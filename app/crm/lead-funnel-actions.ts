'use server';

// =============================================================================
// Un lead en varios productos: las acciones de la pantalla (mig 0207)
// =============================================================================
// «No se debe "Mover" se debe agregar al otro producto» (Martín, 06/10/2026). La lógica vive en
// lib/lead-funnel.ts y las reglas en lib/lead-funnel-reglas.ts; acá sólo se expone, se valida
// la entrada y se invalida la caché.
//
// ⚠️ EN UN ARCHIVO `'use server'` SÓLO SE EXPORTAN FUNCIONES ASYNC (AGENTS.md).

import { revalidatePath, updateTag } from 'next/cache';
import { TAG } from '@/lib/cache';
import { listarFunnels, idDelFunnelDefault } from '@/lib/funnels';
import {
  productosDelLead, agregarAProducto, quitarDeProducto, deshacerQuitar, moverEtapaEnProducto,
  agregarLoteAProducto, quitarLoteDeProducto, etapasDeProducto, type DeshacerQuitar,
  previaDePasar, pasarLoteAOtroFunnel, deshacerPasar, type DeshacerPasar,
} from '@/lib/lead-funnel';
import type { PreviaPasar } from '@/lib/pasar-funnel-reglas';
import { PRESUPUESTO_LOTE_MS } from './lote-tandas';
import { puedeQuitar, nombreVisible } from '@/lib/lead-funnel-reglas';
import { exigirSesion } from '@/lib/sesion-accion';
import type { InformeMovimiento } from '@/lib/reentrada';

type Res<T> = ({ ok: true } & T) | { ok: false; error: string };
const mal = (e: unknown, def: string) => ({ ok: false as const, error: e instanceof Error ? e.message : def });

/** Invalida los tableros. Copia de la de app/crm/actions.ts: un 'use server' sólo exporta acciones. */
function bust() {
  try { updateTag(TAG.leads); } catch { /* vence por TTL */ }
  revalidatePath('/crm');
}

const idOk = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** `null` en la pantalla es el producto del negocio; acá se traduce a su id. */
async function resolverProducto(funnelId: number | null): Promise<number> {
  if (funnelId != null) return Number(funnelId);
  const def = await idDelFunnelDefault();
  if (def == null) throw new Error('No encontré el funnel del negocio.');
  return def;
}

/** Un producto tal como lo dibuja la ficha. */
export type ProductoFicha = {
  id: number;
  nombre: string;
  esDefault: boolean;
  /** ¿Está el lead en este producto? */
  esta: boolean;
  /** ¿Es su casa? */
  esCasa: boolean;
  /** Su etapa en ese producto (para la casa, la del lead). */
  etapa: string | null;
  /** Las etapas de ese producto, sólo si está (para el selector de etapa de la ficha). */
  etapas: Array<{ key: string; label: string; band?: string; dot?: string }>;
};

/**
 * Los productos de la ficha: todos los del workspace, marcando en cuáles está, con la X
 * permitida o no, y las etapas de los suyos.
 */
export async function productosDeLaFichaAction(leadId: number): Promise<Res<{ productos: ProductoFicha[]; puedeQuitar: boolean }>> {
  await exigirSesion();
  try {
    if (!idOk(leadId)) return { ok: false, error: 'Falta el lead.' };
    const [{ productos, etapaCasa }, funnels] = await Promise.all([productosDelLead(leadId), listarFunnels()]);
    const deEl = new Map(productos.map((p) => [p.funnelId, p]));
    const out: ProductoFicha[] = [];
    for (const f of funnels) {
      const p = deEl.get(f.id);
      out.push({
        id: f.id,
        nombre: nombreVisible(f),
        esDefault: f.esDefault,
        esta: !!p,
        esCasa: !!p?.esCasa,
        etapa: p ? (p.esCasa ? etapaCasa : p.etapa) : null,
        etapas: p ? (await etapasDeProducto(f.id)).map((s) => ({ key: s.key, label: s.label, band: s.band, dot: s.dot })) : [],
      });
    }
    return { ok: true, productos: out, puedeQuitar: puedeQuitar(productos) };
  } catch (e) {
    return mal(e, 'No se pudieron leer los funnels del lead.');
  }
}

