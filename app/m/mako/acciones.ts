'use server';

// =============================================================================
// Confirmar o cancelar, desde la TARJETA del chat del teléfono, una acción que MaKo propuso
// =============================================================================
// El ciclo (reclamar → ejecutar → resolver, con gatingOk mirado OTRA VEZ al confirmar) es el
// de lib/api-mako/acciones.ts, el mismo de WhatsApp y de la bandeja. Lo que cambia es el Ctx:
// la clave del chat (`app:<sesión>`, así sólo alcanza lo que se propuso en ESE chat), el rol
// REAL de la persona (un closer no confirma lo que es de admin) y su email como actor. NO
// usa ctxDeBandeja: ése es sólo de admin y ve todo el workspace.
//
// ⚠️ La página que monta estas acciones (/m/mako) declara `export const maxDuration = 300`:
// el techo de la PÁGINA gobierna sus server actions, y sin él una acción lenta se corta a
// mitad con la pendiente ya reclamada (docs/hallazgos-infra.md).
//
// Archivo 'use server': sólo funciones async exportadas (AGENTS.md). Los tipos viven en
// lib/mako-turno-app-reglas.ts.
// =============================================================================

import { refresh } from 'next/cache';
import { personaDelRequest, confirmarDesdeTarjeta, cancelarDesdeTarjeta } from '@/lib/mako-turno-app';
import type { ResultadoTarjeta } from '@/lib/mako-turno-app-reglas';

const idValido = (id: unknown): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0;

/** Redibuja lo que el server dibujó en /m (el badge de Inbox cuenta esta pendiente). El hilo
 *  no se pisa: es estado del cliente. Envuelto: la escritura ya pasó, y un fallo al refrescar
 *  no puede volverla un error (el molde de app/m/inbox/acciones.ts). */
function refrescar(): void {
  try { refresh(); } catch (e) { console.error('[m/mako] refresh:', e instanceof Error ? e.message : e); }
}

export async function confirmarEnChatAction(pendienteId: number, sessionId: number): Promise<ResultadoTarjeta> {
  if (!idValido(pendienteId) || !idValido(sessionId)) return { ok: false, error: 'Acción inválida' };
  const persona = await personaDelRequest();
  if ('error' in persona) return { ok: false, error: persona.error };
  const r = await confirmarDesdeTarjeta(persona, sessionId, pendienteId);
  refrescar();
  return r;
}

export async function cancelarEnChatAction(pendienteId: number, sessionId: number): Promise<ResultadoTarjeta> {
  if (!idValido(pendienteId) || !idValido(sessionId)) return { ok: false, error: 'Acción inválida' };
  const persona = await personaDelRequest();
  if ('error' in persona) return { ok: false, error: persona.error };
  const r = await cancelarDesdeTarjeta(persona, sessionId, pendienteId);
  refrescar();
  return r;
}
