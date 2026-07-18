"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  FileType2,
  FolderTree,
  Inbox,
  Plus,
  Radio,
  Search,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue>({
  open: false,
  setOpen: () => {},
});

interface NavItem {
  href: string;
  label: string;
  icon: typeof FileText;
  group: string;
}

const navItems: NavItem[] = [
  { href: "/documents", label: "Dokumenty", icon: FileText, group: "Strony" },
  { href: "/buffer", label: "Bufor", icon: Inbox, group: "Strony" },
  { href: "/contractors", label: "Kontrahenci", icon: Users, group: "Strony" },
  { href: "/settings/categories", label: "Kategorie", icon: FolderTree, group: "Ustawienia" },
  { href: "/settings/document-types", label: "Typy dokumentów", icon: FileType2, group: "Ustawienia" },
  { href: "/settings/ksef", label: "KSeF / Harmonogram", icon: Radio, group: "Ustawienia" },
  { href: "/documents?action=add", label: "Dodaj dokument", icon: Plus, group: "Akcje" },
  { href: "/contractors?action=add", label: "Dodaj kontrahenta", icon: Plus, group: "Akcje" },
  { href: "/settings/categories?action=add", label: "Dodaj kategorię", icon: Plus, group: "Akcje" },
  { href: "/settings/document-types?action=add", label: "Dodaj typ dokumentu", icon: Plus, group: "Akcje" },
];

function CommandPaletteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const filtered = useMemo(() => {
    if (!query.trim()) return navItems;
    const q = query.toLowerCase();
    return navItems.filter((item) => item.label.toLowerCase().includes(q));
  }, [query]);

  const groups = useMemo(() => {
    const map = new Map<string, NavItem[]>();
    for (const item of filtered) {
      const list = map.get(item.group) || [];
      list.push(item);
      map.set(item.group, list);
    }
    return map;
  }, [filtered]);

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
      onOpenChange(false);
    },
    [router, onOpenChange],
  );

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    const active = listRef.current?.querySelector("[data-selected=true]");
    active?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered.length > 0) {
      e.preventDefault();
      const item = filtered[selectedIndex] ?? filtered[0];
      navigate(item.href);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 bg-black/10 supports-backdrop-filter:backdrop-blur-xs"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-label="Przejdź do…"
        className="fixed top-1/3 left-1/2 z-50 w-full max-w-[calc(100%-2rem)] -translate-x-1/2 overflow-hidden rounded-xl bg-popover p-0 text-sm text-popover-foreground ring-1 ring-foreground/10 shadow-lg sm:max-w-sm animate-in fade-in-0 zoom-in-95"
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Przejdź do…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleInputKeyDown}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div ref={listRef} className="max-h-72 overflow-y-auto p-1">
          {filtered.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Nie znaleziono wyników.
            </div>
          )}
          {Array.from(groups.entries()).map(([group, items], gi) => (
            <div key={group}>
              {gi > 0 && <div className="-mx-1 my-1 h-px bg-border" />}
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                {group}
              </div>
              {items.map((item) => {
                const flatIndex = filtered.indexOf(item);
                return (
                  <button
                    key={item.href}
                    type="button"
                    data-selected={flatIndex === selectedIndex}
                    onClick={() => navigate(item.href)}
                    onMouseEnter={() => setSelectedIndex(flatIndex)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none transition-colors",
                      flatIndex === selectedIndex
                        ? "bg-muted text-foreground"
                        : "text-foreground/80",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [openCount, setOpenCount] = useState(0);

  const handleOpen = useCallback((value: boolean) => {
    setOpen(value);
    if (value) setOpenCount((c) => c + 1);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => {
          const next = !prev;
          if (next) setOpenCount((c) => c + 1);
          return next;
        });
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <CommandPaletteContext.Provider value={{ open, setOpen: handleOpen }}>
      {children}
      <CommandPaletteDialog key={openCount} open={open} onOpenChange={setOpen} />
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  return useContext(CommandPaletteContext);
}
