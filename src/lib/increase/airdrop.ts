import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
  TransactionMessage,
  AddressLookupTableAccount,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  getJupiterQuote,
  getJupiterSwapInstructions,
  createInstructionFromJupiter,
} from "@/service/jupiter/swap";

import { type WalletInfo } from "@/utils/create-wallets";

const BATCH_SIZE = 3;
const DELAY_BETWEEN_BATCHES = 2000;
const DELAY_BETWEEN_TRANSACTIONS = 500;

export interface AirdropTransactions {
  initialTransaction: VersionedTransaction;
  childTransactions: Array<{
    transaction: VersionedTransaction;
    signers: Keypair[];
    description: string;
    walletIndex: number;
  }>;
  keypairMap: Map<string, Keypair>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createVersionedTransaction(
  connection: Connection,
  instructions: TransactionInstruction[],
  feePayer: PublicKey,
  lookupTables?: AddressLookupTableAccount[]
): Promise<VersionedTransaction> {
  const { blockhash } = await connection.getLatestBlockhash();

  const messageV0 = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message(lookupTables || []);

  return new VersionedTransaction(messageV0);
}

function calculateRequiredFunding(
  wallets: WalletInfo[],
  index: number,
  feePerTransfer = 5000,
  extraBuffer = 5000000
): number {
  if (index >= wallets.length) return 0;

  const wallet = wallets[index];
  const left = index * 2 + 1;
  const right = index * 2 + 2;

  const leftCost = wallets[left]
    ? calculateRequiredFunding(wallets, left, feePerTransfer) + feePerTransfer
    : 0;

  const rightCost = wallets[right]
    ? calculateRequiredFunding(wallets, right, feePerTransfer) + feePerTransfer
    : 0;

  const selfHolding =
    Math.round(wallet.solAmount * LAMPORTS_PER_SOL) + extraBuffer;

  return selfHolding + leftCost + rightCost;
}

export function prepareFundingAllocations(wallets: WalletInfo[]): WalletInfo[] {
  const fundedWallets = wallets.map((w) => ({ ...w }));

  for (let i = 1; i < fundedWallets.length; i++) {
    const totalLamports = calculateRequiredFunding(fundedWallets, i);
    fundedWallets[i].transferAmount = totalLamports / LAMPORTS_PER_SOL;
  }

  return fundedWallets;
}

function getFirstLevelWallets(wallets: WalletInfo[]): WalletInfo[] {
  const firstLevel: WalletInfo[] = [];
  if (wallets[1]) firstLevel.push(wallets[1]);
  if (wallets[2]) firstLevel.push(wallets[2]);
  return firstLevel;
}

async function createSwapTransaction(
  wallet: WalletInfo,
  connection: Connection,
  outputMint: string,
  dexes?: string[]
): Promise<VersionedTransaction | null> {
  try {
    const SOL_MINT = "So11111111111111111111111111111111111111112";
    const swapAmount = Math.round(wallet.solAmount * LAMPORTS_PER_SOL);

    let processedDexes = dexes;
    if (dexes && dexes[0] === "Raydium,Meteora,Orca+V2") {
      processedDexes = dexes[0].split(",").map((d) => d.trim());
    }

    let quote;
    try {
      quote = await getJupiterQuote(
        SOL_MINT,
        outputMint,
        swapAmount,
        undefined,
        processedDexes
      );
    } catch (error) {
      if (dexes && dexes[0] === "Raydium,Meteora,Orca+V2") {
        quote = await getJupiterQuote(
          SOL_MINT,
          outputMint,
          swapAmount,
          undefined,
          undefined
        );
      } else {
        throw error;
      }
    }

    const swapInstructions = await getJupiterSwapInstructions({
      userPublicKey: wallet.publicKey,
      quoteResponse: quote,
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: {
          maxLamports: 1000,
          priorityLevel: "medium",
        },
      },
    });

    const instructions = [];

    swapInstructions.computeBudgetInstructions.forEach((ix) => {
      instructions.push(createInstructionFromJupiter(ix));
    });

    swapInstructions.setupInstructions.forEach((ix) => {
      instructions.push(createInstructionFromJupiter(ix));
    });

    instructions.push(
      createInstructionFromJupiter(swapInstructions.swapInstruction)
    );

    if (swapInstructions.cleanupInstruction) {
      instructions.push(
        createInstructionFromJupiter(swapInstructions.cleanupInstruction)
      );
    }

    const tx = await createVersionedTransaction(
      connection,
      instructions,
      wallet.keypair.publicKey
    );

    tx.sign([wallet.keypair]);

    return tx;
  } catch (error) {
    console.error(
      `Failed to create swap transaction for ${wallet.publicKey}:`,
      error
    );
    return null;
  }
}

async function buildChildTransactions(
  wallets: WalletInfo[],
  connection: Connection,
  outputMint?: string,
  dexes?: string[]
): Promise<
  Array<{
    transaction: VersionedTransaction;
    signers: Keypair[];
    description: string;
    walletIndex: number;
  }>
