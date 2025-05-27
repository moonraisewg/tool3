import { NextRequest, NextResponse } from "next/server";
import { PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, getMint } from "@solana/spl-token";
import { checkVaultExists } from "@/lib/helper";
import { deposit, initializeVault } from "@/service/solana/action";

import { connection } from "@/service/solana/connection";

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

    if (body.unlockTimestamp <= Math.floor(Date.now() / 1000)) {
      return NextResponse.json(
        { error: "Unlock timestamp must be in the future" },
        { status: 400 }
      );
    }

    const transaction = new Transaction();

    const vaultCheck = await checkVaultExists(poolId);
    const {
      vault,
      vaultTokenAccount,
      raydiumToken0Vault,
      raydiumToken1Vault,
      token0Mint,
      token1Mint,
      token0Program,
      token1Program,
      tokenProgram,
      projectVaultToken0Account,
      projectVaultToken1Account,
    } = vaultCheck;

    if (!vaultCheck.exists) {
      console.log("Vault does not exist, initializing vault...");

      const initInstruction = await initializeVault({
        publicKey: walletPublicKey,
        poolState: poolId,
        tokenMint,
        tokenProgram,
        token0Program,
        token0Vault: raydiumToken0Vault,
        token1Program,
        token1Vault: raydiumToken1Vault,
        vault0Mint: token0Mint,
        vault1Mint: token1Mint,
        vaultToken0Account: projectVaultToken0Account,
        vaultToken1Account: projectVaultToken1Account,
      });
      transaction.add(initInstruction);
    }

    const userTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      walletPublicKey,
      false,
      tokenProgram
    );

    const depositInstruction = await deposit({
      publicKey: walletPublicKey,
      amount: amountDecimal,
      unlockTimestamp: body.unlockTimestamp,
      userTokenAccount,
      vaultTokenAccount,
      token0Vault: raydiumToken0Vault,
      token1Vault: raydiumToken1Vault,
      tokenProgram,
      poolState: poolId,
      vault,
      tokenMint,
    });
    transaction.add(depositInstruction);

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletPublicKey;

    const serializedTransaction = transaction
      .serialize({ requireAllSignatures: false })
      .toString("base64");

    return NextResponse.json({
      success: true,
      transaction: serializedTransaction,
      blockhash,
      lastValidBlockHeight,
    });
  } catch (error: unknown) {
    const errorMessage = "Failed to process withdraw";

    console.error("Deposit error:", error);

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
