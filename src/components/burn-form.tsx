"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Info, Wallet, Loader2 } from "lucide-react";
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
import { VersionedTransaction } from "@solana/web3.js";

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

export default function Burn() {
  const [isLoading, setIsLoading] = useState(false);
  const [userLpBalance, setUserLpBalance] = useState("0.00");
  const { publicKey, signTransaction } = useWallet();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      poolId: "",
      amount: "",
    },
  });

  const fetchUserLpBalance = async (poolId: string) => {
    try {
      if (!publicKey) return "0.00";
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
        return result.balance.toFixed(3);
      } else {
        toast.error(result.error || "Failed to fetch LP balance. Please try again.")
      }
      return "0.00";
    } catch (error) {
      console.error("Error fetching LP balance:", error);
      return "0.00";
    }
  };

  const handlePoolIdChange = async (value: string) => {
    form.setValue("poolId", value);
  };

  const handleKeyDown = async (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const poolId = form.getValues("poolId");
      if (!publicKey) {
        toast.error("Please connect your wallet before entering Pool ID");
        return;
      }
      if (poolId) {
        try {
          setIsLoading(true);
          const balance = await fetchUserLpBalance(poolId);
          setUserLpBalance(balance);
        } catch (error: unknown) {
          let message = "Cannot get pool information. Please check Pool ID.";

          if (error instanceof Error) {
            message = error.message;
          }

          toast.error(message);
          setUserLpBalance("0.00");
        } finally {
          setIsLoading(false);
        }
      } else {
        toast.error("Please enter Pool ID");
      }
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsLoading(true);
      if (!publicKey || !signTransaction) {
        toast.error("Please connect your wallet first");
        return;
      }

      const burnAmount = parseFloat(values.amount);
      if (isNaN(burnAmount) || burnAmount <= 0) {
        toast.error("Burn amount must be greater than 0");
        return;
      }

      if (burnAmount > parseFloat(userLpBalance)) {
        toast.error("Burn amount cannot exceed your LP token balance");
        return;
      }

      const formattedAmount = burnAmount.toFixed(9);

      const burnData = {
        walletPublicKey: publicKey.toString(),
        amount: formattedAmount,
        poolId: values.poolId,
      };

      const response = await fetch("/api/burn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(burnData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Burn token failed");
      }

      if (data.success && data.transactions && data.transactions.length > 0) {
        for (const serializedTx of data.transactions) {
          try {
            const transactionBuffer = Buffer.from(serializedTx, "base64");

            const transaction = VersionedTransaction.deserialize(transactionBuffer);

            const signedTx = await signTransaction(transaction);
            if (!signedTx) {
              throw new Error("Transaction was not signed");
            }

            const txId = await connection.sendRawTransaction(
              signedTx.serialize(),
              { skipPreflight: false, preflightCommitment: "confirmed" }
            );

            const confirmation = await connection.confirmTransaction(txId, "confirmed");
            if (confirmation.value.err) {
              throw new Error("Transaction failed to confirm");
            }

            console.log("Transaction confirmed:", txId);
          } catch (error: unknown) {
            console.error("Transaction error:", error);

            if (error instanceof Error) {
              if (error.message === "User rejected the request") {
                throw new Error("You rejected the transaction");
              }
              throw new Error("Cannot sign or send transaction: " + error.message);
            }

            throw new Error("Unknown error occurred while signing or sending transaction");
          }
        }

        toast.success("Burn token successful", {
          description: `You have burned ${values.amount} LP tokens`,
        });

        form.reset();
        const newBalance = await fetchUserLpBalance(values.poolId);
        setUserLpBalance(newBalance);
      } else {
        throw new Error("Not receiving transactions from API");
      }
    } catch (error: unknown) {
      const message = error instanceof Error
        ? error.message
        : "Burn token failed. Please try again.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const setHalf = () => {
    const halfAmount = (Number.parseFloat(userLpBalance) / 2).toFixed(3);
    form.setValue("amount", halfAmount);
  };

  const setMax = () => {
    form.setValue("amount", userLpBalance);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Burn LP Tokens</h1>

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
                      className="border-gray-300 bg-white text-gray-900 focus:border-green-500 focus:ring-green-500"
                      placeholder="Enter Pool ID"
                      {...field}
                      onChange={(e) => handlePoolIdChange(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={isLoading}
                    />
                    {isLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="h-5 w-5 animate-spin rounded-full border-4 border-green-600 border-t-transparent"></div>
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
                <FormLabel className="text-gray-900">Burn Amount</FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      step="0.00001"
                      className="border-gray-300 bg-white text-gray-900 focus:border-green-500 focus:ring-green-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (Number(value) >= 0) {
                          field.onChange(value);
                        }
                      }}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-gray-300 bg-white text-gray-700 hover:bg-green-100 hover:text-green-900 cursor-pointer"
                    onClick={setHalf}
                    disabled={isLoading}
                  >
                    Half
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-gray-300 bg-white text-gray-700 hover:bg-green-100 hover:text-green-900 cursor-pointer"
                    onClick={setMax}
                    disabled={isLoading}
                  >
                    Max
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <Card className="border-gray-300 bg-white">
            <CardContent className="py-0 px-4 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Wallet className="h-4 w-4 text-green-400" />
                  <span className="text-gray-700">Your LP Balance</span>
                </div>
                <div className="font-medium text-gray-900">
                  {isLoading ? "Loading..." : `${userLpBalance} LP`}
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            disabled={isLoading || !publicKey}
            className="w-full bg-gradient-to-r from-green-600 to-green-800 text-white hover:from-green-700 hover:to-green-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </span>
            ) : !publicKey ? (
              "Connect Wallet"
            ) : (
              "Burn Tokens"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
