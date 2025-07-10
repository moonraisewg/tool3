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
import { Transaction, PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction, SendTransactionError } from "@solana/web3.js"
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID, NATIVE_MINT } from "@solana/spl-token"
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import WalletList from "./wallet-list"
import SelectTokenBundled from "./select-token-bundled"
import { Token } from "@/types/types"
import { connectionDevnet } from "@/service/solana/connection"
import {
  CpmmSwapParams,
  Raydium,
  TxVersion,
  CurveCalculator,
} from "@raydium-io/raydium-sdk-v2"
import { BN } from "bn.js"
import { Keypair } from "@solana/web3.js"

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
      amount: "0.0001",
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

  const fetchTokenAccountData = async (wallet: PublicKey): Promise<{ tokenAccounts: TokenAccount[] }> => {
    const accounts = await connectionDevnet.getParsedTokenAccountsByOwner(wallet, { programId: TOKEN_PROGRAM_ID })
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
          const ata = await getAssociatedTokenAddress(new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"), pubKey)
          allPubKeys.push(ata)
        }
      }

      const response = await connectionDevnet.getMultipleParsedAccounts(allPubKeys, { commitment: "confirmed" })
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
      setLoading(true);
      setLoadingMessage("Chuẩn bị giao dịch...");

      if (!selectedToken || !selectedToken.decimals) {
        throw new Error("Vui lòng chọn token hợp lệ");
      }

      const selectedWallets = walletAddresses.filter((w) => w.selected);
      if (selectedWallets.length === 0) {
        throw new Error("Vui lòng chọn ít nhất một ví");
      }
      if (selectedWallets.length > 50) {
        throw new Error("Tối đa 50 ví được phép cho bundle");
      }

      const amountInLamports = new BN(toLamports(values.amount, selectedToken.decimals));
      const tokenMint = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
      const solMint = NATIVE_MINT;
      const slippage = 0.1;
      const txVersion = TxVersion.LEGACY;
      const poolId = "2HyNe5a32uVoB4BybXCLak41QrejZLqF9hZM6KBMQ1V2";

      const txIds: string[] = [];

      for (const wallet of selectedWallets) {
        const walletPubKey = wallet.keypair.publicKey;
        const walletKeypair = wallet.keypair;

        setLoadingMessage(`Chuẩn bị giao dịch cho ${shortenAddress(walletPubKey.toString())}...`);

        // Kiểm tra số dư SOL
        const solBalance = await connectionDevnet.getBalance(walletPubKey);
        if (solBalance < 0.002 * 1_000_000_000) {
          throw new Error(`Ví ${shortenAddress(walletPubKey.toString())} không đủ SOL (cần ít nhất 0.002 SOL)`);
        }

        // Khởi tạo Raydium cho ví hiện tại
        const raydium = await Raydium.load({
          connection: connectionDevnet,
          owner: walletPubKey,
        });

        // Lấy blockhash mới
        const { blockhash, lastValidBlockHeight } = await connectionDevnet.getLatestBlockhash("confirmed");

        const transaction = new Transaction({
          recentBlockhash: blockhash,
          feePayer: walletPubKey,
        });

        const { tokenAccounts } = await fetchTokenAccountData(walletPubKey);
        const isInputSol = values.action === "bundledBuy" || values.action === "sellAndBundledBuy";
        const isOutputSol = values.action === "bundledSell" || values.action === "sellAndBundledBuy";

        const inputMint = isInputSol ? solMint : tokenMint;
        const outputMint = isOutputSol ? solMint : tokenMint;
        const inputTokenAcc = tokenAccounts.find((a) => a.mint.toBase58() === inputMint.toBase58())?.publicKey;

        // Kiểm tra số dư token
        if (!isInputSol && inputTokenAcc) {
          const tokenAccountInfo = await connectionDevnet.getParsedAccountInfo(inputTokenAcc);
          if (!tokenAccountInfo.value || !("parsed" in tokenAccountInfo.value.data)) {
            throw new Error(`Tài khoản token ${inputMint.toBase58()} không tồn tại cho ví ${shortenAddress(walletPubKey.toString())}`);
          }
          const tokenAmount = new BN(tokenAccountInfo.value.data.parsed.info.tokenAmount.amount);
          if (tokenAmount.lt(amountInLamports)) {
            throw new Error(`Ví ${shortenAddress(walletPubKey.toString())} không đủ token ${inputMint.toBase58()} (cần ${values.amount}, có ${tokenAmount.toString()})`);
          }
        }

        if (!inputTokenAcc && !isInputSol) {
          throw new Error(`Không tìm thấy tài khoản token đầu vào cho ${inputMint.toBase58()} trong ví ${shortenAddress(walletPubKey.toString())}`);
        }

        const outputTokenAcc = tokenAccounts.find((a) => a.mint.toBase58() === outputMint.toBase58())?.publicKey;
        if (!outputTokenAcc && !isOutputSol) {
          const outputATA = await getAssociatedTokenAddress(outputMint, walletPubKey);
          transaction.add(
            createAssociatedTokenAccountInstruction(
              walletPubKey,
              outputATA,
              walletPubKey,
              outputMint
            )
          );
        }

        if (values.action === "bundledSell") {
          if (values.dex === "raydium") {
            const data = await raydium.cpmm.getPoolInfoFromRpc(poolId);
            const { poolInfo, poolKeys, rpcData } = data;
            const baseIn = inputMint.toBase58() === poolInfo.mintA.address;

            const swapResult = CurveCalculator.swap(
              amountInLamports,
              baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
              baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
              rpcData.configInfo!.tradeFeeRate
            );

            const swapParams: CpmmSwapParams = {
              poolInfo,
              poolKeys,
              inputAmount: amountInLamports,
              swapResult,
              slippage,
              baseIn,
              txVersion,
            };

            const { transaction: swapTx } = await raydium.cpmm.swap(swapParams);
            transaction.add(...swapTx.instructions);
          } else {
            // Placeholder cho Pump
            const pumpProgramId = new PublicKey("PUMP_PROGRAM_ID");
            const poolIdKey = new PublicKey("PUMP_POOL_ID");
            transaction.add(
              new TransactionInstruction({
                keys: [
                  { pubkey: walletPubKey, isSigner: true, isWritable: true },
                  { pubkey: inputTokenAcc || walletPubKey, isSigner: false, isWritable: true },
                  { pubkey: solMint, isSigner: false, isWritable: true },
                  { pubkey: poolIdKey, isSigner: false, isWritable: true },
                ],
                programId: pumpProgramId,
                data: Buffer.from([]),
              })
            );
          }
        }

        const messageV0 = new TransactionMessage({
          payerKey: walletPubKey,
          recentBlockhash: blockhash,
          instructions: transaction.instructions,
        }).compileToV0Message();
        const versionedTx = new VersionedTransaction(messageV0);

        // Ký giao dịch
        try {
          versionedTx.sign([walletKeypair]);
        } catch (signError) {
          throw new Error(`Lỗi ký giao dịch cho ví ${shortenAddress(walletPubKey.toString())}: ${signError instanceof Error ? signError.message : "Lỗi không xác định"}`);
        }

        // Gửi giao dịch
        setLoadingMessage(`Gửi giao dịch cho ${shortenAddress(walletPubKey.toString())}...`);
        try {
          const txId = await connectionDevnet.sendRawTransaction(versionedTx.serialize(), {
            skipPreflight: false,
            maxRetries: 3,
          });
          await connectionDevnet.confirmTransaction({
            signature: txId,
            blockhash,
            lastValidBlockHeight,
          });

          txIds.push(txId);
          toast.success(`Giao dịch ${txId} hoàn tất cho ${shortenAddress(walletPubKey.toString())}`, {
            action: {
              label: "Xem giao dịch",
              onClick: () => window.open(`https://solscan.io/tx/${txId}?cluster=devnet`, "_blank"),
            },
          });
        } catch (error) {
          if (error instanceof SendTransactionError) {
            console.error(`Lỗi giao dịch cho ví ${shortenAddress(walletPubKey.toString())}:`, error);
          } else {
            throw new Error(`Lỗi gửi giao dịch cho ví ${shortenAddress(walletPubKey.toString())}: ${error instanceof Error ? error.message : "Lỗi không xác định"}`);
          }
        }
      }

      form.reset();
      setSelectedToken(null);
      setWalletAddresses([]);
    } catch (error) {
      console.error("Lỗi BundledForm:", error);
      toast.error(error instanceof Error ? error.message : `Không thể thực hiện ${values.action}`);
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

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
    </div>
  )
}