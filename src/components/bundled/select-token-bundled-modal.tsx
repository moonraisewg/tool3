"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import Image from "next/image";
import { Token } from "@/types/types";

interface TokenSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTokenSelect?: (token: Token) => void;
  tokens: Token[];
}

const sanitizeImageSrc = (src: string | undefined): string => {
  if (!src || typeof src !== "string") return "/image/none-icon.webp";
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  return "/image/none-icon.webp";
};

const TokenImage = ({ src, alt }: { src: string; alt: string }) => {
  const [imgSrc, setImgSrc] = useState(sanitizeImageSrc(src));

  return (
    <Image
      src={imgSrc}
      alt={alt}
      width={40}
      height={40}
      className="!w-10 !h-10 rounded-full object-cover"
      onError={() => setImgSrc("/image/none-icon.webp")}
    />
  );
};

export default function SelectTokenBundledModal({
  open,
  onOpenChange,
  onTokenSelect,
  tokens = [],
}: TokenSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTokens = tokens.filter(
    (token) =>
      token?.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTokenSelect = (token: Token) => {
    onTokenSelect?.(token);
    onOpenChange(false);
  };

  const shortenAddress = (address: string) => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 5)}...${address.slice(-5)} `;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-gray-200 text-gray-900 sm:max-w-[500px] shadow-lg !p-0">
        <DialogHeader className="space-y-4">
          <DialogTitle className="hidden">Select a token</DialogTitle>
          <div className="flex items-center space-x-2 bg-gray-100 rounded-lg px-3 py-2">
            <Search className="h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search token..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 bg-transparent text-gray-900 placeholder:text-gray-400 focus-visible:ring-0"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-gray-500 bg-[#e3e3e3] hover:bg-[#ccc] hover:text-gray-700 cursor-pointer px-2"
            >
              Esc
            </Button>
          </div>
        </DialogHeader>

        <div className="h-[500px] overflow-y-auto space-y-1 custom-scroll">
          {filteredTokens?.map((token) => (
            <div
              key={token.address}
              onClick={() => handleTokenSelect(token)}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors border-b border-gray-200 last:border-b-0"
            >
              <div className="flex items-center space-x-3 justify-between w-full">
                <div className="flex items-center space-x-3">
                  <div className="rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                    {token.logoURI ? (
                      <TokenImage src={token.logoURI} alt={token.name} />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center text-white text-[16px] font-bold pt-[1px]">
                        <div className="ml-[3px] mt-[3px]">{token.name?.charAt(0) || "T"}</div>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">{token.symbol || "UNKNOWN"}</span>
                    </div>
                    <div className="text-sm text-gray-600">{token.name || "Unknown Token"}</div>

                  </div>
                </div>
                <div className="text-sm text-gray-400">{shortenAddress(token.address)}</div>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
