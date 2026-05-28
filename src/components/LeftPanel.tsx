/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { AppMode, EnclaveIdentity } from "../types";
import { Shield, Eye, Send, Key, Copy, Check, RefreshCw } from "lucide-react";
import { useState } from "react";

interface LeftPanelProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  identity: EnclaveIdentity | null;
  onRegenerateIdentity: () => void;
}

export function LeftPanel({
  currentMode,
  onModeChange,
  identity,
  onRegenerateIdentity,
}: LeftPanelProps) {
  const [copied, setCopied] = useState(false);

  const copyPublicKey = () => {
    if (identity) {
      navigator.clipboard.writeText(identity.publicKeyBase64);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Truncate public key for visual elegance
  const truncatedPublic = identity
    ? `${identity.publicKeyBase64.substring(0, 10)}...${identity.publicKeyBase64.substring(
        identity.publicKeyBase64.length - 10
      )}`
    : "";

  return (
    <div className="h-full flex flex-col bg-zinc-950/45 p-6 md:p-8 space-y-6 overflow-y-auto border-r border-zinc-900 select-none custom-scrollbar backdrop-blur-md">
      {/* Brand Header */}
      <div className="flex flex-col space-y-2 pb-6 border-b border-zinc-900">
        <div className="flex items-center space-x-2.5">
          <div className="w-5 h-5 rounded border border-white/60 flex items-center justify-center p-0.5 shadow-sm bg-black">
            <div className="w-full h-full bg-white rounded-2xs" />
          </div>
          <span className="font-sans font-semibold text-lg tracking-[0.2em] text-white">OBSIDIAN</span>
        </div>
        <span className="font-mono text-[9px] text-zinc-500 tracking-[0.3em] font-medium">GHOST SHARE</span>
      </div>

      {/* Mode Switches */}
      <div className="flex flex-col space-y-2">
        <span className="font-mono text-[9px] text-zinc-500 tracking-wider">OPERATION SELECTOR</span>
        <div className="grid grid-cols-2 p-1 bg-zinc-950/80 rounded-lg border border-zinc-900">
          <button
            onClick={() => onModeChange(AppMode.GHOST_SHARE)}
            className={`py-2 px-3 rounded-md text-[11px] font-mono tracking-wider flex items-center justify-center space-x-2 transition-all duration-300 relative ${
              currentMode === AppMode.GHOST_SHARE
                ? "text-zinc-950 font-semibold"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {currentMode === AppMode.GHOST_SHARE && (
              <motion.div
                layoutId="activeTabOutline"
                className="absolute inset-0 bg-white rounded-md z-0"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="z-10 flex items-center gap-1.5 justify-center">
              <Send className="w-3 h-3 shrink-0" />
              GHOST SHARE
            </span>
          </button>
          <button
            onClick={() => onModeChange(AppMode.REVEAL_SECRET)}
            className={`py-2 px-3 rounded-md text-[11px] font-mono tracking-wider flex items-center justify-center space-x-2 transition-all duration-300 relative ${
              currentMode === AppMode.REVEAL_SECRET
                ? "text-zinc-950 font-semibold"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {currentMode === AppMode.REVEAL_SECRET && (
              <motion.div
                layoutId="activeTabOutline"
                className="absolute inset-0 bg-white rounded-md z-0"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="z-10 flex items-center gap-1.5 justify-center">
              <Eye className="w-3 h-3 shrink-0" />
              REVEAL SECRET
            </span>
          </button>
        </div>
      </div>

      {/* Cyber-noir Lore text explaining features */}
      <div className="flex flex-col space-y-3 p-4 rounded-lg bg-zinc-950/30 border border-zinc-900/50">
        <span className="font-mono text-[9.5px] text-zinc-400 font-medium tracking-wider flex items-center gap-1.5">
          <Shield className="w-3 h-3 text-zinc-500" />
          RITUAL CONFIDENTIALITY REPORT
        </span>
        <p className="font-sans text-[11.5px] text-zinc-400 leading-relaxed font-light">
          OBSIDIAN Ghost Share establishes complete end-to-end cryptographic shielding for sensitive
          messages. Utilizing ephemeral EC-Diffie Hellman key agreement, enclaves generate fully isolated, 
          hardware-attested enclaves to secure zero-trace payloads. No logs are saved. Messages are decrypted only inside 
          secure, localized execution sandboxes.
        </p>
      </div>

      {/* User On-board Graphite Enclave Identity */}
      {identity && (
        <div className="flex flex-col space-y-3 p-4 rounded-lg bg-zinc-950/20 border border-zinc-900/40 font-mono text-[10.5px]">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-zinc-400 tracking-wider flex items-center gap-1.5 text-zinc-400">
              <Key className="w-3 h-3 text-zinc-500" />
              MY OBSIDIAN IDENTITY
            </span>
            <button
              onClick={onRegenerateIdentity}
              title="Regenerate Identity Cards"
              className="text-zinc-600 hover:text-zinc-400 p-0.5 hover:bg-zinc-900/40 rounded transition-all duration-200"
            >
              <RefreshCw className="w-2.5 h-2.5" />
            </button>
          </div>
          <div className="space-y-2">
            <div>
              <span className="block text-[8px] text-zinc-650 tracking-widest uppercase">ENCLAVE PUBLIC IDENTIFIER</span>
              <div className="flex items-center justify-between bg-black/55 p-2 rounded border border-zinc-900/70 mt-1">
                <span className="font-mono text-[9.5px] text-zinc-300 break-all">{truncatedPublic}</span>
                <button
                  onClick={copyPublicKey}
                  className="text-zinc-500 hover:text-zinc-300 ml-2 p-1 bg-zinc-900/45 hover:bg-zinc-900 rounded transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
            <div>
              <span className="block text-[8px] text-zinc-650 tracking-widest uppercase">ENCLAVE PRIVATE KEY</span>
              <div className="bg-black/5 p-2 rounded border border-zinc-950 mt-1 text-[9px] text-zinc-600 select-none flex items-center justify-between">
                <span>[HIDDEN IN HARDWARE SANDBOX]</span>
                <span className="text-[10px] opacity-25">SHA256</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deep Visualized Architecture Steps */}
      <div className="flex-1 flex flex-col space-y-3 pt-4 border-t border-zinc-900/70">
        <span className="font-mono text-[9px] text-zinc-500 tracking-wider">PIPELINE SECRECY PROCESS</span>
        <div className="space-y-4 font-sans text-xs">
          <div className="flex items-start gap-3">
            <div className="h-4.5 w-4.5 rounded-full bg-zinc-900/70 border border-zinc-700/50 flex items-center justify-center font-mono text-[9.5px] text-zinc-400 shrink-0 mt-0.5">
              1
            </div>
            <div>
              <h4 className="font-mono text-[10.5px] text-zinc-300 tracking-wide">Client EC-Keygen</h4>
              <p className="text-zinc-500 leading-normal text-[11px] font-light mt-0.5">
                Every transmission session utilizes automated ephemeral public key exchanges.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="h-4.5 w-4.5 rounded-full bg-zinc-900/70 border border-zinc-700/50 flex items-center justify-center font-mono text-[9.5px] text-zinc-400 shrink-0 mt-0.5">
              2
            </div>
            <div>
              <h4 className="font-mono text-[10.5px] text-zinc-300 tracking-wide">CONFIDENTIAL ATTESTATION</h4>
              <p className="text-zinc-500 leading-normal text-[11px] font-light mt-0.5">
                Ritual enclaves verify that encryption runs under strictly attested CPU parameters.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="h-4.5 w-4.5 rounded-full bg-zinc-900/70 border border-zinc-700/50 flex items-center justify-center font-mono text-[9.5px] text-zinc-400 shrink-0 mt-0.5">
              3
            </div>
            <div>
              <h4 className="font-mono text-[10.5px] text-zinc-300 tracking-wide">EPHEMERAL CAPSULE SEAL</h4>
              <p className="text-zinc-500 leading-normal text-[11px] font-light mt-0.5">
                We bundle IV, cipher payload, and ephemeral parameters into a self-destructing capsule.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Version Details */}
      <div className="pt-4 border-t border-zinc-900/50 font-mono text-[8.5px] text-zinc-600 flex justify-between select-none">
        <span>CORE_SPEC: RITUAL_O1_E2E</span>
        <span>v1.0827_ENCLAVE</span>
      </div>
    </div>
  );
}
