import type { Metadata } from 'next';
import { Suspense, type CSSProperties } from 'react';
import './globals.css';
import { Sidebar } from './_components/Sidebar';
import { NotificationsProvider } from './_components/NotificationsProvider';
import { ImpersonationBanner } from './_components/ImpersonationBanner';
import { MakoConfirmGate } from './_components/MakoConfirmGate';
import { IaUsageToast } from './_components/IaUsageToast';

export const metadata: Metadata = {
  title: 'Marketing OS — Mauricio Bustos',
  description: 'CRM, marketing y comercial — Mauricio Bustos',
};

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
        <NotificationsProvider>
          <div style={rootStyle}>
            {/* Sidebar usa useSearchParams (propaga el filtro de fecha); Suspense
                evita el error de prerender en cualquier ruta estática. */}
            <Suspense fallback={null}>
              <Sidebar />
            </Suspense>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <Suspense fallback={null}>
                <ImpersonationBanner />
              </Suspense>
              {/* Modal bloqueante: MaKo pide confirmar los cambios automáticos del
                  CRM al entrar a /leads. usePathname (no necesita Suspense). */}
              <MakoConfirmGate />
              {children}
              {/* Toast global: avisa CADA operación de IA que gasta tokens y
                  linkea al detalle en Integraciones › Costo de MaKo. */}
              <IaUsageToast />
            </div>
          </div>
        </NotificationsProvider>
      </body>
    </html>
  );
}
