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
const ADMIN_PUBLIC_KEY = process.env.ADMIN_PUBLIC_KEY!;

const PAYMENT_WALLET = new PublicKey(ADMIN_PUBLIC_KEY);
const PAYMENT_AMOUNT_LAMPORTS = 0.001 * LAMPORTS_PER_SOL;

const SOL_MINT = "So11111111111111111111111111111111111111112";

function isValidBase58(str: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(str);
}

async function verifyPaymentTx(
  paymentTxId: string,
  userPublicKey: PublicKey
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
    if (lamportsTransferred < PAYMENT_AMOUNT_LAMPORTS) return false;

    if (!message.staticAccountKeys[0].equals(userPublicKey)) return false;

    return true;
  } catch (err) {
    console.error("Payment verification error:", err);
    return false;
  }
}

async function createTokenTransferTx(
  userPublicKey: PublicKey,
  mintAAddress: string,
  mintBAddress: string,
  amountA: string,
  amountB: string
): Promise<Transaction> {
  const tx = new Transaction();
  const mintAPubkey = new PublicKey(mintAAddress);
  const mintBPubkey = new PublicKey(mintBAddress);

  const adminAtaA = getAssociatedTokenAddressSync(
    mintAPubkey,
    adminKeypair.publicKey
  );
  const adminAtaB = getAssociatedTokenAddressSync(
    mintBPubkey,
    adminKeypair.publicKey
  );
  const userAtaA = getAssociatedTokenAddressSync(mintAPubkey, userPublicKey);
  const userAtaB = getAssociatedTokenAddressSync(mintBPubkey, userPublicKey);

  const adminAtaAInfo = await connectionDevnet.getAccountInfo(adminAtaA);
  if (!adminAtaAInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        userPublicKey,
        adminAtaA,
        adminKeypair.publicKey,
        mintAPubkey,
        TOKEN_PROGRAM_ID
      )
    );
  }

  const adminAtaBInfo = await connectionDevnet.getAccountInfo(adminAtaB);
  if (!adminAtaBInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        userPublicKey,
        adminAtaB,
        adminKeypair.publicKey,
        mintBPubkey,
        TOKEN_PROGRAM_ID
      )
    );
  }

  if (mintAAddress === SOL_MINT) {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: adminKeypair.publicKey,
        lamports: Number(amountA),
      })
    );
  } else {
    tx.add(
      createTransferInstruction(
        userAtaA,
        adminAtaA,
        userPublicKey,
        Number(amountA),
        [],
        TOKEN_PROGRAM_ID
      )
    );
  }

  tx.add(
    createTransferInstruction(
      userAtaB,
      adminAtaB,
      userPublicKey,
      Number(amountB),
      [],
      TOKEN_PROGRAM_ID
    )
  );

  return tx;
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

    const userPubKey = new PublicKey(userPublicKey);
    const raydium = await initSdk(connectionDevnet);

    if (!paymentTxId) {
      // Create payment transaction
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
    const paymentValid = await verifyPaymentTx(paymentTxId, userPubKey);
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

    const mintA = await raydium.token.getTokenInfo(mintAAddress);
    const mintB = await raydium.token.getTokenInfo(mintBAddress);
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
        userPubKey,
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

    // Verify token transfer transaction
    const tx = await connectionDevnet.getTransaction(tokenTransferTxId, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (!tx || !tx.meta) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or unconfirmed token transfer transaction",
        },
        { status: 400 }
      );
    }

    // Check token balances in admin ATA
    const adminAtaA = getAssociatedTokenAddressSync(
      new PublicKey(mintAAddress),
      adminKeypair.publicKey
    );
    const adminAtaB = getAssociatedTokenAddressSync(
      new PublicKey(mintBAddress),
      adminKeypair.publicKey
    );
    const accountsInfo = await connectionDevnet.getMultipleAccountsInfo([
      adminAtaA,
      adminAtaB,
    ]);
    const tokenABalance = accountsInfo[0]
      ? Number(accountsInfo[0].data.slice(64, 72).readBigUInt64LE())
      : mintAAddress === SOL_MINT
      ? adminBalance
      : 0;
    const tokenBBalance = accountsInfo[1]
      ? Number(accountsInfo[1].data.slice(64, 72).readBigUInt64LE())
      : 0;

    if (tokenABalance < Number(amountA)) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient ${mintA.symbol} transferred. Available: ${
            tokenABalance / 10 ** mintA.decimals
          }, Required: ${Number(amountA) / 10 ** mintA.decimals}`,
        },
        { status: 400 }
      );
    }
    if (tokenBBalance < Number(amountB)) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient ${mintB.symbol} transferred. Available: ${
            tokenBBalance / 10 ** mintB.decimals
          }, Required: ${Number(amountB) / 10 ** mintB.decimals}`,
        },
        { status: 400 }
      );
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
