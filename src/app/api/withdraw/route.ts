import { NextRequest, NextResponse } from "next/server";
import { PublicKey, Transaction, SendTransactionError } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getMint,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { checkVaultExists } from "@/lib/helper";
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

    if (!body.walletPublicKey || !body.amount || !body.poolId) {
      console.error("Missing required parameters:", body);
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const walletPublicKey = new PublicKey(body.walletPublicKey);
    const poolId = new PublicKey(body.poolId);

    if (body.amount <= 0) {
      console.error("Invalid amount:", body.amount);
      return NextResponse.json(
        { error: "Amount must be positive" },
        { status: 400 }
      );
    }

    const vaultCheck = await checkVaultExists(poolId);

    if (!vaultCheck.exists) {
      console.error("Vault not initialized for poolId:", poolId.toBase58());
      return NextResponse.json(
        { error: "Vault not initialized. Please contact admin." },
        { status: 400 }
      );
    }

    const {
      vault,
      vaultTokenAccount,
      raydiumToken0Vault,
      raydiumToken1Vault,
      token0Mint,
      token1Mint,
      tokenMint: lpMint,
      token0Program,
      token1Program,
      tokenProgram,
      projectVaultToken0Account,
      projectVaultToken1Account,
    } = vaultCheck;
    const poolState = poolId;

    const lpMintInfo = await getMint(connection, new PublicKey(lpMint));
    const decimals = lpMintInfo.decimals;

    const amountFloat = parseFloat(body.amount.toString());
    if (isNaN(amountFloat) || amountFloat <= 0) {
      console.error("Invalid amount value:", amountFloat);
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }
    const lpTokenAmount = Math.round(amountFloat * Math.pow(10, decimals));

    const userToken0Account = await getAssociatedTokenAddress(
      token0Mint,
      walletPublicKey,
      false,
      token0Program
    );
    const userToken1Account = await getAssociatedTokenAddress(
      token1Mint,
      walletPublicKey,
      false,
      token1Program
    );

    const adminToken0Account = await getAssociatedTokenAddress(
      token0Mint,
      new PublicKey("4WbU9nksassGissHNW7bSXZrYDsLKrjSDE7WxnLWfys1"),
      false,
      token0Program
    );
    const adminToken1Account = await getAssociatedTokenAddress(
      token1Mint,
      new PublicKey("4WbU9nksassGissHNW7bSXZrYDsLKrjSDE7WxnLWfys1"),
      false,
      token1Program
    );

    const transaction = new Transaction();

    try {
      const userToken0AccountInfo = await connection.getAccountInfo(
        userToken0Account
      );
      if (!userToken0AccountInfo) {
        console.log(
          "Creating user token 0 account:",
          userToken0Account.toBase58()
        );
        transaction.add(
          createAssociatedTokenAccountInstruction(
            walletPublicKey,
            userToken0Account,
            walletPublicKey,
            token0Mint,
            token0Program
          )
        );
      }
    } catch (error) {
      console.log(
        "Error checking user token 0 account, creating new one:",
        error
      );
      transaction.add(
        createAssociatedTokenAccountInstruction(
          walletPublicKey,
          userToken0Account,
          walletPublicKey,
          token0Mint,
          token0Program
        )
      );
    }

    try {
      const userToken1AccountInfo = await connection.getAccountInfo(
        userToken1Account
      );
      if (!userToken1AccountInfo) {
        console.log(
          "Creating user token 1 account:",
          userToken1Account.toBase58()
        );
        transaction.add(
          createAssociatedTokenAccountInstruction(
            walletPublicKey,
            userToken1Account,
            walletPublicKey,
            token1Mint,
            token1Program
          )
        );
      }
    } catch (error) {
      console.log(
        "Error checking user token 1 account, creating new one:",
        error
      );
      transaction.add(
        createAssociatedTokenAccountInstruction(
          walletPublicKey,
          userToken1Account,
          walletPublicKey,
          token1Mint,
          token1Program
        )
      );
    }

    const withdrawInstruction = await withdraw({
      publicKey: walletPublicKey,
      lpTokenAmount,
      adminToken0Account,
      adminToken1Account,
      token0Vault: raydiumToken0Vault,
      token1Vault: raydiumToken1Vault,
      vault0Mint: token0Mint,
      vault1Mint: token1Mint,
      token0Program,
      token1Program,
      tokenProgram,
      lpMint,
      userToken0Account,
      userToken1Account,
      vaultToken0Account: projectVaultToken0Account,
      vaultToken1Account: projectVaultToken1Account,
      poolState,
      vault,
      vaultTokenAccount,
    });

    transaction.add(withdrawInstruction);

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
    let errorMessage = "Failed to process withdraw";

    if (error instanceof SendTransactionError) {
      const logs = await error.getLogs(connection);
      console.error("SendTransactionError:", {
        message: error.message,
        logs,
      });
      errorMessage = `Transaction failed: ${
        error.message
      }. Logs: ${JSON.stringify(logs)}`;
    } else if (error instanceof Error) {
      if (error.message.includes("LockNotYetExpired")) {
        errorMessage = "Lock period has not yet expired";
      } else if (error.message.includes("InsufficientBalance")) {
        errorMessage = "Insufficient balance to withdraw";
      } else if (error.message.includes("ArithmeticUnderflow")) {
        errorMessage = "Arithmetic underflow error during withdrawal";
      } else {
        errorMessage = error.message;
      }
      console.error("Withdraw error:", {
        message: error.message,
        stack: error.stack,
      });
    } else {
      console.error("Withdraw error (unknown type):", error);
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
