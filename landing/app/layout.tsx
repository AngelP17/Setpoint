import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Setpoint — GitOps for the factory floor",
  description:
    "Setpoint is a Kubernetes operator that reconciles Modbus PLC registers the way Argo CD reconciles manifests. Drift detected, drift corrected, audit logged.",
  metadataBase: new URL("https://github.com/apinzon/setpoint-operator"),
  openGraph: {
    title: "Setpoint — GitOps for the factory floor",
    description:
      "Reconcile Modbus registers like you reconcile manifests. Per-register remediation. Verified by a one-command proof.",
    type: "website",
  },
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-ink-950 text-ink-100 antialiased">
        {children}
        <div className="noise" aria-hidden="true" />
      </body>
    </html>
  );
}
