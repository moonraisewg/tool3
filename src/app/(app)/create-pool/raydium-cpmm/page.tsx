import type { Metadata } from "next"
import CreatePoolRaydiumCpmm from "@/components/create-pool/create-raydium-cpmm-pool";

export const metadata: Metadata = {
    title: "Raydium CPMM - Create and Manage New Liquidity Pools",
    description:
        "Effortlessly create a new liquidity pool with Raydium CPMM. Enjoy secure, fast, and efficient pool creation.",
};

export default function CreatePoolWithRaydiumCpmm() {
    return (
        <div className="h-full flex md:items-center mt-10 md:mt-0">
            <div className="container mx-auto px-4">
                <CreatePoolRaydiumCpmm />
            </div>
        </div>
    );
}
