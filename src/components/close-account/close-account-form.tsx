"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { toast } from "sonner";
import { useWallet } from "@solana/wallet-adapter-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2 } from "lucide-react";
import { Transaction } from "@solana/web3.js";
import { useUserTokens } from "@/hooks/useUserTokens";
import Image from "next/image";
import { NATIVE_SOL } from "@/utils/constants";

const formSchema = z.object({
    selectedAccounts: z.array(z.string()).min(1, "Please select at least one account to close"),
});

export default function CloseAccountForm() {
    const isMobile = useIsMobile();
    const [loading, setLoading] = useState(false);
    const [estimatedRent, setEstimatedRent] = useState({ userRent: 0, systemRent: 0 });
    const { publicKey, signTransaction } = useWallet();
    const { tokens, loading: tokensLoading, refetch } = useUserTokens("mainnet", undefined, true);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { selectedAccounts: [] },
    });

    const selectedAccounts = form.watch("selectedAccounts");

    const zeroBalanceAccounts = tokens.filter(
        (token) => token.address !== NATIVE_SOL && parseFloat(token.balance) === 0
    );

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            form.setValue(
                "selectedAccounts",
                zeroBalanceAccounts.map((token) => token.address)
            );
        } else {
            form.setValue("selectedAccounts", []);
        }
    };

    const shortenAddress = (address: string) => {
        if (address.length <= 10) return address;
        return `${address.slice(0, 5)}...${address.slice(-5)}`;
    };

    useEffect(() => {
        const fetchRent = async () => {
            if (selectedAccounts.length === 0 || !publicKey) {
                setEstimatedRent({ userRent: 0, systemRent: 0 });
                return;
            }
            try {
                const response = await fetch("/api/close-account", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userPublicKey: publicKey.toString(),
                        tokenAccounts: selectedAccounts,
                        estimateOnly: true,
                    }),
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || "Failed to estimate rent");
                setEstimatedRent({
                    userRent: data.userRent * 0.9,
                    systemRent: data.userRent * 0.1,
                });
            } catch (error: unknown) {
                const message =
                    error instanceof Error
                        ? error.message
                        : "Failed to estimate rent";
                toast.error(message);

                setEstimatedRent({ userRent: 0, systemRent: 0 });
            }
        };
        fetchRent();
    }, [selectedAccounts, publicKey]);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            setLoading(true);

            if (!publicKey || !signTransaction) {
                throw new Error("Please connect your wallet first");
            }

            const response = await fetch("/api/close-account", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userPublicKey: publicKey.toString(),
                    tokenAccounts: values.selectedAccounts,
                }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to prepare transaction");

            const transaction = Transaction.from(Buffer.from(data.transaction, "base64"));
            const signedTransaction = await signTransaction(transaction);

            const executeResponse = await fetch("/api/close-account", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userPublicKey: publicKey.toString(),
                    tokenAccounts: values.selectedAccounts,
                    signedTransaction: Array.from(signedTransaction.serialize()),
                }),
            });

            const executeData = await executeResponse.json();
            if (!executeResponse.ok) throw new Error(executeData.error || "Failed to execute transaction");

            toast.success("🎉 Accounts closed successfully!", {
                description: `Closed ${values.selectedAccounts.length} accounts. You received ${(estimatedRent.userRent / 1_000_000_000).toFixed(9)} SOL.`,
                action: {
                    label: "View Transaction",
                    onClick: () => window.open(`https://solscan.io/tx/${executeData.signature}`, "_blank"),
                },
            });

            form.reset();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to close accounts";
            toast.error(message);
        } finally {
            refetch()
            setLoading(false);
        }
    };

    return (
        <div className={`md:p-2 max-w-[550px] mx-auto my-2 flex flex-col items-center ${!isMobile && "border-gear"}`}>
            <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">Close Zero-Balance Accounts</h1>

            <div className="mb-4 px-3 py-[8px] bg-green-50 border-gear-green-200 w-[calc(100%-10px)]">
                <p className="text-sm text-green-800">
                    ⚡ Solana Blockchain keeps your SOL! We give it back to you!
                </p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 w-full">
                    <div className="space-y-4 flex flex-col items-center">
                        {tokensLoading ? (
                            <div className="text-center">Loading accounts...</div>
                        ) : zeroBalanceAccounts.length === 0 ? (
                            <div className="text-center text-gray-600">
                                No zero-balance accounts found. Try connecting a different wallet or switching clusters.
                            </div>
                        ) : (
                            <div className="space-y-2 w-full">
                                <label className="flex items-center gap-2 p-2 border rounded-lg bg-gray-50 cursor-pointer px-4">
                                    <input
                                        type="checkbox"
                                        checked={selectedAccounts.length === zeroBalanceAccounts.length}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                    />
                                    <span className="font-medium ml-2">Select All ({zeroBalanceAccounts.length} accounts)</span>
                                </label>
                                <div className="max-h-[240px] overflow-y-auto space-y-2 custom-scroll">
                                    {zeroBalanceAccounts.map((token) => (
                                        <label
                                            key={token.address}
                                            className="flex items-center gap-4 p-2 border rounded-lg hover:bg-gray-100 cursor-pointer px-4"
                                        >
                                            <input
                                                type="checkbox"
                                                value={token.address}
                                                checked={selectedAccounts.includes(token.address)}
                                                onChange={(e) => {
                                                    const current = form.getValues("selectedAccounts");
                                                    if (e.target.checked) {
                                                        form.setValue("selectedAccounts", [...current, token.address]);
                                                    } else {
                                                        form.setValue("selectedAccounts", current.filter((addr) => addr !== token.address));
                                                    }
                                                }}
                                            />
                                            <div className="flex items-center gap-4">
                                                <Image
                                                    src={token.logoURI || "/image/none-icon.webp"}
                                                    alt={token.name}
                                                    width={28}
                                                    height={28}
                                                    className="rounded-full object-cover !h-[28px] !w-[28px]"
                                                />
                                                <div>
                                                    <div>{token.symbol || "UNKNOWN"} ({token.name})</div>
                                                    <div className="text-sm text-gray-400">{shortenAddress(token.address)}</div>
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="px-3 py-[8px] bg-blue-50 border-gear-blue w-[calc(100%-10px)]">
                            <div className="text-sm text-blue-800">
                                💰 <strong>Estimated Reclaimed Rent ({selectedAccounts.length} accounts):</strong>{" "}
                                {selectedAccounts.length === 0 ? (
                                    "Select accounts to estimate"
                                ) : (
                                    <div className="mt-1">
                                        You will receive: <strong className="text-green-600">+{(estimatedRent.userRent / 1_000_000_000).toFixed(9)} SOL</strong> <br />
                                        Fees: {(estimatedRent.systemRent / 1_000_000_000).toFixed(9)} SOL
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <Button
                        type="submit"
                        className="w-full font-semibold py-2 rounded-lg cursor-pointer"
                        variant="default"
                        disabled={loading || !publicKey || selectedAccounts.length === 0}
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Closing Accounts...</span>
                            </div>
                        ) : (
                            "Close Accounts"
                        )}
                    </Button>
                </form>
            </Form>
        </div>
    );
}