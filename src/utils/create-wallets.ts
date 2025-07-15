import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

export interface WalletInfo {
  keypair: Keypair;
  publicKey: string;
  secretKey: string;
  solAmount: number;
  transferAmount: number;
  result?: "success" | "failed";
  tokenBalances?: {
    mint: string;
    amount: number;
  }[];
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

const LOCAL_STORAGE_KEY = "generatedWallets";
export function saveWalletsToLocalStorage(wallets: WalletInfo[]) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(wallets));
}

export function removeWalletsFromLocalStorage() {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}

export function loadWalletsFromLocalStorage(): WalletInfo[] | null {
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error("Failed to parse wallets from localStorage", e);
    return null;
  }
}
