"use client";

import { useNetwork } from "@/context/NetworkContext";
import WalletConnectButton from "./custom-wallet-button";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import { Check, ChevronDown } from "@nsmr/pixelart-react";
import { useRouter, usePathname } from "next/navigation";

export default function Header() {
  const { network, setNetwork } = useNetwork();
  const router = useRouter();
  const pathname = usePathname();

  const handleNetworkChange = (selectedNetwork: WalletAdapterNetwork) => {
    setNetwork(selectedNetwork);
    const newUrl = selectedNetwork === WalletAdapterNetwork.Devnet
      ? "/transfer?cluster=devnet"
      : pathname.replace(/\?cluster=devnet/, "");
    router.push(newUrl);
  };

  return (
    <header className="w-full py-4">
      <div className="container mx-auto md:px-4 flex justify-end items-center space-x-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="flex items-center gap-2 border-gear-white rounded-none border-none bg-white hover:bg-gray-50 !px-2 !py-0 !h-[28px] cursor-pointer"
            >
              <Globe className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">
                {network === WalletAdapterNetwork.Mainnet ? "Mainnet" : "Devnet"}
              </span>
              <ChevronDown className="h-4 w-4 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[160px]">
            <DropdownMenuItem
              className="flex items-center justify-between cursor-pointer"
              onClick={() => handleNetworkChange(WalletAdapterNetwork.Mainnet)}
            >
              <span>Mainnet</span>
              {network === WalletAdapterNetwork.Mainnet && <Check className="h-4 w-4 text-green-600" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex items-center justify-between cursor-pointer"
              onClick={() => handleNetworkChange(WalletAdapterNetwork.Devnet)}
            >
              <span>Devnet</span>
              {network === WalletAdapterNetwork.Devnet && <Check className="h-4 w-4 text-green-600" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <WalletConnectButton />
      </div>
    </header>
  );
}