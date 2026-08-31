import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { WalletProvider, type WalletProviderConfig } from "@1sat/react";
import type { WalletInterface } from "@bsv/sdk";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";

const APP_NAME = "Emberhall";

function developmentWalletProviders(): WalletProviderConfig[] | undefined {
  if (!import.meta.env.DEV || typeof window === "undefined") return undefined;
  const wallet = (window as Window & { __EMBERHALL_SMOKE_WALLET__?: WalletInterface }).__EMBERHALL_SMOKE_WALLET__;
  if (!wallet) return undefined;
  return [{
    type: "emberhall-smoke",
    name: "Emberhall smoke wallet",
    connect: async () => ({ wallet, provider: "emberhall-smoke", identityKey: `02${"1".repeat(64)}`, disconnect: () => {} }),
  }];
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "theme-color", content: "#141210" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg text-fg">
        <PreviewHostBridge />
        <AuthProvider>
          <WalletProvider autoDetect autoReconnect providers={developmentWalletProviders()}>
            <Outlet />
          </WalletProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
