"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: string[];
  options: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
};

export default function MultiSelectDropdown({ value, options, onChange, disabled, placeholder = "Select options" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const selected = value.map(String);
  const label = selected.length ? (selected.length <= 2 ? selected.join(", ") : selected.slice(0, 2).join(", ") + " +" + (selected.length - 2)) : placeholder;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" className="command-input" disabled={disabled} onClick={() => setOpen(v => !v)} aria-expanded={open} style={{ width: "100%", textAlign: "left", cursor: disabled ? "default" : "pointer" }}>
        <span>{label}</span><span style={{ float: "right", opacity: 0.75 }}>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div role="listbox" aria-multiselectable="true" className="card" style={{ position: "absolute", zIndex: 50, left: 0, right: 0, top: "calc(100% + 6px)", padding: 10, maxHeight: 240, overflowY: "auto" }}>
          {options.length ? options.map(option => {
            const checked = selected.includes(option);
            return (
              <label key={option} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 6px", cursor: "pointer" }}>
                <input type="checkbox" checked={checked} onChange={() => onChange(checked ? selected.filter(x => x !== option) : [...selected, option])} />
                <span>{option}</span>
              </label>
            );
          }) : <div className="row-meta" style={{ padding: 8 }}>No options available.</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" className="action primary" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
