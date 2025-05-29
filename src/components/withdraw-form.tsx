"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Info, Loader2, Wallet } from "lucide-react";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useWallet } from "@solana/wallet-adapter-react";
import { connection } from "../service/solana/connection";
import { Transaction } from "@solana/web3.js";
import { useIsMobile } from "@/hooks/use-mobile";
import { debounce } from "lodash";

const formatRemainingTime = (seconds: number): string => {
  if (seconds <= 0) return "Locked";

  const days = Math.floor(seconds / (24 * 3600));
  seconds %= 24 * 3600;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? "s" : ""}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? "s" : ""}`);

  return parts.length > 0 ? `Locked for ${parts.join(", ")}` : "Locked";
};

const formSchema = z.object({
  poolId: z.string().min(1, {
    message: "Pool ID is required",
  }),
  amount: z
    .string()
    .min(1, {
      message: "Amount is required",
    })
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Amount must be greater than 0",
    }),
});

export default function Withdraw() {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [userLpBalance, setUserLpBalance] = useState("0.00");
  const { publicKey, signTransaction } = useWallet();
  const [unlockInfo, setUnlockInfo] = useState<{
    isUnlocked: boolean;
    unlockTimestamp: number;
    remainingTime: number;
  } | null>(null);
  const searchParams = useSearchParams(); // Get URL query parameters

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      poolId: "",
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
        const response = await fetch("/api/fetch-user-lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            poolId,
            walletPublicKey: publicKey.toString(),
          }),
        });
        const result = await response.json();
        if (response.ok && result) {
          setUserLpBalance(result.amount.toFixed(3));
          setUnlockInfo({
            isUnlocked: result.isUnlocked,
            unlockTimestamp: Number(result.unlockTimestamp),
            remainingTime: result.remainingTime,
          });
        } else {
          throw new Error(result.error || "Pool information not found.");
        }
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to fetch pool information. Please check the Pool ID.";
        toast.error(message);
        setUserLpBalance("0.00");
        setUnlockInfo(null);
      } finally {
        setLoading(false);
      }
    },
    [publicKey, setUserLpBalance, setUnlockInfo, setLoading]
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
        toast.error("Please connect wallet first");
        return;
      }

      const withdrawData = {
        walletPublicKey: publicKey.toString(),
        amount: parseFloat(values.amount),
        poolId: values.poolId,
      };

      const response = await fetch("/api/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(withdrawData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Token withdrawal failed");
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
              Withdraw token successful
              <div>
                You have withdrawn {values.amount} LP tokens
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
          : "Token withdrawal failed. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const setHalf = () => {
    const halfAmount = (Number.parseFloat(userLpBalance) / 2).toFixed(3);
    form.setValue("amount", halfAmount);
  };

  const setMax = () => {
    form.setValue("amount", userLpBalance);
  };

  const handlePoolIdChange = (value: string) => {
    form.setValue("poolId", value);
    debouncedFetchPoolInfo(value);
  };


  useEffect(() => {
    const poolId = searchParams.get("poolId")?.trim();
    if (poolId && publicKey) {
      form.setValue("poolId", poolId);
      fetchPoolInfo(poolId);
    }
  }, [searchParams, publicKey, fetchPoolInfo, form]);

  return (
    <div className={`md:p-2 max-w-[550px] mx-auto my-2 ${!isMobile && "border-gear"}`}>
      <div className="text-2xl font-bold text-gray-900 mb-10 flex items-center justify-center ">
        Withdraw LP Tokens
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                  <div className="relative">
                    <Input
                      className="border-gray-300 bg-white text-gray-900 focus:border-purple-500 focus:ring-purple-500"
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
                <FormLabel className="text-gray-900">
                  Withdraw Amount
                </FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Input
                      type="number"
                      className="border-gray-300 bg-white text-gray-900 focus:border-purple-500 focus:ring-purple-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="0.00"
                      disabled={!!unlockInfo && !unlockInfo.isUnlocked}
                      {...field}
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
                    className="border-gray-300 bg-white text-gray-700 hover:bg-purple-100 hover:text-purple-900 cursor-pointer"
                    onClick={setHalf}
                  >
                    Half
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-gray-300 bg-white text-gray-700 hover:bg-purple-100 hover:text-purple-900 cursor-pointer"
                    onClick={setMax}
                  >
                    Max
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <Card className="border-gray-300 bg-white">
            <CardContent className="py-2 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Wallet className="h-4 w-4 text-purple-400" />
                  <span className="text-gray-700">Your LP Balance</span>
                </div>
                <div className="font-medium text-gray-900">
                  {userLpBalance} LP
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            disabled={loading || (!!unlockInfo && !unlockInfo.isUnlocked)}
            className={`w-full text-white cursor-pointer ${!!unlockInfo && !unlockInfo.isUnlocked
              ? "disabled:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              : " disabled:opacity-50 disabled:cursor-not-allowed"
              }`}
            variant="default"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </span>
            ) : !!unlockInfo && !unlockInfo.isUnlocked ? (
              formatRemainingTime(unlockInfo.remainingTime)
            ) : (
              "Withdraw Tokens"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
