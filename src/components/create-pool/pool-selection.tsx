"use client"

import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { ChevronRight, Info } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { useRouter } from "next/navigation"

interface PoolOption {
    id: string
    title: string
    description: string
    comingSoon?: boolean
}

const poolOptions: PoolOption[] = [
    {
        id: "raydium-cpmm",
        title: "Raydium CPMM",
        description: "Constant Product Market Maker - Traditional AMM model",
    },
    {
        id: "meteora-damm",
        title: "Meteora DAMM",
        description: "Dynamic Automated Market Maker - Advanced AMM with dynamic fees",
        comingSoon: false,
    },
    {
        id: "meteora-dlmm",
        title: "Meteora DLMM",
        description: "Dynamic Liquidity Market Maker - Concentrated liquidity solution",
        comingSoon: true,
    },
]

export default function PoolSelection() {
    const isMobile = useIsMobile()
    const router = useRouter();


    const handleOptionSelect = (optionId: string) => {
        if (optionId === "raydium-cpmm") {
            router.push("/create-pool/raydium-cpmm");
        } else {
            router.push("/create-pool/meteora-damm");
        }
    }

    return (
        <div className={`md:p-2 max-w-[600px] mx-auto my-2 ${!isMobile ? "border-gear" : ""}`}>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">Create Liquidity Pool</h1>
                <p className="text-gray-600 text-center">Choose your preferred pool type to get started</p>
            </div>

            <div className="space-y-4">
                {poolOptions.map((option) => (
                    <Card
                        key={option.id}
                        className={`cursor-pointer transition-all duration-200 hover:shadow-md border-gray-200 ${option.comingSoon ? "opacity-60 cursor-not-allowed" : "hover:border-gray-300"
                            }`}
                        onClick={() => !option.comingSoon && handleOptionSelect(option.id)}
                    >
                        <CardContent className="pb-3 !pb-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <CardTitle className="text-lg font-semibold text-gray-900">{option.title}</CardTitle>
                                    {option.comingSoon && (
                                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                                            Coming Soon
                                        </span>
                                    )}
                                </div>
                                {!option.comingSoon && <ChevronRight className="h-5 w-5 text-gray-400" />}
                            </div>
                            <CardDescription className="text-gray-600">{option.description}</CardDescription>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-gray-600">
                        <p className="font-medium text-gray-900 mb-1">Important Notes:</p>
                        <ul className="space-y-1">
                            <li>• Pool creation requires SOL for transaction fees</li>
                            <li>• Make sure your wallet is connected before proceeding</li>
                            <li>• Some features may require switching between Mainnet and Devnet</li>
                            <li>• Always verify token addresses before creating pools</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}
