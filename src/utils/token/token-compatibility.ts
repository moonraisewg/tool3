
export const incompatibleExtensionPairs: [string, string][] = [
  ["transfer-fees", "non-transferable"],
  ["non-transferable", "transfer-hook"],
  ["confidential-transfer", "transfer-fees"],
  ["confidential-transfer", "transfer-hook"],
  ["confidential-transfer", "permanent-delegate"],
  ["confidential-transfer", "non-transferable"]
];


export function isCompatibleExtension(extensionId: string, selectedExtensions: string[]): { 
  compatible: boolean; 
  incompatibleWith?: string 
} {
  for (const selectedExt of selectedExtensions) {
    const pair1 = [extensionId, selectedExt] as [string, string];
    const pair2 = [selectedExt, extensionId] as [string, string];
    
    const isIncompatible = incompatibleExtensionPairs.some(
      pair => (pair[0] === pair1[0] && pair[1] === pair1[1]) || 
              (pair[0] === pair2[0] && pair[1] === pair2[1])
    );
    
    if (isIncompatible) {
      return { compatible: false, incompatibleWith: selectedExt };
    }
  }
  
  return { compatible: true };
}

export function checkExtensionsCompatibility(extensions: string[]): { 
  compatible: boolean; 
  incompatiblePairs?: [string, string][] 
} {
  const incompatiblePairs: [string, string][] = [];
  
  for (let i = 0; i < extensions.length; i++) {
    for (let j = i + 1; j < extensions.length; j++) {
      const ext1 = extensions[i];
      const ext2 = extensions[j];
      const isIncompatible = incompatibleExtensionPairs.some(
        pair => (pair[0] === ext1 && pair[1] === ext2) || 
                (pair[0] === ext2 && pair[1] === ext1)
      );
      
      if (isIncompatible) {
        incompatiblePairs.push([ext1, ext2]);
      }
    }
  }
  
  return { 
    compatible: incompatiblePairs.length === 0,
    incompatiblePairs: incompatiblePairs.length > 0 ? incompatiblePairs : undefined
  };
} 