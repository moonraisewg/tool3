import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getUserLockInfo } from "@/service/fetch-user-lock";
import { checkVaultExists } from "@/lib/helper";
import { getMint } from "@solana/spl-token";
import { connection } from "@/service/solana/connection";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletPublicKey, poolId } = body;

    if (!walletPublicKey || !poolId) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const userPublicKey = new PublicKey(walletPublicKey);
    const poolIdPublicKey = new PublicKey(poolId);

    const vaultCheck = await checkVaultExists(poolIdPublicKey);
    const tokenMint = vaultCheck.tokenMint;
    if (!vaultCheck.exists) {
      return NextResponse.json(
        { error: "Vault not initialized" },
        { status: 404 }
      );
    }
    const mintInfo = await getMint(connection, tokenMint);
    const decimals = mintInfo.decimals;

    const vault = vaultCheck.vault;

    const userLockInfo = await getUserLockInfo({
      vault,
      userPublicKey,
    });
    const adjustedAmount = Number(userLockInfo.amount) / Math.pow(10, decimals);

    return NextResponse.json({
      success: true,
      amount: adjustedAmount,
      unlockTimestamp: userLockInfo.unlockTimestamp.toString(),
      isUnlocked: Date.now() / 1000 > userLockInfo.unlockTimestamp.toNumber(),
      remainingTime: Math.max(
        0,
        userLockInfo.unlockTimestamp.toNumber() - Date.now() / 1000
      ),
    });
  } catch (error: unknown) {
    console.error("Error fetching user lock info:", error);

    let errorMessage = "Failed to fetch user lock info";
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
