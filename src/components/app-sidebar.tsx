"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  FileType2,
  FolderTree,
  Inbox,
  Radio,
  Users,
  Wand2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/sidebar-context";

const mainNav = [
  { href: "/documents", label: "Dokumenty", icon: FileText },
  { href: "/buffer", label: "Bufor", icon: Inbox },
  { href: "/contractors", label: "Kontrahenci", icon: Users },
];

const settingsNav = [
  { href: "/settings/categories", label: "Kategorie", icon: FolderTree },
  { href: "/settings/document-types", label: "Typy dokumentów", icon: FileType2 },
  { href: "/settings/categorization-rules", label: "Reguły kategoryzacji", icon: Wand2 },
  { href: "/settings/ksef", label: "KSeF / Harmonogram", icon: Radio },
];

function Brand() {
  return (
    <Link
      href="/documents"
      className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
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
  );
}

function NavLink({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: (typeof mainNav)[number];
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const active = pathname.startsWith(item.href);

  const linkClasses = cn(
    "flex min-h-10 items-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
    collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
    active
      ? "bg-primary text-primary-foreground"
      : "text-sidebar-foreground/80 hover:bg-white/10 hover:text-sidebar-foreground",
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
              className={linkClasses}
            />
          }
        >
          <item.icon className="size-4 shrink-0" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={linkClasses}
    >
      <item.icon className="size-4 shrink-0" aria-hidden="true" />
      {item.label}
    </Link>
  );
}

function Navigation({
  pathname,
  collapsed,
  onNavigate,
}: {
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const content = (
    <nav
      aria-label="Główna nawigacja"
      className={cn(
        "flex flex-1 flex-col gap-1 pb-3 pt-5",
        collapsed ? "items-center px-2" : "px-3",
      )}
    >
      {!collapsed && (
        <div className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
          Menu
        </div>
      )}
      {mainNav.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          pathname={pathname}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      ))}

      {collapsed ? (
        <div className="my-3 h-px w-8 bg-sidebar-border" />
      ) : (
        <div className="mb-1 mt-6 px-2 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
          Ustawienia
        </div>
      )}
      {settingsNav.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          pathname={pathname}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );

  if (collapsed) {
    return <TooltipProvider>{content}</TooltipProvider>;
  }

  return content;
}

export function AppSidebar() {
  const pathname = usePathname();
  const { collapsed, mobileOpen, setMobileOpen } = useSidebar();

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-black/10 supports-backdrop-filter:backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <div
            id="app-sidebar-mobile"
            className="fixed inset-y-0 left-0 z-50 flex h-full w-[18rem] flex-col gap-0 border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground shadow-lg animate-in slide-in-from-left"
          >
            <div className="flex flex-col gap-0.5 border-b border-sidebar-border p-4">
              <Brand />
            </div>
            <Navigation pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <aside
        className={cn(
          "hidden h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <Navigation pathname={pathname} collapsed={collapsed} />
      </aside>
    </>
  );
}
