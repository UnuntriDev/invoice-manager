"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider } from "@/components/sidebar-context";
import { CommandPaletteProvider } from "@/components/command-palette";
import { NotificationProvider } from "@/components/notification-context";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <SidebarProvider>
          <NotificationProvider>
            <CommandPaletteProvider>
              {children}
              <Toaster richColors position="top-right" />
            </CommandPaletteProvider>
          </NotificationProvider>
        </SidebarProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
