import { PublicKey } from "@solana/web3.js";
import { connection } from "@/service/solana/connection";
import { findVaultPda, findVaultTokenPda } from "@/service/solana/pda";
import { program } from "@/service/solana/program";

interface VaultCheckResult {
  exists: boolean;
  vault: PublicKey;
  vaultTokenAccount: PublicKey;
  tokenMint: PublicKey;
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

    if (!vaultInfo || !vaultTokenAccountInfo) {
      return {
        exists: false,
        vault,
        vaultTokenAccount,
        tokenMint: PublicKey.default,
      };
    }

    const vaultData = await program.account.vault.fetch(vault);
    return {
      exists: true,
      vault,
      vaultTokenAccount,
      tokenMint: vaultData.tokenMint,
    };
  } catch (error: any) {
    console.error("Lỗi khi kiểm tra vault:", error);
    return {
      exists: false,
      vault: PublicKey.default,
      vaultTokenAccount: PublicKey.default,
      tokenMint: PublicKey.default,
    };
  }
};
