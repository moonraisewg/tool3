"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BarChart3, Download, ExternalLink, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
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
import { generateSolanaWallets, type WalletInfo } from "@/utils/create-wallets";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { buildAirdropTransactions } from "@/lib/increase/airdrop";
import { connectionMainnet } from "@/service/solana/connection";
import { useWallet } from "@solana/wallet-adapter-react";
import { Keypair } from "@solana/web3.js";

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

  jitoFee: z.enum(["0.00006", "0.0001", "0.0003"]),
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
      jitoFee: "0.00006",
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
  const feeOptions = [
    { value: "0.00006", label: "0.00006 SOL" },
    { value: "0.0001", label: "0.0001 SOL" },
    { value: "0.0003", label: "0.0003 SOL" },
  ] as const;

  const handleDownloadWallets = () => {
    const formValues = form.getValues();

    const qty =
      formValues.customQuantity && !isNaN(Number(formValues.customQuantity))
        ? parseInt(formValues.customQuantity)
        : parseInt(formValues.quantity);

    const buyAmountMode = formValues.buyAmountMode;
    const fixedAmount = formValues.fixedAmount;
    const randomMin = formValues.randomMin;
    const randomMax = formValues.randomMax;

    if (!qty || qty <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    let wallets = generatedWallets;

    if (!wallets || wallets.length !== qty) {
      if (buyAmountMode === "fixed") {
        const amount = parseFloat(fixedAmount || "0.01");
        if (amount <= 0) {
          toast.error("Please enter a valid fixed amount");
          return;
        }
        console.log("Creating fixed wallets with amount:", amount);
        wallets = generateSolanaWallets(qty, "fixed", amount);
      } else {
        const min = parseFloat(randomMin || "0.001");
        const max = parseFloat(randomMax || "0.01");
        if (min <= 0 || max <= 0 || min > max) {
          toast.error(
            "Please enter valid random amounts (min should be less than max)"
          );
          return;
        }
        wallets = generateSolanaWallets(qty, "random", min, max);
      }
      setGeneratedWallets(wallets);
    }

    const data = wallets.map((w) => ({
      Address: w.publicKey,
      PrivateKey: w.secretKey,
      SOLAmount: w.solAmount,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet["!cols"] = [{ wch: 42 }, { wch: 64 }, { wch: 15 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Wallets");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const blob = new Blob([excelBuffer], {
      type: "application/octet-stream",
    });

    const fileName =
      buyAmountMode === "fixed"
        ? `wallets-${qty}-${fixedAmount}SOL.xlsx`
        : `wallets-${qty}-${randomMin}-${randomMax}SOL.xlsx`;

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

      const { initialTransaction, childTransactions } =
        await buildAirdropTransactions(
          publicKey,
          fullList,
          connectionMainnet,
          selectedToken?.id,
          [data.dexType]
        );

      console.log("swap data", publicKey, fullList, selectedToken.id, [
        data.dexType,
      ]);

      const signedTx = await signTransaction(initialTransaction);

      const sig1 = await connectionMainnet.sendRawTransaction(
        signedTx.serialize()
      );
      await connectionMainnet.confirmTransaction(sig1, "confirmed");

      for (const child of childTransactions) {
        const signed = await connectionMainnet.sendTransaction(
          child.transaction,
          child.signers
        );

        await connectionMainnet.confirmTransaction(signed, "confirmed");
      }

      toast.success(" Success! ", {
        action: {
          label: "View on Solscan",
          onClick: () => window.open(`https://solscan.io/tx/${sig1}`, "_blank"),
        },
      });
    } catch (error) {
      console.error("Error:", error);
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
                                  href={`https://solscan.io/account/${wallet.publicKey}?cluster=devnet`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  {wallet.publicKey}
                                </a>
                              </TableCell>
                              <TableCell>
                                {wallet.solAmount ?? "0"} SOL
                              </TableCell>
                              <TableCell>-</TableCell>
                              <TableCell>-</TableCell>
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
                        <div className="col-span-3">
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

                        <div className="col-span-3">
                          <button
                            type="button"
                            onClick={() => setTokenModalOpen(true)}
                            className="w-full flex items-center gap-2 p-3 border rounded-lg bg-gray-50 h-11 hover:bg-gray-100"
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
                                  <Input
                                    placeholder="Enter RPC URL"
                                    className="h-11"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="col-span-2">
                          <Button
                            variant="outline"
                            className="w-full h-11"
                            type="button"
                          >
                            More RPC
                            <ExternalLink className="h-4 w-4 ml-1" />
                          </Button>
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

                      {/* Fixed Amount Field - luôn render, chỉ ẩn/hiện */}
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
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Random Amount Fields - luôn render, chỉ ẩn/hiện */}
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

                      <FormField
                        control={form.control}
                        name="autoSell"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between">
                            <FormLabel>Auto sell</FormLabel>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
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
                              <Input placeholder="Custom quantity" {...field} />
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
                    </CardContent>
                  </Card>
                </div>
              </div>
            </form>
          </Form>
        </div>
      </div>

      <TokenSearchModal
        open={tokenModalOpen}
        onClose={() => setTokenModalOpen(false)}
        onSelect={(token) => {
          setSelectedToken(token);
          setTokenModalOpen(false);
        }}
      />
    </div>
  );
}
