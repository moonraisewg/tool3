"use client"

import { useWallet } from "@solana/wallet-adapter-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogHeader } from "@/components/ui/dialog"
import { Loader2, Wallet, ChevronRight } from "lucide-react"
import Image from "next/image"
import type { WalletName } from "@solana/wallet-adapter-base"

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

export default function WalletConnectButton() {
  const { publicKey, select, wallets, disconnect, connecting, connected } = useWallet()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null)

  const displayAddress = publicKey ? shortenAddress(publicKey.toBase58()) : ""

  const handleWalletSelect = async (walletName: string) => {
    try {
      setSelectedWallet(walletName)
      select(walletName as WalletName)
      setDialogOpen(false)
      setSelectedWallet(null)
    } catch (error) {
      console.error("Error when selecting wallet:", error)
      setSelectedWallet(null)
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnect()
      setDropdownOpen(false)
    } catch (error) {
      console.error("Error when disconnecting wallet:", error)
    }
  }

  return (
    <div className="wallet-button">
      {!connected ? (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              disabled={connecting}
              variant="default"
              className="flex items-center gap-2 !cursor-pointer"
            >
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Wallet className="h-4 w-4" />
                  Connect Wallet
                </>
              )}
            </Button>
          </DialogTrigger>

          <DialogContent className="bg-white text-slate-900 max-w-[480px] border-slate-200 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-center text-xl font-semibold text-slate-900">
                Connect Your Wallet
              </DialogTitle>
              <p className="text-center text-slate-600 text-sm mt-2">
                Choose your preferred wallet to connect to the application
              </p>
            </DialogHeader>

            <div className="grid gap-4 mt-6">
              {wallets.map((wallet) => (
                <div
                  key={wallet.adapter.name}
                  className=" relative bg-gradient-to-r cursor-pointer border-gear-gray"
                >
                  <Button
                    onClick={() => handleWalletSelect(wallet.adapter.name)}
                    variant="ghost"
                    disabled={selectedWallet === wallet.adapter.name}
                    className="w-full h-auto p-4 flex items-center justify-between text-slate-900 cursor-pointer py-3"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                          <Image
                            src={wallet.adapter.icon || "/placeholder.svg"}
                            alt={wallet.adapter.name}
                            width={24}
                            height={24}
                            className="rounded-full"
                          />
                        </div>
                        {selectedWallet === wallet.adapter.name && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                            <Loader2 className="w-2 h-2 animate-spin text-white" />
                          </div>
                        )}
                      </div>

                      <div className="text-left">
                        <div className="font-medium text-base">{wallet.adapter.name}</div>
                        <div className="text-xs text-slate-500">
                          {wallet.readyState === "Installed" ? "Installed" : "Not Installed"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {wallet.readyState === "Installed" && <div className="w-2 h-2 bg-green-400 rounded-full"></div>}
                      <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-purple-600 transition-colors duration-200" />
                    </div>
                  </Button>

                </div>
              ))}
            </div>

            <div className="mt-6 p-4 -lg bg-slate-100 border-gear-2 ">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                </div>
                <span>New to Solana wallets? We recommend starting with Phantom or Solflare.</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="default" className="flex items-center gap-2 !cursor-pointer border-gear-black border-none rounded-none h-[28px] hover:bg-[#171717]">
              <Wallet className="h-4 w-4" />
              {displayAddress}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white border-slate-200">
            <DropdownMenuItem
              onClick={handleDisconnect}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer transition-colors duration-200"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                Disconnect
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
