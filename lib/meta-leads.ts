// =============================================================================
// Meta Lead Ads — parseo compartido de field_data + polling por workspace
// =============================================================================
// El webhook (tiempo real) y el cron de polling (red de seguridad) leen el
// mismo field_data de los leads. Este helper centraliza el parseo Y el polling
// (pollMetaLeads) para que el cron y la extracción del onboarding usen
// exactamente la misma lógica.
// =============================================================================

import 'server-only';
import { upsertLeadFromMeta } from './leads';
import { credWs } from './credenciales';
import { getWorkspaceActual, OWNER_WS } from './workspace';
import { META_PAGE_ID } from './config';
import { esDelWebhookTodavia, esNuevoParaElNegocio } from './meta-leads-poll-reglas';
import { sinAnunciarDe } from './meta-anuncio';
import type { CandidatoReintento } from './meta-anuncio-reglas';

export const META_GRAPH_VERSION = process.env.META_API_VERSION || 'v24.0';

// ─────────────────────────────────────────────────────────────────────────────
// El parser de field_data vive en ./meta-leads-campos
// ─────────────────────────────────────────────────────────────────────────────
// Se mudó el 04/10/2026 por una razón y una sola: ese módulo NO tiene
// `server-only`, así que sus decisiones —qué campo se reconoce, qué se descarta
// y qué columna cruda se pisa— se pueden EJECUTAR en un test. Este archivo sí lo
// tiene (línea 10), y con él puesto cualquier import desde `npm test` revienta.
//
// Se re-exporta para que los dos caminos de ingesta (el webhook y el poll) sigan
// importando de un solo lugar: una cosa, un lugar.
import { parseLeadFields, type MetaFieldData } from './meta-leads-campos';

export {
  extractField,
  parseLeadFields,
  tieneRespuestas,
  fechaDeMeta,
  columnasCrudasDeMeta,
  rastroDescartes,
  KEYWORDS_CONTACTO,
  NOMBRE_SIN_NOMBRE,
  CAMPO_RESPUESTAS_META,
} from './meta-leads-campos';
export type {
  MetaFieldData,
  LeadContacto,
  ColumnasCrudasDeMeta,
} from './meta-leads-campos';

// ─────────────────────────────────────────────────────────────────────────────
// Polling de leads por workspace (cron diario + backfill del onboarding)
// ─────────────────────────────────────────────────────────────────────────────
// Recorre los formularios de la página del WORKSPACE actual y upsertea los
// leads de los últimos `dias` (Meta retiene 90). upsertLeadFromMeta deduplica
// por meta_lead_id → re-correr no duplica nada.

const GRAPH = 'https://graph.facebook.com';
const PAGE_SIZE = 100;
const MAX_PAGES = 100; // tope de seguridad (con dias=90 y 2 forms ~ varias páginas)

type GraphPage<T> = {
  data?: T[];
  paging?: { next?: string };
  error?: { code?: number; message?: string };
};

async function graphGet<T>(url: string): Promise<GraphPage<T>> {
  const res = await fetch(url);
  const body = (await res.json()) as GraphPage<T>;
  if (body.error) {
    throw new Error(`Graph error (${body.error.code}): ${body.error.message}`);
  }
  return body;
}

type FormRow = { id?: string; name?: string };
type LeadRow = {
  id?: string;
  created_time?: string;
  ad_id?: string;
  ad_name?: string;
  adset_name?: string;
  campaign_name?: string;
  campaign_id?: string;
  adset_id?: string;
  field_data?: MetaFieldData;
};

export type PollLeadsResult = {
  dias: number;
  forms_revisados: number;
  leads_vistos: number;
  creados: number;
  existentes: number;
  /** los de menos de 5 minutos, que se dejan para el webhook (lib/meta-leads-poll-reglas.ts). */
  del_webhook: number;
  /** los creados recientes que el poll ANUNCIÓ: el aviso, los flujos y las automatizaciones (`alNacerLeadDeMeta`, #868). */
  anunciados: number;
  /** los que ya estaban y se anunciaron ahora porque su anuncio se había caído (F117, lib/meta-anuncio.ts). */
  reanunciados: number;
  errores: number;
  detalle_errores?: string[];
};

/**
 * Lo que la ingesta de leads de Meta EXIGE para poder correr, resuelto en UN lugar.
 *
 * Existe porque la pregunta se contestaba DOS veces y las dos respuestas se
 * separaron: `pollMetaLeads` lee la credencial del catalogo y el gate del
 * onboarding (`jobAplica` en lib/onboarding-extract.ts) leia la SETTING
 * homonima en minuscula, que nadie escribe desde que el page id vive como
 * credencial. Resultado: el job `meta_leads` quedaba `skipped` con «Falta
 * token de pagina o ID de pagina» en un workspace donde la ingesta funcionaba
 * perfecto — o sea el historico de leads no llegaba nunca, sin un error, y el
 * CRM del cliente nuevo arrancaba vacio (tarea #171).
 *
 * Quien pregunte «¿puedo ingerir leads?» llama a esto. Un segundo lector que
 * resuelva el page id por su cuenta es el mismo bug otra vez.
 */
