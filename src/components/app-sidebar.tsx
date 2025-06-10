"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { useNetwork } from "@/context/NetworkContext";
import Link from "next/link";
import { Home, Lock, Reload, ArrowUp, Coin } from "@nsmr/pixelart-react";

export const route = {
  mainnet: [
    {
      title: "Transfer",
      icon: Reload,
      url: "/transfer",
    },
    {
      title: "Buy SOL devnet",
      icon: Coin,
      url: "/sell-sol-devnet",
    },
    {
      title: "Create Token",
      icon: Coin,
      url: "/create",
    },
    {
      title: "Review Token",
      icon: Coin,
      url: "/create/review",
      hidden: true,
    },
  ],
  devnet: [
    {
      title: "Dashboard",
      icon: Home,
      url: "/?cluster=devnet",
    },
    {
      title: "Lock LP",
      icon: Lock,
      url: "/lock-lp?cluster=devnet",
    },
    {
      title: "Withdraw LP",
      icon: ArrowUp,
      url: "/withdraw-lp?cluster=devnet",
    },
    {
      title: "Create Token",
      icon: Coin,
      url: "/create?cluster=devnet",
    },
    {
      title: "Review Token",
      icon: Coin,
      url: "/create/review?cluster=devnet",
      hidden: true,
    },
  ],
};


export function AppSidebar() {
  const pathname = usePathname();
  const { network } = useNetwork();

  const navMain = network === WalletAdapterNetwork.Devnet ? route.devnet : route.mainnet;

  return (
    <Sidebar className="border-r border-gray-800">
      <SidebarHeader className="border-b border-gray-800 h-[60px]">
        <div className="flex items-center gap-2 px-4 py-2">
          <span className="text-lg">TOOL3</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navMain.filter(item => !item.hidden).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname.split('?')[0] === item.url.split('?')[0]}>
                    <Link href={item.url} className="flex items-center">
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}