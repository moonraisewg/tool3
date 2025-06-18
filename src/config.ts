import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import crypto from "crypto";

const EC = process.env.EC!;

function decryptAES256(encryptedText: string, password: string): string {
  const [ivHex, encryptedHex] = encryptedText.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  const key = crypto.createHash("sha256").update(password).digest();
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

  let decrypted = decipher.update(encrypted, undefined, "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

const encryptedPrivateKey = process.env.ADMIN_PRIVATE_KEY_ENCRYPTED!;
const decryptedPrivateKey = decryptAES256(encryptedPrivateKey, EC);

export const adminKeypair = Keypair.fromSecretKey(
  bs58.decode(decryptedPrivateKey)
);
