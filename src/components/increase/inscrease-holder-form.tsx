"use client";

import { useState } from "react";
import { BarChart3, Download, ExternalLink, Play, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useIsMobile } from "@/hooks/use-mobile";
import Image from "next/image";

export default function Component() {
  const isMobile = useIsMobile();
  const [selectedAmount, setSelectedAmount] = useState("fixed");
  const [selectedFee, setSelectedFee] = useState("0.00006");
  const [selectedQuantity, setSelectedQuantity] = useState("50");
  const [autoSell, setAutoSell] = useState(false);
  const [customQuantity, setCustomQuantity] = useState("");

  const quantityOptions = ["4", "50", "100", "500", "1000"];
  const feeOptions = [
    { value: "0.00006", label: "0.00006 SOL" },
    { value: "0.0001", label: "0.0001 SOL" },
    { value: "0.0003", label: "0.0003 SOL" },
  ];

  return (
    <div className={`md:p-2 mx-auto my-2 ${!isMobile}`}>
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-6 max-h-[calc(100vh-140px)] overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center gap-3 mb-4">
              <BarChart3 className="h-8 w-8 text-black" />
              <h1 className="text-3xl font-bold text-gray-900">
                SOL Increase Holders
              </h1>
            </div>
            <p className="text-gray-600 mb-6 max-w-4xl">
              Quickly increase the number of new wallet Buy (↑MAKERS) and token
              holders for a specified token by automatically creating new wallet
              addresses, helping your project data stand out on DEX.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Wallet Management */}
            <div className="lg:col-span-2 space-y-6">
              {/* Wallet Management Panel */}
              <Card>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Button className="bg-black hover:bg-gray-600">
                      <Wallet className="h-4 w-4 mr-2" />
                      Import Wallet
                    </Button>
                    <Button variant="outline">Check balance</Button>
                  </div>

                  {/* Wallet Table */}
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>No.</TableHead>
                          <TableHead>Address</TableHead>
                          <TableHead>SOL balance</TableHead>
                          <TableHead>USDC balance</TableHead>
                          <TableHead>Result</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-center py-8 text-gray-500"
                          >
                            Please import wallet
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Token Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-12 gap-4 items-end">
                    <div className="col-span-3">
                      <div className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50 h-11">
                        <Image
                          src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
                          alt="SOL"
                          width={24}
                          height={24}
                          className="rounded-full"
                        />
                        <span className="font-medium">SOL</span>
                      </div>
                    </div>

                    <div className="col-span-3">
                      <Select defaultValue="usdc">
                        <SelectTrigger className="min-h-[44px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="usdc">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                              USDC
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-4">
                      <Input placeholder="Enter RPC URL" className="h-11" />
                    </div>

                    <div className="col-span-2">
                      <Button variant="outline" className="w-full h-11">
                        More RPC
                        <ExternalLink className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Purchase Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Purchase Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Buy Amount Mode */}
                  <div>
                    <Label className="mb-2">Buy Amount Mode</Label>
                    <Tabs
                      value={selectedAmount}
                      onValueChange={setSelectedAmount}
                      className="w-full"
                    >
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="fixed">Fixed Amount</TabsTrigger>
                        <TabsTrigger value="random">Random Amount</TabsTrigger>
                        <TabsTrigger value="percent">
                          Percent Amount %
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  {/* Amount Input */}
                  <div>
                    <Label className="mb-2">Fixed Amount (SOL)</Label>
                    <Input type="number" placeholder="0.01" step="0.001" />
                  </div>

                  {/* Jito Priority Fee */}
                  <div>
                    <Label className="mb-2">Jito Priority Fee</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {feeOptions.map((fee) => (
                        <Button
                          key={fee.value}
                          variant={
                            selectedFee === fee.value ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => setSelectedFee(fee.value)}
                          className={
                            selectedFee === fee.value
                              ? "bg-black hover:bg-gray-600"
                              : ""
                          }
                        >
                          {fee.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Auto sell</Label>
                    <Switch checked={autoSell} onCheckedChange={setAutoSell} />
                  </div>
                </CardContent>
              </Card>

              {/* DEX Platform Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>DEX </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="jup" className="w-full">
                    <TabsList className="grid grid-flow-col auto-cols-max gap-2 overflow-x-auto scrollbar-hide px-1">
                      <TabsTrigger
                        value="jup"
                        className="min-w-[300px] lg:min-w-[300px] truncate text-sm"
                      >
                        Jup / Raydium / Meteora / Orca / PumpSwap (AMM)
                      </TabsTrigger>
                      <TabsTrigger
                        value="raydium"
                        className="min-w-[140px] truncate text-sm"
                      >
                        Raydium Launchpad
                      </TabsTrigger>
                      <TabsTrigger
                        value="pump"
                        className="min-w-[100px] text-sm"
                      >
                        Pump
                      </TabsTrigger>
                      <TabsTrigger
                        value="moonshot"
                        className="min-w-[100px] text-sm"
                      >
                        MoonShot
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Controls and Status */}
            <div className="space-y-6">
              {/* Wallet Generation Controls */}
              <Card>
                <CardHeader>
                  <CardTitle>Increase Wallet(↑MAKERS) Buy</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Quantity</Label>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      {quantityOptions.map((qty) => (
                        <Button
                          key={qty}
                          variant={
                            selectedQuantity === qty ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => setSelectedQuantity(qty)}
                          className={
                            selectedQuantity === qty
                              ? "bg-black hover:bg-gray-600"
                              : ""
                          }
                        >
                          {qty}
                        </Button>
                      ))}
                    </div>
                    <Input
                      placeholder="Custom quantity"
                      value={customQuantity}
                      onChange={(e) => setCustomQuantity(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Status Dashboard */}
              <div className="grid grid-cols-1 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-xl text-gray-600 font-bold">
                        Increase TXNS
                      </div>
                      <div className="text-gray-500">50 BUY 0 SELL</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-xl text-gray-600 font-bold">
                        Increase Token Holders
                      </div>
                      <div className="text-gray-500">50</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-xl text-gray-600 font-bold">
                        Increase Wallet(↑MAKERS) Buy
                      </div>
                      <div className=" text-gray-500">50</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Action Panel */}
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <Button variant="outline" className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Download wallet address info
                  </Button>
                  <Button
                    className="w-full bg-black hover:bg-gray-600"
                    size="lg"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    RUN
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
