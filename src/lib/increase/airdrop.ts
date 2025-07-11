import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getJupiterQuote,
  getJupiterSwapInstructions,
  createInstructionFromJupiter,
} from "@/service/jupiter/swap";

import { type WalletInfo } from "@/utils/create-wallets";

export interface AirdropTransactions {
  initialTransaction: Transaction;
  childTransactions: Array<{
    transaction: Transaction;
    signers: Keypair[];
    description: string;
  }>;
  keypairMap: Map<string, Keypair>;
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

async function buildChildTransactions(
  wallets: WalletInfo[],
  connection: Connection,
  outputMint?: string,
  dexes?: string[]
): Promise<
  Array<{
    transaction: Transaction;
    signers: Keypair[];
    description: string;
  }>
> {
  const transactions: Array<{
    transaction: Transaction;
    signers: Keypair[];
    description: string;
  }> = [];

  const { blockhash } = await connection.getLatestBlockhash();

  async function createSwapInstruction(
    wallet: WalletInfo
  ): Promise<Transaction | null> {
    if (!outputMint) return null;

    try {
      const SOL_MINT = "So11111111111111111111111111111111111111112";
      const swapAmount = Math.round(wallet.solAmount * LAMPORTS_PER_SOL);

      console.log("[SWAP] Creating swap for wallet:", {
        walletPubkey: wallet.publicKey,
        solAmount: wallet.solAmount,
        swapAmount,
        outputMint,
        dexes,
      });

      const quote = await getJupiterQuote(
        SOL_MINT,
        outputMint,
        swapAmount,
        undefined,
        dexes
      );

      console.log("quote: ", quote);

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

      const swapTx = new Transaction();

      swapInstructions.computeBudgetInstructions.forEach((ix) => {
        swapTx.add(createInstructionFromJupiter(ix));
      });

      swapInstructions.setupInstructions.forEach((ix) => {
        swapTx.add(createInstructionFromJupiter(ix));
      });

      swapTx.add(
        createInstructionFromJupiter(swapInstructions.swapInstruction)
      );

      if (swapInstructions.cleanupInstruction) {
        swapTx.add(
          createInstructionFromJupiter(swapInstructions.cleanupInstruction)
        );
      }

      swapTx.recentBlockhash = blockhash;
      swapTx.feePayer = wallet.keypair.publicKey;

      return swapTx;
    } catch (error) {
      console.error(
        `Failed to create swap instruction for ${wallet.publicKey}:`,
        error
      );
      return null;
    }
  }

  async function buildDFSTransactions(
    index: number,
    parent: WalletInfo
  ): Promise<void> {
    if (index >= wallets.length) return;

    const left = index * 2 + 1;
    const right = index * 2 + 2;

    if (wallets[left]) {
      const tx = new Transaction();
      tx.add(
        SystemProgram.transfer({
          fromPubkey: parent.keypair.publicKey,
          toPubkey: new PublicKey(wallets[left].publicKey),
          lamports: Math.round(wallets[left].transferAmount * LAMPORTS_PER_SOL),
        })
      );
      tx.recentBlockhash = blockhash;
      tx.feePayer = parent.keypair.publicKey;

      transactions.push({
        transaction: tx,
        signers: [parent.keypair],
        description: `Transfer: ${parent.publicKey} -> ${wallets[left].publicKey} (${wallets[left].solAmount} SOL)`,
      });

      await buildDFSTransactions(left, wallets[left]);
    }

    if (wallets[right]) {
      const tx = new Transaction();
      tx.add(
        SystemProgram.transfer({
          fromPubkey: parent.keypair.publicKey,
          toPubkey: new PublicKey(wallets[right].publicKey),
          lamports: Math.round(
            wallets[right].transferAmount * LAMPORTS_PER_SOL
          ),
        })
      );
      tx.recentBlockhash = blockhash;
      tx.feePayer = parent.keypair.publicKey;

      transactions.push({
        transaction: tx,
        signers: [parent.keypair],
        description: `Transfer: ${parent.publicKey} -> ${wallets[right].publicKey} (${wallets[right].solAmount} SOL)`,
      });

      await buildDFSTransactions(right, wallets[right]);
    }

    if (index > 0 && outputMint) {
      const swapTx = await createSwapInstruction(wallets[index]);
      if (swapTx) {
        transactions.push({
          transaction: swapTx,
          signers: [wallets[index].keypair],
          description: `Swap: ${wallets[index].publicKey} swaps ${wallets[index].solAmount} SOL`,
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
  const wallets = prepareFundingAllocations(originalWallets);

  const initialTransaction = new Transaction();
  const firstLevelWallets = getFirstLevelWallets(wallets);

  for (const w of firstLevelWallets) {
    initialTransaction.add(
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: new PublicKey(w.publicKey),
        lamports: Math.round(w.transferAmount * LAMPORTS_PER_SOL),
      })
    );
  }

  const { blockhash } = await connection.getLatestBlockhash();
  initialTransaction.recentBlockhash = blockhash;
  initialTransaction.feePayer = userPublicKey;

  const childTransactions = await buildChildTransactions(
    wallets,
    connection,
    outputMint,
    dexes
  );

  const keypairMap = new Map(wallets.map((w) => [w.publicKey, w.keypair]));

  return {
    initialTransaction,
    childTransactions,
    keypairMap,
  };
}
