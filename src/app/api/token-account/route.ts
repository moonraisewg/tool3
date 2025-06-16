import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { walletAddress, mintAddress } = body;

    if (!walletAddress || !mintAddress) {
      return NextResponse.json(
        { error: "Wallet address and mint address are required" },
        { status: 400 }
      );
    }

    let walletPublicKey, mintPublicKey;
    try {
      walletPublicKey = new PublicKey(walletAddress);
      mintPublicKey = new PublicKey(mintAddress);
    } catch {
      return NextResponse.json(
        { error: "Invalid wallet or mint address" },
        { status: 400 }
      );
    }

    const connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com",
      "confirmed"
    );

    let tokenProgram = TOKEN_PROGRAM_ID;
    try {
      const accountInfo = await connection.getAccountInfo(mintPublicKey);
      if (accountInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)) {
        tokenProgram = TOKEN_2022_PROGRAM_ID;
      }
    } catch (error) {
      console.error("Error determining token program:", error);
    }

    const tokenAccount = getAssociatedTokenAddressSync(
      mintPublicKey,
      walletPublicKey,
      false,
      tokenProgram
    );


    let exists = false;
    try {
      const accountInfo = await connection.getAccountInfo(tokenAccount);
      exists = accountInfo !== null;
    } catch (error) {
      console.error("Error checking token account:", error);
    }

    return NextResponse.json({
      tokenAccount: tokenAccount.toString(),
      exists,
      tokenProgram: tokenProgram.toString()
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
} 