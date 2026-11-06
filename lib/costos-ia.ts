import 'server-only';

// =============================================================================
// costos-ia — el gasto de IA agregado por PERÍODO, sin el truncado silencioso
// =============================================================================
// Existe aparte de `lib/anthropic-usage.ts` por dos motivos, y ninguno es estilo:
//
// 1. Aquél lee con `.limit(20000)`, que **no sube el techo de 1000 filas de
//    PostgREST** — el propio repo lo tiene documentado en docs/hallazgos-infra.md.
//    Como ordena por `created_at DESC`, lo que se pierde son las filas VIEJAS: el
//    gasto subestima y el saldo restante sobreestima. Agosto 2026 ya tenía 997
//    filas no-Anthropic contra un techo de 1000. Acá se pagina con `leerTodo`.
//
// 2. Aquél está atado a "el mes en curso" y a la ventana del saldo cargado. Para
//    responder «¿cuánto se gastó en julio?» hace falta un período explícito, que
//    es lo que pidió el dueño: «Sería bueno que incluyas un filtro de fecha y
//    poder ver el gasto de otros meses también» (08/08/2026).
//
// ⚠️ EL CORTE POR WORKSPACE (`porWorkspace`) Y DE QUIÉN ES CADA FILA. Lo decide quien la
// escribe (`wsDeLaFila`, lib/anthropic-usage.ts):
//   · lo pagado con la clave de un negocio, o con una IA suya, va a ESE negocio;
//   · Claude con la clave de MaKo pedido por un negocio va a la PLATAFORMA (`wsSuperAdmin`)
//     desde el 17/10/2026: ahí no se sabe de qué negocio fue, y no se reparte. Lo del ws1
//     queda en el ws1.
// Antes del 17/10 toda fila de Claude con la clave de MaKo iba al workspace 1, venga de
// donde venga: en esos meses el workspace de las filas de Claude era una CONSTANTE, no una
// medición. Admin › Customers › Cost Drivers reparte por negocio sólo desde el 1/11/2026
// (`REPARTO_DESDE`, app/admin/_polar/datos/clientes.ts) y dice aparte lo de la plataforma
// y lo de antes. El análisis viejo está en docs/costos-ia-y-planes.md.
//
// ⚠️ LOS MESES CON DATOS SE PIDEN APARTE (6/11/2026, punto 33 de la revisión de Admin):
// `resumenDelPeriodo` no los lee salvo `{ conMeses: true }`. Leían la tabla ENTERA en cada
// entrada a Customers (que no los usa) y dos veces en Costs. `mesesConDatos` pregunta mes
// por mes si hay alguna fila (una consulta chica por mes, sobre el índice de `created_at`).

import { getSupabaseServer } from '@/lib/supabase';
import { leerTodo } from '@/lib/supabase-paginado';
import { esDeLaClaveDelNegocio, esDelCreditoDeLaPlataforma } from '@/lib/veto-claude';

/** Proveedores que no cobran dinero (free tier por rate-limit). Espeja
 *  PROVEEDORES_GRATIS de anthropic-usage.ts, que es quien guarda el costo en 0. */
const GRATIS = ['groq', 'gemini', 'cerebras', 'mistral', 'openrouter'];

export type FilaUso = {
  created_at: string;
  feature: string | null;
  motivo: string | null;
  model: string | null;
  provider: string | null;
  cost_usd: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  workspace_id: number | null;
};

export type Corte = { clave: string; llamadas: number; tokens: number; costUsd: number };

export type ResumenPeriodo = {
  /** 'YYYY-MM', o 'todo' cuando no se filtra. */
  periodo: string;
  desde: string | null;
  hasta: string | null;
  llamadas: number;
  tokens: number;
  costUsd: number;
  /** Cuántas filas se leyeron de verdad. Si esto es 1000 exacto en el módulo
   *  viejo, era truncado; acá es el total real y sirve para comprobarlo. */
  filas: number;
  porFeature: Corte[];
  porProveedor: Corte[];
  porModelo: Corte[];
  porDia: Corte[];
  /** El gasto anotado en cada workspace. Lo de la plataforma es Claude con la clave de MaKo (ver el encabezado). */
  porWorkspace: Corte[];
  /** Los meses con datos, para poblar el selector sin adivinar. Vacío salvo `{ conMeses: true }`. */
  mesesDisponibles: string[];
  /** Lo que se pagó con la clave de Anthropic DE UN NEGOCIO: no entra en `costUsd`, que es lo de MaKo. */
  delNegocio: { llamadas: number; costUsd: number };
  /** Lo que salió del crédito de API de los planes Max de la plataforma (prepago, sin tarjeta): aparte. */
  delCredito: { llamadas: number; costUsd: number };
};

const num = (v: unknown) => (Number(v) || 0);

/** Costo REAL de una fila PARA MAKO: las gratis por rate-limit valen 0 aunque la tabla diga
 *  otra cosa (la misma corrección que hace `getUsageSummary`), y las pagadas con la clave de
 *  Anthropic de un negocio también, porque esa plata es del negocio (lib/veto-claude.ts, la
 *  segunda puerta). Sumarlas acá haría ver un gasto de Claude que no es de MaKo, y el veto
 *  parecería roto. */
