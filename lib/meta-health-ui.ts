// =============================================================================
// meta-health-ui — tipos + helpers ISOMÓRFICOS del estado de Meta
// =============================================================================
// Sin dependencias de server (no importa credenciales/supabase/next-headers):
// lo pueden importar los client components. La lógica server-side (fetch a la
// Graph API, resolución de credenciales por workspace) vive en lib/meta-health.ts,
// que re-exporta todo esto para el código de servidor.

export type Semaforo = 'rojo' | 'ambar' | 'verde' | 'gris';

export type Reco = {
  fuente: 'meta' | 'mako';
  titulo: string;
  detalle: string;
  prioridad: 'alta' | 'media' | 'baja';
  semaforo: Semaforo;
};

// `code` = error_code de Meta (más fiable que matchear el texto, que viene en el
// idioma de la cuenta y cambia). `mid` = el message id que Meta define justamente
// para reportarle un caso a soporte: lo guardamos para poder citarlo.
export type Issue = { resumen: string; mensaje: string; code?: number; mid?: string };

// ── Aprobación de pares ("peer approval") ────────────────────────────────────
// Meta retiene el anuncio recién publicado hasta que un "usuario de confianza" o
// un admin del portfolio dueño lo apruebe A MANO en Ads Manager. NO es un rechazo
// por políticas (eso es DISAPPROVED + ad_review_feedback): es un control de
// identidad, y Meta NO lo expone por API — no hay endpoint para aprobar ni para
// leer la configuración (probado contra la Graph API: /confirm, /approve, /review
// y /appeal no existen). Lo único que puede hacer la app es detectarlo y guiar.
export const META_ISSUE_APROBACION_PENDIENTE = 2446984;

export function esAprobacionPendiente(it: Issue): boolean {
  if (it.code === META_ISSUE_APROBACION_PENDIENTE) return true;
  const t = `${it.resumen} ${it.mensaje}`.toLowerCase();
  return /trusted user|owning business admin|really you publishing|approve these ads/.test(t);
}

/** Link a Ads Manager centrado en un anuncio. Con el id de la cuenta abre SU Ads
 * Manager; con el del anuncio lo deja seleccionado (y, dentro, se ve su campaña y
 * conjunto). Isomórfico: lo usan tanto la ficha del lead como el estado de Meta.
 * Devuelve null si no hay nada con qué armar un link útil (sin cuenta ni anuncio). */
export function linkAdsManager(accountId?: string | null, adId?: string | null): string | null {
  const act = (accountId ?? '').replace(/^act_/, '');
  if (!act && !adId) return null;
  const qs = new URLSearchParams();
  if (act) qs.set('act', act);
  if (adId) qs.set('selected_ad_ids', adId);
  const s = qs.toString();
  return `https://adsmanager.facebook.com/adsmanager/manage/ads${s ? `?${s}` : ''}`;
}

/** Link a Ads Manager para aprobar el anuncio retenido (peer approval). Igual que
 * linkAdsManager pero siempre devuelve una URL (cae al Ads Manager general). */
export function linkAprobarEnMeta(accountId?: string | null, adId?: string | null): string {
  return linkAdsManager(accountId, adId) ?? 'https://adsmanager.facebook.com/adsmanager/manage/ads';
}

export type NodoEstado = {
  id: string;
  name: string;
  level: 'campaign' | 'adset' | 'ad';
  parentId: string | null;
  effectiveStatus: string;
  configuredStatus: string | null;
  statusLabel: string;
  semaforo: Semaforo;
  createdTime?: string | null;
  dailyBudgetMxn?: number | null;
  lifetimeBudgetMxn?: number | null;
  budgetRemainingMxn?: number | null;
  budgetLevel?: 'campaign' | 'adset' | null;
  objective?: string | null;
  learning?: { status: string | null; label: string; semaforo: Semaforo };
  issues?: Issue[];
  recosMeta?: Reco[];
};

export type MetaAccountHealth = {
  /** act_<id> — para armar los links a Ads Manager (ver linkAprobarEnMeta). */
  accountId: string | null;
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
  severidad: Semaforo;
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
  recosMetaDisponibles: boolean;
  parcial: boolean;
  fetchedAtISO: string;
};

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

export function colorDeSemaforo(s: Semaforo): string {
  return s === 'rojo' ? 'var(--bad)' : s === 'ambar' ? 'var(--warn-fill)' : s === 'verde' ? 'var(--good)' : 'var(--dim)';
}
export function bgDeSemaforo(s: Semaforo): string {
  return s === 'rojo' ? 'var(--bad-bg)' : s === 'ambar' ? 'var(--warn-bg)' : s === 'verde' ? 'var(--good-bg)' : 'var(--surface-2)';
}

// Traduce un problema de Meta (issues_info en inglés) a español, por keywords.
export function explicarIssueEs(it: Issue): { titulo: string; detalle: string } {
  const t = `${it.resumen} ${it.mensaje}`.toLowerCase();
  // OJO con el copy: Meta cierra su mensaje con "you don't need to do anything else"
  // porque asume que quien publica y quien aprueba son personas distintas. Acá el
  // admin del portfolio SOS VOS, así que decirte "esperá" te deja el anuncio colgado
  // para siempre. Hay que mandarte a aprobarlo.
  if (esAprobacionPendiente(it))
    return { titulo: 'Falta que lo apruebes en Meta', detalle: 'El anuncio se creó bien, pero Meta lo retiene por seguridad (“aprobación de pares”): antes de que corra, un usuario de confianza o un admin del portfolio dueño de la cuenta tiene que aprobarlo a mano. Si la cuenta es tuya, ese admin sos vos. Abrilo en Ads Manager con el botón de abajo, o buscá el mail de advertise-noreply@support.facebook.com. No se puede aprobar desde acá: Meta no lo expone por API.' };
  if (/approv|trusted|owning business admin|really you|not running yet|legitimate|notified them/.test(t))
    return { titulo: 'Esperando aprobación del administrador', detalle: 'El anuncio se publicó y tus cambios se aplicaron, pero todavía no corre: por seguridad, Meta necesita que un administrador de la cuenta apruebe estos anuncios. Ya le avisó por email y en el Administrador de Anuncios.' };
  if (/reject|disapprov|doesn.?t comply|not comply|polic|violat|prohibited/.test(t))
    return { titulo: 'Rechazado por las políticas de Meta', detalle: 'Meta rechazó el anuncio por sus políticas de publicidad. Revisá el texto y el creativo, editá los textos y guardá para volver a enviarlo a revisión.' };
  if (/in review|pending review|being reviewed|under review|in_review/.test(t))
    return { titulo: 'En revisión de Meta', detalle: 'Meta todavía está revisando el anuncio. Empieza a entregar cuando lo apruebe (normalmente en unas horas).' };
  if (/payment|billing|unsettled|funding|pay method|declined/.test(t))
    return { titulo: 'Problema de pago', detalle: 'Hay un problema de pago o facturación en la cuenta que frena la entrega. Regularizalo en el Administrador de Anuncios.' };
  return { titulo: it.resumen || 'Problema del anuncio', detalle: it.mensaje || 'Meta marcó un problema con este anuncio. Revisalo en el Administrador de Anuncios.' };
}
