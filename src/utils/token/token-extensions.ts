import { Connection, PublicKey } from "@solana/web3.js";
import { 
  TOKEN_2022_PROGRAM_ID, 
} from "@solana/spl-token";

export interface TokenExtensionInfo {
  isToken2022: boolean;
  hasTransferFee: boolean;
  feePercentage?: number;
  feeDecimals?: number;
  feeBasisPoints?: number;
  maxFee?: string;
  hasNonTransferable: boolean;
  hasPermanentDelegate: boolean;
  delegateAddress?: string;
  hasDefaultAccount: boolean;
  defaultAccountAddress?: string;
  hasMetadata: boolean;
  name?: string;
  symbol?: string;
  uri?: string;
}




export async function isToken2022(connection: Connection, mintAddress: string | PublicKey): Promise<boolean> {
  try {
    const mintPublicKey = typeof mintAddress === 'string' ? new PublicKey(mintAddress) : mintAddress;
    const mintInfo = await connection.getAccountInfo(mintPublicKey);
    
    if (!mintInfo) return false;
    
    return mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID);
  } catch (error) {
    console.error("Error checking if token is Token-2022:", error);
    return false;
  }
}


export function getExtensionSummary(extensionInfo: TokenExtensionInfo): string {
  const extensions = [];
  
  if (extensionInfo.hasTransferFee) {
    extensions.push(`Transfer Fee: ${extensionInfo.feePercentage}%`);
  }
  if (extensionInfo.hasNonTransferable) {
    extensions.push('Non-Transferable');
  }
  if (extensionInfo.hasPermanentDelegate) {
    extensions.push('Permanent Delegate');
  }
  if (extensionInfo.hasDefaultAccount) {
    extensions.push('Default Account');
  }
  if (extensionInfo.hasMetadata) {
    extensions.push('Metadata');
  }
  if (extensions.length === 0) return 'No extensions'; 
  return extensions.join(', ');
}
