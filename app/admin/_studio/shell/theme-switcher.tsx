"use client";
// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN.

// Studio Admin (MIT), src/app/(main)/dashboard/_components/header/theme-switcher.tsx: el mismo botón y los mismos íconos.
// MaKo: cambia el modo de MaKo (`aplicarModo`, el mismo de la barra de MaKo), que es el que lee el tema de `.sa`. Sin
// «sistema»: en MaKo el oscuro es sólo de quien lo elige (AGENTS.md, el oscuro de cada persona), así que el ciclo es
// claro ↔ oscuro.

import { Moon, Sun } from "lucide-react";

import { aplicarModo } from "@/app/_components/InterruptorModo";
import { Button } from "@/app/admin/_studio/components/ui/button";
import { useModoMako } from "@/app/admin/_studio/hooks/use-modo";

export function ThemeSwitcher() {
  const modo = useModoMako();

  return (
    <Button
      size="icon"
      onClick={() => aplicarModo(modo !== "dark")}
      aria-label={modo === "dark" ? "Pasar a modo claro" : "Pasar a modo oscuro"}
    >
      {/* DARK */}
      <Sun className="hidden dark:block" />

      {/* LIGHT */}
      <Moon className="block dark:hidden" />
    </Button>
  );
}
