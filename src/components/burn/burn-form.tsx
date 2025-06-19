"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { Check, ExternalLink, Flame, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { UserToken } from "@/components/transfer/select-token";
import { burnToken, TokenBurnResult } from "@/service/token/token-extensions/tool/burn-token-extension";
import { Separator } from "@/components/ui/separator";
import { SelectTokenModal } from "./select-token-modal";
import React from "react";

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

export function BurnForm({}: BurnFormProps) {
  const wallet = useWallet();
  const { publicKey, connected } = wallet;
  const { connection } = useConnection();
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<UserToken | null>(null);
  const [tokens, setTokens] = useState<UserToken[]>([]);
  const [amount, setAmount] = useState("");
  const [burnInProgress, setBurnInProgress] = useState(false);
  const [burnSuccess, setBurnSuccess] = useState(false);
  const [burnResult, setBurnResult] = useState<TokenBurnResult | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  const handleTokenSelect = (token: UserToken) => {
    setSelectedToken(token);
    setIsModalOpen(false);
  };
  
  interface TokenAsset {
    interface: string;
    id: string;
    token_info?: {
      balance: number;
      decimals: number;
      symbol?: string;
    };
    content?: {
      metadata?: {
        name?: string;
        symbol?: string;
      };
      links?: {
        image?: string;
      };
    };
  }
  
  const fetchUserTokens = async () => {
    if (!publicKey) return;
    
    try {
      setIsLoading(true);
      const urlCluster = window.location.href.includes('cluster=devnet') ? 'devnet' : 'mainnet';
      
      const response = await fetch("/api/user-tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          publicKey: publicKey.toString(),
          cluster: urlCluster
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();
      const assets = data.result?.items || [];
      
      const formattedTokens: UserToken[] = assets
        .filter((asset: TokenAsset) => 
          (asset.interface === "FungibleToken" || asset.interface === "FungibleAsset") && 
          asset.id !== "NativeSOL" && 
          parseFloat(((asset.token_info?.balance || 0) / Math.pow(10, asset.token_info?.decimals || 0)).toString()) > 0
        )
        .map((asset: TokenAsset) => {
          const mint = asset.id;
          const balance = (asset.token_info?.balance || 0) / Math.pow(10, asset.token_info?.decimals || 0);
          return {
            address: mint,
            name: asset.content?.metadata?.name || "Unknown Token",
            balance: balance.toString(),
            symbol: asset.token_info?.symbol || asset.content?.metadata?.symbol,
            logoURI: asset.content?.links?.image,
            decimals: asset.token_info?.decimals || 0,
          };
        });
      
      setTokens(formattedTokens);
    } catch (error) {
      console.error("Error fetching tokens:", error);
      toast.error("Failed to fetch tokens");
    } finally {
      setIsLoading(false);
    }
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
          onStart: () => {},
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
        
        setTimeout(() => {
          fetchUserTokens();
        }, 2000);
      }
    } catch (error: unknown) {
      console.error("Error in burn:", error);
      if (toastId) toast.dismiss(toastId);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Error: ${errorMessage}`);
      setBurnInProgress(false);
    }
  };
  
  const handleMaxAmount = () => {
    if (selectedToken) {
      setAmount(selectedToken.balance);
    }
  };
  
  const handleCloseBurnDialog = () => {
    setBurnSuccess(false);
    setBurnResult(null);
    setAmount("");
  };
  
  const memoizedFetchUserTokens = React.useCallback(fetchUserTokens, [publicKey]);
  
  useEffect(() => {
    if (publicKey) {
      memoizedFetchUserTokens();
    }
  }, [publicKey, memoizedFetchUserTokens]);
  
  if (burnSuccess && burnResult) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6 text-center">
          <div className="mb-6 flex justify-center">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2">Burn Successful!</h2>
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
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-center">Burn Token Extensions</CardTitle>
      </CardHeader>
      <CardContent>
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
            <Button
              type="button"
              variant="outline"
              className="w-full flex justify-between items-center h-10"
              onClick={() => {
                fetchUserTokens();
                setIsModalOpen(true);
              }}
            >
              {selectedToken ? (
                <span>
                  {selectedToken.symbol} - {selectedToken.name}
                </span>
              ) : (
                <span>Select a token</span>
              )}
              <span>▼</span>
            </Button>
            {selectedToken && (
              <div className="text-sm text-gray-500">
                Balance: {selectedToken.balance} {selectedToken.symbol}
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="amount">Amount to Burn</Label>
              <Button 
                type="button" 
                variant="ghost" 
                size="sm"
                className="h-6 text-xs"
                onClick={handleMaxAmount}
                disabled={!selectedToken}
              >
                MAX
              </Button>
            </div>
            <Input
              id="amount"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!selectedToken}
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
      </CardContent>
      
      <SelectTokenModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        tokens={tokens}
        onSelect={handleTokenSelect}
        isLoading={isLoading}
      />
      
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
    </Card>
  );
} 