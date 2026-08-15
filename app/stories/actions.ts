'use server';

// =============================================================================
// Server actions de la tab Stories
// =============================================================================
// Reglas de la casa que gobiernan este archivo:
//   · El workspace se resuelve SIEMPRE con getWorkspaceActual() (nunca ?ws=).
//     Agencia sin impersonar → ws null → se corta con error (fail-closed,
//     patrón wsEstricto — nunca se cae al dueño).
//   · Generar y guardar exigen rol admin del workspace.
//   · El motor es lib/ig-writer.ts (generarPieza) y el puente a contenido_posts
//     es lib/ig-contenido.ts (crearBorradorPublicacion). Acá no se reimplementa
//     nada de eso: se compone el pedido, se valida en determinista lo que el
//     prompt promete, y se RE-sanea lo que vuelve del navegador.

import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { generarPieza, type PiezaStory } from '@/lib/ig-writer';
import { crearBorradorPublicacion } from '@/lib/ig-contenido';
import { getEstadoTab, marcarPasoTab } from '@/lib/tab-onboarding-state';
import { OBJETIVO_EN_PEDIDO, empujaADm, type ObjetivoStories } from './objetivos';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Contexto de una acción de admin: rol admin del workspace + ws concreto.
 * La agencia SIN impersonar tiene ws null: se corta con error en vez de caer al
 * dueño (mismo ctxAdmin que app/instagram/actions.ts).
 */
async function ctxAdmin(): Promise<{ ok: true; ws: number } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') {
    return { ok: false, error: 'Solo el administrador del workspace puede hacer esto.' };
  }
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'Sin workspace activo. Entra al workspace de un cliente para usar Stories.' };
  return { ok: true, ws };
}

// ── Generar ───────────────────────────────────────────────────────────────────

export type GenerarSecuenciaOut = { ok: true; pieza: PiezaStory } | { ok: false; error: string };

/**
 * Genera la secuencia del día (frames numerados con qué mostrar, texto en
 * pantalla e indicación de producción) para el objetivo elegido.
 *
 * También cierra el onboarding de la tab: la primera secuencia generada ES el
 * ensayo (mismo criterio que el paso `analizar` del Landing Analyst), y una
 * pieza generada implica que el contexto del negocio ya se usó. Best-effort: si
 * el estado no se puede marcar, la pieza igual se devuelve.
 */
export async function generarSecuenciaAction(objetivo: ObjetivoStories, pedido: string): Promise<GenerarSecuenciaOut> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  // Guard en POSITIVO: solo los tres objetivos del catálogo.
  const objetivoTxt = OBJETIVO_EN_PEDIDO[objetivo];
  if (!objetivoTxt) return { ok: false, error: 'Objetivo desconocido. Elige conexión, venta o interacción.' };
  const texto = str(pedido);
  if (!texto) return { ok: false, error: 'Escribe la idea del día (el tema, la situación o lo que quieras contar).' };

  const pedidoCompuesto = `Objetivo del día de stories: ${objetivoTxt}\n\nIdea / pedido: ${texto}`;
  const r = await generarPieza(ctx.ws, 'story', pedidoCompuesto);
  if (!r.ok) return r;
  if (r.pieza.formato !== 'story') return { ok: false, error: 'El motor devolvió un formato que no es una secuencia de stories.' };

  // Las dos capas: el prompt pide el empuje a DM y ACÁ se verifica en
  // determinista. Si el objetivo lo exige y la pieza vino sin CTA ni palabra
  // clave, se rechaza con el motivo — rechazar deja la deuda del reintento,
  // nunca un frame de cierre inventado por un fallback.
  if (empujaADm(objetivo) && !r.pieza.cta && !r.pieza.palabraClave) {
    return {
      ok: false,
      error: 'La secuencia vino sin el cierre que empuja al DM (ni CTA ni palabra clave), que el objetivo elegido exige. Genera de nuevo.',
    };
  }

  try {
    const tab = await getEstadoTab('stories');
    if (!tab.steps.stories_contexto?.done) await marcarPasoTab('stories', 'stories_contexto');
    if (!tab.steps.stories_ensayo?.done) await marcarPasoTab('stories', 'stories_ensayo');
  } catch { /* el onboarding no frena la pieza */ }

  return { ok: true, pieza: r.pieza };
}

