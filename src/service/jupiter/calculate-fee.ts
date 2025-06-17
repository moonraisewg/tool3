interface JupiterPriceResponse {
  data: {
    [tokenAddress: string]: {
      id: string;
      type: string;
      price: string;
    };
  };
}

const API_BASE = "https://lite-api.jup.ag";
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

export async function getTokenFeeFromUsd(
  targetTokenMint: string,
  usdAmount: number = 0.5
): Promise<number> {
  try {
    const usdtRes = await fetch(
      `${API_BASE}/price/v2?ids=${USDT_MINT}&vsToken=${targetTokenMint}`
    );

    if (!usdtRes.ok) {
      throw new Error("API Jupiter trả về lỗi");
    }

    const usdtData: JupiterPriceResponse = await usdtRes.json();
    const usdtToTokenRate = parseFloat(usdtData.data[USDT_MINT].price);

    return usdAmount * usdtToTokenRate;
  } catch (err) {
    console.error("Lỗi khi lấy giá token từ Jupiter:", err);
    throw err;
  }
}
