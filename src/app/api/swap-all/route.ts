import { NextRequest, NextResponse } from "next/server";
import {
  PublicKey,
  TransactionInstruction,
  VersionedTransaction,
  TransactionMessage,
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getMint,
  getAccount,
} from "@solana/spl-token";
import { connectionMainnet } from "@/service/solana/connection";
import { getTokenProgram } from "@/lib/helper";
import {
  getJupiterQuote,
  getJupiterSwapInstructions,
  createInstructionFromJupiter,
  type QuoteResponse,
} from "@/service/jupiter/swap";
import { adminKeypair } from "@/config";
import { getTokenFeeFromUsd } from "@/service/jupiter/calculate-fee";
import { BatchTransaction } from "@/types/types";

const SOL_MINT = "So11111111111111111111111111111111111111112";

interface MultiSwapToSolRequestBody {
  walletPublicKey: string;
  tokenSwaps: Array<{
    inputTokenMint: string;
  }>;
  batchSize?: number;
}

interface SwapResult {
  inputTokenMint: string;
  actualInputAmount: number;
  expectedSolOutput: number;
  quote: QuoteResponse;
}

export async function POST(req: NextRequest) {
  try {
    const body: MultiSwapToSolRequestBody = await req.json();
    console.log("Multi-swap to SOL request:", {
      wallet: body.walletPublicKey,
      tokenSwapCount: body.tokenSwaps?.length || 0,
      batchSize: body.batchSize || 3,
    });

    if (!body.tokenSwaps || body.tokenSwaps.length === 0) {
      return NextResponse.json(
        { error: "No token swaps provided" },
        { status: 400 }
      );
    }

    return await prepareBatchedSwapTransactions(body);
  } catch (error: unknown) {
    console.error("Multi-swap to SOL error:", error);
    return NextResponse.json(
      {
        error: "Failed to process multi-swap to SOL",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function prepareBatchedSwapTransactions(body: MultiSwapToSolRequestBody) {
  const userPublicKey = new PublicKey(body.walletPublicKey);
  const batchSize = body.batchSize || 3;
  const adminFeeInSol = await getTokenFeeFromUsd(SOL_MINT, 0.5);

  console.log(
    `Creating batched transactions: ${body.tokenSwaps.length} tokens, ${batchSize} per batch`
  );

  const balanceValidation = await validateTokenBalances(
    body.tokenSwaps,
    userPublicKey
  );
  if (!balanceValidation.success) {
    return NextResponse.json(balanceValidation.error, { status: 400 });
  }

  const tokenBatches: Array<MultiSwapToSolRequestBody["tokenSwaps"]> = [];
  for (let i = 0; i < body.tokenSwaps.length; i += batchSize) {
    tokenBatches.push(body.tokenSwaps.slice(i, i + batchSize));
  }

  console.log(`Created ${tokenBatches.length} batches`);

  const batchTransactions: BatchTransaction[] = [];
  const allSwapResults: SwapResult[] = [];
  let totalExpectedSolOutput = 0;

  for (let batchIndex = 0; batchIndex < tokenBatches.length; batchIndex++) {
    const batch = tokenBatches[batchIndex];
    const isLastBatch = batchIndex === tokenBatches.length - 1;

    console.log(
      `Processing batch ${batchIndex + 1}/${tokenBatches.length}: ${
        batch.length
      } tokens`
    );

    try {
      const batchResult = await createBatchTransaction(
        batch,
        userPublicKey,
        batchIndex,
        isLastBatch ? adminFeeInSol : 0
      );

      batchTransactions.push(batchResult.transaction);
      allSwapResults.push(...batchResult.swapResults);
      totalExpectedSolOutput += batchResult.expectedSolOutput;
    } catch (error) {
      return NextResponse.json(
        {
          error: `Failed to create batch ${batchIndex + 1}`,
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 400 }
      );
    }
  }

  const userSolBalance = await connectionMainnet.getBalance(userPublicKey);
  const estimatedGasFeePerTx = 0.001;
  const totalEstimatedGasFee = estimatedGasFeePerTx * batchTransactions.length;

  if (userSolBalance < totalEstimatedGasFee * LAMPORTS_PER_SOL) {
    return NextResponse.json(
      {
        error: "Insufficient SOL balance for multiple transactions",
        userSolBalance: userSolBalance / LAMPORTS_PER_SOL,
        estimatedTotalGasFee: totalEstimatedGasFee,
        transactionCount: batchTransactions.length,
      },
      { status: 400 }
    );
  }

  console.log(
    `All ${batchTransactions.length} batch transactions created successfully`
  );

  return NextResponse.json({
    success: true,
    transactions: batchTransactions,
    metadata: {
      totalBatches: batchTransactions.length,
      totalTokenSwaps: body.tokenSwaps.length,
      batchSize: batchSize,
      totalInstructions: batchTransactions.reduce(
        (sum, batch) => sum + batch.metadata.instructionCount,
        0
      ),
      adminFeeInSol: adminFeeInSol,
      feeChargedInLastBatch: true,
    },
    breakdown: {
      totalTokenSwaps: body.tokenSwaps.length,
      totalExpectedSolOutput: totalExpectedSolOutput,
      adminFeeInSol: adminFeeInSol,
      netSolAfterFee: totalExpectedSolOutput - adminFeeInSol,
      estimatedTotalGasFee: totalEstimatedGasFee,
      batchBreakdown: batchTransactions.map((batch, index) => ({
        batchIndex: index + 1,
        tokenCount: batch.tokenSwaps.length,
        expectedSolOutput: batch.expectedSolOutput,
        instructionCount: batch.metadata.instructionCount,
        transactionSize: batch.metadata.transactionSize,
      })),
    },
    allSwapResults,
  });
}

async function createBatchTransaction(
  tokenBatch: MultiSwapToSolRequestBody["tokenSwaps"],
  userPublicKey: PublicKey,
  batchIndex: number,
  adminFeeInSol: number = 0
): Promise<{
  transaction: BatchTransaction;
  swapResults: SwapResult[];
  expectedSolOutput: number;
}> {
  const instructions: TransactionInstruction[] = [];
  const lookupTableAccounts: AddressLookupTableAccount[] = [];
  const swapResults: SwapResult[] = [];
  let batchExpectedSolOutput = 0;

  const baseComputeUnits = 200000;
  const perSwapComputeUnits = 150000;
  const totalComputeUnits =
    baseComputeUnits + tokenBatch.length * perSwapComputeUnits;

  instructions.push(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),
    ComputeBudgetProgram.setComputeUnitLimit({ units: totalComputeUnits })
  );

  for (let i = 0; i < tokenBatch.length; i++) {
    const tokenSwap = tokenBatch[i];

    try {
      const swapResult = await processTokenToSolSwap(
        tokenSwap,
        userPublicKey,
        instructions,
        lookupTableAccounts
      );

      swapResults.push(swapResult);
      batchExpectedSolOutput += swapResult.expectedSolOutput;
    } catch (error) {
      throw new Error(
        `Failed to process token ${tokenSwap.inputTokenMint} in batch ${
          batchIndex + 1
        }: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  const adminFeeInLamports = Math.round(adminFeeInSol * LAMPORTS_PER_SOL);
  const solTransferIx = SystemProgram.transfer({
    fromPubkey: userPublicKey,
    toPubkey: adminKeypair.publicKey,
    lamports: adminFeeInLamports,
  });
  instructions.push(solTransferIx);
  console.log(
    `Added ${adminFeeInSol} SOL admin fee to batch ${batchIndex + 1}`
  );

  const { blockhash } = await connectionMainnet.getLatestBlockhash();

  const messageV0 = new TransactionMessage({
    payerKey: userPublicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message(lookupTableAccounts);

  const versionedTransaction = new VersionedTransaction(messageV0);
  const serializedTransaction = Buffer.from(
    versionedTransaction.serialize()
  ).toString("base64");
  const transactionSize = versionedTransaction.serialize().length;

  console.log(
    `Batch ${batchIndex + 1} created: ${tokenBatch.length} swaps, ${
      instructions.length
    } instructions, ${transactionSize} bytes`
  );

  const batchTransaction: BatchTransaction = {
    transaction: serializedTransaction,
    tokenSwaps: tokenBatch.map((t) => t.inputTokenMint),
    expectedSolOutput: batchExpectedSolOutput,
    metadata: {
      batchIndex: batchIndex + 1,
      swapCount: tokenBatch.length,
      instructionCount: instructions.length,
      transactionSize,
    },
  };

  return {
    transaction: batchTransaction,
    swapResults,
    expectedSolOutput: batchExpectedSolOutput,
  };
}

async function processTokenToSolSwap(
  tokenSwap: MultiSwapToSolRequestBody["tokenSwaps"][0],
  userPublicKey: PublicKey,
  instructions: TransactionInstruction[],
  lookupTableAccounts: AddressLookupTableAccount[]
): Promise<SwapResult> {
  const inputTokenMint = new PublicKey(tokenSwap.inputTokenMint);

  const inputMintInfo = await getMint(connectionMainnet, inputTokenMint);
  const inputTokenProgram = await getTokenProgram(inputMintInfo.address);

  const userTokenAccount = await getAssociatedTokenAddress(
    inputTokenMint,
    userPublicKey,
    false,
    inputTokenProgram
  );

  const account = await getAccount(
    connectionMainnet,
    userTokenAccount,
    "confirmed",
    inputTokenProgram
  );

  const inputAmountInLamports = Number(account.amount);

  if (inputAmountInLamports === 0) {
    throw new Error(`No balance found for token ${tokenSwap.inputTokenMint}`);
  }

  const quote = await getJupiterQuote(
    tokenSwap.inputTokenMint,
    SOL_MINT,
    inputAmountInLamports
  );

  const swapInstructionsResponse = await getJupiterSwapInstructions({
    userPublicKey: userPublicKey.toString(),
    quoteResponse: quote,
    dynamicComputeUnitLimit: true,
  });

  await collectLookupTables(
    swapInstructionsResponse.addressLookupTableAddresses,
    lookupTableAccounts
  );

  if (swapInstructionsResponse.setupInstructions?.length > 0) {
    instructions.push(
      ...swapInstructionsResponse.setupInstructions.map(
        createInstructionFromJupiter
      )
    );
  }

  instructions.push(
    createInstructionFromJupiter(swapInstructionsResponse.swapInstruction)
  );

  if (swapInstructionsResponse.cleanupInstruction) {
    instructions.push(
      createInstructionFromJupiter(swapInstructionsResponse.cleanupInstruction)
    );
  }

  const expectedSolOutput = parseFloat(quote.outAmount) / LAMPORTS_PER_SOL;
  const actualInputAmount =
    inputAmountInLamports / Math.pow(10, inputMintInfo.decimals);

  return {
    inputTokenMint: tokenSwap.inputTokenMint,
    actualInputAmount: actualInputAmount,
    expectedSolOutput: expectedSolOutput,
    quote,
  };
}

async function collectLookupTables(
  addresses: string[],
  lookupTableAccounts: AddressLookupTableAccount[]
) {
  for (const address of addresses) {
    try {
      const lookupTableAccount = await connectionMainnet.getAddressLookupTable(
        new PublicKey(address)
      );

      if (lookupTableAccount.value) {
        const exists = lookupTableAccounts.some((account) =>
          account.key.equals(lookupTableAccount.value!.key)
        );

        if (!exists) {
          lookupTableAccounts.push(lookupTableAccount.value);
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch lookup table ${address}:`, error);
    }
  }
}

async function validateTokenBalances(
  tokenSwaps: MultiSwapToSolRequestBody["tokenSwaps"],
  userPublicKey: PublicKey
) {
  for (const tokenSwap of tokenSwaps) {
    const tokenPublicKey = new PublicKey(tokenSwap.inputTokenMint);
    const tokenProgram = await getTokenProgram(tokenPublicKey);
    const userTokenAccount = await getAssociatedTokenAddress(
      tokenPublicKey,
      userPublicKey,
      false,
      tokenProgram
    );

    try {
      const account = await getAccount(
        connectionMainnet,
        userTokenAccount,
        "confirmed",
        tokenProgram
      );

      if (account.amount === BigInt(0)) {
        return {
          success: false,
          error: {
            error: "No token balance to swap",
            tokenMint: tokenSwap.inputTokenMint,
          },
        };
      }
    } catch {
      return {
        success: false,
        error: {
          error: "Token account not found",
          tokenMint: tokenSwap.inputTokenMint,
        },
      };
    }
  }

  return { success: true };
}
