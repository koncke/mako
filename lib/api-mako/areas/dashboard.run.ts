// =============================================================================
// api-mako/areas/dashboard.run — los cuerpos del Dashboard por la API (ver dashboard.def.ts)
// =============================================================================
// Un runner por id de dashboard.def.ts, en `RUNNERS`. ⚠️ NADA MÁS EN ESTE ARCHIVO PUEDE QUEDAR A DOS
// ESPACIOS CON LA FORMA `nombre: {`: tests/api-mako-registro.test.ts lee los ids de los runners con esa
// regex, y una clave suelta a esa altura se contaría como un runner sin def.
//
// Lo que este archivo agrega sobre las libs, y por qué:
//   · NO HAY COOKIE. `leerTablero()` / `guardarTablero()` leen la sesión: en un runner devolvían el
//     inicial sin avisar. Acá se lee y se escribe el informe de la persona elegida (`sub`) con las de
//     versión de lib/graficos-tablero.ts.
//   · LAS LECTURAS SON LAS DE LA PANTALLA: `pedidosDeHoja` (app/dashboard/exportar.ts) con la vista vacía,
//     `datosDeGraficos`, `datosDeBloques`, `detalleDeGrafico`, `csvDeHoja`. Si esto armara las suyas,
//     WhatsApp y la pantalla contarían distinto.
//   · ESCRIBIR ES COMPARE-AND-SET: `preparar()` fija la persona y la versión que leyó, y `ejecutar()` relee,
//     compara y escribe con `guardarTableroSi` (que no escribe si alguien guardó en el medio).
//   · EL AI ANALYST CORRE POR DETRÁS (`after()`): /api/v1 corta a los 60 s y un análisis con la cascada
//     gratis y la red de plataforma pasa de eso. Se le da un plazo que entra en la función que confirma.
//
// Los errores de infraestructura (la base caída) se tiran con el prefijo `api-mako:`, que el choke
// point (lib/api-mako/ejecutar.ts) contesta como 500 con un texto genérico: el detalle va al log, nunca
// a un tercero.
// =============================================================================

import 'server-only';
import { after } from 'next/server';
import type { Ctx, Ejecutado, Preparado, Runners, SalidaLectura } from '../tipos';
import { linkPantalla } from '../link';
import { PREFIJO_FLUJO } from '../canal';
import { getSupabaseServer } from '@/lib/supabase';
import { runWithWorkspace } from '@/lib/workspace';
import { hoyEnTijuana } from '@/lib/date-utils';
import { rateLimit } from '@/lib/rate-limit';
import {
  BLOQUES, bloqueDe, campoDe, camposDeFuente, efectivoDe, esBloque, esElemento, esGrafico, fuenteDe, hojaVacia, metricaDe, sanearTablero,
  tituloDe,
  type Componente, type Grafico, type Hoja,
} from '@/lib/graficos-catalogo';
import { PLANTILLAS_TEMA } from '@/lib/graficos-temas';
import { PLANTILLAS_HOJA, instanciarPlantilla, plantillaHojaDe, tableroInicial } from '@/lib/graficos-plantillas';
import { cortarEnHoyDe, datosDeGraficos, hastaDeFuente, valoresDeCampo, type PedidoDatos } from '@/lib/graficos-datos';
import { datosDeBloques } from '@/lib/graficos-bloques';
import { detalleDeGrafico } from '@/lib/graficos-detalle';
import { guardarTableroSi, leerTableroVersionado, listarTablerosGuardados, type TableroVersionado } from '@/lib/graficos-tablero';
import { analizarHoja, arrancarAMano, cancelarCorrida, programar, vistaDe, NoProgramable } from '@/lib/graficos-analisis-server';
import { queTableroLeer } from '@/lib/graficos-lectura';
import { generarHojaIA } from '@/lib/graficos-ia-generar';
import { TOPE_PEDIDO_IA } from '@/lib/graficos-ia';
import { Alias, sanearCronAnalisis, type SalidaAnalisis } from '@/lib/graficos-analisis';
import { textoCron } from '@/lib/cron-aviso';
import { csvDeHoja, nombreArchivo, pedidosDeHoja, periodoDeHoja, seccionCsv } from '@/app/dashboard/exportar';
import type { Resultado } from '@/lib/graficos-agregar';
import {
  acotarAHoy, aplicarCambio, armarBloque, armarControlHoja, armarElemento, armarGrafico, analisisMarkdown, buscarComponente,
  buscarHoja, catalogoJson, catalogoMarkdown, controlParaHttp, controlesDeFiltros, copiaDeHoja, datosAMarkdown,
  detalleMarkdown, elegirPersona, etiquetaPersona, filtroEnPalabras, filtrosDeConsulta, hojaMarkdown, informesMarkdown, urlParaCanal,
  juntarTotales, nombreDeComponente, periodoPedido, recortar, resolverCampo, resultadoMarkdown, resultadoPara,
  salidaConNombres, textoDeAnalisis,
  type Cambio, type EntradaFiltro, type EntradaGrafico, type Eleccion, type InformeListado, type LeidoDeComponente,
  type MiembroCuenta, type PersonaInforme, type SeccionCatalogo,
} from './dashboard.helpers';

type In = Record<string, unknown>;

// ── utilidades ───────────────────────────────────────────────────────────────────────────────

const J = (o: unknown): string => JSON.stringify(o);
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const str = (input: In, k: string): string => (typeof input[k] === 'string' ? (input[k] as string).trim() : '');
/** `undefined` = no vino; «-» = se pidió SIN (el validador descarta el vacío, así que el guion lo dice). */
const opc = (input: In, k: string): string | undefined => (typeof input[k] === 'string' ? ((input[k] as string).trim() === '-' ? '' : (input[k] as string).trim()) : undefined);
const num = (input: In, k: string): number | undefined => (typeof input[k] === 'number' && Number.isFinite(input[k]) ? (input[k] as number) : undefined);
const textos = (input: In, k: string): string[] | undefined => (Array.isArray(input[k]) ? (input[k] as unknown[]).map((x) => String(x).trim()).filter(Boolean) : undefined);
const comillas = (s: string) => `«${s}»`;

/** Un error del que pide (un id que no existe), legible y con lo que sí vale: sale 400. */
const fallo = (error: string, disponibles?: unknown): SalidaLectura => ({
  content: disponibles !== undefined ? `${error} Disponibles: ${Array.isArray(disponibles) ? disponibles.join(', ') : J(disponibles)}` : error,
  isError: true,
});

/** Lo que falla de NUESTRO lado (la base caída): 500 con texto genérico (ejecutar.ts, `esNuestro`). */
async function infra<T>(que: string, fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch (e) { throw new Error(`api-mako: dashboard ${que}: ${msg(e)}`); }
}

const enFlujo = (ctx: Ctx): boolean => ctx.canalKey.startsWith(PREFIJO_FLUJO);
const formatoDe = (input: In, ctx: Ctx, def: string): string => (str(input, 'formato') || ctx.formato || def).toLowerCase();
const linkHoja = (hojaId: string | null, ctx: Ctx): string => linkPantalla(hojaId ? `/dashboard?hoja=${encodeURIComponent(hojaId)}` : '/dashboard', ctx.ws);

/** Lo que entra en una respuesta de chat: el techo de entrada de Groq son ~7 k tokens. */
const TOPE_MD_CHAT = 14_000;
const TOPE_FILAS_CHAT = 25;
/** Lo que tiene la IA de «Pídeselo a MaKo» por HTTP: /api/v1 corta a los 60 s. */
const PLAZO_IA_HTTP_MS = 40_000;
/** El plazo de un análisis por detrás: el de la función que confirma (60 s por HTTP, 300 el resto). */
const PLAZO_ANALISIS_HTTP_MS = 45_000;
const PLAZO_ANALISIS_MS = 240_000;
const TEXTO_CAMBIO = 'Tu informe del Dashboard cambió desde que se propuso esto (alguien lo editó en la pantalla): vuelve a pedirlo.';

// ── La persona y su informe ──────────────────────────────────────────────────────────────────

type Resuelto = { eleccion: Extract<Eleccion, { ok: true }>; sub: string | null; lectura: TableroVersionado; etiqueta: string; http: boolean };
type Fallo = { error: string; disponibles?: unknown; yaEstaba?: boolean; faltan?: string[] };

type FilaUsuario = { id: number | string; email: string | null; nombre: string | null; rol?: string | null; rol_ws?: string | null; estado?: string | null };

/**
 * Las personas con un informe guardado en la cuenta y las personas de la cuenta. Un `sub` que no es un
 * número (una sesión 'dev', 'password' o 'legacy') no es una persona: no se cuenta.
 */
