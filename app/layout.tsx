import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CopilotKitProvider } from "./providers/CopilotKitProvider";
import { SessionProvider } from "./providers/SessionProvider";
import { ChatProvider } from "./contexts/ChatContext";
import "./globals.css";

// Force dynamic rendering so env vars are read at runtime, not build time
export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SERA",
  description: "AI Assistant",
};

export const viewport: Viewport = {
  themeColor: "#1a1915",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const seraApiUrl = process.env.SERA_API_URL ?? "http://localhost:3001";
  const runtimeUrl = `${seraApiUrl}/copilotkit`;

  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <SessionProvider>
          <CopilotKitProvider runtimeUrl={runtimeUrl}>
            <ChatProvider>{children}</ChatProvider>
          </CopilotKitProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
