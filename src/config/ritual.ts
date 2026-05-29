// ─────────────────────────────────────────────────────────────
//  OBSIDIAN — Ritual Chain Config
//  RPC: https://rpc.ritualfoundation.org
//  Explorer: https://explorer.ritualfoundation.org
// ─────────────────────────────────────────────────────────────

import { defineChain } from "viem";

/** Ritual Testnet — Chain ID 1979 */
export const ritualChain = defineChain({
  id: 1979,
  name: "Ritual",
  nativeCurrency: { name: "RITUAL", symbol: "RITUAL", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.ritualfoundation.org"] },
  },
  blockExplorers: {
    default: {
      name: "Ritual Explorer",
      url: "https://explorer.ritualfoundation.org",
    },
  },
  testnet: true,
});

/** Verified contract addresses on Ritual Chain */
export const RITUAL_CONTRACTS = {
  /** HTTP Precompile — core of Ghost Share trustless delivery */
  HTTP_PRECOMPILE: "0x0000000000000000000000000000000000000801" as `0x${string}`,
  /** TEEServiceRegistry — fetch active executor pubkeys */
  TEE_SERVICE_REGISTRY: "0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F" as `0x${string}`,
  /** SecretsAccessControl — delegate encrypted secret access */
  SECRETS_ACCESS_CONTROL: "0xf9BF1BC8A3e79B9EBeD0fa2Db70D0513fecE32FD" as `0x${string}`,
  /** RitualWallet — fee deposits */
  RITUAL_WALLET: "0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948" as `0x${string}`,
} as const;

export const EXPLORER_URL = "https://explorer.ritualfoundation.org";
export const FAUCET_URL   = "https://faucet.ritualfoundation.org";
