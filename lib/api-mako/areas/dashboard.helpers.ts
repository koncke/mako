// =============================================================================
// api-mako/areas/dashboard.helpers — lo PURO del Dashboard por la API de MaKo (con test)
// =============================================================================
// SIN `server-only`, a propósito (molde: curso.helpers.ts): la resolución de la persona, la búsqueda de
// hojas y componentes, la validación de un gráfico, el CAMBIO que se aplica a un informe y todo el texto
// que sale (markdown, CSV, el resumen del AI Analyst) viven acá para que tests/api-mako-dashboard.test.ts
// los EJECUTE. Lo que lee la base (los informes guardados, las personas, los datos) está en
// dashboard.run.ts, que sí lleva `server-only`.
//
// Las reglas que gobiernan, y por qué:
//
//   · LA PERSONA SE ELIGE CON UNA SOLA FUNCIÓN (`elegirPersona`). Decisión de Martín (11/10/2026): la
//     API trabaja sobre el informe de la persona que se nombre; sin nombrar, el único guardado; con
//     varios, pide elegir; sin ninguno, el inicial para leer y el del único admin para escribir. En una
//     automatización la persona es OBLIGATORIA: «el único informe» deja de serlo el día que otro guarde
//     uno, y el paso empezaría a fallar sin que nadie lo tocara.
//
//   · NUNCA SE CORRIGE EN SILENCIO. `sanearGrafico` (lib/graficos-catalogo.ts) arregla lo que llega: un
//     tipo que no existe pasa a «barras», una métrica que no sirve se cambia por la primera del conjunto.
//     Sobre un pedido de un agente eso dibuja un gráfico que NO es el pedido y le contesta «listo».
//     `armarGrafico` valida ANTES cada campo pedido y rechaza con los `disponibles` (el mismo criterio
//     que `deIAHoja`, lib/graficos-ia.ts); lo único que se completa solo es lo que NO se pidió, y se dice.
//
//   · EL CAMBIO ES UN DATO (`Cambio`), y `aplicarCambio` lo aplica igual en `preparar()` (para validar y
//     decir si ya estaba así) y en `ejecutar()` (sobre el informe que se RELEYÓ). Con la versión igual,
//     las dos corridas dan lo mismo: los ids nuevos se acuñan en preparar y viajan en el cambio.
//
//   · LAS PERSONAS NO SALEN POR HTTP. La lista es la del AI Analyst (`dimensionPublica`, POSITIVA):
//     `sinPersonas` (app/dashboard/exportar.ts) pone «Closer 1» y un filtro sobre una dimensión con
//     nombres se rechaza (filtrar por «Juan» y ver si da cero es una forma de preguntar si Juan existe).

import {
  AGRUPAR, BLOQUES, CAMPOS, FUENTES, MAX_COMPONENTES, MAX_CONTROLES, MAX_HOJAS, PRESETS, TIPOS, TIPOS_CONTROL, TIPOS_ELEMENTO,
  bloqueDe, campoDe, camposDeFuente, desglosesPara, dimensionDe, dimensionesPara, emojiValido,
  esElemento, esGrafico, fuenteDe, metricasPara, nombrePreset, nuevoId, rangoDe, sanearBloque, sanearComponente,
  sanearControlVista, sanearControles, sanearElemento, sanearGrafico, sanearHoja, tipoDe, tituloDe,
  type Bloque, type Componente, type ControlVista, type FiltroDim, type Fuente, type Grafico, type Hoja, type Preset, type Tablero,
} from '@/lib/graficos-catalogo';
import { PLANTILLAS_HOJA, tableroInicial } from '@/lib/graficos-plantillas';
import { PLANTILLAS_TEMA, sanearTema } from '@/lib/graficos-temas';
import { fmtValor, type Resultado } from '@/lib/graficos-agregar';
import { Alias, conNombres, dimensionPublica, etiquetaSegura, haceCuanto, type SalidaAnalisis, type VistaAnalisis } from '@/lib/graficos-analisis';
import { enOrden, rangoTexto, sinPersonas } from '@/app/dashboard/exportar';
import { textoCron } from '@/lib/cron-aviso';
import { esFechaValida } from '@/lib/date-utils';
import { insertableDe, videoDe } from '@/lib/embeds';
import type { Formato } from '@/lib/graficos-constructores';
import type { RespuestaDetalle } from '@/lib/graficos-acciones';

/** Para comparar lo que escribe una persona: sin acentos, sin mayúsculas, sin espacios de más. */
export const normalizar = (s: string): string =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

const comillas = (s: string) => `«${s}»`;
const lista = (xs: readonly string[]) => xs.join(', ');

// ── La persona ───────────────────────────────────────────────────────────────────────────────

/** Una persona con cuenta en MaKo (`sub` = usuarios.id). */
export type PersonaInforme = { sub: string; email: string; nombre: string };
/** Una persona de la cuenta: el rol dentro del negocio (`rol_ws`; null = admin). */
export type MiembroCuenta = PersonaInforme & { rol: 'admin' | 'closer' | 'setter' };
export type ComoSeEligio = 'nombrada' | 'unico_informe' | 'unico_admin' | 'inicial';
export type Eleccion =
  | { ok: true; persona: PersonaInforme | null; guardado: boolean; como: ComoSeEligio }
  | { ok: false; error: string; disponibles: string[] };

/** La frase de la decisión del relevo de Automations: la misma en todo lo que la pide. */
export const ERROR_PERSONA_EN_FLUJO = 'En una automatización elige la persona del informe (su email): sin eso, el paso dependería de cuántos informes haya guardados en la cuenta.';

/**
 * De quién es el informe sobre el que se trabaja.
 *   · `informes`: las personas con un informe guardado en la cuenta.
 *   · `miembros`: las personas de la cuenta (no suspendidas), con su rol.
 *   · `sinPersonaVaElInicial`: para LEER una hoja, sin nadie se mira el inicial; para escribir (y para el
 *     AI Analyst, que guarda por persona) hace falta una persona.
 *   · `enFlujo`: en una automatización la persona es obligatoria.
 * Un closer o un setter no tienen informe propio (su Dashboard es la hoja Closing, en memoria): se rechaza.
 */
export function elegirPersona(p: {
  informes: readonly PersonaInforme[];
  miembros: readonly MiembroCuenta[];
  pedido?: string | null;
  sinPersonaVaElInicial: boolean;
  enFlujo: boolean;
}): Eleccion {
  const admins = p.miembros.filter((m) => m.rol === 'admin');
  const disponibles = [...new Set([...p.informes.map((i) => i.email), ...admins.map((a) => a.email)].filter(Boolean))];
  const limpia = (x: PersonaInforme): PersonaInforme => ({ sub: x.sub, email: x.email, nombre: x.nombre });
  const pedido = (p.pedido ?? '').trim();
  if (pedido) {
    const n = normalizar(pedido);
    const calza = pedido.includes('@')
      ? (x: PersonaInforme) => normalizar(x.email) === n
      : (x: PersonaInforme) => !!x.nombre && normalizar(x.nombre) === n;
    const unicas = new Map<string, PersonaInforme>();
    for (const x of [...p.informes, ...p.miembros]) if (calza(x) && !unicas.has(x.sub)) unicas.set(x.sub, x);
    if (unicas.size > 1) {
      return { ok: false, error: `Hay ${unicas.size} personas que se llaman ${comillas(pedido)}: nómbrala con su email.`, disponibles: [...unicas.values()].map((x) => x.email) };
    }
    const una = [...unicas.values()][0];
    if (!una) return { ok: false, error: `No encontré a ${comillas(pedido)} entre las personas de la cuenta que usan el Dashboard.`, disponibles };
    const guardado = p.informes.some((i) => i.sub === una.sub);
    const m = p.miembros.find((x) => x.sub === una.sub);
    if (!guardado && m && m.rol !== 'admin') {
      return { ok: false, error: `${m.nombre || m.email} es ${m.rol}: su Dashboard es la hoja Closing y no tiene un informe propio.`, disponibles };
    }
    return { ok: true, persona: limpia(una), guardado, como: 'nombrada' };
  }
  if (p.enFlujo) return { ok: false, error: ERROR_PERSONA_EN_FLUJO, disponibles };
  if (p.informes.length === 1) return { ok: true, persona: limpia(p.informes[0]), guardado: true, como: 'unico_informe' };
  if (p.informes.length > 1) return { ok: false, error: `Hay ${p.informes.length} informes guardados en la cuenta: di de quién es (su email).`, disponibles };
  if (p.sinPersonaVaElInicial) return { ok: true, persona: null, guardado: false, como: 'inicial' };
  if (admins.length === 1) return { ok: true, persona: limpia(admins[0]), guardado: false, como: 'unico_admin' };
  return {
    ok: false,
    error: admins.length
      ? `Nadie guardó un informe todavía y la cuenta tiene ${admins.length} admins: di de quién es (su email).`
      : 'Nadie guardó un informe todavía y la cuenta no tiene un admin con cuenta en MaKo: di de quién es (su email).',
    disponibles,
  };
}

/**
 * Cómo se nombra el informe en lo que se contesta. ⚠️ Por HTTP no se escribe el nombre ni el email de una
 * persona que el que llama no nombró: son datos del equipo, y un token vive en la máquina de un tercero.
 */
