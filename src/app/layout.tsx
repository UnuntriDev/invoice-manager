import type { Metadata } from "next";
import { Geist_Mono, Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppTopbar } from "@/components/app-topbar";
import { AppSidebar } from "@/components/app-sidebar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "🫐 gumijagody - zarządzanie fakturami",
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
      suppressHydrationWarning
      className={`${inter.className} ${inter.variable} ${playfairDisplay.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-full flex-col">
        <Providers>
          <AppTopbar />
          <div className="flex min-h-0 flex-1">
            <AppSidebar />
            <main className="min-w-0 flex-1 overflow-hidden bg-card md:bg-transparent md:p-3">
              <div className="h-full overflow-auto md:rounded-2xl md:bg-card md:shadow-sm">
                {children}
              </div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
