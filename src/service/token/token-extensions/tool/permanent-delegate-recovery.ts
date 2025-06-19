import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getAccount,
  createAssociatedTokenAccountInstruction
} from "@solana/spl-token";

import { determineTokenProgram } from "./transfer-token-extension";

export interface PermanentDelegateRecoveryParams {
  sourceWalletAddress: string;
  mintAddress: string;
  amount: string;
  decimals: number;
}

export interface PermanentDelegateRecoveryOptions {
  onStart?: () => void;
  onSuccess?: (signature: string) => void;
  onError?: (error: Error) => void;
  onFinish?: () => void;
  memo?: string;
}

export interface PermanentDelegateRecoveryResult {
  signature: string;
  tokenAccount: string;
  amount: string;
  mintAddress: string;
  message?: string;
}

/**
 * Thu hồi token bằng permanent delegate
 */
export async function permanentDelegateRecovery(
  connection: Connection,
  wallet: WalletContextState,
  params: PermanentDelegateRecoveryParams,
  options: PermanentDelegateRecoveryOptions = {}
): Promise<PermanentDelegateRecoveryResult | null> {
  const { sourceWalletAddress, mintAddress, amount, decimals } = params;
  const { onStart, onSuccess, onError, onFinish, memo } = options;
  
  if (!wallet.publicKey) {
    toast.error("Wallet not connected");
    return null;
  }
  
  try {
    if (onStart) onStart();
    console.log("Starting permanent delegate recovery...");
    
    const mintPubkey = new PublicKey(mintAddress);
    const sourceWalletPubkey = new PublicKey(sourceWalletAddress);
    const delegatePubkey = wallet.publicKey;
    
    console.log("Wallet đang thực hiện quyền permanent delegate:", delegatePubkey.toString());
    
    const tokenProgram = await determineTokenProgram(connection, mintPubkey);
    
    const sourceTokenAccount = getAssociatedTokenAddressSync(
      mintPubkey,
      sourceWalletPubkey,
      false,
      tokenProgram
    );
    
    console.log("Source token account:", sourceTokenAccount.toString());
    
    const transaction = new Transaction();
    
      let sourceAccountExists = false;
    try {
      const sourceAccount = await getAccount(
        connection,
        sourceTokenAccount,
        "confirmed",
        tokenProgram
      );
      console.log("Source account balance:", sourceAccount.amount.toString());
      sourceAccountExists = true;
    } catch {
      console.log("Source account does not exist, will create it...");
      
      const createSourceAccountIx = createAssociatedTokenAccountInstruction(
        wallet.publicKey,          
        sourceTokenAccount,        
        sourceWalletPubkey,        
        mintPubkey,                
        tokenProgram               
      );
      
      transaction.add(createSourceAccountIx);
    }
    
    const destinationTokenAccount = getAssociatedTokenAddressSync(
      mintPubkey,
      delegatePubkey,
      false,
      tokenProgram
    );
    
    console.log("Destination token account:", destinationTokenAccount.toString());
    
    try {
      await getAccount(
        connection,
        destinationTokenAccount,
        "confirmed",
        tokenProgram
      );
      console.log("Destination account exists");
    } catch {
      console.log("Destination account does not exist, will create it...");
      
      const createDestAccountIx = createAssociatedTokenAccountInstruction(
        wallet.publicKey,          
        destinationTokenAccount,   
        delegatePubkey,            
        mintPubkey,                
        tokenProgram               
      );
      
      transaction.add(createDestAccountIx);
    }
    
    if (!sourceAccountExists) {
      toast.warning("Source account was just created. You need to mint tokens to it first.");
      
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;
      
      const signature = await wallet.sendTransaction(transaction, connection);
      
      await connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature
      }, "confirmed");
      
      console.log("Account creation transaction:", signature);
      
      if (onSuccess) onSuccess(signature);
      
      return {
        signature,
        tokenAccount: sourceTokenAccount.toString(),
        amount: "0",
        mintAddress,
        message: "Source account created. Please mint tokens to it before transferring."
      };
    }
    
    const amountToTransfer = BigInt(Math.floor(parseFloat(amount) * (10 ** decimals)));
    console.log(`Amount to transfer: ${amountToTransfer.toString()}, decimals: ${decimals}`);
    
    const transferInstruction = createTransferCheckedInstruction(
      sourceTokenAccount,
      mintPubkey,
      destinationTokenAccount,
      delegatePubkey, 
      amountToTransfer, 
      decimals,
      [],
      tokenProgram
    );
    
    transaction.add(transferInstruction);
    
    if (memo) {
      const memoId = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
      transaction.add({
        keys: [{ pubkey: wallet.publicKey, isSigner: true, isWritable: true }],
        programId: memoId,
        data: Buffer.from(memo, "utf-8")
      });
    }
    
      console.log("Sending transaction...");
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    
    const signature = await wallet.sendTransaction(transaction, connection, {
      skipPreflight: false,
      preflightCommitment: "confirmed"
    });
    
    await connection.confirmTransaction({
      blockhash,
      lastValidBlockHeight,
      signature
    }, "confirmed");
    
    console.log("Transaction successful:", signature);
    
    if (onSuccess) onSuccess(signature);
    
    return {
      signature,
      tokenAccount: destinationTokenAccount.toString(),
      amount,
      mintAddress
    };
  } catch (error: unknown) {
    console.error("Error in permanent delegate recovery:", error);
    
    let errorMessage = "An error occurred during token recovery";
    
    if (error instanceof Error) {
      if (error.message?.includes("insufficient funds")) {
        errorMessage = "Insufficient balance to complete transaction";
      } else if (error.message?.includes("invalid account owner")) {
        errorMessage = "Invalid account owner";
      } else if (error.message?.includes("failed to send transaction")) {
        errorMessage = "Failed to send transaction, please try again";
      } else if (error.message?.includes("not a delegate")) {
        errorMessage = "Your wallet is not a permanent delegate for this token";
      } else {
        errorMessage = error.message;
      }
      
      if (onError) onError(error);
    }
    
    toast.error(errorMessage);
    return null;
  } finally {
    if (onFinish) onFinish();
  }
} 