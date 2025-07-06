import { NextRequest, NextResponse } from "next/server";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { connectionMainnet } from "@/service/solana/connection";
import { adminKeypair } from "@/config";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, symbol, uri, userPublicKey } = body;

    if (!name || !symbol || !uri || !userPublicKey) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const client = new DynamicBondingCurveClient(
      connectionMainnet,
      "confirmed"
    );
    const CONFIG_PUBLIC_KEY = process.env.DBC_CONFIG_MAINNET;
    if (!CONFIG_PUBLIC_KEY)
      throw new Error("Missing DBC_CONFIG_MAINNET in env");

    const payer = new PublicKey(userPublicKey);
    const config = new PublicKey(CONFIG_PUBLIC_KEY);
    const baseMint = Keypair.generate();
    const poolCreator = payer;

    const createPoolParams = {
      name,
      symbol,
      uri,
      baseMint: baseMint.publicKey,
      config,
      payer,
      poolCreator,
    };

    const transaction = await client.pool.createPool(createPoolParams);

    const transferInstruction = SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: adminKeypair.publicKey,
      lamports: 0.003 * LAMPORTS_PER_SOL,
    });

    transaction.add(transferInstruction);

    const { blockhash } = await connectionMainnet.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payer;

    transaction.partialSign(baseMint);

    const serializedTransaction = transaction
      .serialize({ requireAllSignatures: false })
      .toString("base64");

    return NextResponse.json({
      transaction: serializedTransaction,
      baseMint: baseMint.publicKey.toBase58(),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
