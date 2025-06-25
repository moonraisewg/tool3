import { Connection, PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import {
    TOKEN_PROGRAM_ID,
    createTransferInstruction,
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { Keypair } from "@solana/web3.js";
import { NATIVE_SOL } from "./constants";

export async function createTokenTransferTx(
    connection: Connection,
    userPublicKey: PublicKey,
    destinationKeypair: Keypair,
    mintAAddress: string,
    mintBAddress: string,
    amountA: string,
    amountB: string
): Promise<Transaction> {
    const tx = new Transaction();
    const destinationPubkey = destinationKeypair.publicKey;

    // Validate input amounts
    const amountANum = Number(amountA);
    const amountBNum = Number(amountB);
    if (isNaN(amountANum) || amountANum <= 0 || isNaN(amountBNum) || amountBNum <= 0) {
        throw new Error("Invalid transfer amounts");
    }

    // Check balances
    if (mintAAddress === NATIVE_SOL) {
        const userBalance = await connection.getBalance(userPublicKey);
        if (userBalance < amountANum) {
            throw new Error(`Insufficient Native SOL balance for token A. Required: ${amountANum / 1_000_000_000} SOL`);
        }
    } else {
        const mintAPubkey = new PublicKey(mintAAddress);
        const userAtaA = getAssociatedTokenAddressSync(mintAPubkey, userPublicKey);
        const userAtaAInfo = await connection.getTokenAccountBalance(userAtaA).catch(() => null);
        if (!userAtaAInfo || Number(userAtaAInfo.value) < amountANum) {
            throw new Error(`Insufficient balance for token A (${mintAAddress})`);
        }
    }

    if (mintBAddress === NATIVE_SOL) {
        const userBalance = await connection.getBalance(userPublicKey);
        const requiredLamports = (mintAAddress === NATIVE_SOL ? amountANum : 0) + amountBNum;
        if (userBalance < requiredLamports) {
            throw new Error(`Insufficient Native SOL balance for token B. Required: ${requiredLamports / 1_000_000_000} SOL`);
        }
    } else {
        const mintBPubkey = new PublicKey(mintBAddress);
        const userAtaB = getAssociatedTokenAddressSync(mintBPubkey, userPublicKey);
        const userAtaBInfo = await connection.getTokenAccountBalance(userAtaB).catch(() => null);
        if (!userAtaBInfo || Number(userAtaBInfo.value.amount) < amountBNum) {
            throw new Error(`Insufficient balance for token B (${mintBAddress})`);
        }
    }

    // Create ATA for token A if not Native SOL
    if (mintAAddress !== NATIVE_SOL) {
        const mintAPubkey = new PublicKey(mintAAddress);
        const adminAtaA = getAssociatedTokenAddressSync(mintAPubkey, destinationPubkey);
        const adminAtaAInfo = await connection.getAccountInfo(adminAtaA);
        if (!adminAtaAInfo) {
            tx.add(
                createAssociatedTokenAccountInstruction(
                    userPublicKey,
                    adminAtaA,
                    destinationPubkey,
                    mintAPubkey,
                    TOKEN_PROGRAM_ID
                )
            );
        }
    }

    // Create ATA for token B if not Native SOL
    if (mintBAddress !== NATIVE_SOL) {
        const mintBPubkey = new PublicKey(mintBAddress);
        const adminAtaB = getAssociatedTokenAddressSync(mintBPubkey, destinationPubkey);
        const adminAtaBInfo = await connection.getAccountInfo(adminAtaB);
        if (!adminAtaBInfo) {
            tx.add(
                createAssociatedTokenAccountInstruction(
                    userPublicKey,
                    adminAtaB,
                    destinationPubkey,
                    mintBPubkey,
                    TOKEN_PROGRAM_ID
                )
            );
        }
    }

    // Transfer token A
    if (mintAAddress === NATIVE_SOL) {
        tx.add(
            SystemProgram.transfer({
                fromPubkey: userPublicKey,
                toPubkey: destinationPubkey,
                lamports: amountANum,
            })
        );
    } else {
        const mintAPubkey = new PublicKey(mintAAddress);
        const userAtaA = getAssociatedTokenAddressSync(mintAPubkey, userPublicKey);
        const adminAtaA = getAssociatedTokenAddressSync(mintAPubkey, destinationPubkey);
        tx.add(
            createTransferInstruction(
                userAtaA,
                adminAtaA,
                userPublicKey,
                amountANum,
                [],
                TOKEN_PROGRAM_ID
            )
        );
    }

    // Transfer token B
    if (mintBAddress === NATIVE_SOL) {
        tx.add(
            SystemProgram.transfer({
                fromPubkey: userPublicKey,
                toPubkey: destinationPubkey,
                lamports: amountBNum,
            })
        );
    } else {
        const mintBPubkey = new PublicKey(mintBAddress);
        const userAtaB = getAssociatedTokenAddressSync(mintBPubkey, userPublicKey);
        const adminAtaB = getAssociatedTokenAddressSync(mintBPubkey, destinationPubkey);
        tx.add(
            createTransferInstruction(
                userAtaB,
                adminAtaB,
                userPublicKey,
                amountBNum,
                [],
                TOKEN_PROGRAM_ID
            )
        );
    }

    return tx;
}