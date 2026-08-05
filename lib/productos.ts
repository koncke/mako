// =============================================================================
// productos — catálogo de productos/ofertas del workspace (#374)
// =============================================================================
// Entidades estructuradas (a diferencia de la 'oferta' plana del onboarding). El
// CRM referencia un producto al cerrar y hereda su pricing (tipo/monto/plazo).
// Scopeado por getTenantDb (productos está en TENANT_TABLES).

import 'server-only';
import { getTenantDb } from './workspace';
import { getAnswers } from './onboarding';
import { getSetting, setSetting } from './settings';

const SEED_KEY = 'mako.productos.seeded';

export type ProductoTipo = 'unico' | 'suscripcion';

export type Producto = {
  id: number;
  nombre: string;
  tipo: ProductoTipo;
  monto_usd: number | null;        // precio (único) o MENSUAL (suscripción)
  suscripcion_meses: number | null; // plazo fijo; null = indefinida
  promesa: string | null;
  incluye: string | null;
  garantia: string | null;
  descripcion: string | null;
  activo: boolean;
  orden: number;
};

export type ProductoInput = {
  nombre: string;
  tipo: ProductoTipo;
  monto_usd: number | null;
  suscripcion_meses: number | null;
  promesa?: string | null;
  incluye?: string | null;
  garantia?: string | null;
  descripcion?: string | null;
  activo?: boolean;
};

const COLS = 'id, nombre, tipo, monto_usd, suscripcion_meses, promesa, incluye, garantia, descripcion, activo, orden';

export async function listProductos(soloActivos = false): Promise<Producto[]> {
  const db = await getTenantDb();
  let q = db.from('productos').select(COLS).order('orden', { ascending: true }).order('id', { ascending: true });
  if (soloActivos) q = q.eq('activo', true);
  const { data, error } = await q;
  if (error) throw new Error(`listProductos falló: ${error.message}`);
  return (data ?? []) as unknown as Producto[];
}

export async function upsertProducto(input: ProductoInput, id?: number): Promise<number> {
  const db = await getTenantDb();
  const esSus = input.tipo === 'suscripcion';
  const row = {
    nombre: input.nombre.trim(),
    tipo: esSus ? 'suscripcion' : 'unico',
    monto_usd: input.monto_usd ?? null,
    suscripcion_meses: esSus ? (input.suscripcion_meses ?? null) : null,
    promesa: input.promesa?.trim() || null,
    incluye: input.incluye?.trim() || null,
    garantia: input.garantia?.trim() || null,
    descripcion: input.descripcion?.trim() || null,
    activo: input.activo ?? true,
  };
  if (id) {
    const { error } = await db.from('productos').update(row).eq('id', id);
    if (error) throw new Error(`upsertProducto (update) falló: ${error.message}`);
    return id;
  }
  const { data, error } = await db.from('productos').insert(row).select('id').single();
  if (error) throw new Error(`upsertProducto (insert) falló: ${error.message}`);
  return Number((data as { id: number }).id);
}

export async function deleteProducto(id: number): Promise<void> {
  const db = await getTenantDb();
  const { error } = await db.from('productos').delete().eq('id', id);
  if (error) throw new Error(`deleteProducto falló: ${error.message}`);
}

/**
 * Siembra el primer producto desde la 'oferta' del onboarding, si el catálogo
 * está vacío — para no perder lo que el usuario ya cargó. Idempotente (solo
 * corre con catálogo vacío).
 */
export async function seedProductosDesdeOferta(): Promise<void> {
  // Guard: se siembra UNA sola vez. Si el usuario después borra el producto
  // sembrado, no vuelve a aparecer al recargar.
  if ((await getSetting(SEED_KEY))?.trim()) return;
  const existentes = await listProductos();
  if (existentes.length > 0) { await setSetting(SEED_KEY, '1'); return; }
  const a = await getAnswers().catch(() => ({} as Record<string, string>));
  const nombre = (a.oferta_nombre ?? '').trim();
  await setSetting(SEED_KEY, '1'); // marcamos aunque no haya oferta: no reintentar cada carga
  if (!nombre) return;
  const ticket = parseFloat(a.oferta_ticket ?? '');
  await upsertProducto({
    nombre,
    tipo: 'unico',
    monto_usd: Number.isFinite(ticket) ? ticket : null,
    suscripcion_meses: null,
    promesa: a.oferta_promesa ?? null,
    incluye: a.oferta_incluye ?? null,
    garantia: a.oferta_garantia ?? null,
  });
}
