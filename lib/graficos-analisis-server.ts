// =============================================================================
// graficos-analisis-server — el «AI Analyst» del Dashboard: leer, analizar y guardar
// =============================================================================
// La mitad sucia de lib/graficos-analisis.ts (que es la pura: el serializador, el saneo y el horario).
// `analizarHoja` es UNA sola función para el disparo a mano (app/api/graficos/analisis, por detrás con
// `after()`) y para el programado (app/api/cron/dashboard-analisis): si fueran dos, la segunda se
// queda vieja (AGENTS.md, «Una cosa, un lugar»).
//
// Lo que gobierna, y no se ve en las firmas:
//
//   · LA FILA ES ESTADO Y CANDADO A LA VEZ (como closing_jobs). Tomar la corrida es un compare-and-set
//     sobre el `corrida_id` que se leyó; escribir el resultado, otro sobre el propio. Cancelar borra el
//     token: la corrida que sigue por detrás termina, no puede escribir, y no pisa nada.
//
//   · SÓLO IA GRATIS, por `chatCheapCascade` con el pin de /modelos-ia y CASCADA_DOCS (el molde de
//     app/api/chat-agent/onboarding/guion-audio/route.ts). NUNCA `chatClaude`: si la cascada gratis
//     falla, cae a Sonnet y el veto la corta (lib/anthropic.ts), y la persona leería el texto del veto
//     en vez de `errorDeCascada`. CASCADA_DOCS y no CASCADA_GRATIS porque ésta no trae Gemini, y hay
//     negocios que sólo tienen esa key.
//
//   · EN UN CRON NO HAY SESIÓN. `leerTablero` usa la sesión (lib/graficos-tablero.ts): acá se lee la
//     clave de la persona con `getSettingEstricto`, y «no pude leer» NO es «nunca guardó» (con la
//     lectura caída no se analiza el informe inicial como si fuera el suyo). Y `tableroActual()`
//     contesta 'cliente' sin sesión: el conjunto «Tareas del Plan» del super admin se declara «no se
//     pudo leer» en el programado, en vez de leer la tabla vacía del otro tablero (ver `que_tablero`).
//
//   · UN FALLO NO SE REINTENTA SOLO (AGENTS.md, «el default es NO reintentar»): el horario ya avanzó
//     ANTES del trabajo, así que lo que se pierde es UNA ocurrencia, nunca hay dos.

import 'server-only';
import { randomUUID } from 'node:crypto';
import { getTenantDb, getWorkspaceActual, runWithWorkspace } from './workspace';
import { efectivoDe, esBloque, esGrafico, sanearTablero, tituloDe, type Hoja, type VistaValores } from './graficos-catalogo';
import { datosDeGraficos, hastaDeFuente, type DatosGrafico, type PedidoDatos } from './graficos-datos';
import { tableroInicial } from './graficos-plantillas';
import { getSettingEstricto } from './settings';
import { chatCheapCascade, CASCADA_DOCS, MODELO_DOCS, docsIADisponible, errorDeCascada, type ProvName } from './ai-cheap';
import { overrideDeFeature } from './model-registry';
import { porLaRedDePlataforma } from './graficos-ia-red';
import { getPromptText } from './prompt-render';
import { parseJsonObject } from './json-del-modelo';
import { tzDeWorkspace } from './timezone';
import { TZ_TIJUANA, hoyEnTijuana } from './date-utils';
import type { QueTablero } from './tablero-actual';
import {
  ANALISTA_SYSTEM_TEMPLATE, FEATURE_ANALISTA, MAX_TOKENS_SALIDA, agruparParaModelo, idComprimido, primeraCorrida,
  puedeArrancar, sanearCronAnalisis, sanearSalida, serializarHoja, siguienteCorrida, textoParaModelo, vistaDeFila,
  type EstadoLectura, type FilaAnalisis, type ItemAnalisis, type Origen, type VistaAnalisis,
} from './graficos-analisis';

