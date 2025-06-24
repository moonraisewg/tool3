import SwapAllToken from "@/components/swap-sol/swap-all-token-form";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Swap All Tokens to SOL",
  description: "Swap all your SPL tokens to SOL in one click. Fast, simple, and secure — the easiest way to convert tokens and clean up your Solana wallet.",
};
export default function SwapAll() {
  return (
    <div className="h-full flex md:items-center mt-10 md:mt-0">
      <div className="container mx-auto px-4 auto-scroll">
        <SwapAllToken />
      </div>
    </div>
  );
}
