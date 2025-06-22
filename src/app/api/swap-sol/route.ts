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
import { getTokenProgram } from "@/lib/helper";
import {
  getJupiterQuote,
  getJupiterSwapInstructions,
  createInstructionFromJupiter,
} from "@/service/jupiter/swap";
import { adminKeypair } from "@/config";
import { getTokenFeeFromUsd } from "@/service/jupiter/calculate-fee";

interface SwapRequestBody {
  walletPublicKey: string;
  inputTokenMint: string;
  inputAmount: number;
  slippageBps?: number;
  signedTransaction?: number[];
}

export async function POST(req: NextRequest) {
  try {
    const body: SwapRequestBody = await req.json();
    console.log("Request body:", body);

    if (body.signedTransaction) {
      return await executeSignedSwapTransaction(body);
    } else {
      return await prepareSwapTransaction(body);
    }
  } catch (error: unknown) {
    console.error("error:", error);
    return NextResponse.json(
      {
        error: "Failed to process swap",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function prepareSwapTransaction(
  body: Omit<SwapRequestBody, "signedTransaction">
) {
  const userPublicKey = new PublicKey(body.walletPublicKey);
  const inputTokenMint = new PublicKey(body.inputTokenMint);
  const outputTokenMint = new PublicKey(
    "So11111111111111111111111111111111111111112"
  );

  const inputMintInfo = await getMint(connectionMainnet, inputTokenMint);
  const inputDecimals = inputMintInfo.decimals;
  const inputTokenProgram = await getTokenProgram(inputMintInfo.address);

  const outputMintInfo = await getMint(connectionMainnet, outputTokenMint);
  const outputTokenProgram = await getTokenProgram(outputMintInfo.address);

  const inputAmountInLamports = Math.round(
    body.inputAmount * Math.pow(10, inputDecimals)
  );

  const quote = await getJupiterQuote(
    body.inputTokenMint,
    "So11111111111111111111111111111111111111112",
    inputAmountInLamports
  );

  const userInputTokenAccount = await getAssociatedTokenAddress(
    inputTokenMint,
    userPublicKey,
    false,
    inputTokenProgram
  );

  const userOutputTokenAccount = await getAssociatedTokenAddress(
    outputTokenMint,
    userPublicKey,
    false,
    outputTokenProgram
  );

  const feeTokenAccount = await getAssociatedTokenAddress(
    inputTokenMint,
    adminKeypair.publicKey,
    false,
    inputTokenProgram
  );

  const feeInTokens = await getTokenFeeFromUsd(body.inputTokenMint, 0.5);
  const feeAmount = Math.round(feeInTokens * Math.pow(10, inputDecimals));

  const totalRequiredAmount = inputAmountInLamports + feeAmount;

  try {
    const userAccount = await getAccount(
      connectionMainnet,
      userInputTokenAccount,
      "confirmed",
      inputTokenProgram
    );

    if (userAccount.amount < BigInt(totalRequiredAmount)) {
      return NextResponse.json(
        {
          error: "Insufficient token balance",
          required: totalRequiredAmount.toString(),
          available: userAccount.amount.toString(),
        },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "User input token account not found" },
      { status: 400 }
    );
  }

  const swapInstructionsResponse = await getJupiterSwapInstructions({
    userPublicKey: body.walletPublicKey,
    quoteResponse: quote,
    prioritizationFeeLamports: {
      priorityLevelWithMaxLamports: {
        maxLamports: 1000000,
        priorityLevel: "medium",
      },
    },
    dynamicComputeUnitLimit: false,
  });

  const transaction = new Transaction();

  if (swapInstructionsResponse.computeBudgetInstructions.length > 0) {
    const ix = createInstructionFromJupiter(
      swapInstructionsResponse.computeBudgetInstructions[0]
    );
    transaction.add(ix);
  }

  try {
    await getAccount(
      connectionMainnet,
      userOutputTokenAccount,
      "confirmed",
      outputTokenProgram
    );
  } catch {
    const createOutputAccountIx = createAssociatedTokenAccountInstruction(
      adminKeypair.publicKey,
      userOutputTokenAccount,
      userPublicKey,
      outputTokenMint,
      outputTokenProgram
    );
    transaction.add(createOutputAccountIx);
  }

  try {
    await getAccount(
      connectionMainnet,
      feeTokenAccount,
      "confirmed",
      inputTokenProgram
    );
  } catch {
    const createFeeAccountIx = createAssociatedTokenAccountInstruction(
      adminKeypair.publicKey,
      feeTokenAccount,
      adminKeypair.publicKey,
      inputTokenMint,
      inputTokenProgram
    );
    transaction.add(createFeeAccountIx);
  }

  if (feeAmount > 0) {
    const feeTransferIx = createTransferInstruction(
      userInputTokenAccount,
      feeTokenAccount,
      userPublicKey,
      feeAmount,
      [],
      inputTokenProgram
    );
    transaction.add(feeTransferIx);
  }

  const swapIx = createInstructionFromJupiter(
    swapInstructionsResponse.swapInstruction
  );
  transaction.add(swapIx);

  const { blockhash } = await connectionMainnet.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = adminKeypair.publicKey;
  transaction.partialSign(adminKeypair);

  const serializedTransaction = transaction
    .serialize({ requireAllSignatures: false })
    .toString("base64");

  return NextResponse.json({
    success: true,
    transaction: serializedTransaction,
  });
}

async function executeSignedSwapTransaction(body: SwapRequestBody) {
  try {
    const signedTransaction = Transaction.from(
      Buffer.from(body.signedTransaction!)
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
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to execute swap transaction",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
