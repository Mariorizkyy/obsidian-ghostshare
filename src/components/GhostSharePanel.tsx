"use client";
// ─────────────────────────────────────────────────────────────
//  OBSIDIAN — GhostSharePanel
//
//  Drop-in component. Replace your existing dummy GhostShare
//  panel with this one. Plug in your existing OBSIDIAN CSS.
//
//  Props:
//    className?  — extra class on root div
//    onSuccess?  — callback when ghost share is sealed
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import {
  useAccount, useConnect, useDisconnect,
  useChainId
} from "wagmi";
import { metaMask } from "wagmi/connectors";
import { useGhostShare, type GhostStep } from "../hooks/useGhostShare";
import { ritualChain, EXPLORER_URL } from "../config/ritual";
import type { SealedPayload } from "../lib/ecies";
import type { GhostShareResult } from "../lib/ghostShare";

interface Props {
  className?: string;
  onSuccess?: (result: GhostShareResult) => void;
}

// ── Step meta ─────────────────────────────────────────────────
const STEP_LABELS: Record<GhostStep, string> = {
  idle:              "COMPOSE",
  fetching_executor: "FETCH",
  encrypting:        "ENCRYPT",
  signing:           "SIGN",
  submitting:        "SUBMIT",
  mining:            "SETTLE",
  done:              "SEALED",
  error:             "ERROR",
};
const PROGRESS_STEPS: GhostStep[] = [
  "fetching_executor","encrypting","signing","submitting","mining",
];