async function personasDeLaCuenta(ws: number): Promise<{ informes: PersonaInforme[]; miembros: MiembroCuenta[] }> {
  return infra('personas', async () => {
    const { informes: crudos } = await listarTablerosGuardados();
    const ids = crudos.map((i) => i.sub).filter((s) => /^\d+$/.test(s)).map(Number);
    const db = getSupabaseServer();
    const m = await db.from('usuarios').select('id, email, nombre, rol, rol_ws, estado').eq('workspace_id', ws).neq('estado', 'suspendido').limit(500);
    if (m.error) throw new Error(m.error.message);
    let conInforme: FilaUsuario[] = [];
    if (ids.length) {
      const u = await db.from('usuarios').select('id, email, nombre, estado').in('id', ids);
      if (u.error) throw new Error(u.error.message);
      conInforme = (u.data ?? []) as FilaUsuario[];
    }
    const persona = (x: FilaUsuario): PersonaInforme => ({ sub: String(x.id), email: (x.email ?? '').toLowerCase(), nombre: x.nombre ?? '' });
    return {
      informes: conInforme.filter((x) => x.estado !== 'suspendido' && x.email).map(persona),
      miembros: ((m.data ?? []) as FilaUsuario[]).filter((x) => x.email).map((x) => ({
        ...persona(x),
        rol: x.rol === 'admin' ? 'admin' : x.rol_ws === 'closer' || x.rol_ws === 'setter' ? x.rol_ws : 'admin',
      })),
    };
  });
}

/**
 * De quién es el informe, y el informe con su versión. `leer`: sin nadie, el inicial; `persona`: hace
 * falta una persona (escribir, y el AI Analyst, que guarda por persona). Por HTTP no se listan los emails
 * del equipo en `disponibles`.
 */
async function resolver(input: In, ctx: Ctx, modo: 'leer' | 'persona'): Promise<Resuelto | Fallo> {
  const http = ctx.canal === 'http';
  const { informes, miembros } = await personasDeLaCuenta(ctx.ws);
  const e = elegirPersona({ informes, miembros, pedido: str(input, 'persona'), sinPersonaVaElInicial: modo === 'leer', enFlujo: enFlujo(ctx) });
  if (!e.ok) return { error: e.error, ...(http || !e.disponibles.length ? {} : { disponibles: e.disponibles }) };
  const lectura: TableroVersionado = e.persona
    ? await infra('leer el informe', () => leerTableroVersionado(e.persona!.sub))
    : { estado: 'inicial', tablero: tableroInicial(), version: null, actualizado: null };
  return { eleccion: e, sub: e.persona?.sub ?? null, lectura, etiqueta: etiquetaPersona(e, http), http };
}

const esFallo = (x: unknown): x is Fallo => !!x && typeof x === 'object' && 'error' in x;

// ── Un gráfico al vuelo (consultar y el detalle) ─────────────────────────────────────────────

/**
 * Lo que se pide al vuelo, como uno o varios gráficos del catálogo: sin dimensión, un cuadro de resultados
 * por métrica (la lectura se comparte: es UNA por conjunto y período); con dimensión, una tabla; con
 * desglose, columnas (el desglose reparte la primera métrica).
 */
function graficosAlVuelo(input: In): { graficos: Grafico[] } | Fallo {
  const metricas = textos(input, 'metricas') ?? [];
  const dimension = opc(input, 'dimension') || null;
  const desglose = opc(input, 'desglose') || null;
  if (!metricas.length) return { error: 'Faltan las métricas.', faltan: ['metricas'] };
  if (desglose && !dimension) return { error: 'El desglose va con una dimensión.' };
  if (desglose && metricas.length > 4) return { error: 'Con desglose van hasta 4 métricas (el desglose reparte la primera).' };
  const orden = str(input, 'orden');
  const base: EntradaGrafico = {
    conjunto: str(input, 'conjunto'), fecha: str(input, 'fecha') || undefined, comparar: input.comparar === true,
    limite: num(input, 'limite') ?? 20, ...(orden === 'asc' || orden === 'desc' ? { orden } : {}),
  };
  if (!dimension) {
    const graficos: Grafico[] = [];
    for (const [i, m] of metricas.entries()) {
      const a = armarGrafico({ ...base, tipo: 'numero', metricas: [m], dimension: null, desglose: null }, null);
      if (!a.ok) return { error: a.error, disponibles: a.disponibles };
      graficos.push({ ...a.grafico, id: `q${i}` });
    }
    return { graficos };
  }
  const a = armarGrafico({ ...base, tipo: desglose ? 'columnas' : 'tabla', metricas, dimension, desglose }, null);
  if (!a.ok) return { error: a.error, disponibles: a.disponibles };
  return { graficos: [{ ...a.grafico, id: 'q0' }] };
}

const tituloAlVuelo = (gs: readonly Grafico[]): string => {
  const f = fuenteDe(gs[0].fuente);
  if (gs.length === 1) return tituloDe(gs[0]);
  const nombres = gs.map((g) => (f && metricaDe(f, g.metricas[0])?.nombre) ?? g.metricas[0]);
  return nombres.join(', ');
};

// ── Escribir: proponer y aplicar ─────────────────────────────────────────────────────────────

type Plan = { cambio: Cambio; que: string; hecho: string; deshacer: string; datos?: Record<string, unknown>; aviso?: string };
type Armado = Plan | Fallo;

/** El texto de por qué algo no corre en una automatización (pedido del relevo de Automations, 11/10/2026). */
const noEnFlujo = (que: string) => `${que} no corre en una automatización: un flujo corre una vez por cada lead, y repetiría esto con cada uno. Hazlo desde el Dashboard o pídeselo a MaKo en el chat.`;

/** preparar(): la persona, su informe con la versión, el cambio armado y validado contra ESE informe. */
async function proponer(input: In, ctx: Ctx, armar: (r: Resuelto) => Armado | Promise<Armado>, opts: { noEnFlujo?: string } = {}): Promise<Preparado> {
  if (opts.noEnFlujo && enFlujo(ctx)) return { error: noEnFlujo(opts.noEnFlujo) };
  try {
    const r = await resolver(input, ctx, 'persona');
    if (esFallo(r)) return r;
    const plan = await armar(r);
    if (esFallo(plan)) return plan;
    const ap = aplicarCambio(r.lectura.tablero, plan.cambio);
    if (!ap.ok) return { error: ap.error, ...(ap.yaEstaba ? { yaEstaba: true } : {}) };
    return {
      payload: { sub: r.sub, version: r.lectura.version, cambio: plan.cambio, hecho: plan.hecho, deshacer: plan.deshacer, datos: plan.datos ?? {} },
      resumen: `${plan.que}, en ${r.etiqueta}.${plan.aviso ? ` ${plan.aviso}` : ''}`,
    };
  } catch (e) {
    console.error(`[api-mako dashboard] preparar: ${msg(e)}`);
    return { error: 'No pude leer el informe del Dashboard. Reintenta en un momento.' };
  }
}

/** ejecutar(): relee, compara la versión, aplica el MISMO cambio y guarda con compare-and-set. */
async function aplicar(payload: In, ctx: Ctx): Promise<Ejecutado> {
  try {
    const sub = typeof payload.sub === 'string' ? payload.sub : '';
    if (!/^\d+$/.test(sub)) return { ok: false, resumen: 'La propuesta no dice de quién es el informe: vuelve a pedirla.' };
    const version = typeof payload.version === 'string' ? payload.version : null;
    const cambio = payload.cambio as Cambio;
    const actual = await leerTableroVersionado(sub);
    if (actual.version !== version) return { ok: false, resumen: TEXTO_CAMBIO };
    const ap = aplicarCambio(actual.tablero, cambio);
    if (!ap.ok) return { ok: false, resumen: ap.error };
    const g = await guardarTableroSi(sub, ap.tablero, version);
    if (!g.ok) return { ok: false, resumen: TEXTO_CAMBIO };
    const datos = (payload.datos && typeof payload.datos === 'object' ? payload.datos : {}) as Record<string, unknown>;
    const hojaId = typeof datos.hojaId === 'string' ? datos.hojaId : 'hojaId' in cambio && typeof cambio.hojaId === 'string' ? cambio.hojaId : null;
    const sigue = hojaId != null && g.tablero.hojas.some((h) => h.id === hojaId);
    return { ok: true, resumen: `${String(payload.hecho ?? 'Listo')}. ${String(payload.deshacer ?? '')}`.trim(), datos: { ...datos, link: linkHoja(sigue ? hojaId : null, ctx) } };
  } catch (e) {
    console.error(`[api-mako dashboard] ejecutar: ${msg(e)}`);
    return { ok: false, resumen: 'No se pudo guardar el informe del Dashboard: falló la escritura. Reintenta en un momento.' };
  }
}

/** La hoja pedida en el informe resuelto, o el error con las disponibles. */
function laHoja(r: Resuelto, input: In): Hoja | Fallo {
  const hb = buscarHoja(r.lectura.tablero, str(input, 'hoja'));
  return hb.ok ? hb.valor : { error: hb.error, disponibles: hb.disponibles };
}

/** Cómo se vuelve a armar un componente que se saca (por la API no hay deshacer). */
function comoVolver(c: Componente): string {
  if (esGrafico(c)) {
    return `Para volverlo: agregar_grafico_dashboard con tipo ${c.tipo}, conjunto ${c.fuente}, metricas [${c.metricas.join(', ')}]${c.dimension ? `, dimension ${c.dimension}` : ''}${c.desglose ? `, desglose ${c.desglose}` : ''}${c.titulo ? `, titulo ${comillas(c.titulo)}` : ''}.`;
  }
  if (esBloque(c)) return `Para volverlo: agregar_grafico_dashboard con bloque ${c.bloque}.`;
  const url = (c as { url?: string }).url;
  return `Para volverlo: insertar_elemento_dashboard con tipo ${c.tipo}${c.texto ? `, texto ${comillas(c.texto.slice(0, 80))}` : ''}${url ? `, url ${url}` : ''}.`;
}

