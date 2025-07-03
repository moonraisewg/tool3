import {
    Connection,
    PublicKey,
    Transaction,
    SystemProgram,
    VersionedTransaction,
} from "@solana/web3.js";
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as jito from "jito-ts";
import { Keypair } from "@solana/web3.js";
import { toast } from "sonner";
import { connectionDevnet } from "@/service/solana/connection";
import { API_URLS } from "@raydium-io/raydium-sdk-v2";
import { NextRequest, NextResponse } from "next/server";
import { adminKeypair } from "@/config";
import { TransactionInstruction } from "@solana/web3.js";


interface BundledTransactionRequest {
    userPublicKey: string;
    tokenAddress: string;
    amount: string;
    action: "bundledSell" | "bundledBuy" | "sellAndBundledBuy";
    dex: "raydium" | "pump";
    chain: "solana";
    jitoFee: string;
    addresses: string[];
}

interface SwapCompute {
    id: string;
    success: boolean;
    version: "V0" | "V1";
    openTime?: undefined;
    msg: string | undefined;
    data: {
        swapType: "BaseIn" | "BaseOut";
        inputMint: string;
        inputAmount: string;
        outputMint: string;
        outputAmount: string;
        otherAmountThreshold: string;
        slippageBps: number;
        priceImpactPct: number;
        routePlan: {
            poolId: string;
            inputMint: string;
            outputMint: string;
            feeMint: string;
            feeRate: number;
            feeAmount: string;
        }[];
    };
}

interface TokenAccount {
    mint: PublicKey;
    publicKey: PublicKey;
}

async function fetchTokenAccountData(wallet: PublicKey, connection: Connection): Promise<{ tokenAccounts: TokenAccount[] }> {
    const accounts = await connection.getParsedTokenAccountsByOwner(wallet, { programId: TOKEN_PROGRAM_ID });
    const tokenAccounts = accounts.value.map(({ pubkey, account }) => ({
        mint: new PublicKey(account.data.parsed.info.mint),
        publicKey: pubkey,
    }));
    return { tokenAccounts };
}

