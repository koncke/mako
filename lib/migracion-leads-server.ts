// =============================================================================
// migracion-leads-server — lo que la migración desde otro CRM necesita de la base
// =============================================================================
// La regla vive en lib/migracion-leads.ts (pura, con test). Acá: qué ids del CRM viejo ya entraron, y el alta de cada
// contacto por `createLead` (lib/leads.ts), que es la MISMA alta de siempre con tres campos más. Lo usa `migrar_contactos`
// (lib/api-mako/areas/crm.run.ts).
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { createLead } from './leads';
import { esLeadDuplicado } from './leads-duplicados';
import { etapasDeProducto } from './lead-funnel';
import { etapaDeEntrada } from './lead-funnel-reglas';
import { frenarAltaPorTope } from './topes-crm';
import {
  ORIGEN_MIGRACION, esLeadYaMigrado, ubicarEnEtapas, type ContactoMigrado,
} from './migracion-leads';

/** ¿La base todavía no tiene la 0405? (PostgREST 42703 o PGRST204 nombrando una de sus columnas). */
export function faltaLaMigracion(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e);
  return /id_externo|migrado_de|fecha_original/.test(m) && /(does not exist|could not find|42703|PGRST204)/i.test(m);
}

/** Lo que se le dice a quien migra cuando la base no contestó (o le falta la migración). */
export function textoSinMigracion(e: unknown): string {
  return faltaLaMigracion(e)
    ? 'Todavía no se puede migrar en este negocio: falta un cambio en la base de MaKo (la migración 0405). Avísale a soporte; no se creó nada.'
    : 'No pude ver qué contactos ya entraron antes. No se creó nada: intenta de nuevo en un momento.';
}

/** Los ids del CRM viejo que YA tienen un lead en este negocio. Tira si no puede leer (crear sin saber repite gente). */
export async function idsExternosQueYaEstan(migradoDe: string, ids: readonly string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (!ids.length) return out;
  const db = await getTenantDb();
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db.from('leads').select('id_externo').eq('migrado_de', migradoDe).in('id_externo', ids.slice(i, i + 100));
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as Array<{ id_externo: string | null }>) if (r.id_externo) out.add(r.id_externo);
  }
  return out;
}

export type ResultadoMigracion = {
  creados: number; yaEstaban: number; adoptados: number;
  errores: string[]; pendientes: string[]; leadIds: number[];
};

/** Un contacto del payload, de vuelta: lo guardado lo leyó una persona, pero se vuelve a leer porque viene de la base. */
function contactosDelPayload(v: unknown): Array<ContactoMigrado & { etapaKey: string }> {
  const out: Array<ContactoMigrado & { etapaKey: string }> = [];
  for (const c0 of Array.isArray(v) ? v : []) {
    const c = (c0 ?? {}) as Record<string, unknown>;
    const s = (k: string) => (typeof c[k] === 'string' && (c[k] as string).trim() ? (c[k] as string).trim() : null);
    const idExterno = s('idExterno'); const nombre = s('nombre'); const etapaKey = s('etapaKey');
    if (!idExterno || !nombre || !etapaKey) continue;
    out.push({
      i: Number(c.i) || 0, idExterno, nombre, etapaKey, etapa: etapaKey,
      email: s('email'), telefono: s('telefono'), instagram: s('instagram'), empresa: s('empresa'),
      fechaOriginal: s('fechaOriginal'),
      utm_source: s('utm_source'), utm_medium: s('utm_medium'), utm_campaign: s('utm_campaign'), utm_content: s('utm_content'),
    });
  }
  return out;
}

/**
 * Da de alta lo que se confirmó, de a uno, hasta `hasta` (lo que no llega vuelve en `pendientes`: el lote se puede mandar
 * de nuevo, y los que ya entraron se saltean por su id).
 *
 * Por contacto:
 *   · ya hay un lead con ese id del CRM viejo → «ya estaba» (`LeadYaMigradoError`), no se toca;
 *   · ya hay uno con ese email, teléfono o Instagram (entró antes por otro lado) → se le ANOTA el id del CRM viejo si no
 *     tenía (así un segundo intento lo encuentra por su id) y no se mueve ni se aquieta: ya es un lead vivo;
 *   · si sólo se parece por el nombre → se crea igual: el CRM viejo dice con su id que es otra persona;
 *   · si no, nace QUIETO en su etapa (`origen_lead: 'migracion'`).
 *
 * La etapa se vuelve a mirar contra el CRM de HOY: entre la propuesta y el «sí» alguien pudo borrarla o volverla final.
 */
export async function crearMigrados(ws: number, payload: Record<string, unknown>, hasta: number): Promise<ResultadoMigracion> {
  const r: ResultadoMigracion = { creados: 0, yaEstaban: 0, adoptados: 0, errores: [], pendientes: [], leadIds: [] };
  const crm = Number(payload.crm);
  const migradoDe = typeof payload.migradoDe === 'string' ? payload.migradoDe : '';
  if (!Number.isInteger(crm) || crm <= 0 || !migradoDe) throw new Error('la propuesta de migración vino incompleta');
  const etapas = await etapasDeProducto(crm);
  const pedidos = contactosDelPayload(payload.contactos);
  const { ubicados, afuera } = ubicarEnEtapas(pedidos, etapas, etapaDeEntrada(etapas));
  r.errores.push(...afuera);
  await frenarAltaPorTope(ws, 'crm.leads', ubicados.length);
  const db = await getTenantDb();
  for (let k = 0; k < ubicados.length; k++) {
    const c = ubicados[k];
    if (Date.now() > hasta) { r.pendientes.push(...ubicados.slice(k).map((x) => x.idExterno)); break; }
    const alta = {
      nombre: c.nombre, email: c.email, telefono: c.telefono, instagram: c.instagram, empresa: c.empresa,
      utm_source: c.utm_source, utm_medium: c.utm_medium, utm_campaign: c.utm_campaign, utm_content: c.utm_content,
      funnel_id: crm, pipeline_stage: c.etapaKey, origen_lead: ORIGEN_MIGRACION,
      id_externo: c.idExterno, migrado_de: migradoDe, fecha_original: c.fechaOriginal,
    };
    try {
      const lead = await createLead(alta);
      r.creados++; r.leadIds.push(lead.id);
    } catch (e) {
      if (esLeadYaMigrado(e)) { r.yaEstaban++; continue; }
      if (esLeadDuplicado(e)) {
        const porContacto = e.coincidencias.find((x) => x.motivo !== 'nombre');
        if (!porContacto) {
          try { const lead = await createLead({ ...alta, permitirDuplicado: true }); r.creados++; r.leadIds.push(lead.id); }
          catch (e2) { if (esLeadYaMigrado(e2)) r.yaEstaban++; else r.errores.push(`«${c.nombre}»: ${e2 instanceof Error ? e2.message : String(e2)}`); }
          continue;
        }
        const { data, error } = await db.from('leads')
          .update({ id_externo: c.idExterno, migrado_de: migradoDe, ...(c.fechaOriginal ? { fecha_original: c.fechaOriginal } : {}) })
          .eq('id', porContacto.lead.id).is('id_externo', null).select('id');
        if (error) r.errores.push(`«${c.nombre}» ya estaba y no le pude anotar su id: ${error.message}`);
        // Cero filas = ese lead ya tenía el id de OTRA migración: es la misma persona, que ya entró.
        else if (!(data ?? []).length) r.yaEstaban++;
        else r.adoptados++;
        continue;
      }
      r.errores.push(`«${c.nombre}»: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return r;
}
