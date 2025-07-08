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

import { getTokenFeeFromUsd } from "@/service/jupiter/calculate-fee";

const SOL_MINT = "So11111111111111111111111111111111111111112";

export interface SwapTokenData {
  inputTokenMint: string;
}

export interface SwapResult {
  inputTokenMint: string;
  actualInputAmount: number;
  expectedSolOutput: number;
  quote: QuoteResponse;
}

export interface BatchTransactionResult {
  transaction: VersionedTransaction;
  tokenSwaps: string[];
  expectedSolOutput: number;
  metadata: {
    batchIndex: number;
    swapCount: number;
    instructionCount: number;
    transactionSize: number;
  };
}

export interface MultiSwapResult {
  transactions: BatchTransactionResult[];
  metadata: {
    totalBatches: number;
    totalTokenSwaps: number;
    batchSize: number;
    totalInstructions: number;
    adminFeeInSol: number;
    feeChargedInLastBatch: boolean;
  };
  breakdown: {
    totalTokenSwaps: number;
    totalExpectedSolOutput: number;
    adminFeeInSol: number;
    netSolAfterFee: number;
    estimatedTotalGasFee: number;
    batchBreakdown: Array<{
      batchIndex: number;
      tokenCount: number;
      expectedSolOutput: number;
      instructionCount: number;
      transactionSize: number;
    }>;
  };
  allSwapResults: SwapResult[];
}

export async function createMultiSwapToSolTransactions(
  walletPublicKey: PublicKey,
  tokenSwaps: SwapTokenData[],
  batchSize: number = 3
): Promise<MultiSwapResult> {
  console.log(
    `Creating batched transactions: ${tokenSwaps.length} tokens, ${batchSize} per batch`
  );

  const balanceValidation = await validateTokenBalances(
    tokenSwaps,
    walletPublicKey
  );
  if (!balanceValidation.success) {
    throw new Error(balanceValidation.error);
  }

  const adminFeeInSol = await getTokenFeeFromUsd(
    SOL_MINT,
    0.5,
    walletPublicKey.toString()
  );

  const tokenBatches: SwapTokenData[][] = [];
  for (let i = 0; i < tokenSwaps.length; i += batchSize) {
    tokenBatches.push(tokenSwaps.slice(i, i + batchSize));
  }

  console.log(`Created ${tokenBatches.length} batches`);

  const batchTransactions: BatchTransactionResult[] = [];
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
        walletPublicKey,
        batchIndex,
        isLastBatch ? adminFeeInSol : 0
      );

      batchTransactions.push(batchResult.transaction);
      allSwapResults.push(...batchResult.swapResults);
      totalExpectedSolOutput += batchResult.expectedSolOutput;
    } catch (error) {
      throw new Error(
        `Failed to create batch ${batchIndex + 1}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  const userSolBalance = await connectionMainnet.getBalance(walletPublicKey);
  const estimatedGasFeePerTx = 0.001;
  const totalEstimatedGasFee = estimatedGasFeePerTx * batchTransactions.length;

  if (userSolBalance < totalEstimatedGasFee * LAMPORTS_PER_SOL) {
    throw new Error(
      `Insufficient SOL balance for multiple transactions. Required: ${totalEstimatedGasFee} SOL, Available: ${
        userSolBalance / LAMPORTS_PER_SOL
      } SOL`
    );
  }

  console.log(
    `All ${batchTransactions.length} batch transactions created successfully`
  );

  return {
    transactions: batchTransactions,
    metadata: {
      totalBatches: batchTransactions.length,
      totalTokenSwaps: tokenSwaps.length,
      batchSize: batchSize,
      totalInstructions: batchTransactions.reduce(
        (sum, batch) => sum + batch.metadata.instructionCount,
        0
      ),
      adminFeeInSol: adminFeeInSol,
      feeChargedInLastBatch: true,
    },
    breakdown: {
      totalTokenSwaps: tokenSwaps.length,
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
  };
}

async function createBatchTransaction(
  tokenBatch: SwapTokenData[],
  userPublicKey: PublicKey,
  batchIndex: number,
  adminFeeInSol: number = 0
): Promise<{
  transaction: BatchTransactionResult;
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
  const ADMIN_PUBLIC_KEY = process.env.NEXT_PUBLIC_ADMIN_PUBLIC_KEY!;

  if (adminFeeInLamports > 0) {
    const solTransferIx = SystemProgram.transfer({
      fromPubkey: userPublicKey,
      toPubkey: new PublicKey(ADMIN_PUBLIC_KEY),
      lamports: adminFeeInLamports,
    });
    instructions.push(solTransferIx);
    console.log(
      `Added ${adminFeeInSol} SOL admin fee to batch ${batchIndex + 1}`
    );
  }

  const { blockhash } = await connectionMainnet.getLatestBlockhash();
  const messageV0 = new TransactionMessage({
    payerKey: userPublicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message(lookupTableAccounts);

  const versionedTransaction = new VersionedTransaction(messageV0);
  const transactionSize = versionedTransaction.serialize().length;

  console.log(
    `Batch ${batchIndex + 1} created: ${tokenBatch.length} swaps, ${
      instructions.length
    } instructions, ${transactionSize} bytes`
  );

  const batchTransaction: BatchTransactionResult = {
    transaction: versionedTransaction,
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
  tokenSwap: SwapTokenData,
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

  console.log(
    "Full Jupiter Response:",
    JSON.stringify(swapInstructionsResponse, null, 2)
  );

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
  tokenSwaps: SwapTokenData[],
  userPublicKey: PublicKey
): Promise<{ success: boolean; error?: string }> {
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
          error: `No token balance to swap for ${tokenSwap.inputTokenMint}`,
        };
      }
    } catch {
      return {
        success: false,
        error: `Token account not found for ${tokenSwap.inputTokenMint}`,
      };
    }
  }

  return { success: true };
}
