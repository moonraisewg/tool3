import { useState } from "react";
import { toast } from "sonner";
import { uploadImageAndGetUrl } from "@/utils/pinata";
import { validateBasicTokenData, checkExtensionRequiredFields } from "@/utils/token/token-validation";
import { isCompatibleExtension } from "@/utils/token/token-compatibility";

export type TextOptionType = {
  id: string
  label: string
  type: "text"
  placeholder: string
  required?: boolean
  validator?: (value: string) => { valid: boolean, message?: string }
}

export type SliderOptionType = {
  id: string
  label: string
  type: "slider"
  min: number
  max: number
  step: number
  defaultValue: number
}

export type SelectOptionType = {
  id: string
  label: string
  type: "select"
  options: Array<{value: string, label: string}>
  defaultValue: string
}

export type OptionType = TextOptionType | SliderOptionType | SelectOptionType

export type TokenExtensionType = {
  id: string
  icon: React.ElementType
  name: string
  description: string
  color: string
  bgColor: string
  options: OptionType[]
  isRequired?: boolean
  disabled?: boolean
  disabledReason?: string
}


export function useTokenCreation() {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExtensions, setSelectedExtensions] = useState<string[]>(["metadata", "metadata-pointer"]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, Record<string, string>>>({});
  const [activeTab, setActiveTab] = useState<string>("metadata");
  const [formErrors, setFormErrors] = useState<{
    name?: string;
    symbol?: string;
    decimals?: string;
    supply?: string;
    image?: string;
  }>({});
  const [tokenData, setTokenData] = useState({
    name: "",
    symbol: "",
    decimals: "9",
    supply: "1000000",
    description: "",
    image: null as File | null,
    imageUrl: "",
    extensionOptions: {} as Record<string, Record<string, string | number | undefined>>,
    websiteUrl: "",
    twitterUrl: "",
    telegramUrl: "",
    discordUrl: ""
  });

  const toggleExtension = (extensionId: string, tokenExtensions: TokenExtensionType[]) => {
    const extension = tokenExtensions.find(ext => ext.id === extensionId);
    if (extension?.isRequired) {
      return;
    }
    if (extension?.disabled) {
      toast.error(`Cannot use ${extension.name} feature: ${extension.disabledReason}`);
      return;
    }
    
    if (selectedExtensions.includes(extensionId)) {

      setSelectedExtensions(prev => prev.filter(id => id !== extensionId));
      if (activeTab === extensionId) {
        const remainingExtensions = selectedExtensions.filter(id => id !== extensionId);
        if (remainingExtensions.length > 0) {
          setActiveTab(remainingExtensions[0]);
        } else {
          setActiveTab("metadata"); 
        }
      }
    } else {
      const compatibility = isCompatibleExtension(extensionId, selectedExtensions);
      if (!compatibility.compatible) {
        const incompatibleExt = tokenExtensions.find(ext => ext.id === compatibility.incompatibleWith);
        toast.error(`${extension?.name} is not compatible with the selected ${incompatibleExt?.name}`);
        return;
      }
      
      setSelectedExtensions(prev => [...prev, extensionId]);    
      if (extensionId === "transfer-fees") {
        const transferFeeExt = tokenExtensions.find(ext => ext.id === "transfer-fees");
        if (transferFeeExt) {
          const feePercentageOption = transferFeeExt.options.find(opt => opt.id === "fee-percentage");
          if (feePercentageOption && feePercentageOption.type === "slider") {
            setTokenData(prev => ({
              ...prev,
              extensionOptions: {
                ...prev.extensionOptions,
                "transfer-fees": {
                  ...(prev.extensionOptions["transfer-fees"] || {}),
                  "fee-percentage": (feePercentageOption as SliderOptionType).defaultValue,
                  "max-fee": "1.0",
                  "fee-receiver": ""
                }
              }
            }));
          }
        }
      }
      setActiveTab(extensionId);
    }
  };

  const updateExtensionOption = (extensionId: string, optionId: string, value: string | number) => {
    setTokenData(prev => ({
      ...prev,
      extensionOptions: {
        ...prev.extensionOptions,
        [extensionId]: {
          ...(prev.extensionOptions[extensionId] || {}),
          [optionId]: value
        }
      }
    }));
    if (extensionId === "transfer-fees" && optionId === "fee-percentage") {
      const feePercentage = parseFloat(value.toString());
      if (isNaN(feePercentage) || feePercentage < 0) {
        setValidationErrors(prev => ({
          ...prev,
          [extensionId]: {
            ...(prev[extensionId] || {}),
            [optionId]: 'Transfer fee cannot be less than 0%'
          }
        }));
      } else if (feePercentage > 10) {
        setValidationErrors(prev => ({
          ...prev,
          [extensionId]: {
            ...(prev[extensionId] || {}),
            [optionId]: 'Transfer fee cannot be greater than 10%'
          }
        }));
      } else {
        if (validationErrors[extensionId]?.[optionId]) {
          setValidationErrors(prev => {
            const newErrors = { ...prev };
            if (newErrors[extensionId]) {
              delete newErrors[extensionId][optionId];
            }
            return newErrors;
          });
        }
      }
    }
    
    if (validationErrors[extensionId]?.[optionId]) {
      setValidationErrors(prev => ({
        ...prev,
        [extensionId]: {
          ...(prev[extensionId] || {}),
          [optionId]: ''
        }
      }));
      
      const extension = tokenExtensions.find(ext => ext.id === extensionId);
      const option = extension?.options.find(opt => opt.id === optionId);
      
      if (option && option.type === 'text' && (option as TextOptionType).validator) {
        const textOption = option as TextOptionType;
        const validation = textOption.validator!(value.toString());
        
        if (!validation.valid) {
          setValidationErrors(prev => ({
            ...prev,
            [extensionId]: {
              ...(prev[extensionId] || {}),
              [optionId]: validation.message || 'Invalid value'
            }
          }));
        }
      }
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file || !(file instanceof File)) {
      toast.error("No valid file selected");
      return;
    }

    setUploadingImage(true);

    try {
      const imageUrl = await uploadImageAndGetUrl(file, `token-${tokenData.name.toLowerCase()}`);    
      setTokenData(prev => ({
        ...prev,
        image: file,
        imageUrl: imageUrl
      }));
      if (formErrors.image) {
        setFormErrors({...formErrors, image: undefined});
      }

      toast.success("Image uploaded successfully");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
      setFormErrors({...formErrors, image: "Could not upload image, please try again"});
    } finally {
      setUploadingImage(false);
    }
  };
  const validateTokenData = (): boolean => {
    const basicValidation = validateBasicTokenData({
      name: tokenData.name,
      symbol: tokenData.symbol,
      decimals: tokenData.decimals,
      supply: tokenData.supply,
      imageUrl: tokenData.imageUrl
    });
    
    setFormErrors(basicValidation.errors);
    const extensionValidation = checkExtensionRequiredFields(selectedExtensions, tokenData.extensionOptions);
    setValidationErrors(
      Object.fromEntries(
        Object.entries(extensionValidation.missingFields).map(([extId, fields]) => [
          extId,
          Object.fromEntries(fields.map(field => [field, `${field} is required`]))
        ])
      )
    );
    
    if (!basicValidation.isValid) {
      toast.error("Please enter all required basic information for the token");
    } else if (!extensionValidation.valid) {
      toast.error("Please enter all required information for the selected extensions");
    }
    
    return basicValidation.isValid && extensionValidation.valid;
  };
  const handleCreateToken = () => {
    if (!validateTokenData()) {
      return;
    }
    if (typeof window !== 'undefined') {
      const dataToSave = {
        name: tokenData.name,
        symbol: tokenData.symbol,
        decimals: tokenData.decimals,
        supply: tokenData.supply,
        description: tokenData.description,
        extensionOptions: tokenData.extensionOptions,
        selectedExtensions,
        imageUrl: tokenData.imageUrl,
        websiteUrl: tokenData.websiteUrl,
        twitterUrl: tokenData.twitterUrl,
        telegramUrl: tokenData.telegramUrl,
        discordUrl: tokenData.discordUrl
      };
      localStorage.setItem('tokenData', JSON.stringify(dataToSave));
      
    
      const currentUrl = new URL(window.location.href);
      const cluster = currentUrl.searchParams.get('cluster');
      const redirectUrl = cluster ? `/create/review?cluster=${cluster}` : '/create/review';
      
      window.location.href = redirectUrl;
    }
  };
  const initializeTokenData = () => {
    const loadData = async () => {
      setIsLoading(false);
    };
    
    loadData();
  };

  return {
    isLoading,
    setIsLoading,
    selectedExtensions,
    setSelectedExtensions,
    uploadingImage,
    validationErrors,
    activeTab,
    setActiveTab,
    formErrors,
    tokenData,
    setTokenData,
    

    toggleExtension,
    updateExtensionOption,
    handleImageUpload,
    validateTokenData,
    handleCreateToken,
    initializeTokenData
  };
}

