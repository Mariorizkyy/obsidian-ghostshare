// ─────────────────────────────────────────────────────────────
//  OBSIDIAN — WalletProvider
//  Wrap your app root with this.
//
//  Next.js (app router):
//    export default function RootLayout({ children }) {
//      return <WalletProvider>{children}</WalletProvider>
//    }
//
//  Next.js (pages router) / Vite:
//    ReactDOM.createRoot(...).render(
//      <WalletProvider><App /></WalletProvider>
//    )
// ─────────────────────────────────────────────────────────────

"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "../config/wagmi";

const queryClient = new QueryClient();

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
