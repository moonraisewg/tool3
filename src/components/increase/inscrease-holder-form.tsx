"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  BarChart3,
  Download,
  Play,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { fetchSolAndTokenBalancesBatched } from "@/utils/increase/check-wallets";
import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useIsMobile } from "@/hooks/use-mobile";
import Image from "next/image";
import TokenSearchModal, {
  TokenInfo,
} from "@/components/increase/search-token";
import {
  generateSolanaWallets,
  saveWalletsToLocalStorage,
  loadWalletsFromLocalStorage,
  removeWalletsFromLocalStorage,
  type WalletInfo,
} from "@/utils/create-wallets";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { buildAirdropTransactions } from "@/lib/increase/airdrop";
import { useWallet } from "@solana/wallet-adapter-react";
import { Keypair } from "@solana/web3.js";
import { checkRPCSpeed, createConnection, RPCStatus } from "@/lib/increase/rpc";
import { getJupiterQuote } from "@/service/jupiter/swap";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

const formSchema = z.object({
  rpcUrl: z.string().url("Invalid RPC URL").optional().or(z.literal("")),

  buyAmountMode: z.enum(["fixed", "random"]),
  fixedAmount: z
    .string()
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Amount must be a positive number",
    })
    .optional(),
  randomMin: z
    .string()
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Amount must be a positive number",
    })
    .optional(),
  randomMax: z
    .string()
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Amount must be a positive number",
    })
    .optional(),

  autoSell: z.boolean(),

  dexType: z.enum([
    "Raydium,Meteora,Orca+V2",
    "Raydium Launchlab",
    "Pump.fun",
    "Pump.fun Amm",
  ]),

  quantity: z.string().refine(
    (val) => {
      const num = Number(val);
      return !isNaN(num) && num > 0 && num <= 10000;
    },
    {
      message: "Quantity must be between 1 and 10000",
    }
  ),
  customQuantity: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function Component() {
  const isMobile = useIsMobile();
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>({
    id: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    name: "USD Coin",
    symbol: "USDC",
    icon: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
    decimals: 6,
    usdPrice: 1,
    mcap: 0,
    liquidity: 0,
    isVerified: true,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      rpcUrl: "",
      buyAmountMode: "fixed",
      fixedAmount: "0.001",
      randomMin: "0.001",
      randomMax: "0.01",
      autoSell: false,
      dexType: "Raydium,Meteora,Orca+V2",
      quantity: "50",
      customQuantity: "",
    },
  });

  const { watch, handleSubmit } = form;
  const watchedQuantity = watch("quantity");
  const watchedCustomQuantity = watch("customQuantity");
  const [isLoading, setIsLoading] = useState(false);
  const { publicKey, signTransaction } = useWallet();
  const [generatedWallets, setGeneratedWallets] = useState<WalletInfo[] | null>(
    null
  );
  const quantityOptions = ["4", "50", "100", "500", "1000"];
  const showNewRun =
    !isLoading && generatedWallets && generatedWallets.length > 0;

  const [rpcStatus, setRpcStatus] = useState<RPCStatus | null>(null);
  const [isCheckingRPC, setIsCheckingRPC] = useState(false);
  const isFormDisabled = showNewRun || isLoading;
  const [, setQuoteStatus] = useState<{
    isValid: boolean;
    error?: string;
    isChecking: boolean;
  }>({
    isValid: false,
    isChecking: false,
  });

  const getDexDisplayName = (dexType: string) => {
    switch (dexType) {
      case "Raydium,Meteora,Orca+V2":
        return "Raydium/Meteora/Orca";
      case "Raydium Launchlab":
        return "Raydium Launchpad";
      case "Pump.fun":
        return "Pump.fun";
      case "Pump.fun Amm":
        return "PumpSwap (AMM)";
      default:
        return dexType;
    }
  };

  const validateQuote = async (tokenMint: string, dexType: string) => {
    setQuoteStatus({ isValid: false, isChecking: true });

    try {
      const SOL_MINT = "So11111111111111111111111111111111111111112";
      const testAmount = Math.round(0.001 * LAMPORTS_PER_SOL);

      let dexes: string[] | undefined;
      let allowFallback = false;

      if (dexType === "Raydium,Meteora,Orca+V2") {
        allowFallback = true;
        dexes = dexType.split(",").map((d) => d.trim());
      } else {
        dexes = [dexType];
      }

      try {
        const quote = await getJupiterQuote(
          SOL_MINT,
          tokenMint,
          testAmount,
          undefined,
          dexes
        );

        if (quote?.routePlan?.length > 0) {
          setQuoteStatus({ isValid: true, isChecking: false });
        } else {
          throw new Error("No route found");
        }
      } catch {
        if (allowFallback) {
          const fallbackQuote = await getJupiterQuote(
            SOL_MINT,
            tokenMint,
            testAmount,
            undefined,
            undefined
          );

          if (fallbackQuote?.routePlan?.length > 0) {
            setQuoteStatus({
              isValid: true,
              isChecking: false,
            });
          } else {
            throw new Error("No fallback route");
          }
        } else {
          const dexName = getDexDisplayName(dexType);
          toast.message("Incompatible DEX selected. Please choose another.");
          setQuoteStatus({
            isValid: false,
            isChecking: false,
            error: `No route available for ${dexName}`,
          });
        }
      }
    } catch {
      setQuoteStatus({
        isValid: false,
        isChecking: false,
        error: "Failed to check quote",
      });
    }
  };
  const rpcUrl = form.watch("rpcUrl");
  useEffect(() => {
    if (rpcUrl && rpcUrl.trim()) {
      setIsCheckingRPC(true);

      const timeoutId = setTimeout(async () => {
        const status = await checkRPCSpeed(rpcUrl);
        setRpcStatus(status);
        setIsCheckingRPC(false);
      }, 1000);

      return () => clearTimeout(timeoutId);
    } else {
      setRpcStatus(null);
    }
  }, [rpcUrl]);

  const dexType = form.watch("dexType");
  useEffect(() => {
    const token = selectedToken;
    const dexType = form.watch("dexType");

    if (token && dexType && !isFormDisabled) {
      const timeoutId = setTimeout(() => {
        validateQuote(token.id, dexType);
      }, 1000);

      return () => clearTimeout(timeoutId);
    } else {
      setQuoteStatus({ isValid: false, isChecking: false });
    }
  }, [selectedToken, dexType, isFormDisabled, validateQuote]);

  useEffect(() => {
    const saved = loadWalletsFromLocalStorage();
    if (saved) {
      setGeneratedWallets(saved);
    }
  }, []);

  const handleNewRun = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    removeWalletsFromLocalStorage();
    setGeneratedWallets(null);
  };

  const handleDownloadWallets = () => {
    const wallets = generatedWallets;

    if (!wallets || wallets.length === 0) {
      toast.error("No wallets to download. Please run first.");
      return;
    }

    const data = wallets.map((w) => ({
      Address: w.publicKey,
      PrivateKey: w.secretKey,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet["!cols"] = [{ wch: 42 }, { wch: 64 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Wallets");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const blob = new Blob([excelBuffer], {
      type: "application/octet-stream",
    });

    const fileName = "wallets.xlsx";

    saveAs(blob, fileName);
  };

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);

    try {
      const qty =
        data.customQuantity && !isNaN(Number(data.customQuantity))
          ? parseInt(data.customQuantity)
          : parseInt(data.quantity);

      if (!qty || qty <= 0) {
        throw new Error("Please enter a valid quantity");
      }

      if (data.buyAmountMode === "fixed") {
        const amount = parseFloat(data.fixedAmount || "0");
        if (!amount || amount <= 0) {
          throw new Error("Please enter a valid fixed SOL amount");
        }
      } else {
        const min = parseFloat(data.randomMin || "0");
        const max = parseFloat(data.randomMax || "0");
        if (!min || !max || min <= 0 || max <= 0 || min > max) {
          throw new Error(
            "Please enter valid random SOL amounts (min should be less than max)"
          );
        }
      }

      if (!publicKey || !signTransaction) {
        toast.error("Wallet not connected");
        setIsLoading(false);
        return;
      }

      const adminWallet: WalletInfo = {
        keypair: Keypair.generate(),
        publicKey: publicKey.toBase58(),
        secretKey: "",
        solAmount: 0,
        transferAmount: 0,
      };

      let wallets = generatedWallets;

      if (!wallets || wallets.length !== qty) {
        if (data.buyAmountMode === "fixed") {
          const amount = parseFloat(data.fixedAmount || "0");
          wallets = generateSolanaWallets(qty, "fixed", amount);
        } else {
          const min = parseFloat(data.randomMin || "0");
          const max = parseFloat(data.randomMax || "0");
          wallets = generateSolanaWallets(qty, "random", min, max);
        }
        setGeneratedWallets(wallets);
      }

      const fullList = [adminWallet, ...wallets];
      console.log(wallets);
      if (!selectedToken) {
        throw new Error("Please select the token you want to use.");
      }

      const connection = createConnection(data.rpcUrl);

      const { initialTransaction, childTransactions } =
        await buildAirdropTransactions(
          publicKey,
          fullList,
          connection,
          selectedToken?.id,
          [data.dexType]
        );

      console.log("swap data", publicKey, fullList, selectedToken.id, [
        data.dexType,
      ]);

      const signedTx = await signTransaction(initialTransaction);

      const sig1 = await connection.sendTransaction(signedTx);
      await connection.confirmTransaction(sig1, "confirmed");

      console.log("wallets.length:", wallets.length);
      console.log("childTransactions.length:", childTransactions.length);

      for (let i = 0; i < childTransactions.length; i++) {
        const child = childTransactions[i];

        try {
          const signed = await connection.sendTransaction(child.transaction);
          await connection.confirmTransaction(signed, "confirmed");

          const walletIndex = child.walletIndex - 1;
          if (walletIndex >= 0 && walletIndex < wallets.length) {
            wallets[walletIndex].result = "success";
          }
        } catch {
          const walletIndex = child.walletIndex - 1;
          if (walletIndex >= 0 && walletIndex < wallets.length) {
            wallets[walletIndex].result = "failed";
          }
        }
      }

      await new Promise((r) => setTimeout(r, 2000));

      const updatedWallets = await fetchSolAndTokenBalancesBatched(
        wallets,
        connection
      );

      console.log("update", updatedWallets);

      const finalWallets = updatedWallets.map((w, idx) => ({
        ...w,
        result: wallets[idx].result,
      }));
      console.log("final", finalWallets);
      saveWalletsToLocalStorage(finalWallets);
      setGeneratedWallets(finalWallets);

      toast.success(" Success! ", {
        action: {
          label: "View on Solscan",
          onClick: () => window.open(`https://solscan.io/tx/${sig1}`, "_blank"),
        },
      });
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred while processing the transaction.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`mx-auto my-2 md:p-2`}>
      <div className="min-h-screen">
        <div
          className={`max-h-[calc(100vh-100px)] overflow-y-auto px-4 ${
            isMobile ? "py-2" : "py-6"
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center gap-3 mb-4">
              <BarChart3 className="h-8 w-8 text-black" />
              <h1 className="text-3xl font-bold text-gray-900">
                SOL Increase Holders
              </h1>
            </div>
            <p className="text-gray-600 mb-6 max-w-4xl">
              Quickly increase the number of new wallet Buy (↑MAKERS) and token
              holders for a specified token by automatically creating new wallet
              addresses, helping your project data stand out on DEX.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <Card>
                    <div className="h-[200px] overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 z-10 bg-white">
                          <TableRow>
                            <TableHead>No.</TableHead>
                            <TableHead>Address</TableHead>
                            <TableHead>SOL balance</TableHead>
                            <TableHead>
                              {selectedToken?.symbol} balance
                            </TableHead>
                            <TableHead>Result</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {generatedWallets?.map((wallet, index) => (
                            <TableRow key={wallet.publicKey}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell className="font-mono text-xs break-all">
                                <a
                                  href={`https://solscan.io/account/${wallet.publicKey}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  {wallet.publicKey}
                                </a>
                              </TableCell>
                              <TableCell>
                                {wallet.solAmount?.toFixed(4) ?? "0"} SOL
                              </TableCell>
                              <TableCell>
                                {wallet.tokenBalances
                                  ?.find((t) => t.mint === selectedToken?.id)
                                  ?.amount?.toFixed(4) ?? "-"}
                              </TableCell>
                              <TableCell>
                                {wallet.result === "success"
                                  ? "Success"
                                  : wallet.result === "failed"
                                  ? "Failed"
                                  : "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Token Configuration</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-12 gap-4 items-end">
                        <div className="col-span-4">
                          <div className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50 h-11">
                            <Image
                              src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
                              alt="SOL"
                              width={24}
                              height={24}
                              className="rounded-full"
                            />
                            SOL
                          </div>
                        </div>

                        <div className="col-span-4">
                          <button
                            type="button"
                            onClick={() => setTokenModalOpen(true)}
                            disabled={isFormDisabled}
                            className={`w-full flex items-center gap-2 p-3 border rounded-lg h-11 ${
                              isFormDisabled
                                ? "bg-gray-200 cursor-not-allowed"
                                : "bg-gray-50 hover:bg-gray-100"
                            }`}
                          >
                            {selectedToken ? (
                              <>
                                <Image
                                  src={selectedToken.icon}
                                  alt={selectedToken.symbol}
                                  width={20}
                                  height={20}
                                  className="rounded-full"
                                />
                                <span className="font-medium truncate">
                                  {selectedToken.symbol}
                                </span>
                              </>
                            ) : (
                              <span className="text-gray-400">
                                Select token
                              </span>
                            )}
                          </button>
                        </div>

                        <div className="col-span-4">
                          <FormField
                            control={form.control}
                            name="rpcUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <div className="relative">
                                    <Input
                                      placeholder="Enter RPC URL (optional)"
                                      className="h-11 pr-24"
                                      disabled={isFormDisabled}
                                      {...field}
                                    />
                                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                                      {isCheckingRPC && (
                                        <Clock className="h-4 w-4 text-gray-400 animate-spin" />
                                      )}
                                      {rpcStatus && !isCheckingRPC && (
                                        <>
                                          {rpcStatus.isValid ? (
                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                          ) : (
                                            <XCircle className="h-4 w-4 text-red-500" />
                                          )}
                                          <span
                                            className={`text-xs font-mono ${
                                              rpcStatus.isValid
                                                ? "text-green-600"
                                                : "text-red-600"
                                            }`}
                                          >
                                            {rpcStatus.isValid
                                              ? `${rpcStatus.latency}ms`
                                              : "Error"}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Purchase Settings</CardTitle>
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
                                onValueChange={
                                  isFormDisabled ? undefined : field.onChange
                                }
                                className="w-full"
                              >
                                <TabsList
                                  className={`grid w-full grid-cols-2 ${
                                    isFormDisabled
                                      ? "opacity-50 pointer-events-none"
                                      : ""
                                  }`}
                                >
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
                        name="fixedAmount"
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
                                disabled={isFormDisabled}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div
                        className={`grid grid-cols-2 gap-4 ${
                          form.watch("buyAmountMode") === "random"
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
                                  placeholder="0.001"
                                  step="0.001"
                                  disabled={isFormDisabled}
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
                      <CardTitle>DEX</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FormField
                        control={form.control}
                        name="dexType"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Tabs
                                value={field.value}
                                onValueChange={
                                  isFormDisabled ? undefined : field.onChange
                                }
                                className="w-full"
                              >
                                <TabsList
                                  className={`grid grid-flow-col auto-cols-max gap-2 overflow-x-auto scrollbar-hide px-1 ${
                                    isFormDisabled
                                      ? "opacity-50 pointer-events-none"
                                      : ""
                                  }`}
                                >
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
                </div>

                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Increase Wallet(↑MAKERS) Buy</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="quantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantity</FormLabel>
                            <FormControl>
                              <div className="space-y-2">
                                <div className="grid grid-cols-3 gap-2">
                                  {quantityOptions.map((qty) => (
                                    <Button
                                      key={qty}
                                      variant={
                                        field.value === qty
                                          ? "default"
                                          : "outline"
                                      }
                                      size="sm"
                                      type="button"
                                      disabled={isFormDisabled}
                                      onClick={() => field.onChange(qty)}
                                      className={
                                        field.value === qty
                                          ? "bg-black hover:bg-gray-600"
                                          : ""
                                      }
                                    >
                                      {qty}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="customQuantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                placeholder="Custom quantity"
                                disabled={isFormDisabled}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-xl text-gray-600 font-bold">
                            Increase TXNS
                          </div>
                          <div className="text-gray-500">
                            {watchedCustomQuantity || watchedQuantity} BUY 0
                            SELL
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-xl text-gray-600 font-bold">
                            Increase Token Holders
                          </div>
                          <div className="text-gray-500">
                            {watchedCustomQuantity || watchedQuantity}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-xl text-gray-600 font-bold">
                            Increase Wallet(↑MAKERS) Buy
                          </div>
                          <div className="text-gray-500">
                            {watchedCustomQuantity || watchedQuantity}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardContent className="pt-6 space-y-3">
                      <Button
                        variant="outline"
                        className="w-full"
                        type="button"
                        onClick={handleDownloadWallets}
                        disabled={isLoading}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download wallet address info
                      </Button>

                      {showNewRun ? (
                        <Button
                          type="button"
                          className="w-full bg-black hover:bg-gray-600"
                          size="lg"
                          onClick={handleNewRun}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          New
                        </Button>
                      ) : (
                        <Button
                          type="submit"
                          className="w-full bg-black hover:bg-gray-600 disabled:bg-gray-400"
                          size="lg"
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Running...
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              RUN
                            </>
                          )}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </form>
          </Form>
        </div>
      </div>

      <TokenSearchModal
        open={tokenModalOpen && !isFormDisabled}
        onClose={() => setTokenModalOpen(false)}
        onSelect={(token) => {
          if (!isFormDisabled) {
            setSelectedToken(token);
            setTokenModalOpen(false);
          }
        }}
      />
    </div>
  );
}
