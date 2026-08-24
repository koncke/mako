import type { Metadata, Viewport } from 'next';
import { Suspense, type CSSProperties } from 'react';
import './globals.css';
import { Sidebar } from './_components/Sidebar';
import { NotificationsProvider } from './_components/NotificationsProvider';
import { ImpersonationBanner } from './_components/ImpersonationBanner';
import { MakoConfirmGate } from './_components/MakoConfirmGate';
import { IaUsageToast } from './_components/IaUsageToast';
import { HideOnPublicLanding } from './_components/PublicRouteGate';
import { TituloTab } from './_components/TituloTab';
import { WsFetch } from './_components/WsFetch';
import { TemaCandidato } from './_components/TemaCandidato';
import { getSesionAdmin } from '@/lib/auth';
import { APP_BASE_URL } from '@/lib/app-url';
import { WsProvider } from './_ui/Link';

// Título por defecto de las pantallas internas — es lo que se lee en la pestaña
// del navegador, al lado del favicon. El producto es MaKo: acá decía "Marketing
// OS — Mauricio Bustos", branding viejo de cuando era el dashboard interno de una
// sola cuenta. La landing (app/page.tsx) pisa esto con su propio título.
//
// Este es el título de ARRANQUE. Ya en el navegador, <TituloTab /> le agrega la
// sección donde estás parado ("MaKo - CRM"), para poder distinguir una pestaña de
// otra sin entrar a cada una.
export const metadata: Metadata = {
  title: 'MaKo',
  description: 'Marketing, CRM y ventas en una sola app.',
  // ⚠️ SIN `metadataBase` una imagen de OpenGraph declarada como ruta relativa NO SE
  // MANDA: Next necesita un origen para volverla absoluta, y sin él la deja afuera del
  // <head> con un warning en el build que nadie mira. Sale de APP_BASE_URL, que es la
  // única fuente del dominio (lib/app-url.ts) — un literal acá se queda viejo el día de
  // la próxima mudanza y las tarjetas apuntan a un host muerto.
  metadataBase: new URL(APP_BASE_URL),
  // La tarjeta que se ve al pegar un link de MaKo en un chat. No existía NINGUNA: no
  // había un solo `openGraph` en todo app/, así que cualquier link —la landing incluida—
  // se previsualizaba como texto pelado. Las pantallas que tienen algo mejor que mostrar
  // (un curso compartido) pisan esto con su propio `generateMetadata`.
  openGraph: {
    type: 'website',
    siteName: 'MaKo',
    title: 'MaKo',
    description: 'Marketing, CRM y ventas en una sola app.',
    images: [{ url: '/og-mako.jpg', width: 1200, height: 630, alt: 'MaKo' }],
  },
  twitter: { card: 'summary_large_image', images: ['/og-mako.jpg'] },
  // Agregada a la pantalla de inicio del celular tiene que verse como una app, no
  // como un marcador: sin esto el sistema pone la inicial del título en un cuadrado
  // gris. `apple-web-app` además la abre SIN la barra del navegador en iOS.
  appleWebApp: { capable: true, title: 'MaKo', statusBarStyle: 'black-translucent' },
};

// El color de la barra del sistema cuando la app corre desde la pantalla de inicio:
// el mismo fondo del badge, así no aparece una franja blanca arriba del contenido.
export const viewport: Viewport = { themeColor: '#171511' };

