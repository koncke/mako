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
//
// ⚠️ MaKo Mobile (11/10/2026): `start_url` era '/', y '/' es la LANDING DE VENTA
// para todo el mundo, logueados incluidos (app/page.tsx): la app instalada abría la
// landing. Ahora abre /inicio, el repartidor: un teléfono va a /m y una instalación
// de escritorio sigue en escritorio.
//   · `id: '/'` NO es decorativo. Sin `id`, la identidad de la app ES su start_url:
//     cambiar el start_url sin fijar el id la volvía «otra app» para Chrome, y las
//     instalaciones que ya existen no se actualizaban. '/' es el start_url de antes.
//   · `scope: '/'`: /login, el OAuth de Google y las pantallas de escritorio siguen
//     adentro de la app (sin barra del navegador). Un scope '/m/' las sacaba.
//   · En iOS el ícono ya agregado CONGELA el start_url viejo: hay que volver a
//     agregarlo a la pantalla de inicio para que tome el nuevo.
//   · Los accesos directos (mantener apretado el ícono, Android) van directo a /m: el
//     guard de cada página manda a quien no le toca (o a quien no es de un teléfono
//     con esa sección) a donde corresponde.
// =============================================================================

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MaKo',
    short_name: 'MaKo',
    description: 'Marketing, CRM y ventas en una sola app.',
    id: '/',
    start_url: '/inicio',
    scope: '/',
    display: 'standalone',
    background_color: '#171511',
    theme_color: '#171511',
    lang: 'es',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Los nombres de la barra de MaKo Mobile (lib/movil-rutas.ts): en inglés, como el producto.
    shortcuts: [
      { name: 'Today', url: '/m/hoy', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Inbox', url: '/m/inbox', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'MaKo', url: '/m/mako', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
    ],
  };
}
