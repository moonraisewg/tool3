import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { connectionDevnet } from "@/service/solana/connection";
import { derivePoolAddress } from "@meteora-ag/cp-amm-sdk";

import { isValidBase58 } from "../../create-pool-raydium/route";
import { CONFIG_CREATE_METEORA_ADDRESS, WSOL_MINT } from "@/utils/constants";

export async function POST(req: Request) {
    try {
        let { mintAAddress, mintBAddress } = await req.json();

        if (!mintAAddress || !mintBAddress) {
            return NextResponse.json({ success: false, error: "Missing mintAAddress or mintBAddress" }, { status: 400 });
        }

        if (mintAAddress === "NativeSOL") {
            mintAAddress = WSOL_MINT;
        }
        if (mintBAddress === "NativeSOL") {
            mintBAddress = WSOL_MINT;
        }

        if (!isValidBase58(mintAAddress) || !isValidBase58(mintBAddress)) {
            return NextResponse.json({ success: false, error: "Invalid base58 format" }, { status: 400 });
        }

        const config = new PublicKey(CONFIG_CREATE_METEORA_ADDRESS);
        const derivedPoolId = derivePoolAddress(
            config,
            new PublicKey(mintAAddress),
            new PublicKey(mintBAddress)
        );

        const poolInfo = await connectionDevnet.getAccountInfo(derivedPoolId);

        return NextResponse.json({
            success: true,
            exists: !!poolInfo,
            poolId: poolInfo ? derivedPoolId.toBase58() : null,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}