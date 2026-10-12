// =============================================================================
// MaKo Mobile — el guard de cada página de /m (y lo que el layout lee una vez)
// =============================================================================
// ⚠️ CADA page.tsx DE /m LLAMA A `requireMovil`. No alcanza con el layout: Next
// NO re-ejecuta los layouts al navegar (node_modules/next/dist/docs/01-app/
// 02-guides/authentication.md), así que un guard puesto sólo ahí deja pasar
// cualquier navegación de cliente. Y el proxy sólo valida la FIRMA de la cookie:
// la suspensión de una persona la ve `getUsuarioActual`, contra la base.
//
// ⚠️ LOS GUARDS DE lib/tab-access.ts NO SE USAN TAL CUAL: `requireRolWs`,
// `requireCapa` y `guardOnboarding` redirigen a ESCRITORIO (`homeDeCapa` → /crm o
// /plan, y /onboarding), y usados en /m sacan a la persona del shell móvil sin
// decir nada. Se reusan los PREDICADOS —`requireSesion`, `puedeVerKey` (la misma
// regla del Sidebar), `onboardingPendiente`— con destinos /m y `rutaConWs`.
//
// Y `requireSesion` sí va tal cual: su único redirect es /login, y ése va sin
// `?ws=` a propósito (sin sesión no hay pestaña que preservar).
// =============================================================================

import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUsuarioActual, type Sesion } from './auth';
import {
  getCapaActual, getRolWsEfectivo, getWorkspace, getWorkspaceActual, estaImpersonando, rutaConWs, wsSuperAdmin,
} from './workspace';
import { requireSesion } from './tab-access';
import { onboardingPendiente } from './onboarding-state';
import { HOME_MOVIL, puedeVerKey } from './movil-rutas';
import { tipoDeDispositivo, vaAMovil, VISTA_COOKIE } from './movil-dispositivo';
import { rutaDeSalida } from './agencia-cartera';
import { agenciaDeCliente } from './agencia';
import { WS_PARAM, conWs } from './ws-tab';
import type { RolWorkspace } from './auth-session';
import type { CapaId } from './capas';

/** La pantalla de /m para el onboarding sin terminar. */
export const RUTA_CONFIGURAR_MOVIL = '/m/configurar';

export type ContextoMovil = {
  sesion: Sesion;
  rol: RolWorkspace;
  capa: CapaId;
  /** El workspace que ve el request (null = admin sin cliente). Nunca leído de la URL a mano. */
  ws: number | null;
  /** Un super admin o una agencia mirando la cuenta de un cliente. */
  impersonando: boolean;
  /** El nombre del cliente que se está mirando (sólo si `impersonando`). */
  clienteNombre: string | null;
};

/**
 * El nombre del cliente que se está mirando. La MISMA pregunta que contesta
 * /api/auth/me para el banner de escritorio (app/api/auth/me/route.ts:26-32), sin
 * el «Workspace N» de respaldo: un id no es un nombre que se pueda dibujar.
 */
async function nombreDeCliente(ws: number): Promise<string | null> {
  try { return (await getWorkspace(ws))?.nombre?.trim() || null; } catch { return null; }
}

/**
 * Rol, capa, workspace y a quién se mira, resueltos UNA vez por request (está
 * cacheado: el layout y la página lo comparten). Sin sesión devuelve null y NO
 * redirige: eso es trabajo de `requireMovil`.
 */
export const contextoMovil = cache(async (): Promise<ContextoMovil | null> => {
  const sesion = await getUsuarioActual();
  if (!sesion) return null;
  const rol = await getRolWsEfectivo();
  if (!rol) return null;
  const [capa, ws, conPestana] = await Promise.all([getCapaActual(), getWorkspaceActual(), estaImpersonando()]);
  // El admin global en SU negocio (el workspace de plataforma, a donde lo manda `requireMovil` sin cliente)
  // no está «viendo a un cliente»: sin esto, el teléfono le dibujaba la píldora «MaKo» y «Salir de MaKo».
  const enLoPropio = sesion.rol === 'admin' && ws != null && ws === (await wsSuperAdmin());
  const impersonando = conPestana && !enLoPropio;
  const clienteNombre = impersonando && ws != null ? await nombreDeCliente(ws) : null;
  return { sesion, rol, capa, ws, impersonando, clienteNombre };
});

