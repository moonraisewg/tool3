import { BN } from "@coral-xyz/anchor";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { program } from "./program";
import { findUserLockPda } from "./pda";
import { getAccount } from "@solana/spl-token";
import { connection } from "./connection";

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


export interface UserPoolInfo {
  vaultAddress: PublicKey;
  poolState: PublicKey;
  lockedAmount: bigint;
  unlockTimestamp: bigint;
  depositTokenPerLp0: bigint;
  depositTokenPerLp1: bigint;
  token0Mint: PublicKey;
  token1Mint: PublicKey;
  vault0Amount: bigint;
  vault1Amount: bigint;
  lpMintDecimals: number;
  lpRatio?: number;
  vault0Address?: PublicKey;
  vault1Address?: PublicKey;
}

export async function getUserLockedPools(
  userPublicKey: PublicKey
): Promise<UserPoolInfo[]> {
  try {
    const userLockAccounts = await program.account.userLock.all([
      {
        memcmp: {
          offset: 8,
          bytes: userPublicKey.toBase58(),
        },
      },
    ]);

    const userPoolInfos: UserPoolInfo[] = [];

    for (const userLock of userLockAccounts) {
      const userLockData = userLock.account;
      const userLockPubkey = userLock.publicKey;

      const vaultAccounts = await program.account.vault.all();

      for (const vaultAccount of vaultAccounts) {
        const vault = vaultAccount.account;
        const vaultAddress = vaultAccount.publicKey;

        const [expectedUserLockPda] = findUserLockPda(vaultAddress, userPublicKey);
        if (expectedUserLockPda.equals(userLockPubkey)) {
          const poolStateAccount = await program.account.poolState.fetch(vault.poolState);


          const token0VaultAccount = await getAccount(connection, poolStateAccount.token0Vault);
          const token1VaultAccount = await getAccount(connection, poolStateAccount.token1Vault);

          const vault0Amount = BigInt(token0VaultAccount.amount.toString());
          const vault1Amount = BigInt(token1VaultAccount.amount.toString());


          const lpSupply = BigInt(poolStateAccount.lpSupply.toString());
          const lpRatio = lpSupply > 0 ? (Number(userLockData.amount) / Number(lpSupply)) * 100 : 0;


          userPoolInfos.push({
            vaultAddress,
            poolState: vault.poolState,
            lockedAmount: BigInt(userLockData.amount.toString()),
            unlockTimestamp: BigInt(userLockData.unlockTimestamp.toString()),
            depositTokenPerLp0: BigInt(userLockData.depositTokenPerLp0.toString()),
            depositTokenPerLp1: BigInt(userLockData.depositTokenPerLp1.toString()),
            token0Mint: poolStateAccount.token0Mint,
            token1Mint: poolStateAccount.token1Mint,
            vault0Amount,
            vault1Amount,
            lpMintDecimals: poolStateAccount.lpMintDecimals,
            vault0Address: poolStateAccount.token0Vault,
            vault1Address: poolStateAccount.token1Vault,
            lpRatio
          });
        }
      }
    }

    return userPoolInfos;
  } catch (error) {
    console.error("Error fetching user locked pools:", error);
    throw error;
  }
}