// ── Onboarding ────────────────────────────────────────────────────────────────

/**
 * El ÚNICO paso que se marca a mano desde el wizard: `stories_contexto` (el
 * usuario vio qué sabe MaKo del negocio y siguió). `conectar` se deriva del
 * estado vivo de la tab Instagram (esta tab nunca lo marca) y `stories_ensayo`
 * lo cierra la primera secuencia generada.
 */
export async function marcarContextoStoriesAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  try {
    await marcarPasoTab('stories', 'stories_contexto');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

// ── Enviar a publicación ──────────────────────────────────────────────────────

export type EnvioSecuenciaOut =
  | { ok: true; creados: number; total: number; href: string; aviso: string | null }
  | { ok: false; error: string };

/**
 * Crea un borrador en contenido_posts (tipo 'story', estado 'borrador') POR CADA
 * frame de la secuencia: cada story se publica como una pieza de media propia, y
 * la media se sube y se programa en /instagram. El guion del frame viaja en las
 * notas de producción (crearBorradorPublicacion las anexa a la caption con su
 * rótulo visible).
 *
 * Lo que llega del navegador se RE-sanea acá: strings coaccionadas, frames
 * vacíos afuera, tope duro de 50 — nunca se confía en el shape del cliente.
 */
export async function enviarSecuenciaAction(pieza: PiezaStory): Promise<EnvioSecuenciaOut> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const idea = str((pieza as { idea?: unknown })?.idea);
  const rawFrames = Array.isArray((pieza as { frames?: unknown })?.frames) ? (pieza as { frames: unknown[] }).frames : [];
  const frames = rawFrames
    .map((f) => {
      const o = (f && typeof f === 'object' ? f : {}) as Record<string, unknown>;
      return { tipo: str(o.tipo) || 'selfie', texto: str(o.texto), indicacion: str(o.indicacion), interactivoManual: o.interactivoManual === true };
    })
    .filter((f) => f.texto || f.indicacion)
    .slice(0, 50);
  if (!frames.length) return { ok: false, error: 'La secuencia no tiene frames que enviar.' };
  const cta = str((pieza as { cta?: unknown })?.cta) || null;
  const palabraClave = str((pieza as { palabraClave?: unknown })?.palabraClave) || null;

  // Secuencial a propósito (no Promise.all): el orden de creación es el orden
  // del día, y si algo falla se sabe exactamente cuántos entraron.
  let creados = 0;
  let primerError: string | null = null;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const ultimo = i === frames.length - 1;
    const notas = [
      `Secuencia «${idea || 'sin título'}» — frame ${i + 1} de ${frames.length} · formato: ${f.tipo}`,
      f.indicacion ? `Producción: ${f.indicacion}` : '',
      f.interactivoManual
        ? 'Elemento interactivo (encuesta/pregunta/slider): se agrega A MANO en la app de Instagram después de publicar — la API de Meta no publica stickers.'
        : '',
      ultimo && (cta || palabraClave)
        ? `Cierre del día: ${[cta, palabraClave ? `palabra clave ${palabraClave}` : ''].filter(Boolean).join(' · ')}`
        : '',
    ].filter(Boolean).join('\n');

    const r = await crearBorradorPublicacion(ctx.ws, { tipo: 'story', caption: f.texto, notas });
    if (r.ok) creados++;
    else if (!primerError) primerError = r.error;
  }

  if (!creados) return { ok: false, error: primerError ?? 'No se pudo crear ningún borrador.' };
  return {
    ok: true,
    creados,
    total: frames.length,
    href: '/instagram',
    aviso: creados < frames.length
      ? `Se crearon ${creados} de ${frames.length} borradores. ${primerError ?? ''}`.trim()
      : null,
  };
}