/**
 * El guard de una página de /m. Una línea al principio de cada page.tsx:
 *
 *   const ctx = await requireMovil({ navKey: 'crm' });
 *
 * · Sin sesión (o suspendida) → /login.
 * · Admin global sin cliente → /m/hoy de SU negocio (`?ws=` del workspace de plataforma):
 *   /m es la app de UN negocio, y el suyo es la plataforma (antes iba a /inicio).
 * · Onboarding pendiente → /m/configurar (salvo `onboarding: false`, que lo usa
 *   esa misma pantalla para no redirigirse a sí misma).
 * · `navKey` (la key de nav.ts del destino) que este rol o esta capa no ven →
 *   /m/hoy. Es la MISMA regla del Sidebar (lib/movil-rutas.ts → puedeVerKey).
 *
 * Todos los destinos van con `rutaConWs`: si se pierde el `?ws=`, el super admin
 * que mira un cliente termina en SU cuenta sin que nada lo diga.
 */
export async function requireMovil(opts: { navKey?: string | null; onboarding?: boolean } = {}): Promise<ContextoMovil> {
  await requireSesion();
  const ctx = await contextoMovil();
  if (!ctx) redirect('/login');
  // El admin global SIN cliente ve /m de SU negocio (el workspace de plataforma), no su panel: hasta
  // el 12/10/2026 iba a /inicio, y eso obligaba a dejarlo fuera del desvío (Martín veía el escritorio
  // en el teléfono). Con `?ws=` en la URL, el resto de /m lo lleva solo (el Link de app/_ui).
  if (ctx.ws == null && ctx.sesion.rol === 'admin') redirect(conWs(HOME_MOVIL, await wsSuperAdmin()));
  if (opts.onboarding !== false && (await onboardingPendiente())) redirect(await rutaConWs(RUTA_CONFIGURAR_MOVIL));
  if (opts.navKey && !puedeVerKey(opts.navKey, ctx.rol, ctx.capa)) redirect(await rutaConWs(HOME_MOVIL));
  return ctx;
}

/**
 * Cómo se SALE de la vista de un cliente: a dónde y por qué puerta. Lo mismo que
 * /api/auth/me le da al banner de escritorio (`salida` + `modoAgencia`), porque en
 * /m ese banner no se dibuja y sin esto no hay salida (AGENTS.md: «si la única
 * salida vive adentro de una pantalla condicional, no hay salida»).
 * null = no se está mirando a nadie.
 */
export async function salidaDeVista(): Promise<{ salida: string; modoAgencia: boolean } | null> {
  const ctx = await contextoMovil();
  if (!ctx?.impersonando) return null;
  const esSuperAdmin = ctx.sesion.rol === 'admin';
  const agencia = esSuperAdmin && ctx.ws != null ? await agenciaDeCliente(ctx.ws) : null;
  return {
    salida: agencia ? `/customer-success?${WS_PARAM}=${agencia.ws}` : rutaDeSalida(esSuperAdmin),
    modoAgencia: !esSuperAdmin,
  };
}

/**
 * ¿Este request tiene que ir a /m? Teléfono (lib/movil-dispositivo.ts) y sin la
 * cookie de «Versión completa». La llama /inicio ANTES de repartir.
 */
export async function prefiereMovil(): Promise<boolean> {
  const [h, c] = await Promise.all([headers(), cookies()]);
  return vaAMovil(tipoDeDispositivo(h.get('user-agent'), h.get('sec-ch-ua-mobile')), c.get(VISTA_COOKIE)?.value);
}
