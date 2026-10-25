import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrustVault - Secure Document Sharing Platform",
  description: "Enterprise Document Management with Verifiable Cryptographic Audit Trails and Server-Enforced Zero-Trust Security",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
