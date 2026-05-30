/**
 * OBSIDIAN — Ritual Chain Integration
 * Full on-chain Ghost Share via HTTP Precompile
 */

import { ethers } from 'ethers';
import { encrypt, ECIES_CONFIG } from 'eciesjs';
import { bytesToBase64, base64ToBytes } from './crypto';

ECIES_CONFIG.symmetricNonceLength = 12;

// ── Chain constants ───────────────────────────────────────────
export const RITUAL_CHAIN = {
  id:         1979,
  idHex:      '0x7BB',
  name:       'Ritual',
  rpc:        'https://rpc.ritualfoundation.org',
  explorer:   'https://explorer.ritualfoundation.org',
  symbol:     'RITUAL',
  decimals:   18,
} as const;

export const CONTRACTS = {
  HTTP_PRECOMPILE:      '0x0000000000000000000000000000000000000801',
  TEE_SERVICE_REGISTRY: '0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F',
  SECRETS_ACCESS_CTRL:  '0xf9BF1BC8A3e79B9EBeD0fa2Db70D0513fecE32FD',
  RITUAL_WALLET:        '0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948',
} as const;

export const EXPLORER_TX = (hash: string) =>
  `${RITUAL_CHAIN.explorer}/tx/${hash}`;

// ── ABIs ──────────────────────────────────────────────────────
const TEE_ABI = [
  'function getServicesByCapability(uint8 capability, bool checkValidity) view returns (tuple(tuple(address paymentAddress, address teeAddress, uint8 teeType, bytes publicKey, string endpoint, bytes32 certPubKeyHash, uint8 capability) node, bool isValid, bytes32 workloadId)[])',
];

// 13-field HTTP precompile ABI (full Ritual format)
const PRECOMPILE_TYPES = [
  'address',   // executor
  'bytes[]',   // encryptedSecrets
  'uint256',   // ttl
  'bytes[]',   // signatures
  'bytes',     // userPublicKey (output encrypted here)
  'string',    // url
  'uint8',     // method (0=GET,2=POST)
  'string[]',  // headerKeys
  'string[]',  // headerValues
  'bytes',     // body (template substitution applied in TEE)
  'uint256',   // dkmsKeyIndex
  'uint8',     // dkmsKeyFormat
  'bool',      // piiEnabled
];

const SPC_OUTPUT_TYPES = [
  'uint16',    // status code
  'string[]',  // header keys
  'string[]',  // header values
  'bytes',     // body (encrypted if userPublicKey set)
  'string',    // error message
];

// ── Wallet helpers ────────────────────────────────────────────
export function getBrowserProvider(): ethers.BrowserProvider | null {
  if (typeof window === 'undefined' || !window.ethereum) return null;
  return new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
}

export async function connectWallet(): Promise<{
  address:  string;
  chainId:  number;
  provider: ethers.BrowserProvider;
  signer:   ethers.JsonRpcSigner;
}> {
  const provider = getBrowserProvider();
  if (!provider) throw new Error('MetaMask not found. Install MetaMask to continue.');

  await provider.send('eth_requestAccounts', []);
  const signer  = await provider.getSigner();
  const address = await signer.getAddress();
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);

  return { address, chainId, provider, signer };
}

export async function switchToRitual(): Promise<void> {
  if (!window.ethereum) throw new Error('MetaMask not found');
  await window.ethereum.request({
    method: 'wallet_addEthereumChain',
    params: [{
      chainId:         RITUAL_CHAIN.idHex,
      chainName:       'Ritual',
      nativeCurrency:  { name: 'RITUAL', symbol: 'RITUAL', decimals: 18 },
      rpcUrls:         [RITUAL_CHAIN.rpc],
      blockExplorerUrls: [RITUAL_CHAIN.explorer],
    }],
  });
}

// ── Executor ──────────────────────────────────────────────────
export interface ExecutorInfo {
  address:   string;
  publicKey: string; // hex
  endpoint:  string;
}

