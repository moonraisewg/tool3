"use client"

import { useState, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { useWallet } from "@solana/wallet-adapter-react"
import { Info, Loader2 } from "lucide-react"
import { Transaction, PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js"
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID, NATIVE_MINT } from "@solana/spl-token"
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import WalletList from "./wallet-list"
import SelectTokenBundled from "./select-token-bundled"
import { Token } from "@/types/types"
import { connectionMainnet } from "@/service/solana/connection"

import { Keypair } from "@solana/web3.js"
import { createInstructionFromJupiter, getJupiterQuote, getJupiterSwapInstructions, SwapInstructionsRequest } from "@/service/jupiter/swap"
import Image from "next/image"
import BN from "bn.js"

const formSchema = z.object({
  amount: z.string().refine((val) => !isNaN(Number.parseFloat(val)) && Number.parseFloat(val) >= 0, {
    message: "Amount must be a valid non-negative number",
  }).optional(),
  buyAmountMode: z.enum(["fixed", "random"]),
  randomMin: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Amount must be a positive number",
  }).optional(),
  randomMax: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Amount must be a positive number",
  }).optional(),
  action: z.enum(["bundledSell", "bundledBuy", "sellAndBundledBuy"], {
    required_error: "Please select a transaction type",
  }),
  dex: z.enum(["Raydium,Meteora,Orca+V2", "Raydium Launchlab", "Pump.fun", "Pump.fun Amm"], {
    required_error: "Please select a DEX"
  }),
  chain: z.enum(["solana"], { required_error: "Please select a chain" }),
  jitoFee: z.enum(["0.00006", "0.0001", "0.0003"]),
})

interface TokenAccount {
  mint: PublicKey
  publicKey: PublicKey
}

export interface WalletAddress {
  id: string
  keypair: Keypair
  solBalance: number
  tokenBalance: number
  selected: boolean
}

