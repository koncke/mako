// =============================================================================
// El Plan de cada chat se arma solo — el lado del servidor (17/10/2026)
// =============================================================================
// Las reglas y el porqué en lib/centro-plan-auto-reglas.ts. Acá:
//   · `anotarTurnosDelPlan`: lo llama la vuelta del Runner (lib/operaciones.ts → cicloCartero) con los turnos que acaban
//     de entrar. Es rápido: sólo escribe la lista de cada chat (`operaciones.plan-chat.<local>`) y el índice de los que
//     tienen algo pendiente (`operaciones.plan-chat-pendientes`).
//   · `aplicarPlanDeLosChats`: corre DESPUÉS de contestarle al Runner (`after()`), porque cada alta o cierre pasa por el
//     Perro (30 a 60 s) y el Runner no puede esperar: su vuelta corta a los 120 s. Hace lo que entra en el presupuesto y
//     deja lo demás para la vuelta siguiente.
// Escribe el Plan SÓLO con las operaciones de la API de MaKo (lib/centro-plan.ts → sumarTareaAlPlan, cerrarTareaDelPlan),
// como todo el Centro (AGENTS.md → «Cada jefe ES un proyecto del Plan»), con el actor «MaKo · Ops Center».
//
// ⚠️ ESCRIBIR LEE ESTRICTO: si no puede leer la lista de un chat, no la pisa (se perderían sus tareas).
// ⚠️ DOS VUELTAS A LA VEZ (dos Runners, o `vigilar` que da otra mientras el Perro piensa): un candado con vencimiento
//    (`CANDADO`) deja aplicar a una sola. No es atómico; lo que se escape lo frena `sumarTareaAlPlan`, que mira antes si
//    ya hay una abierta con ese título, y cerrar dos veces la misma dice «Ya no estaba abierta».

import 'server-only';
import { getSetting, getSettingEstricto, setSetting } from './settings';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { canalKeyDe } from './api-mako/canal';
import type { Ctx } from './api-mako/tipos';
import { DESTINO_RE, type TurnoChat } from './operaciones-reglas';
import { proyectoDelChat } from './centro-plan-reglas';
import { cerrarTareaDelPlan, sumarTareaAlPlan } from './centro-plan';
import { anotarTurnos, conResultado, proximoPaso, sanearTareasDelChat, type TareaDelChat } from './centro-plan-auto-reglas';

const PREFIJO = 'operaciones.plan-chat.';
const PENDIENTES = 'operaciones.plan-chat-pendientes';
/** Mientras una vuelta aplica, la siguiente no empieza (el Perro tarda; dos a la vez crearían la misma tarea dos veces).
 *  Vence solo: una vuelta cortada no lo deja tomado. */
const CANDADO = 'operaciones.plan-chat-candado';
const parsear = (v: string | null): unknown => { try { return v ? JSON.parse(v) : []; } catch { return []; } };
const locales = (x: unknown): string[] => (Array.isArray(x) ? x.filter((l): l is string => typeof l === 'string' && DESTINO_RE.test(l)) : []);

/** El contexto con el que MaKo escribe el Plan por los chats: el workspace de la plataforma, con su actor. */
export function ctxDeMaKo(ws: number): Ctx {
  return { ws, canal: 'app', canalKey: canalKeyDe('app', 'centro:mako'), alcance: 'ejecutar', rol: 'admin', actor: 'MaKo · Ops Center' };
}

/** Anota los «Voy a trabajar en…» y los «Ya está» que acaban de entrar. `titulos`: el nombre de cada sesión ahora. */
export async function anotarTurnosDelPlan(turnos: readonly TurnoChat[], titulos: ReadonlyMap<string, string>): Promise<number> {
  const porChat = new Map<string, TurnoChat[]>();
  for (const t of turnos) if (t.rol === 'el') porChat.set(t.local, [...(porChat.get(t.local) ?? []), t]);
  const ws = await wsSuperAdmin();
  return runWithWorkspace(ws, async () => {
    const conAlgo: string[] = [];
    for (const [local, ts] of porChat) {
      const chat = titulos.get(local);
      // El Cerebro no tiene proyecto (reparte), y un chat sin nombre no tiene jefe: no se anota nada.
      if (!chat || !proyectoDelChat(chat)) continue;
      const antes = sanearTareasDelChat(parsear(await getSettingEstricto(PREFIJO + local)));
      const despues = anotarTurnos(antes, ts, chat);
      if (JSON.stringify(despues) === JSON.stringify(antes)) continue;
      await setSetting(PREFIJO + local, JSON.stringify(despues));
      if (proximoPaso(despues)) conAlgo.push(local);
    }
    if (conAlgo.length) {
      const ya = locales(parsear(await getSettingEstricto(PENDIENTES)));
      await setSetting(PENDIENTES, JSON.stringify([...new Set([...ya, ...conAlgo])]));
    }
    return conAlgo.length;
  });
}

/** Lo que el Plan tiene que hacer por los chats, hasta `presupuestoMs`. Lo que no entra queda para la vuelta siguiente. */
export async function aplicarPlanDeLosChats(presupuestoMs: number): Promise<number> {
  const fin = Date.now() + presupuestoMs;
  const ws = await wsSuperAdmin();
  const ctx = ctxDeMaKo(ws);
  return runWithWorkspace(ws, async () => {
    let hechos = 0;
    const pendientes = locales(parsear(await getSettingEstricto(PENDIENTES)));
    if (!pendientes.length) return 0;
    const candado = Number(await getSettingEstricto(CANDADO));
    if (Number.isFinite(candado) && candado > Date.now()) return 0;
    await setSetting(CANDADO, String(fin + 60_000));
    const siguen: string[] = [];
    for (const local of pendientes) {
      let lista = sanearTareasDelChat(parsear(await getSettingEstricto(PREFIJO + local)));
      // Cada paso del Perro tarda hasta un minuto: no se empieza uno sin 70 s por delante.
      while (Date.now() + 70_000 < fin) {
        const p = proximoPaso(lista);
        if (!p) break;
        const r = p.accion === 'crear'
          ? await sumarTareaAlPlan(ctx, p.t.chat, { titulo: p.t.titulo, detalle: 'Lo armó MaKo con el «Voy a trabajar en…» del chat.', proyecto: proyectoDelChat(p.t.chat) ?? p.t.chat }).catch(() => null)
          : await cerrarTareaDelPlan(ctx, p.t.chat, { id: p.t.tarea!, evidencia: `El chat «${p.t.chat}» dijo «Ya está».` }).catch(() => null);
        lista = conResultado(lista, p.t, r?.ok ? { ok: true, tarea: r.tareaId ?? null } : { ok: false });
        await setSetting(PREFIJO + local, JSON.stringify(lista));
        hechos++;
      }
      if (proximoPaso(lista)) siguen.push(local);
    }
    await setSetting(PENDIENTES, JSON.stringify(siguen));
    await setSetting(CANDADO, '0');
    return hechos;
  });
}

/** Las tareas de las sesiones de un chat, para su conversación (la tarjeta del Plan del «Ya está», «Tareas vinculadas»). */
export async function leerTareasDelChat(locales_: readonly string[]): Promise<TareaDelChat[]> {
  const validos = [...new Set(locales_.filter((l) => DESTINO_RE.test(l)))].slice(0, 12);
  if (!validos.length) return [];
  try {
    const ws = await wsSuperAdmin();
    const listas = await runWithWorkspace(ws, () => Promise.all(validos.map(async (l) => sanearTareasDelChat(parsear(await getSetting(PREFIJO + l))))));
    return listas.flat().sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  } catch {
    return [];
  }
}
