// =============================================================================
// /m — el layout de MaKo Mobile
// =============================================================================
// ⚠️ ESTO VIVE ADENTRO DEL LAYOUT RAÍZ, y no hay forma de esquivarlo: no hay route
// groups ni un segundo root layout, y moverlos tocaría cada ruta. /m se dibuja en
// la columna de contenido de app/layout.tsx, y lo que apaga el cromo de escritorio
// (Sidebar, banners, la esquina de avisos) es que /m está en `esVistaSinChrome`
// (app/_components/PublicRouteGate.tsx).
//
// Resuelve UNA vez, en el server, rol, capa y a quién se mira (lib/movil-guard.ts
// → contextoMovil) y se lo pasa al shell: la barra nace con los destinos de ese
// rol, sin un fetch a /api/auth/me ni el flash de una barra equivocada.
//
// ⚠️ Y NO PROTEGE NADA: los layouts no se re-ejecutan al navegar. Cada page.tsx
// de /m llama a `requireMovil()`.
// =============================================================================

import type { Viewport } from 'next';
import type { ReactNode } from 'react';
import './m.css';
import { ShellM, type DestinoBarra } from './_ui/ShellM';
import { contarBadges } from './badges';
import { contextoMovil } from '@/lib/movil-guard';
import { destinosVisibles } from '@/lib/movil-rutas';
import { CAPTURA_TEMPRANA } from '@/lib/movil-instalar';
import { TEMA_ANTES_DE_PINTAR } from './_ui/tema';

/**
 * El viewport del teléfono. `viewport-fit: cover` es lo que hace que
 * `env(safe-area-inset-*)` valga algo (sin él, todas valen 0 y el header queda
 * debajo del reloj). `interactive-widget: resizes-content` hace que el teclado de
 * Android achique el layout como en iOS, así lo pegado abajo sube con él.
 * NUNCA maximum-scale ni user-scalable=no: el zoom es accesibilidad, y lo que lo
 * disparaba (inputs de menos de 16 px) se arregla en app/m/m.css.
 *
 * `themeColor` es el hex de --sidebar (#14161B, app/globals.css): el cromo es
 * oscuro en los dos modos, y la barra del sistema tiene que ser del mismo color
 * que el header. Una meta no puede leer un `var()`, por eso es el único hex de /m.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: '#14161B',
};

/** «Ana María Pérez» → «AP»; sin nombre, la inicial del email. */
function iniciales(nombre: string | null | undefined, email: string | null | undefined): string {
  const partes = (nombre ?? '').trim().split(/\s+/).filter(Boolean);
  const ini = partes.length > 1 ? partes[0][0] + partes[partes.length - 1][0] : partes[0]?.slice(0, 2) ?? '';
  return (ini || (email ?? '').trim()[0] || '·').toUpperCase();
}

export default async function LayoutMovil({ children }: { children: ReactNode }) {
  const ctx = await contextoMovil();
  const destinos: DestinoBarra[] = destinosVisibles(ctx?.rol ?? null, ctx?.capa ?? null)
    .map(({ id, label, href, icon }) => ({ id, label, href, icon }));
  const badges = ctx
    ? await contarBadges({ rol: ctx.rol, capa: ctx.capa, ws: ctx.ws }, destinos.map((d) => d.id))
    : {};

  return (
    <div id="m-root" data-m>
      {/* Antes que nada del shell: el tema y la captura del aviso de instalación
          tienen que existir antes del primer pintado y antes de que hidrate React. */}
      <script dangerouslySetInnerHTML={{ __html: TEMA_ANTES_DE_PINTAR }} />
      <script dangerouslySetInnerHTML={{ __html: CAPTURA_TEMPRANA }} />
      <ShellM
        destinos={destinos}
        badges={badges}
        usuario={ctx ? { iniciales: iniciales(ctx.sesion.nombre, ctx.sesion.email) } : null}
        cliente={ctx?.impersonando ? { nombre: ctx.clienteNombre ?? 'Cliente' } : null}
      >
        {children}
      </ShellM>
    </div>
  );
}
