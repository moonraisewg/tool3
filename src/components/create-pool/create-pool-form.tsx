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
import {
    Connection,
    PublicKey,
    SystemProgram,
    Transaction,
    LAMPORTS_PER_SOL,
} from "@solana/web3.js";
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

const PAYMENT_WALLET = new PublicKey("FbirCYiRfy64Bfp8WuMfyx57ifevXWWjWgohnzgCv8gK");
const PAYMENT_AMOUNT = 0.00001 * LAMPORTS_PER_SOL;

export default function CreatePoolRaydium() {
    const isMobile = useIsMobile();
    const [selectedToken1, setSelectedToken1] = useState<UserToken | null>(null);
    const [selectedToken2, setSelectedToken2] = useState<UserToken | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("");
    const { publicKey, signTransaction } = useWallet();
    const mainnetConnection = new Connection("https://mainnet.helius-rpc.com/?api-key=4c0b7347-3a35-4a3c-a9ed-cd3e1763e54c", "confirmed");
    const devnetConnection = new Connection(
        "https://devnet.helius-rpc.com/?api-key=4c0b7347-3a35-4a3c-a9ed-cd3e1763e54c",
        "confirmed"
    );

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { amountToken1: "", amountToken2: "" },
    });

    const toLamports = useCallback((amountStr: string, decimals: number): bigint => {
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) throw new Error("Invalid amount");
        return BigInt(Math.floor(amount * 10 ** decimals));
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

        setLoadingMessage("Preparing payment transaction...");

        const tx = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: publicKey,
                toPubkey: PAYMENT_WALLET,
                lamports: PAYMENT_AMOUNT,
            })
        );

        tx.recentBlockhash = (await mainnetConnection.getLatestBlockhash()).blockhash;
        tx.feePayer = publicKey;

        setLoadingMessage("Awaiting transaction signature...");
        const signedTx = await signTransaction(tx);

        setLoadingMessage("Sending payment transaction...");
        const txId = await mainnetConnection.sendRawTransaction(signedTx.serialize(), {
            skipPreflight: false,
            preflightCommitment: "confirmed",
        });

        setLoadingMessage("Waiting for payment confirmation...");
        const confirmation = await mainnetConnection.confirmTransaction(txId, "confirmed");

        if (confirmation.value.err) {
            throw new Error("Payment transaction failed: " + confirmation.value.err.toString());
        }

        return txId;
    }, [publicKey, signTransaction]);

    const sendTokenTransfer = async (tokenTransferTxBase64: string) => {
        if (!publicKey || !signTransaction) {
            throw new Error("Wallet not connected or does not support transaction signing");
        }

        setLoadingMessage("Deserializing token transfer transaction...");
        const txBuffer = Buffer.from(tokenTransferTxBase64, "base64");
        const tx = Transaction.from(txBuffer);

        setLoadingMessage("Awaiting token transfer signature...");
        const signedTx = await signTransaction(tx);
        setLoadingMessage("Sending token transfer transaction...");
        const txId = await devnetConnection.sendRawTransaction(signedTx.serialize(), {
            skipPreflight: false,
            preflightCommitment: "confirmed",
        });

        setLoadingMessage("Waiting for token transfer confirmation...");
        const confirmation = await devnetConnection.confirmTransaction(txId, "confirmed");
        if (confirmation.value.err) {
            throw new Error("Token transfer transaction failed: " + confirmation.value.err.toString());
        }

        return txId;
    };

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            setLoading(true);
            setLoadingMessage("Checking wallet...");

            if (!publicKey) throw new Error("Please connect your wallet");
            if (!signTransaction) throw new Error("Wallet does not support signing");
            if (!selectedToken1 || !selectedToken2) throw new Error("Please select both tokens");
            if (!selectedToken1.decimals || !selectedToken2.decimals) throw new Error("Invalid token decimals");

            const mintAAddress =
                selectedToken1.address === "NativeSOL"
                    ? "So11111111111111111111111111111111111111112"
                    : selectedToken1.address;
            const mintBAddress =
                selectedToken2.address === "NativeSOL"
                    ? "So11111111111111111111111111111111111111112"
                    : selectedToken2.address;
            const lamportsA = toLamports(values.amountToken1, selectedToken1.decimals);
            const lamportsB = toLamports(values.amountToken2, selectedToken2.decimals);

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
                    amountA: lamportsA.toString(),
                    amountB: lamportsB.toString(),
                    userPublicKey: publicKey.toBase58(),
                    paymentTxId,
                }),
            });

            let data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Failed to get token transfer transaction");
            }

            if (data?.tokenTransferTx) {
                setLoadingMessage("Preparing token transfer...");
                const tokenTransferTxId = await sendTokenTransfer(data?.tokenTransferTx);

                setLoadingMessage("Creating pool on server...");
                res = await fetch("/api/create-pool-raydium", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        mintAAddress,
                        mintBAddress,
                        amountA: lamportsA.toString(),
                        amountB: lamportsB.toString(),
                        userPublicKey: publicKey.toBase58(),
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
                            href={`https://solscan.io/tx/${paymentTxId}?cluster=mainnet-beta`}
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
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Unknown error";
            return new Response(JSON.stringify({ success: false, error: message }), { status: 500 });
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
                        />
                        <SelectToken
                            selectedToken={selectedToken2}
                            setSelectedToken={setSelectedToken2}
                            onAmountChange={(v) => form.setValue("amountToken2", v)}
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
                            <p>Pool creation fee: 0.01 SOL (paid on Mainnet)</p>
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