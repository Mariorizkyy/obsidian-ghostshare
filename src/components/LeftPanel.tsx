/**
 * @license SPDX-License-Identifier: Apache-2.0
 * OBSIDIAN LeftPanel — with Ritual Chain wallet connect
 */

import { motion } from "motion/react";
import { AppMode, EnclaveIdentity, WalletState } from "../types";
import { Shield, Eye, Send, Key, Copy, Check, RefreshCw, Wallet, ExternalLink } from "lucide-react";
import { useState } from "react";
import { RITUAL_CHAIN, CONTRACTS, EXPLORER_TX } from "../lib/ritual";

interface LeftPanelProps {
  currentMode:          AppMode;
  onModeChange:         (mode: AppMode) => void;
  identity:             EnclaveIdentity | null;
  onRegenerateIdentity: () => void;
  walletState:          WalletState;
  onConnectWallet:      () => void;
  onSwitchChain:        () => void;
}

export function LeftPanel({
  currentMode, onModeChange, identity, onRegenerateIdentity,
  walletState, onConnectWallet, onSwitchChain,
}: LeftPanelProps) {
  const [copied,      setCopied]      = useState(false);
  const [addrCopied,  setAddrCopied]  = useState(false);

  const copyPublicKey = () => {
    if (identity) { navigator.clipboard.writeText(identity.publicKeyBase64); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };
  const copyAddress = () => {
    if (walletState.address) { navigator.clipboard.writeText(walletState.address); setAddrCopied(true); setTimeout(() => setAddrCopied(false), 2000); }
  };

  const truncatedPublic = identity
    ? `${identity.publicKeyBase64.substring(0, 10)}...${identity.publicKeyBase64.substring(identity.publicKeyBase64.length - 10)}`
    : "";
  const shortAddr = walletState.address
    ? `${walletState.address.slice(0,6)}...${walletState.address.slice(-4)}`
    : "";

  return (
    <div className="h-full flex flex-col bg-zinc-950/45 p-6 md:p-8 space-y-6 overflow-y-auto border-r border-zinc-900 select-none custom-scrollbar backdrop-blur-md">

      {/* Brand */}
      <div className="flex flex-col space-y-2 pb-6 border-b border-zinc-900">
        <div className="flex items-center space-x-2.5">
          <div className="w-5 h-5 rounded border border-white/60 flex items-center justify-center p-0.5 shadow-sm bg-black">
            <div className="w-full h-full bg-white rounded-2xs" />
          </div>
          <span className="font-sans font-semibold text-lg tracking-[0.2em] text-white">OBSIDIAN</span>
        </div>
        <span className="font-mono text-[9px] text-zinc-500 tracking-[0.3em] font-medium">GHOST SHARE · RITUAL CHAIN</span>
      </div>

      {/* Mode Switches */}
      <div className="flex flex-col space-y-2">
        <span className="font-mono text-[9px] text-zinc-500 tracking-wider">OPERATION SELECTOR</span>
        <div className="grid grid-cols-2 p-1 bg-zinc-950/80 rounded-lg border border-zinc-900">
          {[AppMode.GHOST_SHARE, AppMode.REVEAL_SECRET].map((mode) => (
            <button key={mode} onClick={() => onModeChange(mode)}
              className={`py-2 px-3 rounded-md text-[11px] font-mono tracking-wider flex items-center justify-center space-x-2 transition-all duration-300 relative ${currentMode === mode ? "text-zinc-950 font-semibold" : "text-zinc-500 hover:text-zinc-300"}`}>
              {currentMode === mode && (
                <motion.div layoutId="activeTabOutline" className="absolute inset-0 bg-white rounded-md z-0"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }} />
              )}
              <span className="z-10 flex items-center gap-1.5 justify-center">
                {mode === AppMode.GHOST_SHARE ? <Send className="w-3 h-3 shrink-0" /> : <Eye className="w-3 h-3 shrink-0" />}
                {mode === AppMode.GHOST_SHARE ? "GHOST SHARE" : "REVEAL SECRET"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── WALLET CONNECT ── */}
      <div className="flex flex-col space-y-3 p-4 rounded-lg bg-zinc-950/30 border border-zinc-900/50">
        <span className="font-mono text-[9px] text-zinc-400 tracking-wider flex items-center gap-1.5">
          <Wallet className="w-3 h-3 text-zinc-500" />
          RITUAL CHAIN WALLET
        </span>

        {!walletState.connected ? (
          <button onClick={onConnectWallet}
            className="w-full py-2 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-500 rounded font-mono text-[10px] text-zinc-300 tracking-wider transition-all flex items-center justify-center gap-2">
            <Wallet className="w-3 h-3" />
            CONNECT METAMASK
          </button>
        ) : (
          <div className="space-y-2">
            {/* Address */}
            <div className="flex items-center justify-between bg-black/40 p-2 rounded border border-zinc-900">
              <div>
                <span className="block text-[8px] text-zinc-600 tracking-widest uppercase mb-0.5">ADDRESS</span>
                <span className="font-mono text-[10px] text-zinc-300">{shortAddr}</span>
              </div>
              <button onClick={copyAddress} className="text-zinc-500 hover:text-zinc-300 p-1 bg-zinc-900/45 hover:bg-zinc-900 rounded transition-colors">
                {addrCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>

            {/* Chain status */}
            <div className={`flex items-center justify-between p-2 rounded border ${walletState.onRitual ? "border-emerald-900/50 bg-emerald-950/20" : "border-amber-900/50 bg-amber-950/20"}`}>
              <div>
                <span className="block text-[8px] tracking-widest uppercase mb-0.5 text-zinc-500">CHAIN</span>
                <span className={`font-mono text-[10px] ${walletState.onRitual ? "text-emerald-400" : "text-amber-400"}`}>
                  {walletState.onRitual ? `RITUAL (id:${RITUAL_CHAIN.id}) ●` : `WRONG CHAIN (${walletState.chainId ?? "?"})`}
                </span>
              </div>
              {!walletState.onRitual && (
                <button onClick={onSwitchChain}
                  className="text-[9px] font-mono text-amber-400 hover:text-amber-200 border border-amber-800/50 hover:border-amber-600 px-2 py-1 rounded transition-colors">
                  SWITCH
                </button>
              )}
            </div>
          </div>
        )}

        {/* Faucet link */}
        <a href="https://faucet.ritualfoundation.org" target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-600 hover:text-zinc-400 transition-colors">
          <ExternalLink className="w-2.5 h-2.5" />
          RITUAL TESTNET FAUCET
        </a>
      </div>

      {/* Lore / info */}
      <div className="flex flex-col space-y-3 p-4 rounded-lg bg-zinc-950/30 border border-zinc-900/50">
        <span className="font-mono text-[9.5px] text-zinc-400 font-medium tracking-wider flex items-center gap-1.5">
          <Shield className="w-3 h-3 text-zinc-500" />
          RITUAL CONFIDENTIALITY REPORT
        </span>
        <p className="font-sans text-[11.5px] text-zinc-400 leading-relaxed font-light">
          OBSIDIAN Ghost Share uses Ritual Chain's HTTP precompile to transmit secrets
          via TEE executor. Secrets ECIES-encrypted to executor pubkey · re-encrypted
          to ephemeral user keypair · zero plaintext at any on-chain layer.
        </p>
      </div>

      {/* Identity */}
      {identity && (
        <div className="flex flex-col space-y-3 p-4 rounded-lg bg-zinc-950/20 border border-zinc-900/40 font-mono text-[10.5px]">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-zinc-400 tracking-wider flex items-center gap-1.5">
              <Key className="w-3 h-3 text-zinc-500" />
              MY OBSIDIAN IDENTITY
            </span>
            <button onClick={onRegenerateIdentity} title="Regenerate"
              className="text-zinc-600 hover:text-zinc-400 p-0.5 hover:bg-zinc-900/40 rounded transition-all">
              <RefreshCw className="w-2.5 h-2.5" />
            </button>
          </div>
          <div>
            <span className="block text-[8px] text-zinc-600 tracking-widest uppercase">ENCLAVE PUBLIC KEY (secp256k1)</span>
            <div className="flex items-center justify-between bg-black/55 p-2 rounded border border-zinc-900/70 mt-1">
              <span className="font-mono text-[9.5px] text-zinc-300">{truncatedPublic}</span>
              <button onClick={copyPublicKey} className="text-zinc-500 hover:text-zinc-300 ml-2 p-1 bg-zinc-900/45 hover:bg-zinc-900 rounded transition-colors">
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
          <div>
            <span className="block text-[8px] text-zinc-600 tracking-widest uppercase">ENCLAVE PRIVATE KEY</span>
            <div className="bg-black/5 p-2 rounded border border-zinc-950 mt-1 text-[9px] text-zinc-600 select-none flex items-center justify-between">
              <span>[HIDDEN IN HARDWARE SANDBOX]</span>
              <span className="text-[10px] opacity-25">SHA256</span>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline steps */}
      <div className="flex-1 flex flex-col space-y-3 pt-4 border-t border-zinc-900/70">
        <span className="font-mono text-[9px] text-zinc-500 tracking-wider">RITUAL EXECUTION PIPELINE</span>
        <div className="space-y-4 font-sans text-xs">
          {[
            { n:"1", title:"TEE EXECUTOR FETCH",    desc:"Query TEEServiceRegistry for active secp256k1 executor pubkey." },
            { n:"2", title:"ECIES ENCRYPT",          desc:"Secret ECIES-encrypted to executor pubkey. 12-byte AES-GCM nonce (Ritual standard)." },
            { n:"3", title:"HTTP PRECOMPILE TX",     desc:"ABI-encoded 13-field calldata dispatched to 0x0000...0801 on Ritual Chain." },
            { n:"4", title:"PRIVATE OUTPUT SEAL",    desc:"Executor re-encrypts output to ephemeral user keypair. Only keypair holder can decrypt." },
          ].map(s => (
            <div key={s.n} className="flex items-start gap-3">
              <div className="h-4.5 w-4.5 rounded-full bg-zinc-900/70 border border-zinc-700/50 flex items-center justify-center font-mono text-[9.5px] text-zinc-400 shrink-0 mt-0.5">{s.n}</div>
              <div>
                <h4 className="font-mono text-[10.5px] text-zinc-300 tracking-wide">{s.title}</h4>
                <p className="text-zinc-500 leading-normal text-[11px] font-light mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contract addresses */}
      <div className="space-y-1.5 pt-3 border-t border-zinc-900/50">
        <span className="font-mono text-[8px] text-zinc-600 tracking-wider">CONTRACT ADDRESSES</span>
        {[
          { label: "HTTP PRECOMPILE",  addr: CONTRACTS.HTTP_PRECOMPILE },
          { label: "TEE REGISTRY",     addr: CONTRACTS.TEE_SERVICE_REGISTRY },
          { label: "SECRETS AC",       addr: CONTRACTS.SECRETS_ACCESS_CTRL },
        ].map(c => (
          <div key={c.label} className="flex items-center justify-between">
            <span className="font-mono text-[8px] text-zinc-600">{c.label}</span>
            <span className="font-mono text-[8px] text-zinc-700">{c.addr.slice(0,10)}...{c.addr.slice(-6)}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="pt-2 border-t border-zinc-900/50 font-mono text-[8.5px] text-zinc-600 flex justify-between">
        <span>RITUAL_ID:{RITUAL_CHAIN.id}</span>
        <span>v2.0_ONCHAIN</span>
      </div>
    </div>
  );
}
