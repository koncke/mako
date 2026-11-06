"use client"

// El modo (claro u oscuro) de MaKo, para lo que Studio leía de next-themes (el Toaster, el botón de la luna).
// En MaKo el oscuro es `data-tema="oscuro"` en <html> y lo cambia `aplicarModo` (app/_components/InterruptorModo.tsx), que
// avisa con el evento `mako-modo`. Claro por defecto: nunca `prefers-color-scheme` (AGENTS.md, el oscuro de cada persona).

import * as React from "react"

import { ATTR_MODO } from "@/lib/temas-candidatos"

export function useModoMako(): "light" | "dark" {
  const [oscuro, setOscuro] = React.useState(false)

  React.useEffect(() => {
    const sync = () => setOscuro(document.documentElement.getAttribute(ATTR_MODO) === "oscuro")
    sync()
    window.addEventListener("mako-modo", sync)
    return () => window.removeEventListener("mako-modo", sync)
  }, [])

  return oscuro ? "dark" : "light"
}
