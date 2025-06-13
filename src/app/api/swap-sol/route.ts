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
import { getTokenFeeFromSolAndUsd } from "@/service/jupiter/calculate-fee";
import { getTokenProgram } from "@/lib/helper";
import {
  getJupiterQuote,
  getJupiterSwapInstructions,
  type JupiterInstruction,
} from "@/service/jupiter/swap";
import {
  adminKeypair,
  FEE_WALLET,
  TRANSACTION_FEE_SOL,
  ACCOUNT_CREATION_FEE_SOL,
} from "@/config";

interface SwapRequestBody {
  walletPublicKey: string;
  inputTokenMint: string;
  outputTokenMint: string;
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

  const quote = await getJupiterQuote(
    body.inputTokenMint,
    body.outputTokenMint,
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
    FEE_WALLET,
    false,
    inputTokenProgram
  );

  let accountCreationCount = 0;

  try {
    await getAccount(
      connectionMainnet,
      userOutputTokenAccount,
      "confirmed",
      outputTokenProgram
    );
  } catch {
    accountCreationCount++;
  }

  try {
    await getAccount(
      connectionMainnet,
      feeTokenAccount,
      "confirmed",
      inputTokenProgram
    );
  } catch {
    accountCreationCount++;
  }

  const totalAdminCostSOL =
    TRANSACTION_FEE_SOL + accountCreationCount * ACCOUNT_CREATION_FEE_SOL;

  const feeInTokens = await getTokenFeeFromSolAndUsd(
    totalAdminCostSOL,
    body.inputTokenMint
  );
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
      FEE_WALLET,
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
    quote,
    breakdown: {
      inputAmount: body.inputAmount,
      expectedOutputAmount:
        parseFloat(quote.outAmount) / Math.pow(10, outputMintInfo.decimals),
      feeAmount: feeAmount / Math.pow(10, inputDecimals),
      totalRequired: totalRequiredAmount / Math.pow(10, inputDecimals),
    },
    adminCostSOL: totalAdminCostSOL,
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
