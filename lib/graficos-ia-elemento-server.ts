// =============================================================================
// graficos-ia-elemento-server — las cajas «Conclusiones de MaKo»: leer, escribir con la IA gratis y guardar
// =============================================================================
// La mitad sucia de lib/graficos-ia-elemento.ts. Es una corrida del AI Analyst ACOTADA a la caja, y usa las
// MISMAS piezas que él (lib/graficos-analisis-server.ts): el candado de la fila, la lectura de lo que los
// gráficos muestran, la IA gratis (las keys del negocio y la red de plataforma) y el drenaje del cron. Lo propio:
// el pedido de la caja, qué muestra, el largo, y el modo ENTIDAD (lo que se abrió en un pop-up).
//
// Lo que gobierna, y no se ve en las firmas:
//   · NUNCA CORRE AL ABRIR LA HOJA. Sólo `arrancarCaja` toma una corrida, y la llaman únicamente el «Generar» del
//     panel y el ↻ de la caja (POST de app/api/graficos/ia-elemento, sólo admin) y el cron, con un horario puesto.
//     Leer la caja (`vistaDeCaja`) no escribe nada.
//   · UNA CAJA EN UN POP-UP LEE LO QUE SE ABRIÓ (una llamada o un anuncio), y su fila es por eso que se abrió
//     (`ref`). De una llamada lee su análisis guardado Y lo que se dijo (el transcript de Fathom, decisión 3 de
//     Martín del 12/10/2026). Eso queda en `entrada` y no sale de la tabla: la pantalla recibe `vistaDeFilaCaja`.
//   · QUÉ ES CADA COSA LO DECIDE EL SERVER: el contexto del pop-up (`contextoDeClic`) se rearma con el gráfico
//     dueño del pop-up y el `ref` que manda el navegador; un `ref` que no es de esa entidad no lee nada.
//   · EL CLOSER (que mira un informe EN MEMORIA, `informeCloser`) lee la caja de la CUENTA: la última que escribió
//     cualquiera del negocio para esa misma caja (los ids de la plantilla Closing son fijos, así que la caja del
//     admin y la del closer son la misma). No genera: eso es del admin.

import 'server-only';
import { getTenantDb, getWorkspaceActual, runWithWorkspace } from './workspace';
import { esElemento, type Hoja, type VistaValores } from './graficos-catalogo';
import { paraModelo, primeraCorrida, serializarHoja, type Origen } from './graficos-analisis';
import { contextoDeClic, type ContextoEntidad } from './graficos-acciones';
import {
  CLAVE_PROMPT_CAJA, ELEMENTO_IA_SYSTEM_TEMPLATE, FEATURE_CONCLUSIONES, LARGOS, buscarCaja, cajaLlevaDatosDeClientes, cronDeCaja, entidadParaModelo,
  entradaDeAnuncio, entradaDeLlamada, graficosDeCaja, sanearSalidaCaja, sanearSalidaEntidad, userDeCaja, vistaDeFilaCaja,
  type EntradaEntidad, type FilaCaja, type LineaParaIA, type VistaCaja,
} from './graficos-ia-elemento';
import {
  TECHO_MS, cerrarConError, cerrarCorrida, drenarTabla, leerGraficosParaIA, leerInformeGuardado, marcarFase, pedirIAGratis,
  tomarCorrida, type CuentaCron,
} from './graficos-analisis-server';
import { errorDeCascada } from './ai-cheap';
import { getPromptText } from './prompt-render';
import { parseJsonObject } from './json-del-modelo';
import { tzDeWorkspace } from './timezone';
import { TZ_TIJUANA, hoyEnTijuana } from './date-utils';
import { leerLlamada } from './api-mako/areas/closing.helpers';
import { fetchRecordingTranscript } from './fathom-api';
import { integracionConectada } from './credenciales';
import { getScriptView } from './ads-analyst';
import type { QueTablero } from './tablero-actual';

const TC = 'dashboard_ia_elementos';
const COLS = 'id, usuario, hoja_id, popup_de, elemento_id, ref, cron, tz, proxima_at, anterior_at, que_tablero, estado, fase, corrida_id, origen, started_at, finished_at, error, analizado_at, resultado, entrada, modelo, corridas';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const ahoraIso = () => new Date().toISOString();

