// =============================================================================
// Media Buyer — el MOTOR: de los números de la cuenta a las decisiones (PURO, sin red ni base)
// =============================================================================
// Lo que entra: el árbol de la cuenta (campañas, conjuntos y anuncios con su estado y su presupuesto), las
// señales por anuncio en tres ventanas (3, 7 y 14 días: gasto de Meta + leads, agendas, ventas y caja del
// CRM) y las decisiones de las últimas dos semanas. Lo que sale: propuestas, cada una con su porqué y la
// tabla de números que la disparó. No escribe nada; lanzarlas es de lib/media-buyer/ejecutar.ts.
//
// LAS TÁCTICAS SE COPIAN DE MADGICX (academy.madgicx.com/lessons/madgicx-automation-tactics, 25/10/2026):
//   · Surf        → subir el presupuesto de lo que rinde, con techo.
//   · Sunsetting  → bajar de a poco y apagar lo que no se recupera, mirando 3 y 7 días.
//   · Stop Loss   → pausar lo que gastó sin resultado.
//   · Revive      → prender lo que se apagó y DESPUÉS resultó bueno: la atribución llega tarde.
// Y dos que Madgicx no puede tener, porque salen del CRM de MaKo:
//   · Calidad     → un anuncio que trae leads que no agendan, aunque Meta los cuente bien.
//   · Ganador     → el anuncio que mejor convierte pide variaciones (lo que gana alimenta lo que se escribe).
//
// LOS NÚMEROS DE CADA TÁCTICA (los cambia una persona en código, con el porqué):
//   · 72 h sin tocar lo recién creado o recién cambiado (Madgicx: «Give new ad sets time to be properly
//     delivered»; Meta reacomoda la entrega después de un cambio grande).
//   · Un cambio de presupuesto por entidad y por día (Madgicx: «may trigger maximum once a day per ad set»).
//   · Subir: costo de 3 días ≤ 80% del objetivo, con 2 resultados o más y el presupuesto gastado (si no lo
//     gasta, subirlo no cambia nada). Se sube lo que permite el tope del negocio, nunca más de 20% de una vez
//     (un salto más grande reinicia el aprendizaje de Meta).
//   · Bajar: costo de 7 días ≥ 150% del objetivo con al menos dos objetivos gastados. Baja 20%.
//   · Apagar un conjunto: costo de 7 días ≥ 300% del objetivo (o sin resultados con 3 objetivos gastados).
//     Madgicx baja a 2,2× el promedio y apaga a 5×; acá el objetivo es una META (por debajo del promedio),
//     así que los múltiplos van más cerca.
//   · Stop loss de un anuncio: 2 objetivos gastados en 7 días, cero resultados y 3 días corriendo.
//   · Revive: lo que pausó MaKo hace más de 24 h y hoy, con el CRM al día, cuesta ≤ 110% del objetivo
//     (Madgicx: el Revive va 10-20% más holgado que el Stop Loss).
//   · Calidad: 8 leads o más del CRM en 14 días y ninguna agenda, cuando la cuenta agenda 15% o más.
//   · Ganador: 3 resultados o más en 7 días a ≤ el objetivo; una tanda de variaciones por anuncio por semana.
//   · Relevo (dentro de Ganador, 6/11/2026, lo prometido a la agencia de Thiago: «pausar el original cuando una variación le
//     gana»): con 7 días o más desde que salió la variación (la ventana de 7 días entera es posterior), la variación trajo 3
//     resultados o más a ≤ el objetivo y le gana al original por 20% o más en costo por resultado (o el original gastó un
//     objetivo entero sin resultados) → se propone pausar el ORIGINAL. Es la regla A/B de Madgicx «Creative testing»: el
//     ganador del test se queda con el presupuesto del conjunto. Revive NO prende lo que pausó el Relevo: el original sigue
//     dentro del objetivo por definición, y Revive lo volvería a prender al otro día.
//   · Hasta (la fecha de fin de la persona, zona.ts): pasada, se pausa la campaña; con menos de 3 días por delante, Surf
//     no sube y Revive no prende lo que ya terminó. La ZONA no se mira acá (pide leer el público de cada conjunto): la
//     filtra la corrida y la vuelve a mirar `lanzar` en vivo.
// =============================================================================

import type { TacticaAuto, TacticasResueltas } from './tacticas';
import { finDeCampana, frenoPorFecha, pausasPorFecha, propuestaHasta } from './zona';
import type {
  ConfigMediaBuyer, Decision, EstadoDecision, KpiMediaBuyer, NivelMeta, NumeroDecision, Propuesta, Tactica, TipoDecision,
} from './tipos';

export type NodoMB = {
  id: string;
  nombre: string;
  nivel: NivelMeta;
  parentId: string | null;
  /** El interruptor propio (Meta `configured_status` / `status`): ACTIVE, PAUSED, … */
  configurado: string | null;
  /** La entrega (Meta `effective_status`): ACTIVE, CAMPAIGN_PAUSED, IN_PROCESS, … */
  entrega: string;
  /** Presupuesto diario en la moneda de la CUENTA (lo que va a Meta). null si no tiene o es de por vida. */
  presupuestoDia: number | null;
  nivelPresupuesto: 'campaign' | 'adset' | null;
  creada: string | null;
  /** Meta lo RETUVO hasta que un admin lo apruebe (la «aprobación de pares», 2446984): no entrega. Sólo lo trae el token. */
  retenido?: boolean;
};

export type SenalMB = {
  adId: string;
  gasto: number;
  leadsMeta: number;
  leadsCrm: number;
  agendasMeta: number;
  agendasCrm: number;
  cierres: number;
  caja: number;
  impresiones: number;
  frecuencia: number | null;
  diasCorriendo: number;
  esVideo: boolean;
  miniatura: string | null;
};

