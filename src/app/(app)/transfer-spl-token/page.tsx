import TransferForm from "@/components/transfer/transfer-form";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transfer Tokens Without Needing SOL",
  description:
    "Easily transfer tokens without requiring SOL in your wallet. Fast, secure, and convenient token transfers designed for all Web3 users.",
};

export default function WithdrawLP() {
  return (
    <div className="h-full flex md:items-center mt-10 md:mt-0">
      <div className="container mx-auto px-4">
        <TransferForm />
      </div>
    </div>
  );
}
