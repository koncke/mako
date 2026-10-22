'use server';

// =============================================================================
// Cómo se ve la tarjeta de un cliente, a elección de cada persona (21/10/2026)
// =============================================================================
// Martín: «la personalización de las tarjetas en clientes, plan, etc.». El molde es el del CRM
// (app/crm/tarjeta-campos-actions.ts); el porqué de «por persona», en lib/tarjeta-clientes.ts. Acá sólo la puerta: la
// sesión viva y la MISMA de las demás actions de Clientes (`puedeUsarCs`, ./puerta.ts), y lo que llega se limpia contra
// el catálogo (`setTarjetaClientes`).
// ⚠️ ARCHIVO APARTE de ./actions.ts a propósito: tests/cs-acciones-puerta.test.ts enumera los exports de aquel, y esto no
//    toca ningún lead (escribe en la fila de quien mira, no en la cartera).
// =============================================================================

import { exigirSesion } from '@/lib/sesion-accion';
import { setTarjetaClientes } from '@/lib/perfil';
import { puedeUsarCs } from './puerta';
import type { CampoTarjetaCliente, FormaTarjetaCliente, PlantillaTarjetaCliente } from '@/lib/tarjeta-clientes';

/** `plantillas` ausente = se quedan las propias que tenía (elegir una o sacar un dato no las toca). */
export async function guardarTarjetaClientesAction(campos: string[], forma?: string, plantillas?: unknown[]): Promise<{ ok: true; campos: CampoTarjetaCliente[]; forma: FormaTarjetaCliente; plantillas: PlantillaTarjetaCliente[]; guardado: boolean } | { ok: false; error: string }> {
  await exigirSesion();
  const no = await puedeUsarCs(); if (no) return { ok: false, error: no };
  try {
    const r = await setTarjetaClientes(campos, forma, plantillas);
    return { ok: true, ...r };
  } catch (e) {
    console.error('[cs] guardar la tarjeta:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'No pude guardarlo.' };
  }
}
