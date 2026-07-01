// =============================================================================
// Salud / estado de entrega de Meta Ads (live, sin Supabase)
// =============================================================================
// A diferencia de marketing_metrics_daily (atribución de performance: agendas,
// leads, cierres, ROAS), esta capa lee el ESTADO OPERATIVO en vivo de la Graph
// API: ¿la cuenta entrega? ¿hay saldo impago? ¿qué status tienen campañas,
// conjuntos y anuncios? ¿hay rechazos / aprendizaje / recomendaciones?
//
// Dos puntos de entrada:
//   - getMetaAccountHealth()  → 1 GET (solo cuenta). Lo usa el Semáforo de
//                               /general para la alerta, sin pesar la vista.
//   - getMetaHealth()         → cuenta + campañas + conjuntos + anuncios + las
//                               sugerencias derivadas. Lo usa /marketing/salud.
//
// Honestidad: Meta NO expone de forma fiable sus "recomendaciones con puntos"
// (Opportunity Score) por la Graph API. Pedimos `recommendations`/`issues_info`
// y los mostramos SI llegan; cuando no, derivamos sugerencias propias (MaKo) de
// las señales que sí tenemos (status de cuenta, rechazos, aprendizaje, pausas).
// =============================================================================

import { mxnAUsd, META_BALANCE_ALERTA_MXN } from './config';

const GRAPH_BASE = 'https://graph.facebook.com';
const MAX_PAGES = 50;
const PAGE_SIZE = 200;
const MAX_BACKOFF_ATTEMPTS = 4;

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type Semaforo = 'rojo' | 'ambar' | 'verde' | 'gris';

export type Reco = {
  fuente: 'meta' | 'mako';
  titulo: string;
  detalle: string;
  prioridad: 'alta' | 'media' | 'baja';
  semaforo: Semaforo;
};

export type Issue = { resumen: string; mensaje: string };

export type NodoEstado = {
  id: string;
  name: string;
  level: 'campaign' | 'adset' | 'ad';
  parentId: string | null; // adset.campaign_id / ad.adset_id
  effectiveStatus: string;
  configuredStatus: string | null;
  statusLabel: string;
  semaforo: Semaforo;
  createdTime?: string | null; // ISO de creación en Meta (para filtrar por año al renombrar)
  // Presupuesto (MXN) si el nodo lo tiene propio (campaña CBO o adset ABO).
  dailyBudgetMxn?: number | null;
  lifetimeBudgetMxn?: number | null;
  budgetRemainingMxn?: number | null;
  // Dónde vive el presupuesto: 'campaign' = CBO, 'adset' = ABO, null = lo hereda.
  budgetLevel?: 'campaign' | 'adset' | null;
  // campaigns: objetivo (OUTCOME_LEADS, etc.)
  objective?: string | null;
  // adsets: fase de aprendizaje (Meta a veces no la devuelve → degrada a gris)
  learning?: { status: string | null; label: string; semaforo: Semaforo };
  // ads: problemas de revisión/políticas si los hay
  issues?: Issue[];
  // recomendaciones nativas de Meta para este nodo (suelen venir vacías).
  recosMeta?: Reco[];
};

export type MetaAccountHealth = {
  status: number;
  statusLabel: string;
  disableReason: number;
  disableReasonLabel: string | null;
  balanceMxn: number;
  balanceUsd: number;
  amountSpentMxn: number;
  spendCapMxn: number | null;
  isPrepay: boolean;
  fundingCard: string | null;
  currency: string;
  severidad: Semaforo; // 'rojo' | 'ambar' | 'verde'
  entregaFrenada: boolean;
};

export type MetaResumen = {
  activos: number;
  aprendizaje: number;
  enRevision: number;
  pausados: number;
  rechazados: number;
};

export type MetaHealth = {
  account: MetaAccountHealth;
  campaigns: NodoEstado[];
  adsets: NodoEstado[];
  ads: NodoEstado[];
  resumen: MetaResumen;
  recomendaciones: Reco[];
  recosMetaDisponibles: boolean; // ¿Meta devolvió recommendations/issues nativos?
  parcial: boolean; // alguna sección (campañas/adsets/ads) falló pero la cuenta no
  fetchedAtISO: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Env + fetch con backoff
// ─────────────────────────────────────────────────────────────────────────────

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.startsWith('PENDING')) {
    throw new Error(`Env var ${name} no definida (o con placeholder)`);
  }
  return v;
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