export type DecisionPrevia = {
  tipo: TipoDecision;
  tactica: Tactica;
  nivel: NivelMeta;
  entidadId: string;
  estado: EstadoDecision;
  creada: string;
  aplicadaAt: string | null;
  origen: 'piloto' | 'persona' | null;
  /** Los anuncios que creó (variaciones o creativos subidos): el Relevo los compara con su original. */
  creados?: readonly string[];
  /** El anuncio del que salen (`anuncioBase.id`): el original de una variación, o el que se probó contra un creativo subido. */
  anuncioBaseId?: string | null;
};

/**
 * Lo que el motor necesita de una decisión guardada. UNA función para la corrida diaria y para el vigía (eran dos copias, y
 * la que no se actualiza deja al Relevo sin los anuncios que creó cada variación).
 */
export function previaDeDecision(d: Decision): DecisionPrevia {
  return {
    tipo: d.tipo, tactica: d.tactica, nivel: d.nivel, entidadId: d.entidadId, estado: d.estado,
    creada: d.creada, aplicadaAt: d.aplicadaAt, origen: d.origen,
    creados: d.creados ?? [], anuncioBaseId: d.anuncioBase?.id ?? null,
  };
}

export type EntradaMotor = {
  ahora: number;
  /**
   * Cada táctica con su estado, sus umbrales y lo que cubre (lib/media-buyer/tacticas.ts → resolverTacticas). Sin esto, todas
   * prendidas con los valores de siempre (las constantes de abajo).
   */
  tacticas?: TacticasResueltas;
  config: ConfigMediaBuyer;
  /** El objetivo ya resuelto (el del negocio, o el recomendado de `objetivoRecomendado`). */
  objetivo: number | null;
  arbol: NodoMB[];
  /** Señales por anuncio: últimos 3, 7 y 14 días (terminando ayer: el día de hoy no está cerrado). */
  corta: SenalMB[];
  larga: SenalMB[];
  crm: SenalMB[];
  historial: DecisionPrevia[];
  /** Un monto de la moneda de la cuenta → la unidad del gasto (dólares si convierte). */
  aUnidad: (montoCuenta: number) => number;
  /** Cómo se escribe un monto en la unidad del gasto («US$ 12»). */
  fmt: (unidad: number) => string;
  /** El presupuesto diario más chico que se propone, en la moneda de la cuenta (Meta rechaza por debajo). */
  presupuestoMinimo: number;
  /**
   * El día de HOY del negocio (su zona horaria), para la fecha de fin. null = no se pudo leer: con una fecha puesta, «no sé»
   * frena subir y prender (zona.ts → frenoPorFecha) y no pausa nada por fecha. Sin el campo, igual que null.
   */
  hoyNegocio?: string | null;
};

// ── Los números de las tácticas (ver la cabecera) ───────────────────────────
export const ENFRIAMIENTO_MS = 72 * 3600_000;
export const UN_DIA_MS = 24 * 3600_000;
export const SURF_COSTO_MAX = 0.8;
export const SURF_RESULTADOS_MIN = 2;
export const SURF_RITMO_MIN = 0.9;
export const SURF_SALTO_MAX_PCT = 20;
export const BAJAR_COSTO_MIN = 1.5;
export const BAJAR_GASTO_MIN = 2;
export const BAJAR_PCT = 20;
export const APAGAR_COSTO_MIN = 3;
export const APAGAR_GASTO_SIN_RESULTADOS = 3;
export const STOP_GASTO_MIN = 2;
export const STOP_DIAS_MIN = 3;
export const REVIVE_COSTO_MAX = 1.1;
export const CALIDAD_LEADS_MIN = 8;
export const CALIDAD_TASA_CUENTA_MIN = 0.15;
export const GANADOR_RESULTADOS_MIN = 3;
export const GANADOR_POR_CORRIDA = 2;
export const VARIACIONES_CADA_MS = 7 * UN_DIA_MS;
/** Relevo: días desde que salió la variación (7 = la ventana larga entera es posterior), sus resultados y cuánto le gana. */
export const RELEVO_DIAS_MIN = 7;
export const RELEVO_RESULTADOS_MIN = 3;
export const RELEVO_MARGEN_PCT = 20;

// ── Agregados ───────────────────────────────────────────────────────────────

export type Agregado = {
  gasto: number; leadsMeta: number; leadsCrm: number; agendasMeta: number; agendasCrm: number;
  cierres: number; caja: number; impresiones: number; anuncios: number;
};

const VACIO: Agregado = { gasto: 0, leadsMeta: 0, leadsCrm: 0, agendasMeta: 0, agendasCrm: 0, cierres: 0, caja: 0, impresiones: 0, anuncios: 0 };

function sumar(a: Agregado, s: SenalMB): Agregado {
  return {
    gasto: a.gasto + s.gasto, leadsMeta: a.leadsMeta + s.leadsMeta, leadsCrm: a.leadsCrm + s.leadsCrm,
    agendasMeta: a.agendasMeta + s.agendasMeta, agendasCrm: a.agendasCrm + s.agendasCrm,
    cierres: a.cierres + s.cierres, caja: a.caja + s.caja, impresiones: a.impresiones + s.impresiones, anuncios: a.anuncios + 1,
  };
}

/**
 * Cuántos RESULTADOS tiene algo, según el KPI del negocio.
 *
 * ⚠️ Lead y agenda toman el MAYOR entre lo que cuenta Meta y lo que tiene el CRM, no la suma: son la misma persona
 * vista desde dos lados, y sumarlos contaría doble. Se toma el mayor porque cada lado pierde lo suyo: Meta no ve el
 * lead que llegó por la landing sin el píxel, y el CRM no ve el lead de un formulario que todavía no entró.
 * La venta es SÓLO del CRM: Meta no sabe quién compró.
 */
export function resultados(a: Pick<Agregado, 'leadsMeta' | 'leadsCrm' | 'agendasMeta' | 'agendasCrm' | 'cierres'>, kpi: KpiMediaBuyer): number {
  if (kpi === 'venta') return a.cierres;
  if (kpi === 'agenda') return Math.max(a.agendasMeta, a.agendasCrm);
  return Math.max(a.leadsMeta, a.leadsCrm);
}

