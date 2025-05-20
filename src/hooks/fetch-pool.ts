import { PublicKey } from "@solana/web3.js";
import { CpmmKeys } from "@raydium-io/raydium-sdk-v2";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { initSdk } from "@/service/raydium-sdk";
import { connection } from "../service/solana/connection";

interface LpTokenData {
  lpMint: string;
  balance: number;
}

export const fetchLpMintAndBalance = async (
  poolId: string,
  userPublicKey?: string
): Promise<LpTokenData | null> => {
  try {
    const raydium = await initSdk();

    const data = await raydium.cpmm.getPoolInfoFromRpc(poolId);
    const poolKeys: CpmmKeys | undefined = data.poolKeys;

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
      } catch (error) {}
    }

    return {
      lpMint,
      balance,
    };
  } catch (error) {
    console.error(
      `Lỗi khi lấy LP token mint hoặc số dư cho pool ${poolId}:`,
      error
    );
    return null;
  }
};