// Contenedor raíz: sidebar fijo + el <main> que aporta cada pantalla.
//
// ⚠️ `alignItems: 'stretch'` (el default), NUNCA `flex-start`. Acá NACE la cadena de
// altos de toda la app: con `flex-start` la columna que envuelve al <main> se queda del
// alto de SU contenido, así que ningún descendiente tiene un alto definido contra el que
// resolver un `1fr`, un `100%` o un `flex-basis: 0%`. Chrome igual les da un alto usable;
// Safari viejo devuelve CERO — y ahí un `overflow` cualquiera recorta la pantalla entera.
// Es la causa raíz de «el plan está vacío» reportado tres veces desde una Mac.
//
// Venía de la «réplica del rootStyle del prototipo», o sea copiado de un HTML suelto
// donde no había ninguna pantalla que tuviera que llenar el alto.
const rootStyle: CSSProperties = {
  minHeight: '100vh',
  background: 'var(--bg)',
  color: 'var(--ink)',
  fontFamily: "'Geist', system-ui, sans-serif",
  display: 'flex',
  alignItems: 'stretch',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ⚠️ EL TALLER DE PALETAS SOLO EXISTE PARA EL SUPER-ADMIN, y esto es un GUARD, no una
  // preferencia. `<TemaCandidato>` mete un <script> que corre antes del primer pintado y
  // aplica el tema guardado en el localStorage del navegador — sin preguntar quién es.
  //
  // Lo que eso produjo, con un cliente mirando: la app ENTERA ilegible. Los temas
  // candidatos incluyen paletas CLARAS (`true-north` pone `--ink: #2E3440`), así que
  // sobre el lienzo oscuro quedó todo pintado del color del fondo — tarjetas, botones y
  // texto dibujados y borrados a la vez. Se reportó como «no están sus tareas y están
  // todos los botones mal»: no faltaba nada, no se veía nada.
  //
  // Y falla EN SILENCIO por diseño: el mismo bloque CSS le pone una transición de color
  // a todos los elementos, así que ni siquiera parpadea al aplicarse.
  //
  // El guard va en el SERVER y en positivo —solo admin— porque el localStorage lo
  // escribe el navegador y no sabe de sesiones: cualquier cliente que abra la app en un
  // browser donde alguien probó paletas se lleva el tema puesto.
  const esAdmin = !!(await getSesionAdmin());
  return (
    <html lang="es" className="h-full antialiased">
      <body>
        {/* Geist vía CDN: deja que los estilos en línea del diseño usen
            font-family:'Geist' / 'Geist Mono' tal cual. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {/* Notificaciones de WhatsApp a nivel app: badge del sidebar + sonido +
            pop-up, corriendo en cualquier sección. */}
        {/* Nombre de la sección en la pestaña del navegador. */}
        <Suspense fallback={null}>
          <TituloTab />
        </Suspense>
        {/* No pinta nada: importarlo acá es lo que aplica el parche de fetch que
            le pega el `?ws=` de la pestaña a todas las llamadas a /api. Va lo más
            arriba posible del árbol para que el chunk cargue antes que nadie. */}
        <WsFetch />
        {/* El tema candidato del rebrand, si hay uno puesto desde
            /admin/ui?tab=temas. Va acá arriba a propósito: su <script> tiene
            que correr ANTES del primer pintado o la app parpadea del tema viejo
            al nuevo en cada navegación. No pinta nada cuando no hay tema. */}
        {esAdmin && <TemaCandidato />}
        {/* El `?ws=` de la pestaña, leído UNA vez acá adentro del Suspense y
            repartido por contexto: es lo que hace que <Link> y router.push no
            te saquen del cliente que estás mirando. */}
        <Suspense fallback={null}>
        <WsProvider>
        <NotificationsProvider>
          <div style={rootStyle}>
            {/* Sidebar usa useSearchParams (propaga el filtro de fecha); Suspense
                evita el error de prerender en cualquier ruta estática.
                Va DENTRO del gate: a alguien de afuera con un link compartido no
                se le muestran los nombres de las tabs internas. /vsl lo escondía
                por CSS desde la landing; ahora no hace falta el hack. */}
            <HideOnPublicLanding>
              <Suspense fallback={null}>
                <Sidebar />
              </Suspense>
            </HideOnPublicLanding>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              {/* Chrome interno oculto en la landing pública /vsl (ver PublicRouteGate). */}
              <HideOnPublicLanding>
                <Suspense fallback={null}>
                  <ImpersonationBanner />
                </Suspense>
              </HideOnPublicLanding>
              {/* Modal bloqueante: MaKo pide confirmar los cambios automáticos del
                  CRM al entrar a /crm. usePathname (no necesita Suspense). */}
              <MakoConfirmGate />
              {children}
              {/* Toast global: avisa CADA operación de IA que gasta tokens y
                  linkea al detalle en Integraciones › Costo de MaKo. */}
              <HideOnPublicLanding>
                <IaUsageToast />
              </HideOnPublicLanding>
            </div>
          </div>
        </NotificationsProvider>
        </WsProvider>
        </Suspense>
      </body>
    </html>
  );
}
