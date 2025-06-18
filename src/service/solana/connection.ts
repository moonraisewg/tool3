import { Connection } from "@solana/web3.js";

const RPC_DEVNET = process.env.RPC_DEVNET;
const RPC_MAINNET = process.env.RPC_MAINNET;

if (!RPC_DEVNET) {
  throw new Error("Environment variable RPC_DEVNET is not set!");
}

if (!RPC_MAINNET) {
  throw new Error("Environment variable RPC_MAINNET is not set!");
}

export const connectionDevnet = new Connection(RPC_DEVNET, "confirmed");
export const connectionMainnet = new Connection(RPC_MAINNET, "confirmed");
