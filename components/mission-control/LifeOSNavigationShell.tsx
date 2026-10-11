"use client";

import type { ReactNode } from "react";

type LifeOSNavigationShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  heading?: string;
};

export default function LifeOSNavigationShell({
  open,
  onOpenChange,
  children,
  heading = "Navigate",
}: LifeOSNavigationShellProps) {
  return (
    <>
      <aside className={"mission-sidebar " + (open ? "open" : "")} aria-label="LifeOS navigation">
        <div className="sidebar-head">
          <div>
            <div className="kicker">LifeOS</div>
            <strong>{heading}</strong>
          </div>
          <button className="sidebar-close" type="button" onClick={() => onOpenChange(false)} aria-label="Close navigation">×</button>
        </div>
        <nav className="sidebar-nav" aria-label="Primary navigation">{children}</nav>
      </aside>
      {open && <button className="sidebar-scrim" type="button" aria-label="Close navigation" onClick={() => onOpenChange(false)} />}
      <button
        className="mission-menu-fab"
        type="button"
        aria-expanded={open}
        aria-label={open ? "Close LifeOS navigation" : "Open LifeOS navigation"}
        onClick={() => onOpenChange(!open)}
      >
        {open ? "×" : "☰"}
      </button>
    </>
  );
}
