import TransferForm from "@/components/transfer/transfer-form";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transfer",
  description: "Transfer token",
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
