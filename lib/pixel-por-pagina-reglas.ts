// =============================================================================
// ¿Por qué la tab Tracking de un lead no tiene nada? — las reglas PURAS (14/11/2026)
// =============================================================================
// La llamada de Martín con Julio (13/11, min 25:20): un lead de Mauricio con el tracking VACÍO, «tal vez porque no
// instaló el Pixel» en esa página. La ficha sólo sabía decir que falta el Pixel cuando el NEGOCIO entero no mide
// (`landingRecibioEventos`, el semáforo de /integraciones): Mauricio lo tiene puesto en su funnel principal, así que un
// lead que entró por OTRA página quedaba con la tab vacía y sin una palabra de por qué.
//
// Acá se decide QUÉ página mirar y QUÉ decir; la lectura de `landing_visits` vive en lib/pixel-por-pagina.ts.
//   · La página por la que ENTRÓ es `pagina_registro` (la escribe sólo el opt-in de la landing, mig 0290).
//   · Sin ella, y si entró por una página (landing, Calendly, Cal.com o sin origen), las páginas que el negocio
//     asignó a SU funnel en /integraciones (`landing.config`). Eso es una inferencia: el texto dice «de su funnel»,
//     nunca «por la que entró».
//   · Si entró por algo que no es una página (formulario de Meta, WhatsApp, a mano…), no hay página que revisar:
//     se dice eso, en una línea, en vez de dejar la tab vacía.
// =============================================================================

import { normalizarUrl, esPreviewDeEditor } from './landing-paginas';
import { urlLandingVigente } from './editor-landing/dominios-reglas';
import type { LandingConfig } from './landing-config';

/** Por qué no hay nada que mostrar, cuando se sabe. null = no se sabe (la tab se queda como siempre). */
export type SinTracking =
  | { como: 'sin-pixel'; url: string; deEntrada: boolean }
  | { como: 'sin-pagina'; origen: string };

/** Lo que mira la regla del lead (la ficha lo lee con `*`). */
export type LeadParaPixel = {
  pagina_registro?: string | null;
  funnel_id?: number | null;
  origen_lead?: string | null;
  meta_lead_id?: string | null;
  created_at?: string | null;
};

/** Los orígenes que NO pasan por una página, con cómo se dice. Calendly y Cal.com no están: antes de agendar se pasa por la landing. */
export const ENTRO_SIN_PAGINA: Record<string, string> = {
  instant_form: 'Entró por el formulario de Meta',
  carga_manual: 'Lo cargaron a mano',
  importacion: 'Entró por una importación',
  chat_whatsapp: 'Entró por WhatsApp',
  grupo_whatsapp: 'Entró por un grupo de WhatsApp',
  instagram: 'Entró por Instagram',
  messenger: 'Entró por Messenger',
  perfil_instagram: 'Entró por su perfil de Instagram',
  perfil_linkedin: 'Entró por su perfil de LinkedIn',
  hotmart: 'Entró por Hotmart',
  skool: 'Entró por Skool',
  stripe: 'Entró por un pago de Stripe',
  migracion: 'Vino de otro CRM',
};

/** Hasta cuántas páginas de un funnel se revisan (una lectura por página). */
export const MAX_PAGINAS_A_REVISAR = 3;
/** Cuántas filas de una página se traen como candidatas: con el tope lleno no se puede afirmar nada. */
export const FILAS_POR_PAGINA = 500;

/** Entró por algo que no es una página: lo que se dice, o null. */
export function entroSinPagina(lead: LeadParaPixel): string | null {
  if (lead.pagina_registro?.trim()) return null;
  if (lead.meta_lead_id) return ENTRO_SIN_PAGINA.instant_form;
  return ENTRO_SIN_PAGINA[lead.origen_lead ?? ''] ?? null;
}

/** La forma con la que se comparan dos páginas: normalizada y con la dirección de HOY de las del editor. */
export function clavePagina(url: string | null | undefined): string | null {
  const u = url ? normalizarUrl(url) : null;
  return u ? urlLandingVigente(u) : null;
}

