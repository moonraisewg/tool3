"use client";

import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { route } from "@/components/app-sidebar";

interface NetworkContextType {
    network: WalletAdapterNetwork;
    setNetwork: (network: WalletAdapterNetwork) => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();

    const [network, setNetwork] = useState<WalletAdapterNetwork>(() => {
        const cluster = searchParams.get("cluster");
        return cluster === "devnet" ? WalletAdapterNetwork.Devnet : WalletAdapterNetwork.Mainnet;
    });

    useEffect(() => {
        const cluster = searchParams.get("cluster");
        const newNetwork = cluster === "devnet" ? WalletAdapterNetwork.Devnet : WalletAdapterNetwork.Mainnet;

        const validDevnetPaths = route.devnet.map(item => item.url.split('?')[0]);
        const validMainnetPaths = route.mainnet.map(item => item.url.split('?')[0]);

        if (newNetwork !== network) {
            setNetwork(newNetwork);
            if (newNetwork === WalletAdapterNetwork.Devnet && !validDevnetPaths.includes(pathname)) {
                router.push(route.devnet[0].url);
            } else if (newNetwork === WalletAdapterNetwork.Mainnet && !validMainnetPaths.includes(pathname)) {
                router.push(route.mainnet[0].url);
            }
        } else {
            if (network === WalletAdapterNetwork.Devnet && !validDevnetPaths.includes(pathname)) {
                router.push(route.devnet[0].url);
            } else if (network === WalletAdapterNetwork.Mainnet && !validMainnetPaths.includes(pathname)) {
                router.push(route.mainnet[0].url);
            }
        }
    }, [searchParams, pathname, router, network]);

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