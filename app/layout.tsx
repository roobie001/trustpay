import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BRAND_NAME } from "@/lib/constants";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = `${BRAND_NAME} — Peer-to-Peer Social Commerce Escrow`;
const description =
  `${BRAND_NAME} locks buyer funds safely at the neutral midpoint until doorstep delivery is confirmed. Fast, mobile-first escrow for WhatsApp & Instagram trade.`;

export const metadata: Metadata = {
  title: {
    template: `%s | ${BRAND_NAME}`,
    default: title,
  },
  description,
  openGraph: {
    title,
    description,
    siteName: BRAND_NAME,
    type: "website",
    locale: "en_NG",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#030712] text-slate-100 antialiased selection:bg-amber-500/20 selection:text-amber-300">
        {children}
      </body>
    </html>
  );
}
