// api/close-account/route.ts
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
        const systemPubkey = adminKeypair.publicKey; // Địa chỉ ví hệ thống nhận 10%

        if (estimateOnly) {
            // Ước tính phí rent
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
            // Chuẩn bị giao dịch
            const transaction = new Transaction();
            let totalRent = 0;

            for (const tokenMint of tokenAccounts) {
                const tokenAccount = await getAssociatedTokenAddress(
                    new PublicKey(tokenMint),
                    userPubkey
                );
                const accountInfo = await connectionDevnet.getAccountInfo(tokenAccount);
                if (!accountInfo) continue;

                totalRent += accountInfo.lamports;

                // Thêm instruction đóng tài khoản
                transaction.add(
                    createCloseAccountInstruction(
                        tokenAccount, // Tài khoản token cần đóng
                        userPubkey, // Địa chỉ nhận rent tạm thời
                        userPubkey, // Chủ sở hữu tài khoản
                        [], // Signers bổ sung (nếu có)
                        TOKEN_PROGRAM_ID
                    )
                );
            }

            // Chia phí rent: 90% cho người dùng, 10% cho hệ thống
            const userRent = Math.floor(totalRent * 0.9);
            const systemRent = totalRent - userRent;

            // Chuyển 10% cho hệ thống
            if (systemRent > 0) {
                transaction.add(
                    SystemProgram.transfer({
                        fromPubkey: userPubkey,
                        toPubkey: systemPubkey,
                        lamports: systemRent,
                    })
                );
            }

            const { blockhash, lastValidBlockHeight } = await connectionDevnet.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = userPubkey;

            return NextResponse.json({
                transaction: Buffer.from(transaction.serialize({ requireAllSignatures: false })).toString("base64"),
                blockhash,
                lastValidBlockHeight,
            });
        }

        // Thực thi giao dịch
        const transaction = Transaction.from(Buffer.from(signedTransaction));
        const signature = await connectionDevnet.sendRawTransaction(transaction.serialize());
        await connectionDevnet.confirmTransaction(signature);

        return NextResponse.json({ signature });
    } catch (error) {
        console.error("Close account error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}