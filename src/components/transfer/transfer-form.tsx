"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useWallet } from "@solana/wallet-adapter-react";
import SelectToken, { Token } from "./select-token";
import { useIsMobile } from "@/hooks/use-mobile";

const formSchema = z.object({
    recipient: z
        .string()
        .min(1, { message: "Recipient address is required" })
        .regex(/^[\w]{32,44}$/, { message: "Invalid Solana address" }),
    amount: z
        .string()
});

export default function TransferForm() {
    const isMobile = useIsMobile()
    const [selectedToken, setSelectedToken] = useState<Token | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const { publicKey } = useWallet();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            recipient: "",
            amount: "",
        },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            setLoading(true);
            if (!publicKey) {
                toast.error("Please connect your wallet first");
                return;
            }
            if (!selectedToken) {
                toast.error("Please select a token");
                return;
            }

            const amountValue = parseFloat(values.amount);

            if (amountValue > parseFloat(selectedToken.balance)) {
                toast.error("Insufficient balance");
                return;
            }

            if (amountValue <= 0 || Number.isNaN(amountValue)) {
                toast.error("Amount must be greater than 0");
                return;
            }

            const transferData = {
                walletPublicKey: publicKey.toString(),
                recipient: values.recipient,
                amount: amountValue * Math.pow(10, selectedToken.decimals || 0),
                tokenMint: selectedToken.address,
            };

            const response = await fetch("/api/transfer", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(transferData),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Transfer failed");
            }

            toast.success("Transfer successful", {
                description: `You have transferred ${values.amount} ${selectedToken.symbol || selectedToken.name} to ${values.recipient}`,
            });
            form.reset();
        } catch (error) {
            const message = error instanceof Error ? error.message : "An unexpected error occurred";
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`md:p-2 max-w-[550px] mx-auto my-2 ${!isMobile && "border-gear"}`}>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                Transfer Tokens
            </h2>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex flex-col justify-center">
                    <div className="px-[5px] space-y-6">
                        <FormField
                            control={form.control}
                            name="recipient"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-gray-900 mb-2">Recipient Address</FormLabel>
                                    <FormControl>
                                        <Input
                                            className="border-gear-gray bg-white text-gray-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                                            placeholder="Enter recipient Solana address"
                                            {...field}
                                            disabled={loading}
                                        />
                                    </FormControl>
                                    <FormMessage className="text-red-500 text-sm mt-1" />
                                </FormItem>
                            )}
                        />

                        <SelectToken
                            onTokenSelect={setSelectedToken}
                            onAmountChange={(value) => {
                                form.setValue("amount", value);
                            }}
                        />
                    </div>

                    <Button
                        type="submit"
                        className="w-full text-white font-semibold py-2 rounded-lg transition-colors duration-200 cursor-pointer mt-4"
                        variant="default"
                        disabled={loading}
                    >
                        Transfer Token
                    </Button>
                </form>
            </Form>
        </div>
    );
}