import BuySollMainnet from "@/components/swap-sol/swap-sol";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Swap Sol",
  description: "Swap Sol",
};

export default function SwapSol() {
  return (
    <div className="h-full flex md:items-center mt-10 md:mt-0">
      <div className="container mx-auto px-4">
        <BuySollMainnet />
      </div>
    </div>
  );
}
