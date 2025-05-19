"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog";
import { Wallet, Loader2 } from "lucide-react";
import Image from "next/image";
import { WalletName } from "@solana/wallet-adapter-base";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

// Rút gọn địa chỉ ví
export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export default function WalletConnectButton() {
  const { publicKey, select, wallets, disconnect, connecting, connected } =
    useWallet();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const displayAddress = publicKey ? shortenAddress(publicKey.toBase58()) : "";

  const handleWalletSelect = async (walletName: string) => {
    try {
      await select(walletName as WalletName);
      setDialogOpen(false);
    } catch (error) {
      console.error("Lỗi khi chọn ví:", error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setDropdownOpen(false);
    } catch (error) {
      console.error("Lỗi khi ngắt kết nối ví:", error);
    }
  };

  return (
    <div className="wallet-button text-white">
      {!connected ? (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              disabled={connecting}
              variant="default"
              className="flex items-center gap-2"
            >
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Wallet className="h-4 w-4" />
                  Connect
                </>
              )}
            </Button>
          </DialogTrigger>

          <DialogContent className="bg-black text-white max-w-[400px]">
            <DialogTitle asChild>
              <VisuallyHidden>Select</VisuallyHidden>
            </DialogTitle>
            <div className="flex flex-col space-y-4">
              {wallets.map((wallet) => (
                <Button
                  key={wallet.adapter.name}
                  onClick={() => handleWalletSelect(wallet.adapter.name)}
                  variant="ghost"
                  className="flex items-center justify-start gap-3 text-white hover:bg-white/10"
                >
                  <Image
                    src={wallet.adapter.icon}
                    alt={wallet.adapter.name}
                    width={24}
                    height={24}
                  />
                  <span>{wallet.adapter.name}</span>
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="default" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              {displayAddress}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={handleDisconnect}
              className="text-red-600 cursor-pointer"
            >
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
