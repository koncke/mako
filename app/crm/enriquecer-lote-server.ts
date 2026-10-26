// =============================================================================
// Completar en LOTE desde el tablero (24/10/2026) — los leads que la persona tildó
// =============================================================================
// Martín: «¿cómo comienzo a scrapear los datos de mis leads?... Eso debería poder hacerlo en lote, con el multiple check, no
// sólo cuando cargo nuevos de grupos». Hasta acá «Completar desde mi WhatsApp» y «Datos de empresa» vivían adentro del modal de
// traer de un grupo, o sea que sólo alcanzaban a lo que estaba entrando. Esto los lleva a la barra de lote del CRM
// (app/crm/AccionesLoteLeads.tsx), sobre los tildados. Los NÚCLEOS son los mismos del grupo (app/crm/grupo-wa-server.ts:
// `completarFichas` y `completarPerfiles`), con los mismos cuidados; lo único propio de acá es de dónde salen los teléfonos.
// ⚠️ SÓLO LOS TILDADOS: las fichas que devuelve la extensión se cruzan contra `soloIds`, y los perfiles se consultan por el
//    teléfono guardado en cada lead tildado. Nunca se crea, se mueve ni se le manda nada a nadie.
// ⚠️ El cupo de «Datos de empresa» es POR LÍNEA: el tablero y el modal del grupo gastan el mismo (120 por día).

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { EVENTO_TRAIDO_DE_GRUPO, TOPE_LOTE_COMPLETAR, asuntoComparable, grupoDelEvento, gruposDelLote } from '@/lib/grupo-wa-reglas';
import { numeroParaWhatsApp } from '@/lib/numero-whatsapp';
import { completarFichas, completarPerfiles, gruposDeLinea, lineasDelNegocio, participantesDelGrupo, type ResultadoFichas, type ResultadoPerfiles } from './grupo-wa-server';
import { indiceContactos } from './importar-server';
import { buscarTelefono } from './leads-importar';

/** Los ids que llegan del navegador, limpios: enteros positivos, sin repetir, con tope. */
export function idsLimpios(ids: unknown): number[] {
  return [...new Set((Array.isArray(ids) ? ids : []).filter((x): x is number => Number.isInteger(x) && (x as number) > 0))].slice(0, TOPE_LOTE_COMPLETAR);
}

/** El teléfono de cada lead tildado (los dígitos; sin teléfono, no está). Sólo de este negocio (`getTenantDb`). */
export async function telefonosDeLeads(ids: readonly number[]): Promise<Array<{ id: number; telefono: string }>> {
  const db = await getTenantDb();
  const out: Array<{ id: number; telefono: string }> = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from('leads').select('id, telefono').in('id', ids.slice(i, i + 200));
    if (error) throw new Error(`No pude leer los teléfonos: ${error.message}`);
    for (const r of (data ?? []) as Array<{ id: number; telefono: string | null }>) {
      const telefono = String(r.telefono ?? '').replace(/\D/g, '');
      if (telefono.length >= 8 && telefono.length <= 15) out.push({ id: Number(r.id), telefono });
    }
  }
  return out;
}

/** Un pedido a la extensión: el teléfono del lead y, si se sabe, su `@lid` (cómo lo conoce WhatsApp en un grupo). */
export type PedidoDeFicha = { id: number; telefono: string; lid: string | null };

/**
 * LO QUE LA EXTENSIÓN NECESITA DE LOS TILDADOS (25/10/2026, Martín: «Si ya sabe el nombre del grupo debería buscarlos
 * dentro»): el teléfono de cada uno, los grupos de donde vinieron (el historial «Traído de un grupo de WhatsApp») y el `@lid`
 * de cada uno en ese grupo. ⚠️ El `@lid` hace falta: MEDIDO en el WhatsApp Web de Martín, en sus grupos TODOS los
 * participantes son `@lid` y el 37 % no trae teléfono en su navegador; sin el `@lid` esos no se encuentran. Lo da Evolution
 * con la lista del grupo (`participantesDelGrupo`: una lectura de la base del grupo, con caché de 2 min, no una consulta de
 * perfil por persona). Si el grupo no está en ninguna línea, van sin `@lid`: la extensión busca igual por teléfono.
 */
