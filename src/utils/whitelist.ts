const WHITELISTED_WALLETS = new Set([
  "AoNFGeyLgCPZff6QHPMP8s7m3pqq5sbecerf6U2GSbfW",
  "2iA95CUhQtrtxAuxokraMdsM7dEjXHkwePz65kuf8oLN",
  "AXfPF7CidmgzxKk8EuSZpowxi3eEwEGYAZmcynUXw4VD",
  "DyJMhKtK5i7TLFxg4kHQPtwYcBsP1zXHJ6LbsEg2F8Qw",
]);

export function isWhitelisted(wallet: string): boolean {
  return WHITELISTED_WALLETS.has(wallet);
}
