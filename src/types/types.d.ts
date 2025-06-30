export interface Token {
  address: string;
  name: string;
  symbol: string;
  logoURI?: string;
  decimals?: number;
  chainId?: number;
}

export type ClusterType = "mainnet" | "devnet";

export interface BatchTransaction {
  transaction: string;
  tokenSwaps: string[];
  expectedSolOutput: number;
  metadata: {
    batchIndex: number;
    swapCount: number;
    instructionCount: number;
    transactionSize: number;
  };
}
