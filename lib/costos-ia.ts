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
// ⚠️ LO QUE ESTE MÓDULO NO PUEDE ARREGLAR, y hay que saber al leer sus números:
// `lib/anthropic-usage.ts:22-25` (`wsDeProveedor`) escribe TODA fila de Anthropic
// con `workspace_id = 1`, venga del workspace que venga. Para las filas de Claude
// —que son el ~99% del gasto— el workspace es una CONSTANTE, no una medición. Por
// eso `porWorkspace` marca `atribuible: false` en Anthropic: mostrar ese corte como
// si fuera real es peor que no mostrarlo. El análisis está en
// docs/costos-ia-y-planes.md.

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
  /** Ojo: para Anthropic el workspace es constante (ver el encabezado). */
  porWorkspace: Array<Corte & { atribuible: boolean }>;
  /** Los meses con datos, para poblar el selector sin adivinar. */
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
function costoDe(r: FilaUso): number {
  const p = r.provider ?? 'anthropic';
  if (GRATIS.includes(p)) return 0;
  if (esDeLaClaveDelNegocio(r.motivo)) return 0;
  // El crédito de los planes Max de la plataforma (puerta 3): ya está pago con la suscripción y al
  // acabarse corta en vez de cobrar. Va aparte (`delCredito`), para que se vea cuánto se usa.
  if (esDelCreditoDeLaPlataforma(r.motivo)) return 0;
  return num(r.cost_usd);
}

function agrupar(filas: FilaUso[], clave: (r: FilaUso) => string): Corte[] {
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

/**
 * El gasto de un período, paginado (sin techo de 1000) y cortado por todas las
 * dimensiones que la pantalla necesita. `periodo` = 'YYYY-MM' o 'todo'.
 *
 * GLOBAL a propósito: es la vista del DUEÑO sobre el costo de la agencia, y el
 * caller la gatea (solo super-admin). No usa `getTenantDb` porque el corte por
 * workspace es justamente uno de los datos que queremos ver.
 */
export async function resumenDelPeriodo(periodo = 'todo'): Promise<ResumenPeriodo> {
  const { desde, hasta } = ventana(periodo);
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
  // Las de la clave de un negocio se registran en SU workspace (`wsDeProveedor`), así que no
  // vuelven constante el corte por workspace: sólo cuentan las de la clave de la agencia.
  // Lo mismo las del crédito de la plataforma: `conCreditoDeLaPlataforma` las anota en el ws del cliente.
  const anthropicTieneFilas = filas.some((r) => (r.provider ?? 'anthropic') === 'anthropic'
    && !esDeLaClaveDelNegocio(r.motivo) && !esDelCreditoDeLaPlataforma(r.motivo));
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
    porWorkspace: agrupar(filas, (r) => String(r.workspace_id ?? 1)).map((c) => ({
      ...c,
      // Con filas de Anthropic en el período, el corte por workspace no es real.
      atribuible: !anthropicTieneFilas,
    })),
    mesesDisponibles: await mesesConDatos(),
    delNegocio: { llamadas: delNegocio.length, costUsd: delNegocio.reduce((s, r) => s + num(r.cost_usd), 0) },
    delCredito: { llamadas: delCredito.length, costUsd: delCredito.reduce((s, r) => s + num(r.cost_usd), 0) },
  };
}

/** Los meses que tienen al menos una fila, más nuevo primero. Alimenta el
 *  selector: ofrecer meses vacíos es ofrecer pantallas en blanco. */
export async function mesesConDatos(): Promise<string[]> {
  try {
    const filas = await leerTodo<{ created_at: string }>(getSupabaseServer(), 'anthropic_usage', 'created_at', {
      orden: [{ col: 'created_at', asc: true }, { col: 'id', asc: true }],
    });
    return [...new Set(filas.map((r) => r.created_at.slice(0, 7)))].sort().reverse();
  } catch (e) {
    console.warn(`[costos-ia] no se pudieron leer los meses: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}