/** Agrega el lead a un producto, en la etapa de entrada. */
export async function agregarAProductoAction(leadId: number, funnelId: number | null): Promise<Res<{ agregado: boolean }>> {
  await exigirSesion();
  try {
    if (!idOk(leadId)) return { ok: false, error: 'Falta el lead.' };
    const r = await agregarAProducto(leadId, await resolverProducto(funnelId));
    bust();
    return { ok: true, agregado: r.agregado };
  } catch (e) {
    return mal(e, 'No se pudo agregar al funnel.');
  }
}

/** Saca el lead de un producto (sólo con dos o más). Devuelve lo necesario para deshacer. */
export async function quitarDeProductoAction(leadId: number, funnelId: number | null): Promise<Res<{ deshacer: DeshacerQuitar }>> {
  await exigirSesion();
  try {
    if (!idOk(leadId)) return { ok: false, error: 'Falta el lead.' };
    const d = await quitarDeProducto(leadId, await resolverProducto(funnelId));
    bust();
    return { ok: true, deshacer: d };
  } catch (e) {
    return mal(e, 'No se pudo quitar del funnel.');
  }
}

/** El deshacer de «quitar». */
export async function deshacerQuitarAction(d: DeshacerQuitar): Promise<Res<object>> {
  await exigirSesion();
  try {
    if (!d || !idOk(d.leadId) || !idOk(d.funnelId)) return { ok: false, error: 'No hay nada que deshacer.' };
    await deshacerQuitar(d);
    bust();
    return { ok: true };
  } catch (e) {
    return mal(e, 'No se pudo deshacer.');
  }
}

/**
 * Mueve la tarjeta de un lead AGREGADO a un producto (no su casa): escribe su etapa en ESE
 * producto y nada más.
 */
export async function moverEtapaEnProductoAction(leadId: number, funnelId: number | null, etapa: string): Promise<Res<{ antes: string; automatizaciones?: InformeMovimiento }>> {
  await exigirSesion();
  try {
    if (!idOk(leadId) || typeof etapa !== 'string' || !etapa) return { ok: false, error: 'Falta la etapa.' };
    // Lo mueve una persona: el informe de las automatizaciones de la etapa vuelve a la pantalla (23/10/2026).
    const r = await moverEtapaEnProducto(leadId, await resolverProducto(funnelId), etapa, { porPersona: true });
    bust();
    const i = r.automatizaciones;
    return { ok: true, antes: r.antes, ...(i && (i.entro.length || i.noEntro.length) ? { automatizaciones: i } : {}) };
  } catch (e) {
    return mal(e, 'No se pudo mover.');
  }
}

/** Agrega VARIOS leads a un producto (lote, «traer»). Devuelve los que agregó, para deshacer. */
export async function agregarLoteAProductoAction(leadIds: number[], funnelId: number | null, porQue?: string): Promise<Res<{ agregados: number[]; fallaron: number }>> {
  await exigirSesion();
  try {
    const ids = (Array.isArray(leadIds) ? leadIds : []).filter(idOk).slice(0, 2000);
    if (!ids.length) return { ok: true, agregados: [], fallaron: 0 };
    const destino = await resolverProducto(funnelId);
    const nombre = (await listarFunnels()).find((f) => f.id === destino);
    const r = await agregarLoteAProducto(ids, destino, porQue?.trim() || `Agregado a «${(nombre ? nombreVisible(nombre) : '') || 'otro funnel'}»`);
    bust();
    return { ok: true, ...r };
  } catch (e) {
    return mal(e, 'No se pudieron agregar al funnel.');
  }
}

