// =============================================================================
// Los outliers de video: el lector de la portada (server; 9/11/2026)
// =============================================================================
// Junta las FUENTES enchufadas (lib/video-outliers.ts tiene el contrato). Para sumar una: su módulo exporta una
// `FuenteOutliersVideo` y se agrega a `FUENTES_OUTLIERS_VIDEO`. Una fuente que tira no tumba la portada: queda como caída, con
// su motivo, y las demás se dibujan.
//
// 11/11/2026 (Martín, con la captura de la portada: UNA tarjeta, sin imagen): entra la fuente de Spy, la «Ya» de
// docs/investigacion-outliers-video.md §1. Lee lo que Spy YA trajo de las cuentas que el negocio sigue (`spy_competidores` +
// `spy_piezas`, por el proxy del inquilino), igual que la portada de Image (lib/carruseles/explorar-servidor.ts): no llama a
// Apify ni a Meta ni gasta nada.
// =============================================================================

import 'server-only';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { leerPorPaginas } from './supabase-paginado';
import { podarVencido } from './spy-reglas';
import { rendimientoInstagram } from './zernio-organico';
import { criterioDeReel } from './video-outliers-criterio';
import {
  FUENTE_MAKO, conCriterio, juntarOutliers, outliersDeSpy, outliersPropios,
  type CuentaSpy, type FuenteOutliersVideo, type LecturaFuente, type PiezaReel, type PortadaOutliers,
} from './video-outliers';

/** Cuántos reels se leen como mucho (todas las cuentas juntas), como los carruseles de Image (25 cuentas × 240). */
export const REELS_A_LEER = 6000;

/** Los reels de las cuentas que el negocio sigue en Competitors Spy. Sin cuentas (o sin las tablas de Spy), ninguno. */
export const FUENTE_SPY: FuenteOutliersVideo = {
  id: 'spy',
  nombre: 'las cuentas que sigues en Competitors Spy',
  leer: async (): Promise<LecturaFuente> => {
    const db = await getTenantDb();
    const comp = await db.from('spy_competidores').select('id, nombre, instagram, avatar').limit(100);
    if (comp.error) {
      // Spy sin tablas no es un error del negocio: no sigue a nadie todavía.
      if (comp.error.code === '42P01') return { ok: true, outliers: [] };
      return { ok: false, motivo: comp.error.message };
    }
    const cuentas = ((comp.data ?? []) as CuentaSpy[]).filter((c) => !!c.instagram);
    if (!cuentas.length) return { ok: true, outliers: [] };
    const piezas: PiezaReel[] = [];
    // TODAS las de Instagram de esas cuentas (no sólo los reels): el múltiplo se calcula sobre su cuenta, como en Spy. `*` y no
    // una lista de columnas: `medio` (mig 0391) puede no existir todavía, y una columna nombrada que falta rechaza la consulta.
    await leerPorPaginas<Record<string, unknown>>(db, 'spy_piezas', '*', (pagina) => {
      for (const f of pagina) piezas.push(podarVencido(f) as unknown as PiezaReel);
      return piezas.length < REELS_A_LEER;
    }, { orden: 'id', filtros: (q) => q.eq('canal', 'instagram').in('competidor_id', cuentas.map((c) => c.id)) });
    // Sólo los que enseñan un patrón de edición (11/11/2026, Martín: «no reels random al azar»); los demás se cuentan.
    const { outliers, resumen } = conCriterio(outliersDeSpy(piezas, cuentas), criterioDeReel);
    return { ok: true, outliers, resumen };
  },
};

/** Cuánto se espera a Zernio: la portada no se queda colgada por lo propio. */
export const ESPERA_PROPIOS_MS = 6000;
/** Los últimos 6 meses de lo propio: con 7 reels alcanza para la mediana; Zernio da hasta 50 por pedido. */
const DIAS_PROPIOS = 180;

/**
 * Los reels del propio Instagram del negocio, por Zernio (docs/investigacion-outliers-video.md §1, fuente «3»). Sin Zernio, sin
 * Instagram conectado o sin el complemento de Analytics NO es una caída: no hay de dónde leer lo propio, y la portada se ve
 * con lo de Spy. Lo demás (la clave mala, una respuesta rara, que no conteste) sí se dice.
 */
export const FUENTE_PROPIOS: FuenteOutliersVideo = {
  id: 'propio',
  nombre: 'tus reels de Instagram',
  leer: async (): Promise<LecturaFuente> => {
    const ws = await getWorkspaceActual();
    if (ws == null) return { ok: true, outliers: [] };
    const hasta = new Date();
    const desde = new Date(hasta.getTime() - DIAS_PROPIOS * 86_400_000);
    const dia = (d: Date) => d.toISOString().slice(0, 10);
    const r = await Promise.race([
      rendimientoInstagram(ws, { desde: dia(desde), hasta: dia(hasta), limite: 50 }),
      new Promise<'tarde'>((res) => setTimeout(() => res('tarde'), ESPERA_PROPIOS_MS)),
    ]);
    if (r === 'tarde') return { ok: false, motivo: 'Zernio no contestó a tiempo.' };
    if ('error' in r) {
      if (r.error === 'sin-clave' || r.error === 'sin-cuenta' || r.error === 'sin-analytics') return { ok: true, outliers: [] };
      return { ok: false, motivo: r.texto };
    }
    return { ok: true, outliers: outliersPropios({ usuario: r.cuenta.usuario, nombre: r.cuenta.nombre }, r.publicaciones ?? []) };
  },
};

/** Las fuentes, en orden. La del chat «Outliers de reels y anuncios» entra acá. */
export const FUENTES_OUTLIERS_VIDEO: readonly FuenteOutliersVideo[] = [FUENTE_MAKO, FUENTE_SPY, FUENTE_PROPIOS];

export async function leerOutliersVideo(fuentes: readonly FuenteOutliersVideo[] = FUENTES_OUTLIERS_VIDEO): Promise<PortadaOutliers> {
  const lecturas = await Promise.all(fuentes.map(async (fuente) => {
    let lectura: LecturaFuente;
    try { lectura = await fuente.leer(); } catch (e) {
      lectura = { ok: false, motivo: e instanceof Error && e.message ? e.message.slice(0, 200) : 'No respondió.' };
    }
    return { fuente, lectura };
  }));
  return juntarOutliers(lecturas);
}