export async function fetchActiveExecutor(
  provider: ethers.BrowserProvider | ethers.JsonRpcProvider
): Promise<ExecutorInfo> {
  const registry  = new ethers.Contract(CONTRACTS.TEE_SERVICE_REGISTRY, TEE_ABI, provider);
  const services  = await registry.getServicesByCapability(0, true);
  if (!services || services.length === 0)
    throw new Error('No active HTTP executors on Ritual testnet');
  const s = services[0];
  return {
    address:   s.node.teeAddress,
    publicKey: s.node.publicKey,   // hex bytes
    endpoint:  s.node.endpoint,
  };
}

// ── Ephemeral keypair for private output ──────────────────────
export interface EphemeralKeypair {
  privateKeyBase64: string;
  publicKeyHex:     string;  // 0x04... 65 bytes
}

export async function generateEphemeralKeypair(): Promise<EphemeralKeypair> {
  const { secp256k1 } = await import('@noble/curves/secp256k1');
  const priv    = secp256k1.utils.randomPrivateKey();
  const pub     = secp256k1.getPublicKey(priv, false); // uncompressed 65 bytes
  return {
    privateKeyBase64: bytesToBase64(priv),
    publicKeyHex:     '0x' + Array.from(pub).map(b => b.toString(16).padStart(2,'0')).join(''),
  };
}

// ── Main: submit Ghost Share on-chain ─────────────────────────
export interface GhostShareOnChainResult {
  txHash:           string;
  block:            number;
  explorerUrl:      string;
  encryptedOutput:  string | null;
  ephPrivKeyBase64: string;
  ephPubKeyHex:     string;
}

