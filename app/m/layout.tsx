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
// → contextoMovil) y se lo pasa al shell: la barra nace con los lugares de ese
// rol (`barraMovil`: Today · CRM · Inbox · Plan · More, con los huecos llenos por
// la primera sección de More que el rol ve), sin un fetch a /api/auth/me ni el
// flash de una barra equivocada.
//
// ⚠️ Y NO PROTEGE NADA: los layouts no se re-ejecutan al navegar. Cada page.tsx
// de /m llama a `requireMovil()`.
// =============================================================================

import type { Viewport } from 'next';
import type { ReactNode } from 'react';
import './m.css';
import { ShellM } from './_ui/ShellM';
import { contarBadges } from './badges';
import { contextoMovil } from '@/lib/movil-guard';
import { barraMovil } from '@/lib/movil-rutas';
import { CAPTURA_TEMPRANA } from '@/lib/movil-instalar';
import { TEMA_ANTES_DE_PINTAR } from './_ui/tema';
import { ARRANQUE_ANTES_DE_PINTAR } from './_ui/entrada';
import { inicialesM } from './_ui/formato';
import { leerPerfil } from '@/lib/perfil';
import { AvisoPruebaM } from './_prueba/PruebaM';
import { estadoDePrueba } from '@/lib/prueba-uso';
import { esAppIosDelPedido } from '@/lib/tienda-pedido';

/**
 * El viewport del teléfono. `viewport-fit: cover` es lo que hace que
 * `env(safe-area-inset-*)` valga algo (sin él, todas valen 0 y el header queda
 * debajo del reloj). `interactive-widget: resizes-content` hace que el teclado de
 * Android achique el layout como en iOS, así lo pegado abajo sube con él.
 * NUNCA maximum-scale ni user-scalable=no: el zoom es accesibilidad, y lo que lo
 * disparaba (inputs de menos de 16 px) se arregla en app/m/m.css.
 *
 * `themeColor` es el hex de --bg del tema claro (#efefed, app/globals.css): el
 * encabezado de la v2 es --bg, y la barra del sistema tiene que ser del mismo color.
 * Una meta no puede leer un `var()`, por eso es el único hex de /m. Con el oscuro
 * (que la persona elige), ShellM le escribe el --bg resuelto.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: '#efefed',
};

export default async function LayoutMovil({ children }: { children: ReactNode }) {
  const ctx = await contextoMovil();
  // El Ops Center del medio (20/10/2026): para el super admin sin mirar un cliente es el Centro, como la fila de /m/mas.
  const barra = barraMovil(ctx?.rol ?? null, ctx?.capa ?? null, ctx?.sesion.rol === 'admin' && !ctx.impersonando);
  // La FOTO de la cabecera (17/10/2026 noche): la de Información personal, como More y el menú de la foto de escritorio
  // (hasta ese día, siempre iniciales). Mirando a un cliente no se lee: la cabecera no lleva la cuenta propia ahí.
  const [badges, perfil] = ctx
    ? await Promise.all([
      contarBadges({ rol: ctx.rol, capa: ctx.capa, ws: ctx.ws }, barra.map((d) => d.id)),
      ctx.impersonando ? Promise.resolve(null) : leerPerfil().catch(() => null),
    ])
    : [{}, null];
  const foto = perfil && !perfil.vista.deOtro ? perfil.perfil.avatarUrl.trim() || null : null;
  // LA VERSIÓN DE PRUEBA (25/10/2026): una línea arriba de cada pantalla mientras dura (una lectura, cacheada por pedido).
  const prueba = ctx?.ws != null ? await estadoDePrueba(ctx.ws) : null;
  const appIos = await esAppIosDelPedido();

  return (
    <div id="m-root" data-m>
      {/* Antes que nada del shell: el tema y la captura del aviso de instalación
          tienen que existir antes del primer pintado y antes de que hidrate React. */}
      <script dangerouslySetInnerHTML={{ __html: TEMA_ANTES_DE_PINTAR }} />
      <script dangerouslySetInnerHTML={{ __html: CAPTURA_TEMPRANA }} />
      {/* La entrada de MaKo (ShellM → EntradaApp) viene en este mismo HTML: si ya salió en esta apertura, este script la
          apaga antes del primer cuadro, y la centra como el splash del sistema (app/m/_ui/entrada.ts). */}
      <script dangerouslySetInnerHTML={{ __html: ARRANQUE_ANTES_DE_PINTAR }} />
      <ShellM
        barra={barra}
        badges={badges}
        usuario={ctx ? { iniciales: inicialesM(ctx.sesion.nombre, ctx.sesion.email), foto } : null}
        cliente={ctx?.impersonando ? { nombre: ctx.clienteNombre ?? 'Cliente' } : null}
        appIos={appIos}
      >
        {prueba?.enPrueba && <AvisoPruebaM dias={prueba.dias} plan={prueba.plan ?? 'tu plan'} despues={prueba.despues} />}
        {children}
      </ShellM>
    </div>
  );
}
