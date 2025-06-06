"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { toast } from "sonner";
import { useWallet } from "@solana/wallet-adapter-react";
import SelectToken, { UserToken } from "../transfer/select-token";
import { useIsMobile } from "@/hooks/use-mobile";

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "../ui/tooltip";
import { Info } from "lucide-react";
import BN from "bn.js";

const formSchema = z.object({
    amountToken1: z.string(),
    amountToken2: z.string(),
});

export default function CreatePoolRaydium() {
    const isMobile = useIsMobile();
    const [selectedToken1, setSelectedToken1] = useState<UserToken | null>(null);
    const [selectedToken2, setSelectedToken2] = useState<UserToken | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const { publicKey } = useWallet();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            amountToken1: "",
            amountToken2: "",
        },
    });

    function toLamports(amountStr: string, decimals: number): number {
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) throw new Error('Invalid amount');
        const lamports = Math.floor(amount * 10 ** decimals);
        return lamports;
    }


    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            setLoading(true);

            if (!publicKey) {
                toast.error("Please connect your wallet first");
                return;
            }

            if (!selectedToken1 || !selectedToken2) {
                toast.error("Please select two tokens");
                return;
            }

            if (!selectedToken1.decimals || !selectedToken2.decimals) {
                toast.error("Please enter amount tokens");
                return;
            }

            const lamportsA = toLamports(values.amountToken1, selectedToken1.decimals);
            const lamportsB = toLamports(values.amountToken2, selectedToken2.decimals);

            // Gọi API tạo pool
            const res = await fetch("/api/create-pool-raydium", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    mintAAddress: selectedToken1.address,
                    mintBAddress: selectedToken2.address,
                    amountA: lamportsA,
                    amountB: lamportsB,
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.error || "Failed to create pool");
            }

            toast.success(`Pool created successfully. TxId: ${data.txId}`);

            // Reset form hoặc cập nhật UI nếu cần
            form.reset();
            setSelectedToken1(null);
            setSelectedToken2(null);
        } catch (error: unknown) {
            console.error("Create pool error:", error);
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Create pool failed. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className={`md:p-2 max-w-[550px] mx-auto my-2 ${!isMobile ? "border-gear" : ""
                }`}
        >
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                Create pool with Raydium CPMM
            </h2>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="px-[5px] space-y-6">
                        <SelectToken
                            selectedToken={selectedToken1}
                            setSelectedToken={setSelectedToken1}
                            onAmountChange={(value) => {
                                form.setValue("amountToken1", value);
                            }}
                        />

                        <SelectToken
                            selectedToken={selectedToken2}
                            setSelectedToken={setSelectedToken2}
                            onAmountChange={(value) => {
                                form.setValue("amountToken2", value);
                            }}
                        />

                        <div className="flex items-center gap-2">
                            <div>Initial price</div>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className="h-4 w-4 text-gray-500 mt-[3px]" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>
                                            Initial price is set by the ratio of tokens deposited for
                                            initial liquidity. If the token is already trading on
                                            Raydium, initial price will be auto-filled with the
                                            current price.
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>

                        <div className="border-gear-gray flex items-center justify-between px-2 py-2">
                            <div>
                                {parseFloat(form.watch("amountToken1")) /
                                    parseFloat(form.watch("amountToken2")) || ""}
                            </div>
                            <p>{`${selectedToken1?.symbol}/${selectedToken2?.symbol}`}</p>
                        </div>
                    </div>

                    <Button
                        type="submit"
                        className="w-full text-white font-semibold py-2 rounded-lg transition-colors duration-200"
                        variant="default"
                        disabled={loading || !publicKey}
                    >
                        {loading ? "Processing..." : "Create Liquidity Pool"}
                    </Button>
                </form>
            </Form>
        </div>
    );
}