const T = 'dashboard_analisis';
const COLS = 'id, usuario, hoja_id, componentes, cron, tz, proxima_at, anterior_at, que_tablero, estado, fase, corrida_id, origen, started_at, finished_at, error, analizado_at, resultado, entrada, modelo, visto_at, corridas';
type Fila = FilaAnalisis & { usuario: string };

/**
 * La clave del informe de una persona. ⚠️ ES LA MISMA que `clave` de lib/graficos-tablero.ts (que no
 * la exporta): `tests/graficos-analisis.test.ts` lee ese fuente y falla si se separan. Con otra clave,
 * el programado analizaría el informe INICIAL de todo el mundo sin un solo error.
 */
export const claveTablero = (sub: string): string => `graficos.tablero.${sub}`;

/** Lo que tiene que quedar del plazo para ARRANCAR un análisis: la cascada con esperas y respaldo. */
const RESERVA_MS = 90_000;
/** El techo de UN análisis, aunque el plazo del cron dé para más (la ruta y el cron cortan a los 300 s). */
const TECHO_MS = 240_000;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const ahoraIso = () => new Date().toISOString();

/** En una función que recibe o usa el negocio, resolverlo es la primera línea (AGENTS.md). */
async function wsActual(): Promise<number> {
  const ws = await getWorkspaceActual();
  if (ws == null) throw new Error('Sin negocio');
  return ws;
}

/** La fila de (persona, hoja), o null si nunca se analizó. ⚠️ Una lectura que falla TIRA: no es «nunca». */
export async function filaDe(usuario: string, hojaId: string): Promise<Fila | null> {
  const ws = await wsActual();
  const { data, error } = await (await getTenantDb()).from(T).select(COLS)
    .eq('workspace_id', ws).eq('usuario', usuario).eq('hoja_id', hojaId).maybeSingle();
  if (error) throw new Error(`No pude leer el análisis: ${error.message}`);
  return (data as Fila | null) ?? null;
}

export async function vistaDe(usuario: string, hojaId: string): Promise<VistaAnalisis> {
  return vistaDeFila(await filaDe(usuario, hojaId), Date.now());
}

/** Las hojas de esta persona con un análisis que todavía no vio (el punto del botón). */
export async function hojasConNuevo(usuario: string): Promise<string[]> {
  const ws = await wsActual();
  const { data, error } = await (await getTenantDb()).from(T).select('hoja_id, analizado_at, visto_at')
    .eq('workspace_id', ws).eq('usuario', usuario).not('analizado_at', 'is', null).limit(200);
  if (error) throw new Error(`No pude leer los análisis: ${error.message}`);
  const t = (s: string | null) => (s ? Date.parse(s) || 0 : 0);
  return ((data ?? []) as Array<{ hoja_id: string; analizado_at: string; visto_at: string | null }>)
    .filter((f) => t(f.analizado_at) > t(f.visto_at)).map((f) => f.hoja_id);
}

/** Crea la fila si no existe, sin tocar la que hay, y la devuelve. */
async function asegurarFila(usuario: string, hojaId: string): Promise<Fila> {
  const ws = await wsActual();
  const { error } = await (await getTenantDb()).from(T)
    .upsert({ workspace_id: ws, usuario, hoja_id: hojaId }, { onConflict: 'workspace_id,usuario,hoja_id', ignoreDuplicates: true });
  if (error) throw new Error(`No pude preparar el análisis: ${error.message}`);
  const f = await filaDe(usuario, hojaId);
  if (!f) throw new Error('No pude preparar el análisis: la base no devolvió la fila.');
  return f;
}

/**
 * Toma la corrida, o dice que la tiene otro (`null`). Compare-and-set sobre el token que se LEYÓ, con
 * `.select()` de las filas tocadas: sin leerlas no hay compare-and-set, el update toca cero filas sin
 * error y se analiza dos veces (lib/avisos-programados.ts, medido el 07/10/2026).
 */
