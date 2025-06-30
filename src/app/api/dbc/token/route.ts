import { NextResponse } from "next/server";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { connectionDevnet } from "@/service/solana/connection";
import { adminKeypair } from "@/config";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, symbol, uri, userPublicKey } = body;

    if (!name || !symbol || !uri || !userPublicKey) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const client = new DynamicBondingCurveClient(connectionDevnet, "confirmed");

    const payer = new PublicKey(userPublicKey);
    const config = new PublicKey(
      "544amtMmn1PubCRB8W9uTiGpE2522ZJSqvMuCWkVMT9q"
    );
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

    const { blockhash } = await connectionDevnet.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payer;

    transaction.partialSign(baseMint);

    const serializedTransaction = transaction
      .serialize({ requireAllSignatures: false })
      .toString("base64");

    return NextResponse.json({
      transaction: serializedTransaction,
    });
  } catch (error: unknown) {
    console.error("Create Pool API Error:", error);
    return NextResponse.json(
      { error: error || "Internal error" },
      { status: 500 }
    );
  }
}
