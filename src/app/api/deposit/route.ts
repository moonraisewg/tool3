import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getMint } from "@solana/spl-token";
import { checkVaultExists } from "@/lib/vaultCheck";
import { deposit, initializeVault } from "@/service/solana/action";
import { owner } from "@/service/raydium-sdk";
import { connection } from "@/service/solana/connection";
import { PROGRAM_ID } from "@/service/solana/program";

interface DepositRequestBody {
  walletPublicKey: string;
  amount: number;
  unlockTimestamp: number;
  poolId: string;
  tokenMint: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: DepositRequestBody = await req.json();

    if (
      !body.walletPublicKey ||
      !body.amount ||
      !body.unlockTimestamp ||
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

    const mintInfo = await getMint(connection, tokenMint);
    const decimals = mintInfo.decimals;

    const amountFloat = parseFloat(body.amount.toString());
    if (isNaN(amountFloat) || amountFloat <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }
    const amountDecimal = Math.round(amountFloat * Math.pow(10, decimals));

    if (body.amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be positive" },
        { status: 400 }
      );
    }

    if (body.unlockTimestamp <= Math.floor(Date.now() / 1000)) {
      return NextResponse.json(
        { error: "Unlock timestamp must be in the future" },
        { status: 400 }
      );
    }

    let vaultCheck = await checkVaultExists(poolId);
    if (!vaultCheck.exists) {
      console.log("Vault does not exist, initializing vault...");

      const [, bump] = await PublicKey.findProgramAddress(
        [Buffer.from("vault"), poolId.toBuffer()],
        PROGRAM_ID
      );

      const txId = await initializeVault({
        owner,
        poolId,
        bump,
        tokenMint,
      });

      console.log("Vault initialized, txId:", txId);

      vaultCheck = await checkVaultExists(poolId);
      if (!vaultCheck.exists) {
        return NextResponse.json(
          { error: "Failed to initialize vault" },
          { status: 500 }
        );
      }
    }

    const vault = vaultCheck.vault;
    const vaultTokenAccount = vaultCheck.vaultTokenAccount;
    const userTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      walletPublicKey
    );

    const serializedTransaction = await deposit({
      publicKey: walletPublicKey,
      amount: amountDecimal,
      unlockTimestamp: body.unlockTimestamp,
      vault,
      userTokenAccount,
      vaultTokenAccount,
    });

    return NextResponse.json({
      success: true,
      transactions: [serializedTransaction],
    });
  } catch (err) {
    console.error("Deposit error:", err);
    return NextResponse.json({ err }, { status: 500 });
  }
}
