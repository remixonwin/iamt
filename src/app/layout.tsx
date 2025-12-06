import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/shared/contexts/AuthContext";
import { ChunkErrorReload } from "@/shared/components/ChunkErrorReload";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IAMT - Decentralized App",
  description: "A modular, TDD-first decentralized web application",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Polyfill for WebTorrent browser compatibility handled in next.config.mjs */}
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <AuthProvider>
          <ChunkErrorReload />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

