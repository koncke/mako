// =============================================================================
// Media Buyer — lo que la pantalla necesita además de la config y las decisiones (25/10/2026)
// =============================================================================
// El arranque (los productos del CRM, lo medido de sus anuncios, cuántos avatares y razones tiene, y lo que ya respondió)
// y la cuenta por producto (lib/media-buyer/productos.ts). Todo con el negocio fijo (`runWithWorkspace`) y tolerante: una
// lectura que falla deja su parte vacía y la pantalla no la dibuja; nunca la tira.
// Lo que respondió en el arranque se guarda en `media-buyer.arranque` (app_settings), como el onboarding general guarda el
// suyo en `onboarding.arranque`: es estado de la charla, no config del Media Buyer.
// =============================================================================

import 'server-only';
import { runWithWorkspace } from '@/lib/workspace';
import { getSetting, setSetting } from '@/lib/settings';
import { listarFunnels } from '@/lib/funnels';
import { leerCampanasAsignadas } from '@/lib/campana-funnel';
import { getSenalesRecon } from '@/lib/queries';
import { getAvatares } from '@/lib/avatares';
import { getRazones } from '@/lib/razones';
import { deTusAnuncios } from '@/lib/calculadora-presupuesto-ads';
import { hoyEnTijuana } from '@/lib/date-utils';
import { diasAntes } from './senales';
import { etiquetaDeFunnel, lienzo, mapaDeProductos, mejoresAnuncios, type AnuncioDestacado } from './productos';
import type { ProductoArranque, RespuestasArranque } from './arranque';
import type { KpiMediaBuyer } from './tipos';
import { CLAVE_AGENTES, leerAgentes, type AgentePropio } from './agentes-propios';
import type { DatosCuenta } from './datos';

export const CLAVE_ARRANQUE = 'media-buyer.arranque';

export type VistaMediaBuyer = {
  arranque: { productos: ProductoArranque[]; costoMedido: number | null; cierreMedido: number | null; avatares: number; funcionalidades: number; respuestas: RespuestasArranque };
  productoDe: Record<string, string>;
  /** Los anuncios que más resultados trajeron al CRM este mes (la Biblioteca). */
  mejores: AnuncioDestacado[];
  /** Los agentes propios del negocio (el panel «N activos»). */
  agentes: AgentePropio[];
};

const ok = <T,>(p: Promise<T>, def: T): Promise<T> => p.catch((e) => { console.warn('[media-buyer/vista]', e instanceof Error ? e.message : String(e)); return def; });

export function leerRespuestasArranque(crudo: string | null): RespuestasArranque {
  try { const j = crudo ? JSON.parse(crudo) : null; return j && typeof j === 'object' && !Array.isArray(j) ? j as RespuestasArranque : {}; } catch { return {}; }
}

export async function vistaMediaBuyer(ws: number, kpi: KpiMediaBuyer, objetivo: number | null, hoy: string = hoyEnTijuana()): Promise<VistaMediaBuyer> {
  return runWithWorkspace(ws, async () => {
    const desdeMes = `${hoy.slice(0, 7)}-01`;
    const hasta = diasAntes(hoy, 1);
    const [funnels, asignadas, senales30, senalesMes, avatares, razones, crudo, crudoAgentes] = await Promise.all([
      ok(listarFunnels(), []),
      ok(leerCampanasAsignadas(), []),
      ok(getSenalesRecon(diasAntes(hoy, 30), hasta), []),
      hasta >= desdeMes ? ok(getSenalesRecon(desdeMes, hasta), []) : Promise.resolve([]),
      ok(getAvatares(), []),
      ok(getRazones(), []),
      ok(getSetting(CLAVE_ARRANQUE), null),
      ok(getSetting(CLAVE_AGENTES), null),
    ]);
    const medido = deTusAnuncios(senales30.map((s) => ({ spend_usd: s.spend_usd, leads: s.leads, leads_crm: s.leads_crm, cierres: s.cierres })));
    const fs = funnels.map((f) => ({ id: f.id, nombre: f.nombre, producto: f.producto, esDefault: f.esDefault }));
    const asig = asignadas.map((a) => ({ tipo: a.tipo, id: a.id, nombre: a.nombre, funnelId: a.funnelId }));
    return {
      arranque: {
        productos: fs.map((f) => ({ id: String(f.id), nombre: etiquetaDeFunnel(f), precio: null })),
        costoMedido: medido.costoPorLead, cierreMedido: medido.cierre,
        avatares: avatares.length, funcionalidades: new Set(razones.map((r) => r.nombre)).size,
        respuestas: leerRespuestasArranque(crudo),
      },
      productoDe: mapaDeProductos(asig, fs),
      mejores: mejoresAnuncios(senalesMes, kpi),
      agentes: leerAgentes(crudoAgentes),
    };
  });
}

/**
 * El lienzo (la pestaña Campañas): la cuenta leída EN VIVO (lo que el Media Buyer ve y opera, `leerDatosCuenta`) agrupada
 * por producto, con el gasto y los resultados del CRM del mes. Se pide al abrir la pestaña, no al cargar la página: lee Meta.
 * `leida`: la cuenta ya leída (ver_campanas_media_buyer de la API), para no leer Meta dos veces.
 */
export async function lienzoMediaBuyer(ws: number, kpi: KpiMediaBuyer, objetivo: number | null, hoy: string = hoyEnTijuana(), leida?: DatosCuenta) {
  const datos = leida ?? await (await import('./datos')).leerDatosCuenta(ws, hoy);
  return runWithWorkspace(ws, async () => {
    const desdeMes = `${hoy.slice(0, 7)}-01`;
    const hasta = diasAntes(hoy, 1);
    const [funnels, asignadas, senalesMes] = await Promise.all([
      ok(listarFunnels(), []),
      ok(leerCampanasAsignadas(), []),
      hasta >= desdeMes ? ok(getSenalesRecon(desdeMes, hasta), []) : Promise.resolve([]),
    ]);
    const campanas = datos.arbol.filter((n) => n.nivel === 'campaign' && n.configurado !== 'DELETED').map((c) => ({
      id: c.id, nombre: c.nombre, prendida: c.configurado === 'ACTIVE', presupuestoDia: c.presupuestoDia,
      conjuntos: datos.arbol.filter((s) => s.nivel === 'adset' && s.parentId === c.id && s.configurado !== 'DELETED').length,
    }));
    const fs = funnels.map((f) => ({ id: f.id, nombre: f.nombre, producto: f.producto, esDefault: f.esDefault }));
    const asig = asignadas.map((a) => ({ tipo: a.tipo, id: a.id, nombre: a.nombre, funnelId: a.funnelId, ...(a.campanaId ? { campanaId: a.campanaId } : {}) }));
    return { ...lienzo(campanas, senalesMes, asig, fs, kpi, objetivo), fuente: datos.fuente, moneda: datos.moneda };
  });
}

export async function guardarRespuestasArranque(ws: number, r: RespuestasArranque): Promise<void> {
  await runWithWorkspace(ws, () => setSetting(CLAVE_ARRANQUE, JSON.stringify(r).slice(0, 4000)));
}
