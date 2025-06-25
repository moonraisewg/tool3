import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
    TOKEN_PROGRAM_ID,
    createTransferInstruction,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { NextResponse } from "next/server";
import { connectionMainnet, connectionDevnet } from "@/service/solana/connection";
import { adminKeypair } from "@/config";
import { NATIVE_SOL } from "@/utils/constants";

interface SellSolRequest {
    walletPublicKey: string;
    tokenAmount: number;
    tokenMint: string;
    solAmount: number;
}

function isValidPublicKey(key: string): boolean {
    try {
        if (key === NATIVE_SOL) return true;
        new PublicKey(key);
        return true;
    } catch {
        return false;
    }
}

export async function POST(request: Request) {
    try {
        const { walletPublicKey, tokenAmount, tokenMint, solAmount } = await request.json() as SellSolRequest;

        if (
            !walletPublicKey ||
            !tokenMint ||
            tokenAmount === undefined ||
            isNaN(tokenAmount) ||
            Number(tokenAmount) <= 0 ||
            solAmount === undefined ||
            isNaN(solAmount) ||
            Number(solAmount) <= 0
        ) {
            return NextResponse.json(
                { error: "Missing or invalid input" },
                { status: 400 }
            );
        }

        if (!isValidPublicKey(walletPublicKey) || !isValidPublicKey(tokenMint)) {
            return NextResponse.json(
                { error: "Invalid public key(s)" },
                { status: 400 }
            );
        }

        const userPublicKey = new PublicKey(walletPublicKey);
        const adminPublicKey = adminKeypair.publicKey;
        let mintPublicKey: PublicKey;
        const isNativeSOL = tokenMint === NATIVE_SOL;

        const adminBalance = await connectionDevnet.getBalance(adminPublicKey);
        const requiredLamports = Math.round(solAmount);
        const minBalanceForRentExemption = 890880;
        if (adminBalance < requiredLamports + minBalanceForRentExemption) {
            return NextResponse.json(
                {
                    error: "Admin wallet does not have enough SOL on Devnet to complete the transaction",
                },
                { status: 400 }
            );
        }

        const transaction = new Transaction();

        if (isNativeSOL) {
            transaction.add(
                SystemProgram.transfer({
                    fromPubkey: userPublicKey,
                    toPubkey: adminPublicKey,
                    lamports: Math.round(tokenAmount),
                })
            );
        } else {
            mintPublicKey = new PublicKey(tokenMint);
            const userTokenAccount = await getAssociatedTokenAddress(mintPublicKey, userPublicKey);
            const adminTokenAccount = await getAssociatedTokenAddress(mintPublicKey, adminPublicKey);

            const userTokenExists = !!(await connectionMainnet.getAccountInfo(userTokenAccount));
            const adminTokenExists = !!(await connectionMainnet.getAccountInfo(adminTokenAccount));

            if (!userTokenExists) {
                transaction.add(
                    createAssociatedTokenAccountInstruction(
                        userPublicKey,
                        userTokenAccount,
                        userPublicKey,
                        mintPublicKey
                    )
                );
            }

            if (!adminTokenExists) {
                transaction.add(
                    createAssociatedTokenAccountInstruction(
                        userPublicKey,
                        adminTokenAccount,
                        adminPublicKey,
                        mintPublicKey
                    )
                );
            }

            transaction.add(
                createTransferInstruction(
                    userTokenAccount,
                    adminTokenAccount,
                    userPublicKey,
                    Math.round(tokenAmount),
                    [],
                    TOKEN_PROGRAM_ID
                )
            );
        }

        const { blockhash } = await connectionMainnet.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = userPublicKey;

        const serializedTx = transaction.serialize({
            requireAllSignatures: false,
        }).toString("base64");

        return NextResponse.json({ serializedTx });
    } catch (error) {
        console.error("Transaction preparation error:", error);
        return NextResponse.json(
            { error: (error as Error).message || "Internal Server Error" },
            { status: 500 }
        );
    }
}