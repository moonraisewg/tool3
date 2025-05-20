import { BN } from "@coral-xyz/anchor";
import { getProgram } from "./program";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  PublicKey,
  Transaction,
  Keypair,
} from "@solana/web3.js";

export const initializeVault = async ({
  owner,
  poolId,
  bump,
  vault,
  vaultTokenAccount,
  vaultAuthority,
  tokenMint,
}: {
  owner: Keypair;
  poolId: PublicKey;
  bump: number;
  vault: PublicKey;
  vaultTokenAccount: PublicKey;
  vaultAuthority: PublicKey;
  tokenMint: PublicKey;
}): Promise<string> => {
  const program = getProgram();

  const instruction = await program.methods
    .initializeVault(poolId, bump)
    .accounts({
      vault,
      initializer: owner.publicKey,
      tokenMint,
      vaultTokenAccount,
      vaultAuthority,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .instruction();

  const transaction = new Transaction();
  transaction.add(instruction);

  const { blockhash } = await program.provider.connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = owner.publicKey;

  // Ký và gửi giao dịch
  transaction.sign(owner);
  const txId = await program.provider.connection.sendRawTransaction(
    transaction.serialize()
  );
  await program.provider.connection.confirmTransaction(txId);

  return txId; // Trả về transaction ID
};

export const deposit = async ({
  publicKey,
  amount,
  unlockTimestamp,
  vault,
  userLock,
  userTokenAccount,
  vaultTokenAccount,
  tokenMint,
}: {
  publicKey: PublicKey;
  amount: number;
  unlockTimestamp: number;
  vault: PublicKey;
  userLock: PublicKey;
  userTokenAccount: PublicKey;
  vaultTokenAccount: PublicKey;
  tokenMint: PublicKey;
}): Promise<string> => {
  const program = getProgram();

  const instruction = await program.methods
    .deposit(new BN(amount), new BN(unlockTimestamp))
    .accounts({
      vault,
      user: publicKey,
      userLock,
      userTokenAccount,
      vaultTokenAccount,
      tokenMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      clock: SYSVAR_CLOCK_PUBKEY,
      systemProgram: SystemProgram.programId,
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
  userLock,
  userTokenAccount,
  vaultTokenAccount,
  vaultAuthority,
  tokenMint,
}: {
  publicKey: PublicKey;
  amount: number;
  vault: PublicKey;
  userLock: PublicKey;
  userTokenAccount: PublicKey;
  vaultTokenAccount: PublicKey;
  vaultAuthority: PublicKey;
  tokenMint: PublicKey;
}): Promise<string> => {
  const program = getProgram();

  const instruction = await program.methods
    .withdraw(new BN(amount))
    .accounts({
      vault,
      user: publicKey,
      userLock,
      userTokenAccount,
      vaultTokenAccount,
      vaultAuthority,
      tokenMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      clock: SYSVAR_CLOCK_PUBKEY,
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
//   cpSwapProgram,
//   authority,
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
//   cpSwapProgram: PublicKey;
//   authority: PublicKey;
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
//   const program = getProgram();

//   const instruction = await program.methods
//     .proxyWithdraw(
//       new BN(lpTokenAmount),
//       new BN(minToken0Amount),
//       new BN(minToken1Amount)
//     )
//     .accounts({
//       cpSwapProgram,
//       owner: publicKey, // Dùng publicKey
//       authority,
//       poolState,
//       ownerLpToken,
//       token0Account,
//       token1Account,
//       token0Vault,
//       token1Vault,
//       tokenProgram: TOKEN_PROGRAM_ID,
//       tokenProgram2022: new PublicKey(
//         "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
//       ),
//       vault0Mint,
//       vault1Mint,
//       lpMint,
//       memoProgram: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
//     })
//     .instruction();

//   const transaction = new Transaction();
//   transaction.add(instruction);

//   const { blockhash } = await program.provider.connection.getLatestBlockhash();
//   transaction.recentBlockhash = blockhash;
//   transaction.feePayer = publicKey; // Dùng publicKey

//   return transaction
//     .serialize({ requireAllSignatures: false })
//     .toString("base64");
// };