// ──────────────────────────────────────────────────────────────
export function GhostSharePanel({ className, onSuccess }: Props) {
  const [mode, setMode]             = useState<"send" | "receive">("send");
  const [secret, setSecret]         = useState("");
  const [recipient, setRecipient]   = useState("");
  const [ttl, setTtl]               = useState("100");
  const [recvPayload, setRecvPayload] = useState("");
  const [recvPrivKey, setRecvPrivKey] = useState("");

  const { address, isConnected } = useAccount();
  const { connect }               = useConnect();
  const { disconnect }            = useDisconnect();
  const chainId                   = useChainId();
  const isRitual                  = chainId === ritualChain.id;

  const {
    send, reveal, reset,
    step, logs, result, decrypted, error,
    isLoading, switchToRitual,
  } = useGhostShare();

  // ── Connect wallet ─────────────────────────────────────────
  const handleConnect = () => connect({ connector: metaMask() });

  // ── Send ghost share ───────────────────────────────────────
  const handleSend = async () => {
    if (!secret.trim() || !isConnected || !isRitual) return;
    const res = await send({
      secret,
      recipientLabel: recipient || undefined,
      ttlBlocks:      BigInt(ttl || "100"),
    });
    if (res) onSuccess?.(res);
  };

  // ── Reveal ─────────────────────────────────────────────────
  const handleReveal = async () => {
    if (!recvPayload.trim() || !recvPrivKey.trim()) return;
    try {
      const payload: SealedPayload = JSON.parse(recvPayload);
      await reveal(payload, recvPrivKey.trim() as `0x${string}`);
    } catch {
      // JSON parse error handled below
    }
  };

  // ── Copy util ──────────────────────────────────────────────
  const copy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    const el = document.getElementById(id);
    if (!el) return;
    const orig = el.textContent;
    el.textContent = "COPIED";
    setTimeout(() => { if (el) el.textContent = orig; }, 1800);
  };

  // ── Helpers ────────────────────────────────────────────────
  const shortAddr = (a: string) => `${a.slice(0,6)}...${a.slice(-4)}`;
  const canSend   = !!secret.trim() && isConnected && isRitual && !isLoading;
  const canReveal = !!recvPayload.trim() && !!recvPrivKey.trim() && !isLoading;

  return (
    <div className={`obsidian-panel ${className ?? ""}`} data-step={step}>

      {/* ── Header ── */}
      <header className="obs-header">
        <div className="obs-brand">
          <ObsidianEye state={isLoading ? "processing" : step === "done" ? "success" : "idle"} />
          <div>
            <div className="obs-title">OBSIDIAN</div>
            <div className="obs-sub">Ghost Share · Ritual Chain · id:1979</div>
          </div>
        </div>
        <div className={`obs-chain-pill ${isRitual ? "on" : isConnected ? "wrong" : ""}`}>
          {isConnected
            ? isRitual ? "Ritual:1979 ●" : "Wrong Chain"
            : "disconnected"}
        </div>
      </header>

      {/* ── Wallet ── */}
      <div className="obs-wallet-row">
        {!isConnected ? (
          <button className="obs-btn obs-btn-outline" onClick={handleConnect}>
            CONNECT WALLET
          </button>
        ) : (
          <div className="obs-wallet-info">
            <span className="obs-addr">● {shortAddr(address!)}</span>
            {!isRitual && (
              <button className="obs-btn obs-btn-warn" onClick={switchToRitual}>
                SWITCH TO RITUAL →
              </button>
            )}
            <button className="obs-btn obs-btn-ghost" onClick={() => disconnect()}>
              DISCONNECT
            </button>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="obs-tabs">
        <button
          className={`obs-tab ${mode === "send" ? "active" : ""}`}
          onClick={() => { setMode("send"); reset(); }}
        >
          GHOST SHARE
        </button>
        <button
          className={`obs-tab ${mode === "receive" ? "active" : ""}`}
          onClick={() => { setMode("receive"); reset(); }}
        >
          REVEAL SECRET
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════
          SEND MODE
      ══════════════════════════════════════════════════════ */}
      {mode === "send" && (
        <div className="obs-panel-body">

          {/* Compose form */}
          {(step === "idle" || step === "error") && (
            <>
              <p className="obs-hint">
                Secret → ECIES encrypted to executor pubkey · enters TEE via HTTP precompile ·
                output re-encrypted to ephemeral keypair · zero plaintext on-chain
              </p>

              <label className="obs-label">Secret Message</label>
              <textarea
                className="obs-input obs-textarea"
                rows={4}
                placeholder="api key, seed phrase, private note..."
                value={secret}
                onChange={e => setSecret(e.target.value)}
              />

              <div className="obs-row-2">
                <div>
                  <label className="obs-label">Recipient (label)</label>
                  <input
                    className="obs-input"
                    placeholder="0x..."
                    value={recipient}
                    onChange={e => setRecipient(e.target.value)}
                  />
                </div>
                <div>
                  <label className="obs-label">TTL (blocks)</label>
                  <input
                    className="obs-input"
                    placeholder="100"
                    value={ttl}
                    onChange={e => setTtl(e.target.value)}
                  />
                </div>
              </div>

              {!isConnected && (
                <div className="obs-warn-box">Connect wallet to submit on-chain.</div>
              )}
              {isConnected && !isRitual && (
                <div className="obs-warn-box">
                  Switch to Ritual Chain (id:1979) to continue.
                </div>
              )}
              {error && <div className="obs-error-box">✕ {error}</div>}

              <button className="obs-btn obs-btn-primary" onClick={handleSend} disabled={!canSend}>
                ENCRYPT &amp; TRANSMIT ON-CHAIN
              </button>
            </>
          )}

          {/* Progress */}
          {isLoading && (
            <>
              <StepIndicator current={step} />
              <LogPane logs={logs} />
            </>
          )}

          {/* Done */}
          {step === "done" && result && (
            <>
              <div className="obs-success-title">✓ Ghost Share Sealed on Ritual Chain</div>

              <CopyRow
                id="cp-tx"
                label="Transaction Hash"
                value={result.sealedPayload.txHash}
                link={result.explorerUrl}
                onCopy={copy}
              />
              <CopyRow
                id="cp-link"
                label="Ghost Link (share with recipient)"
                value={JSON.stringify(result.sealedPayload)}
                onCopy={copy}
              />
              <CopyRow
                id="cp-priv"
                label="⚠ Ephemeral Private Key — send securely"
                value={result.ephemeralPrivateKey}
                onCopy={copy}
                warn
              />
              {result.sealedPayload.encryptedOutput && (
                <CopyRow
                  id="cp-out"
                  label="Encrypted Output (from spcCalls)"
                  value={result.sealedPayload.encryptedOutput}
                  onCopy={copy}
                />
              )}

              <div className="obs-trace-box">
                <div className="obs-trace-title">EXECUTION TRACE</div>
                chain: Ritual (id:1979) · block: {result.sealedPayload.block}<br/>
                precompile: 0x0000...0801<br/>
                executor pubkey: ECIES secp256k1 · 12-byte nonce<br/>
                private output: ephemeral ECDH keypair<br/>
                <a href={result.explorerUrl} target="_blank" rel="noreferrer"
                   className="obs-link">view on explorer →</a>
              </div>

              <LogPane logs={logs} collapsed />

              <button className="obs-btn obs-btn-ghost" onClick={reset}>
                NEW GHOST SHARE
              </button>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          RECEIVE MODE
      ══════════════════════════════════════════════════════ */}
      {mode === "receive" && (
        <div className="obs-panel-body">
          <p className="obs-hint">
            Paste the ghost link JSON and the ephemeral private key from the sender.
            Decryption is fully client-side — no keys leave your browser.
          </p>

          <label className="obs-label">Ghost Link (JSON)</label>
          <textarea
            className="obs-input obs-textarea"
            rows={4}
            placeholder='{"v":1,"txHash":"0x...","encryptedOutput":"0x...","network":"ritual:1979"}'
            value={recvPayload}
            onChange={e => setRecvPayload(e.target.value)}
          />

          <label className="obs-label">Ephemeral Private Key</label>
          <input
            className="obs-input"
            type="password"
            placeholder="0x..."
            value={recvPrivKey}
            onChange={e => setRecvPrivKey(e.target.value)}
          />

          {error && <div className="obs-error-box">{error}</div>}

          <button
            className="obs-btn obs-btn-primary"
            onClick={handleReveal}
            disabled={!canReveal}
          >
            REVEAL SECRET
          </button>

          {decrypted != null && (
            <div className="obs-reveal-block">
              <div className="obs-label">Revealed Secret</div>
              <div className="obs-reveal-box">{decrypted}</div>
              <div className="obs-reveal-note">
                ✓ decrypted via ephemeral ECDH · zero on-chain plaintext exposure
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Footer: contract addresses ── */}
      <footer className="obs-footer">
        <ContractBadge name="HTTP Precompile"  addr="0x0000...0801" />
        <ContractBadge name="TEE Registry"     addr="0x9644...47F"  />
        <ContractBadge name="Secrets AC"       addr="0xf9BF...2FD"  />
      </footer>

    </div>
  );
}

// ──────────────────────────────────────────────────────────────
//  Sub-components
// ──────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: GhostStep }) {
  const ci = PROGRESS_STEPS.indexOf(current);
  return (
    <div className="obs-steps">
      {PROGRESS_STEPS.map((s, i) => {
        const done   = ci > i;
        const active = ci === i;
        return (
          <div key={s} className="obs-step-item">
            <div className={`obs-step-dot ${done?"done":""} ${active?"active":""}`}>
              {done ? "✓" : i + 1}
            </div>
            {i < PROGRESS_STEPS.length - 1 && (
              <div className={`obs-step-line ${done||active?"done":""}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function LogPane({ logs, collapsed }: { logs: ReturnType<typeof useGhostShare>["logs"], collapsed?: boolean }) {
  return (
    <div className={`obs-log-pane ${collapsed?"collapsed":""}`}>
      {logs.map(l => (
        <div key={l.id} className={`obs-log-line ${l.type}`}>
          {l.message}
        </div>
      ))}
      {!collapsed && <div className="obs-log-cursor">█</div>}
    </div>
  );
}

function CopyRow({
  id, label, value, link, onCopy, warn
}: {
  id: string; label: string; value: string;
  link?: string; onCopy: (v: string, id: string) => void; warn?: boolean;
}) {
  return (
    <div className="obs-copy-row">
      <div className="obs-label">{label}</div>
      <div className={`obs-copy-box ${warn ? "warn" : ""}`}>
        <span className="obs-copy-val">{value.slice(0, 50)}{value.length > 50 ? "..." : ""}</span>
        <div className="obs-copy-actions">
          {link && (
            <a href={link} target="_blank" rel="noreferrer" className="obs-btn obs-btn-ghost obs-btn-xs">
              VIEW
            </a>
          )}
          <button id={id} className="obs-btn obs-btn-ghost obs-btn-xs" onClick={() => onCopy(value, id)}>
            COPY
          </button>
        </div>
      </div>
    </div>
  );
}

function ContractBadge({ name, addr }: { name: string; addr: string }) {
  return (
    <div className="obs-contract-badge">
      <div className="obs-contract-name">{name}</div>
      <div className="obs-contract-addr">{addr}</div>
    </div>
  );
}

function ObsidianEye({ state }: { state: "idle" | "processing" | "success" }) {
  const r = state === "idle" ? 16 : state === "processing" ? 22 : 26;
  return (
    <svg width="36" height="36" viewBox="0 0 100 100" className={`obs-eye obs-eye-${state}`}>
      <defs>
        <radialGradient id="og" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <clipPath id="oc"><circle cx="50" cy="50" r="44"/></clipPath>
      </defs>
      <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
      <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.3" strokeDasharray="2 9" />
      <ellipse cx="50" cy="50" rx={r} ry={r} fill="url(#og)" style={{ transition: "rx .5s, ry .5s" }} />
      <line x1="50" y1="7" x2="50" y2="93" stroke="white" strokeWidth="0.8" strokeOpacity="0.8" clipPath="url(#oc)" />
      <circle cx="50" cy="50" r="2.5" fill="white" />
    </svg>
  );
}
