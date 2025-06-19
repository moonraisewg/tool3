import "dotenv/config";
import crypto from "crypto";
import readlineSync from "readline-sync";

const EC = process.env.EC!;

function encryptAES256(plaintext: string, password: string): string {
  const key = crypto.createHash("sha256").update(password).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

const privateKey = readlineSync.question("Enter Private Key (base58): ");

if (!privateKey) {
  console.error(" You haven't entered the private key!");
  process.exit(1);
}

const encrypted = encryptAES256(privateKey, EC);
console.log(`\nADMIN_PRIVATE_KEY_ENCRYPTED=${encrypted}\n`);
