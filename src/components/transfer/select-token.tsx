"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TokenSearchModal from "./select-token-modal";
import { toast } from "sonner";
import Image from "next/image";
import { ChevronDown, Loader, Wallet } from "@nsmr/pixelart-react";
import { useUserTokens, UserToken } from "@/hooks/useUserTokens";
import { ClusterType } from "@/types/types";
import { NATIVE_SOL } from "@/utils/constants";

interface SelectTokenProps {
  selectedToken: UserToken | null;
  setSelectedToken: (token: UserToken | null) => void;
  onAmountChange: (amount: string) => void;
  title?: string;
  disabled?: boolean;
  amount: string;
  amountLoading?: boolean;
  excludeToken?: string[];
  cluster?: ClusterType;
  onTokensLoaded?: (tokens: UserToken[]) => void;
  tokenFee?: number;
}

const SelectToken: React.FC<SelectTokenProps> = ({
  selectedToken,
  setSelectedToken,
  onAmountChange,
  title,
  disabled,
  amount,
  amountLoading = false,
  excludeToken,
  cluster = "mainnet",
  onTokensLoaded,
  tokenFee = 0,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { tokens, loading } = useUserTokens(cluster, excludeToken);
  const [userHasSelected, setUserHasSelected] = useState(false);

  useEffect(() => {
    if (tokens.length > 0 && !selectedToken && !userHasSelected) {
      const solToken = tokens.find(
        (token) =>
          token.symbol === "SOL" ||
          token.address === "11111111111111111111111111111111" ||
          token.address === NATIVE_SOL
      );

      if (solToken) {
        setSelectedToken(solToken);
      } else {
        setSelectedToken(tokens[0]);
      }
    }

    if (tokens.length > 0 && onTokensLoaded) {
      onTokensLoaded(tokens);
    }
  }, [
    tokens,
    selectedToken,
    setSelectedToken,
    onTokensLoaded,
    userHasSelected,
  ]);

  const handleTokenSelect = (token: UserToken) => {
    setSelectedToken(token);
    setUserHasSelected(true);
    setIsModalOpen(false);
    onAmountChange("");
  };

  const setAmount = (type: "half" | "max") => {
    if (!selectedToken) return;

    const balance = parseFloat(selectedToken.balance);
    const decimals = selectedToken.decimals || 6;
    const symbol = selectedToken.symbol;

    if (balance < tokenFee) {
      toast.error(
        `Insufficient balance to cover fee. Need ${tokenFee.toFixed(
          6
        )} ${symbol}, but only have ${balance.toFixed(6)} ${symbol}`
      );
      onAmountChange("0");
      return;
    }

    const availableAmount = Math.max(0, balance - tokenFee);
    const amount = type === "half" ? availableAmount / 2 : availableAmount;
    const amountString = amount.toFixed(decimals);

    toast.success(
      `You can proceed with up to ${amountString} ${symbol} after deducting fee`
    );

    onAmountChange(amountString);
  };

  const setHalf = () => setAmount("half");
  const setMax = () => setAmount("max");

  const handleAmountChange = (value: string) => {
    if (disabled) return;

    if (value === "") {
      onAmountChange("");
      return;
    }
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) {
      toast.error("Please enter a valid positive number");
      return;
    }
    if (selectedToken && numValue > parseFloat(selectedToken.balance)) {
      toast.error(
        `Amount exceeds available balance of ${selectedToken.balance} ${selectedToken.symbol}`
      );
      return;
    }
    onAmountChange(value);
  };

  return (
    <div className="bg-white border-gear-gray p-3 flex flex-col min-h-[120px] justify-between pt-[18px]">
      <div className="flex items-center justify-between mb-2">
        <div className="ml-[4px]">{title || "Select Token"}</div>
        <div className="flex items-center sm:gap-4 gap-2 mr-1">
          <div className="flex items-center gap-1">
            <Wallet className="h-4 w-4 text-purple-400" />
            <div className="mt-[2px]">
              {selectedToken
                ? `${selectedToken.balance} ${selectedToken.symbol}`
                : "0.00"}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-gear-gray h-[26px] bg-white text-gray-700 hover:bg-white hover:text-purple-900 cursor-pointer"
              onClick={setHalf}
              disabled={!selectedToken || disabled}
            >
              HALF
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-gear-gray h-[26px] bg-white text-gray-700 hover:bg-white hover:text-purple-900 cursor-pointer"
              onClick={setMax}
              disabled={!selectedToken || disabled}
            >
              MAX
            </Button>
          </div>
        </div>
      </div>
      <div className="flex justify-between items-center mb-2 mt-4 h-[40px]">
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className={`flex items-center gap-2 text-gray-700 hover:text-purple-900 border-gear-gray px-2 py-1 ml-2 ${
            !selectedToken || loading ? "cursor-not-allowed" : "cursor-pointer"
          }`}
          disabled={!selectedToken || loading}
        >
          {selectedToken ? (
            <div className="flex items-center gap-2">
              <Image
                src={selectedToken?.logoURI || "/image/none-icon.webp"}
                alt={selectedToken?.name || "Token"}
                width={24}
                height={24}
                className="rounded-full object-cover !h-6 !w-6"
              />
              <div className="mt-[2px]">
                {title === "You Pay"
                  ? `${selectedToken.symbol} Mainnet`
                  : selectedToken.symbol}
                {selectedToken.isToken2022 && (
                  <span className="ml-1 text-xs text-purple-600 font-semibold">
                    2022
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gray-200" />
              <div>Loading ...</div>
            </div>
          )}
          <ChevronDown size={24} />
        </button>
        <div className="sm:w-[270px] w-[190px] h-[40px] flex items-center justify-end">
          {amountLoading ? (
            <Loader className="h-6 w-6 animate-spin text-gray-500 mb-1" />
          ) : (
            <Input
              type="number"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                  e.preventDefault();
                }
              }}
              className="focus-visible:ring-0 focus-visible:border-none focus-visible:outline-none outline-none ring-0 border-none shadow-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-right md:!text-[32px] !text-[24px] pr-0"
              placeholder="0.00"
              disabled={disabled}
            />
          )}
        </div>
      </div>
      <TokenSearchModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onTokenSelect={handleTokenSelect}
        tokens={tokens}
      />
    </div>
  );
};

export default SelectToken;
