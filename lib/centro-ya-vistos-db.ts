// =============================================================================
// El ✓ de cada «Completado» del Ops Center, en MaKo (18/10/2026, pedido 1d15877a)
// =============================================================================
// Martín: «la notificación de todos los chats siempre debe ser "Espera tu respuesta", y no desaparecer hasta que yo le dé
// un check al mensaje de completado». El ✓ va del lado del servidor (no por dispositivo) para que valga igual en la
// computadora y en el teléfono. Las reglas (qué chat espera el ✓) en lib/centro-chats.ts → esperaCheck.
//
// UNA clave en el workspace de la PLATAFORMA, `operaciones.ya-vistos`: { <clave del chat>: <instante del último «Ya está»
// con ✓> }. ⚠️ MARCAR SÓLO AVANZA: se guarda el más nuevo de los dos, así un ✓ que llega tarde de otro dispositivo no
// vuelve a prender un aviso. Lee estricto: si no puede leer lo que había, no escribe.
// ⚠️ LA GUARDA NO VIVE ACÁ: la pide la acción (acciones.ts, `puedeOperar`).

import 'server-only';
import { getSetting, getSettingEstricto, setSetting } from './settings';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { leerYaVistos, type YaVistos } from './centro-chats';

const CLAVE = 'operaciones.ya-vistos';

const parsear = (v: string | null): YaVistos => { try { return v ? leerYaVistos(JSON.parse(v)) : {}; } catch { return {}; } };

/** Los ✓ de todos los chats, para la lista. Sin la base, null: la lista no avisa (no inventa avisos que no puede apagar). */
export async function leerYaVistosDe(): Promise<YaVistos | null> {
  try {
    const ws = await wsSuperAdmin();
    return parsear(await runWithWorkspace(ws, () => getSetting(CLAVE)));
  } catch {
    return null;
  }
}

/** El ✓ de un chat hasta ese «Ya está». Devuelve todos los ✓ como quedaron. */
export async function marcarYaVistoDe(chat: string, instante: number): Promise<YaVistos> {
  const ws = await wsSuperAdmin();
  return runWithWorkspace(ws, async () => {
    const actual = parsear(await getSettingEstricto(CLAVE));
    if ((actual[chat] ?? 0) >= instante) return actual;
    const nuevo = leerYaVistos({ ...actual, [chat]: instante });
    await setSetting(CLAVE, JSON.stringify(nuevo));
    return nuevo;
  });
}
