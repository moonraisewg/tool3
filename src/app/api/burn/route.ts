import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { checkVaultExists } from "@/lib/vaultCheck";
import { withdrawLiquidityFromRaydium } from "@/service/raydium-sdk";
import { connection } from "@/service/solana/connection";

interface BurnRequestBody {
  walletPublicKey: string;
  amount: string;
  poolId: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: BurnRequestBody = await req.json();
    console.log("API nhận request burn:", body);

    if (!body.walletPublicKey || !body.amount || !body.poolId) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const walletPublicKey = new PublicKey(body.walletPublicKey);
    const poolId = body.poolId;

    // Kiểm tra ví có tồn tại và có số dư không
    try {
      const accountInfo = await connection.getAccountInfo(walletPublicKey);
      if (!accountInfo) {
        return NextResponse.json(
          { error: "Wallet not found or not initialized" },
          { status: 400 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 400 }
      );
    }

    const amount = parseFloat(body.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be positive" },
        { status: 400 }
      );
    }

    // Kiểm tra vault có tồn tại không
    const vaultCheck = await checkVaultExists(new PublicKey(poolId));
    if (!vaultCheck.exists) {
      return NextResponse.json(
        { error: "Vault not initialized. Please contact admin." },
        { status: 400 }
      );
    }

    // Tạo transaction để burn LP token và nhận token gốc
    const serializedTransaction = await withdrawLiquidityFromRaydium({
      poolId,
      lpAmount: body.amount,
      userPublicKey: walletPublicKey.toString(),
    });

    return NextResponse.json({
      success: true,
      transactions: [serializedTransaction],
    });
  } catch (error: any) {
    let errorMessage = error.message || "Failed to process burn";
    if (error.message.includes("InsufficientBalance")) {
      errorMessage = "Insufficient LP token balance to burn";
    } else if (error.message.includes("ArithmeticUnderflow")) {
      errorMessage = "Arithmetic underflow error during burn";
    } else if (error.message.includes("InvalidPublicKey")) {
      errorMessage = "Invalid wallet address";
    }
    console.error("Burn error:", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