> {
  const transactions: Array<{
    transaction: VersionedTransaction;
    signers: Keypair[];
    description: string;
    walletIndex: number;
  }> = [];

  const walletIndexMap = new Map<string, number>();
  wallets.forEach((wallet, index) => {
    walletIndexMap.set(wallet.publicKey, index);
  });

  async function buildDFSTransactions(
    index: number,
    parent: WalletInfo
  ): Promise<void> {
    if (index >= wallets.length) return;

    const left = index * 2 + 1;
    const right = index * 2 + 2;

    if (wallets[left]) {
      const instruction = SystemProgram.transfer({
        fromPubkey: parent.keypair.publicKey,
        toPubkey: new PublicKey(wallets[left].publicKey),
        lamports: Math.round(wallets[left].transferAmount * LAMPORTS_PER_SOL),
      });

      const tx = await createVersionedTransaction(
        connection,
        [instruction],
        parent.keypair.publicKey
      );

      tx.sign([parent.keypair]);

      transactions.push({
        transaction: tx,
        signers: [parent.keypair],
        description: `Transfer: ${parent.publicKey} -> ${wallets[left].publicKey} (${wallets[left].transferAmount} SOL)`,
        walletIndex: left,
      });

      await buildDFSTransactions(left, wallets[left]);
    }

    if (wallets[right]) {
      const instruction = SystemProgram.transfer({
        fromPubkey: parent.keypair.publicKey,
        toPubkey: new PublicKey(wallets[right].publicKey),
        lamports: Math.round(wallets[right].transferAmount * LAMPORTS_PER_SOL),
      });

      const tx = await createVersionedTransaction(
        connection,
        [instruction],
        parent.keypair.publicKey
      );

      tx.sign([parent.keypair]);

      transactions.push({
        transaction: tx,
        signers: [parent.keypair],
        description: `Transfer: ${parent.publicKey} -> ${wallets[right].publicKey} (${wallets[right].transferAmount} SOL)`,
        walletIndex: right,
      });

      await buildDFSTransactions(right, wallets[right]);
    }

    if (index > 0 && outputMint) {
      const swapTx = await createSwapTransaction(
        wallets[index],
        connection,
        outputMint,
        dexes
      );

      if (swapTx) {
        transactions.push({
          transaction: swapTx,
          signers: [wallets[index].keypair],
          description: `Swap: ${wallets[index].publicKey} swaps ${wallets[index].solAmount} SOL -> ${outputMint}`,
          walletIndex: index,
        });
      }
    }
  }

  const firstLevelWallets = getFirstLevelWallets(wallets);
  for (let i = 0; i < firstLevelWallets.length; i++) {
    await buildDFSTransactions(i + 1, firstLevelWallets[i]);
  }

  return transactions;
}

export async function buildAirdropTransactions(
  userPublicKey: PublicKey,
  originalWallets: WalletInfo[],
  connection: Connection,
  outputMint?: string,
  dexes?: string[]
): Promise<AirdropTransactions> {
  console.log("Building airdrop transactions...", {
    walletsCount: originalWallets.length,
    outputMint,
    dexes,
  });

  const wallets = prepareFundingAllocations(originalWallets);
  const firstLevelWallets = getFirstLevelWallets(wallets);

  let processedDexes = dexes;

  if (dexes && dexes.length > 0) {
    if (dexes[0] === "Raydium,Meteora,Orca+V2") {
      processedDexes = dexes[0].split(",").map((d) => d.trim());
    }
  }

  const transferInstructions = [];
  for (const w of firstLevelWallets) {
    transferInstructions.push(
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: new PublicKey(w.publicKey),
        lamports: Math.round(w.transferAmount * LAMPORTS_PER_SOL),
      })
    );
  }

  const initialTransaction = await createVersionedTransaction(
    connection,
    transferInstructions,
    userPublicKey
  );

  const childTransactions = await buildChildTransactions(
    wallets,
    connection,
    outputMint,
    processedDexes
  );

  const keypairMap = new Map(wallets.map((w) => [w.publicKey, w.keypair]));

  return {
    initialTransaction,
    childTransactions,
    keypairMap,
  };
}

export async function executeChildTransactionsBatched(
  childTransactions: Array<{
    transaction: VersionedTransaction;
    signers: Keypair[];
    description: string;
    walletIndex: number;
  }>,
  connection: Connection,
  wallets: WalletInfo[],
  onProgress?: (completed: number, total: number) => void
): Promise<void> {
  console.log(
    `Executing ${childTransactions.length} child transactions in batches...`
  );

  const batches = [];
  for (let i = 0; i < childTransactions.length; i += BATCH_SIZE) {
    batches.push(childTransactions.slice(i, i + BATCH_SIZE));
  }

  let completedTransactions = 0;

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    console.log(
      `Processing batch ${batchIndex + 1}/${batches.length} (${
        batch.length
      } transactions)`
    );

    const batchPromises = batch.map(async (child, indexInBatch) => {
      await sleep(indexInBatch * DELAY_BETWEEN_TRANSACTIONS);

      try {
        const signature = await connection.sendTransaction(child.transaction);
        await connection.confirmTransaction(signature, "confirmed");

        if (child.walletIndex < wallets.length) {
          wallets[child.walletIndex].result = "success";
        }

        completedTransactions++;
        onProgress?.(completedTransactions, childTransactions.length);

        console.log(
          ` Transaction ${completedTransactions}/${childTransactions.length} completed`
        );

        return { success: true, signature, walletIndex: child.walletIndex };
      } catch (err) {
        console.error(
          ` Transaction failed for wallet ${child.walletIndex}:`,
          err
        );

        if (child.walletIndex < wallets.length) {
          wallets[child.walletIndex].result = "failed";
        }

        completedTransactions++;
        onProgress?.(completedTransactions, childTransactions.length);

        return { success: false, error: err, walletIndex: child.walletIndex };
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);

    const successCount = batchResults.filter(
      (r) => r.status === "fulfilled"
    ).length;
    console.log(
      `Batch ${batchIndex + 1} completed: ${successCount}/${
        batch.length
      } successful`
    );

    if (batchIndex < batches.length - 1) {
      console.log(`Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }

  console.log(
    `All batches completed. Total: ${completedTransactions}/${childTransactions.length}`
  );
}
