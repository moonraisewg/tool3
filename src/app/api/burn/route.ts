import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { checkVaultExists } from "@/lib/vaultCheck";
import { withdrawLiquidityFromRaydium } from "@/service/raydium-sdk";
import { connection } from "@/service/solana/connection";
import { getMint } from "@solana/spl-token";

interface BurnRequestBody {
  walletPublicKey: string;
  amount: number;
  poolId: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: BurnRequestBody = await req.json();

    if (!body.walletPublicKey || !body.amount || !body.poolId) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const walletPublicKey = new PublicKey(body.walletPublicKey);
    const poolId = body.poolId;

    try {
      const accountInfo = await connection.getAccountInfo(walletPublicKey);
      if (!accountInfo) {
        return NextResponse.json(
          { error: "Wallet not found or not initialized" },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error("Wallet address error:", error);
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 400 }
      );
    }

    if (body.amount <= 0) {
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

    const lpMint = new PublicKey(vaultCheck.tokenMint);
    const mintInfo = await getMint(connection, lpMint);
    const decimals = mintInfo.decimals;
    const amountFloat = parseFloat(body.amount.toString());
    const amountDecimal = Math.round(amountFloat * Math.pow(10, decimals));

    // Tạo transaction để burn LP token và nhận token gốc
    const serializedTransaction = await withdrawLiquidityFromRaydium({
      poolId,
      lpAmount: amountDecimal,
      userPublicKey: walletPublicKey.toString(),
    });

    return NextResponse.json({
      success: true,
      transactions: [serializedTransaction],
    });
  } catch (error: unknown) {
    let errorMessage = "Failed to process burn";

    if (error instanceof Error) {
      if (error.message.includes("InsufficientBalance")) {
        errorMessage = "Insufficient LP token balance to burn";
      } else if (error.message.includes("ArithmeticUnderflow")) {
        errorMessage = "Arithmetic underflow error during burn";
      } else if (error.message.includes("InvalidPublicKey")) {
        errorMessage = "Invalid wallet address";
      } else {
        errorMessage = error.message;
      }

      console.error("Burn error:", error);
    } else {
      console.error("Burn error: unknown", error);
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
