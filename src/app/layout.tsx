import type { Metadata } from "next";
import "./globals.css";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import Header from "@/components/header";
import WalletProviderComponent from "@/components/wallet-provider";
import { Toaster } from "sonner";
import { NetworkProvider } from "@/context/NetworkContext";
import SuspenseLayout from "@/components/suspense-layout";
import { GoogleTagManager } from "@next/third-parties/google";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Tool3 - Powerful All-in-One Token Tool",
  description:
    "Tool3 is your all-in-one Token Tool providing seamless solutions for token creation, liquidity pool management, secure LP token locking, instant token swaps, effortless devnet token purchases and much more.",

  openGraph: {
    title: "Tool3 - Powerful All-in-One Token Tool",
    description:
      "Tool3 is your all-in-one Token Tool providing seamless solutions for token creation, liquidity pool management, secure LP token locking, instant token swaps, effortless devnet token purchases and much more.",
    url: "https://tool3.xyz",
    siteName: "Tool3",
    images: [
      {
        url: "https://tool3.xyz/image/social-preview.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Tool3 - Powerful All-in-One Token Tool",
    description:
      "Tool3 is your all-in-one Token Tool providing seamless solutions for token creation, liquidity pool management, secure LP token locking, instant token swaps, effortless devnet token purchases and much more.",
    images: ["https://tool3.xyz/image/social-preview.png"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Tool3",
  url: "https://tool3.xyz",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <GoogleTagManager gtmId="GTM-T3L7ZX2F" />
        <Script
          id="json-ld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          strategy="afterInteractive"
        />
      </head>
      <body className="flex flex-col h-screen">
        <SuspenseLayout>
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
        </SuspenseLayout>
      </body>
    </html>
  );
}
