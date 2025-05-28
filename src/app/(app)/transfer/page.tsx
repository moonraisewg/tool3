"use client"
import TransferForm from "@/components/transfer/transfer-form";

export default function WithdrawLP() {
    return (
        <div className="h-full flex md:items-center mt-10 md:mt-0">
            <div className="container mx-auto px-4">
                <TransferForm />
            </div>
        </div>
    );
}