export function etiquetaPersona(e: Extract<Eleccion, { ok: true }>, http: boolean): string {
  const quien = e.persona ? (http ? e.persona.email : `${e.persona.nombre || e.persona.email} (${e.persona.email})`) : '';
  const sinGuardar = ' (todavía no guardó uno: se parte del inicial)';
  switch (e.como) {
    case 'nombrada': return `el informe de ${quien}${e.guardado ? '' : sinGuardar}`;
    case 'unico_informe': return http ? 'el único informe guardado de la cuenta' : `el informe de ${quien}, el único guardado de la cuenta`;
    case 'unico_admin': return http ? `el informe de la única persona admin de la cuenta${sinGuardar}` : `el informe de ${quien}, la única persona admin de la cuenta${sinGuardar}`;
    case 'inicial': return 'el informe inicial de MaKo (nadie guardó uno todavía)';
  }
}

// ── Hojas y componentes ──────────────────────────────────────────────────────────────────────

export type Encontrado<T> = { ok: true; valor: T; indice: number } | { ok: false; error: string; disponibles: string[] };

/** Una hoja por su id, o por su nombre (sin acentos ni mayúsculas). Dos con el mismo nombre: se pide el id. */
export function buscarHoja(t: Tablero, pedido: string): Encontrado<Hoja> {
  const disponibles = t.hojas.map((h) => `${h.id} · ${h.nombre}`);
  const p = pedido.trim();
  const porId = t.hojas.findIndex((h) => h.id === p);
  if (porId >= 0) return { ok: true, valor: t.hojas[porId], indice: porId };
  const n = normalizar(p);
  const exactas = t.hojas.map((h, i) => ({ h, i })).filter(({ h }) => normalizar(h.nombre) === n);
  const candidatas = exactas.length ? exactas : t.hojas.map((h, i) => ({ h, i })).filter(({ h }) => n.length >= 3 && normalizar(h.nombre).includes(n));
  if (candidatas.length === 1) return { ok: true, valor: candidatas[0].h, indice: candidatas[0].i };
  if (candidatas.length > 1) return { ok: false, error: `Hay ${candidatas.length} hojas que se llaman parecido a ${comillas(p)}: pasa su id.`, disponibles: candidatas.map(({ h }) => `${h.id} · ${h.nombre}`) };
  return { ok: false, error: `No hay ninguna hoja ${comillas(p)} en ese informe.`, disponibles };
}

/** Cómo se llama un componente en una lista. */
export function nombreDeComponente(c: Componente): string {
  if (esElemento(c)) {
    const t = c.texto.replace(/\s+/g, ' ').trim();
    const tipo = TIPOS_ELEMENTO.find((x) => x.id === c.tipo)?.nombre ?? c.tipo;
    return t ? `${tipo}: ${t.slice(0, 60)}` : tipo;
  }
  return tituloDe(c);
}

/** Un componente por su id, o por su título (sin acentos ni mayúsculas). */
export function buscarComponente(h: Hoja, pedido: string): Encontrado<Componente> {
  const disponibles = enOrden(h.componentes).map((c) => `${c.id} · ${nombreDeComponente(c)}`);
  const p = pedido.trim();
  const porId = h.componentes.findIndex((c) => c.id === p);
  if (porId >= 0) return { ok: true, valor: h.componentes[porId], indice: porId };
  const n = normalizar(p);
  const iguales = h.componentes.map((c, i) => ({ c, i })).filter(({ c }) => normalizar(esElemento(c) ? c.texto : tituloDe(c)) === n);
  if (iguales.length === 1) return { ok: true, valor: iguales[0].c, indice: iguales[0].i };
  if (iguales.length > 1) return { ok: false, error: `Hay ${iguales.length} componentes que se llaman ${comillas(p)}: pasa su id.`, disponibles: iguales.map(({ c }) => `${c.id} · ${nombreDeComponente(c)}`) };
  return { ok: false, error: `No hay ningún componente ${comillas(p)} en la hoja ${comillas(h.nombre)}.`, disponibles };
}

// ── El período ───────────────────────────────────────────────────────────────────────────────

const PRESETS_CON_NOMBRE = PRESETS.filter((x) => x.id !== 'personalizado').map((x) => x.id);
const esPreset = (v: string): v is Preset => (PRESETS_CON_NOMBRE as string[]).includes(v);
type EntradaPeriodo = { periodo?: unknown; desde?: unknown; hasta?: unknown };
type ErrorPedido = { error: string; disponibles?: unknown };
const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * El período de una LECTURA: un preset, o desde y hasta (a medida). Acotado a hoy, salvo con `acotar:
 * false`: un BLOQUE decide su propia ventana (el Outstanding mira hasta fin de mes), como /api/graficos.
 */
export function periodoPedido(input: EntradaPeriodo, hoy: string, porDefecto: Preset = 'ult30', acotar = true): { preset: Preset; desde: string; hasta: string } | ErrorPedido {
  const fin = (d: string, h: string) => (acotar ? acotarAHoy(d, h, hoy) : { desde: d, hasta: h });
  const p = texto(input.periodo);
  const d = texto(input.desde);
  const h = texto(input.hasta);
  if (d || h) {
    if (!d || !h) return { error: 'Un período a medida va con desde y hasta, los dos (YYYY-MM-DD).' };
    if (!esFechaValida(d) || !esFechaValida(h)) return { error: `«desde» y «hasta» van como YYYY-MM-DD (llegó ${d} y ${h}).` };
    if (d > h) return { error: `El período está al revés: «desde» (${d}) es posterior a «hasta» (${h}).` };
    if (p && p !== 'personalizado') return { error: 'Pasa un período (periodo) o un rango (desde y hasta), no los dos.' };
    return { preset: 'personalizado', ...fin(d, h) };
  }
  if (p && !esPreset(p)) return { error: `El período ${comillas(p)} no existe.`, disponibles: PRESETS_CON_NOMBRE };
  const preset = (p || porDefecto) as Preset;
  const rg = rangoDe(preset, hoy);
  return { preset, ...fin(rg.desde, rg.hasta) };
}

/** Como /api/graficos: un período que termina después de hoy se acota a hoy (sin quedar al revés). */
export function acotarAHoy(desde: string, hasta: string, hoy: string): { desde: string; hasta: string } {
  return { desde, hasta: hasta > hoy ? (hoy < desde ? desde : hoy) : hasta };
}

/** El período que se GUARDA en un gráfico o un bloque: 'auto' (el de la hoja), un preset, o a medida. */
export function periodoGuardado(input: EntradaPeriodo): { periodo: Preset | 'auto'; desde: string | null; hasta: string | null } | ErrorPedido {
  const p = texto(input.periodo);
  const d = texto(input.desde);
  const h = texto(input.hasta);
  if (d || h) {
    if (!d || !h) return { error: 'Un período a medida va con desde y hasta, los dos (YYYY-MM-DD).' };
    if (!esFechaValida(d) || !esFechaValida(h) || d > h) return { error: `«desde» y «hasta» tienen que ser fechas YYYY-MM-DD en orden (llegó ${d} y ${h}).` };
    if (p && p !== 'personalizado') return { error: 'Pasa un período (periodo) o un rango (desde y hasta), no los dos.' };
    return { periodo: 'personalizado', desde: d, hasta: h };
  }
  if (!p || p === 'auto') return { periodo: 'auto', desde: null, hasta: null };
  if (!esPreset(p)) return { error: `El período ${comillas(p)} no existe.`, disponibles: ['auto', ...PRESETS_CON_NOMBRE] };
  return { periodo: p, desde: null, hasta: null };
}

const periodoEnPalabras = (periodo: Preset | 'auto', desde: string | null, hasta: string | null): string =>
  periodo === 'auto' ? 'el período de la hoja' : periodo === 'personalizado' && desde && hasta ? rangoTexto(desde, hasta) : nombrePreset(periodo).toLowerCase();

// ── Un gráfico: lo pedido, validado ANTES de sanear ──────────────────────────────────────────

export type EntradaGrafico = {
  tipo?: string; conjunto?: string; metricas?: string[]; dimension?: string | null; desglose?: string | null;
  fecha?: string; periodo?: string; desde?: string; hasta?: string; titulo?: string; subtitulo?: string;
  limite?: number; comparar?: boolean; orden?: 'asc' | 'desc';
};
export type GraficoArmado = { ok: true; grafico: Grafico; notas: string[] } | ({ ok: false } & ErrorPedido);

const ALIAS_TIPO: Record<string, string> = { linea: 'serie', torta: 'circular' };
const noVale = (error: string, disponibles?: unknown): GraficoArmado => ({ ok: false, error, ...(disponibles !== undefined ? { disponibles } : {}) });

/**
 * El gráfico pedido, o el error con lo que sí vale. `base` = el gráfico que se edita (lo no pedido se
 * conserva si todavía vale); sin base, uno nuevo (con `lugar`). `dimension`/`desglose`: `undefined` = no
 * se pidió; `null` o '' = se pidió SIN.
 */
