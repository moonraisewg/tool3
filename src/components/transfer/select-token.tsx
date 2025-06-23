"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TokenSearchModal from "./select-token-modal";
import { toast } from "sonner";
import Image from "next/image";
import { ChevronDown, Loader, Wallet } from "@nsmr/pixelart-react";
import { useUserTokens, UserToken } from "@/hooks/useUserTokens";

interface SelectTokenProps {
  selectedToken: UserToken | null;
  setSelectedToken: (token: UserToken | null) => void;
  onAmountChange: (amount: string) => void;
  title?: string;
  disabled?: boolean;
  amount: string;
  amountLoading?: boolean;
  excludeToken?: string;
  cluster?: string;
  onTokensLoaded?: (tokens: UserToken[]) => void;
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
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { tokens, loading } = useUserTokens(cluster, excludeToken);
  const [userHasSelected, setUserHasSelected] = useState(false);

  useEffect(() => {
    if (tokens.length > 0 && !selectedToken && !userHasSelected) {
      const solToken = tokens.find(token => 
        token.symbol === "SOL" || 
        token.address === "11111111111111111111111111111111" || 
        token.address === "NativeSOL"
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
  }, [tokens, selectedToken, setSelectedToken, onTokensLoaded, userHasSelected]);

  const handleTokenSelect = (token: UserToken) => {
    setSelectedToken(token);
    setUserHasSelected(true);
    setIsModalOpen(false);
    onAmountChange("");
  };

  const setHalf = () => {
    if (selectedToken) {
      const halfBalance = (
        parseFloat(selectedToken.balance) / 2
      ).toFixed(selectedToken.decimals || 2);
      onAmountChange(halfBalance);
    }
  };

  const setMax = () => {
    if (selectedToken) {
      onAmountChange(selectedToken.balance);
    }
  };

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
          className={`flex items-center gap-2 text-gray-700 hover:text-purple-900 border-gear-gray px-2 py-1 ml-2 ${!selectedToken || loading
            ? "cursor-not-allowed"
            : "cursor-pointer"
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
                className="rounded-full object-cover"
              />
              <div className="mt-[2px]">
                {title === "You Pay"
                  ? `${selectedToken.symbol} Mainnet`
                  : selectedToken.symbol}
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