'use server';

// =============================================================================
// Server actions de Customer Success — emitir, rotar y revocar el link del cliente
// =============================================================================
// Esto reemplaza al script de terminal. Es la única forma en que Mauricio puede
// darle a un cliente la llave de su tarea, así que las reglas del share valen
// igual acá que allá — y con más razón, porque acá el que aprieta el botón no
// necesariamente sabe lo que hay detrás:
//
//   · `permiso: 'editar'` + `alcance: 'item'` apuntando al lead. `crearShare`
//     rechaza cualquier otra combinación, así que no se puede emitir de más.
//   · El token se devuelve UNA sola vez. De la base solo sale su sha256, así que
//     ni esta acción ni ninguna otra lo puede volver a leer. Por eso la pantalla
//     lo muestra en un cartel que hay que cerrar a mano.
//   · Rotar REVOCA lo anterior. Dos links vivos son dos formas de entrar y una
//     sola que alguien se acuerde de cortar.
//
// ⚠️ El lead se valida contra la cartera del workspace de la sesión, no se
// confía del id que llega. Sin eso, un POST con el id de un lead ajeno emitiría
// una llave de escritura sobre datos de otro inquilino.

import { revalidatePath } from 'next/cache';
import { crearShare, listarShares, revocarShare } from '@/lib/shares';
import { getTenantDb, getWorkspaceActual, OWNER_WS } from '@/lib/workspace';
import { getPerfil } from '@/lib/perfil';
import { RECURSO_TAREA, type EstadoCliente } from '@/lib/cs-cartera';
import { APP_BASE_URL } from '@/lib/app-url';

async function wsActual(): Promise<number> {
  return (await getWorkspaceActual()) ?? OWNER_WS;
}

/** ¿Este lead es un cliente DE ESTE workspace? Fail-closed. */
async function clienteDelWorkspace(leadId: number): Promise<{ id: number; nombre: string } | null> {
  if (!Number.isFinite(leadId) || leadId <= 0) return null;
  const db = await getTenantDb();
  const { data } = await db.from('leads')
    .select('id, nombre').eq('id', leadId).eq('estado_lead', 'ganado').maybeSingle();
  return (data as { id: number; nombre: string } | null) ?? null;
}

export type ResultadoLink =
  | { ok: true; url: string; nombre: string; mandado?: boolean; avisoEnvio?: string }
  | { ok: false; error: string };

/**
 * Emite el link de un cliente. Si ya tenía uno vivo, no hace nada salvo que se
 * pida `rotar`: el token viejo no se puede recuperar, así que emitir de nuevo
 * sin querer dejaría al cliente con un link que nadie sabe cuál es.
 */
export async function emitirLinkAction(
  leadId: number, rotar = false,
  /** true = además se lo manda por WhatsApp. El click de Mauricio ES la
   *  aprobación: acá no va por la cola de borradores. */
  mandarPorWhatsApp = false,
): Promise<ResultadoLink> {
  const ws = await wsActual();
  const cliente = await clienteDelWorkspace(leadId);
  if (!cliente) return { ok: false, error: 'Ese cliente no está en tu cartera.' };

  const vivos = (await listarShares(ws, RECURSO_TAREA).catch(() => []))
    .filter((s) => String((s as { recurso_id?: unknown }).recurso_id) === String(leadId)
      && !(s as { revocado_at?: string | null }).revocado_at);

  if (vivos.length && !rotar) {
    return { ok: false, error: `${cliente.nombre} ya tiene un link vivo. Para emitir uno nuevo hay que rotar, y el anterior deja de andar.` };
  }
  for (const s of vivos) await revocarShare(ws, (s as { id: number }).id).catch(() => {});

  const quien = await getPerfil().then(p => p.nombre).catch(() => null);
  const { token } = await crearShare({
    ws, recurso: RECURSO_TAREA, alcance: 'item', recursoId: String(leadId),
    modo: 'link', permiso: 'editar',
    etiqueta: `Tarea del programa — ${cliente.nombre}`,
    creadoPor: quien ?? 'Customer Success',
  });

  const url = `${APP_BASE_URL}/compartido/${token}`;

  // ⚠️ El token lo pone el CÓDIGO, no un modelo. Son 43 caracteres al azar sin
  // ninguna redundancia: si lo transporta un LLM falla de dos formas, y la
  // silenciosa —un link que resuelve a OTRO cliente— es la peor.
  let mandado = false;
  let avisoEnvio: string | undefined;
  if (mandarPorWhatsApp) {
    const { mandarElLink } = await import('@/lib/cs-mensajes');
    const r = await mandarElLink({ leadId, nombre: cliente.nombre, token })
      .catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : 'falló el envío' }));
    mandado = r.ok;
    if (!r.ok) avisoEnvio = r.error;
  }

  revalidatePath('/customer-success');
  return { ok: true, url, nombre: cliente.nombre, mandado, avisoEnvio };
}

