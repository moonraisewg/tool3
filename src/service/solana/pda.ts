import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "./program";

// UTF-8 seeds
const SEED_USER_LOCK = "user-lock";
const SEED_VAULT = "vault";
const SEED_VAULT_TOKEN = "vault-token";
const SEED_VAULT_AUTH = "vault-authority";

/**
 * Derive PDA for user lock account
 */
export const findUserLockPda = async (vault: PublicKey, user: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_USER_LOCK), vault.toBuffer(), user.toBuffer()],
    PROGRAM_ID
  );
};

/**
 * Derive PDA for vault
 */
export const findVaultPda = async (poolId: PublicKey, tokenMint: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_VAULT), poolId.toBuffer(), tokenMint.toBuffer()],
    PROGRAM_ID
  );
};

/**
 * Derive PDA for vault token account
 */
export const findVaultTokenPda = async (
  poolId: PublicKey,
  vault: PublicKey
) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_VAULT_TOKEN), poolId.toBuffer(), vault.toBuffer()],
    PROGRAM_ID
  );
};

/**
 * Derive PDA for vault authority
 */
export const findVaultAuthorityPda = async (
  poolId: PublicKey,
  vault: PublicKey
) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_VAULT_AUTH), poolId.toBuffer(), vault.toBuffer()],
    PROGRAM_ID
  );
};
