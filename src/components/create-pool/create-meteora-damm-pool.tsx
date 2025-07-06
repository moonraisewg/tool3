"use client"

import { useState, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import { toast } from "sonner"
import { useWallet } from "@solana/wallet-adapter-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { Loader2, Info, ChevronRight } from "lucide-react"
import { Transaction } from "@solana/web3.js"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip"
import SelectToken from "../transfer/select-token"
import { UserToken } from "@/hooks/useUserTokens"
import { CREATE_POOL_FEE, TOKEN2022 } from "@/utils/constants"

const formSchema = z.object({
    amountToken1: z.string().refine((val) => !isNaN(Number.parseFloat(val)) && Number.parseFloat(val) > 0, {
        message: "Amount must be a valid positive number",
    }),
    amountToken2: z.string().refine((val) => !isNaN(Number.parseFloat(val)) && Number.parseFloat(val) > 0, {
        message: "Amount must be a valid positive number",
    }),
})

export default function CreateMeteoraDammPool() {
    const isMobile = useIsMobile()
    const [selectedToken1, setSelectedToken1] = useState<UserToken | null>(null)
    const [selectedToken2, setSelectedToken2] = useState<UserToken | null>(null)
    const [loading, setLoading] = useState(false)
    const [loadingMessage, setLoadingMessage] = useState("")
    const [currentStep, setCurrentStep] = useState(1)
    const [paymentTxId, setPaymentTxId] = useState("")
    const [poolResult, setPoolResult] = useState<{ poolTxId: string; poolKeys: { poolId: string } } | null>(null)
    const { publicKey, signTransaction } = useWallet()

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { amountToken1: "", amountToken2: "" },
    })

    const toLamports = useCallback((amountStr: string, decimals: number): string => {
        const amount = Number.parseFloat(amountStr)
        if (isNaN(amount) || amount <= 0) throw new Error("Invalid amount")
        return (amount * 10 ** decimals).toString()
    }, [])

    const checkPoolExists = async (mintA: string, mintB: string) => {
        const res = await fetch("/api/create-pool-meteora-damm/check-pool", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mintAAddress: mintA, mintBAddress: mintB }),
        })
        const data = await res.json()
        if (!res.ok || !data.success) {
            throw new Error(data.error || "Failed to check pool")
        }
        return data.exists
    }

    const sendPayment = useCallback(async (mintAAddress: string, mintBAddress: string) => {
        if (!publicKey || !signTransaction) {
            throw new Error("Wallet not connected or does not support transaction signing")
        }
        setLoadingMessage("Requesting payment transaction...")
        const res = await fetch("/api/create-pool-meteora-damm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userPublicKey: publicKey.toString(),
                mintAAddress,
                mintBAddress
            }),
        })
        const data = await res.json()
        if (!res.ok || !data.success || !data.paymentTx) {
            throw new Error(data.error || "Unable to create payment transaction")
        }

        setLoadingMessage("Awaiting payment transaction signature...")
        const tx = Transaction.from(Buffer.from(data.paymentTx, "base64"))
        const signedTx = await signTransaction(tx)

        setLoadingMessage("Sending payment transaction...")
        const sendTxResponse = await fetch("/api/send-transaction", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                transaction: Buffer.from(signedTx.serialize()).toString("base64"),
                blockhash: data.blockhash,
                lastValidBlockHeight: data.lastValidBlockHeight,
                cluster: "mainnet",
            }),
        })

        const sendTxData = await sendTxResponse.json()
        if (!sendTxResponse.ok) {
            throw new Error(sendTxData.error || "Failed to send payment transaction")
        }

        return sendTxData.txId
    }, [publicKey, signTransaction])

    const sendTokenTransfer = async (tokenTransferTxBase64: string, blockhash: string, lastValidBlockHeight: number) => {
        if (!publicKey || !signTransaction) {
            throw new Error("Wallet not connected or does not support transaction signing")
        }

        setLoadingMessage("Deserializing token transfer transaction...")
        const txBuffer = Buffer.from(tokenTransferTxBase64, "base64")
        const tx = Transaction.from(txBuffer)

        setLoadingMessage("Awaiting token transfer signature...")
        const signedTx = await signTransaction(tx)

        setLoadingMessage("Sending token transfer transaction...")
        const sendTxResponse = await fetch("/api/send-transaction", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                transaction: Buffer.from(signedTx.serialize()).toString("base64"),
                blockhash,
                lastValidBlockHeight,
                cluster: "devnet",
            }),
        })

        const sendTxData = await sendTxResponse.json()
        if (!sendTxResponse.ok) {
            throw new Error(sendTxData.error || "Failed to send token transfer transaction")
        }

        return sendTxData.txId
    }

    const handleNext = async () => {
        try {
            setLoading(true)
            if (currentStep === 1) {
                if (!publicKey) throw new Error("Please connect your wallet")
                if (!selectedToken1 || !selectedToken2) throw new Error("Please select both tokens")
                if (selectedToken1.address === selectedToken2.address) {
                    throw new Error("Token A and Token B cannot be the same")
                }
                if (!selectedToken1.decimals || !selectedToken2.decimals) throw new Error("Invalid token decimals")
                const isValid = await form.trigger()
                if (!isValid) throw new Error("Please enter valid token amounts")
                setLoadingMessage("Checking if pool already exists...")
                const poolExists = await checkPoolExists(selectedToken1.address, selectedToken2.address)
                if (poolExists) {
                    throw new Error("Pool already exists for the selected token pair")
                }
                setCurrentStep(2)
            } else if (currentStep === 2) {
                setLoadingMessage("Sending payment on Mainnet...")
                const mintAAddress = selectedToken1!.address
                const mintBAddress = selectedToken2!.address
                const txId = await sendPayment(mintAAddress, mintBAddress)
                setPaymentTxId(txId)
                setCurrentStep(3)
            } else if (currentStep === 3) {
                setLoadingMessage("Requesting token transfer transaction...")
                const values = form.getValues()
                const amountA = toLamports(values.amountToken1, selectedToken1!.decimals!)
                const amountB = toLamports(values.amountToken2, selectedToken2!.decimals!)
                const mintAAddress = selectedToken1!.address
                const mintBAddress = selectedToken2!.address
                const resTokenTransfer = await fetch("/api/create-pool-meteora-damm", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        mintAAddress,
                        mintBAddress,
                        amountA,
                        amountB,
                        userPublicKey: publicKey!.toString(),
                        paymentTxId,
                    }),
                })
                const dataTokenTransfer = await resTokenTransfer.json()
                if (!resTokenTransfer.ok || !dataTokenTransfer.success) {
                    throw new Error(dataTokenTransfer.error || "Failed to get token transfer transaction")
                }

                let tokenTransferTxId = ""
                if (dataTokenTransfer?.tokenTransferTx) {
                    setLoadingMessage("Preparing token transfer...")
                    tokenTransferTxId = await sendTokenTransfer(
                        dataTokenTransfer.tokenTransferTx,
                        dataTokenTransfer.blockhash,
                        dataTokenTransfer.lastValidBlockHeight
                    )
                }

                setLoadingMessage("Creating pool on server...")
                const resCreatePool = await fetch("/api/create-pool-meteora-damm", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        mintAAddress,
                        mintBAddress,
                        amountA,
                        amountB,
                        userPublicKey: publicKey!.toString(),
                        paymentTxId,
                        tokenTransferTxId,
                    }),
                })
                const dataCreatePool = await resCreatePool.json()
                if (!resCreatePool.ok || !dataCreatePool.success) {
                    throw new Error(dataCreatePool.error || "Failed to create pool")
                }

                setPoolResult({
                    poolTxId: dataCreatePool.poolTxId,
                    poolKeys: dataCreatePool.poolKeys,
                })
                toast.success(
                    <div className="space-y-2">
                        <p>✅ Pool created successfully!</p>
                        <p className="text-sm">
                            Create pool Tx ID:{" "}
                            <a
                                href={`https://solscan.io/tx/${dataCreatePool?.poolTxId}?cluster=devnet`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline"
                            >
                                {dataCreatePool?.poolTxId.slice(0, 8)}...{dataCreatePool?.poolTxId.slice(-8)}
                            </a>
                        </p>
                        <p className="text-sm">
                            Pool ID:{" "}
                            <a
                                href={`https://solscan.io/account/${dataCreatePool.poolKeys.poolId}?cluster=devnet`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline"
                            >
                                {dataCreatePool.poolKeys.poolId.slice(0, 8)}...{dataCreatePool.poolKeys.poolId.slice(-8)}
                            </a>
                        </p>
                    </div>,
                )
                setCurrentStep(4)
            } else if (currentStep === 4) {
                form.reset()
                setSelectedToken1(null)
                setSelectedToken2(null)
                setPaymentTxId("")
                setPoolResult(null)
                setCurrentStep(1)
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "An error occurred"
            toast.error(msg)
        } finally {
            setLoading(false)
            setLoadingMessage("")
        }
    }

    const price = Number.parseFloat(form.watch("amountToken1")) / Number.parseFloat(form.watch("amountToken2")) || ""

    const steps = [
        { title: "Choose Tokens", description: "Choose the token pair and specify amounts for your liquidity pool." },
        { title: "Confirm Payment", description: `Pay ${CREATE_POOL_FEE} SOL on Mainnet to proceed.` },
        { title: "Create Pool", description: "Transfer tokens and finalize the pool creation on Devnet." },
        { title: "Result", description: "View the created pool details." },
    ]

    const getButtonText = () => {
        if (loading) return loadingMessage
        if (currentStep === 1) return "Continue"
        if (currentStep === 2) return "Pay Fee"
        if (currentStep === 3) return "Create Pool"
        return "Create Another Pool"
    }

    return (
        <div className={`md:p-2 max-w-[550px] mx-auto my-2 ${!isMobile ? "border-gear" : ""}`}>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">Create Pool with Meteora DAMM (Devnet)</h1>
                <div className="flex justify-between mb-4">
                    {steps.map((step, index) => (
                        <div
                            key={index}
                            className={`flex-1 text-center ${currentStep === index + 1 ? "text-blue-500 font-semibold" : "text-gray-500"}`}
                        >
                            <div className="text-sm">{step.title}</div>
                            <div className={`h-1 mt-1 ${currentStep >= index + 1 ? "bg-blue-500" : "bg-gray-200"}`}></div>
                        </div>
                    ))}
                </div>
            </div>

            <Form {...form}>
                <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
                    {currentStep === 1 && (
                        <div className="space-y-6 px-1">
                            <SelectToken
                                selectedToken={selectedToken1}
                                setSelectedToken={setSelectedToken1}
                                onAmountChange={(v) => form.setValue("amountToken1", v)}
                                cluster="devnet"
                                amount={form.watch("amountToken1")}
                                excludeToken={[TOKEN2022]}
                            />
                            {form.formState.errors.amountToken1 && (
                                <p className="text-sm text-red-500 mt-1">
                                    {form.formState.errors.amountToken1.message}
                                </p>
                            )}
                            <SelectToken
                                selectedToken={selectedToken2}
                                setSelectedToken={setSelectedToken2}
                                onAmountChange={(v) => form.setValue("amountToken2", v)}
                                cluster="devnet"
                                amount={form.watch("amountToken2")}
                                excludeToken={[TOKEN2022]}
                            />
                            {form.formState.errors.amountToken2 && (
                                <p className="text-sm text-red-500 mt-1">
                                    {form.formState.errors.amountToken2.message}
                                </p>
                            )}
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
                                <p>{`${selectedToken1?.symbol || "UNKNOW"}/${selectedToken2?.symbol || "UNKNOW"}`}</p>
                            </div>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div className="space-y-6 px-1">
                            <div className="text-sm text-gray-500">
                                <p>Pool creation fee: {CREATE_POOL_FEE} SOL (paid on Mainnet)</p>
                                <p className="mt-2">Please click Pay Fee and confirm the payment to proceed with pool creation.</p>
                            </div>
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div className="space-y-6 px-1">
                            <div className="text-sm">
                                <p className="mt-1"><strong>Token Pair:</strong> {selectedToken1?.symbol || "UNKNOW"} / {selectedToken2?.symbol || "UNKNOW"}</p>
                                <p className="mt-1"><strong>Amount A:</strong> {form.watch("amountToken1")}</p>
                                <p className="mt-1"><strong>Amount B:</strong> {form.watch("amountToken2")}</p>
                                <p className="mt-1"><strong>Initial Price:</strong> {price} {selectedToken1?.symbol || "UNKNOW"}/{selectedToken2?.symbol || "UNKNOW"}</p>
                                <p className="mt-1"><strong>Fee:</strong> {CREATE_POOL_FEE} SOL</p>
                                <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-2">⚡Switch your wallet to Devnet, then click Create Pool to transfer tokens and finalize the pool creation.</div>
                            </div>
                        </div>
                    )}

                    {currentStep === 4 && (
                        <div className="space-y-6 px-1">
                            <div className="text-sm text-gray-500">
                                <p className="text-green-600 font-semibold">✅ Pool created successfully!</p>
                                <p className="mt-2">
                                    Create pool Tx ID:{" "}
                                    <a
                                        href={`https://solscan.io/tx/${poolResult?.poolTxId}?cluster=devnet`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-500 hover:underline"
                                    >
                                        {poolResult?.poolTxId.slice(0, 8)}...{poolResult?.poolTxId.slice(-8)}
                                    </a>
                                </p>
                                <p className="mt-2">
                                    Pool ID:{" "}
                                    <a
                                        href={`https://solscan.io/account/${poolResult?.poolKeys.poolId}?cluster=devnet`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-500 hover:underline"
                                    >
                                        {poolResult?.poolKeys.poolId.slice(0, 8)}...{poolResult?.poolKeys.poolId.slice(-8)}
                                    </a>
                                </p>
                                <p className="mt-2">Click Create Another Pool to start a new pool creation process.</p>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-center">
                        <Button
                            type="button"
                            onClick={handleNext}
                            className="font-semibold py-2 rounded-lg cursor-pointer"
                            variant="default"
                            disabled={loading || !publicKey || !signTransaction}
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>{loadingMessage}</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <span>{getButtonText()}</span>
                                    {currentStep < 4 && <ChevronRight className="h-4 w-4" />}
                                </div>
                            )}
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    )
}