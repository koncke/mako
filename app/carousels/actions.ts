'use server';

// =============================================================================
// Server actions de la tab Carousels (Content Machine)
// =============================================================================
// El motor es lib/ig-writer.ts (generarPieza): acá NO se reimplementa. Esta capa
// solo:
//   · guarda el rol (admin del workspace) y resuelve el ws con
//     getWorkspaceActual() — nunca ?ws=; agencia sin impersonar → ws null →
//     error honesto, jamás caer al dueño (ctxAdmin),
//   · colorea el pedido con el tipo elegido (ver GUIA_TIPO),
//   · marca el onboarding de la tab (la primera pieza generada ES el ensayo,
//     patrón landing-an: la tab se configura usándola).
//
// Hasta el 06/10/2026 había un «Enviar a publicación» (borrador en el programador
// de /instagram, vía lib/ig-contenido.ts): salió con la tab Instagram.

import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { getEstadoTab, marcarPasoTab } from '@/lib/tab-onboarding-state';
import { generarPieza, type PiezaCarrusel } from '@/lib/ig-writer';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Tipos de carrusel que ofrece la tab. ⚠️ Taxonomía de CRITERIO GENERAL, no de
 * los cursos: la metodología de carrusel es acotada y lo declara (ver
 * METODOLOGIA_CARRUSEL en lib/ig-formatos.ts). El tipo solo COLOREA el pedido
 * que se le pasa al writer — no cambia el contrato de la pieza ni el saneo.
 */
export type TipoCarrusel = 'educativo' | 'storytelling' | 'venta';

const GUIA_TIPO: Record<TipoCarrusel, string> = {
  educativo:
    'Tipo de carrusel: EDUCATIVO — enseña UNA sola cosa concreta; la portada abre la curiosidad sin revelar la respuesta, que se entrega recién en las últimas slides.',
  storytelling:
    'Tipo de carrusel: STORYTELLING — una historia escena a escena con un personaje consistente (rasgos o accesorios que lo mantienen identificable slide a slide), el formato que sí enseñan los cursos.',
  venta:
    'Tipo de carrusel: VENTA — problema visible en la portada, desarrollo que agita y una solución ligada a la oferta real del negocio; el CTA con palabra clave va en la última slide.',
};

/**
 * Contexto de una acción de la tab: rol admin del workspace + ws concreto. La
 * agencia SIN impersonar tiene ws null y acá se corta con error en vez de caer al
 * dueño.
 */
async function ctxAdmin(): Promise<{ ok: true; ws: number } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') {
    return { ok: false, error: 'Solo el administrador del workspace puede hacer esto.' };
  }
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'Sin workspace activo. Entra al workspace de un cliente para escribir carruseles.' };
  return { ok: true, ws };
}

/**
 * Genera un carrusel con el motor compartido. Además cierra el onboarding de la
 * tab en best-effort: la primera pieza generada vale como ensayo, y el contexto
 * (que no pide nada nuevo: muestra lo que la app ya sabe) cae con ella. Un fallo
 * al marcar pasos NUNCA rompe la generación.
 */
export async function generarCarruselAction(
  pedido: string,
  tipo: TipoCarrusel,
): Promise<{ ok: true; pieza: PiezaCarrusel } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  const guia = GUIA_TIPO[tipo] ?? GUIA_TIPO.educativo;
  const r = await generarPieza(ctx.ws, 'carrusel', `${guia}\n\nPEDIDO:\n${(pedido ?? '').trim()}`);
  if (!r.ok) return r;
  if (r.pieza.formato !== 'carrusel') {
    // No debería pasar (generarPieza sanea por formato), pero el tipo lo exige
    // y un error honesto es mejor que un cast.
    return { ok: false, error: 'La pieza no vino con formato de carrusel. Intenta de nuevo.' };
  }
  try {
    const tab = await getEstadoTab('carousels');
    if (!tab.steps.carousels_contexto?.done) await marcarPasoTab('carousels', 'carousels_contexto');
    if (!tab.steps.carousels_ensayo?.done) await marcarPasoTab('carousels', 'carousels_ensayo');
  } catch { /* el estado del onboarding nunca frena una pieza ya generada */ }
  return { ok: true, pieza: r.pieza };
}

/**
 * Marca un paso del onboarding de la tab (los del wizard).
 */
export async function marcarPasoCarouselsAction(
  paso: 'carousels_contexto' | 'carousels_ensayo',
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  try {
    const tab = await getEstadoTab('carousels');
    if (!tab.steps[paso]?.done) await marcarPasoTab('carousels', paso);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}
