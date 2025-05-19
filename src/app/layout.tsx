import type { Metadata } from "next";
import "./globals.css";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import Header from "@/components/header";
import WalletProviderComponent from "@/components/wallet-provider";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "DiptsTool",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex flex-col h-screen">
        <SidebarProvider>
          <AppSidebar />
          <div className="flex flex-col flex-1">
            <WalletProviderComponent>
              <Header />
              <main className="flex-1">{children}</main>
              <Toaster />
            </WalletProviderComponent>
          </div>
        </SidebarProvider>
      </body>
    </html>
  );
}