async function wsActual(): Promise<number> {
  const ws = await getWorkspaceActual();
  if (ws == null) throw new Error('Sin negocio');
  return ws;
}

/** Dónde está una caja: la hoja, el pop-up ('' = suelta en la hoja), la caja y lo abierto ('' = lee gráficos). */
export type ClaveCaja = { hojaId: string; popupDe: string; elementoId: string; ref: string };

/** La fila de la caja de ESTA persona, o null. ⚠️ Una lectura que falla TIRA: no es «nunca se generó». */
async function filaDe(usuario: string, k: ClaveCaja): Promise<FilaCaja | null> {
  const ws = await wsActual();
  const { data, error } = await (await getTenantDb()).from(TC).select(COLS)
    .eq('workspace_id', ws).eq('usuario', usuario).eq('hoja_id', k.hojaId).eq('popup_de', k.popupDe).eq('elemento_id', k.elementoId).eq('ref', k.ref)
    .maybeSingle();
  if (error) throw new Error(`No pude leer las conclusiones: ${error.message}`);
  return (data as FilaCaja | null) ?? null;
}

/** Lo que dibuja la caja de quien la armó (el admin, con su informe). Leer no escribe nada. */
export async function vistaDeCaja(usuario: string, k: ClaveCaja): Promise<VistaCaja> {
  return vistaDeFilaCaja(await filaDe(usuario, k), Date.now());
}

/**
 * Lo que dibuja la caja del CLOSER: la última que escribió cualquiera del negocio para esa caja (su informe es
 * la plantilla, en memoria, sin fila propia). Un texto en curso de otro no se muestra como «corriendo»: se ve el
 * último bueno.
 */
export async function vistaDeCajaDeLaCuenta(k: ClaveCaja): Promise<VistaCaja> {
  const ws = await wsActual();
  const { data, error } = await (await getTenantDb()).from(TC).select(COLS)
    .eq('workspace_id', ws).eq('hoja_id', k.hojaId).eq('popup_de', k.popupDe).eq('elemento_id', k.elementoId).eq('ref', k.ref)
    .not('analizado_at', 'is', null).order('analizado_at', { ascending: false }).limit(1);
  if (error) throw new Error(`No pude leer las conclusiones: ${error.message}`);
  const f = ((data ?? []) as FilaCaja[])[0] ?? null;
  const v = vistaDeFilaCaja(f, Date.now());
  return { ...v, corriendo: null, programa: null };
}

async function asegurarFila(usuario: string, k: ClaveCaja): Promise<FilaCaja> {
  const ws = await wsActual();
  const { error } = await (await getTenantDb()).from(TC).upsert(
    { workspace_id: ws, usuario, hoja_id: k.hojaId, popup_de: k.popupDe, elemento_id: k.elementoId, ref: k.ref },
    { onConflict: 'workspace_id,usuario,hoja_id,popup_de,elemento_id,ref', ignoreDuplicates: true },
  );
  if (error) throw new Error(`No pude preparar las conclusiones: ${error.message}`);
  const f = await filaDe(usuario, k);
  if (!f) throw new Error('No pude preparar las conclusiones: la base no devolvió la fila.');
  return f;
}

/** Lo que hace falta para escribir una caja. Lo arman el disparo a mano y el cron. */
export type PedidoCaja = {
  ws: number;
  usuario: string;
  filaId: number;
  corridaId: string;
  corridasPrevias: number;
  hoja: Hoja;
  popupDe: string | null;
  elementoId: string;
  /** Lo que se abrió (en un pop-up); null = la caja lee gráficos. */
  contexto: ContextoEntidad | null;
  vista: VistaValores;
  hoy: string;
  origen: Origen;
  hastaMs: number;
  queTablero: QueTablero | null;
};

/** Lo que se le explica a quien pidió algo que no se puede (un 400 con el motivo, no un 500). */
export class CajaInvalida extends Error {
  constructor(m: string) { super(m); this.name = 'CajaInvalida'; }
}

/**
 * Dónde está la caja y qué lee, con lo que manda el navegador VERIFICADO: la caja tiene que estar en esa hoja (o
 * en el pop-up de ese gráfico), y adentro de un pop-up el contexto se rearma con el gráfico dueño.
 */
