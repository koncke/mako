'use server';

// =============================================================================
// /reels — server actions: generar el guion y enviarlo a publicación
// =============================================================================
// El motor es lib/ig-writer.ts (generarPieza) y el puente a contenido_posts es
// lib/ig-contenido.ts (crearBorradorPublicacion): acá solo se guarda el guard,
// el historial y el marcado del onboarding de la tab. Ambos verifican el `ws`
// en POSITIVO contra el del request; el guard de rol vive acá (patrón ctxAdmin
// de app/instagram/actions.ts — la agencia sin impersonar corta con error, nunca
// cae al dueño).

import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { generarPieza } from '@/lib/ig-writer';
import { crearBorradorPublicacion } from '@/lib/ig-contenido';
import { getEstadoTab, marcarPasoTab } from '@/lib/tab-onboarding-state';
import {
  estadoContextoReels, guardarEnHistorial, leerHistorial, marcarEnviada,
  type PiezaGuardada,
} from './reels-datos';
import { componerPedido, guionATexto, type PedidoReel } from './reel-pedido';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Rol admin del workspace + ws concreto, o error honesto. */
async function ctxAdmin(): Promise<{ ok: true; ws: number } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') {
    return { ok: false, error: 'Solo el administrador del workspace puede hacer esto.' };
  }
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'Sin workspace activo. Entra al workspace de un cliente para escribir guiones.' };
  return { ok: true, ws };
}

/**
 * El onboarding de la tab se completa USÁNDOLA: la primera pieza generada marca
 * `reels_ensayo` (y antes `reels_contexto`, si el perfil ya está — el orden lo
 * exige pasoBloqueadoPor). Accesorio al resultado: si el marcado falla, la pieza
 * igual se devuelve.
 */
async function marcarOnboardingTrasGenerar(): Promise<void> {
  try {
    const [ctx, tab] = await Promise.all([estadoContextoReels(), getEstadoTab('reels')]);
    let steps = tab.steps;
    if (ctx.listo && !steps.reels_contexto?.done) {
      steps = (await marcarPasoTab('reels', 'reels_contexto')).steps;
    }
    if (steps.reels_contexto?.done && !steps.reels_ensayo?.done) {
      await marcarPasoTab('reels', 'reels_ensayo');
    }
  } catch { /* accesorio al resultado */ }
}

export type GenerarReelOut =
  | { ok: true; item: PiezaGuardada; historial: PiezaGuardada[] }
  | { ok: false; error: string };

/**
 * Genera un guion de reel desde el pedido (tema + objetivo + duración). Para
 * regenerar con feedback, `anteriorId` apunta a la pieza del historial y
 * `feedback` dice qué cambiar: la versión anterior viaja RESUMIDA dentro del
 * pedido (gancho, moraleja, CTA), no el JSON entero.
 */
export async function generarReelAction(
  input: PedidoReel & { anteriorId?: string },
): Promise<GenerarReelOut> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  const tema = (input.tema ?? '').trim();
  if (!tema) return { ok: false, error: 'Escribe el tema o la idea del reel primero.' };

  const anterior = input.anteriorId
    ? (await leerHistorial()).find((e) => e.id === input.anteriorId)?.pieza
    : undefined;

  const out = await generarPieza(ctx.ws, 'reel', componerPedido(input, anterior));
  if (!out.ok) return out;
  if (out.pieza.formato !== 'reel') {
    // No puede pasar (se pidió 'reel'), pero el narrowing lo exige y un cast
    // silencioso escondería un bug del motor.
    return { ok: false, error: 'El motor devolvió una pieza que no es un reel.' };
  }

  const item: PiezaGuardada = {
    id: crypto.randomUUID(),
    pedido: tema.slice(0, 200),
    pieza: out.pieza,
    at: new Date().toISOString(),
  };
  const historial = await guardarEnHistorial(item);
  await marcarOnboardingTrasGenerar();
  return { ok: true, item, historial };
}

export type EnviarReelOut =
  | { ok: true; borradorId: number; href: string; historial: PiezaGuardada[] }
  | { ok: false; error: string };

/**
 * Crea el borrador en contenido_posts (tipo 'reel', estado 'borrador') con la
 * caption de la pieza y el guion completo como notas de producción, y devuelve
 * a dónde seguir (/instagram: ahí se sube el video y se programa).
 *
 * Idempotente por pieza: si esta entrada del historial YA tiene borrador, se
 * devuelve el existente en vez de crear un duplicado con el doble click.
 */
export async function enviarAPublicacionAction(id: string): Promise<EnviarReelOut> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  try {
    const historial = await leerHistorial();
    const item = historial.find((e) => e.id === id);
    if (!item) return { ok: false, error: 'No encontré ese guion en el historial. Genera la pieza de nuevo.' };
    if (item.borradorId) return { ok: true, borradorId: item.borradorId, href: '/instagram', historial };

    const out = await crearBorradorPublicacion(ctx.ws, {
      tipo: 'reel',
      caption: item.pieza.caption,
      notas: guionATexto(item.pieza),
    });
    if (!out.ok) return out;
    const nuevo = await marcarEnviada(id, out.id);
    return { ok: true, borradorId: out.id, href: out.href, historial: nuevo };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}
