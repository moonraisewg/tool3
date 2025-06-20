import {
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { NextResponse } from "next/server";
import { adminKeypair } from "@/config";

import {
  connectionMainnet,
  connectionDevnet,
} from "@/service/solana/connection";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { signedTransaction, walletPublicKey, solAmount, tokenMint } = body;

    if (!signedTransaction || !walletPublicKey || !solAmount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const adminPublicKey = adminKeypair.publicKey;
    const userPublicKey = new PublicKey(walletPublicKey);

    const rawTx =
      typeof signedTransaction === "string"
        ? Buffer.from(signedTransaction, "base64")
        : Buffer.from(signedTransaction);

    const transaction = Transaction.from(rawTx);

    const transferInstruction = transaction.instructions.find(
      (ix) =>
        ix.programId.equals(TOKEN_PROGRAM_ID) ||
        ix.programId.equals(SystemProgram.programId)
    );

    if (!transferInstruction) {
      return NextResponse.json(
        { error: "No transfer instruction found" },
        { status: 400 }
      );
    }

    const isSignedByUser = transferInstruction.keys.some(
      (key) => key.pubkey.equals(userPublicKey) && key.isSigner
    );

    let isToAdmin = false;

    if (tokenMint === "NativeSOL") {
      isToAdmin = transferInstruction.keys.some((key) =>
        key.pubkey.equals(adminPublicKey)
      );
    } else {
      const adminTokenAccount = await getAssociatedTokenAddress(
        new PublicKey(tokenMint),
        adminPublicKey
      );
      isToAdmin = transferInstruction.keys.some((key) =>
        key.pubkey.equals(adminTokenAccount)
      );
    }

    if (!isSignedByUser || !isToAdmin) {
      return NextResponse.json(
        {
          error:
            "Transaction doesn't transfer to admin or isn't signed by user",
        },
        { status: 400 }
      );
    }

    const txSignature = await connectionMainnet.sendRawTransaction(
      transaction.serialize(),
      {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 3,
      }
    );

    const confirmation = await connectionMainnet.confirmTransaction(
      txSignature,
      "confirmed"
    );

    if (confirmation.value.err) {
      return NextResponse.json(
        { error: `Token transaction failed`, details: confirmation.value.err },
        { status: 400 }
      );
    }

    const solTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: adminPublicKey,
        toPubkey: userPublicKey,
        lamports: Math.round(solAmount),
      })
    );

    const solTxSignature = await sendAndConfirmTransaction(
      connectionDevnet,
      solTx,
      [adminKeypair],
      {
        commitment: "confirmed",
      }
    );

    return NextResponse.json({
      txSignature,
      solTxSignature,
      message: `Token confirmed. Sent ${solAmount / 1_000_000_000} SOL`,
    });
  } catch (error) {
    console.error("Confirm error:", error);
    return NextResponse.json(
      {
        error:
          (error as Error).message || "Failed to confirm and send SOL Devnet",
      },
      { status: 500 }
    );
  }
}
