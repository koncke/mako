// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN.
import type { SVGProps } from "react"

// El lugar del logo de Studio Admin (src/components/app-logo.tsx: una marca de un color, `currentColor`), con la chispa
// de MaKo (el trazo de app/_components/MakoBrand.tsx) dibujada igual: de un color y sin la animación de la marca.
const CHISPA = "M0 -11 C1 -4 4 -1 11 0 C4 1 1 4 0 11 C-1 4 -4 1 -11 0 C-4 -1 -1 -4 0 -11 Z"

export function AppLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -12 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d={CHISPA} />
    </svg>
  )
}
