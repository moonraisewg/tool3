import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "./program";

const SEED_USER_LOCK = "user-lock";
const SEED_VAULT = "vault";
const SEED_VAULT_TOKEN = "vault-token";
const SEED_VAULT_AUTH = "vault-authority";

export const findUserLockPda = (vault: PublicKey, user: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_USER_LOCK), vault.toBuffer(), user.toBuffer()],
    PROGRAM_ID
  );
};

export const findVaultPda = (poolId: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_VAULT), poolId.toBuffer()],
    PROGRAM_ID
  );
};

export const findVaultTokenPda = (poolId: PublicKey, vault: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_VAULT_TOKEN), poolId.toBuffer(), vault.toBuffer()],
    PROGRAM_ID
  );
};

export const findVaultAuthorityPda = (poolId: PublicKey, vault: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_VAULT_AUTH), poolId.toBuffer(), vault.toBuffer()],
    PROGRAM_ID
  );
};