/**
 * Cómo se nombra el resultado en los textos. `un`, `ningun`, `ninguno`, `unSolo` y `cadaUno` llevan su GÉNERO (14/11/2026): con
 * «ningún ${uno}» escrito fijo salía «no trajo ningún agenda» y «9 agendas a US$ 31 cada uno». Lead es masculino; agenda y venta,
 * femeninos. Lo fija tests/media-buyer-textos-genero.test.ts.
 */
export const NOMBRE_RESULTADO: Record<KpiMediaBuyer, { uno: string; varios: string; costo: string; un: string; ningun: string; ninguno: string; unSolo: string; cadaUno: string }> = {
  lead: { uno: 'lead', varios: 'leads', costo: 'Costo por lead', un: 'un', ningun: 'ningún', ninguno: 'ninguno', unSolo: 'un solo', cadaUno: 'cada uno' },
  agenda: { uno: 'agenda', varios: 'agendas', costo: 'Costo por agenda', un: 'una', ningun: 'ninguna', ninguno: 'ninguna', unSolo: 'una sola', cadaUno: 'cada una' },
  venta: { uno: 'venta', varios: 'ventas', costo: 'Costo por venta', un: 'una', ningun: 'ninguna', ninguno: 'ninguna', unSolo: 'una sola', cadaUno: 'cada una' },
};

/** «de» + lo que se toca: «del conjunto», «de la campaña» (con `de ${que}` salía «Subir el presupuesto de el conjunto»). */
export const deLo = (que: string): string => (que.startsWith('el ') ? `del ${que.slice(3)}` : `de ${que}`);

const costo = (a: Agregado, kpi: KpiMediaBuyer): number | null => {
  const r = resultados(a, kpi);
  return r > 0 ? a.gasto / r : null;
};

/**
 * El objetivo que recomienda MaKo cuando el negocio no puso uno (el «let Madgicx recommend» del popup del KPI):
 * el costo por resultado de la cuenta entera en la ventana larga. null si no hubo resultados: sin eso no hay vara,
 * y las tácticas que la necesitan no corren.
 */
export function objetivoRecomendado(senales: SenalMB[], kpi: KpiMediaBuyer): number | null {
  const total = senales.reduce(sumar, VACIO);
  const c = costo(total, kpi);
  return c != null && c > 0 ? Math.round(c * 100) / 100 : null;
}

// ── Lo que dice cada fila ───────────────────────────────────────────────────

const pct = (x: number): string => `${Math.round(x * 100)}%`;
const hace = (ms: number): string => {
  const h = Math.floor(ms / 3600_000);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'hace 1 día' : `hace ${d} días`;
};

// ── El motor ────────────────────────────────────────────────────────────────

type Contexto = EntradaMotor & {
  porId: Map<string, NodoMB>;
  /** Los anuncios de cada conjunto y los conjuntos de cada campaña (del árbol). */
  hijos: Map<string, NodoMB[]>;
};

/** Los anuncios que cuelgan de un nodo (él mismo si es un anuncio). */
function anunciosDe(ctx: Contexto, n: NodoMB): string[] {
  if (n.nivel === 'ad') return [n.id];
  const out: string[] = [];
  for (const h of ctx.hijos.get(n.id) ?? []) out.push(...anunciosDe(ctx, h));
  return out;
}

function agregar(senales: SenalMB[], ids: string[]): Agregado {
  const set = new Set(ids);
  return senales.filter((s) => set.has(s.adId)).reduce(sumar, VACIO);
}

/**
 * ¿Está prendido de verdad? Su interruptor y los de arriba.
 * ⚠️ Un padre que NO está en el árbol es «no sé», y «no sé» es «no»: la lectura de Meta es tolerante (si la página
 * de campañas falla, vienen los conjuntos igual, `parcial: true`), y tratar al huérfano como prendido haría que el
 * motor suba el presupuesto de algo cuya campaña puede estar apagada.
 */
function prendido(ctx: Contexto, n: NodoMB): boolean {
  let x: NodoMB | undefined = n;
  while (x) {
    if (x.configurado !== 'ACTIVE') return false;
    if (!x.parentId) return true;
    x = ctx.porId.get(x.parentId);
  }
  return false;
}

const campanaDe = (ctx: Contexto, n: NodoMB): NodoMB | null => {
  let x: NodoMB | undefined = n;
  while (x && x.nivel !== 'campaign') x = x.parentId ? ctx.porId.get(x.parentId) : undefined;
  return x ?? null;
};

/** Lo último que se le hizo a una entidad (aplicado), para el enfriamiento y el Revive. */
function ultimaAplicada(ctx: Contexto, id: string, tipos?: TipoDecision[]): DecisionPrevia | null {
  let mejor: DecisionPrevia | null = null;
  for (const d of ctx.historial) {
    if (d.entidadId !== id || d.estado !== 'aplicada' || !d.aplicadaAt) continue;
    if (tipos && !tipos.includes(d.tipo)) continue;
    if (!mejor || d.aplicadaAt > (mejor.aplicadaAt ?? '')) mejor = d;
  }
  return mejor;
}

/** ¿Es muy nueva o se tocó hace poco? Entonces no se le cambia el presupuesto ni el estado. */
function enfriando(ctx: Contexto, n: NodoMB): { motivo: string } | null {
  if (n.creada) {
    const edad = ctx.ahora - Date.parse(n.creada);
    if (Number.isFinite(edad) && edad < ENFRIAMIENTO_MS) return { motivo: `creada ${hace(edad)}` };
  }
  const u = ultimaAplicada(ctx, n.id);
  if (u?.aplicadaAt) {
    const edad = ctx.ahora - Date.parse(u.aplicadaAt);
    const ventana = u.tipo === 'subir_presupuesto' || u.tipo === 'bajar_presupuesto' ? UN_DIA_MS : ENFRIAMIENTO_MS;
    if (edad < ventana) return { motivo: `MaKo la cambió ${hace(edad)}` };
  }
  return null;
}

const redondear = (x: number): number => Math.round(x * 100) / 100;

