// =============================================================================
// campaign-structurer — MaKo propone la estructura de una campaña nueva
// =============================================================================
// Arma el prompt (plantillas editables con {{slots}}) y el "brief" del negocio
// (funnel + perfil + KPIs + ganadores + conocimiento + presupuesto típico) para
// que MaKo proponga un CampaignSpec aterrizado, y parsea/coacciona su JSON.
// El objetivo lo ELIGE MaKo a partir del funnel (fuente de verdad). Todo lo que
// propone es editable por el usuario antes de publicar (siempre en PAUSA).
// =============================================================================

import 'server-only';
import { getActivePersona, MAKO_NUCLEO } from './mako-prompts';
import { getFunnel } from './leads';
import { perfilNegocioTexto } from './onboarding';
import { getSenalesRecon, getMarketingWindow, getRevenuePeriod } from './queries';
import { searchKnowledge, formatKnowledge } from './mako-knowledge';
import { ayerEnTijuana } from './date-utils';
import {
  type CampaignSpec, type AdSetSpec, type AdSpec, type Creative, type Targeting,
  type Objective, type CTAType, type BudgetLevel,
  OBJETIVOS, objetivoDef, CTA_OPCIONES,
} from './campaign-types';

// ── Metodología (Jan: intención + ritmo) — sale del comentario de getSenalesRecon
//    para que MaKo la use como criterio al estructurar/escalar. Editable. ────────
export const CAMPAIGN_METODOLOGIA = `CÓMO DECIDIR LA ESTRUCTURA (método de adquisición de Jan, aplicalo):
- Para un funnel VSL/leads NO hace falta inventar mil conjuntos: poca segmentación, dejá que Meta optimice (Advantage+ amplio) salvo que el usuario pida abrir públicos nuevos o retargeting.
- Validá por INTENCIÓN (≥10 leads de una versión de oferta) y por RITMO (que el conjunto gaste su presupuesto diario completo 3 días seguidos). Intención sin ritmo = falso positivo → replicar (snowball), no escalar en vertical.
- Si hay un creativo GANADOR (te paso los de mejor rendimiento), proponé REPLICARLO en un conjunto nuevo antes que inventar uno de cero.
- Empezá simple: 1 campaña, 1-2 conjuntos, 1-2 anuncios. Presupuesto diario realista contra el gasto/CAC histórico que te paso.
- Apagá lo que tras ~$80 USD y 4 días no trae leads.`;

// ── Contrato JSON exacto que MaKo debe devolver (editable como referencia) ──────
export const CAMPAIGN_JSON_SHAPE = `Devolvé EXCLUSIVAMENTE un objeto JSON válido (sin markdown, sin texto fuera del JSON) con esta forma EXACTA:
{
  "name": "nombre claro de la campaña",
  "objective": "OUTCOME_LEADS | OUTCOME_SALES | OUTCOME_TRAFFIC | OUTCOME_ENGAGEMENT | OUTCOME_AWARENESS",
  "budget_level": "campaign | adset",
  "daily_budget_mxn": <número en MXN si budget_level=campaign, si no null>,
  "rationale": "2-4 líneas en tu voz: por qué este objetivo y esta estructura, contra los datos que te pasé",
  "adsets": [
    {
      "name": "nombre del conjunto",
      "daily_budget_mxn": <número en MXN si budget_level=adset, si no null>,
      "optimization_goal": "LEAD_GENERATION | OFFSITE_CONVERSIONS | LANDING_PAGE_VIEWS | LINK_CLICKS | REACH",
      "targeting": {
        "geo_locations": { "countries": ["MX"] },
        "age_min": <13-65>, "age_max": <13-65>,
        "genders": [],                       // [] = todos · [1] = hombres · [2] = mujeres
        "interests": [{ "name": "interés sugerido" }],  // SOLO nombres; el usuario los confirma
        "advantage_audience": 1,             // 1 = Advantage+ amplio (recomendado para VSL)
        "publisher_platforms": ["facebook","instagram"]
      },
      "ads": [
        {
          "name": "nombre del anuncio",
          "creative": {
            "source": "upload | existing",
            "source_ad_id": "<ad_id de un ganador si source=existing, si no null>",
            "primary_text": "copy principal del anuncio",
            "headline": "título corto",
            "description": "opcional",
            "cta_type": "LEARN_MORE | SIGN_UP | GET_OFFER | APPLY_NOW | ...",
            "destination_url": "URL de la landing/VSL de destino"
          }
        }
      ]
    }
  ]
}
Reglas: no inventes ids de intereses (solo nombres); no inventes audiencias personalizadas; usá MXN para presupuestos; si el usuario te pasó creativos para subir, dejá source="upload"; si recomendás replicar un ganador, source="existing" con su ad_id.`;

