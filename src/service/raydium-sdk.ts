import { Raydium } from "@raydium-io/raydium-sdk-v2";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";
import { connection } from "@/service/solana/connection";

const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const cluster = "devnet";
if (!ADMIN_PRIVATE_KEY) {
  throw new Error("ADMIN_PRIVATE_KEY not set in .env");
}
export const owner = Keypair.fromSecretKey(bs58.decode(ADMIN_PRIVATE_KEY));

export const initSdk = async () => {
  console.log("Initializing Raydium SDK...");
  try {
    const raydium = await Raydium.load({
      owner,
      connection,
      cluster,
      disableFeatureCheck: true,
      blockhashCommitment: "finalized",
    });
    return raydium;
  } catch (error) {
    console.error("Error initializing SDK:", error);
    throw error;
  }
};