function costoDe(r: Pick<FilaUso, 'provider' | 'motivo' | 'cost_usd'>): number {
  const p = r.provider ?? 'anthropic';
  if (GRATIS.includes(p)) return 0;
  if (esDeLaClaveDelNegocio(r.motivo)) return 0;
  // El crédito de los planes Max de la plataforma (puerta 3): ya está pago con la suscripción y al
  // acabarse corta en vez de cobrar. Va aparte (`delCredito`), para que se vea cuánto se usa.
  if (esDelCreditoDeLaPlataforma(r.motivo)) return 0;
  return num(r.cost_usd);
}

type FilaDeCosto = Pick<FilaUso, 'provider' | 'motivo' | 'cost_usd' | 'input_tokens' | 'output_tokens'>;

function agrupar<F extends FilaDeCosto>(filas: readonly F[], clave: (r: F) => string): Corte[] {
  const m = new Map<string, Corte>();
  for (const r of filas) {
    const k = clave(r) || '—';
    const a = m.get(k) ?? { clave: k, llamadas: 0, tokens: 0, costUsd: 0 };
    a.llamadas += 1;
    a.tokens += num(r.input_tokens) + num(r.output_tokens);
    a.costUsd += costoDe(r);
    m.set(k, a);
  }
  return [...m.values()].sort((x, y) => y.costUsd - x.costUsd || y.llamadas - x.llamadas);
}

/** Límites del mes en UTC. `periodo` es 'YYYY-MM'; cualquier otra cosa = todo. */
function ventana(periodo: string): { desde: string | null; hasta: string | null } {
  const m = /^(\d{4})-(\d{2})$/.exec(periodo);
  if (!m) return { desde: null, hasta: null };
  const y = Number(m[1]);
  const mes = Number(m[2]) - 1;
  return {
    desde: new Date(Date.UTC(y, mes, 1)).toISOString(),
    hasta: new Date(Date.UTC(y, mes + 1, 1)).toISOString(),
  };
}

/** `conMeses`: además, los meses con datos (`mesesConDatos`). Por defecto no: son otra lectura (ver el encabezado). */
export type OpcionesResumen = { conMeses?: boolean };

/**
 * El gasto de un período, paginado (sin techo de 1000) y cortado por todas las
 * dimensiones que la pantalla necesita. `periodo` = 'YYYY-MM' o 'todo'.
 *
 * GLOBAL a propósito: es la vista del DUEÑO sobre el costo de la agencia, y el
 * caller la gatea (solo super-admin). No usa `getTenantDb` porque el corte por
 * workspace es justamente uno de los datos que queremos ver.
 */
export async function resumenDelPeriodo(periodo = 'todo', o: OpcionesResumen = {}): Promise<ResumenPeriodo> {
  const { desde, hasta } = ventana(periodo);
  return resumenDeVentana(periodo, desde, hasta, o);
}

/**
 * Lo mismo que `resumenDelPeriodo`, entre dos instantes cualesquiera (ISO; `null` = sin ese borde). Existe para el selector
 * de rango de Polar en Admin › Customers › Cost Drivers (6/11/2026): «30d» u «Hoy» son una ventana exacta sobre `created_at`,
 * no un mes redondeado. `periodo` es el rótulo que se devuelve (no decide nada). Global como aquélla: la gatea quien llama.
 */
export async function resumenEntre(periodo: string, desde: string | null, hasta: string | null, o: OpcionesResumen = {}): Promise<ResumenPeriodo> {
  const iso = (v: string | null) => v == null || Number.isFinite(Date.parse(v));
  if (!iso(desde) || !iso(hasta)) throw new Error(`resumenEntre: «${desde} → ${hasta}» no es una ventana de fechas`);
  return resumenDeVentana(periodo, desde, hasta, o);
}

async function resumenDeVentana(periodo: string, desde: string | null, hasta: string | null, o: OpcionesResumen): Promise<ResumenPeriodo> {
  const cols = 'created_at, feature, motivo, model, provider, cost_usd, input_tokens, output_tokens, workspace_id';

  // El orden desempatado por la PK es la mitad del truco de paginar: con un orden
  // no único el bucle devuelve filas repetidas y salteadas sin decir nada.
  const filas = await leerTodo<FilaUso>(getSupabaseServer(), 'anthropic_usage', cols, {
    orden: [{ col: 'created_at', asc: true }, { col: 'id', asc: true }],
    filtros: (q) => {
      let r = q;
      if (desde) r = r.gte('created_at', desde);
      if (hasta) r = r.lt('created_at', hasta);
      return r;
    },
  });

  const porProveedor = agrupar(filas, (r) => r.provider ?? 'anthropic');
  const delNegocio = filas.filter((r) => esDeLaClaveDelNegocio(r.motivo));
  const delCredito = filas.filter((r) => esDelCreditoDeLaPlataforma(r.motivo));

  return {
    periodo,
    desde,
    hasta,
    filas: filas.length,
    llamadas: filas.length,
    tokens: filas.reduce((s, r) => s + num(r.input_tokens) + num(r.output_tokens), 0),
    costUsd: filas.reduce((s, r) => s + costoDe(r), 0),
    porFeature: agrupar(filas, (r) => r.feature ?? 'otros'),
    porProveedor,
    porModelo: agrupar(filas, (r) => r.model ?? '—'),
    porDia: agrupar(filas, (r) => r.created_at.slice(0, 10)).sort((a, b) => a.clave.localeCompare(b.clave)),
    porWorkspace: agrupar(filas, (r) => String(r.workspace_id ?? 1)),
    mesesDisponibles: o.conMeses ? await mesesConDatos() : [],
    delNegocio: { llamadas: delNegocio.length, costUsd: delNegocio.reduce((s, r) => s + num(r.cost_usd), 0) },
    delCredito: { llamadas: delCredito.length, costUsd: delCredito.reduce((s, r) => s + num(r.cost_usd), 0) },
  };
}