// ── Plantillas (con {{slots}}) — editables en /configuraciones ─────────────────
export const CAMPAIGN_SUGGEST_SYSTEM_TEMPLATE = `Sos MaKo y estás armando una CAMPAÑA NUEVA de Meta Ads para el negocio. Tu trabajo: proponer una estructura campaña → conjunto(s) → anuncio(s) aterrizada en los DATOS REALES del negocio que te paso (funnel, KPIs, ganadores), lista para que el usuario la edite y publique.

ELEGÍ EL OBJETIVO a partir del FUNNEL (es la fuente de verdad): si el funnel entra por formulario instantáneo → OUTCOME_LEADS con optimization LEAD_GENERATION; si entra por una landing/VSL con pixel → OUTCOME_SALES/OUTCOME_TRAFFIC; etc.

{{metodologia}}

Objetivos disponibles y su optimización por defecto:
{{objetivos}}

{{jsonShape}}`;

export const CAMPAIGN_SUGGEST_USER_TEMPLATE = `PEDIDO DEL USUARIO:
{{prompt}}

CREATIVOS QUE TE PASÓ:
{{creativos}}

CONTEXTO DEL NEGOCIO (datos reales):
{{contexto}}

Devolvé el JSON del CampaignSpec con tu propuesta.`;

export const CAMPAIGN_ADJUST_SYSTEM_TEMPLATE = `Sos MaKo ajustando una campaña que YA propusiste. El usuario te pide cambios. Aplicá SOLO lo que pide, conservando todo lo demás del spec actual. Mantené la coherencia (objetivo ↔ optimization ↔ promoted_object). No inventes ids de intereses ni audiencias.

{{jsonShape}}`;

export const CAMPAIGN_ADJUST_USER_TEMPLATE = `SPEC ACTUAL (JSON):
{{specActual}}

CAMBIO QUE PIDE EL USUARIO:
{{instruccion}}

CONTEXTO DEL NEGOCIO (por si lo necesitás):
{{contexto}}

Devolvé el JSON COMPLETO del CampaignSpec ya ajustado.`;

// Texto de objetivos para el slot {{objetivos}}.
export function objetivosTexto(): string {
  return OBJETIVOS.map((o) => `- ${o.value} (${o.label}): optimization ${o.optimization_goal}${o.promoted === 'pixel' ? ' · requiere pixel' : o.promoted === 'page' ? ' · usa la página (formulario)' : ''}. ${o.hint}`).join('\n');
}

// ── Brief del negocio (grounding) ──────────────────────────────────────────────

function rangoUltimosDias(dias: number): { desde: string; hasta: string } {
  const hasta = ayerEnTijuana();
  const d = new Date(`${hasta}T12:00:00`);
  d.setDate(d.getDate() - dias);
  return { desde: d.toISOString().slice(0, 10), hasta };
}

const usd = (n: number | null | undefined, dec = 2) => (n == null || !Number.isFinite(n) ? '—' : `$${n.toFixed(dec)}`);
const mxn0 = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '—' : `$${Math.round(n).toLocaleString('es-MX')} MXN`);
const TC = 17.3; // USD→MXN (espeja TIPO_DE_CAMBIO_USD_MXN de config)

/**
 * Compone el contexto del negocio para el prompt: funnel + perfil + KPIs +
 * ganadores + conocimiento + presupuesto típico. Tolerante a fallos (cada
 * bloque degrada a "—" sin romper la sugerencia).
 */
