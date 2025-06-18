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
const SOL_MINT = "So11111111111111111111111111111111111111112";

export async function getTokenFeeFromUsd(
  targetTokenMint: string,
  usdAmount: number
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

export async function convertSOLToUSDT(solAmount: number): Promise<number> {
  try {
    const response = await fetch(
      `${API_BASE}/price/v2?ids=${SOL_MINT}&vsToken=${USDT_MINT}`
    );

    if (!response.ok) {
      throw new Error("API Jupiter trả về lỗi");
    }

    const data: JupiterPriceResponse = await response.json();
    const solToUsdtRate = parseFloat(data.data[SOL_MINT].price);

    return solAmount * solToUsdtRate;
  } catch (err) {
    console.error("Lỗi khi convert SOL sang USDT:", err);
    throw err;
  }
}
