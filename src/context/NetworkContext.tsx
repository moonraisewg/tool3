"use client";

import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { route } from "@/components/app-sidebar";

interface NetworkContextType {
  network: WalletAdapterNetwork;
  setNetwork: (network: WalletAdapterNetwork) => void;
}

interface RouteItem {
  url?: string;
  submenu?: RouteItem[];
  [key: string]: unknown;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [network, setNetwork] = useState<WalletAdapterNetwork>(() => {
    const cluster = searchParams.get("cluster");
    return cluster === "devnet"
      ? WalletAdapterNetwork.Devnet
      : WalletAdapterNetwork.Mainnet;
  });

  useEffect(() => {
    const cluster = searchParams.get("cluster");
    const newNetwork =
      cluster === "devnet"
        ? WalletAdapterNetwork.Devnet
        : WalletAdapterNetwork.Mainnet;
    const getAllValidPaths = (routes: RouteItem[]) => {
      const paths: string[] = [];

      routes.forEach((item) => {
        if (item.url) {
          paths.push(item.url.split("?")[0]);
        }
        if (item.submenu && Array.isArray(item.submenu)) {
          item.submenu.forEach((subItem: RouteItem) => {
            if (subItem.url) {
              paths.push(subItem.url.split("?")[0]);
            }
          });
        }
      });

      return paths;
    };

    const validDevnetPaths = getAllValidPaths(route.devnet);
    const validMainnetPaths = getAllValidPaths(route.mainnet);

    const currentPath = pathname || "/";
    const isApiPath =
      route.api &&
      route.api.some((apiPath) => {
        const currentPathWithoutQuery = currentPath.split("?")[0];
        return (
          currentPathWithoutQuery === apiPath ||
          currentPathWithoutQuery.startsWith(apiPath + "/")
        );
      });
    if (isApiPath) {
      setNetwork(newNetwork);
      return;
    }

    if (newNetwork !== network) {
      setNetwork(newNetwork);
      if (
        newNetwork === WalletAdapterNetwork.Devnet &&
        !validDevnetPaths.includes(currentPath)
      ) {
        if (route.devnet.length > 0 && route.devnet[0].url) {
          router.push(route.devnet[0].url);
        }
      } else if (
        newNetwork === WalletAdapterNetwork.Mainnet &&
        !validMainnetPaths.includes(currentPath)
      ) {
        if (route.mainnet.length > 0 && route.mainnet[0].submenu?.[0]?.url) {
          router.push(route.mainnet[0].submenu[0].url);
        }
      }
    } else {
      if (
        network === WalletAdapterNetwork.Devnet &&
        !validDevnetPaths.includes(currentPath)
      ) {
        if (route.devnet.length > 0 && route.devnet[0].url) {
          router.push(route.devnet[0].url);
        }
      } else if (
        network === WalletAdapterNetwork.Mainnet &&
        !validMainnetPaths.includes(currentPath)
      ) {
        if (route.mainnet.length > 0 && route.mainnet[0].submenu?.[0]?.url) {
          router.push(route.mainnet[0].submenu[0].url);
        }
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