/** Corta el acceso al instante: cada request revalida contra la fila viva. */
export async function revocarLinksAction(leadId: number): Promise<{ ok: boolean; revocados: number }> {
  const ws = await wsActual();
  if (!(await clienteDelWorkspace(leadId))) return { ok: false, revocados: 0 };

  const vivos = (await listarShares(ws, RECURSO_TAREA).catch(() => []))
    .filter((s) => String((s as { recurso_id?: unknown }).recurso_id) === String(leadId)
      && !(s as { revocado_at?: string | null }).revocado_at);
  for (const s of vivos) await revocarShare(ws, (s as { id: number }).id).catch(() => {});

  revalidatePath('/customer-success');
  return { ok: true, revocados: vivos.length };
}

// ── Sincronizar el programa a Whop ──────────────────────────────────────────
// Lo mismo que hacía `scripts/cargar-programa-whop.ts`, desde un botón. El
// script queda para el arranque desde cero; el día a día es esto.
//
// Idempotente por título, igual que el script: la API de Whop no tiene «crear si
// no existe» ni borrado en lote, así que correrlo dos veces sin comparar dejaría
// el curso duplicado y sin forma cómoda de limpiarlo.

export type ResultadoSync =
  | { ok: true; creadas: number; reescritas: number; sinCambios: number; mapa: number }
  | { ok: false; error: string };

export async function sincronizarWhopAction(): Promise<ResultadoSync> {
  const ws = await wsActual();
  try {
    const { sincronizarPrograma } = await import('@/lib/cs-sync-whop');
    const r = await sincronizarPrograma(ws);
    revalidatePath('/customer-success/programa');
    return r;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo sincronizar.' };
  }
}

// ── El estado del cliente dentro del programa ───────────────────────────────
// `graduado` y `baja` son DECISIONES, no cálculos: el contrato dice cuándo vence
// el plazo, no si el trabajo se terminó. La garantía de Sergio Esquer dice
// textual «continuar sesiones sin costo hasta instalación completa», así que
// pasarse de las 16 semanas no significa nada por sí solo.

export async function marcarEstadoAction(
  leadId: number, estado: EstadoCliente, motivo?: string,
): Promise<{ ok: boolean; error?: string }> {
  const ws = await wsActual();
  const cliente = await clienteDelWorkspace(leadId);
  if (!cliente) return { ok: false, error: 'Ese cliente no está en tu cartera.' };

  const { getTenantDb: db } = await import('@/lib/workspace');
  const ahora = new Date().toISOString();
  const { error } = await (await db())
    .from('cs_clientes')
    .upsert({
      lead_id: leadId, estado,
      estado_at: estado === 'activo' ? null : ahora,
      motivo: motivo?.trim() || null,
      updated_at: ahora,
    }, { onConflict: 'workspace_id,lead_id' });

  if (error) return { ok: false, error: error.message };
  revalidatePath('/customer-success');
  return { ok: true };
}
