import { PublicKey } from "@solana/web3.js";
import { connection } from "@/service/solana/connection";
import { findVaultPda, findVaultTokenPda } from "@/service/solana/pda";

interface VaultCheckResult {
  exists: boolean;
  vault: PublicKey;
  vaultTokenAccount: PublicKey;
}

export const checkVaultExists = async (
  poolId: PublicKey
): Promise<VaultCheckResult> => {
  try {
    const [vault] = await findVaultPda(poolId);
    const [vaultTokenAccount] = await findVaultTokenPda(poolId, vault);

    const vaultInfo = await connection.getAccountInfo(vault);
    const vaultTokenAccountInfo = await connection.getAccountInfo(
      vaultTokenAccount
    );

    return {
      exists: !!vaultInfo && !!vaultTokenAccountInfo,
      vault,
      vaultTokenAccount,
    };
  } catch (error: any) {
    console.error("Error checking vault:", error);
    return {
      exists: false,
      vault: PublicKey.default,
      vaultTokenAccount: PublicKey.default,
    };
  }
};
