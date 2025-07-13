"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { ExternalLink } from "lucide-react";

export interface TokenInfo {
  id: string;
  name: string;
  symbol: string;
  icon: string;
  decimals: number;
  usdPrice: number;
  mcap: number;
  liquidity: number;
  isVerified: boolean;
}

interface TokenSearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelect?: (token: TokenInfo) => void;
}

export default function TokenSearchModal({
  open,
  onClose,
  onSelect,
}: TokenSearchModalProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<TokenInfo[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const handler = setTimeout(() => {
      setLoading(true);
      fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${query}`)
        .then((res) => {
          return res.json();
        })
        .then((data: Partial<TokenInfo>[]) => {
          if (!Array.isArray(data)) {
            setResults([]);
            return;
          }

          const tokens: TokenInfo[] = data.map((item) => ({
            id: item.id ?? "",
            name: item.name ?? "",
            symbol: item.symbol ?? "",
            icon: item.icon ?? "",
            decimals: item.decimals ?? 0,
            usdPrice: item.usdPrice ?? 0,
            mcap: item.mcap ?? 0,
            liquidity: item.liquidity ?? 0,
            isVerified: item.isVerified ?? false,
          }));

          setResults(tokens);
        })
        .catch(() => {
          setResults([]);
        })
        .finally(() => setLoading(false));
    }, 400);

    return () => clearTimeout(handler);
  }, [query]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Search Token</DialogTitle>
        </DialogHeader>

        <Input
          placeholder="Enter token name, symbol or address..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-10"
        />

        <div className="max-h-80 overflow-y-auto mt-2 space-y-2">
          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : results.length === 0 && query.length >= 2 ? (
            <p className="text-sm text-gray-500">No tokens found.</p>
          ) : (
            results.map((token) => {
              const iconSrc =
                token.icon && token.icon.trim().length > 0
                  ? token.icon
                  : "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png";

              return (
                <button
                  key={token.id}
                  onClick={() => {
                    onSelect?.(token);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between border rounded-lg px-3 py-2 hover:bg-gray-100 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white border border-gray-200 overflow-hidden">
                      <Image
                        src={iconSrc}
                        alt={token.symbol}
                        width={32}
                        height={32}
                        className="object-cover w-8 h-8"
                      />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">{token.name}</div>
                      <div className="text-xs text-gray-500">
                        {token.symbol}
                      </div>
                    </div>
                  </div>

                  <a
                    href={`https://solscan.io/token/${token.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-500 hover:underline text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </button>
              );
            })
          )}
        </div>

        <div className="pt-2 text-right">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
