import { NextRequest, NextResponse } from "next/server";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getMint,
  createAssociatedTokenAccountInstruction,
  getAccount,
  createTransferInstruction,
} from "@solana/spl-token";
import { connectionMainnet } from "@/service/solana/connection";
import { getTokenFeeFromUsd } from "@/service/jupiter/calculate-fee";
import { getTokenProgram } from "@/lib/helper";
import { adminKeypair } from "@/config";
import { calculateTransferFee } from "@/utils/ata-checker";

interface TransferRequestBody {
  walletPublicKey: string;
  tokenAmount: number;
  receiverWalletPublicKey: string;
  tokenMint: string;
  signedTransaction: number[];
}

export async function POST(req: NextRequest) {
  try {
    const body: TransferRequestBody = await req.json();
    if (body.signedTransaction) {
      return await executeSignedTransaction(body);
    } else {
      return await prepareTransaction(body);
    }
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: "Failed to process transfer",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function prepareTransaction(
  body: Omit<TransferRequestBody, "signedTransaction">
) {
  const senderPublicKey = new PublicKey(body.walletPublicKey);
  const receiverPublicKey = new PublicKey(body.receiverWalletPublicKey);
  const tokenMint = new PublicKey(body.tokenMint);

  const mintInfo = await getMint(connectionMainnet, tokenMint);
  const decimals = mintInfo.decimals;
  const tokenProgram = await getTokenProgram(mintInfo.address);

  const senderTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    senderPublicKey,
    false,
    tokenProgram
  );
  const receiverTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    receiverPublicKey,
    false,
    tokenProgram
  );
  const feeTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    adminKeypair.publicKey,
    false,
    tokenProgram
  );

  const feeUsdt = await calculateTransferFee(
    body.receiverWalletPublicKey,
    body.tokenMint
  );

  const feeInTokens = await getTokenFeeFromUsd(body.tokenMint, feeUsdt);
  const feeAmount = Math.round(feeInTokens * Math.pow(10, decimals));

  const netAmount = Math.round(
    parseFloat(body.tokenAmount.toString()) * Math.pow(10, decimals)
  );
  const totalAmount = netAmount + feeAmount;

  try {
    const senderAccount = await getAccount(
      connectionMainnet,
      senderTokenAccount,
      "confirmed",
      tokenProgram
    );
    if (senderAccount.amount < BigInt(totalAmount)) {
      return NextResponse.json(
        {
          error: "Insufficient token balance",
          required: totalAmount.toString(),
          available: senderAccount.amount.toString(),
        },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Sender token account not found" },
      { status: 400 }
    );
  }

  const transaction = new Transaction();

  try {
    await getAccount(
      connectionMainnet,
      receiverTokenAccount,
      "confirmed",
      tokenProgram
    );
  } catch {
    const createReceiverAccountIx = createAssociatedTokenAccountInstruction(
      adminKeypair.publicKey,
      receiverTokenAccount,
      receiverPublicKey,
      tokenMint,
      tokenProgram
    );
    transaction.add(createReceiverAccountIx);
  }

  try {
    await getAccount(
      connectionMainnet,
      feeTokenAccount,
      "confirmed",
      tokenProgram
    );
  } catch {
    const createFeeAccountIx = createAssociatedTokenAccountInstruction(
      adminKeypair.publicKey,
      feeTokenAccount,
      adminKeypair.publicKey,
      tokenMint,
      tokenProgram
    );
    transaction.add(createFeeAccountIx);
  }

  if (feeAmount > 0) {
    const feeTransferIx = createTransferInstruction(
      senderTokenAccount,
      feeTokenAccount,
      senderPublicKey,
      feeAmount,
      [],
      tokenProgram
    );
    transaction.add(feeTransferIx);
  }

  const netTransferIx = createTransferInstruction(
    senderTokenAccount,
    receiverTokenAccount,
    senderPublicKey,
    netAmount,
    [],
    tokenProgram
  );
  transaction.add(netTransferIx);

  const { blockhash, lastValidBlockHeight } =
    await connectionMainnet.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = adminKeypair.publicKey;
  transaction.partialSign(adminKeypair);

  const serializedTransaction = transaction
    .serialize({ requireAllSignatures: false })
    .toString("base64");

  return NextResponse.json({
    success: true,
    transaction: serializedTransaction,
    blockhash,
    lastValidBlockHeight,
    breakdown: {
      transferAmount: body.tokenAmount,
      feeAmount: feeAmount / Math.pow(10, decimals),
      totalRequired: totalAmount / Math.pow(10, decimals),
    },
  });
}

async function executeSignedTransaction(body: TransferRequestBody) {
  try {
    const signedTransaction = Transaction.from(
      Buffer.from(body.signedTransaction)
    );

    const hasValidSignatures = signedTransaction.signatures.some(
      (sig) => sig.signature !== null
    );

    if (!hasValidSignatures) {
      throw new Error("No valid signatures found");
    }

    const signature = await connectionMainnet.sendRawTransaction(
      signedTransaction.serialize(),
      {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 3,
      }
    );

    const confirmation = await connectionMainnet.confirmTransaction(signature);

    if (confirmation.value.err) {
      throw new Error(
        `Transaction failed: ${JSON.stringify(confirmation.value.err)}`
      );
    }

    return NextResponse.json({
      success: true,
      signature: signature,
      message: "Gasless transfer completed successfully",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to execute transaction",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
