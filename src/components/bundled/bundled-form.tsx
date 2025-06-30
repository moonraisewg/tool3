"use client"

import { useState, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { useWallet } from "@solana/wallet-adapter-react"
import { Loader2, Info } from "lucide-react"
import { Transaction } from "@solana/web3.js"
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import WalletList from "./wallet-list"
import SelectTokenBundled from "./select-token-bundled"
import { Token } from "@/types/types"

const formSchema = z.object({
  amount: z.string().refine((val) => !isNaN(Number.parseFloat(val)) && Number.parseFloat(val) >= 0, {
    message: "Amount must be a valid non-negative number",
  }),
  action: z.enum(["bundledSell", "bundledBuy", "sellAndBundledBuy"], {
    required_error: "Please select a transaction type",
  }),
  dex: z.enum(["raydium", "pump"], { required_error: "Please select a DEX" }),
  chain: z.enum(["solana"], { required_error: "Please select a chain" }),
  jitoFee: z.string().refine((val) => !isNaN(Number.parseFloat(val)) && Number.parseFloat(val) >= 0, {
    message: "Jito fee must be a valid non-negative number",
  }),
  amountType: z.enum(["allAmount", "randomAmount", "percentAmount", "fixedAmount", "fixedRetention"], {
    required_error: "Please select an amount type",
  }),
})

export interface WalletAddress {
  id: string
  address: string
  solBalance: number
  tokenBalance: number
  selected: boolean
}

export default function BundledForm() {
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState("")
  const [walletAddresses, setWalletAddresses] = useState<WalletAddress[]>([])
  const { publicKey, signTransaction } = useWallet()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: "0",
      action: "bundledSell",
      dex: "raydium",
      chain: "solana",
      jitoFee: "0.0003",
      amountType: "allAmount",
    },
  })

  const toLamports = useCallback((amountStr: string, decimals: number): string => {
    const amount = Number.parseFloat(amountStr)
    if (isNaN(amount) || amount < 0) throw new Error("Invalid amount")
    return (amount * 10 ** decimals).toString()
  }, [])

  const handleCheckBalance = async () => {
    if (!publicKey) {
      toast.error("Please connect your wallet first")
      return
    }
    try {
      setLoading(true)
      setLoadingMessage("Checking balance...")
      const response = await fetch("/api/check-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userPublicKey: publicKey.toString() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to check balance")

      setWalletAddresses((prev) =>
        prev.map((wallet) =>
          wallet.address === publicKey.toString()
            ? { ...wallet, solBalance: data.solBalance, tokenBalance: data.tokenBalance }
            : wallet,
        ),
      )

      toast.success(`Balance checked: ${data.solBalance} SOL, ${data.tokenBalance} ${selectedToken?.symbol || "TOKEN"}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to check balance")
    } finally {
      setLoading(false)
      setLoadingMessage("")
    }
  }

  const shortenAddress = (address: string) => {
    if (address.length <= 10) return address
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setLoading(true)
      setLoadingMessage("Preparing transaction...")

      if (!publicKey || !signTransaction) {
        throw new Error("Please connect your wallet first")
      }
      if (!selectedToken) {
        throw new Error("Please select a token")
      }
      if (!selectedToken.decimals) {
        throw new Error("Invalid token decimals")
      }

      const selectedAddresses = walletAddresses.filter((w) => w.selected).map((w) => w.address)
      if (selectedAddresses.length === 0) {
        throw new Error("Please select at least one wallet address")
      }

      const amountInLamports = toLamports(values.amount, selectedToken.decimals)
      const isSell = values.action.includes("Sell")
      const jitoFeeInLamports = toLamports(values.jitoFee, 9)

      setLoadingMessage(`Requesting ${isSell ? "sell" : "buy"} transaction...`)
      const response = await fetch("/api/bundled-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPublicKey: publicKey.toString(),
          tokenAddress: selectedToken.address,
          amount: amountInLamports,
          action: values.action,
          dex: values.dex,
          chain: values.chain,
          jitoFee: jitoFeeInLamports,
          addresses: selectedAddresses,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || `Failed to prepare ${isSell ? "sell" : "buy"} transaction`)

      setLoadingMessage("Awaiting transaction signature...")
      const transaction = Transaction.from(Buffer.from(data.transaction, "base64"))
      const signedTransaction = await signTransaction(transaction)

      setLoadingMessage(`Sending ${isSell ? "sell" : "buy"} transaction...`)
      const executeResponse = await fetch("/api/send-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction: Buffer.from(signedTransaction.serialize()).toString("base64"),
          blockhash: data.blockhash,
          lastValidBlockHeight: data.lastValidBlockHeight,
          cluster: "mainnet",
        }),
      })

      const executeData = await executeResponse.json()
      if (!executeResponse.ok)
        throw new Error(executeData.error || `Failed to execute ${isSell ? "sell" : "buy"} transaction`)

      toast.success(
        `🎉 ${isSell ? "Sold" : "Bought"} ${values.amount} ${selectedToken.symbol || "UNKNOWN"} successfully!`,
        {
          description: `Transaction ID: ${executeData.txId}`,
          action: {
            label: "View Transaction",
            onClick: () => window.open(`https://solscan.io/tx/${executeData.txId}?cluster=mainnet`, "_blank"),
          },
        },
      )

      form.reset()
      setSelectedToken(null)
      setWalletAddresses([])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${values.action} token`)
    } finally {
      setLoading(false)
      setLoadingMessage("")
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">

      <SelectTokenBundled
        selectedToken={selectedToken}
        setSelectedToken={setSelectedToken}
      />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="space-y-2 w-[40%]">
                  <label className="text-lg font-bold text-gray-700">DEX</label>
                  <div className="flex gap-2 mt-1">
                    <Button
                      type="button"
                      variant={form.watch("dex") === "raydium" ? "default" : "outline"}
                      onClick={() => form.setValue("dex", "raydium")}
                      className="flex-1 !w-[120px]"
                    >
                      🌊 Raydium
                    </Button>
                    <Button
                      type="button"
                      variant={form.watch("dex") === "pump" ? "default" : "outline"}
                      onClick={() => form.setValue("dex", "pump")}
                      className="flex-1 !w-[120px]"
                    >
                      🔥 Pump
                    </Button>
                    <div className="flex justify-center">
                      <Button variant="outline" size="sm" className="text-xs">
                        🔍 Find LP
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 w-[40%]">
                  <label className="text-lg font-bold text-gray-700">Transaction Type</label>
                  <div className="flex gap-2 mt-1">
                    <Button
                      type="button"
                      variant={form.watch("action") === "bundledSell" ? "default" : "outline"}
                      onClick={() => form.setValue("action", "bundledSell")}
                      className="w-[120px]"
                    >
                      Bundled Sell
                    </Button>
                    <Button
                      type="button"
                      variant={form.watch("action") === "bundledBuy" ? "default" : "outline"}
                      onClick={() => form.setValue("action", "bundledBuy")}
                      className="w-[120px]"
                    >
                      Bundled Buy
                    </Button>
                    <Button
                      type="button"
                      variant={form.watch("action") === "sellAndBundledBuy" ? "default" : "outline"}
                      onClick={() => form.setValue("action", "sellAndBundledBuy")}
                      className="w-[170px]"
                    >
                      Sell and Bundled Buy
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 ml-1" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Advanced transaction type</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 w-[20%]">
                  <label className="text-lg font-bold text-gray-700">Chain</label>
                  <Button type="button" variant="outline" className="w-full justify-start mt-1" disabled>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full"></div>
                      Solana
                    </div>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <WalletList
            walletAddresses={walletAddresses}
            setWalletAddresses={setWalletAddresses}
            handleCheckBalance={handleCheckBalance}
            shortenAddress={shortenAddress}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {form.watch("action") === "bundledSell"
                  ? "Sell Amount (USDC)"
                  : form.watch("action") === "bundledBuy"
                    ? "Buy Amount (USDC)"
                    : "Buy Amount (USDC)"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={form.watch("amountType") === "allAmount" ? "default" : "outline"}
                  onClick={() => form.setValue("amountType", "allAmount")}
                  size="sm"
                  className=""
                >
                  All Amount
                </Button>
                <Button
                  type="button"
                  variant={form.watch("amountType") === "randomAmount" ? "default" : "outline"}
                  onClick={() => form.setValue("amountType", "randomAmount")}
                  size="sm"
                >
                  Random Amount
                </Button>
                <Button
                  type="button"
                  variant={form.watch("amountType") === "percentAmount" ? "default" : "outline"}
                  onClick={() => form.setValue("amountType", "percentAmount")}
                  size="sm"
                >
                  Percent Amount %
                </Button>
                <Button
                  type="button"
                  variant={form.watch("amountType") === "fixedAmount" ? "default" : "outline"}
                  onClick={() => form.setValue("amountType", "fixedAmount")}
                  size="sm"
                >
                  Fixed Amount
                </Button>
                <Button
                  type="button"
                  variant={form.watch("amountType") === "fixedRetention" ? "default" : "outline"}
                  onClick={() => form.setValue("amountType", "fixedRetention")}
                  size="sm"
                >
                  Fixed Retention
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                Jito Priority Fee
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-gray-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Select the priority fee for faster transaction processing.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={form.watch("jitoFee") === "0.0003" ? "default" : "outline"}
                  onClick={() => form.setValue("jitoFee", "0.0003")}
                  size="sm"
                  className=""
                >
                  0.0003 SOL
                </Button>
                <Button
                  type="button"
                  variant={form.watch("jitoFee") === "0.003" ? "default" : "outline"}
                  onClick={() => form.setValue("jitoFee", "0.003")}
                  size="sm"
                >
                  0.003 SOL
                </Button>
                <Button
                  type="button"
                  variant={form.watch("jitoFee") === "0.01" ? "default" : "outline"}
                  onClick={() => form.setValue("jitoFee", "0.01")}
                  size="sm"
                >
                  0.01 SOL
                </Button>
                <Button
                  type="button"
                  variant={form.watch("jitoFee") === "0.1" ? "default" : "outline"}
                  onClick={() => form.setValue("jitoFee", "0.1")}
                  size="sm"
                >
                  0.1 SOL
                </Button>
                <div className="flex items-center gap-2 ml-4">
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="0.0003"
                    className="border rounded px-2 py-1 text-sm w-20"
                    onChange={(e) => form.setValue("jitoFee", e.target.value)}
                  />
                  <span className="text-sm text-gray-500">SOL</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6">
              <p className="text-sm text-green-800">
                Up to 50 addresses are supported for simultaneous bundle operation. The service fee for each address is
                0.0000066SOL, and all service fees will be paid by the first address imported.
              </p>
            </CardContent>
          </Card>

          <Button
            type="submit"
            className="w-full h-12 text-lg font-semibold hover:bg-green-700"
            variant={"default"}
            disabled={loading || !publicKey || !selectedToken || walletAddresses.filter((w) => w.selected).length === 0}
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>{loadingMessage}</span>
              </div>
            ) : (
              <span>
                {form.watch("action") === "bundledSell"
                  ? "Bundled Sell"
                  : form.watch("action") === "bundledBuy"
                    ? "Bundled Buy"
                    : "Sell and Bundled Buy"}
              </span>
            )}
          </Button>
        </form>
      </Form>
    </div>
  )
}