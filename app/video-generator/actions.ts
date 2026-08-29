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
import { resolverAcento } from '@/lib/acento-workspace';
import { tzDeWorkspace } from '@/lib/timezone';
import {
  puestaPorId, cabidaDeGuion, soloHablado, contarPalabras, marcasDeVoseo, palabrasQueEntran,
} from '@/lib/puestas-data';
import {
  guardarEnHistorial, leerHistorial, type PlanGuardado,
} from './video-datos';
import {
  componerTema, type PedidoVideo,
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

  const guionTexto = (input.guionTexto ?? '').trim();
  if (!guionTexto) return { ok: false, error: 'Elige uno de tus guiones antes de generar.' };

  try {
    const anterior = input.anteriorId
      ? (await leerHistorial()).find((e) => e.id === input.anteriorId)?.plan
      : undefined;

    // ── Lo que el wizard dejó de preguntar, DERIVADO ──────────────────────────
    //
    // La duración sale del guion: palabras habladas ÷ densidad de la puesta. Los
    // rótulos de sección no se cuentan porque no se pronuncian — contarlos
    // inflaría el largo y haría que un guion que entra parezca que no.
    const cabida = cabidaDeGuion(puesta, soloHablado(guionTexto));

    // Y el acento sale del CLIENTE, no del anuncio. Hoy se infiere de su zona
    // horaria; cuando el onboarding de la tab lo pregunte, ese valor gana.
    const acento = resolverAcento(null, await tzDeWorkspace(ctx.ws));

    const out = await generarPlan(ctx.ws, {
      puestaId: puesta.id,
      anguloId: input.anguloId,
      acentoPrompt: acento.prompt,
      tema: componerTema({ ...input, guionTexto }, anterior),
      // El guion, PALABRA POR PALABRA. Con esto el motor lo reparte en tomas en
      // vez de pedirle al modelo que lo escriba — que es lo que venia pasando y
      // por lo que un anuncio salio con un CTA que el cliente nunca escribio.
      guionLiteral: guionTexto,
      cantidadClips: cabida.clips,
      duracionTotalSeg: cabida.segundosReales,
      feedback: input.feedback,
    });
    if (!out.ok) return out;

    const item: PlanGuardado = {
      id: crypto.randomUUID(),
      // El rótulo del historial son las primeras palabras HABLADAS: un rótulo que
      // empieza con «GANCHO» no distingue un anuncio de otro.
      pedido: soloHablado(guionTexto).slice(0, 200),
      // Con qué guion se hizo. Es lo que después contesta «¿este ya lo grabé?»
      // sin comparar textos: un id es una clave, un texto parecido es un parecido.
      guionId: input.guionId || undefined,
      plan: { ...out.plan, acentoEsVoseante: acento.id === 'ar' },
      at: new Date().toISOString(),
    };
    const historial = await guardarEnHistorial(item);
    return { ok: true, item, historial };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/**
 * Reescribe lo que dice UNA toma del plan.
 *
 * El dueño, mirando el plan ya generado: «llegado a ese punto, ya no me deja
 * editar escribiendo, debería dejarme». Y tiene razón: hasta acá el único camino
 * para cambiar una frase era pedirle a MaKo que rehiciera el plan entero —caro,
 * lento, y con el riesgo de que las otras seis tomas también cambien—. Corregir
 * una palabra tiene que costar una palabra.
 *
 * Se recalculan `palabras`, `voseo` y `deCorrido` en el server y no se confía en
 * lo que manda el cliente: son medidas, no declaraciones, y la pantalla las usa
 * para avisar que una toma no entra.
 */
export async function editarLineaPlanAction(
  planId: string,
  n: number,
  voz: string,
): Promise<{ ok: true; item: PlanGuardado } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const limpio = (voz ?? '').trim();
  if (!limpio) return { ok: false, error: 'La toma no puede quedar sin texto.' };
  if (limpio.length > 1200) return { ok: false, error: 'Eso es demasiado largo para una sola toma.' };

  const historial = await leerHistorial();
  const item = historial.find((e) => e.id === planId);
  if (!item) return { ok: false, error: 'Ese anuncio ya no está en el historial. Vuelve a generarlo.' };

  const puesta = puestaPorId(item.plan.puestaId);

  const clips = item.plan.clips.map((c) => (
    c.n !== n ? c : {
      ...c,
      voz: limpio,
      palabras: contarPalabras(limpio),
      voseo: marcasDeVoseo(limpio),
      // Editada a mano deja de ser «el cierre literal» y deja de ser «MaKo metió
      // un CTA»: las dos marcas hablan de lo que hizo MaKo, y esto lo hizo el
      // dueño. Dejarlas sería atribuirle a MaKo un texto que no escribió.
      literal: undefined,
      ctaInventado: undefined,
      original: undefined,
      tope: puesta ? palabrasQueEntran(puesta, c.segundos) : c.tope,
    }
  ));

  const actualizado: PlanGuardado = {
    ...item,
    plan: {
      ...item.plan,
      clips,
      deCorrido: clips.map((c) => c.voz).filter(Boolean).join(' '),
    },
  };

  await guardarEnHistorial(actualizado);
  return { ok: true, item: actualizado };
}
