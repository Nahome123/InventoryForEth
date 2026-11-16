import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Noto_Sans_Ethiopic, Space_Grotesk } from "next/font/google";
import { Translator } from "@/components/translator";
import { getLang } from "@/lib/i18n/server";
import "./globals.css";

const heading = Space_Grotesk({ subsets: ["latin"], variable: "--font-heading", display: "swap" });
const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const code = JetBrains_Mono({ subsets: ["latin"], variable: "--font-code", display: "swap" });
const ethiopic = Noto_Sans_Ethiopic({ subsets: ["ethiopic"], variable: "--font-ethiopic", display: "swap" });

// Every page reads the session and live data, so nothing is prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Store ERP", template: "%s · Store ERP" },
  description: "Inventory, sales, customer orders and demand analytics for a family retail shop.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f0f3" },
    { media: "(prefers-color-scheme: dark)", color: "#141316" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang} data-lang={lang} className={`${heading.variable} ${body.variable} ${code.variable} ${ethiopic.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        {children}
        <Translator lang={lang} />
      </body>
    </html>
  );
}
