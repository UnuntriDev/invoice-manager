"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";
import {
  FileText,
  Users,
  FolderTree,
  FileType2,
  Radio,
  Inbox,
  Check,
  Trash2,
  Pencil,
  Settings,
} from "lucide-react";

export interface AppNotification {
  id: string;
  icon: LucideIcon;
  iconColor: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  createdAt: number;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  add: (n: Pick<AppNotification, "title" | "description"> & { icon?: LucideIcon; iconColor?: string }) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  add: () => {},
  markRead: () => {},
  markAllRead: () => {},
  remove: () => {},
  clearAll: () => {},
});

const categoryIcons: Record<string, { icon: LucideIcon; color: string }> = {
  dokument: { icon: FileText, color: "text-blue-500" },
  kontrahent: { icon: Users, color: "text-violet-500" },
  kategori: { icon: FolderTree, color: "text-amber-500" },
  typ: { icon: FileType2, color: "text-orange-500" },
  bufor: { icon: Inbox, color: "text-cyan-500" },
  ksef: { icon: Radio, color: "text-emerald-500" },
  harmonogram: { icon: Settings, color: "text-emerald-500" },
  zaakceptowano: { icon: Check, color: "text-emerald-500" },
  usunięto: { icon: Trash2, color: "text-red-500" },
  usunięt: { icon: Trash2, color: "text-red-500" },
  zaktualizow: { icon: Pencil, color: "text-blue-500" },
  kolumn: { icon: Settings, color: "text-gray-500" },
};

function inferIcon(title: string): { icon: LucideIcon; color: string } {
  const lower = title.toLowerCase();
  for (const [key, value] of Object.entries(categoryIcons)) {
    if (lower.includes(key)) return value;
  }
  return { icon: Check, color: "text-emerald-500" };
}

function formatTime(createdAt: number): string {
  const diff = Date.now() - createdAt;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "teraz";
  if (mins < 60) return `${mins} min temu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} godz. temu`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "wczoraj";
  return `${days} dni temu`;
}

const STORAGE_KEY = "gj:notifications";

interface StoredNotification {
  id: string;
  title: string;
  description: string;
  read: boolean;
  createdAt: number;
}

function hydrate(stored: StoredNotification[]): AppNotification[] {
  return stored.map((n) => {
    const inferred = inferIcon(n.title);
    return {
      ...n,
      icon: inferred.icon,
      iconColor: inferred.color,
      time: formatTime(n.createdAt),
    };
  });
}

const EMPTY: AppNotification[] = [];
let store: AppNotification[] = EMPTY;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  for (const listener of listeners) listener();
}

function persist() {
  if (typeof window === "undefined") return;
  const stored: StoredNotification[] = store.map((n) => ({
    id: n.id,
    title: n.title,
    description: n.description,
    read: n.read,
    createdAt: n.createdAt,
  }));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

function loadInitial() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as StoredNotification[];
    store = hydrate(parsed);
  } catch {
    store = EMPTY;
  }
}

let initialized = false;
function ensureInitialized() {
  if (initialized) return;
  initialized = true;
  loadInitial();
}

function getSnapshot() {
  return store;
}

function getServerSnapshot() {
  return EMPTY;
}

const actions = {
  add(n: Pick<AppNotification, "title" | "description"> & { icon?: LucideIcon; iconColor?: string }) {
    const inferred = inferIcon(n.title);
    const createdAt = Date.now();
    const notification: AppNotification = {
      id: crypto.randomUUID(),
      icon: n.icon ?? inferred.icon,
      iconColor: n.iconColor ?? inferred.color,
      title: n.title,
      description: n.description,
      time: formatTime(createdAt),
      read: false,
      createdAt,
    };
    store = [notification, ...store];
    persist();
    emit();
  },
  markRead(id: string) {
    store = store.map((n) => (n.id === id ? { ...n, read: true } : n));
    persist();
    emit();
  },
  markAllRead() {
    store = store.map((n) => ({ ...n, read: true }));
    persist();
    emit();
  },
  remove(id: string) {
    store = store.filter((n) => n.id !== id);
    persist();
    emit();
  },
  clearAll() {
    store = EMPTY;
    persist();
    emit();
  },
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  ensureInitialized();
  const notifications = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const value = useMemo(
    () => ({ notifications, unreadCount, ...actions }),
    [notifications, unreadCount],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
