import SuspenseLayout from "@/components/suspense-layout";
import Withdraw from "@/components/withdraw-form";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Securely Withdraw Your LP Tokens Easily",
  description:
    "Withdraw your liquidity provider (LP) tokens quickly and securely using our intuitive interface.",
};

export default function WithdrawLP() {
  return (
    <div className="h-full flex md:items-center mt-10 md:mt-0">
      <div className="container mx-auto px-4">
        <SuspenseLayout>
          <Withdraw />
        </SuspenseLayout>

      </div>
    </div>
  );
}
