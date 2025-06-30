import type { Metadata } from "next"
import BundledForm from "@/components/bundled/bundled-form";

export const metadata: Metadata = {
  title: "Bundled Token Trading - Execute Multi-Wallet Buy/Sell Transactions",
  description:
    "Bundle multiple wallets to buy or sell tokens in the same block. Maximize profit, reduce slippage, and outpace sniping bots with atomic bundled transactions on Solana.",
};

export default function BundledToken() {
    return (
        <div className="h-full flex md:items-center mt-10 md:mt-0">
            <div className="container mx-auto px-4">
                <BundledForm />
            </div>
        </div>
    );
}
