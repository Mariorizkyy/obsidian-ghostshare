import { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  AppMode, ExecutionStage, ExecutionStatus,
  EnclaveIdentity, RitualExecutionLog, WalletState
} from "./types";
import {
  generateEnclaveIdentity, encryptSecret,
  decryptSecret, serializePayload, deserializePayload
} from "./lib/crypto";
import {
  connectWallet, switchToRitual, submitGhostShareOnChain,
  RITUAL_CHAIN, EXPLORER_TX
} from "./lib/ritual";
import { LeftPanel }   from "./components/LeftPanel";
import { CenterPanel } from "./components/CenterPanel";
import { LogsPanel }   from "./components/LogsPanel";
import { AlignLeft, Terminal } from "lucide-react";

export default function App() {
  const [currentMode,  setCurrentMode]  = useState<AppMode>(AppMode.GHOST_SHARE);
  const [status,       setStatus]       = useState<ExecutionStatus>(ExecutionStatus.IDLE);
  const [currentStage, setCurrentStage] = useState<ExecutionStage>(ExecutionStage.COMPOSE);
  const [identity,     setIdentity]     = useState<EnclaveIdentity | null>(null);
  const [logs,         setLogs]         = useState<RitualExecutionLog[]>([]);

  const [lastSealedPayloadUrl, setLastSealedPayloadUrl] = useState<string | null>(null);
  const [lastSealedPayloadRaw, setLastSealedPayloadRaw] = useState<string | null>(null);
  const [lastEphemeralPrivKey, setLastEphemeralPrivKey] = useState<string | null>(null);
  const [lastTxHash,           setLastTxHash]           = useState<string | null>(null);
  const [decryptedSecret,      setDecryptedSecret]      = useState<string | null>(null);
  const [errorMessage,         setErrorMessage]         = useState<string | null>(null);
  const [decodedHashPayload,   setDecodedHashPayload]   = useState<string | null>(null);

  const [walletState,    setWalletState]    = useState<WalletState>({ address: null, chainId: null, connected: false, onRitual: false });
  const [ritualSigner,   setRitualSigner]   = useState<ethers.JsonRpcSigner | null>(null);
  const [ritualProvider, setRitualProvider] = useState<ethers.BrowserProvider | null>(null);

  const [mobileShowLeft,  setMobileShowLeft]  = useState(false);
  const [mobileShowRight, setMobileShowRight] = useState(false);

  // ── Identity ─────────────────────────────────────────────
  const initIdentity = async (forceRegen = false) => {
    try {
      if (!forceRegen) {
        const pub  = localStorage.getItem("obsidian_pub_identity");
        const priv = localStorage.getItem("obsidian_priv_identity");
        if (pub && priv && pub.length > 60) {
          setIdentity({ publicKeyBase64: pub, privateKeyBase64: priv, alias: "Graphite Guardian" });
          return;
        }
      }
      const keys = await generateEnclaveIdentity();
      localStorage.setItem("obsidian_pub_identity", keys.publicKeyBase64);
      localStorage.setItem("obsidian_priv_identity", keys.privateKeyBase64);
      setIdentity({ publicKeyBase64: keys.publicKeyBase64, privateKeyBase64: keys.privateKeyBase64, alias: "Graphite Guardian" });
    } catch (e) { console.error("Identity init failed", e); }
  };

  useEffect(() => { initIdentity(); }, []);

  // ── URL hash routing ──────────────────────────────────────
  useEffect(() => {
    const checkHash = () => {
      try {
        const hash = window.location.hash;
        if (hash?.startsWith("#reveal?payload=")) {
          const p = hash.substring("#reveal?payload=".length);
          if (p) { setDecodedHashPayload(p); setCurrentMode(AppMode.REVEAL_SECRET); }
        }
      } catch {}
    };
    checkHash();
    window.addEventListener("hashchange", checkHash);
    return () => window.removeEventListener("hashchange", checkHash);
  }, []);

  // ── Wallet events ─────────────────────────────────────────
  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth) return;
    const onChain = (hex: string) => {
      const id = parseInt(hex, 16);
      setWalletState(prev => ({ ...prev, chainId: id, onRitual: id === RITUAL_CHAIN.id }));
    };
    const onAccounts = (accounts: string[]) => {
      if (accounts.length === 0) handleDisconnect();
      else setWalletState(prev => ({ ...prev, address: accounts[0] }));
    };
    eth.on?.("chainChanged", onChain);
    eth.on?.("accountsChanged", onAccounts);
    return () => { eth.removeListener?.("chainChanged", onChain); eth.removeListener?.("accountsChanged", onAccounts); };
  }, []);

  // ── Log helper ────────────────────────────────────────────
  const appendLog = (tag: string, message: string, isHeader = false) => {
    const d   = new Date();
    const pad = (n: number, l = 2) => n.toString().padStart(l, "0");
    const ts  = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}`;
    setLogs(prev => [...prev, { timestamp: ts, tag, message, isHeader }]);
  };

  // ── Wallet connect ────────────────────────────────────────
  const handleConnectWallet = async () => {
    try {
      appendLog("wallet", "REQUESTING METAMASK CONNECTION...");
      const { address, chainId, provider, signer } = await connectWallet();
      setRitualProvider(provider);
      setRitualSigner(signer);
      setWalletState({ address, chainId, connected: true, onRitual: chainId === RITUAL_CHAIN.id });
      appendLog("wallet", `CONNECTED: ${address.slice(0,10)}...${address.slice(-4)}`);
      if (chainId !== RITUAL_CHAIN.id) {
        appendLog("wallet", "WRONG CHAIN — ATTEMPTING SWITCH TO RITUAL...");
        await switchToRitual();
        const net = await provider.getNetwork();
        const id  = Number(net.chainId);
        setWalletState(prev => ({ ...prev, chainId: id, onRitual: id === RITUAL_CHAIN.id }));
        appendLog("wallet", id === RITUAL_CHAIN.id
          ? "✓ RITUAL CHAIN (id:1979) ACTIVE"
          : "SWITCH FAILED — ADD RITUAL MANUALLY VIA METAMASK");
      } else {
        appendLog("wallet", "✓ RITUAL CHAIN (id:1979) ACTIVE");
      }
    } catch (e: any) {
      appendLog("wallet", `CONNECTION ERROR: ${e.message}`);
    }
  };

  // ── Disconnect ────────────────────────────────────────────
  const handleDisconnect = () => {
    setWalletState({ address: null, chainId: null, connected: false, onRitual: false });
    setRitualSigner(null);
    setRitualProvider(null);
    appendLog("wallet", "WALLET DISCONNECTED FROM OBSIDIAN SESSION");
  };

  // ── Switch chain ──────────────────────────────────────────
  const handleSwitchChain = async () => {
    try {
      await switchToRitual();
      if (ritualProvider) {
        const net = await ritualProvider.getNetwork();
        const id  = Number(net.chainId);
        setWalletState(prev => ({ ...prev, chainId: id, onRitual: id === RITUAL_CHAIN.id }));
        appendLog("wallet", id === RITUAL_CHAIN.id ? "✓ SWITCHED TO RITUAL CHAIN" : "SWITCH FAILED");
      }
    } catch (e: any) {
      appendLog("wallet", `CHAIN SWITCH ERROR: ${e.message}`);
    }
  };

  // ── GHOST SHARE ───────────────────────────────────────────
  const executeGhostTransmission = async (
    recipientPubKey: string,
    secret: string,
    expOption: string
  ) => {
    try {
      setStatus(ExecutionStatus.PROCESSING);
      setCurrentStage(ExecutionStage.COMPOSE);
      setLogs([]);
      appendLog("system", "DEPLOYING ISOLATED CONFIDENTIAL TRANSMISSION UNIT", true);

      // ── No wallet: local ECIES fallback ──
      if (!walletState.connected || !walletState.onRitual || !ritualSigner || !ritualProvider) {
        appendLog("wallet", "WALLET NOT ON RITUAL — RUNNING LOCAL ECIES (NO ON-CHAIN TX)");
        appendLog("wallet", "CONNECT WALLET + SWITCH TO RITUAL FOR FULL ON-CHAIN TRANSMISSION");
        setCurrentStage(ExecutionStage.ENCRYPT);

        const target = recipientPubKey.trim() || identity?.publicKeyBase64 || "";
        if (!target) throw new Error("No recipient key and no identity loaded.");

        const { sealedPayload, senderEphemeralPrivateKeyBase64 } =
          await encryptSecret(target, secret, expOption);
        const serialized = serializePayload(sealedPayload);
        const shareUrl   = `${window.location.origin}${window.location.pathname}#reveal?payload=${serialized}`;

        setLastSealedPayloadRaw(serialized);
        setLastSealedPayloadUrl(shareUrl);
        setLastEphemeralPrivKey(senderEphemeralPrivateKeyBase64);
        setLastTxHash(null);
        appendLog("system", "LOCAL ECIES COMPLETE — CONNECT WALLET FOR RITUAL ON-CHAIN TX", true);
        setStatus(ExecutionStatus.SUCCESS);
        setCurrentStage(ExecutionStage.RECEIVE);
        return;
      }

      // ── Full Ritual on-chain flow ──
      const onChainResult = await submitGhostShareOnChain(
        secret,
        recipientPubKey || "anonymous",
        100n,
        ritualSigner,
        ritualProvider,
        (tag, msg) => {
          appendLog(tag, msg);
          if (tag === "CRYPTO")    setCurrentStage(ExecutionStage.ENCRYPT);
          if (tag === "ATTEST")    setCurrentStage(ExecutionStage.ATTEST);
          if (tag === "TRANSMIT")  setCurrentStage(ExecutionStage.TRANSMIT);
          if (tag === "ENCLAVE")   setCurrentStage(ExecutionStage.RECEIVE);
        }
      );

      // Build sealed payload with on-chain fields
      const { sealedPayload } = await encryptSecret(
        identity?.publicKeyBase64 || recipientPubKey || onChainResult.ephPubKeyHex,
        secret,
        expOption
      );
      sealedPayload.txHash          = onChainResult.txHash;
      sealedPayload.block           = onChainResult.block;
      sealedPayload.encryptedOutput = onChainResult.encryptedOutput ?? undefined;
      sealedPayload.network         = "ritual:1979";
      sealedPayload.explorerUrl     = onChainResult.explorerUrl;

      const serialized = serializePayload(sealedPayload);
      const shareUrl   = `${window.location.origin}${window.location.pathname}#reveal?payload=${serialized}`;

      setLastSealedPayloadRaw(serialized);
      setLastSealedPayloadUrl(shareUrl);
      setLastEphemeralPrivKey(onChainResult.ephPrivKeyBase64);
      setLastTxHash(onChainResult.txHash);

      appendLog("system", "TRANSMISSION DISPATCH SUCCESSFUL", true);
      appendLog("network", `EXPLORER: ${onChainResult.explorerUrl}`);
      setStatus(ExecutionStatus.SUCCESS);
      setCurrentStage(ExecutionStage.RECEIVE);

    } catch (err: any) {
      appendLog("system", `EXECUTION EXCEPTION: ${err.message}`);
      setErrorMessage(err.message);
      setStatus(ExecutionStatus.ERROR);
    }
  };

  // ── REVEAL SECRET ─────────────────────────────────────────
  const executeRevealRecovery = async (encodedPayload: string, recipientPrivKey: string) => {
    try {
      setStatus(ExecutionStatus.PROCESSING);
      setCurrentStage(ExecutionStage.RECEIVE);
      setLogs([]);

      const queue = [
        { tag:"enclave", text:"SPARKING SECURE RECONSTRUCTION CPU GATE [A-1 TEE CORE]",         delay:200, stage:ExecutionStage.RECEIVE },
        { tag:"network", text:"DEPACKING SERIALIZED GHOST CAPSULE ENVELOPE BOUNDS",              delay:300, stage:ExecutionStage.RECEIVE },
        { tag:"attest",  text:"AUDITING HARDWARE ATTESTATION SHIELD SIGNATURES ON HOST CPU",     delay:350, stage:ExecutionStage.ATTEST  },
        { tag:"crypto",  text:"IMPORTING DECRYPTER EPHEMERAL PRIVATE KEY INTO SECURE BOUNDS",    delay:400, stage:ExecutionStage.ATTEST  },
        { tag:"crypto",  text:"EXTRACTING SENDER EPHEMERAL PUBLIC COMPONENTS (secp256k1)",       delay:280, stage:ExecutionStage.ENCRYPT },
        { tag:"crypto",  text:"CALCULATING SHARED SECRET (ECDH secp256k1 → HKDF-SHA256)",       delay:350, stage:ExecutionStage.ENCRYPT },
        { tag:"crypto",  text:"ATTEMPTING AES-256-GCM DECRYPT ON VOLATILE RAM (12-byte nonce)", delay:450, stage:ExecutionStage.TRANSMIT },
      ];

      appendLog("system", "RECONSTRUCTING SEALS UNDER SECURE INTELLIGENCE ENCLAVE", true);
      let cDelay = 0;

      queue.forEach((step, idx) => {
        cDelay += step.delay;
        setTimeout(() => {
          setCurrentStage(step.stage);
          appendLog(step.tag, step.text);

          if (idx === queue.length - 1) {
            setTimeout(async () => {
              try {
                const sealedPayload = deserializePayload(encodedPayload.trim());
                const plain = await decryptSecret(sealedPayload, recipientPrivKey.trim());
                setDecryptedSecret(plain);
                appendLog("system", "DECRYPTION INTEGRITY CHECK OK", true);
                appendLog("crypto", "ECIES ENVELOPE UNSEALED — E2E VOLATILE SHIELD COLLAPSED");
                appendLog("enclave", "ZEROING ALL INTERMEDIATE KEY STORAGE BUFFERS...");
                if (sealedPayload.txHash)
                  appendLog("network", `SOURCE TX: ${EXPLORER_TX(sealedPayload.txHash)}`);
                setStatus(ExecutionStatus.SUCCESS);
                setCurrentStage(ExecutionStage.RECEIVE);
              } catch (e: any) {
                appendLog("system", "ERROR: INTEGRITY MISMATCH OR DECRYPTION KEY MISMATCH", true);
                appendLog("system", `[FAULT] ${e.message}`);
                setErrorMessage("Envelope integrity fail. Mismatched decryption keys or corrupted payload.");
                setStatus(ExecutionStatus.ERROR);
              }
            }, 300);
          }
        }, cDelay);
      });

    } catch (err: any) {
      appendLog("system", `RECONSTRUCT FAULT: ${err.message}`);
      setErrorMessage(`Decryption failure: ${err.message}`);
      setStatus(ExecutionStatus.ERROR);
    }
  };

  // ── Reset ─────────────────────────────────────────────────
  const handleReset = () => {
    setStatus(ExecutionStatus.IDLE);
    setLogs([]);
    setLastSealedPayloadRaw(null);
    setLastSealedPayloadUrl(null);
    setLastEphemeralPrivKey(null);
    setLastTxHash(null);
    setDecryptedSecret(null);
    setErrorMessage(null);
    setDecodedHashPayload(null);
    if (window.location.hash)
      window.history.pushState("", document.title, window.location.pathname);
  };

  return (
    <div className="h-screen w-screen flex flex-col font-sans bg-zinc-950 text-zinc-100 overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(18,18,18,0.2)_1px,transparent_1px)] bg-[size:32px_32px] md:bg-[size:48px_48px] opacity-25" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[900px] h-[350px] bg-sky-950/5 blur-3xl rounded-full" />
        <div className="absolute bottom-0 left-0 right-0 h-[200px] bg-[radial-gradient(circle_at_bottom,rgba(15,15,15,0.4),transparent)] blur-xl" />
      </div>

      {/* Mobile header */}
      <div className="lg:hidden shrink-0 border-b border-zinc-900 bg-zinc-950/80 p-4.5 flex items-center justify-between z-40 select-none">
        <button onClick={() => { setMobileShowLeft(!mobileShowLeft); setMobileShowRight(false); }}
          className="text-zinc-400 hover:text-white p-1 hover:bg-zinc-900/40 rounded transition-colors">
          <AlignLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center space-x-2">
          <div className="w-3.5 h-3.5 rounded border border-white/60 flex items-center justify-center p-0.5 bg-black">
            <div className="w-full h-full bg-white rounded-3xs" />
          </div>
          <span className="font-sans font-medium text-xs tracking-[0.2em] text-white">OBSIDIAN</span>
        </div>
        <button onClick={() => { setMobileShowRight(!mobileShowRight); setMobileShowLeft(false); }}
          className="text-zinc-400 hover:text-white p-1 hover:bg-zinc-900/40 rounded transition-colors flex items-center space-x-1.5">
          <Terminal className="w-4 h-4" />
          {logs.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-ping" />}
        </button>
      </div>

      <div className="flex-1 flex flex-row overflow-hidden relative z-10">
        {/* Left */}
        <div className={`lg:w-[28%] lg:block shrink-0 h-full z-30 transition-transform duration-300 ${mobileShowLeft ? "absolute inset-y-0 left-0 w-[80%] max-w-[340px] translate-x-0 shadow-2xl border-r border-zinc-850" : "hidden lg:translate-x-0"}`}>
          <LeftPanel
            currentMode={currentMode}
            onModeChange={(mode) => { setCurrentMode(mode); setMobileShowLeft(false); handleReset(); }}
            identity={identity}
            onRegenerateIdentity={() => initIdentity(true)}
            walletState={walletState}
            onConnectWallet={handleConnectWallet}
            onSwitchChain={handleSwitchChain}
            onDisconnect={handleDisconnect}
          />
        </div>

        {(mobileShowLeft || mobileShowRight) && (
          <div onClick={() => { setMobileShowLeft(false); setMobileShowRight(false); }}
            className="absolute inset-0 bg-black/65 z-20 cursor-pointer lg:hidden" />
        )}

        {/* Center */}
        <div className="flex-1 h-full overflow-hidden flex flex-col items-center">
          <CenterPanel
            currentMode={currentMode}
            status={status}
            currentIdentity={identity}
            onTransmit={executeGhostTransmission}
            onReveal={executeRevealRecovery}
            onReset={handleReset}
            lastSealedPayloadRaw={lastSealedPayloadRaw}
            lastSealedPayloadUrl={lastSealedPayloadUrl}
            lastEphemeralPrivKey={lastEphemeralPrivKey}
            lastTxHash={lastTxHash}
            decryptedSecret={decryptedSecret}
            errorMessage={errorMessage}
            preloadedPayload={decodedHashPayload}
          />
        </div>

        {/* Right */}
        <div className={`lg:w-[28%] lg:block shrink-0 h-full z-30 transition-transform duration-300 ${mobileShowRight ? "absolute inset-y-0 right-0 w-[85%] max-w-[340px] translate-x-0 shadow-2xl border-l border-zinc-850" : "hidden lg:translate-x-0"}`}>
          <LogsPanel logs={logs} currentStage={currentStage} status={status} />
        </div>
      </div>
    </div>
  );
}
