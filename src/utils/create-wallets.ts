import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

export interface WalletInfo {
  keypair: Keypair;
  publicKey: string;
  secretKey: string;
  solAmount: number;
  transferAmount: number;
}

export function generateSolanaWallets(
  qty: number,
  mode: "fixed" | "random",
  value1: number,
  value2?: number
): WalletInfo[] {
  const wallets: WalletInfo[] = [];

  for (let i = 0; i < qty; i++) {
    const keypair = Keypair.generate();

    let amount: number;

    if (mode === "fixed") {
      amount = value1;
    } else {
      const min = value1;
      const max = value2 ?? value1;
      amount = parseFloat((Math.random() * (max - min) + min).toFixed(6));
    }

    wallets.push({
      keypair,
      publicKey: keypair.publicKey.toBase58(),
      secretKey: bs58.encode(keypair.secretKey),
      solAmount: amount,
      transferAmount: 0,
    });
  }

  return wallets;
}