type GraphError = { message: string; code?: number; error_subcode?: number };
type GraphResponse = {
  data?: Record<string, unknown>[];
  paging?: { next?: string };
  error?: GraphError;
} & Record<string, unknown>;

export class MetaHealthTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetaHealthTokenError';
  }
}

async function graphGet(url: string, attempt = 0): Promise<GraphResponse> {
  const res = await fetch(url, { method: 'GET', cache: 'no-store' });
  let body: GraphResponse;
  try {
    body = (await res.json()) as GraphResponse;
  } catch {
    throw new Error(`Respuesta no-JSON de Meta (HTTP ${res.status})`);
  }
  if (body.error) {
    const { code, error_subcode, message } = body.error;
    if (code === 190) throw new MetaHealthTokenError(`Token Meta inválido o expirado: ${message}`);
    if (code === 17 && error_subcode === 4 && attempt < MAX_BACKOFF_ATTEMPTS) {
      await sleep(1000 * 2 ** attempt);
      return graphGet(url, attempt + 1);
    }
    throw new Error(`Meta API error: ${message}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} de Meta sin error body`);
  return body;
}

/** Trae todas las páginas de una edge (campaigns/adsets/ads). */
async function graphGetAll(buildUrl: () => URL): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let next: string | null = buildUrl().toString();
  let pages = 0;
  while (next) {
    if (++pages > MAX_PAGES) break;
    const page = await graphGet(next);
    if (Array.isArray(page.data)) out.push(...page.data);
    next = page.paging?.next ?? null;
  }
  return out;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeos enum → etiqueta / color
// ─────────────────────────────────────────────────────────────────────────────

export function colorDeSemaforo(s: Semaforo): string {
  return s === 'rojo' ? 'var(--bad)' : s === 'ambar' ? 'var(--warn-fill)' : s === 'verde' ? 'var(--good)' : 'var(--dim)';
}
export function bgDeSemaforo(s: Semaforo): string {
  return s === 'rojo' ? 'var(--bad-bg)' : s === 'ambar' ? 'var(--warn-bg)' : s === 'verde' ? 'var(--good-bg)' : 'var(--surface-2)';
}

// account_status: https://developers.facebook.com/docs/marketing-api/reference/ad-account
const ACCOUNT_STATUS: Record<number, string> = {
  1: 'Activa',
  2: 'Deshabilitada',
  3: 'Saldo impago',
  7: 'En revisión de riesgo',
  8: 'Pendiente de liquidación',
  9: 'En período de gracia',
  100: 'Pendiente de cierre',
  101: 'Cerrada',
  201: 'Activa (cualquiera)',
  202: 'Cerrada (cualquiera)',
};
export function accountStatusLabel(status: number): string {
  return ACCOUNT_STATUS[status] ?? `Estado desconocido (${status})`;
}

const DISABLE_REASON: Record<number, string> = {
  0: '',
  1: 'Política de integridad de anuncios',
  2: 'Revisión de IP de anuncios',
  3: 'Riesgo de pago',
  4: 'Cierre por cuenta gris',
  5: 'Revisión AFC de anuncios',
  6: 'Integridad del negocio',
  7: 'Cierre permanente',
  8: 'Cuenta de reseller sin uso',
  9: 'Cuenta sin uso',
};
export function disableReasonLabel(reason: number): string | null {
  return reason && DISABLE_REASON[reason] ? DISABLE_REASON[reason] : null;
}

// effective_status de campaign/adset/ad
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Activo',
  PAUSED: 'Pausado',
  CAMPAIGN_PAUSED: 'Pausado por campaña',
  ADSET_PAUSED: 'Pausado por conjunto',
  ARCHIVED: 'Archivado',
  DELETED: 'Eliminado',
  IN_PROCESS: 'Procesando',
  PENDING_REVIEW: 'En revisión',
  PREAPPROVED: 'Pre-aprobado',
  WITH_ISSUES: 'Con problemas',
  DISAPPROVED: 'Rechazado',
  PENDING_BILLING_INFO: 'Falta info de pago',
};
export function statusLabel(s: string): string {
  return STATUS_LABEL[s] ?? s.replace(/_/g, ' ').toLowerCase();
}
export function statusSemaforo(s: string): Semaforo {
  switch (s) {
    case 'ACTIVE':
      return 'verde';
    case 'PAUSED':
    case 'CAMPAIGN_PAUSED':
    case 'ADSET_PAUSED':
    case 'ARCHIVED':
    case 'DELETED':
      return 'gris';
    case 'IN_PROCESS':
    case 'PENDING_REVIEW':
    case 'PREAPPROVED':
      return 'ambar';
    case 'WITH_ISSUES':
    case 'DISAPPROVED':
    case 'PENDING_BILLING_INFO':
      return 'rojo';
    default:
      return 'gris';
  }
}