export async function submitGhostShareOnChain(
  secret: string,
  recipientLabel: string,
  ttlBlocks: bigint,
  signer: ethers.JsonRpcSigner,
  provider: ethers.BrowserProvider,
  onLog: (tag: string, msg: string) => void
): Promise<GhostShareOnChainResult> {

  const abiCoder = new ethers.AbiCoder();

  // 1. Fetch executor
  onLog('REGISTRY', 'QUERYING TEEServiceRegistry FOR ACTIVE HTTP EXECUTOR...');
  const executor = await fetchActiveExecutor(provider);
  onLog('REGISTRY', `EXECUTOR BOUND: ${executor.address}`);
  onLog('REGISTRY', `PUBKEY: ${executor.publicKey.slice(0, 18)}...`);

  // 2. ECIES encrypt secret payload → executor pubkey
  onLog('CRYPTO', 'ECIES ENCRYPTING TO EXECUTOR — 12-BYTE AES-GCM NONCE (RITUAL STANDARD)');
  let pubHex = executor.publicKey.replace('0x', '');
  if (pubHex.length === 128) pubHex = '04' + pubHex;
  const secretJson   = JSON.stringify({ GHOST_MSG: secret });
  const encSecBuf    = encrypt(Buffer.from(pubHex, 'hex'), Buffer.from(secretJson));
  const encSecHex    = '0x' + encSecBuf.toString('hex');
  onLog('CRYPTO', `ENCRYPTED BLOB: ${encSecHex.slice(0, 20)}... [${encSecBuf.length} bytes]`);

  // 3. Generate ephemeral keypair (userPublicKey → executor seals output here)
  onLog('CRYPTO', 'GENERATING EPHEMERAL secp256k1 KEYPAIR FOR SEALED OUTPUT...');
  const eph = await generateEphemeralKeypair();
  onLog('CRYPTO', `EPHEMERAL PUBKEY: ${eph.publicKeyHex.slice(0, 20)}...`);

  // 4. EIP-191 sign encrypted blob
  onLog('ATTEST', 'REQUESTING EIP-191 SIGNATURE OVER ENCRYPTED BLOB...');
  onLog('ATTEST', '(CONFIRM IN WALLET)');
  const encSecBytes = ethers.getBytes(encSecHex);
  const signature   = await signer.signMessage(encSecBytes);
  onLog('ATTEST', `SIGNATURE SEALED: ${signature.slice(0, 18)}...`);

  // 5. ABI encode 13-field calldata
  onLog('TRANSMIT', 'ABI ENCODING 13-FIELD HTTP PRECOMPILE CALLDATA...');
  const bodyJson  = JSON.stringify({
    message:   'GHOST_MSG',    // ← substituted by executor inside TEE
    recipient: recipientLabel || 'anonymous',
    timestamp: Date.now(),
  });
  const calldata = abiCoder.encode(PRECOMPILE_TYPES, [
    executor.address,
    [encSecHex],
    ttlBlocks,
    [signature],
    ethers.getBytes(eph.publicKeyHex),
    'https://httpbin.org/post',
    2,                          // POST
    ['Content-Type', 'X-Ghost-Recipient'],
    ['application/json', recipientLabel || '0x0'],
    ethers.toUtf8Bytes(bodyJson),
    0n,
    0,
    false,
  ]);
  onLog('TRANSMIT', `PRECOMPILE TARGET: ${CONTRACTS.HTTP_PRECOMPILE}`);
  onLog('TRANSMIT', `CALLDATA: ${calldata.slice(0, 20)}... [${calldata.length / 2} bytes]`);

  // 6. Send tx to Ritual Chain
  onLog('TRANSMIT', 'DISPATCHING TRANSACTION TO RITUAL CHAIN...');
  onLog('TRANSMIT', '(CONFIRM IN WALLET)');
  const tx = await signer.sendTransaction({
    to:       CONTRACTS.HTTP_PRECOMPILE,
    data:     calldata,
    gasLimit: 3_000_000n,
  });
  onLog('TRANSMIT', `TX HASH: ${tx.hash}`);
  onLog('TRANSMIT', `EXPLORER: ${EXPLORER_TX(tx.hash)}`);

  // 7. Wait for receipt
  onLog('ENCLAVE', 'WAITING FOR TEE EXECUTOR SETTLEMENT ON-CHAIN...');
  const receipt = await tx.wait(1);
  if (!receipt) throw new Error('Transaction receipt not found');
  if (receipt.status === 0) throw new Error(`Transaction reverted in block ${receipt.blockNumber}`);
  onLog('ENCLAVE', `CONFIRMED: BLOCK ${receipt.blockNumber} · GAS ${receipt.gasUsed.toLocaleString()}`);

  // 8. Parse spcCalls from raw receipt (Ritual custom field)
  onLog('ENCLAVE', 'PARSING EXECUTOR OUTPUT FROM spcCalls...');
  let encryptedOutput: string | null = null;

  try {
    const raw      = await provider.send('eth_getTransactionReceipt', [tx.hash]);
    const spcCalls = (raw as any)?.spcCalls;

    if (Array.isArray(spcCalls) && spcCalls.length > 0) {
      const decoded = abiCoder.decode(SPC_OUTPUT_TYPES, spcCalls[0].output);
      const code    = Number(decoded[0]);
      const errMsg  = String(decoded[4] ?? '');

      if (errMsg.length > 0) {
        onLog('ENCLAVE', `EXECUTOR ERROR: ${errMsg}`);
      } else if (code >= 400) {
        onLog('ENCLAVE', `HTTP ${code} FROM EXECUTOR`);
      } else {
        const bodyBytes   = decoded[3] as Uint8Array;
        encryptedOutput   = '0x' + Array.from(bodyBytes).map(b => b.toString(16).padStart(2,'0')).join('');
        onLog('ENCLAVE', `✓ EXECUTOR STATUS: ${code}`);
        onLog('ENCLAVE', `✓ OUTPUT SEALED WITH EPHEMERAL PUBKEY`);
        onLog('ENCLAVE', `✓ ENCRYPTED OUTPUT: ${encryptedOutput.slice(0, 20)}...`);
      }
    } else {
      onLog('ENCLAVE', 'spcCalls NOT EXPOSED BY NODE — TX CONFIRMED ON-CHAIN');
      onLog('ENCLAVE', 'CHECK EXPLORER FOR FULL EXECUTOR RESPONSE');
    }
  } catch (e: any) {
    onLog('ENCLAVE', `spcCalls PARSE WARNING: ${e.message}`);
  }

  onLog('SYSTEM', '✓ GHOST SHARE SEALED ON RITUAL CHAIN');

  return {
    txHash:          tx.hash,
    block:           receipt.blockNumber,
    explorerUrl:     EXPLORER_TX(tx.hash),
    encryptedOutput,
    ephPrivKeyBase64: eph.privateKeyBase64,
    ephPubKeyHex:     eph.publicKeyHex,
  };
}
