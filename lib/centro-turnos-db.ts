// =============================================================================
// Lo que se dijo en cada chat, en la base (17/10/2026)
// =============================================================================
// Los turnos que sube la PC (cartero.mjs → turnosDeLineas): una clave de app_settings POR CHAT en el workspace de la
// PLATAFORMA (`wsSuperAdmin()`, como los muñecos: lib/centro-munecos-db.ts), con sus últimos `TURNOS_POR_CHAT`. Por
// chat y no un mapa entero: cada vuelta toca sólo los chats que hablaron, y abrir uno lee sólo el suyo.
//
// ⚠️ SIN MIGRACIÓN A PROPÓSITO (el número lo da el Cerebro y no hacía falta esperar): si un día se muda a una tabla,
//    la forma es `TurnoChat` (lib/operaciones-reglas.ts) y se lee por `local`.
// ⚠️ GUARDAR LEE ESTRICTO (AGENTS.md → «Una lectura que cae al DEFAULT sirve para dibujar, nunca para DECIDIR»): si no
//    puede leer lo que había, no escribe; si escribiera, borraría la historia del chat con la vuelta nueva sola.
// ⚠️ LA GUARDA NO VIVE ACÁ: guarda el endpoint del cartero (su token) y lee una acción con `puedeOperar` (acciones.ts).

import 'server-only';
import { getSetting, getSettingEstricto, setSetting } from './settings';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { DESTINO_RE, sanearTurnos, unirTurnos, type TurnoChat } from './operaciones-reglas';

const PREFIJO = 'operaciones.turnos.';
const parsear = (v: string | null): unknown => { try { return v ? JSON.parse(v) : []; } catch { return []; } };

/** Guarda lo que subió una vuelta. Devuelve cuántos chats tocó. */
export async function guardarTurnos(turnos: readonly TurnoChat[]): Promise<number> {
  const porChat = new Map<string, TurnoChat[]>();
  for (const t of turnos) porChat.set(t.local, [...(porChat.get(t.local) ?? []), t]);
  if (!porChat.size) return 0;
  const ws = await wsSuperAdmin();
  return runWithWorkspace(ws, async () => {
    let n = 0;
    for (const [local, nuevos] of porChat) {
      const antes = sanearTurnos(parsear(await getSettingEstricto(PREFIJO + local)));
      await setSetting(PREFIJO + local, JSON.stringify(unirTurnos(antes, nuevos)));
      n++;
    }
    return n;
  });
}

/** Lo que se dijo en las sesiones de un chat (las de sus cuentas), la más vieja arriba. Para dibujar: sin la base, nada. */
export async function leerTurnos(locales: readonly string[]): Promise<TurnoChat[]> {
  const validos = [...new Set(locales.filter((l) => DESTINO_RE.test(l)))].slice(0, 12);
  if (!validos.length) return [];
  try {
    const ws = await wsSuperAdmin();
    const listas = await runWithWorkspace(ws, () => Promise.all(validos.map(async (l) => sanearTurnos(parsear(await getSetting(PREFIJO + l))))));
    return unirTurnos([], listas.flat());
  } catch {
    return [];
  }
}
