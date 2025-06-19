import { Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";

import { Token } from "solana-token-extension-boost";
export interface TokenBurnParams {
  mintAddress: string;  
  amount: string | number;  
  decimals: number;  
}
export interface TokenBurnResult {
  signature: string;  
  mintAddress: string;  
  amount: string | number;  
}
export interface TokenBurnOptions {
  mintAddress: string;
  amount: string | number;
  decimals: number;
}
export interface TokenBurnCallbacks {
  onStart?: () => void;
  onSuccess?: (signature: string) => void;
  onError?: (error: Error) => void;
  onFinish?: () => void;
}


export async function burnToken(
  connection: Connection,
  wallet: WalletContextState,
  options: TokenBurnOptions,
  callbacks?: TokenBurnCallbacks
): Promise<TokenBurnResult> {
  const { mintAddress, amount, decimals } = options;
  const { onStart, onSuccess, onError, onFinish } = callbacks || {};

  if (!wallet.publicKey) {
    throw new Error("Wallet not connected");
  }

  try {
    if (onStart) onStart();

    const mintPublicKey = new PublicKey(mintAddress);
    const amountValue = typeof amount === 'string' ? parseFloat(amount) : amount;
    const burnAmount = BigInt(Math.floor(amountValue * Math.pow(10, decimals)));
    
    if (burnAmount <= BigInt(0)) {
      throw new Error("Invalid token amount");
    }
    
    const mintInfo = await connection.getAccountInfo(mintPublicKey);
    if (!mintInfo) {
      throw new Error("Token mint not found");
    }
    
    const tokenAccounts = await connection.getTokenAccountsByOwner(
      wallet.publicKey,
      { mint: mintPublicKey }
    );
    
    if (tokenAccounts.value.length === 0) {
      throw new Error("No token account found for this token");
    }
    
    const tokenAccount = tokenAccounts.value[0].pubkey;
    
    const token = new Token(connection, mintPublicKey);
    
    const { instructions } = token.createBurnInstructions(
      tokenAccount,        
      wallet.publicKey,     
      burnAmount,           
      decimals              
    );
    
    const transaction = new Transaction();
    
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    
    instructions.forEach((ix: TransactionInstruction) => transaction.add(ix));
    
    const signature = await wallet.sendTransaction(
      transaction,
      connection,
      { skipPreflight: false, preflightCommitment: 'confirmed' }
    );
    
    await connection.confirmTransaction({
      blockhash,
      lastValidBlockHeight,
      signature
    }, 'confirmed');
    
    console.log("Token burn successful with signature:", signature);
    
    if (onSuccess) onSuccess(signature);
    
    return {
      signature,
      mintAddress,
      amount
    };
  } catch (error) {
    console.error("Error burning token:", error);
    if (error instanceof Error && onError) {
      onError(error);
    } else if (onError) {
      onError(new Error(String(error)));
    }
    throw error;
  } finally {
    if (onFinish) onFinish();
  }
} 