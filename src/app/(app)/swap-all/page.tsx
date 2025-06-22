import SwapAllToken from "@/components/swap-sol/swap-all-token-form";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Swap All Tokens to SOL Without Holding SOL",
  description:
    "Easily swap all your tokens to SOL without needing SOL in your wallet first. Fast, secure token swaps designed for seamless Web3 user experience.",
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
