/**
 * WalletConnect integration utility for the Flare Network DeFi Tracker.
 *
 * Uses @walletconnect/ethereum-provider to connect wallets via
 * the WalletConnect protocol (QR code modal).
 */

import { EthereumProvider } from "@walletconnect/ethereum-provider";

export class WalletConnectNotAvailableError extends Error {
  constructor() {
    super(
      "WalletConnect is not available. Please ensure the WalletConnect project ID is configured."
    );
    this.name = "WalletConnectNotAvailableError";
  }
}

export class WalletConnectUserRejectedError extends Error {
  constructor() {
    super(
      "Connection request was rejected. Please approve the connection in your wallet."
    );
    this.name = "WalletConnectUserRejectedError";
  }
}

/** Cached provider instance to allow disconnect without re-init. */
let cachedProvider: InstanceType<typeof EthereumProvider> | null = null;

/**
 * Connects via WalletConnect and returns the selected wallet address
 * (lowercased, 0x-prefixed).
 *
 * @throws {WalletConnectNotAvailableError} if no project ID is configured
 * @throws {WalletConnectUserRejectedError} if the user rejects the connection request
 * @throws {Error} for any other unexpected errors
 */
export async function connectWalletConnect(): Promise<string> {
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

  if (!projectId) {
    throw new WalletConnectNotAvailableError();
  }

  try {
    const provider = await EthereumProvider.init({
      projectId,
      chains: [14], // Flare mainnet
      showQrModal: true,
    });

    cachedProvider = provider;

    await provider.enable();

    const accounts = provider.accounts;

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts returned from WalletConnect.");
    }

    const address = accounts[0].toLowerCase();

    // Validate address format
    if (!/^0x[a-f0-9]{40}$/.test(address)) {
      throw new Error(`Invalid address format received: ${address}`);
    }

    return address;
  } catch (err: unknown) {
    // WalletConnect user rejection (EIP-1193 code 4001 or provider-level rejection)
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: number }).code === 4001
    ) {
      throw new WalletConnectUserRejectedError();
    }
    // Some wallets emit a generic "User rejected" message
    if (err instanceof Error && /reject/i.test(err.message)) {
      throw new WalletConnectUserRejectedError();
    }
    throw err;
  }
}

/**
 * Disconnects the current WalletConnect session, if any.
 */
export async function disconnectWalletConnect(): Promise<void> {
  if (cachedProvider) {
    await cachedProvider.disconnect();
    cachedProvider = null;
  }
}

/**
 * Checks if WalletConnect can be used (project ID is configured).
 */
export function isWalletConnectAvailable(): boolean {
  return !!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
}
