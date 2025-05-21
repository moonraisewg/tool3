import { BN } from "@coral-xyz/anchor";
import { program } from "./program";
import { PublicKey, Transaction, Keypair } from "@solana/web3.js";

export const initializeVault = async ({
  owner,
  poolId,
  bump,
  tokenMint,
}: {
  owner: Keypair;
  poolId: PublicKey;
  bump: number;
  tokenMint: PublicKey;
}): Promise<string> => {
  const instruction = await program.methods
    .initializeVault(poolId, bump)
    .accounts({
      initializer: owner.publicKey,
      tokenMint,
    })
    .instruction();

  const transaction = new Transaction();
  transaction.add(instruction);

  const { blockhash } = await program.provider.connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = owner.publicKey;

  transaction.sign(owner);
  const txId = await program.provider.connection.sendRawTransaction(
    transaction.serialize()
  );
  await program.provider.connection.confirmTransaction(txId);

  return txId;
};

export const deposit = async ({
  publicKey,
  amount,
  unlockTimestamp,
  vault,
  userTokenAccount,
  vaultTokenAccount,
}: {
  publicKey: PublicKey;
  amount: number;
  unlockTimestamp: number;
  vault: PublicKey;
  userTokenAccount: PublicKey;
  vaultTokenAccount: PublicKey;
}): Promise<string> => {
  const instruction = await program.methods
    .deposit(new BN(amount), new BN(unlockTimestamp))
    .accounts({
      vault,
      user: publicKey,
      userTokenAccount,
      vaultTokenAccount,
    })
    .instruction();

  const transaction = new Transaction();
  transaction.add(instruction);

  const { blockhash } = await program.provider.connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = publicKey;

  return transaction
    .serialize({ requireAllSignatures: false })
    .toString("base64");
};

export const withdraw = async ({
  publicKey,
  amount,
  vault,
  userTokenAccount,
  vaultTokenAccount,
}: {
  publicKey: PublicKey;
  amount: number;
  vault: PublicKey;
  userTokenAccount: PublicKey;
  vaultTokenAccount: PublicKey;
}): Promise<string> => {
  const instruction = await program.methods
    .withdraw(new BN(amount))
    .accounts({
      vault,
      user: publicKey,
      userTokenAccount,
      vaultTokenAccount,
    })
    .instruction();

  const transaction = new Transaction();
  transaction.add(instruction);

  const { blockhash } = await program.provider.connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = publicKey;

  return transaction
    .serialize({ requireAllSignatures: false })
    .toString("base64");
};

// export const proxyWithdraw = async ({
//   publicKey,
//   lpTokenAmount,
//   minToken0Amount,
//   minToken1Amount,
//   poolState,
//   ownerLpToken,
//   token0Account,
//   token1Account,
//   token0Vault,
//   token1Vault,
//   vault0Mint,
//   vault1Mint,
//   lpMint,
// }: {
//   publicKey: PublicKey;
//   lpTokenAmount: number;
//   minToken0Amount: number;
//   minToken1Amount: number;
//   poolState: PublicKey;
//   ownerLpToken: PublicKey;
//   token0Account: PublicKey;
//   token1Account: PublicKey;
//   token0Vault: PublicKey;
//   token1Vault: PublicKey;
//   vault0Mint: PublicKey;
//   vault1Mint: PublicKey;
//   lpMint: PublicKey;
// }): Promise<string> => {
//   const instruction = await program.methods
//     .proxyWithdraw(
//       new BN(lpTokenAmount),
//       new BN(minToken0Amount),
//       new BN(minToken1Amount)
//     )
//     .accounts({
//       lpMint,
//       ownerLpToken,
//       poolState,
//       token0Account,
//       token0Vault,
//       token1Account,
//       token1Vault,
//       vault0Mint,
//       vault1Mint,
//     })
//     .instruction();

//   const transaction = new Transaction();
//   transaction.add(instruction);

//   const { blockhash } = await program.provider.connection.getLatestBlockhash();
//   transaction.recentBlockhash = blockhash;
//   transaction.feePayer = publicKey;

//   return transaction
//     .serialize({ requireAllSignatures: false })
//     .toString("base64");
// };
