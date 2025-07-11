import { Connection, PublicKey } from "@solana/web3.js";
import { WalletInfo } from "../create-wallets";

export async function checkBalances(
  wallets: WalletInfo[],
  connection: Connection
): Promise<WalletInfo[]> {
  const results = await Promise.allSettled(
    wallets.map(async (wallet) => {
      const pubkey = new PublicKey(wallet.publicKey);
      const balanceLamports = await connection.getBalance(pubkey);
      const balanceSOL = balanceLamports / 1_000_000_000;
      return {
        ...wallet,
        solAmount: balanceSOL,
      };
    })
  );

  return results.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    console.error(
      ` Failed to get balance for ${wallets[i].publicKey}`,
      result.reason
    );
    return wallets[i];
  });
}
