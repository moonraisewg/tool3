import BuySollMainnet from "@/components/buy-sol/buy-sol";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Buy Sol",
    description: "Buy Sol",
}

export default function WithdrawLP() {
    return (
        <div className="h-full flex md:items-center mt-10 md:mt-0">
            <div className="container mx-auto px-4">
                <BuySollMainnet />
            </div>
        </div>
    );
}
