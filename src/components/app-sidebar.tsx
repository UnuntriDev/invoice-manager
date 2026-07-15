"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  FileType2,
  FolderTree,
  Inbox,
  Menu,
  Radio,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const mainNav = [
  { href: "/documents", label: "Dokumenty", icon: FileText },
  { href: "/buffer", label: "Bufor", icon: Inbox },
  { href: "/contractors", label: "Kontrahenci", icon: Users },
];

const settingsNav = [
  { href: "/settings/categories", label: "Kategorie", icon: FolderTree },
  { href: "/settings/document-types", label: "Typy dokumentów", icon: FileType2 },
  { href: "/settings/ksef", label: "KSeF / Harmonogram", icon: Radio },
];

function Brand({ onDark = false }: { onDark?: boolean }) {
  return (
    <Link
      href="/documents"
      className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      aria-label="Gumijagoda - przejdź do rejestru dokumentów"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="10.5"
            cy="14"
            r="5.25"
            fill="currentColor"
          />
          <path
            d="M12.8 8.2c1.45-2.7 4.05-3.75 6.35-3.1-.25 2.9-2.25 4.95-5.65 5.1"
            fill="currentColor"
          />
          <path
            d="M11.9 10.1c.55-1.45 1.45-2.65 2.75-3.55"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="8.75" cy="12.5" r="0.9" fill="var(--primary)" />
        </svg>
      </span>
      <span
        className={cn(
          "text-[15px] leading-none font-semibold tracking-[-0.01em]",
          onDark ? "text-sidebar-foreground" : "text-foreground"
        )}
      >
        Gumijagoda
      </span>
    </Link>
  );
}

function Navigation({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const renderLink = (item: (typeof mainNav)[number]) => {
    const active = pathname.startsWith(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
        className={cn(
          "flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          active
            ? "bg-primary text-primary-foreground"
            : "text-sidebar-foreground/80 hover:bg-white/10 hover:text-sidebar-foreground"
        )}
      >
        <item.icon className="size-4" aria-hidden="true" />
        {item.label}
      </Link>
    );
  };

  return (
    <nav aria-label="Główna nawigacja" className="flex flex-1 flex-col gap-1 p-3">
      <div className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
        Menu
      </div>
      {mainNav.map(renderLink)}

      <div className="mb-1 mt-6 px-2 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
        Ustawienia
      </div>
      {settingsNav.map(renderLink)}
    </nav>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4 md:hidden">
        <Brand />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Otwórz menu nawigacji"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="size-5" aria-hidden="true" />
        </Button>
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[18rem] gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground sm:max-w-[18rem]"
        >
          <SheetHeader className="border-b border-sidebar-border">
            <SheetTitle className="text-sidebar-foreground">
              <Brand onDark />
            </SheetTitle>
          </SheetHeader>
          <Navigation pathname={pathname} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <aside className="hidden h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <Brand onDark />
        </div>
        <Navigation pathname={pathname} />
      </aside>
    </>
  );
}
