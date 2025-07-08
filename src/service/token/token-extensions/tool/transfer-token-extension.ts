import { Connection, PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { 
 
  createTransferCheckedInstruction
} from "@solana/spl-token";

import { getTokenProgram } from "@/lib/helper";
import { Token } from "solana-token-extension-boost";

export interface TokenTransferParams {
    mintAddress: string;  
    recipientAddress: string;  
    amount: string;  
    decimals: number;  
  }

  export interface TokenTransferOptions {
    onStart?: () => void;
    onSuccess?: (signature: string) => void;
    onError?: (error: Error) => void;
    onFinish?: () => void;
    memo?: string;
    feeRecipientAddress?: string;
    feePerRecipient?: number;
  }

export interface TokenTransferResult {
  signature: string;
  mintAddress: string;
  recipientAddress: string;
  amount: string;
}

export const transferToken = async (
    connection: Connection,
    wallet: WalletContextState,
    params: TokenTransferParams,
    options: TokenTransferOptions = {}
  ): Promise<TokenTransferResult | null> => {
    const { mintAddress, recipientAddress, amount, decimals } = params;
    const { onStart, onSuccess, onError, onFinish, memo, feeRecipientAddress, feePerRecipient = 0.006 } = options;
    const { publicKey, sendTransaction } = wallet;
    
    if (!publicKey || !connection || !sendTransaction) {
      toast.error("Wallet not connected");
      return null;
    }
    
    try {
      if (onStart) onStart();
      const amountToSend = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals)));
      
      if (amountToSend <= BigInt(0)) {
        throw new Error("Invalid token amount");
      }
      
      console.log("Mint address:", mintAddress);
      console.log("Recipient address:", recipientAddress);
      
      let mintPublicKey, recipientPublicKey;
      try {
        mintPublicKey = new PublicKey(mintAddress);
      } catch (err) {
        console.error("Error converting mint address:", err);
        throw new Error("Invalid token mint address");
      }
      
      try {
        recipientPublicKey = new PublicKey(recipientAddress);
      } catch (err) {
        console.error("Error converting recipient address:", err);
        throw new Error("Invalid recipient wallet address");
      }
      
      const tokenProgram = await determineTokenProgram(connection, mintPublicKey);
      
      const token = new Token(connection, mintPublicKey);
      
      console.log("Token class methods:", Object.getOwnPropertyNames(Token.prototype));
      console.log("Token instance:", token);
      
      console.log("Getting source token account...");
      let sourceTokenAccount;
      
      try {
        const sourceAssociatedAddress = await token.getAssociatedAddress(
          publicKey,
          false
        );
        
        const sourceAccountInfo = await connection.getAccountInfo(sourceAssociatedAddress);
        
        if (!sourceAccountInfo) {
          throw new Error("Your token account does not exist. Please create a token account first.");
        }
        
        console.log("Source token account exists:", sourceAssociatedAddress.toString());
        sourceTokenAccount = sourceAssociatedAddress;
      } catch (err) {
        console.error("Error checking source token account:", err);
        throw new Error("Source token account not found. You need to have tokens in your wallet before transferring.");
      }
      
      console.log("Getting or creating destination token account...");
      const destinationAssociatedAddress = await token.getAssociatedAddress(
        recipientPublicKey,
        false
      );
      
      const destinationAccountInfo = await connection.getAccountInfo(destinationAssociatedAddress);
      
      const transaction = new Transaction();
      
      // Thêm instruction chuyển phí nếu có địa chỉ nhận phí
      if (feeRecipientAddress) {
        try {
          const feeRecipientPublicKey = new PublicKey(feeRecipientAddress);
          const feeLamports = BigInt(Math.round(feePerRecipient * 1e9));
          
          if (feeLamports > BigInt(0)) {
            transaction.add(
              SystemProgram.transfer({
                fromPubkey: publicKey,
                toPubkey: feeRecipientPublicKey,
                lamports: feeLamports
              })
            );
            console.log(`Added fee transfer of ${feePerRecipient} SOL to ${feeRecipientAddress}`);
          }
        } catch (err) {
          console.error("Error adding fee transfer:", err);
          throw new Error("Invalid fee recipient address");
        }
      }
      
      if (!destinationAccountInfo) {
        console.log("Creating new destination token account...");
        transaction.add(
          token.createAssociatedTokenAccountInstruction(
            publicKey,            
            destinationAssociatedAddress,  
            recipientPublicKey      
          )
        );
      } else {
        console.log("Destination token account exists:", destinationAssociatedAddress.toString());
      }
      
      console.log("Creating token transfer instruction...");
      
      transaction.add(
        createTransferCheckedInstruction(
          sourceTokenAccount,          
          mintPublicKey,               
          destinationAssociatedAddress,     
          publicKey,                   
          amountToSend,                
          decimals,                    
          [],                          
          tokenProgram                 
        )
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
      
      console.log("Sending transaction...");
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
        mintAddress,
        recipientAddress,
        amount
      };
    } catch (error: unknown) {
      console.error("Error transferring token:", error);
      
      let errorMessage = "An error occurred while transferring token";
      
      if (error instanceof Error) {
        if (error.message?.includes("NonTransferable")) {
          errorMessage = "This token cannot be transferred (has NonTransferable extension)";
        } else if (error.message?.includes("insufficient funds")) {
          errorMessage = "Insufficient balance to complete transaction";
        } else if (error.message?.includes("invalid account owner")) {
          errorMessage = "Invalid account owner";
        } else if (error.message?.includes("failed to send transaction")) {
          errorMessage = "Failed to send transaction, please try again";
        } else if (error.name === "TokenAccountNotFoundError") {
          errorMessage = "Token account not found. Please make sure you have enough SOL to create token account";
        }
        
        if (onError) onError(error);
      }
      
      toast.error(errorMessage);
      return null;
    } finally {
      if (onFinish) onFinish();
    }
  };