/** Las páginas a revisar: la de su registro, o las de su funnel. `idDefault` = el funnel del negocio (el lead lo tiene como null). */
export function paginasDelLead(lead: LeadParaPixel, configs: readonly LandingConfig[], idDefault: number | null): { urls: string[]; deEntrada: boolean } {
  const propia = clavePagina(lead.pagina_registro);
  if (propia) return { urls: [propia], deEntrada: true };
  if (entroSinPagina(lead)) return { urls: [], deEntrada: false };
  const f = lead.funnel_id ?? null;
  const urls: string[] = [];
  for (const c of configs) {
    if (esPreviewDeEditor(c.url)) continue;
    const ids = c.funnelIds ?? [];
    // Una página sin funnels asignados manda sus leads al del negocio (lib/landing-funnel.ts, `funnelsDeLanding`).
    const va = f != null ? ids.includes(f) : !ids.length || (idDefault != null && ids.includes(idDefault));
    const k = va ? clavePagina(c.url) : null;
    if (k && !urls.includes(k)) urls.push(k);
  }
  return { urls: urls.slice(0, MAX_PAGINAS_A_REVISAR), deEntrada: false };
}

/** Desde cuándo se buscan eventos: 30 días, o desde una semana antes de que entrara si es más viejo (el Pixel pudo estar y sacarse). */
export function desdeParaElPixel(creadoAt: string | null | undefined, ahora: number): string {
  const treinta = ahora - 30 * 86_400_000;
  const t = creadoAt ? Date.parse(creadoAt) : NaN;
  return new Date(Number.isFinite(t) ? Math.min(treinta, t - 7 * 86_400_000) : treinta).toISOString();
}

/** Lo que va en el `ilike` de `landing_url`: host sin `www.` y camino, con los comodines escapados. Trae CANDIDATAS. */
export function pistaDePagina(clave: string): string | null {
  try {
    const u = new URL(clave);
    return `%${`${u.hostname.replace(/^www\./, '')}${u.pathname}`.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  } catch {
    return null;
  }
}

/** Con o sin `www.` es el mismo sitio: el código pegado en uno mide en los dos (uno redirige al otro). */
const sinWww = (clave: string | null) => clave?.replace(/^(https?:\/\/)www\./, '$1') ?? null;

/** ¿Midió el Pixel esa página? 'mide' con una fila que ES esa página; 'no-se' si el tope cortó la lectura; si no, 'no-mide'. */
export function veredictoDePagina(clave: string, filas: ReadonlyArray<{ landing_url: string | null }>, tope = FILAS_POR_PAGINA): 'mide' | 'no-mide' | 'no-se' {
  const k = sinWww(clave);
  if (filas.some((r) => sinWww(clavePagina(r.landing_url)) === k)) return 'mide';
  return filas.length >= tope ? 'no-se' : 'no-mide';
}

/**
 * Lo que se dice. La de su registro se afirma sola; las de su funnel, sólo si NINGUNA mide (si una mide, pudo entrar por
 * ésa sin dejar su identificador) y ninguna quedó en duda.
 */
export function sinPixelDe(deEntrada: boolean, veredictos: ReadonlyArray<{ url: string; v: 'mide' | 'no-mide' | 'no-se' }>): SinTracking | null {
  if (!veredictos.length) return null;
  if (deEntrada) return veredictos[0].v === 'no-mide' ? { como: 'sin-pixel', url: veredictos[0].url, deEntrada: true } : null;
  if (veredictos.some((x) => x.v !== 'no-mide')) return null;
  return { como: 'sin-pixel', url: veredictos[0].url, deEntrada: false };
}

/** El texto de la ficha. */
export function textoSinTracking(s: SinTracking): string {
  if (s.como === 'sin-pagina') return `${s.origen}, sin pasar por una página: no hay visitas que registrar.`;
  const pagina = s.url.replace(/^https?:\/\//, '');
  return s.deEntrada
    ? `La página ${pagina} por la que entró no tiene el Pixel de MaKo: lo que pase ahí no se registra.`
    : `La página ${pagina} de su funnel no tiene el Pixel de MaKo: lo que pase ahí no se registra.`;
}
