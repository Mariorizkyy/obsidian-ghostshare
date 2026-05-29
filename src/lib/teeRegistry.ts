// ─────────────────────────────────────────────────────────────
//  OBSIDIAN — TEEServiceRegistry Reader
//  Fetches the active HTTP executor + its secp256k1 public key
//  from Ritual's on-chain registry.
// ─────────────────────────────────────────────────────────────

import { createPublicClient, http, type Hex } from "viem";
import { ritualChain, RITUAL_CONTRACTS } from "../config/ritual";

// ── ABI (minimal — only what we need) ─────────────────────────
const TEE_REGISTRY_ABI = [
  {
    name: "getServicesByCapability",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "capability", type: "uint8" },
      { name: "checkValidity", type: "bool" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          {
            name: "node",
            type: "tuple",
            components: [
              { name: "paymentAddress", type: "address" },
              { name: "teeAddress",     type: "address" },
              { name: "teeType",        type: "uint8"   },
              { name: "publicKey",      type: "bytes"   },  // ← secp256k1 pubkey
              { name: "endpoint",       type: "string"  },
              { name: "certPubKeyHash", type: "bytes32" },
              { name: "capability",     type: "uint8"   },
            ],
          },
          { name: "isValid",    type: "bool"    },
          { name: "workloadId", type: "bytes32" },
        ],
      },
    ],
  },
] as const;

export interface ExecutorInfo {
  /** on-chain teeAddress */
  address: `0x${string}`;
  /** raw secp256k1 public key bytes (hex with 0x prefix) */
  publicKey: Hex;
  /** TEE endpoint URL */
  endpoint: string;
}

const publicClient = createPublicClient({
  chain: ritualChain,
  transport: http("https://rpc.ritualfoundation.org"),
});

/**
 * Fetches all valid HTTP executors from TEEServiceRegistry
 * and returns the first one (index 0 = default executor).
 *
 * CAPABILITY_HTTP = 0
 */
export async function fetchActiveExecutor(): Promise<ExecutorInfo> {
  const services = await publicClient.readContract({
    address: RITUAL_CONTRACTS.TEE_SERVICE_REGISTRY,
    abi: TEE_REGISTRY_ABI,
    functionName: "getServicesByCapability",
    args: [0, true], // capability=0 (HTTP), checkValidity=true
  });

  if (!services || services.length === 0) {
    throw new Error(
      "No active HTTP executors found on Ritual testnet. " +
      "Check https://explorer.ritualfoundation.org for registry status."
    );
  }

  const s = services[0];
  return {
    address:   s.node.teeAddress,
    publicKey: s.node.publicKey as Hex,
    endpoint:  s.node.endpoint,
  };
}
