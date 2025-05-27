"use client";

import WalletConnectButton from "./custom-wallet-button";

export default function Header() {
  return (
    <header className="">
      <div className="container mx-auto px-4 flex justify-end items-center">
        <WalletConnectButton />
      </div>
    </header>
  );
}
