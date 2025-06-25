import type { Metadata } from "next"
import CloseAccountForm from "@/components/close-account/close-account-form";

export const metadata: Metadata = {
    title: "Meteora DAMM - Create New Liquidity Pools Easily",
    description:
        "Create a new liquidity pool effortlessly with Meteora DAMM. Experience seamless pool creation, secure transactions, and advanced AMM features.",
};

export default function CloseAccount() {
    return (
        <div className="h-full flex md:items-center mt-10 md:mt-0">
            <div className="container mx-auto px-4">
                <CloseAccountForm />
            </div>
        </div>
    );
}
