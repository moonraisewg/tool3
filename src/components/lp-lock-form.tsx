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
  const [userLpBalance, setUserLpBalance] = useState("1000.00");

  const fetchUserLpBalance = async (poolId: string) => {
    console.log(`Fetching balance for pool ${poolId}`);
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
      console.log("Locking token:", values);
      toast.success("Token locked successfully", {
        description: `You have locked ${values.amount} LP tokens for ${values.lockPeriod}`,
      });
    } catch (error) {
      toast.error("Failed to lock token. Please try again.");
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
                        <Info className="ml-2 h-4 w-4 text-gray-500 mb-[3px]" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Enter the unique identifier for the liquidity pool</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </FormLabel>
                <FormControl>
                  <Input
                    className="border-gray-300 bg-white text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                    placeholder="Enter Pool ID"
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
                  <span className="text-gray-700">Your LP Balance</span>
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
                <div className="flex items-center justify-between">
                  <FormLabel className="text-gray-900">
                    Lock Period
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="ml-2 h-4 w-4 text-gray-500 mb-[3px]" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Choose how long you want to lock your LP tokens</p>
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
                        <SelectValue placeholder="Select lock period" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="border-gray-300 bg-white text-gray-900">
                      <SelectItem value="6months">6 months</SelectItem>
                      <SelectItem value="1year">1 year</SelectItem>
                      <SelectItem value="2years">2 years</SelectItem>
                      <SelectItem value="3years">3 years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                    />
                  </FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-gray-300 bg-white text-gray-700 hover:bg-purple-100 hover:text-purple-900"
                    onClick={setHalf}
                  >
                    Half
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-gray-300 bg-white text-gray-700 hover:bg-purple-100 hover:text-purple-900"
                    onClick={setMax}
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
          >
            Lock LP Token
          </Button>
        </form>
      </Form>
    </div>
  );
}