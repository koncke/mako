'use server';

// =============================================================================
// Las columnas del Plan: renombrar, agregar y quitar (20/10/2026, docs/pedidos-crm.md B1)
// =============================================================================
// La regla está en lib/plan-columnas.ts. Acá la puerta: como editar el funnel en el CRM (`editarEtapaAction`), sólo
// el administrador del negocio. El id de una columna nueva lo acuña el server, nunca la pantalla.
// =============================================================================

import { exigirSesion } from '@/lib/sesion-accion';
import { getRolWsEfectivo } from '@/lib/workspace';
import { cambiarColumnasPlan } from '@/lib/plan-columnas-server';
import { nuevoIdColumna, type ConfigColumnasPlan, type PedidoColumnas } from '@/lib/plan-columnas';

export async function cambiarColumnasPlanAction(p: PedidoColumnas): Promise<{ ok: true; config: ConfigColumnasPlan } | { ok: false; error: string }> {
  await exigirSesion();
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: 'Sólo el administrador del negocio puede cambiar las columnas.' };
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  try {
    if (p?.tipo === 'renombrar') return await cambiarColumnasPlan({ tipo: 'renombrar', clave: str(p.clave), nombre: typeof p.nombre === 'string' ? p.nombre : null });
    if (p?.tipo === 'agregar') return await cambiarColumnasPlan({ tipo: 'agregar', despuesDe: str(p.despuesDe), nombre: str(p.nombre), id: nuevoIdColumna() });
    if (p?.tipo === 'quitar') return await cambiarColumnasPlan({ tipo: 'quitar', id: str(p.id) });
    return { ok: false, error: 'Cambio inválido.' };
  } catch (e) {
    console.error('[plan] cambiar columnas:', e instanceof Error ? e.message : String(e));
    return { ok: false, error: 'No pude guardar el cambio. Prueba de nuevo.' };
  }
}
