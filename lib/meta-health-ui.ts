// =============================================================================
// meta-health-ui — tipos + helpers ISOMÓRFICOS del estado de Meta
// =============================================================================
// Sin dependencias de server (no importa credenciales/supabase/next-headers):
// lo pueden importar los client components. La lógica server-side (fetch a la
// Graph API, resolución de credenciales por workspace) vive en lib/meta-health.ts,
// que re-exporta todo esto para el código de servidor.

import { type Semaforo, tonoDeSemaforo } from './mako-gramatica';
import { TONO } from '@/app/_ui/tokens';

// El Semáforo ya no se define acá: vive en lib/mako-gramatica.ts junto con los
// nueve estados de MaKo, porque eran DOS tipos distintos (el otro era
// `SemaforoAviso`, con 'amarillo' y 'na' donde éste dice 'ambar' y 'gris') y un
// `switch` sobre el equivocado compilaba igual y pintaba otro color. Se
// re-exporta para no tocar los 22 archivos que ya lo importan de acá.
export type { Semaforo };

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
  /** timezone_name de la cuenta (ej. "America/Argentina/Buenos_Aires"). */
  timezoneName: string | null;
  /** ISO-2 del país de la cuenta, o null si no se puede afirmar. Ver lib/meta-pais.ts. */
  country: string | null;
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
  /** Cuándo TERMINÓ la lectura a Meta. Es la hora que se le muestra a la persona. */
  fetchedAtISO: string;
  /**
   * Cuándo EMPEZÓ, antes del primer pedido a Meta. Lo que esta lectura trae puede ser de
   * cualquier momento entre las dos horas, así que para saber si ya ve una escritura se
   * mira ésta (lib/presupuesto-cambio.ts → presupuestosVigentes). Opcional: una entrada
   * de caché escrita antes de que existiera no lo trae.
   */
  inicioLecturaISO?: string;
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

// Los dos colores del semáforo salen ahora de la paleta de tonos, no de una
// lista de variables escrita a mano acá: así el ámbar del semáforo y el warning
// de un botón no pueden separarse nunca más. Los valores que devuelven son los
// mismos de antes — esto no cambia un pixel, cambia de dónde sale el pixel.
export function colorDeSemaforo(s: Semaforo): string {
  // `gris` es la excepción: va a --dim y no al fill del tono neutral (--faint),
  // porque un punto de estado en una tabla densa tiene que verse. --faint está
  // pensado para texto de apoyo.
  if (s === 'gris') return 'var(--dim)';
  return TONO[tonoDeSemaforo(s)].fill;
}
export function bgDeSemaforo(s: Semaforo): string {
  return TONO[tonoDeSemaforo(s)].bg;
}

// Traduce un problema de Meta (issues_info en inglés) a español, por keywords.
export function explicarIssueEs(it: Issue): { titulo: string; detalle: string } {
  const t = `${it.resumen} ${it.mensaje}`.toLowerCase();
  // OJO con el copy: Meta cierra su mensaje con "you don't need to do anything else"
  // porque asume que quien publica y quien aprueba son personas distintas. Acá el
  // admin del portfolio SOS VOS, así que decirte "esperá" te deja el anuncio colgado
  // para siempre. Hay que mandarte a aprobarlo.
  if (esAprobacionPendiente(it))
    return { titulo: 'Falta que lo apruebes en Meta', detalle: 'El anuncio se creó bien, pero Meta lo retiene por seguridad (“aprobación de pares”): antes de que corra, un usuario de confianza o un admin del portfolio dueño de la cuenta tiene que aprobarlo a mano. Si la cuenta es tuya, ese admin eres tú. Ábrelo en Ads Manager con el botón de abajo, o busca el mail de advertise-noreply@support.facebook.com. No se puede aprobar desde aquí: Meta no lo expone por API.' };
  if (/approv|trusted|owning business admin|really you|not running yet|legitimate|notified them/.test(t))
    return { titulo: 'Esperando aprobación del administrador', detalle: 'El anuncio se publicó y tus cambios se aplicaron, pero todavía no corre: por seguridad, Meta necesita que un administrador de la cuenta apruebe estos anuncios. Ya le avisó por email y en el Administrador de Anuncios.' };
  if (/reject|disapprov|doesn.?t comply|not comply|polic|violat|prohibited/.test(t))
    return { titulo: 'Rechazado por las políticas de Meta', detalle: 'Meta rechazó el anuncio por sus políticas de publicidad. Revisa el texto y el creativo, edita los textos y guarda para volver a enviarlo a revisión.' };
  if (/in review|pending review|being reviewed|under review|in_review/.test(t))
    return { titulo: 'En revisión de Meta', detalle: 'Meta todavía está revisando el anuncio. Empieza a entregar cuando lo apruebe (normalmente en unas horas).' };
  if (/payment|billing|unsettled|funding|pay method|declined/.test(t))
    return { titulo: 'Problema de pago', detalle: 'Hay un problema de pago o facturación en la cuenta que frena la entrega. Regularízalo en el Administrador de Anuncios.' };
  return { titulo: it.resumen || 'Problema del anuncio', detalle: it.mensaje || 'Meta marcó un problema con este anuncio. Revísalo en el Administrador de Anuncios.' };
}
