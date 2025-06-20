"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Check, ExternalLink, Loader2, Search, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import Image from "next/image";
import { transferToken, TokenTransferResult, transferTokenToMultipleRecipients } from "@/service/token/token-extensions/tool/transfer-token-extension";
import { UserToken } from "@/hooks/useUserTokens";

interface Recipient {
  address: string;
  amount: string;
}

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

export default function TransferTokenPage() {
  const wallet = useWallet();
  const { publicKey, connected } = wallet;
  const { connection } = useConnection();
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<UserToken | null>(null);
  const [tokens, setTokens] = useState<UserToken[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([{ address: "", amount: "" }]);
  const [memo, setMemo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [transferInProgress, setTransferInProgress] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [transferResults, setTransferResults] = useState<TokenTransferResult[]>([]);

  const handleTokenSelect = (token: UserToken) => {
    setSelectedToken(token);
    setIsModalOpen(false);
  };


  const fetchUserTokens = useCallback(async () => {
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
  }, [publicKey]);

  // Thêm người nhận mới
  const addRecipient = () => {
    setRecipients([...recipients, { address: "", amount: "" }]);
  };

  // Xóa người nhận
  const removeRecipient = (index: number) => {
    if (recipients.length > 1) {
      setRecipients(recipients.filter((_, i) => i !== index));
    }
  };

  // Cập nhật thông tin người nhận
  const updateRecipient = (index: number, field: keyof Recipient, value: string) => {
    console.log(`Updating recipient ${index}, field: ${field}, value: ${value}`);

    const newRecipients = [...recipients];

    // Đảm bảo index tồn tại trong mảng
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

  // Kiểm tra tổng số token chuyển không vượt quá số dư
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

  // Xử lý khi submit form
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

    // Kiểm tra từng người nhận
    const validRecipients: Recipient[] = [];
    const invalidRecipients: string[] = [];

    console.log("Checking recipients:", recipients);

    recipients.forEach((recipient, index) => {
      // Bỏ qua các ô hoàn toàn trống
      if (!recipient.address && (!recipient.amount || parseFloat(recipient.amount) <= 0)) {
        console.log(`Recipient ${index + 1}: Completely empty, skipping`);
        return;
      }

      // Kiểm tra địa chỉ
      if (!recipient.address) {
        console.log(`Recipient ${index + 1}: Missing address`);
        invalidRecipients.push(`Recipient ${index + 1}: Missing address`);
        return;
      }

      // Kiểm tra số lượng
      if (!recipient.amount || parseFloat(recipient.amount) <= 0 || isNaN(parseFloat(recipient.amount))) {
        console.log(`Recipient ${index + 1}: Invalid amount "${recipient.amount}"`);
        invalidRecipients.push(`Recipient ${index + 1}: Invalid amount`);
        return;
      }

      // Nếu đã qua mọi kiểm tra, thêm vào danh sách hợp lệ
      console.log(`Recipient ${index + 1}: Valid - Address: ${recipient.address}, Amount: ${recipient.amount}`);
      validRecipients.push(recipient);
    });

    // Nếu có lỗi, hiển thị và dừng
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
            onStart: () => { },
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
            onStart: () => { },
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
    } catch (error: unknown) {
      console.error("Error in transfer:", error);
      if (toastId) toast.dismiss(toastId);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Error: ${errorMessage}`);
      setTransferInProgress(false);
    }
  };

  const handleSetMaxForAll = () => {
    if (!selectedToken) return;

    const balance = parseFloat(selectedToken.balance);
    const count = recipients.length;

    if (count === 0) return;

    const amountPerRecipient = (balance / count).toFixed(selectedToken.decimals || 6);

    setRecipients(recipients.map(r => ({
      ...r,
      amount: amountPerRecipient
    })));
  };

  const handleMaxAmount = (index: number) => {
    if (!selectedToken) return;

    // Calculate remaining balance after accounting for other recipients
    const totalOtherAmount = recipients.reduce((sum, r, i) => {
      if (i === index) return sum;
      return sum + (parseFloat(r.amount) || 0);
    }, 0);

    const availableBalance = parseFloat(selectedToken.balance) - totalOtherAmount;

    if (availableBalance <= 0) {
      toast.error("No remaining balance available");
      return;
    }

    const newRecipients = [...recipients];
    newRecipients[index] = {
      ...newRecipients[index],
      amount: availableBalance.toString()
    };

    setRecipients(newRecipients);
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

  useEffect(() => {
    if (publicKey) {
      fetchUserTokens();
    }
  }, [publicKey, fetchUserTokens]);


  const filteredTokens = tokens.filter(
    (token) =>
      token?.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.address.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const shortenAddress = (address: string) => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 5)}...${address.slice(-5)}`;
  };

  if (transferSuccess && transferResults.length > 0) {
    return (
      <div className="container mx-auto px-4 py-8">
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
                    <p className="text-base font-mono break-all">{shortenAddress(result.recipientAddress)}</p>
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
    );
  }

  return (
    <div className="container mx-auto px-4 py-8  max-h-[calc(100vh-60px)] overflow-y-auto">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-center">Transfer Token Extensions</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Token Selection */}
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
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-500">
                    Balance: {selectedToken.balance} {selectedToken.symbol}
                  </div>
                  {recipients.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={handleSetMaxForAll}
                    >
                      Distribute Evenly
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Recipients */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>Recipients</Label>
              </div>

              <div className="max-h-[350px] overflow-y-auto pr-1 space-y-4">
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

      {/* Token Selection Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-white border-gray-200 text-gray-900 sm:max-w-[500px] shadow-lg !p-0">
          <DialogHeader className="space-y-4">
            <DialogTitle className="hidden">Select a token</DialogTitle>
            <div className="flex items-center space-x-2 bg-gray-100 rounded-lg px-3 py-2">
              <Search className="h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search token..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-0 bg-transparent text-gray-900 placeholder:text-gray-400 focus-visible:ring-0"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 bg-[#e3e3e3] hover:bg-[#ccc] hover:text-gray-700 cursor-pointer px-2"
              >
                Esc
              </Button>
            </div>
          </DialogHeader>

          <div className="h-[500px] overflow-y-auto space-y-1 custom-scroll">
            {filteredTokens.length > 0 ? (
              filteredTokens.map((token) => (
                <div
                  key={token.address}
                  onClick={() => handleTokenSelect(token)}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors border-b border-gray-200 last:border-b-0"
                >
                  <div className="flex items-center space-x-3">
                    <div className="rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                      {token.logoURI ? (
                        <Image
                          src={token.logoURI}
                          alt={token.name}
                          className="rounded-full"
                          width={40}
                          height={40}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center text-white text-[16px] font-bold pt-[1px]">
                          <div className="ml-[3px] mt-[3px]">{token.name?.charAt(0) || "T"}</div>
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">{token.symbol || "UNKNOWN"}</span>
                      </div>
                      <div className="text-sm text-gray-600">{token.name || "Unknown Token"}</div>
                      <div className="text-xs text-gray-400">{shortenAddress(token.address)}</div>
                    </div>
                  </div>
                  {token.balance && (
                    <div className="text-right">
                      <div className="font-medium text-gray-900">
                        {parseFloat(token.balance).toFixed(token.decimals || 2)}
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">No tokens found</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 