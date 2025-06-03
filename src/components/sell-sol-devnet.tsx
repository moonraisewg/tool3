"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useWallet } from "@solana/wallet-adapter-react";
import SelectToken, { UserToken } from "./transfer/select-token";
import { useIsMobile } from "@/hooks/use-mobile";
import Image from "next/image";
import { debounce } from "lodash";
import { Loader } from "@nsmr/pixelart-react";

const formSchema = z.object({
    amount: z.string(),
    solAmount: z.string(),
});

export default function SellSolDevnet() {
    const isMobile = useIsMobile();
    const [selectedToken, setSelectedToken] = useState<UserToken | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [priceLoading, setPriceLoading] = useState<boolean>(false);

    const { publicKey } = useWallet();

    const USDPERSOL = 0.049

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            amount: "",
            solAmount: "",
        },
    });

    const fetchPrice = useCallback(async (inputAmount: string) => {
        try {
            setPriceLoading(true);
            if (!inputAmount || Number(inputAmount) === 0) {
                form.setValue("solAmount", "0.00");
            }

            let tokenMint = selectedToken?.address ?? "";
            if (selectedToken?.address === "NativeSOL") {
                tokenMint = "So11111111111111111111111111111111111111112";
            }

            const response = await fetch(
                `https://lite-api.jup.ag/price/v2?ids=${tokenMint}`
            );

            const result = await response.json();
            console.log(result?.data[tokenMint]?.price);

            if (result?.data[tokenMint]?.price) {
                const priceInUSD = result?.data[tokenMint]?.price;

                if (inputAmount) {
                    const amountValue = parseFloat(inputAmount);
                    if (!isNaN(amountValue) && amountValue > 0) {
                        const solAmount = (amountValue * priceInUSD) / USDPERSOL;
                        form.setValue("solAmount", solAmount.toString());
                    } else {
                        form.setValue("solAmount", "");
                    }
                }
            } else {
                form.setValue("solAmount", "");
                toast.error("Failed to fetch price data");
            }
        } catch (e) {
            console.error("Failed to fetch price data:", e);
            form.setValue("solAmount", "");
        } finally {
            setPriceLoading(false);
        }
    }, [selectedToken, form]);


    const debouncedFetchPrice = useMemo(() => {
        return debounce((amount: string) => {
            fetchPrice(amount);
        }, 1000);
    }, [fetchPrice]);


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

            const tokenAmount = parseFloat(values.amount);
            const solAmount = parseFloat(values.solAmount)

            if (tokenAmount > parseFloat(selectedToken.balance)) {
                toast.error("Insufficient balance");
                return;
            }

            if (tokenAmount <= 0 || Number.isNaN(tokenAmount)) {
                toast.error("Amount must be greater than 0");
                return;
            }

            const sellData = {
                walletPublicKey: publicKey.toString(),
                tokenAmount: tokenAmount * Math.pow(10, selectedToken.decimals || 0),
                tokenMint: selectedToken.address,
                solAmount: solAmount
            };

            const response = await fetch("/api/sell-sol-devnet", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(sellData),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Transfer failed");
            }

            toast.success("Buy successful", {
                description: `You have bought ${values.solAmount} SOL Devnet`,
            });
            form.reset();
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "An unexpected error occurred";
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        debouncedFetchPrice(form.getValues("amount"))
    }, [selectedToken]);

    return (
        <div
            className={`md:p-2 max-w-[550px] mx-auto my-2 ${!isMobile && "border-gear"}`}
        >
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
                Buy Solana Devnet
            </h2>
            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4 flex flex-col justify-center"
                >
                    <div className="px-[5px] space-y-6">
                        <SelectToken
                            title={"You Pay"}
                            onTokenSelect={setSelectedToken}
                            onAmountChange={(value) => {
                                form.setValue("amount", value);
                                debouncedFetchPrice(value);
                            }}
                        />

                        <div className="bg-white border-gear-gray p-3 flex flex-col min-h-[120px] justify-between pt-[18px]">
                            <div className="flex items-center justify-between mb-2">
                                <div className="ml-[4px]">You Receive</div>
                                <div className="flex items-center sm:gap-4 gap-1 mr-1">
                                    ${USDPERSOL} per SOL Devnet
                                </div>
                            </div>

                            <div className="flex justify-between items-center mb-2 mt-4 h-[40px]">
                                <div className="flex gap-2 flex items-center gap-2 text-gray-700 border-gear-gray px-2 py-1 ml-2">
                                    <Image
                                        src={
                                            "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
                                        }
                                        alt={"Solana"}
                                        width={24}
                                        height={24}
                                        className="rounded-full object-cover"
                                    />
                                    <div className="mt-[2px]">SOL Devnet</div>
                                </div>

                                <div className=" max-w-[300px] h-[40px] flex items-center">

                                    {priceLoading ? (
                                        <Loader className="h-6 w-6 animate-spin text-gray-500 mb-1" />
                                    ) : <FormField
                                        control={form.control}
                                        name="solAmount"
                                        render={({ field }) => (
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    className="focus-visible:ring-0 focus-visible:border-none focus-visible:outline-none outline-none ring-0 border-none shadow-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-right md:!text-[32px] !text-[24px] pr-0"
                                                    placeholder="0.00"
                                                    disabled={true}
                                                    {...field}
                                                />
                                            </FormControl>
                                        )}
                                    />}
                                </div>
                            </div>
                        </div>
                    </div>
                    <Button
                        type="submit"
                        className="w-full text-white font-semibold py-2 rounded-lg transition-colors duration-200 cursor-pointer mt-4"
                        variant="default"
                        disabled={loading}
                    >
                        Buy Sol Devnet
                    </Button>
                </form>
            </Form>
        </div>
    );
}