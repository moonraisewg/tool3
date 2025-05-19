import { NextRequest, NextResponse } from "next/server";
import { PublicKey, Keypair } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import {
  findUserLockPda,
  findVaultPda,
  findVaultTokenPda,
  findVaultAuthorityPda,
} from "@/service/solana/pda";
import { checkVaultExists } from "@/lib/vaultCheck";
import { deposit, initializeVault } from "@/service/solana/action";
import bs58 from "bs58";

const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
if (!ADMIN_PRIVATE_KEY) {
  throw new Error("ADMIN_PRIVATE_KEY not set in .env");
}
const adminKeypair = Keypair.fromSecretKey(bs58.decode(ADMIN_PRIVATE_KEY));

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

    let vaultCheck = await checkVaultExists(poolId, tokenMint);
    if (!vaultCheck.exists) {
      console.log("Vault does not exist, initializing vault...");
      const [vault] = await findVaultPda(poolId, tokenMint);
      const [vaultTokenAccount] = await findVaultTokenPda(poolId, vault);
      const [vaultAuthority] = await findVaultAuthorityPda(poolId, vault);

      // Tính bump
      const [, bump] = await PublicKey.findProgramAddress(
        [Buffer.from("vault"), poolId.toBuffer(), tokenMint.toBuffer()],
        new PublicKey("Hog1fQ9MwCd6qQFoVYczbbXwEWNd3m1bnNakPGg4frK") // PROGRAM_ID
      );

      const txId = await initializeVault({
        adminKeypair,
        poolId,
        bump,
        vault,
        vaultTokenAccount,
        vaultAuthority,
        tokenMint,
      });

      console.log("Vault initialized, txId:", txId);

      // Kiểm tra lại vault
      vaultCheck = await checkVaultExists(poolId, tokenMint);
      if (!vaultCheck.exists) {
        return NextResponse.json(
          { error: "Failed to initialize vault" },
          { status: 500 }
        );
      }
    }

    const vault = vaultCheck.vault;
    const vaultTokenAccount = vaultCheck.vaultTokenAccount;
    const [userLock] = await findUserLockPda(vault, walletPublicKey);
    const userTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      walletPublicKey
    );

    // Gọi hàm deposit
    const serializedTransaction = await deposit({
      publicKey: walletPublicKey,
      amount: body.amount,
      unlockTimestamp: body.unlockTimestamp,
      vault,
      userLock,
      userTokenAccount,
      vaultTokenAccount,
      tokenMint,
    });

    return NextResponse.json({
      success: true,
      transactions: [serializedTransaction],
    });
  } catch (error: any) {
    let errorMessage = error.message || "Failed to process deposit";
    if (error.message.includes("InvalidMint")) {
      errorMessage = "Invalid token mint";
    } else if (error.message.includes("InvalidUnlockTimestamp")) {
      errorMessage = "Unlock timestamp is invalid";
    } else if (error.message.includes("ArithmeticOverflow")) {
      errorMessage = "Arithmetic overflow error during deposit";
    }
    console.error("Deposit error:", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
