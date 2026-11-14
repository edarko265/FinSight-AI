import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SafeArea } from "@/components/layout/SafeArea";
import {
  PREFERENCES_BOOT_SCRIPT,
  PreferencesProvider,
} from "@/components/providers/PreferencesProvider";

import { ToastProvider } from "@/components/providers/ToastProvider";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FinSight-AI",
  description:
    "An explainable financial coach: understand your money, protect what matters, explore what you can change.",
  applicationName: "FinSight-AI",
  appleWebApp: { capable: true, title: "FinSight", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#004628",
};

export default function RootLayout({ children }: LayoutProps<"/">): React.JSX.Element {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFERENCES_BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <SafeArea />
        <PreferencesProvider>
          <ToastProvider>{children}</ToastProvider>
        </PreferencesProvider>
      </body>
    </html>
  );
}
