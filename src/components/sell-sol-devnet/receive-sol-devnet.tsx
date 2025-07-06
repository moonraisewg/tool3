import React from "react";
import { FormControl, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { Loader } from "@nsmr/pixelart-react";
import { UseFormReturn } from "react-hook-form";
import { FormSellSol } from "./sell-sol-devnet";

interface ReceiveSolDevnetProps {
    form: UseFormReturn<FormSellSol>;
    priceLoading: boolean;
    isSwapped: boolean;
    onAmountChange: (value: string) => void;
    USDPERSOL: number;
}

const ReceiveSolDevnet: React.FC<ReceiveSolDevnetProps> = ({
    form,
    priceLoading,
    isSwapped,
    onAmountChange,
    USDPERSOL,
}) => {
    return (
        <div className="bg-white border-gear-gray p-3 flex flex-col min-h-[120px] justify-between pt-[18px]">
            <div className="flex items-center justify-between mb-2 h-[26px]">
                <div className="ml-[4px]">You Receive</div>
                <div className="flex items-center sm:gap-4 gap-1 mr-1">
                    ${USDPERSOL} per SOL Devnet
                </div>
            </div>
            <div className="flex justify-between items-center mb-2 mt-4 h-[40px] gap-4">
                <div className="flex gap-2 items-center text-gray-700 border-gear-gray px-2 py-1 ml-2">
                    <Image
                        src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
                        alt="Solana"
                        width={24}
                        height={24}
                        className="rounded-full object-cover"
                    />
                    <div className="mt-[2px]">SOL Devnet</div>
                </div>
                <div className="w-[200px] sm:w-[300px] h-[40px] flex items-center justify-end">
                    {priceLoading && !isSwapped ? (
                        <Loader className="h-6 w-6 animate-spin text-gray-500 mb-1" />
                    ) : (
                        <FormField
                            control={form.control}
                            name="solAmount"
                            render={({ field }) => (
                                <FormControl>
                                    <Input
                                        type="number"
                                        className="focus-visible:ring-0 focus-visible:border-none focus-visible:outline-none outline-none ring-0 border-none shadow-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-right md:!text-[32px] !text-[24px] pr-0"
                                        placeholder="0.00"
                                        disabled={!isSwapped}
                                        {...field}
                                        onChange={(e) => {
                                            let value = e.target.value;
                                            if (parseFloat(value) < 0) value = "0";
                                            field.onChange(value);
                                            if (isSwapped) {
                                                onAmountChange(value);
                                            }
                                        }}
                                    />
                                </FormControl>
                            )}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReceiveSolDevnet;