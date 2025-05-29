"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicKey } from "@solana/web3.js";
import { getAllPoolsWithUserRatio, type PoolInfo } from "@/service/solana/action";
import { useWallet } from "@solana/wallet-adapter-react";
import { ArrowUpRight, Coins, Lock, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Token } from "@/types/types";

interface EnhancedPoolInfo extends PoolInfo {
    token0Metadata?: Token | null;
    token1Metadata?: Token | null;
}

const ListPools = () => {
    const [pools, setPools] = useState<EnhancedPoolInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const { publicKey } = useWallet();

    const fetchTokenMetadata = async (mintAddress: PublicKey): Promise<Token | null> => {
        try {
            const response = await fetch("/api/token-metadata", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ mintAddress: mintAddress.toString() }),
            });

            const data = await response.json();
            if (response.ok && data) {
                return data as Token;
            }
            return null;
        } catch (error) {
            console.error(`Error fetching metadata for mint ${mintAddress}:`, error);
            return null;
        }
    };

    const formatAddress = (address: string) => {
        return `${address.slice(0, 5)}...${address.slice(-5)}`;
    };

    const formatAmount = (amount: bigint, decimals: number) => {
        return (Number(amount) / Math.pow(10, decimals)).toFixed(4);
    };

    useEffect(() => {
        const fetchPools = async () => {
            if (!publicKey) return;
            setLoading(true);
            try {
                const result = await getAllPoolsWithUserRatio(publicKey);

                const enhancedPools = await Promise.all(
                    result.map(async (pool) => {
                        const [token0Metadata, token1Metadata] = await Promise.all([
                            fetchTokenMetadata(pool.token0Mint),
                            fetchTokenMetadata(pool.token1Mint),
                        ]);
                        return {
                            ...pool,
                            token0Metadata,
                            token1Metadata,
                        };
                    })
                );
                setPools(enhancedPools);
            } catch (err) {
                console.error("Error fetching pools:", err);
            } finally {
                setLoading(false);
            }
        };
        if (publicKey) {
            fetchPools();
        }
    }, [publicKey]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[200px]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-gray-500">Getting list of pools ...</p>
                </div>
            </div>
        );
    }

    if (pools.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[200px]">
                <div className="text-center">
                    <Lock className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-400">No pools found.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 md:p-6 p-3 py-6">
            {pools.map((pool, index) => (
                <Card
                    key={index}
                    className="shadow-lg rounded-2xl border hover:shadow-xl transition-shadow duration-300 gap-3"
                >
                    <CardHeader className="pb-0">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Coins className="h-5 w-5 text-blue-600" />
                            Liquidity Pool #{index + 1}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Pool Id:</span>
                            <Badge variant="outline" className="font-mono text-[14px]">
                                {formatAddress(pool.poolState.toBase58())}
                            </Badge>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 flex items-center gap-1">
                                <Lock className="h-4 w-4" />
                                Total Locked:
                            </span>
                            <span className="font-semibold text-green-600">
                                {formatAmount(pool.totalLocked, pool.lpMintDecimals)}
                            </span>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 flex items-center gap-1">
                                <Coins className="h-4 w-4" />
                                Your LP Ratio:
                            </span>
                            <span className="font-semibold text-purple-600">{pool.lpRatio.toFixed(4)}%</span>
                        </div>

                        <div className="">
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">Token Pair</h4>

                            <div className="bg-gray-50 rounded-lg p-3 mb-3 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    {pool.token0Metadata?.logoURI ? (
                                        <Image
                                            src={pool.token0Metadata.logoURI}
                                            alt={pool.token0Metadata.name}
                                            className="rounded-full"
                                            onError={(e) => {
                                                e.currentTarget.style.display = "none";
                                            }}
                                            width={32}
                                            height={32}
                                        />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                                            {pool.token0Metadata?.symbol?.charAt(0) || "T"}
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-semibold text-sm">{pool.token0Metadata?.name || "Unknown Token"}</p>
                                        <p className="text-xs text-gray-500">{pool.token0Metadata?.symbol || "UNKNOWN"}</p>
                                    </div>
                                </div>
                                <div className="text-[14px] text-gray-600 font-mono mt-1">
                                    {formatAddress(pool.token0Mint.toBase58())}
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-3 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    {pool.token1Metadata?.logoURI ? (
                                        <Image
                                            src={pool.token1Metadata.logoURI || "image/none-icon.webp"}
                                            alt={pool.token1Metadata.name}
                                            className="rounded-full"
                                            width={32}
                                            height={32}
                                            onError={(e) => {
                                                e.currentTarget.style.display = "none";
                                            }}
                                        />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-400 to-purple-600 flex items-center justify-center text-white text-[14px] font-bold">
                                            {pool.token1Metadata?.symbol?.charAt(0) || "T"}
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-semibold text-sm">{pool.token1Metadata?.name || "Unknown Token"}</p>
                                        <p className="text-xs text-gray-500">{pool.token1Metadata?.symbol || "UNKNOWN"}</p>
                                    </div>
                                </div>
                                <div className="text-[14px] text-gray-600 font-mono mt-1">
                                    {formatAddress(pool.token1Mint.toBase58())}
                                </div>
                            </div>
                        </div>

                        <div className="">
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">Vault Amounts</h4>
                            <div className="grid grid-cols-2 gap-2 text-[14px]">
                                <div className="bg-blue-50 p-2 rounded">
                                    <p className="text-gray-600">Vault 0:</p>
                                    <p className="font-semibold">
                                        {formatAmount(pool.vault0Amount, pool.token0Metadata?.decimals || 0)}
                                    </p>
                                </div>
                                <div className="bg-purple-50 p-2 rounded">
                                    <p className="text-gray-600">Vault 1:</p>
                                    <p className="font-semibold">
                                        {formatAmount(pool.vault1Amount, pool.token1Metadata?.decimals || 0)}
                                    </p>
                                </div>
                            </div>

                            <div className="pt-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <Link href={`/lock-lp?poolId=${pool.poolState.toBase58()}`}>
                                        <Button
                                            variant="outline"
                                            className="w-full flex items-center gap-2 hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Lock More
                                        </Button>
                                    </Link>

                                    <Link href={`/withdraw-lp?poolId=${pool.poolState.toBase58()}`}>
                                        <Button
                                            variant="default"
                                            className="w-full flex items-center gap-2 bg-green-600 hover:bg-green-700 transition-colors cursor-pointer"
                                        >
                                            <ArrowUpRight className="h-4 w-4" />
                                            Withdraw
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};

export default ListPools;