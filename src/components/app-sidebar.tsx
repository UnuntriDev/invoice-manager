"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Inbox,
  Users,
  Settings,
  FolderTree,
  FileType2,
  Radio,
  Columns3,
} from "lucide-react";
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
  { href: "/settings/columns", label: "Kolumny", icon: Columns3 },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/documents" className="flex items-center gap-2 font-semibold">
          <span className="text-lg">🫐</span>
          <span>Gumijagoda</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        <div className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Menu
        </div>
        {mainNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              pathname.startsWith(item.href)
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}

        <div className="mb-2 mt-6 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Ustawienia
        </div>
        {settingsNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              pathname.startsWith(item.href)
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
