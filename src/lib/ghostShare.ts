// ─────────────────────────────────────────────────────────────
//  OBSIDIAN — Ghost Share Core
//
//  Full flow:
//  1. Fetch executor from TEEServiceRegistry
//  2. ECIES encrypt secret to executor pubkey
//  3. Generate ephemeral keypair (private output)
//  4. EIP-191 sign encrypted blob
//  5. ABI-encode 13-field HTTP precompile calldata
//  6. Send tx → Ritual Chain
//  7. Parse spcCalls from receipt → get encrypted output
//
//  Result: SealedPayload + ephemeral private key
//  Recipient decrypts with eciesDecrypt(ephPrivKey, encryptedOutput)
// ─────────────────────────────────────────────────────────────

import {
  encodeAbiParameters,
  decodeAbiParameters,
  keccak256,
  toBytes,
  toHex,
  type WalletClient,
  type PublicClient,
  type Hex,
  type Address,
} from "viem";

import { RITUAL_CONTRACTS, EXPLORER_URL } from "../config/ritual";
import { eciesEncrypt, generateEphemeralKeypair, type SealedPayload } from "./ecies";
import { fetchActiveExecutor } from "./teeRegistry";

// ── HTTP method enum ──────────────────────────────────────────
const HTTP_METHOD = { GET: 0, POST: 2 } as const;

// ── Precompile ABI (13-field format) ─────────────────────────
const PRECOMPILE_INPUT_TYPES = [
  { type: "address"  }, // executor address
  { type: "bytes[]"  }, // encryptedSecrets (ECIES blobs)
  { type: "uint256"  }, // ttl (blocks)
  { type: "bytes[]"  }, // signatures (EIP-191, one per blob)
  { type: "bytes"    }, // userPublicKey (output encrypted here)
  { type: "string"   }, // url
  { type: "uint8"    }, // method (0=GET, 2=POST)
  { type: "string[]" }, // headerKeys
  { type: "string[]" }, // headerValues
  { type: "bytes"    }, // body (template substitution applied inside TEE)
  { type: "uint256"  }, // dkmsKeyIndex
  { type: "uint8"    }, // dkmsKeyFormat
  { type: "bool"     }, // piiEnabled
] as const;

// ── spcCalls output ABI ───────────────────────────────────────
const SPC_OUTPUT_TYPES = [
  { type: "uint16"   }, // HTTP status code
  { type: "string[]" }, // response header keys
  { type: "string[]" }, // response header values
  { type: "bytes"    }, // response body (encrypted if userPublicKey set)
  { type: "string"   }, // error message (empty = success)
] as const;

// ──────────────────────────────────────────────────────────────
//  Input / Output types
// ──────────────────────────────────────────────────────────────
export interface GhostShareInput {
  /** The secret message to transmit privately */
  secret: string;
  /** Recipient label (stored in header, not the encryption key) */
  recipientLabel?: string;
  /** TTL in blocks — ~246,858 blocks ≈ 24h on Ritual */
  ttlBlocks?: bigint;
}

export interface GhostShareResult {
  /** The sealed payload — share this with the recipient */
  sealedPayload: SealedPayload;
  /**
   * The ephemeral private key.
   * ⚠️ Share securely (Signal, encrypted email, etc.)
   * Anyone with this + sealedPayload can read the secret.
   */
  ephemeralPrivateKey: `0x${string}`;
  /** Explorer link for the transaction */
  explorerUrl: string;
}

