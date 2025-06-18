import {
  Raydium,
  CpmmKeys,
  ApiV3PoolInfoStandardItemCpmm,
  TxVersion,
} from "@raydium-io/raydium-sdk-v2";

import { adminKeypair } from "@/config";
import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { connectionDevnet } from "./solana/connection";

export const txVersion = TxVersion.V0;

const cluster = "devnet";

export const owner = adminKeypair;

let cachedRaydium: Raydium | null = null;

export const initSdk = async (connection: Connection): Promise<Raydium> => {
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

export const createAtaIfMissing = async (
  connection: Connection,
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey
): Promise<{ ata: PublicKey; instructions: TransactionInstruction[] }> => {
  const ata = await getAssociatedTokenAddress(mint, owner);
  const accountInfo = await connection.getAccountInfo(ata);
  if (accountInfo === null) {
    const instruction = createAssociatedTokenAccountInstruction(
      payer, // funding payer
      ata, // ATA address
      owner, // token account owner
      mint // token mint
    );
    return { ata, instructions: [instruction] };
  }

  return { ata, instructions: [] };
};

const getPoolInfoById = async (
  poolId: string
): Promise<{
  poolInfo: ApiV3PoolInfoStandardItemCpmm;
  poolKeys?: CpmmKeys;
}> => {
  const raydium = await initSdk(connectionDevnet);

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

        const balanceInfo = await connectionDevnet.getTokenAccountBalance(
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
