// =============================================================================
// El plan del funnel: un objeto guardado, no un mensaje del chat (1/11/2026)
// =============================================================================
// docs/funnel-coach.md §3: «Un chat puede fingir que te armó una oferta escribiéndola en un mensaje. No puede fingir un botón que la
// muestra». Lo guarda el Funnel Coach (operación `guardar_plan_funnel`) y lo muestra su botón «Ver el plan». Vive en app_settings del
// negocio: es uno por negocio y se reemplaza entero. Esta parte es pura; la lectura y la escritura están en lib/funnel-plan-db.ts.

export const CLAVE_PLAN_FUNNEL = 'funnel_coach.plan';

export const FUNNELS = ['anuncios', 'organico', 'youtube', 'anuncios-a-whatsapp', 'anuncios-a-vsl', 'prospeccion-en-frio'] as const;
export type Funnel = (typeof FUNNELS)[number];

export const ROTULO_FUNNEL: Readonly<Record<Funnel, string>> = {
  anuncios: 'Anuncios', organico: 'Orgánico', youtube: 'YouTube', 'anuncios-a-whatsapp': 'Anuncios a WhatsApp',
  'anuncios-a-vsl': 'Anuncios a VSL', 'prospeccion-en-frio': 'Scraping y prospección en frío',
};

export type PlanFunnel = {
  funnel: Funnel;
  /** Por qué ese y no otro, en lo que dijo la persona. */
  porque: string;
  /** Lo que invierte por mes, en dólares. null = todavía no lo dijo (un funnel orgánico puede no tenerlo). */
  presupuestoMensual: number | null;
  creativos: number | null;
  angulos: number | null;
  landings: number | null;
  pasos: string[];
  guardadoEn: string;
};

const TOPE_TEXTO = 600;
const TOPE_PASOS = 12;

const texto = (v: unknown, tope = TOPE_TEXTO): string => (typeof v === 'string' ? v.trim().slice(0, tope) : '');
const numero = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
};

/** Lo que llega de la herramienta o de la base: sin funnel válido no hay plan, y lo demás se limpia sin inventar nada. */
export function sanearPlan(v: unknown, guardadoEn?: string): PlanFunnel | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const funnel = FUNNELS.find((f) => f === o.funnel);
  if (!funnel) return null;
  const pasos = Array.isArray(o.pasos) ? o.pasos.map((p) => texto(p, 200)).filter(Boolean).slice(0, TOPE_PASOS) : [];
  return {
    funnel, porque: texto(o.porque), presupuestoMensual: numero(o.presupuestoMensual), creativos: numero(o.creativos), angulos: numero(o.angulos),
    landings: numero(o.landings), pasos, guardadoEn: guardadoEn ?? texto(o.guardadoEn, 40),
  };
}

/** Lo que se lee del plan: sólo lo que está. Un dato que no se dijo no ocupa una línea. */
export function lineasDelPlan(p: PlanFunnel): Array<{ rotulo: string; valor: string }> {
  const dato = (rotulo: string, n: number | null, conMoneda = false) => (n == null ? [] : [{ rotulo, valor: conMoneda ? `US$ ${n.toLocaleString('es-MX')}` : String(n) }]);
  return [
    { rotulo: 'Funnel', valor: ROTULO_FUNNEL[p.funnel] },
    ...dato('Inversión por mes', p.presupuestoMensual, true), ...dato('Creativos', p.creativos), ...dato('Ángulos', p.angulos), ...dato('Landings', p.landings),
  ];
}