export function armarGrafico(e: EntradaGrafico, base: Grafico | null, lugar: { x: number; y: number } = { x: 0, y: 0 }): GraficoArmado {
  const notas: string[] = [];
  const tipoCrudo = e.tipo !== undefined ? texto(e.tipo) : base?.tipo ?? '';
  if (!tipoCrudo) return noVale('Falta el tipo de gráfico.', TIPOS.map((x) => x.id));
  const info = tipoDe(ALIAS_TIPO[tipoCrudo] ?? tipoCrudo);
  if (!info) return noVale(`El tipo de gráfico ${comillas(tipoCrudo)} no existe.`, TIPOS.map((x) => x.id));
  const fuenteId = e.conjunto !== undefined ? texto(e.conjunto) : base?.fuente ?? '';
  if (!fuenteId) return noVale('Falta el conjunto de datos.', FUENTES.map((f) => f.id));
  const fuente = fuenteDe(fuenteId);
  if (!fuente) return noVale(`El conjunto ${comillas(fuenteId)} no existe.`, FUENTES.map((f) => f.id));
  const cambioConjunto = !!base && fuente.id !== base.fuente;
  if (cambioConjunto && e.metricas === undefined) return noVale(`Al cambiar al conjunto ${comillas(fuente.id)}, di sus métricas.`, metricasPara(fuente, info.id).map((x) => x.id));

  // Las métricas.
  const validas = metricasPara(fuente, info.id).map((x) => x.id);
  const sumas = info.soloSumas ? ' (este tipo sólo acepta las que se suman: no las razones)' : '';
  let mets: string[];
  if (e.metricas !== undefined) {
    mets = [...new Set(e.metricas.map((x) => texto(x)).filter(Boolean))];
    const malas = mets.filter((x) => !validas.includes(x));
    if (malas.length) return noVale(`${malas.length === 1 ? 'La métrica' : 'Las métricas'} ${lista(malas.map(comillas))} no ${malas.length === 1 ? 'sirve' : 'sirven'} en ${comillas(fuente.id)} para ${comillas(info.id)}${sumas}.`, validas);
    if (mets.length > info.maxMetricas) return noVale(`${comillas(info.id)} lleva hasta ${info.maxMetricas} ${info.maxMetricas === 1 ? 'métrica' : 'métricas'}: llegaron ${mets.length}.`);
  } else {
    mets = (base?.metricas ?? []).filter((x) => validas.includes(x));
    const fuera = (base?.metricas ?? []).filter((x) => !validas.includes(x));
    if (fuera.length) notas.push(`saqué ${lista(fuera.map(comillas))}: ${comillas(info.id)} no ${fuera.length === 1 ? 'la acepta' : 'las acepta'}`);
    if (mets.length > info.maxMetricas) { notas.push(`dejé las primeras ${info.maxMetricas} métricas: ${comillas(info.id)} no lleva más`); mets = mets.slice(0, info.maxMetricas); }
  }
  if (mets.length < info.minMetricas) return noVale(`${comillas(info.id)} pide al menos ${info.minMetricas} ${info.minMetricas === 1 ? 'métrica' : 'métricas'}.`, validas);

  // La dimensión.
  const dims = dimensionesPara(fuente, info.id).map((d) => d.id);
  let dimension: string | null;
  if (e.dimension !== undefined) {
    dimension = texto(e.dimension) || null;
    if (dimension && !dims.includes(dimension)) {
      return noVale(dims.length ? `${comillas(dimension)} no sirve como dimensión de ${comillas(fuente.id)} para ${comillas(info.id)}.` : `${comillas(info.id)} no lleva dimensión.`, dims.length ? dims : undefined);
    }
  } else {
    dimension = base?.dimension ?? null;
    if (dimension && !dims.includes(dimension)) { notas.push(`saqué la dimensión ${comillas(dimension)}: ${comillas(info.id)} no la acepta`); dimension = null; }
  }
  if (!dimension && dims.length) return noVale(`${comillas(info.id)} lleva una dimensión: elige una.`, dims);

  // El desglose.
  const desgs = desglosesPara(fuente, info.id, dimension).map((d) => d.id);
  let desglose: string | null;
  if (e.desglose !== undefined) {
    desglose = texto(e.desglose) || null;
    if (desglose && !desgs.includes(desglose)) {
      return noVale(desgs.length ? `${comillas(desglose)} no sirve como desglose de ${comillas(fuente.id)} para ${comillas(info.id)}.` : `${comillas(info.id)} no lleva desglose.`, desgs.length ? desgs : undefined);
    }
  } else {
    desglose = base?.desglose ?? null;
    if (desglose && !desgs.includes(desglose)) { notas.push(`saqué el desglose ${comillas(desglose)}: no sirve ahí`); desglose = null; }
  }
  if (!desglose && info.desglose === 'requerido') return noVale(`${comillas(info.id)} lleva un desglose: elige uno.`, desgs);

  // La fecha del conjunto.
  const fechas = fuente.fechas.map((f) => f.id);
  let fecha: string;
  if (e.fecha !== undefined && texto(e.fecha)) {
    fecha = texto(e.fecha);
    if (!fechas.includes(fecha)) return noVale(`${comillas(fecha)} no es una fecha de ${comillas(fuente.id)}.`, fechas);
  } else {
    fecha = base && fechas.includes(base.fecha) ? base.fecha : fechas[0];
    if (base && !fechas.includes(base.fecha)) notas.push(`la fecha pasó a ${comillas(fecha)}`);
  }

  // El período guardado.
  let periodo: Preset | 'auto' = base?.periodo ?? 'auto';
  let desde: string | null = base?.desde ?? null;
  let hasta: string | null = base?.hasta ?? null;
  if (e.periodo !== undefined || e.desde !== undefined || e.hasta !== undefined) {
    const pg = periodoGuardado(e);
    if ('error' in pg) return { ok: false, ...pg };
    ({ periodo, desde, hasta } = pg);
  }

  const raw: Record<string, unknown> = {
    ...(base ?? {}),
    id: base?.id ?? nuevoId(), clase: 'grafico', tipo: info.id, fuente: fuente.id, fecha, dimension, desglose, metricas: mets,
    periodo, desde, hasta,
    titulo: e.titulo !== undefined ? e.titulo : base?.titulo ?? '',
    subtitulo: e.subtitulo !== undefined ? e.subtitulo : base?.subtitulo ?? '',
    ...(e.limite !== undefined ? { limite: e.limite } : {}),
    ...(e.comparar !== undefined ? { comparar: e.comparar } : {}),
    ...(e.orden !== undefined ? { ordenAsc: e.orden === 'asc' } : {}),
    // Un tipo nuevo cambia el orden de las métricas: la de orden se reinicia si ya no está.
    ordenMetrica: base?.ordenMetrica && mets.includes(base.ordenMetrica) ? base.ordenMetrica : null,
    ...(base ? {} : { x: lugar.x, y: lugar.y, w: info.w, h: info.h }),
  };
  const g = sanearGrafico(raw);
  // Defensa: lo validado tiene que sobrevivir al saneo. Si no, se dice en vez de dibujar otra cosa.
  if (!g || g.tipo !== info.id || g.fuente !== fuente.id || g.dimension !== dimension || g.desglose !== desglose
    || g.fecha !== fecha || g.metricas.join(',') !== mets.join(',')) {
    return noVale('No pude armar el gráfico como se pidió.');
  }
  return { ok: true, grafico: g, notas };
}

/** Un bloque armado (revenue, cobranza…), con su período guardado. */
export function armarBloque(e: { bloque: string; titulo?: string } & EntradaPeriodo, lugar: { x: number; y: number }): { ok: true; bloque: Bloque } | ({ ok: false } & ErrorPedido) {
  const info = bloqueDe(texto(e.bloque));
  if (!info) return { ok: false, error: `El bloque ${comillas(texto(e.bloque))} no existe.`, disponibles: BLOQUES.map((b) => b.id) };
  const pg = periodoGuardado(e);
  if ('error' in pg) return { ok: false, ...pg };
  const b = sanearBloque({ id: nuevoId(), clase: 'bloque', bloque: info.id, titulo: e.titulo ?? '', ...pg, x: lugar.x, y: lugar.y, w: info.w, h: info.h });
  return b ? { ok: true, bloque: b } : { ok: false, error: 'No pude armar el bloque.' };
}

// ── Los filtros ──────────────────────────────────────────────────────────────────────────────

export type EntradaFiltro = { campo?: unknown; valores?: unknown; texto?: unknown };

const valoresDe = (v: unknown): string[] =>
  (Array.isArray(v) ? [...new Set(v.map((x) => String(x ?? '').trim().slice(0, 120)).filter(Boolean))].slice(0, 50) : []);

/** La dimensión de un conjunto que nombra un filtro: su id, o un campo compartido que significa lo mismo ahí. */
function dimensionDelFiltro(fuente: Fuente, campo: string): string | null {
  const directa = fuente.dimensiones.find((d) => d.id === campo && d.clase === 'categoria');
  if (directa) return directa.id;
  return campoDe(campo)?.en[fuente.id] ?? null;
}

/**
 * Los filtros de una CONSULTA (no se guardan): por dimensión del conjunto. Por HTTP, una dimensión con
 * nombres de personas no se filtra (filtrar por un nombre y mirar si da cero es preguntar si existe).
 */
