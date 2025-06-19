import { useState } from "react";
import { toast } from "sonner";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { isCompatibleExtension } from "@/utils/token/token-compatibility";
import { checkExtensionRequiredFields } from "@/utils/token/token-validation";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

import { 
  TextOptionType, 
  TokenExtensionType 
} from "./token-creation";

export const updatableTokenExtensions: TokenExtensionType[] = [
  {
    id: "memo-transfer",
    icon: () => null,
    name: "Required Memo on Transfer",
    description: "Require all transfers to this account to include a memo instruction",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    options: [] 
  },
  {
    id: "cpi-guard",
    icon: () => null,
    name: "CPI Guard",
    description: "Prevent Cross-Program Invocation of token instructions from other programs",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    options: [] 
  }
];

interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  supply: string;
  existingExtensions: string[];
}

export interface TokenExtensionUpdateData {
  mintAddress: string;
  extensionOptions: Record<string, Record<string, string | number | undefined>>;
}

export function useTokenExtensionUpdate() {
  const { connection } = useConnection();
  const wallet = useWallet();
  
  const [isLoading, setIsLoading] = useState(false);
  const [selectedExtensions, setSelectedExtensions] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, Record<string, string>>>({});
  const [activeTab, setActiveTab] = useState<string>("");
  const [mintAddress, setMintAddress] = useState<string>("");
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [extensionOptions, setExtensionOptions] = useState<Record<string, Record<string, string | number | undefined>>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [transactionSignature, setTransactionSignature] = useState<string | null>(null);
  const [explorerLinks, setExplorerLinks] = useState<{
    transaction: string | null;
    tokenAccount: string | null;
  }>({ transaction: null, tokenAccount: null });

  const toggleExtension = (extensionId: string, tokenExtensions: TokenExtensionType[]) => {
    const extension = tokenExtensions.find(ext => ext.id === extensionId);
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
          setActiveTab(""); 
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
      
      if (extensionId === "memo-transfer") {
        setExtensionOptions(prev => ({
          ...prev,
          "memo-transfer": {}
        }));
      } else if (extensionId === "cpi-guard") {
        setExtensionOptions(prev => ({
          ...prev,
          "cpi-guard": {}
        }));
      }
      
      setActiveTab(extensionId);
    }
  };

  const updateExtensionOption = (extensionId: string, optionId: string, value: string | number) => {
    setExtensionOptions(prev => ({
      ...prev,
      [extensionId]: {
        ...(prev[extensionId] || {}),
        [optionId]: value
      }
    }));
    
    if (validationErrors[extensionId]?.[optionId]) {
      setValidationErrors(prev => ({
        ...prev,
        [extensionId]: {
          ...(prev[extensionId] || {}),
          [optionId]: ''
        }
      }));
      
      const extension = updatableTokenExtensions.find(ext => ext.id === extensionId);
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

  const validateMintAddress = async (address: string): Promise<boolean> => {
    try {
      if (!address || address.trim() === '') {
        toast.error("Please enter a token mint address");
        return false;
      }
      
      try {
        new PublicKey(address);
      } catch {
        toast.error("Invalid token mint address format");
        return false;
      }
      
      setIsLoading(true);
      
      setTimeout(() => {
        setTokenInfo({
          name: "Example Token",
          symbol: "EXT",
          decimals: 9,
          supply: "1000000",
          existingExtensions: []
        });
        setIsLoading(false);
      }, 1000);
      
      return true;
    } catch {
      console.error("Error validating mint address");
      toast.error("Failed to validate token mint address");
      setIsLoading(false);
      return false;
    }
  };

  const validateUpdateData = (): boolean => {
    const extensionValidation = checkExtensionRequiredFields(selectedExtensions, extensionOptions);
    
    setValidationErrors(
      Object.fromEntries(
        Object.entries(extensionValidation.missingFields).map(([extId, fields]) => [
          extId,
          Object.fromEntries(fields.map(field => [field, `${field} is required`]))
        ])
      )
    );
    
    if (!extensionValidation.valid) {
      toast.error("Please enter all required information for the selected extensions");
      return false;
    }
    
    if (selectedExtensions.length === 0) {
      toast.error("Please select at least one extension to update");
      return false;
    }
    
    return true;
  };

  const handleUpdateExtensions = async () => {
    if (!wallet.connected || !connection) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!wallet.publicKey) {
      toast.error("Wallet public key not available");
      return;
    }

    if (!wallet.signTransaction) {
      toast.error("Wallet does not support transaction signing");
      return;
    }
    
    if (!mintAddress) {
      toast.error("Please enter a token mint address");
      return;
    }
    
    if (!validateUpdateData()) {
      return;
    }
    
    setIsUpdating(true);
    setUpdateError(null);
    
    try {
      const toastId = toast.loading("Preparing extension update...");
      
      const requestData = {
        walletPublicKey: wallet.publicKey.toString(),
        mintAddress: mintAddress,
        selectedExtensions,
        extensionOptions
      };
      
      const response = await fetch("/api/update-extensions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create update transaction");
      }

      const updateData = await response.json();
      toast.dismiss(toastId);
      
      const transactionBuffer = Buffer.from(updateData.transaction, "base64");
      const transaction = Transaction.from(transactionBuffer);
      
      const signedTransaction = await wallet.signTransaction(transaction);
      const toastId2 = toast.loading("Updating token extensions...");
      
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      await connection.confirmTransaction({
        blockhash: updateData.blockhash,
        lastValidBlockHeight: updateData.lastValidBlockHeight,
        signature
      }, 'confirmed');
      
      toast.dismiss(toastId2);
      toast.success("Token extensions updated successfully!");
      
      setTransactionSignature(signature);
      setUpdateSuccess(true);
      
      const tokenAccount = getAssociatedTokenAddressSync(
        new PublicKey(mintAddress),
        wallet.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      
      setExplorerLinks({
        transaction: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
        tokenAccount: `https://explorer.solana.com/address/${tokenAccount.toString()}?cluster=devnet`
      });
      
    } catch (error) {
      console.error("Error updating token extensions:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setUpdateError(errorMessage);
      toast.error(`Failed to update token extensions: ${errorMessage}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    isLoading,
    selectedExtensions,
    setSelectedExtensions,
    validationErrors,
    activeTab,
    setActiveTab,
    mintAddress,
    setMintAddress,
    tokenInfo,
    extensionOptions,
    isUpdating,
    updateSuccess,
    updateError,
    transactionSignature,
    explorerLinks,
    
    toggleExtension,
    updateExtensionOption,
    validateMintAddress,
    handleUpdateExtensions
  };
} 