export async function POST(req: NextRequest) {
    try {
        const {
            userPublicKey,
            tokenAddress,
            amount,
            action,
            dex,
            chain,
            jitoFee,
            addresses,
        }: BundledTransactionRequest = await req.json();

        // Input validation
        if (!userPublicKey || !tokenAddress || !amount || !action || !dex || !chain || !jitoFee || !addresses || addresses.length === 0) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        if (chain !== "solana") {
            return NextResponse.json({ error: "Only Solana chain is supported" }, { status: 400 });
        }

        if (!["bundledSell", "bundledBuy", "sellAndBundledBuy"].includes(action)) {
            return NextResponse.json({ error: "Invalid action type" }, { status: 400 });
        }

        if (addresses.length > 50) {
            return NextResponse.json({ error: "Maximum 50 addresses allowed for bundling" }, { status: 400 });
        }

        const connection = connectionDevnet;
        const userPubKey = new PublicKey(userPublicKey);
        const tokenMint = new PublicKey(tokenAddress);
        // const amountInLamports = BigInt(amount);
        const jitoFeeInLamports = BigInt(jitoFee);
        const solMint = new PublicKey("So11111111111111111111111111111111111111112"); // Wrapped SOL mint
        const slippage = 0.5; // 0.5% slippage
        const txVersion = "V0";

        // Load Jito configuration
        const blockEngineUrl = process.env.BLOCK_ENGINE_URL || "";
        if (!blockEngineUrl) {
            return NextResponse.json({ error: "BLOCK_ENGINE_URL not configured" }, { status: 500 });
        }

        const authKeypair: Keypair = adminKeypair;

        // Initialize Jito searcher client
        const jitoClient = jito.searcher.searcherClient(blockEngineUrl, authKeypair);

        // Fetch recent blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

        // Create transaction
        const transaction = new Transaction({
            recentBlockhash: blockhash,
            feePayer: userPubKey,
        });

        // Add Jito fee transfer instruction
        if (jitoFeeInLamports > 0) {
            const jitoTipAccount = new PublicKey("3bT5oZ2y9tA5kY1nWFu84tqqpx2mC8n6T3n2f1qG4rnx");
            transaction.add(
                SystemProgram.transfer({
                    fromPubkey: userPubKey,
                    toPubkey: jitoTipAccount,
                    lamports: jitoFeeInLamports,
                })
            );
        }

        // Add service fee instruction (0.0000066 SOL per address)
        const serviceFeePerAddress = BigInt(6600); // 0.0000066 SOL in lamports
        const totalServiceFee = serviceFeePerAddress * BigInt(addresses.length);
        transaction.add(
            SystemProgram.transfer({
                fromPubkey: userPubKey,
                toPubkey: adminKeypair.publicKey,
                lamports: totalServiceFee,
            })
        );

        // Fetch priority fee
        const priorityFeeResponse = await fetch(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`);
        const priorityFeeData: { id: string; success: boolean; data: { default: { vh: number; h: number; m: number } } } = await priorityFeeResponse.json();
        if (!priorityFeeData.success) {
            throw new Error("Failed to fetch priority fee");
        }
        const computeUnitPriceMicroLamports = String(priorityFeeData.data.default.h);

        // Process transactions for each address
        for (const address of addresses) {
            const walletPubKey = new PublicKey(address);
            const { tokenAccounts } = await fetchTokenAccountData(walletPubKey, connection);
            const isInputSol = action === "bundledBuy" || action === "sellAndBundledBuy";
            const isOutputSol = action === "bundledSell" || action === "sellAndBundledBuy";

            const inputMint = isInputSol ? solMint : tokenMint;
            const outputMint = isOutputSol ? solMint : tokenMint;
            const inputTokenAcc = tokenAccounts.find((a) => a.mint.toBase58() === inputMint.toBase58())?.publicKey;
            const outputTokenAcc = tokenAccounts.find((a) => a.mint.toBase58() === outputMint.toBase58())?.publicKey;

            if (!inputTokenAcc && !isInputSol) {
                return NextResponse.json({ error: `No input token account for ${inputMint.toBase58()}` }, { status: 400 });
            }

            // Create output ATA if it doesn't exist
            if (!outputTokenAcc && !isOutputSol) {
                const outputATA = await getAssociatedTokenAddress(outputMint, walletPubKey);
                transaction.add(
                    createAssociatedTokenAccountInstruction(
                        userPubKey,
                        outputATA,
                        walletPubKey,
                        outputMint
                    )
                );
            }

            if (action === "bundledSell" || action === "sellAndBundledBuy") {
                // Sell: Swap tokens for SOL (swap-base-out to specify output SOL amount)
                if (dex === "raydium") {
                    const swapResponse = await fetch(
                        `${API_URLS.SWAP_HOST}/compute/swap-base-out?inputMint=${tokenMint.toBase58()}&outputMint=${solMint.toBase58()}&amount=${amount}&slippageBps=${slippage * 100}&txVersion=${txVersion}`
                    );
                    const swapData: SwapCompute = await swapResponse.json();
                    if (!swapData.success) {
                        throw new Error(swapData.msg || "Failed to fetch swap data");
                    }

                    const swapTxResponse = await fetch(`${API_URLS.SWAP_HOST}/transaction/swap-base-out`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            computeUnitPriceMicroLamports,
                            swapResponse: swapData,
                            txVersion,
                            wallet: walletPubKey.toBase58(),
                            wrapSol: false,
                            unwrapSol: true,
                            inputAccount: inputTokenAcc?.toBase58(),
                            outputAccount: undefined,
                        }),
                    });
                    const swapTxData: { id: string; version: string; success: boolean; data: { transaction: string }[] } = await swapTxResponse.json();
                    if (!swapTxData.success) {
                        throw new Error("Failed to fetch swap transaction");
                    }

                    const txBuf = Buffer.from(swapTxData.data[0].transaction, "base64");
                    const swapTx = VersionedTransaction.deserialize(txBuf);
                    transaction.add(...swapTx.message.compiledInstructions.map((ix) =>
                        new TransactionInstruction({
                            keys: ix.accountKeyIndexes.map((idx) => ({
                                pubkey: swapTx.message.staticAccountKeys[idx],
                                isSigner: swapTx.message.header.numRequiredSignatures > idx,
                                isWritable: swapTx.message.isAccountWritable(idx),
                            })),
                            programId: swapTx.message.staticAccountKeys[ix.programIdIndex],
                            data: Buffer.from(ix.data),
                        })
                    ));
                } else {
                    // Pump sell placeholder
                    const pumpProgramId = new PublicKey("PUMP_PROGRAM_ID"); // Replace with actual Pump program ID
                    const poolId = new PublicKey("PUMP_POOL_ID"); // Replace with actual Pump pool ID
                    transaction.add(
                        new TransactionInstruction({
                            keys: [
                                { pubkey: walletPubKey, isSigner: true, isWritable: true },
                                { pubkey: inputTokenAcc || walletPubKey, isSigner: false, isWritable: true },
                                { pubkey: solMint, isSigner: false, isWritable: true },
                                { pubkey: poolId, isSigner: false, isWritable: true },
                            ],
                            programId: pumpProgramId,
                            data: Buffer.from([]),
                        })
                    );
                }
            }

            if (action === "bundledBuy" || action === "sellAndBundledBuy") {
                // Buy: Swap SOL for tokens (swap-base-in)
                if (dex === "raydium") {
                    const swapResponse = await fetch(
                        `${API_URLS.SWAP_HOST}/compute/swap-base-in?inputMint=${solMint.toBase58()}&outputMint=${tokenMint.toBase58()}&amount=${100}&slippageBps=${slippage * 100}&txVersion=${txVersion}`
                    );
                    const swapData: SwapCompute = await swapResponse.json();
                    if (!swapData.success) {
                        throw new Error(swapData.msg || "Failed to fetch swap data");
                    }

                    const swapTxResponse = await fetch(`${API_URLS.SWAP_HOST}/transaction/swap-base-in`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            computeUnitPriceMicroLamports,
                            swapResponse: swapData,
                            txVersion,
                            wallet: walletPubKey.toBase58(),
                            wrapSol: true,
                            unwrapSol: false,
                            inputAccount: undefined,
                            outputAccount: outputTokenAcc?.toBase58(),
                        }),
                    });
                    const swapTxData: { id: string; version: string; success: boolean; data: { transaction: string }[] } = await swapTxResponse.json();
                    if (!swapTxData.success) {
                        throw new Error("Failed to fetch swap transaction");
                    }

                    const txBuf = Buffer.from(swapTxData.data[0].transaction, "base64");
                    const swapTx = VersionedTransaction.deserialize(txBuf);
                    transaction.add(...swapTx.message.compiledInstructions.map((ix) =>
                        new TransactionInstruction({
                            keys: ix.accountKeyIndexes.map((idx) => ({
                                pubkey: swapTx.message.staticAccountKeys[idx],
                                isSigner: swapTx.message.header.numRequiredSignatures > idx,
                                isWritable: swapTx.message.isAccountWritable(idx),
                            })),
                            programId: swapTx.message.staticAccountKeys[ix.programIdIndex],
                            data: Buffer.from(ix.data),
                        })
                    ));
                } else {
                    // Pump buy placeholder
                    const pumpProgramId = new PublicKey("PUMP_PROGRAM_ID"); // Replace with actual Pump program ID
                    const poolId = new PublicKey("PUMP_POOL_ID"); // Replace with actual Pump pool ID
                    transaction.add(
                        new TransactionInstruction({
                            keys: [
                                { pubkey: walletPubKey, isSigner: true, isWritable: true },
                                { pubkey: solMint, isSigner: false, isWritable: true },
                                { pubkey: outputTokenAcc || tokenMint, isSigner: false, isWritable: true },
                                { pubkey: poolId, isSigner: false, isWritable: true },
                            ],
                            programId: pumpProgramId,
                            data: Buffer.from([]),
                        })
                    );
                }
            }
        }

        // Convert legacy Transaction to VersionedTransaction for Jito
        const messageV0 = transaction.compileMessage();
        const versionedTx = new VersionedTransaction(messageV0);
        // Create Jito bundle
        const bundle = new jito.bundle.Bundle([versionedTx], addresses.length);
        bundle.addTipTx(authKeypair, Number(jitoFeeInLamports), userPubKey, blockhash);

        // Serialize transaction for client-side signing
        const serializedTransaction = Buffer.from(versionedTx.serialize()).toString("base64");

        // Send bundle to Jito block engine
        const bundleResult = await jitoClient.sendBundle(bundle);
        if (!bundleResult.ok) {
            throw new Error(`Failed to send bundle: ${bundleResult.error}`);
        }

        // Subscribe to bundle result
        jitoClient.onBundleResult(
            (result) => {
                if (result.bundleId === bundleResult.value) {
                    if (result.accepted) {
                        toast.success(`Bundle ${result.bundleId} accepted by Jito block engine`);
                    } else if (result.rejected) {
                        toast.error(`Bundle ${result.bundleId} rejected: ${JSON.stringify(result.rejected)}`);
                    } else if (result.processed) {
                        toast.info(`Bundle ${result.bundleId} processed`);
                    }
                }
            },
            (error) => {
                toast.error(`Error tracking bundle: ${error.message}`);
            }
        );

        return NextResponse.json({
            transaction: serializedTransaction,
            blockhash,
            lastValidBlockHeight,
            bundleId: bundleResult.value,
        });
    } catch (error) {
        console.error("Error in bundled-transaction API:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Failed to prepare bundled transaction",
            },
            { status: 500 }
        );
    }
}