/**
 * OBSIDIAN — Ritual Chain Integration
 */

import { ethers } from 'ethers';
import { encrypt, ECIES_CONFIG } from 'eciesjs';
import { bytesToBase64 } from './crypto';

ECIES_CONFIG.symmetricNonceLength = 12;

export const RITUAL_CHAIN = {
  id:       1979,
  idHex:    '0x7BB',
  name:     'Ritual',
  rpc:      'https://rpc.ritualfoundation.org',
  explorer: 'https://explorer.ritualfoundation.org',
  symbol:   'RITUAL',
  decimals: 18,
} as const;

export const CONTRACTS = {
  HTTP_PRECOMPILE:      '0x0000000000000000000000000000000000000801',
  TEE_SERVICE_REGISTRY: '0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F',
  SECRETS_ACCESS_CTRL:  '0xf9BF1BC8A3e79B9EBeD0fa2Db70D0513fecE32FD',
  RITUAL_WALLET:        '0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948',
} as const;

export const EXPLORER_TX = (hash: string) =>
  `${RITUAL_CHAIN.explorer}/tx/${hash}`;

// ── Safe Uint8Array → hex (fixes eciesjs returning Uint8Array in browser) ──
function u8ToHex(bytes: Uint8Array | Buffer | ArrayBufferLike): string {
  const arr = new Uint8Array(
    bytes instanceof ArrayBuffer ? bytes : (bytes as Uint8Array).buffer
      ? (bytes as Uint8Array)
      : new Uint8Array(Object.values(bytes as any))
  );
  return '0x' + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function ensureBuffer(data: string): Buffer {
  return Buffer.from(data.replace('0x', ''), 'hex');
}

// ── ABIs ─────────────────────────────────────────────────────
const TEE_ABI = [
  'function getServicesByCapability(uint8 capability, bool checkValidity) view returns (tuple(tuple(address paymentAddress, address teeAddress, uint8 teeType, bytes publicKey, string endpoint, bytes32 certPubKeyHash, uint8 capability) node, bool isValid, bytes32 workloadId)[])',
];

const PRECOMPILE_TYPES = [
  'address','bytes[]','uint256','bytes[]','bytes',
  'string','uint8','string[]','string[]','bytes',
  'uint256','uint8','bool',
];

const SPC_OUTPUT_TYPES = ['uint16','string[]','string[]','bytes','string'];

// ── Wallet ────────────────────────────────────────────────────
export function getBrowserProvider(): ethers.BrowserProvider | null {
  if (typeof window === 'undefined' || !(window as any).ethereum) return null;
  return new ethers.BrowserProvider((window as any).ethereum as ethers.Eip1193Provider);
}

export async function connectWallet() {
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
  const eth = (window as any).ethereum;
  if (!eth) throw new Error('MetaMask not found');
  await eth.request({
    method: 'wallet_addEthereumChain',
    params: [{
      chainId:           RITUAL_CHAIN.idHex,
      chainName:         'Ritual',
      nativeCurrency:    { name: 'RITUAL', symbol: 'RITUAL', decimals: 18 },
      rpcUrls:           [RITUAL_CHAIN.rpc],
      blockExplorerUrls: [RITUAL_CHAIN.explorer],
    }],
  });
}

// ── Executor ──────────────────────────────────────────────────
export interface ExecutorInfo {
  address:   string;
  publicKey: string;
  endpoint:  string;
}

export async function fetchActiveExecutor(
  provider: ethers.BrowserProvider | ethers.JsonRpcProvider
): Promise<ExecutorInfo> {
  const reg      = new ethers.Contract(CONTRACTS.TEE_SERVICE_REGISTRY, TEE_ABI, provider);
  const services = await reg.getServicesByCapability(0, true);
  if (!services || services.length === 0)
    throw new Error('No active HTTP executors on Ritual testnet');
  const s = services[0];
  return { address: s.node.teeAddress, publicKey: s.node.publicKey, endpoint: s.node.endpoint };
}

// ── Ephemeral keypair ─────────────────────────────────────────
export interface EphemeralKeypair {
  privateKeyBase64: string;
  publicKeyHex:     string;
}

export async function generateEphemeralKeypair(): Promise<EphemeralKeypair> {
  const { secp256k1 } = await import('@noble/curves/secp256k1');
  const priv = secp256k1.utils.randomPrivateKey();            // Uint8Array 32 bytes
  const pub  = secp256k1.getPublicKey(priv, false);           // Uint8Array 65 bytes uncompressed
  return {
    privateKeyBase64: bytesToBase64(priv),
    publicKeyHex:     '0x' + Array.from(pub).map(b => b.toString(16).padStart(2,'0')).join(''),
  };
}

// ── Main on-chain flow ────────────────────────────────────────
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

  // 2. ECIES encrypt → executor pubkey
  onLog('CRYPTO', 'ECIES ENCRYPTING TO EXECUTOR — 12-BYTE AES-GCM NONCE...');

  // Normalize executor pubkey to 65-byte uncompressed hex
  let pubHex = executor.publicKey.replace('0x', '');
  if (pubHex.length === 128) pubHex = '04' + pubHex;
  if (pubHex.length !== 130)
    throw new Error(`Invalid executor pubkey length: ${pubHex.length} chars (expected 130)`);

  const secretJson = JSON.stringify({ GHOST_MSG: secret });

  // eciesjs encrypt — may return Uint8Array in browser, use u8ToHex to safely convert
  const encSecResult = encrypt(
    Buffer.from(pubHex, 'hex'),
    Buffer.from(secretJson, 'utf8')
  );
  // ✅ safe conversion — fixes "0x4,156,102..." bug
  const encSecHex = u8ToHex(encSecResult);
  onLog('CRYPTO', `ENCRYPTED: ${encSecHex.slice(0, 20)}... [${(encSecHex.length - 2) / 2} bytes]`);

  // 3. Ephemeral keypair for private output
  onLog('CRYPTO', 'GENERATING EPHEMERAL secp256k1 KEYPAIR FOR SEALED OUTPUT...');
  const eph = await generateEphemeralKeypair();
  onLog('CRYPTO', `EPHEMERAL PUBKEY: ${eph.publicKeyHex.slice(0, 20)}...`);

  // 4. EIP-191 sign — pass raw Uint8Array, NOT hex string
  onLog('ATTEST', 'REQUESTING EIP-191 SIGNATURE OVER ENCRYPTED BLOB...');
  onLog('ATTEST', '(CONFIRM IN WALLET)');

  // ✅ convert hex → Uint8Array for signMessage
  const encSecBytes = Uint8Array.from(
    encSecHex.replace('0x', '').match(/.{1,2}/g)!.map(b => parseInt(b, 16))
  );
  const signature = await signer.signMessage(encSecBytes);
  onLog('ATTEST', `SIGNATURE SEALED: ${signature.slice(0, 18)}...`);

  // 5. ABI encode calldata
  onLog('TRANSMIT', 'ABI ENCODING 13-FIELD HTTP PRECOMPILE CALLDATA...');

  const bodyJson = JSON.stringify({
    message:   'GHOST_MSG',
    recipient: recipientLabel || 'anonymous',
    timestamp: Date.now(),
  });

  // userPublicKey: convert publicKeyHex → Uint8Array safely
  const ephPubBytes = Uint8Array.from(
    eph.publicKeyHex.replace('0x', '').match(/.{1,2}/g)!.map(b => parseInt(b, 16))
  );

  const calldata = abiCoder.encode(PRECOMPILE_TYPES, [
    executor.address,
    [encSecHex],
    ttlBlocks,
    [signature],
    ephPubBytes,
    'https://httpbin.org/post',
    2,
    ['Content-Type', 'X-Ghost-Recipient'],
    ['application/json', recipientLabel || '0x0'],
    ethers.toUtf8Bytes(bodyJson),
    0n,
    0,
    false,
  ]);

  onLog('TRANSMIT', `PRECOMPILE: ${CONTRACTS.HTTP_PRECOMPILE}`);
  onLog('TRANSMIT', `CALLDATA: ${calldata.slice(0, 20)}... [${calldata.length / 2} bytes]`);

  // 6. Send tx
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
  onLog('ENCLAVE', 'WAITING FOR TEE EXECUTOR SETTLEMENT...');
  const receipt = await tx.wait(1);
  if (!receipt) throw new Error('No receipt returned');
  if (receipt.status === 0) throw new Error(`Transaction reverted — block ${receipt.blockNumber}`);
  onLog('ENCLAVE', `CONFIRMED: BLOCK ${receipt.blockNumber} · GAS ${receipt.gasUsed.toLocaleString()}`);

  // 8. Parse spcCalls
  onLog('ENCLAVE', 'PARSING EXECUTOR OUTPUT (spcCalls)...');
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
        const bodyBytes  = decoded[3] as Uint8Array;
        encryptedOutput  = '0x' + Array.from(bodyBytes).map(b => b.toString(16).padStart(2,'0')).join('');
        onLog('ENCLAVE', `✓ STATUS: ${code} — OUTPUT SEALED WITH EPHEMERAL PUBKEY`);
        onLog('ENCLAVE', `✓ ENCRYPTED OUTPUT: ${encryptedOutput.slice(0, 20)}...`);
      }
    } else {
      onLog('ENCLAVE', 'spcCalls NOT IN RECEIPT — CHECK EXPLORER FOR EXECUTOR RESPONSE');
    }
  } catch (e: any) {
    onLog('ENCLAVE', `spcCalls WARNING: ${e.message}`);
  }

  onLog('SYSTEM', '✓ GHOST SHARE SEALED ON RITUAL CHAIN');

  return {
    txHash:           tx.hash,
    block:            receipt.blockNumber,
    explorerUrl:      EXPLORER_TX(tx.hash),
    encryptedOutput,
    ephPrivKeyBase64: eph.privateKeyBase64,
    ephPubKeyHex:     eph.publicKeyHex,
  };
}
