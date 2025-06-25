import { NextResponse } from "next/server";
import { initSdk, txVersion } from "@/service/raydium-sdk";
import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  DEVNET_PROGRAM_ID,
  getCpmmPdaAmmConfigId,
} from "@raydium-io/raydium-sdk-v2";
import {
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { adminKeypair } from "@/config";
import BN from "bn.js";
import {
  connectionDevnet,
  connectionMainnet,
} from "@/service/solana/connection";
import { CREATE_POOL_FEE, NATIVE_SOL, WSOL_MINT } from "@/utils/constants";
import { createTokenTransferTx } from "@/utils/solana-token-transfer";
import { isWhitelisted } from "@/utils/whitelist";

const PAYMENT_WALLET = adminKeypair.publicKey;

export function isValidBase58(str: string): boolean {
  if (str === NATIVE_SOL) return true;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(str);
}

async function verifyPaymentTx(
  paymentTxId: string,
  userPublicKey: PublicKey,
  paymentAmount: number
): Promise<boolean> {
  try {
    const tx = await connectionMainnet.getTransaction(paymentTxId, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (!tx || !tx.meta) return false;

    const message = tx.transaction.message;
    const transferInstruction = message.compiledInstructions.find(
      (ix) =>
        message.staticAccountKeys[ix.programIdIndex].equals(
          SystemProgram.programId
        ) &&
        ix.accountKeyIndexes.length === 2 &&
        message.staticAccountKeys[ix.accountKeyIndexes[1]].equals(
          PAYMENT_WALLET
        )
    );
    if (!transferInstruction) return false;

    const lamportsTransferred = new BN(
      transferInstruction.data.slice(4),
      "le"
    ).toNumber();
    if (lamportsTransferred < paymentAmount) return false;

    if (!message.staticAccountKeys[0].equals(userPublicKey)) return false;

    return true;
  } catch (err) {
    console.error("Payment verification error:", err);
    return false;
  }
}

async function transferLpToken(
  userPublicKey: PublicKey,
  lpMint: PublicKey,
  amount: number
): Promise<string> {
  const tx = new Transaction();
  const adminAtaLp = getAssociatedTokenAddressSync(
    lpMint,
    adminKeypair.publicKey
  );
  const userAtaLp = getAssociatedTokenAddressSync(lpMint, userPublicKey);

  const userAtaLpInfo = await connectionDevnet.getAccountInfo(userAtaLp);
  if (!userAtaLpInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        adminKeypair.publicKey,
        userAtaLp,
        userPublicKey,
        lpMint,
        TOKEN_PROGRAM_ID
      )
    );
  }

  tx.add(
    createTransferInstruction(
      adminAtaLp,
      userAtaLp,
      adminKeypair.publicKey,
      amount,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  const { blockhash, lastValidBlockHeight } =
    await connectionDevnet.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = adminKeypair.publicKey;
  tx.sign(adminKeypair);

  const serializedTx = tx.serialize();
  const lpTransferTxId = await connectionDevnet.sendRawTransaction(
    serializedTx,
    {
      skipPreflight: false,
      maxRetries: 3,
    }
  );
  await connectionDevnet.confirmTransaction(
    {
      signature: lpTransferTxId,
      blockhash,
      lastValidBlockHeight,
    },
    "confirmed"
  );

  return lpTransferTxId;
}

export async function POST(req: Request) {
  try {
    const {
      mintAAddress,
      mintBAddress,
      amountA,
      amountB,
      userPublicKey,
      paymentTxId,
      tokenTransferTxId,
    } = await req.json();

    if (!userPublicKey) {
      return NextResponse.json(
        { success: false, error: "Missing userPublicKey" },
        { status: 400 }
      );
    }

    if (
      !isValidBase58(userPublicKey) ||
      (paymentTxId && !isValidBase58(paymentTxId)) ||
      (mintAAddress && !isValidBase58(mintAAddress)) ||
      (mintBAddress && !isValidBase58(mintBAddress)) ||
      (tokenTransferTxId && !isValidBase58(tokenTransferTxId))
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid base58 format" },
        { status: 400 }
      );
    }

    let PAYMENT_AMOUNT_LAMPORTS = CREATE_POOL_FEE * LAMPORTS_PER_SOL;

    if (userPublicKey && isWhitelisted(userPublicKey)) {
      console.log("Wallet in whitelist, free transaction");
      PAYMENT_AMOUNT_LAMPORTS = 0;
    }

    const userPubKey = new PublicKey(userPublicKey);
    const raydium = await initSdk(connectionDevnet);

    if (!paymentTxId) {
      const paymentTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: userPubKey,
          toPubkey: PAYMENT_WALLET,
          lamports: PAYMENT_AMOUNT_LAMPORTS,
        })
      );
      const { blockhash, lastValidBlockHeight } =
        await connectionMainnet.getLatestBlockhash("confirmed");
      paymentTx.recentBlockhash = blockhash;
      paymentTx.feePayer = userPubKey;

      return NextResponse.json({
        success: true,
        paymentTx: Buffer.from(
          paymentTx.serialize({ requireAllSignatures: false })
        ).toString("base64"),
        blockhash,
        lastValidBlockHeight,
      });
    }

    // Verify Mainnet payment
    const paymentValid = await verifyPaymentTx(paymentTxId, userPubKey, PAYMENT_AMOUNT_LAMPORTS);
    if (!paymentValid) {
      return NextResponse.json(
        { success: false, error: "Invalid or unconfirmed payment transaction" },
        { status: 400 }
      );
    }

    if (!mintAAddress || !mintBAddress || !amountA || !amountB) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const mintA = await raydium.token.getTokenInfo(mintAAddress === NATIVE_SOL ? WSOL_MINT : mintAAddress);
    const mintB = await raydium.token.getTokenInfo(mintBAddress === NATIVE_SOL ? WSOL_MINT : mintBAddress);
    if (!mintA || !mintB || mintA.address === mintB.address) {
      return NextResponse.json(
        { success: false, error: "Invalid token mints" },
        { status: 400 }
      );
    }

    const adminBalance = await connectionDevnet.getBalance(
      adminKeypair.publicKey
    );
    if (adminBalance < 0.05 * LAMPORTS_PER_SOL) {
      return NextResponse.json(
        { success: false, error: "Insufficient admin SOL balance" },
        { status: 400 }
      );
    }

    if (!tokenTransferTxId) {
      const tokenTransferTx = await createTokenTransferTx(
        connectionDevnet,
        userPubKey,
        adminKeypair,
        mintAAddress,
        mintBAddress,
        amountA,
        amountB
      );
      const { blockhash, lastValidBlockHeight } =
        await connectionDevnet.getLatestBlockhash("confirmed");
      tokenTransferTx.recentBlockhash = blockhash;
      tokenTransferTx.feePayer = userPubKey;

      return NextResponse.json({
        success: true,
        tokenTransferTx: Buffer.from(
          tokenTransferTx.serialize({ requireAllSignatures: false })
        ).toString("base64"),
        blockhash,
        lastValidBlockHeight,
      });
    }

    const transferTx = await connectionDevnet.getTransaction(tokenTransferTxId, { commitment: "confirmed" });
    if (!transferTx) {
      return NextResponse.json({ success: false, error: "Invalid token transfer transaction" }, { status: 400 });
    }

    const feeConfigs = await raydium.api.getCpmmConfigs();
    if (!feeConfigs.length) {
      return NextResponse.json(
        { success: false, error: "No fee configurations available" },
        { status: 500 }
      );
    }
    if (raydium.cluster === "devnet") {
      feeConfigs.forEach((config) => {
        config.id = getCpmmPdaAmmConfigId(
          DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
          config.index
        ).publicKey.toBase58();
      });
    }

    // Create pool
    const { transaction, extInfo } = await raydium.cpmm.createPool({
      programId: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
      poolFeeAccount: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC,
      mintA,
      mintB,
      mintAAmount: new BN(amountA),
      mintBAmount: new BN(amountB),
      startTime: new BN(Math.floor(Date.now() / 1000)),
      feeConfig: feeConfigs[0],
      associatedOnly: true,
      checkCreateATAOwner: true,
      ownerInfo: {
        feePayer: adminKeypair.publicKey,
        useSOLBalance: true,
      },
      feePayer: adminKeypair.publicKey,
      txVersion,
    });

    const { blockhash, lastValidBlockHeight } =
      await connectionDevnet.getLatestBlockhash("confirmed");
    transaction.message.recentBlockhash = blockhash;
    transaction.sign([adminKeypair]);

    const serializedTx = transaction.serialize();
    const poolTxId = await connectionDevnet.sendRawTransaction(serializedTx, {
      skipPreflight: false,
      maxRetries: 3,
    });
    await connectionDevnet.confirmTransaction(
      {
        signature: poolTxId,
        blockhash,
        lastValidBlockHeight,
      },
      "confirmed"
    );

    // Transfer LP tokens to user
    const lpMint = new PublicKey(extInfo.address.lpMint);
    const adminAtaLp = getAssociatedTokenAddressSync(
      lpMint,
      adminKeypair.publicKey
    );
    const lpBalanceInfo = await connectionDevnet.getTokenAccountBalance(
      adminAtaLp
    );
    const lpAmount = Number(lpBalanceInfo.value.amount);

    if (lpAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "No LP tokens available to transfer" },
        { status: 500 }
      );
    }

    const lpTransferTxId = await transferLpToken(userPubKey, lpMint, lpAmount);

    return NextResponse.json({
      success: true,
      poolTxId,
      lpTransferTxId,
      poolKeys: {
        poolId: extInfo.address.poolId.toString(),
        configId: extInfo.address.configId.toString(),
        authority: extInfo.address.authority.toString(),
        lpMint: extInfo.address.lpMint.toString(),
        vaultA: extInfo.address.vaultA.toString(),
        vaultB: extInfo.address.vaultB.toString(),
        observationId: extInfo.address.observationId.toString(),
        mintA: extInfo.address.mintA.toString(),
        mintB: extInfo.address.mintB.toString(),
        programId: extInfo.address.programId.toString(),
        poolFeeAccount: extInfo.address.poolFeeAccount.toString(),
        feeConfig: feeConfigs[0],
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