export const tokenExtensions: TokenExtensionType[] = [
  {
    id: "metadata",
    icon: () => null,
    name: "Token Metadata",
    description: "Metadata embedded directly into the token (always enabled)",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    options: [],
    isRequired: true
  },
  {
    id: "metadata-pointer",
    icon: () => null,
    name: "Metadata Pointer",
    description: "Link metadata with token (always enabled)",
    color: "text-pink-400",
    bgColor: "bg-pink-400/10",
    options: [],
    isRequired: true
  },
  {
    id: "transfer-fees",
    icon: () => null,
    name: "Transfer Fees",
    description: "Automatically collect fees for each token transfer transaction",
    color: "text-green-400",
    bgColor: "bg-green-400/10",
    options: [
      { id: "fee-percentage", label: "Fee Percentage", type: "slider", min: 0, max: 10, step: 0.1, defaultValue: 1 },
      { 
        id: "max-fee", 
        label: "Maximum Fee (tokens)", 
        type: "text", 
        placeholder: "Enter maximum fee per transaction (e.g. 1.0)",
        required: true
      },
      { 
        id: "fee-receiver", 
        label: "Fee Receiver Address", 
        type: "text", 
        placeholder: "Enter fee receiver public key",
        required: true,
        validator: (value: string) => {
          if (!value || value.trim() === '') {
            return { valid: false, message: "Public key cannot be empty" };
          }
          
          const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
          if (!base58Regex.test(value)) {
            return { valid: false, message: "Public key format is invalid" };
          }
          
          return { valid: true };
        }
      }
    ]
  },
  {
    id: "confidential-transfer",
    icon: () => null,
    name: "Confidential Transfer",
    description: "Secure transaction information with zero-knowledge proofs",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    options: [],
    disabled: true,
    disabledReason: "Currently in development, not ready for use yet"
  },
  {
    id: "permanent-delegate",
    icon: () => null,
    name: "Permanent Delegate",
    description: "Assign a permanent delegate for the token",
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
    options: [
      { 
        id: "delegate-address", 
        label: "Delegate Address", 
        type: "text", 
        placeholder: "Enter delegate public key",
        required: true,
        validator: (value: string) => {
          if (!value || value.trim() === '') {
            return { valid: false, message: "Public key cannot be empty" };
          }
          
          const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
          if (!base58Regex.test(value)) {
            return { valid: false, message: "Public key format is invalid" };
          }
          
          return { valid: true };
        }
      }
    ]
  },
  {
    id: "non-transferable",
    icon: () => null,
    name: "Non-Transferable",
    description: "Create tokens that cannot be transferred",
    color: "text-red-400",
    bgColor: "bg-red-400/10",
    options: []
  },
  {
    id: "interest-bearing",
    icon: () => null,
    name: "Interest Bearing",
    description: "Tokens that automatically generate interest over time",
    color: "text-orange-400",
    bgColor: "bg-orange-400/10",
    options: [
      { id: "interest-rate", label: "Annual Interest Rate (%)", type: "slider", min: 0, max: 20, step: 0.1, defaultValue: 5 }
    ]
  },
  {
    id: "default-account-state",
    icon: () => null,
    name: "Default Account State",
    description: "Set default state for all accounts of this token (always frozen)",
    color: "text-cyan-400",
    bgColor: "bg-cyan-400/10",
    options: [
      {
        id: "freeze-authority",
        label: "Freeze Authority Address",
        type: "text",
        placeholder: "Enter freeze authority public key (defaults to your wallet)",
        validator: (value: string) => {
          if (value && value.trim() !== '') {
            const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
            if (!base58Regex.test(value)) {
              return { valid: false, message: "Public key format is invalid" };
            }
          }
          
          return { valid: true };
        }
      }
    ]
  },
  {
    id: "mint-close-authority",
    icon: () => null,
    name: "Mint Close Authority",
    description: "Authority allowed to close this mint",
    color: "text-pink-600",
    bgColor: "bg-pink-600/10",
    options: [
      { 
        id: "close-authority", 
        label: "Close Authority Address", 
        type: "text", 
        placeholder: "Enter close authority public key",
        required: true,
        validator: (value: string) => {
          if (!value || value.trim() === '') {
            return { valid: false, message: "Public key cannot be empty" };
          }
          
          const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
          if (!base58Regex.test(value)) {
            return { valid: false, message: "Public key format is invalid" };
          }
          
          return { valid: true };
        }
      }
    ]
  },
  {
    id: "transfer-hook",
    icon: () => null,
    name: "Transfer Hook",
    description: "Execute custom program logic on every token transfer",
    color: "text-indigo-500",
    bgColor: "bg-indigo-500/10",
    options: [
      { 
        id: "program-id", 
        label: "Transfer Hook Program ID", 
        type: "text", 
        placeholder: "Enter program ID of the transfer hook",
        required: true,
        validator: (value: string) => {
          if (!value || value.trim() === '') {
            return { valid: false, message: "Public key cannot be empty" };
          }
          
          const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
          if (!base58Regex.test(value)) {
            return { valid: false, message: "Public key format is invalid" };
          }
          
          return { valid: true };
        }
      }
    ]
  }
]; 