export function filtrosDeConsulta(fuente: Fuente, crudos: readonly EntradaFiltro[] | undefined, http: boolean): { ok: true; filtros: FiltroDim[] } | ({ ok: false } & ErrorPedido) {
  const out: FiltroDim[] = [];
  const categorias = fuente.dimensiones.filter((d) => d.clase === 'categoria').map((d) => d.id);
  for (const f of crudos ?? []) {
    const campo = texto(f.campo);
    const dim = dimensionDelFiltro(fuente, campo);
    if (!dim) return { ok: false, error: `${comillas(campo)} no es una categoría de ${comillas(fuente.id)}: no se puede filtrar por eso.`, disponibles: categorias };
    if (http && !dimensionPublica(fuente.id, dim)) {
      return { ok: false, error: `Por la API no se filtra por ${comillas(dimensionDe(fuente, dim)?.nombre ?? dim)}: son nombres de personas.` };
    }
    const valores = valoresDe(f.valores);
    const t = texto(f.texto).slice(0, 80);
    if (!valores.length && !t) return { ok: false, error: `El filtro de ${comillas(campo)} no trae valores ni texto.` };
    out.push(valores.length ? { dimension: dim, valores } : { dimension: dim, texto: t });
  }
  return { ok: true, filtros: out };
}

/** El campo (de CAMPOS) que nombra un filtro guardado de un gráfico: su id, o la dimensión del conjunto. */
function campoParaFuente(fuente: Fuente, campo: string): string | null {
  const directo = campoDe(campo);
  if (directo?.en[fuente.id]) return directo.id;
  return camposDeFuente(fuente.id).find((c) => c.en[fuente.id] === campo)?.id ?? null;
}

/** Los filtros PROPIOS de un gráfico, como controles de su cabecera (los de lista y búsqueda). */
export function controlesDeFiltros(fuente: Fuente, crudos: readonly EntradaFiltro[]): { ok: true; controles: ControlVista[] } | ({ ok: false } & ErrorPedido) {
  const out: ControlVista[] = [];
  for (const f of crudos) {
    const nombre = texto(f.campo);
    const campo = campoParaFuente(fuente, nombre);
    if (!campo) return { ok: false, error: `${comillas(nombre)} no es un campo que filtre ${comillas(fuente.id)}.`, disponibles: camposDeFuente(fuente.id).map((c) => c.id) };
    const valores = valoresDe(f.valores);
    const t = texto(f.texto).slice(0, 80);
    const c = sanearControlVista({ id: nuevoId(), tipo: valores.length || !t ? 'lista' : 'texto', campo, valores: valores.length ? valores : null, texto: t });
    if (!c) return { ok: false, error: `No pude armar el filtro de ${comillas(nombre)}.` };
    out.push(c);
  }
  return { ok: true, controles: out };
}

/** Los campos que tienen sentido en una hoja: los que filtran algún gráfico suyo (o todos, si no tiene). */
export function camposDeLaHoja(h: Hoja): string[] {
  const fuentes = new Set(h.componentes.filter(esGrafico).map((g) => g.fuente));
  const campos = CAMPOS.filter((c) => !fuentes.size || Object.keys(c.en).some((f) => fuentes.has(f)));
  return campos.map((c) => c.id);
}

/** Un campo por su id, por su nombre, o por la dimensión que nombra en un único campo. */
export function resolverCampo(pedido: string, candidatos: readonly string[] = CAMPOS.map((c) => c.id)): string | null {
  const p = pedido.trim();
  if (campoDe(p) && candidatos.includes(p)) return p;
  const n = normalizar(p);
  const porNombre = CAMPOS.filter((c) => candidatos.includes(c.id) && normalizar(c.nombre) === n);
  if (porNombre.length === 1) return porNombre[0].id;
  const porDimension = CAMPOS.filter((c) => candidatos.includes(c.id) && Object.values(c.en).includes(p));
  return porDimension.length === 1 ? porDimension[0].id : null;
}

/** Un filtro de la barra de una hoja, armado y validado. */
export function armarControlHoja(h: Hoja, e: { tipo: string; campo?: string; valores?: unknown; texto?: string; agrupar?: string } & EntradaPeriodo): { ok: true; control: ControlVista } | ({ ok: false; yaEstaba?: boolean } & ErrorPedido) {
  const tipo = TIPOS_CONTROL.find((t) => t.id === e.tipo)?.id;
  if (!tipo) return { ok: false, error: `El tipo de filtro ${comillas(e.tipo)} no existe.`, disponibles: TIPOS_CONTROL.map((t) => t.id) };
  if (h.controles.length >= MAX_CONTROLES) return { ok: false, error: `La hoja ya tiene ${MAX_CONTROLES} filtros: es el máximo.` };
  const raw: Record<string, unknown> = { id: nuevoId(), tipo };
  if (tipo === 'periodo') {
    const p = texto(e.periodo);
    const d = texto(e.desde);
    const hh = texto(e.hasta);
    if (d || hh) {
      const pg = periodoGuardado(e);
      if ('error' in pg) return { ok: false, ...pg };
      Object.assign(raw, { preset: 'personalizado', desde: pg.desde, hasta: pg.hasta });
    } else if (p) {
      if (!esPreset(p)) return { ok: false, error: `El período ${comillas(p)} no existe.`, disponibles: PRESETS_CON_NOMBRE };
      raw.preset = p;
    } else raw.preset = 'ult30';
  } else if (tipo === 'agrupar') {
    // `sanearControlVista` pasaría un valor inventado a «auto» sin decir nada.
    if (e.agrupar && !AGRUPAR.some((a) => a.id === e.agrupar)) return { ok: false, error: `${comillas(e.agrupar)} no es una forma de agrupar.`, disponibles: AGRUPAR.map((a) => a.id) };
    raw.agrupar = e.agrupar ?? 'auto';
  } else {
    const nombre = texto(e.campo);
    if (!nombre) return { ok: false, error: 'Un filtro de lista o de búsqueda va con su campo.', disponibles: camposDeLaHoja(h) };
    const campo = resolverCampo(nombre, CAMPOS.map((c) => c.id));
    if (!campo) return { ok: false, error: `El campo ${comillas(nombre)} no existe.`, disponibles: camposDeLaHoja(h) };
    raw.campo = campo;
    if (tipo === 'lista') { const v = valoresDe(e.valores); raw.valores = v.length ? v : null; }
    else raw.texto = texto(e.texto);
  }
  const c = sanearControlVista(raw);
  if (!c) return { ok: false, error: 'No pude armar el filtro.' };
  const clave = (x: ControlVista) => (x.tipo === 'periodo' || x.tipo === 'agrupar' ? x.tipo : `campo:${x.campo}`);
  const ya = h.controles.find((x) => clave(x) === clave(c));
  if (ya) {
    const igual = JSON.stringify({ ...ya, id: '' }) === JSON.stringify({ ...c, id: '' });
    return igual
      ? { ok: false, error: `La hoja ya tiene ese filtro (${ya.id}).`, yaEstaba: true }
      : { ok: false, error: `La hoja ya tiene un filtro de ${c.tipo === 'periodo' || c.tipo === 'agrupar' ? c.tipo : campoDe(c.campo)?.nombre ?? c.campo} (${ya.id}): uno por cosa. Quítalo primero con quitar_filtro_dashboard.` };
  }
  return { ok: true, control: c };
}

// ── Un elemento ──────────────────────────────────────────────────────────────────────────────

/** Los tamaños de un texto (los de `Elemento.tamano`, lib/graficos-catalogo.ts). */
const TAMANOS = ['s', 'm', 'l', 'xl'];
/** Los tipos que viven de una dirección: sin ella no muestran nada. */
const PIDEN_URL = new Set(['imagen', 'enlace', 'video', 'insertado']);

/**
 * La dirección de un elemento por un canal. Por HTTP, el link de una GRABACIÓN de llamada (Fathom: un
 * Video o un Enlace de la hoja Closing) no sale: AGENTS.md, «transcripts y links de grabaciones… no
 * llevan 'http'». Por WhatsApp y la app, tal cual (es la pantalla del dueño).
 */
export function urlParaCanal(url: string | undefined, http: boolean): string {
  if (!url) return '';
  if (!http) return url;
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (h === 'fathom.video' || h.endsWith('.fathom.video')) return 'una grabación de llamada (no sale por la API)';
  } catch { /* no es una dirección: va tal cual */ }
  return url;
}

