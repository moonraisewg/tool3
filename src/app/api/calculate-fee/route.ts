import { calculateTransferFee } from "@/utils/ata-checker";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { recipientAddress, tokenMint } = await req.json();
    const fee = await calculateTransferFee(recipientAddress, tokenMint);
    return NextResponse.json({ fee });
  } catch {
    return NextResponse.json(
      { error: "Failed to calculate fee" },
      { status: 500 }
    );
  }
}
