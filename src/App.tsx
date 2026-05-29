/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { AppMode, ExecutionStage, ExecutionStatus, RitualExecutionLog } from "./types";
import {
  executeGhostShare,
  createRitualPublicClient,
  createRitualWalletClient,
  type GhostRequest,
  type GhostResult,
  type ExecutionStep,
} from "./lib/ritual";
import { LeftPanel } from "./components/LeftPanel";
import { CenterPanel } from "./components/CenterPanel";
import { LogsPanel } from "./components/LogsPanel";
import type { Hex, Address } from "viem";

export default function App() {
  // Navigation & States
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.GHOST_SHARE);
  const [status, setStatus] = useState<ExecutionStatus>(ExecutionStatus.IDLE);
  const [currentStage, setCurrentStage] = useState<ExecutionStage>(ExecutionStage.COMPOSE);

  // Wallet
  const [walletPrivateKey, setWalletPrivateKey] = useState<string>(
    () => localStorage.getItem("ritual_wallet_pk") || ""
  );

  // Results
  const [lastResult, setLastResult] = useState<GhostResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Logs
  const [logs, setLogs] = useState<RitualExecutionLog[]>([]);

  // Mobile toggles
  const [mobileShowLeft, setMobileShowLeft] = useState(false);
  const [mobileShowRight, setMobileShowRight] = useState(false);

  // Save wallet key
  useEffect(() => {
    if (walletPrivateKey) {
      localStorage.setItem("ritual_wallet_pk", walletPrivateKey);
    }
  }, [walletPrivateKey]);

  // Helper: append log
  const appendLog = (tag: string, message: string, isHeader = false) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    const d = new Date();
    const timeStr = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${d.getUTCMilliseconds().toString().padStart(3, "0")}`;
    setLogs((prev) => [...prev, { timestamp: timeStr, tag, message, isHeader }]);
  };

  // Map ExecutionStep to ExecutionStage
  const stepToStage = (step: ExecutionStep): ExecutionStage => {
    const map: Record<ExecutionStep, ExecutionStage> = {
      COMPOSE: ExecutionStage.COMPOSE,
      ENCRYPT: ExecutionStage.ENCRYPT,
      ATTEST: ExecutionStage.ATTEST,
      TRANSMIT: ExecutionStage.TRANSMIT,
      RECEIVE: ExecutionStage.RECEIVE,
    };
    return map[step] || ExecutionStage.COMPOSE;
  };

  // GHOST SHARE — Real Ritual execution
  const executeGhostTransmission = async (
    recipientPubKey: string,
    secret: string,
    expiration: string
  ) => {
    if (!walletPrivateKey) {
      setErrorMessage("Please set your wallet private key first");
      setStatus(ExecutionStatus.ERROR);
      return;
    }

    try {
      setStatus(ExecutionStatus.PROCESSING);
      setCurrentStage(ExecutionStage.COMPOSE);
      setLogs([]);
      setErrorMessage(null);

      appendLog("system", "DEPLOYING ISOLATED CONFIDENTIAL TRANSMISSION UNIT", true);

      const walletClient = createRitualWalletClient(walletPrivateKey as Hex);
      const publicClient = createRitualPublicClient();
      const account = walletClient.account!.address;

      appendLog("system", `WALLET: ${account}`);

      // Build request — secret as single key-value
      const request: GhostRequest = {
        url: "https://httpbin.org/post",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: "GHOST_SECRET" }),
        secrets: { GHOST_SECRET: secret },
      };

      const result = await executeGhostShare(
        request,
        walletClient,
        publicClient,
        account,
        (step, detail, tag) => {
          setCurrentStage(stepToStage(step as ExecutionStep));
          appendLog(tag || "system", detail);
        }
      );

      setLastResult(result);
      setStatus(result.status === "success" ? ExecutionStatus.SUCCESS : ExecutionStatus.ERROR);

      if (result.status === "error") {
        setErrorMessage("Execution failed. Check logs for details.");
      }

      // Append all logs from result
      result.log.forEach((line) => {
        const tag = line.match(/^$$(\w+)$$/)?.[1]?.toLowerCase() || "system";
        appendLog(tag, line);
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      appendLog("system", `EXCEPTION: ${msg}`);
      setErrorMessage(msg);
      setStatus(ExecutionStatus.ERROR);
    }
  };

  // REVEAL SECRET
  const executeRevealRecovery = async (
    encodedPayload: string,
    recipientPrivKey: string
  ) => {
    try {
      setStatus(ExecutionStatus.PROCESSING);
      setCurrentStage(ExecutionStage.RECEIVE);
      setLogs([]);
      setErrorMessage(null);

      appendLog("system", "RECONSTRUCTING SEALS UNDER SECURE ENCLAVE", true);

      // Parse: if it's our GhostResult JSON
      try {
        const parsed = JSON.parse(atob(encodedPayload.trim()));
        if (parsed.ephemeralPrivateKey) {
          const { revealSecret } = await import("./lib/ritual");
          const result = await revealSecret(
            parsed.sealedPayload,
            parsed.ephemeralPrivateKey
          );
          setLastResult({
            txHash: "0x",
            sealedPayload: parsed.sealedPayload,
            ephemeralPrivateKey: parsed.ephemeralPrivateKey,
            decryptedOutput: result.decryptedData,
            status: "success",
            log: result.log,
          });
          result.log.forEach((line) => appendLog("system", line));
          setStatus(ExecutionStatus.SUCCESS);
          return;
        }
      } catch {
        // Not our format, fall through
      }

      // Fallback: try as raw sealed payload
      appendLog("system", "Payload format not recognized");
      setErrorMessage("Invalid payload format. Use the sealed payload from a Ghost Share execution.");
      setStatus(ExecutionStatus.ERROR);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      appendLog("system", `EXCEPTION: ${msg}`);
      setErrorMessage(msg);
      setStatus(ExecutionStatus.ERROR);
    }
  };

  const handleReset = () => {
    setStatus(ExecutionStatus.IDLE);
    setLogs([]);
    setLastResult(null);
    setErrorMessage(null);
  };

  // Identity object for compatibility with existing components
  const identity = walletPrivateKey
    ? {
        publicKeyBase64: walletPrivateKey.slice(0, 10) + "...",
        privateKeyBase64: walletPrivateKey,
        alias: "Ritual Wallet",
      }
    : null;

  return (
    <div className="h-screen w-screen flex flex-col font-sans bg-zinc-950 text-zinc-100 overflow-hidden relative">
      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(18,18,18,0.2)_1px,transparent_1px)] bg-[size:32px_32px] md:bg-[size:48px_48px] opacity-25" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[900px] h-[350px] bg-sky-950/5 blur-3xl rounded-full" />
        <div className="absolute bottom-0 left-0 right-0 h-[200px] bg-[radial-gradient(circle_at_bottom,rgba(15,15,15,0.4),transparent)] blur-xl" />
      </div>

      {/* Mobile header */}
      <div className="lg:hidden shrink-0 border-b border-zinc-900 bg-zinc-950/80 p-4 flex items-center justify-between z-40 select-none">
        <button
          onClick={() => { setMobileShowLeft(!mobileShowLeft); setMobileShowRight(false); }}
          className="text-zinc-400 hover:text-white p-1"
        >
          Menu
        </button>
        <span className="font-medium text-xs tracking-[0.2em] text-white">OBSIDIAN</span>
        <button
          onClick={() => { setMobileShowRight(!mobileShowRight); setMobileShowLeft(false); }}
          className="text-zinc-400 hover:text-white p-1"
        >
          Logs
        </button>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-row overflow-hidden relative z-10">
        {/* Left Panel */}
        <div className={`lg:w-[28%] lg:block shrink-0 h-full z-30 ${mobileShowLeft ? "absolute inset-y-0 left-0 w-[80%] max-w-[340px] shadow-2xl" : "hidden lg:block"}`}>
          <LeftPanel
            currentMode={currentMode}
            onModeChange={(mode) => { setCurrentMode(mode); setMobileShowLeft(false); handleReset(); }}
            identity={identity}
            onRegenerateIdentity={() => {}}
          />
        </div>

        {/* Backdrop */}
        {(mobileShowLeft || mobileShowRight) && (
          <div onClick={() => { setMobileShowLeft(false); setMobileShowRight(false); }} className="absolute inset-0 bg-black/65 z-20 cursor-pointer lg:hidden" />
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
            lastSealedPayloadUrl={lastResult?.txHash || null}
            lastSealedPayloadRaw={lastResult ? btoa(JSON.stringify(lastResult)) : null}
            decryptedSecret={lastResult?.decryptedOutput || null}
            errorMessage={errorMessage}
            preloadedPayload={null}
          />
        </div>

        {/* Right Panel */}
        <div className={`lg:w-[28%] lg:block shrink-0 h-full z-30 ${mobileShowRight ? "absolute inset-y-0 right-0 w-[85%] max-w-[340px] shadow-2xl" : "hidden lg:block"}`}>
          <LogsPanel logs={logs} currentStage={currentStage} status={status} />
        </div>
      </div>
    </div>
  );
}
