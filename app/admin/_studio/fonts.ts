// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN.
// La letra de Studio Admin: Geist (Vercel, SIL OFL 1.1, app/admin/_studio/fonts/OFL-GEIST.txt), del paquete `geist` 1.9.1
// que usa Studio. Va con `next/font/local` y el woff2 commiteado, NUNCA `next/font/google`: el build que depende de Google
// se cayó dos veces (app/chats/fuente.tsx, 15/10/2026). Y no por la hoja de Google en el navegador: MaKo ya declara una
// familia llamada «Geist» que es Urbanist (app/globals.css), y dos @font-face con el mismo nombre se pisan. Con
// `next/font/local` la familia sale con un nombre propio y se usa por la variable `--font-geist-sa` (studio-theme.css).

import localFont from "next/font/local"

export const geistSa = localFont({
  src: "./fonts/Geist-Variable.woff2",
  variable: "--font-geist-sa",
  weight: "100 900",
  display: "swap",
})
