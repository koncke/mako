// =============================================================================
// graficos-lectura — las piezas comunes de los lectores del Dashboard
// =============================================================================
// Lo que comparten lib/graficos-datos.ts y lib/graficos-datos-extra.ts (los conjuntos de las tabs de
// Analysts): leer una tabla con el workspace EXPLÍCITO y paginada, y normalizar fechas y textos.
// Separado para que los dos lectores lo importen sin importarse entre sí.

import 'server-only';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { leerTodo, type ConsultaPaginada, type OrdenPaginado } from './supabase-paginado';
import { diasAntes, hoyEnTijuana } from './date-utils';
import { tramosDeDias } from './graficos-agregar';

export const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
export const txt = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
export const fechaTj = (iso: unknown): string | null => {
  if (typeof iso !== 'string' || !iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? hoyEnTijuana(new Date(ms)) : null;
};
export const lindo = (s: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/[_-]+/g, ' ') : null);
/** La ruta de una URL sin el dominio ni la query: «/vsl», no «https://hola-mako.com/vsl?fbclid=…». */
export const ruta = (u: unknown): string | null => {
  const s = txt(u);
  if (!s) return null;
  try { const x = new URL(s); return `${x.hostname.replace(/^www\./, '')}${x.pathname.replace(/\/$/, '') || ''}`; } catch { return s.split('?')[0]; }
};
export const host = (u: unknown): string | null => {
  const s = txt(u);
  if (!s) return '(directo)';
  try { return new URL(s).hostname.replace(/^www\./, ''); } catch { return s; }
};

export type Rango = { desde: string; hasta: string; sinRango: boolean };

/**
 * La lectura común: workspace explícito, paginada, y con el período sobre la columna que se
 * pida. Un instante (`ts`) se trae con un día de margen a cada lado y se recorta en memoria con
 * la fecha de Tijuana, que es la que se dibuja.
 */
export async function leer<T>(tabla: string, cols: string, rg: Rango, opts: { col?: string | null; ts?: boolean; orden?: OrdenPaginado; extra?: (q: ConsultaPaginada) => ConsultaPaginada } = {}): Promise<T[]> {
  const ws = await getWorkspaceActual();
  if (ws == null) return [];
  const db = await getTenantDb();
  const col = opts.col;
  const base = (q: ConsultaPaginada) => (opts.extra ? opts.extra(q) : q);
  const leerCon = (filtros: (q: ConsultaPaginada) => ConsultaPaginada) =>
    leerTodo<T>(db, tabla, cols, { orden: opts.orden ?? 'id', eq: { workspace_id: ws }, filtros });
  if (!col || rg.sinRango) return leerCon(base);
  if (!opts.ts) return leerCon((q) => base(q).gte(col, rg.desde).lte(col, rg.hasta));
  // ⚠️ UN INSTANTE SE LEE EN TRAMOS DE DÍAS, A LA VEZ. `leerTodo` pagina en serie con OFFSET: 45.122 eventos
  // del VSL en 30 días eran 46 páginas y 34 s, y la hoja Landing tardaba 51 s en abrir con un tope de 60
  // (medido el 11/10/2026, ws1). Partido en tramos contiguos (`tramosDeDias`: sin huecos ni días
  // repetidos; cada tramo es [su día, el día siguiente al suyo) y el último cierra igual que antes), cada
  // uno pagina poco y todos van juntos. Lo que se trae es EXACTAMENTE lo mismo: el corte con la fecha de
  // Tijuana sigue en memoria, en cada lector.
  const ini = diasAntes(rg.desde, 1);
  const fin = diasAntes(rg.hasta, -1);
  const tramos = tramosDeDias(ini, fin, TRAMOS_EN_PARALELO);
  const partes = await Promise.all(tramos.map((t, i) => {
    const ultimo = i === tramos.length - 1;
    return leerCon((q) => {
      const x = base(q).gte(col, `${t.desde}T00:00:00Z`);
      return ultimo ? x.lte(col, `${fin}T23:59:59Z`) : x.lt(col, `${diasAntes(t.hasta, -1)}T00:00:00Z`);
    });
  }));
  return partes.flat();
}
/** Cuántos tramos van a la vez en una lectura de un instante. Más es más carga para la base por pedido. */
const TRAMOS_EN_PARALELO = 6;
/** ¿La fecha de la fila entra en el período? (Las de un instante vienen con margen.) */
export const enRango = (f: string | null, rg: Rango) => rg.sinRango || (!!f && f >= rg.desde && f <= rg.hasta);

export async function nombres(tabla: string, ids: Array<number | string>, col = 'nombre'): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unicos = [...new Set(ids.filter((x) => x != null).map(String))];
  if (!unicos.length) return out;
  const ws = await getWorkspaceActual();
  const db = await getTenantDb();
  // De a tandas: un `.in` con cientos de ids arma una URL que el proxy corta.
  for (let i = 0; i < unicos.length; i += 150) {
    const { data, error } = await db.from(tabla).select(`id, ${col}`).eq('workspace_id', ws ?? -1).in('id', unicos.slice(i, i + 150));
    if (error) throw new Error(`No pude leer ${tabla}: ${error.message}`);
    for (const x of (data ?? []) as unknown as Array<Record<string, unknown>>) { const n = txt(x[col]); if (n) out.set(String(x.id), n); }
  }
  return out;
}