export function resolverCaja(hoja: Hoja, elementoId: string, popupDe: string | null, ref: string | null) {
  const caja = buscarCaja(hoja, elementoId, popupDe);
  if (!caja) throw new CajaInvalida('Esa caja ya no está en la hoja.');
  let contexto: ContextoEntidad | null = null;
  if (caja.dueno) {
    contexto = contextoDeClic({ fuente: caja.dueno.fuente, dimension: caja.dueno.dimension, ref });
    if (!contexto) throw new CajaInvalida('Esta caja no sabe qué se abrió.');
    if (contexto.tipo === 'lead') throw new CajaInvalida('Todavía no leo la ficha de un lead.');
  }
  const clave: ClaveCaja = { hojaId: hoja.id, popupDe: popupDe ?? '', elementoId, ref: contexto?.ref ?? '' };
  return { caja, contexto, clave };
}

/**
 * El disparo a mano (el «Generar» del panel y el ↻ de la caja): prepara la fila, toma la corrida y devuelve el
 * pedido para correrlo por detrás. `null` en `pedido` = ya hay una corriendo (se devuelve su estado).
 */
export async function arrancarCaja(p: { usuario: string; hoja: Hoja; elementoId: string; popupDe: string | null; ref: string | null; vista: VistaValores; queTablero: QueTablero; hastaMs: number }):
  Promise<{ ok: true; pedido: PedidoCaja; clave: ClaveCaja } | { ok: false; vista: VistaCaja }> {
  const ws = await wsActual();
  const { contexto, clave } = resolverCaja(p.hoja, p.elementoId, p.popupDe, p.ref);
  const f = await asegurarFila(p.usuario, clave);
  const token = await tomarCorrida(TC, f, 'manual');
  if (!token) return { ok: false, vista: vistaDeFilaCaja(await filaDe(p.usuario, clave), Date.now()) };
  return {
    ok: true, clave,
    pedido: {
      ws, usuario: p.usuario, filaId: f.id, corridaId: token, corridasPrevias: f.corridas ?? 0, hoja: p.hoja,
      popupDe: p.popupDe, elementoId: p.elementoId, contexto, vista: p.vista, hoy: hoyEnTijuana(), origen: 'manual',
      hastaMs: p.hastaMs, queTablero: p.queTablero,
    },
  };
}

/**
 * Pone (o saca) el horario de una caja SUELTA EN LA HOJA, con el «Cuándo» que ya trae su configuración. Una caja
 * de pop-up no se programa: lee lo que alguien abrió, y un horario no sabe qué abrir.
 * ⚠️ La zona se resuelve acá y se CONGELA en la fila (el mismo porqué que el AI Analyst).
 */
export async function programarCaja(p: { usuario: string; hoja: Hoja; elementoId: string; queTablero: QueTablero }): Promise<VistaCaja> {
  const ws = await wsActual();
  const caja = buscarCaja(p.hoja, p.elementoId, null);
  if (!caja) throw new CajaInvalida('Esa caja ya no está en la hoja.');
  const cron = cronDeCaja(caja.e.ia!.cron);
  const clave: ClaveCaja = { hojaId: p.hoja.id, popupDe: '', elementoId: p.elementoId, ref: '' };
  const f = await asegurarFila(p.usuario, clave);
  const ahora = new Date();
  let cambios: Record<string, unknown>;
  if (cron) {
    const tz = await tzDeWorkspace(ws).catch(() => TZ_TIJUANA);
    cambios = { cron, tz, proxima_at: primeraCorrida(cron, tz, ahora).toISOString(), anterior_at: ahora.toISOString(), que_tablero: p.queTablero };
  } else cambios = { cron: null, proxima_at: null, anterior_at: null };
  const { data, error } = await (await getTenantDb()).from(TC).update({ ...cambios, updated_at: ahora.toISOString() })
    .eq('id', f.id).select(COLS).maybeSingle();
  if (error) throw new Error(`No pude guardar el horario: ${error.message}`);
  if (!data) throw new Error('No pude guardar el horario: la base no devolvió la fila.');
  return vistaDeFilaCaja(data as FilaCaja, Date.now());
}

// ── Lo que se abrió ──────────────────────────────────────────────────────────────────────────

