"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { toast } from "sonner";
import { useWallet } from "@solana/wallet-adapter-react";
import SelectToken from "../transfer/select-token";
import ReceiveSolMainnet from "./receive-sol";
import { useIsMobile } from "@/hooks/use-mobile";
import { debounce } from "lodash";
import { Transaction } from "@solana/web3.js";
import { UserToken } from "@/hooks/useUserTokens";
import { WSOL_MINT } from "@/utils/constants";
import { getTokenFeeFromUsd } from "@/service/jupiter/calculate-fee";
import { connectionMainnet } from "../../service/solana/connection";

const formSchema = z.object({
  amount: z.string(),
  solAmount: z.string(),
});

export type FormSwapSol = z.infer<typeof formSchema>;

export default function SwapSolForm() {
  const isMobile = useIsMobile();
  const [selectedToken, setSelectedToken] = useState<UserToken | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [priceLoading, setPriceLoading] = useState<boolean>(false);
  const [tokenFee, setTokenFee] = useState<number>(0);
  const { publicKey, signAllTransactions } = useWallet();

  const form = useForm<FormSwapSol>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: "",
      solAmount: "",
    },
  });

  useEffect(() => {
    const calculateTokenFee = async () => {
      if (selectedToken && publicKey) {
        try {
          const tokenFeeAmount = await getTokenFeeFromUsd(
            selectedToken.address,
            0.5,
            publicKey.toString()
          );
          setTokenFee(tokenFeeAmount);
        } catch (error) {
          console.error("Error calculating token fee:", error);
          setTokenFee(0);
        }
      } else {
        setTokenFee(0);
      }
    };

    calculateTokenFee();
  }, [selectedToken, publicKey]);

  const fetchSwapQuote = useCallback(
    async (inputAmount: string, isCalculatingSol: boolean) => {
      try {
        setPriceLoading(true);
        if (!inputAmount || Number(inputAmount) === 0 || !selectedToken) {
          form.setValue(isCalculatingSol ? "solAmount" : "amount", "");
          return;
        }

        const amountValue = parseFloat(inputAmount);
        if (isNaN(amountValue) || amountValue <= 0) {
          form.setValue(isCalculatingSol ? "solAmount" : "amount", "");
          return;
        }

        let response;

        if (isCalculatingSol) {
          const inputAmountInLamports = Math.round(
            amountValue * Math.pow(10, selectedToken.decimals || 0)
          );

          response = await fetch(
            `https://lite-api.jup.ag/swap/v1/quote?inputMint=${selectedToken.address}&outputMint=So11111111111111111111111111111111111111112&amount=${inputAmountInLamports}&slippageBps=100&swapMode=ExactIn`
          );
        } else {
          const solAmountInLamports = Math.round(amountValue * Math.pow(10, 9));

          response = await fetch(
            `https://lite-api.jup.ag/swap/v1/quote?inputMint=${selectedToken.address}&outputMint=So11111111111111111111111111111111111111112&amount=${solAmountInLamports}&slippageBps=100&swapMode=ExactOut`
          );
        }

        if (!response.ok) {
          throw new Error("Failed to fetch quote");
        }

        const quote = await response.json();

        if (isCalculatingSol) {
          const solAmount = parseFloat(quote.outAmount) / Math.pow(10, 9);
          form.setValue("solAmount", solAmount.toFixed(6));
        } else {
          const tokenAmount =
            parseFloat(quote.inAmount) /
            Math.pow(10, selectedToken.decimals || 0);
          form.setValue(
            "amount",
            tokenAmount.toFixed(selectedToken.decimals || 6)
          );
        }
      } catch (e) {
        console.error("Failed to fetch swap quote:", e);
        form.setValue(isCalculatingSol ? "solAmount" : "amount", "");
        toast.error("Failed to fetch swap quote");
      } finally {
        setPriceLoading(false);
      }
    },
    [selectedToken, form]
  );

  const debouncedFetchQuote = useMemo(() => {
    return debounce((amount: string, isCalculatingSol: boolean) => {
      fetchSwapQuote(amount, isCalculatingSol);
    }, 300);
  }, [fetchSwapQuote]);

  const onSubmit = async (values: FormSwapSol) => {
    try {
      setLoading(true);

      if (!publicKey || !signAllTransactions) {
        toast.error("Please connect your wallet first");
        return;
      }

      if (!selectedToken) {
        toast.error("Please select a token to swap");
        return;
      }

      const tokenAmount = parseFloat(values.amount);
      const solAmount = parseFloat(values.solAmount);

      if (tokenAmount > parseFloat(selectedToken.balance)) {
        toast.error(`Insufficient ${selectedToken.symbol} balance`);
        return;
      }

      if (
        tokenAmount <= 0 ||
        Number.isNaN(tokenAmount) ||
        solAmount <= 0 ||
        Number.isNaN(solAmount)
      ) {
        toast.error("Amount must be greater than 0");
        return;
      }

      const swapData = {
        walletPublicKey: publicKey.toString(),
        inputTokenMint: selectedToken.address,
        inputAmount: tokenAmount,
      };

      const response = await fetch("/api/swap-sol", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(swapData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to prepare swap transaction");
      }

      const swapTx = Transaction.from(
        Buffer.from(data.swapTransaction, "base64")
      );
      const unwrapTx = Transaction.from(
        Buffer.from(data.unwrapTransaction, "base64")
      );

      const [signedSwapTx, signedUnwrapTx] = await signAllTransactions([
        swapTx,
        unwrapTx,
      ]);

      const swapSignature = await connectionMainnet.sendRawTransaction(
        signedSwapTx.serialize()
      );
      const swapConfirmation = await connectionMainnet.confirmTransaction(
        swapSignature
      );

      if (swapConfirmation.value.err) {
        throw new Error("Swap failed");
      }

      const unwrapSignature = await connectionMainnet.sendRawTransaction(
        signedUnwrapTx.serialize()
      );
      const unwrapConfirmation = await connectionMainnet.confirmTransaction(
        unwrapSignature
      );

      if (swapConfirmation.value.err) {
        throw new Error(
          `Transaction failed: ${JSON.stringify(swapConfirmation.value.err)}`
        );
      }

      if (unwrapConfirmation.value.err) {
        throw new Error(
          `Transaction failed: ${JSON.stringify(unwrapConfirmation.value.err)}`
        );
      }

      toast.success("🎉 Gasless Swap to SOL Successful!", {
        description: `Swapped ${values.amount} ${selectedToken.symbol} for ${values.solAmount} SOL`,
        action: {
          label: "View Transaction",
          onClick: () =>
            window.open(`https://solscan.io/tx/${swapSignature}`, "_blank"),
        },
      });

      setSelectedToken(null);
      form.reset();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An unexpected error occurred";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const amount = form.getValues("amount");
    if (amount && selectedToken) {
      debouncedFetchQuote(amount, true);
    }
  }, [selectedToken, debouncedFetchQuote, form]);

  return (
    <div
      className={`md:p-2 max-w-[550px] mx-auto my-2 flex flex-col items-center ${!isMobile && "border-gear"
        }`}
    >
      <h1 className="text-2xl font-bold text-gray-900 mb-8 text-center">
        Gasless Swap to SOL
      </h1>

      <div className="mb-6 p-[8px] bg-green-50 border-gear-green-200 w-[calc(100%-10px)]">
        <p className="text-sm text-green-800">
          ⚡ <strong>No SOL ownership required:</strong> Just $0.50 per
          transaction!
        </p>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4 flex flex-col justify-center w-full"
        >
          <div className="px-[5px] space-y-6">
            <SelectToken
              title="You Pay"
              selectedToken={selectedToken}
              setSelectedToken={setSelectedToken}
              amount={form.watch("amount")}
              onAmountChange={(value) => {
                form.setValue("amount", value);
                debouncedFetchQuote(value, true);
              }}
              excludeToken={["NativeSOL", WSOL_MINT]}
              tokenFee={tokenFee}
            />

            <ReceiveSolMainnet
              form={form}
              priceLoading={priceLoading}
              allowEdit={true}
              onAmountChange={(value) => {
                form.setValue("solAmount", value);
                debouncedFetchQuote(value, false);
              }}
            />
          </div>

          <Button
            type="submit"
            className="w-full text-white font-semibold py-2 rounded-lg transition-colors duration-200 cursor-pointer mt-4"
            variant="default"
            disabled={loading || !selectedToken}
          >
            {loading ? "Processing..." : "💫 Swap to SOL"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
