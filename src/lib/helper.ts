import { PublicKey, Connection } from "@solana/web3.js";
import {
  findVaultPda,
  findVaultTokenPda,
  findVaultAuthorityPda,
} from "@/service/solana/pda";
import { program } from "@/service/solana/program";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { connectionDevnet, connectionMainnet } from "@/service/solana/connection";

interface VaultCheckResult {
  exists: boolean;
  vault: PublicKey;
  vaultTokenAccount: PublicKey; // LP token account của project vault
  tokenMint: PublicKey; // LP mint
  // Raydium pool vaults
  raydiumToken0Vault: PublicKey;
  raydiumToken1Vault: PublicKey;
  // Token mints
  token0Mint: PublicKey;
  token1Mint: PublicKey;
  // Project vault token accounts (cần tính toán)
  projectVaultToken0Account: PublicKey;
  projectVaultToken1Account: PublicKey;
  tokenProgram: PublicKey;
  token0Program: PublicKey;
  token1Program: PublicKey;
}

export const checkVaultExists = async (
  poolId: PublicKey
): Promise<VaultCheckResult> => {
  try {
    const [vault] = findVaultPda(poolId);
    const [vaultTokenAccount] = findVaultTokenPda(poolId, vault);
    const [vaultAuthority] = findVaultAuthorityPda(poolId, vault);

    // Luôn fetch pool state để lấy thông tin token
    const poolState = await program.account.poolState.fetch(poolId);

    const vaultInfo = await connectionDevnet.getAccountInfo(vault);
    const vaultTokenAccountInfo = await connectionDevnet.getAccountInfo(
      vaultTokenAccount
    );

    const exists = !!(vaultInfo && vaultTokenAccountInfo);

    let tokenMint = poolState.lpMint;
    if (exists) {
      const vaultData = await program.account.vault.fetch(vault);
      tokenMint = vaultData.tokenMint;
    }

    const token0Program = await getTokenProgram(poolState.token0Mint);
    const token1Program = await getTokenProgram(poolState.token1Mint);
    const tokenProgram = await getTokenProgram(tokenMint);

    const projectVaultToken0Account = await getAssociatedTokenAddress(
      poolState.token0Mint,
      vaultAuthority,
      true,
      token0Program
    );

    const projectVaultToken1Account = await getAssociatedTokenAddress(
      poolState.token1Mint,
      vaultAuthority,
      true,
      token1Program
    );

    return {
      exists,
      vault,
      vaultTokenAccount,
      tokenMint,
      raydiumToken0Vault: poolState.token0Vault,
      raydiumToken1Vault: poolState.token1Vault,
      token0Mint: poolState.token0Mint,
      token1Mint: poolState.token1Mint,
      projectVaultToken0Account,
      projectVaultToken1Account,
      token0Program,
      token1Program,
      tokenProgram,
    };
  } catch (error: unknown) {
    console.error("Error checking vault:", error);
    return {
      exists: false,
      vault: PublicKey.default,
      vaultTokenAccount: PublicKey.default,
      tokenMint: PublicKey.default,
      raydiumToken0Vault: PublicKey.default,
      raydiumToken1Vault: PublicKey.default,
      token0Mint: PublicKey.default,
      token1Mint: PublicKey.default,
      projectVaultToken0Account: PublicKey.default,
      projectVaultToken1Account: PublicKey.default,
      token0Program: PublicKey.default,
      token1Program: PublicKey.default,
      tokenProgram: PublicKey.default,
    };
  }
};

export async function getTokenProgram(mint: PublicKey, connection?: Connection): Promise<PublicKey> {
  try {
    const conn = connection || connectionMainnet;
    const mintAccountInfo = await conn.getAccountInfo(mint);

    if (!mintAccountInfo) {
      console.warn(`Mint account not found: ${mint.toString()}`);
      return TOKEN_PROGRAM_ID;
    }

    if (mintAccountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
      return TOKEN_PROGRAM_ID;
    } else if (mintAccountInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
      return TOKEN_2022_PROGRAM_ID;
    } else {
      console.warn(`Unknown token program: ${mintAccountInfo.owner.toString()}`);
      return TOKEN_PROGRAM_ID; 
    }
  } catch (error) {
    console.error("Error in getTokenProgram:", error);
    return TOKEN_PROGRAM_ID; 
  }
}
