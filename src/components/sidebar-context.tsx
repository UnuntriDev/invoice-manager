"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

interface SidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  toggle: () => {},
  mobileOpen: false,
  setMobileOpen: () => {},
});

const STORAGE_KEY = "sidebar-collapsed";

let sidebarListeners: (() => void)[] = [];

function subscribeSidebar(cb: () => void) {
  sidebarListeners = [...sidebarListeners, cb];
  return () => {
    sidebarListeners = sidebarListeners.filter((l) => l !== cb);
  };
}

function getSidebarSnapshot() {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

function getSidebarServerSnapshot() {
  return false;
}

function setSidebarValue(value: boolean) {
  localStorage.setItem(STORAGE_KEY, String(value));
  sidebarListeners.forEach((l) => l());
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const collapsed = useSyncExternalStore(
    subscribeSidebar,
    getSidebarSnapshot,
    getSidebarServerSnapshot,
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggle = useCallback(() => {
    setSidebarValue(!getSidebarSnapshot());
  }, []);

  return (
    <SidebarContext.Provider
      value={{ collapsed, toggle, mobileOpen, setMobileOpen }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