/** Un elemento validado contra los tipos VIGENTES (TIPOS_ELEMENTO, en tiempo de ejecución). */
export function armarElemento(e: { tipo: string; texto?: string; url?: string; titulo?: string; tamano?: string }, y: number): { ok: true; elemento: Componente } | ({ ok: false } & ErrorPedido) {
  const info = TIPOS_ELEMENTO.find((x) => x.id === e.tipo);
  if (!info) return { ok: false, error: `El tipo de elemento ${comillas(e.tipo)} no existe.`, disponibles: TIPOS_ELEMENTO.map((x) => x.id) };
  let url = texto(e.url);
  // `sanearElemento` pasaría un tamaño inventado al de por defecto sin decir nada.
  if (e.tamano && !TAMANOS.includes(e.tamano)) return { ok: false, error: `${comillas(e.tamano)} no es un tamaño.`, disponibles: TAMANOS };
  if (PIDEN_URL.has(info.id) && !url) return { ok: false, error: `Un elemento ${comillas(info.nombre)} va con su dirección (url).` };
  // Un Video y un Insertar se miden con la MISMA vara que la pantalla (lib/embeds.ts): `sanearElemento`
  // sólo exige https, así que sin esto un video de un sitio cualquiera se guardaba y no se veía, y un
  // `<iframe>` pegado se rechazaba. Se guarda la dirección que esas funciones devuelven.
  if (url && (info.id === 'video' || info.id === 'insertado')) {
    const r = info.id === 'video' ? videoDe(url) : insertableDe(url);
    if (!r.ok) return { ok: false, error: r.error };
    url = r.valor.direccion;
  }
  // El título de un video o de una página insertada vive en `texto` (lib/graficos-catalogo.ts).
  const t = e.texto !== undefined ? e.texto : e.titulo ?? '';
  if (info.id === 'texto' && !t.trim()) return { ok: false, error: 'Un elemento de texto va con su texto.' };
  const el = sanearElemento({ id: nuevoId(), clase: 'elemento', tipo: info.id, texto: t, url, ...(e.tamano ? { tamano: e.tamano } : {}), x: 0, y, w: info.w, h: info.h });
  if (!el) return { ok: false, error: 'No pude armar el elemento.' };
  if (url && !(el as { url?: string }).url) return { ok: false, error: `Esa dirección no se puede usar en ${comillas(info.nombre)}: tiene que ser https y de un lugar que se pueda mostrar. Llegó: ${url}` };
  return { ok: true, elemento: el };
}

// ── El CAMBIO de un informe ──────────────────────────────────────────────────────────────────

export type Cambio =
  | { op: 'crear_hoja'; hoja: Hoja }
  | { op: 'editar_hoja'; hojaId: string; nombre?: string; emoji?: string; subtitulo?: string; tema?: string; posicion?: number }
  | { op: 'duplicar_hoja'; hojaId: string; copia: Hoja }
  | { op: 'borrar_hoja'; hojaId: string }
  | { op: 'agregar_componente'; hojaId: string; componente: Componente; lugar: 'abajo' | 'arriba' }
  | { op: 'reemplazar_componente'; hojaId: string; componente: Componente }
  | { op: 'quitar_componente'; hojaId: string; componenteId: string }
  | { op: 'agregar_filtro'; hojaId: string; control: ControlVista }
  | { op: 'quitar_filtro'; hojaId: string; controlId: string }
  | { op: 'restablecer' };

export type Aplicado = { ok: true; tablero: Tablero } | { ok: false; error: string; yaEstaba?: true };

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** La copia de una hoja: TODO lo que tiene id se acuña de nuevo (como «Duplicar» del editor). */
export function copiaDeHoja(h: Hoja): Hoja {
  return sanearHoja({
    ...h, id: nuevoId(), nombre: `${h.nombre} (copia)`.slice(0, 40),
    controles: h.controles.map((c) => ({ ...c, id: nuevoId() })),
    componentes: h.componentes.map((c) => (esElemento(c) ? { ...c, id: nuevoId() } : { ...c, id: nuevoId(), controles: c.controles.map((k) => ({ ...k, id: nuevoId() })) })),
  }, 0)!;
}

/**
 * Aplica un cambio a un informe y devuelve el informe nuevo (o por qué no). Puro: lo corre `preparar()`
 * para validar y `ejecutar()` sobre lo que releyó. Lo que viene del payload se vuelve a sanear: un
 * payload es un JSON guardado en la base, no un objeto en el que confiar.
 */
export function aplicarCambio(t: Tablero, c: Cambio): Aplicado {
  if (c.op === 'restablecer') {
    const ini = tableroInicial();
    return igual(t, ini) ? { ok: false, error: 'El informe ya es el inicial.', yaEstaba: true } : { ok: true, tablero: ini };
  }
  if (c.op === 'crear_hoja') {
    if (t.hojas.length >= MAX_HOJAS) return { ok: false, error: `El informe ya tiene ${MAX_HOJAS} hojas: es el máximo.` };
    const h = sanearHoja(c.hoja, t.hojas.length);
    if (!h) return { ok: false, error: 'La hoja no se pudo armar.' };
    if (t.hojas.some((x) => x.id === h.id)) return { ok: false, error: 'Ya hay una hoja con ese id.' };
    return { ok: true, tablero: { ...t, hojas: [...t.hojas, h] } };
  }
  const i = t.hojas.findIndex((x) => x.id === c.hojaId);
  if (i < 0) return { ok: false, error: `La hoja ${comillas(c.hojaId)} ya no está en el informe.` };
  const h = t.hojas[i];
  const conHoja = (nueva: Hoja): Aplicado => {
    const hojas = [...t.hojas];
    hojas[i] = nueva;
    return { ok: true, tablero: { ...t, hojas } };
  };
  switch (c.op) {
    case 'editar_hoja': {
      const nueva: Hoja = {
        ...h,
        ...(c.nombre !== undefined ? { nombre: c.nombre.trim().slice(0, 40) || h.nombre } : {}),
        ...(c.emoji !== undefined ? { emoji: emojiValido(c.emoji) } : {}),
        ...(c.subtitulo !== undefined ? { subtitulo: c.subtitulo.slice(0, 140) } : {}),
        ...(c.tema !== undefined ? { tema: sanearTema({ ...h.tema, plantilla: c.tema }) } : {}),
      };
      const hojas = [...t.hojas];
      hojas[i] = nueva;
      if (c.posicion !== undefined) {
        const destino = Math.min(hojas.length, Math.max(1, Math.round(c.posicion))) - 1;
        const [movida] = hojas.splice(i, 1);
        hojas.splice(destino, 0, movida);
      }
      if (igual(hojas, t.hojas)) return { ok: false, error: `La hoja ${comillas(h.nombre)} ya está así.`, yaEstaba: true };
      return { ok: true, tablero: { ...t, hojas } };
    }
    case 'duplicar_hoja': {
      if (t.hojas.length >= MAX_HOJAS) return { ok: false, error: `El informe ya tiene ${MAX_HOJAS} hojas: es el máximo.` };
      const copia = sanearHoja(c.copia, i + 1);
      if (!copia || t.hojas.some((x) => x.id === copia.id)) return { ok: false, error: 'La copia no se pudo armar.' };
      const hojas = [...t.hojas];
      hojas.splice(i + 1, 0, copia);
      return { ok: true, tablero: { ...t, hojas } };
    }
    case 'borrar_hoja':
      if (t.hojas.length <= 1) return { ok: false, error: 'Es la única hoja del informe: no se puede borrar.' };
      return { ok: true, tablero: { ...t, hojas: t.hojas.filter((x) => x.id !== h.id) } };
    case 'agregar_componente': {
      if (h.componentes.length >= MAX_COMPONENTES) return { ok: false, error: `La hoja ya tiene ${MAX_COMPONENTES} componentes: es el máximo.` };
      const comp = sanearComponente(c.componente);
      if (!comp) return { ok: false, error: 'El componente no se pudo armar.' };
      if (h.componentes.some((x) => x.id === comp.id)) return { ok: false, error: 'Ya hay un componente con ese id.' };
      const abajo = h.componentes.reduce((mx, x) => Math.max(mx, x.y + x.h), 0);
      const componentes = c.lugar === 'arriba'
        ? [{ ...comp, x: 0, y: 0 }, ...h.componentes.map((x) => ({ ...x, y: x.y + comp.h }))]
        : [...h.componentes, { ...comp, x: 0, y: abajo }];
      return conHoja({ ...h, componentes });
    }
    case 'reemplazar_componente': {
      const j = h.componentes.findIndex((x) => x.id === c.componente.id);
      if (j < 0) return { ok: false, error: 'Ese componente ya no está en la hoja.' };
      const comp = sanearComponente(c.componente);
      if (!comp || comp.clase !== h.componentes[j].clase) return { ok: false, error: 'El componente no se pudo armar.' };
      if (igual(comp, h.componentes[j])) return { ok: false, error: `${comillas(nombreDeComponente(comp))} ya está así.`, yaEstaba: true };
      const componentes = [...h.componentes];
      componentes[j] = comp;
      return conHoja({ ...h, componentes });
    }
    case 'quitar_componente':
      if (!h.componentes.some((x) => x.id === c.componenteId)) return { ok: false, error: 'Ese componente ya no está en la hoja.', yaEstaba: true };
      return conHoja({ ...h, componentes: h.componentes.filter((x) => x.id !== c.componenteId) });
    case 'agregar_filtro': {
      const ctl = sanearControlVista(c.control);
      if (!ctl) return { ok: false, error: 'El filtro no se pudo armar.' };
      const controles = sanearControles([...h.controles, ctl]);
      if (!controles.some((x) => x.id === ctl.id)) return { ok: false, error: 'La hoja ya tiene un filtro de ese tipo: uno por cosa.' };
      return conHoja({ ...h, controles });
    }
    case 'quitar_filtro':
      if (!h.controles.some((x) => x.id === c.controlId)) return { ok: false, error: 'Ese filtro ya no está en la hoja.', yaEstaba: true };
      return conHoja({ ...h, controles: h.controles.filter((x) => x.id !== c.controlId) });
  }
}

