'use server';

// =============================================================================
// Lo que la tarjeta de una reunión pide AL ABRIRSE el pop-up de «Tus reuniones» (22/10/2026, app/crm/TarjetaReunion.tsx):
// lo último que hizo el lead y lo de su R1. La lectura vive en lib/reunion-preparar.ts (nunca tira); esto pone la sesión
// adelante. La lee MaKo por su lado: `reuniones_proximas` (la hora y el link), `reuniones_lead` y Closing Analyst.
// =============================================================================

import { exigirSesion } from '@/lib/sesion-accion';
import { contextoParaReuniones, type ContextoReunion } from '@/lib/reunion-preparar';

export async function contextoDeReunionesAction(leadIds: number[]): Promise<{ ok: true; porLead: Record<number, ContextoReunion> } | { ok: false; error: string }> {
  try { await exigirSesion(); } catch { return { ok: false, error: 'Tu sesión venció: vuelve a entrar.' }; }
  if (!Array.isArray(leadIds)) return { ok: false, error: 'Pedido inválido.' };
  try {
    return { ok: true, porLead: await contextoParaReuniones(leadIds.map(Number)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
