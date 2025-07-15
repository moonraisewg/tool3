import { Connection } from "@solana/web3.js";
import { connectionMainnet } from "@/service/solana/connection";

export interface RPCStatus {
  latency: number;
  isValid: boolean;
  error?: string;
}

export async function checkRPCSpeed(rpcUrl: string): Promise<RPCStatus> {
  const startTime = Date.now();

  try {
    const connection = new Connection(rpcUrl, "confirmed");
    await connection.getSlot();

    const latency = Date.now() - startTime;

    return {
      latency,
      isValid: true,
    };
  } catch (error) {
    return {
      latency: -1,
      isValid: false,
      error: error instanceof Error ? error.message : "Invalid RPC",
    };
  }
}

export function createConnection(userRpcUrl?: string): Connection {
  if (userRpcUrl && userRpcUrl.trim()) {
    try {
      return new Connection(userRpcUrl, "confirmed");
    } catch {
      return connectionMainnet;
    }
  }
  return connectionMainnet;
}
