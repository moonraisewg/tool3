import { NextRequest, NextResponse } from "next/server";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getMint,
  createAssociatedTokenAccountInstruction,
  getAccount,
  createTransferInstruction,
  createCloseAccountInstruction,
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

const SOL_MINT = "So11111111111111111111111111111111111111112";

interface SwapRequestBody {
  walletPublicKey: string;
  inputTokenMint: string;
  inputAmount: number;
  slippageBps?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body: SwapRequestBody = await req.json();

    return await prepareSwapTransaction(body);
  } catch (error: unknown) {
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
  const outputTokenMint = new PublicKey(SOL_MINT);

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
    SOL_MINT,
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

  const feeInTokens = await getTokenFeeFromUsd(
    body.inputTokenMint,
    0.5,
    body.walletPublicKey
  );
  let feeAmount = Math.round(feeInTokens * Math.pow(10, inputDecimals));

  let totalRequiredAmount = inputAmountInLamports + feeAmount;

  try {
    const userAccount = await getAccount(
      connectionMainnet,
      userInputTokenAccount,
      "confirmed",
      inputTokenProgram
    );

    if (userAccount.amount < BigInt(totalRequiredAmount)) {
      const reducedFeeAmount = Math.round(
        feeInTokens * 0.98 * Math.pow(10, inputDecimals)
      );
      totalRequiredAmount = inputAmountInLamports + reducedFeeAmount;
      if (userAccount.amount >= BigInt(totalRequiredAmount)) {
        feeAmount = reducedFeeAmount;
      } else {
        return NextResponse.json(
          {
            error: "Token price has change. Please try again.",
            required: totalRequiredAmount.toString(),
            available: userAccount.amount.toString(),
          },
          { status: 400 }
        );
      }
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

  const swapTransaction = new Transaction();

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
    swapTransaction.add(createOutputAccountIx);
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
    swapTransaction.add(createFeeAccountIx);
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
    swapTransaction.add(feeTransferIx);
  }

  const swapIx = createInstructionFromJupiter(
    swapInstructionsResponse.swapInstruction
  );
  swapTransaction.add(swapIx);

  const { blockhash } = await connectionMainnet.getLatestBlockhash();
  swapTransaction.recentBlockhash = blockhash;
  swapTransaction.feePayer = adminKeypair.publicKey;
  swapTransaction.partialSign(adminKeypair);

  const unwrapTransaction = new Transaction();

  const closeAccountIx = createCloseAccountInstruction(
    userOutputTokenAccount,
    userPublicKey,
    userPublicKey,
    [],
    outputTokenProgram
  );
  unwrapTransaction.add(closeAccountIx);

  const { blockhash: unwrapBlockhash } =
    await connectionMainnet.getLatestBlockhash();
  unwrapTransaction.recentBlockhash = unwrapBlockhash;
  unwrapTransaction.feePayer = adminKeypair.publicKey;
  unwrapTransaction.partialSign(adminKeypair);

  return NextResponse.json({
    success: true,
    swapTransaction: swapTransaction
      .serialize({ requireAllSignatures: false })
      .toString("base64"),
    unwrapTransaction: unwrapTransaction
      .serialize({ requireAllSignatures: false })
      .toString("base64"),
  });
}
