import { Token } from "@/types/types";
import { NextRequest, NextResponse } from "next/server";

interface SolanaTokenList {
  tokens: Token[];
}

interface TokenInfo {
  balance?: number;
  decimals?: number;
  supply?: number;
  token_standard?: string;
  price_info?: {
    price_per_token: number;
    total_price: number;
    currency: string;
  };
}

interface AssetContent {
  metadata?: {
    name?: string;
    symbol?: string;
    description?: string;
    attributes?: Array<{ trait_type: string; value: string }>;
  };
  links?: {
    image?: string;
    external_url?: string;
  };
}

interface Asset {
  id: string;
  content?: AssetContent;
  token_info?: TokenInfo;
  interface?: string;
  ownership?: {
    owner: string;
    frozen: boolean;
  };
  [key: string]: unknown;
}

interface HeliusResponse {
  result: {
    items: Asset[];
    total: number;
    limit: number;
    page: number;
    grand_total?: {
      native_balance: number;
      tokens: number;
    };
  };
  jsonrpc: string;
  id: string;
}

let fallbackTokenList: {
  tokens: Record<string, Token>;
  timestamp: number;
} | null = null;

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 giờ

async function loadFallbackTokenList(forceRefresh = false): Promise<Record<string, Token>> {
  if (
    !forceRefresh &&
    fallbackTokenList &&
    Date.now() - fallbackTokenList.timestamp < CACHE_TTL
  ) {
    return fallbackTokenList.tokens;
  }

  try {
    const res = await fetch(
      "https://cdn.jsdelivr.net/gh/solana-labs/token-list@latest/src/tokens/solana.tokenlist.json"
    );
    if (!res.ok) {
      throw new Error(
        `Failed to fetch Solana Labs token list: ${res.statusText}`
      );
    }
    const tokenList: SolanaTokenList = await res.json();
    const tokenMap = tokenList.tokens.reduce(
      (map: Record<string, Token>, token: Token) => {
        map[token.address] = token;
        return map;
      },
      {}
    );

    fallbackTokenList = { tokens: tokenMap, timestamp: Date.now() };
    return tokenMap;
  } catch (error) {
    console.error("Error loading fallback token list:", error);
    return {};
  }
}

export async function POST(req: NextRequest) {
  try {

    const { publicKey, cluster = "mainnet", forceRefresh = false } = await req.json();

    if (!publicKey || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(publicKey)) {
      return NextResponse.json({ error: "Invalid public key" }, { status: 400 });
    }

    let RPC
    if (cluster === "mainnet") {
      RPC = process.env.NEXT_PUBLIC_RPC_MAINNET!;
    } else {
      RPC = process.env.NEXT_PUBLIC_RPC_DEVNET!;
    }

    const response = await fetch(
      RPC,
      {
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
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data: HeliusResponse = await response.json();
    const assets: Asset[] = data.result.items || [];

    const fallbackMap = await loadFallbackTokenList(forceRefresh);

    const enrichedAssets: Asset[] = assets.map((asset: Asset) => {
      const metadata = asset.content?.metadata;
      const hasMetadata = metadata && Object.keys(metadata).length > 0;

      if (hasMetadata) return asset;

      const fallback = fallbackMap[asset.id];
      if (fallback) {
        return {
          ...asset,
          content: {
            ...asset.content,
            metadata: {
              name: fallback.name,
              symbol: fallback.symbol,
            },
            links: {
              ...asset.content?.links,
              image: fallback.logoURI,
            },
          },
          token_info: {
            ...asset.token_info,
            decimals: fallback.decimals,
          },
        };
      }

      return asset;
    });

    return NextResponse.json(
      { ...data, result: { ...data.result, items: enrichedAssets } },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Error fetching tokens:", error);
    let message = "Failed to fetch tokens";
    if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
