import { NextRequest, NextResponse } from "next/server";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getMint,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import { connectionMainnet } from "@/service/solana/connection";
import { getTokenFeeFromUsd } from "@/service/jupiter/calculate-fee";
import { getTokenProgram } from "@/lib/helper";
import {
  getJupiterQuote,
  getJupiterSwapInstructions,
  type JupiterInstruction,
} from "@/service/jupiter/swap";
import { adminKeypair } from "@/config";

interface SwapRequestBody {
  walletPublicKey: string;
  inputTokenMint: string;
  outputTokenMint: string; // Giả sử là SOL mint
  inputAmount: number;
  slippageBps?: number;
  signedTransaction?: number[];
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
  const outputTokenMint = new PublicKey(body.outputTokenMint);

  const inputMintInfo = await getMint(connectionMainnet, inputTokenMint);
  const inputDecimals = inputMintInfo.decimals;
  const inputTokenProgram = await getTokenProgram(inputMintInfo.address);

  const outputMintInfo = await getMint(connectionMainnet, outputTokenMint);
  const outputTokenProgram = await getTokenProgram(outputMintInfo.address);

  const inputAmountInLamports = Math.round(
    body.inputAmount * Math.pow(10, inputDecimals)
  );

  const feeInTokens = await getTokenFeeFromUsd(body.inputTokenMint, 0.5);
  const feeAmount = Math.round(feeInTokens * Math.pow(10, inputDecimals));
  const totalSwapAmount = inputAmountInLamports + feeAmount;

  const quote = await getJupiterQuote(
    body.inputTokenMint,
    body.outputTokenMint,
    totalSwapAmount
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

  // ✅ Check balance cho total amount
  try {
    const userAccount = await getAccount(
      connectionMainnet,
      userInputTokenAccount,
      "confirmed",
      inputTokenProgram
    );

    if (userAccount.amount < BigInt(totalSwapAmount)) {
      return NextResponse.json(
        {
          error: "Insufficient token balance",
          required: totalSwapAmount.toString(),
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

  const swapIx = createInstructionFromJupiter(
    swapInstructionsResponse.swapInstruction
  );
  transaction.add(swapIx);

  const totalSolOutput = parseFloat(quote.outAmount);
  const feeRatio = feeAmount / totalSwapAmount;
  const feeSolAmount = Math.round(totalSolOutput * feeRatio);
  const userSolAmount = totalSolOutput - feeSolAmount;

  if (feeSolAmount > 0) {
    const feeTransferIx = SystemProgram.transfer({
      fromPubkey: userPublicKey,
      toPubkey: adminKeypair.publicKey,
      lamports: feeSolAmount,
    });
    transaction.add(feeTransferIx);
  }

  const { blockhash, lastValidBlockHeight } =
    await connectionMainnet.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = adminKeypair.publicKey;
  transaction.partialSign(adminKeypair);

  const serializedTransaction = transaction
    .serialize({ requireAllSignatures: false })
    .toString("base64");

  const adjustedQuote = {
    ...quote,
    inAmount: inputAmountInLamports.toString(), // Chỉ input amount
    outAmount: userSolAmount.toString(),
  };

  return NextResponse.json({
    success: true,
    transaction: serializedTransaction,
    blockhash,
    lastValidBlockHeight,
    quote: adjustedQuote,
    breakdown: {
      inputAmount: body.inputAmount,
      expectedOutputAmount: userSolAmount / LAMPORTS_PER_SOL,
      feeAmount: feeAmount / Math.pow(10, inputDecimals),
      totalRequired: totalSwapAmount / Math.pow(10, inputDecimals),
      feeSolAmount: feeSolAmount / LAMPORTS_PER_SOL,
    },
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
      message: "Gasless swap completed successfully",
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