// ── Cómo se escribe lo que sale ──────────────────────────────────────────────────────────────

const UNIDAD: Record<Formato, string> = { numero: '', usd: ' (US$)', pct: ' (%)', veces: ' (x)', segundos: ' (s)' };
/** Una celda de una tabla markdown: sin barras ni saltos que la partan. */
const celda = (s: string) => s.replace(/\|/g, '/').replace(/[\r\n]+/g, ' ').trim();
const fila = (xs: readonly string[]) => `| ${xs.map(celda).join(' | ')} |`;
const tabla = (cab: readonly string[], filas: ReadonlyArray<readonly string[]>): string[] => [fila(cab), `|${cab.map(() => '---').join('|')}|`, ...filas.map(fila)];

/** Corta un texto largo en un salto de línea y lo DICE: un recorte callado se lee como un total. */
export function recortar(s: string, tope: number, como = 'pide una parte más chica'): string {
  if (s.length <= tope) return s;
  const corte = s.lastIndexOf('\n', tope);
  return `${s.slice(0, corte > tope / 2 ? corte : tope)}\n\n(Recortado: la respuesta pasaba de ${tope} caracteres; ${como}.)`;
}

/** Lo que muestra un gráfico, en markdown: su título, su período, la tabla y sus notas. */
export function resultadoMarkdown(g: Grafico, r: Resultado, p: { desde: string; hasta: string; topeFilas?: number; titulo?: string; agrupar?: string | null }): string[] {
  const f = fuenteDe(g.fuente);
  const sinRango = !!f?.fechas.find((x) => x.id === g.fecha)?.sinRango;
  const out: string[] = [`**${p.titulo ?? tituloDe(g)}** · ${f?.nombre ?? g.fuente} · ${sinRango ? 'la foto de hoy' : rangoTexto(p.desde, p.hasta)}`];
  const cols = r.columnas;
  const fmt = (v: number | null | undefined, fo: Formato) => (v == null ? '—' : fmtValor(v, fo));
  if (!cols.length) return [...out, 'Sin columnas.'];
  if (r.clase == null) {
    const conAnterior = !!r.anterior?.some((v) => v != null);
    out.push(...tabla(['Métrica', 'Valor', ...(conAnterior ? ['Período anterior'] : [])],
      cols.map((c, i) => [c.nombre, fmt(r.totales[i], c.formato), ...(conAnterior ? [fmt(r.anterior?.[i], c.formato)] : [])])));
    return out;
  }
  // Con «agrupar por» (un filtro de la hoja), el tiempo va por esa unidad y no por la del gráfico.
  const dimId = r.clase === 'tiempo' ? (p.agrupar ?? g.dimension) : g.dimension;
  const dimNombre = (f && dimensionDe(f, dimId)?.nombre) ?? 'Grupo';
  const tope = p.topeFilas ?? Infinity;
  const visibles = r.filas.slice(0, tope);
  if (r.cruce && cols[0]) {
    const c0 = cols[0];
    out.push(`${c0.nombre}${UNIDAD[c0.formato]}, por ${dimNombre.toLowerCase()} y ${((f && dimensionDe(f, g.desglose)?.nombre) ?? 'desglose').toLowerCase()}:`);
    out.push(...tabla([dimNombre, ...r.cruce.claves, 'Total'], visibles.map((fl, i) => [fl.etiqueta, ...r.cruce!.celdas[i].map((v) => fmt(v, c0.formato)), fmt(fl.valores[0], c0.formato)])));
  } else {
    out.push(...tabla([dimNombre, ...cols.map((c) => `${c.nombre}${UNIDAD[c.formato]}`)], visibles.map((fl) => [fl.etiqueta, ...fl.valores.map((v, i) => fmt(v, cols[i]?.formato ?? 'numero'))])));
  }
  if (r.totales.some((v) => v != null)) out.push(`Total: ${cols.map((c, i) => `${c.nombre} ${fmt(r.totales[i], c.formato)}`).join(' · ')}.`);
  if (r.anterior?.some((v) => v != null)) out.push(`Período anterior del mismo largo: ${cols.map((c, i) => `${c.nombre} ${fmt(r.anterior?.[i], c.formato)}`).join(' · ')}.`);
  if (r.filas.length > visibles.length) out.push(`(y ${r.filas.length - visibles.length} filas más)`);
  if (r.fuera > 0) out.push(`(${r.fuera} grupos más que no entran en el gráfico)`);
  return out;
}

/** Varios cuadros de un número sobre el mismo conjunto, juntos en uno solo (una consulta sin dimensión). */
export function juntarTotales(rs: readonly Resultado[]): Resultado {
  const conAnterior = rs.some((r) => r.anterior);
  return {
    columnas: rs.flatMap((r) => r.columnas), filas: [], fuera: 0, clase: null,
    totales: rs.flatMap((r) => r.totales),
    ...(conAnterior ? { anterior: rs.flatMap((r) => r.anterior ?? r.columnas.map(() => null)) } : {}),
  };
}

/**
 * Lo que un gráfico puede mostrar por un canal. Por HTTP, las etiquetas de personas como alias
 * («Closer 1»); por WhatsApp y la app, tal cual (es la pantalla del dueño).
 */
export const resultadoPara = (g: Grafico, r: Resultado, http: boolean, alias: Alias): Resultado => (http ? sinPersonas(g, r, alias) : r);

/** Un control de la hoja visto por HTTP: los valores elegidos de un campo con personas, como alias. */
export function controlParaHttp(c: ControlVista, alias: Alias): ControlVista {
  if (c.tipo !== 'lista' && c.tipo !== 'texto') return c;
  const campo = campoDe(c.campo);
  if (!campo) return c;
  const publico = Object.entries(campo.en).every(([f, d]) => dimensionPublica(f, d));
  if (publico) return c;
  return { ...c, valores: c.valores?.map((v) => alias.de(campo.nombre, v)) ?? null, texto: c.texto ? 'una búsqueda' : '' };
}

/** Un filtro ya resuelto (de `efectivoDe`), en palabras. */
export function filtroEnPalabras(fuenteId: string, f: FiltroDim, http: boolean, alias: Alias): string {
  const fu = fuenteDe(fuenteId);
  const nombre = (fu && dimensionDe(fu, f.dimension)?.nombre) ?? f.dimension;
  if (f.valores) return `${nombre}: ${f.valores.map((v) => (http ? etiquetaSegura(fuenteId, f.dimension, v, alias) : v)).join(', ')}`;
  return http && !dimensionPublica(fuenteId, f.dimension) ? `${nombre}: una búsqueda` : `${nombre} contiene «${f.texto ?? ''}»`;
}

/**
 * Los datos de un bloque, en markdown. Cada bloque tiene su payload (app/dashboard/bloques/datos-comercial.ts,
 * lib/graficos-bloques-extra-catalogo.ts): acá se recorren genéricos, con topes, en vez de escribir quince
 * dibujos que se quedarían viejos con cada bloque nuevo.
 */
export function datosAMarkdown(datos: unknown, prof = 0): string[] {
  const sangria = '  '.repeat(prof);
  const prim = (v: unknown): string | null => {
    if (v == null) return '—';
    if (typeof v === 'number') return Number.isFinite(v) ? String(Math.round(v * 100) / 100) : '—';
    if (typeof v === 'boolean') return v ? 'sí' : 'no';
    if (typeof v === 'string') return v.length > 120 ? `${v.slice(0, 119)}…` : v;
    return null;
  };
  const out: string[] = [];
  if (!datos || typeof datos !== 'object') { out.push(`${sangria}- ${prim(datos) ?? ''}`); return out; }
  for (const [k, v] of Object.entries(datos as Record<string, unknown>)) {
    if (k === 'bloque') continue;
    const p = prim(v);
    if (p != null) { out.push(`${sangria}- ${k}: ${p}`); continue; }
    if (Array.isArray(v)) {
      if (!v.length) { out.push(`${sangria}- ${k}: (vacío)`); continue; }
      if (v.every((x) => prim(x) != null)) { out.push(`${sangria}- ${k}: ${v.slice(0, 12).map((x) => prim(x)).join(', ')}${v.length > 12 ? ` (y ${v.length - 12} más)` : ''}`); continue; }
      out.push(`${sangria}- ${k} (${v.length}):`);
      for (const x of v.slice(0, 10)) {
        if (x && typeof x === 'object' && !Array.isArray(x)) {
          const planos = Object.entries(x as Record<string, unknown>).map(([kk, vv]) => [kk, prim(vv)] as const).filter(([, vv]) => vv != null);
          out.push(`${sangria}  - ${planos.map(([kk, vv]) => `${kk}: ${vv}`).join(' · ')}`);
        } else out.push(`${sangria}  - ${prim(x) ?? '{…}'}`);
      }
      if (v.length > 10) out.push(`${sangria}  - (y ${v.length - 10} más)`);
      continue;
    }
    if (prof >= 2) { out.push(`${sangria}- ${k}: {…}`); continue; }
    out.push(`${sangria}- ${k}:`, ...datosAMarkdown(v, prof + 1));
  }
  return out;
}

// ── El catálogo ──────────────────────────────────────────────────────────────────────────────

