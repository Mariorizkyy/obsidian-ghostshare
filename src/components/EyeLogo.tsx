/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { ExecutionStatus } from "../types";

interface EyeLogoProps {
  status: ExecutionStatus;
}

export function EyeLogo({ status }: EyeLogoProps) {
  // Define animation parameters based on execution status
  const isIdle = status === ExecutionStatus.IDLE;
  const isProcessing = status === ExecutionStatus.PROCESSING;
  const isSuccess = status === ExecutionStatus.SUCCESS;
  const isError = status === ExecutionStatus.ERROR;

  return (
    <div className="relative flex flex-col items-center justify-center p-8 select-none">
      {/* Dynamic Background Outer Rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* Deep Ambient Aura */}
        <motion.div
          animate={
            isProcessing
              ? { scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }
              : isSuccess
              ? { scale: 1.4, opacity: [0.1, 0.8, 0.1] }
              : isError
              ? { scale: [1, 0.9, 1.1, 1], opacity: [0.2, 0.5, 0.2] }
              : { scale: [0.95, 1.05, 0.95], opacity: [0.15, 0.25, 0.15] }
          }
          transition={{
            duration: isProcessing ? 1.5 : isSuccess ? 2 : 4,
            repeat: isSuccess ? 0 : Infinity,
            ease: "easeInOut",
          }}
          className={`w-64 h-64 rounded-full blur-3xl transition-colors duration-1000 ${
            isSuccess
              ? "bg-slate-300"
              : isError
              ? "bg-red-950/30"
              : isProcessing
              ? "bg-zinc-800"
              : "bg-zinc-950"
          }`}
        />

        {/* Orbit Ring 1 */}
        <motion.div
          animate={{ rotate: isProcessing ? 360 : 45 }}
          transition={{
            duration: isProcessing ? 3 : 25,
            repeat: Infinity,
            ease: "linear",
          }}
          className={`absolute w-48 h-48 rounded-full border border-dashed transition-colors duration-700 ${
            isSuccess
              ? "border-slate-500/35"
              : isError
              ? "border-red-900/30"
              : isProcessing
              ? "border-slate-300/40"
              : "border-zinc-800/40"
          }`}
        />

        {/* Orbit Ring 2 */}
        <motion.div
          animate={{ rotate: isProcessing ? -360 : -45 }}
          transition={{
            duration: isProcessing ? 6 : 40,
            repeat: Infinity,
            ease: "linear",
          }}
          className={`absolute w-36 h-36 rounded-full border transition-colors duration-700 ${
            isSuccess
              ? "border-slate-400/20"
              : isError
              ? "border-red-800/10"
              : isProcessing
              ? "border-zinc-500/30"
              : "border-zinc-900/10"
          }`}
        />
      </div>

      {/* Main Eye Assembly */}
      <motion.div
        animate={
          isError
            ? { x: [-3, 3, -2, 2, 0], y: [1, -1, 2, -2, 0] }
            : isSuccess
            ? { scale: [1, 1.05, 1] }
            : {}
        }
        transition={{
          duration: isError ? 0.3 : 1,
          repeat: isError ? Infinity : 0,
        }}
        className="relative w-40 h-28 flex items-center justify-center overflow-hidden"
      >
        <svg
          viewBox="0 0 100 60"
          className={`w-full h-full transition-colors duration-500 ${
            isSuccess
              ? "text-slate-200"
              : isError
              ? "text-red-500/85"
              : isProcessing
              ? "text-slate-300"
              : "text-zinc-650"
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        >
          {/* Outer Eyelid Frame */}
          <motion.path
            d="M 5,30 C 25,5 75,5 95,30 C 75,55 25,55 5,30 Z"
            fill="rgba(10, 10, 10, 0.45)"
            strokeWidth="0.75"
            className="transition-colors duration-500"
          />

          {/* Sclera & Iris Ring */}
          <motion.circle
            cx="50"
            cy="30"
            r="16"
            className="transition-all duration-300"
            stroke="currentColor"
            strokeWidth="0.5"
            strokeDasharray={isProcessing ? "4, 2" : "none"}
            fill="none"
          />

          {/* Living Inner Ring */}
          <motion.circle
            cx="50"
            cy="30"
            r="11"
            className="transition-all duration-300"
            stroke="currentColor"
            strokeWidth="1.2"
            fill="none"
            animate={
              isProcessing
                ? { scale: [0.9, 1.1, 0.9], opacity: [0.7, 1, 0.7] }
                : isIdle
                ? { scale: [0.98, 1.02, 0.98] }
                : {}
            }
            transition={{
              duration: isProcessing ? 1 : 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* Pupil Center */}
          <motion.circle
            cx="50"
            cy="30"
            r="5"
            className={`transition-all duration-300 ${
              isError ? "fill-red-650" : isSuccess ? "fill-slate-100" : "fill-zinc-400"
            }`}
            animate={
              isProcessing
                ? { r: [4.5, 5.5, 4.5] }
                : isIdle
                ? {
                    scaleY: [1, 1, 0.05, 1, 1, 1], // Spontaneous physiological eyelid blink
                  }
                : {}
            }
            transition={{
              duration: isProcessing ? 0.8 : 5,
              repeat: Infinity,
              times: [0, 0.45, 0.47, 0.5, 0.55, 1],
              ease: "easeInOut",
            }}
          />

          {/* Geometric Crosshair Alignment Guidelines */}
          {isProcessing && (
            <>
              <line x1="15" y1="30" x2="85" y2="30" stroke="currentColor" strokeWidth="0.1" strokeDasharray="1, 1" />
              <line x1="50" y1="5" x2="50" y2="55" stroke="currentColor" strokeWidth="0.1" strokeDasharray="1, 1" />
            </>
          )}
        </svg>

        {/* Real-time Intel SGX / Ritual Confining Laser Scanning Beam */}
        {isProcessing && (
          <motion.div
            initial={{ top: "15%" }}
            animate={{ top: "85%" }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut",
            }}
            className="absolute left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-slate-100/70 to-transparent pointer-events-none drop-shadow-[0_0_2px_rgba(255,255,255,0.8)]"
          />
        )}
      </motion.div>

      {/* Status Metadata Labels */}
      <div className="mt-4 flex flex-col items-center">
        <motion.span
          key={status}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-mono text-[10px] tracking-[0.25em] h-4 flex items-center select-none"
        >
          {isSuccess && <span className="text-slate-300">SECURE ENCLAVE SEALED</span>}
          {isError && <span className="text-red-500 font-medium">ATTESTATION DISRUPTED</span>}
          {isProcessing && <span className="text-zinc-300 animate-pulse">EXECUTING ATTESTATION...</span>}
          {isIdle && <span className="text-zinc-500">ENCLAVE STANDBY / COLD LOCK</span>}
        </motion.span>
      </div>
    </div>
  );
}
