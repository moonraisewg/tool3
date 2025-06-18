import { NextRequest, NextResponse } from "next/server";
import { PublicKey, Transaction } from "@solana/web3.js";
import { TokenBuilder } from "solana-token-extension-boost";
import { ipfsToHTTP, pinJSONToIPFS } from "@/utils/pinata";
import { ClusterType } from "@/types/types";
import { connectionDevnet, connectionMainnet } from "@/service/solana/connection";

interface TransferFeesOptions {
  'fee-percentage'?: string;
  'max-fee'?: string;
}

interface PermanentDelegateOptions {
  'delegate-address'?: string;
}

interface InterestBearingOptions {
  'interest-rate'?: string;
}

interface MintCloseAuthorityOptions {
  'close-authority'?: string;
}

interface DefaultAccountStateOptions {
  'freeze-authority'?: string;
}

interface TransferHookOptions {
  'program-id'?: string;
}

interface ExtensionOptions {
  'transfer-fees'?: TransferFeesOptions;
  'permanent-delegate'?: PermanentDelegateOptions;
  'interest-bearing'?: InterestBearingOptions;
  'mint-close-authority'?: MintCloseAuthorityOptions;
  'default-account-state'?: DefaultAccountStateOptions;
  'transfer-hook'?: TransferHookOptions;
}

interface CreateTokenRequestBody {
  walletPublicKey: string;
  name: string;
  symbol: string;
  decimals: string | number;
  supply: string | number;
  description?: string;
  imageUrl?: string;
  extensionOptions?: ExtensionOptions;
  selectedExtensions: string[];
  websiteUrl?: string;
  twitterUrl?: string;
  telegramUrl?: string;
  discordUrl?: string;
  cluster?: ClusterType;
}

