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

const title = `${BRAND_NAME} — The Neutral Escrow Bridge for Social Commerce`;
const description =
  `${BRAND_NAME} holds buyer funds securely at the midpoint until doorstep delivery is verified. Fast, link-based escrow for WhatsApp & Instagram trade in Nigeria.`;

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
