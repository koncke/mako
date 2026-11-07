'use server';

// =============================================================================
// Server actions de la tab Stories
// =============================================================================
// Reglas de la casa que gobiernan este archivo:
//   · El workspace se resuelve SIEMPRE con getWorkspaceActual() (nunca ?ws=).
//     Agencia sin impersonar → ws null → se corta con error (fail-closed,
//     patrón wsEstricto — nunca se cae al dueño).
//   · Generar y guardar exigen rol admin del workspace.
//   · El motor es lib/ig-writer.ts (generarPieza). Acá no se reimplementa: se
//     compone el pedido y se valida en determinista lo que el prompt promete.
//   · Toda secuencia que sale BIEN se guarda (lib/ig-historial.ts, app_settings por
//     workspace, tope 10): desde el 6/11/2026 el historial sobrevive a recargar. Se
//     guarda ACÁ y no en el motor porque es la pantalla la que sabe con qué OBJETIVO se
//     pidió, y ese rótulo es la mitad de lo que se lee en la lista. Guardar nunca frena
//     la pieza: si la escritura falla, la secuencia se devuelve igual.
//   · Hasta el 06/10/2026 había un «Enviar a publicación» (un borrador por frame
//     en el programador de /instagram, vía lib/ig-contenido.ts): salió con la tab
//     Instagram (decisión de Martín).

import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { generarPieza, type PiezaStory } from '@/lib/ig-writer';
import { getHistorialIg, guardarEnHistorialIg, type ItemHistorialIg } from '@/lib/ig-historial';
import { getEstadoTab, marcarPasoTab } from '@/lib/tab-onboarding-state';
import { OBJETIVOS_STORIES, OBJETIVO_EN_PEDIDO, empujaADm, type ObjetivoStories } from './objetivos';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Contexto de una acción de admin: rol admin del workspace + ws concreto.
 * La agencia SIN impersonar tiene ws null: se corta con error en vez de caer al
 * dueño.
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

  // El historial: lo que se guarda es la pieza + el RÓTULO del objetivo ya resuelto (ver
  // lib/ig-historial.ts). Best-effort: la secuencia se devuelve aunque no se haya podido
  // guardar — lo que la persona pidió es la pieza. Sin workspace no se llega hasta acá
  // (ctxAdmin corta antes), así que el `wsObligatorio` de la escritura no cae al dueño.
  try {
    await guardarEnHistorialIg('story', r.pieza, OBJETIVOS_STORIES.find((o) => o.value === objetivo)?.label ?? '');
  } catch { /* guardar el historial no frena la pieza */ }

  try {
    const tab = await getEstadoTab('stories');
    if (!tab.steps.stories_contexto?.done) await marcarPasoTab('stories', 'stories_contexto');
    if (!tab.steps.stories_ensayo?.done) await marcarPasoTab('stories', 'stories_ensayo');
  } catch { /* el onboarding no frena la pieza */ }

  return { ok: true, pieza: r.pieza };
}

// ── Historial ─────────────────────────────────────────────────────────────────

/**
 * Las secuencias ya escritas de ESTE workspace, de la más nueva a la más vieja (tope 10).
 *
 * Lo lee la page del teléfono para sembrar la pantalla, así que una lectura caída devuelve
 * una lista vacía y no una pantalla de error: lo que se pierde es el historial, no la
 * posibilidad de escribir hoy. Mismo guard que generar (admin del workspace): el historial
 * es material de marketing del negocio.
 */
export async function historialStoriesAction(): Promise<ItemHistorialIg[]> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return [];
  try { return await getHistorialIg('story'); } catch { return []; }
}

// ── Onboarding ────────────────────────────────────────────────────────────────

/**
 * El ÚNICO paso que se marca a mano desde el wizard: `stories_contexto` (el
 * usuario vio qué sabe MaKo del negocio y siguió). `stories_ensayo` lo cierra la
 * primera secuencia generada.
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
