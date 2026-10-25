// =============================================================================
// Media Buyer — la cuenta POR PRODUCTO (PURO: lo prueban los tests)
// =============================================================================
// Martín, 25/10/2026 ~18:50: «recuerda que tenemos varios CRM, varios productos, se debe poder interactuar». Cada negocio
// tiene N funnels (lib/funnels.ts), cada uno con el producto que vende, y cada campaña o conjunto de Meta apunta a uno
// (lib/campana-config.ts, `meta.campanas`; el funnel del negocio se guarda como `null`). Acá se junta el gasto y los
// resultados del CRM de cada anuncio (las señales del Recon, atribuidas por `meta_ad_id`) en el producto de su campaña.
//
// ⚠️ LAS SEÑALES DEL RECON TRAEN EL NOMBRE de la campaña y del conjunto, no su id. Se cruzan por NOMBRE con la asignación
//    (que guarda el nombre al asignar): una campaña renombrada después cae en «sin asignar» hasta que se reasigne. Un
//    conjunto asignado gana a su campaña (la misma precedencia que `funnelIdDeCampana`).
// ⚠️ Sin ninguna asignación, la lista va VACÍA (no se inventa que todo es del producto principal): la pantalla no la dibuja.
// =============================================================================

import type { KpiMediaBuyer } from './tipos';
import { nombreVisible } from '@/lib/lead-funnel-reglas';

export type SenalDeProducto = { campana: string | null; adset_name: string | null; spend_usd: number; leads_crm: number; agendas: number; cierres: number };
export type FunnelDeProducto = { id: number; nombre: string; producto: string | null; esDefault: boolean };
export type AsignadaDeProducto = { tipo: 'campana' | 'conjunto'; id: string; nombre: string; funnelId: number | null };
export type CuentaDeProducto = { id: string; nombre: string; gasto: number; resultados: number; costo: number | null; tono: 'bien' | 'mal' | null };

/** Cómo se llama un funnel en pantalla: la regla de la casa, en UN lugar (tests/inbox-agregar-al-crm.test.ts). */
export const etiquetaDeFunnel = (f: Pick<FunnelDeProducto, 'nombre' | 'producto'>): string => nombreVisible(f);

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

function funnelDe(asignadas: readonly AsignadaDeProducto[], funnels: readonly FunnelDeProducto[]) {
  const def = funnels.find((f) => f.esDefault) ?? null;
  const vivo = (id: number | null) => (id == null ? def : funnels.find((f) => f.id === id) ?? null);
  const porCampana = new Map<string, FunnelDeProducto | null>();
  const porConjunto = new Map<string, FunnelDeProducto | null>();
  for (const a of asignadas) (a.tipo === 'conjunto' ? porConjunto : porCampana).set(norm(a.nombre), vivo(a.funnelId));
  return (s: Pick<SenalDeProducto, 'campana' | 'adset_name'>): FunnelDeProducto | null =>
    porConjunto.get(norm(s.adset_name)) ?? porCampana.get(norm(s.campana)) ?? null;
}

/** El gasto y los resultados del CRM de cada producto, el que más gasta primero. */
export function porProducto(senales: readonly SenalDeProducto[], asignadas: readonly AsignadaDeProducto[], funnels: readonly FunnelDeProducto[], kpi: KpiMediaBuyer, objetivo: number | null): CuentaDeProducto[] {
  if (!asignadas.length) return [];
  const de = funnelDe(asignadas, funnels);
  const acc = new Map<number, { f: FunnelDeProducto; gasto: number; resultados: number }>();
  for (const s of senales) {
    const f = de(s);
    if (!f) continue;
    const x = acc.get(f.id) ?? { f, gasto: 0, resultados: 0 };
    x.gasto += s.spend_usd;
    x.resultados += kpi === 'venta' ? s.cierres : kpi === 'agenda' ? s.agendas : s.leads_crm;
    acc.set(f.id, x);
  }
  return [...acc.values()].map(({ f, gasto, resultados }) => {
    const costo = resultados > 0 ? Math.round((gasto / resultados) * 100) / 100 : null;
    const tono = costo == null || !objetivo ? null : costo <= objetivo ? 'bien' : costo > objetivo * 1.2 ? 'mal' : null;
    return { id: String(f.id), nombre: etiquetaDeFunnel(f), gasto: Math.round(gasto * 100) / 100, resultados, costo, tono } as CuentaDeProducto;
  }).sort((a, b) => b.gasto - a.gasto);
}

