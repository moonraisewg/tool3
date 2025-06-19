export interface Token {
    address: string;
    name: string;
    symbol: string;
    logoURI?: string;
    decimals?: number;
}

export type ClusterType = "mainnet" | "devnet";