async function tomarCorrida(f: Fila, origen: Origen, extra: Record<string, unknown> = {}): Promise<string | null> {
  if (!puedeArrancar(f, Date.now())) return null;
  const token = randomUUID();
  const ahora = ahoraIso();
  const base = (await getTenantDb()).from(T)
    .update({ ...extra, estado: 'corriendo', fase: 'leyendo', corrida_id: token, origen, started_at: ahora, finished_at: null, updated_at: ahora })
    .eq('id', f.id);
  const { data, error } = await (f.corrida_id ? base.eq('corrida_id', f.corrida_id) : base.is('corrida_id', null)).select('id');
  if (error) throw new Error(`No pude arrancar el análisis: ${error.message}`);
  return data?.length ? token : null;
}

/** Cierra la corrida. `false` = ya no es nuestra (se canceló o venció y la tomó otro): no se escribe nada. */
async function cerrar(filaId: number, token: string, cambios: Record<string, unknown>): Promise<boolean> {
  const ahora = ahoraIso();
  const { data, error } = await (await getTenantDb()).from(T)
    .update({ ...cambios, fase: null, finished_at: ahora, updated_at: ahora })
    .eq('id', filaId).eq('corrida_id', token).eq('estado', 'corriendo').select('id');
  if (error) { console.error(`[analista] no pude cerrar la corrida ${filaId}: ${error.message}`); return false; }
  return !!data?.length;
}
const cerrarConError = (filaId: number, token: string, error: string) => cerrar(filaId, token, { estado: 'error', error: error.slice(0, 600) });

async function marcarFase(filaId: number, token: string, fase: 'leyendo' | 'escribiendo'): Promise<void> {
  const { error } = await (await getTenantDb()).from(T).update({ fase, updated_at: ahoraIso() }).eq('id', filaId).eq('corrida_id', token);
  if (error) console.warn(`[analista] fase ${fase}: ${error.message}`);
}

/** Lo que hace falta para correr un análisis. Lo arman el disparo a mano y el cron. */
export type PedidoAnalisis = {
  ws: number;
  usuario: string;
  filaId: number;
  corridaId: string;
  corridasPrevias: number;
  hoja: Hoja;
  /** null = toda la hoja. */
  ids: string[] | null;
  /** Lo que la persona eligió MIRANDO (a mano); `{}` en el programado: los valores guardados. */
  vista: VistaValores;
  hoy: string;
  origen: Origen;
  /** La fecha límite ABSOLUTA de toda la corrida (la cascada incluida). */
  hastaMs: number;
  queTablero: QueTablero | null;
};

/**
 * El disparo a mano: prepara la fila, toma la corrida y devuelve el pedido para correrlo por detrás.
 * La selección de gráficos se guarda en la fila: es la del analista de esa hoja, a mano y programado.
 */
export async function arrancarAMano(p: { usuario: string; hoja: Hoja; ids: string[] | null; vista: VistaValores; queTablero: QueTablero; hastaMs: number }):
  Promise<{ ok: true; pedido: PedidoAnalisis } | { ok: false; vista: VistaAnalisis }> {
  const ws = await wsActual();
  const f = await asegurarFila(p.usuario, p.hoja.id);
  const token = await tomarCorrida(f, 'manual', { componentes: p.ids });
  if (!token) return { ok: false, vista: vistaDeFila(await filaDe(p.usuario, p.hoja.id), Date.now()) };
  return {
    ok: true,
    pedido: {
      ws, usuario: p.usuario, filaId: f.id, corridaId: token, corridasPrevias: f.corridas ?? 0,
      hoja: p.hoja, ids: p.ids, vista: p.vista, hoy: hoyEnTijuana(), origen: 'manual', hastaMs: p.hastaMs, queTablero: p.queTablero,
    },
  };
}