/**
 * El producto de cada entidad de la cuenta, para la etiqueta de cada acción: por id (campañas y conjuntos asignados) y por
 * el NOMBRE de la campaña (`c:<nombre>`), que es lo que una acción sobre un anuncio sabe de dónde está.
 */
export function mapaDeProductos(asignadas: readonly AsignadaDeProducto[], funnels: readonly FunnelDeProducto[]): Record<string, string> {
  const def = funnels.find((f) => f.esDefault) ?? null;
  const out: Record<string, string> = {};
  for (const a of asignadas) {
    const f = a.funnelId == null ? def : funnels.find((x) => x.id === a.funnelId) ?? null;
    if (!f) continue;
    out[a.id] = etiquetaDeFunnel(f);
    if (a.tipo === 'campana') out[`c:${norm(a.nombre)}`] = etiquetaDeFunnel(f);
  }
  return out;
}

// ── El lienzo (la pestaña Campañas): cada producto con SUS campañas ─────────────────────────────────────────────────

export type CampanaEnVivo = { id: string; nombre: string; prendida: boolean; presupuestoDia: number | null; conjuntos: number };
export type CampanaDeLienzo = CampanaEnVivo & { gasto: number; resultados: number; costo: number | null; tono: 'bien' | 'mal' | null };
export type ProductoDeLienzo = { id: string; nombre: string; gasto: number; resultados: number; costo: number | null; tono: 'bien' | 'mal' | null; campanas: CampanaDeLienzo[] };

const tonoDe = (costo: number | null, objetivo: number | null): 'bien' | 'mal' | null =>
  costo == null || !objetivo ? null : costo <= objetivo ? 'bien' : costo > objetivo * 1.2 ? 'mal' : null;

/**
 * Los productos con sus campañas (todas las de la cuenta, leídas en vivo), y las que no van a ninguno. Una campaña va al
 * producto de SU asignación; si no tiene, al de sus conjuntos asignados (el primero); si tampoco, a «sin producto». Los
 * números del mes salen de las señales por NOMBRE de campaña (ver arriba). Los productos sin campañas también van: el
 * negocio ve que existen y que todavía no tienen anuncios.
 */
