"use client";

import { useEffect } from "react";
import {
  type CommandCenterSectionId,
  getCommandCenterSectionElementId,
} from "@/lib/command-center/sections";

type Props = {
  section: CommandCenterSectionId | null;
};

export function CommandCenterScrollIntoSection({ section }: Props) {
  useEffect(() => {
    if (!section) {
      return;
    }
    const id = getCommandCenterSectionElementId(section);
    const el = document.getElementById(id);
    if (!el) {
      return;
    }
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [section]);

  return null;
}
