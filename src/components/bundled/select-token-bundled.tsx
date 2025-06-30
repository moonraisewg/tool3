"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { ChevronDown } from "@nsmr/pixelart-react";
import { Token } from "@/types/types";
import { useAllTokens } from "@/hooks/useAllToken";
import SelectTokenBundledModal from "./select-token-bundled-modal";

interface SelectTokenBundledProps {
  selectedToken: Token | null;
  setSelectedToken: (token: Token | null) => void;
}

const SelectTokenBundled: React.FC<SelectTokenBundledProps> = ({
  selectedToken,
  setSelectedToken,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { tokens, loading } = useAllTokens();
  const [userHasSelected, setUserHasSelected] = useState(false);

  useEffect(() => {
    if (tokens.length > 0 && !selectedToken && !userHasSelected) {
      setSelectedToken(tokens[0]);
    }

  }, [
    tokens,
    selectedToken,
    setSelectedToken,
    userHasSelected,
  ]);

  const handleTokenSelect = (token: Token) => {
    setSelectedToken(token);
    setUserHasSelected(true);
    setIsModalOpen(false);
  };


  return (
    <div className="">
      <div className="text-xl font-semibold mb-2">Select Token</div>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className={`flex items-center text-gray-700 hover:text-purple-900 border-gear-gray px-2 py-1 w-full h-[44px] justify-between mt-1 ${!selectedToken || loading ? "cursor-not-allowed" : "cursor-pointer"
          }`}
        disabled={!selectedToken || loading}
      >
        {selectedToken ? (
          <div className="flex items-center gap-4">
            <Image
              src={selectedToken?.logoURI || "/image/none-icon.webp"}
              alt={selectedToken?.name || "Token"}
              width={36}
              height={36}
              className="rounded-full object-cover"
            />
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-medium text-gray-900">{selectedToken.symbol || "UNKNOWN"}</span>
              </div>
              <div className="text-sm text-gray-600">{selectedToken.name || "Unknown Token"}</div>

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

      <SelectTokenBundledModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onTokenSelect={handleTokenSelect}
        tokens={tokens}
      />
    </div>
  );
};

export default SelectTokenBundled;