// Traduce un problema de Meta (issues_info suele venir en inglés) a una explicación
// clara en español, por keywords. Devuelve título corto + detalle accionable.
export function explicarIssueEs(it: Issue): { titulo: string; detalle: string } {
  const t = `${it.resumen} ${it.mensaje}`.toLowerCase();
  if (/approv|trusted|owning business admin|really you|not running yet|legitimate|notified them/.test(t))
    return { titulo: 'Esperando aprobación del administrador', detalle: 'El anuncio se publicó y tus cambios se aplicaron, pero todavía no corre: por seguridad, Meta necesita que un administrador de la cuenta apruebe estos anuncios. Ya le avisó por email y en el Administrador de Anuncios. No tenés que hacer nada más, solo esperar la aprobación.' };
  if (/reject|disapprov|doesn.?t comply|not comply|polic|violat|prohibited/.test(t))
    return { titulo: 'Rechazado por las políticas de Meta', detalle: 'Meta rechazó el anuncio por sus políticas de publicidad. Revisá el texto y el creativo, editá los textos y guardá para volver a enviarlo a revisión.' };
  if (/in review|pending review|being reviewed|under review|in_review/.test(t))
    return { titulo: 'En revisión de Meta', detalle: 'Meta todavía está revisando el anuncio. Empieza a entregar cuando lo apruebe (normalmente en unas horas).' };
  if (/payment|billing|unsettled|funding|pay method|declined/.test(t))
    return { titulo: 'Problema de pago', detalle: 'Hay un problema de pago o facturación en la cuenta que frena la entrega. Regularizalo en el Administrador de Anuncios.' };
  return { titulo: it.resumen || 'Problema del anuncio', detalle: it.mensaje || 'Meta marcó un problema con este anuncio. Revisalo en el Administrador de Anuncios.' };
}