/** Corta la corrida viva. La que sigue por detrás termina igual, pero ya no puede escribir su resultado. */
export async function cancelarCorrida(usuario: string, hojaId: string): Promise<boolean> {
  const ws = await wsActual();
  const ahora = ahoraIso();
  const { data, error } = await (await getTenantDb()).from(T)
    .update({ estado: 'cancelado', fase: null, corrida_id: null, finished_at: ahora, updated_at: ahora })
    .eq('workspace_id', ws).eq('usuario', usuario).eq('hoja_id', hojaId).eq('estado', 'corriendo').select('id');
  if (error) throw new Error(`No pude cancelar: ${error.message}`);
  return !!data?.length;
}

/** Ya lo vio: apaga el punto del botón. Sólo si sigue siendo ESE análisis (uno más nuevo vuelve a prenderlo). */
export async function marcarVisto(usuario: string, hojaId: string, analizadoAt: string): Promise<void> {
  const ws = await wsActual();
  const { error } = await (await getTenantDb()).from(T).update({ visto_at: analizadoAt })
    .eq('workspace_id', ws).eq('usuario', usuario).eq('hoja_id', hojaId).eq('analizado_at', analizadoAt);
  if (error) throw new Error(`No pude marcarlo visto: ${error.message}`);
}

/** El horario que la pantalla pide y no se puede guardar: un 400 con el motivo, no el 500 de una escritura. */
export class NoProgramable extends Error {
  constructor() { super('Ese horario no se puede programar: cada día, cada semana o cada mes.'); this.name = 'NoProgramable'; }
}

/**
 * Programa (o desprograma, con `cron: null`) el análisis de una hoja.
 *
 * ⚠️ LA ZONA SE RESUELVE ACÁ Y SE CONGELA EN LA FILA (lib/avisos-programados.ts, el mismo porqué):
 * `tzDeWorkspace` puede salir a la red, y resolverla en cada tick movería el horario el día que conteste
 * otra cosa. Y `que_tablero` también se congela: en el cron no hay sesión para preguntarlo.
 * ⚠️ El error de escritura NO se traga: la pantalla pintaría el horario elegido sobre una fila vacía.
 */
export async function programar(p: { usuario: string; hojaId: string; cron: unknown; componentes: string[] | null; queTablero: QueTablero }): Promise<VistaAnalisis> {
  const ws = await wsActual();
  const limpio = p.cron == null ? null : sanearCronAnalisis(p.cron);
  if (p.cron != null && !limpio) throw new NoProgramable();
  const f = await asegurarFila(p.usuario, p.hojaId);
  const ahora = new Date();
  let cambios: Record<string, unknown>;
  if (limpio) {
    const tz = await tzDeWorkspace(ws).catch(() => TZ_TIJUANA);
    cambios = {
      cron: limpio, tz, proxima_at: primeraCorrida(limpio, tz, ahora).toISOString(), anterior_at: ahora.toISOString(),
      que_tablero: p.queTablero, componentes: p.componentes,
    };
  } else cambios = { cron: null, proxima_at: null, anterior_at: null };
  const { data, error } = await (await getTenantDb()).from(T).update({ ...cambios, updated_at: ahora.toISOString() })
    .eq('id', f.id).select(COLS).maybeSingle();
  if (error) throw new Error(`No pude guardar el horario: ${error.message}`);
  if (!data) throw new Error('No pude guardar el horario: la base no devolvió la fila.');
  return vistaDeFila(data as Fila, Date.now());
}

/**
 * EL ANÁLISIS. Lee lo que la hoja muestra, lo serializa sin personas, le pregunta a la IA gratis,
 * sanea la salida y la guarda en la fila — sólo si la corrida sigue siendo suya.
 */
