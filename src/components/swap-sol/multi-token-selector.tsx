"use client";

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import Image from "next/image";
import { Wallet } from "lucide-react";
import { useUserTokens, type UserToken } from "@/hooks/useUserTokens";
import { ClusterType } from "@/types/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SelectedTokenData {
  token: UserToken;
  estimatedSol: string;
}

interface MultiTokenSelectorProps {
  selectedTokens: SelectedTokenData[];
  onTokensChange: (tokens: SelectedTokenData[]) => void;
  excludeToken?: string[];
  cluster?: ClusterType;
  disabled?: boolean;
}

function MultiTokenSelector({
  selectedTokens,
  onTokensChange,
  excludeToken,
  cluster = "mainnet",
  disabled = false,
}: MultiTokenSelectorProps) {
  const { tokens } = useUserTokens(cluster, excludeToken);
  const [searchTerm, setSearchTerm] = useState("");
  const [, setPriceLoading] = useState<Record<string, boolean>>({});
  const [didAutoSelect, setDidAutoSelect] = useState(false);
  const [canSwapMap, setCanSwapMap] = useState<Record<string, boolean>>({});

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

  const fetchSwapQuote = useCallback(
    async (token: UserToken, amount: string) => {
      if (!amount || Number(amount) === 0) {
        setCanSwapMap((prev) => ({ ...prev, [token.address]: false }));
        return "0";
      }

      try {
        setPriceLoading((prev) => ({ ...prev, [token.address]: true }));

        const inputAmountInLamports = Math.round(
          Number(amount) * Math.pow(10, token.decimals || 0)
        );

        const response = await fetch(
          `https://lite-api.jup.ag/swap/v1/quote?inputMint=${token.address}&outputMint=So11111111111111111111111111111111111111112&amount=${inputAmountInLamports}&slippageBps=100&swapMode=ExactIn`
        );

        if (!response.ok) {
          setCanSwapMap((prev) => ({ ...prev, [token.address]: false }));
          return "0";
        }

        const quote = await response.json();
        const solAmount = Number.parseFloat(quote.outAmount) / Math.pow(10, 9);

        const canSwap = solAmount > 0;
        setCanSwapMap((prev) => ({ ...prev, [token.address]: canSwap }));

        return solAmount.toFixed(6);
      } catch (error) {
        console.error("Failed to fetch swap quote:", error);
        setCanSwapMap((prev) => ({ ...prev, [token.address]: false }));
        return "0";
      } finally {
        setPriceLoading((prev) => ({ ...prev, [token.address]: false }));
      }
    },
    []
  );

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
    if (!disabled && tokens.length > 0 && !didAutoSelect) {
      const autoSelectAll = async () => {
        const updated = await Promise.all(
          tokens.map(async (token) => {
            const estimatedSol = await fetchSwapQuote(token, token.balance);
            if (Number(estimatedSol) === 0) return null;
            return { token, estimatedSol };
          })
        );
        onTokensChange(updated.filter(Boolean) as SelectedTokenData[]);
        setDidAutoSelect(true);
      };
      autoSelectAll();
    }
  }, [tokens, disabled, didAutoSelect, onTokensChange, fetchSwapQuote]);

  return (
    <div className="">
      <div className="space-y-4 flex flex-col items-center">
        <div className="flex items-center justify-between w-full">
          <h3 className="text-base font-semibold">Select Tokens to Swap</h3>
          <div className="text-sm text-gray-600">
            {selectedTokens.length} token
            {selectedTokens.length !== 1 ? "s" : ""} selected
          </div>
        </div>

        {selectedTokens.length > 0 && (
          <div className="px-3 py-2 bg-blue-50 border-gear-blue w-[calc(100%-10px)]">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-800">
                Total Estimated SOL:
              </span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-blue-900 mt-[2px]">
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

        <Input
          type="text"
          placeholder="Search tokens..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-[calc(100%-10px)] border-gear-gray !h-[30px]"
        />

        <ScrollArea className="h-[250px] w-full">
          <div className="space-y-4 pb-2 p-[6px]">
            {filteredTokens.map((token) => {
              const isSelected = isTokenSelected(token.address);
              const canSwap = canSwapMap[token.address] !== false;
              return (
                <div
                  key={token.address}
                  className={`border rounded-lg transition-colors px-1 py-1 ${isSelected
                    ? "bg-blue-50 border-gear-blue"
                    : "bg-white border-gear-gray"
                    }`}
                >
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) =>
                        handleTokenToggle(token, checked as boolean)
                      }
                      disabled={disabled || !canSwap}
                    />

                    <Image
                      src={token.logoURI || "/image/none-icon.webp"}
                      alt={token.name}
                      width={32}
                      height={32}
                      className="rounded-full object-cover !h-[32px] !w-[32px]"
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
                          {!canSwap && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="text-xs text-red-500 mt-1 cursor-help">
                                    🚫 Not swappable
                                  </p>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                  Jupiter doesn’t support swapping this token to
                                  SOL.
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
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
    </div>
  );
}

export default MultiTokenSelector;