/** El deshacer de un lote: borra SÓLO las filas que ese lote creó. */
export async function quitarLoteDeProductoAction(leadIds: number[], funnelId: number | null): Promise<Res<{ quitados: number }>> {
  await exigirSesion();
  try {
    const ids = (Array.isArray(leadIds) ? leadIds : []).filter(idOk).slice(0, 2000);
    const n = await quitarLoteDeProducto(ids, await resolverProducto(funnelId), 'Se deshizo el agregado');
    bust();
    return { ok: true, quitados: n };
  } catch (e) {
    return mal(e, 'No se pudo deshacer.');
  }
}

/** El nombre que ve la persona de un funnel por su id real. */
async function nombreDeFunnel(id: number): Promise<string> {
  const f = (await listarFunnels()).find((x) => x.id === id);
  return (f ? nombreVisible(f) : '') || 'otro funnel';
}

/**
 * Lo que la pregunta de «Pasar a otro funnel» muestra ANTES de tocar nada (28/10/2026, ticket #21 de Leila): quiénes ya
 * están en el destino, quiénes agendaron, quiénes pagaron en el origen, y las etapas del destino. La pantalla la pide al
 * elegir el destino.
 */
export async function previaPasarAction(leadIds: number[], desde: number | null, hacia: number | null): Promise<Res<PreviaPasar & { origen: string; destino: string }>> {
  await exigirSesion();
  try {
    const ids = (Array.isArray(leadIds) ? leadIds : []).filter(idOk).slice(0, 5000);
    const [d, h] = await Promise.all([resolverProducto(desde), resolverProducto(hacia)]);
    if (d === h) return { ok: false, error: 'Ya están en ese funnel.' };
    const previa = await previaDePasar(ids, d, h);
    return { ok: true, ...previa, origen: await nombreDeFunnel(d), destino: await nombreDeFunnel(h) };
  } catch (e) {
    return mal(e, 'No pude leer a los elegidos.');
  }
}

/**
 * PASA los tildados a otro funnel, en `etapa` (de a tandas desde la pantalla, como mover de etapa: lo que no llega en el
 * plazo vuelve en `pendientes`). Los que la pantalla dejó afuera (pagaron, agendaron) ni llegan acá; los de plata, si
 * llegan, los frena `quitarDeProducto`. Devuelve con qué deshacer el lote.
 */
export async function pasarAOtroFunnelAction(leadIds: number[], desde: number | null, hacia: number | null, etapa: string): Promise<Res<{
  pasados: number[]; yaEstaban: number; fallaron: number; motivos: string[]; pendientes: number[]; deshacer: DeshacerPasar[];
}>> {
  await exigirSesion();
  try {
    const ids = (Array.isArray(leadIds) ? leadIds : []).filter(idOk);
    const [d, h] = await Promise.all([resolverProducto(desde), resolverProducto(hacia)]);
    if (d === h) return { ok: false, error: 'Ya están en ese funnel.' };
    const r = await pasarLoteAOtroFunnel(ids.slice(0, 200), d, h, String(etapa ?? ''), { hasta: Date.now() + PRESUPUESTO_LOTE_MS });
    bust();
    return { ok: true, ...r, pendientes: [...r.pendientes, ...ids.slice(200)] };
  } catch (e) {
    return mal(e, 'No se pudieron pasar.');
  }
}

/** El «Deshacer» del aviso de un pase: cada lead vuelve a su funnel y su etapa de antes. Sigue aunque uno falle. */
export async function deshacerPasarAction(items: DeshacerPasar[]): Promise<Res<{ deshechos: number; fallaron: number }>> {
  await exigirSesion();
  let deshechos = 0, fallaron = 0;
  for (const d of (Array.isArray(items) ? items : []).slice(0, 200)) {
    if (!d || !idOk(d.leadId) || !idOk(d.hacia) || !d.quitar || d.quitar.leadId !== d.leadId) { fallaron += 1; continue; }
    try { await deshacerPasar(d); deshechos += 1; } catch { fallaron += 1; }
  }
  bust();
  return { ok: true, deshechos, fallaron };
}
