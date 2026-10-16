// =============================================================================
// linea-plataforma — la línea de WhatsApp de MaKo, como la línea de Automations del ws de la PLATAFORMA (15/10/2026)
// =============================================================================
// Martín (el 3 de las doce): «en SuperAdmin me dice que no tengo conectado WhatsApp... Está el WhatsApp de MaKo...
// Luego si quisiera conectar otros números tengo la opción, pero no entiendo por qué no aparece». La línea de MaKo
// (lib/mako-canal.ts, `mako_superadmin_<sufijo>`) no es de ningún negocio a propósito, y el ws 9 sólo tenía la suya
// propia sin conectar: Automations decía «Sin conectar» y además no podía mandar.
//
// DECIDIDO (coordinador «Estrategia 3 cuentas», 15/10/2026, el camino (a); docs/hallazgos-comunicacion.md):
//   · en la plataforma, la línea de MaKo es la de POR DEFECTO para MANDAR y para el estado de Automations;
//   · lo que ENTRA sigue yendo al canal de MaKo: no escucha 1 a 1 (el webhook sólo procesa sus grupos), así que una
//     tarjeta que espera respuesta lo dice (`noEscucha`, el chip «No escucha respuestas»);
//   · NO vale para ningún negocio cliente: fuera de la plataforma esto devuelve null y nada cambia;
//   · las operaciones de la línea (QR, desconectar, webhook, renombrar) NO la ven: siguen con las del negocio.
//
// Sin importar lib/mako-canal.ts (que importa lib/evolution.ts, que importa esto): la clave del canal vive acá y
// mako-canal la re-exporta.

import 'server-only';
import { getSettingEstricto } from './settings';
import { runWithWorkspace, OWNER_WS, wsSuperAdmin } from './workspace';

/** Qué instancia ES hoy el canal de MaKo (el setting lo escribe lib/mako-canal.ts al rotar una línea trabada). */
export const KEY_CANAL_INSTANCIA = 'mako.canal.instancia';
/** El nombre base del canal; sin el setting, es ése (lo mismo que `instanciaCanal`). */
const BASE = 'mako_superadmin';
/** Cómo se dice en pantalla. */
export const ETIQUETA_LINEA_MAKO = 'WhatsApp de MaKo';

/** ¿Este nombre es una línea del canal de MaKo? (La misma regla que `esNombreDeCanal`, lib/mako-canal.ts.) */
export const esLineaDeMaKo = (n: string): boolean => n === BASE || n.startsWith(`${BASE}_`);

/**
 * La línea de MaKo, SI `ws` es el de la plataforma; null para cualquier otro (fail-closed: si no se puede leer cuál es
 * la plataforma o cuál es la línea, null y el ws sigue con las suyas).
 */
export async function lineaDeMaKoPara(ws: number): Promise<string | null> {
  const plataforma = await wsSuperAdmin().catch(() => -1);
  if (ws !== plataforma) return null;
  // El setting vive en el ws del dueño (OWNER_WS), como lo lee `instanciaCanal`.
  const v = await runWithWorkspace(OWNER_WS, () => getSettingEstricto(KEY_CANAL_INSTANCIA)).catch(() => undefined);
  if (v === undefined) return null;
  const nombre = (v ?? '').trim() || BASE;
  return esLineaDeMaKo(nombre) ? nombre : null;
}
