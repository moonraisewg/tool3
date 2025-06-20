import { NextRequest, NextResponse } from "next/server";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createCloseAccountInstruction } from "@solana/spl-token";
import { connectionDevnet } from "@/service/solana/connection";
import { adminKeypair } from "@/config";

export async function POST(req: NextRequest) {
    try {
        const { userPublicKey, tokenAccounts, signedTransaction, estimateOnly } = await req.json();

        if (!userPublicKey) {
            return NextResponse.json({ error: "Missing user public key" }, { status: 400 });
        }

        const userPubkey = new PublicKey(userPublicKey);
        const systemPubkey = adminKeypair.publicKey; // 

        if (estimateOnly) {
            let totalRent = 0;
            for (const tokenMint of tokenAccounts) {
                const tokenAccount = await getAssociatedTokenAddress(
                    new PublicKey(tokenMint),
                    userPubkey
                );
                const accountInfo = await connectionDevnet.getAccountInfo(tokenAccount);
                if (accountInfo) {
                    totalRent += accountInfo.lamports;
                }
            }
            return NextResponse.json({
                userRent: totalRent,
            });
        }

        if (!tokenAccounts || !Array.isArray(tokenAccounts)) {
            return NextResponse.json({ error: "Missing or invalid token accounts" }, { status: 400 });
        }

        if (!signedTransaction) {
            const transaction = new Transaction();
            let totalRent = 0;

            for (const tokenMint of tokenAccounts) {
                const tokenAccount = await getAssociatedTokenAddress(
                    new PublicKey(tokenMint),
                    userPubkey
                );
                const accountInfo = await connectionDevnet.getAccountInfo(tokenAccount);
                if (!accountInfo) {
                    console.warn(`Token account ${tokenAccount.toString()} not found, skipping`);
                    continue;
                }

                totalRent += accountInfo.lamports;

                transaction.add(
                    createCloseAccountInstruction(
                        tokenAccount,
                        systemPubkey,
                        userPubkey,
                        [],
                        TOKEN_PROGRAM_ID
                    )
                );
            }

            if (totalRent === 0) {
                return NextResponse.json({ error: "No rent to reclaim from selected accounts" }, { status: 400 });
            }

            const userRent = Math.floor(totalRent * 0.9);
            if (userRent > 0) {
                transaction.add(
                    SystemProgram.transfer({
                        fromPubkey: systemPubkey,
                        toPubkey: userPubkey,
                        lamports: userRent,
                    })
                );
            }

            // Lấy blockhash và đặt fee payer
            const { blockhash, lastValidBlockHeight } = await connectionDevnet.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = adminKeypair.publicKey;
            transaction.partialSign(adminKeypair);

            return NextResponse.json({
                transaction: Buffer.from(transaction.serialize({ requireAllSignatures: false })).toString("base64"),
                blockhash,
                lastValidBlockHeight,
            });
        }

        const transaction = Transaction.from(Buffer.from(signedTransaction));
        const signature = await connectionDevnet.sendRawTransaction(transaction.serialize(), {
            skipPreflight: false,
            preflightCommitment: "confirmed",
        });
        await connectionDevnet.confirmTransaction({
            signature,
            blockhash: transaction.recentBlockhash!,
            lastValidBlockHeight: (await connectionDevnet.getLatestBlockhash()).lastValidBlockHeight,
        });

        return NextResponse.json({ signature });
    } catch (error) {
        console.error("Close account error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}