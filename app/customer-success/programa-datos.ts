import 'server-only';

// =============================================================================
// programa-datos — eliminar y restaurar un PROGRAMA (un producto con su curso), sin la sesión
// =============================================================================
// Lo que hacía `eliminarServicioAction` (./actions.ts) adentro, sacado acá el 25/10/2026 para que lo usen DOS puertas
// sin copiarlo: la action de la pantalla (que pregunta si quien aprieta es admin) y la API de MaKo
// (lib/api-mako/areas/curso.run.ts, que tiene su propio gating). Ninguna función de acá mira la sesión: eso es de la
// puerta. La regla (archivar sus embudos, o la baja si no tiene ninguno), pura y con test, en ./eliminar-programa.ts.
//
// ⚠️ CORRE EN EL NEGOCIO DEL CONTEXTO (`getTenantDb()`): quien llama ya lo fijó.

import { getTenantDb } from '@/lib/workspace';
import { archivarFunnel, restaurarFunnel } from '@/lib/funnels';
import { pasoParaEliminar, deshacerValido, type DeshacerEliminar, type EmbudoDelProducto } from './eliminar-programa';

/** Los embudos atados a un producto (vía `v_funnel_productos`), con su estado. */
export async function embudosDelProducto(productoId: number): Promise<EmbudoDelProducto[]> {
  const db = await getTenantDb();
  const { data: vp, error } = await db.from('v_funnel_productos').select('funnel_id').eq('producto_id', productoId);
  if (error) throw new Error(`No pude leer los embudos del producto: ${error.message}`);
  const fids = [...new Set(((vp ?? []) as Array<{ funnel_id: number }>).map((r) => Number(r.funnel_id)))];
  if (!fids.length) return [];
  const { data: fs, error: e2 } = await db.from('funnels').select('id, activo, es_default').in('id', fids);
  if (e2) throw new Error(`No pude leer los embudos del producto: ${e2.message}`);
  return ((fs ?? []) as Array<{ id: number; activo: boolean; es_default: boolean }>)
    .map((f) => ({ id: Number(f.id), activo: f.activo !== false, esDefault: f.es_default === true }));
}

/** Pone el producto de alta o de baja en el catálogo. Tira si no es de este negocio. */
async function ponerActivo(productoId: number, activo: boolean): Promise<void> {
  const db = await getTenantDb();
  const { data: tocadas, error } = await db.from('productos').update({ activo }).eq('id', productoId).select('id');
  if (error) throw new Error(`No se pudo ${activo ? 'restaurar' : 'eliminar'}: ${error.message}`);
  if (!((tocadas ?? []) as unknown[]).length) throw new Error('Ese producto no es de este workspace.');
}

/**
 * Elimina un programa como el CRM: ARCHIVA, no borra (vuelve desde «Productos eliminados»). Devuelve QUÉ hizo, para que
 * deshacer sea lo inverso exacto; `null` = no había nada que hacer (ya estaba archivado). Un «no» de la regla (el
 * principal) vuelve como `error`.
 */
export async function eliminarPrograma(productoId: number): Promise<{ ok: true; deshacer: DeshacerEliminar | null } | { ok: false; error: string }> {
  const paso = pasoParaEliminar(await embudosDelProducto(productoId));
  if (paso.tipo === 'no') return { ok: false, error: paso.error };
  if (paso.tipo === 'archivar') {
    for (const id of paso.ids) await archivarFunnel(id);
    return { ok: true, deshacer: { tipo: 'embudos', ids: paso.ids } };
  }
  if (paso.tipo === 'baja') {
    await ponerActivo(productoId, false);
    return { ok: true, deshacer: { tipo: 'baja' } };
  }
  return { ok: true, deshacer: null };
}

/** Lo inverso EXACTO de `eliminarPrograma`. Los embudos tienen que ser de ESE producto (`deshacerValido`). */
export async function restaurarPrograma(productoId: number, deshacer: DeshacerEliminar): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!deshacer || (deshacer.tipo !== 'baja' && deshacer.tipo !== 'embudos')) return { ok: false, error: 'No sé qué deshacer.' };
  if (!deshacerValido(deshacer, await embudosDelProducto(productoId))) return { ok: false, error: 'Ese producto no es de este workspace.' };
  if (deshacer.tipo === 'embudos') for (const id of deshacer.ids) await restaurarFunnel(id);
  else await ponerActivo(productoId, true);
  return { ok: true };
}

/**
 * Restaura un programa eliminado SIN saber qué hizo el eliminar (la API de MaKo, días después): vuelve a dar de alta
 * el producto si estaba de baja y saca de «Productos eliminados» todos sus embudos archivados. Es lo mismo que
 * restaurarlo desde el CRM.
 */
export async function restaurarProgramaEliminado(productoId: number): Promise<{ ok: true; embudos: number; deAlta: boolean } | { ok: false; error: string }> {
  const db = await getTenantDb();
  const { data, error } = await db.from('productos').select('id, activo').eq('id', productoId).maybeSingle();
  if (error) throw new Error(error.message);
  const p = data as { id: number; activo: boolean | null } | null;
  if (!p) return { ok: false, error: 'Ese producto no es de este workspace.' };
  const archivados = (await embudosDelProducto(productoId)).filter((f) => !f.activo);
  const deAlta = p.activo === false;
  if (!deAlta && !archivados.length) return { ok: false, error: 'Ese programa no está eliminado.' };
  if (deAlta) await ponerActivo(productoId, true);
  for (const f of archivados) await restaurarFunnel(f.id);
  return { ok: true, embudos: archivados.length, deAlta };
}
