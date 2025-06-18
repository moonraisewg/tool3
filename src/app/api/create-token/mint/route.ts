import { NextRequest, NextResponse } from "next/server";
import { PublicKey, Transaction } from "@solana/web3.js";
import { connectionDevnet, connectionMainnet } from "@/service/solana/connection";
import { TransferFeeToken } from "solana-token-extension-boost";
import { ClusterType } from "@/types/types";


interface MintTokenRequestBody {
  walletPublicKey: string;
  mintAddress: string;
  amount: string | number;
  decimals: number;
  useToken2022?: boolean;
  recipientAddress?: string;
  cluster?: ClusterType;
}

export async function POST(req: NextRequest) {
  try {
    const body: MintTokenRequestBody = await req.json();

    if (!body.walletPublicKey || !body.mintAddress || !body.amount || body.decimals === undefined) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const connection = body.cluster === "mainnet" ? connectionMainnet : connectionDevnet;

    let walletPublicKey: PublicKey;
    let mintPublicKey: PublicKey;

    try {
      walletPublicKey = new PublicKey(body.walletPublicKey);
      mintPublicKey = new PublicKey(body.mintAddress);
      /* eslint-disable @typescript-eslint/no-unused-vars */
    } catch (_) {
      /* eslint-enable @typescript-eslint/no-unused-vars */
      return NextResponse.json(
        { error: "Invalid public key format" },
        { status: 400 }
      );
    }


    const amountValue = typeof body.amount === 'string' ? parseFloat(body.amount) : body.amount;
    if (isNaN(amountValue) || amountValue <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    const mintAmount = BigInt(Math.floor(amountValue * Math.pow(10, body.decimals)));

    // Xác định recipient 
    const recipient = body.recipientAddress
      ? new PublicKey(body.recipientAddress)
      : walletPublicKey;

    const transferFeeConfig = {
      feeBasisPoints: 0,
      maxFee: BigInt(0),
      transferFeeConfigAuthority: walletPublicKey,
      withdrawWithheldAuthority: walletPublicKey
    };

    const token = new TransferFeeToken(
      connection,
      mintPublicKey,
      transferFeeConfig
    );

    const { instructions, address: tokenAccount } = await token.createAccountAndMintToInstructions(
      recipient,
      walletPublicKey,
      mintAmount,
      walletPublicKey
    );
    const transaction = new Transaction();
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletPublicKey;

    instructions.forEach(ix => transaction.add(ix));
    const serializedTransaction = transaction
      .serialize({ requireAllSignatures: false })
      .toString("base64");
    return NextResponse.json({
      success: true,
      transaction: serializedTransaction,
      blockhash,
      lastValidBlockHeight,
      tokenAccount: tokenAccount.toString()
    });

  } catch (error: unknown) {
    console.error("Mint token error:", error);

    const errorMessage = error instanceof Error
      ? error.message
      : "Failed to create mint transaction";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 