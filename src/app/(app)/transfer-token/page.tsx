"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Check, ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import SelectToken from "@/components/transfer/select-token";
import { transferToken, TokenTransferResult, transferTokenToMultipleRecipients } from "@/service/token/token-extensions/tool/transfer-token-extension";
import { transferSol, transferSolToMultipleRecipients, } from "@/service/token/token-extensions/tool/transfer-sol";
import { UserToken } from "@/hooks/useUserTokens";

interface Recipient {
  address: string;
  amount: string;
}

export default function TransferTokenPage() {
  const wallet = useWallet();
  const { connected } = wallet;
  const { connection } = useConnection();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedToken, setSelectedToken] = useState<UserToken | null>(null);
  const [tokenAmount, setTokenAmount] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([{ address: "", amount: "" }]);
  const [memo, setMemo] = useState("");
 
  const [transferInProgress, setTransferInProgress] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [transferResults, setTransferResults] = useState<TokenTransferResult[]>([]);
  const [cluster, setCluster] = useState("mainnet");

  const [isUpdatingFromSelectToken, setIsUpdatingFromSelectToken] = useState(false);

  const handleTokensLoaded = (tokens: UserToken[]) => {
    setIsLoading(false);
    if (!selectedToken) {
      const solToken = tokens.find(token => 
        token.symbol === "SOL" || 
        token.address === "11111111111111111111111111111111" || 
        token.address === "NativeSOL"
      );
      
      if (solToken) {
        setSelectedToken(solToken);
      } else if (tokens.length > 0) {
        setSelectedToken(tokens[0]);
      }
    }
  };

  useEffect(() => {
    const urlCluster = window.location.href.includes('cluster=devnet') ? 'devnet' : 'mainnet';
    setCluster(urlCluster);
  }, []);

  const handleAmountChange = (amount: string) => {
    setTokenAmount(amount);
    setIsUpdatingFromSelectToken(true);
    if (amount && selectedToken) {
      if (recipients.length === 1) {
        const updatedRecipients = [...recipients];
        updatedRecipients[0] = {
          ...updatedRecipients[0],
          amount
        };
        setRecipients(updatedRecipients);
      } else if (recipients.length > 1) {
        const amountPerRecipient = (parseFloat(amount) / recipients.length).toFixed(selectedToken.decimals || 6);
        setRecipients(recipients.map(r => ({
          ...r,
          amount: amountPerRecipient
        })));
      }
    }
    setTimeout(() => setIsUpdatingFromSelectToken(false), 0);
  };

  const addRecipient = () => {
    setRecipients([...recipients, { address: "", amount: "" }]);
  };

  const removeRecipient = (index: number) => {
    if (recipients.length > 1) {
      setRecipients(recipients.filter((_, i) => i !== index));
    }
  };
  const updateRecipient = (index: number, field: keyof Recipient, value: string) => {
    console.log(`Updating recipient ${index}, field: ${field}, value: ${value}`);
    const newRecipients = [...recipients];
    
    if (index >= newRecipients.length) {
      console.error(`Index ${index} out of bounds, max index is ${newRecipients.length - 1}`);
      return;
    }
    
    newRecipients[index] = { 
      ...newRecipients[index], 
      [field]: value 
    };
    
    console.log(`Updated recipients:`, newRecipients);
    setRecipients(newRecipients);
  };
  const validateTotalAmount = (): boolean => {
    if (!selectedToken) return false;
    
    const totalAmount = recipients.reduce((sum, recipient) => {
      const amount = parseFloat(recipient.amount) || 0;
      return sum + amount;
    }, 0);
    
    const balance = parseFloat(selectedToken.balance);
    
    if (totalAmount > balance) {
      toast.error(`Total amount exceeds your balance (${balance} ${selectedToken.symbol})`);
      return false;
    }
    
    return true;
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!connected) {
      toast.error("Please connect your wallet first");
      return;
    }
    
    if (!selectedToken) {
      toast.error("Please select a token");
      return;
    }
    
    const validRecipients: Recipient[] = [];
    const invalidRecipients: string[] = [];
    
    console.log("Checking recipients:", recipients);
    
    recipients.forEach((recipient, index) => {
      if (!recipient.address && (!recipient.amount || parseFloat(recipient.amount) <= 0)) {
        console.log(`Recipient ${index + 1}: Completely empty, skipping`);
        return;
      }
      
      if (!recipient.address) {
        console.log(`Recipient ${index + 1}: Missing address`);
        invalidRecipients.push(`Recipient ${index + 1}: Missing address`);
        return;
      }
      
      if (!recipient.amount || parseFloat(recipient.amount) <= 0 || isNaN(parseFloat(recipient.amount))) {
        console.log(`Recipient ${index + 1}: Invalid amount "${recipient.amount}"`);
        invalidRecipients.push(`Recipient ${index + 1}: Invalid amount`);
        return;
      }
      
      console.log(`Recipient ${index + 1}: Valid - Address: ${recipient.address}, Amount: ${recipient.amount}`);
      validRecipients.push(recipient);
    });
    
    if (invalidRecipients.length > 0) {
      toast.error(
        <div>
          <p>Please fix the following errors:</p>
          <ul className="list-disc pl-4 mt-1">
            {invalidRecipients.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      );
      return;
    }
    
    if (validRecipients.length === 0) {
      toast.error("Please add at least one valid recipient with amount");
      return;
    }
    
    console.log("Valid recipients:", validRecipients);
    
    if (!validateTotalAmount()) {
      return;
    }
    
    let toastId: string | number | undefined;
    
    try {
      setTransferInProgress(true);
      
      toastId = toast.loading("Preparing transfer...");
      
      // Kiểm tra nếu token đang chuyển là SOL
      const isSOL = selectedToken.symbol === "SOL" || 
                   selectedToken.address === "NativeSOL" ||
                   selectedToken.address === "11111111111111111111111111111111";
      
      if (isSOL) {
        // Xử lý chuyển SOL
        if (validRecipients.length === 1) {
          // Chuyển SOL cho một người nhận
          const recipient = validRecipients[0];
          
          const result = await transferSol(
            connection,
            wallet,
            {
              recipientAddress: recipient.address,
              amount: recipient.amount
            },
            {
              memo: memo,
              onStart: () => {},
              onSuccess: () => {
                toast.dismiss(toastId);
                toast.success("SOL transfer successful!");
              },
              onError: (err) => {
                toast.dismiss(toastId);
                toast.error(`SOL transfer failed: ${err.message}`);
              },
              onFinish: () => setTransferInProgress(false)
            }
          );
          
          if (result) {
            console.log("SOL transaction signature:", result.signature);
            toast.dismiss(toastId);
            setTransferResults([result as unknown as TokenTransferResult]);
            setTransferSuccess(true);
          }
        } else {
          // Chuyển SOL cho nhiều người nhận
          const transferParams = validRecipients.map(recipient => ({
            recipientAddress: recipient.address,
            amount: recipient.amount
          }));
          
          const results = await transferSolToMultipleRecipients(
            connection,
            wallet,
            transferParams,
            {
              memo: memo,
              onStart: () => {},
              onSuccess: () => {
                toast.dismiss(toastId);
                toast.success("SOL transfers successful!");
              },
              onError: (err: Error) => {
                toast.dismiss(toastId);
                toast.error(`SOL transfers failed: ${err.message}`);
              },
              onFinish: () => setTransferInProgress(false)
            }
          );
          
          if (results && results.length > 0) {
            console.log("SOL transaction results:", results);
            toast.dismiss(toastId);
            setTransferResults(results as unknown as TokenTransferResult[]);
            setTransferSuccess(true);
          }
        }
      } else {
        // Xử lý chuyển token (logic cũ)
        if (validRecipients.length === 1) {
          // Chuyển cho một người nhận
          const recipient = validRecipients[0];
        
          const result = await transferToken(
            connection,
            wallet,
            {
              mintAddress: selectedToken.address,
              recipientAddress: recipient.address,
              amount: recipient.amount,
              decimals: selectedToken.decimals || 0
            },
            {
              memo: memo,
              onStart: () => {},
              onSuccess: () => {
                toast.dismiss(toastId);
                toast.success("Transfer successful!");
              },
              onError: (err) => {
                toast.dismiss(toastId);
                toast.error(`Transfer failed: ${err.message}`);
              },
              onFinish: () => setTransferInProgress(false)
            }
          );
          
          if (result) {
            console.log("Transaction signature:", result.signature);
            toast.dismiss(toastId);
            setTransferResults([result]);
            setTransferSuccess(true);
          }
        } else {
          // Chuyển cho nhiều người nhận
          const transferParams = validRecipients.map(recipient => ({
            mintAddress: selectedToken.address,
            recipientAddress: recipient.address,
            amount: recipient.amount,
            decimals: selectedToken.decimals || 0
          }));
          
          const results = await transferTokenToMultipleRecipients(
            connection,
            wallet,
            transferParams,
            {
              memo: memo,
              onStart: () => {},
              onSuccess: () => {
                toast.dismiss(toastId);
                toast.success("Transfers successful!");
              },
              onError: (err: Error) => {
                toast.dismiss(toastId);
                toast.error(`Transfers failed: ${err.message}`);
              },
              onFinish: () => setTransferInProgress(false)
            }
          );
          
          if (results && results.length > 0) {
            console.log("Transaction results:", results);
            toast.dismiss(toastId);
            setTransferResults(results);
            setTransferSuccess(true);
          }
        }
      }
    } catch (error: unknown) {
      console.error("Error in transfer:", error);
      if (toastId) toast.dismiss(toastId);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Error: ${errorMessage}`);
      setTransferInProgress(false);
    }
  };

  // Cập nhật total amount khi recipient thay đổi
  useEffect(() => {
    // Nếu cập nhật đến từ SelectToken thì bỏ qua
    if (isUpdatingFromSelectToken) return;
    
    // Tính tổng số token từ tất cả recipient
    const totalAmount = recipients.reduce((sum, recipient) => {
      const amount = parseFloat(recipient.amount) || 0;
      return sum + amount;
    }, 0);
    
    // Cập nhật tokenAmount để hiển thị trong SelectToken
    if (!isNaN(totalAmount)) {
      setTokenAmount(totalAmount.toString());
    }
  }, [recipients, isUpdatingFromSelectToken]);

  const handleSetMaxForAll = () => {
    if (!selectedToken) return;
    
    const balance = parseFloat(selectedToken.balance);
    const count = recipients.length;
    
    if (count === 0) return;
    
    // Đánh dấu để tránh useEffect tính lại tổng số lượng
    setIsUpdatingFromSelectToken(true);
    
    const amountPerRecipient = (balance / count).toFixed(selectedToken.decimals || 6);
    
    // Cập nhật số lượng cho mỗi recipient
    setRecipients(recipients.map(r => ({
      ...r,
      amount: amountPerRecipient
    })));
    
    // Cập nhật luôn tokenAmount để hiển thị đúng trong SelectToken
    setTokenAmount(balance.toString());
    
    // Reset flag
    setTimeout(() => setIsUpdatingFromSelectToken(false), 0);
  };

  const handleMaxAmount = (index: number) => {
    if (!selectedToken) return;
    
    // Đánh dấu để tránh useEffect tính lại tổng số lượng
    setIsUpdatingFromSelectToken(true);
    
    const totalOtherAmount = recipients.reduce((sum, r, i) => {
      if (i === index) return sum;
      return sum + (parseFloat(r.amount) || 0);
    }, 0);
    
    const availableBalance = parseFloat(selectedToken.balance) - totalOtherAmount;
    
    if (availableBalance <= 0) {
      toast.error("No remaining balance available");
      setIsUpdatingFromSelectToken(false);
      return;
    }
    
    const newRecipients = [...recipients];
    newRecipients[index] = {
      ...newRecipients[index],
      amount: availableBalance.toString()
    };
    
    setRecipients(newRecipients);
    
    // Cập nhật tổng số lượng trong SelectToken
    const totalAmount = newRecipients.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
    setTokenAmount(totalAmount.toString());
    
    // Reset flag
    setTimeout(() => setIsUpdatingFromSelectToken(false), 0);
  };

  const calculateTotalAmount = (): number => {
    return recipients.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  };

  const handleCloseSuccessDialog = () => {
    setTransferSuccess(false);
    setTransferResults([]);
    setRecipients([{ address: "", amount: "" }]);
    setMemo("");
  };

  if (transferSuccess && transferResults.length > 0) {
    return (
      <div className="max-h-[calc(100vh-60px)] overflow-y-auto">
        <div className="container mx-auto py-8">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="pt-6 text-center">
              <div className="mb-6 flex justify-center">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2">Transfer Successful!</h2>
              <p className="text-gray-500 mb-6">Your tokens have been sent successfully</p>

              <div className="space-y-4 mb-8">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-500">Token</p>
                  <p className="text-base font-mono break-all">{transferResults[0].mintAddress}</p>
                </div>

                {transferResults.map((result, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-500">Recipient {index + 1}</p>
                    <div className="flex justify-between items-center">
                      <p className="text-base font-mono break-all">{result.recipientAddress}</p>
                      <p className="text-base font-mono">{result.amount} {selectedToken?.symbol || ""}</p>
                    </div>
                  </div>
                ))}

                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-500">Transaction</p>
                  <p className="text-base font-mono break-all">{transferResults[0].signature}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  variant="outline"
                  onClick={handleCloseSuccessDialog}
                >
                  Make Another Transfer
                </Button>

                <Button
                  onClick={() => {
                    const urlCluster = window.location.href.includes('cluster=devnet') ? 'devnet' : 'mainnet';
                    const explorerUrl = urlCluster === 'devnet'
                      ? `https://explorer.solana.com/tx/${transferResults[0].signature}?cluster=devnet`
                      : `https://explorer.solana.com/tx/${transferResults[0].signature}`;
                    window.open(explorerUrl, "_blank");
                  }}
                >
                  View on Explorer <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="max-h-[calc(100vh-60px)] overflow-y-auto">
      <div className="container mx-auto py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-center">Transfer Token Extensions</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Token Selection using SelectToken component */}
              <div className="space-y-2">
                <SelectToken
                  selectedToken={selectedToken}
                  setSelectedToken={setSelectedToken}
                  onAmountChange={handleAmountChange}
                  title="Select Token"
                  disabled={!connected}
                  amount={tokenAmount}
                  amountLoading={isLoading}
                  cluster={cluster}
                  onTokensLoaded={handleTokensLoaded}
                />
                
                {selectedToken && recipients.length > 1 && (
                  <div className="flex justify-end mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={handleSetMaxForAll}
                    >
                      Distribute Evenly
                    </Button>
                  </div>
                )}
              </div>

              {/* Recipients */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>Recipients</Label>
                </div>

                <div className="space-y-4">
                  {recipients.map((recipient, index) => (
                    <div key={index} className="p-4 border border-gray-200 rounded-lg space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-medium">Recipient {index + 1}</h4>
                        {recipients.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRecipient(index)}
                            className="h-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div>
                          <Label htmlFor={`recipient-${index}`} className="sr-only">Recipient Address</Label>
                          <Input
                            id={`recipient-${index}`}
                            placeholder="Enter Solana address"
                            value={recipient.address}
                            onChange={(e) => updateRecipient(index, "address", e.target.value)}
                          />
                        </div>

                        <div>
                          <div className="flex justify-between">
                            <Label htmlFor={`amount-${index}`} className="sr-only">Amount</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => handleMaxAmount(index)}
                              disabled={!selectedToken}
                            >
                              MAX
                            </Button>
                          </div>
                          <Input
                            id={`amount-${index}`}
                            placeholder="0.00"
                            value={recipient.amount}
                            onChange={(e) => updateRecipient(index, "amount", e.target.value)}
                            disabled={!selectedToken}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-center mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-full"
                    onClick={addRecipient}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add Recipient
                  </Button>
                </div>

                {selectedToken && recipients.length > 0 && (
                  <div className="flex justify-between items-center px-4 py-2 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium">Total Amount:</span>
                    <span className="font-medium">
                      {calculateTotalAmount()} {selectedToken.symbol}
                      {calculateTotalAmount() > parseFloat(selectedToken.balance) && (
                        <span className="text-red-500 ml-2">(Exceeds balance)</span>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Memo (for MemoTransfer extension) */}
              <div className="space-y-2">
                <Label htmlFor="memo">Memo (Optional)</Label>
                <Textarea
                  id="memo"
                  placeholder="Add a memo to this transfer"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  className="resize-none"
                  rows={3}
                />
                <p className="text-xs text-gray-500">
                  Some tokens with MemoTransfer extension require a memo for transfers.
                </p>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !connected || !selectedToken || transferInProgress}
              >
                {transferInProgress ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Transfer Token"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 