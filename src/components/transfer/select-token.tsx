"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TokenSearchModal from "./select-token-modal";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import Image from "next/image";
import { ChevronDown, Loader, Wallet } from "@nsmr/pixelart-react";

export interface UserToken {
  address: string;
  name: string;
  balance: string;
  symbol?: string;
  logoURI?: string;
  decimals?: number;
}

interface TokenInfo {
  balance: number;
  decimals: number;
  symbol?: string;
}

interface Content {
  metadata: { name?: string; symbol?: string };
  links?: { image?: string };
}

interface Asset {
  interface: "FungibleToken" | "FungibleAsset";
  id: string;
  content: Content;
  token_info: TokenInfo;
}

interface SelectTokenProps {
  selectedToken: UserToken | null;
  setSelectedToken: (token: UserToken | null) => void;
  onAmountChange: (amount: string) => void;
  title?: string;
  disabled?: boolean;
  externalAmount?: string;
  amountLoading?: boolean;
}

const SelectToken: React.FC<SelectTokenProps> = ({
  selectedToken,
  setSelectedToken,
  onAmountChange,
  title,
  disabled,
  externalAmount,
  amountLoading = false,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tokens, setTokens] = useState<UserToken[]>([]);
  const [amount, setAmount] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const { publicKey } = useWallet();

  useEffect(() => {
    if (disabled && externalAmount !== undefined) {
      setAmount(externalAmount);
    }
  }, [disabled, externalAmount]);

  const handleTokenSelect = (token: UserToken) => {
    setSelectedToken(token);
    setIsModalOpen(false);
  };

  const fetchAllTokens = useCallback(async () => {
    if (!publicKey) {
      setTokens([]);
      setSelectedToken(null);
      setAmount("");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/user-tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ publicKey: publicKey.toString() }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();
      const assets = data.result?.items || [];
      const nativeBalance = data.result?.nativeBalance?.lamports || 0;

      const formattedTokens: UserToken[] = assets
        .filter((asset: Asset) => asset.interface === "FungibleToken" || asset.interface === "FungibleAsset")
        .map((asset: Asset) => {
          const mint = asset.id;
          const balance = (asset.token_info?.balance || 0) / Math.pow(10, asset.token_info?.decimals || 0);
          return {
            address: mint,
            name: asset.content?.metadata?.name || "Unknown Token",
            balance: balance.toString(),
            symbol: asset.token_info?.symbol || asset.content?.metadata?.symbol,
            logoURI: asset.content?.links?.image,
            decimals: asset.token_info?.decimals || 0,
          };
        });

      const solToken: UserToken = {
        address: "NativeSOL",
        name: "Solana",
        symbol: "SOL",
        balance: (nativeBalance / 1_000_000_000).toString(),
        logoURI:
          "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
        decimals: 9,
      };

      const allTokens = [solToken, ...formattedTokens];
      setTokens(allTokens);

      if (allTokens.length > 0 && !selectedToken) {
        setSelectedToken(allTokens[0]);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error fetching tokens:", error);
        toast.error(error.message);
      } else {
        console.error("Unknown error fetching tokens:", error);
        toast.error("Failed to fetch tokens. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [publicKey, setSelectedToken, selectedToken]);

  const setHalf = () => {
    if (selectedToken) {
      const halfBalance = (
        parseFloat(selectedToken.balance) / 2
      ).toFixed(selectedToken.decimals || 2);
      setAmount(halfBalance);
      onAmountChange(halfBalance);
    }
  };

  const setMax = () => {
    if (selectedToken) {
      setAmount(selectedToken.balance);
      onAmountChange(selectedToken.balance);
    }
  };

  const handleAmountChange = (value: string) => {
    if (disabled) return;

    if (value === "") {
      setAmount("");
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
    setAmount(value);
    onAmountChange(value);
  };

  useEffect(() => {
    fetchAllTokens();
  }, [publicKey, fetchAllTokens]);

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
              disabled={!selectedToken || loading || disabled}
            >
              HALF
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-gear-gray h-[26px] bg-white text-gray-700 hover:bg-white hover:text-purple-900 cursor-pointer"
              onClick={setMax}
              disabled={!selectedToken || loading || disabled}
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
          className={`flex items-center gap-2 text-gray-700 hover:text-purple-900 border-gear-gray px-2 py-1 ml-2 ${!selectedToken || loading ? "cursor-not-allowed" : "cursor-pointer"
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
                {title === "You Pay" ? `${selectedToken.symbol} Devnet` : selectedToken.symbol}
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
              disabled={disabled || loading}
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