export const SECCIONES_CATALOGO = ['conjuntos', 'tipos', 'bloques', 'plantillas', 'estilos', 'filtros', 'elementos', 'periodos', 'campos'] as const;
export type SeccionCatalogo = (typeof SECCIONES_CATALOGO)[number];

const conjuntoJson = (f: Fuente, detalle: boolean) => ({
  id: f.id, nombre: f.nombre, area: f.area, ...(detalle ? { descripcion: f.descripcion } : {}),
  fechas: f.fechas.map((x) => (detalle ? { id: x.id, nombre: x.nombre, ...(x.sinRango ? { foto_de_hoy: true } : {}) } : x.id)),
  dimensiones: f.dimensiones.map((d) => (detalle ? { id: d.id, nombre: d.nombre, clase: d.clase } : d.id)),
  metricas: f.metricas.map((m) => (detalle ? { id: m.id, nombre: m.nombre, formato: m.formato, ...(m.razon ? { razon: true } : {}), ...(m.distinto ? { distintos: true } : {}) } : m.id)),
  ...(f.porDimension ? { por_dimension: true, cruces: f.cruces ?? {} } : {}),
});

/** El catálogo en JSON (toda la lista, o una sección, o un conjunto con su detalle). */
export function catalogoJson(p: { conjunto?: string; seccion?: SeccionCatalogo }): Record<string, unknown> | ErrorPedido {
  if (p.conjunto) {
    const f = fuenteDe(p.conjunto);
    if (!f) return { error: `El conjunto ${comillas(p.conjunto)} no existe.`, disponibles: FUENTES.map((x) => x.id) };
    return { conjunto: conjuntoJson(f, true), campos: camposDeFuente(f.id).map((c) => ({ id: c.id, nombre: c.nombre })) };
  }
  const todo: Record<SeccionCatalogo, unknown> = {
    conjuntos: FUENTES.map((f) => conjuntoJson(f, false)),
    tipos: TIPOS.map((t) => ({ id: t.id, nombre: t.nombre, grupo: t.grupo, dimension: t.dimension, desglose: t.desglose, metricas: { min: t.minMetricas, max: t.maxMetricas }, ...(t.soloSumas ? { solo_sumas: true } : {}), ...(t.soloDims ? { solo_dimensiones: t.soloDims } : {}) })),
    bloques: BLOQUES.map((b) => ({ id: b.id, nombre: b.nombre, linea: b.linea })),
    plantillas: PLANTILLAS_HOJA.map((x) => ({ id: x.id, nombre: x.nombre, emoji: x.emoji, linea: x.linea })),
    estilos: PLANTILLAS_TEMA.map((x) => ({ id: x.id, nombre: x.nombre, linea: x.linea })),
    filtros: TIPOS_CONTROL.map((x) => ({ id: x.id, nombre: x.nombre, linea: x.linea })),
    elementos: TIPOS_ELEMENTO.map((x) => ({ id: x.id, nombre: x.nombre })),
    periodos: PRESETS.map((x) => ({ id: x.id, nombre: x.nombre })),
    campos: CAMPOS.map((c) => ({ id: c.id, nombre: c.nombre, conjuntos: Object.keys(c.en) })),
  };
  if (p.seccion) return { [p.seccion]: todo[p.seccion] };
  return todo;
}

/**
 * El catálogo en markdown. Sin sección, todo menos los campos (son ~cien: se piden aparte). Con `compacto`
 * (un chat: el techo de entrada de Groq son ~7 k tokens), los conjuntos van sin sus dimensiones y métricas,
 * que se piden por conjunto: completo pasa de 14 mil caracteres (medido el 11/10/2026).
 */
export function catalogoMarkdown(p: { conjunto?: string; seccion?: SeccionCatalogo; compacto?: boolean }): string | ErrorPedido {
  if (p.conjunto) {
    const f = fuenteDe(p.conjunto);
    if (!f) return { error: `El conjunto ${comillas(p.conjunto)} no existe.`, disponibles: FUENTES.map((x) => x.id) };
    return [
      `## ${f.nombre} (\`${f.id}\`) · ${f.area}`, f.descripcion, '',
      `Fechas: ${f.fechas.map((x) => `\`${x.id}\` ${x.nombre}${x.sinRango ? ' (la foto de hoy, sin período)' : ''}`).join(' · ')}`,
      `Dimensiones: ${f.dimensiones.map((d) => `\`${d.id}\` ${d.nombre}`).join(' · ')}`,
      `Métricas: ${f.metricas.map((m) => `\`${m.id}\` ${m.nombre}${UNIDAD[m.formato]}${m.razon ? ' (razón)' : ''}`).join(' · ')}`,
      ...(f.porDimension ? [`Cada dimensión es una lectura aparte; se cruzan sólo: ${Object.entries(f.cruces ?? {}).map(([d, xs]) => `${d} con ${xs.join(', ')}`).join('; ') || 'ninguna'}.`] : []),
      `Campos para filtrar: ${camposDeFuente(f.id).map((c) => `\`${c.id}\``).join(', ') || 'ninguno'}`,
    ].join('\n');
  }
  const ver = (s: SeccionCatalogo) => !p.seccion || p.seccion === s;
  const out: string[] = [];
  if (ver('conjuntos')) {
    const corto = p.compacto && p.seccion !== 'conjuntos';
    out.push('## Conjuntos de datos', corto ? 'Sus fechas, dimensiones y métricas: pide `conjunto` con el id.' : 'Cada uno: fechas · dimensiones · métricas (ids). Con `conjunto`, sus nombres y unidades.');
    for (const f of FUENTES) {
      out.push(corto
        ? `- \`${f.id}\` ${f.nombre} (${f.area})`
        : `- \`${f.id}\` ${f.nombre} (${f.area}) · fechas: ${f.fechas.map((x) => x.id).join(', ')} · dimensiones: ${f.dimensiones.map((d) => d.id).join(', ')} · métricas: ${f.metricas.map((m) => m.id).join(', ')}`);
    }
  }
  if (ver('tipos')) {
    out.push('', '## Tipos de gráfico', 'id · dimensión que pide · desglose · métricas (mín-máx).');
    for (const t of TIPOS) out.push(`- \`${t.id}\` ${t.nombre} · ${t.dimension} · desglose ${t.desglose} · ${t.minMetricas}-${t.maxMetricas}${t.soloSumas ? ' · sólo las que se suman' : ''}${t.soloDims ? ` · sólo ${t.soloDims.join(', ')}` : ''}`);
  }
  if (ver('bloques')) { out.push('', '## Bloques armados'); for (const b of BLOQUES) out.push(`- \`${b.id}\` ${b.nombre}: ${b.linea}`); }
  if (ver('plantillas')) { out.push('', '## Plantillas de hoja'); for (const x of PLANTILLAS_HOJA) out.push(`- \`${x.id}\` ${x.emoji} ${x.nombre}: ${x.linea}`); }
  if (ver('estilos')) { out.push('', '## Estilos de página'); for (const x of PLANTILLAS_TEMA) out.push(`- \`${x.id}\` ${x.nombre}: ${x.linea}`); }
  if (ver('filtros')) { out.push('', '## Filtros de una hoja'); for (const x of TIPOS_CONTROL) out.push(`- \`${x.id}\` ${x.nombre}: ${x.linea}`); }
  if (ver('elementos')) { out.push('', '## Elementos'); out.push(TIPOS_ELEMENTO.map((x) => `\`${x.id}\` ${x.nombre}`).join(' · ')); }
  if (ver('periodos')) { out.push('', '## Períodos'); out.push(PRESETS.map((x) => `\`${x.id}\` ${x.nombre}`).join(' · '), 'Con desde y hasta, uno a medida.'); }
  if (p.seccion === 'campos') {
    out.push('## Campos para filtrar', 'Un campo compartido filtra todos los conjuntos donde significa lo mismo; los demás son de un conjunto («leads.etapa»).');
    for (const c of CAMPOS) out.push(`- \`${c.id}\` ${c.nombre} · ${Object.keys(c.en).join(', ')}`);
  } else if (!p.seccion) out.push('', `Los ${CAMPOS.length} campos para filtrar: pide la sección «campos».`);
  return out.join('\n').trim();
}

// ── El AI Analyst ────────────────────────────────────────────────────────────────────────────

/**
 * El texto CORTO de un análisis: el resumen, hasta tres hallazgos y el link. Puro, para que lo mande
 * también una automatización (el relevo de Automations, 11/10/2026). Los nombres van como vengan en
 * `salida`: quien la pasa decide si ya les puso los reales (`conNombres`).
 */
export function textoDeAnalisis(salida: Pick<SalidaAnalisis, 'resumen' | 'hallazgos'>, hojaNombre: string, link: string): string {
  const lineas = [`AI Analyst · ${hojaNombre}`, salida.resumen.trim()];
  for (const h of salida.hallazgos.slice(0, 3)) lineas.push(`• ${h.titulo.trim()}: ${h.texto.trim()}`);
  if (link) lineas.push(link);
  return lineas.filter(Boolean).join('\n');
}