const LEARNING_LABEL: Record<string, string> = {
  LEARNING: 'En aprendizaje',
  LEARNING_LIMITED: 'Aprendizaje limitado',
  SUCCESS: 'Aprendizaje completado',
};
function learningInfo(raw: unknown): NodoEstado['learning'] {
  const status =
    raw && typeof raw === 'object' && 'status' in raw && typeof (raw as { status: unknown }).status === 'string'
      ? ((raw as { status: string }).status)
      : null;
  if (!status) return { status: null, label: 'Sin datos de aprendizaje', semaforo: 'gris' };
  const label = LEARNING_LABEL[status] ?? status;
  const semaforo: Semaforo = status === 'SUCCESS' ? 'verde' : 'ambar';
  return { status, label, semaforo };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cuenta (1 GET)
// ─────────────────────────────────────────────────────────────────────────────

function computeAccountHealth(raw: Record<string, unknown>): MetaAccountHealth {
  const status = num(raw.account_status);
  const disableReason = num(raw.disable_reason);
  const currency = String(raw.currency ?? 'MXN');
  // Montos llegan en CENTAVOS de la moneda de la cuenta (MXN) → /100.
  const balanceMxn = num(raw.balance) / 100;
  const amountSpentMxn = num(raw.amount_spent) / 100;
  const spendCapRaw = num(raw.spend_cap) / 100;
  const spendCapMxn = spendCapRaw > 0 ? spendCapRaw : null;

  const funding = raw.funding_source_details as { display_string?: string } | undefined;
  const fundingCard = funding?.display_string ?? null;

  // Severidad:
  //  rojo  → cuenta no entrega: DISABLED/UNSETTLED/PENDING_CLOSURE/CLOSED,
  //          o cualquier disable_reason, o saldo adeudado con cuenta no-activa.
  //  ambar → estados de espera: revisión de riesgo / liquidación / gracia.
  //  verde → activa y sin deuda.
  const rojoStatus = status === 2 || status === 3 || status === 100 || status === 101;
  const ambarStatus = status === 7 || status === 8 || status === 9;
  const saldoProblema = balanceMxn > META_BALANCE_ALERTA_MXN && status !== 1;
  let severidad: Semaforo;
  if (rojoStatus || disableReason !== 0 || saldoProblema) severidad = 'rojo';
  else if (ambarStatus) severidad = 'ambar';
  else severidad = 'verde';

  return {
    status,
    statusLabel: accountStatusLabel(status),
    disableReason,
    disableReasonLabel: disableReasonLabel(disableReason),
    balanceMxn,
    balanceUsd: mxnAUsd(balanceMxn),
    amountSpentMxn,
    spendCapMxn,
    isPrepay: Boolean(raw.is_prepay_account),
    fundingCard,
    currency,
    severidad,
    entregaFrenada: severidad === 'rojo',
  };
}

async function fetchAccountRaw(): Promise<Record<string, unknown>> {
  const acct = getEnv('META_AD_ACCOUNT_ID');
  const ver = getEnv('META_API_VERSION');
  const token = getEnv('META_ACCESS_TOKEN');
  const url = new URL(`${GRAPH_BASE}/${ver}/${acct}`);
  url.searchParams.set(
    'fields',
    'name,account_status,disable_reason,balance,amount_spent,spend_cap,currency,is_prepay_account,funding_source_details',
  );
  url.searchParams.set('access_token', token);
  const body = await graphGet(url.toString());
  return body as Record<string, unknown>;
}

/** Solo la salud de la cuenta — 1 GET. Para el Semáforo de /general. */
export async function getMetaAccountHealth(): Promise<MetaAccountHealth> {
  return computeAccountHealth(await fetchAccountRaw());
}

/**
 * Recomendaciones nativas a nivel CUENTA (edge act_<id>/recommendations).
 * El endpoint existe y es válido, pero para cuentas restringidas/sin permiso
 * ads_management suele devolver lista vacía. Falla suave → [].
 */
export async function fetchAccountRecommendations(): Promise<Reco[]> {
  try {
    const acct = getEnv('META_AD_ACCOUNT_ID');
    const ver = getEnv('META_API_VERSION');
    const token = getEnv('META_ACCESS_TOKEN');
    const url = new URL(`${GRAPH_BASE}/${ver}/${acct}/recommendations`);
    url.searchParams.set('access_token', token);
    const body = await graphGet(url.toString());
    return parseRecosMeta(body.data);
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Edges: campañas / conjuntos / anuncios
// ─────────────────────────────────────────────────────────────────────────────

function edgeUrl(path: string, fields: string): () => URL {
  const acct = getEnv('META_AD_ACCOUNT_ID');
  const ver = getEnv('META_API_VERSION');
  const token = getEnv('META_ACCESS_TOKEN');
  return () => {
    const url = new URL(`${GRAPH_BASE}/${ver}/${acct}/${path}`);
    url.searchParams.set('fields', fields);
    url.searchParams.set('limit', String(PAGE_SIZE));
    url.searchParams.set('access_token', token);
    return url;
  };
}

function centavosAMxn(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n / 100 : null;
}

function toNodo(
  raw: Record<string, unknown>,
  level: NodoEstado['level'],
  parentKey: string | null,
): NodoEstado {
  const eff = String(raw.effective_status ?? 'UNKNOWN');
  const nodo: NodoEstado = {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? '(sin nombre)'),
    level,
    parentId: parentKey ? (raw[parentKey] != null ? String(raw[parentKey]) : null) : null,
    effectiveStatus: eff,
    configuredStatus: raw.configured_status != null ? String(raw.configured_status) : null,
    statusLabel: statusLabel(eff),
    semaforo: statusSemaforo(eff),
    createdTime: raw.created_time != null ? String(raw.created_time) : null,
  };
  if (level === 'campaign' || level === 'adset') {
    nodo.dailyBudgetMxn = centavosAMxn(raw.daily_budget);
    nodo.lifetimeBudgetMxn = centavosAMxn(raw.lifetime_budget);
    nodo.budgetRemainingMxn = centavosAMxn(raw.budget_remaining);
    // CBO si la campaña tiene budget propio; ABO si el conjunto lo tiene.
    nodo.budgetLevel = nodo.dailyBudgetMxn != null || nodo.lifetimeBudgetMxn != null ? level : null;
  }
  if (level === 'campaign') nodo.objective = raw.objective != null ? String(raw.objective) : null;
  if (level === 'adset') nodo.learning = learningInfo(raw.learning_stage_info);
  if (level === 'ad') {
    const issues = parseIssues(raw.issues_info);
    if (issues.length) nodo.issues = issues;
  }
  const recos = parseRecosMeta(raw.recommendations);
  if (recos.length) nodo.recosMeta = recos;
  return nodo;
}

function parseIssues(raw: unknown): Issue[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it) => {
      const o = (it ?? {}) as Record<string, unknown>;
      const resumen = String(o.error_summary ?? o.error_type ?? 'Problema');
      const mensaje = String(o.error_message ?? '');
      return { resumen, mensaje };
    })
    .filter((x) => x.resumen || x.mensaje);
}

