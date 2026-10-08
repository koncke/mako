'use server';

// =============================================================================
// Confirmar o cancelar una acción pendiente desde la bandeja /mako/pendientes
// =============================================================================
// Todo el ciclo (reclamar → ejecutar → resolver) vive en lib/api-mako/acciones.ts
// y es el MISMO que usan WhatsApp y la API. Acá solo se arma el contexto de la
// persona logueada y se traduce el resultado a algo que la fila pueda pintar.
// =============================================================================

import { revalidatePath } from 'next/cache';
import { confirmarPendiente, cancelarPendiente } from '@/lib/api-mako/acciones';
import { ctxDeBandeja } from '../ctx-bandeja';

export type ResultadoBandeja = { ok: true; resumen: string } | { ok: false; error: string };

const idValido = (id: unknown): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0;

export async function confirmarPendienteAction(id: number): Promise<ResultadoBandeja> {
  if (!idValido(id)) return { ok: false, error: 'Falta el id de la acción.' };
  const c = await ctxDeBandeja();
  if ('error' in c) return { ok: false, error: c.error };
  // Lo que el código sólo le muestra a una persona (la agenda de Google, que no pasa
  // por ningún modelo: lib/agenda-sin-ia.ts). Acá la que mira es una persona, así que
  // va pegado al resumen — si no, quien confirma desde la bandeja pierde el motivo real.
  const detalle: string[] = [];
  const r = await confirmarPendiente({ ...c.ctx, aPersona: (t) => { detalle.push(t); } }, id);
  revalidatePath('/mako/pendientes');
  if ('error' in r) return { ok: false, error: r.error };
  const conDetalle = [r.resumen, ...detalle].join('\n');
  // `ok: false` acá es «se ejecutó y falló»: la pendiente ya quedó en `error` y
  // no vuelve a `pendiente`. Se muestra el motivo, no se invita a reintentar.
  return r.ok ? { ok: true, resumen: conDetalle } : { ok: false, error: conDetalle };
}

export async function cancelarPendienteAction(id: number): Promise<ResultadoBandeja> {
  if (!idValido(id)) return { ok: false, error: 'Falta el id de la acción.' };
  const c = await ctxDeBandeja();
  if ('error' in c) return { ok: false, error: c.error };
  const r = await cancelarPendiente(c.ctx, id);
  revalidatePath('/mako/pendientes');
  if ('error' in r) return { ok: false, error: r.error };
  return { ok: true, resumen: r.resumen };
}
