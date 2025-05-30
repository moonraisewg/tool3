"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Info, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useWallet } from "@solana/wallet-adapter-react";
import { connection } from "../service/solana/connection";
import { Transaction } from "@solana/web3.js";
import { add, format, fromUnixTime } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { debounce } from "lodash";

const formSchema = z.object({
  poolId: z.string().min(1, {
    message: "Pool ID is required",
  }),
  lockPeriod: z.string().min(1, {
    message: "Lock period is required",
  }),
  amount: z.string().min(1, {
    message: "Amount is required",
  }),
});

export default function LpLockForm() {
  const isMobile = useIsMobile();
  const [userLpBalance, setUserLpBalance] = useState("0.00");
  const [tokenMint, setTokenMint] = useState("");
  const [loading, setLoading] = useState(false);
  const { publicKey, signTransaction } = useWallet();
  const searchParams = useSearchParams();

  const getLockTimestamp = (period: string): number => {
    const now = new Date();
    let unlockDate: Date;

    switch (period) {
      case "6months":
        unlockDate = add(now, { minutes: 15 });
        break;
      case "1year":
        unlockDate = add(now, { years: 1 });
        break;
      case "2years":
        unlockDate = add(now, { years: 2 });
        break;
      case "3years":
        unlockDate = add(now, { years: 3 });
        break;
      default:
        return 0;
    }

    return Math.floor(unlockDate.getTime() / 1000);
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      poolId: "",
      lockPeriod: "",
      amount: "",
    },
  });

  const fetchPoolInfo = useCallback(
    async (poolId: string) => {
      if (!publicKey) {
        toast.error("Please connect your wallet before fetching pool info");
        return;
      }
      if (!poolId) {
        toast.error("Please enter a Pool ID");
        return;
      }
      try {
        setLoading(true);
        const response = await fetch("/api/fetch-lp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            poolId,
            userPublicKey: publicKey.toString(),
          }),
        });
        const result = await response.json();
        if (response.ok && result) {
          setUserLpBalance(result.balance.toFixed(3));
          setTokenMint(result.lpMint);
        } else {
          throw new Error(result.error || "Pool information not found");
        }
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : "Cannot get pool information. Please check Pool ID.";
        toast.error(message);
        setUserLpBalance("0.00");
        setTokenMint("");
      } finally {
        setLoading(false);
      }
    },
    [publicKey]
  );

  const debouncedFetchPoolInfo = useMemo(() => {
    return debounce((poolId: string) => {
      fetchPoolInfo(poolId);
    }, 1000);
  }, [fetchPoolInfo]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setLoading(true);
      if (!publicKey || !signTransaction) {
        toast.error("Please connect your wallet first");
        return;
      }

      if (parseFloat(values.amount) > parseFloat(userLpBalance)) {
        toast.error("Insufficient balance");
        return;
      }

      if (!tokenMint) {
        toast.error("Token information not found");
        return;
      }

      const unlockTimestamp = getLockTimestamp(values.lockPeriod);
      if (unlockTimestamp === 0) {
        toast.error("Invalid lock period");
        return;
      }

      const depositData = {
        walletPublicKey: publicKey.toString(),
        amount: parseFloat(values.amount),
        unlockTimestamp,
        poolId: values.poolId,
        tokenMint,
      };

      const response = await fetch("/api/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(depositData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Lock token failed");
      }

      if (data.success && data.transaction) {
        try {
          const transaction = Transaction.from(
            Buffer.from(data.transaction, "base64")
          );

          const signedTx = await signTransaction(transaction);

          const txId = await connection.sendRawTransaction(
            signedTx.serialize()
          );

          await connection.confirmTransaction({
            signature: txId,
            blockhash: data.blockhash,
            lastValidBlockHeight: data.lastValidBlockHeight,
          });

          toast.success(
            <div>
              Lock token successful
              <div>
                You have locked {values.amount} LP tokens for {values.lockPeriod}
              </div>
              <a
                href={`https://solscan.io/tx/${txId}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 underline"
              >
                View on Solscan
              </a>
            </div>,
            {
              duration: 10000,
            }
          );
        } catch (error: unknown) {
          console.error("Transaction error:", error);
          throw new Error("Cannot sign or send transaction");
        }
      } else {
        throw new Error("No transaction received from API");
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Lock token failed. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handlePoolIdChange = (value: string) => {
    form.setValue("poolId", value);
    debouncedFetchPoolInfo(value);
  };

  const setHalf = () => {
    const halfAmount = (Number.parseFloat(userLpBalance) / 2).toFixed(3);
    form.setValue("amount", halfAmount);
  };

  const setMax = () => {
    form.setValue("amount", userLpBalance);
  };

  useEffect(() => {
    const poolId = searchParams.get("poolId");
    if (poolId && publicKey) {
      form.setValue("poolId", poolId);
      fetchPoolInfo(poolId);
    }
  }, [searchParams, publicKey, fetchPoolInfo, form]);
  return (
    <div className={`md:p-3 max-w-[550px] mx-auto my-2 ${!isMobile && "border-gear"}`}>
      <div className="text-2xl font-bold text-gray-900 mb-6 flex items-center justify-center">
        Lock LP Tokens
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="px-[4px] space-y-6">
            <FormField
              control={form.control}
              name="poolId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-900">
                    Pool ID
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="ml-2 h-4 w-4 text-gray-500 mb-[3px]" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            Enter the unique identifier for the liquidity pool
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </FormLabel>
                  <FormControl>
                    <div className="relative mt-1">
                      <Input
                        className="border-gear-gray h-[28px] bg-white text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                        placeholder="Enter Pool ID"
                        {...field}
                        onChange={(e) => handlePoolIdChange(e.target.value)}
                        disabled={loading}
                      />
                      {loading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="h-5 w-5 animate-spin rounded-full border-4 border-purple-600 border-t-transparent"></div>
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-900">Lock Amount</FormLabel>
                  <div className="flex items-center gap-4 mt-1">
                    <FormControl>
                      <Input
                        className="border-gear-gray h-[28px] bg-white text-gray-900 focus:border-purple-500 focus:ring-purple-500 "
                        placeholder="0.00"
                        {...field}
                        disabled={loading}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (Number(value) >= 0) {
                            field.onChange(value);
                          }
                        }}
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-gear-gray h-[28px] bg-white text-gray-700 hover:text-purple-900 cursor-pointer hover:bg-white"
                      onClick={setHalf}
                      disabled={loading}
                    >
                      Half
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-gear-gray h-[28px] bg-white text-gray-700 hover:text-purple-900 cursor-pointer hover:bg-white"
                      onClick={setMax}
                      disabled={loading}
                    >
                      Max
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lockPeriod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-900">
                    Lock Duration
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-gray-500 mb-[1px]" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            Select the duration you want to lock your LP tokens
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={loading}
                  >
                    <FormControl>
                      <SelectTrigger className="border-gear-gray !h-[28px] !mt-1 bg-white text-gray-900 focus:border-purple-500 focus:ring-purple-500 cursor-pointer">
                        <SelectValue placeholder="Select lock duration" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="border-gray-300 bg-white text-gray-900">
                      <SelectItem value="6months" className="cursor-pointer">6 months</SelectItem>
                      <SelectItem value="1year" className="cursor-pointer">1 years</SelectItem>
                      <SelectItem value="2years" className="cursor-pointer">2 years</SelectItem>
                      <SelectItem value="3years" className="cursor-pointer">3 years</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Card className="border-gear-gray bg-white py-4">
              <CardContent className="py-2 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Wallet className="h-4 w-4 text-purple-400" />
                    <span className="text-gray-700">Your LP Balance</span>
                  </div>
                  <div className="font-medium text-gray-900">
                    {loading ? "Loading..." : `${userLpBalance} LP`}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="border-gear-gray bg-white p-4 !mt-6 py-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Unlock Date</span>
                {form.watch("lockPeriod")
                  ? format(
                    fromUnixTime(getLockTimestamp(form.watch("lockPeriod"))),
                    "dd/MM/yyyy"
                  )
                  : "--"}
              </div>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full cursor-pointer mt-3"
            variant="default"
            disabled={loading}
          >
            Lock LP Token
          </Button>
        </form>
      </Form>
    </div>
  );
}