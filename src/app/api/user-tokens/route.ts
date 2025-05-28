import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { publicKey } = await req.json();

        if (!publicKey || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(publicKey)) {
            return NextResponse.json({ error: "Invalid public key" }, { status: 400 });
        }

        const heliusApiKey = process.env.HELIUS_API_KEY;
        if (!heliusApiKey) {
            throw new Error("Helius API key is not configured");
        }

        const response = await fetch(`https://devnet.helius-rpc.com/?api-key=${heliusApiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: "1",
                method: "getAssetsByOwner",
                params: {
                    ownerAddress: publicKey,
                    page: 1,
                    limit: 50,
                    sortBy: { sortBy: "created", sortDirection: "asc" },
                    options: {
                        showUnverifiedCollections: true,
                        showCollectionMetadata: true,
                        showGrandTotal: true,
                        showFungible: true,
                        showNativeBalance: true,
                        showInscription: false,
                        showZeroBalance: true,
                    },
                },
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data, { status: 200 });
    } catch (error: unknown) {
        console.error("Error fetching tokens:", error);

        let message = "Failed to fetch tokens";

        if (error instanceof Error) {
            message = error.message;
        }

        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}