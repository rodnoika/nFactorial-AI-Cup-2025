import { Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";
import type { Metadata } from 'next'

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gmail AI Assistant",
  description: "AI-powered Gmail assistant for better email management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
} 