"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { Wallet, Loader } from "lucide-react";
import { useUserTokens, type UserToken } from "@/hooks/useUserTokens";

interface SelectedTokenData {
  token: UserToken;
  estimatedSol: string;
}

interface MultiTokenSelectorProps {
  selectedTokens: SelectedTokenData[];
  onTokensChange: (tokens: SelectedTokenData[]) => void;
  excludeToken?: string;
  cluster?: string;
  disabled?: boolean;
}

function MultiTokenSelector({
  selectedTokens,
  onTokensChange,
  excludeToken,
  cluster = "mainnet",
  disabled = false,
}: MultiTokenSelectorProps) {
  const { tokens, loading } = useUserTokens(cluster, excludeToken);
  const [searchTerm, setSearchTerm] = useState("");
  const [, setPriceLoading] = useState<Record<string, boolean>>({});

  const filteredTokens = tokens.filter(
    (token) =>
      token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      token.symbol?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isTokenSelected = (tokenAddress: string) => {
    return selectedTokens.some(
      (selected) => selected.token.address === tokenAddress
    );
  };

  const fetchSwapQuote = async (token: UserToken, amount: string) => {
    if (!amount || Number(amount) === 0) return "0";

    try {
      setPriceLoading((prev) => ({ ...prev, [token.address]: true }));

      const amountValue = Number.parseFloat(amount);
      if (isNaN(amountValue) || amountValue <= 0) return "0";

      const inputAmountInLamports = Math.round(
        amountValue * Math.pow(10, token.decimals || 0)
      );

      const response = await fetch(
        `https://lite-api.jup.ag/swap/v1/quote?inputMint=${token.address}&outputMint=So11111111111111111111111111111111111111112&amount=${inputAmountInLamports}&slippageBps=100&swapMode=ExactIn`
      );

      if (!response.ok) throw new Error("Failed to fetch quote");

      const quote = await response.json();
      const solAmount = Number.parseFloat(quote.outAmount) / Math.pow(10, 9);
      return solAmount.toFixed(6);
    } catch (error) {
      console.error("Failed to fetch swap quote:", error);
      return "0";
    } finally {
      setPriceLoading((prev) => ({ ...prev, [token.address]: false }));
    }
  };

  const handleTokenToggle = async (token: UserToken, checked: boolean) => {
    if (disabled) return;

    if (checked) {
      const estimatedSol = await fetchSwapQuote(token, token.balance);

      const newTokenData: SelectedTokenData = {
        token,
        estimatedSol,
      };

      onTokensChange([...selectedTokens, newTokenData]);
    } else {
      onTokensChange(
        selectedTokens.filter(
          (selected) => selected.token.address !== token.address
        )
      );
    }
  };

  const getTotalEstimatedSol = () => {
    return selectedTokens
      .reduce(
        (total, selected) =>
          total + Number.parseFloat(selected.estimatedSol || "0"),
        0
      )
      .toFixed(6);
  };

  useEffect(() => {
    if (!disabled && tokens.length > 0 && selectedTokens.length === 0) {
      const autoSelectAll = async () => {
        const updated = await Promise.all(
          tokens.map(async (token) => {
            const estimatedSol = await fetchSwapQuote(token, token.balance);
            return { token, estimatedSol };
          })
        );
        onTokensChange(updated);
      };
      autoSelectAll();
    }
  }, [tokens, disabled, selectedTokens.length, onTokensChange]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader className="h-6 w-6 animate-spin mr-2" />
            <span>Loading tokens...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Select Tokens to Swap</h3>
            <div className="text-sm text-gray-600">
              {selectedTokens.length} token
              {selectedTokens.length !== 1 ? "s" : ""} selected
            </div>
          </div>

          {selectedTokens.length > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-800">
                  Total Estimated SOL:
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-blue-900">
                    {getTotalEstimatedSol()}
                  </span>
                  <Image
                    src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
                    alt="SOL"
                    width={24}
                    height={24}
                    className="rounded-full"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="relative">
            <Input
              type="text"
              placeholder="Search tokens..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>

          <ScrollArea className="h-[310px] w-full">
            <div className="space-y-2">
              {filteredTokens.map((token) => {
                const isSelected = isTokenSelected(token.address);

                return (
                  <div
                    key={token.address}
                    className={`border rounded-lg p-3 transition-colors ${
                      isSelected
                        ? "bg-blue-50 border-blue-200"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          handleTokenToggle(token, checked as boolean)
                        }
                        disabled={disabled}
                      />

                      <Image
                        src={token.logoURI || "/image/none-icon.webp"}
                        alt={token.name}
                        width={32}
                        height={32}
                        className="rounded-full object-cover"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900 truncate">
                              {token.symbol || token.name}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                              {token.name}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center text-sm text-gray-600">
                              <Wallet className="h-4 w-4 mr-1" />
                              {Number.parseFloat(token.balance).toFixed(4)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {filteredTokens.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No tokens found matching your search.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default MultiTokenSelector;
