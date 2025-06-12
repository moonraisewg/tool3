"use client";

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { toast } from "sonner";
import { useWallet } from "@solana/wallet-adapter-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2, Info } from "lucide-react";
import { Transaction } from "@solana/web3.js";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import SelectToken, { UserToken } from "../transfer/select-token";

const formSchema = z.object({
    amountToken1: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
        message: "Amount must be a valid positive number",
    }),
    amountToken2: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
        message: "Amount must be a valid positive number",
    }),
});


export default function CreatePoolRaydium() {
    const isMobile = useIsMobile();
    const [selectedToken1, setSelectedToken1] = useState<UserToken | null>(null);
    const [selectedToken2, setSelectedToken2] = useState<UserToken | null>(null)
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("");
    const { publicKey, signTransaction } = useWallet();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { amountToken1: "", amountToken2: "" },
    });

    const toLamports = useCallback((amountStr: string, decimals: number): string => {
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) throw new Error("Invalid amount");
        return (amount * 10 ** decimals).toString();
    }, []);

    const checkPoolExists = async (mintA: string, mintB: string) => {
        const res = await fetch("/api/create-pool-raydium/check-pool", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mintAAddress: mintA, mintBAddress: mintB }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.error || "Failed to check pool");
        }
        return data.exists;
    };

    const sendPayment = useCallback(async () => {
        if (!publicKey || !signTransaction) {
            throw new Error("Wallet not connected or does not support transaction signing");
        }

        setLoadingMessage("Requesting payment transaction...");
        const res = await fetch("/api/create-pool-raydium", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userPublicKey: publicKey.toString(),
            }),
        });
        const data = await res.json();
        if (!res.ok || !data.success || !data.paymentTx) {
            throw new Error(data.error || "Unable to create payment transaction");
        }

        setLoadingMessage("Awaiting payment transaction signature...");
        const tx = Transaction.from(Buffer.from(data.paymentTx, "base64"));
        const signedTx = await signTransaction(tx);

        setLoadingMessage("Sending payment transaction...");
        const sendTxResponse = await fetch("/api/send-transaction", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                transaction: Buffer.from(signedTx.serialize()).toString("base64"),
                blockhash: data.blockhash,
                lastValidBlockHeight: data.lastValidBlockHeight,
                cluster: "mainnet"
            }),
        });

        const sendTxData = await sendTxResponse.json();
        if (!sendTxResponse.ok) {
            throw new Error(sendTxData.error || "Failed to send payment transaction");
        }

        return sendTxData.txId;
    }, [publicKey, signTransaction]);

    const sendTokenTransfer = async (tokenTransferTxBase64: string, blockhash: string, lastValidBlockHeight: number) => {
        if (!publicKey || !signTransaction) {
            throw new Error("Wallet not connected or does not support transaction signing");
        }

        setLoadingMessage("Deserializing token transfer transaction...");
        const txBuffer = Buffer.from(tokenTransferTxBase64, "base64");
        const tx = Transaction.from(txBuffer);

        setLoadingMessage("Awaiting token transfer signature...");
        const signedTx = await signTransaction(tx);

        setLoadingMessage("Sending token transfer transaction...");
        const sendTxResponse = await fetch("/api/send-transaction", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                transaction: Buffer.from(signedTx.serialize()).toString("base64"),
                blockhash,
                lastValidBlockHeight,
                cluster: "devnet"
            }),
        });

        const sendTxData = await sendTxResponse.json();
        if (!sendTxResponse.ok) {
            throw new Error(sendTxData.error || "Failed to send token transfer transaction");
        }

        return sendTxData.txId;
    };

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            setLoading(true);
            setLoadingMessage("Checking wallet...");

            if (!publicKey) throw new Error("Please connect your wallet");
            if (!signTransaction) throw new Error("Wallet does not support signing");
            if (!selectedToken1 || !selectedToken2) throw new Error("Please select both tokens");
            if (!selectedToken1.decimals || !selectedToken2.decimals) throw new Error("Invalid token decimals");
            const SOL_MINT = "So11111111111111111111111111111111111111112"
            const mintAAddress =
                selectedToken1.address === "NativeSOL"
                    ? SOL_MINT
                    : selectedToken1.address;
            const mintBAddress =
                selectedToken2.address === "NativeSOL"
                    ? SOL_MINT
                    : selectedToken2.address;
            const amountA = toLamports(values.amountToken1, selectedToken1.decimals);
            const amountB = toLamports(values.amountToken2, selectedToken2.decimals);

            setLoadingMessage("Checking if pool already exists...");
            const poolExists = await checkPoolExists(mintAAddress, mintBAddress);
            if (poolExists) {
                throw new Error("Pool already exists for the selected token pair.");
            }

            setLoadingMessage("Sending payment on Mainnet...");
            const paymentTxId = await sendPayment();

            setLoadingMessage("Please switch your wallet to Devnet for token transfer...");
            toast.info("Please switch your wallet to Devnet to continue.");
            await new Promise((resolve) => setTimeout(resolve, 5000));

            setLoadingMessage("Requesting token transfer transaction...");
            let res = await fetch("/api/create-pool-raydium", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mintAAddress,
                    mintBAddress,
                    amountA,
                    amountB,
                    userPublicKey: publicKey.toString(),
                    paymentTxId,
                }),
            });

            let data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Failed to get token transfer transaction");
            }

            if (data?.tokenTransferTx) {
                setLoadingMessage("Preparing token transfer...");
                const tokenTransferTxId = await sendTokenTransfer(data.tokenTransferTx, data.blockhash, data.lastValidBlockHeight);

                setLoadingMessage("Creating pool on server...");
                res = await fetch("/api/create-pool-raydium", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        mintAAddress,
                        mintBAddress,
                        amountA,
                        amountB,
                        userPublicKey: publicKey.toString(),
                        paymentTxId,
                        tokenTransferTxId,
                    }),
                });

                data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.error || "Failed to create pool");
                }
            }

            toast.success(
                <div className="space-y-2">
                    <p>✅ Pool created successfully!</p>
                    <p className="text-sm">
                        Payment Tx ID:{" "}
                        <a
                            href={`https://solscan.io/tx/${paymentTxId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline"
                        >
                            {paymentTxId.slice(0, 8)}...{paymentTxId.slice(-8)}
                        </a>
                    </p>
                    <p className="text-sm">
                        Pool ID:{" "}
                        <a
                            href={`https://solscan.io/account/${data.poolKeys.poolId}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline"
                        >
                            {data.poolKeys.poolId.slice(0, 8)}...{data.poolKeys.poolId.slice(-8)}
                        </a>
                    </p>
                </div>
            );

            form.reset();
            setSelectedToken1(null);
            setSelectedToken2(null);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "Failed to create pool";
            toast.error(msg);
        } finally {
            setLoading(false);
            setLoadingMessage("");
        }
    };

    const price =
        parseFloat(form.watch("amountToken1")) / parseFloat(form.watch("amountToken2")) || "";

    return (
        <div className={`md:p-2 max-w-[550px] mx-auto my-2 ${!isMobile ? "border-gear" : ""}`}>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                Create Pool with Raydium CPMM (Devnet)
            </h2>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="space-y-6 px-1">
                        <SelectToken
                            selectedToken={selectedToken1}
                            setSelectedToken={setSelectedToken1}
                            onAmountChange={(v) => form.setValue("amountToken1", v)}
                            cluster="devnet"
                        />
                        <SelectToken
                            selectedToken={selectedToken2}
                            setSelectedToken={setSelectedToken2}
                            onAmountChange={(v) => form.setValue("amountToken2", v)}
                            cluster="devnet"
                        />
                        <div className="flex items-center gap-2">
                            <div>Initial price</div>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className="h-4 w-4 text-gray-500 mt-[3px]" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>The initial price is calculated as Token A / Token B.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <div className="border-gear-gray flex items-center justify-between px-2 py-2 text-sm">
                            <div>{price || "-"}</div>
                            <p>{`${selectedToken1?.symbol || "?"}/${selectedToken2?.symbol || "?"}`}</p>
                        </div>
                        <div className="text-sm text-gray-500">
                            <p>Pool creation fee: 0.001 SOL (paid on Mainnet)</p>
                            <p>Transaction fee: 0.0025%</p>
                        </div>
                    </div>
                    <Button
                        type="submit"
                        className="w-full font-semibold py-2 rounded-lg"
                        variant="default"
                        disabled={loading || !publicKey || !signTransaction}
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>{loadingMessage}</span>
                            </div>
                        ) : (
                            "Create Liquidity Pool"
                        )}
                    </Button>
                </form>
            </Form>
        </div>
    );
}