/** Las decisiones que crean anuncios para probar contra un original: variaciones, o creativos subidos contra un anuncio. */
const PRUEBAN_CONTRA_UN_ORIGINAL: ReadonlySet<TipoDecision> = new Set<TipoDecision>(['variaciones_texto', 'variaciones_hook', 'crear_anuncios']);

/**
 * El RELEVO: las variaciones (o los creativos subidos contra un anuncio) que ya le ganaron a su original, con la propuesta de
 * pausar el original. Una por original como mucho (la mejor variación), y nunca:
 *   · antes de `dias` desde que salieron (la ventana de 7 días tiene que ser toda posterior: si no, se compara el original de
 *     una semana entera contra una variación de dos días);
 *   · si la variación no está prendida (pausar el original dejaría el conjunto sin nada que entregue) o no está en el árbol;
 *   · si la variación no tiene `resultadosMin` resultados o su costo pasa el objetivo (tiene que ser buena, no menos mala);
 *   · si una persona (o MaKo) ya decidió el relevo de ESE lanzamiento: aplicado, deshecho o descartado. Volver a proponerlo
 *     cada mañana sobre un «no» sería insistirle a la persona.
 * Puro: `ctx` es el del motor.
 */
function relevos(ctx: Contexto, o: {
  obj: number; kpi: KpiMediaBuyer; hoy: string; dias: number; resultadosMin: number; margenPct: number; cubre: (n: NodoMB) => boolean;
}): Propuesta[] {
  const nom = NOMBRE_RESULTADO[o.kpi];
  const porOriginal = new Map<string, { p: Propuesta; k: number; r: number }>();
  for (const d of ctx.historial) {
    if (!PRUEBAN_CONTRA_UN_ORIGINAL.has(d.tipo) || d.estado !== 'aplicada' || !d.aplicadaAt) continue;
    const originalId = d.anuncioBaseId ?? (d.tipo === 'crear_anuncios' ? null : d.entidadId);
    const creados = (d.creados ?? []).filter((id) => id && id !== originalId);
    if (!originalId || !creados.length) continue;
    const edad = ctx.ahora - Date.parse(d.aplicadaAt);
    if (!(edad >= o.dias * UN_DIA_MS)) continue;
    const original = ctx.porId.get(originalId);
    if (!original || original.nivel !== 'ad' || !prendido(ctx, original) || !o.cubre(original)) continue;
    const yaDecidido = ctx.historial.some((x) => x.tipo === 'pausar' && x.tactica === 'ganador' && x.entidadId === originalId
      && (x.estado === 'aplicada' || x.estado === 'deshecha' || x.estado === 'descartada') && x.creada >= d.aplicadaAt!);
    if (yaDecidido) continue;
    const so = ctx.larga.find((x) => x.adId === originalId);
    if (!so) continue;
    const ro = resultados(so, o.kpi);
    const ko = ro > 0 ? so.gasto / ro : null;
    let mejor: { ad: NodoMB; s: SenalMB; r: number; k: number } | null = null;
    for (const id of creados) {
      const v = ctx.porId.get(id);
      if (!v || v.nivel !== 'ad' || !prendido(ctx, v)) continue;
      const sv = ctx.larga.find((x) => x.adId === id);
      if (!sv) continue;
      const rv = resultados(sv, o.kpi);
      if (rv < o.resultadosMin) continue;
      const kv = sv.gasto / rv;
      if (!(kv <= o.obj)) continue;
      const gana = ko == null ? so.gasto >= o.obj : kv <= ko * (1 - o.margenPct / 100);
      if (!gana) continue;
      if (!mejor || kv < mejor.k || (kv === mejor.k && rv > mejor.r)) mejor = { ad: v, s: sv, r: rv, k: kv };
    }
    if (!mejor) continue;
    const previo = porOriginal.get(originalId);
    if (previo && (previo.k < mejor.k || (previo.k === mejor.k && previo.r >= mejor.r))) continue;
    const camp = campanaDe(ctx, original);
    const dias = Math.floor(edad / UN_DIA_MS);
    const leGana = ko == null ? `el original gastó ${ctx.fmt(so.gasto)} sin ${nom.ningun} ${nom.uno}` : `le gana por ${pct(1 - mejor.k / ko)}`;
    porOriginal.set(originalId, {
      k: mejor.k, r: mejor.r,
      p: {
        clave: `ganador-relevo:ad:${originalId}:${o.hoy}`, tipo: 'pausar', tactica: 'ganador', nivel: 'ad',
        entidadId: originalId, entidadNombre: original.nombre, campanaNombre: camp?.nombre ?? null,
        titulo: `Pausar el original «${original.nombre}»: su variación «${mejor.ad.nombre}» le gana`,
        titular: `«${mejor.ad.nombre}» trae ${nom.varios} a ${ctx.fmt(mejor.k)}${ko == null ? ', y el original ninguno' : `; el original, a ${ctx.fmt(ko)}`}`,
        porque: [
          `En los últimos 7 días la variación trajo ${mejor.r} ${mejor.r === 1 ? nom.uno : nom.varios} a ${ctx.fmt(mejor.k)} ${nom.cadaUno}: ${leGana}.`,
          'Pausar el original deja el presupuesto del conjunto para la variación, que ya demostró que convierte mejor.',
          'Se deshace con un botón, y MaKo no lo vuelve a prender solo.',
        ],
        numeros: [
          { condicion: `${nom.costo} del original, últimos 7 días`, valor: ko == null ? `sin ${nom.varios}` : ctx.fmt(ko), porQue: `Gastó ${ctx.fmt(so.gasto)} con ${ro} ${ro === 1 ? nom.uno : nom.varios}` },
          { condicion: `${nom.costo} de «${mejor.ad.nombre}»`, valor: ctx.fmt(mejor.k), porQue: ko == null ? `Dentro de tu objetivo (${ctx.fmt(o.obj)})` : `${pct(1 - mejor.k / ko)} más barato (le gana desde ${o.margenPct}%)` },
          { condicion: `${nom.varios[0].toUpperCase()}${nom.varios.slice(1)} de la variación, últimos 7 días`, valor: String(mejor.r), porQue: `Con ${o.resultadosMin} o más ya no es suerte` },
          { condicion: 'Desde que salió la variación', valor: dias === 1 ? '1 día' : `${dias} días`, porQue: `Con ${o.dias} o más, los dos se miden en la misma semana` },
        ],
        antes: { estado: 'ACTIVE' }, despues: { estado: 'PAUSED' },
      },
    });
  }
  return [...porOriginal.values()].map((x) => x.p);
}

