import SellSolDevnet from "@/components/sell-sol-devnet/sell-sol-devnet";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Buy Sol Devnet",
    description: "Buy Sol Devnet",
}

export default function WithdrawLP() {
    return (
        <div className="h-full flex md:items-center mt-10 md:mt-0">
            <div className="container mx-auto px-4">
                <SellSolDevnet />
            </div>
        </div>
    );
}
