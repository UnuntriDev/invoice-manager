"use client";

import { useEffect, useRef } from "react";
import { Bell, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/components/notification-context";
import { useState } from "react";

export function Notifications() {
  const { notifications, unreadCount, markRead, markAllRead, remove, clearAll } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex size-11 items-center justify-center rounded-md text-sidebar-foreground transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring md:size-9"
        aria-label={`Powiadomienia${unreadCount > 0 ? ` (${unreadCount} nieprzeczytanych)` : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 animate-in fade-in-0 zoom-in-95">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Powiadomienia
            </span>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Przeczytane
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Wyczyść
                </button>
              )}
            </div>
          </div>
          <div className="my-1 h-px bg-border" />
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Brak powiadomień
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "group/item flex w-full items-start gap-3 rounded-md p-2 text-left transition-colors hover:bg-accent",
                    !n.read && "bg-accent/50",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => markRead(n.id)}
                    className="flex min-w-0 flex-1 items-start gap-3"
                  >
                    <n.icon
                      className={cn("mt-0.5 size-4 shrink-0", n.iconColor)}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span
                        className={cn(
                          "text-sm leading-tight",
                          !n.read && "font-medium",
                        )}
                      >
                        {n.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {n.description}
                      </span>
                      <span className="text-xs text-muted-foreground/70">
                        {n.time}
                      </span>
                    </div>
                    {!n.read && (
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(n.id)}
                    className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/item:opacity-100"
                    aria-label={`Usuń powiadomienie: ${n.title}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
