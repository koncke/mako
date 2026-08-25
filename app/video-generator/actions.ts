'use server';

// =============================================================================
// /video-generator — server actions: planificar el anuncio
// =============================================================================
// El motor es lib/video-planner.ts (generarPlan): acá solo viven el guard, el
// historial y el saneo del pedido. El guard de rol usa el patrón ctxAdmin de
// app/reels/actions.ts — la agencia sin impersonar corta con error, nunca cae
// al workspace del dueño.

import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { generarPlan } from '@/lib/video-planner';
import { puestaPorId } from '@/lib/puestas-data';
import {
  guardarEnHistorial, leerHistorial, type PlanGuardado,
} from './video-datos';
import {
  acentoPrompt, clipsParaDuracion, componerTema, segundosDe, type PedidoVideo,
} from './video-pedido';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Rol admin del workspace + ws concreto, o error honesto. */
async function ctxAdmin(): Promise<{ ok: true; ws: number } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') {
    return { ok: false, error: 'Solo el administrador del workspace puede hacer esto.' };
  }
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'Sin workspace activo. Entra al workspace de un cliente para planificar un anuncio.' };
  return { ok: true, ws };
}

export type GenerarPlanActionOut =
  | { ok: true; item: PlanGuardado; historial: PlanGuardado[] }
  | { ok: false; error: string };

/**
 * Arma el plan de clips desde el pedido (puesta + tema + duración). Para
 * regenerar con feedback, `anteriorId` apunta al plan del historial y
 * `feedback` dice qué cambiar: el plan anterior viaja RESUMIDO dentro del tema
 * (título, ritmo, el guion de corrido), no el JSON entero.
 */
export async function generarPlanAction(
  input: PedidoVideo & { anteriorId?: string },
): Promise<GenerarPlanActionOut> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const puesta = puestaPorId(input.puestaId);
  if (!puesta) return { ok: false, error: 'Elige una puesta en escena antes de generar.' };

  const tema = (input.tema ?? '').trim();
  if (!tema) return { ok: false, error: 'Escribe el tema o la historia del anuncio primero.' };

  try {
    const anterior = input.anteriorId
      ? (await leerHistorial()).find((e) => e.id === input.anteriorId)?.plan
      : undefined;

    const totalSeg = segundosDe(input.duracion);
    const out = await generarPlan(ctx.ws, {
      puestaId: puesta.id,
      anguloId: input.anguloId,
      acentoPrompt: acentoPrompt(input.acento),
      tema: componerTema({ ...input, tema }, anterior),
      cantidadClips: clipsParaDuracion(puesta, totalSeg),
      duracionTotalSeg: totalSeg,
      feedback: input.feedback,
    });
    if (!out.ok) return out;

    const item: PlanGuardado = {
      id: crypto.randomUUID(),
      pedido: tema.slice(0, 200),
      plan: out.plan,
      at: new Date().toISOString(),
    };
    const historial = await guardarEnHistorial(item);
    return { ok: true, item, historial };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}
