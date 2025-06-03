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
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export async function getTokenFeeFromSolAndUsd(
  solAmount: number,
  targetTokenMint: string,
  usdAmount: number = 0.5
): Promise<number> {
  try {
    const [solRes, usdcRes] = await Promise.all([
      fetch(`${API_BASE}/price/v2?ids=${SOL_MINT}&vsToken=${targetTokenMint}`),
      fetch(`${API_BASE}/price/v2?ids=${USDC_MINT}&vsToken=${targetTokenMint}`),
    ]);

    if (!solRes.ok || !usdcRes.ok) {
      throw new Error("API Jupiter trả về lỗi");
    }

    const solData: JupiterPriceResponse = await solRes.json();
    const usdcData: JupiterPriceResponse = await usdcRes.json();

    const solToTokenRate = parseFloat(solData.data[SOL_MINT].price);
    const usdcToTokenRate = parseFloat(usdcData.data[USDC_MINT].price);

    const tokensFromSol = solAmount * solToTokenRate;
    const tokensFromUsd = usdAmount * usdcToTokenRate;

    return tokensFromSol + tokensFromUsd;
  } catch (err) {
    console.error("Lỗi khi lấy giá token từ Jupiter:", err);
    throw err;
  }
}
