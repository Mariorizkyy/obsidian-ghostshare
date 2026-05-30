/**
 * OBSIDIAN — Crypto Library v2
 * secp256k1 ECIES compatible with Ritual TEE executor (eciesjs format)
 * Wire format: ephPubKey(65) ‖ iv(12) ‖ ciphertext+gcmTag(n+16)
 */

import { encrypt, decrypt, ECIES_CONFIG } from 'eciesjs';
import { SealedPayload } from '../types';

// ⚠️ CRITICAL: must be set before any encrypt/decrypt call
ECIES_CONFIG.symmetricNonceLength = 12;

// ── Encoding helpers ──────────────────────────────────────────
export function bytesToBase64(bytes: Uint8Array | Buffer): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  arr.forEach(b => (bin += String.fromCharCode(b)));
  return window.btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = window.atob(b64.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function hexToBytes(hex: string): Uint8Array {
  const h = hex.replace('0x', '');
  const b = new Uint8Array(h.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return b;
}

export function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map(v => v.toString(16).padStart(2, '0')).join('');
}

// ── Key management ────────────────────────────────────────────
/**
 * Generates a secp256k1 keypair for the user's OBSIDIAN identity.
 * Keys stored as base64 for UI compat.
 */
export async function generateEnclaveIdentity(): Promise<{
  publicKeyBase64:  string;
  privateKeyBase64: string;
}> {
  // Use eciesjs's internal secp256k1 for key generation
  const { secp256k1 } = await import('@noble/curves/secp256k1');
  const privBytes = secp256k1.utils.randomPrivateKey(); // 32 bytes
  const pubBytes  = secp256k1.getPublicKey(privBytes, false); // 65 bytes uncompressed
  return {
    publicKeyBase64:  bytesToBase64(pubBytes),
    privateKeyBase64: bytesToBase64(privBytes),
  };
}

// ── ECIES encrypt (secp256k1, eciesjs-compatible) ─────────────
/**
 * Encrypts plaintext to recipientPublicKeyBase64 using secp256k1 ECIES.
 * Used for:
 *   1. Encrypting secrets to Ritual executor pubkey
 *   2. User-to-user ghost share (peer encryption)
 */
export async function encryptSecret(
  recipientPublicKeyBase64: string,
  secretMessage: string,
  expiration: string
): Promise<{
  sealedPayload:                   SealedPayload;
  senderEphemeralPublicKeyBase64:  string;
  senderEphemeralPrivateKeyBase64: string; // share securely with recipient
}> {
  const recipientPubBytes = Buffer.from(base64ToBytes(recipientPublicKeyBase64));

  // eciesjs encrypt returns: ephPubKey(65) ‖ iv(12) ‖ ciphertext+tag
  const plainBuf   = Buffer.from(new TextEncoder().encode(secretMessage));
  const encrypted  = encrypt(recipientPubBytes, plainBuf);
  const encBytes   = new Uint8Array(encrypted);

  // Parse wire format to extract fields
  const ephPub = encBytes.slice(0, 65);
  const iv     = encBytes.slice(65, 77);
  const ct     = encBytes.slice(77);

  // Generate ephemeral private key for private output (Ritual-side)
  const { secp256k1 } = await import('@noble/curves/secp256k1');
  const ephPrivBytes = secp256k1.utils.randomPrivateKey();

  return {
    sealedPayload: {
      version:                  'obsidian.v2',
      ciphertext:               bytesToBase64(ct),
      iv:                       bytesToBase64(iv),
      senderEphemeralPublicKey: bytesToBase64(ephPub),
      recipientPublicKey:       recipientPublicKeyBase64,
      expiration,
      createdAt:                Date.now(),
    },
    senderEphemeralPublicKeyBase64:  bytesToBase64(ephPub),
    senderEphemeralPrivateKeyBase64: bytesToBase64(ephPrivBytes),
  };
}

// ── ECIES decrypt ─────────────────────────────────────────────
/**
 * For ghost link decryption:
 *   recipientPrivateKeyBase64 = the ephemeral private key from the ghost link
 *   sealedPayload.encryptedOutput = hex blob from spcCalls (executor output)
 *
 * For peer decryption (reveal secret):
 *   recipientPrivateKeyBase64 = the recipient's identity private key
 */
export async function decryptSecret(
  sealedPayload: SealedPayload,
  recipientPrivateKeyBase64: string
): Promise<string> {
  // If there's an encryptedOutput from spcCalls, decrypt that (Ritual path)
  const encHex = sealedPayload.encryptedOutput;
  if (encHex && encHex.length > 0) {
    return decryptFromHex(encHex, recipientPrivateKeyBase64);
  }

  // Fallback: decrypt from the ciphertext field (peer-to-peer path)
  const privBytes = Buffer.from(base64ToBytes(recipientPrivateKeyBase64));
  const ctBytes   = base64ToBytes(sealedPayload.ciphertext);
  const ivBytes   = base64ToBytes(sealedPayload.iv);
  const ephPub    = base64ToBytes(sealedPayload.senderEphemeralPublicKey);

  // Reconstruct eciesjs wire format: ephPub(65) ‖ iv(12) ‖ ct+tag
  const wire = new Uint8Array(65 + 12 + ctBytes.length);
  wire.set(ephPub, 0);
  wire.set(ivBytes, 65);
  wire.set(ctBytes, 77);

  const decrypted = decrypt(privBytes, Buffer.from(wire));
  return new TextDecoder().decode(decrypted);
}

/**
 * Decrypt hex-encoded eciesjs blob (from spcCalls encryptedOutput).
 */
export async function decryptFromHex(
  encryptedHex: string,
  privKeyBase64: string
): Promise<string> {
  const privBytes = Buffer.from(base64ToBytes(privKeyBase64));
  const encBytes  = Buffer.from(hexToBytes(encryptedHex));
  const decrypted = decrypt(privBytes, encBytes);
  const text      = new TextDecoder().decode(decrypted);

  // Executor returns httpbin JSON — extract the ghost message
  try {
    const parsed = JSON.parse(text);
    if (parsed?.json?.message) return parsed.json.message;
    if (parsed?.data)          return parsed.data;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return text;
  }
}

// ── Serialize / Deserialize ───────────────────────────────────
export function serializePayload(payload: SealedPayload): string {
  return window.btoa(encodeURIComponent(JSON.stringify(payload)));
}

export function deserializePayload(serialized: string): SealedPayload {
  try {
    const json = decodeURIComponent(window.atob(serialized.trim()));
    const obj  = JSON.parse(json);
    if (obj.ciphertext && obj.senderEphemeralPublicKey) return obj as SealedPayload;
    throw new Error('Invalid payload schema');
  } catch {
    throw new Error('Undecodable secret payload envelope.');
  }
}

// ── Array buffer helpers (backward compat) ────────────────────
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return bytesToBase64(new Uint8Array(buffer));
}
export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  return base64ToBytes(b64).buffer;
}
