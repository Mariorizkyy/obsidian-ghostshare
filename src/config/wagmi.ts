// ─────────────────────────────────────────────────────────────
//  OBSIDIAN — Wagmi Config
//  Ritual Chain wallet connection setup
// ─────────────────────────────────────────────────────────────

import { createConfig, http } from "wagmi";
import { injected, metaMask } from "wagmi/connectors";
import { ritualChain } from "./ritual";

export const wagmiConfig = createConfig({
  chains: [ritualChain],
  connectors: [
    metaMask(),
    injected(), // fallback for other injected wallets
  ],
  transports: {
    [ritualChain.id]: http("https://rpc.ritualfoundation.org"),
  },
});

// ── Type augmentation for wagmi chain registry ─────────────
declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
