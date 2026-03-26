/**
 * MetaMask wallet connection utility for the Flare Network DeFi Tracker.
 *
 * Requests the user's Ethereum-compatible address via the injected
 * window.ethereum provider (MetaMask, Rabby, etc.).
 */

interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export class MetaMaskNotInstalledError extends Error {
  constructor() {
    super("MetaMask is not installed. Please install MetaMask to connect your wallet.");
    this.name = "MetaMaskNotInstalledError";
  }
}

export class UserRejectedError extends Error {
  constructor() {
    super("Connection request was rejected. Please approve the connection in MetaMask.");
    this.name = "UserRejectedError";
  }
}

/**
 * Connects to MetaMask and returns the selected wallet address (lowercased, 0x-prefixed).
 *
 * @throws {MetaMaskNotInstalledError} if no injected provider is found
 * @throws {UserRejectedError} if the user rejects the connection request
 * @throws {Error} for any other unexpected errors
 */
export async function connectMetaMask(): Promise<string> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new MetaMaskNotInstalledError();
  }

  try {
    const accounts = (await window.ethereum.request({
      method: "eth_requestAccounts",
    })) as string[];

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts returned from MetaMask.");
    }

    const address = accounts[0].toLowerCase();

    // Validate address format
    if (!/^0x[a-f0-9]{40}$/.test(address)) {
      throw new Error(`Invalid address format received: ${address}`);
    }

    return address;
  } catch (err: unknown) {
    // MetaMask error code 4001 = user rejected
    if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 4001) {
      throw new UserRejectedError();
    }
    throw err;
  }
}

/**
 * Requests MetaMask to switch to Flare Network (chain ID 14).
 * If the chain is not added yet, prompts the user to add it.
 */
export async function switchToFlareNetwork(): Promise<void> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new MetaMaskNotInstalledError();
  }

  const FLARE_CHAIN_ID = "0xe"; // 14 in hex

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: FLARE_CHAIN_ID }],
    });
  } catch (err: unknown) {
    // Error code 4902 = chain not added
    if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: FLARE_CHAIN_ID,
            chainName: "Flare",
            nativeCurrency: { name: "Flare", symbol: "FLR", decimals: 18 },
            rpcUrls: ["https://flare-api.flare.network/ext/C/rpc"],
            blockExplorerUrls: ["https://flarescan.com"],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

/**
 * Checks if MetaMask (or any injected EIP-1193 provider) is available.
 */
export function isMetaMaskAvailable(): boolean {
  return typeof window !== "undefined" && !!window.ethereum;
}