export function lienzo(campanas: readonly CampanaEnVivo[], senales: readonly SenalDeProducto[], asignadas: readonly (AsignadaDeProducto & { campanaId?: string })[], funnels: readonly FunnelDeProducto[], kpi: KpiMediaBuyer, objetivo: number | null): { productos: ProductoDeLienzo[]; sinProducto: CampanaDeLienzo[] } {
  const def = funnels.find((f) => f.esDefault) ?? null;
  const vivo = (id: number | null) => (id == null ? def : funnels.find((f) => f.id === id) ?? null);
  const numeros = new Map<string, { gasto: number; resultados: number }>();
  for (const s of senales) {
    const k = norm(s.campana);
    const x = numeros.get(k) ?? { gasto: 0, resultados: 0 };
    x.gasto += s.spend_usd;
    x.resultados += kpi === 'venta' ? s.cierres : kpi === 'agenda' ? s.agendas : s.leads_crm;
    numeros.set(k, x);
  }
  const deCampana = (c: CampanaEnVivo): FunnelDeProducto | null | 'sin' => {
    const propia = asignadas.find((a) => a.tipo === 'campana' && a.id === c.id);
    if (propia) return vivo(propia.funnelId) ?? 'sin';
    const deConjunto = asignadas.find((a) => a.tipo === 'conjunto' && a.campanaId === c.id);
    return deConjunto ? vivo(deConjunto.funnelId) ?? 'sin' : 'sin';
  };
  const porFunnel = new Map<number, CampanaDeLienzo[]>();
  const sinProducto: CampanaDeLienzo[] = [];
  for (const c of campanas) {
    const n = numeros.get(norm(c.nombre)) ?? { gasto: 0, resultados: 0 };
    const costo = n.resultados > 0 ? Math.round((n.gasto / n.resultados) * 100) / 100 : null;
    const fila: CampanaDeLienzo = { ...c, gasto: Math.round(n.gasto * 100) / 100, resultados: n.resultados, costo, tono: tonoDe(costo, objetivo) };
    const f = deCampana(c);
    if (f === 'sin' || f == null) sinProducto.push(fila);
    else porFunnel.set(f.id, [...(porFunnel.get(f.id) ?? []), fila]);
  }
  const orden = (a: CampanaDeLienzo, b: CampanaDeLienzo) => Number(b.prendida) - Number(a.prendida) || b.gasto - a.gasto || a.nombre.localeCompare(b.nombre);
  const productos = funnels.map((f) => {
    const cs = (porFunnel.get(f.id) ?? []).sort(orden);
    const gasto = Math.round(cs.reduce((s, c) => s + c.gasto, 0) * 100) / 100;
    const resultados = cs.reduce((s, c) => s + c.resultados, 0);
    const costo = resultados > 0 ? Math.round((gasto / resultados) * 100) / 100 : null;
    return { id: String(f.id), nombre: etiquetaDeFunnel(f), gasto, resultados, costo, tono: tonoDe(costo, objetivo), campanas: cs };
  }).sort((a, b) => b.campanas.length - a.campanas.length || b.gasto - a.gasto);
  return { productos, sinProducto: sinProducto.sort(orden) };
}

// ── La Biblioteca: los mejores anuncios del mes, por lo que trajeron al CRM ─────────────────────────────────────────

export type SenalDeAnuncio = SenalDeProducto & { ad_id: string; ad_name: string; ad_thumbnail_url: string | null };
export type AnuncioDestacado = { adId: string; nombre: string; campana: string | null; miniatura: string | null; gasto: number; resultados: number; costo: number | null };

/**
 * Los anuncios que más resultados trajeron al CRM este mes (con gasto: un anuncio sin gasto no se mide), el más barato
 * primero entre los que empatan. Es de dónde salen las variaciones que vale la pena pedir.
 */
export function mejoresAnuncios(senales: readonly SenalDeAnuncio[], kpi: KpiMediaBuyer, cuantos = 6): AnuncioDestacado[] {
  return senales
    .map((s) => {
      const resultados = kpi === 'venta' ? s.cierres : kpi === 'agenda' ? s.agendas : s.leads_crm;
      const costo = resultados > 0 ? Math.round((s.spend_usd / resultados) * 100) / 100 : null;
      return { adId: s.ad_id, nombre: s.ad_name || s.ad_id, campana: s.campana, miniatura: s.ad_thumbnail_url, gasto: Math.round(s.spend_usd * 100) / 100, resultados, costo };
    })
    .filter((a) => a.gasto > 0 && a.resultados > 0)
    .sort((a, b) => b.resultados - a.resultados || (a.costo ?? Infinity) - (b.costo ?? Infinity))
    .slice(0, cuantos);
}

/** El producto de una acción: su entidad, o la campaña donde está (por nombre). null = sin asignar. */
export function productoDeAccion(mapa: Record<string, string>, d: { nivel: 'campaign' | 'adset' | 'ad'; entidadId: string; entidadNombre: string; campanaNombre: string | null }): string | null {
  return mapa[d.entidadId] ?? (d.campanaNombre ? mapa[`c:${norm(d.campanaNombre)}`] : undefined) ?? (d.nivel === 'campaign' ? mapa[`c:${norm(d.entidadNombre)}`] : undefined) ?? null;
}
