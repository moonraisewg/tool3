import { NextResponse } from "next/server";
import { Transaction } from "@solana/web3.js";
import { connectionDevnet, connectionMainnet } from "@/service/solana/connection";

export async function POST(req: Request) {
    try {
        const { transaction, blockhash, lastValidBlockHeight, cluster } = await req.json();

        if (!transaction || !blockhash || !lastValidBlockHeight || !cluster) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        const connection = cluster.toLowerCase() === "devnet" ? connectionDevnet : connectionMainnet;

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
            error instanceof Error ? error.message : "Failed transaction processing";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}