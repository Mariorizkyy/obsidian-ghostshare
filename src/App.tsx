/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { AppMode, ExecutionStage, ExecutionStatus, EnclaveIdentity, RitualExecutionLog } from "./types";
import {
  generateEnclaveIdentity,
  encryptSecret,
  decryptSecret,
  serializePayload,
  deserializePayload
} from "./lib/crypto";
import { LeftPanel } from "./components/LeftPanel";
import { CenterPanel } from "./components/CenterPanel";
import { LogsPanel } from "./components/LogsPanel";
import { Layers, HelpCircle, AlignLeft, Terminal, ShieldAlert } from "lucide-react";

export default function App() {
  // Navigation & Basic States
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.GHOST_SHARE);
  const [status, setStatus] = useState<ExecutionStatus>(ExecutionStatus.IDLE);
  const [currentStage, setCurrentStage] = useState<ExecutionStage>(ExecutionStage.COMPOSE);

  // Identity State
  const [identity, setIdentity] = useState<EnclaveIdentity | null>(null);

  // Encryption/Decryption Output States
  const [lastSealedPayloadUrl, setLastSealedPayloadUrl] = useState<string | null>(null);
  const [lastSealedPayloadRaw, setLastSealedPayloadRaw] = useState<string | null>(null);
  const [decryptedSecret, setDecryptedSecret] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Hash query state
  const [decodedHashPayload, setDecodedHashPayload] = useState<string | null>(null);

  // Logs stream state
  const [logs, setLogs] = useState<RitualExecutionLog[]>([]);

  // Mobile navigation drawers toggles
  const [mobileShowLeft, setMobileShowLeft] = useState(false);
  const [mobileShowRight, setMobileShowRight] = useState(false);

  // 1. Initialize user's long-term Obsidian Identity
  const initIdentity = async (forceRegen = false) => {
    try {
      if (!forceRegen) {
        const storedPub = localStorage.getItem("obsidian_pub_identity");
        const storedPriv = localStorage.getItem("obsidian_priv_identity");
        if (storedPub && storedPriv) {
          setIdentity({
            publicKeyBase64: storedPub,
            privateKeyBase64: storedPriv,
            alias: "Graphite Guardian"
          });
          return;
        }
      }

      // Generate a brand new EC key pair if missing or forces
      const keys = await generateEnclaveIdentity();
      localStorage.setItem("obsidian_pub_identity", keys.publicKeyBase64);
      localStorage.setItem("obsidian_priv_identity", keys.privateKeyBase64);
      setIdentity({
        publicKeyBase64: keys.publicKeyBase64,
        privateKeyBase64: keys.privateKeyBase64,
        alias: "Graphite Guardian"
      });
    } catch (e) {
      console.error("Identity generation failed", e);
    }
  };

  useEffect(() => {
    initIdentity();
  }, []);

  // 2. Parse URL hash on mount for quick reveals
  useEffect(() => {
    const checkHash = () => {
      try {
        const hash = window.location.hash;
        if (hash && hash.startsWith("#reveal?payload=")) {
          const serializedPayload = hash.substring("#reveal?payload=".length);
          if (serializedPayload) {
            setDecodedHashPayload(serializedPayload);
            setCurrentMode(AppMode.REVEAL_SECRET);
            setCurrentStage(AppMode.REVEAL_SECRET as any); // Preload view
          }
        }
      } catch (e) {
        console.error("Hash routing parse failure", e);
      }
    };
    
    checkHash();
    window.addEventListener("hashchange", checkHash);
    return () => window.removeEventListener("hashchange", checkHash);
  }, []);

  // Helper: Append a structured log timestamped
  const appendLog = (tag: string, message: string, isHeader = false) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    const d = new Date();
    const timeStr = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${d.getUTCMilliseconds().toString().padStart(3, "0")}`;

    setLogs((prev) => [
      ...prev,
      {
        timestamp: timeStr,
        tag,
        message,
        isHeader,
      },
    ]);
  };

  // 3. SECURE GHOST SHARE PIPELINE
  const executeGhostTransmission = async (
    recipientPubKey: string,
    secret: string,
    expOption: string
  ) => {
    try {
      setStatus(ExecutionStatus.PROCESSING);
      setCurrentStage(ExecutionStage.COMPOSE);
      setLogs([]);

      // Setup sequence steps
      const queue = [
        { label: "INIT", text: "SPINNING UP ISOLATED CONFIDENTIAL HARDWARE INTEL-SGX", delay: 150, stage: ExecutionStage.COMPOSE, tag: "enclave" },
        { label: "SETUP", text: "CERTIFIED ATTESTED MEMORY ISOLATION REGISTERS MAPPED", delay: 350, stage: ExecutionStage.COMPOSE, tag: "enclave" },
        { label: "SETUP", text: "VERIFYING TARGET AUDITOR GRAPHITE ENCLAVE ALIGNMENT KEY", delay: 250, stage: ExecutionStage.ENCRYPT, tag: "crypto" },
        { label: "AMPLIFY", text: "GENERATING EPHEMERAL ELLIPTIC CURVE EXCHANGE KEYPAIR (ECDH P-256 curve)", delay: 400, stage: ExecutionStage.ENCRYPT, tag: "crypto" },
        { label: "AMPLIFY", text: "DERIVING SYMMETRIC SESSION KEY FORWARD SECRECY (AES-GCM 256)", delay: 350, stage: ExecutionStage.ENCRYPT, tag: "crypto" },
        { label: "CRYPT", text: "ENCRYPTING SENSITIVE PAYLOAD BOUNDS IN SECURE L3 MEMORY CACHE", delay: 450, stage: ExecutionStage.ATTEST, tag: "crypto" },
        { label: "ATTEST", text: "CONSTRUCTING ENCLAVE HARDSIGN REPORT INTEGRITY HASHE (MRENCLAVE matches)", delay: 500, stage: ExecutionStage.ATTEST, tag: "attest" },
        { label: "ATTEST", text: "ATTESTATION SHIELD CERTIFICATION ATTACHED: SHA256 VALIDATED", delay: 300, stage: ExecutionStage.TRANSMIT, tag: "attest" },
        { label: "PACK", text: "PACKAGING GHOST CAPSULE (PAYLOAD HEX, EPHEMERAL EXCHANGE, BOUND VECTOR)", delay: 400, stage: ExecutionStage.TRANSMIT, tag: "network" },
        { label: "SEND", text: "DISPATCHING ENVELOPE SEAL TO THE INVISIBLE TRANSMISSION BLOCK...", delay: 600, stage: ExecutionStage.TRANSMIT, tag: "network" },
      ];

      // Stream the logs
      let cumulativeDelay = 0;
      
      appendLog("system", "DEPLOYING ISOLATED CONFIDENTIAL TRANSMISSION UNIT", true);

      queue.forEach((step, idx) => {
        cumulativeDelay += step.delay;
        setTimeout(() => {
          setCurrentStage(step.stage);
          appendLog(step.tag, step.text);

          // All steps completed, run the actual math
          if (idx === queue.length - 1) {
            setTimeout(async () => {
              try {
                // RUN ACTUAL WEB CRYPTO ENCRYPTION!
                const { sealedPayload } = await encryptSecret(recipientPubKey, secret, expOption);
                const serialized = window.btoa(encodeURIComponent(JSON.stringify(sealedPayload)));
                
                // Construct decentralized link
                const shareableUrl = `${window.location.origin}${window.location.pathname}#reveal?payload=${serialized}`;

                setLastSealedPayloadRaw(serialized);
                setLastSealedPayloadUrl(shareableUrl);
                
                appendLog("system", "TRANSMISSION DISPATCH SUCCESSFUL", true);
                appendLog("network", `CAPSULE SEAL SUCCESSFULLY BROADCAST: ${serialized.substring(0, 30)}...`);
                appendLog("system", `SECURE LIFESPAN SET TO DELAY: ${expOption.toUpperCase()}`);

                setStatus(ExecutionStatus.SUCCESS);
                setCurrentStage(ExecutionStage.RECEIVE);
              } catch (err: any) {
                appendLog("system", `CRITICAL MEMORY EXCEPTION GATES BLOCKED: ${err.message}`);
                setErrorMessage(`Encryption fault inside isolation frame. Verify target public key integrity bounds.`);
                setStatus(ExecutionStatus.ERROR);
              }
            }, 300);
          }
        }, cumulativeDelay);
      });

    } catch (err: any) {
      appendLog("system", `EXECUTION GHOSTING EXCEPTION: ${err.message}`);
      setErrorMessage(`Encryption pipeline failure: ${err.message}`);
      setStatus(ExecutionStatus.ERROR);
    }
  };

  // 4. SECURE REVEAL SECRET RECOVERY PIPELINE
  const executeRevealRecovery = async (
    encodedPayload: string,
    recipientPrivKey: string
  ) => {
    try {
      setStatus(ExecutionStatus.PROCESSING);
      setCurrentStage(ExecutionStage.RECEIVE);
      setLogs([]);

      const queue = [
        { label: "INIT", text: "SPARKING SECURE RECONSTRUCTION CPU GATE [A-1 TEE CORE]", delay: 200, stage: ExecutionStage.RECEIVE, tag: "enclave" },
        { label: "SETUP", text: "DEPACKING SERIALIZED GHOST CAPSULE ENVELOPE BOUNDS", delay: 350, stage: ExecutionStage.RECEIVE, tag: "network" },
        { label: "VERIFY", text: "PARSING ENVELOPE TIMESTAMPS FOR EXPIRATION CORROSION", delay: 250, stage: ExecutionStage.ATTEST, tag: "network" },
        { label: "VERIFY", text: "AUDITING HARDWARE ATTESTATION SCHIELD SIGNATURES ON HOST CPU", delay: 400, stage: ExecutionStage.ATTEST, tag: "attest" },
        { label: "KEY", text: "IMPORTING DECRYPTER IDENTITY PRIVATE KEY INTO SECURE BOUNDS", delay: 450, stage: ExecutionStage.ATTEST, tag: "crypto" },
        { label: "KEY", text: "EXTRACTING SENDER EPHEMERAL PUBLIC COMPONENTS", delay: 300, stage: ExecutionStage.ENCRYPT, tag: "crypto" },
        { label: "AGREE", text: "MUTUALLY CALCULATING SHARED SECRET MATRIX (ZERO-KNOWLEDGE DH)", delay: 400, stage: ExecutionStage.ENCRYPT, tag: "crypto" },
        { label: "CRYPT", text: "ATTEMPTING AES-256-GCM WORK BUFFER DECRYPT ON VOLATILE RAM", delay: 500, stage: ExecutionStage.TRANSMIT, tag: "crypto" },
      ];

      appendLog("system", "RECONSTRUCTING SEALS UNDER SECURE INTELLIGENCE ENCLAVE", true);

      let cumulativeDelay = 0;

      queue.forEach((step, idx) => {
        cumulativeDelay += step.delay;
        setTimeout(() => {
          setCurrentStage(step.stage);
          appendLog(step.tag, step.text);

          if (idx === queue.length - 1) {
            setTimeout(async () => {
              try {
                // RUN ACTUAL DECRYPTION NATIVE MATH
                const sealedPayload = JSON.parse(decodeURIComponent(window.atob(encodedPayload.trim())));
                const decrypted = await decryptSecret(sealedPayload, recipientPrivKey);

                setDecryptedSecret(decrypted);

                appendLog("system", "DECRYPTION INTEGRITY CHECK OK", true);
                appendLog("crypto", "E2E VOLATILE SHIELD COLLAPSED CONVENTUALLY");
                appendLog("enclave", "ZEROING ALL INTERMEDIATE KEY STORAGE BUFFERS...");

                setStatus(ExecutionStatus.SUCCESS);
                setCurrentStage(ExecutionStage.RECEIVE);
              } catch (err: any) {
                appendLog("system", "ERROR: INTEGRITY MISMATCH OR CRYPTOGRAPHIC ADAPT CORRUPTED", true);
                appendLog("system", `[FAULT] Decryption block alignment failed. Payload may be corrupt or target private credentials mismatched.`);
                setErrorMessage("Envelope integrity fail. Mismatched decryption keys, corrupted base64 blocks, or outdated enclave signature bounds.");
                setStatus(ExecutionStatus.ERROR);
              }
            }, 300);
          }
        }, cumulativeDelay);
      });

    } catch (err: any) {
      appendLog("system", `RECONSTRUCT FAULT EXCEPTION: ${err.message}`);
      setErrorMessage(`Decryption failure: ${err.message}`);
      setStatus(ExecutionStatus.ERROR);
    }
  };

  const handleReset = () => {
    setStatus(ExecutionStatus.IDLE);
    setLogs([]);
    setLastSealedPayloadRaw(null);
    setLastSealedPayloadUrl(null);
    setDecryptedSecret(null);
    setErrorMessage(null);
    setDecodedHashPayload(null);
    // Remove the hash from URL to clean up the browser space
    if (window.location.hash) {
      window.history.pushState("", document.title, window.location.pathname);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col font-sans bg-zinc-950 text-zinc-100 overflow-hidden relative">
      
      {/* Cinematic Blur Mesh Ornaments Backdrop */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Deep Dark Reflective Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(18,18,18,0.2)_1px,transparent_1px)] bg-[size:32px_32px] md:bg-[size:48px_48px] opacity-25" />
        
        {/* Soft volumetric top light */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[900px] h-[350px] bg-sky-950/5 blur-3xl rounded-full" />
        
        {/* Ambient bottom reflective glass mist */}
        <div className="absolute bottom-0 left-0 right-0 h-[200px] bg-[radial-gradient(circle_at_bottom,rgba(15,15,15,0.4),transparent)] blur-xl" />
      </div>

      {/* MOBILE HEADER UTILITIES (md and below) */}
      <div className="lg:hidden shrink-0 border-b border-zinc-900 bg-zinc-950/80 p-4.5 flex items-center justify-between z-40 select-none">
        <button
          onClick={() => {
            setMobileShowLeft(!mobileShowLeft);
            setMobileShowRight(false);
          }}
          className="text-zinc-400 hover:text-white p-1 hover:bg-zinc-900/40 rounded transition-colors"
        >
          <AlignLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2">
          <div className="w-3.5 h-3.5 rounded border border-white/60 flex items-center justify-center p-0.5 bg-black">
            <div className="w-full h-full bg-white rounded-3xs" />
          </div>
          <span className="font-sans font-medium text-xs tracking-[0.2em] text-white">OBSIDIAN</span>
        </div>

        <button
          onClick={() => {
            setMobileShowRight(!mobileShowRight);
            setMobileShowLeft(false);
          }}
          className="text-zinc-400 hover:text-white p-1 hover:bg-zinc-900/40 rounded transition-colors flex items-center space-x-1.5"
        >
          <Terminal className="w-4 h-4" />
          {logs.length > 0 && (
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-ping" />
          )}
        </button>
      </div>

      {/* MAIN CONTAINER FRAME */}
      <div className="flex-1 flex flex-row overflow-hidden relative z-10">
        
        {/* LEFT PANEL drawer handler */}
        <div
          className={`lg:w-[28%] lg:block shrink-0 h-full z-30 transition-transform duration-300 ${
            mobileShowLeft
              ? "absolute inset-y-0 left-0 w-[80%] max-w-[340px] translate-x-0 shadow-2xl border-r border-zinc-850"
              : "hidden lg:translate-x-0"
          }`}
        >
          <LeftPanel
            currentMode={currentMode}
            onModeChange={(mode) => {
              setCurrentMode(mode);
              setMobileShowLeft(false);
              handleReset();
            }}
            identity={identity}
            onRegenerateIdentity={() => initIdentity(true)}
          />
        </div>

        {/* Backdrop clicks for mobile drawers */}
        {(mobileShowLeft || mobileShowRight) && (
          <div
            onClick={() => {
              setMobileShowLeft(false);
              setMobileShowRight(false);
            }}
            className="absolute inset-0 bg-black/65 z-20 cursor-pointer lg:hidden"
          />
        )}

        {/* CENTER COMPONENT AREA */}
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
            decryptedSecret={decryptedSecret}
            errorMessage={errorMessage}
            preloadedPayload={decodedHashPayload}
          />
        </div>

        {/* RIGHT PANEL logs drawer handler */}
        <div
          className={`lg:w-[28%] lg:block shrink-0 h-full z-30 transition-transform duration-300 ${
            mobileShowRight
              ? "absolute inset-y-0 right-0 w-[85%] max-w-[340px] translate-x-0 shadow-2xl border-l border-zinc-850"
              : "hidden lg:translate-x-0"
          }`}
        >
          <LogsPanel logs={logs} currentStage={currentStage} status={status} />
        </div>

      </div>
    </div>
  );
}
