import { NextRequest, NextResponse } from "next/server";
import { fetchLpMintAndBalance } from "@/hooks/fetch-pool";

export async function POST(request: NextRequest) {
  const { poolId, userPublicKey } = await request.json();

  if (!poolId) {
    return NextResponse.json(
      { error: "Vui lòng cung cấp Pool ID" },
      { status: 400 }
    );
  }

  try {
    const result = await fetchLpMintAndBalance(poolId, userPublicKey);
    if (result) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(
        { error: "Không tìm thấy thông tin pool hoặc ví chưa kết nối" },
        { status: 404 }
      );
    }
  } catch (error: any) {
    console.error("Lỗi trong API fetch-lp:", error);
    return NextResponse.json(
      { error: error.message || "Không thể lấy thông tin pool" },
      { status: 500 }
    );
  }
}