export async function buildCampaignBrief(prompt: string): Promise<string> {
  const { desde, hasta } = rangoUltimosDias(30);

  const [funnelTxt, perfilTxt, kpisTxt, ganadoresTxt, presupuestoTxt, conocimientoTxt] = await Promise.all([
    (async () => {
      try {
        const f = await getFunnel();
        const etapas = f.pipeline.map((s) => `${s.label}${s.kind ? ` (${s.kind})` : ''}`).join(' → ');
        const entrada = f.pipeline.find((s) => s.kind === 'entrada');
        return `Etapas del funnel: ${etapas}.\nEntrada: ${entrada ? `${entrada.label} (${entrada.kind})` : '—'}. Inferí el objetivo de campaña de cómo entra la gente.`;
      } catch { return '—'; }
    })(),
    perfilNegocioTexto().catch(() => '—'),
    (async () => {
      try {
        const [w, r] = await Promise.all([getMarketingWindow(desde, hasta), getRevenuePeriod(desde, hasta)]);
        return [
          `Ventana ${desde} → ${hasta} (${w.dias_con_datos} días con datos):`,
          `Gasto: ${usd(w.spend_usd)} USD · Leads: ${w.leads_count} · Agendas: ${w.agendamientos}`,
          `CPL: ${usd(w.cpl_global)} · CPM: ${usd(w.cpm_global)} · CPC: ${usd(w.cpc_global)} · CTR: ${w.ctr_global != null ? (w.ctr_global * 100).toFixed(2) + '%' : '—'}`,
          `CAC: ${usd(r.cac_usd)} USD · ROAS (cash): ${r.roas_cash != null ? r.roas_cash.toFixed(2) + 'x' : '—'} · Ticket vendido: ${usd(r.sold_revenue_usd, 0)}`,
        ].join('\n');
      } catch { return '—'; }
    })(),
    (async () => {
      try {
        const s = await getSenalesRecon(desde, hasta);
        const top = [...s].sort((a, b) => b.leads - a.leads || b.spend_usd - a.spend_usd).slice(0, 6);
        if (!top.length) return 'Sin anuncios con datos en la ventana.';
        return ['Anuncios con mejor rendimiento (para replicar ganadores):',
          ...top.map((a) => `- ad_id=${a.ad_id} · "${a.ad_name}" · leads ${a.leads} · CPL ${usd(a.cpl_usd)} · gasto ${usd(a.spend_usd, 0)} · veredicto ${a.veredicto}`)].join('\n');
      } catch { return '—'; }
    })(),
    (async () => {
      try {
        const w = await getMarketingWindow(desde, hasta);
        if (!w.dias_con_datos) return 'Sin histórico de gasto: sugerí un presupuesto conservador.';
        const diarioUsd = w.spend_usd / Math.max(1, w.dias_con_datos);
        return `Gasto diario promedio reciente: ${usd(diarioUsd)} USD (~${mxn0(diarioUsd * TC)}). Usalo como referencia para el presupuesto diario.`;
      } catch { return '—'; }
    })(),
    (async () => {
      try {
        const k = await searchKnowledge(prompt || 'estructura de campaña de adquisición Meta Ads VSL', 4);
        return k.length ? formatKnowledge(k) : '';
      } catch { return ''; }
    })(),
  ]);

  return [
    `## FUNNEL\n${funnelTxt}`,
    `## PERFIL DEL NEGOCIO\n${perfilTxt}`,
    `## KPIs RECIENTES\n${kpisTxt}`,
    `## GANADORES\n${ganadoresTxt}`,
    `## PRESUPUESTO\n${presupuestoTxt}`,
    conocimientoTxt ? `## CONOCIMIENTO (método)\n${conocimientoTxt}` : '',
  ].filter(Boolean).join('\n\n');
}

/** System prompt branded (persona + núcleo + plantilla ya renderizada). */
export async function brandSystem(rendered: string): Promise<string> {
  const persona = await getActivePersona().catch(() => '');
  return [persona, MAKO_NUCLEO, rendered].filter(Boolean).join('\n\n');
}

// ── Parseo + coerción del JSON de MaKo → CampaignSpec ──────────────────────────

export function parseJsonObject(text: string): Record<string, unknown> {
  const c = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const a = c.indexOf('{'), b = c.lastIndexOf('}');
  if (a === -1 || b <= a) throw new Error('respuesta sin JSON');
  return JSON.parse(c.slice(a, b + 1));
}

const OBJ_VALUES = new Set(OBJETIVOS.map((o) => o.value));
const OPT_VALUES = new Set(['LEAD_GENERATION', 'OFFSITE_CONVERSIONS', 'LANDING_PAGE_VIEWS', 'LINK_CLICKS', 'REACH', 'IMPRESSIONS', 'THRUPLAY', 'POST_ENGAGEMENT']);
const CTA_VALUES = new Set(CTA_OPCIONES.map((c) => c.value));

