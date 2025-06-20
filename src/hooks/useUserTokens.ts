import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { ClusterType } from "@/types/types";

export interface UserToken {
    address: string;
    name: string;
    balance: string;
    symbol?: string;
    logoURI?: string;
    decimals?: number;
}

interface Token {
    address: string;
    name: string;
    symbol: string;
    logoURI?: string;
    decimals: number;
}

interface TokenInfo {
    balance?: number;
    decimals?: number;
    symbol?: string;
}

interface Content {
    metadata?: { name?: string; symbol?: string };
    links?: { image?: string };
}

interface Asset {
    interface: "FungibleToken" | "FungibleAsset";
    id: string;
    content?: Content;
    token_info?: TokenInfo;
}

interface HeliusResponse {
    result: {
        items: Asset[];
        nativeBalance?: { lamports: number };
    };
}

interface SolanaTokenList {
    tokens: Token[];
}

let fallbackTokenList: {
    tokens: Record<string, Token>;
    timestamp: number;
} | null = null;

const CACHE_TTL = 24 * 60 * 60 * 1000;

const loadFallbackTokenList = async (forceRefresh = false): Promise<Record<string, Token>> => {
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
            throw new Error(`Failed to fetch Solana Labs token list: ${res.statusText}`);
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
};

export const useUserTokens = (cluster: ClusterType = "mainnet", excludeToken?: string) => {
    const [tokens, setTokens] = useState<UserToken[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const { publicKey } = useWallet();

    const fetchTokens = useCallback(async () => {
        if (!publicKey) {
            setTokens([]);
            setError(null);
            return;
        }

        if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(publicKey.toString())) {
            setError("Invalid public key");
            toast.error("Invalid public key");
            setTokens([]);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const RPC =
                cluster === "mainnet"
                    ? process.env.NEXT_PUBLIC_RPC_MAINNET!
                    : process.env.NEXT_PUBLIC_RPC_DEVNET!;

            const response = await fetch(RPC, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: "1",
                    method: "getAssetsByOwner",
                    params: {
                        ownerAddress: publicKey.toString(),
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

            const data: HeliusResponse = await response.json();
            const assets = data.result?.items || [];
            const nativeBalance = data.result?.nativeBalance?.lamports || 0;

            const fallbackMap = await loadFallbackTokenList();

            const enrichedAssets: Asset[] = assets.map((asset: Asset) => {
                const metadata = asset.content?.metadata;
                const hasMetadata = !!(metadata?.name && metadata?.symbol);

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
                                image: asset.content?.links?.image || fallback.logoURI,
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

            const formattedTokens: UserToken[] = enrichedAssets
                .filter(
                    (asset: Asset) =>
                        asset.interface === "FungibleToken" || asset.interface === "FungibleAsset"
                )
                .map((asset: Asset) => {
                    const mint = asset.id;
                    const balance =
                        (asset.token_info?.balance || 0) /
                        Math.pow(10, asset.token_info?.decimals || 0);

                    return {
                        address: mint,
                        name: asset.content?.metadata?.name || "Unknown Token",
                        balance: balance.toString(),
                        symbol: asset.token_info?.symbol || asset.content?.metadata?.symbol,
                        logoURI: asset.content?.links?.image,
                        decimals: asset.token_info?.decimals || 0,
                    };
                })
                .filter((token: UserToken) => !excludeToken || token.address !== excludeToken);

            const solToken: UserToken = {
                address: "NativeSOL",
                name: "Solana",
                symbol: "SOL",
                balance: (nativeBalance / 1_000_000_000).toString(),
                logoURI:
                    "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
                decimals: 9,
            };

            const allTokens =
                excludeToken !== "NativeSOL" ? [solToken, ...formattedTokens] : formattedTokens;

            setTokens(allTokens);
        } catch (error: unknown) {
            const errorMessage =
                error instanceof Error ? error.message : "Failed to fetch tokens";
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [publicKey, cluster, excludeToken]);

    useEffect(() => {
        fetchTokens();
    }, [fetchTokens]);

    return { tokens, loading, error, refetch: fetchTokens };
};
