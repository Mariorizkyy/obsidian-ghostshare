// ─────────────────────────────────────────────────────────────
//  OBSIDIAN — ECIES Crypto Library
//  Compatible with eciesjs + Ritual 12-byte AES-GCM nonce
//
//  Wire format: ephPubKey(65) ‖ iv(12) ‖ ciphertext+gcmTag(n+16)
//
//  Requires: eciesjs installed
//  npm install eciesjs
//
//  ECIES_CONFIG.symmetricNonceLength MUST be 12 before any call.
//  This is set once at module load below.
// ─────────────────────────────────────────────────────────────

import { encrypt, decrypt, ECIES_CONFIG } from "eciesjs";

// ⚠️  CRITICAL: set before first encrypt/decrypt call
ECIES_CONFIG.symmetricNonceLength = 12;

// ──────────────────────────────────────────────────────────────
//  Types
// ──────────────────────────────────────────────────────────────
export interface EphemeralKeypair {
  privateKey: `0x${string}`;
  publicKey: `0x${string}`;  // 65-byte uncompressed (0x04 prefix)
}

export interface SealedPayload {
  /** Version tag for future-proofing */
  v: 1;
  /** Ritual Chain tx hash */
  txHash: `0x${string}`;
  /** Block number of settlement */
  block: number;
  /**
   * Output encrypted by TEE executor to ephemeral user keypair.
   * Extracted from receipt.spcCalls[0].output — ABI-decoded body field.
   */
  encryptedOutput: `0x${string}` | null;
  /** Ritual Chain ID */
  network: "ritual:1979";
}

// ──────────────────────────────────────────────────────────────
//  Encrypt a plaintext secret to a secp256k1 public key
//  (used to encrypt to executor pubkey from TEEServiceRegistry)
// ──────────────────────────────────────────────────────────────
export async function eciesEncrypt(
  recipientPubKeyHex: string,
  plaintext: string
): Promise<`0x${string}`> {
  // Normalize: strip 0x prefix, ensure 04 uncompressed prefix
  let pub = recipientPubKeyHex.replace(/^0x/, "");
  if (pub.length === 128) pub = "04" + pub;   // add uncompressed prefix
  if (pub.length !== 130) {
    throw new Error(`invalid public key length: ${pub.length} chars`);
  }

  const pubKeyBytes   = Buffer.from(pub, "hex");
  const plaintextBuf  = Buffer.from(plaintext, "utf8");
  const encrypted     = encrypt(pubKeyBytes, plaintextBuf);

  return ("0x" + encrypted.toString("hex")) as `0x${string}`;
}

// ──────────────────────────────────────────────────────────────
//  Decrypt — used by recipient to reveal the Ghost Share
//  privKeyHex: the ephemeral private key from the ghost link
//  encryptedHex: encryptedOutput from spcCalls
// ──────────────────────────────────────────────────────────────
export async function eciesDecrypt(
  privKeyHex: string,
  encryptedHex: string
): Promise<string> {
  const priv      = privKeyHex.replace(/^0x/, "");
  const encBuf    = Buffer.from(encryptedHex.replace(/^0x/, ""), "hex");
  const privBuf   = Buffer.from(priv, "hex");
  const decrypted = decrypt(privBuf, encBuf);
  return decrypted.toString("utf8");
}

// ──────────────────────────────────────────────────────────────
//  Generate an ephemeral secp256k1 keypair
//  userPublicKey is sent to precompile so executor can encrypt
//  output back — only the holder of privateKey can decrypt
// ──────────────────────────────────────────────────────────────
export function generateEphemeralKeypair(): EphemeralKeypair {
  // eciesjs uses secp256k1 internally
  const priv  = crypto.getRandomValues(new Uint8Array(32));
  const privHex = "0x" + Buffer.from(priv).toString("hex") as `0x${string}`;

  // Derive public key via eciesjs internal helper
  // We encrypt a dummy payload to ourselves and strip the ephemeral key from it
  // — cleaner: use @noble/secp256k1 directly
  const { getPublicKey } = require("@noble/secp256k1");
  const pubBytes = getPublicKey(priv, false); // false = uncompressed (65 bytes)
  const pubHex   = ("0x" + Buffer.from(pubBytes).toString("hex")) as `0x${string}`;

  return { privateKey: privHex, publicKey: pubHex };
}
