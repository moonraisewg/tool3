"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useWallet } from "@solana/wallet-adapter-react";
import MultiTokenSelector from "./multi-token-selector";
import { useIsMobile } from "@/hooks/use-mobile";
import type { UserToken } from "@/hooks/useUserTokens";
import { connectionMainnet } from "@/service/solana/connection";
import { WSOL_MINT } from "@/utils/constants";
import { createMultiSwapToSolTransactions } from "@/lib/multi-swap-to-sol";

interface SelectedTokenData {
  token: UserToken;
  estimatedSol: string;
}

export default function SwapAllTokenFormMulti() {
  const isMobile = useIsMobile();
  const [selectedTokens, setSelectedTokens] = useState<SelectedTokenData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const { publicKey, signAllTransactions } = useWallet();

  const handleSwap = async () => {
    try {
      setLoading(true);

      if (!publicKey || !signAllTransactions) {
        toast.error("Please connect your wallet first");
        return;
      }

      if (selectedTokens.length === 0) {
        toast.error("Please select at least one token to swap");
        return;
      }

      for (const selectedToken of selectedTokens) {
        const tokenBalance = Number.parseFloat(selectedToken.token.balance);
        if (tokenBalance <= 0 || Number.isNaN(tokenBalance)) {
          toast.error(`Invalid balance for ${selectedToken.token.symbol}`);
          return;
        }
      }

      const swapData = selectedTokens.map((selectedToken) => ({
        inputTokenMint: selectedToken.token.address,
      }));

      const result = await createMultiSwapToSolTransactions(
        publicKey,
        swapData,
        3
      );

      const transactions = result.transactions.map(
        (txData) => txData.transaction
      );

      const signedTransactions = await signAllTransactions(transactions);

      const broadcastPromises = signedTransactions.map(async (signedTx) => {
        const signature = await connectionMainnet.sendRawTransaction(
          signedTx.serialize(),
          {
            skipPreflight: false,
            preflightCommitment: "confirmed",
            maxRetries: 3,
          }
        );
        return signature;
      });

      const signatures = await Promise.all(broadcastPromises);

      const confirmPromises = signatures.map(async (signature, index) => {
        const confirmation = await connectionMainnet.confirmTransaction(
          signature,
          "confirmed"
        );

        if (confirmation.value.err) {
          throw new Error(
            `Transaction ${index + 1} failed: ${JSON.stringify(
              confirmation.value.err
            )}`
          );
        }

        return signature;
      });

      await Promise.all(confirmPromises);
      const lastSignature = signatures[signatures.length - 1];

      toast.success(
        `🎉 Successfully swapped ${selectedTokens.length} token${
          selectedTokens.length !== 1 ? "s" : ""
        } to SOL!`,
        {
          description: `Completed in ${signatures.length} transaction${
            signatures.length !== 1 ? "s" : ""
          }. Estimated SOL: ${result.breakdown.totalExpectedSolOutput.toFixed(
            6
          )} SOL`,
          action: {
            label: "View Last Transaction",
            onClick: () => {
              window.open(`https://solscan.io/tx/${lastSignature}`, "_blank");
            },
          },
        }
      );

      setSelectedTokens([]);
    } catch (error) {
      console.error("Multi-swap failed:", error);
      const message =
        error instanceof Error ? error.message : "An unexpected error occurred";
      toast.error(`Multi-swap failed: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`md:p-2 max-w-[550px] mx-auto my-2 flex flex-col items-center ${
        !isMobile && "border-gear"
      }`}
    >
      <h1 className="text-2xl font-bold text-gray-900 mb-8 text-center ">
        Swap All Tokens To SOL
      </h1>

      <div className="mb-4 p-[8px] bg-green-50 border-gear-green-200 text-center w-[calc(100%-10px)]">
        <p className="text-sm text-green-800">⚡ Just $0.50 per transaction!</p>
      </div>

      <div className="space-y-4 flex flex-col justify-center w-full">
        <MultiTokenSelector
          selectedTokens={selectedTokens}
          onTokensChange={setSelectedTokens}
          excludeToken={["NativeSOL", WSOL_MINT]}
          disabled={loading}
        />

        <Button
          onClick={handleSwap}
          className="w-full text-white font-semibold py-2 rounded-lg transition-colors duration-200 cursor-pointer"
          variant="default"
          disabled={loading || selectedTokens.length === 0}
        >
          {loading
            ? "Processing Multi-Swap..."
            : `💫 Swap ${selectedTokens.length} Token${
                selectedTokens.length !== 1 ? "s" : ""
              } to SOL `}
        </Button>
      </div>
    </div>
  );
}
