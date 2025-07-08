"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Check, ExternalLink, Loader2, Plus, Trash2, FileText, X, Upload } from "lucide-react";
import SelectToken from "@/components/transfer/select-token";
import { transferToken, TokenTransferResult, transferTokenToMultipleRecipients } from "@/service/token/token-extensions/tool/transfer-token-extension";
import { transferSol, transferSolToMultipleRecipients, } from "@/service/token/token-extensions/tool/transfer-sol";
import { UserToken } from "@/hooks/useUserTokens";
import { useIsMobile } from "@/hooks/use-mobile";
import SuspenseLayout from "@/components/suspense-layout";
import { ClusterType } from "@/types/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";


// Hằng số cho phí và địa chỉ nhận phí
const FEE_PER_RECIPIENT = 0.006; // 0.006 SOL per recipient
const FEE_RECIPIENT_ADDRESS = "4UWS2QEhNT9hyAnvRikAXtDhvvgJGGT8fHhLzoq5KhEa";

interface Recipient {
  address: string;
  amount: string;
  valid?: boolean;
  error?: string;
}

export default function TransferTokenPage() {
  const isMobile = useIsMobile();
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
  const [cluster, setCluster] = useState<ClusterType>("mainnet");

  const [isUpdatingFromSelectToken, setIsUpdatingFromSelectToken] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [parsedCsvRecipients, setParsedCsvRecipients] = useState<Recipient[]>([]);

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

  // Xử lý import CSV
  const processCsvInput = (text: string) => {
    if (!text.trim()) {
      setParsedCsvRecipients([]);
      return;
    }

    const lines = text.trim().split('\n');
    const newRecipients: Recipient[] = [];
    let skipHeader = true;

    for (const line of lines) {
      if (!line.trim()) continue;

      // Kiểm tra xem dòng đầu có phải là header không
      if (skipHeader) {
        const lowerLine = line.toLowerCase().trim();
        if (lowerLine.includes('address') && lowerLine.includes('amount')) {
          skipHeader = false;
          continue;
        }
        skipHeader = false;
      }

      // Phân tích dòng CSV
      const parts = line.split(',').map(part => part.trim());
      if (parts.length < 2) {
        newRecipients.push({
          address: line,
          amount: '',
          valid: false,
          error: 'Invalid format. Expected: address, amount'
        });
        continue;
      }

      const address = parts[0];
      const amount = parts[1];

      // Kiểm tra địa chỉ
      const isValidAddress = /^[\w]{32,44}$/.test(address);
      
      // Kiểm tra số lượng
      const parsedAmount = parseFloat(amount);
      const isValidAmount = !isNaN(parsedAmount) && parsedAmount > 0;

      newRecipients.push({
        address,
        amount,
        valid: isValidAddress && isValidAmount,
        error: !isValidAddress 
          ? 'Invalid address format' 
          : !isValidAmount 
          ? 'Invalid amount' 
          : undefined
      });
    }

    setParsedCsvRecipients(newRecipients);
  };

  const handleCsvTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setCsvText(text);
    processCsvInput(text);
  };

  const clearCsvText = () => {
    setCsvText('');
    setParsedCsvRecipients([]);
  };

  const importCsvData = () => {
    // Lọc các recipient hợp lệ
    const validRecipients = parsedCsvRecipients.filter(r => r.valid);
    
    if (validRecipients.length === 0) {
      toast.error('No valid recipients found in CSV data');
      return;
    }

    // Cập nhật danh sách recipients
    setRecipients(validRecipients);
    
    // Tính tổng số lượng để cập nhật tokenAmount
    const totalAmount = validRecipients.reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0);
    setTokenAmount(totalAmount.toString());
    
    // Đóng dialog và thông báo
    setCsvDialogOpen(false);
    toast.success(`Imported ${validRecipients.length} recipients from CSV`);
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
              feeRecipientAddress: FEE_RECIPIENT_ADDRESS,
              feePerRecipient: FEE_PER_RECIPIENT,
              onStart: () => { },
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
              feeRecipientAddress: FEE_RECIPIENT_ADDRESS,
              feePerRecipient: FEE_PER_RECIPIENT,
              onStart: () => { },
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
              feeRecipientAddress: FEE_RECIPIENT_ADDRESS,
              feePerRecipient: FEE_PER_RECIPIENT,
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
              feeRecipientAddress: FEE_RECIPIENT_ADDRESS,
              feePerRecipient: FEE_PER_RECIPIENT,
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

  // Tính tổng phí dựa trên số lượng người nhận
  const calculateTotalFee = (): number => {
    const validRecipients = recipients.filter(r => r.address && r.amount);
    // Tính phí cho cả mainnet và devnet
    if (validRecipients.length > 1) {
      return FEE_PER_RECIPIENT * (validRecipients.length - 1); // Miễn phí cho địa chỉ đầu tiên
    }
    return 0;
  };

  const handleCloseSuccessDialog = () => {
    setTransferSuccess(false);
    setTransferResults([]);
    setRecipients([{ address: "", amount: "" }]);
    setMemo("");
  };

  // Thêm một hàm xử lý upload file CSV
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Kiểm tra định dạng file
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast.error('Please upload a valid CSV file');
      return;
    }

    // Đọc file
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      processCsvInput(text);
    };
    reader.onerror = () => {
      toast.error('Failed to read file');
    };
    reader.readAsText(file);
  };

  // Hàm tạo và tải xuống mẫu CSV
  const downloadCsvTemplate = () => {
    const template = "address,amount\n9ZNTfG4NyQgxy2SWjSiQoUyBPEvXT2xo7fKc5hPYYJ7b,0.1\nHxFLKUAmAMLz1jtT3hbvCMELwH5H9tpM2QugP8sKyfhc,0.5";
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transfer_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (transferSuccess && transferResults.length > 0) {
    return (
      <div className="h-full flex md:items-center mt-10 md:mt-0">
        <div className="container mx-auto px-4">
          <div className={`md:p-6 max-w-[550px] mx-auto my-2 ${!isMobile && "border-gear shadow-sm rounded-xl"}`}>
            <div className="text-center">
              <div className="mb-8 flex justify-center">
                <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center shadow-sm">
                  <Check className="h-10 w-10 text-green-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2">Transfer Successful!</h2>
              <p className="text-gray-500 mb-8">Your tokens have been sent successfully</p>

              <div className="space-y-5 mb-10">
                <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100 shadow-sm">
                  <div className="px-6 py-4 bg-gray-100 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-700">Transaction Details</p>
                  </div>
                  
                  <div className="divide-y divide-gray-100">
                    <div className="px-6 py-4 flex justify-between items-center">
                      <p className="text-sm font-medium text-gray-500">Token</p>
                      <p className="text-base font-semibold">{selectedToken?.symbol || ""}</p>
                    </div>
                    
                    <div className="px-6 py-4 flex justify-between items-center">
                      <p className="text-sm font-medium text-gray-500">Total Amount</p>
                      <p className="text-base font-semibold">
                        {parseFloat(transferResults.reduce((sum, result) => sum + parseFloat(result.amount), 0).toFixed(selectedToken?.decimals || 6)).toString()} {selectedToken?.symbol || ""}
                      </p>
                    </div>
                    
                    <div className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-500 mb-2">Transaction ID</p>
                      <div className="bg-white p-3 rounded-lg border border-gray-200 break-all font-mono text-xs text-gray-700">
                        {transferResults[0].signature}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  variant="outline"
                  onClick={handleCloseSuccessDialog}
                  className="px-6"
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
                  className="px-6"
                >
                  View on Explorer <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex md:items-center mt-10 md:mt-0 ">
      <div className="container mx-auto px-4 max-h-[calc(100vh-100px)] overflow-y-auto py-5">
        <SuspenseLayout>
          <div className={`md:p-3 max-w-[550px] mx-auto my-2 ${!isMobile && "border-gear"}`}>
            <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center justify-center">
              Transfer Token Extensions
            </h1>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="px-[4px] space-y-6">
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
                        className="border-gear-gray h-[28px] bg-white text-gray-700 hover:text-purple-900 cursor-pointer hover:bg-white"
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
                    <Label className="text-gray-900">Recipients</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-gear-gray h-[28px] bg-white text-gray-700 hover:text-purple-900 cursor-pointer hover:bg-white"
                      onClick={() => setCsvDialogOpen(true)}
                    >
                      <FileText className="h-4 w-4 mr-1" /> Import CSV
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {recipients.map((recipient, index) => (
                      <div key={index} className="p-4 border border-gear-gray rounded-lg space-y-3">
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
                              className="border-gear-gray h-[28px] bg-white text-gray-900 focus:border-purple-500 focus:ring-purple-500"
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
                              className="border-gear-gray h-[28px] bg-white text-gray-900 focus:border-purple-500 focus:ring-purple-500"
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
                      className="border-gear-gray h-[28px] bg-white text-gray-700 hover:text-purple-900 cursor-pointer hover:bg-white w-full"
                      onClick={addRecipient}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Recipient
                    </Button>
                  </div>

                  {selectedToken && recipients.length > 0 && (
                    <div className="bg-white py-4 px-4 border-gear-gray rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Total Amount:</span>
                        <span className="font-medium text-gray-900">
                          {calculateTotalAmount()} {selectedToken.symbol}
                          {calculateTotalAmount() > parseFloat(selectedToken.balance) && (
                            <span className="text-red-500 ml-2">(Exceeds balance)</span>
                          )}
                        </span>
                      </div>
                      
                      {/* Hiển thị phí khi có nhiều người nhận */}
                      {recipients.length > 1 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">Fee:</span>
                          <span className="font-medium text-amber-600">
                            {calculateTotalFee().toFixed(6)} SOL
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Memo (for MemoTransfer extension) */}
                <div className="space-y-2">
                  <Label htmlFor="memo" className="text-gray-900">Memo (Optional)</Label>
                  <Textarea
                    id="memo"
                    placeholder="Add a memo to this transfer"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    className="resize-none border-gear-gray bg-white text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                    rows={3}
                  />
                  <p className="text-xs text-gray-500">
                    Some tokens with MemoTransfer extension require a memo for transfers.
                  </p>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full cursor-pointer mt-3"
                variant="default"
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

            {/* CSV Import Dialog */}
            <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
              <DialogContent className="sm:max-w-[525px]">
                <DialogHeader>
                  <DialogTitle>Import CSV Data</DialogTitle>
                  <DialogDescription>
                    Paste CSV data with addresses and amounts to create multiple recipients.
                    <br />Format: address, amount (one per line)
                  </DialogDescription>
                  <div className="mt-2 flex justify-end">
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="h-6 p-0 text-xs"
                      onClick={downloadCsvTemplate}
                    >
                      Download template
                    </Button>
                  </div>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="text-sm font-medium">CSV Data</div>
                    <div className="flex gap-2">
                      <label
                        htmlFor="csv-file"
                        className="cursor-pointer flex items-center px-2 h-8 text-xs font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                      >
                        <Upload className="h-3 w-3 mr-1" /> Upload CSV
                        <input
                          id="csv-file"
                          type="file"
                          accept=".csv,text/csv"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={clearCsvText}
                        className="h-8"
                        disabled={!csvText}
                      >
                        <X className="h-4 w-4 mr-1" /> Clear
                      </Button>
                    </div>
                  </div>
                  
                  <Textarea
                    placeholder="address, amount&#10;9ZNTfG4NyQgxy2SWjSiQoUyBPEvXT2xo7fKc5hPYYJ7b, 0.1&#10;HxFLKUAmAMLz1jtT3hbvCMELwH5H9tpM2QugP8sKyfhc, 0.5"
                    className="min-h-[150px] font-mono text-sm"
                    value={csvText}
                    onChange={handleCsvTextChange}
                  />
                  
                  <div className="text-xs text-gray-500 flex items-center">
                    <div className="flex-1">
                      <p>You can either paste CSV data above or upload a CSV file.</p>
                      <p>The first row with &quot;address, amount&quot; will be skipped as header.</p>
                    </div>
                  </div>

                  {parsedCsvRecipients.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12 text-center">#</TableHead>
                            <TableHead>Recipient</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parsedCsvRecipients.map((recipient, index) => (
                            <TableRow key={index} className={recipient.valid ? "" : "bg-red-50"}>
                              <TableCell className="text-center font-mono text-xs">{index + 1}</TableCell>
                              <TableCell className="font-mono text-xs">
                                {recipient.address ? `${recipient.address.slice(0, 6)}...${recipient.address.slice(-6)}` : "–"}
                              </TableCell>
                              <TableCell>{recipient.amount || "–"}</TableCell>
                              <TableCell className="text-right">
                                {recipient.valid ? (
                                  <span className="text-green-600 text-xs">Valid</span>
                                ) : (
                                  <span className="text-red-600 text-xs">{recipient.error}</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <div className="w-full flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                      {parsedCsvRecipients.filter(r => r.valid).length}/{parsedCsvRecipients.length} valid recipients
                    </div>
                    <Button 
                      onClick={importCsvData} 
                      disabled={parsedCsvRecipients.filter(r => r.valid).length === 0}
                    >
                      <Upload className="h-4 w-4 mr-2" /> Import
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </SuspenseLayout>
      </div>
    </div>
  );
} 