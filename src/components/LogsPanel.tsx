/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ExecutionStage, ExecutionStatus, RitualExecutionLog } from "../types";
import { Shield, Cpu, RefreshCw, Layers } from "lucide-react";

interface LogsPanelProps {
  logs: RitualExecutionLog[];
  currentStage: ExecutionStage;
  status: ExecutionStatus;
}

export function LogsPanel({ logs, currentStage, status }: LogsPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto scroll logs on new prints
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  // Stage list for flow indicator
  const stages = [
    { key: ExecutionStage.COMPOSE, label: "COMPOSE" },
    { key: ExecutionStage.ENCRYPT, label: "ENCRYPT" },
    { key: ExecutionStage.ATTEST, label: "ATTEST" },
    { key: ExecutionStage.TRANSMIT, label: "TRANSMIT" },
    { key: ExecutionStage.RECEIVE, label: "RECEIVE" },
  ];

  // Map stage to index for completion calculation
  const getStageIndex = (stage: ExecutionStage) => {
    return stages.findIndex((s) => s.key === stage);
  };

  const currentIndex = getStageIndex(currentStage);

  return (
    <div className="h-full flex flex-col bg-zinc-950/40 border-l border-zinc-900 overflow-hidden backdrop-blur-md">
      {/* 1. Header & Live Indicator */}
      <div className="p-4 border-b border-zinc-900 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <Layers className="w-3.5 h-3.5 text-zinc-500" />
          <span className="font-mono text-xs text-zinc-400 tracking-wider">RITUAL SECURE EXECUTION</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              status === ExecutionStatus.PROCESSING
                ? "bg-slate-300 animate-ping"
                : status === ExecutionStatus.SUCCESS
                ? "bg-emerald-500"
                : status === ExecutionStatus.ERROR
                ? "bg-red-500 animate-pulse"
                : "bg-zinc-700"
            }`}
          />
          <span className="font-mono text-[9px] text-zinc-500 tracking-widest uppercase">
            {status === ExecutionStatus.PROCESSING ? "Executing" : status.toLowerCase()}
          </span>
        </div>
      </div>

      {/* 2. Execution Flow Indicator */}
      <div className="p-5 border-b border-zinc-900 bg-zinc-950/20">
        <div className="flex items-center justify-between relative">
          {/* Background Connective Bar */}
          <div className="absolute left-1 right-1 top-3 h-[1px] bg-zinc-900 z-0" />

          {/* Connective progress bar */}
          <motion.div
            className="absolute left-1 top-3 h-[1px] bg-slate-300 z-0 origin-left"
            initial={{ scaleX: 0 }}
            animate={{
              scaleX:
                status === ExecutionStatus.SUCCESS
                  ? 1
                  : status === ExecutionStatus.ERROR
                  ? currentIndex / (stages.length - 1) * 0.8
                  : currentIndex / (stages.length - 1),
            }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            style={{ width: "98%" }}
          />

          {stages.map((st, idx) => {
            const isCompleted = idx < currentIndex || status === ExecutionStatus.SUCCESS;
            const isActive = idx === currentIndex && status !== ExecutionStatus.SUCCESS;
            const isStageError = idx === currentIndex && status === ExecutionStatus.ERROR;

            return (
              <div key={st.key} className="flex flex-col items-center relative z-10 w-12">
                {/* Visual Circle Node */}
                <motion.div
                  className={`w-6.5 h-6.5 rounded-full flex items-center justify-center border text-[9px] font-mono select-none transition-colors duration-500 ${
                    isStageError
                      ? "bg-red-950 border-red-500 text-red-100"
                      : isCompleted
                      ? "bg-zinc-100 border-white text-zinc-950 shadow-[0_0_10px_rgba(255,255,255,0.15)]"
                      : isActive
                      ? "bg-black border-slate-300 text-white animate-pulse"
                      : "bg-zinc-950 border-zinc-900 text-zinc-650"
                  }`}
                  whileHover={{ scale: 1.05 }}
                >
                  {isStageError ? "!" : isCompleted ? "✓" : `0${idx + 1}`}
                </motion.div>

                {/* Micro Node labels */}
                <span
                  className={`mt-2 font-mono text-[8px] tracking-wider transition-colors duration-500 ${
                    isStageError
                      ? "text-red-400 font-medium"
                      : isCompleted
                      ? "text-zinc-300"
                      : isActive
                      ? "text-zinc-200 font-medium"
                      : "text-zinc-600"
                  }`}
                >
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. System Specs Enclave Grid */}
      <div className="px-5 py-3.5 border-b border-zinc-900 bg-zinc-950/35 grid grid-cols-2 gap-4 font-mono text-[9px] text-zinc-500">
        <div className="flex items-center space-x-2">
          <Shield className="w-3 h-3 text-zinc-650 select-none" />
          <div>
            <span className="block text-[8px] text-zinc-600 tracking-wider">ENCLAVE DEPLOYMENT</span>
            <span className="text-zinc-300">Intel SGX-v2 [MRENCLAVE]</span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Cpu className="w-3 h-3 text-zinc-650 select-none" />
          <div>
            <span className="block text-[8px] text-zinc-600 tracking-wider">COMPUTE INSTANCE</span>
            <span className="text-zinc-300">Ritual TEE-Host C320</span>
          </div>
        </div>
      </div>

      {/* 4. Scrollable Logs Core */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-5 space-y-2.5 font-mono text-[10.5px] leading-relaxed custom-scrollbar scroll-smooth"
      >
        <AnimatePresence initial={false}>
          {logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-zinc-600">
              <RefreshCw className="w-5 h-5 mb-2.5 stroke-[1.25] text-zinc-700 select-none" />
              <p className="max-w-[180px] text-[10px] tracking-wider font-mono">
                AWAITING ENCLAVE EXHAUST FOR REALTIME TELEMETRY RECONSTRUCTION...
              </p>
            </div>
          ) : (
            logs.map((log, i) => {
              const LogTag = log.tag.toUpperCase();

              // Coloring tags
              let tagColor = "text-zinc-500 bg-zinc-900/40 border-zinc-800/60";
              if (log.tag === "crypto") tagColor = "text-slate-300 bg-slate-950 border-slate-900";
              else if (log.tag === "attest") tagColor = "text-zinc-200 bg-zinc-900/50 border-zinc-800";
              else if (log.tag === "network") tagColor = "text-zinc-400 bg-zinc-900/30 border-zinc-850";
              else if (log.tag === "system" && log.message.includes("ERROR")) tagColor = "text-red-400 bg-red-950/25 border-red-900/30";

              if (log.isHeader) {
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15 }}
                    className="pt-2.5 text-zinc-400 border-b border-zinc-900 pb-1.5 flex items-center justify-between font-mono font-medium tracking-wider text-[11px]"
                  >
                    <span>{log.message}</span>
                    <span className="text-[9px] text-zinc-600">{log.timestamp}</span>
                  </motion.div>
                );
              }

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.1 }}
                  className="flex items-start space-x-2 w-full text-zinc-300 hover:bg-zinc-900/10 p-1 rounded transition-colors duration-150"
                >
                  {/* Print tag */}
                  <span className={`px-1.5 py-0.5 rounded text-[8px] border shrink-0 tracking-wider font-medium uppercase select-none ${tagColor}`}>
                    {LogTag}
                  </span>

                  {/* Message body */}
                  <span className="break-all whitespace-pre-wrap flex-1">{log.message}</span>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* 5. Command Line Status line */}
      <div className="p-3 border-t border-zinc-900 bg-zinc-950/55 font-mono text-[9px] text-zinc-650 flex justify-between select-none">
        <span>ENCLAVE_SYSTEM_RECOVERY: STANDBY_NET</span>
        <span className="animate-pulse">● AGENT_ONLINE [UTC]</span>
      </div>
    </div>
  );
}