const num = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function coerceTargeting(raw: unknown): Targeting {
  const t = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: Targeting = {};
  const geo = (t.geo_locations && typeof t.geo_locations === 'object' ? t.geo_locations : {}) as Record<string, unknown>;
  const countries = Array.isArray(geo.countries) ? geo.countries.map(String).filter(Boolean) : [];
  out.geo_locations = { countries: countries.length ? countries : ['MX'] };
  const amin = num(t.age_min); if (amin) out.age_min = Math.min(65, Math.max(13, Math.round(amin)));
  const amax = num(t.age_max); if (amax) out.age_max = Math.min(65, Math.max(13, Math.round(amax)));
  if (Array.isArray(t.genders)) { const g = t.genders.map(Number).filter((x) => x === 1 || x === 2); if (g.length) out.genders = g; }
  // intereses: MaKo solo manda nombres (sin id). Se guardan para que el usuario los resuelva.
  const interests = Array.isArray(t.interests) ? t.interests : [];
  const named = interests.map((i) => { const o = (i && typeof i === 'object' ? i : {}) as Record<string, unknown>; return { id: str(o.id), name: str(o.name) }; }).filter((i) => i.name);
  if (named.length) out.flexible_spec = [{ interests: named }];
  const adv = num(t.advantage_audience); if (adv === 0 || adv === 1) out.advantage_audience = adv as 0 | 1;
  if (Array.isArray(t.publisher_platforms)) { const p = t.publisher_platforms.map(String).filter(Boolean); if (p.length) out.publisher_platforms = p; }
  return out;
}

function coerceCreative(raw: unknown, objective: Objective): Creative {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const source = c.source === 'existing' ? 'existing' : 'upload';
  const ctaRaw = str(c.cta_type) as CTAType;
  const cta = CTA_VALUES.has(ctaRaw) ? ctaRaw : (objective === 'OUTCOME_LEADS' ? 'SIGN_UP' : 'LEARN_MORE');
  return {
    source,
    source_ad_id: source === 'existing' ? str(c.source_ad_id) || null : null,
    primary_text: str(c.primary_text),
    headline: str(c.headline),
    description: str(c.description),
    cta_type: cta,
    destination_url: str(c.destination_url),
    media_type: source === 'upload' ? 'image' : undefined,
    image_hash: null, video_id: null,
  };
}

function coerceAd(raw: unknown, idx: number, objective: Objective): AdSpec {
  const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return { name: str(a.name) || `Anuncio ${idx + 1}`, creative: coerceCreative(a.creative, objective) };
}

function coerceAdSet(raw: unknown, idx: number, objective: Objective, budgetLevel: BudgetLevel): AdSetSpec {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const def = objetivoDef(objective);
  const optRaw = str(s.optimization_goal);
  const ads = Array.isArray(s.ads) && s.ads.length ? s.ads.map((x, i) => coerceAd(x, i, objective)) : [coerceAd({}, 0, objective)];
  const budget = num(s.daily_budget_mxn);
  return {
    name: str(s.name) || `Conjunto ${idx + 1}`,
    daily_budget_mxn: budgetLevel === 'adset' ? (budget && budget > 0 ? budget : 200) : null,
    optimization_goal: OPT_VALUES.has(optRaw) ? optRaw : def.optimization_goal,
    billing_event: def.billing_event,
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    targeting: coerceTargeting(s.targeting),
    ads,
  };
}

/** Coacciona el JSON de MaKo a un CampaignSpec válido (con defaults sanos). */
export function parseCampaignSpec(text: string, fallbackObjective: Objective = 'OUTCOME_LEADS'): CampaignSpec {
  const raw = parseJsonObject(text);
  const objRaw = str(raw.objective) as Objective;
  const objective: Objective = OBJ_VALUES.has(objRaw) ? objRaw : fallbackObjective;
  const budget_level: BudgetLevel = raw.budget_level === 'adset' ? 'adset' : 'campaign';
  const adsetsRaw = Array.isArray(raw.adsets) && raw.adsets.length ? raw.adsets : [{}];
  const adsets = adsetsRaw.map((x, i) => coerceAdSet(x, i, objective, budget_level));
  const campBudget = num(raw.daily_budget_mxn);
  return {
    name: str(raw.name) || 'Campaña nueva',
    objective,
    special_ad_categories: [],
    budget_level,
    daily_budget_mxn: budget_level === 'campaign' ? (campBudget && campBudget > 0 ? campBudget : 300) : null,
    adsets,
    rationale: str(raw.rationale),
  };
}