function parseRecosMeta(raw: unknown): Reco[] {
  if (!Array.isArray(raw)) return [];
  const impMap: Record<string, { p: Reco['prioridad']; s: Semaforo }> = {
    HIGH: { p: 'alta', s: 'rojo' },
    MEDIUM: { p: 'media', s: 'ambar' },
    LOW: { p: 'baja', s: 'gris' },
  };
  return raw.map((it) => {
    const o = (it ?? {}) as Record<string, unknown>;
    const imp = String(o.importance ?? 'MEDIUM').toUpperCase();
    const m = impMap[imp] ?? impMap.MEDIUM;
    return {
      fuente: 'meta' as const,
      titulo: String(o.title ?? 'Recomendación de Meta'),
      detalle: String(o.message ?? ''),
      prioridad: m.p,
      semaforo: m.s,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sugerencias derivadas (MaKo) — de las señales reales que sí tenemos
// ─────────────────────────────────────────────────────────────────────────────

function sugerenciasMako(
  account: MetaAccountHealth,
  campaigns: NodoEstado[],
  adsets: NodoEstado[],
  ads: NodoEstado[],
): Reco[] {
  const out: Reco[] = [];

  // 1) Cuenta no entrega → la urgencia #1.
  if (account.entregaFrenada) {
    const saldo = account.balanceMxn > 0 ? ` Saldo adeudado ~${account.balanceMxn.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN.` : '';
    const tarjeta = account.fundingCard ? ` Medio de pago: ${account.fundingCard}.` : '';
    out.push({
      fuente: 'mako',
      titulo: 'Regularizá el pago de la cuenta de Meta',
      detalle: `La cuenta está "${account.statusLabel}".${saldo}${tarjeta} Tus campañas figuran activas pero Meta no está entregando hasta que se salde. Entrá al Administrador de Anuncios y pagá / actualizá la tarjeta.`,
      prioridad: 'alta',
      semaforo: 'rojo',
    });
  } else if (account.severidad === 'ambar') {
    out.push({
      fuente: 'mako',
      titulo: 'La cuenta de Meta está en un estado de espera',
      detalle: `Estado "${account.statusLabel}". La entrega puede verse limitada. Revisá el Business Manager por las dudas.`,
      prioridad: 'media',
      semaforo: 'ambar',
    });
  }

  // 2) Anuncios rechazados / con problemas.
  const rechazados = ads.filter((a) => a.semaforo === 'rojo');
  if (rechazados.length) {
    const ej = rechazados.slice(0, 3).map((a) => a.name).join(', ');
    out.push({
      fuente: 'mako',
      titulo: `${rechazados.length} anuncio${rechazados.length === 1 ? '' : 's'} rechazado${rechazados.length === 1 ? '' : 's'} o con problemas`,
      detalle: `Ej.: ${ej}. Revisá el motivo en cada anuncio (políticas/pago) y corregí o reemplazá el creativo para no perder entrega.`,
      prioridad: 'alta',
      semaforo: 'rojo',
    });
  }

  // 3) Conjuntos en aprendizaje limitado (solo si Meta devolvió el status).
  const limitados = adsets.filter((a) => a.learning?.status === 'LEARNING_LIMITED');
  if (limitados.length) {
    out.push({
      fuente: 'mako',
      titulo: `${limitados.length} conjunto${limitados.length === 1 ? '' : 's'} en aprendizaje limitado`,
      detalle: 'Meta no junta suficientes conversiones para salir de aprendizaje. Ampliá la audiencia, subí el presupuesto o consolidá conjuntos para darles volumen.',
      prioridad: 'media',
      semaforo: 'ambar',
    });
  }

  // 4) Cuenta activa pero sin nada entregando.
  const adsActivos = ads.filter((a) => a.effectiveStatus === 'ACTIVE').length;
  if (account.severidad === 'verde' && ads.length > 0 && adsActivos === 0) {
    out.push({
      fuente: 'mako',
      titulo: 'No hay anuncios entregando',
      detalle: 'La cuenta está al día pero ningún anuncio está activo. Si esperabas tener campañas corriendo, activá al menos un conjunto/anuncio.',
      prioridad: 'media',
      semaforo: 'ambar',
    });
  }

  // 5) Anuncios en revisión de Meta.
  const enRevision = ads.filter((a) => a.semaforo === 'ambar').length;
  if (enRevision > 0) {
    out.push({
      fuente: 'mako',
      titulo: `${enRevision} anuncio${enRevision === 1 ? '' : 's'} en revisión de Meta`,
      detalle: 'Meta todavía los está revisando. No empiezan a entregar hasta aprobarse; normalmente es cuestión de horas.',
      prioridad: 'baja',
      semaforo: 'gris',
    });
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Salud completa (cuenta + edges + sugerencias)
// ─────────────────────────────────────────────────────────────────────────────

export async function getMetaHealth(): Promise<MetaHealth> {
  // La cuenta es obligatoria (sin ella no hay banner): si falla, propaga.
  const accountRaw = await fetchAccountRaw();
  const account = computeAccountHealth(accountRaw);

  // Edges en paralelo, tolerante: si una falla, sigue con lo que haya.
  // MaKo "le pregunta a Meta primero": pedimos recommendations en cada nivel +
  // el edge de cuenta, y las combinamos con las sugerencias derivadas.
  const [campR, adsetR, adR, accRecoR] = await Promise.allSettled([
    graphGetAll(edgeUrl('campaigns', 'name,effective_status,configured_status,daily_budget,lifetime_budget,objective,recommendations,created_time')),
    graphGetAll(edgeUrl('adsets', 'name,campaign_id,effective_status,configured_status,daily_budget,lifetime_budget,budget_remaining,learning_stage_info,recommendations,created_time')),
    graphGetAll(edgeUrl('ads', 'name,adset_id,campaign_id,effective_status,configured_status,issues_info,recommendations,created_time')),
    fetchAccountRecommendations(),
  ]);

  const campaignsRaw = campR.status === 'fulfilled' ? campR.value : [];
  const adsetsRaw = adsetR.status === 'fulfilled' ? adsetR.value : [];
  const adsRaw = adR.status === 'fulfilled' ? adR.value : [];
  const accRecos = accRecoR.status === 'fulfilled' ? accRecoR.value : [];
  const parcial = [campR, adsetR, adR].some((r) => r.status === 'rejected');

  const campaigns = campaignsRaw.map((r) => toNodo(r, 'campaign', null));
  const adsets = adsetsRaw.map((r) => toNodo(r, 'adset', 'campaign_id'));
  const ads = adsRaw.map((r) => toNodo(r, 'ad', 'adset_id'));

  // Recomendaciones nativas de Meta (raras vía API): cuenta + cada nivel.
  const recosMeta: Reco[] = [
    ...accRecos,
    ...[...campaigns, ...adsets, ...ads].flatMap((n) => n.recosMeta ?? []),
  ];
  const recosMetaDisponibles = recosMeta.length > 0;

  const sugerencias = sugerenciasMako(account, campaigns, adsets, ads);
  const prioridadPeso: Record<Reco['prioridad'], number> = { alta: 0, media: 1, baja: 2 };
  const recomendaciones = [...recosMeta, ...sugerencias].sort(
    (a, b) => prioridadPeso[a.prioridad] - prioridadPeso[b.prioridad],
  );

  const resumen: MetaResumen = {
    activos: ads.filter((a) => a.effectiveStatus === 'ACTIVE').length,
    aprendizaje: adsets.filter((a) => a.learning?.status === 'LEARNING' || a.learning?.status === 'LEARNING_LIMITED').length,
    enRevision: ads.filter((a) => a.semaforo === 'ambar').length,
    pausados: ads.filter((a) => a.semaforo === 'gris').length,
    rechazados: ads.filter((a) => a.semaforo === 'rojo').length,
  };

  return {
    account,
    campaigns,
    adsets,
    ads,
    resumen,
    recomendaciones,
    recosMetaDisponibles,
    parcial,
    fetchedAtISO: new Date().toISOString(),
  };
}
