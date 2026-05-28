/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppMode, ExecutionStatus, EnclaveIdentity } from "../types";
import { EyeLogo } from "./EyeLogo";
import {
  Send,
  Eye,
  Copy,
  Check,
  RotateCcw,
  Shield,
  HelpCircle,
  Clock,
  AlertOctagon,
  ArrowRight,
  Sparkles,
  Lock,
  Unlock,
  Trash2
} from "lucide-react";

interface CenterPanelProps {
  currentMode: AppMode;
  status: ExecutionStatus;
  currentIdentity: EnclaveIdentity | null;
  onTransmit: (recipientPublicKey: string, secret: string, expiration: string) => void;
  onReveal: (encodedPayload: string, recipientPrivateKey: string) => void;
  onReset: () => void;
  lastSealedPayloadUrl: string | null;
  lastSealedPayloadRaw: string | null;
  decryptedSecret: string | null;
  errorMessage: string | null;
  preloadedPayload: string | null;
}

export function CenterPanel({
  currentMode,
  status,
  currentIdentity,
  onTransmit,
  onReveal,
  onReset,
  lastSealedPayloadUrl,
  lastSealedPayloadRaw,
  decryptedSecret,
  errorMessage,
  preloadedPayload,
}: CenterPanelProps) {
  // Ghost Share Form Inputs
  const [targetPublicKey, setTargetPublicKey] = useState("");
  const [secretMessage, setSecretMessage] = useState("");
  const [expiration, setExpiration] = useState("burn"); // burn | 5m | 1h | 24h

  // Reveal Secret Form Inputs
  const [sealedInput, setSealedInput] = useState("");
  const [privateKeyInput, setPrivateKeyInput] = useState("");

  // Copy success states
  const [urlCopied, setUrlCopied] = useState(false);
  const [rawCopied, setRawCopied] = useState(false);

  // Prepopulate if payload is loaded from URL hash
  useEffect(() => {
    if (preloadedPayload && currentMode === AppMode.REVEAL_SECRET) {
      setSealedInput(preloadedPayload);
    }
  }, [preloadedPayload, currentMode]);

  const handleGhostSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!targetPublicKey.trim() || !secretMessage.trim()) return;
    onTransmit(targetPublicKey.trim(), secretMessage.trim(), expiration);
  };

  const handleRevealSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!sealedInput.trim() || !privateKeyInput.trim()) return;
    onReveal(sealedInput.trim(), privateKeyInput.trim());
  };

  const handleSelfTestAutofill = () => {
    if (currentIdentity) {
      setTargetPublicKey(currentIdentity.publicKeyBase64);
    }
  };

  const handleSelfTestAutofillPrivate = () => {
    if (currentIdentity) {
      setPrivateKeyInput(currentIdentity.privateKeyBase64);
    }
  };

  const copyToClipboard = (text: string, setCopiedFn: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopiedFn(true);
    setTimeout(() => setCopiedFn(false), 2000);
  };

  return (
    <div className="h-full flex flex-col items-center justify-start p-6 md:p-10 overflow-y-auto bg-gradient-to-b from-zinc-950 via-zinc-950/95 to-zinc-900/60 custom-scrollbar select-none relative z-10 w-full">
      
      {/* Dynamic Status Living Eye Anchor */}
      <EyeLogo status={status} />

      {/* Primary Card Container */}
      <div className="w-full max-w-lg mt-2 relative">
        <AnimatePresence mode="wait">
          
          {/* 1. GHOST SHARE: IDLE FORM */}
          {currentMode === AppMode.GHOST_SHARE && status === ExecutionStatus.IDLE && (
            <motion.div
              key="ghost-compose"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="bg-zinc-950/60 border border-zinc-900 rounded-xl p-6.5 shadow-2xl backdrop-blur-xl relative overflow-hidden"
            >
              {/* Card Aura Line */}
              <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-zinc-700/35 to-transparent" />

              <h2 className="font-sans font-medium text-[15px] text-zinc-200 uppercase tracking-widest mb-1 select-none">
                SEAL CONFIDENTIAL ARCHIVE
              </h2>
              <p className="font-sans text-[11px] text-zinc-500 leading-relaxed font-light mb-6">
                Compose an encrypted micro-packet shareable across insecure lines.
              </p>

              <form onSubmit={handleGhostSubmit} className="space-y-5.5">
                {/* Recipient Input */}
                <div className="flex flex-col space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="font-mono text-[9px] text-zinc-400 tracking-wider">
                      RECIPIENT PUBLIC KEY
                    </label>
                    {currentIdentity && (
                      <button
                        type="button"
                        onClick={handleSelfTestAutofill}
                        className="font-mono text-[8px] text-zinc-500 hover:text-white flex items-center gap-1 transition-colors duration-200"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        SELF-TEST AUTOFILL
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    value={targetPublicKey}
                    onChange={(e) => setTargetPublicKey(e.target.value)}
                    placeholder="P-256 Elliptic Curve SPKI key (Paste friend's identifier)"
                    className="w-full bg-zinc-950/90 border border-zinc-900 rounded px-3 py-2 text-xs font-mono text-zinc-350 focus:outline-none focus:border-zinc-650 placeholder-zinc-700 transition-colors"
                  />
                </div>

                {/* Secret Compose Area */}
                <div className="flex flex-col space-y-2">
                  <label className="font-mono text-[9px] text-zinc-400 tracking-wider">
                    CONFIDENTIAL SECRET CONTENT
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={secretMessage}
                    onChange={(e) => setSecretMessage(e.target.value)}
                    placeholder="Compose encrypted message, credentials, codes, or instructions..."
                    className="w-full bg-zinc-950/90 border border-zinc-905 rounded px-3 py-2 text-xs font-sans text-white focus:outline-none focus:border-zinc-650 placeholder-zinc-700 resize-none transition-colors leading-relaxed"
                  />
                </div>

                {/* Expiration Settings */}
                <div className="flex flex-col space-y-2">
                  <label className="font-mono text-[9px] text-zinc-400 tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-zinc-650" />
                    REVOCATION PERIOD
                  </label>
                  <select
                    value={expiration}
                    onChange={(e) => setExpiration(e.target.value)}
                    className="w-full bg-zinc-950/90 border border-zinc-900 rounded px-3 py-2 text-xs font-mono text-zinc-400 focus:outline-none focus:border-zinc-650 transition-colors cursor-pointer"
                  >
                    <option value="burn">BURN ON READ (One-time extraction)</option>
                    <option value="5m">5 MINUTES ENCLAVE EXHAUST</option>
                    <option value="1h">1 HOUR MOLECULAR DECAY</option>
                    <option value="24h">24 HOURS ABSOLUTE FORGET</option>
                  </select>
                </div>

                {/* Submit button */}
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full py-3 bg-white text-zinc-950 rounded font-mono text-[11px] font-semibold tracking-widest flex items-center justify-center space-x-2 shadow-lg cursor-pointer transition-all duration-300 hover:shadow-white/5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>TRANSMIT SECURE SEAL</span>
                </motion.button>
              </form>
            </motion.div>
          )}

          {/* 2. REVEAL SECRET: IDLE FORM */}
          {currentMode === AppMode.REVEAL_SECRET && status === ExecutionStatus.IDLE && (
            <motion.div
              key="reveal-form"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="bg-zinc-950/60 border border-zinc-900 rounded-xl p-6.5 shadow-2xl backdrop-blur-xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-zinc-700/35 to-transparent" />

              <h2 className="font-sans font-medium text-[15px] text-zinc-200 uppercase tracking-widest mb-1">
                RECONSTRUCT ENCLAVE CAPSULE
              </h2>
              <p className="font-sans text-[11px] text-zinc-500 leading-relaxed font-light mb-6">
                Deliver the sealed cipher payload and matching key agreements.
              </p>

              <form onSubmit={handleRevealSubmit} className="space-y-5.5">
                {/* Encrypted Envelope Input */}
                <div className="flex flex-col space-y-2">
                  <label className="font-mono text-[9px] text-zinc-400 tracking-wider">
                    SEALED PAYLOAD ENVELOPE (BASE64)
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={sealedInput}
                    onChange={(e) => setSealedInput(e.target.value)}
                    placeholder="eyJ2ZXJzaW9uIjoib2JzaWRpYW4udjEiLCJjaXBoZXJ0ZXh0Ijoi..."
                    className="w-full bg-zinc-950/90 border border-zinc-900 rounded px-3 py-2 text-[10px] font-mono text-zinc-400 focus:outline-none focus:border-zinc-650 placeholder-zinc-800 resize-none transition-colors"
                  />
                </div>

                {/* Recipient Private Key Input */}
                <div className="flex flex-col space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="font-mono text-[9px] text-zinc-400 tracking-wider">
                      RECIPIENT PRIVATE DECRYPTION KEY
                    </label>
                    {currentIdentity && (
                      <button
                        type="button"
                        onClick={handleSelfTestAutofillPrivate}
                        className="font-mono text-[8px] text-zinc-500 hover:text-white flex items-center gap-1 transition-colors duration-200"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        AUTOFILL MY PRIVATE KEY
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    required
                    value={privateKeyInput}
                    onChange={(e) => setPrivateKeyInput(e.target.value)}
                    placeholder="Elliptic Curve PKCS8 Private Identifier (E2E memory only)"
                    className="w-full bg-zinc-950/90 border border-zinc-900 rounded px-3 py-2 text-xs font-mono text-zinc-400 focus:outline-none focus:border-zinc-650 placeholder-zinc-800 transition-colors"
                  />
                </div>

                {/* Submit button */}
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full py-3 bg-white text-zinc-950 rounded font-mono text-[11px] font-semibold tracking-widest flex items-center justify-center space-x-2 shadow-lg cursor-pointer transition-all duration-300 hover:shadow-white/5"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>UNSEAL & REVEAL PAYLOAD</span>
                </motion.button>
              </form>
            </motion.div>
          )}

          {/* 3. TRANSIT ACTIVE SCANNING / LOADING FRAME */}
          {status === ExecutionStatus.PROCESSING && (
            <motion.div
              key="loading-execution"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-black/80 border border-zinc-900 rounded-xl p-8 shadow-2xl backdrop-blur-md text-center flex flex-col items-center justify-center min-h-[300px]"
            >
              <div className="w-10 h-10 border border-dashed border-zinc-500 rounded-full animate-spin flex items-center justify-center mb-6">
                <Shield className="w-4 h-4 text-zinc-400" />
              </div>
              <h3 className="font-mono text-[12px] text-zinc-300 tracking-[0.2em] uppercase mb-2">
                Ritual Core Confining...
              </h3>
              <p className="text-[10.5px] font-mono text-zinc-500 max-w-sm leading-relaxed">
                Hardware Enclave generating attestation signatures and negotiating ephemeral keys on client module...
              </p>
            </motion.div>
          )}

          {/* 4. GHOST SHARE: SUCCESS RESULT SUMMARY */}
          {currentMode === AppMode.GHOST_SHARE && status === ExecutionStatus.SUCCESS && lastSealedPayloadRaw && (
            <motion.div
              key="ghost-success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-zinc-950/80 border border-zinc-100/15 rounded-xl p-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

              <div className="flex items-center space-x-3 mb-6">
                <div className="w-7 h-7 rounded bg-zinc-900 border border-slate-500/50 flex items-center justify-center">
                  <Shield className="w-3.5 h-3.5 text-slate-100" />
                </div>
                <div>
                  <h3 className="font-sans font-medium text-[13.5px] text-white tracking-widest uppercase">
                    GLOW PACKET SEALED
                  </h3>
                  <p className="font-mono text-[8px] text-zinc-500 tracking-wider">
                    ATTESTATION SUCCESSFUL // SGX_HARDWARE_VERIFIED
                  </p>
                </div>
              </div>

              <p className="font-sans text-[11.5px] text-zinc-400 leading-relaxed font-light mb-6">
                Your secret message is cryptographically frozen inside a zero-knowledge capsule. Alice can decrypt 
                it ONLY if she possesses the recipient private key. 
              </p>

              <div className="space-y-4">
                {/* Option A: Ghost link (URL) */}
                {lastSealedPayloadUrl && (
                  <div className="flex flex-col space-y-1.5">
                    <span className="font-mono text-[8px] text-zinc-500 tracking-widest uppercase">
                      SECURE GHOST REVEAL LINK (ONE-CLICK DECRYPT)
                    </span>
                    <div className="flex items-center justify-between bg-zinc-950 p-2.5 rounded border border-zinc-900">
                      <span className="font-mono text-[10px] text-zinc-400 truncate max-w-[340px]">
                        {lastSealedPayloadUrl}
                      </span>
                      <button
                        onClick={() => copyToClipboard(lastSealedPayloadUrl, setUrlCopied)}
                        className="text-zinc-400 hover:text-white p-1 hover:bg-zinc-900 rounded transition-colors"
                      >
                        {urlCopied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Option B: Raw base64 packet */}
                <div className="flex flex-col space-y-1.5">
                  <span className="font-mono text-[8px] text-zinc-500 tracking-widest uppercase">
                    SEALED ENVELOPE PAYLOAD (RAW CODES)
                  </span>
                  <div className="flex items-start justify-between bg-zinc-950 p-2.5 rounded border border-zinc-900">
                    <span className="font-mono text-[9px] text-zinc-500 break-all max-h-16 overflow-y-auto pr-2 flex-1 scrollbar-narrow leading-relaxed">
                      {lastSealedPayloadRaw}
                    </span>
                    <button
                      onClick={() => copyToClipboard(lastSealedPayloadRaw, setUrlCopied)}
                      className="text-zinc-400 hover:text-white p-1 hover:bg-zinc-900 rounded transition-colors ml-4 shrink-0"
                    >
                      {urlCopied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Back to Compose */}
              <motion.button
                onClick={onReset}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full mt-6 py-2.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800 rounded font-mono text-[9.5px] font-medium tracking-widest flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>COMPOSE NEW TRANSMISSION</span>
              </motion.button>
            </motion.div>
          )}

          {/* 5. REVEAL SECRET: SUCCESS RESULT GRID */}
          {currentMode === AppMode.REVEAL_SECRET && status === ExecutionStatus.SUCCESS && decryptedSecret && (
            <motion.div
              key="reveal-success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-zinc-950/80 border border-emerald-500/20 rounded-xl p-6.5 shadow-2xl relative overflow-hidden"
            >
              {/* Green/Emerald micro header border */}
              <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />

              <div className="flex items-center space-x-3 mb-5">
                <div className="w-7 h-7 rounded bg-zinc-950 border border-emerald-500/30 flex items-center justify-center">
                  <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-sans font-medium text-[13.5px] text-zinc-100 tracking-widest uppercase">
                    SECRECY DETONATED / REVEALED
                  </h3>
                  <p className="font-mono text-[8px] text-emerald-500 tracking-wider">
                    DECRYPT COMPLETELY CLEANED FROM MEMORY GATES
                  </p>
                </div>
              </div>

              <div className="bg-zinc-950/90 border border-zinc-900 rounded-lg p-4 mb-5.5 relative">
                <span className="absolute top-2 right-2 font-mono text-[7px] text-zinc-650 tracking-widest uppercase select-none">
                  CONFIDENTIAL
                </span>
                <span className="block font-mono text-[8px] text-zinc-500 tracking-wider mb-2 select-none">
                  DECRYPTED OUTPUT PROTOCOL
                </span>
                <p className="font-sans text-sm text-white break-all whitespace-pre-wrap leading-relaxed">
                  {decryptedSecret}
                </p>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded bg-red-950/20 border border-red-900/15 text-red-400 font-sans text-[11px] leading-relaxed mb-6 font-light">
                <AlertOctagon className="w-4 h-4 shrink-0 text-red-500" />
                <span>
                  <strong>CRITICAL SECURE BURST:</strong> Closing this screen or clicking below permanently zeros this decapsulated data from all temporary buffers. We do not store keys.
                </span>
              </div>

              {/* Burn & zero now */}
              <motion.button
                onClick={onReset}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full py-3 bg-red-950 hover:bg-red-900/60 text-red-200 border border-red-900/30 rounded font-mono text-[10px] font-semibold tracking-widest flex items-center justify-center space-x-2 cursor-pointer transition-all duration-300"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>BURN DECRYPTED DATA NOW</span>
              </motion.button>
            </motion.div>
          )}

          {/* 6. ERROR CONTAINER FOR FAULTY SEALS */}
          {status === ExecutionStatus.ERROR && errorMessage && (
            <motion.div
              key="execution-error"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-black border border-red-500/25 rounded-xl p-6.5 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-red-500/35 to-transparent" />

              <div className="flex items-center space-x-3 mb-4 text-red-500">
                <div className="w-7 h-7 rounded bg-red-950/30 border border-red-900/35 flex items-center justify-center">
                  <AlertOctagon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-sans font-medium text-[13px] tracking-widest uppercase text-red-200">
                    ATTESTATION DISTORTION
                  </h3>
                  <p className="font-mono text-[8px] text-red-500/80 tracking-wider">
                    ERROR_CODE: RITUAL_ATTEST_FAILED
                  </p>
                </div>
              </div>

              <p className="font-mono text-[11px] text-red-400 p-3 bg-red-950/10 border border-red-900/20 rounded mb-6 leading-relaxed">
                {errorMessage}
              </p>

              {/* Reset button */}
              <motion.button
                onClick={onReset}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-900 text-zinc-300 border border-zinc-850 rounded font-mono text-[9.5px] font-medium tracking-widest flex items-center justify-center space-x-2 cursor-pointer transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>TRY ANOTHER DEPLOYMENT</span>
              </motion.button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Decorative Floating Intelligence Guidelines */}
      <div className="mt-10 max-w-lg text-center font-mono text-[9px] text-zinc-600 space-y-2 select-none">
        <p className="tracking-wider">
          RITUAL_ENCLAVE_SYSTEMS: CRYPTO_SUITE_P256 // AES_256_GCM_AEAD_CIPHER
        </p>
        <p className="font-sans text-[10px] text-zinc-500 font-light flex items-center justify-center gap-1 leading-normal max-w-sm mx-auto">
          <Shield className="w-3 h-3 text-zinc-650 inline shrink-0" />
          Zero server database dependency. No third-party network has access to private key components. Decryption is entirely native.
        </p>
      </div>
    </div>
  );
}