export type CredLeads =
  | { ok: true; token: string; pageId: string }
  | { ok: false; motivo: string };

export async function credencialesDeLeads(): Promise<CredLeads> {
  const token = await credWs('META_PAGE_ACCESS_TOKEN');
  if (!token || token.startsWith('PENDING')) {
    return { ok: false, motivo: 'META_PAGE_ACCESS_TOKEN no configurado' };
  }
  // El page id sale de la MISMA credencial del catálogo que el cliente carga en
  // /integraciones (META_PAGE_ID), no de una setting aparte. Antes esto leía
  // configWs('meta_page_id'): el cliente completaba el campo, el webhook andaba
  // (usa webhook_routing) y este cron tiraba "no configurado" todos los días,
  // porque eran DOS almacenes distintos y nada escribía el de la setting.
  //
  // La credencial es la fuente de verdad correcta porque guardarla pasa por
  // guardarCredencial(), que reclama el identificador en webhook_routing y falla
  // cerrado (IdentificadorOcupadoError) si ya es de otro workspace. setSetting
  // también espeja el routing, pero IGNORA el resultado: un "ocupado" se tragaba
  // en silencio y quedaba un page id guardado que no rutea a ningún lado.
  //
  // El fallback al literal (página de Mauricio) es SOLO para el dueño; un cliente
  // sin la credencial queda fail-closed (jamás ingiere leads ajenos).
  const ws = await getWorkspaceActual();
  const pageId = (await credWs('META_PAGE_ID')) ?? (ws === OWNER_WS || ws == null ? META_PAGE_ID : null);
  if (!pageId) {
    return { ok: false, motivo: 'META_PAGE_ID no configurado para este workspace (Integraciones → Meta Ads → "ID de tu página de Facebook")' };
  }
  return { ok: true, token, pageId: String(pageId) };
}

