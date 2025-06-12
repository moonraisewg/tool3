import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { Token } from "@/types/types";

const cache = new Map<string, { metadata: Token; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const { mintAddress } = await request.json();
    if (!mintAddress) {
      return NextResponse.json(
        { error: "Mint address is required" },
        { status: 400 }
      );
    }

    try {
      new PublicKey(mintAddress);
    } catch {
      return NextResponse.json(
        { error: "Invalid mint address" },
        { status: 400 }
      );
    }

    // Check cache first
    const cached = cache.get(mintAddress);
    const now = Date.now();
    if (cached && now - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.metadata);
    }

    const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

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

    if (
      data?.result?.content?.metadata &&
      Object.keys(data.result.content.metadata).length > 0
    ) {
      const metadata: Token = {
        address: mintAddress,
        name: data.result.content.metadata.name || "Unknown",
        symbol: data.result.content.metadata.symbol || "Unknown",
        logoURI: data.result.content.links?.image || undefined,
        decimals: data.result.token_info?.decimals || 0,
      };

      // Store in cache
      cache.set(mintAddress, { metadata, timestamp: now });
      return NextResponse.json(metadata);
    }

    const fallbackRes = await fetch(
      "https://cdn.jsdelivr.net/gh/solana-labs/token-list@latest/src/tokens/solana.tokenlist.json"
    );
    const fallbackData = await fallbackRes.json();

    const tokenList: Token[] = fallbackData?.tokens || [];
    const found = tokenList.find(
      (token: Token) => token.address === mintAddress
    );

    if (found) {
      const fallbackMetadata: Token = {
        address: mintAddress,
        name: found.name,
        symbol: found.symbol,
        logoURI: found.logoURI,
        decimals: found.decimals,
      };

      // Store in cache
      cache.set(mintAddress, { metadata: fallbackMetadata, timestamp: now });
      return NextResponse.json(fallbackMetadata);
    }

    return NextResponse.json({ error: "Metadata not found" }, { status: 404 });
  } catch (error) {
    console.error("Error fetching token metadata:", error);
    return NextResponse.json(
      { error: "Failed to fetch token metadata" },
      { status: 500 }
    );
  }
}
