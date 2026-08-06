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
  // Agregada a la pantalla de inicio del celular tiene que verse como una app, no
  // como un marcador: sin esto el sistema pone la inicial del título en un cuadrado
  // gris. `apple-web-app` además la abre SIN la barra del navegador en iOS.
  appleWebApp: { capable: true, title: 'MaKo', statusBarStyle: 'black-translucent' },
};

// El color de la barra del sistema cuando la app corre desde la pantalla de inicio:
// el mismo fondo del badge, así no aparece una franja blanca arriba del contenido.
export const viewport: Viewport = { themeColor: '#171511' };

// Contenedor raíz: sidebar fijo + el <main> que aporta cada pantalla.
// Réplica del rootStyle del prototipo (display:flex; align-items:flex-start).
const rootStyle: CSSProperties = {
  minHeight: '100vh',
  background: 'var(--bg)',
  color: 'var(--ink)',
  fontFamily: "'Geist', system-ui, sans-serif",
  display: 'flex',
  alignItems: 'flex-start',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
      </body>
    </html>
  );
}
