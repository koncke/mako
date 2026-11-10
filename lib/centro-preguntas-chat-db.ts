// =============================================================================
// Las preguntas de cada chat de Claude Code, en la base (17/10/2026)
// =============================================================================
// El molde es el de los turnos (lib/centro-turnos-db.ts): una clave de app_settings POR CHAT en el workspace de la
// PLATAFORMA (`wsSuperAdmin()`), `operaciones.preguntas.<local>`, con las últimas `PREGUNTAS_POR_CHAT`. Las reglas (qué
// es una pregunta válida, cómo se une, el texto de la respuesta) viven en lib/centro-preguntas-chat.ts.
//
// ⚠️ SIN MIGRACIÓN A PROPÓSITO: si un día se muda a una tabla, la forma es `PreguntaChat` y se lee por `local`.
// ⚠️ ESCRIBIR LEE ESTRICTO (AGENTS.md → «Una lectura que cae al DEFAULT sirve para dibujar, nunca para DECIDIR»): si no
//    puede leer lo que había, no escribe, o borraría las preguntas del chat con la vuelta nueva sola.
// ⚠️ CONTESTAR ES COMPARAR-Y-ESCRIBIR: sólo marca una pregunta que estaba SIN contestar. Dos dispositivos que contestan a
//    la vez: el segundo recibe «ya contestada», y lo que llega a la PC es el trabajo firmado de cada uno.
// ⚠️ LA GUARDA NO VIVE ACÁ: guarda el endpoint del cartero (su token) y contesta una acción con `puedeOperar`.

import 'server-only';
import { getSetting, getSettingEstricto, setSetting } from './settings';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { DESTINO_RE, sanearTurnos } from './operaciones-reglas';
import { esperaAMartinEnElChat, ignorarEnLaLista, mostrarDeNuevoEnLaLista, retirarDeLaLista, sanearPregunta, superarPreguntas, unirPreguntas, type PreguntaChat, type RespuestaPregunta, type TurnoQueSupera } from './centro-preguntas-chat';

const PREFIJO = 'operaciones.preguntas.';
/** Los turnos de cada chat (lib/centro-turnos-db.ts): una pregunta de wrap_up se supera con un turno posterior. */
const PREFIJO_TURNOS = 'operaciones.turnos.';
/** Cuántas espera cada chat, en UNA clave: la lista de chats lo lee en cada refresco (el globito y el orden), sin abrir
 *  la de cada uno. Se recalcula para el chat que se escribe, cada vez que se escribe. */
const CLAVE_ABIERTAS = 'operaciones.preguntas-abiertas';
const parsear = (v: string | null): unknown => { try { return v ? JSON.parse(v) : []; } catch { return []; } };
const lista = (x: unknown): PreguntaChat[] => (Array.isArray(x) ? x.map(sanearPregunta).filter((p): p is PreguntaChat => p != null) : []);
const parsearMapa = (v: string | null): Record<string, number> => {
  try {
    const o = v ? JSON.parse(v) : {};
    const out: Record<string, number> = {};
    if (o && typeof o === 'object' && !Array.isArray(o)) for (const [k, n] of Object.entries(o)) if (DESTINO_RE.test(k) && Number.isInteger(n) && (n as number) > 0) out[k] = n as number;
    return out;
  } catch { return {}; }
};

/** Anota cuántas espera cada chat que se acaba de escribir. Si no puede leer el mapa, no lo pisa (la cuenta vuelve sola
 *  con la próxima escritura de ese chat); el globito es un aviso, no la verdad de la pregunta. Devuelve si lo escribió. */
