/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum AppMode {
  GHOST_SHARE = "GHOST_SHARE",
  REVEAL_SECRET = "REVEAL_SECRET"
}

export enum ExecutionStage {
  COMPOSE = "COMPOSE",
  ENCRYPT = "ENCRYPT",
  ATTEST = "ATTEST",
  TRANSMIT = "TRANSMIT",
  RECEIVE = "RECEIVE"
}

export enum ExecutionStatus {
  IDLE = "IDLE",
  PROCESSING = "PROCESSING",
  SUCCESS = "SUCCESS",
  ERROR = "ERROR"
}

export interface EnclaveIdentity {
  publicKeyBase64: string;
  privateKeyBase64: string;
  alias: string;
}

export interface SealedPayload {
  version: string;
  ciphertext: string;
  iv: string;
  senderEphemeralPublicKey: string; // Ephemeral public key
  recipientPublicKey: string;
  expiration: string; // 'burn-on-read' | '5m' | '1h' | '24h'
  createdAt: number;
}

export interface RitualExecutionLog {
  timestamp: string;
  tag: string; // 'enclave' | 'crypto' | 'network' | 'attest' | 'system'
  message: string;
  isHeader?: boolean;
}
