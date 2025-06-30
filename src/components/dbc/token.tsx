"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { toast } from "sonner";
import { useState } from "react";
import { connectionDevnet } from "@/service/solana/connection";

const formSchema = z.object({
  name: z.string().min(1, "Token name is required"),
  symbol: z.string().min(1, "Token symbol is required"),
  uri: z
    .string()
    .min(1, "Token URI is required")
    .refine(
      (val) => {
        try {
          new URL(val);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Invalid URI" }
    ),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateTokenForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const { publicKey, signTransaction } = useWallet();
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data: FormValues) => {
    if (!publicKey || !signTransaction) {
      toast.error("Please connect your wallet");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/dbc/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          userPublicKey: publicKey.toBase58(),
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "API error");
      }

      const tx = Transaction.from(Buffer.from(result.transaction, "base64"));

      const signedTx = await signTransaction(tx);

      const sig = await connectionDevnet.sendRawTransaction(
        signedTx.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        }
      );

      toast.success("Create token successful", {
        action: {
          label: "View Transaction",
          onClick: () =>
            window.open(
              `https://solscan.io/tx/${sig}?cluster=devnet`,
              "_blank"
            ),
        },
      });
    } catch (err: unknown) {
      toast.error(` Failed: ${err || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-lg mx-auto p-6 bg-white rounded-xl shadow-md space-y-4"
    >
      <h2 className="text-xl font-bold text-center">Create a New Token</h2>

      <div className="space-y-2">
        <Label htmlFor="name">Token Name</Label>
        <Input id="name" {...register("name")} />
        {errors.name && (
          <p className="text-red-500 text-sm">{errors.name.message}</p>
        )}

        <Label htmlFor="symbol">Token Symbol</Label>
        <Input id="symbol" {...register("symbol")} />
        {errors.symbol && (
          <p className="text-red-500 text-sm">{errors.symbol.message}</p>
        )}

        <Label htmlFor="uri">Metadata URI</Label>
        <Input id="uri" {...register("uri")} />
        {errors.uri && (
          <p className="text-red-500 text-sm">{errors.uri.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full mt-6" disabled={loading}>
        {loading ? "Creating Token..." : "Create Token"}
      </Button>
    </form>
  );
}
