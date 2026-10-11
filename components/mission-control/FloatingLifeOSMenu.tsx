"use client";

import { useState } from "react";

const destinations = [
  { href: "/", label: "Mission Control", hint: "Home" },
  { href: "/payroll", label: "Payroll Calculator", hint: "Estimate" },
  { href: "/payroll/forecast", label: "Payroll Forecast", hint: "Schedule" },
];

export default function FloatingLifeOSMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "fixed", zIndex: 1200, right: "max(16px, env(safe-area-inset-right))", bottom: "max(18px, env(safe-area-inset-bottom))", fontFamily: "Arial, sans-serif" }}>
      {open && (
        <nav aria-label="LifeOS quick navigation" style={{ width: "min(280px, calc(100vw - 32px))", marginBottom: 10, padding: 8, border: "1px solid rgba(255,213,79,.32)", borderRadius: 16, background: "rgba(8,11,20,.96)", boxShadow: "0 18px 48px rgba(0,0,0,.45)", backdropFilter: "blur(18px)" }}>
          <div style={{ padding: "8px 10px 10px", color: "#ff6a00", fontSize: 10, fontWeight: 800, letterSpacing: 2 }}>LIFEOS / QUICK NAV</div>
          {destinations.map((item) => (
            <a key={item.href} href={item.href} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 10px", borderRadius: 10, color: "#edf4ff", textDecoration: "none", borderTop: "1px solid rgba(255,255,255,.06)" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{item.label}</span>
              <span style={{ color: "#ffd54f", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>{item.hint}</span>
            </a>
          ))}
        </nav>
      )}
      <button type="button" aria-expanded={open} aria-label={open ? "Close LifeOS quick navigation" : "Open LifeOS quick navigation"} onClick={() => setOpen((value) => !value)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, minHeight: 52, padding: "0 17px", border: "1px solid rgba(255,213,79,.55)", borderRadius: 999, background: "linear-gradient(135deg, rgba(255,106,0,.98), rgba(255,213,79,.98))", color: "#080b14", boxShadow: "0 8px 28px rgba(255,106,0,.25)", fontSize: 12, fontWeight: 900, letterSpacing: ".06em", cursor: "pointer" }}>
        <span aria-hidden="true" style={{ fontSize: 17, lineHeight: 1 }}>{open ? "×" : "☰"}</span>
        <span>{open ? "CLOSE MENU" : "LIFEOS MENU"}</span>
      </button>
    </div>
  );
}
