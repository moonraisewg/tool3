'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Info, Loader2, Wallet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const formSchema = z.object({
  poolId: z.string().min(1, {
    message: 'Pool ID is required',
  }),
  amount: z.string()
    .min(1, {
      message: 'Amount is required',
    })
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: 'Amount must be greater than 0',
    }),
});

export default function Withdraw() {
  const [isLoading, setIsLoading] = useState(false);
  const [userLpBalance, setUserLpBalance] = useState('0.00');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      poolId: '',
      amount: '',
    },
  });

  const fetchUserLpBalance = async (poolId: string) => {
    console.log(`Fetching balance for pool ${poolId}`);
    return '1000.00';
  };

  const handlePoolIdChange = async (value: string) => {
    form.setValue('poolId', value);
    if (value) {
      const balance = await fetchUserLpBalance(value);
      setUserLpBalance(balance);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsLoading(true);
      // TODO: Implement withdraw logic here
      await new Promise((resolve) => setTimeout(resolve, 1000));
      alert('Withdraw successful!');
      form.reset();
    } catch (error) {
      alert('An error occurred while withdrawing tokens');
    } finally {
      setIsLoading(false);
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Withdraw LP Tokens</h1>

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
            <CardContent className="py-0 px-4 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Wallet className="h-4 w-4 text-purple-400" />
                  <span className="text-gray-700">Your LP Balance</span>
                </div>
                <div className="font-medium text-gray-900">{userLpBalance} LP</div>
              </div>
            </CardContent>
          </Card>

          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-900">Withdraw Amount</FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      className="border-gray-300 bg-white text-gray-900 focus:border-purple-500 focus:ring-purple-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (Number(value) >= 0) {
                          field.onChange(value);
                        }
                      }}
                    />
                  </FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-gray-300 bg-white text-gray-700 hover:bg-purple-100 hover:text-purple-900 cursor-pointer"
                    onClick={setHalf}
                  >
                    Half
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-gray-300 bg-white text-gray-700 hover:bg-purple-100 hover:text-purple-900 cursor-pointer"
                    onClick={setMax}
                  >
                    Max
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-purple-600 to-purple-800 text-white hover:from-purple-700 hover:to-purple-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </span>
            ) : (
              'Withdraw Tokens'
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
