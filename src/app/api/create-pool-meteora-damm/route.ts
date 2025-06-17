import { NextResponse } from "next/server";
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createTransferInstruction, getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { adminKeypair } from "@/config";
import BN from "bn.js";
import { connectionDevnet, connectionMainnet } from "@/service/solana/connection";
import { CpAmm, MIN_SQRT_PRICE, MAX_SQRT_PRICE, derivePoolAddress } from "@meteora-ag/cp-amm-sdk";
const PAYMENT_AMOUNT_LAMPORTS = 0.001 * LAMPORTS_PER_SOL;
const SOL_MINT = "So11111111111111111111111111111111111111112";

function isValidBase58(str: string): boolean {
    return /^[1-9A-HJ-NP-Za-km-z]+$/.test(str);
}

async function verifyPaymentTx(paymentTxId: string, userPublicKey: PublicKey): Promise<boolean> {
    try {
        const tx = await connectionMainnet.getTransaction(paymentTxId, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
        });
        if (!tx || !tx.meta) return false;

        const message = tx.transaction.message;
        const transferInstruction = message.compiledInstructions.find(
            (ix) =>
                message.staticAccountKeys[ix.programIdIndex].equals(SystemProgram.programId) &&
                ix.accountKeyIndexes.length === 2 &&
                message.staticAccountKeys[ix.accountKeyIndexes[1]].equals(adminKeypair.publicKey)
        );
        if (!transferInstruction) return false;

        const lamportsTransferred = new BN(transferInstruction.data.slice(4), "le").toNumber();
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

    const adminAtaA = getAssociatedTokenAddressSync(mintAPubkey, adminKeypair.publicKey);
    const adminAtaB = getAssociatedTokenAddressSync(mintBPubkey, adminKeypair.publicKey);
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


export async function POST(req: Request) {
    try {
        const { mintAAddress, mintBAddress, amountA, amountB, userPublicKey, paymentTxId, tokenTransferTxId } = await req.json();

        if (!userPublicKey) {
            return NextResponse.json({ success: false, error: "Missing userPublicKey" }, { status: 400 });
        }

        if (
            !isValidBase58(userPublicKey) ||
            (paymentTxId && !isValidBase58(paymentTxId)) ||
            (mintAAddress && !isValidBase58(mintAAddress)) ||
            (mintBAddress && !isValidBase58(mintBAddress)) ||
            (tokenTransferTxId && !isValidBase58(tokenTransferTxId))
        ) {
            return NextResponse.json({ success: false, error: "Invalid base58 format" }, { status: 400 });
        }
        const cpAmm = new CpAmm(connectionDevnet);

        const config = new PublicKey("F7xJjVwqvVBoAkYV3TdZesu4ckwzzVQEebaPiZVqT4Ly");

        const derivedPoolId = derivePoolAddress(
            config,
            new PublicKey(mintAAddress),
            new PublicKey(mintBAddress)
        );

        const poolInfo = await connectionDevnet.getAccountInfo(derivedPoolId);

        if (poolInfo) {
            return NextResponse.json({
                success: false,
                error: "Pool already exists",
                poolId: derivedPoolId.toBase58(),
            });
        }

        const userPubKey = new PublicKey(userPublicKey);

        if (!paymentTxId) {
            const paymentTx = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: userPubKey,
                    toPubkey: adminKeypair.publicKey,
                    lamports: PAYMENT_AMOUNT_LAMPORTS,
                })
            );
            const { blockhash, lastValidBlockHeight } = await connectionMainnet.getLatestBlockhash("confirmed");
            paymentTx.recentBlockhash = blockhash;
            paymentTx.feePayer = userPubKey;

            return NextResponse.json({
                success: true,
                paymentTx: Buffer.from(paymentTx.serialize({ requireAllSignatures: false })).toString("base64"),
                blockhash,
                lastValidBlockHeight,
            });
        }

        const paymentValid = await verifyPaymentTx(paymentTxId, userPubKey);
        if (!paymentValid) {
            return NextResponse.json(
                { success: false, error: "Invalid or unconfirmed payment transaction" },
                { status: 400 }
            );
        }

        if (!mintAAddress || !mintBAddress || !amountA || !amountB) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
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

        const transferTx = await connectionDevnet.getTransaction(tokenTransferTxId, { commitment: "confirmed" });
        if (!transferTx) {
            return NextResponse.json({ success: false, error: "Invalid token transfer transaction" }, { status: 400 });
        }

        const tokenAAmountBN = new BN(amountA);
        const tokenBAmountBN = new BN(amountB);
        const { initSqrtPrice, liquidityDelta } = cpAmm.preparePoolCreationParams({
            tokenAAmount: tokenAAmountBN,
            tokenBAmount: tokenBAmountBN,
            minSqrtPrice: MIN_SQRT_PRICE,
            maxSqrtPrice: MAX_SQRT_PRICE
        });

        if (liquidityDelta.lte(new BN(0))) {
            return NextResponse.json({ success: false, error: "Liquidity delta <= 0, cannot create pool" }, { status: 400 });
        }
        const positionNftMint = Keypair.generate();
        const activationPoint = new BN(Math.floor(Date.now() / 1000) + 60);


        const txBuilder = await cpAmm.createPool({
            creator: adminKeypair.publicKey,
            payer: adminKeypair.publicKey,
            config, // PublicKey của config bạn muốn dùng
            positionNft: positionNftMint.publicKey,
            tokenAMint: new PublicKey(mintAAddress),
            tokenBMint: new PublicKey(mintBAddress),
            initSqrtPrice,
            liquidityDelta,
            tokenAAmount: tokenAAmountBN,
            tokenBAmount: tokenBAmountBN,
            activationPoint, // BN hoặc null
            tokenAProgram: TOKEN_PROGRAM_ID,
            tokenBProgram: TOKEN_PROGRAM_ID,
            isLockLiquidity: false,
        });

        const { blockhash, lastValidBlockHeight } = await connectionDevnet.getLatestBlockhash("confirmed");
        txBuilder.recentBlockhash = blockhash;
        txBuilder.feePayer = adminKeypair.publicKey;
        txBuilder.sign(adminKeypair, positionNftMint);
        const serializedTx = txBuilder.serialize();
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

        const poolId = derivePoolAddress(
            config,
            new PublicKey(mintAAddress),
            new PublicKey(mintBAddress)
        );


        return NextResponse.json({
            success: true,
            poolTxId,
            poolKeys: {
                poolId: poolId.toString(),
                // positionId: position.toString(),
            }
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}