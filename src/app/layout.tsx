import type { Metadata } from "next";
import "./globals.css";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import Header from "@/components/header";
import WalletProviderComponent from "@/components/wallet-provider";
import { Toaster } from "sonner";
import { NetworkProvider } from "@/context/NetworkContext";

export const metadata: Metadata = {
  title: "Tool3",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex flex-col h-screen">
        <NetworkProvider>
          <SidebarProvider>
            <AppSidebar />
            <div className="flex flex-col flex-1">
              <WalletProviderComponent>
                <div className="flex justify-between items-center px-4 py-4 border-b border-gray-800 h-[60px]">
                  <SidebarTrigger />
                  <Header />
                </div>
                <main className="flex-1"> {children}</main>
                <Toaster />
              </WalletProviderComponent>
            </div>
          </SidebarProvider>
        </NetworkProvider>
      </body>
    </html>
  );
}
