"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Copy, Trash2 } from "lucide-react"
import { WalletAddress } from "./bundled-form"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Keypair } from "@solana/web3.js"
import { mnemonicToSeedSync, validateMnemonic } from "bip39"
import { derivePath } from "ed25519-hd-key"
import bs58 from "bs58"

interface WalletListProps {
  walletAddresses: WalletAddress[]
  setWalletAddresses: React.Dispatch<React.SetStateAction<WalletAddress[]>>
  handleCheckBalance: () => Promise<void>
  shortenAddress: (address: string) => string
}

export default function WalletList({
  walletAddresses,
  setWalletAddresses,
  handleCheckBalance,
  shortenAddress,
}: WalletListProps) {
  const [privateKeysInput, setPrivateKeysInput] = useState("")
  const [mnemonicInput, setMnemonicInput] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)

  const toggleWalletSelection = (id: string) => {
    setWalletAddresses((prev) =>
      prev.map((wallet) => (wallet.id === id ? { ...wallet, selected: !wallet.selected } : wallet)),
    )
  }

  const deleteSelectedWallets = () => {
    setWalletAddresses((prev) => prev.filter((wallet) => !wallet.selected))
  }

  const invertSelection = () => {
    setWalletAddresses((prev) => prev.map((wallet) => ({ ...wallet, selected: !wallet.selected })))
  }

  const handleImportWallets = (type: "privateKey" | "mnemonic") => {
    try {
      let newWallets: WalletAddress[] = []
      if (type === "privateKey") {
        const privateKeys = privateKeysInput.split("\n").filter((key) => key.trim() !== "")
        newWallets = privateKeys.map((key) => {
          try {
            const secretKey = bs58.decode(key) // Decode Base58 private key to Uint8Array
            const keypair = Keypair.fromSecretKey(secretKey)
            return {
              id: Date.now().toString() + Math.random(),
              address: keypair.publicKey.toString(),
              solBalance: 0,
              tokenBalance: 0,
              selected: true,
            }
          } catch {
            toast.error(`Invalid private key: ${key.slice(0, 10)}...`)
            return null
          }
        }).filter((wallet): wallet is WalletAddress => wallet !== null)
      } else {
        const mnemonics = mnemonicInput.split("\n").filter((m) => m.trim() !== "")
        newWallets = mnemonics.flatMap((mnemonic) => {
          try {
            if (!validateMnemonic(mnemonic)) {
              toast.error(`Invalid mnemonic: ${mnemonic.slice(0, 10)}...`)
              return []
            }
            const seed = mnemonicToSeedSync(mnemonic) // Returns Buffer
            const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString("hex")).key
            const keypair = Keypair.fromSeed(new Uint8Array(derivedSeed))
            return {
              id: Date.now().toString() + Math.random(),
              address: keypair.publicKey.toString(),
              solBalance: 0,
              tokenBalance: 0,
              selected: true,
            }
          } catch {
            toast.error(`Failed to derive keypair from mnemonic: ${mnemonic.slice(0, 10)}...`)
            return []
          }
        })
      }

      if (newWallets.length > 0) {
        setWalletAddresses(newWallets)
        setIsModalOpen(false)
        // handleCheckBalance()
        toast.success(`${newWallets.length} wallet${newWallets.length > 1 ? "s" : ""} imported successfully!`)
      } else {
        toast.error("No valid wallets were imported")
      }
    } catch {
      toast.error("Failed to import wallets")
    }
  }

  const selectSolBalanceGreaterThanZero = () => {
    setWalletAddresses((prev) =>
      prev.map((wallet) => ({
        ...wallet,
        selected: wallet.solBalance > 0,
      })),
    );
    toast.success("Selected wallets with SOL balance > 0");
  };

  const selectTokenBalanceGreaterThanZero = () => {
    setWalletAddresses((prev) =>
      prev.map((wallet) => ({
        ...wallet,
        selected: wallet.tokenBalance > 0,
      })),
    );
    toast.success("Selected wallets with Token balance > 0");
  };

  const selectedCount = walletAddresses.filter((w) => w.selected).length

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap gap-2 mb-4">
          <Button className="cursor-pointer" type="button" onClick={() => setIsModalOpen(true)} variant="default" size="sm">
            1. Import Wallet
          </Button>
          <Button className="cursor-pointer" type="button" onClick={handleCheckBalance} variant="outline" size="sm">
            2. Check Balance
          </Button>
          <Button className="cursor-pointer" type="button" variant="outline" size="sm"
            onClick={selectSolBalanceGreaterThanZero}>
            Select SOL Balance {">"} 0
          </Button>
          <Button className="cursor-pointer" type="button" variant="outline" size="sm"
            onClick={selectTokenBalanceGreaterThanZero} >
            Select Token Balance {">"} 0
          </Button>
          <Button
            className="cursor-pointer"
            type="button"
            onClick={invertSelection}
            variant="outline"
            size="sm"
            disabled={walletAddresses.length === 0}
          >
            Invert Selection
          </Button>
          <Button
            className="cursor-pointer"
            type="button"
            onClick={deleteSelectedWallets}
            variant="destructive"
            size="sm"
            disabled={selectedCount === 0}
          >
            Delete Selected
          </Button>
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button id="import-wallet-modal" className="hidden" />
          </DialogTrigger>
          <DialogContent className="sm:max-w-[770px]">
            <DialogHeader>
              <DialogTitle>Import Wallets</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="privateKey" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="privateKey">Private Keys</TabsTrigger>
                <TabsTrigger value="mnemonic">Mnemonics</TabsTrigger>
              </TabsList>
              <TabsContent value="privateKey">
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">
                    Enter one private key per line (Base58 format)
                  </p>
                  <textarea
                    className="w-full h-40 p-2 border rounded-md text-sm"
                    placeholder="Enter private keys, one per line..."
                    value={privateKeysInput}
                    onChange={(e) => setPrivateKeysInput(e.target.value)}
                  />
                  <Button onClick={() => handleImportWallets("privateKey")}>
                    Import Private Keys
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="mnemonic">
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">
                    Enter one mnemonic phrase per line
                  </p>
                  <textarea
                    className="w-full h-40 p-2 border rounded-md"
                    placeholder="Enter mnemonic phrases, one per line..."
                    value={mnemonicInput}
                    onChange={(e) => setMnemonicInput(e.target.value)}
                  />
                  <Button onClick={() => handleImportWallets("mnemonic")}>
                    Import Mnemonics
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
            <div className="mt-4 text-sm text-red-600">
              <strong>Warning:</strong> Private keys and mnemonics are sensitive data. Do not persist them in production
              environments. Consider clearing or encrypting this data after use.
            </div>
          </DialogContent>
        </Dialog>

        {walletAddresses.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b">
              <div className="grid grid-cols-6 gap-4 text-sm font-medium text-gray-600">
                <div>No.</div>
                <div>Address ({walletAddresses.length})</div>
                <div>SOL Balance</div>
                <div>Token Balance</div>
                <div>Result</div>
                <div>Option</div>
              </div>
            </div>
            <div className="divide-y">
              {walletAddresses.map((wallet, index) => (
                <div key={wallet.id} className="px-4 py-3">
                  <div className="grid grid-cols-6 gap-4 items-center text-sm">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={wallet.selected}
                        onCheckedChange={() => toggleWalletSelection(wallet.id)}
                      />
                      <span>{index + 1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{shortenAddress(wallet.address)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(wallet.address)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>{wallet.solBalance}</span>
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>{wallet.tokenBalance}</span>
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    </div>
                    <div>
                      <Badge variant="secondary">Wait</Badge>
                    </div>
                    <div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setWalletAddresses((prev) => prev.filter((w) => w.id !== wallet.id))}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
            Please import wallet
          </div>
        )}
      </CardContent>
    </Card>
  )
}