import { BN } from "@coral-xyz/anchor";
import { program } from "@/service/solana/program";
import { PublicKey } from "@solana/web3.js";
import { findUserLockPda } from "@/service/solana/pda";

export const getUserLockInfo = async ({
  vault,
  userPublicKey,
}: {
  vault: PublicKey;
  userPublicKey: PublicKey;
}): Promise<{
  amount: BN;
  unlockTimestamp: BN;
}> => {
  const [userLock] = findUserLockPda(vault, userPublicKey);
  try {
    const userLockAccount = await program.account.userLock.fetch(userLock);

    return {
      amount: userLockAccount.amount,
      unlockTimestamp: userLockAccount.unlockTimestamp,
    };
  } catch (error) {
    console.error("Error fetching user lock info:", error);
    return {
      amount: new BN(0),
      unlockTimestamp: new BN(0),
    };
  }
};
