"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/sidebar-context";
import { useCommandPalette } from "@/components/command-palette";
import { Notifications } from "@/components/notifications";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserProfile } from "@/components/user-profile";
import { cn } from "@/lib/utils";

export function AppTopbar() {
  const { collapsed, toggle, setMobileOpen } = useSidebar();
  const { setOpen: openPalette } = useCommandPalette();

  function handleBurger() {
    if (window.matchMedia("(min-width: 768px)").matches) {
      toggle();
    } else {
      setMobileOpen(true);
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div
        className={cn(
          "hidden shrink-0 items-center border-r border-sidebar-border px-4 md:flex",
          collapsed ? "w-16 justify-center" : "w-60",
        )}
      >
        {collapsed ? (
          <Link
            href="/documents"
            aria-label="Gumijagoda"
            className="text-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            🫐
          </Link>
        ) : (
          <Link
            href="/documents"
            className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            aria-label="Gumijagoda - przejdź do rejestru dokumentów"
          >
            <span className="relative block h-10 w-[190px] shrink-0 overflow-hidden">
              <Image
                src="/gumijagody-transparent.png"
                alt=""
                width={260}
                height={146}
                preload
                unoptimized
                draggable={false}
                className="absolute top-[47%] left-1/2 h-auto w-[260px] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain select-none"
              />
            </span>
          </Link>
        )}
      </div>

      <div className="flex flex-1 items-center gap-3 px-4">
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-11 shrink-0 text-sidebar-foreground hover:bg-white/10 hover:text-sidebar-foreground md:size-7"
          onClick={handleBurger}
          aria-label="Przełącz nawigację"
        >
          <Menu className="size-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          className="size-11 shrink-0 text-sidebar-foreground hover:bg-white/10 hover:text-sidebar-foreground md:hidden"
          onClick={() => openPalette(true)}
          aria-label="Szukaj w aplikacji"
        >
          <Search className="size-4" />
        </Button>

        <button
          type="button"
          onClick={() => openPalette(true)}
          className="hidden h-8 w-72 items-center gap-2 rounded-md bg-white/10 px-3 text-sm text-sidebar-foreground/60 transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring md:flex"
        >
          <Search className="size-4 shrink-0" />
          <span className="truncate">Szukaj w aplikacji...</span>
          <kbd className="ml-auto shrink-0 rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">
            Ctrl+K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-3">
          <Notifications />
          <ThemeToggle />
          <UserProfile />
        </div>
      </div>
    </header>
  );
}
