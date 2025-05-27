import { NextRequest, NextResponse } from "next/server";
import {
  PublicKey,
  Transaction,
  SendTransactionError
} from "@solana/web3.js";
import { getAssociatedTokenAddress, getMint } from "@solana/spl-token";
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

    if (
      !token0Mint ||
      !token1Mint ||
      !poolState ||
      !raydiumToken0Vault ||
      !raydiumToken1Vault ||
      !lpMint
    ) {
      console.error("Incomplete vault data:", {
        token0Mint,
        token1Mint,
        poolState,
        raydiumToken0Vault,
        raydiumToken1Vault,
        lpMint,
      });
      return NextResponse.json(
        { error: "Incomplete vault data. Please contact admin." },
        { status: 400 }
      );
    }

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

    const ownerLpToken = await getAssociatedTokenAddress(
      lpMint,
      walletPublicKey
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

    const accountStates = await Promise.all([
      connection.getAccountInfo(vault),
      connection.getAccountInfo(vaultTokenAccount),
      connection.getAccountInfo(raydiumToken0Vault),
      connection.getAccountInfo(raydiumToken1Vault),
      connection.getAccountInfo(token0Mint),
      connection.getAccountInfo(token1Mint),
      connection.getAccountInfo(poolState),
      connection.getAccountInfo(lpMint),
      connection.getAccountInfo(userToken0Account),
      connection.getAccountInfo(userToken1Account),
      connection.getAccountInfo(ownerLpToken),
      connection.getAccountInfo(adminToken0Account),
      connection.getAccountInfo(adminToken1Account),
    ]);

    if (
      !accountStates[0] ||
      !accountStates[1] ||
      !accountStates[2] ||
      !accountStates[3] ||
      !accountStates[4] ||
      !accountStates[5] ||
      !accountStates[6] ||
      !accountStates[7] ||
      !accountStates[8] ||
      !accountStates[9] ||
      !accountStates[10] ||
      !accountStates[11] ||
      !accountStates[12]
    ) {
      console.error("Missing required accounts:", {
        vault: !accountStates[0],
        vaultTokenAccount: !accountStates[1],
        token0Vault: !accountStates[2],
        token1Vault: !accountStates[3],
        token0Mint: !accountStates[4],
        token1Mint: !accountStates[5],
        poolState: !accountStates[6],
        lpMint: !accountStates[7],
        userToken0Account: !accountStates[8],
        userToken1Account: !accountStates[9],
        ownerLpToken: !accountStates[10],
        adminToken0Account: !accountStates[11],
        adminToken1Account: !accountStates[12],
      });
      return NextResponse.json(
        { error: "One or more required accounts are not initialized" },
        { status: 400 }
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

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    const transaction = new Transaction().add(withdrawInstruction);
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
      errorMessage = `Transaction failed: ${error.message
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
