/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SealedPayload } from "../types";

// Helper utilities for ArrayBuffer and Base64 translations
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generates an OBSIDIAN Graphite Identity (P-256 ECDH Keypair)
 */
export async function generateEnclaveIdentity(): Promise<{
  publicKeyBase64: string;
  privateKeyBase64: string;
}> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true, // extractable
    ["deriveKey", "deriveBits"]
  );

  const exportedPublic = await window.crypto.subtle.exportKey(
    "spki",
    keyPair.publicKey
  );
  const exportedPrivate = await window.crypto.subtle.exportKey(
    "pkcs8",
    keyPair.privateKey
  );

  return {
    publicKeyBase64: arrayBufferToBase64(exportedPublic),
    privateKeyBase64: arrayBufferToBase64(exportedPrivate),
  };
}

/**
 * Encrypts a confidential secret using Ephemeral ECDH & AES-GCM
 */
export async function encryptSecret(
  recipientPublicKeyBase64: string,
  secretMessage: string,
  expiration: string
): Promise<{
  sealedPayload: SealedPayload;
  senderEphemeralPublicKeyBase64: string;
}> {
  // 1. Generate sender's ephemeral P-256 key pair
  const ephemeralKeyPair = await window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveKey", "deriveBits"]
  );

  // 2. Import recipient's public key (SPKI)
  const recipientPublicKey = await window.crypto.subtle.importKey(
    "spki",
    base64ToArrayBuffer(recipientPublicKeyBase64),
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    []
  );

  // 3. Derive symmetric shared AES key
  const sharedKey = await window.crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: recipientPublicKey,
    },
    ephemeralKeyPair.privateKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt"]
  );

  // 4. Encrypt payload
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const textEncoder = new TextEncoder();
  const encodedPayload = textEncoder.encode(secretMessage);

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    sharedKey,
    encodedPayload
  );

  // Export ephemeral public key so recipient can perform agreement
  const exportedEphemeralPublic = await window.crypto.subtle.exportKey(
    "spki",
    ephemeralKeyPair.publicKey
  );

  const senderEphemeralPublicKeyBase64 = arrayBufferToBase64(exportedEphemeralPublic);

  return {
    sealedPayload: {
      version: "obsidian.v1",
      ciphertext: arrayBufferToBase64(ciphertextBuffer),
      iv: arrayBufferToBase64(iv.buffer),
      senderEphemeralPublicKey: senderEphemeralPublicKeyBase64,
      recipientPublicKey: recipientPublicKeyBase64.trim(),
      expiration,
      createdAt: Date.now(),
    },
    senderEphemeralPublicKeyBase64,
  };
}

/**
 * Decrypts a sealed payload using the recipient's private key and agreement parameters
 */
export async function decryptSecret(
  sealedPayload: SealedPayload,
  recipientPrivateKeyBase64: string
): Promise<string> {
  // 1. Import recipient's private key (PKCS8)
  const recipientPrivateKey = await window.crypto.subtle.importKey(
    "pkcs8",
    base64ToArrayBuffer(recipientPrivateKeyBase64),
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveKey", "deriveBits"]
  );

  // 2. Import sender's ephemeral public key
  const senderPublicKey = await window.crypto.subtle.importKey(
    "spki",
    base64ToArrayBuffer(sealedPayload.senderEphemeralPublicKey),
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    []
  );

  // 3. Reconstruct symmetric key via Diffie-Hellman Key Agreement
  const sharedKey = await window.crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: senderPublicKey,
    },
    recipientPrivateKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["decrypt"]
  );

  // 4. Decrypt ciphertext
  const ivArrayBuffer = base64ToArrayBuffer(sealedPayload.iv);
  const ciphertextArrayBuffer = base64ToArrayBuffer(sealedPayload.ciphertext);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(ivArrayBuffer),
    },
    sharedKey,
    ciphertextArrayBuffer
  );

  // 5. Decode secret message
  const textDecoder = new TextDecoder();
  return textDecoder.decode(decryptedBuffer);
}

/**
 * Packs a sealed payload to Base64 (for easy sharing)
 */
export function serializePayload(payload: SealedPayload): string {
  const jsonStr = JSON.stringify(payload);
  return window.btoa(encodeURIComponent(jsonStr));
}

/**
 * Unpacks a sealed payload from Base64
 */
export function deserializePayload(serialized: string): SealedPayload {
  try {
    const jsonStr = decodeURIComponent(window.atob(serialized.trim()));
    const obj = JSON.parse(jsonStr);
    if (obj.ciphertext && obj.senderEphemeralPublicKey) {
      return obj as SealedPayload;
    }
    throw new Error("Invalid payload schema");
  } catch (e) {
    throw new Error("Undecodable secret payload envelope.");
  }
}
