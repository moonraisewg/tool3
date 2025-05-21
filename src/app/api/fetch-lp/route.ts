import { NextRequest, NextResponse } from "next/server";
import { fetchLpMintAndBalance } from "@/hooks/fetch-pool";

export async function POST(request: NextRequest) {
  const { poolId, userPublicKey } = await request.json();

  if (!poolId) {
    return NextResponse.json(
      { error: "Please provide Pool ID" },
      { status: 400 }
    );
  }

  try {
    const result = await fetchLpMintAndBalance(poolId, userPublicKey);
    if (result) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(
        { error: "Pool information not found or wallet not connected" },
        { status: 404 }
      );
    }
  } catch (error: any) {
    console.error("Error in fetch-lp API:", error);
    return NextResponse.json(
      { error: error.message || "Unable to get pool information" },
      { status: 500 }
    );
  }
}
