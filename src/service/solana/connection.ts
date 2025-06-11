import { Connection } from "@solana/web3.js";

const heliusApiKey = process.env.HELIUS_API_KEY;
const cluster = process.env.CLUSTER;
const rpc = `https://${cluster}.helius-rpc.com/?api-key=${heliusApiKey}`;
const rpcDevnet = `https://devnet.helius-rpc.com/?api-key=${heliusApiKey}`;
const rpcMainnet = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;

export const connection = new Connection(rpc, "confirmed");

export const connectionDevnet = new Connection(rpcDevnet, "confirmed");

export const connectionMainnet = new Connection(rpcMainnet, "confirmed");