/**
 * Las propuestas del día. Una por entidad como mucho (la de mayor prioridad: apagar > bajar > subir), más las
 * de variaciones, que van sobre anuncios y no compiten con el presupuesto.
 */
export function proponer(entrada: EntradaMotor, hoy: string): Propuesta[] {
  const porId = new Map(entrada.arbol.map((n) => [n.id, n] as const));
  const hijos = new Map<string, NodoMB[]>();
  for (const n of entrada.arbol) {
    if (!n.parentId) continue;
    const l = hijos.get(n.parentId) ?? [];
    l.push(n);
    hijos.set(n.parentId, l);
  }
  const ctx: Contexto = { ...entrada, porId, hijos };
  const { config } = entrada;
  if (!config.encendido) return [];
  // Cada táctica, con lo suyo (tacticas.ts): apagada no mira nada; sus umbrales; y si cubre sólo algunas campañas.
  const T = entrada.tacticas;
  const on = (t: TacticaAuto): boolean => (T ? T[t].estado !== 'apagada' : true);
  const par = (t: TacticaAuto, id: string, def: number): number => T?.[t].p[id] ?? def;
  const cubre = (t: TacticaAuto, n: NodoMB): boolean => {
    const c = T?.[t].campanas;
    if (!c) return true;
    const camp = n.nivel === 'campaign' ? n : campanaDe(ctx, n);
    return !!camp && c.has(camp.id);
  };

  const kpi = config.kpi;
  const nom = NOMBRE_RESULTADO[kpi];
  const obj = entrada.objetivo;
  const out: Propuesta[] = [];
  const tomadas = new Set<string>();
  const poner = (p: Propuesta) => {
    if (tomadas.has(p.entidadId) && !p.tipo.startsWith('variaciones')) return;
    if (!p.tipo.startsWith('variaciones')) tomadas.add(p.entidadId);
    out.push(p);
  };
  // La fecha de fin de lo que cuelga de `n` (la de su campaña, o la de toda la cuenta).
  const hoyN = entrada.hoyNegocio ?? null;
  const finDe = (n: NodoMB): string | null => finDeCampana(config, (n.nivel === 'campaign' ? n : campanaDe(ctx, n))?.id ?? null);

  // ── 0. Hasta: lo que pasó su fecha de fin se pausa PRIMERO (es la regla de la persona, gana a todo lo demás) ──
  for (const p of pausasPorFecha(entrada.arbol, config, hoyN)) poner(propuestaHasta(p));
  const clave = (t: Tactica, n: NodoMB) => `${t}:${n.nivel}:${n.id}:${hoy}`;
  const filaObjetivo = (c: number | null, ventana: string): NumeroDecision => ({
    condicion: `${nom.costo}, ${ventana}`,
    valor: c == null ? `sin ${nom.varios}` : entrada.fmt(c),
    porQue: obj == null ? 'No hay objetivo todavía'
      : c == null ? `Tu objetivo es ${entrada.fmt(obj)}`
        : c <= obj ? `Tu objetivo es ${entrada.fmt(obj)}: está ${pct(1 - c / obj)} por debajo`
          : `Tu objetivo es ${entrada.fmt(obj)}: está ${pct(c / obj - 1)} por encima`,
  });

  // ── 1. Stop Loss: anuncios que gastaron sin resultado ─────────────────────
  if (obj != null && on('stop_loss')) {
    const gastoVeces = par('stop_loss', 'gastoVeces', STOP_GASTO_MIN);
    const diasMin = par('stop_loss', 'dias', STOP_DIAS_MIN);
    for (const ad of entrada.arbol.filter((n) => n.nivel === 'ad')) {
      if (!prendido(ctx, ad) || enfriando(ctx, ad) || !cubre('stop_loss', ad)) continue;
      const s = entrada.larga.find((x) => x.adId === ad.id);
      if (!s) continue;
      const r = resultados(s, kpi);
      if (r > 0 || s.gasto < obj * gastoVeces || s.diasCorriendo < diasMin) continue;
      const camp = campanaDe(ctx, ad);
      poner({
        clave: clave('stop_loss', ad), tipo: 'pausar', tactica: 'stop_loss', nivel: 'ad',
        entidadId: ad.id, entidadNombre: ad.nombre, campanaNombre: camp?.nombre ?? null,
        titulo: `Pausar el anuncio «${ad.nombre}»: gastó sin traer ${nom.varios}`,
        titular: `Gastó ${entrada.fmt(s.gasto)} en 7 días sin ${nom.unSolo} ${nom.uno}`,
        porque: [
          `Este anuncio lleva ${s.diasCorriendo} días gastando y no trajo ${nom.ningun} ${nom.uno}.`,
          `Ya gastó ${pct(s.gasto / obj)} de lo que te cuesta ${nom.un} ${nom.uno} en promedio.`,
          'Pausarlo libera ese gasto para los anuncios que sí convierten. Si después aparecen resultados tardíos, MaKo lo vuelve a prender.',
        ],
        numeros: [
          { condicion: 'Gasto, últimos 7 días', valor: entrada.fmt(s.gasto), porQue: `Más de ${gastoVeces} veces tu objetivo` },
          { condicion: `${nom.varios[0].toUpperCase()}${nom.varios.slice(1)}, últimos 7 días`, valor: '0', porQue: 'Ni uno' },
          { condicion: 'Días corriendo', valor: String(s.diasCorriendo), porQue: `Con ${diasMin} o más ya tuvo su oportunidad` },
        ],
        antes: { estado: 'ACTIVE' }, despues: { estado: 'PAUSED' },
      });
    }
  }

  // ── 2. Calidad (MaKo): leads que no agendan ──────────────────────────────
  if (kpi !== 'lead' && on('calidad')) {
    const cuenta = entrada.crm.reduce(sumar, VACIO);
    const tasaCuenta = cuenta.leadsCrm > 0 ? Math.max(cuenta.agendasMeta, cuenta.agendasCrm) / cuenta.leadsCrm : 0;
    const leadsMin = par('calidad', 'leads', CALIDAD_LEADS_MIN);
    if (tasaCuenta >= par('calidad', 'tasaCuentaPct', CALIDAD_TASA_CUENTA_MIN * 100) / 100) {
      for (const ad of entrada.arbol.filter((n) => n.nivel === 'ad')) {
        if (!prendido(ctx, ad) || enfriando(ctx, ad) || !cubre('calidad', ad)) continue;
        const s = entrada.crm.find((x) => x.adId === ad.id);
        if (!s || s.leadsCrm < leadsMin || Math.max(s.agendasMeta, s.agendasCrm) > 0) continue;
        const camp = campanaDe(ctx, ad);
        poner({
          clave: clave('calidad', ad), tipo: 'pausar', tactica: 'calidad', nivel: 'ad',
          entidadId: ad.id, entidadNombre: ad.nombre, campanaNombre: camp?.nombre ?? null,
          titulo: `Pausar «${ad.nombre}»: trae leads que no agendan`,
          titular: `${s.leadsCrm} leads en tu CRM y ninguno agendó`,
          porque: [
            `Meta cuenta estos leads como buenos, pero en tu CRM ninguno de los ${s.leadsCrm} llegó a agendar.`,
            `El resto de tu cuenta agenda ${pct(tasaCuenta)} de sus leads: el problema es este anuncio, no tu equipo.`,
            'Esto sólo lo puede ver MaKo, porque cruza el anuncio con lo que pasó después en tu CRM.',
          ],
          numeros: [
            { condicion: 'Leads en el CRM, últimos 14 días', valor: String(s.leadsCrm), porQue: `Con ${leadsMin} o más la muestra alcanza` },
            { condicion: 'Agendas de esos leads', valor: '0', porQue: 'Ninguno avanzó' },
            { condicion: 'Agenda de toda la cuenta', valor: pct(tasaCuenta), porQue: 'Tu cuenta sí agenda: es el anuncio' },
          ],
          antes: { estado: 'ACTIVE' }, despues: { estado: 'PAUSED' },
        });
      }
    }
  }

  // ── 3. Sunsetting y Surf: la unidad que tiene el presupuesto ──────────────
  // En CBO el presupuesto es de la campaña; en ABO, de cada conjunto. Un conjunto de una campaña CBO no se
  // sube ni se baja: se apaga si es muy malo (Sunsetting final).
  if (obj != null && (on('sunsetting') || on('surf'))) {
    const bajarVeces = par('sunsetting', 'bajarVeces', BAJAR_COSTO_MIN);
    const bajarPct = par('sunsetting', 'bajarPct', BAJAR_PCT);
    const apagarVeces = par('sunsetting', 'apagarVeces', APAGAR_COSTO_MIN);
    const surfCosto = par('surf', 'costoPct', SURF_COSTO_MAX * 100) / 100;
    const surfResultados = par('surf', 'resultados', SURF_RESULTADOS_MIN);
    const surfSalto = par('surf', 'subidaPct', SURF_SALTO_MAX_PCT);
    const conPresupuesto = entrada.arbol.filter((n) =>
      (n.nivel === 'campaign' && n.nivelPresupuesto === 'campaign') || (n.nivel === 'adset' && n.nivelPresupuesto !== 'campaign'));
    for (const n of conPresupuesto) {
      if (!prendido(ctx, n) || n.presupuestoDia == null || n.presupuestoDia <= 0) continue;
      const frio = enfriando(ctx, n);
      if (frio) continue;
      const ads = anunciosDe(ctx, n);
      const c3 = agregar(entrada.corta, ads);
      const c7 = agregar(entrada.larga, ads);
      const r3 = resultados(c3, kpi);
      const r7 = resultados(c7, kpi);
      const k3 = costo(c3, kpi);
      const k7 = costo(c7, kpi);
      const presuUnidad = entrada.aUnidad(n.presupuestoDia);
      const camp = campanaDe(ctx, n);
      const que = n.nivel === 'campaign' ? 'la campaña' : 'el conjunto';
      const ultimoCambio = ultimaAplicada(ctx, n.id);
      const filaCambio: NumeroDecision = {
        condicion: 'Último cambio de MaKo',
        valor: ultimoCambio?.aplicadaAt ? hace(entrada.ahora - Date.parse(ultimoCambio.aplicadaAt)) : 'nunca',
        porQue: 'Un cambio por día como mucho: Meta necesita tiempo para reacomodar la entrega',
      };

      const ponerSunset = on('sunsetting') && cubre('sunsetting', n);
      // Sunsetting final: apagar
      const apagar = ponerSunset && ((k7 != null && k7 >= obj * apagarVeces && c7.gasto >= obj * BAJAR_GASTO_MIN)
        || (r7 === 0 && c7.gasto >= obj * APAGAR_GASTO_SIN_RESULTADOS));
      if (apagar) {
        poner({
          clave: clave('sunsetting', n), tipo: 'pausar', tactica: 'sunsetting', nivel: n.nivel,
          entidadId: n.id, entidadNombre: n.nombre, campanaNombre: n.nivel === 'campaign' ? null : camp?.nombre ?? null,
          titulo: `Pausar ${que} «${n.nombre}»: no se recupera`,
          titular: k7 == null
            ? `Gastó ${entrada.fmt(c7.gasto)} en 7 días sin ${nom.varios}`
            : `Cada ${nom.uno} te costó ${entrada.fmt(k7)}, ${pct(k7 / obj - 1)} más que tu objetivo`,
          porque: [
            k7 == null ? `En 7 días gastó ${pct(c7.gasto / obj)} de tu objetivo y no trajo ${nom.ningun} ${nom.uno}.`
              : `En 7 días cada ${nom.uno} costó ${(k7 / obj).toFixed(1)} veces tu objetivo.`,
            'Bajarle el presupuesto ya no alcanza: lo que gasta aquí rinde más en otro lado.',
            'Pausarlo se deshace con un botón si cambias de idea.',
          ],
          numeros: [
            filaObjetivo(k7, 'últimos 7 días'),
            { condicion: 'Gasto, últimos 7 días', valor: entrada.fmt(c7.gasto), porQue: 'Ya tuvo con qué demostrar' },
            { condicion: `${nom.varios[0].toUpperCase()}${nom.varios.slice(1)}, últimos 7 días`, valor: String(r7), porQue: r7 === 0 ? 'Ninguno' : 'Muy caros' },
          ],
          antes: { estado: 'ACTIVE' }, despues: { estado: 'PAUSED' },
        });
        continue;
      }

      // Sunsetting: bajar
      if (ponerSunset && (k7 != null ? (k7 >= obj * bajarVeces && c7.gasto >= obj * BAJAR_GASTO_MIN) : (c7.gasto >= obj * BAJAR_GASTO_MIN))) {
        const nuevo = Math.max(entrada.presupuestoMinimo, redondear(n.presupuestoDia * (1 - bajarPct / 100)));
        if (nuevo < n.presupuestoDia) {
          poner({
            clave: clave('sunsetting', n), tipo: 'bajar_presupuesto', tactica: 'sunsetting', nivel: n.nivel,
            entidadId: n.id, entidadNombre: n.nombre, campanaNombre: n.nivel === 'campaign' ? null : camp?.nombre ?? null,
            titulo: `Bajar el presupuesto ${deLo(que)} «${n.nombre}»`,
            titular: k7 == null ? `${entrada.fmt(c7.gasto)} en 7 días sin ${nom.varios}` : `Cada ${nom.uno} te está costando ${entrada.fmt(k7)}`,
            porque: [
              k7 == null ? `En 7 días no trajo ${nom.varios} y ya gastó ${pct(c7.gasto / obj)} de tu objetivo.`
                : `Su costo por ${nom.uno} está ${pct(k7 / obj - 1)} por encima de tu objetivo.`,
              `Se baja ${bajarPct}% y no de golpe: si se recupera, vuelve a subir; si no, MaKo lo apaga.`,
            ],
            numeros: [
              filaObjetivo(k7, 'últimos 7 días'),
              { condicion: 'Gasto, últimos 7 días', valor: entrada.fmt(c7.gasto), porQue: `Más de ${BAJAR_GASTO_MIN} veces tu objetivo: no es ruido` },
              filaCambio,
            ],
            antes: { presupuesto: n.presupuestoDia }, despues: { presupuesto: nuevo },
          });
          continue;
        }
      }

      // Surf: subir. Nunca cerca de la fecha de fin (ni pasada): el salto se gastaría antes de rendir.
      const ritmo = c3.gasto / Math.max(presuUnidad * 3, 0.01);
      if (on('surf') && cubre('surf', n) && !frenoPorFecha('subir_presupuesto', finDe(n), hoyN) && k3 != null && k3 <= obj * surfCosto && r3 >= surfResultados && ritmo >= SURF_RITMO_MIN) {
        const saltoPct = Math.min(config.subidaMaxPctDia, surfSalto);
        if (saltoPct <= 0) continue;
        const nuevo = redondear(n.presupuestoDia * (1 + saltoPct / 100));
        poner({
          clave: clave('surf', n), tipo: 'subir_presupuesto', tactica: 'surf', nivel: n.nivel,
          entidadId: n.id, entidadNombre: n.nombre, campanaNombre: n.nivel === 'campaign' ? null : camp?.nombre ?? null,
          titulo: `Subir el presupuesto ${deLo(que)} «${n.nombre}»`,
          titular: `Trae ${nom.varios} a ${entrada.fmt(k3)}, ${pct(1 - k3 / obj)} por debajo de tu objetivo`,
          porque: [
            `En los últimos 3 días trajo ${r3} ${r3 === 1 ? nom.uno : nom.varios} a ${entrada.fmt(k3)} ${nom.cadaUno}.`,
            `Gasta todo su presupuesto (${pct(ritmo)}): hoy lo que lo frena es el presupuesto, no el anuncio.`,
            `Se sube ${saltoPct}%: un salto más grande reinicia el aprendizaje de Meta.`,
          ],
          numeros: [
            filaObjetivo(k3, 'últimos 3 días'),
            { condicion: `${nom.varios[0].toUpperCase()}${nom.varios.slice(1)}, últimos 3 días`, valor: String(r3), porQue: `Con ${surfResultados} o más ya no es suerte` },
            { condicion: 'Gastó su presupuesto', valor: pct(ritmo), porQue: 'Si no lo gastara, subirlo no cambiaría nada' },
            filaCambio,
          ],
          antes: { presupuesto: n.presupuestoDia }, despues: { presupuesto: nuevo },
        });
      }
    }
  }

  // ── 4. Revive: lo que pausó MaKo y resultó bueno ──────────────────────────
  if (obj != null && on('revive')) {
    const reviveCosto = par('revive', 'costoVeces', REVIVE_COSTO_MAX);
    for (const d of entrada.historial) {
      if (d.tipo !== 'pausar' || d.estado !== 'aplicada' || !d.aplicadaAt) continue;
      const n = porId.get(d.entidadId);
      if (!n || n.configurado !== 'PAUSED' || !cubre('revive', n)) continue;
      // Lo que pausó la fecha de fin no lo revive nadie, y lo que ya pasó su fecha tampoco se prende. Lo que pausó el Relevo
      // (táctica `ganador`) tampoco: lo reemplazó una variación que le gana, y el original sigue dentro del objetivo por
      // definición, así que Revive lo volvería a prender al otro día.
      if (d.tactica === 'hasta' || d.tactica === 'ganador' || frenoPorFecha('activar', finDe(n), hoyN)) continue;
      // Que nadie la haya vuelto a tocar después (una persona la pausó también, o la prendió y la volvió a pausar).
      const ultima = ultimaAplicada(ctx, n.id);
      if (ultima && ultima.aplicadaAt !== d.aplicadaAt) continue;
      const edad = entrada.ahora - Date.parse(d.aplicadaAt);
      if (!(edad >= UN_DIA_MS)) continue;
      const c = agregar(entrada.crm, anunciosDe(ctx, n));
      const k = costo(c, kpi);
      if (k == null || k > obj * reviveCosto) continue;
      const camp = campanaDe(ctx, n);
      const que = n.nivel === 'campaign' ? 'la campaña' : n.nivel === 'adset' ? 'el conjunto' : 'el anuncio';
      poner({
        clave: clave('revive', n), tipo: 'activar', tactica: 'revive', nivel: n.nivel,
        entidadId: n.id, entidadNombre: n.nombre, campanaNombre: n.nivel === 'campaign' ? null : camp?.nombre ?? null,
        titulo: `Volver a prender ${que} «${n.nombre}»`,
        titular: `Con los resultados que llegaron tarde, cuesta ${entrada.fmt(k)} por ${nom.uno}`,
        porque: [
          `MaKo lo pausó ${hace(edad)}, pero después llegaron ${nom.varios} atribuidos a él.`,
          `Con eso su costo por ${nom.uno} quedó en ${entrada.fmt(k)}, dentro de tu objetivo.`,
          'Los resultados tardan en llegar: por eso MaKo vuelve a mirar todo lo que pausó.',
        ],
        numeros: [
          filaObjetivo(k, 'últimos 14 días'),
          { condicion: `${nom.varios[0].toUpperCase()}${nom.varios.slice(1)}, últimos 14 días`, valor: String(resultados(c, kpi)), porQue: 'Contando los que entraron después de pausarlo' },
          { condicion: 'Pausado por MaKo', valor: hace(edad), porQue: 'Más de un día: ya llegaron los resultados demorados' },
        ],
        antes: { estado: 'PAUSED' }, despues: { estado: 'ACTIVE' },
      });
    }
  }

  // ── 5. Relevo (dentro de Ganador): la variación le ganó a su original → pausar el original ───────────
  if (obj != null && on('ganador')) {
    for (const p of relevos(ctx, {
      obj, kpi, hoy,
      dias: par('ganador', 'relevoDias', RELEVO_DIAS_MIN),
      resultadosMin: par('ganador', 'relevoResultados', RELEVO_RESULTADOS_MIN),
      margenPct: par('ganador', 'relevoMargenPct', RELEVO_MARGEN_PCT),
      cubre: (n) => cubre('ganador', n),
    })) poner(p);
  }

  // ── 6. Ganador: variaciones de lo que mejor convierte ─────────────────────
  if (obj != null && on('ganador')) {
    const ganadorMin = par('ganador', 'resultados', GANADOR_RESULTADOS_MIN);
    const candidatos: Array<{ ad: NodoMB; s: SenalMB; r: number; k: number }> = [];
    for (const ad of entrada.arbol.filter((n) => n.nivel === 'ad')) {
      // Lo que hoy se propone pausar (el Relevo, un Stop Loss) no pide variaciones nuevas el mismo día.
      if (!prendido(ctx, ad) || !cubre('ganador', ad) || tomadas.has(ad.id)) continue;
      const s = entrada.larga.find((x) => x.adId === ad.id);
      if (!s) continue;
      const r = resultados(s, kpi);
      const k = r > 0 ? s.gasto / r : null;
      if (r < ganadorMin || k == null || k > obj) continue;
      const reciente = entrada.historial.some((d) => d.entidadId === ad.id && d.tactica === 'ganador'
        && entrada.ahora - Date.parse(d.creada) < VARIACIONES_CADA_MS && d.estado !== 'vencida');
      if (reciente) continue;
      candidatos.push({ ad, s, r, k });
    }
    candidatos.sort((a, b) => b.r - a.r || a.k - b.k);
    for (const { ad, s, r, k } of candidatos.slice(0, GANADOR_POR_CORRIDA)) {
      const camp = campanaDe(ctx, ad);
      const fatiga = s.frecuencia != null && s.frecuencia >= 3;
      const tipo: TipoDecision = s.esVideo ? 'variaciones_hook' : 'variaciones_texto';
      poner({
        clave: clave('ganador', ad), tipo, tactica: 'ganador', nivel: 'ad',
        entidadId: ad.id, entidadNombre: ad.nombre, campanaNombre: camp?.nombre ?? null,
        titulo: s.esVideo ? `Nuevos hooks para el ganador «${ad.nombre}»` : `Variaciones de texto del ganador «${ad.nombre}»`,
        titular: `Tu mejor anuncio: ${r} ${nom.varios} a ${entrada.fmt(k)}`,
        porque: [
          `Es el que más ${nom.varios} trajo en 7 días, y ${nom.cadaUno} costó menos que tu objetivo.`,
          fatiga ? `Su frecuencia ya es ${s.frecuencia!.toFixed(1)}: la misma gente lo vio varias veces y se va a cansar.`
            : 'Un ganador se cansa: probar variaciones antes de que caiga mantiene el costo bajo.',
          s.esVideo ? 'MaKo escribe hooks nuevos para el mismo video; los que elijas salen como anuncios nuevos en el mismo conjunto.'
            : 'MaKo escribe variaciones con lo que ya funciona; las que elijas salen como anuncios nuevos en el mismo conjunto.',
        ],
        numeros: [
          filaObjetivo(k, 'últimos 7 días'),
          { condicion: `${nom.varios[0].toUpperCase()}${nom.varios.slice(1)}, últimos 7 días`, valor: String(r), porQue: `El que más trajo (${ganadorMin} o más)` },
          { condicion: 'Frecuencia', valor: s.frecuencia != null ? s.frecuencia.toFixed(1) : '—', porQue: fatiga ? 'Desde 3, la gente se cansa del anuncio' : 'Todavía no cansa' },
        ],
        antes: {}, despues: {},
        anuncioBase: { id: ad.id, esVideo: s.esVideo, miniatura: s.miniatura },
      });
    }
  }

  return out;
}
