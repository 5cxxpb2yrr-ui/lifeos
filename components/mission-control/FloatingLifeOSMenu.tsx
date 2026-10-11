"use client";

import { useState } from "react";

const destinations = [
  { href: "/", label: "Mission Control", hint: "Home" },
  { href: "/payroll", label: "Payroll Calculator", hint: "Finance" },
  { href: "/payroll/forecast", label: "Payroll Forecast", hint: "Finance" },
];

export default function FloatingLifeOSMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close LifeOS navigation"
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 53, border: 0, background: "rgba(0,0,0,.28)" }}
          />
          <nav
            aria-label="LifeOS navigation"
            style={{
              position: "fixed", left: 14, top: 88, bottom: 82,
              zIndex: 54, width: "min(330px, calc(100vw - 28px))",
              overflow: "auto", padding: 14, border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 20, background: "rgba(8,11,20,.96)",
              boxShadow: "0 24px 80px rgba(0,0,0,.5)", backdropFilter: "blur(22px)",
              color: "#edf4ff", fontFamily: "Arial, sans-serif",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ color: "#00e5ff", fontSize: 9, letterSpacing: 2, fontWeight: 700 }}>LIFEOS / NAVIGATION</div>
                <strong style={{ display: "block", marginTop: 4, fontSize: 16 }}>Mission Control</strong>
              </div>
              <button type="button" aria-label="Close navigation" onClick={() => setOpen(false)} style={{ width: 34, height: 34, border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, background: "rgba(255,255,255,.06)", color: "#edf4ff", fontSize: 18 }}>×</button>
            </div>
            <div style={{ color: "#74839c", padding: "0 7px 7px", fontSize: 9, letterSpacing: 1.5, fontWeight: 700 }}>CORE</div>
            {destinations.map((item) => {
              const active = typeof window !== "undefined" && window.location.pathname === item.href;
              return (
                <a key={item.href} href={item.href} style={{
                  display: "grid", gridTemplateColumns: "24px minmax(0,1fr) auto", alignItems: "center", gap: 8,
                  padding: "11px 9px", marginBottom: 3, border: active ? "1px solid rgba(0,229,255,.25)" : "1px solid transparent",
                  borderRadius: 11, background: active ? "rgba(0,229,255,.08)" : "transparent",
                  color: active ? "#00e5ff" : "#edf4ff", textDecoration: "none", fontSize: 13, fontWeight: 700,
                }}>
                  <span aria-hidden="true">{item.href === "/" ? "⌂" : item.href === "/payroll" ? "＄" : "◷"}</span>
                  <span>{item.label}</span>
                  <span style={{ color: "#74839c", fontSize: 9, letterSpacing: 1, textTransform: "uppercase" }}>{item.hint}</span>
                </a>
              );
            })}
          </nav>
        </>
      )}
      <button
        type="button"
        className="mission-menu-fab"
        aria-expanded={open}
        aria-label={open ? "Close LifeOS navigation" : "Open LifeOS navigation"}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "×" : "☰"}
      </button>
    </>
  );
}