export async function pedidosDeFichas(ids: readonly number[]): Promise<{ pedidos: PedidoDeFicha[]; grupos: string[] }> {
  const tels = await telefonosDeLeads(ids);
  if (!tels.length) return { pedidos: [], grupos: [] };
  const db = await getTenantDb();
  const valores: Array<string | null> = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from('lead_audit').select('valor_nuevo').eq('campo', EVENTO_TRAIDO_DE_GRUPO).in('lead_id', ids.slice(i, i + 200));
    if (error) throw new Error(`No pude leer de qué grupo vinieron: ${error.message}`);
    for (const r of (data ?? []) as Array<{ valor_nuevo: string | null }>) valores.push(r.valor_nuevo);
  }
  const grupos = gruposDelLote(valores);
  const lidPorSufijo = new Map<string, string>();
  if (grupos.length) {
    const lineas = (await lineasDelNegocio()).filter((l) => l.conectada);
    for (const nombre of grupos) {
      const buscado = asuntoComparable(nombre);
      for (const l of lineas) {
        const lista = await gruposDeLinea(l.linea).catch(() => null);
        const g = lista && lista.ok ? lista.grupos.find((x) => asuntoComparable(x.nombre) === buscado) : null;
        if (!g) continue;
        const leidos = await participantesDelGrupo(l.linea, g.jid).catch(() => null);
        if (!leidos || !leidos.ok) continue;
        for (const p of leidos.participantes) if (p.lid) lidPorSufijo.set(p.telefono.slice(-10), p.lid);
        break;
      }
    }
  }
  return { pedidos: tels.map((t) => ({ ...t, lid: lidPorSufijo.get(t.telefono.slice(-10)) ?? null })), grupos };
}

/** Los leads traídos de ese grupo (por su historial «Traído de un grupo de WhatsApp»), a lo sumo `TOPE_LOTE_COMPLETAR`. */
export async function leadsDelGrupo(nombre: string): Promise<number[]> {
  const db = await getTenantDb();
  const literal = nombre.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data, error } = await db.from('lead_audit').select('lead_id, valor_nuevo').eq('campo', EVENTO_TRAIDO_DE_GRUPO)
    .ilike('valor_nuevo', `«${literal}», a «%`).limit(TOPE_LOTE_COMPLETAR);
  if (error) throw new Error(`No pude leer de qué grupo vinieron: ${error.message}`);
  const buscado = asuntoComparable(nombre);
  const filas = (data ?? []) as Array<{ lead_id: number; valor_nuevo: string | null }>;
  return [...new Set(filas.filter((r) => asuntoComparable(grupoDelEvento(r.valor_nuevo)) === buscado).map((r) => Number(r.lead_id)))];
}

/** Las fichas de SU WhatsApp Web (las lee la extensión en el navegador), escritas SÓLO en los leads tildados. */
export async function completarFichasDeLeads(p: { ids: readonly number[]; fichas: unknown[]; autor: string; hasta: number }): Promise<ResultadoFichas> {
  return completarFichas({ fichas: p.fichas, autor: p.autor, hasta: p.hasta, soloIds: new Set(p.ids) });
}

/**
 * «Datos de empresa» sobre los tildados, por la línea conectada del negocio. Un teléfono que comparten DOS leads no se adivina
 * (como en el grupo): sólo cuenta si ese teléfono es UN lead y ese lead es el tildado.
 * ⚠️ EL NÚMERO SE CONSULTA CON SU CÓDIGO DE PAÍS (`numeroParaWhatsApp`, como todo envío). En el grupo el número sale del JID y
 *    siempre lo trae; en una ficha muchas veces no (53 de 70 en un negocio de México, lib/numero-whatsapp.ts). Sin esto se
 *    consultaba un número que no existe: gastaba cupo de la línea y quedaba marcado como «ya consultado» con la misma clave
 *    (los últimos 10 dígitos) que el contacto real, que después no se consultaba nunca (la revisión del 24/10/2026). El que no
 *    se puede completar (10 dígitos con una línea de país sin largo conocido) no se consulta y se cuenta en `sinPais`.
 */
export async function completarPerfilesDeLeads(p: {
  ids: readonly number[]; autor: string; hechas?: number; saltear?: readonly string[]; hasta?: number; soloContar?: boolean;
}): Promise<ResultadoPerfiles> {
  const linea = (await lineasDelNegocio()).find((l) => l.conectada) ?? null;
  if (!linea) return { ok: false, error: 'Conecta una línea de WhatsApp para consultar los perfiles de empresa.' };
  const [tels, idx] = await Promise.all([telefonosDeLeads(p.ids), indiceContactos()]);
  const telIdx = { exactos: idx.tels, sufijos: idx.telsSufijo };
  let sinPais = 0;
  const candidatos = tels.flatMap((t) => {
    if (buscarTelefono(telIdx, t.telefono) !== t.id) return []; // el cruce, con el número guardado
    const n = numeroParaWhatsApp(t.telefono, linea.numero);
    if (!n.ok) { sinPais++; return []; }
    return [{ telefono: n.numero, id: t.id }]; // se consulta y se marca con el país
  });
  const r = await completarPerfiles({ linea: linea.linea, candidatos, autor: p.autor, hechas: p.hechas, saltear: p.saltear, hasta: p.hasta, soloContar: p.soloContar });
  // La pregunta y el aviso nombran la línea (el cupo es de ESA línea) y cuentan a los que no se pueden consultar.
  return r.ok ? { ...r, lineaNombre: linea.etiqueta, sinPais } : r;
}
