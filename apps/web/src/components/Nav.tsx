"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clapperboard, Home } from "lucide-react";
import { cn } from "./ui";

// Разделы появляются по мере реализации этапов (см. PLAN.md).
const LINKS = [
  { href: "/", label: "Главная", icon: Home },
  { href: "/library", label: "Библиотека", icon: Clapperboard },
];

export function Nav() {
  const path = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-panel">
      <div className="tricolore h-1 w-full" />
      <div className="px-5 py-5">
        <div className="font-display text-xl font-bold">
          Italiano<span className="text-verde-2">Per</span>
          <span className="text-rosso">Te</span>
        </div>
        <div className="text-xs text-mute">ферма шортсов</div>
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-mute hover:bg-panel-2 hover:text-ink", active && "bg-panel-2 text-ink")}
            >
              <Icon size={18} className={active ? "text-verde-2" : undefined} /> {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
