"use client";

import Link from "next/link";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const SECTIONS: Array<{ id: string; label: string; param: string }> = [
  { id: "command-center-triage", label: "Triage", param: "triage" },
  { id: "command-center-background", label: "Background", param: "background" },
  { id: "command-center-daily", label: "Daily", param: "daily" },
];

export function CommandCenterSectionNav() {
  return (
    <nav aria-label="Command center sections">
      <ul className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <Link
              className="inline-flex rounded-full border border-border/80 bg-card/40 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground"
              href={`${BASE_PATH}/command-center?section=${s.param}`}
            >
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
