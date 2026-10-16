// =============================================================================
// puerta-admin-tab — `requireRolWs([], { nav })` para una RUTA /api: sólo el admin, con la tab en la capa
// =============================================================================
// La página de una tab sólo para el admin se cierra con `requireRolWs([], { nav })`, que REDIRIGE. Una ruta /api
// no puede redirigir (quien la llama es un fetch) y el proxy sólo pide SESIÓN fuera de /admin y /metodo
// (proxy.ts, SOLO_ADMIN): el rol lo mira cada ruta o nadie. Esto es el mismo corte, devolviendo la respuesta.
//
// ⚠️ POR QUÉ EXISTE (16/10/2026, revisión de MaKo Mobile, tanda 2): /api/experimentos, /api/experimentos/suggest,
// /api/experimentos/ideas, /api/retro y /api/second-brain/buscar no miraban el rol, y sus pantallas sí. Un closer
// o un setter con su cookie, desde la consola de la misma pestaña (pasa el CSRF), aceptaba un ítem de la Retro
// (crea un experimento y sus tareas en To-do), corría una Retro (hasta 9 llamadas a Opus), borraba retros,
// cerraba experimentos, leía las retros enteras, o le pedía a la búsqueda del Second Brain los precios y las
// objeciones del negocio, quemando la IA barata del workspace. El hueco era de escritorio (hallazgos-plan.md,
// abierto desde el 16/09); el teléfono le sumaba una pantalla más que llama a las mismas rutas.
//
// En POSITIVO: entra 'admin' y nadie más (un rol nuevo no entra por olvido). `getRolWsEfectivo` ya da 'admin' a
// la agencia y al dueño. La capa contesta 404 y no 403: a quien no le corresponde, la tab no existe (AGENTS.md).
// =============================================================================

import 'server-only';
import { tabEnCapa } from '@/lib/capas';
import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';

const cerrada = (status: number, error: string) =>
  Response.json({ ok: false, error }, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * `null` = entra. Si no, la respuesta tal cual, con la forma de las rutas (`{ ok: false, error }`).
 * @param nav la key de nav.ts de la tab (la misma que su `page.tsx` le pasa a `requireRolWs`).
 */
export async function soloAdminDeTab(nav: string): Promise<Response | null> {
  const rol = await getRolWsEfectivo();
  if (rol == null) return cerrada(401, 'Sin sesión: vuelve a entrar');
  if (rol !== 'admin') return cerrada(403, 'Sólo el admin del negocio');
  if (!tabEnCapa(nav, await getCapaActual())) return cerrada(404, 'No existe');
  return null;
}
