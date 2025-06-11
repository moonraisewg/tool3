import { NextResponse } from "next/server";
import { Transaction } from "@solana/web3.js";
import { connection } from "@/service/solana/connection";

export async function POST(req: Request) {
    try {
        const { transaction, blockhash, lastValidBlockHeight } = await req.json();

        if (!transaction || !blockhash || !lastValidBlockHeight) {
            return NextResponse.json(
                { error: "Thiếu các trường bắt buộc" },
                { status: 400 }
            );
        }

        const tx = Transaction.from(Buffer.from(transaction, "base64"));

        const txId = await connection.sendRawTransaction(tx.serialize());

        await connection.confirmTransaction({
            signature: txId,
            blockhash,
            lastValidBlockHeight,
        });

        return NextResponse.json({ success: true, txId });
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : "Xử lý giao dịch thất bại";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}