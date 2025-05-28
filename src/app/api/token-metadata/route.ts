import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";

export interface TokenMetadata {
    name: string;
    symbol: string;
    image?: string;
    decimals?: number;
}

export async function POST(request: Request) {
    try {
        const { mintAddress } = await request.json();
        if (!mintAddress) {
            return NextResponse.json({ error: "Mint address is required" }, { status: 400 });
        }

        try {
            new PublicKey(mintAddress);
        } catch {
            return NextResponse.json({ error: "Invalid mint address" }, { status: 400 });
        }

        const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
        if (!HELIUS_API_KEY) {
            return NextResponse.json({ error: "Helius API key not configured" }, { status: 500 });
        }

        const HELIUS_URL = `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

        const response = await fetch(HELIUS_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: "test",
                method: "getAsset",
                params: {
                    id: mintAddress,
                    options: {
                        showUnverifiedCollections: true,
                        showCollectionMetadata: true,
                        showFungible: true,
                        showInscription: true,
                    },
                },
            }),
        });

        const data = await response.json();
        if (data?.result?.content?.metadata) {
            const metadata: TokenMetadata = {
                name: data.result.content.metadata.name || "Unknown",
                symbol: data.result.content.metadata.symbol || "Unknown",
                image: data.result.content.links?.image || undefined,
                decimals: data.result.token_info?.decimals || 0,
            };
            return NextResponse.json(metadata);
        }

        return NextResponse.json({ error: "Metadata not found" }, { status: 404 });
    } catch (error) {
        console.error("Error fetching token metadata:", error);
        return NextResponse.json({ error: "Failed to fetch token metadata" }, { status: 500 });
    }
}