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

const formSchema = z.object({
  poolId: z.string().min(1, {
    message: "Pool ID là bắt buộc",
  }),
  lockPeriod: z.string().min(1, {
    message: "Thời gian khóa là bắt buộc",
  }),
  amount: z.string().min(1, {
    message: "Số lượng là bắt buộc",
  }),
});

export default function LpLockForm() {
  const [userLpBalance, setUserLpBalance] = useState("1000.00");

  const fetchUserLpBalance = async (poolId: string) => {
    console.log(`Đang lấy số dư cho pool ${poolId}`);
    return "1000.00";
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
      console.log("Khóa token:", values);
      toast.success("Khóa token thành công", {
        description: `Bạn đã khóa ${values.amount} LP token trong ${values.lockPeriod}`,
      });
    } catch (error) {
      toast.error("Khóa token thất bại. Vui lòng thử lại.");
    }
  };

  const handlePoolIdChange = async (value: string) => {
    form.setValue("poolId", value);
    if (value) {
      const balance = await fetchUserLpBalance(value);
      setUserLpBalance(balance);
    }
  };

  const setHalf = () => {
    const halfAmount = (Number.parseFloat(userLpBalance) / 2).toFixed(2);
    form.setValue("amount", halfAmount);
  };

  const setMax = () => {
    form.setValue("amount", userLpBalance);
  };

  return (
    <div className="rounded-lg border border-gray-500 bg-white p-6 shadow-sm ">
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
                        <Info className="ml-2 h-4 w-4 text-gray-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Nhập mã định danh duy nhất cho pool thanh khoản</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </FormLabel>
                <FormControl>
                  <Input
                    className="border-gray-300 bg-white text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                    placeholder="Nhập Pool ID"
                    {...field}
                    onChange={(e) => handlePoolIdChange(e.target.value)}
                  />
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
                  <span className="text-gray-700">Số dư LP của bạn</span>
                </div>
                <div className="font-medium text-gray-900">
                  {userLpBalance} LP
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
                  Thời gian khóa lâu hơn có thể mang lại phần thưởng cao hơn
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
                <FormLabel className="text-gray-900">Số lượng khóa</FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Input
                      className="border-gray-300 bg-white text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                      placeholder="0.00"
                      {...field}
                    />
                  </FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-gray-300 bg-white text-gray-700 hover:bg-purple-100 hover:text-purple-900"
                    onClick={setHalf}
                  >
                    Nửa
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-gray-300 bg-white text-gray-700 hover:bg-purple-100 hover:text-purple-900"
                    onClick={setMax}
                  >
                    Tối đa
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="rounded-md border border-gray-300 bg-gray-50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Ước tính APR</span>
              <span className="font-medium text-purple-600">12.5%</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-gray-500">Ngày mở khóa</span>
              <span className="font-medium text-gray-900">
                {form.watch("lockPeriod") === "6months" && "19/11/2025"}
                {form.watch("lockPeriod") === "1year" && "19/05/2026"}
                {form.watch("lockPeriod") === "2years" && "19/05/2027"}
                {form.watch("lockPeriod") === "3years" && "19/05/2028"}
                {!form.watch("lockPeriod") && "Chọn thời gian khóa"}
              </span>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-purple-600 to-purple-800 text-white hover:from-purple-700 hover:to-purple-900"
          >
            Khóa LP Token
          </Button>
        </form>
      </Form>
    </div>
  );
}
