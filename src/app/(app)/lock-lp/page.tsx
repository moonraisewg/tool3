import LpLockForm from '@/components/lp-lock-form';
import SuspenseLayout from "@/components/suspense-layout";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lock Your LP Tokens Securely and Easily",
  description:
    "Securely lock your liquidity provider (LP) tokens with ease using our simple and trusted interface. Protect your assets and manage your positions confidently.",
};


export default function LockLpPage() {
  return (
    <div className="h-full flex md:items-center mt-10 md:mt-0">
      <div className="container mx-auto px-4">
        <SuspenseLayout>
          <LpLockForm />
        </SuspenseLayout>
      </div>
    </div>
  );
}
