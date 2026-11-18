// =============================================================================
// meta-anuncio — la marca de «este lead de Meta ya se anunció», y quién la reclama (F117, 18/11/2026)
// =============================================================================
// Las reglas (qué es un reintento que hay que anunciar, quién gana el reclamo) viven en lib/meta-anuncio-reglas.ts, sin
// `server-only`, y se prueban ejecutándolas. Acá, las lecturas y las escrituras: la marca es una línea de `lead_audit`
// (sin migración, y en la ficha se lee), y «desde cuándo marca este negocio» una fila de `app_settings`.
//
// ⚠️ TODO FALLA HACIA «NO ANUNCIAR» EN UN REINTENTO: una lectura que no contesta no autoriza un segundo aviso. En la
// puerta que CREA el lead, en cambio, «no pude marcar» anuncia igual, como antes de la marca: ese lead es nuevo seguro.
// =============================================================================

import 'server-only';
import { getTenantDb, runWithWorkspace } from './workspace';
import { cambiarSettingSi, getSettingEstricto } from './settings';
import {
  CAMPO_ANUNCIO, CLAVE_MARCA_DESDE, LINEA_LEAD_ANUNCIADO, anunciarEnElReintento, ganaElReclamo, podriaSerReintento,
  type CandidatoReintento,
} from './meta-anuncio-reglas';

/** Los negocios que ya anotaron «desde cuándo marcan» en este proceso: la fila se escribe una vez, no en cada lead. */
const desdeAnotado = new Set<number>();

const filaDeMarca = (leadId: number) => ({
  lead_id: leadId, campo: CAMPO_ANUNCIO, valor_anterior: null, valor_nuevo: LINEA_LEAD_ANUNCIADO, autor: 'MaKo',
});

/** Anota la primera vez que este negocio marca (insertar-si-no-existe: el primero gana y la fecha no se mueve). */
async function anotarDesde(ws: number): Promise<void> {
  if (desdeAnotado.has(ws)) return;
  try {
    await cambiarSettingSi(CLAVE_MARCA_DESDE, null, new Date().toISOString());
    desdeAnotado.add(ws);
  } catch (e) {
    console.error(`[meta-anuncio] no pude anotar desde cuándo marca el ws ${ws}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Reclama el anuncio de un lead: escribe su marca y relee las del lead. `true` = esta puerta anuncia; `false` = otra ya lo
 * anuncia (y la marca de más se borra, para no ensuciar el historial); `null` = no se pudo saber.
 */
export async function reclamarAnuncio(ws: number, leadId: number): Promise<boolean | null> {
  try {
    return await runWithWorkspace(ws, async () => {
      const db = await getTenantDb();
      const { data: mia, error } = await db.from('lead_audit').insert([filaDeMarca(leadId)]).select('id').single();
      if (error || !mia) {
        console.error(`[meta-anuncio] no pude marcar el lead ${leadId} (ws ${ws}): ${error?.message ?? 'sin fila'}`);
        return null;
      }
      const propia = Number((mia as { id: unknown }).id);
      await anotarDesde(ws);
      const { data: marcas, error: e2 } = await db.from('lead_audit').select('id')
        .eq('lead_id', leadId).eq('campo', CAMPO_ANUNCIO).eq('valor_nuevo', LINEA_LEAD_ANUNCIADO)
        .order('id', { ascending: true }).limit(20);
      if (e2) {
        console.error(`[meta-anuncio] no pude releer las marcas del lead ${leadId} (ws ${ws}): ${e2.message}`);
        return null;
      }
      const gana = ganaElReclamo(propia, ((marcas ?? []) as Array<{ id: unknown }>).map((m) => Number(m.id)));
      if (gana === false) {
        const { error: e3 } = await db.from('lead_audit').delete().eq('id', propia);
        if (e3) console.error(`[meta-anuncio] no pude borrar la marca de más del lead ${leadId}: ${e3.message}`);
      }
      return gana;
    });
  } catch (e) {
    console.error(`[meta-anuncio] reclamo del lead ${leadId} (ws ${ws}): ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** La marca sin reclamo: la puerta que creó el lead y no pudo marcarlo ANTES lo intenta una vez más DESPUÉS de anunciar. */
export async function marcarAnunciado(ws: number, leadId: number): Promise<void> {
  try {
    await runWithWorkspace(ws, async () => {
      const { error } = await (await getTenantDb()).from('lead_audit').insert([filaDeMarca(leadId)]);
      if (error) throw new Error(error.message);
      await anotarDesde(ws);
    });
  } catch (e) {
    console.error(`[meta-anuncio] tampoco pude marcar después el lead ${leadId} (ws ${ws}): ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * De estos leads que YA estaban (la entrega los encontró: `created: false`), los que hay que anunciar porque su anuncio se
 * cayó. Dos lecturas para todos juntos (las marcas y «desde cuándo»), y sólo si alguno pasa el filtro sin base. Cualquier
 * error es «ninguno».
 */
export async function sinAnunciarDe(ws: number, candidatos: ReadonlyArray<CandidatoReintento>, ahoraMs = Date.now()): Promise<Set<number>> {
  const posibles = candidatos.filter((c) => Number.isFinite(c.id) && podriaSerReintento(c, ahoraMs));
  if (!posibles.length) return new Set();
  try {
    return await runWithWorkspace(ws, async () => {
      const marcaDesde = await getSettingEstricto(CLAVE_MARCA_DESDE);
      if (!marcaDesde) return new Set<number>();
      const db = await getTenantDb();
      const marcados = new Set<number>();
      // De a 100: los ids viajan en la URL del pedido.
      for (let i = 0; i < posibles.length; i += 100) {
        const { data, error } = await db.from('lead_audit').select('lead_id')
          .eq('campo', CAMPO_ANUNCIO).eq('valor_nuevo', LINEA_LEAD_ANUNCIADO).in('lead_id', posibles.slice(i, i + 100).map((c) => c.id));
        if (error) {
          console.error(`[meta-anuncio] no pude leer las marcas (ws ${ws}): ${error.message}`);
          return new Set<number>();
        }
        for (const f of (data ?? []) as Array<{ lead_id: unknown }>) marcados.add(Number(f.lead_id));
      }
      return new Set(posibles.filter((c) => anunciarEnElReintento({ candidato: c, marcado: marcados.has(c.id), marcaDesde, ahoraMs })).map((c) => c.id));
    });
  } catch (e) {
    console.error(`[meta-anuncio] reintentos (ws ${ws}): ${e instanceof Error ? e.message : String(e)}`);
    return new Set();
  }
}

/** Lo mismo para UN lead (el webhook de Meta, el de Zernio). */
export async function reintentoSinAnunciar(ws: number, candidato: CandidatoReintento, ahoraMs = Date.now()): Promise<boolean> {
  return (await sinAnunciarDe(ws, [candidato], ahoraMs)).has(candidato.id);
}
