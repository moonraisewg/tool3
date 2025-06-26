"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { Check, ExternalLink, Flame, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { burnToken, TokenBurnResult } from "@/service/token/token-extensions/tool/burn-token-extension";
import { Separator } from "@/components/ui/separator";
import SelectToken from "@/components/transfer/select-token";
import React from "react";
import { UserToken } from "@/hooks/useUserTokens";
import { useIsMobile } from "@/hooks/use-mobile";

const Alert = ({ className, children }: { className?: string, children: React.ReactNode }) => (
  <div className={`p-4 rounded-md ${className}`}>{children}</div>
);

const AlertTitle = ({ children }: { children: React.ReactNode }) => (
  <h5 className="font-medium mb-1">{children}</h5>
);

const AlertDescription = ({ children }: { children: React.ReactNode }) => (
  <div className="text-sm">{children}</div>
);

export interface BurnFormProps {
  [key: string]: never;
}

export function BurnForm({ }: BurnFormProps) {
  const wallet = useWallet();
  const { connected } = wallet;
  const { connection } = useConnection();
  const isMobile = useIsMobile();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedToken, setSelectedToken] = useState<UserToken | null>(null);
  const [amount, setAmount] = useState("");
  const [burnInProgress, setBurnInProgress] = useState(false);
  const [burnSuccess, setBurnSuccess] = useState(false);
  const [burnResult, setBurnResult] = useState<TokenBurnResult | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [cluster, setCluster] = useState<"mainnet" | "devnet">("mainnet");

  const handleTokensLoaded = () => {
    setIsLoading(false);
  };
  
  useEffect(() => {
    const urlCluster = window.location.href.includes('cluster=devnet') ? 'devnet' : 'mainnet';
    setCluster(urlCluster);
  }, []);

  const handleAmountChange = (amount: string) => {
    setAmount(amount);
  };

  const handleCloseBurnDialog = () => {
    setBurnSuccess(false);
    setBurnResult(null);
    setAmount("");
  };

  const openConfirmDialog = () => {
    if (!connected) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!selectedToken) {
      toast.error("Please select a token");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const tokenBalance = parseFloat(selectedToken.balance);
    if (parseFloat(amount) > tokenBalance) {
      toast.error(`Insufficient balance. You only have ${tokenBalance} ${selectedToken.symbol}`);
      return;
    }

    setShowConfirmDialog(true);
  };

  const handleBurn = async () => {
    if (!connected || !selectedToken || !amount) {
      toast.error("Please fill in all required information");
      return;
    }

    setShowConfirmDialog(false);
    setBurnInProgress(true);

    let toastId: string | number | undefined;

    try {
      toastId = toast.loading("Processing burn transaction...");

      const result = await burnToken(
        connection,
        wallet,
        {
          mintAddress: selectedToken.address,
          amount: amount,
          decimals: selectedToken.decimals || 0
        },
        {
          onStart: () => { },
          onSuccess: () => {
            toast.dismiss(toastId);
            toast.success("Token burned successfully!");
          },
          onError: (err) => {
            toast.dismiss(toastId);
            toast.error(`Burn failed: ${err.message}`);
          },
          onFinish: () => setBurnInProgress(false)
        }
      );

      if (result) {
        console.log("Transaction signature:", result.signature);
        toast.dismiss(toastId);
        setBurnResult(result);
        setBurnSuccess(true);

        // Reloading tokens will happen automatically through parent components
      }
    } catch (error: unknown) {
      console.error("Error in burn:", error);
      if (toastId) toast.dismiss(toastId);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Error: ${errorMessage}`);
      setBurnInProgress(false);
    }
  };

  if (burnSuccess && burnResult) {
    return (
      <div className={`md:p-3 max-w-[550px] mx-auto my-2 ${!isMobile && "border-gear"}`}>
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center justify-center">
          Burn Successful
        </h1>
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <p className="text-gray-500 mb-6">Your tokens have been permanently removed from circulation</p>

          <div className="space-y-4 mb-8">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-500">Token</p>
              <p className="text-base font-mono break-all">{burnResult.mintAddress}</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-500">Amount Burned</p>
              <p className="text-base font-mono">{burnResult.amount} {selectedToken?.symbol || ""}</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-500">Transaction</p>
              <p className="text-base font-mono break-all">{burnResult.signature}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              variant="outline"
              onClick={handleCloseBurnDialog}
            >
              Burn More Tokens
            </Button>

            <Button
              onClick={() => {
                window.open(
                  `https://explorer.solana.com/tx/${burnResult.signature}?cluster=devnet`,
                  "_blank"
                );
              }}
            >
              View on Explorer <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`md:p-3 max-w-[550px] mx-auto my-2 ${!isMobile && "border-gear"}`}>
      <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center justify-center">
        Burn Token Extensions
      </h1>
      <div>
        <Alert className="bg-amber-50 border-amber-200 mb-6">
          <Flame className="h-4 w-4 text-amber-500" />
          <AlertTitle>Warning: Irreversible Action</AlertTitle>
          <AlertDescription>
            Burning tokens permanently removes them from circulation. This action cannot be undone.
          </AlertDescription>
        </Alert>

        <form onSubmit={(e) => { e.preventDefault(); openConfirmDialog(); }} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="token">Select Token</Label>
            <SelectToken
              selectedToken={selectedToken}
              setSelectedToken={setSelectedToken}
              onAmountChange={handleAmountChange}
              title="Select Token"
              disabled={!connected}
              amount={amount}
              amountLoading={isLoading}
              cluster={cluster}
              onTokensLoaded={handleTokensLoaded}
            />
          </div>

          {selectedToken && amount && (
            <div className="bg-gray-50 p-4 rounded-md">
              <p className="text-sm text-gray-500 mb-1">Balance After Burning</p>
              <p className="font-medium">
                {amount
                  ? (parseFloat(selectedToken.balance) - parseFloat(amount || "0")).toLocaleString()
                  : parseFloat(selectedToken.balance).toLocaleString()
                } {selectedToken.symbol}
              </p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-700 text-white"
            disabled={isLoading || !connected || !selectedToken || burnInProgress || !amount}
          >
            {burnInProgress ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Flame className="mr-2 h-4 w-4" />
                Burn Token
              </>
            )}
          </Button>
        </form>
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="bg-white border-gray-200 text-gray-900 sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Token Burn</DialogTitle>
            <DialogDescription className="text-gray-500">
              You are about to permanently burn tokens. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {selectedToken && (
            <div className="space-y-3 py-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Token:</span>
                <span className="font-medium">{selectedToken.name} ({selectedToken.symbol})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount to Burn:</span>
                <span className="font-medium">{amount} {selectedToken.symbol}</span>
              </div>
              <Separator className="bg-gray-200" />
              <div className="flex justify-between text-red-500">
                <span>Tokens will be permanently removed</span>
                <Flame className="w-4 h-4" />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBurn}
              className="bg-red-600 hover:bg-red-700"
            >
              <Flame className="w-4 h-4 mr-2" /> Confirm Burn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 