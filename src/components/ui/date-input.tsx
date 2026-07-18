"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Calendar } from "lucide-react";

interface DateInputProps {
  id?: string;
  value: string;
  onChange: (isoValue: string) => void;
  min?: string;
  max?: string;
  className?: string;
  required?: boolean;
}

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return "";
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

export function displayDateToIso(display: string): string | null {
  const match = display.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${y}-${m}-${d}`;
}

export function DateInput({
  id,
  value,
  onChange,
  min,
  max,
  className,
  required,
}: DateInputProps) {
  const dateRef = useRef<HTMLInputElement>(null);
  const [localText, setLocalText] = useState("");
  const [editing, setEditing] = useState(false);

  const displayValue = isoToDisplay(value);

  function handleFocus() {
    setLocalText(displayValue);
    setEditing(true);
  }

  function handleBlur() {
    setEditing(false);
    if (localText === "") {
      onChange("");
      return;
    }
    const iso = displayDateToIso(localText);
    if (iso) onChange(iso);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^\d.]/g, "");
    setLocalText(raw);
    const iso = displayDateToIso(raw);
    if (iso) onChange(iso);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        required={required}
        aria-required={required}
        aria-invalid={
          editing && localText.length === 10 && !displayDateToIso(localText)
        }
        placeholder="DD.MM.RRRR"
        className={className}
        value={editing ? localText : displayValue}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={() => dateRef.current?.showPicker?.()}
        aria-label="Otwórz kalendarz"
      >
        <Calendar className="h-4 w-4" />
      </button>
      <input
        ref={dateRef}
        type="date"
        className="pointer-events-none absolute inset-0 opacity-0"
        tabIndex={-1}
        aria-hidden="true"
        value={value || ""}
        required={required}
        min={min}
        max={max}
        onChange={(e) => {
          onChange(e.target.value);
          setEditing(false);
        }}
      />
    </div>
  );
}
