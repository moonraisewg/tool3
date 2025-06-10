import { TokenBuilder, TransferFeeToken } from "solana-token-extension-boost";
import { Connection, PublicKey, Commitment, ConnectionConfig, Transaction } from "@solana/web3.js";
import { pinJSONToIPFS, pinFileToIPFS, ipfsToHTTP, pinImageFromBase64 } from "@/utils/pinata";
import { WalletContextState } from "@solana/wallet-adapter-react";
export interface TokenData {
  name: string;
  symbol: string;
  decimals: string | number;
  supply: string | number;
  description?: string;
  imageBase64?: string | null;
  imageUrl?: string | null;
  extensionOptions?: Record<string, Record<string, string | number>>;
  websiteUrl?: string;
  twitterUrl?: string;
  telegramUrl?: string;
  discordUrl?: string;
}
export interface ExtensionConfig {
  id: string;
  options?: Record<string, string | number>;
}
export interface TokenCreationResult {
  mint: string;
  signature: string;
  metadataUri: string;
}

export async function createToken(
  connection: Connection,
  wallet: WalletContextState,
  tokenData: TokenData,
  selectedExtensions: string[]
): Promise<TokenCreationResult> {
  if (!wallet.publicKey) {
    throw new Error("Wallet not connected");
  }
  let imageUri = "";
  let imageHttpUrl = "";

  if (tokenData.imageUrl) {
    imageHttpUrl = tokenData.imageUrl;
    if (!imageHttpUrl.startsWith('http')) {
      if (imageHttpUrl.startsWith('ipfs://')) {
        imageHttpUrl = ipfsToHTTP(imageHttpUrl);
      } else {
        imageHttpUrl = `https://gateway.pinata.cloud/ipfs/${imageHttpUrl}`;
      }
    }
  } 
  else if (tokenData.imageBase64) {
    try {
      let base64Data = tokenData.imageBase64;
      if (!base64Data.startsWith('data:image')) {
        base64Data = `data:image/png;base64,${base64Data}`;
      }
      
      try {
        imageUri = await pinImageFromBase64(base64Data);
        imageHttpUrl = ipfsToHTTP(imageUri);
        if (!imageUri || !imageHttpUrl || imageHttpUrl.trim() === '') {
          throw new Error("Failed to get valid image URI after upload");
        }
      } catch {
        if (base64Data.includes(',')) {
          base64Data = base64Data.split(',')[1];
        }
        
        imageUri = await pinFileToIPFS(base64Data, `${tokenData.name.toLowerCase()}-image`);
        imageHttpUrl = ipfsToHTTP(imageUri);
      }
    } catch {
      imageHttpUrl = "";
    }
  }

  const metadataBase: Record<string, unknown> = {
    name: tokenData.name,
    symbol: tokenData.symbol,
    description: tokenData.description || "",
    seller_fee_basis_points: 0,
    attributes: [
      { trait_type: "Decimals", value: String(tokenData.decimals) },
      { trait_type: "Supply", value: String(tokenData.supply) }
    ]
  };

  if (imageHttpUrl && imageHttpUrl.trim() !== '') {
    metadataBase.image = imageHttpUrl;
    metadataBase.properties = {
      files: [
        {
          uri: imageHttpUrl,
          type: "image/png"
        }
      ],
      category: "image",
      creators: [
        {
          address: wallet.publicKey.toString(),
          share: 100
        }
      ]
    };
  } else {
    metadataBase.properties = {
      category: "image",
      creators: [
        {
          address: wallet.publicKey.toString(),
          share: 100
        }
      ]
    };
  }

  metadataBase.collection = {
    name: tokenData.name,
    family: "Token-2022"
  };

  if (tokenData.websiteUrl && tokenData.websiteUrl.trim() !== '') {
    metadataBase.external_url = tokenData.websiteUrl;
  }

  const offchainMetadata = metadataBase;
  
  let metadataUri: string;
  try {
    const ipfsUri = await pinJSONToIPFS(offchainMetadata);
    
    metadataUri = ipfsToHTTP(ipfsUri);
  } catch {
    metadataUri = `https://arweave.net/${tokenData.name.toLowerCase()}-${tokenData.symbol.toLowerCase()}`;
  }

  const connectionConfig: ConnectionConfig = {
    commitment: 'confirmed' as Commitment,
    confirmTransactionInitialTimeout: 60000
  };
  
  const enhancedConnection = new Connection(
    connection.rpcEndpoint, 
    connectionConfig
  );
  
  const additionalMetadata: Record<string, string> = {};
  
  if (tokenData.description) additionalMetadata["description"] = String(tokenData.description);
  if (tokenData.websiteUrl) additionalMetadata["website"] = String(tokenData.websiteUrl);
  if (tokenData.twitterUrl) additionalMetadata["twitter"] = String(tokenData.twitterUrl);
  if (tokenData.telegramUrl) additionalMetadata["telegram"] = String(tokenData.telegramUrl);
  if (tokenData.discordUrl) additionalMetadata["discord"] = String(tokenData.discordUrl);
  
  const decimals = typeof tokenData.decimals === 'string' ? 
    parseInt(tokenData.decimals) : tokenData.decimals;
  

  const tokenBuilder = new TokenBuilder(enhancedConnection)
    .setTokenInfo(
      decimals,
      wallet.publicKey
    )
    .addTokenMetadata(
      tokenData.name,
      tokenData.symbol,
      metadataUri,
      additionalMetadata
    );
  
  for (const extensionId of selectedExtensions) {
    if (extensionId === "metadata" || extensionId === "metadata-pointer") continue;
    
    if (extensionId === "transfer-fees" && tokenData.extensionOptions?.["transfer-fees"]) {
      const feePercentage = parseFloat(String(tokenData.extensionOptions["transfer-fees"]["fee-percentage"] || "1"));
      const feeBasisPoints = feePercentage * 100;
      
      let maxFeeValue: bigint;
      
      if (tokenData.extensionOptions["transfer-fees"]["max-fee"]) {
        const maxFeeInput = tokenData.extensionOptions["transfer-fees"]["max-fee"];
        
        const maxFeeAmount = parseFloat(String(maxFeeInput));
        
        maxFeeValue = BigInt(Math.floor(maxFeeAmount * Math.pow(10, decimals)));
      } else {
        maxFeeValue = BigInt(Math.pow(10, decimals));
      }
      
      tokenBuilder.addTransferFee(
        feeBasisPoints,
        maxFeeValue,
        wallet.publicKey,
        wallet.publicKey
      );
    } 
    else if (extensionId === "non-transferable") {
      tokenBuilder.addNonTransferable();
    }
    else if (extensionId === "permanent-delegate" && tokenData.extensionOptions?.["permanent-delegate"]) {
      const delegateAddress = new PublicKey(tokenData.extensionOptions["permanent-delegate"]["delegate-address"] || wallet.publicKey.toString());
      tokenBuilder.addPermanentDelegate(delegateAddress);
    }
    else if (extensionId === "interest-bearing" && tokenData.extensionOptions?.["interest-bearing"]) {
      const rate = parseFloat(String(tokenData.extensionOptions["interest-bearing"]["interest-rate"] || "5"));
      tokenBuilder.addInterestBearing(rate * 100, wallet.publicKey);
    }
    else if (extensionId === "mint-close-authority" && tokenData.extensionOptions?.["mint-close-authority"]) {
      const closeAuthorityAddress = new PublicKey(tokenData.extensionOptions["mint-close-authority"]["close-authority"] || wallet.publicKey.toString());
      tokenBuilder.addMintCloseAuthority(closeAuthorityAddress);
    }
    else if (extensionId === "default-account-state") {
      const defaultState = 1;
      
      const freezeAuthority = tokenData.extensionOptions?.["default-account-state"]?.["freeze-authority"] 
        ? new PublicKey(tokenData.extensionOptions["default-account-state"]["freeze-authority"])
        : wallet.publicKey;
      
      tokenBuilder.addDefaultAccountState(defaultState, freezeAuthority);
    }
    else if (extensionId === "transfer-hook" && tokenData.extensionOptions?.["transfer-hook"]) {
      const hookProgramId = tokenData.extensionOptions["transfer-hook"]["program-id"]
        ? new PublicKey(tokenData.extensionOptions["transfer-hook"]["program-id"])
        : wallet.publicKey;
      
      tokenBuilder.addTransferHook(hookProgramId);
    }
  }
  
  const { instructions: createInstructions, signers, mint } = 
    await tokenBuilder.createTokenInstructions(wallet.publicKey);
  
  let feeBasisPoints = 0;
  let maxFeeValue = BigInt(0);
  
  if (selectedExtensions.includes("transfer-fees") && tokenData.extensionOptions?.["transfer-fees"]) {
    const feePercentage = parseFloat(String(tokenData.extensionOptions["transfer-fees"]["fee-percentage"] || "1"));
    feeBasisPoints = feePercentage * 100;

    if (tokenData.extensionOptions["transfer-fees"]["max-fee"]) {
      const maxFeeInput = tokenData.extensionOptions["transfer-fees"]["max-fee"];
      const maxFeeAmount = parseFloat(String(maxFeeInput));
      maxFeeValue = BigInt(Math.floor(maxFeeAmount * Math.pow(10, decimals)));
    } else {
      maxFeeValue = BigInt(Math.pow(10, decimals));
    }
  }
  
  const createTransaction = new Transaction();
  
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  createTransaction.recentBlockhash = blockhash;
  createTransaction.feePayer = wallet.publicKey;
  
  createInstructions.forEach(ix => createTransaction.add(ix));
  
  if (signers.length > 0) {
    createTransaction.partialSign(...signers);
  }
  
  try {
    const createSignature = await wallet.sendTransaction(
      createTransaction,
      connection,
      { skipPreflight: false, preflightCommitment: 'confirmed' }
    );
    
    await connection.confirmTransaction({
      blockhash,
      lastValidBlockHeight,
      signature: createSignature
    }, 'confirmed');
    
    console.log("Token creation successful with signature:", createSignature);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const token = new TransferFeeToken(
      connection, 
      mint,
      {
        feeBasisPoints: feeBasisPoints,
        maxFee: maxFeeValue,
        transferFeeConfigAuthority: wallet.publicKey,
        withdrawWithheldAuthority: wallet.publicKey
      }
    );
    
    const tokenDecimals = typeof tokenData.decimals === 'string' ? 
      parseInt(tokenData.decimals) : tokenData.decimals; 
    const tokenSupplyAmount = typeof tokenData.supply === 'string' ? 
      parseFloat(tokenData.supply) : tokenData.supply;  
    const tokenAmount = BigInt(Math.floor(tokenSupplyAmount * Math.pow(10, tokenDecimals)));
    const { instructions: mintInstructions } = 
      await token.createAccountAndMintToInstructions(
        wallet.publicKey, 
        wallet.publicKey, 
        tokenAmount,     
        wallet.publicKey  
      );
    
  
    const mintBlockhashInfo = await connection.getLatestBlockhash('confirmed');
    const mintTransaction = new Transaction();
    mintTransaction.recentBlockhash = mintBlockhashInfo.blockhash;
    mintTransaction.feePayer = wallet.publicKey;
    mintInstructions.forEach(ix => mintTransaction.add(ix));
    const mintSignature = await wallet.sendTransaction(
      mintTransaction,
      connection,
      { skipPreflight: false, preflightCommitment: 'confirmed' }
    );
    
    await connection.confirmTransaction({
      blockhash: mintBlockhashInfo.blockhash,
      lastValidBlockHeight: mintBlockhashInfo.lastValidBlockHeight,
      signature: mintSignature
    }, 'confirmed');
    
    console.log("Token minting successful with signature:", mintSignature);

    return {
      mint: mint.toString(),
      signature: createSignature,
      metadataUri: metadataUri
    };
    
  } catch (error: Error | unknown) {
    console.error("Error during token creation:", error);
    if (error instanceof Error && 'logs' in error) {
      console.error("Error logs:", error.logs);
    }
    throw error;
  }
}