export async function pollMetaLeads(dias: number): Promise<PollLeadsResult> {
  const cred = await credencialesDeLeads();
  if (!cred.ok) throw new Error(cred.motivo);
  const { token, pageId } = cred;
  const corteMs = Date.now() - Math.max(1, dias) * 86400_000;

  // 1) Listar formularios activos de la página
  const forms: FormRow[] = [];
  let formsUrl: string | null =
    `${GRAPH}/${META_GRAPH_VERSION}/${pageId}/leadgen_forms` +
    `?fields=id,name&limit=${PAGE_SIZE}&access_token=${token}`;
  let formPages = 0;
  while (formsUrl && formPages++ < MAX_PAGES) {
    const page: GraphPage<FormRow> = await graphGet<FormRow>(formsUrl);
    if (Array.isArray(page.data)) forms.push(...page.data);
    formsUrl = page.paging?.next ?? null;
  }

  // 2) Por cada form, traer leads recientes y upsertear
  let vistos = 0;
  let creados = 0;
  let existentes = 0;
  let delWebhook = 0;
  let anunciados = 0;
  let reanunciados = 0;
  // Los que ya estaban, por si su anuncio se cayó (F117): se miran todos juntos al final, en una lectura.
  const yaEstaban: Array<CandidatoReintento & { nombre: string; telefono: string | null; fieldData: MetaFieldData | null; campana: string | null; formId?: string | null }> = [];
  const ahoraMs = Date.now();
  const errores: string[] = [];

  for (const form of forms) {
    if (!form.id) continue;
    let leadsUrl: string | null =
      `${GRAPH}/${META_GRAPH_VERSION}/${form.id}/leads` +
      // `campaign_id,adset_id`: los mismos dos que pide el webhook. Si una de las dos
      // puertas los pidiera y la otra no, el mismo lead naceria en un producto u otro
      // segun por donde entro — sin error, y sin forma de saberlo despues.
      `?fields=created_time,ad_id,ad_name,adset_name,campaign_name,campaign_id,adset_id,field_data` +
      `&limit=${PAGE_SIZE}&access_token=${token}`;
    let leadPages = 0;
    let cortar = false;

    while (leadsUrl && !cortar && leadPages++ < MAX_PAGES) {
      const page: GraphPage<LeadRow> = await graphGet<LeadRow>(leadsUrl);
      for (const lr of page.data ?? []) {
        // Cortar cuando los leads se vuelven más viejos que la ventana
        if (lr.created_time && new Date(lr.created_time).getTime() < corteMs) {
          cortar = true;
          break;
        }
        if (!lr.id) continue;
        // Uno recién llegado es del webhook: si lo toma el poll, el webhook se saltea el aviso
        // y la nutrición inmediata. La próxima pasada (10 min) lo levanta.
        if (esDelWebhookTodavia(lr.created_time, ahoraMs)) { delWebhook++; continue; }
        vistos++;
        try {
          const { email, nombre, telefono, empresa, noReconocidos } = parseLeadFields(lr.field_data);
          const { created, lead } = await upsertLeadFromMeta({
            email,
            nombre,
            telefono,
            empresa,
            // El formulario del bucle (20/11/2026): asignado en «Asignar fuentes», decide el funnel (lib/formulario-meta-funnel.ts).
            meta_form_id: form.id,
            meta_lead_id: lr.id,
            meta_ad_id: lr.ad_id ?? null,
            meta_ad_name: lr.ad_name ?? null,
            meta_campaign_name: lr.campaign_name ?? null,
            meta_adset_name: lr.adset_name ?? null,
            meta_campaign_id: lr.campaign_id ?? null,
            meta_adset_id: lr.adset_id ?? null,
            // Las respuestas CRUDAS y la fecha real de Meta. El poll ya las pedía
            // () y el created_time sólo servía para cortar la
            // ventana de arriba, así que un lead rescatado de hace 60 días nacía con
            // la fecha de la INGESTA. Y el field_data entero se descartaba: el día que
            // entre el primer lead del ws13 —cinco formularios con preguntas propias—
            // esa respuesta no tiene columna, y Meta la borra a los 90 días.
            meta_field_data: lr.field_data ?? null,
            meta_created_at: lr.created_time ?? null,
            meta_campos_no_reconocidos: noReconocidos,
          });
          if (created) creados++;
          else {
            existentes++;
            yaEstaban.push({
              id: lead.id, creadoAt: lead.created_at, formCreadoEn: lr.created_time ?? null,
              nombre: lead.nombre, telefono: lead.telefono ?? null, fieldData: lr.field_data ?? null, campana: lr.campaign_name ?? null, formId: form.id,
            });
          }
          // ⚠️ LO INMEDIATO TAMBIÉN DESDE ACÁ (17/10/2026, #868): una página sin suscribir no recibe el webhook nunca, y
          // sus leads entraban sin disparar ninguna automatización. Sólo uno recién creado y RECIENTE: un rescate de
          // días no se anuncia como nuevo (`esNuevoParaElNegocio`). Import dinámico: el motor no viaja con cada importador.
          if (created && esNuevoParaElNegocio(lr.created_time, ahoraMs)) {
            const ws = await getWorkspaceActual();
            if (ws != null) {
              const { alNacerLeadDeMeta } = await import('./meta-lead-nuevo');
              await alNacerLeadDeMeta(ws, { id: lead.id, nombre: lead.nombre, telefono: lead.telefono }, {
                fieldData: lr.field_data ?? null, campana: lr.campaign_name ?? null, formId: form.id,
              });
              anunciados++;
            }
          } else if (created) {
            // Un rescate viejo no se ANUNCIA, pero sí se CALIFICA (20/11/2026): ubicarlo en su etapa no le escribe a nadie.
            const { calificarLeadDeMeta } = await import('./meta-lead-nuevo');
            await calificarLeadDeMeta(lead.id, form.id, lr.field_data ?? null);
          }
        } catch (err) {
          errores.push(`lead ${lr.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      leadsUrl = cortar ? null : page.paging?.next ?? null;
    }
  }

  // ⚠️ EL QUE YA ESTABA Y NO SE ANUNCIÓ (F117, 18/11/2026): la puerta que lo creó se cayó después del insert. Sólo los que
  // pasan las reglas de lib/meta-anuncio-reglas.ts (sin la marca del anuncio, el mismo lead nuevo de hoy), y cada uno
  // reclama antes de anunciar: si el webhook lo está anunciando a la vez, sale una vez.
  if (yaEstaban.length) {
    const ws = await getWorkspaceActual();
    if (ws != null) {
      const sinAnunciar = await sinAnunciarDe(ws, yaEstaban, ahoraMs);
      if (sinAnunciar.size) {
        const { alNacerLeadDeMeta } = await import('./meta-lead-nuevo');
        for (const c of yaEstaban.filter((x) => sinAnunciar.has(x.id))) {
          try {
            await alNacerLeadDeMeta(ws, { id: c.id, nombre: c.nombre, telefono: c.telefono }, { fieldData: c.fieldData, campana: c.campana, formId: c.formId }, { esReintento: true });
            reanunciados++;
          } catch (err) {
            errores.push(`lead ${c.id} (anuncio): ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    }
  }

  return {
    dias,
    forms_revisados: forms.length,
    leads_vistos: vistos,
    creados,
    existentes,
    del_webhook: delWebhook,
    anunciados,
    reanunciados,
    errores: errores.length,
    ...(errores.length > 0 ? { detalle_errores: errores.slice(0, 10) } : {}),
  };
}
