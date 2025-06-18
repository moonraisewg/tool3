import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { convertSOLToUSDT } from "@/service/jupiter/calculate-fee";
import { connectionMainnet } from "@/service/solana/connection";

export async function calculateTransferFee(
  recipientAddress: string,
  tokenMint: string
): Promise<number> {
  try {
    const recipientPubkey = new PublicKey(recipientAddress);
    const tokenMintPubkey = new PublicKey(tokenMint);

    const recipientATA = await getAssociatedTokenAddress(
      tokenMintPubkey,
      recipientPubkey
    );

    const [recipientATAInfo] = await Promise.all([
      connectionMainnet.getAccountInfo(recipientATA),
    ]);

    let ataCount = 0;
    if (!recipientATAInfo) ataCount++;

    const baseFeeUSDT = 0.5;
    const ataFeeSOL = ataCount * 0.003;

    const ataFeeUSDT = await convertSOLToUSDT(ataFeeSOL);

    return baseFeeUSDT + ataFeeUSDT;
  } catch (error) {
    console.error("Error calculating fee:", error);
    return 0.5;
  }
}
