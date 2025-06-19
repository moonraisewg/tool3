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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { useNetwork } from "@/context/NetworkContext";
import Link from "next/link";
import {
  Home,
  Lock,
  Reload,
  ArrowUp,
  Coin,
  AddBox,
  Wallet,
  ChevronDown,
} from "@nsmr/pixelart-react";
import { useState } from "react";

interface RouteItem {
  title: string;
  icon?: React.ElementType;
  url: string;
  submenu?: RouteItem[];
  hidden?: boolean;
};

export const route = {
  api: [
    '/api',
    '/api/update-extensions',
    '/api/create-token',
    '/create',
    '/create/review',
    '/update-extensions',
    '/transfer-token'
  ],
  mainnet: [
    {
      title: "Transfer",
      icon: Reload,
      url: "/transfer-spl-token",
      url: "/transfer-spl-token",
    },
    {
      title: "Buy SOL devnet",
      icon: Coin,
      url: "/sell-sol-devnet",
    },
    {
      title: "Token",
      icon: Coin,
      submenu: [
        {
          title: "Create Token",
          url: "/create",
        },
        {
          title: "Update Extensions",
          url: "/update-extensions",
        },
        {
          title: "Transfer Token",
          url: "/transfer-token",
        },
        {
          title: "Burn Token",
          url: "/burn-token",
        },
        {
          title: "Permanent Delegate",
          url: "/permanent-delegate-recovery",
        },
      ],
    },
    {
      title: "Review Token",
      icon: Coin,
      url: "/create/review",
      hidden: true,
    },
    {
      title: "Swap SOL mainnet",
      icon: Wallet,
      url: "/swap-sol",
    },
    {
      title: "Create liquidity pool",
      icon: AddBox,
      url: "/create-pool",
    },
    {
      title: "Create Raydium CPMM Pool",
      url: "/create-pool/raydium-cpmm",
      hidden: true
    },
    {
      title: "Create Meteora DAMM Pool",
      url: "/create-pool/meteora-damm",
      hidden: true
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
      title: "Token",
      icon: Coin,
      submenu: [
        {
          title: "Create Token",
          url: "/create?cluster=devnet",
        },
        {
          title: "Update Extensions",
          url: "/update-extensions?cluster=devnet",
        },
        {
          title: "Transfer Token",
          url: "/transfer-token?cluster=devnet",
        },
        {
          title: "Burn Token",
          url: "/burn-token?cluster=devnet",
        },
        {
          title: "Permanent Delegate",
          url: "/permanent-delegate-recovery?cluster=devnet",
        },
      ],
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
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);

  const navMain = network === WalletAdapterNetwork.Devnet ? route.devnet : route.mainnet;

  const toggleSubmenu = (title: string) => {
    setOpenSubmenu(openSubmenu === title ? null : title);
  };

  // Check if any submenu item is active
  const isSubmenuActive = (submenuItems: RouteItem[]) => {
    if (!pathname) return false;
    return submenuItems.some(item => {
      if (!item.url) return false;
      return pathname.split('?')[0] === item.url.split('?')[0];
    });
  };

  return (
    <Sidebar className="border-r border-gray-800">
      <SidebarHeader className="border-b border-gray-800 h-[60px]">
        <div className="flex items-center gap-2 px-4 py-2">
          <Link href={"/?cluster=devnet"} className="text-2xl cursor-pointer">
            TOOL3
          </Link>
          <Link href={"/?cluster=devnet"} className="text-2xl cursor-pointer">
            TOOL3
          </Link>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navMain.filter(item => !item.hidden).map((item) => (
                <SidebarMenuItem key={item.title}>
                  {item.submenu ? (
                    <>
                      <SidebarMenuButton
                        onClick={() => toggleSubmenu(item.title)}
                        isActive={isSubmenuActive(item.submenu)}
                        className="flex items-center justify-between w-full"
                      >
                        <div className="flex items-center">
                          {item.icon && <item.icon className="mr-2 h-4 w-4" />}
                          <span>{item.title}</span>
                        </div>
                        <ChevronDown className="h-4 w-4" />
                      </SidebarMenuButton>

                      {(openSubmenu === item.title || isSubmenuActive(item.submenu)) && (
                        <SidebarMenuSub>
                          {item.submenu.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={
                                  pathname && subItem.url
                                    ? pathname.split("?")[0] === subItem.url.split("?")[0]
                                    : false
                                }
                              >
                                <Link href={subItem.url || "#"}>
                                  <span>{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      )}
                    </>
                  ) : (
                    <SidebarMenuButton
                      asChild
                      isActive={
                        pathname && item.url
                          ? pathname.split("?")[0] === item.url.split("?")[0]
                          : false
                      }
                    >
                      <Link href={item.url || "#"} className="flex items-center">
                        {item.icon && <item.icon className="mr-2 h-4 w-4" />}
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
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