/** «HH:MM:SS» o «MM:SS» de Fathom a segundos (lo mismo que hace GET /api/closing/transcript). */
function aSegundos(ts: string | null | undefined): number {
  if (!ts) return 0;
  const p = String(ts).split(':').map(Number);
  if (p.some((n) => Number.isNaN(n))) return 0;
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  if (p.length === 2) return p[0] * 60 + p[1];
  return p[0] || 0;
}

/**
 * Lo que la caja lee de lo que se abrió, con los lectores que ya existen: una llamada, su análisis guardado
 * (`leerLlamada`, por getTenantDb: una llamada de otro negocio no existe acá) y lo que se dijo (Fathom en vivo;
 * si falla, sigue con el análisis y lo dice); un anuncio, sus números del Ads Analyst (`getScriptView`).
 * Devuelve el motivo (un string) si no hay qué leer.
 */
async function leerEntidad(ctx: ContextoEntidad): Promise<EntradaEntidad | string> {
  if (ctx.tipo === 'llamada') {
    const id = Number(ctx.ref);
    const c = await leerLlamada(id);
    if (!c) return 'Esa llamada no está en esta cuenta.';
    let lineas: LineaParaIA[] | null = null;
    let errorTr: string | null = null;
    if (await integracionConectada('fathom').catch(() => false)) {
      try {
        lineas = (await fetchRecordingTranscript(id))
          .map((it) => ({ t_seconds: aSegundos(it.timestamp), speaker: it.speaker?.display_name ?? null, text: (it.text ?? '').trim() }))
          .filter((l) => l.text);
      } catch (e) { errorTr = msg(e); }
    } else errorTr = 'Fathom no está conectado';
    return entradaDeLlamada(c, lineas, errorTr);
  }
  if (ctx.tipo === 'anuncio') {
    const sv = await getScriptView(ctx.ref).catch(() => null);
    return sv ? entradaDeAnuncio(sv) : 'Ese anuncio no tiene análisis todavía.';
  }
  return 'Todavía no leo la ficha de un lead.';
}

// ── La corrida ───────────────────────────────────────────────────────────────────────────────

/**
 * LA CAJA. Lee lo que le toca (los gráficos de su lugar, o lo que se abrió), le pregunta a la IA gratis con el
 * pedido de la caja como DATO, sanea y corta al largo, y lo guarda — sólo si la corrida sigue siendo suya.
 */
export async function analizarCaja(p: PedidoCaja): Promise<{ ok: boolean; error?: string }> {
  return runWithWorkspace(p.ws, async () => {
    const fallar = async (error: string) => { await cerrarConError(TC, p.filaId, p.corridaId, error); return { ok: false, error }; };
    try {
      const caja = buscarCaja(p.hoja, p.elementoId, p.popupDe);
      if (!caja) return await fallar('Esa caja ya no está en la hoja.');
      const c = caja.e.ia!;
      const titulo = (caja.e.texto || 'Conclusiones').slice(0, 40);
      let user: string;
      let sanear: (raw: unknown) => ReturnType<typeof sanearSalidaCaja>;
      let entrada: unknown;
      if (p.contexto) {
        const ent = await leerEntidad(p.contexto);
        if (typeof ent === 'string') return await fallar(ent);
        entrada = ent;
        user = userDeCaja(c, { entidad: entidadParaModelo(ent) });
        sanear = (raw) => sanearSalidaEntidad(raw, ent, c);
      } else {
        const { leer, faltan } = graficosDeCaja(c, caja.graficos);
        if (!leer.length) return await fallar(faltan.length ? 'Los gráficos que lee ya no están en la hoja.' : 'Esta hoja no tiene gráficos para leer.');
        const items = await leerGraficosParaIA({ hoja: p.hoja, graficos: leer, vista: p.vista, hoy: p.hoy, origen: p.origen, queTablero: p.queTablero });
        const e = serializarHoja({
          hoja: p.hoja, hoy: p.hoy, origen: p.origen, conVista: Object.keys(p.vista).length > 0, items,
          noIncluidos: faltan.map(() => ({ titulo: 'Un gráfico que ya no está', motivo: 'Se borró de la hoja.' })),
        });
        if (!e.graficos.some((g) => !('error' in g))) return await fallar('No pude leer ninguno de los gráficos que lee.');
        entrada = e;
        user = userDeCaja(c, { datos: paraModelo(e) });
        sanear = (raw) => sanearSalidaCaja(raw, e, c);
      }

      await marcarFase(TC, p.filaId, p.corridaId, 'escribiendo');
      const r = await pedirIAGratis({
        system: await getPromptText(CLAVE_PROMPT_CAJA, ELEMENTO_IA_SYSTEM_TEMPLATE),
        user, maxTokens: LARGOS[c.largo].maxTokens,
        feature: FEATURE_CONCLUSIONES, motivo: `Conclusiones de MaKo · ${titulo}${p.origen === 'cron' ? ' · programado' : ''}`,
        hastaMs: p.hastaMs,
        // La marca `pii` del catálogo es de la feature entera: la afina lo que lee ESTA caja.
        pii: cajaLlevaDatosDeClientes(p.contexto ? p.contexto.tipo : 'graficos'),
        validar: (t) => !!sanear(parseJsonObject(t)),
      });
      if (!r.crudo.trim()) {
        return await fallar(r.rechazos.length
          ? `Lo que escribió MaKo ${r.rechazos[r.rechazos.length - 1]}. Prueba de nuevo.`
          : await errorDeCascada(r.errores, 'escribir las conclusiones'));
      }
      const salida = sanear(parseJsonObject(r.crudo));
      if (!salida) return await fallar('Lo que escribió MaKo no se apoyaba en los datos. Prueba de nuevo.');

      const ok = await cerrarCorrida(TC, p.filaId, p.corridaId, {
        estado: 'listo', error: null, analizado_at: ahoraIso(), resultado: salida, entrada, modelo: r.modelo, corridas: p.corridasPrevias + 1,
      });
      if (!ok) console.info(`[conclusiones] caja ${p.elementoId}: la corrida se cortó, el texto no se guarda`);
      return { ok };
    } catch (e) {
      console.error(`[conclusiones] caja ${p.elementoId}: ${msg(e)}`);
      return await fallar('No pude escribir las conclusiones. Prueba de nuevo.');
    }
  });
}

