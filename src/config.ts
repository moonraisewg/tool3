import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

export const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY!;
export const adminKeypair = Keypair.fromSecretKey(
  bs58.decode(ADMIN_PRIVATE_KEY)
);
export const ADMIN_PUBLIC_KEY = new PublicKey(process.env.ADMIN_PUBLIC_KEY!);
export const FEE_WALLET = ADMIN_PUBLIC_KEY;

export const TRANSACTION_FEE_SOL = 0.000005;
export const ACCOUNT_CREATION_FEE_SOL = 0.00203928;

export const DEFAULT_SLIPPAGE_BPS = 50;
export const PRIORITY_LEVEL = "medium";
export const MAX_LAMPORTS_PRIORITY = 1_000_000;
