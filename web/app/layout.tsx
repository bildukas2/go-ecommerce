import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import packageJson from "@/package.json";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://volm.dev";
const webVersion = packageJson.version;
const siteTitle = `Volm v${webVersion}`;
const siteDescription = `Volm is a modern ecommerce storefront by ByteRan.com. Fast shopping, clean product discovery, and the current storefront release v${webVersion}.`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  applicationName: "Volm",
  authors: [{ name: "ByteRan", url: "https://byteran.com" }],
  creator: "ByteRan.com",
  publisher: "ByteRan.com",
  icons: {
    icon: [
      { url: "/img/Volm logo small.png", type: "image/png" },
      { url: "/img/favicon.png", type: "image/png" },
    ],
    apple: "/img/Volm logo small.png",
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    siteName: "Volm",
    type: "website",
    images: [
      {
        url: "/img/Volm logo small.png",
        width: 512,
        height: 512,
        alt: "Volm logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
    creator: "@ByteRanCom",
    images: ["/img/Volm logo small.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
