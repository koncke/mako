// =============================================================================
// El DOCUMENTO FISCAL DEL CLIENTE de un lead (la constancia de situación fiscal, el RFC, el CUIT): el archivo a Storage
// (`contratos`, `<ws>/<lead>/fiscal/<ms>_<nombre>`) y su path en `deal_fiscal.doc_path`, sin tocar los demás datos
// fiscales. Lo usan la pantalla (app/api/extract-deal-fiscal: «Subir documento» del bloque «Datos fiscales») y MaKo desde
// el chat de la app (`guardar_documento_fiscal`, lib/api-mako/areas/cobros.*): la misma ruta y el mismo jsonb, en un solo
// lugar. Completar los datos que el documento dice va aparte: la pantalla los propone y MaKo los pasa por
// `escribirCampoDeal` (lib/pagos.ts), que deja el historial.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';

export const LEAD_NO_ENCONTRADO = 'lead no encontrado';

export async function guardarDocumentoFiscal(o: {
  ws: number;
  leadId: number;
  bytes: Buffer;
  mime: string;
  nombre: string;
}): Promise<{ ok: true; path: string; docNombre: string } | { ok: false; error: string }> {
  const db = await getTenantDb();
  const { data: lead } = await db.from('leads').select('id, deal_fiscal').eq('id', o.leadId).maybeSingle();
  if (!lead?.id) return { ok: false, error: LEAD_NO_ENCONTRADO };
  const safe = (o.nombre || 'fiscal').replace(/[^\w.\-]+/g, '_').slice(-80);
  const path = `${o.ws}/${o.leadId}/fiscal/${Date.now()}_${safe}`;
  const { error: upErr } = await db.storage.from('contratos').upload(path, o.bytes, { contentType: o.mime, upsert: true });
  if (upErr) return { ok: false, error: `storage: ${upErr.message}` };
  const docNombre = o.nombre || safe;
  const actual = (lead.deal_fiscal ?? {}) as Record<string, unknown>;
  const { error } = await db.from('leads').update({ deal_fiscal: { ...actual, doc_path: path, doc_nombre: docNombre } }).eq('id', o.leadId);
  if (error) return { ok: false, error: `leads: ${error.message}` };
  return { ok: true, path, docNombre };
}
