import {
  Raydium,
  CpmmKeys,
  ApiV3PoolInfoStandardItemCpmm,
  TxVersion
} from "@raydium-io/raydium-sdk-v2";
import bs58 from "bs58";
import { Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { connection } from "@/service/solana/connection";

export const txVersion = TxVersion.V0

const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const cluster = "devnet";

if (!ADMIN_PRIVATE_KEY) {
  throw new Error("ADMIN_PRIVATE_KEY not set in .env");
}

export const owner = Keypair.fromSecretKey(bs58.decode(ADMIN_PRIVATE_KEY));

let cachedRaydium: Raydium | null = null;

export const initSdk = async (): Promise<Raydium> => {
  if (cachedRaydium) return cachedRaydium;

  console.log("Initializing Raydium SDK...");
  try {
    cachedRaydium = await Raydium.load({
      owner,
      connection,
      cluster,
      disableFeatureCheck: true,
      blockhashCommitment: "finalized",
    });
    return cachedRaydium;
  } catch (error) {
    console.error("Error initializing SDK:", error);
    throw error;
  }
};

const getPoolInfoById = async (
  poolId: string
): Promise<{
  poolInfo: ApiV3PoolInfoStandardItemCpmm;
  poolKeys?: CpmmKeys;
}> => {
  const raydium = await initSdk();

  if (raydium.cluster === "mainnet") {
    const data = await raydium.api.fetchPoolById({ ids: poolId });
    const poolInfo = data[0] as ApiV3PoolInfoStandardItemCpmm;
    return { poolInfo };
  } else {
    const data = await raydium.cpmm.getPoolInfoFromRpc(poolId);
    return {
      poolInfo: data.poolInfo,
      poolKeys: data.poolKeys,
    };
  }
};

export interface LpTokenData {
  lpMint: string;
  balance: number;
}

export const fetchLpMintAndBalanceFromRaydium = async (
  poolId: string,
  userPublicKey?: string
): Promise<LpTokenData | null> => {
  try {
    const { poolKeys } = await getPoolInfoById(poolId);

    if (!poolKeys || !poolKeys.mintLp) {
      return null;
    }

    const lpMint = poolKeys.mintLp.address;
    let balance = 0;

    if (userPublicKey) {
      try {
        const lpTokenAccount = getAssociatedTokenAddressSync(
          new PublicKey(lpMint),
          new PublicKey(userPublicKey)
        );

        const balanceInfo = await connection.getTokenAccountBalance(
          lpTokenAccount
        );
        balance = balanceInfo.value.uiAmount ?? 0;
      } catch (error) {
        console.warn("Unable to get LP token balance:", error);
      }
    }

    return { lpMint, balance };
  } catch (error) {
    console.error(`Error fetching LP info from pool ${poolId}:`, error);
    return null;
  }
};
