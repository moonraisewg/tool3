import SellSolDevnet from "@/components/sell-sol-devnet/sell-sol-devnet";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Buy SOL on Devnet - Easy and Fast Token Purchase",
    description:
        "Purchase SOL tokens easily on the Devnet network. Enjoy a fast, secure, and hassle-free token buying experience specifically designed for developers and testers to streamline their projects.",
};

export default function WithdrawLP() {
    return (
        <div className="h-full flex md:items-center mt-10 md:mt-0">
            <div className="container mx-auto px-4">
                <SellSolDevnet />
            </div>
        </div>
    );
}
