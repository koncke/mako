'use server';

// Server actions del modal de confirmaciones de MaKo (MakoConfirmGate).

import { revalidatePath } from 'next/cache';
import { listPendientes, resolverConfirmacion, type MakoConfirmacion } from '@/lib/mako-confirmaciones';
import { listarFunnels } from '@/lib/funnels';
import { getUsuarioActual } from '@/lib/auth';

/**
 * ⚠️ SIN SESIÓN NO HAY NADA QUE LISTAR NI RESOLVER. Las dos acciones las monta el LAYOUT raíz
 * (MakoConfirmGate), así que su id viaja en todas las páginas — y sin cookie
 * `getWorkspaceActual()` cae al dueño (el ws1). Medido el 06/10/2026: un POST sin cookie a
 * `/login` devolvía las confirmaciones pendientes del CRM del ws1. El corte de fondo es el proxy
 * (una página pública sólo se lee, `esPublicaSoloLeer`); éste es el segundo, para que la acción
 * no dependa de por qué ruta llegó.
 */
async function haySesion(): Promise<boolean> {
  try { return Boolean(await getUsuarioActual()); } catch { return false; }
}

async function autorActual(): Promise<string> {
  try {
    const s = await getUsuarioActual();
    return s?.email?.trim() || 'CRM';
  } catch {
    return 'CRM';
  }
}

/**
 * Qué confirmaciones tiene que listar la tarjeta.
 *
 *   'todo'              → las del workspace, como siempre. Es lo que se pide en las
 *                         pantallas de /crm que NO son un tablero de producto (la ficha
 *                         de un lead, /crm/revisar, /crm/new): ahí no hay producto a la
 *                         vista, y esconder un cambio de MaKo donde no se puede decir de
 *                         quién es sería perder el aviso.
 *   { funnel: N|null }  → las del producto que se está mirando. `null` = el del negocio.
 *
 * Es un parámetro y no un dato que la action deduzca: una server action no ve la URL, y
 * el `?funnel=` vive en el query string del navegador.
 */
export type AlcanceConfirmaciones = 'todo' | { funnel: number | null };

/**
 * Confirmaciones pendientes del producto que se está mirando (o del workspace).
 *
 * ⚠️ EL ID DE LA URL SE VALIDA ACÁ, NO EN EL CLIENTE — misma regla que `app/crm/page.tsx:95`.
 * Un `?funnel=` que no nombra un funnel activo, del workspace y no default, se descarta y
 * el tablero dibuja el del negocio: si la tarjeta se creyera el crudo, con `?funnel=999` el
 * tablero mostraría los 1.530 leads y la tarjeta se filtraría por 999 → tarjeta vacía sobre
 * un tablero lleno. Dos superficies contando cosas distintas del mismo tablero, que es el
 * bug que esto viene a cerrar.
 *
 * No es un IDOR (`getTenantDb()` acota al workspace igual): lo que está en juego es
 * mostrar la lista EQUIVOCADA, no la de otro cliente.
 */
export async function listConfirmacionesAction(alcance: AlcanceConfirmaciones = 'todo'): Promise<MakoConfirmacion[]> {
  if (!(await haySesion())) return [];
  if (alcance === 'todo') return listPendientes();
  const funnels = await listarFunnels().catch(() => []);
  const pedido = Number.isInteger(alcance.funnel) && (alcance.funnel ?? 0) > 0 ? alcance.funnel : null;
  const funnelId = funnels.some((f) => f.id === pedido && !f.esDefault) ? pedido : null;
  // `listarFunnels()` ya trae sólo los `activo`: eso es lo que hace «mirable» a un embudo.
  // Y el default se excluye a propósito — ver `ProductoALaVista.secundarios`.
  return listPendientes({ funnelId, secundarios: funnels.filter((f) => !f.esDefault).map((f) => f.id) });
}

/** Resuelve una confirmación: 'confirmar' | 'rechazar' | 'op:<key>'. */
export async function resolverConfirmacionAction(id: number, decision: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!(await haySesion())) return { ok: false, error: 'Sin sesión.' };
    const autor = await autorActual();
    await resolverConfirmacion(id, decision, autor);
    revalidatePath('/crm');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
