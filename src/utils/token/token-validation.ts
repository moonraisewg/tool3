export function validatePublicKey(value: string): { valid: boolean, message?: string } {
  if (!value || value.trim() === '') {
    return { valid: false, message: "Public key cannot be empty" };
  }
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  if (!base58Regex.test(value)) {
    return { valid: false, message: "Public key format is invalid" };
  }
  
  return { valid: true };
}

export function validateBasicTokenData(tokenData: {
  name: string;
  symbol: string;
  decimals: string | number;
  supply: string | number;
  imageUrl?: string;
}, hasMetadataExtension: boolean = true): {
  isValid: boolean;
  errors: {
    name?: string;
    symbol?: string;
    decimals?: string;
    supply?: string;
    image?: string;
  }
} {
  const errors: {
    name?: string;
    symbol?: string;
    decimals?: string;
    supply?: string;
    image?: string;
  } = {};
  let isValid = true;
  
  if (hasMetadataExtension) {
    if (!tokenData.name.trim()) {
      errors.name = "Token name is required";
      isValid = false;
    }
    
    if (!tokenData.symbol.trim()) {
      errors.symbol = "Token symbol is required";
      isValid = false;
    } else if (tokenData.symbol.length > 10) {
      errors.symbol = "Token symbol must not exceed 10 characters";
      isValid = false;
    }
  }

  if (!tokenData.decimals) {
    errors.decimals = "Decimals are required";
    isValid = false;
  } else {
    const decimalsNum = Number(tokenData.decimals);
    if (isNaN(decimalsNum) || decimalsNum < 0 || decimalsNum > 9) {
      errors.decimals = "Decimals must be a number between 0-9";
      isValid = false;
    }
  }
  
  if (!tokenData.supply) {
    errors.supply = "Token supply is required";
    isValid = false;
  } else {
    const supplyNum = Number(tokenData.supply);
    if (isNaN(supplyNum) || supplyNum <= 0) {
      errors.supply = "Token supply must be greater than 0";
      isValid = false;
    }
  }
  
  if (hasMetadataExtension && !tokenData.imageUrl) {
    errors.image = "You must upload an image for the token";
    isValid = false;
  }
  
  return { isValid, errors };
}

export interface ExtensionField {
  id: string;
  label: string;
  required: boolean;
}

export const requiredExtensionFields: Record<string, ExtensionField[]> = {
  "transfer-fees": [
    { id: "fee-receiver", label: "Fee Receiver Address", required: true },
    { id: "max-fee", label: "Maximum Fee", required: true },
    { id: "fee-percentage", label: "Fee Percentage", required: true }
  ],
  "permanent-delegate": [
    { id: "delegate-address", label: "Delegate Address", required: true }
  ],
  "mint-close-authority": [
    { id: "close-authority", label: "Close Authority Address", required: true }
  ],
  "transfer-hook": [
    { id: "program-id", label: "Program ID", required: true }
  ]
};

interface ExtensionOptions {
  [extensionId: string]: Record<string, string | number | undefined> | undefined;
}

export function checkExtensionRequiredFields(extensions: string[], extensionOptions: ExtensionOptions): { 
  valid: boolean; 
  missingFields: Record<string, string[]>;
} {
  const missingFields: Record<string, string[]> = {};
  let valid = true;
  
  for (const extensionId of extensions) {
    const requiredFields = requiredExtensionFields[extensionId];
    if (!requiredFields) continue;
    
    for (const field of requiredFields) {
      if (field.required) {
        const value = extensionOptions[extensionId]?.[field.id];
        
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          if (!missingFields[extensionId]) {
            missingFields[extensionId] = [];
          }
          missingFields[extensionId].push(field.label);
          valid = false;
        } 
    
        else if ((field.id === "fee-receiver" || field.id === "delegate-address" || 
                 field.id === "close-authority" || field.id === "program-id") && 
                 typeof value === 'string') {
          const validation = validatePublicKey(value);
          if (!validation.valid) {
            if (!missingFields[extensionId]) {
              missingFields[extensionId] = [];
            }
            missingFields[extensionId].push(`${field.label} (${validation.message})`);
            valid = false;
          }
        }
      }
    }
  }
  
  return { valid, missingFields };
} 