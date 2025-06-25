"use client";

import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { clusterApiUrl } from "@solana/web3.js";
import { ReactNode, useMemo } from "react";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";

import "@solana/wallet-adapter-react-ui/styles.css";
import { useNetwork } from "@/context/NetworkContext";


export default function WalletProviderComponent({
  children,
}: {
  children: ReactNode;
}) {
  const { network } = useNetwork();
  
  const endpoint = useMemo(() => {
    if (network === 'devnet') {
      return process.env.NEXT_PUBLIC_RPC_DEVNET || clusterApiUrl('devnet');
    } else {
      return process.env.NEXT_PUBLIC_RPC_MAINNET || clusterApiUrl('mainnet-beta');
    }
  }, [network]);
  
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
