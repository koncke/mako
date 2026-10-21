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
import { ULTIMOS_VENTANA_MS, DESTINO_RE, resumirTurnos, sanearTurnos, unirTurnos, type TurnoChat } from './operaciones-reglas';
import { getSupabaseServer } from './supabase';
import { esYaEsta } from './centro-chats';
import { superarConTurnos } from './centro-preguntas-chat-db';

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
    // Lo que Martín (u otro chat) dijo después de una pregunta de wrap_up la deja atrás (20/10/2026): no espera más. Si
    // falla, los turnos ya quedaron: la pregunta se supera con la próxima vuelta que traiga un turno.
    await superarConTurnos(turnos).catch((err) => console.error('[operaciones] superar preguntas:', err instanceof Error ? err.message : err));
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

// ── Lo último de TODOS los chats, para la lista (17/10/2026) ────────────────────────────────────────────────────────────
// Un «Ya está» sólo avisaba en los chats que se habían abierto en esa pantalla: los turnos viajan del chat que se mira. Esto
// trae, de cada chat con algo reciente, sus últimos turnos recortados (`resumirTurnos`) en cada refresco. Pesaba ~0,9 MB leer
// los 61 chats enteros (medido el 17/10), así que: (1) sólo los tocados en los últimos 3 días, y (2) por chat se guarda lo ya
// leído con su `updated_at`: una lectura liviana pide qué cambió y trae el valor sólo de lo cambiado.
const ULTIMOS_EN_MEMORIA = new Map<string, { at: string; turnos: TurnoChat[] }>();

/** Los últimos turnos de cada chat tocado hace poco, por sesión (`local_…`). Para dibujar: sin la base, nada. */
export async function leerUltimosTurnos(ahora = Date.now()): Promise<Record<string, TurnoChat[]>> {
  try {
    const ws = await wsSuperAdmin();
    const sb = getSupabaseServer();
    const desde = new Date(ahora - ULTIMOS_VENTANA_MS).toISOString();
    const { data: filas, error } = await sb.from('app_settings').select('key, updated_at')
      .eq('workspace_id', ws).like('key', `${PREFIJO}%`).gte('updated_at', desde).limit(300);
    if (error || !filas) return {};
    const cambiadas = filas.filter((f) => ULTIMOS_EN_MEMORIA.get(f.key)?.at !== f.updated_at).map((f) => f.key as string);
    for (let i = 0; i < cambiadas.length; i += 25) {
      const lote = cambiadas.slice(i, i + 25);
      const { data: valores } = await sb.from('app_settings').select('key, value, updated_at').eq('workspace_id', ws).in('key', lote);
      for (const v of valores ?? []) {
        ULTIMOS_EN_MEMORIA.set(v.key, { at: v.updated_at, turnos: sanearTurnos(parsear(v.value)) });
      }
    }
    const out: Record<string, TurnoChat[]> = {};
    for (const f of filas) {
      const local = String(f.key).slice(PREFIJO.length);
      if (!DESTINO_RE.test(local)) continue;
      // Con su último «Ya está», aunque haya escrito más después: el ✓ del «Completado» (18/10/2026).
      const r = resumirTurnos(ULTIMOS_EN_MEMORIA.get(f.key)?.turnos ?? [], ahora, esYaEsta);
      if (r.length) out[local] = r;
    }
    return out;
  } catch {
    return {};
  }
}
