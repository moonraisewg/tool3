import { NextRequest, NextResponse } from "next/server";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
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
import {
  getJupiterQuote,
  getJupiterSwapInstructions,
  type JupiterInstruction,
} from "@/service/jupiter/swap";
import { calculateTransferFee } from "@/utils/ata-checker";

interface TransferRequestBody {
  walletPublicKey: string;
  tokenAmount: number;
  receiverWalletPublicKey: string;
  tokenMint: string;
  signedTransaction: number[];
}

function createInstructionFromJupiter(
  jupiterInstruction: JupiterInstruction
): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(jupiterInstruction.programId),
    keys: jupiterInstruction.accounts.map((account) => ({
      pubkey: new PublicKey(account.pubkey),
      isSigner: account.isSigner,
      isWritable: account.isWritable,
    })),
    data: Buffer.from(jupiterInstruction.data, "base64"),
  });
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

  await preCreateAccountsIfNeeded(
    receiverTokenAccount,
    feeTokenAccount,
    receiverPublicKey,
    tokenMint,
    tokenProgram
  );

  const feeToSolQuote = await getJupiterQuote(
    body.tokenMint,
    "So11111111111111111111111111111111111111112",
    feeAmount
  );

  if (parseInt(feeToSolQuote.outAmount) < 1000) {
    return NextResponse.json(
      { error: "Fee amount too small for swap" },
      { status: 400 }
    );
  }

  const transaction = new Transaction();

  const feeTransferIx = createTransferInstruction(
    senderTokenAccount,
    feeTokenAccount,
    senderPublicKey,
    feeAmount,
    [],
    tokenProgram
  );
  transaction.add(feeTransferIx);

  const netTransferIx = createTransferInstruction(
    senderTokenAccount,
    receiverTokenAccount,
    senderPublicKey,
    netAmount,
    [],
    tokenProgram
  );
  transaction.add(netTransferIx);

  const feeSwapInstructions = await getJupiterSwapInstructions({
    userPublicKey: adminKeypair.publicKey.toString(),
    quoteResponse: feeToSolQuote,
    prioritizationFeeLamports: {
      priorityLevelWithMaxLamports: {
        maxLamports: 500000,
        priorityLevel: "medium",
      },
    },
    dynamicComputeUnitLimit: false,
  });

  feeSwapInstructions.computeBudgetInstructions.forEach((ix) => {
    transaction.add(createInstructionFromJupiter(ix));
  });

  feeSwapInstructions.setupInstructions.forEach((ix) => {
    transaction.add(createInstructionFromJupiter(ix));
  });

  const feeSwapIx = createInstructionFromJupiter(
    feeSwapInstructions.swapInstruction
  );
  transaction.add(feeSwapIx);

  if (feeSwapInstructions.cleanupInstruction) {
    transaction.add(
      createInstructionFromJupiter(feeSwapInstructions.cleanupInstruction)
    );
  }

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
      expectedFeeInSol: parseInt(feeToSolQuote.outAmount) / 1e9,
    },
  });
}

async function preCreateAccountsIfNeeded(
  receiverTokenAccount: PublicKey,
  feeTokenAccount: PublicKey,
  receiverPublicKey: PublicKey,
  tokenMint: PublicKey,
  tokenProgram: PublicKey
) {
  const accountsToCreate = [];

  try {
    await getAccount(
      connectionMainnet,
      receiverTokenAccount,
      "confirmed",
      tokenProgram
    );
  } catch {
    accountsToCreate.push(
      createAssociatedTokenAccountInstruction(
        adminKeypair.publicKey,
        receiverTokenAccount,
        receiverPublicKey,
        tokenMint,
        tokenProgram
      )
    );
  }

  try {
    await getAccount(
      connectionMainnet,
      feeTokenAccount,
      "confirmed",
      tokenProgram
    );
  } catch {
    accountsToCreate.push(
      createAssociatedTokenAccountInstruction(
        adminKeypair.publicKey,
        feeTokenAccount,
        adminKeypair.publicKey,
        tokenMint,
        tokenProgram
      )
    );
  }

  if (accountsToCreate.length > 0) {
    const setupTx = new Transaction();
    accountsToCreate.forEach((ix) => setupTx.add(ix));

    const { blockhash } = await connectionMainnet.getLatestBlockhash();
    setupTx.recentBlockhash = blockhash;
    setupTx.feePayer = adminKeypair.publicKey;
    setupTx.sign(adminKeypair);

    try {
      await connectionMainnet.sendRawTransaction(setupTx.serialize());
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.log("Pre-create accounts failed:", error);
    }
  }
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
        skipPreflight: true,
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
