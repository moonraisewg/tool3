"use client";

import { Button } from "@/components/ui/button";
import { Tag, Gem } from "lucide-react";
import WalletConnectButton from "./custom-wallet-button";

export default function Header() {
  return (
    <header className="border-b border-gray-800">
      {/* Top Banner */}
      <div className="bg-purple-600 flex items-center justify-center py-2">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-black">📦</span>
            <span>Share your affiliate link and enjoy 30% commission!</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="container mx-auto px-4 flex justify-between items-center h-16">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="bg-yellow-500 text-black border-yellow-400 hover:bg-yellow-600"
          >
            100% on FLIP
          </Button>
          <Button variant="outline" className="border-gray-700">
            <Tag className="mr-2 h-4 w-4" />
            <span>Tags</span>
          </Button>
          <Button variant="outline" className="border-gray-700">
            <Gem className="mr-2 h-4 w-4" />
            <span>Gems</span>
          </Button>
          <WalletConnectButton />
        </div>
      </div>
    </header>
  );
}
