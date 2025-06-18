"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { toast } from "sonner";
import { useWallet } from "@solana/wallet-adapter-react";
import SelectToken, { UserToken } from "../transfer/select-token";
import ReceiveSolDevnet from "./receive-sol-devnet";
import { useIsMobile } from "@/hooks/use-mobile";
import { debounce } from "lodash";
import { ArrowsVertical } from "@nsmr/pixelart-react";
import { Transaction } from "@solana/web3.js";


const formSchema = z.object({
    amount: z.string(),
    solAmount: z.string(),
});

export type FormSellSol = z.infer<typeof formSchema>;

export default function SellSolDevnet() {
    const isMobile = useIsMobile();
    const [selectedToken, setSelectedToken] = useState<UserToken | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [priceLoading, setPriceLoading] = useState<boolean>(false);
    const [isSwapped, setIsSwapped] = useState<boolean>(false);

    const { publicKey, signTransaction } = useWallet();

    const USDPERSOL = 0.049;

    const form = useForm<FormSellSol>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            amount: "",
            solAmount: "",
        },
    });

    const fetchPrice = useCallback(
        async (inputAmount: string) => {
            try {
                setPriceLoading(true);
                if (!inputAmount || Number(inputAmount) === 0 || !selectedToken) {
                    form.setValue(isSwapped ? "amount" : "solAmount", "0.00");
                    return;
                }

                let tokenMint = selectedToken?.address || "";
                if (selectedToken?.address === "NativeSOL") {
                    tokenMint = "So11111111111111111111111111111111111111112";
                }

                const response = await fetch(`https://lite-api.jup.ag/price/v2?ids=${tokenMint}`);

                const result = await response.json();
                const priceInUSD = result?.data[tokenMint]?.price;

                if (priceInUSD) {
                    const amountValue = parseFloat(inputAmount);
                    if (!isNaN(amountValue) && amountValue > 0) {
                        if (isSwapped) {
                            const tokenAmount = (amountValue * USDPERSOL) / priceInUSD;
                            form.setValue("amount", tokenAmount.toFixed(selectedToken?.decimals || 6));
                        } else {
                            const solAmount = (amountValue * priceInUSD) / USDPERSOL;
                            form.setValue("solAmount", solAmount.toFixed(9));
                        }
                    } else {
                        form.setValue(isSwapped ? "amount" : "solAmount", "");
                    }
                } else {
                    form.setValue(isSwapped ? "amount" : "solAmount", "");
                    toast.error("Failed to fetch price data");
                }
            } catch (e) {
                console.error("Failed to fetch price data:", e);
                form.setValue(isSwapped ? "amount" : "solAmount", "");
                toast.error("Failed to fetch price data");
            } finally {
                setPriceLoading(false);
            }
        },
        [selectedToken, form, isSwapped]
    );

    const debouncedFetchPrice = useMemo(() => {
        return debounce((amount: string) => {
            fetchPrice(amount);
        }, 300);
    }, [fetchPrice]);

    const handleSwap = () => {
        setIsSwapped(!isSwapped);
        form.setValue("amount", "");
        form.setValue("solAmount", "");
    };

    const onSubmit = async (values: FormSellSol) => {
        try {
            setLoading(true);
            if (!publicKey || !signTransaction) {
                toast.error("Please connect your wallet first");
                return;
            }
            if (!selectedToken) {
                toast.error("Please select a token");
                return;
            }

            const tokenAmount = parseFloat(values.amount);
            const solAmount = parseFloat(values.solAmount);

            if (tokenAmount > parseFloat(selectedToken.balance)) {
                toast.error(`Insufficient ${selectedToken.symbol} balance`);
                return;
            }

            if (tokenAmount <= 0 || Number.isNaN(tokenAmount) || solAmount <= 0 || Number.isNaN(solAmount)) {
                toast.error("Amount must be greater than 0");
                return;
            }

            const sellData = {
                walletPublicKey: publicKey.toString(),
                tokenAmount: tokenAmount * Math.pow(10, selectedToken.decimals || 0),
                tokenMint: selectedToken.address,
                solAmount: solAmount * 1_000_000_000,
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
                throw new Error(data.error || "Failed to create transaction");
            }

            const tokenTx = Transaction.from(Buffer.from(data.serializedTx, "base64"));
            const signedTx = await signTransaction(tokenTx);

            const confirmResponse = await fetch("/api/sell-sol-devnet/confirm", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    signedTransaction: Array.from(signedTx.serialize()),
                    walletPublicKey: publicKey.toString(),
                    solAmount: sellData.solAmount,
                    tokenMint: selectedToken.address,
                }),
            });

            const confirmData = await confirmResponse.json();

            if (!confirmResponse.ok) {
                throw new Error(confirmData.error || "Failed to send SOL Devnet");
            }

            toast.success("🎉 Buy sol devnet Successful!", {
                description: `You sold ${values.amount} ${selectedToken.symbol} for ${values.solAmount} SOL Devnet`,
                action: {
                    label: "View Transaction",
                    onClick: () =>
                        window.open(
                            `https://solscan.io/tx/${confirmData.solTxSignature}?cluster=devnet`,
                            "_blank"
                        ),
                },
            });
            setSelectedToken(null)
            form.reset();
        } catch (error) {
            const message = error instanceof Error ? error.message : "An unexpected error occurred";
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const amount = form.getValues(isSwapped ? "solAmount" : "amount");
        if (amount) {
            debouncedFetchPrice(amount);
        }
    }, [selectedToken, isSwapped, debouncedFetchPrice, form]);

    return (
        <div className={`md:p-2 max-w-[550px] mx-auto my-2 ${!isMobile && "border-gear"}`}>
            <h1 className="text-2xl font-bold text-gray-900 mb-8 text-center">Buy SOL Devnet</h1>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex flex-col justify-center">
                    <div className="px-[5px] space-y-6">
                        {isSwapped ? (
                            <ReceiveSolDevnet
                                form={form}
                                priceLoading={priceLoading}
                                isSwapped={isSwapped}
                                onAmountChange={debouncedFetchPrice}
                                USDPERSOL={USDPERSOL}
                            />
                        ) : (
                            <SelectToken
                                title="You Pay"
                                selectedToken={selectedToken}
                                setSelectedToken={setSelectedToken}
                                externalAmount={form.watch("amount")}
                                onAmountChange={(value) => {
                                    form.setValue("amount", value);
                                    debouncedFetchPrice(value);
                                }}
                            />
                        )}

                        <div className="flex justify-center">
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="border-gear-gray bg-white text-gray-700 hover:bg-gray-100 cursor-pointer"
                                onClick={handleSwap}
                            >
                                <ArrowsVertical className="h-6 w-6" />
                            </Button>
                        </div>

                        {isSwapped ? (
                            <SelectToken
                                title="You Pay"
                                selectedToken={selectedToken}
                                setSelectedToken={setSelectedToken}
                                onAmountChange={(value) => {
                                    form.setValue("amount", value);
                                }}
                                disabled={true}
                                externalAmount={form.watch("amount")}
                                amountLoading={priceLoading}
                            />
                        ) : (
                            <ReceiveSolDevnet
                                form={form}
                                priceLoading={priceLoading}
                                isSwapped={isSwapped}
                                onAmountChange={debouncedFetchPrice}
                                USDPERSOL={USDPERSOL}
                            />
                        )}
                    </div>
                    <Button
                        type="submit"
                        className="w-full text-white font-semibold py-2 rounded-lg transition-colors duration-200 cursor-pointer mt-4"
                        variant="default"
                        disabled={loading}
                    >
                        {loading ? "Processing..." : "Buy SOL Devnet"}
                    </Button>
                </form>
            </Form>
        </div>
    );
}