// ── El AI Analyst: lo que corre por detrás ───────────────────────────────────────────────────

/**
 * Corre el análisis DESPUÉS de contestar, re-entrando al workspace (after() corre fuera del
 * AsyncLocalStorage; `analizarHoja` igual lo fija con `runWithWorkspace`). Fuera de un request (un
 * script), after() tira: ahí se corre en línea.
 */
async function porDetras(ws: number, trabajo: () => Promise<unknown>): Promise<'fondo' | 'en_linea'> {
  const envuelto = () => runWithWorkspace(ws, async () => {
    try { await trabajo(); } catch (e) { console.error(`[api-mako dashboard] análisis por detrás: ${msg(e)}`); }
  });
  try { after(envuelto); return 'fondo'; } catch { await envuelto(); return 'en_linea'; }
}

// ── Los runners ──────────────────────────────────────────────────────────────────────────────

export const RUNNERS: Runners = {
  ver_catalogo_dashboard: {
    leer: async (input, ctx) => {
      const seccion = (str(input, 'seccion') || undefined) as SeccionCatalogo | undefined;
      const conjunto = str(input, 'conjunto') || undefined;
      if (formatoDe(input, ctx, 'md') === 'json') {
        const j = catalogoJson({ conjunto, seccion });
        return 'error' in j && typeof j.error === 'string' ? fallo(j.error, j.disponibles) : { content: J(j), formato: 'json' };
      }
      const md = catalogoMarkdown({ conjunto, seccion, compacto: ctx.canal !== 'http' });
      return typeof md === 'string' ? md : fallo(md.error, md.disponibles);
    },
  },

  consultar_datos_dashboard: {
    leer: async (input, ctx) => {
      const http = ctx.canal === 'http';
      const hoy = hoyEnTijuana();
      const al = graficosAlVuelo(input);
      if (esFallo(al)) return fallo(al.error, al.disponibles);
      const principal = al.graficos[0];
      const fuente = fuenteDe(principal.fuente)!;
      const per = periodoPedido(input, hoy);
      if ('error' in per) return fallo(per.error, per.disponibles);
      const fl = filtrosDeConsulta(fuente, input.filtros as EntradaFiltro[] | undefined, http);
      if (!fl.ok) return fallo(fl.error, fl.disponibles);
      const pedidos: PedidoDatos[] = al.graficos.map((g) => ({ grafico: g, desde: per.desde, hasta: per.hasta, filtros: fl.filtros, agrupar: null }));
      const datos = await infra('consultar', () => datosDeGraficos(pedidos));
      const rs: Resultado[] = [];
      for (const g of al.graficos) {
        const d = datos[g.id];
        if (!d) return fallo('No pude leer esos datos.');
        if (!d.ok) return fallo(`No pude leer esos datos: ${d.error}.`);
        rs.push(d.resultado);
      }
      const alias = new Alias();
      const r = resultadoPara(principal, al.graficos.length > 1 ? juntarTotales(rs) : rs[0], http, alias);
      const hastaDatos = hastaDeFuente(principal, per.desde, per.hasta);
      const filtros = fl.filtros.map((f) => filtroEnPalabras(fuente.id, f, http, alias));
      const formato = formatoDe(input, ctx, 'md');
      if (formato === 'json') {
        return {
          content: J({
            conjunto: fuente.id, tipo: principal.tipo, dimension: principal.dimension, desglose: principal.desglose, fecha: principal.fecha,
            periodo: { desde: per.desde, hasta: per.hasta, datos_hasta: hastaDatos }, filtros, resultado: r,
          }),
          formato: 'json',
        };
      }
      if (formato === 'csv') {
        const BOM = String.fromCharCode(0xfeff);
        const lineas = seccionCsv({ ...principal, titulo: tituloAlVuelo(al.graficos) }, r, { desde: per.desde, hasta: per.hasta, agrupar: null });
        return {
          content: `${BOM}${lineas.join('\r\n')}\r\n`, formato: 'csv',
          headers: { 'Content-Disposition': `attachment; filename="${nombreArchivo(fuente.id, hoy, 'csv')}"` },
        };
      }
      const md = [
        ...resultadoMarkdown(principal, r, { desde: per.desde, hasta: per.hasta, topeFilas: http ? undefined : TOPE_FILAS_CHAT, titulo: tituloAlVuelo(al.graficos) }),
        ...(filtros.length ? [`Filtros: ${filtros.join(' · ')}`] : []),
        ...(hastaDatos !== per.hasta ? [`La pauta de Meta llega con un día de atraso: los datos van hasta ${hastaDatos}.`] : []),
      ].join('\n');
      return http ? md : recortar(md, TOPE_MD_CHAT, 'pide un período más corto o menos métricas');
    },
  },

  leer_bloque_dashboard: {
    leer: async (input, ctx) => {
      const info = bloqueDe(str(input, 'bloque'));
      if (!info) return fallo(`El bloque ${comillas(str(input, 'bloque'))} no existe.`, BLOQUES.map((b) => b.id));
      // Un bloque decide su propia ventana (el Outstanding mira hasta fin de mes): va sin acotar, como /api/graficos.
      const rg = periodoPedido(input, hoyEnTijuana(), 'ult30', false);
      if ('error' in rg) return fallo(rg.error, rg.disponibles);
      const datos = await infra('bloque', () => datosDeBloques([{ id: 'b', bloque: info.id, desde: rg.desde, hasta: rg.hasta }]));
      const d = datos.b;
      if (!d || !d.ok) return fallo(`No pude leer el bloque ${comillas(info.nombre)}${d && !d.ok ? `: ${d.error}` : ''}.`);
      if (formatoDe(input, ctx, 'md') === 'json') return { content: J({ bloque: info.id, nombre: info.nombre, periodo: { desde: rg.desde, hasta: rg.hasta }, datos: d.datos }), formato: 'json' };
      const md = [`**${info.nombre}** (\`${info.id}\`) · ${rg.desde} a ${rg.hasta}`, info.linea, '', ...datosAMarkdown(d.datos)].join('\n');
      return recortar(md, TOPE_MD_CHAT, 'pide un período más corto');
    },
  },

  listar_informes_dashboard: {
    leer: async (input, ctx) => {
      const { informes: crudos, recortado } = await infra('informes', () => listarTablerosGuardados({ conContenido: true }));
      const ids = crudos.map((i) => i.sub).filter((s) => /^\d+$/.test(s)).map(Number);
      const usuarios = new Map<string, FilaUsuario>();
      if (ids.length) {
        const u = await infra('informes', async () => {
          const r = await getSupabaseServer().from('usuarios').select('id, email, nombre, estado').in('id', ids);
          if (r.error) throw new Error(r.error.message);
          return (r.data ?? []) as FilaUsuario[];
        });
        for (const x of u) if (x.email && x.estado !== 'suspendido') usuarios.set(String(x.id), x);
      }
      const listados: InformeListado[] = [];
      for (const c of crudos) {
        const u = usuarios.get(c.sub);
        if (!u) continue;
        let hojas: Array<{ id: string; nombre: string }> = [];
        try { hojas = (sanearTablero(JSON.parse(c.raw ?? 'null'))?.hojas ?? []).map((h) => ({ id: h.id, nombre: h.nombre })); } catch { hojas = []; }
        listados.push({ persona: { sub: c.sub, email: (u.email ?? '').toLowerCase(), nombre: u.nombre ?? '' }, actualizado: c.actualizado, hojas });
      }
      const sinPersona = crudos.length - listados.length;
      if (formatoDe(input, ctx, 'md') === 'json') {
        return {
          content: J({
            informes: listados.map((l) => ({ email: l.persona.email, nombre: l.persona.nombre, actualizado: l.actualizado, hojas: l.hojas })),
            ...(listados.length ? {} : { inicial: tableroInicial().hojas.map((h) => ({ id: h.id, nombre: h.nombre })) }),
            sin_persona: sinPersona, recortado,
          }),
          formato: 'json',
        };
      }
      return informesMarkdown({ informes: listados, sinPersona, recortado });
    },
  },

  leer_hoja_dashboard: {
    leer: async (input, ctx) => {
      const r = await resolver(input, ctx, 'leer');
      if (esFallo(r)) return fallo(r.error, r.disponibles);
      const hoja = laHoja(r, input);
      if (esFallo(hoja)) return fallo(hoja.error, hoja.disponibles);
      const http = r.http;
      const hoy = hoyEnTijuana();
      const { graficos, bloques } = pedidosDeHoja(hoja, {}, hoy, 0);
      const [datos, datosB] = await infra('leer la hoja', () => Promise.all([
        datosDeGraficos(graficos.map(({ pedido }) => pedido)),
        // Los bloques traen nombres de clientes y del equipo: por HTTP no se leen.
        http || !bloques.length ? Promise.resolve({} as Awaited<ReturnType<typeof datosDeBloques>>) : datosDeBloques(bloques.map((b) => b.pedido)),
      ]));
      const alias = new Alias();
      const resultados: Record<string, Resultado | undefined> = {};
      const efectivos: Record<string, { desde: string; hasta: string; agrupar: 'dia' | 'semana' | 'mes' | null }> = {};
      const leidos: LeidoDeComponente[] = [];
      for (const c of [...hoja.componentes].sort((a, b) => a.y - b.y || a.x - b.x)) {
        if (esGrafico(c)) {
          const pg = graficos.find((x) => x.g.id === c.id)!;
          const hasta = cortarEnHoyDe(c, pg.ef.desde, pg.ef.hasta);
          const d = datos[c.id];
          const res = d?.ok ? resultadoPara(c, d.resultado, http, alias) : null;
          if (res) { resultados[c.id] = res; efectivos[c.id] = { desde: pg.ef.desde, hasta, agrupar: pg.ef.agrupar }; }
          leidos.push({
            c, desde: pg.ef.desde, hasta, agrupar: pg.ef.agrupar,
            filtros: pg.ef.filtros.map((f) => filtroEnPalabras(c.fuente, f, http, alias)), noAplica: pg.ef.noAplica,
            resultado: res, error: d ? (d.ok ? null : d.error) : 'No pude leer los datos',
          });
        } else if (esBloque(c)) {
          const pb = bloques.find((x) => x.b.id === c.id)!;
          const d = datosB[c.id];
          leidos.push({ c, desde: pb.ef.desde, hasta: pb.ef.hasta, datos: d?.ok ? d.datos : null, error: http ? null : d ? (d.ok ? null : d.error) : 'No pude leer los datos', oculto: http });
        } else if (esElemento(c)) leidos.push({ c });
      }
      const controles = http ? hoja.controles.map((c) => controlParaHttp(c, alias)) : hoja.controles;
      const link = linkHoja(hoja.id, ctx);
      const formato = formatoDe(input, ctx, 'md');
      if (formato === 'csv') {
        const c = csvDeHoja({ hoja, resultados, efectivos, hoy });
        return { content: c.csv, formato: 'csv', headers: { 'Content-Disposition': `attachment; filename="${nombreArchivo(hoja.nombre, hoy, 'csv')}"`, 'X-Graficos': String(c.graficos) } };
      }
      if (formato === 'json') {
        return {
          content: J({
            informe: r.etiqueta, estado: r.lectura.estado,
            hoja: { id: hoja.id, nombre: hoja.nombre, emoji: hoja.emoji, subtitulo: hoja.subtitulo, estilo: hoja.tema, filtros: controles },
            componentes: leidos.map((l) => {
              if (!('desde' in l)) return { id: l.c.id, clase: 'elemento', tipo: l.c.tipo, texto: l.c.texto, url: urlParaCanal((l.c as { url?: string }).url, http), x: l.c.x, y: l.c.y, w: l.c.w, h: l.c.h };
              if ('resultado' in l) {
                const g = l.c;
                return {
                  id: g.id, clase: 'grafico', titulo: tituloDe(g), tipo: g.tipo, conjunto: g.fuente, fecha: g.fecha, metricas: g.metricas,
                  dimension: g.dimension, desglose: g.desglose, periodo_guardado: g.periodo, periodo: { desde: l.desde, hasta: l.hasta },
                  agrupado_por: l.agrupar, filtros: l.filtros, no_filtra: l.noAplica, filtros_propios: http ? g.controles.map((k) => controlParaHttp(k, alias)) : g.controles,
                  x: g.x, y: g.y, w: g.w, h: g.h,
                  ...(l.resultado ? { resultado: l.resultado } : { error: l.error ?? 'no se pudo leer' }),
                };
              }
              const b = l.c as Componente & { clase: 'bloque'; bloque: string };
              return { id: b.id, clase: 'bloque', titulo: tituloDe(b), bloque: b.bloque, periodo: { desde: l.desde, hasta: l.hasta }, x: b.x, y: b.y, w: b.w, h: b.h, ...(http ? { datos: 'no sale por la API' } : l.error ? { error: l.error } : { datos: l.datos }) };
            }),
            link,
          }),
          formato: 'json',
        };
      }
      const md = hojaMarkdown({
        hoja, quien: r.etiqueta, periodoHoja: periodoDeHoja({ ...hoja, controles }, {}, hoy), leidos, link,
        topeFilas: http ? Infinity : TOPE_FILAS_CHAT, controles, http,
      });
      return http ? md : recortar(md, TOPE_MD_CHAT, 'pide un gráfico con consultar_datos_dashboard o el formato csv');
    },
  },

  leer_analisis_dashboard: {
    leer: async (input, ctx) => {
      const r = await resolver(input, ctx, 'persona');
      if (esFallo(r)) return fallo(r.error, r.disponibles);
      const hoja = laHoja(r, input);
      if (esFallo(hoja)) return fallo(hoja.error, hoja.disponibles);
      const vista = await infra('leer el análisis', () => vistaDe(r.sub!, hoja.id));
      const link = linkHoja(hoja.id, ctx);
      // Los nombres reales sólo por WhatsApp y la app (es la pantalla del dueño); por HTTP quedan los alias.
      const salida: SalidaAnalisis | null = vista.ultimo
        ? (r.http ? vista.ultimo.salida : salidaConNombres(vista.ultimo.salida, vista.ultimo.entrada.nombres ?? {}))
        : null;
      if (formatoDe(input, ctx, 'md') === 'json') {
        return {
          content: J({
            informe: r.etiqueta, hoja: { id: hoja.id, nombre: hoja.nombre },
            corriendo: vista.corriendo, fallo: vista.fallo,
            ultimo: vista.ultimo && salida ? {
              analizado_at: vista.ultimo.analizadoAt, modelo: vista.ultimo.modelo, resumen: salida.resumen,
              hallazgos: salida.hallazgos.map((h) => ({ titulo: h.titulo, texto: h.texto, tono: h.tono, grafico: h.cita.grafico, columna: h.cita.columna, valor: h.cita.valor })),
              recomendaciones: salida.recomendaciones,
              texto: textoDeAnalisis(salida, hoja.nombre, link),
            } : null,
            programa: vista.programa ? { horario: textoCron(vista.programa.cron, vista.programa.tz), cron: vista.programa.cron, tz: vista.programa.tz, proxima_at: vista.programa.proximaAt } : null,
            graficos: vista.componentes,
            link,
          }),
          formato: 'json',
        };
      }
      return analisisMarkdown(vista, { hojaNombre: hoja.nombre, link, ahoraMs: Date.now(), salida });
    },
  },

  ver_detalle_numero_dashboard: {
    leer: async (input, ctx) => {
      const hoy = hoyEnTijuana();
      let g: Grafico;
      let pedido: { desde: string; hasta: string; filtros: unknown; agrupar: unknown };
      let titulo: string;
      if (str(input, 'componente')) {
        const r = await resolver(input, ctx, 'leer');
        if (esFallo(r)) return fallo(r.error, r.disponibles);
        const hoja = laHoja(r, input);
        if (esFallo(hoja)) return fallo(hoja.error, hoja.disponibles);
        const cb = buscarComponente(hoja, str(input, 'componente'));
        if (!cb.ok) return fallo(cb.error, cb.disponibles);
        if (!esGrafico(cb.valor)) return fallo(`${comillas(nombreDeComponente(cb.valor))} no es un gráfico: el detalle es de un número de un gráfico.`);
        g = cb.valor;
        const ef = efectivoDe(g, hoja, {}, hoy);
        pedido = { desde: ef.desde, hasta: ef.hasta, filtros: ef.filtros, agrupar: ef.agrupar };
        titulo = tituloDe(g);
      } else {
        if (!str(input, 'conjunto')) return fallo('Pasa el gráfico de una hoja (hoja y componente) o uno al vuelo (conjunto y metricas).');
        const al = graficosAlVuelo(input);
        if (esFallo(al)) return fallo(al.error, al.disponibles);
        const metrica = str(input, 'metrica');
        g = al.graficos.find((x) => x.metricas.includes(metrica)) ?? al.graficos[0];
        const per = periodoPedido(input, hoy);
        if ('error' in per) return fallo(per.error, per.disponibles);
        const fl = filtrosDeConsulta(fuenteDe(g.fuente)!, input.filtros as EntradaFiltro[] | undefined, false);
        if (!fl.ok) return fallo(fl.error, fl.disponibles);
        pedido = { desde: per.desde, hasta: per.hasta, filtros: fl.filtros, agrupar: null };
        titulo = tituloAlVuelo(al.graficos);
      }
      const metrica = str(input, 'metrica') || undefined;
      if (metrica && !g.metricas.includes(metrica)) return fallo(`${comillas(metrica)} no es una métrica de ese gráfico.`, g.metricas);
      const valor = str(input, 'valor');
      if (valor && !g.dimension) return fallo('Ese gráfico no tiene grupos: el detalle es del total. Saca «valor».');
      const sel = { dimension: valor ? g.dimension : null, valor: valor || null, ...(metrica ? { metrica } : {}) };
      const resp = await infra('detalle', () => detalleDeGrafico({ grafico: g, ...pedido, sel }));
      if (!resp.ok) return fallo(`No pude leer el detalle: ${resp.error}.`);
      if (formatoDe(input, ctx, 'md') === 'json') {
        return { content: J({ grafico: { titulo, conjunto: g.fuente, metricas: g.metricas, dimension: g.dimension }, grupo: valor || null, ...resp }), formato: 'json' };
      }
      return recortar(detalleMarkdown(resp, `${titulo}${valor ? ` · ${valor}` : ''}`), TOPE_MD_CHAT, 'filtra para ver menos filas');
    },
  },

  listar_valores_campo_dashboard: {
    leer: async (input, ctx) => {
      const pedido = str(input, 'campo');
      const conjunto = str(input, 'conjunto');
      const fuente = conjunto ? fuenteDe(conjunto) : undefined;
      if (conjunto && !fuente) return fallo(`El conjunto ${comillas(conjunto)} no existe.`);
      const candidatos = fuente ? camposDeFuente(fuente.id).map((c) => c.id) : undefined;
      const campo = resolverCampo(pedido, candidatos) ?? (fuente ? resolverCampo(`${fuente.id}.${pedido}`, candidatos) : null);
      if (!campo) return fallo(`El campo ${comillas(pedido)} no existe${fuente ? ` en ${comillas(fuente.id)}` : ''}.`, candidatos ?? 'ver_catalogo_dashboard con seccion campos');
      const per = periodoPedido(input, hoyEnTijuana());
      if ('error' in per) return fallo(per.error, per.disponibles);
      const valores = await infra('valores', () => valoresDeCampo(campo, per.desde, per.hasta, fuente ? [fuente.id] : undefined));
      const nota = valores.length ? null : 'No llegó ningún valor: puede que el período no tenga filas o que la lectura no haya podido. No quiere decir que el campo no exista ni que esté vacío.';
      if (formatoDe(input, ctx, 'json') === 'md') {
        return [`**${campoDe(campo)?.nombre ?? campo}** (\`${campo}\`) · ${per.desde} a ${per.hasta}`, ...(nota ? [nota] : valores.map((v) => `- ${v.valor} (${v.filas})`))].join('\n');
      }
      return { content: J({ campo: { id: campo, nombre: campoDe(campo)?.nombre ?? campo }, periodo: { desde: per.desde, hasta: per.hasta }, valores, ...(nota ? { nota } : {}) }), formato: 'json' };
    },
  },

  // ── Acciones ───────────────────────────────────────────────────────────────────────────────

  crear_hoja_dashboard: {
    preparar: (input, ctx) => proponer(input, ctx, async (r) => {
      const plantilla = str(input, 'plantilla');
      const pedido = str(input, 'pedido');
      const nombre = str(input, 'nombre').slice(0, 40);
      if (plantilla && pedido) return { error: 'Usa una plantilla o un pedido, no los dos.' };
      let hoja: Hoja;
      let como: string;
      let aviso: string | undefined;
      if (plantilla) {
        const p = plantillaHojaDe(plantilla);
        if (!p) return { error: `La plantilla ${comillas(plantilla)} no existe.`, disponibles: PLANTILLAS_HOJA.map((x) => x.id) };
        hoja = instanciarPlantilla(p);
        como = `desde la plantilla ${p.nombre}`;
      } else if (pedido) {
        // MaKo la arma ANTES de proponerla: lo que la persona confirma es la hoja que se va a guardar.
        const g = await generarHojaIA(pedido.slice(0, TOPE_PEDIDO_IA), Date.now(), ctx.canal === 'http' ? { plazoMs: PLAZO_IA_HTTP_MS } : {});
        if ('error' in g) return { error: g.error };
        hoja = g.hoja;
        como = 'que armó MaKo con tu pedido';
        if (g.avisos.length) aviso = `(${g.avisos.join(' · ')})`;
      } else {
        hoja = hojaVacia(nombre || `Página ${r.lectura.tablero.hojas.length + 1}`);
        como = 'en blanco';
      }
      if (nombre) hoja = { ...hoja, nombre };
      const piezas = hoja.componentes.filter((c) => !esElemento(c)).map((c) => tituloDe(c));
      return {
        cambio: { op: 'crear_hoja', hoja },
        que: `Crear la hoja ${comillas(hoja.nombre)} ${como}${piezas.length ? `, con ${piezas.length} ${piezas.length === 1 ? 'componente' : 'componentes'}: ${piezas.slice(0, 8).join(', ')}${piezas.length > 8 ? '…' : ''}` : ''}`,
        hecho: `Quedó la hoja ${comillas(hoja.nombre)} (id ${hoja.id})`,
        deshacer: `Para deshacerlo: borrar_hoja_dashboard con hoja ${hoja.id}.`,
        datos: { hojaId: hoja.id },
        aviso,
      };
    }, { noEnFlujo: 'Crear una hoja' }),
    ejecutar: aplicar,
  },

  editar_hoja_dashboard: {
    preparar: (input, ctx) => proponer(input, ctx, (r) => {
      const h = laHoja(r, input);
      if (esFallo(h)) return h;
      const cambio: Extract<Cambio, { op: 'editar_hoja' }> = { op: 'editar_hoja', hojaId: h.id };
      const que: string[] = [];
      const antes: string[] = [];
      const nombre = opc(input, 'nombre');
      if (nombre !== undefined) {
        if (!nombre) return { error: 'El nombre de una hoja no puede quedar vacío.' };
        cambio.nombre = nombre.slice(0, 40); que.push(`nombre ${comillas(cambio.nombre)}`); antes.push(`nombre ${comillas(h.nombre)}`);
      }
      const emoji = opc(input, 'emoji');
      if (emoji !== undefined) { cambio.emoji = emoji; que.push(emoji ? `emoji ${emoji}` : 'sin emoji'); antes.push(`emoji ${h.emoji || '-'}`); }
      const subtitulo = opc(input, 'subtitulo');
      if (subtitulo !== undefined) { cambio.subtitulo = subtitulo; que.push(subtitulo ? `subtítulo ${comillas(subtitulo)}` : 'sin subtítulo'); antes.push(`subtitulo ${h.subtitulo ? comillas(h.subtitulo) : '-'}`); }
      const tema = str(input, 'tema');
      if (tema) {
        if (!PLANTILLAS_TEMA.some((x) => x.id === tema)) return { error: `El estilo ${comillas(tema)} no existe.`, disponibles: PLANTILLAS_TEMA.map((x) => x.id) };
        cambio.tema = tema; que.push(`estilo ${tema}`); antes.push(`tema ${h.tema.plantilla}`);
      }
      const posicion = num(input, 'posicion');
      if (posicion !== undefined) {
        cambio.posicion = posicion; que.push(`lugar ${posicion}`);
        antes.push(`posicion ${r.lectura.tablero.hojas.findIndex((x) => x.id === h.id) + 1}`);
      }
      if (!que.length) return { error: 'Di qué cambiar de la hoja: nombre, emoji, subtítulo, estilo o posición.' };
      return {
        cambio,
        que: `Cambiar la hoja ${comillas(h.nombre)}: ${que.join(', ')}`,
        hecho: `Quedó la hoja ${comillas(cambio.nombre ?? h.nombre)} con ${que.join(', ')}`,
        deshacer: `Para volver: editar_hoja_dashboard con hoja ${h.id} y ${antes.join(', ')}.`,
        datos: { hojaId: h.id },
      };
    }),
    ejecutar: aplicar,
  },

  duplicar_hoja_dashboard: {
    preparar: (input, ctx) => proponer(input, ctx, (r) => {
      const h = laHoja(r, input);
      if (esFallo(h)) return h;
      const copia = copiaDeHoja(h);
      return {
        cambio: { op: 'duplicar_hoja', hojaId: h.id, copia },
        que: `Duplicar la hoja ${comillas(h.nombre)} (queda ${comillas(copia.nombre)}, al lado)`,
        hecho: `Quedó la copia ${comillas(copia.nombre)} (id ${copia.id})`,
        deshacer: `Para deshacerlo: borrar_hoja_dashboard con hoja ${copia.id}.`,
        datos: { hojaId: copia.id },
      };
    }),
    ejecutar: aplicar,
  },

  borrar_hoja_dashboard: {
    preparar: (input, ctx) => proponer(input, ctx, (r) => {
      const h = laHoja(r, input);
      if (esFallo(h)) return h;
      return {
        cambio: { op: 'borrar_hoja', hojaId: h.id },
        que: `Borrar la hoja ${comillas(h.nombre)} con sus ${h.componentes.length} componentes (por la API no se deshace)`,
        hecho: `Se borró la hoja ${comillas(h.nombre)}`,
        deshacer: 'Por la API no se deshace: se puede volver a armar desde una plantilla o en la pantalla.',
      };
    }, { noEnFlujo: 'Borrar una hoja' }),
    ejecutar: aplicar,
  },

  agregar_grafico_dashboard: {
    preparar: (input, ctx) => proponer(input, ctx, (r) => {
      const h = laHoja(r, input);
      if (esFallo(h)) return h;
      const lugar = str(input, 'lugar') === 'arriba' ? 'arriba' : 'abajo';
      let comp: Componente;
      let que: string;
      if (str(input, 'bloque')) {
        if (str(input, 'tipo') || str(input, 'conjunto')) return { error: 'Un bloque va solo: sin tipo ni conjunto.' };
        const b = armarBloque({ bloque: str(input, 'bloque'), titulo: str(input, 'titulo') || undefined, periodo: input.periodo, desde: input.desde, hasta: input.hasta }, { x: 0, y: 0 });
        if (!b.ok) return { error: b.error, disponibles: b.disponibles };
        comp = b.bloque;
        que = `Agregar el bloque ${comillas(tituloDe(b.bloque))}`;
      } else {
        if (!str(input, 'tipo') || !str(input, 'conjunto')) return { error: 'Un gráfico va con tipo, conjunto y métricas (o pide un bloque).', faltan: [!str(input, 'tipo') ? 'tipo' : 'conjunto'] };
        const a = armarGrafico({
          tipo: str(input, 'tipo'), conjunto: str(input, 'conjunto'), metricas: textos(input, 'metricas') ?? [],
          dimension: opc(input, 'dimension') ?? null, desglose: opc(input, 'desglose') ?? null,
          ...(str(input, 'fecha') ? { fecha: str(input, 'fecha') } : {}),
          ...(input.periodo !== undefined ? { periodo: str(input, 'periodo') } : {}),
          ...(input.desde !== undefined ? { desde: str(input, 'desde') } : {}),
          ...(input.hasta !== undefined ? { hasta: str(input, 'hasta') } : {}),
          titulo: str(input, 'titulo'), ...(input.comparar !== undefined ? { comparar: input.comparar === true } : {}),
        }, null);
        if (!a.ok) return { error: a.error, disponibles: a.disponibles };
        comp = a.grafico;
        const f = fuenteDe(a.grafico.fuente);
        que = `Agregar el gráfico ${comillas(tituloDe(a.grafico))} (${a.grafico.tipo} de ${f?.nombre ?? a.grafico.fuente})`;
      }
      return {
        cambio: { op: 'agregar_componente', hojaId: h.id, componente: comp, lugar },
        que: `${que} ${lugar === 'arriba' ? 'arriba' : 'abajo'} de todo en la hoja ${comillas(h.nombre)}`,
        hecho: `Quedó ${comillas(nombreDeComponente(comp))} en la hoja ${comillas(h.nombre)} (id ${comp.id})`,
        deshacer: `Para deshacerlo: quitar_componente_dashboard con hoja ${h.id} y componente ${comp.id}.`,
        datos: { hojaId: h.id, componenteId: comp.id },
      };
    }),
    ejecutar: aplicar,
  },

  editar_grafico_dashboard: {
    preparar: (input, ctx) => proponer(input, ctx, (r) => {
      const h = laHoja(r, input);
      if (esFallo(h)) return h;
      const cb = buscarComponente(h, str(input, 'componente'));
      if (!cb.ok) return { error: cb.error, disponibles: cb.disponibles };
      const actual = cb.valor;
      if (esElemento(actual)) return { error: `${comillas(nombreDeComponente(actual))} es un elemento: sácalo con quitar_componente_dashboard e inserta otro.` };
      const titulo = opc(input, 'titulo');
      const subtitulo = opc(input, 'subtitulo');
      if (esBloque(actual)) {
        const otros = ['tipo', 'conjunto', 'metricas', 'dimension', 'desglose', 'fecha', 'limite', 'comparar', 'filtros'].filter((k) => input[k] !== undefined);
        if (otros.length) return { error: `${comillas(tituloDe(actual))} es un bloque: de un bloque sólo se cambian el título, el subtítulo y el período.` };
        // Un período pedido reemplaza al guardado entero (un preset nuevo no arrastra las fechas a medida de antes).
        const pidePeriodo = input.periodo !== undefined || input.desde !== undefined || input.hasta !== undefined;
        const per = pidePeriodo
          ? { periodo: input.periodo, desde: input.desde, hasta: input.hasta }
          : { periodo: actual.periodo, desde: actual.desde ?? undefined, hasta: actual.hasta ?? undefined };
        const b = armarBloque({ bloque: actual.bloque, ...per }, { x: actual.x, y: actual.y });
        if (!b.ok) return { error: b.error, disponibles: b.disponibles };
        const nuevo = { ...actual, titulo: titulo ?? actual.titulo, subtitulo: subtitulo ?? actual.subtitulo, periodo: b.bloque.periodo, desde: b.bloque.desde, hasta: b.bloque.hasta };
        return {
          cambio: { op: 'reemplazar_componente', hojaId: h.id, componente: nuevo },
          que: `Cambiar el bloque ${comillas(tituloDe(actual))} de la hoja ${comillas(h.nombre)}`,
          hecho: `Quedó el bloque ${comillas(tituloDe(nuevo))}`,
          deshacer: `Para volver: editar_grafico_dashboard con componente ${actual.id}${actual.titulo ? `, titulo ${comillas(actual.titulo)}` : ''}, periodo ${actual.periodo}.`,
          datos: { hojaId: h.id, componenteId: actual.id },
        };
      }
      const g = actual as Grafico;
      const e: EntradaGrafico = {
        ...(input.tipo !== undefined ? { tipo: str(input, 'tipo') } : {}),
        ...(input.conjunto !== undefined ? { conjunto: str(input, 'conjunto') } : {}),
        ...(input.metricas !== undefined ? { metricas: textos(input, 'metricas') ?? [] } : {}),
        ...(opc(input, 'dimension') !== undefined ? { dimension: opc(input, 'dimension') || null } : {}),
        ...(opc(input, 'desglose') !== undefined ? { desglose: opc(input, 'desglose') || null } : {}),
        ...(input.fecha !== undefined ? { fecha: str(input, 'fecha') } : {}),
        ...(input.periodo !== undefined ? { periodo: str(input, 'periodo') } : {}),
        ...(input.desde !== undefined ? { desde: str(input, 'desde') } : {}),
        ...(input.hasta !== undefined ? { hasta: str(input, 'hasta') } : {}),
        ...(titulo !== undefined ? { titulo } : {}),
        ...(subtitulo !== undefined ? { subtitulo } : {}),
        ...(num(input, 'limite') !== undefined ? { limite: num(input, 'limite') } : {}),
        ...(input.comparar !== undefined ? { comparar: input.comparar === true } : {}),
      };
      const a = armarGrafico(e, g);
      if (!a.ok) return { error: a.error, disponibles: a.disponibles };
      let nuevo: Grafico = a.grafico;
      if (Array.isArray(input.filtros)) {
        const fuente = fuenteDe(nuevo.fuente)!;
        const cf = controlesDeFiltros(fuente, input.filtros as EntradaFiltro[]);
        if (!cf.ok) return { error: cf.error, disponibles: cf.disponibles };
        nuevo = { ...nuevo, controles: [...nuevo.controles.filter((k) => k.tipo === 'periodo' || k.tipo === 'agrupar'), ...cf.controles] };
      } else if (a.grafico.fuente !== g.fuente) {
        // Un filtro propio de un campo que el conjunto nuevo no tiene filtraría nada: se saca y se dice.
        const sirven = new Set(camposDeFuente(nuevo.fuente).map((c) => c.id));
        const quedan = nuevo.controles.filter((k) => (k.tipo !== 'lista' && k.tipo !== 'texto') || (k.campo && sirven.has(k.campo)));
        if (quedan.length !== nuevo.controles.length) a.notas.push('saqué los filtros propios que el conjunto nuevo no puede aplicar');
        nuevo = { ...nuevo, controles: quedan };
      }
      const cambios: string[] = [];
      const antes: string[] = [];
      const dif = (k: string, ahora: unknown, ant: unknown, txt: (v: unknown) => string) => {
        if (JSON.stringify(ahora) !== JSON.stringify(ant)) { cambios.push(`${k} ${txt(ahora)}`); antes.push(`${k} ${txt(ant)}`); }
      };
      const t = (v: unknown) => (v == null || v === '' ? '-' : Array.isArray(v) ? `[${v.join(', ')}]` : String(v));
      dif('tipo', nuevo.tipo, g.tipo, t); dif('conjunto', nuevo.fuente, g.fuente, t); dif('metricas', nuevo.metricas, g.metricas, t);
      dif('dimension', nuevo.dimension, g.dimension, t); dif('desglose', nuevo.desglose, g.desglose, t); dif('fecha', nuevo.fecha, g.fecha, t);
      dif('periodo', nuevo.periodo === 'personalizado' ? `${nuevo.desde}..${nuevo.hasta}` : nuevo.periodo, g.periodo === 'personalizado' ? `${g.desde}..${g.hasta}` : g.periodo, t);
      dif('titulo', nuevo.titulo, g.titulo, (v) => (v ? comillas(String(v)) : '-')); dif('subtitulo', nuevo.subtitulo, g.subtitulo, (v) => (v ? comillas(String(v)) : '-'));
      dif('limite', nuevo.limite, g.limite, t); dif('comparar', nuevo.comparar, g.comparar, t);
      if (JSON.stringify(nuevo.controles) !== JSON.stringify(g.controles)) cambios.push('sus filtros propios');
      return {
        cambio: { op: 'reemplazar_componente', hojaId: h.id, componente: nuevo },
        que: `Cambiar el gráfico ${comillas(tituloDe(g))} de la hoja ${comillas(h.nombre)}: ${cambios.join(', ') || 'nada'}${a.notas.length ? ` (${a.notas.join('; ')})` : ''}`,
        hecho: `Quedó el gráfico ${comillas(tituloDe(nuevo))}`,
        deshacer: antes.length ? `Para volver: editar_grafico_dashboard con componente ${g.id} y ${antes.join(', ')}.` : 'Para volver, edítalo de nuevo.',
        datos: { hojaId: h.id, componenteId: g.id },
      };
    }),
    ejecutar: aplicar,
  },

  quitar_componente_dashboard: {
    preparar: (input, ctx) => proponer(input, ctx, (r) => {
      const h = laHoja(r, input);
      if (esFallo(h)) return h;
      const cb = buscarComponente(h, str(input, 'componente'));
      if (!cb.ok) return { error: cb.error, disponibles: cb.disponibles };
      const c = cb.valor;
      return {
        cambio: { op: 'quitar_componente', hojaId: h.id, componenteId: c.id },
        que: `Sacar ${comillas(nombreDeComponente(c))} de la hoja ${comillas(h.nombre)}`,
        hecho: `Se sacó ${comillas(nombreDeComponente(c))}`,
        deshacer: comoVolver(c),
        datos: { hojaId: h.id, quitado: c },
      };
    }),
    ejecutar: aplicar,
  },

  agregar_filtro_dashboard: {
    preparar: (input, ctx) => proponer(input, ctx, (r) => {
      const h = laHoja(r, input);
      if (esFallo(h)) return h;
      const a = armarControlHoja(h, {
        tipo: str(input, 'tipo'), campo: str(input, 'campo') || undefined, valores: input.valores, texto: str(input, 'texto') || undefined,
        agrupar: str(input, 'agrupar') || undefined, periodo: input.periodo, desde: input.desde, hasta: input.hasta,
      });
      if (!a.ok) return { error: a.error, disponibles: a.disponibles, ...(a.yaEstaba ? { yaEstaba: true } : {}) };
      const c = a.control;
      const cual = c.tipo === 'periodo' ? 'de período' : c.tipo === 'agrupar' ? 'de agrupar' : `de ${campoDe(c.campo)?.nombre ?? c.campo}`;
      return {
        cambio: { op: 'agregar_filtro', hojaId: h.id, control: c },
        que: `Agregar un filtro ${cual} a la hoja ${comillas(h.nombre)}${c.valores?.length ? ` (de entrada: ${c.valores.join(', ')})` : ''}`,
        hecho: `Quedó el filtro ${cual} (id ${c.id})`,
        deshacer: `Para deshacerlo: quitar_filtro_dashboard con hoja ${h.id} y filtro ${c.id}.`,
        datos: { hojaId: h.id, filtroId: c.id },
      };
    }),
    ejecutar: aplicar,
  },

  quitar_filtro_dashboard: {
    preparar: (input, ctx) => proponer(input, ctx, (r) => {
      const h = laHoja(r, input);
      if (esFallo(h)) return h;
      const id = str(input, 'filtro');
      const tipo = str(input, 'tipo');
      if (tipo && !['periodo', 'lista', 'texto', 'agrupar'].includes(tipo)) return { error: `${comillas(tipo)} no es un tipo de filtro.`, disponibles: ['periodo', 'lista', 'texto', 'agrupar'] };
      const campo = str(input, 'campo') ? resolverCampo(str(input, 'campo')) : null;
      const c = id ? h.controles.find((k) => k.id === id) : tipo ? h.controles.find((k) => k.tipo === tipo && (tipo === 'periodo' || tipo === 'agrupar' || k.campo === campo)) : undefined;
      if (!id && !tipo) return { error: 'Di qué filtro sacar: su id, o su tipo (y el campo).', faltan: ['filtro'] };
      if (!c) return { error: 'Esa hoja no tiene ese filtro.', disponibles: h.controles.map((k) => `${k.id} · ${k.tipo}${k.campo ? ` ${k.campo}` : ''}`), yaEstaba: true };
      const cual = c.tipo === 'periodo' ? 'de período' : c.tipo === 'agrupar' ? 'de agrupar' : `de ${campoDe(c.campo)?.nombre ?? c.campo}`;
      return {
        cambio: { op: 'quitar_filtro', hojaId: h.id, controlId: c.id },
        que: `Sacar el filtro ${cual} de la hoja ${comillas(h.nombre)}`,
        hecho: `Se sacó el filtro ${cual}`,
        deshacer: `Para volverlo: agregar_filtro_dashboard con hoja ${h.id}, tipo ${c.tipo}${c.campo ? `, campo ${c.campo}` : ''}${c.tipo === 'periodo' ? `, periodo ${c.preset}` : ''}${c.valores?.length ? `, valores [${c.valores.join(', ')}]` : ''}.`,
        datos: { hojaId: h.id },
      };
    }),
    ejecutar: aplicar,
  },

  insertar_elemento_dashboard: {
    preparar: (input, ctx) => proponer(input, ctx, (r) => {
      const h = laHoja(r, input);
      if (esFallo(h)) return h;
      const lugar = str(input, 'lugar') === 'arriba' ? 'arriba' : 'abajo';
      const a = armarElemento({
        tipo: str(input, 'tipo'), ...(input.texto !== undefined ? { texto: String(input.texto) } : {}), url: str(input, 'url'),
        ...(str(input, 'titulo') ? { titulo: str(input, 'titulo') } : {}), ...(str(input, 'tamano') ? { tamano: str(input, 'tamano') } : {}),
      }, 0);
      if (!a.ok) return { error: a.error, disponibles: a.disponibles };
      const el = a.elemento;
      const url = (el as { url?: string }).url;
      return {
        cambio: { op: 'agregar_componente', hojaId: h.id, componente: el, lugar },
        // ⚠️ LA DIRECCIÓN VA ENTERA: una URL que pasó por un modelo no es exacta, y la persona la confirma viéndola.
        que: `Insertar ${comillas(nombreDeComponente(el))} ${lugar === 'arriba' ? 'arriba' : 'abajo'} de todo en la hoja ${comillas(h.nombre)}${url ? `, con la dirección ${url}` : ''}`,
        hecho: `Quedó ${comillas(nombreDeComponente(el))} (id ${el.id})`,
        deshacer: `Para deshacerlo: quitar_componente_dashboard con hoja ${h.id} y componente ${el.id}.`,
        datos: { hojaId: h.id, componenteId: el.id },
      };
    }),
    ejecutar: aplicar,
  },

  restablecer_informe_dashboard: {
    preparar: (input, ctx) => proponer(input, ctx, (r) => {
      if (!r.eleccion.guardado) return { error: 'Esa persona no guardó un informe: ya ve el inicial.', yaEstaba: true };
      const hojas = r.lectura.tablero.hojas;
      return {
        cambio: { op: 'restablecer' },
        que: `Volver al informe inicial (Marketing y Comercial): se pierden ${hojas.length} ${hojas.length === 1 ? 'hoja' : 'hojas'} (${hojas.map((x) => x.nombre).join(', ')}). Por la API no se deshace`,
        hecho: 'El informe volvió al inicial de MaKo',
        deshacer: 'Por la API no se deshace.',
      };
    }, { noEnFlujo: 'Restablecer el informe' }),
    ejecutar: aplicar,
  },

  analizar_hoja_dashboard: {
    preparar: async (input, ctx) => {
      try {
        const r = await resolver(input, ctx, 'persona');
        if (esFallo(r)) return r;
        const h = laHoja(r, input);
        if (esFallo(h)) return h;
        const graficos = h.componentes.filter(esGrafico);
        if (!graficos.length) return { error: `La hoja ${comillas(h.nombre)} no tiene gráficos para analizar (los bloques todavía no se analizan).` };
        const ids = textos(input, 'componentes');
        if (ids?.length) {
          const malos = ids.filter((id) => !graficos.some((g) => g.id === id));
          if (malos.length) return { error: `${malos.map(comillas).join(', ')} no ${malos.length === 1 ? 'es un gráfico' : 'son gráficos'} de esa hoja.`, disponibles: graficos.map((g) => `${g.id} · ${tituloDe(g)}`) };
        }
        const vista = await vistaDe(r.sub!, h.id);
        if (vista.corriendo) return { error: `Ya hay un análisis de ${comillas(h.nombre)} corriendo: se lee con leer_analisis_dashboard en un rato.`, yaEstaba: true };
        const n = ids?.length ? ids.length : graficos.length;
        return {
          payload: { sub: r.sub, hojaId: h.id, ids: ids?.length ? ids : null },
          resumen: `Analizar con el AI Analyst ${n} ${n === 1 ? 'gráfico' : 'gráficos'} de la hoja ${comillas(h.nombre)}, en ${r.etiqueta}. Corre por detrás y puede tardar más de un minuto.`,
        };
      } catch (e) {
        console.error(`[api-mako dashboard] analizar: ${msg(e)}`);
        return { error: 'No pude leer el informe del Dashboard. Reintenta en un momento.' };
      }
    },
    ejecutar: async (payload, ctx) => {
      try {
        const sub = typeof payload.sub === 'string' ? payload.sub : '';
        const hojaId = typeof payload.hojaId === 'string' ? payload.hojaId : '';
        if (!/^\d+$/.test(sub) || !hojaId) return { ok: false, resumen: 'La propuesta no dice qué hoja analizar: vuelve a pedirla.' };
        const ids = Array.isArray(payload.ids) ? (payload.ids as unknown[]).map(String) : null;
        const lectura = await leerTableroVersionado(sub);
        const hoja = lectura.tablero.hojas.find((h) => h.id === hojaId);
        if (!hoja) return { ok: false, resumen: 'Esa hoja ya no está en el informe.' };
        // El mismo tope que la pantalla: 15 por hora por persona (app/api/graficos/analisis/route.ts).
        if (!rateLimit(`analista:${ctx.ws}:${sub}`, 15, 60 * 60_000)) return { ok: false, resumen: 'Muchos análisis seguidos de esa persona. Prueba en un rato.' };
        const r = await arrancarAMano({
          usuario: sub, hoja, ids, vista: {}, queTablero: await queTableroLeer(),
          hastaMs: Date.now() + (ctx.canal === 'http' ? PLAZO_ANALISIS_HTTP_MS : PLAZO_ANALISIS_MS),
        });
        if (!r.ok) return { ok: false, resumen: `Ya hay un análisis de ${comillas(hoja.nombre)} corriendo: se lee con leer_analisis_dashboard.` };
        const modo = await porDetras(ctx.ws, () => analizarHoja(r.pedido));
        return {
          ok: true,
          resumen: modo === 'fondo'
            ? `El AI Analyst quedó analizando la hoja ${comillas(hoja.nombre)}: se lee con leer_analisis_dashboard en un rato.`
            : `El AI Analyst analizó la hoja ${comillas(hoja.nombre)}: se lee con leer_analisis_dashboard.`,
          datos: { hojaId: hoja.id, estado: modo === 'fondo' ? 'corriendo' : 'terminado', link: linkHoja(hoja.id, ctx) },
        };
      } catch (e) {
        console.error(`[api-mako dashboard] analizar: ${msg(e)}`);
        return { ok: false, resumen: 'No pude arrancar el análisis. Reintenta en un momento.' };
      }
    },
  },

  programar_analisis_dashboard: {
    preparar: async (input, ctx) => {
      try {
        const r = await resolver(input, ctx, 'persona');
        if (esFallo(r)) return r;
        const h = laHoja(r, input);
        if (esFallo(h)) return h;
        const unidad = str(input, 'unidad');
        if (!['dia', 'semana', 'mes', 'apagar'].includes(unidad)) return { error: `${comillas(unidad)} no es una unidad: cada día, cada semana, cada mes, o apagar.`, disponibles: ['dia', 'semana', 'mes', 'apagar'] };
        const ids = textos(input, 'componentes');
        if (ids?.length) {
          const graficos = h.componentes.filter(esGrafico);
          const malos = ids.filter((id) => !graficos.some((g) => g.id === id));
          if (malos.length) return { error: `${malos.map(comillas).join(', ')} no ${malos.length === 1 ? 'es un gráfico' : 'son gráficos'} de esa hoja.`, disponibles: graficos.map((g) => `${g.id} · ${tituloDe(g)}`) };
        }
        const cron = unidad === 'apagar' ? null : sanearCronAnalisis({
          unidad, cada: num(input, 'cada') ?? 1, hora: num(input, 'hora') ?? 9, minuto: num(input, 'minuto') ?? 0,
          ...(num(input, 'diaSemana') !== undefined ? { diaSemana: num(input, 'diaSemana') } : {}),
          ...(num(input, 'diaMes') !== undefined ? { diaMes: num(input, 'diaMes') } : {}),
        });
        if (unidad !== 'apagar' && !cron) return { error: 'Ese horario no se puede programar: cada día, cada semana o cada mes.' };
        const vista = await vistaDe(r.sub!, h.id);
        const antes = vista.programa?.cron ?? null;
        if (!cron && !antes) return { error: `La hoja ${comillas(h.nombre)} no tiene un horario programado.`, yaEstaba: true };
        if (cron && antes && JSON.stringify(cron) === JSON.stringify(antes) && JSON.stringify(ids?.length ? ids : null) === JSON.stringify(vista.componentes ?? null)) {
          return { error: `La hoja ${comillas(h.nombre)} ya está programada así.`, yaEstaba: true };
        }
        const tz = vista.programa?.tz ?? null;
        return {
          payload: { sub: r.sub, hojaId: h.id, cron, componentes: ids?.length ? ids : null },
          resumen: cron
            ? `Programar el AI Analyst de la hoja ${comillas(h.nombre)}: ${textoCron(cron, tz)}${tz ? '' : ' (en la zona del negocio)'}, en ${r.etiqueta}.`
            : `Sacar el horario del AI Analyst de la hoja ${comillas(h.nombre)} (era ${textoCron(antes!, tz)}), en ${r.etiqueta}.`,
        };
      } catch (e) {
        console.error(`[api-mako dashboard] programar: ${msg(e)}`);
        return { error: 'No pude leer el informe del Dashboard. Reintenta en un momento.' };
      }
    },
    ejecutar: async (payload, ctx) => {
      try {
        const sub = typeof payload.sub === 'string' ? payload.sub : '';
        const hojaId = typeof payload.hojaId === 'string' ? payload.hojaId : '';
        if (!/^\d+$/.test(sub) || !hojaId) return { ok: false, resumen: 'La propuesta no dice qué hoja programar: vuelve a pedirla.' };
        const lectura = await leerTableroVersionado(sub);
        if (!lectura.tablero.hojas.some((h) => h.id === hojaId)) return { ok: false, resumen: 'Esa hoja ya no está en el informe.' };
        const vista = await programar({
          usuario: sub, hojaId, cron: payload.cron ?? null,
          componentes: Array.isArray(payload.componentes) ? (payload.componentes as unknown[]).map(String) : null,
          queTablero: await queTableroLeer(),
        });
        return {
          ok: true,
          resumen: vista.programa
            ? `Quedó programado: ${textoCron(vista.programa.cron, vista.programa.tz)}${vista.programa.proximaAt ? `. Próximo: ${vista.programa.proximaAt}` : ''}. Para sacarlo: programar_analisis_dashboard con unidad apagar.`
            : 'Se sacó el horario del AI Analyst de esa hoja.',
          datos: { hojaId, link: linkHoja(hojaId, ctx) },
        };
      } catch (e) {
        if (e instanceof NoProgramable) return { ok: false, resumen: e.message };
        console.error(`[api-mako dashboard] programar: ${msg(e)}`);
        return { ok: false, resumen: 'No pude guardar el horario. Reintenta en un momento.' };
      }
    },
  },

  cancelar_analisis_dashboard: {
    preparar: async (input, ctx) => {
      try {
        const r = await resolver(input, ctx, 'persona');
        if (esFallo(r)) return r;
        const h = laHoja(r, input);
        if (esFallo(h)) return h;
        const vista = await vistaDe(r.sub!, h.id);
        if (!vista.corriendo) return { error: `No hay ningún análisis de ${comillas(h.nombre)} corriendo.`, yaEstaba: true };
        return { payload: { sub: r.sub, hojaId: h.id }, resumen: `Cortar el análisis de la hoja ${comillas(h.nombre)} que está corriendo, en ${r.etiqueta}. El último análisis bueno queda.` };
      } catch (e) {
        console.error(`[api-mako dashboard] cancelar: ${msg(e)}`);
        return { error: 'No pude leer el informe del Dashboard. Reintenta en un momento.' };
      }
    },
    ejecutar: async (payload) => {
      try {
        const sub = typeof payload.sub === 'string' ? payload.sub : '';
        const hojaId = typeof payload.hojaId === 'string' ? payload.hojaId : '';
        if (!/^\d+$/.test(sub) || !hojaId) return { ok: false, resumen: 'La propuesta no dice qué análisis cortar: vuelve a pedirla.' };
        const cortado = await cancelarCorrida(sub, hojaId);
        return cortado
          ? { ok: true, resumen: 'Se cortó el análisis. Para volver a correrlo: analizar_hoja_dashboard.', datos: { hojaId } }
          : { ok: true, resumen: 'Ya no había un análisis corriendo: terminó antes.', datos: { hojaId } };
      } catch (e) {
        console.error(`[api-mako dashboard] cancelar: ${msg(e)}`);
        return { ok: false, resumen: 'No pude cortar el análisis. Reintenta en un momento.' };
      }
    },
  },
};
