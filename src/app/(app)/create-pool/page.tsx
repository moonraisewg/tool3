import type { Metadata } from "next"
import PoolSelection from "@/components/create-pool/pool-selection";

export const metadata: Metadata = {
    title: "Create a New Liquidity Pool Easily and Securely",
    description:
        "Effortlessly create a new liquidity pool with our user-friendly interface. Manage your pools efficiently and take full control of your DeFi assets.",
};


export default function CreatePool() {
    return (
        <div className="h-full flex md:items-center mt-10 md:mt-0">
            <div className="container mx-auto px-4">
                <PoolSelection />
            </div>
        </div>
    );
}
