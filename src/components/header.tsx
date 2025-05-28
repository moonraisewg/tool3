"use client";

import WalletConnectButton from "./custom-wallet-button";

export default function Header() {
  return (
    <header className="w-full">
      <div className="container mx-auto md:px-4 flex justify-end items-center">
        <WalletConnectButton />
      </div>
    </header>
  );
}
