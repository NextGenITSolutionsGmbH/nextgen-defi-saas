// ---------------------------------------------------------------------------
// Wallet Connection Utilities — Flare Network
// ---------------------------------------------------------------------------

export interface WalletConnectionResult {
  address: string;
  chainId: number;
  method: "metamask" | "walletconnect" | "manual";
}

/** Flare Mainnet chain configuration (EIP-3085) */
export const FLARE_CHAIN_CONFIG = {
  chainId: "0xe", // 14 in hex
  chainName: "Flare Mainnet",
  nativeCurrency: { name: "Flare", symbol: "FLR", decimals: 18 },
  rpcUrls: ["https://flare-api.flare.network/ext/C/rpc"],
  blockExplorerUrls: ["https://flarescan.com"],
} as const;

/** Flare mainnet chain ID */
export const FLARE_CHAIN_ID = 14;

// ---------------------------------------------------------------------------
// EVM Address Helpers
// ---------------------------------------------------------------------------

/**
 * Validate an EVM address: must be 0x followed by exactly 40 hex chars.
 */
export function isValidEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Truncate an address for display: 0x1234...abcd
 */
export function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// MetaMask Connection
// ---------------------------------------------------------------------------

/**
 * Connect to MetaMask, request account access, and ensure the user is on
 * the Flare network. If not on Flare, attempts to switch — and if the chain
 * is unknown to the wallet, attempts to add it.
 *
 * Returns the connected address (lowercased) and chain ID.
 *
 * @throws Error if MetaMask is not installed or user rejects the request.
 */
export async function connectMetaMask(): Promise<WalletConnectionResult> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error(
      "MetaMask is not installed. Please install MetaMask to connect your wallet."
    );
  }

  // Request account access (EIP-1102)
  const accounts = (await window.ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];

  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts returned from MetaMask.");
  }

  // Check current chain
  const chainIdHex = (await window.ethereum.request({
    method: "eth_chainId",
  })) as string;
  const currentChainId = parseInt(chainIdHex, 16);

  if (currentChainId !== FLARE_CHAIN_ID) {
    // Attempt to switch to Flare
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: FLARE_CHAIN_CONFIG.chainId }],
      });
    } catch (switchError: unknown) {
      // Error code 4902 means the chain is not added to MetaMask
      const errCode =
        typeof switchError === "object" &&
        switchError !== null &&
        "code" in switchError
          ? (switchError as { code: number }).code
          : undefined;

      if (errCode === 4902) {
        // Add Flare network
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: FLARE_CHAIN_CONFIG.chainId,
              chainName: FLARE_CHAIN_CONFIG.chainName,
              nativeCurrency: { ...FLARE_CHAIN_CONFIG.nativeCurrency },
              rpcUrls: [...FLARE_CHAIN_CONFIG.rpcUrls],
              blockExplorerUrls: [...FLARE_CHAIN_CONFIG.blockExplorerUrls],
            },
          ],
        });
      } else {
        throw new Error(
          "Failed to switch to Flare network. Please switch manually in MetaMask."
        );
      }
    }
  }

  return {
    address: accounts[0].toLowerCase(),
    chainId: FLARE_CHAIN_ID,
    method: "metamask",
  };
}

// ---------------------------------------------------------------------------
// TypeScript: extend Window for EIP-1193 provider
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}
