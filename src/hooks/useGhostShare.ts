// ─────────────────────────────────────────────────────────────
//  OBSIDIAN — useGhostShare hook
//
//  Drop-in replacement for any dummy/mock implementation.
//  Usage:
//
//    const {
//      send, reveal, reset,
//      step, logs, result,
//      isLoading, error
//    } = useGhostShare();
//
//    await send({ secret: "my secret", recipientLabel: "0xabc..." });
//    await reveal(sealedPayload, ephPrivKey);
// ─────────────────────────────────────────────────────────────

import { useState, useCallback } from "react";
import { useWalletClient, usePublicClient, useChainId, useSwitchChain } from "wagmi";
import { submitGhostShare, revealGhostShare } from "../lib/ghostShare";
import { ritualChain } from "../config/ritual";
import type { SealedPayload } from "../lib/ecies";
import type { GhostShareInput, GhostShareResult } from "../lib/ghostShare";

// ── Step type ─────────────────────────────────────────────────
export type GhostStep =
  | "idle"
  | "fetching_executor"
  | "encrypting"
  | "signing"
  | "submitting"
  | "mining"
  | "done"
  | "error";

export interface LogEntry {
  id: string;
  message: string;
  type: "info" | "ok" | "warn" | "error";
  timestamp: number;
}

export interface UseGhostShareReturn {
  // Actions
  send:   (input: GhostShareInput) => Promise<GhostShareResult | null>;
  reveal: (payload: SealedPayload, ephPrivKey: `0x${string}`) => Promise<string | null>;
  reset:  () => void;

  // State
  step:      GhostStep;
  logs:      LogEntry[];
  result:    GhostShareResult | null;
  decrypted: string | null;
  error:     string | null;
  isLoading: boolean;

  // Chain helpers
  isCorrectChain: boolean;
  switchToRitual: () => void;
}

export function useGhostShare(): UseGhostShareReturn {
  const [step,      setStep]      = useState<GhostStep>("idle");
  const [logs,      setLogs]      = useState<LogEntry[]>([]);
  const [result,    setResult]    = useState<GhostShareResult | null>(null);
  const [decrypted, setDecrypted] = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  const chainId             = useChainId();
  const { data: walletClient }  = useWalletClient();
  const publicClient            = usePublicClient();
  const { switchChain }         = useSwitchChain();

  const isCorrectChain = chainId === ritualChain.id;

  const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
    setLogs(prev => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, message, type, timestamp: Date.now() },
    ]);
  }, []);

  const reset = useCallback(() => {
    setStep("idle");
    setLogs([]);
    setResult(null);
    setDecrypted(null);
    setError(null);
  }, []);

  // ── send ────────────────────────────────────────────────────
  const send = useCallback(async (input: GhostShareInput): Promise<GhostShareResult | null> => {
    if (!walletClient || !publicClient) {
      setError("Wallet not connected");
      return null;
    }
    if (!isCorrectChain) {
      setError("Switch to Ritual Chain first");
      return null;
    }

    reset();
    setStep("fetching_executor");

    // Map log calls to step changes
    const handleLog = (msg: string, type: LogEntry["type"] = "info") => {
      addLog(msg, type);
      // Update step based on log context
      if (msg.includes("ECIES encrypting"))     setStep("encrypting");
      if (msg.includes("EIP-191 signature"))    setStep("signing");
      if (msg.includes("sending transaction"))  setStep("submitting");
      if (msg.includes("waiting for TEE"))      setStep("mining");
    };

    try {
      const res = await submitGhostShare(input, walletClient, publicClient, handleLog);
      setStep("done");
      setResult(res);
      return res;
    } catch (e: any) {
      setStep("error");
      setError(e.message ?? "Unknown error");
      addLog(`error: ${e.message}`, "error");
      return null;
    }
  }, [walletClient, publicClient, isCorrectChain, addLog, reset]);

  // ── reveal ──────────────────────────────────────────────────
  const reveal = useCallback(async (
    payload: SealedPayload,
    ephPrivKey: `0x${string}`
  ): Promise<string | null> => {
    setDecrypted(null);
    setError(null);
    try {
      const plain = await revealGhostShare(payload, ephPrivKey);
      setDecrypted(plain);
      return plain;
    } catch (e: any) {
      setError(`Decryption failed: ${e.message}`);
      return null;
    }
  }, []);

  // ── switchToRitual ──────────────────────────────────────────
  const switchToRitual = useCallback(() => {
    switchChain({ chainId: ritualChain.id });
  }, [switchChain]);

  return {
    send, reveal, reset,
    step, logs, result, decrypted, error,
    isLoading: ["fetching_executor","encrypting","signing","submitting","mining"].includes(step),
    isCorrectChain,
    switchToRitual,
  };
}
