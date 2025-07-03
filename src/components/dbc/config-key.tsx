"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Info } from "lucide-react";
import Image from "next/image";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const USDCLogo = () => (
  <Image
    src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png"
    alt="USDC"
    width={24}
    height={24}
    className="rounded-full"
  />
);

const SOLLogo = () => (
  <Image
    src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
    alt="SOL"
    width={24}
    height={24}
    className="rounded-full"
  />
);

export default function TokenConfigForm() {
  const [quoteMint, setQuoteMint] = useState("USDC");
  const [activationType, setActivationType] = useState("Slot");
  const [collectFeeMode, setCollectFeeMode] = useState("Quote");
  const [migrationOption, setMigrationOption] = useState("DAMM V2");
  const [migrationFeeOption, setMigrationFeeOption] = useState("0.25%");
  const [tokenUpdateAuthority, setTokenUpdateAuthority] = useState("Immutable");
  const [dynamicFees] = useState(false);
  const [antiSniperSuite, setAntiSniperSuite] = useState(false);
  const [lockedVesting, setLockedVesting] = useState(false);

  const [feeClaimer, setFeeClaimer] = useState("");
  const [leftoverReceiver, setLeftoverReceiver] = useState("");

  const [totalTokenSupply, setTotalTokenSupply] = useState("1,000,000,000");
  const [leftover, setLeftover] = useState("0");
  const [tokenType, setTokenType] = useState("SPL");
  const [initialMarketCap, setInitialMarketCap] = useState("30");
  const [migrationMarketCap, setMigrationMarketCap] = useState("550");
  const [baseMintDecimal, setBaseMintDecimal] = useState("6");
  const [quoteMintDecimal, setQuoteMintDecimal] = useState("6");
  const [migrationFeePercentage, setMigrationFeePercentage] = useState("0");
  const [creatorMigrationFeePercentage, setCreatorMigrationFeePercentage] =
    useState("0");
  const [partnerLPPercentage, setPartnerLPPercentage] = useState("0");
  const [partnerLockedLPPercentage, setPartnerLockedLPPercentage] =
    useState("100");
  const [creatorLPPercentage, setCreatorLPPercentage] = useState("0");
  const [creatorLockedLPPercentage, setCreatorLockedLPPercentage] =
    useState("0");
  const [baseFeeBps, setBaseFeeBps] = useState("100");
  const [creatorTradingFeePercentage, setCreatorTradingFeePercentage] =
    useState("0");
  const [startingFeeBps, setStartingFeeBps] = useState("100");
  const [endingFeeBps, setEndingFeeBps] = useState("100");
  const [numberOfPeriod, setNumberOfPeriod] = useState("0");
  const [totalDuration, setTotalDuration] = useState("0");
  const [sniperSuiteType, setSniperSuiteType] = useState("Linear");

  const [totalVestingAmount, setTotalVestingAmount] = useState("0");
  const [numberOfVestingPeriod, setNumberOfVestingPeriod] = useState("0");
  const [totalVestingDuration, setTotalVestingDuration] = useState("0");
  const [cliffDurationFromMigration, setCliffDurationFromMigration] =
    useState("0");
  const [cliffUnlockAmount, setCliffUnlockAmount] = useState("0");
  const [baseFeeBpsSniper, setBaseFeeBpsSniper] = useState("0");
  const [feeIncrementBps, setFeeIncrementBps] = useState("0");
  const [referenceAmount, setReferenceAmount] = useState("0");
  const [maxLimiterDuration, setMaxLimiterDuration] = useState("0");

  const getQuoteMintAddress = (symbol: string) => {
    const addresses: { [key: string]: string } = {
      USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      SOL: "So11111111111111111111111111111111111111112",
    };
    return addresses[symbol];
  };

  const handleAntiSniperChange = (checked: boolean) => {
    setAntiSniperSuite(checked);
  };

  const handleLockedVestingChange = (checked: boolean) => {
    setLockedVesting(checked);
  };

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-4xl mx-auto max-h-[calc(100vh-140px)] overflow-y-auto ">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Token Configuration
          </h1>
          <p className="text-gray-600">
            Configure your token parameters and settings
          </p>
        </div>

        <Card className="bg-white border border-gray-200 shadow-lg">
          <CardContent className="p-8 space-y-8">
            {/* Fee Claimer and Leftover Receiver */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-gray-700 font-medium flex items-center gap-2">
                    Fee Claimer
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          The wallet address that will collect all the bonding
                          curve fees.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    placeholder="Enter wallet address"
                    className="border-gray-300 focus:border-black focus:ring-black"
                    value={feeClaimer}
                    onChange={(e) => setFeeClaimer(e.target.value)}
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-gray-700 font-medium flex items-center gap-2">
                    Leftover Receiver
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          The wallet address that will be able to claim the
                          bonding curve leftover tokens.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    placeholder="Enter wallet address"
                    className="border-gray-300 focus:border-black focus:ring-black"
                    value={leftoverReceiver}
                    onChange={(e) => setLeftoverReceiver(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-gray-200" />

            {/* Quote Mint */}
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-gray-700 font-medium flex items-center gap-2">
                  Quote Mint
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        The quote mint that your base mint token will be paired
                        with.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    value={getQuoteMintAddress(quoteMint)}
                    className="border-gray-300 focus:border-black focus:ring-black flex-1 font-mono text-sm"
                    readOnly
                  />
                  <ToggleGroup
                    type="single"
                    value={quoteMint}
                    onValueChange={setQuoteMint}
                    className="flex gap-2"
                  >
                    <ToggleGroupItem
                      value="USDC"
                      className="rounded-xl shadow-md border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium
    hover:bg-gray-100 transition-all duration-200 ease-in-out
    data-[state=on]:bg-black data-[state=on]:text-white"
                    >
                      <USDCLogo />
                      <span className="ml-2">USDC</span>
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="SOL"
                      className="rounded-xl shadow-md border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium
    hover:bg-gray-100 transition-all duration-200 ease-in-out
    data-[state=on]:bg-black data-[state=on]:text-white"
                    >
                      <SOLLogo />
                      <span className="ml-2">SOL</span>
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>

              {/* Token Type */}
              <div className="space-y-3">
                <Label className="text-gray-700 font-medium flex items-center gap-2">
                  Token Type
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>The base mint token type.</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Select value={tokenType} onValueChange={setTokenType}>
                  <SelectTrigger className="border-gray-300 focus:border-black focus:ring-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200">
                    <SelectItem value="SPL" className="text-gray-900">
                      SPL Token
                    </SelectItem>
                    <SelectItem value="Token2022" className="text-gray-900">
                      Token 2022
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="bg-gray-200" />

            {/* Supply and Market Cap */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-gray-700 font-medium flex items-center gap-2">
                    Total Token Supply
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          The total number of base mint tokens to be launched.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={totalTokenSupply}
                      onChange={(e) => setTotalTokenSupply(e.target.value)}
                      className="border-gray-300 focus:border-black focus:ring-black flex-1"
                    />
                    <Badge
                      variant="secondary"
                      className="bg-gray-100 text-gray-700 border border-gray-300"
                    >
                      Base Tokens
                    </Badge>
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-gray-700 font-medium flex items-center gap-2">
                    Leftover
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          The amount of base mint tokens that will be leftover
                          in the bonding curve after token graduation.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={leftover}
                      onChange={(e) => setLeftover(e.target.value)}
                      className="border-gray-300 focus:border-black focus:ring-black flex-1"
                    />
                    <Badge
                      variant="secondary"
                      className="bg-gray-100 text-gray-700 border border-gray-300"
                    >
                      Base Tokens
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-gray-700 font-medium flex items-center gap-2">
                    Initial Market Cap
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>The initial market cap of the token.</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={initialMarketCap}
                      onChange={(e) => setInitialMarketCap(e.target.value)}
                      className="border-gray-300 focus:border-black focus:ring-black flex-1"
                    />
                    <Badge
                      variant="secondary"
                      className={
                        quoteMint === "SOL"
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "bg-blue-50 text-blue-700 border border-blue-200"
                      }
                    >
                      {quoteMint}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-gray-700 font-medium flex items-center gap-2">
                    Migration Market Cap
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>The market of the token during migration.</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={migrationMarketCap}
                      onChange={(e) => setMigrationMarketCap(e.target.value)}
                      className="border-gray-300 focus:border-black focus:ring-black flex-1"
                    />
                    <Badge
                      variant="secondary"
                      className={
                        quoteMint === "SOL"
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "bg-blue-50 text-blue-700 border border-blue-200"
                      }
                    >
                      {quoteMint}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="bg-gray-200" />

            {/* Advanced Configuration */}
            <div className="space-y-6">
              {/* Token Specifications */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-gray-700 font-medium flex items-center gap-2">
                      Base Mint Decimal
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            The number of decimals for your base mint token.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <ToggleGroup
                      type="single"
                      value={baseMintDecimal}
                      onValueChange={setBaseMintDecimal}
                      className="flex gap-2"
                    >
                      <ToggleGroupItem
                        value="6"
                        className="rounded-xl shadow-md border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium
            hover:bg-gray-100 transition-all duration-200 ease-in-out
            data-[state=on]:bg-black data-[state=on]:text-white"
                      >
                        6
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="9"
                        className="rounded-xl shadow-md border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium
            hover:bg-gray-100 transition-all duration-200 ease-in-out
            data-[state=on]:bg-black data-[state=on]:text-white"
                      >
                        9
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-gray-700 font-medium flex items-center gap-2">
                      Quote Mint Decimal
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            The number of decimals for your quote mint token.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <ToggleGroup
                      type="single"
                      value={quoteMintDecimal}
                      onValueChange={setQuoteMintDecimal}
                      className="flex gap-2"
                    >
                      <ToggleGroupItem
                        value="6"
                        className="rounded-xl shadow-md border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium
            hover:bg-gray-100 transition-all duration-200 ease-in-out
            data-[state=on]:bg-black data-[state=on]:text-white"
                      >
                        6
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="9"
                        className="rounded-xl shadow-md border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium
            hover:bg-gray-100 transition-all duration-200 ease-in-out
            data-[state=on]:bg-black data-[state=on]:text-white"
                      >
                        9
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-gray-700 font-medium flex items-center gap-2">
                      Token Update Authority
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            Choose whether the token metadata update authority
                            is immutable or mutable
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <ToggleGroup
                      type="single"
                      value={tokenUpdateAuthority}
                      onValueChange={setTokenUpdateAuthority}
                      className="flex gap-2"
                    >
                      <ToggleGroupItem
                        value="Mutable"
                        className="rounded-xl shadow-md border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium
            hover:bg-gray-100 transition-all duration-200 ease-in-out
            data-[state=on]:bg-black data-[state=on]:text-white"
                      >
                        Mutable
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="Immutable"
                        className="rounded-xl shadow-md border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium
            hover:bg-gray-100 transition-all duration-200 ease-in-out
            data-[state=on]:bg-black data-[state=on]:text-white"
                      >
                        Immutable
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                </div>
              </div>

              <Separator className="bg-gray-200" />

              {/* Trading & Activation Settings */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-gray-700 font-medium flex items-center gap-2">
                      Activation Type
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            Slot = 400ms, Timestamp = 1s. Only affect Fee
                            Scheduler or Rate Limiter.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <ToggleGroup
                      type="single"
                      value={activationType}
                      onValueChange={setActivationType}
                      className="flex gap-2"
                    >
                      <ToggleGroupItem
                        value="Slot"
                        className="rounded-xl shadow-md border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium
            hover:bg-gray-100 transition-all duration-200 ease-in-out
            data-[state=on]:bg-black data-[state=on]:text-white"
                      >
                        Slot
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="Timestamp"
                        className="rounded-xl shadow-md border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium
            hover:bg-gray-100 transition-all duration-200 ease-in-out
            data-[state=on]:bg-black data-[state=on]:text-white"
                      >
                        Timestamp
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-gray-700 font-medium flex items-center gap-2">
                      Collect Fee Mode
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            QuoteOnly = Fees collected only in quote mint, Quote
                            + Base = Fees collected in both quote and base mint.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <ToggleGroup
                      type="single"
                      value={collectFeeMode}
                      onValueChange={setCollectFeeMode}
                      className="flex gap-2"
                    >
                      <ToggleGroupItem
                        value="Quote"
                        className="rounded-xl shadow-md border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium
            hover:bg-gray-100 transition-all duration-200 ease-in-out
            data-[state=on]:bg-black data-[state=on]:text-white"
                      >
                        <USDCLogo />
                        <span className="ml-2">Quote</span>
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="Quote+Base"
                        className="rounded-xl shadow-md border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium
            hover:bg-gray-100 transition-all duration-200 ease-in-out
            data-[state=on]:bg-black data-[state=on]:text-white"
                      >
                        <div className="flex items-center gap-1">
                          <USDCLogo />
                          <SOLLogo />
                        </div>
                        <span className="ml-4"> Quote+Base</span>
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                </div>

                {/* Dynamic Fees Toggle */}
                <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <Checkbox
                    id="dynamic-fees"
                    checked={dynamicFees}
                    className="border-blue-400"
                  />
                  <Label
                    htmlFor="dynamic-fees"
                    className="text-gray-700 font-medium flex items-center gap-2"
                  >
                    Enable Dynamic Fees
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Automatically adjust fees based on token volatility.
                          Capped at 20% of base fee.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                </div>
              </div>

              <Separator className="bg-gray-200" />

              {/* Migration Configuration */}
              <div className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-3">
                    <Label className="text-gray-700 font-medium flex items-center gap-2">
                      Migration Option
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            The type of DAMM pool that DBC pool will be migrated
                            to upon curve completion.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <ToggleGroup
                      type="single"
                      value={migrationOption}
                      onValueChange={setMigrationOption}
                      className="flex gap-2"
                    >
                      <ToggleGroupItem
                        value="DAMM V1"
                        className="rounded-xl shadow-md border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium
            hover:bg-gray-100 transition-all duration-200 ease-in-out
            data-[state=on]:bg-black data-[state=on]:text-white"
                      >
                        DAMM V1
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="DAMM V2"
                        className="rounded-xl shadow-md border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium
            hover:bg-gray-100 transition-all duration-200 ease-in-out
            data-[state=on]:bg-black data-[state=on]:text-white"
                      >
                        DAMM V2
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-gray-700 font-medium flex items-center gap-2">
                      Migration Fee Option
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            The amount of fees that will be charged in the
                            graduated DAMM pool after migration.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <ToggleGroup
                      type="single"
                      value={migrationFeeOption}
                      onValueChange={setMigrationFeeOption}
                      className="flex gap-2 flex-wrap"
                    >
                      <ToggleGroupItem
                        value="0.25%"
                        className="rounded-xl shadow-md border border-gray-300 text-gray-700 px-4 py-2 text-sm font-medium
            hover:bg-gray-100 transition-all duration-200 ease-in-out
            data-[state=on]:bg-black data-[state=on]:text-white"
                      >
                        0.25%
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="0.30%"
                        className="rounded-xl shadow-md border border-gray-300 text-gray-700 px-4 py-2 text-sm font-medium
            hover:bg-gray-100 transition-all duration-200 ease-in-out
            data-[state=on]:bg-black data-[state=on]:text-white"
                      >
                        0.30%
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="1%"
                        className="rounded-xl shadow-md border border-gray-300 text-gray-700 px-4 py-2 text-sm font-medium
            hover:bg-gray-100 transition-all duration-200 ease-in-out
            data-[state=on]:bg-black data-[state=on]:text-white"
                      >
                        1%
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="2%"
                        className="rounded-xl shadow-md border border-gray-300 text-gray-700 px-4 py-2 text-sm font-medium
            hover:bg-gray-100 transition-all duration-200 ease-in-out
            data-[state=on]:bg-black data-[state=on]:text-white"
                      >
                        2%
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="bg-gray-200" />

            {/* Fee Configuration */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-gray-700 font-medium flex items-center gap-2">
                    Migration Fee Percentage
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          The percentage of quote token fee from the migration
                          quote threshold that will be taken upon migration.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={migrationFeePercentage}
                      onChange={(e) =>
                        setMigrationFeePercentage(e.target.value)
                      }
                      className="border-gray-300 focus:border-black focus:ring-black flex-1"
                    />
                    <span className="text-gray-600 font-medium">%</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-gray-700 font-medium flex items-center gap-2">
                    Creator Migration Fee Percentage
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          The percentage of quote token fee from the migration
                          fee that will be fee shared with the token pool
                          creator.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={creatorMigrationFeePercentage}
                      onChange={(e) =>
                        setCreatorMigrationFeePercentage(e.target.value)
                      }
                      className="border-gray-300 focus:border-black focus:ring-black flex-1"
                    />
                    <span className="text-gray-600 font-medium">%</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-gray-700 font-medium flex items-center gap-2">
                    Partner LP Percentage
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          The percentage of transferrable LP tokens that will go
                          to the partner immediately.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={partnerLPPercentage}
                      onChange={(e) => setPartnerLPPercentage(e.target.value)}
                      className="border-gray-300 focus:border-black focus:ring-black flex-1"
                    />
                    <span className="text-gray-600 font-medium">%</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-gray-700 font-medium flex items-center gap-2">
                    Partner Locked LP Percentage
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          The percentage of LP tokens that go to the partner but
                          are locked forever.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={partnerLockedLPPercentage}
                      onChange={(e) =>
                        setPartnerLockedLPPercentage(e.target.value)
                      }
                      className="border-gray-300 focus:border-black focus:ring-black flex-1"
                    />
                    <span className="text-gray-600 font-medium">%</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-gray-700 font-medium flex items-center gap-2">
                    Creator LP Percentage
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          The percentage of transferrable LP tokens that will go
                          to the creator immediately.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={creatorLPPercentage}
                      onChange={(e) => setCreatorLPPercentage(e.target.value)}
                      className="border-gray-300 focus:border-black focus:ring-black flex-1"
                    />
                    <span className="text-gray-600 font-medium">%</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-gray-700 font-medium flex items-center gap-2">
                    Creator Locked LP Percentage
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          The percentage of LP tokens that go to the creator but
                          are locked forever.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={creatorLockedLPPercentage}
                      onChange={(e) =>
                        setCreatorLockedLPPercentage(e.target.value)
                      }
                      className="border-gray-300 focus:border-black focus:ring-black flex-1"
                    />
                    <span className="text-gray-600 font-medium">%</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-gray-700 font-medium flex items-center gap-2">
                    Base Fee Bps
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>The base fee for bonding curve.</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={baseFeeBps}
                      onChange={(e) => setBaseFeeBps(e.target.value)}
                      className="border-gray-300 focus:border-black focus:ring-black flex-1"
                    />
                    <Badge
                      variant="secondary"
                      className="bg-gray-100 text-gray-700 border border-gray-300"
                    >
                      bps
                    </Badge>
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-gray-700 font-medium flex items-center gap-2">
                    Creator Trading Fee Percentage
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          The percentage of bonding curve fee that will be fee
                          shared with the token pool creator.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={creatorTradingFeePercentage}
                      onChange={(e) =>
                        setCreatorTradingFeePercentage(e.target.value)
                      }
                      className="border-gray-300 focus:border-black focus:ring-black flex-1"
                    />
                    <span className="text-gray-600 font-medium">%</span>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="bg-gray-200" />

            {/* Optional Settings */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-orange-600 border-b border-orange-200 pb-2">
                Optional Settings
              </h2>

              <div className="space-y-4">
                <div className="flex items-center space-x-3 p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <Checkbox
                    id="anti-sniper"
                    checked={antiSniperSuite}
                    onCheckedChange={handleAntiSniperChange}
                    className="border-orange-400"
                  />
                  <Label
                    htmlFor="anti-sniper"
                    className="text-gray-700 font-medium flex items-center gap-2"
                  >
                    Anti Sniper Suite
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Enable Fee Scheduler or Rate Limiter to deter snipers.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                </div>

                {/* Anti Sniper Suite Configuration */}
                {antiSniperSuite && (
                  <div className="space-y-4 p-4 rounded-lg">
                    {/* Sniper Suite Type Selection */}
                    <div className="space-y-3">
                      <ToggleGroup
                        type="single"
                        value={sniperSuiteType}
                        onValueChange={setSniperSuiteType}
                        className="flex gap-2"
                      >
                        <ToggleGroupItem
                          value="Linear"
                          className="rounded-xl shadow-md border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium
            hover:bg-gray-100 transition-all duration-200 ease-in-out
            data-[state=on]:bg-black data-[state=on]:text-white"
                        >
                          Linear
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="Exponential"
                          className="rounded-xl shadow-md border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium
            hover:bg-gray-100 transition-all duration-200 ease-in-out
            data-[state=on]:bg-black data-[state=on]:text-white"
                        >
                          Exponential
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="Rate Limiter"
                          className="rounded-xl shadow-md border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium
            hover:bg-gray-100 transition-all duration-200 ease-in-out
            data-[state=on]:bg-black data-[state=on]:text-white"
                        >
                          Rate Limiter
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>

                    {/* Configuration Fields */}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(sniperSuiteType === "Linear" ||
                        sniperSuiteType === "Exponential") && (
                        <>
                          <div className="space-y-2">
                            <Label className="text-gray-700 font-medium flex items-center gap-2">
                              Starting Fee Bps
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-4 w-4 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>The starting fee for the bonding curve.</p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <div className="flex items-center gap-2">
                              <Input
                                value={startingFeeBps}
                                onChange={(e) =>
                                  setStartingFeeBps(e.target.value)
                                }
                                className=" border-gray-300 focus:border-black focus:ring-black flex-1"
                              />
                              <Badge
                                variant="secondary"
                                className=" text-gray-700 border border-gray-300"
                              >
                                bps
                              </Badge>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-gray-700 font-medium flex items-center gap-2">
                              Ending Fee Bps
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-4 w-4 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    The ending fee for the boding curve. Will
                                    aslo be the base fee after the fee scheduler
                                    ends.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <div className="flex items-center gap-2">
                              <Input
                                value={endingFeeBps}
                                onChange={(e) =>
                                  setEndingFeeBps(e.target.value)
                                }
                                className=" border-gray-300 focus:border-black focus:ring-black flex-1"
                              />
                              <Badge
                                variant="secondary"
                                className=" text-gray-700 border border-gray-300"
                              >
                                bps
                              </Badge>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-gray-700 font-medium flex items-center gap-2">
                              Number of Period
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-4 w-4 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    The total number of periods over which the
                                    fee reduction occurs.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <div className="flex items-center gap-2">
                              <Input
                                value={numberOfPeriod}
                                onChange={(e) =>
                                  setNumberOfPeriod(e.target.value)
                                }
                                className=" border-gray-300 focus:border-black focus:ring-black flex-1"
                              />
                              <Badge
                                variant="secondary"
                                className=" text-gray-700 border border-gray-300"
                              >
                                period(s)
                              </Badge>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-gray-700 font-medium flex items-center gap-2">
                              Total Duration
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-4 w-4 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    The total duration of the fee scheduler.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <div className="flex items-center gap-2">
                              <Input
                                value={totalDuration}
                                onChange={(e) =>
                                  setTotalDuration(e.target.value)
                                }
                                className=" border-gray-300 focus:border-black focus:ring-black flex-1"
                              />
                              <Badge
                                variant="secondary"
                                className=" text-gray-700 border border-gray-300"
                              >
                                slot(s)/sec(s)
                              </Badge>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {sniperSuiteType === "Rate Limiter" && (
                        <>
                          <div className="space-y-2">
                            <Label className="text-gray-700 font-medium flex items-center gap-2">
                              Base Fee Bps
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-4 w-4 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>The base fee for the bonding curve.</p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <div className="flex items-center gap-2">
                              <Input
                                value={baseFeeBpsSniper}
                                onChange={(e) =>
                                  setBaseFeeBpsSniper(e.target.value)
                                }
                                className="border-gray-300 focus:border-black focus:ring-black flex-1"
                              />
                              <Badge
                                variant="secondary"
                                className=" text-gray-700 border border-gray-300"
                              >
                                bps
                              </Badge>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-gray-700 font-medium flex items-center gap-2">
                              Fee Increment Bps
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-4 w-4 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    The rate at which the fees increase based on
                                    the reference amount.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <div className="flex items-center gap-2">
                              <Input
                                value={feeIncrementBps}
                                onChange={(e) =>
                                  setFeeIncrementBps(e.target.value)
                                }
                                className="border-gray-300 focus:border-black focus:ring-black flex-1"
                              />
                              <Badge
                                variant="secondary"
                                className=" text-gray-700 border border-gray-300"
                              >
                                bps
                              </Badge>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-gray-700 font-medium flex items-center gap-2">
                              Reference Amount
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-4 w-4 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    The amount of quote mint tokens that is
                                    referenced to calculate the fee increment.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <div className="flex items-center gap-2">
                              <Input
                                value={referenceAmount}
                                onChange={(e) =>
                                  setReferenceAmount(e.target.value)
                                }
                                className="border-gray-300 focus:border-black focus:ring-black flex-1"
                              />
                              <Badge
                                variant="secondary"
                                className=" text-gray-700 border border-gray-300"
                              >
                                Quote Tokens
                              </Badge>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-gray-700 font-medium flex items-center gap-2">
                              Max Limiter Duration
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-4 w-4 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>The total duration of the rate limiter.</p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <div className="flex items-center gap-2">
                              <Input
                                value={maxLimiterDuration}
                                onChange={(e) =>
                                  setMaxLimiterDuration(e.target.value)
                                }
                                className="border-gray-300 focus:border-black focus:ring-black flex-1"
                              />
                              <Badge
                                variant="secondary"
                                className=" text-gray-700 border border-gray-300"
                              >
                                slot(s)/sec(s)
                              </Badge>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-3 p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <Checkbox
                    id="locked-vesting"
                    checked={lockedVesting}
                    onCheckedChange={handleLockedVestingChange}
                    className="border-orange-400"
                  />
                  <Label
                    htmlFor="locked-vesting"
                    className="text-gray-700 font-medium flex items-center gap-2"
                  >
                    Locked Vesting
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Locked vesting of base mint tokens for creator upon
                          token migration (tokens will be migrated to
                          https://lock.jup.ag).
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                </div>

                {/* Locked Vesting Configuration */}
                {lockedVesting && (
                  <div className="space-y-4 p-4 rounded-lg ">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className=" text-gray-700 font-medium flex items-center gap-2">
                          Total Vesting Amount
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-4 w-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                The total amount of base mint tokens to be
                                vested.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            value={totalVestingAmount}
                            onChange={(e) =>
                              setTotalVestingAmount(e.target.value)
                            }
                            className="border-gray-300 focus:border-black focus:ring-black flex-1"
                          />
                          <Badge
                            variant="secondary"
                            className="text-gray-700 border border-gray-300"
                          >
                            Base Tokens
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-gray-700 font-medium flex items-center gap-2">
                          Number of Vesting Period
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-4 w-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>The total number of vesting periods.</p>
                            </TooltipContent>
                          </Tooltip>
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            value={numberOfVestingPeriod}
                            onChange={(e) =>
                              setNumberOfVestingPeriod(e.target.value)
                            }
                            className=" border-gray-300 focus:border-black focus:ring-black flex-1"
                          />
                          <Badge
                            variant="secondary"
                            className=" text-gray-700 border border-gray-300"
                          >
                            period(s)
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-gray-700 font-medium flex items-center gap-2">
                          Total Vesting Duration
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-4 w-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>The total duration of the vesting.</p>
                            </TooltipContent>
                          </Tooltip>
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            value={totalVestingDuration}
                            onChange={(e) =>
                              setTotalVestingDuration(e.target.value)
                            }
                            className=" border-gray-300 focus:border-black focus:ring-black flex-1"
                          />
                          <Badge
                            variant="secondary"
                            className=" text-gray-700 border border-gray-300"
                          >
                            /sec(s)
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-gray-700 font-medium flex items-center gap-2">
                          Cliff Duration From Migration Time
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-4 w-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                The duration to start the vesting from migration
                                time.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            value={cliffDurationFromMigration}
                            onChange={(e) =>
                              setCliffDurationFromMigration(e.target.value)
                            }
                            className=" border-gray-300 focus:border-black focus:ring-black flex-1"
                          />
                          <Badge
                            variant="secondary"
                            className=" text-gray-700 border border-gray-300"
                          >
                            sec(s)
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-gray-700 font-medium flex items-center gap-2">
                          Cliff Unlock Amount
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-4 w-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                The amount of base mint tokens that unlock
                                immediately when the cliff duration from
                                migration time ends.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            value={cliffUnlockAmount}
                            onChange={(e) =>
                              setCliffUnlockAmount(e.target.value)
                            }
                            className=" border-gray-300 focus:border-black focus:ring-black flex-1"
                          />
                          <Badge
                            variant="secondary"
                            className=" text-gray-700 border border-gray-300"
                          >
                            Base Tokens
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Submit Button */}
            <div className="pt-8 border-t border-gray-200">
              <Button className="w-full bg-black hover:bg-gray-800 text-white py-3 text-lg font-semibold">
                Create Token Configuration
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
