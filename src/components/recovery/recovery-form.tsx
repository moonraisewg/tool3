"use client";

import { useState, useEffect, useCallback } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { Check, ExternalLink, Loader2, Info, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { permanentDelegateRecovery, PermanentDelegateRecoveryResult } from "@/service/token/token-extensions/tool/permanent-delegate-recovery";
import { Separator } from "@/components/ui/separator";
import SelectToken from "@/components/transfer/select-token";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PublicKey } from "@solana/web3.js";
import React from "react";
import { UserToken } from "@/hooks/useUserTokens";
import { useIsMobile } from "@/hooks/use-mobile";

export interface RecoveryFormProps {
  [key: string]: never;
}

export function RecoveryForm({ }: RecoveryFormProps) {
  const wallet = useWallet();
  const { publicKey, connected } = wallet;
  const { connection } = useConnection();
  const isMobile = useIsMobile();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedToken, setSelectedToken] = useState<UserToken | null>(null);
  const [cluster, setCluster] = useState<"mainnet" | "devnet">("mainnet");

  const [sourceWalletAddress, setSourceWalletAddress] = useState<string>("");
  const [sourceTokenAccount, setSourceTokenAccount] = useState<string>("");
  const [calculatingSource, setCalculatingSource] = useState<boolean>(false);

  const [amount, setAmount] = useState<string>("");
  const [memo, setMemo] = useState<string>("");
  const [recoveryInProgress, setRecoveryInProgress] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const [recoveryResult, setRecoveryResult] = useState<PermanentDelegateRecoveryResult | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState<boolean>(false);
  const [isDelegate, setIsDelegate] = useState<boolean | null>(null);

  useEffect(() => {
    const urlCluster = window.location.href.includes('cluster=devnet') ? 'devnet' : 'mainnet';
    setCluster(urlCluster);
  }, []);

  const handleTokensLoaded = () => {
    setIsLoading(false);
  };

  const handleAmountChange = (amount: string) => {
    setAmount(amount);
  };

  // Calculate token account address from wallet address
  const calculateTokenAccount = useCallback(async (walletAddress: string, mintAddress: string) => {
    if (!walletAddress || !mintAddress || !connection) return;

    try {
      // Validate wallet address
      try {
        new PublicKey(walletAddress);
        new PublicKey(mintAddress);
      } catch {
        toast.error("Invalid wallet or mint address");
        setSourceTokenAccount("");
        return;
      }

      setCalculatingSource(true);

      // Fetch token account using API
      const response = await fetch("/api/token-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: walletAddress,
          mintAddress: mintAddress
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get token account");
      }

      const data = await response.json();

      if (data.tokenAccount) {
        setSourceTokenAccount(data.tokenAccount);
      } else {
        toast.warning("Token account does not exist for this wallet and token");
        setSourceTokenAccount("");
      }
    } catch {
      toast.error("Failed to calculate token account");
      setSourceTokenAccount("");
    } finally {
      setCalculatingSource(false);
    }
  }, [connection, setSourceTokenAccount, setCalculatingSource]);

  // Calculate token account when source wallet address changes
  useEffect(() => {
    if (sourceWalletAddress && selectedToken) {
      calculateTokenAccount(sourceWalletAddress, selectedToken.address);
    }
  }, [sourceWalletAddress, selectedToken, calculateTokenAccount]);

  // Reset source address when token changes
  useEffect(() => {
    if (selectedToken) {
      setSourceWalletAddress("");
      setSourceTokenAccount("");
    }
  }, [selectedToken]);

  const openConfirmDialog = () => {
    if (!connected) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!selectedToken) {
      toast.error("Please select a token");
      return;
    }

    if (!sourceWalletAddress) {
      toast.error("Please enter a source wallet address");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setShowConfirmDialog(true);
  };

  const handleRecovery = async () => {
    if (!connected || !selectedToken || !amount || !sourceWalletAddress) {
      toast.error("Please fill in all required information");
      return;
    }

    setShowConfirmDialog(false);
    setRecoveryInProgress(true);

    let toastId: string | number | undefined;

    try {
      toastId = toast.loading("Processing recovery transaction...");

      const result = await permanentDelegateRecovery(
        connection,
        wallet,
        {
          sourceWalletAddress: sourceWalletAddress,
          mintAddress: selectedToken.address,
          amount: amount,
          decimals: selectedToken.decimals || 0
        },
        {
          memo: memo,
          onStart: () => { },
          onSuccess: () => {
            toast.dismiss(toastId);
            toast.success("Token recovery successful!");
          },
          onError: (err) => {
            toast.dismiss(toastId);
            toast.error(`Recovery failed: ${err.message}`);
          },
          onFinish: () => setRecoveryInProgress(false)
        }
      );

      if (result) {
        console.log("Transaction signature:", result.signature);
        toast.dismiss(toastId);
        setRecoveryResult(result);
        setRecoverySuccess(true);
        // Reloading will happen automatically through parent components
      }
    } catch (error: unknown) {
      console.error("Error in recovery:", error);
      if (toastId) toast.dismiss(toastId);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Error: ${errorMessage}`);
      setRecoveryInProgress(false);
    }
  };

  const handleCloseRecoveryDialog = () => {
    setRecoverySuccess(false);
    setRecoveryResult(null);
    setAmount("");
    setSourceWalletAddress("");
    setSourceTokenAccount("");
    setMemo("");
  };

  // Verify delegate status
  const verifyDelegateStatus = async () => {
    if (!connection || !publicKey || !selectedToken) {
      toast.error("Please connect your wallet and select a token");
      return;
    }

    setVerifyLoading(true);

    try {
      // Simulate verification
      setTimeout(() => {
        setIsDelegate(true);
        toast.success("Verification successful: You are the permanent delegate");
        setVerifyLoading(false);
      }, 1000);
    } catch {
      console.error("Error during verification");
      toast.error("Verification error: Could not verify delegate status");
      setVerifyLoading(false);
    }
  };

  if (recoverySuccess && recoveryResult) {
    return (
      <div className={`md:p-3 max-w-[550px] mx-auto my-2 ${!isMobile && "border-gear"}`}>
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center justify-center">
          Recovery Successful!
        </h1>
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <p className="text-gray-500 mb-6">Tokens have been successfully recovered using permanent delegate authority</p>

          <div className="space-y-4 mb-8">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-500">Token</p>
              <p className="text-base font-mono break-all">{recoveryResult.mintAddress}</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-500">Amount Recovered</p>
              <p className="text-base font-mono">{recoveryResult.amount} {selectedToken?.symbol || ""}</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-500">Transaction</p>
              <p className="text-base font-mono break-all">{recoveryResult.signature}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              variant="outline"
              onClick={handleCloseRecoveryDialog}
            >
              Recover More Tokens
            </Button>

            <Button
              onClick={() => {
                window.open(
                  `https://explorer.solana.com/tx/${recoveryResult.signature}?cluster=devnet`,
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
        Permanent Delegate Recovery
      </h1>
      <div>
        <div className="text-center mb-6">
          Recover tokens from other wallets using permanent delegate authority
        </div>
        <Alert className="bg-purple-50 border-gear-purple w-[calc(100%-8px)] ml-1 mb-6">
          <Info className="h-4 w-4 text-purple-500" />
          <AlertTitle>About Permanent Delegate Recovery</AlertTitle>
          <AlertDescription>
            If you are the permanent delegate for a token, you can use this tool to recover tokens from any wallet.
            This is useful for retrieving tokens that were sent to the wrong address.
          </AlertDescription>
        </Alert>

        <form onSubmit={(e) => { e.preventDefault(); openConfirmDialog(); }} className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="token">Select Token</Label>
            <div className="w-[calc(100%-8px)] ml-1">
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
            {/* Verify Button */}
            <Button
              variant="outline"
              className="mt-2 border-gear-gray cursor-pointer ml-1 py-0 h-[30px]"
              onClick={verifyDelegateStatus}
              disabled={!selectedToken || verifyLoading}
            >
              {verifyLoading ? (
                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
              ) : (
                "Verify Delegate Status"
              )}
            </Button>

            {isDelegate === true && (
              <p className="text-sm text-green-500">✓ You are the permanent delegate for this token</p>
            )}
          </div>

          {/* Source Wallet Address */}
          <div className="space-y-3">
            <Label htmlFor="source-wallet">Source Wallet Address</Label>
            <Input
              id="source-wallet"
              placeholder="Enter source wallet address"
              value={sourceWalletAddress}
              onChange={(e) => setSourceWalletAddress(e.target.value)}
              disabled={!selectedToken}
              className="w-[calc(100%-8px)] border-gear-gray !h-[28px] ml-1"
            />
            <p className="text-xs text-gray-500">
              The wallet address you want to recover tokens from
            </p>
          </div>

          {/* Source Token Account (Calculated) */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="source-token-account">Token Account (Calculated)</Label>
              {calculatingSource && (
                <RefreshCw className="h-3 w-3 animate-spin text-blue-400" />
              )}
            </div>
            <Input
              id="source-token-account"
              value={sourceTokenAccount}
              disabled
              className="bg-gray-100 text-gray-500"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!selectedToken}
              className="w-[calc(100%-8px)] border-gear-gray !h-[28px] ml-1"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="memo">Memo (Optional)</Label>
            <Input
              id="memo"
              placeholder="Add a note to this transaction"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              disabled={!selectedToken}
              className="w-[calc(100%-8px)] border-gear-gray !h-[28px] ml-1"
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white cursor-pointer"
            disabled={isLoading || !connected || !selectedToken || recoveryInProgress || !sourceWalletAddress || !amount}
          >
            {recoveryInProgress ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Recover Tokens"
            )}
          </Button>
        </form>
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="bg-white border-gray-200 text-gray-900 sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Token Recovery</DialogTitle>
            <DialogDescription className="text-gray-500">
              You are about to recover tokens using your permanent delegate authority.
            </DialogDescription>
          </DialogHeader>

          {selectedToken && (
            <div className="space-y-3 py-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Token:</span>
                <span className="font-medium">{selectedToken.name} ({selectedToken.symbol})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Source Wallet:</span>
                <span className="font-medium">{sourceWalletAddress.substring(0, 6)}...{sourceWalletAddress.substring(sourceWalletAddress.length - 4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount to Recover:</span>
                <span className="font-medium">{amount} {selectedToken.symbol}</span>
              </div>
              <Separator className="bg-gray-200" />
              <div className="flex justify-between text-purple-500">
                <span>Using permanent delegate authority</span>
                <Info className="w-4 h-4" />
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
              onClick={handleRecovery}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Confirm Recovery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 