export default function BundledForm() {
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState("")
  const [walletAddresses, setWalletAddresses] = useState<WalletAddress[]>([])
  const { publicKey } = useWallet()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: "0.001",
      buyAmountMode: "fixed",
      randomMin: "0.001",
      randomMax: "0.01",
      action: "bundledBuy",
      dex: "Raydium,Meteora,Orca+V2",
      chain: "solana",
      jitoFee: "0.00006",
    },
  })

  const feeOptions = [
    { value: "0.00006", label: "0.00006 SOL" },
    { value: "0.0001", label: "0.0001 SOL" },
    { value: "0.0003", label: "0.0003 SOL" },
  ] as const

  const toLamports = useCallback((amountStr: string, decimals: number): string => {
    const amount = Number.parseFloat(amountStr)
    if (isNaN(amount) || amount < 0) throw new Error("Invalid amount")
    return (amount * 10 ** decimals).toString()
  }, [])

  const fetchTokenAccountData = async (wallet: PublicKey): Promise<{ tokenAccounts: TokenAccount[] }> => {
    const accounts = await connectionMainnet.getParsedTokenAccountsByOwner(wallet, { programId: TOKEN_PROGRAM_ID })
    const tokenAccounts = accounts.value.map(({ pubkey, account }) => ({
      mint: new PublicKey(account.data.parsed.info.mint),
      publicKey: pubkey,
    }))
    return { tokenAccounts }
  }

  const handleCheckBalance = async () => {
    if (walletAddresses.length === 0) {
      toast.error("Please import at least one wallet")
      return
    }

    try {
      setLoading(true)
      setLoadingMessage("Checking balances...")

      const allPubKeys: PublicKey[] = []

      for (const wallet of walletAddresses) {
        const pubKey = wallet.keypair.publicKey
        allPubKeys.push(pubKey)

        if (selectedToken) {
          const ata = await getAssociatedTokenAddress(new PublicKey(selectedToken.address), pubKey)
          allPubKeys.push(ata)
        }
      }

      const response = await connectionMainnet.getMultipleParsedAccounts(allPubKeys, { commitment: "confirmed" })
      const accountInfos = response.value

      const updatedWallets = await Promise.all(
        walletAddresses.map(async (wallet, index) => {
          const walletIndex = index * 2
          const accountInfo = accountInfos[walletIndex]
          if (!accountInfo) {
            toast.error(`Failed to fetch balance for ${shortenAddress(wallet.keypair.publicKey.toString())}`)
            return wallet
          }

          const solBalance = accountInfo.lamports / 1_000_000_000
          let tokenBalance = 0
          if (selectedToken) {
            const ataIndex = walletIndex + 1
            const ataAccountInfo = accountInfos[ataIndex]

            if (
              ataAccountInfo &&
              "parsed" in ataAccountInfo.data &&
              (ataAccountInfo.data).program === "spl-token"
            ) {
              const parsed = ataAccountInfo.data
              tokenBalance = Number(parsed.parsed.info.tokenAmount.uiAmount)
            }
          }

          return {
            ...wallet,
            solBalance,
            tokenBalance,
          }
        })
      )

      setWalletAddresses(updatedWallets)
      toast.success("Balances checked successfully!")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to check balances")
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
      setLoadingMessage("Prepare transaction...")

      if (!selectedToken || !selectedToken.decimals) {
        throw new Error("Please select a valid token")
      }

      const selectedWallets = walletAddresses.filter((w) => w.selected)
      if (selectedWallets.length === 0) {
        throw new Error("Please select at least one wallet")
      }

      let amountInLamports: BN
      if (values.buyAmountMode === "fixed") {
        const amount = parseFloat(values.amount || "0")
        if (!amount || amount <= 0) {
          throw new Error("Please enter a valid fixed SOL amount")
        }
        amountInLamports = new BN(toLamports(values.amount || "0", selectedToken.decimals))
      } else {
        const min = parseFloat(values.randomMin || "0")
        const max = parseFloat(values.randomMax || "0")
        if (!min || !max || min <= 0 || max <= 0 || min > max) {
          throw new Error("Please enter valid random SOL amounts (min should be less than max)")
        }
        const randomAmount = (Math.random() * (max - min) + min).toFixed(6)
        amountInLamports = new BN(toLamports(randomAmount, selectedToken.decimals))
      }

      const tokenMint = new PublicKey(selectedToken.address)
      const solMint = NATIVE_MINT
      const slippageBps = 100
      const { blockhash, lastValidBlockHeight } = await connectionMainnet.getLatestBlockhash("confirmed")

      const transactions: VersionedTransaction[] = []

      for (const wallet of selectedWallets) {
        const walletPubKey = wallet.keypair.publicKey
        const walletKeypair = wallet.keypair

        const solBalance = await connectionMainnet.getBalance(walletPubKey)
        if (solBalance < 0.002 * 1_000_000_000) {
          throw new Error(`Wallet ${shortenAddress(walletPubKey.toString())} does not have enough SOL (needs at least 0.002 SOL)`)
        }

        const transaction = new Transaction({
          recentBlockhash: blockhash,
          feePayer: walletPubKey,
        })

        const { tokenAccounts } = await fetchTokenAccountData(walletPubKey)
        const isInputSol = values.action === "bundledBuy"
        const isOutputSol = values.action === "bundledSell"

        const inputMint = isInputSol ? solMint : tokenMint
        const outputMint = isOutputSol ? solMint : tokenMint
        const inputTokenAcc = tokenAccounts.find((a) => a.mint.toBase58() === inputMint.toBase58())?.publicKey

        if (!isInputSol && !inputTokenAcc) {
          throw new Error(`Input token account not found for ${inputMint.toBase58()} in wallet ${shortenAddress(walletPubKey.toString())}`)
        }

        if (!isInputSol && inputTokenAcc) {
          const tokenAccountInfo = await connectionMainnet.getParsedAccountInfo(inputTokenAcc)
          if (!tokenAccountInfo.value || !("parsed" in tokenAccountInfo.value.data)) {
            throw new Error(`Token account ${inputMint.toBase58()} does not exist for wallet ${shortenAddress(walletPubKey.toString())}`)
          }
          const tokenAmount = new BN(tokenAccountInfo.value.data.parsed.info.tokenAmount.amount)
          if (tokenAmount.lt(amountInLamports)) {
            throw new Error(`Wallet ${shortenAddress(walletPubKey.toString())} does not have enough tokens ${inputMint.toBase58()} (needs ${amountInLamports.toString()}, has ${tokenAmount.toString()})`)
          }
        }

        const outputTokenAcc = tokenAccounts.find((a) => a.mint.toBase58() === outputMint.toBase58())?.publicKey
        if (!outputTokenAcc && !isOutputSol) {
          const outputATA = await getAssociatedTokenAddress(outputMint, walletPubKey)
          transaction.add(
            createAssociatedTokenAccountInstruction(
              walletPubKey,
              outputATA,
              walletPubKey,
              outputMint
            )
          )
        }

        if (["bundledSell", "bundledBuy"].includes(values.action)) {
          const quote = await getJupiterQuote(
            inputMint.toBase58(),
            outputMint.toBase58(),
            Number(amountInLamports),
            slippageBps,
            values.dex.split(",")
          )

          const swapInstructionsRequest: SwapInstructionsRequest = {
            userPublicKey: walletPubKey.toBase58(),
            quoteResponse: quote,
            prioritizationFeeLamports: {
              priorityLevelWithMaxLamports: {
                maxLamports: Number(values.jitoFee) * 1_000_000_000,
                priorityLevel: "medium",
              },
            },
            dynamicComputeUnitLimit: true,
          }

          const swapInstructions = await getJupiterSwapInstructions(swapInstructionsRequest)

          swapInstructions.computeBudgetInstructions.forEach((instruction) => {
            transaction.add(createInstructionFromJupiter(instruction))
          })
          swapInstructions.setupInstructions.forEach((instruction) => {
            transaction.add(createInstructionFromJupiter(instruction))
          })
          transaction.add(createInstructionFromJupiter(swapInstructions.swapInstruction))
          if (swapInstructions.cleanupInstruction) {
            transaction.add(createInstructionFromJupiter(swapInstructions.cleanupInstruction))
          }
          if (swapInstructions.tokenLedgerInstruction) {
            transaction.add(createInstructionFromJupiter(swapInstructions.tokenLedgerInstruction))
          }
        }

        const messageV0 = new TransactionMessage({
          payerKey: walletPubKey,
          recentBlockhash: blockhash,
          instructions: transaction.instructions,
        }).compileToV0Message()

        const versionedTx = new VersionedTransaction(messageV0)
        versionedTx.sign([walletKeypair])

        const simulation = await connectionMainnet.simulateTransaction(versionedTx)
        if (simulation.value.err) {
          throw new Error(`Simulation failed for wallet ${shortenAddress(walletPubKey.toString())}: ${JSON.stringify(simulation.value.err)}`)
        }

        transactions.push(versionedTx)
      }

      setLoadingMessage("Send transaction...")
      const signatures: string[] = []

      for (const tx of transactions) {
        const serializedTx = tx.serialize()
        const signature = await connectionMainnet.sendRawTransaction(serializedTx, {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        })
        signatures.push(signature)
        console.log(`Transaction sent: ${signature}`)
      }

      setLoadingMessage("Confirm transaction...")
      for (const signature of signatures) {
        try {
          await connectionMainnet.confirmTransaction(
            {
              signature,
              blockhash,
              lastValidBlockHeight,
            },
            "confirmed"
          )
          toast.success(`Transaction ${signature} completed`, {
            action: {
              label: "View transaction",
              onClick: () => window.open(`https://solscan.io/tx/${signature}`, "_blank"),
            },
          })
        } catch (confirmError) {
          console.error(`Transaction confirmation error ${signature}:`, confirmError)
          toast.error(`Transaction confirmation error ${signature}`)
        }
      }

      form.reset()
      setSelectedToken(null)
      setWalletAddresses([])
      toast.success("All transactions have been sent and confirmed!")
    } catch (error) {
      console.error("Error BundledForm:", error)
      toast.error(error instanceof Error ? error.message : `Cannot be done ${values.action}`)
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
            <CardHeader>
              <CardTitle>DEX</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="dex"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Tabs
                        value={field.value}
                        onValueChange={field.onChange}
                        className="w-full"
                      >
                        <TabsList className="grid grid-flow-col auto-cols-max gap-2 overflow-x-auto scrollbar-hide px-1">
                          <TabsTrigger
                            value="Raydium,Meteora,Orca+V2"
                            className="min-w-[250px] lg:min-w-[300px] truncate text-sm"
                          >
                            Jup / Raydium / Meteora / Orca
                          </TabsTrigger>
                          <TabsTrigger
                            value="Raydium Launchlab"
                            className="min-w-[140px] truncate text-sm"
                          >
                            Raydium Launchpad
                          </TabsTrigger>
                          <TabsTrigger
                            value="Pump.fun"
                            className="min-w-[100px] text-sm"
                          >
                            Pump
                          </TabsTrigger>
                          <TabsTrigger
                            value="Pump.fun Amm"
                            className="min-w-[150px] text-sm"
                          >
                            PumpSwap (AMM)
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>


                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />


            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="flex justify-between">
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
                      <Image
                        src={"https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"}
                        alt={"solana"}
                        className="rounded-full !w-[20px] !h-[20px]"
                        width={20}
                        height={20}
                      />
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
                  ? "Sell Amount"
                  : form.watch("action") === "bundledBuy"
                    ? "Buy Amount"
                    : "Buy Amount"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="buyAmountMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Buy Amount Mode</FormLabel>
                    <FormControl>
                      <Tabs
                        value={field.value}
                        onValueChange={field.onChange}
                        className="w-full"
                      >
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="fixed">
                            Fixed Amount
                          </TabsTrigger>
                          <TabsTrigger value="random">
                            Random Amount
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem
                    className={
                      form.watch("buyAmountMode") === "fixed"
                        ? ""
                        : "hidden"
                    }
                  >
                    <FormLabel>Fixed Amount (SOL)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0.01"
                        step="0.001"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div
                className={`grid grid-cols-2 gap-4 ${form.watch("buyAmountMode") === "random"
                  ? ""
                  : "hidden"
                  }`}
              >
                <FormField
                  control={form.control}
                  name="randomMin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min Amount (SOL)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0.001"
                          step="0.001"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="randomMax"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Amount (SOL)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0.01"
                          step="0.001"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
              <FormField
                control={form.control}
                name="jitoFee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jito Priority Fee</FormLabel>
                    <FormControl>
                      <div className="grid grid-cols-3 gap-2">
                        {feeOptions.map((fee) => (
                          <Button
                            key={fee.value}
                            variant={
                              field.value === fee.value
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            type="button"
                            onClick={() => field.onChange(fee.value)}
                            className={
                              field.value === fee.value
                                ? "bg-black hover:bg-gray-600"
                                : ""
                            }
                          >
                            {fee.label}
                          </Button>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-200">
            <CardContent className="">
              <p className="text-sm text-green-800">
                Up to 50 addresses are supported for simultaneous bundle operation. The service fee for each address is
                0.001 SOL, and all service fees will be paid by the first address imported.
              </p>
            </CardContent>
          </Card>

          <Button
            type="submit"
            className="w-full h-12 text-lg font-semibold cursor-pointer"
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
    </div >
  )
}