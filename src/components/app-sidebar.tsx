"use client";

import { Home, LockIcon, Anvil, Repeat } from "lucide-react";
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

const data = {
  navMain: [
    {
      title: "Dashboard",
      icon: Home,
      url: "/",
      isActive: true,
    },
    {
      title: "Lock LP",
      icon: LockIcon,
      url: "/lock-lp",
    },
    {
      title: "Withdraw LP",
      icon: Anvil,
      url: "/withdraw-lp",
    },
    {
      title: "Transfer",
      icon: Repeat,
      url: "/transfer",
    },
  ],
};

export function AppSidebar() {
  const pathname = usePathname();
  const { network } = useNetwork();

  // Filter nav items based on network
  const filteredNavMain = network === WalletAdapterNetwork.Devnet
    ? data.navMain.filter((item) => item.title === "Transfer")
    : data.navMain;

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
              {filteredNavMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
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