export async function analizarHoja(p: PedidoAnalisis): Promise<{ ok: boolean; error?: string }> {
  return runWithWorkspace(p.ws, async () => {
    const fallar = async (error: string) => { await cerrarConError(p.filaId, p.corridaId, error); return { ok: false, error }; };
    try {
      // a) Qué se analiza: los gráficos (los elegidos, si hay). Los bloques todavía no: su payload es
      //    propio de cada uno y «A quién cobrarle» trae nombres de clientes. Se NOMBRAN como no incluidos.
      const elegidos = p.ids ? new Set(p.ids) : null;
      const comps = p.hoja.componentes.filter((c) => !elegidos || elegidos.has(c.id));
      const graficos = comps.filter(esGrafico);
      const noIncluidos = comps.filter(esBloque).map((b) => ({ titulo: tituloDe(b), motivo: 'Los bloques todavía no se analizan.' }));
      if (!graficos.length) return await fallar(elegidos ? 'Los gráficos elegidos ya no están en la hoja.' : 'Esta hoja no tiene gráficos para analizar.');

      // b) El período, los filtros y el «agrupar por» de cada uno: los MISMOS que la pantalla
      //    (`efectivoDe`, con la vista de la persona a mano y vacía en el programado).
      const pedidos: PedidoDatos[] = [];
      const prep = graficos.map((g) => {
        const ef = efectivoDe(g, p.hoja, p.vista, p.hoy);
        // Como /api/graficos: un período que termina después de hoy se acota a hoy.
        const hasta = ef.hasta > p.hoy ? (p.hoy < ef.desde ? ef.desde : p.hoy) : ef.hasta;
        if (g.fuente === 'tareas' && p.origen === 'cron' && p.queTablero === 'dueno') {
          return { g, ef, hasta, bloqueo: 'El análisis programado todavía no puede leer el tablero del super admin.' as string | null, comprimir: null };
        }
        pedidos.push({ grafico: g, desde: ef.desde, hasta, filtros: ef.filtros, agrupar: ef.agrupar });
        // Una serie de 90 días por día no entra: se pide TAMBIÉN por semana (la misma lectura, que
        // `datosDeGraficos` comparte por clave) y la de la pantalla queda para la firma.
        const comprimir = agruparParaModelo(ef.agrupar ?? g.dimension, ef.desde, hasta);
        if (comprimir) pedidos.push({ grafico: { ...g, id: idComprimido(g.id) }, desde: ef.desde, hasta, filtros: ef.filtros, agrupar: comprimir });
        return { g, ef, hasta, bloqueo: null, comprimir };
      });
      const datos: Record<string, DatosGrafico> = pedidos.length ? await datosDeGraficos(pedidos) : {};
      const items: ItemAnalisis[] = prep.map((x) => {
        // ⚠️ Sin dato de la lectura es «no se pudo leer», NUNCA un resultado vacío.
        const lectura: EstadoLectura = x.bloqueo ? { ok: false, error: x.bloqueo } : datos[x.g.id] ?? { ok: false, error: 'No pude leer los datos' };
        return {
          g: x.g, lectura,
          ...(x.comprimir ? { comprimida: datos[idComprimido(x.g.id)], agrupadaPor: x.comprimir } : {}),
          desde: x.ef.desde, hasta: x.hasta, hastaFuente: hastaDeFuente(x.g, x.ef.desde, x.hasta),
          filtros: x.ef.filtros, noAplica: x.ef.noAplica,
        };
      });

      // c) Lo que ve el modelo: serializado ACÁ, sin nombres, con unidades y recortes declarados.
      const entrada = serializarHoja({ hoja: p.hoja, hoy: p.hoy, origen: p.origen, conVista: Object.keys(p.vista).length > 0, items, noIncluidos });
      if (!entrada.graficos.some((g) => !('error' in g))) return await fallar('No pude leer ninguno de los gráficos de la hoja.');

      // d) La IA, sólo gratis: primero las keys del negocio y, si ninguna devuelve algo usable (o no
      //    tiene ninguna), la RED DE PLATAFORMA (lib/graficos-ia-red.ts). Martín, 11/10/2026: «siempre
      //    tiene que probar con otros provedoores» — la única key de Gemini del ws1 la bloqueó Google y el
      //    panel decía que no pudo, con la agencia teniendo con qué contestar.
      const hayIaDelNegocio = await docsIADisponible().catch(() => false);
      await marcarFase(p.filaId, p.corridaId, 'escribiendo');
      const pin = await overrideDeFeature(FEATURE_ANALISTA).catch(() => null);
      const usaPin = pin != null && pin.provider !== 'anthropic';
      const errores: string[] = [];
      const rechazos: string[] = [];
      // ⚠️ QUÉ MODELO CONTESTÓ: `chatCheapCascade` no lo dice todavía. Falta su parámetro de salida
      // `respondioOut` en lib/ai-cheap.ts (no es de este archivo: queda como pendiente de quien integra).
      // Se le pasa igual dónde anotarlo —`opciones` no es un literal fresco, así que el compilador no
      // reclama la clave de más—; mientras la cascada no la escriba queda vacía y se guarda null, NUNCA
      // el modelo configurado, que es la degradación silenciosa que landing-analyst ya pagó.
      const respondio: { provider?: string; model?: string } = {};
      const opciones = {
        system: await getPromptText('dashboard.analista.system', ANALISTA_SYSTEM_TEMPLATE),
        user: textoParaModelo(entrada),
        json: true, maxTokens: MAX_TOKENS_SALIDA, temperature: 0.3, esfuerzo: 'low' as const,
        feature: FEATURE_ANALISTA, motivo: `AI Analyst · ${p.hoja.nombre.slice(0, 40)}${p.origen === 'cron' ? ' · programado' : ''}`,
        provs: usaPin ? [pin.provider as ProvName] : CASCADA_DOCS,
        modelos: usaPin ? ({ [pin.provider]: pin.model } as Partial<Record<ProvName, string>>) : MODELO_DOCS,
        validar: (t: string) => {
          try {
            if (sanearSalida(parseJsonObject(t), entrada)) return true;
            rechazos.push('no apoyó ningún hallazgo en los datos de la hoja');
          } catch { rechazos.push('devolvió un JSON que no se pudo leer'); }
          return false;
        },
        erroresOut: errores,
        hastaMs: p.hastaMs,
        respondioOut: respondio,
      };
      let crudo = hayIaDelNegocio ? await chatCheapCascade(opciones) : '';
      if (!crudo.trim()) {
        const red = await porLaRedDePlataforma({
          system: opciones.system, user: opciones.user, maxTokens: MAX_TOKENS_SALIDA,
          feature: FEATURE_ANALISTA, motivo: opciones.motivo, hastaMs: p.hastaMs, validar: opciones.validar,
        });
        if (red) {
          crudo = red.texto;
          respondio.provider = `red de plataforma · ${red.provider}`;
        }
      }
      if (!crudo.trim()) {
        return await fallar(rechazos.length
          ? `El análisis que escribió MaKo ${rechazos[rechazos.length - 1]}. Prueba de nuevo.`
          : await errorDeCascada(errores, 'analizar tus gráficos'));
      }
      const salida = sanearSalida(parseJsonObject(crudo), entrada);
      if (!salida) return await fallar('El análisis que escribió MaKo no se apoyaba en los datos de la hoja. Prueba de nuevo.');

      // e) Se guarda SÓLO si la corrida sigue siendo nuestra.
      const ok = await cerrar(p.filaId, p.corridaId, {
        estado: 'listo', error: null, analizado_at: ahoraIso(), resultado: salida, entrada,
        modelo: respondio.provider ? `${respondio.provider}/${respondio.model ?? ''}`.slice(0, 120) : null,
        corridas: p.corridasPrevias + 1,
      });
      if (!ok) console.info(`[analista] hoja ${p.hoja.id}: la corrida se canceló, el resultado no se guarda`);
      return { ok };
    } catch (e) {
      console.error(`[analista] hoja ${p.hoja.id}: ${msg(e)}`);
      return await fallar('No pude analizar la hoja. Prueba de nuevo.');
    }
  });
}

