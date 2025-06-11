import { initSdk, txVersion } from "@/service/raydium-sdk";
import {
    Connection,
    PublicKey,
    Transaction,
    LAMPORTS_PER_SOL,
    Keypair,
    SystemProgram,
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
import BN from "bn.js";
import bs58 from "bs58";

const mainnetConnection = new Connection("https://mainnet.helius-rpc.com/?api-key=4c0b7347-3a35-4a3c-a9ed-cd3e1763e54c", "confirmed");
const devnetConnection = new Connection(
    "https://devnet.helius-rpc.com/?api-key=4c0b7347-3a35-4a3c-a9ed-cd3e1763e54c",
    "confirmed"
);
const PAYMENT_WALLET = new PublicKey("FbirCYiRfy64Bfp8WuMfyx57ifevXWWjWgohnzgCv8gK");
const PAYMENT_AMOUNT_LAMPORTS = 0.00001 * LAMPORTS_PER_SOL;
const ADMIN_SECRET_KEY = process.env.ADMIN_PRIVATE_KEY!;
const adminKeypair = Keypair.fromSecretKey(bs58.decode(ADMIN_SECRET_KEY));

function isValidBase58(str: string): boolean {
    return /^[1-9A-HJ-NP-Za-km-z]+$/.test(str);
}

async function verifyPaymentTx(paymentTxId: string, userPublicKey: PublicKey): Promise<boolean> {
    try {
        const tx = await mainnetConnection.getTransaction(paymentTxId, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
        });
        if (!tx || !tx.meta) return false;

        const message = tx.transaction.message;
        const transferInstruction = message.compiledInstructions.find(
            (ix) =>
                message.staticAccountKeys[ix.programIdIndex].equals(SystemProgram.programId) &&
                ix.accountKeyIndexes.length === 2 &&
                message.staticAccountKeys[ix.accountKeyIndexes[1]].equals(PAYMENT_WALLET)
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

    // Admin's ATAs for holding tokens temporarily
    const adminAtaA = getAssociatedTokenAddressSync(mintAPubkey, adminKeypair.publicKey);
    const adminAtaB = getAssociatedTokenAddressSync(mintBPubkey, adminKeypair.publicKey);

    // User's ATAs
    const userAtaA = getAssociatedTokenAddressSync(mintAPubkey, userPublicKey);
    const userAtaB = getAssociatedTokenAddressSync(mintBPubkey, userPublicKey);

    // Check if admin ATAs exist; create if not
    const adminAtaAInfo = await devnetConnection.getAccountInfo(adminAtaA);
    if (!adminAtaAInfo) {
        tx.add(
            createAssociatedTokenAccountInstruction(
                userPublicKey, // User pays for ATA creation
                adminAtaA,
                adminKeypair.publicKey,
                mintAPubkey,
                TOKEN_PROGRAM_ID
            )
        );
    }

    const adminAtaBInfo = await devnetConnection.getAccountInfo(adminAtaB);
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

    // Transfer Token A
    if (mintAAddress === "So11111111111111111111111111111111111111112") {
        tx.add(
            SystemProgram.transfer({
                fromPubkey: userPublicKey,
                toPubkey: adminKeypair.publicKey, // Temporary holding by admin
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

    // Transfer Token B
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
        const { mintAAddress, mintBAddress, amountA, amountB, userPublicKey, paymentTxId, tokenTransferTxId } =
            await req.json();

        if (!userPublicKey || !paymentTxId || !mintAAddress || !mintBAddress || !amountA || !amountB) {
            return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), {
                status: 400,
            });
        }

        if (
            !isValidBase58(userPublicKey) ||
            !isValidBase58(paymentTxId) ||
            !isValidBase58(mintAAddress) ||
            !isValidBase58(mintBAddress) ||
            (tokenTransferTxId && !isValidBase58(tokenTransferTxId))
        ) {
            return new Response(JSON.stringify({ success: false, error: "Invalid base58 format" }), {
                status: 400,
            });
        }

        const userPubKey = new PublicKey(userPublicKey);
        const raydium = await initSdk();

        // Verify Mainnet payment
        const paymentValid = await verifyPaymentTx(paymentTxId, userPubKey);
        if (!paymentValid) {
            return new Response(
                JSON.stringify({ success: false, error: "Invalid or unconfirmed payment transaction" }),
                { status: 400 }
            );
        }

        const mintA = await raydium.token.getTokenInfo(mintAAddress);
        const mintB = await raydium.token.getTokenInfo(mintBAddress);
        if (!mintA || !mintB || mintA.address === mintB.address) {
            return new Response(JSON.stringify({ success: false, error: "Invalid token mints" }), {
                status: 400,
            });
        }

        const adminBalance = await devnetConnection.getBalance(adminKeypair.publicKey);
        if (adminBalance < 0.05 * LAMPORTS_PER_SOL) {
            return new Response(JSON.stringify({ success: false, error: "Insufficient admin SOL balance" }), {
                status: 400,
            });
        }

        // If tokenTransferTxId is not provided, generate token transfer transaction
        if (!tokenTransferTxId) {
            const tokenTransferTx = await createTokenTransferTx(
                userPubKey,
                mintAAddress,
                mintBAddress,
                amountA,
                amountB
            );
            const blockhashData = await devnetConnection.getLatestBlockhash("confirmed");
            tokenTransferTx.recentBlockhash = blockhashData.blockhash;
            tokenTransferTx.feePayer = userPubKey;

            return Response.json({
                success: true,
                tokenTransferTx: Buffer.from(tokenTransferTx.serialize({ requireAllSignatures: false })).toString("base64"),
                blockhash: blockhashData.blockhash,
                lastValidBlockHeight: blockhashData.lastValidBlockHeight,
            });
        }

        // Verify token transfer transaction
        const tx = await devnetConnection.getTransaction(tokenTransferTxId, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
        });
        if (!tx || !tx.meta) {
            return new Response(JSON.stringify({ success: false, error: "Invalid or unconfirmed token transfer transaction" }), {
                status: 400,
            });
        }

        // Check if tokens were transferred to admin's ATAs
        const adminAtaA = getAssociatedTokenAddressSync(new PublicKey(mintAAddress), adminKeypair.publicKey);
        const adminAtaB = getAssociatedTokenAddressSync(new PublicKey(mintBAddress), adminKeypair.publicKey);
        const accountsInfo = await devnetConnection.getMultipleAccountsInfo([adminAtaA, adminAtaB]);
        const tokenABalance = accountsInfo[0]
            ? Number(accountsInfo[0].data.slice(64, 72).readBigUInt64LE())
            : mintAAddress === "So11111111111111111111111111111111111111112"
                ? adminBalance
                : 0;
        const tokenBBalance = accountsInfo[1] ? Number(accountsInfo[1].data.slice(64, 72).readBigUInt64LE()) : 0;

        if (tokenABalance < Number(amountA)) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: `Insufficient ${mintA.symbol} transferred. Available: ${tokenABalance / (10 ** mintA.decimals)}, Required: ${Number(amountA) / (10 ** mintA.decimals)}`,
                }),
                { status: 400 }
            );
        }
        if (tokenBBalance < Number(amountB)) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: `Insufficient ${mintB.symbol} transferred. Available: ${tokenBBalance / (10 ** mintB.decimals)}, Required: ${Number(amountB) / (10 ** mintB.decimals)}`,
                }),
                { status: 400 }
            );
        }

        const feeConfigs = await raydium.api.getCpmmConfigs();
        if (!feeConfigs.length) {
            return new Response(JSON.stringify({ success: false, error: "No fee configurations available" }), {
                status: 500,
            });
        }
        if (raydium.cluster === "devnet") {
            feeConfigs.forEach((config) => {
                config.id = getCpmmPdaAmmConfigId(DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM, config.index).publicKey.toBase58();
            });
        }

        // Create pool using admin's token accounts
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

        const blockhashData = await devnetConnection.getLatestBlockhash("confirmed");
        transaction.message.recentBlockhash = blockhashData.blockhash;
        transaction.sign([adminKeypair]);

        const serializedTx = transaction.serialize();
        const poolTxId = await devnetConnection.sendRawTransaction(serializedTx, {
            skipPreflight: false,
            maxRetries: 3,
        });
        await devnetConnection.confirmTransaction(
            {
                signature: poolTxId,
                blockhash: blockhashData.blockhash,
                lastValidBlockHeight: blockhashData.lastValidBlockHeight,
            },
            "confirmed"
        );


        return Response.json({
            success: true,
            poolTxId,
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
        return new Response(JSON.stringify({ success: false, error: message }), { status: 500 });
    }
}