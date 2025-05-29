"use client";

import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { createContext, useContext, useState, ReactNode } from "react";

interface NetworkContextType {
    network: WalletAdapterNetwork;
    setNetwork: (network: WalletAdapterNetwork) => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
    const [network, setNetwork] = useState<WalletAdapterNetwork>(WalletAdapterNetwork.Devnet);

    return (
        <NetworkContext.Provider value={{ network, setNetwork }}>
            {children}
        </NetworkContext.Provider>
    );
}

export function useNetwork() {
    const context = useContext(NetworkContext);
    if (!context) {
        throw new Error("useNetwork must be used within a NetworkProvider");
    }
    return context;
}