/** La salida con los nombres reales en lugar de «Closer 1» (lo que ve la pantalla). */
export function salidaConNombres(s: SalidaAnalisis, nombres: Record<string, string>): SalidaAnalisis {
  const n = (t: string) => conNombres(t, nombres);
  return {
    ...s, resumen: n(s.resumen),
    hallazgos: s.hallazgos.map((h) => ({ ...h, titulo: n(h.titulo), texto: n(h.texto) })),
    recomendaciones: s.recomendaciones.map((r) => ({ ...r, accion: n(r.accion), porque: n(r.porque) })),
  };
}

/** El estado del AI Analyst de una hoja, en markdown: lo que corre, lo último, el horario. */
export function analisisMarkdown(v: VistaAnalisis, p: { hojaNombre: string; link: string; ahoraMs: number; salida: SalidaAnalisis | null }): string {
  const out: string[] = [];
  if (v.corriendo) out.push(`Hay un análisis corriendo desde ${haceCuanto(v.corriendo.desde, p.ahoraMs)} (${v.corriendo.fase === 'escribiendo' ? 'escribiendo' : 'leyendo los datos'}). Vuelve a leerlo en un rato.`);
  if (v.fallo) out.push(`El último intento no salió: ${v.fallo.error}`);
  if (v.ultimo && p.salida) {
    out.push(`Último análisis: ${haceCuanto(v.ultimo.analizadoAt, p.ahoraMs)} (${v.ultimo.analizadoAt}).`, '', textoDeAnalisis(p.salida, p.hojaNombre, ''));
    if (p.salida.hallazgos.length > 3) for (const h of p.salida.hallazgos.slice(3)) out.push(`• ${h.titulo}: ${h.texto}`);
    if (p.salida.recomendaciones.length) {
      out.push('', 'Recomendaciones:');
      for (const r of p.salida.recomendaciones) out.push(`- ${r.accion} — ${r.porque}${r.impacto ? ` (impacto ${r.impacto}${r.esfuerzo ? `, esfuerzo ${r.esfuerzo}` : ''})` : ''}`);
    }
  } else if (!v.corriendo) out.push(`La hoja ${comillas(p.hojaNombre)} no tiene ningún análisis todavía: se pide con analizar_hoja_dashboard.`);
  out.push('', v.programa ? `Programado: ${textoCron(v.programa.cron, v.programa.tz)}${v.programa.proximaAt ? `. Próximo: ${v.programa.proximaAt}` : ''}.` : 'Sin horario programado.');
  if (p.link) out.push(p.link);
  return out.join('\n').trim();
}

// ── El detalle de un número ──────────────────────────────────────────────────────────────────

export function detalleMarkdown(r: RespuestaDetalle, titulo: string): string {
  if (!r.ok) return `No pude leer el detalle: ${r.error}`;
  const out = [`**Detrás de ${titulo}** · ${rangoTexto(r.desde, r.hasta)}`];
  if (!r.entidad) {
    out.push('Ese número no tiene cosas que se puedan listar (se arma por día, no por una cosa con id).');
    if (r.noAplica.length) out.push(`No se pudo aplicar: ${r.noAplica.join(', ')}.`);
    return out.join('\n');
  }
  if (!r.filas.length) out.push(`No hay ${r.plural?.toLowerCase() ?? 'filas'} en ese período.`);
  else {
    out.push(...tabla([r.plural ?? 'Fila', 'Detalle', 'Fecha', ...r.columnas.map((c) => `${c.nombre}${UNIDAD[c.formato]}`), 'id'],
      r.filas.map((f) => [f.nombre, f.linea ?? '', f.fecha ?? '', ...f.valores.map((v, i) => (v == null ? '—' : fmtValor(v, r.columnas[i]?.formato ?? 'numero'))), f.id])));
  }
  if (r.fuera > 0) out.push(`(y ${r.fuera} más que no entran: filtra para verlas)`);
  if (r.sinId > 0) out.push(`(${r.sinId} filas sin id no se pueden listar)`);
  if (r.noAplica.length) out.push(`Filtros que no se pudieron aplicar: ${r.noAplica.join(', ')}.`);
  return out.join('\n');
}

// ── Los informes de la cuenta ────────────────────────────────────────────────────────────────

export type InformeListado = { persona: PersonaInforme; actualizado: string | null; hojas: Array<{ id: string; nombre: string }> };

export function informesMarkdown(p: { informes: readonly InformeListado[]; sinPersona: number; recortado: boolean }): string {
  if (!p.informes.length) {
    const ini = tableroInicial();
    return [
      'Nadie guardó un informe del Dashboard todavía: todos ven el inicial de MaKo.',
      `Sus hojas: ${ini.hojas.map((h) => `${h.nombre} (\`${h.id}\`)`).join(', ')}.`,
      ...(p.sinPersona ? [`(${p.sinPersona} informe${p.sinPersona === 1 ? '' : 's'} de una sesión sin persona, que no se cuentan.)`] : []),
    ].join('\n');
  }
  const out = [`${p.informes.length} informe${p.informes.length === 1 ? '' : 's'} guardado${p.informes.length === 1 ? '' : 's'} en la cuenta:`];
  for (const i of p.informes) {
    out.push(`- ${i.persona.nombre || i.persona.email} (${i.persona.email})${i.actualizado ? ` · cambiado ${i.actualizado.slice(0, 16).replace('T', ' ')}` : ''} · ${i.hojas.length} hoja${i.hojas.length === 1 ? '' : 's'}: ${i.hojas.map((h) => `${h.nombre} (\`${h.id}\`)`).join(', ')}`);
  }
  if (p.sinPersona) out.push(`(${p.sinPersona} informe${p.sinPersona === 1 ? '' : 's'} de una sesión sin persona o de alguien que ya no tiene cuenta, que no se cuentan.)`);
  if (p.recortado) out.push('(La lista llegó a su tope de 200: puede haber más.)');
  return out.join('\n');
}

// ── Una hoja, en palabras ────────────────────────────────────────────────────────────────────

/** Lo que el runner leyó de cada componente de la hoja. */
export type LeidoDeComponente =
  | { c: Grafico; desde: string; hasta: string; agrupar: 'dia' | 'semana' | 'mes' | null; filtros: string[]; noAplica: string[]; resultado: Resultado | null; error: string | null }
  | { c: Bloque; desde: string; hasta: string; datos: unknown; error: string | null; oculto: boolean }
  | { c: Componente & { clase: 'elemento' } };

export function hojaMarkdown(p: { hoja: Hoja; quien: string; periodoHoja: string; leidos: readonly LeidoDeComponente[]; link: string; topeFilas: number; controles: readonly ControlVista[]; http?: boolean }): string {
  const h = p.hoja;
  const out: string[] = [
    `# ${h.emoji ? `${h.emoji} ` : ''}${h.nombre} (\`${h.id}\`)`,
    ...(h.subtitulo ? [h.subtitulo] : []),
    `De ${p.quien}. ${p.periodoHoja}. Estilo: ${h.tema.plantilla}.`,
  ];
  if (p.controles.length) {
    out.push('Filtros de la hoja:');
    for (const c of p.controles) {
      const que = c.tipo === 'periodo' ? `período ${periodoEnPalabras(c.preset, c.desde, c.hasta)}`
        : c.tipo === 'agrupar' ? `agrupar por ${c.agrupar}`
          : `${campoDe(c.campo)?.nombre ?? c.campo}: ${c.tipo === 'lista' ? (c.valores?.join(', ') || 'todos') : c.texto ? `contiene «${c.texto}»` : 'sin buscar'}`;
      out.push(`- \`${c.id}\` ${que}`);
    }
  }
  for (const l of p.leidos) {
    out.push('');
    // Por la FORMA de lo leído (sin período = un elemento): un type guard sobre `l.c` no angosta `l`.
    if (!('desde' in l)) { const u = urlParaCanal((l.c as { url?: string }).url, !!p.http); out.push(`(\`${l.c.id}\`) ${nombreDeComponente(l.c)}${u ? ` · ${u}` : ''}`); continue; }
    if ('resultado' in l) {
      const g = l.c;
      out.push(`(\`${g.id}\`) ${tipoDe(g.tipo)?.nombre ?? g.tipo} · ${g.metricas.join(', ')}${g.dimension ? ` por ${g.dimension}` : ''}${g.desglose ? ` y ${g.desglose}` : ''}`);
      if (l.filtros.length) out.push(`Filtros: ${l.filtros.join(' · ')}`);
      if (l.noAplica.length) out.push(`No filtra por: ${l.noAplica.join(', ')}`);
      if (l.error || !l.resultado) out.push(`**${tituloDe(g)}**: no se pudo leer (${l.error ?? 'sin datos'}). No es un cero.`);
      else out.push(...resultadoMarkdown(g, l.resultado, { desde: l.desde, hasta: l.hasta, topeFilas: p.topeFilas, agrupar: l.agrupar }));
      continue;
    }
    const b = l.c as Bloque;
    out.push(`(\`${b.id}\`) **${tituloDe(b)}** · bloque \`${b.bloque}\` · ${rangoTexto(l.desde, l.hasta)}`);
    if (l.oculto) out.push('Los datos de los bloques no salen por la API (traen nombres de personas).');
    else if (l.error) out.push(`No se pudo leer (${l.error}). No es un cero.`);
    else out.push(...datosAMarkdown(l.datos));
  }
  if (p.link) out.push('', p.link);
  return out.join('\n');
}

