import { Connection } from "@solana/web3.js";

const RPC_DEVNET = process.env.NEXT_PUBLIC_RPC_DEVNET;
const RPC_MAINNET = process.env.NEXT_PUBLIC_RPC_MAINNET;

if (!RPC_DEVNET) {
  throw new Error("Environment variable NEXT_PUBLIC_RPC_DEVNET is not set!");
}

if (!RPC_MAINNET) {
  throw new Error("Environment variable NEXT_PUBLIC_RPC_MAINNET is not set!");
}

export const connectionDevnet = new Connection(RPC_DEVNET, "confirmed");
export const connectionMainnet = new Connection(RPC_MAINNET, "confirmed");
