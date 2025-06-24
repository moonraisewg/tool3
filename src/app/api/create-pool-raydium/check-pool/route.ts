import { NextRequest } from "next/server";
import { PublicKey } from "@solana/web3.js";
import {
    DEVNET_PROGRAM_ID,
    CpmmPoolInfoLayout,
} from "@raydium-io/raydium-sdk-v2";
import { connectionDevnet } from "@/service/solana/connection";
import { WSOL_MINT } from "@/utils/constants";

export async function POST(req: NextRequest) {
    try {
        let { mintAAddress, mintBAddress } = await req.json();

        if (!mintAAddress || !mintBAddress) {
            return new Response(JSON.stringify({ success: false, error: "Missing token addresses" }), { status: 400 });
        }

        if (mintAAddress === "NativeSOL") {
            mintAAddress = WSOL_MINT;
        }
        if (mintBAddress === "NativeSOL") {
            mintBAddress = WSOL_MINT;
        }

        const mintA = new PublicKey(mintAAddress);
        const mintB = new PublicKey(mintBAddress);

        const cpmmPoolsData = await connectionDevnet.getProgramAccounts(
            DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
            {
                filters: [{ dataSize: CpmmPoolInfoLayout.span }],
            }
        );

        for (const pool of cpmmPoolsData) {
            const decoded = CpmmPoolInfoLayout.decode(pool.account.data);
            const { mintA: poolMintA, mintB: poolMintB } = decoded;

            const isMatch =
                (poolMintA.equals(mintA) && poolMintB.equals(mintB)) ||
                (poolMintA.equals(mintB) && poolMintB.equals(mintA));

            if (isMatch) {
                return new Response(JSON.stringify({
                    success: true,
                    exists: true,
                    poolId: pool.pubkey.toBase58(),
                }));
            }
        }

        return new Response(JSON.stringify({ success: true, exists: false }));
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return new Response(JSON.stringify({ success: false, error: message }), { status: 500 });
    }
}
