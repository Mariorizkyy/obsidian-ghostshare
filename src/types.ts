export enum AppMode {
  GHOST_SHARE    = "GHOST_SHARE",
  REVEAL_SECRET  = "REVEAL_SECRET"
}

export enum ExecutionStage {
  COMPOSE  = "COMPOSE",
  ENCRYPT  = "ENCRYPT",
  ATTEST   = "ATTEST",
  TRANSMIT = "TRANSMIT",
  RECEIVE  = "RECEIVE"
}

export enum ExecutionStatus {
  IDLE       = "IDLE",
  PROCESSING = "PROCESSING",
  SUCCESS    = "SUCCESS",
  ERROR      = "ERROR"
}

export interface EnclaveIdentity {
  publicKeyBase64:  string; // secp256k1 uncompressed pubkey, base64
  privateKeyBase64: string; // secp256k1 privkey, base64
  alias:            string;
}

export interface SealedPayload {
  version:                   string;
  ciphertext:                string;   // AES-GCM ciphertext+tag, base64
  iv:                        string;   // 12-byte IV, base64
  senderEphemeralPublicKey:  string;   // secp256k1 ephemeral pubkey, base64
  recipientPublicKey:        string;
  expiration:                string;
  createdAt:                 number;
  // ── Ritual on-chain fields ───────────────────────
  txHash?:           string;
  block?:            number;
  encryptedOutput?:  string; // hex — from spcCalls, decryptable with ephPrivKey
  network?:          string; // "ritual:1979"
  explorerUrl?:      string;
}

export interface RitualExecutionLog {
  timestamp:  string;
  tag:        string;
  message:    string;
  isHeader?:  boolean;
}

// Wallet state
export interface WalletState {
  address:   string | null;
  chainId:   number | null;
  connected: boolean;
  onRitual:  boolean;
}
