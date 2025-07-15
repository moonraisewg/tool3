import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { WalletInfo } from "../create-wallets";

export interface SimpleTokenBalance {
  mint: string;
  amount: number;
}

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export async function fetchSolAndTokenBalancesBatched(
  wallets: WalletInfo[],
  connection: Connection,
  batchSize = 10,
  delayMs = 300
): Promise<
  (WalletInfo & {
    solAmount: number;
    tokenBalances: SimpleTokenBalance[];
  })[]
> {
  const results: (WalletInfo & {
    solAmount: number;
    tokenBalances: SimpleTokenBalance[];
  })[] = [];

  for (let i = 0; i < wallets.length; i += batchSize) {
    const batch = wallets.slice(i, i + batchSize);

    const batchResults = await Promise.allSettled(
      batch.map(async (wallet) => {
        try {
          const pubkey = new PublicKey(wallet.publicKey);
          const solLamports = await connection.getBalance(pubkey);
          const solAmount = solLamports / LAMPORTS_PER_SOL;

          const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            pubkey,
            {
              programId: TOKEN_PROGRAM_ID,
            }
          );

          const tokenBalances: SimpleTokenBalance[] = tokenAccounts.value.map(
            (acc) => {
              const info = acc.account.data.parsed.info;
              const mint = info.mint;
              const amount = parseFloat(info.tokenAmount.uiAmountString || "0");
              return { mint, amount };
            }
          );

          return {
            ...wallet,
            solAmount,
            tokenBalances,
          };
        } catch (err) {
          console.error(`Error with wallet ${wallet.publicKey}`, err);
          return {
            ...wallet,
            solAmount: 0,
            tokenBalances: [],
          };
        }
      })
    );

    results.push(
      ...batchResults.map((res, idx) =>
        res.status === "fulfilled"
          ? res.value
          : {
              ...batch[idx],
              solAmount: 0,
              tokenBalances: [],
            }
      )
    );

    if (i + batchSize < wallets.length) {
      await delay(delayMs);
    }
  }

  return results;
}
