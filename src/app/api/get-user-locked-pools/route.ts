import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getUserLockedPools } from "@/service/solana/action";

export async function POST(req: Request) {
    try {
        const { userPublicKey } = await req.json();

        if (!userPublicKey) {
            return NextResponse.json(
                { error: "Missing required field: userPublicKey" },
                { status: 400 }
            );
        }

        // Validate PublicKey
        let publicKey;
        try {
            publicKey = new PublicKey(userPublicKey);
        } catch {
            return NextResponse.json(
                { error: "Invalid userPublicKey" },
                { status: 400 }
            );
        }

        // Gọi hàm getUserLockedPools từ action.ts
        const userPoolInfos = await getUserLockedPools(publicKey);

        return NextResponse.json({ success: true, data: userPoolInfos });
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : "Failed to fetch user locked pools";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}