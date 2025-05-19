import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { findUserLockPda, findVaultAuthorityPda } from "@/service/solana/pda";
import { checkVaultExists } from "@/lib/vaultCheck";
import { withdraw } from "@/service/solana/action";

interface WithdrawRequestBody {
  walletPublicKey: string;
  amount: number;
  poolId: string;
  tokenMint: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: WithdrawRequestBody = await req.json();

    if (
      !body.walletPublicKey ||
      !body.amount ||
      !body.poolId ||
      !body.tokenMint
    ) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const walletPublicKey = new PublicKey(body.walletPublicKey);
    const poolId = new PublicKey(body.poolId);
    const tokenMint = new PublicKey(body.tokenMint);

    if (body.amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be positive" },
        { status: 400 }
      );
    }

    const vaultCheck = await checkVaultExists(poolId, tokenMint);
    if (!vaultCheck.exists) {
      return NextResponse.json(
        { error: "Vault not initialized. Please contact admin." },
        { status: 400 }
      );
    }

    const vault = vaultCheck.vault;
    const vaultTokenAccount = vaultCheck.vaultTokenAccount;
    const [userLock] = await findUserLockPda(vault, walletPublicKey);
    const [vaultAuthority] = await findVaultAuthorityPda(poolId, vault);
    const userTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      walletPublicKey
    );

    const serializedTransaction = await withdraw({
      publicKey: walletPublicKey,
      amount: body.amount,
      vault,
      userLock,
      userTokenAccount,
      vaultTokenAccount,
      vaultAuthority,
      tokenMint,
    });

    return NextResponse.json({
      success: true,
      transactions: [serializedTransaction],
    });
  } catch (error: any) {
    let errorMessage = error.message || "Failed to process withdraw";
    if (error.message.includes("LockNotYetExpired")) {
      errorMessage = "Lock period has not yet expired";
    } else if (error.message.includes("InsufficientBalance")) {
      errorMessage = "Insufficient balance to withdraw";
    } else if (error.message.includes("ArithmeticUnderflow")) {
      errorMessage = "Arithmetic underflow error during withdrawal";
    }
    console.error("Withdraw error:", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
