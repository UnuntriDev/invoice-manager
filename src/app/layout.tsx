import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppSidebar } from "@/components/app-sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gumijagoda — Zarządzanie fakturami",
  description: "System zarządzania fakturami dla Gumijagoda Sp. z o.o.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl-PL"
      className={`${geistSans.className} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-full flex-col md:flex-row">
        <Providers>
          <AppSidebar />
          <main className="min-w-0 flex-1 overflow-auto">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