async function anotarAbiertas(porChat: ReadonlyMap<string, readonly PreguntaChat[]>): Promise<boolean> {
  try {
    const mapa = parsearMapa(await getSettingEstricto(CLAVE_ABIERTAS));
    for (const [local, ps] of porChat) {
      // Una superada (un wrap_up después del cual el chat siguió) no espera a nadie, y una técnica no espera a Martín (10/11/2026).
      const n = ps.filter(esperaAMartinEnElChat).length;
      if (n) mapa[local] = n; else delete mapa[local];
    }
    await setSetting(CLAVE_ABIERTAS, JSON.stringify(mapa));
    return true;
  } catch (err) {
    console.error('[operaciones] preguntas abiertas:', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * LA REGLA CON LA QUE SE CONTÓ EL MAPA (10/11/2026). El mapa de `CLAVE_ABIERTAS` se cuenta AL ESCRIBIR cada chat, así que cuando cambia
 * lo que «espera a Martín» (las técnicas ya no: lib/pregunta-para-martin.ts) el mapa guardado sigue contando las de antes —y un chat
 * dormido no se vuelve a escribir nunca—. La vuelta del Runner lo recuenta UNA vez, con la regla nueva, sobre los chats que el mapa
 * cuenta (los únicos que pueden estar de más). Lee estricto: si algo no se puede leer, no marca la regla y vuelve a probar.
 */
const CLAVE_REGLA_ABIERTAS = 'operaciones.preguntas-abiertas.regla';
export const REGLA_ABIERTAS = 'para-martin-1';
const MAX_RECUENTO = 300;
export async function recontarAbiertasSiCambioLaRegla(): Promise<boolean> {
  const ws = await wsSuperAdmin();
  return runWithWorkspace(ws, async () => {
    if ((await getSettingEstricto(CLAVE_REGLA_ABIERTAS)) === REGLA_ABIERTAS) return false;
    const mapa = parsearMapa(await getSettingEstricto(CLAVE_ABIERTAS));
    const listas = new Map<string, PreguntaChat[]>();
    for (const local of Object.keys(mapa).slice(0, MAX_RECUENTO)) listas.set(local, lista(parsear(await getSettingEstricto(PREFIJO + local))));
    if (listas.size && !(await anotarAbiertas(listas))) return false;
    await setSetting(CLAVE_REGLA_ABIERTAS, REGLA_ABIERTAS);
    return true;
  });
}

/** Cuántas preguntas espera cada sesión (para la lista: el globito y el orden). Para dibujar: sin la base, ninguna. */
export async function leerAbiertas(): Promise<Record<string, number>> {
  try {
    const ws = await wsSuperAdmin();
    return parsearMapa(await runWithWorkspace(ws, () => getSetting(CLAVE_ABIERTAS)));
  } catch {
    return {};
  }
}

/** Las sesiones de la cadena de `local` (la suya incluida; sin cadena, sólo ella), las que tienen una clave en la base. */
const deLaCadena = (local: string, cadena?: ReadonlyMap<string, readonly string[]>): string[] =>
  [...new Set([local, ...(cadena?.get(local) ?? [])])].filter((l) => DESTINO_RE.test(l)).slice(0, 12);

/** Guarda lo que subió una vuelta. Devuelve los ids que ENTRARON (la PC borra sólo esos: el molde de `cierresIds`).
 *  `cadena` (lib/centro-chats.ts → cadenasDeSesiones): una pregunta se supera también con los turnos de las otras sesiones de
 *  su chat (25/10/2026). */
export async function guardarPreguntas(preguntas: readonly PreguntaChat[], cadena?: ReadonlyMap<string, readonly string[]>): Promise<string[]> {
  const porChat = new Map<string, PreguntaChat[]>();
  for (const p of preguntas) porChat.set(p.local, [...(porChat.get(p.local) ?? []), p]);
  if (!porChat.size) return [];
  const ws = await wsSuperAdmin();
  return runWithWorkspace(ws, async () => {
    const entraron: string[] = [];
    const escritas = new Map<string, PreguntaChat[]>();
    for (const [local, nuevas] of porChat) {
      const antes = lista(parsear(await getSettingEstricto(PREFIJO + local)));
      // Con los turnos del chat (los de todas sus sesiones): una de wrap_up que llega cuando Martín ya contestó en la app entra
      // superada.
      const turnos = (await Promise.all(deLaCadena(local, cadena).map(async (l) => sanearTurnos(parsear(await getSetting(PREFIJO_TURNOS + l)))))).flat();
      // Y ANTES de unir: una de wrap_up que ya quedó atrás no frena a la misma pregunta hecha de nuevo (revisión de la ola 1).
      const juntas = superarPreguntas(unirPreguntas(superarPreguntas(antes, turnos, cadena), nuevas), turnos, cadena);
      await setSetting(PREFIJO + local, JSON.stringify(juntas));
      escritas.set(local, juntas);
      entraron.push(...nuevas.map((p) => p.id));
    }
    await anotarAbiertas(escritas);
    return entraron;
  });
}

/** Las preguntas de las sesiones de un chat (las de sus cuentas), la más vieja arriba. Para dibujar: sin la base, nada. */
export async function leerPreguntas(locales: readonly string[]): Promise<PreguntaChat[]> {
  const validos = [...new Set(locales.filter((l) => DESTINO_RE.test(l)))].slice(0, 12);
  if (!validos.length) return [];
  try {
    const ws = await wsSuperAdmin();
    const listas = await runWithWorkspace(ws, () => Promise.all(validos.map(async (l) => lista(parsear(await getSetting(PREFIJO + l))))));
    return listas.flat().sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  } catch {
    return [];
  }
}

/**
 * Con los turnos NUEVOS de una vuelta: las preguntas de wrap_up que quedaron atrás se marcan superadas (Martín contestó en
 * la app, en la caja o por Remote Control, o el chat siguió escribiendo: 27/10/2026). Lo llama `guardarTurnos`. Lee estricto:
 * si no puede leer, no escribe.
 * Con `cadena`, también las de las OTRAS sesiones de cada chat (25/10/2026): la pregunta de la cuenta 2 que la conversación
 * dejó atrás en la cuenta 1 (`superarPreguntas`).
 */
export async function superarConTurnos(turnos: readonly TurnoQueSupera[], cadena?: ReadonlyMap<string, readonly string[]>): Promise<void> {
  // `el` también (cartero 1.18.0): lo que el chat escribe después de un AskUserQuestion la deja atrás (superarPreguntas).
  const quienes = [...new Set(turnos.filter((t) => t.rol === 'yo' || t.rol === 'otro' || t.rol === 'el').map((t) => t.local))].filter((l) => DESTINO_RE.test(l));
  const locales = [...new Set(quienes.flatMap((l) => deLaCadena(l, cadena)))];
  if (!locales.length) return;
  const ws = await wsSuperAdmin();
  await runWithWorkspace(ws, async () => {
    const escritas = new Map<string, PreguntaChat[]>();
    for (const local of locales) {
      const actuales = lista(parsear(await getSettingEstricto(PREFIJO + local)));
      const superadas = superarPreguntas(actuales, turnos, cadena);
      if (superadas === actuales) continue;
      await setSetting(PREFIJO + local, JSON.stringify(superadas));
      escritas.set(local, superadas);
    }
    if (escritas.size) await anotarAbiertas(escritas);
  });
}

/** Retira la pregunta abierta `id` del chat `local` (cartero 1.17.4, `cartero.mjs retirar`). Las reglas: `retirarDeLaLista`.
 *  Lee estricto: si no puede leer lo que había, no escribe. Quien llama ya miró el token del cartero. */
export async function retirarPregunta(local: string, id: string): Promise<{ ok: true; pregunta: PreguntaChat } | { ok: false; error: string }> {
  if (!DESTINO_RE.test(local)) return { ok: false, error: 'falta el chat que la hizo' };
  const ws = await wsSuperAdmin();
  return runWithWorkspace(ws, async () => {
    const actuales = lista(parsear(await getSettingEstricto(PREFIJO + local)));
    const r = retirarDeLaLista(actuales, id);
    if (!r.ok) return r;
    await setSetting(PREFIJO + local, JSON.stringify(r.preguntas));
    await anotarAbiertas(new Map([[local, r.preguntas]]));
    return { ok: true, pregunta: r.pregunta };
  });
}

export type Contestada = { ok: true; pregunta: PreguntaChat } | { ok: false; error: string; yaContestada?: true; ignorada?: true };

/**
 * «Ignorar» o «Volver a mostrar» una pregunta (5/11/2026). Las reglas: `ignorarEnLaLista` y `mostrarDeNuevoEnLaLista`. No le manda
 * nada a la PC: es una marca de Martín, como el ✓ de un «Completado». Lee estricto: si no puede leer lo que había, no escribe.
 * Quien llama ya miró `puedeOperar`.
 */
export async function ignorarPregunta(local: string, id: string, ignorar: boolean): Promise<{ ok: true; pregunta: PreguntaChat } | { ok: false; error: string }> {
  if (!DESTINO_RE.test(local)) return { ok: false, error: 'Falta el chat.' };
  const ws = await wsSuperAdmin();
  return runWithWorkspace(ws, async () => {
    const actuales = lista(parsear(await getSettingEstricto(PREFIJO + local)));
    const r = ignorar ? ignorarEnLaLista(actuales, id) : mostrarDeNuevoEnLaLista(actuales, id);
    if (!r.ok) return r;
    await setSetting(PREFIJO + local, JSON.stringify(r.preguntas));
    await anotarAbiertas(new Map([[local, r.preguntas]]));
    return { ok: true, pregunta: r.pregunta };
  });
}

/**
 * Las preguntas de cada destino, para DECIDIR si un trabajo se entrega (la vuelta del Runner, lib/operaciones.ts). ESTRICTO: si no
 * puede leer, tira, y quien llama no entrega ese trabajo en esta vuelta (queda escrito y vuelve a intentar en la siguiente).
 */
export async function preguntasParaDecidir(destinos: readonly string[]): Promise<Map<string, PreguntaChat[]>> {
  const validos = [...new Set(destinos.filter((l) => DESTINO_RE.test(l)))].slice(0, 20);
  const out = new Map<string, PreguntaChat[]>();
  if (!validos.length) return out;
  const ws = await wsSuperAdmin();
  await runWithWorkspace(ws, async () => {
    for (const l of validos) out.set(l, lista(parsear(await getSettingEstricto(PREFIJO + l))));
  });
  return out;
}

/** Marca contestada una pregunta, sólo si no lo estaba. Quien llama ya verificó el trabajo firmado de la respuesta. */
export async function marcarContestada(local: string, id: string, respuesta: RespuestaPregunta): Promise<Contestada> {
  if (!DESTINO_RE.test(local)) return { ok: false, error: 'Falta el chat.' };
  const ws = await wsSuperAdmin();
  return runWithWorkspace(ws, async () => {
    const actuales = lista(parsear(await getSettingEstricto(PREFIJO + local)));
    const p = actuales.find((x) => x.id === id);
    if (!p) return { ok: false, error: 'Esa pregunta ya no está.' };
    if (p.respuesta) return { ok: false, error: 'Ya la contestaste.', yaContestada: true };
    // Ignorada en otro dispositivo (5/11/2026): su respuesta no se entrega (la vuelta del Runner la cancela), así que no se marca.
    if (p.ignorada) return { ok: false, error: 'La ignoraste: vuelve a mostrarla para contestarla.', ignorada: true };
    if (p.superada) return { ok: false, error: 'Ya no espera tu respuesta: el chat siguió.', yaContestada: true };
    const nueva: PreguntaChat = { ...p, respuesta };
    const juntas = actuales.map((x) => (x.id === id ? nueva : x));
    await setSetting(PREFIJO + local, JSON.stringify(juntas));
    await anotarAbiertas(new Map([[local, juntas]]));
    return { ok: true, pregunta: nueva };
  });
}
