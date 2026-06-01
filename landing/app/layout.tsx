import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Setpoint | GitOps for the factory floor",
  description:
    "Setpoint is a Kubernetes operator that reconciles Modbus PLC registers the way Argo CD reconciles manifests. Drift detected, drift corrected, audit logged.",
  metadataBase: new URL("https://github.com/apinzon/setpoint-operator"),
  openGraph: {
    title: "Setpoint | GitOps for the factory floor",
    description:
      "Reconcile Modbus registers like you reconcile manifests. Per-register remediation. Verified by a one-command proof.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable} bg-ink-950 text-ink-100 antialiased font-sans`}>
        {children}
        <div className="noise" aria-hidden="true" />
      </body>
    </html>
  );
}
