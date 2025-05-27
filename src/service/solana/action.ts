import { BN } from "@coral-xyz/anchor";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { program } from "./program";

export const initializeVault = async ({
  publicKey,
  poolState,
  tokenMint,
  tokenProgram,
  token0Program,
  token0Vault,
  token1Program,
  token1Vault,
  vault0Mint,
  vault1Mint,
  vaultToken0Account,
  vaultToken1Account,
}: {
  publicKey: PublicKey;
  poolState: PublicKey;
  tokenMint: PublicKey;
  tokenProgram: PublicKey;
  token0Program: PublicKey;
  token0Vault: PublicKey;
  token1Program: PublicKey;
  token1Vault: PublicKey;
  vault0Mint: PublicKey;
  vault1Mint: PublicKey;
  vaultToken0Account: PublicKey;
  vaultToken1Account: PublicKey;
}): Promise<TransactionInstruction> => {
  return await program.methods
    .initializeVault()
    .accounts({
      initializer: publicKey,
      poolState,
      tokenMint,
      tokenProgram,
      token0Program,
      token0Vault,
      token1Program,
      token1Vault,
      vault0Mint,
      vault1Mint,
      vaultToken0Account,
      vaultToken1Account,
    })
    .instruction();
};

export const deposit = async ({
  publicKey,
  amount,
  unlockTimestamp,
  userTokenAccount,
  vaultTokenAccount,
  token0Vault,
  token1Vault,
  tokenProgram,
  poolState,
  vault,
  tokenMint,
}: {
  publicKey: PublicKey;
  amount: number;
  unlockTimestamp: number;
  userTokenAccount: PublicKey;
  vaultTokenAccount: PublicKey;
  token0Vault: PublicKey;
  token1Vault: PublicKey;
  tokenProgram: PublicKey;
  poolState: PublicKey;
  vault: PublicKey;
  tokenMint: PublicKey;
}): Promise<TransactionInstruction> => {
  return await program.methods
    .deposit(new BN(amount), new BN(unlockTimestamp))
    .accounts({
      user: publicKey,
      userTokenAccount,
      vaultTokenAccount,
      token0Vault,
      token1Vault,
      tokenProgram,
      poolState,
      vault,
      tokenMint,
    })
    .instruction();
};

export const withdraw = async ({
  publicKey,
  lpTokenAmount,
  adminToken0Account,
  adminToken1Account,
  token0Vault,
  token1Vault,
  vault0Mint,
  vault1Mint,
  token0Program,
  token1Program,
  tokenProgram,
  lpMint,
  userToken0Account,
  userToken1Account,
  vaultToken0Account,
  vaultToken1Account,
  poolState,
  vault,
  vaultTokenAccount,
}: {
  publicKey: PublicKey;
  lpTokenAmount: number;
  adminToken0Account: PublicKey;
  adminToken1Account: PublicKey;
  userToken0Account: PublicKey;
  userToken1Account: PublicKey;
  vaultToken0Account: PublicKey;
  vaultToken1Account: PublicKey;
  token0Vault: PublicKey;
  token1Vault: PublicKey;
  vault0Mint: PublicKey;
  vault1Mint: PublicKey;
  token0Program: PublicKey;
  token1Program: PublicKey;
  tokenProgram: PublicKey;
  lpMint: PublicKey;
  poolState: PublicKey;
  vault: PublicKey;
  vaultTokenAccount: PublicKey;
}): Promise<TransactionInstruction> => {
  return await program.methods
    .withdraw(new BN(lpTokenAmount))
    .accounts({
      user: publicKey,
      adminToken0Account,
      adminToken1Account,
      token0Vault,
      token1Vault,
      vault0Mint,
      vault1Mint,
      lpMint,
      token0Program,
      token1Program,
      tokenProgram,
      userToken0Account,
      userToken1Account,
      vaultToken0Account,
      vaultToken1Account,
      poolState,
      vault,
      vaultTokenAccount,
    })
    .instruction();
};
