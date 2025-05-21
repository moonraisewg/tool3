import {
  Raydium,
  CpmmKeys,
  ApiV3PoolInfoStandardItemCpmm,
  Percent,
} from "@raydium-io/raydium-sdk-v2";
import bs58 from "bs58";
import BN from "bn.js";
import { Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { connection } from "@/service/solana/connection";

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
        console.warn("Không thể lấy số dư LP token:", error);
      }
    }

    return { lpMint, balance };
  } catch (error) {
    console.error(`Lỗi khi fetch LP info từ pool ${poolId}:`, error);
    return null;
  }
};

export const withdrawLiquidityFromRaydium = async ({
  poolId,
  lpAmount,
  userPublicKey,
}: {
  poolId: string;
  lpAmount: string;
  userPublicKey: string;
}): Promise<string> => {
  try {
    const userPubkey = new PublicKey(userPublicKey);
    // Tạo instance Raydium mới với owner là user
    const userRaydium = await Raydium.load({
      owner: new PublicKey(userPubkey),
      connection,
      cluster,
      disableFeatureCheck: true,
      blockhashCommitment: "finalized",
    });

    const { poolInfo, poolKeys } = await getPoolInfoById(poolId);
    const slippage = new Percent(1, 100);

    // Chuyển đổi số lượng LP token thành số nguyên với decimals
    const lpDecimals = 9; // Raydium LP token thường có 9 decimals
    const amount = parseFloat(lpAmount);
    const lpAmountWithDecimals = new BN(Math.floor(amount * Math.pow(10, lpDecimals)));

    // Kiểm tra số lượng LP token
    if (lpAmountWithDecimals.lte(new BN(0))) {
      throw new Error("Số lượng LP token phải lớn hơn 0");
    }

    console.log("Số lượng LP token sau khi chuyển đổi:", lpAmountWithDecimals.toString());

    // Tạo transaction unsigned, fee payer là user
    const { transaction } = await userRaydium.cpmm.withdrawLiquidity({
      poolInfo,
      poolKeys,
      lpAmount: lpAmountWithDecimals,
      slippage,
      txVersion: 0,
      feePayer: userPubkey,
    });

    // Serialize transaction và chuyển thành base64
    const serialized = transaction.serialize();
    return Buffer.from(serialized).toString('base64');
  } catch (error) {
    console.error("Lỗi khi tạo transaction rút thanh khoản:", error);
    throw error;
  }
};
