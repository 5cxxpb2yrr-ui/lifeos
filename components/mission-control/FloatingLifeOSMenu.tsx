"use client";

import { useState } from "react";
import LifeOSNavigationShell from "@/components/mission-control/LifeOSNavigationShell";

const destinations = [
  { href: "/", label: "Mission Control", icon: "⌂", group: "Mission" },
  { href: "/payroll", label: "Payroll Calculator", icon: "$", group: "Money" },
  { href: "/payroll/forecast", label: "Payroll Forecast", icon: "◷", group: "Money" },
];

export default function FloatingLifeOSMenu() {
  const [open, setOpen] = useState(false);

  return (
    <LifeOSNavigationShell open={open} onOpenChange={setOpen} heading="Navigate">
      <div className="sidebar-group">
        <div className="sidebar-group-label">Mission</div>
        <a className="sidebar-link" href="/"><span>⌂</span><strong>Mission Control</strong></a>
      </div>
      <div className="sidebar-group">
        <div className="sidebar-group-label">Money</div>
        {destinations.filter((item) => item.group === "Money").map((item) => (
          <a className="sidebar-link" href={item.href} key={item.href}>
            <span>{item.icon}</span><strong>{item.label}</strong>
          </a>
        ))}
      </div>
    </LifeOSNavigationShell>
  );
}
