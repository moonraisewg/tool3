import type { Metadata } from "next"
import CreatePoolRaydium from "@/components/create-pool/create-pool-form"

export const metadata: Metadata = {
    title: "Create Liquidity Pool",
    description: "Create a new concentrated liquidity pool",
}

export default function CreatePool() {
    return (
        <div className="h-full flex md:items-center mt-10 md:mt-0">
            <div className="container mx-auto px-4">
                <CreatePoolRaydium />
            </div>
        </div>
    );
}