// ── El cron: la MISMA función que drena el AI Analyst ───────────────────────────────────────

/**
 * Las cajas programadas que vencieron en el negocio ACTUAL (`drenarTabla`, lib/graficos-analisis-server.ts: la
 * misma que el AI Analyst). Cada una se escribe con el informe GUARDADO de su dueño y los valores guardados de
 * los filtros. Si la caja se borró, o ya no tiene «Cuándo», se desprograma: si no, el cron la buscaría en cada
 * ocurrencia para siempre.
 */
export function drenarCajasVencidas(opts: { deadline: number }): Promise<CuentaCron> {
  return drenarTabla<FilaCaja>({
    tabla: TC, cols: COLS, deadline: opts.deadline,
    correr: async (f, token, ws) => {
      const desprogramar = async (motivo: string) => {
        await cerrarConError(TC, f.id, token, motivo);
        await (await getTenantDb()).from(TC).update({ cron: null, proxima_at: null, anterior_at: null, updated_at: ahoraIso() }).eq('id', f.id);
        return false;
      };
      let hoja: Hoja | null;
      try {
        hoja = (await leerInformeGuardado(f.usuario)).hojas.find((h) => h.id === f.hoja_id) ?? null;
      } catch (e) {
        console.error(`[conclusiones:cron] ${f.id}: ${msg(e)}`);
        await cerrarConError(TC, f.id, token, 'No pude leer tu informe guardado.');
        return false;
      }
      if (!hoja) return desprogramar('La hoja ya no existe: se sacó el horario.');
      const e = hoja.componentes.find((c) => esElemento(c) && c.id === f.elemento_id);
      if (f.popup_de || f.ref || !e || !esElemento(e) || e.tipo !== 'ia' || !e.ia?.cron) return desprogramar('La caja ya no tiene horario: se sacó.');
      const r = await analizarCaja({
        ws, usuario: f.usuario, filaId: f.id, corridaId: token, corridasPrevias: f.corridas ?? 0, hoja, popupDe: null,
        elementoId: f.elemento_id, contexto: null, vista: {}, hoy: hoyEnTijuana(), origen: 'cron',
        hastaMs: Math.min(opts.deadline, Date.now() + TECHO_MS),
        queTablero: f.que_tablero === 'dueno' || f.que_tablero === 'cliente' ? f.que_tablero : null,
      });
      return r.ok;
    },
  });
}