export async function POST(req: NextRequest) {
  try {
    const body: CreateTokenRequestBody = await req.json();
    if (!body.walletPublicKey || !body.decimals || !body.supply || !body.selectedExtensions) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const connection = body.cluster === "mainnet" ? connectionMainnet : connectionDevnet;

    const hasMetadataExtension = body.selectedExtensions.includes("metadata") ||
      body.selectedExtensions.includes("metadata-pointer");
    if (hasMetadataExtension) {
      if (!body.selectedExtensions.includes("metadata")) {
        body.selectedExtensions.push("metadata");
      }
      if (!body.selectedExtensions.includes("metadata-pointer")) {
        body.selectedExtensions.push("metadata-pointer");
      }

      if (!body.name || !body.symbol) {
        return NextResponse.json(
          { error: "Name and symbol are required when using metadata extension" },
          { status: 400 }
        );
      }
    }

    const decimals = typeof body.decimals === 'string' ?
      parseInt(body.decimals) : body.decimals;

    const supplyAmount = typeof body.supply === 'string' ?
      parseFloat(body.supply) : body.supply;

    if (isNaN(decimals) || decimals < 0 || decimals > 9) {
      return NextResponse.json(
        { error: "Decimals must be a number between 0-9" },
        { status: 400 }
      );
    }

    if (isNaN(supplyAmount) || supplyAmount <= 0) {
      return NextResponse.json(
        { error: "Supply must be a positive number" },
        { status: 400 }
      );
    }

    const tokenName = hasMetadataExtension ? body.name : (body.name || "Unnamed Token");
    const tokenSymbol = hasMetadataExtension ? body.symbol : (body.symbol || "UNNAMED");

    let walletPublicKey: PublicKey;
    try {
      walletPublicKey = new PublicKey(body.walletPublicKey);
      /* eslint-disable @typescript-eslint/no-unused-vars */
    } catch (error) {
      /* eslint-enable @typescript-eslint/no-unused-vars */
      return NextResponse.json(
        { error: "Invalid wallet public key" },
        { status: 400 }
      );
    }

    let imageHttpUrl = "";
    if (body.imageUrl) {
      imageHttpUrl = body.imageUrl;
      if (imageHttpUrl.startsWith('ipfs://')) {
        imageHttpUrl = ipfsToHTTP(imageHttpUrl);
      }
    }

    const metadataBase: Record<string, unknown> = {
      name: tokenName,
      symbol: tokenSymbol,
      description: body.description || "",
      seller_fee_basis_points: 0,
      attributes: [
        { trait_type: "Decimals", value: body.decimals },
        { trait_type: "Supply", value: body.supply }
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
            address: body.walletPublicKey,
            share: 100
          }
        ]
      };
    } else {
      metadataBase.properties = {
        category: "image",
        creators: [
          {
            address: body.walletPublicKey,
            share: 100
          }
        ]
      };
    }


    metadataBase.collection = {
      name: tokenName,
      family: "Token-2022"
    };


    if (body.websiteUrl && body.websiteUrl.trim() !== '') {
      metadataBase.external_url = body.websiteUrl;
    }

    let metadataUri = "";
    try {
      const ipfsUri = await pinJSONToIPFS(metadataBase);


      metadataUri = ipfsToHTTP(ipfsUri);

      console.log(`Created metadata URI: ${metadataUri}`);
      /* eslint-disable @typescript-eslint/no-unused-vars */
    } catch (_) {
      /* eslint-enable @typescript-eslint/no-unused-vars */
      console.error("Error creating metadata URI");
      return NextResponse.json(
        { error: "Failed to create metadata for token" },
        { status: 500 }
      );
    }


    const additionalMetadata: Record<string, string> = {};

    if (body.description) additionalMetadata["description"] = body.description;
    if (body.websiteUrl) additionalMetadata["website"] = body.websiteUrl;
    if (body.twitterUrl) additionalMetadata["twitter"] = body.twitterUrl;
    if (body.telegramUrl) additionalMetadata["telegram"] = body.telegramUrl;
    if (body.discordUrl) additionalMetadata["discord"] = body.discordUrl;


    const realExtensions = body.selectedExtensions.filter(ext =>
      ext !== "metadata" && ext !== "metadata-pointer"
    );

    const useToken2022 = realExtensions.length > 0;

    const tokenBuilder = new TokenBuilder(connection)
      .setTokenInfo(
        decimals,
        walletPublicKey
      );

    let metadataAdded = false;

    if (body.selectedExtensions.includes("metadata") || body.selectedExtensions.includes("metadata-pointer")) {
      tokenBuilder.addTokenMetadata(
        tokenName,
        tokenSymbol,
        metadataUri,
        additionalMetadata
      );
      metadataAdded = true;
    } else {
      try {
        // @ts-expect-error - Access to private property
        if (Array.isArray(tokenBuilder.extensions)) {
          // @ts-expect-error - Remove MetadataPointer extension from the list
          tokenBuilder.extensions = tokenBuilder.extensions.filter(
            ext => ext !== 16 // ExtensionType.MetadataPointer from @solana/spl-token
          );
          // @ts-expect-error - Clear tokenMetadata if it has been set
          tokenBuilder.tokenMetadata = undefined;
          // @ts-expect-error - Clear metadata if it has been set
          tokenBuilder.metadata = undefined;
        }
      } catch (e) {
        console.error("Could not remove metadata extension:", e);
      }
    }

    for (const extensionId of body.selectedExtensions) {
      if (extensionId === "metadata" || extensionId === "metadata-pointer") {
        continue;
      }

      if (extensionId === "transfer-fees" && body.extensionOptions?.["transfer-fees"]) {
        const feePercentage = parseFloat(body.extensionOptions["transfer-fees"]["fee-percentage"] || "1");
        const feeBasisPoints = feePercentage * 100;

        let maxFeeValue: bigint;
        if (body.extensionOptions["transfer-fees"]["max-fee"]) {
          const maxFeeInput = body.extensionOptions["transfer-fees"]["max-fee"];
          const maxFeeAmount = parseFloat(maxFeeInput);
          maxFeeValue = BigInt(Math.floor(maxFeeAmount * Math.pow(10, decimals)));
        } else {
          maxFeeValue = BigInt(Math.pow(10, decimals));
        }

        tokenBuilder.addTransferFee(
          feeBasisPoints,
          maxFeeValue,
          walletPublicKey,
          walletPublicKey
        );
      }
      else if (extensionId === "non-transferable") {
        tokenBuilder.addNonTransferable();
      }
      else if (extensionId === "permanent-delegate" && body.extensionOptions?.["permanent-delegate"]) {
        const delegateAddress = new PublicKey(body.extensionOptions["permanent-delegate"]["delegate-address"] || body.walletPublicKey);
        tokenBuilder.addPermanentDelegate(delegateAddress);
      }
      else if (extensionId === "interest-bearing" && body.extensionOptions?.["interest-bearing"]) {
        const rate = parseFloat(body.extensionOptions["interest-bearing"]["interest-rate"] || "5");
        tokenBuilder.addInterestBearing(rate * 100, walletPublicKey);
      }
      else if (extensionId === "mint-close-authority" && body.extensionOptions?.["mint-close-authority"]) {
        const closeAuthorityAddress = new PublicKey(body.extensionOptions["mint-close-authority"]["close-authority"] || body.walletPublicKey);
        tokenBuilder.addMintCloseAuthority(closeAuthorityAddress);
      }
      else if (extensionId === "default-account-state") {
        const defaultState = 1;
        const freezeAuthority = body.extensionOptions?.["default-account-state"]?.["freeze-authority"]
          ? new PublicKey(body.extensionOptions["default-account-state"]["freeze-authority"])
          : walletPublicKey;
        tokenBuilder.addDefaultAccountState(defaultState, freezeAuthority);
      }
      else if (extensionId === "transfer-hook" && body.extensionOptions?.["transfer-hook"]) {
        const hookProgramId = body.extensionOptions["transfer-hook"]["program-id"]
          ? new PublicKey(body.extensionOptions["transfer-hook"]["program-id"])
          : walletPublicKey;
        tokenBuilder.addTransferHook(hookProgramId);
      }
    }

    const { instructions: createInstructions, signers, mint } =
      await tokenBuilder.createTokenInstructions(walletPublicKey);

    console.log(`Token created with mint: ${mint.toString()}, metadata: ${metadataAdded ? "yes" : "no"}`);

    const createTransaction = new Transaction();

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    createTransaction.recentBlockhash = blockhash;
    createTransaction.feePayer = walletPublicKey;

    createInstructions.forEach(ix => createTransaction.add(ix));

    if (signers.length > 0) {
      createTransaction.partialSign(...signers);
    }

    const serializedTransaction = createTransaction
      .serialize({ requireAllSignatures: false })
      .toString("base64");

    const mintAmount = BigInt(Math.floor(supplyAmount * Math.pow(10, decimals)));

    return NextResponse.json({
      success: true,
      transaction: serializedTransaction,
      blockhash,
      lastValidBlockHeight,
      mint: mint.toString(),
      decimals,
      mintAmount: mintAmount.toString(),
      useToken2022,
      metadataUri
    });

  } catch (error: unknown) {
    console.error("Create token error:", error);

    const errorMessage = error instanceof Error
      ? error.message
      : "Failed to create token transaction";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 