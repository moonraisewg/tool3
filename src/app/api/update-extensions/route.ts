import { NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  Transaction,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createReallocateInstruction,
  createEnableRequiredMemoTransfersInstruction,
  createEnableCpiGuardInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

export async function POST(request: Request) {
  try {
    const { walletPublicKey, mintAddress, selectedExtensions } = await request.json();

    if (!walletPublicKey) {
      return NextResponse.json({ error: "Wallet public key is required" }, { status: 400 });
    }

    if (!mintAddress) {
      return NextResponse.json({ error: "Mint address is required" }, { status: 400 });
    }

    if (!selectedExtensions || !Array.isArray(selectedExtensions) || selectedExtensions.length === 0) {
      return NextResponse.json({ error: "At least one extension must be selected" }, { status: 400 });
    }

    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

    const walletPubkey = new PublicKey(walletPublicKey);
    const mintPubkey = new PublicKey(mintAddress);

    const tokenAccount = getAssociatedTokenAddressSync(
      mintPubkey,
      walletPubkey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const extensionsToAdd = [];
    const instructions = [];

    if (selectedExtensions.includes("memo-transfer")) {
      extensionsToAdd.push(ExtensionType.MemoTransfer);
    }

    if (selectedExtensions.includes("cpi-guard")) {
      extensionsToAdd.push(ExtensionType.CpiGuard);
    }

    if (extensionsToAdd.length > 0) {
      const reallocateInstruction = createReallocateInstruction(
        tokenAccount,
        walletPubkey,
        extensionsToAdd,
        walletPubkey,
        [],
        TOKEN_2022_PROGRAM_ID
      );
      instructions.push(reallocateInstruction);

      if (selectedExtensions.includes("memo-transfer")) {
        const enableMemoTransferInstruction = createEnableRequiredMemoTransfersInstruction(
          tokenAccount,
          walletPubkey,
          [],
          TOKEN_2022_PROGRAM_ID
        );
        instructions.push(enableMemoTransferInstruction);
      }

      if (selectedExtensions.includes("cpi-guard")) {
        const enableCpiGuardInstruction = createEnableCpiGuardInstruction(
          tokenAccount,
          walletPubkey,
          [],
          TOKEN_2022_PROGRAM_ID
        );
        instructions.push(enableCpiGuardInstruction);
      }
    }

    if (instructions.length === 0) {
      return NextResponse.json({ error: "No valid extensions to add" }, { status: 400 });
    }

    const recentBlockhash = await connection.getLatestBlockhash();
    const transaction = new Transaction({
      feePayer: walletPubkey,
      blockhash: recentBlockhash.blockhash,
      lastValidBlockHeight: recentBlockhash.lastValidBlockHeight,
    });

    instructions.forEach(instruction => transaction.add(instruction));

    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    return NextResponse.json({
      transaction: Buffer.from(serializedTransaction).toString("base64"),
      blockhash: recentBlockhash.blockhash,
      lastValidBlockHeight: recentBlockhash.lastValidBlockHeight,
    });
  } catch (error) {
    console.error("Error creating update transaction:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
} 