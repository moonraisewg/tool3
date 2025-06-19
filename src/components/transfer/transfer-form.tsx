"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import SelectToken, { UserToken } from "./select-token";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWatch } from "react-hook-form";

const formSchema = z.object({
  recipient: z
    .string()
    .min(1, { message: "Recipient address is required" })
    .regex(/^[\w]{32,44}$/, { message: "Invalid Solana address" }),
  amount: z.string(),
});

export default function TransferForm() {
  const isMobile = useIsMobile();
  const [selectedToken, setSelectedToken] = useState<UserToken | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [estimatedFee, setEstimatedFee] = useState<number>(0.5);
  const [feeLoading, setFeeLoading] = useState(false);
  const { publicKey, signTransaction } = useWallet();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      recipient: "",
      amount: "",
    },
  });

  const recipient = useWatch({ control: form.control, name: "recipient" });

  useEffect(() => {
    const checkFee = async () => {
      if (recipient && selectedToken && recipient.length >= 32) {
        setFeeLoading(true);
        try {
          const response = await fetch("/api/calculate-fee", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipientAddress: recipient,
              tokenMint: selectedToken.address,
            }),
          });
          const data = await response.json();
          setEstimatedFee(data.fee || 0.5);
        } catch (error) {
          console.error("Error checking fee:", error);
          setEstimatedFee(0.5);
        }
        setFeeLoading(false);
      } else {
        setEstimatedFee(0.5);
      }
    };

    checkFee();
  }, [recipient, selectedToken]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setLoading(true);

      if (!publicKey || !signTransaction) {
        toast.error("Please connect your wallet first");
        return;
      }

      if (!selectedToken) {
        toast.error("Please select a token");
        return;
      }

      const amountValue = parseFloat(values.amount);

      if (amountValue > parseFloat(selectedToken.balance)) {
        toast.error("Insufficient balance");
        return;
      }

      if (amountValue <= 0 || Number.isNaN(amountValue)) {
        toast.error("Amount must be greater than 0");
        return;
      }

      const prepareData = {
        walletPublicKey: publicKey.toString(),
        tokenAmount: amountValue,
        receiverWalletPublicKey: values.recipient,
        tokenMint: selectedToken.address,
      };

      const prepareResponse = await fetch("/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prepareData),
      });

      const prepareResult = await prepareResponse.json();

      if (!prepareResponse.ok) {
        throw new Error(prepareResult.error || "Failed to prepare transaction");
      }

      const transaction = Transaction.from(
        Buffer.from(prepareResult.transaction, "base64")
      );
      const signedTransaction = await signTransaction(transaction);

      const executeData = {
        walletPublicKey: publicKey.toString(),
        tokenAmount: amountValue,
        receiverWalletPublicKey: values.recipient,
        tokenMint: selectedToken.address,
        signedTransaction: Array.from(signedTransaction.serialize()),
      };

      const executeResponse = await fetch("/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(executeData),
      });

      const executeResult = await executeResponse.json();

      if (!executeResponse.ok) {
        throw new Error(executeResult.error || "Failed to execute transaction");
      }

      toast.success("🎉 Gasless Transfer Successful!", {
        description: `Transferred ${values.amount} ${
          selectedToken.symbol || selectedToken.name
        } to ${values.recipient.slice(0, 8)}...${values.recipient.slice(-8)}`,
        action: {
          label: "View Transaction",
          onClick: () =>
            window.open(
              `https://solscan.io/tx/${executeResult.signature}`,
              "_blank"
            ),
        },
      });

      form.reset();
      setSelectedToken(null);
    } catch (error: unknown) {
      console.error("Transfer error:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Transfer failed. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`md:p-2 max-w-[550px] mx-auto my-2 ${
        !isMobile && "border-gear"
      }`}
    >
      <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
        Tool3 - Powerful All-in-One Token Tool
      </h1>

      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          💰 <strong>Estimated Fee:</strong>{" "}
          {feeLoading ? (
            <span className="text-gray-600">Calculating...</span>
          ) : (
            <span className="font-semibold">
              ${estimatedFee.toFixed(3)} USDT
            </span>
          )}
        </p>
      </div>

      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          💰 <strong>Estimated Fee:</strong>{" "}
          {feeLoading ? (
            <span className="text-gray-600">Calculating...</span>
          ) : (
            <span className="font-semibold">
              ${estimatedFee.toFixed(3)} USDT
            </span>
          )}
        </p>
      </div>

      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-sm text-green-800">
          ⚡ <strong>100% Gasless:</strong> No SOL needed!
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="px-[5px] space-y-6">
            <FormField
              control={form.control}
              name="recipient"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-900">
                    Recipient Address
                  </FormLabel>
                  <FormControl>
                    <Input
                      className="border-gray-300 bg-white text-gray-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 rounded-lg"
                      placeholder="Enter recipient Solana address"
                      {...field}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage className="text-red-500 text-sm mt-1" />
                </FormItem>
              )}
            />

            <SelectToken
              selectedToken={selectedToken}
              setSelectedToken={setSelectedToken}
              onAmountChange={(value) => {
                form.setValue("amount", value);
              }}
              externalAmount={form.watch("amount")}
            />
          </div>

          <Button
            type="submit"
            className="w-full text-white font-semibold py-2 rounded-lg transition-colors duration-200"
            variant="default"
            disabled={loading || !selectedToken || !publicKey}
          >
            {loading ? "Processing..." : "🚀Transfer"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
