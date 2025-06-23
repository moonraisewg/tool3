import { Connection, PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { toast } from "sonner";

export interface SolTransferParams {
  recipientAddress: string;
  amount: string;
}

export interface SolTransferResult {
  signature: string;
  mintAddress: string;  
  recipientAddress: string;
  amount: string;
}

export interface SolTransferOptions {
  memo?: string;
  onStart?: () => void;
  onSuccess?: (signature: string) => void;
  onError?: (error: Error) => void;
  onFinish?: () => void;
}


export const transferSol = async (
  connection: Connection,
  wallet: WalletContextState,
  params: SolTransferParams,
  options: SolTransferOptions = {}
): Promise<SolTransferResult | null> => {
  const { recipientAddress, amount } = params;
  const { onStart, onSuccess, onError, onFinish, memo } = options;
  const { publicKey, sendTransaction } = wallet;

  if (!publicKey || !connection || !sendTransaction) {
    toast.error("Wallet not connected");
    return null;
  }

  try {
    if (onStart) onStart();
    const lamports = BigInt(Math.round(parseFloat(amount) * 1e9));
    
    if (lamports <= BigInt(0)) {
      throw new Error("Invalid SOL amount");
    }

    let recipientPublicKey;
    try {
      recipientPublicKey = new PublicKey(recipientAddress);
    } catch (_err) {
      console.error("Error creating PublicKey:", _err);
      throw new Error("Invalid recipient wallet address");
    }
    
    const transaction = new Transaction();
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: recipientPublicKey,
        lamports: lamports
      })
    );
    if (memo) {
      const memoId = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
      transaction.add({
        keys: [{ pubkey: publicKey, isSigner: true, isWritable: true }],
        programId: memoId,
        data: Buffer.from(memo, "utf-8")
      });
    }

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey; 
    console.log("Sending SOL transfer transaction...");
    const signature = await sendTransaction(transaction, connection, {
      skipPreflight: false,
      preflightCommitment: "confirmed"
    });
    
    console.log("Waiting for confirmation...");
    await connection.confirmTransaction({
      blockhash,
      lastValidBlockHeight,
      signature
    }, "confirmed");
    
    if (onSuccess) onSuccess(signature);
    
    return {
      signature,
      mintAddress: "NativeSOL", 
      recipientAddress, 
      amount
    };
  } catch (error) {
    console.error("Error transferring SOL:", error);
    
    let errorMessage = "An error occurred while transferring SOL";
    
    if (error instanceof Error) {
      if (error.message?.includes("insufficient funds")) {
        errorMessage = "Insufficient balance to complete transaction";
      } else if (error.message?.includes("failed to send transaction")) {
        errorMessage = "Failed to send transaction, please try again";
      }
      
      if (onError) onError(error);
    }
    
    toast.error(errorMessage);
    return null;
  } finally {
    if (onFinish) onFinish();
  }
};

export const transferSolToMultipleRecipients = async (
  connection: Connection,
  wallet: WalletContextState,
  paramsArray: SolTransferParams[],
  options: SolTransferOptions = {}
): Promise<SolTransferResult[] | null> => {
  const { onStart, onSuccess, onError, onFinish, memo } = options;
  const { publicKey, sendTransaction } = wallet;
  
  if (!publicKey || !connection || !sendTransaction) {
    toast.error("Wallet not connected");
    return null;
  }
  
  try {
    if (onStart) onStart();
    
    if (!paramsArray.length) {
      throw new Error("No recipients specified");
    }
    
    const transaction = new Transaction();
    
    for (const params of paramsArray) {
      const { recipientAddress, amount } = params;
      const lamports = BigInt(Math.round(parseFloat(amount) * 1e9));
      
      if (lamports <= BigInt(0)) {
        throw new Error(`Invalid SOL amount for recipient ${recipientAddress}`);
      }
      
      let recipientPublicKey;
      try {
        recipientPublicKey = new PublicKey(recipientAddress);
      } catch (_err) {
        console.error("Error creating PublicKey:", _err);
        throw new Error(`Invalid recipient wallet address: ${recipientAddress}`);
      }
      
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: recipientPublicKey,
          lamports: lamports
        })
      );
    }
    
    if (memo) {
      const memoId = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
      transaction.add({
        keys: [{ pubkey: publicKey, isSigner: true, isWritable: true }],
        programId: memoId,
        data: Buffer.from(memo, "utf-8")
      });
    }
    
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey; 
    
    console.log("Sending multi-SOL transfer transaction...");
    const signature = await sendTransaction(transaction, connection, {
      skipPreflight: false,
      preflightCommitment: "confirmed"
    });
    
    console.log("Waiting for confirmation...");
    await connection.confirmTransaction({
      blockhash,
      lastValidBlockHeight,
      signature
    }, "confirmed");
    
    if (onSuccess) onSuccess(signature);
    
    return paramsArray.map(params => ({
      signature,
      mintAddress: "NativeSOL",
      recipientAddress: params.recipientAddress,
      amount: params.amount
    }));
    
  } catch (error) {
    console.error("Error transferring SOL to multiple recipients:", error);
    
    let errorMessage = "An error occurred while transferring SOL";
    
    if (error instanceof Error) {
      if (error.message?.includes("insufficient funds")) {
        errorMessage = "Insufficient balance to complete transaction";
      } else if (error.message?.includes("failed to send transaction")) {
        errorMessage = "Failed to send transaction, please try again";
      }
      
      if (onError) onError(error);
    }
    
    toast.error(errorMessage);
    return null;
  } finally {
    if (onFinish) onFinish();
  }
}; 