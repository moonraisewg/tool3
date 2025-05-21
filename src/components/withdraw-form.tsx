"use client";

import { useState } from "react";
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
  const [loading, setLoading] = useState(false);
  const [userLpBalance, setUserLpBalance] = useState("0.00");
  const { publicKey, signTransaction } = useWallet();
  const [unlockInfo, setUnlockInfo] = useState<{
    isUnlocked: boolean;
    unlockTimestamp: number;
    remainingTime: number;
  } | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      poolId: "",
      amount: "",
    },
  });

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

      console.log(withdrawData);

      const response = await fetch("/api/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(withdrawData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Token withdrawal failed.");
      }

      if (data.success && data.transactions && data.transactions.length > 0) {
        for (const serializedTx of data.transactions) {
          const transaction = Transaction.from(
            Buffer.from(serializedTx, "base64")
          );
          try {
            const signedTx = await signTransaction(transaction);
            const txId = await connection.sendRawTransaction(
              signedTx.serialize()
            );
            await connection.confirmTransaction(txId);
          } catch (error: any) {
            throw new Error("Unable to sign or send the transaction.");
          }
        }

        toast.success("Withdraw token successfully", {
          description: `You have withdrawn ${values.amount} LP token `,
        });
      } else {
        throw new Error("Did not receive the transaction from the API.");
      }
    } catch (error: any) {
      toast.error(
        error.message || "Token withdrawal failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const setHalf = () => {
    // const halfAmount = (Number.parseFloat(userLpBalance) / 2).toFixed(3);
    const halfAmount = (Number.parseFloat(userLpBalance) / 2).toFixed(6);
    form.setValue("amount", halfAmount);
  };

  const setMax = () => {
    form.setValue("amount", userLpBalance);
  };

  const handlePoolIdChange = async (value: string) => {
    form.setValue("poolId", value);
  };

  const handleKeyDown = async (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter") {
      const poolId = form.getValues("poolId")?.trim();
      event.preventDefault();
      if (!publicKey) {
        toast.error("Please connect your wallet before entering the Pool ID.");
        return;
      }
      if (poolId) {
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
            // setUserLpBalance(result.amount.toFixed(3));
            setUserLpBalance(result.amount);
            setUnlockInfo({
              isUnlocked: result.isUnlocked,
              unlockTimestamp: Number(result.unlockTimestamp),
              remainingTime: result.remainingTime,
            });
          } else {
            throw new Error(result.error || "Pool information not found.");
          }
        } catch (error: any) {
          toast.error(
            error.message ||
            "Unable to fetch pool information. Please check the Pool ID."
          );
          setUserLpBalance("0.00");
        } finally {
          setLoading(false);
        }
      } else {
        toast.error("Please enter the Pool ID.");
      }
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Withdraw LP Tokens
      </h1>

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
                      onKeyDown={handleKeyDown}
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
          <Card className="border-gray-300 bg-white">
            <CardContent className="py-0 px-4 pt-2">
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

          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-900">Withdraw Amount</FormLabel>
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

          <Button
            type="submit"
            disabled={loading || (!!unlockInfo && !unlockInfo.isUnlocked)}
            className={`w-full text-white cursor-pointer ${!!unlockInfo && !unlockInfo.isUnlocked
              ? "bg-red-600 hover:bg-red-700 disabled:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              : "bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 disabled:opacity-50 disabled:cursor-not-allowed"
              }`}
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
