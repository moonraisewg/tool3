"use client";

import WalletConnectButton from "./custom-wallet-button";

export default function Header() {
  return (
    <header className="border-b border-gray-800 ">

      <div className="container mx-auto px-4 flex justify-end items-center h-[60px]">
        <WalletConnectButton />
      </div>
    </header>
  );
}
