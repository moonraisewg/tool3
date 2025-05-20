import { Connection, clusterApiUrl } from "@solana/web3.js";

const cluster = "devnet";
// const rpc = "https://api.devnet.solana.com";

export const connection = new Connection(clusterApiUrl(cluster), "confirmed");
