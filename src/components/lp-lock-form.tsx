"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CalendarClock, Info, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useWallet } from "@solana/wallet-adapter-react";
import { connection } from "../service/solana/connection";
import { Transaction } from "@solana/web3.js";
import { add, format, fromUnixTime } from "date-fns";

const formSchema = z.object({
  poolId: z.string().min(1, {
    message: "Pool ID is required",
  }),
  lockPeriod: z.string().min(1, {
    message: "Lock period is required",
  }),
  amount: z.string().min(1, {
    message: "Amount is required",
  }),
});

export default function LpLockForm() {
  const [userLpBalance, setUserLpBalance] = useState("0.00");
  const [tokenMint, setTokenMint] = useState("");
  const [loading, setLoading] = useState(false);

  const { publicKey, signTransaction } = useWallet();

  const getLockTimestamp = (period: string): number => {
    const now = new Date();

    let unlockDate: Date;

    switch (period) {
      case "6months":
        unlockDate = add(now, { minutes: 10 });
        break;
      case "1year":
        unlockDate = add(now, { years: 1 });
        break;
      case "2years":
        unlockDate = add(now, { years: 2 });
        break;
      case "3years":
        unlockDate = add(now, { years: 3 });
        break;
      default:
        return 0;
    }

    return Math.floor(unlockDate.getTime() / 1000);
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      poolId: "",
      lockPeriod: "",
      amount: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      if (!publicKey || !signTransaction) {
        toast.error("Vui lòng kết nối ví trước");
        return;
      }

      if (!tokenMint) {
        toast.error("Không tìm thấy thông tin token");
        return;
      }

      const unlockTimestamp = getLockTimestamp(values.lockPeriod);
      if (unlockTimestamp === 0) {
        toast.error("Thời gian khóa không hợp lệ");
        return;
      }

      const depositData = {
        walletPublicKey: publicKey.toString(),
        amount: parseFloat(values.amount),
        unlockTimestamp,
        poolId: values.poolId,
        tokenMint,
      };

      const amountFloat = parseFloat(values.amount);
      console.log(`Số lượng token gửi đi (UI): ${amountFloat}`);

      const response = await fetch("/api/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(depositData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Khóa token thất bại");
      }

      if (data.success && data.transactions && data.transactions.length > 0) {
        for (const serializedTx of data.transactions) {
          const transaction = Transaction.from(
            Buffer.from(serializedTx, "base64")
          );
          try {
            const signedTx = await signTransaction(transaction);
            const txId = await connection.sendRawTransaction(
              signedTx.serialize()
            );
            await connection.confirmTransaction(txId);
            console.log("Giao dịch thành công, txId:", txId);
          } catch (error: any) {
            console.error("Lỗi khi ký/gửi giao dịch:", error);
            throw new Error("Không thể ký hoặc gửi giao dịch");
          }
        }

        toast.success("Khóa token thành công", {
          description: `Bạn đã khóa ${values.amount} LP token trong ${values.lockPeriod}`,
        });
      } else {
        throw new Error("Không nhận được giao dịch từ API");
      }
    } catch (error: any) {
      toast.error(error.message || "Khóa token thất bại. Vui lòng thử lại.");
    }
  };

  const handlePoolIdChange = async (value: string) => {
    form.setValue("poolId", value);
  };

  const handleKeyDown = async (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const poolId = form.getValues("poolId");
      if (!publicKey) {
        toast.error("Vui lòng kết nối ví trước khi nhập Pool ID");
        return;
      }
      if (poolId) {
        try {
          setLoading(true);
          console.log(`Đang lấy số dư và mint cho pool ${poolId}`);
          const response = await fetch("/api/fetch-lp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              poolId,
              userPublicKey: publicKey.toString(),
            }),
          });
          const result = await response.json();
          console.log(result);
          if (response.ok && result) {
            setUserLpBalance(result.balance.toFixed(3));
            setTokenMint(result.lpMint);
          } else {
            throw new Error(result.error || "Không tìm thấy thông tin pool");
          }
        } catch (error: any) {
          console.error("Lỗi khi lấy số dư và mint:", error);
          toast.error(
            error.message ||
              "Không thể lấy thông tin pool. Vui lòng kiểm tra Pool ID."
          );
          setUserLpBalance("0.00");
          setTokenMint("");
        } finally {
          setLoading(false);
        }
      } else {
        toast.error("Vui lòng nhập Pool ID");
      }
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
    <div className="rounded-lg border border-gray-500 bg-white p-6 shadow-sm">
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
                      className="border-gray-300 bg-white text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                      placeholder="Nhập Pool ID"
                      {...field}
                      onChange={(e) => handlePoolIdChange(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={loading}
                    />
                    {loading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="h-5 w-5 animate-spin rounded-full border-4 border-purple-600 border-t-transparent"></div>
                      </div>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Card className="border-gray-300 bg-white">
            <CardContent className="py-2 px-4 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Wallet className="h-4 w-4 text-purple-400" />
                  <span className="text-gray-700">Your LP Balance</span>
                </div>
                <div className="font-medium text-gray-900">
                  {loading ? "Đang tải..." : `${userLpBalance} LP`}
                </div>
              </div>
            </CardContent>
          </Card>

          <FormField
            control={form.control}
            name="lockPeriod"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-900">
                  Thời gian khóa
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="ml-2 h-4 w-4 text-gray-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Chọn thời gian bạn muốn khóa LP token</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={loading}
                >
                  <FormControl>
                    <SelectTrigger className="border-gray-300 bg-white text-gray-900 focus:border-purple-500 focus:ring-purple-500">
                      <SelectValue placeholder="Chọn thời gian khóa" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="border-gray-300 bg-white text-gray-900">
                    <SelectItem value="6months">6 tháng</SelectItem>
                    <SelectItem value="1year">1 năm</SelectItem>
                    <SelectItem value="2years">2 năm</SelectItem>
                    <SelectItem value="3years">3 năm</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription className="flex items-center gap-1 text-gray-500">
                  <CalendarClock className="h-3 w-3" />
                  Longer lock periods may yield higher rewards
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-900">Lock Amount</FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Input
                      className="border-gray-300 bg-white text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                      placeholder="0.00"
                      {...field}
                      disabled={loading}
                    />
                  </FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-gray-300 bg-white text-gray-700 hover:bg-purple-100 hover:text-purple-900"
                    onClick={setHalf}
                    disabled={loading}
                  >
                    Half
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-gray-300 bg-white text-gray-700 hover:bg-purple-100 hover:text-purple-900"
                    onClick={setMax}
                    disabled={loading}
                  >
                    Max
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="rounded-md border border-gray-300 bg-gray-50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Estimated APR</span>
              <span className="font-medium text-purple-600">12.5%</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-gray-500">Ngày mở khóa</span>
              {form.watch("lockPeriod")
                ? format(
                    fromUnixTime(getLockTimestamp(form.watch("lockPeriod"))),
                    "dd/MM/yyyy"
                  )
                : "--"}
              <span className="text-gray-500">Unlock Date</span>
              <span className="font-medium text-gray-900">
                {form.watch("lockPeriod") === "6months" && "19/11/2025"}
                {form.watch("lockPeriod") === "1year" && "19/05/2026"}
                {form.watch("lockPeriod") === "2years" && "19/05/2027"}
                {form.watch("lockPeriod") === "3years" && "19/05/2028"}
                {!form.watch("lockPeriod") && "Select lock period"}
              </span>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-purple-600 to-purple-800 text-white hover:from-purple-700 hover:to-purple-900"
            disabled={loading}
          >
            Lock LP Token
          </Button>
        </form>
      </Form>
    </div>
  );
}
