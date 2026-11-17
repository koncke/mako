'use server';

// =============================================================================
// ficha/pagos/seguimiento-actions — lo que leen y escriben «Recordatorios de cobro» y «Excepciones» (P28, 17/11/2026)
// =============================================================================
// El contrato de la ficha (../tipos.ts, punto 3): lo que no viene en `LeadFullData` lo pide cada bloque con SU action al
// montarse, así nadie paga la lectura de un bloque que no está puesto. Lo puro (qué se dibuja) es lib/pagos-bloques-lead.ts.
//
//   · `recordatoriosDeCobroAction`: las corridas de cobranza vivas de sus cuotas sin cobrar (`recordatoriosDelLead`). El
//     «Cortarlo» es la acción que ya existía, `cortarRecordatoriosCuotaAction` (app/crm/[id]/pagos-campo-actions.ts).
//   · `motivosDeExcepcionesAction`: el último motivo que dejó en el historial cada excepción declarada al mover la etapa.
//   · `quitarExcepcionAction` / `volverExcepcionAction`: «Quitarla» (el diseño: «Quitarlas (nuevo)») y su Deshacer.
//     Quitar una excepción hace que el dato eximido se vuelva a pedir: la cabecera recuenta «N sin marcar» al releer.
// =============================================================================

import { revalidatePath, updateTag } from 'next/cache';
import { TAG } from '@/lib/cache';
import { getUsuarioActual } from '@/lib/auth';
import { getTenantDb } from '@/lib/workspace';
import { logLeadEvent } from '@/lib/leads';
import { recordatoriosDelLead } from '@/lib/pagos';
import {
  EVENTOS_DE_EXCEPCION, esIdExcepcion, lineaAlQuitar, lineaAlVolver, recordatoriosPorCuota, valorAlQuitar, type IdExcepcion, type RecordatorioDeCuota,
} from '@/lib/pagos-bloques-lead';

type Fallo = { ok: false; error: string };
const SIN_SESION = 'Tu sesión no está activa en este negocio. Recarga la página.';
const idValido = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;
const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e));

async function quienEs(): Promise<string | null> {
  try { const u = await getUsuarioActual(); return u ? u.email?.trim() || 'CRM' : null; } catch { return null; }
}

function alCambiar(leadId: number) {
  try { updateTag(TAG.leads); } catch { /* vence por su TTL */ }
  revalidatePath(`/crm/${leadId}`);
  revalidatePath('/crm');
}

/** Las cuotas sin cobrar del lead que tienen un recordatorio corriendo, con cuándo sale lo próximo. */
export async function recordatoriosDeCobroAction(leadId: number): Promise<{ ok: true; recordatorios: RecordatorioDeCuota[] } | Fallo> {
  try {
    if (!(await quienEs())) return { ok: false, error: SIN_SESION };
    if (!idValido(leadId)) return { ok: false, error: 'Lead inválido.' };
    const { cuotas, corridas } = await recordatoriosDelLead(leadId);
    return { ok: true, recordatorios: recordatoriosPorCuota(corridas, cuotas) };
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}

/**
 * El motivo de cada excepción: el ÚLTIMO texto de su evento en el historial (`completeStageMoveAction` lo escribe al
 * declararla). El de la R2 por fuera llega como «R2 · <motivo>». Sin historial leído, el bloque muestra las excepciones sin
 * motivo (nunca uno inventado).
 */
export async function motivosDeExcepcionesAction(leadId: number): Promise<{ ok: true; motivos: Record<string, string> } | Fallo> {
  try {
    if (!(await quienEs())) return { ok: false, error: SIN_SESION };
    if (!idValido(leadId)) return { ok: false, error: 'Lead inválido.' };
    const db = await getTenantDb();
    const { data, error } = await db.from('lead_audit').select('campo, valor_nuevo, created_at')
      .eq('lead_id', leadId).in('campo', [...EVENTOS_DE_EXCEPCION]).order('created_at', { ascending: false }).limit(40);
    if (error) return { ok: false, error: `No pude leer los motivos: ${error.message}` };
    const motivos: Record<string, string> = {};
    for (const r of (data ?? []) as Array<{ campo: string; valor_nuevo: string | null }>) {
      if (motivos[r.campo] != null) continue; // el más nuevo gana: vienen ordenados
      const t = (r.valor_nuevo ?? '').replace(/^R2 · /, '').trim();
      if (t) motivos[r.campo] = t;
    }
    return { ok: true, motivos };
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}

/**
 * Quita UNA excepción. Compare-and-set: sólo si sigue puesta (otra persona pudo quitarla mientras tanto, y entonces no se
 * escribe nada ni se ensucia el historial). Devuelve lo que había, para el Deshacer.
 */
export async function quitarExcepcionAction(leadId: number, id: IdExcepcion): Promise<{ ok: true; antes: boolean | string; cambio: boolean } | Fallo> {
  try {
    const autor = await quienEs();
    if (!autor) return { ok: false, error: SIN_SESION };
    if (!idValido(leadId) || !esIdExcepcion(id)) return { ok: false, error: 'Excepción inválida.' };
    const db = await getTenantDb();
    const { data: fila, error: eLeer } = await db.from('leads').select(id).eq('id', leadId).maybeSingle();
    if (eLeer) return { ok: false, error: `No pude leer el lead: ${eLeer.message}` };
    if (!fila) return { ok: false, error: 'Ese lead no existe en este negocio.' };
    const antes = (fila as unknown as Record<string, unknown>)[id];
    const puesta = id === 'r2_agenda_externa_motivo' ? typeof antes === 'string' && antes.trim() !== '' : antes === true;
    if (!puesta) return { ok: true, antes: false, cambio: false };
    let q = db.from('leads').update({ [id]: valorAlQuitar(id) }).eq('id', leadId);
    q = id === 'r2_agenda_externa_motivo' ? q.eq(id, antes as string) : q.eq(id, true);
    const { data: hecho, error } = await q.select('id');
    if (error) return { ok: false, error: `No pude quitarla: ${error.message}` };
    if (!hecho?.length) return { ok: false, error: 'La excepción cambió mientras tanto. Recarga la ficha.' };
    await logLeadEvent(leadId, 'Excepción', lineaAlQuitar(id), autor);
    alCambiar(leadId);
    return { ok: true, antes: antes as boolean | string, cambio: true };
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}

/** El Deshacer de «Quitar»: la vuelve a poner con lo que tenía (true, o el motivo de la R2 por fuera). */
export async function volverExcepcionAction(leadId: number, id: IdExcepcion, antes: boolean | string): Promise<{ ok: true } | Fallo> {
  try {
    const autor = await quienEs();
    if (!autor) return { ok: false, error: SIN_SESION };
    if (!idValido(leadId) || !esIdExcepcion(id)) return { ok: false, error: 'Excepción inválida.' };
    const valor = id === 'r2_agenda_externa_motivo' ? (typeof antes === 'string' && antes.trim() ? antes.trim().slice(0, 500) : null) : antes === true;
    if (valor == null || valor === false) return { ok: false, error: 'No hay nada que volver a poner.' };
    const db = await getTenantDb();
    const { error } = await db.from('leads').update({ [id]: valor }).eq('id', leadId);
    if (error) return { ok: false, error: `No pude volver a ponerla: ${error.message}` };
    await logLeadEvent(leadId, 'Excepción', lineaAlVolver(id), autor);
    alCambiar(leadId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}