// ──────────────────────────────────────────────────────────────
//  Main: submit Ghost Share to Ritual Chain
// ──────────────────────────────────────────────────────────────
export async function submitGhostShare(
  input: GhostShareInput,
  walletClient: WalletClient,
  publicClient: PublicClient,
  onLog?: (msg: string, type?: "info" | "ok" | "warn" | "error") => void
): Promise<GhostShareResult> {
  const log = (m: string, t?: "info" | "ok" | "warn" | "error") => onLog?.(m, t);
  const ttl = input.ttlBlocks ?? 100n;

  // ── 1. Fetch executor ───────────────────────────────────────
  log("fetching active executor from TEEServiceRegistry...", "info");
  const executor = await fetchActiveExecutor();
  log(`executor: ${executor.address}`, "ok");
  log(`pubkey:   ${executor.publicKey.slice(0, 18)}...`, "info");

  // ── 2. ECIES encrypt secret payload to executor pubkey ─────
  log("ECIES encrypting → executor (12-byte AES-GCM nonce)...", "info");

  // The executor will template-substitute GHOST_MSG → actual secret inside TEE
  const secretsJson = JSON.stringify({ GHOST_MSG: input.secret });
  const encryptedSecret = await eciesEncrypt(executor.publicKey, secretsJson);
  log(`encrypted blob: ${encryptedSecret.slice(0, 18)}... [${(encryptedSecret.length - 2) / 2} bytes]`, "info");

  // ── 3. Generate ephemeral keypair (private output) ──────────
  log("generating ephemeral secp256k1 keypair for sealed output...", "info");
  const ephemeralKeypair = generateEphemeralKeypair();
  log(`ephemeral pubkey: ${ephemeralKeypair.publicKey.slice(0, 18)}...`, "info");

  // ── 4. EIP-191 sign encrypted blob ─────────────────────────
  log("requesting EIP-191 signature (confirm in wallet)...", "info");
  const [account] = await walletClient.getAddresses();

  const signature = await walletClient.signMessage({
    account,
    message: { raw: toBytes(encryptedSecret) },  // raw bytes, not hashed
  });
  log(`signature: ${signature.slice(0, 18)}...`, "ok");

  // ── 5. ABI-encode precompile calldata ───────────────────────
  log("encoding 13-field HTTP precompile calldata...", "info");

  // Body: GHOST_MSG will be substituted by executor inside TEE
  const bodyJson = JSON.stringify({
    message:   "GHOST_MSG",   // ← template key, replaced in TEE
    timestamp: Date.now(),
    recipient: input.recipientLabel ?? "anonymous",
  });

  const calldata = encodeAbiParameters(PRECOMPILE_INPUT_TYPES, [
    executor.address,                          // executor
    [encryptedSecret],                         // encryptedSecrets[]
    ttl,                                       // ttl
    [signature],                               // signatures[]
    toBytes(ephemeralKeypair.publicKey),        // userPublicKey → sealed output
    "https://httpbin.org/post",                // url (executor POSTs here)
    HTTP_METHOD.POST,                          // method
    ["Content-Type", "X-Ghost-Recipient"],     // header keys
    ["application/json", input.recipientLabel ?? "0x0"], // header values
    toBytes(bodyJson),                         // body
    0n,                                        // dkmsKeyIndex
    0,                                         // dkmsKeyFormat
    false,                                     // piiEnabled
  ]);

  log(`precompile: ${RITUAL_CONTRACTS.HTTP_PRECOMPILE}`, "info");

  // ── 6. Send transaction to Ritual Chain ────────────────────
  log("sending transaction to Ritual Chain...", "info");

  const txHash = await walletClient.sendTransaction({
    account,
    to:       RITUAL_CONTRACTS.HTTP_PRECOMPILE,
    data:     calldata,
    gas:      3_000_000n,
    chain:    undefined, // already set in walletClient
  });
  log(`tx: ${txHash}`, "ok");

  // ── 7. Wait for receipt ────────────────────────────────────
  log("waiting for TEE executor settlement...", "info");
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  log(`confirmed block: ${receipt.blockNumber} · gas: ${receipt.gasUsed}`, "info");

  if (receipt.status === "reverted") {
    throw new Error(`transaction reverted in block ${receipt.blockNumber}`);
  }

  // ── 8. Parse spcCalls from raw receipt (Ritual custom field) ──
  log("parsing spcCalls from receipt...", "info");

  let encryptedOutput: Hex | null = null;
  let executorError: string | null = null;

  try {
    const rawReceipt = await publicClient.request({
      method: "eth_getTransactionReceipt" as any,
      params: [txHash],
    }) as any;

    const spcCalls = rawReceipt?.spcCalls;

    if (Array.isArray(spcCalls) && spcCalls.length > 0) {
      const [statusCode, , , outputBody, errorMsg] = decodeAbiParameters(
        SPC_OUTPUT_TYPES,
        spcCalls[0].output as Hex
      );

      const code = Number(statusCode);

      if (errorMsg && String(errorMsg).length > 0) {
        executorError = String(errorMsg);
        log(`executor error: ${errorMsg}`, "error");
      } else if (code >= 400) {
        executorError = `HTTP ${code}`;
        log(`HTTP error: ${code}`, "error");
      } else {
        encryptedOutput = toHex(outputBody as Uint8Array);
        log(`✓ executor status: ${code}`, "ok");
        log(`✓ output sealed with ephemeral pubkey`, "ok");
        log(`✓ encryptedOutput: ${encryptedOutput.slice(0, 18)}...`, "ok");
      }
    } else {
      log("spcCalls not in receipt — node may not expose custom fields", "warn");
      log("tx confirmed on-chain. Check explorer for details.", "warn");
    }
  } catch (e: any) {
    log(`spcCalls parse warning: ${e.message}`, "warn");
  }

  log("✓ ghost share sealed on Ritual Chain", "ok");

  const sealedPayload: SealedPayload = {
    v:               1,
    txHash,
    block:           Number(receipt.blockNumber),
    encryptedOutput,
    network:         "ritual:1979",
  };

  return {
    sealedPayload,
    ephemeralPrivateKey: ephemeralKeypair.privateKey,
    explorerUrl: `${EXPLORER_URL}/tx/${txHash}`,
  };
}

// ──────────────────────────────────────────────────────────────
//  Reveal: decrypt a Ghost Share using ephemeral private key
// ──────────────────────────────────────────────────────────────
export async function revealGhostShare(
  sealedPayload: SealedPayload,
  ephemeralPrivateKey: `0x${string}`
): Promise<string> {
  if (!sealedPayload.encryptedOutput) {
    throw new Error(
      "No encryptedOutput in sealed payload. " +
      "The executor output may not have been captured. " +
      `Check tx on explorer: ${EXPLORER_URL}/tx/${sealedPayload.txHash}`
    );
  }

  const { eciesDecrypt } = await import("./ecies");
  const plaintext = await eciesDecrypt(ephemeralPrivateKey, sealedPayload.encryptedOutput);

  // The executor returns the httpbin response JSON.
  // Extract the ghost message from json.message field.
  try {
    const parsed = JSON.parse(plaintext);
    if (parsed?.json?.message) return parsed.json.message;
    if (parsed?.data)          return parsed.data;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return plaintext; // return raw if not JSON
  }
}