export async function mintToken(
  connection: Connection,
  wallet: WalletContextState,
  mintAddress: string,
  amount: string | number,
  decimals: number,
  recipientAddress?: string
): Promise<string> {
  if (!wallet.publicKey) {
    throw new Error("Wallet not connected");
  }
  
  const mintPublicKey = new PublicKey(mintAddress);
  const amountValue = typeof amount === 'string' ? parseFloat(amount) : amount;
  const mintAmount = BigInt(Math.floor(amountValue * Math.pow(10, decimals)));
  const mintInfo = await connection.getAccountInfo(mintPublicKey);
  if (!mintInfo) {
    throw new Error("Token mint not found");
  }
  const recipient = recipientAddress 
    ? new PublicKey(recipientAddress)
    : wallet.publicKey;
  
  try {
    const transferFeeConfig = {
      feeBasisPoints: 0,
      maxFee: BigInt(0),
      transferFeeConfigAuthority: wallet.publicKey,
      withdrawWithheldAuthority: wallet.publicKey
    };
    
    const token = new TransferFeeToken(
      connection,
      mintPublicKey,
      transferFeeConfig
    );
    const { instructions } = await token.createAccountAndMintToInstructions(
      recipient,          
      wallet.publicKey,   
      mintAmount,           
      wallet.publicKey     
    );
    const transaction = new Transaction();
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    instructions.forEach(ix => transaction.add(ix));
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
    
    return signature;
  } catch (error) {
    console.error("Error minting token:", error);
    throw error;
  }
}

