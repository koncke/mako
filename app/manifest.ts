import type { MetadataRoute } from 'next';

// =============================================================================
// manifest — la app agregada a la pantalla de inicio se ve como MaKo
// =============================================================================
// Mauricio se agregó la app al celular para entrar rápido y le quedó un cuadrado
// gris con la inicial del título ("M"), al lado de sus otros accesos que sí tienen
// ícono. Sin manifest ni apple-icon, el sistema no tiene de dónde sacar el arte y
// pone la letra: se ve como un marcador, no como una app.
//
// Dos piezas, porque cada sistema mira la suya:
//   · iOS  → app/apple-icon.png (180×180). NO acepta SVG para esto.
//   · Android/Chrome → este manifest, con 192 y 512 + una versión `maskable`
//     (sin esquinas propias y con más margen: Android recorta a su forma y con el
//     arte al borde se comería la chispa).
//
// `display: standalone` = abre sin la barra del navegador, que es lo que hace que
// se sienta una app y no una pestaña.
// =============================================================================

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MaKo',
    short_name: 'MaKo',
    description: 'Marketing, CRM y ventas en una sola app.',
    start_url: '/',
    display: 'standalone',
    background_color: '#171511',
    theme_color: '#171511',
    lang: 'es',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
