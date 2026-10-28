'use server';

// =============================================================================
// difusion/actions — la hoja de difusión del CRM le pide al server (28/10/2026)
// =============================================================================
// Las dos puertas de `HojaDifusion`: ver a quién le llega (no escribe) y mandarla (crea la automatización y la inscribe,
// lib/difusion.ts). Sólo el administrador del negocio, como frenar o empezar de nuevo desde el CRM.
// =============================================================================

import { requireSesion } from '@/lib/tab-access';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual } from '@/lib/workspace';
import { prepararDifusion, crearDifusion, type SeleccionDifusion, type VistaDifusion, type ResultadoDifusion } from '@/lib/difusion';
import { esCanalDifusion, type CanalDifusion, type MensajesDifusion } from '@/lib/difusion-reglas';

/** El negocio de la sesión; sin uno, tira (no se adivina). */
async function wsActual(): Promise<number> {
  const ws = await getWorkspaceActual();
  if (ws == null) throw new Error('no sé de qué negocio es');
  return ws;
}

/** La selección que llega del cliente, saneada: ids enteros, o una etapa con su embudo. null = no se entiende. */
function seleccionDe(raw: unknown): SeleccionDifusion | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { leadIds?: unknown; etapa?: unknown; funnelId?: unknown };
  if (Array.isArray(o.leadIds)) return { leadIds: o.leadIds.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0) };
  if (typeof o.etapa === 'string' && o.etapa.trim()) {
    const f = Number(o.funnelId);
    return { etapa: o.etapa.trim(), funnelId: Number.isInteger(f) && f > 0 ? f : null };
  }
  return null;
}

export async function prepararDifusionAction(seleccion: unknown): Promise<{ ok: true; vista: VistaDifusion } | { ok: false; error: string }> {
  const rol = await requireSesion();
  if (rol !== 'admin') return { ok: false, error: 'Sólo el administrador puede mandar una difusión.' };
  const sel = seleccionDe(seleccion);
  if (!sel) return { ok: false, error: 'Elige los leads o una columna.' };
  try {
    return { ok: true, vista: await prepararDifusion(await wsActual(), sel) };
  } catch (e) {
    return { ok: false, error: `No pude leer a quién le llega: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function crearDifusionAction(input: {
  seleccion: unknown; canales: unknown; mensajes: unknown; goteo: unknown;
}): Promise<ResultadoDifusion> {
  const rol = await requireSesion();
  if (rol !== 'admin') return { ok: false, error: 'Sólo el administrador puede mandar una difusión.' };
  const sel = seleccionDe(input.seleccion);
  if (!sel) return { ok: false, error: 'Elige los leads o una columna.' };
  const canales = (Array.isArray(input.canales) ? input.canales : []).filter(esCanalDifusion) as CanalDifusion[];
  try {
    const autor = (await getUsuarioActual().catch(() => null))?.email?.trim() || 'CRM';
    return await crearDifusion(await wsActual(), {
      seleccion: sel, canales, mensajes: (input.mensajes ?? {}) as MensajesDifusion, goteo: input.goteo as { minutos: number; dia: number }, autor,
    });
  } catch (e) {
    return { ok: false, error: `No pude mandarla: ${e instanceof Error ? e.message : String(e)}` };
  }
}
