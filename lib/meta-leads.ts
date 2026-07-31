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

export const META_GRAPH_VERSION = process.env.META_API_VERSION || 'v24.0';

export type MetaFieldData = Array<{ name?: string; values?: string[] }>;

/**
 * Extrae el primer field cuyo `name` contenga alguno de los keywords
 * (case-insensitive). Devuelve su primer value (trim) o null.
 */
export function extractField(
  fieldData: MetaFieldData | undefined,
  names: string[],
): string | null {
  if (!fieldData) return null;
  const lowered = names.map((n) => n.toLowerCase());
  const found = fieldData.find(
    (f) => f.name && lowered.some((n) => f.name!.toLowerCase().includes(n)),
  );
  return found?.values?.[0]?.trim() || null;
}

export type LeadContacto = {
  email: string | null;
  nombre: string;
  telefono: string | null;
  empresa: string | null;
};

/**
 * Saca email / nombre / teléfono / empresa de un field_data de Meta.
 * Mismos keywords en el webhook y en el polling.
 */
export function parseLeadFields(fieldData: MetaFieldData | undefined): LeadContacto {
  const email = extractField(fieldData, ['email', 'correo']);
  const nombre =
    extractField(fieldData, [
      'full_name', 'full name', 'nombre completo', 'name', 'nombre',
    ]) ?? 'Lead sin nombre (Meta)';
  const telefono = extractField(fieldData, ['phone', 'teléfono', 'telefono', 'celular']);
  const empresa = extractField(fieldData, ['company', 'empresa', 'negocio', 'organiz']);
  return { email, nombre, telefono, empresa };
}

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
  field_data?: MetaFieldData;
};

export type PollLeadsResult = {
  dias: number;
  forms_revisados: number;
  leads_vistos: number;
  creados: number;
  existentes: number;
  errores: number;
  detalle_errores?: string[];
};

export async function pollMetaLeads(dias: number): Promise<PollLeadsResult> {
  const token = await credWs('META_PAGE_ACCESS_TOKEN');
  if (!token || token.startsWith('PENDING')) {
    throw new Error('META_PAGE_ACCESS_TOKEN no configurado');
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
    throw new Error('META_PAGE_ID no configurado para este workspace (Integraciones → Meta Ads → "ID de tu página de Facebook")');
  }

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
  const errores: string[] = [];

  for (const form of forms) {
    if (!form.id) continue;
    let leadsUrl: string | null =
      `${GRAPH}/${META_GRAPH_VERSION}/${form.id}/leads` +
      `?fields=created_time,ad_id,ad_name,adset_name,campaign_name,field_data` +
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
        vistos++;
        try {
          const { email, nombre, telefono, empresa } = parseLeadFields(lr.field_data);
          const { created } = await upsertLeadFromMeta({
            email,
            nombre,
            telefono,
            empresa,
            meta_lead_id: lr.id,
            meta_ad_id: lr.ad_id ?? null,
            meta_ad_name: lr.ad_name ?? null,
            meta_campaign_name: lr.campaign_name ?? null,
            meta_adset_name: lr.adset_name ?? null,
          });
          if (created) creados++;
          else existentes++;
        } catch (err) {
          errores.push(`lead ${lr.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      leadsUrl = cortar ? null : page.paging?.next ?? null;
    }
  }

  return {
    dias,
    forms_revisados: forms.length,
    leads_vistos: vistos,
    creados,
    existentes,
    errores: errores.length,
    ...(errores.length > 0 ? { detalle_errores: errores.slice(0, 10) } : {}),
  };
}
