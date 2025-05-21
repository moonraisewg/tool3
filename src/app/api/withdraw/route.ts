import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getMint } from "@solana/spl-token";
import { checkVaultExists } from "@/lib/vaultCheck";
import { withdraw } from "@/service/solana/action";
import { connection } from "@/service/solana/connection";

interface WithdrawRequestBody {
  walletPublicKey: string;
  amount: number;
  poolId: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: WithdrawRequestBody = await req.json();
    console.log(body);
    if (!body.walletPublicKey || !body.amount || !body.poolId) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const walletPublicKey = new PublicKey(body.walletPublicKey);
    const poolId = new PublicKey(body.poolId);

    if (body.amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be positive" },
        { status: 400 }
      );
    }

    const vaultCheck = await checkVaultExists(poolId);
    if (!vaultCheck.exists) {
      return NextResponse.json(
        { error: "Vault not initialized. Please contact admin." },
        { status: 400 }
      );
    }

    const vault = vaultCheck.vault;
    const vaultTokenAccount = vaultCheck.vaultTokenAccount;
    const userTokenAccount = await getAssociatedTokenAddress(
      vaultCheck.tokenMint,
      walletPublicKey
    );

    const tokenMint = vaultCheck.tokenMint;

    const mintInfo = await getMint(connection, tokenMint);
    const decimals = mintInfo.decimals;
    const amountFloat = parseFloat(body.amount.toString());
    const amountDecimal = Math.round(amountFloat * Math.pow(10, decimals));

    const serializedTransaction = await withdraw({
      publicKey: walletPublicKey,
      amount: amountDecimal,
      vault,
      userTokenAccount,
      vaultTokenAccount,
    });

    return NextResponse.json({
      success: true,
      transactions: [serializedTransaction],
    });
  } catch (error: unknown) {
    let errorMessage = "Failed to process withdraw";

    if (error instanceof Error) {
      if (error.message.includes("LockNotYetExpired")) {
        errorMessage = "Lock period has not yet expired";
      } else if (error.message.includes("InsufficientBalance")) {
        errorMessage = "Insufficient balance to withdraw";
      } else if (error.message.includes("ArithmeticUnderflow")) {
        errorMessage = "Arithmetic underflow error during withdrawal";
      } else {
        errorMessage = error.message;
      }
      console.error("Withdraw error:", error);
    } else {
      console.error("Withdraw error (unknown type):", error);
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
