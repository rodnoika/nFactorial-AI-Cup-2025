import { Inter } from "next/font/google";
import { SessionProvider } from 'next-auth/react';
import { ChatProvider } from '@/contexts/ChatContext';
import { EmailProvider } from '@/contexts/EmailContext';
import { Providers } from "@/app/providers";
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
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <SessionProvider>
            <EmailProvider>
              <ChatProvider>
                {children}
              </ChatProvider>
            </EmailProvider>
          </SessionProvider>
        </Providers>
      </body>
    </html>
  );
} 