/**
 * El gasto de MaKo POR DÍA (UTC, la misma clave que `porDia`) desde `desde` (YYYY-MM-DD, incluido) hasta ahora, en UNA
 * lectura paginada de esa ventana. Con el mismo `costoDe` que `resumenDelPeriodo`: cada día suma lo mismo que en Admin ›
 * Analytics › Costs. Existe para quien necesita VARIOS meses juntos (el margen bruto de Admin › Overview, 6/11/2026):
 * `resumenDelPeriodo` por mes serían N lecturas. Global como aquél: lo gatea quien llama (sólo el super admin).
 */
export async function gastoPorDia(desde: string): Promise<Corte[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) throw new Error(`gastoPorDia: «${desde}» no es un día (YYYY-MM-DD)`);
  type Fila = FilaDeCosto & Pick<FilaUso, 'created_at'>;
  const filas = await leerTodo<Fila>(getSupabaseServer(), 'anthropic_usage', 'created_at, motivo, provider, cost_usd, input_tokens, output_tokens', {
    orden: [{ col: 'created_at', asc: true }, { col: 'id', asc: true }],
    filtros: (q) => q.gte('created_at', `${desde}T00:00:00.000Z`),
    // Lo lee la portada de Admin, que alguien espera mirando: de a una, cada página paga su ida y vuelta.
    paralelo: 4,
  });
  return agrupar(filas, (r) => r.created_at.slice(0, 10)).sort((a, b) => a.clave.localeCompare(b.clave));
}

/** Los meses «YYYY-MM» de `desde` a `hasta`, incluidos, el más viejo primero. */
export function mesesEntre(desde: string, hasta: string): string[] {
  const out: string[] = [];
  let [y, m] = desde.split('-').map(Number);
  const [yh, mh] = hasta.split('-').map(Number);
  while (y < yh || (y === yh && m <= mh)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

/** Cuántos meses se preguntan a la vez (una consulta de una fila cada uno). */
const MESES_A_LA_VEZ = 6;

/**
 * Los meses que tienen al menos una fila, más nuevo primero. Alimenta el selector de Admin › Analytics › Costs y el de
 * /integraciones: ofrecer meses vacíos es ofrecer pantallas en blanco.
 *
 * NO lee la tabla entera (6/11/2026, punto 33 de la revisión de Admin): busca la primera fila y pregunta, mes por mes desde
 * ese mes hasta el actual (UTC), si hay alguna (`limit(1)` sobre el índice de `created_at`). Son pocas consultas de una fila,
 * y no crecen con cada llamada a la IA. Sin `estricto`, «no pude leer» devuelve `[]` (y lo anota); con `estricto`, tira.
 */
export async function mesesConDatos(o: { estricto?: boolean; ahora?: Date } = {}): Promise<string[]> {
  try {
    const db = getSupabaseServer();
    const { data, error } = await db.from('anthropic_usage').select('created_at')
      .order('created_at', { ascending: true }).order('id', { ascending: true }).limit(1);
    if (error) throw new Error(error.message);
    const primera = (data?.[0] as { created_at?: string } | undefined)?.created_at;
    if (!primera) return [];
    const meses = mesesEntre(primera.slice(0, 7), (o.ahora ?? new Date()).toISOString().slice(0, 7));
    const con: string[] = [];
    for (let i = 0; i < meses.length; i += MESES_A_LA_VEZ) {
      const ola = await Promise.all(meses.slice(i, i + MESES_A_LA_VEZ).map(async (mes) => {
        const v = ventana(mes);
        const r = await db.from('anthropic_usage').select('id').gte('created_at', v.desde!).lt('created_at', v.hasta!).limit(1);
        if (r.error) throw new Error(r.error.message);
        return (r.data?.length ?? 0) > 0 ? mes : null;
      }));
      for (const mes of ola) if (mes) con.push(mes);
    }
    return con.sort().reverse();
  } catch (e) {
    if (o.estricto) throw e;
    console.warn(`[costos-ia] no se pudieron leer los meses: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}
