import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
    TOKEN_PROGRAM_ID,
    createTransferInstruction,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { NextResponse } from "next/server";
import { connectionMainnet } from "@/service/solana/connection";

const ADMIN_PUBLIC_KEY = process.env.ADMIN_PUBLIC_KEY || "";

function isValidPublicKey(key: string): boolean {
    try {
        if (key === "NativeSOL") return true
        new PublicKey(key);
        return true;
    } catch {
        return false;
    }
}

export async function POST(request: Request) {
    try {
        const { walletPublicKey, tokenAmount, tokenMint } = await request.json();

        if (
            !walletPublicKey ||
            !tokenMint ||
            tokenAmount === undefined ||
            isNaN(tokenAmount) ||
            Number(tokenAmount) <= 0
        ) {
            return NextResponse.json(
                { error: "Missing or invalid input" },
                { status: 400 }
            );
        }

        if (!isValidPublicKey(walletPublicKey) || !isValidPublicKey(tokenMint) || !isValidPublicKey(ADMIN_PUBLIC_KEY)) {
            return NextResponse.json(
                { error: "Invalid public key(s)" },
                { status: 400 }
            );
        }

        const userPublicKey = new PublicKey(walletPublicKey);
        const adminPublicKey = new PublicKey(ADMIN_PUBLIC_KEY);
        let mintPublicKey: PublicKey;
        const isNativeSOL = tokenMint === "NativeSOL";

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