export type CuentaCron = { corridos: number; fallidos: number; sinTurno: number; saltados: number };

/**
 * Lo programado que venció en el negocio ACTUAL (el cron lo llama adentro de `runWithWorkspace`).
 *
 * ⚠️ EL ORDEN: primero se avanza el horario con compare-and-set, recién después se trabaja. Si el
 * trabajo falla se pierde UNA ocurrencia; al revés, dos ticks solapados analizarían dos veces.
 * ⚠️ Y LO QUE NO TIENE TURNO NO SE TOCA: queda vencido y lo toma el tick siguiente (no se quema).
 */
export async function drenarVencidos(opts: { deadline: number }): Promise<CuentaCron> {
  const ws = await wsActual();
  const cuenta: CuentaCron = { corridos: 0, fallidos: 0, sinTurno: 0, saltados: 0 };
  const db = await getTenantDb();
  const { data, error } = await db.from(T).select(COLS).eq('workspace_id', ws)
    .not('cron', 'is', null).lte('proxima_at', ahoraIso()).order('proxima_at', { ascending: true }).limit(20);
  if (error) throw new Error(`No pude leer lo programado: ${error.message}`);
  const filas = (data ?? []) as Fila[];
  if (!filas.length) return cuenta;
  // ⚠️ Un negocio SIN IA propia también se analiza: después de sus keys va la red de plataforma
  // (lib/graficos-ia-red.ts; Martín, 11/10/2026: «siempre tiene que probar con otros provedoores»).

  for (const f of filas) {
    if (Date.now() > opts.deadline - RESERVA_MS) { cuenta.sinTurno++; continue; }
    const cron = sanearCronAnalisis(f.cron);
    if (!cron || !f.tz || !f.proxima_at) { cuenta.saltados++; continue; }
    const proxima = siguienteCorrida(cron, f.proxima_at, f.tz, new Date());
    const { data: tocadas, error: e2 } = await db.from(T)
      .update({ proxima_at: proxima.toISOString(), anterior_at: f.proxima_at, updated_at: ahoraIso() })
      .eq('id', f.id).eq('proxima_at', f.proxima_at).select('id');   // compare-and-set
    if (e2 || !tocadas?.length) { cuenta.saltados++; continue; }

    // Si hay una corrida a mano viva, esta ocurrencia se saltea: la de a mano es igual de fresca.
    const token = await tomarCorrida(f, 'cron').catch((e) => { console.error(`[analista:cron] ${f.id}: ${msg(e)}`); return null; });
    if (!token) { cuenta.saltados++; continue; }
    // El informe GUARDADO de esa persona. «No pude leer» no es «nunca guardó».
    let hoja: Hoja | null;
    try {
      const raw = await getSettingEstricto(claveTablero(f.usuario));
      const tablero = raw == null ? tableroInicial() : (sanearTablero(JSON.parse(raw)) ?? tableroInicial());
      hoja = tablero.hojas.find((h) => h.id === f.hoja_id) ?? null;
    } catch (e) {
      console.error(`[analista:cron] ${f.id}: ${msg(e)}`);
      await cerrarConError(f.id, token, 'No pude leer tu informe guardado.');
      cuenta.fallidos++;
      continue;
    }
    if (!hoja) {
      // La hoja se borró: se dice y se desprograma, o el cron la buscaría en cada ocurrencia para siempre.
      await cerrarConError(f.id, token, 'La hoja ya no existe: se sacó el horario.');
      await db.from(T).update({ cron: null, proxima_at: null, anterior_at: null, updated_at: ahoraIso() }).eq('id', f.id);
      cuenta.fallidos++;
      continue;
    }

    const r = await analizarHoja({
      ws, usuario: f.usuario, filaId: f.id, corridaId: token, corridasPrevias: f.corridas ?? 0,
      hoja, ids: f.componentes, vista: {}, hoy: hoyEnTijuana(), origen: 'cron',
      hastaMs: Math.min(opts.deadline, Date.now() + TECHO_MS),
      queTablero: f.que_tablero === 'dueno' || f.que_tablero === 'cliente' ? f.que_tablero : null,
    });
    if (r.ok) cuenta.corridos++; else cuenta.fallidos++;
  }
  return cuenta;
}