/**
 * Chuyển token cho nhiều người nhận cùng lúc
 */
export const transferTokenToMultipleRecipients = async (
  connection: Connection,
  wallet: WalletContextState,
  paramsArray: TokenTransferParams[],
  options: TokenTransferOptions = {}
): Promise<TokenTransferResult[] | null> => {
  const { onStart, onSuccess, onError, onFinish, memo, feeRecipientAddress, feePerRecipient = 0.006 } = options;
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
    const firstMint = paramsArray[0].mintAddress;

    if (!paramsArray.every(param => param.mintAddress === firstMint)) {
      throw new Error("All transfers must use the same token");
    }
    
    let mintPublicKey;
    try {
      mintPublicKey = new PublicKey(firstMint);
    } catch (err) {
      console.error("Error converting mint address:", err);
      throw new Error("Invalid token mint address");
    }
    
    const tokenProgram = await determineTokenProgram(connection, mintPublicKey);
    const token = new Token(connection, mintPublicKey);
    
    let sourceTokenAccount;
    try {
      const sourceAssociatedAddress = await token.getAssociatedAddress(
        publicKey,
        false
      );
      
      const sourceAccountInfo = await connection.getAccountInfo(sourceAssociatedAddress);
      
      if (!sourceAccountInfo) {
        throw new Error("Your token account does not exist. Please create a token account first.");
      }
      
      sourceTokenAccount = sourceAssociatedAddress;
    } catch (err) {
      console.error("Error checking source token account:", err);
      throw new Error("Source token account not found. You need to have tokens in your wallet before transferring.");
    }
    
    const transaction = new Transaction();
    
    // Thêm instruction chuyển phí nếu có nhiều người nhận và có địa chỉ nhận phí
    if (feeRecipientAddress && paramsArray.length > 1) {
      try {
        const feeRecipientPublicKey = new PublicKey(feeRecipientAddress);
        const totalFee = feePerRecipient * (paramsArray.length - 1); // Miễn phí cho người đầu tiên
        const feeLamports = BigInt(Math.round(totalFee * 1e9));
        
        if (feeLamports > BigInt(0)) {
          transaction.add(
            SystemProgram.transfer({
              fromPubkey: publicKey,
              toPubkey: feeRecipientPublicKey,
              lamports: feeLamports
            })
          );
          console.log(`Added fee transfer of ${totalFee} SOL to ${feeRecipientAddress}`);
        }
      } catch (err) {
        console.error("Error adding fee transfer:", err);
        throw new Error("Invalid fee recipient address");
      }
    }
    
    for (const params of paramsArray) {
      const { recipientAddress, amount, decimals } = params;
      const amountToSend = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals)));
      
      if (amountToSend <= BigInt(0)) {
        throw new Error(`Invalid token amount for recipient ${recipientAddress}`);
      }
      
      let recipientPublicKey;
      try {
        recipientPublicKey = new PublicKey(recipientAddress);
      } catch (err) {
        console.error("Error converting recipient address:", err);
        throw new Error(`Invalid recipient wallet address: ${recipientAddress}`);
      }
      
      const destinationAssociatedAddress = await token.getAssociatedAddress(
        recipientPublicKey,
        false
      );
      
      const destinationAccountInfo = await connection.getAccountInfo(destinationAssociatedAddress);
      
      if (!destinationAccountInfo) {
        transaction.add(
          token.createAssociatedTokenAccountInstruction(
            publicKey,            
            destinationAssociatedAddress,  
            recipientPublicKey      
          )
        );
      }
      
      transaction.add(
        createTransferCheckedInstruction(
          sourceTokenAccount,          
          mintPublicKey,               
          destinationAssociatedAddress,     
          publicKey,                   
          amountToSend,                
          decimals,                    
          [],                          
          tokenProgram                 
        )
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
    
    console.log("Sending multi-transfer transaction...");
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
      mintAddress: params.mintAddress,
      recipientAddress: params.recipientAddress,
      amount: params.amount
    }));
    
  } catch (error: unknown) {
    console.error("Error transferring tokens to multiple recipients:", error);
    
    let errorMessage = "An error occurred while transferring tokens";
    
    if (error instanceof Error) {
      if (error.message?.includes("NonTransferable")) {
        errorMessage = "This token cannot be transferred (has NonTransferable extension)";
      } else if (error.message?.includes("insufficient funds")) {
        errorMessage = "Insufficient balance to complete transaction";
      } else if (error.message?.includes("invalid account owner")) {
        errorMessage = "Invalid account owner";
      } else if (error.message?.includes("failed to send transaction")) {
        errorMessage = "Failed to send transaction, please try again";
      } else if (error.name === "TokenAccountNotFoundError") {
        errorMessage = "Token account not found. Please make sure you have enough SOL to create token accounts";
      }
      
      if (onError) onError(error);
    }
    
    toast.error(errorMessage);
    return null;
  } finally {
    if (onFinish) onFinish();
  }
};

  export async function determineTokenProgram(
    connection: Connection,
    mintAddress: PublicKey
  ): Promise<PublicKey> {
  return getTokenProgram(mintAddress, connection);
  }