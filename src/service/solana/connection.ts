import { Connection, clusterApiUrl } from "@solana/web3.js";

const RPC_NETWORK = "devnet";

export const connection = new Connection(
  clusterApiUrl(RPC_NETWORK),
  "confirmed"
);
