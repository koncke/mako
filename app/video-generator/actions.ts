'use server';

// =============================================================================
// /video-generator — server actions: planificar el anuncio
// =============================================================================
// El motor es lib/video-planner.ts (generarPlan): acá solo viven el guard, el
// historial y el saneo del pedido. El guard de rol usa el patrón ctxAdmin de
// app/reels/actions.ts — la agencia sin impersonar corta con error, nunca cae
// al workspace del dueño.

import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { generarPlan, reescribirToma } from '@/lib/video-planner';
import { resolverAcento } from '@/lib/acento-workspace';
import { getVozCliente, type VozCliente } from './voz-cliente';
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
  // `clipsMinimos`: el piso de tomas cuando no es el del formato. Lo usa el
  // «Avatar de IA» del Video Editor (app/video-editor/avatar/actions.ts).
  input: PedidoVideo & { anteriorId?: string; clipsMinimos?: number },
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
    const piso = input.clipsMinimos != null
      ? { ...puesta, clips: [Math.max(1, Math.round(input.clipsMinimos)), puesta.clips[1]] as [number, number] }
      : puesta;
    const cabida = cabidaDeGuion(piso, soloHablado(guionTexto));

    // Y el acento sale del CLIENTE, no del anuncio. Hoy se infiere de su zona
    // horaria; cuando el onboarding de la tab lo pregunte, ese valor gana.
    // ⚠️ EL DECLARADO GANA, y hasta hoy este llamador pasaba `null` fijo: el
    // parámetro existía desde que se escribió el módulo y no lo usaba nadie, así
    // que el acento de TODOS los clientes salía de adivinar su zona horaria.
    const voz = await getVozCliente().catch((): VozCliente => ({ acento: '', muletillas: [], muestras: [] }));
    const acento = resolverAcento(voz.acento, await tzDeWorkspace(ctx.ws), voz.muletillas, voz.acentoOrigen);

    const out = await generarPlan(ctx.ws, {
      puestaId: puesta.id,
      anguloId: input.anguloId,
      acentoPrompt: acento.prompt,
      tema: componerTema({ ...input, guionTexto }, anterior),
      // El guion, PALABRA POR PALABRA. Con esto el motor lo reparte en tomas en
      // vez de pedirle al modelo que lo escriba — que es lo que venia pasando y
      // por lo que un anuncio salio con un CTA que el cliente nunca escribio.
      guionLiteral: guionTexto,
      adaptarVoz: input.adaptarVoz,
      cantidadClips: cabida.clips,
      clipsMinimos: input.clipsMinimos,
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

/**
 * Le pide a MaKo que cambie UNA toma, con una instrucción del dueño.
 *
 * Reemplaza al «¿le cambiamos algo?» que rehacía el plan ENTERO. El dueño:
 * «mejor que se pueda editar escribiendo, o sí darle instrucciones, pero por
 * bloques, no todo el guion».
 *
 * Y no es solo comodidad: rehacer el plan entero por una frase que no cierra
 * cambiaba también las seis tomas que sí estaban bien. El costo de arreglar algo
 * tiene que ser proporcional a lo que está mal.
 *
 * ⚠️ La instrucción la escribe el USUARIO, así que viaja envuelta en
 * `contenidoNoConfiable`. Y el guion también — ninguno de los dos manda sobre las
 * reglas, que van en el system.
 */
export async function reescribirTomaAction(
  planId: string,
  n: number,
  instruccion: string,
): Promise<{ ok: true; item: PlanGuardado } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const pedido = (instruccion ?? '').trim().slice(0, 600);
  if (!pedido) return { ok: false, error: 'Escribe qué le cambio a esta toma.' };

  const historial = await leerHistorial();
  const item = historial.find((e) => e.id === planId);
  if (!item) return { ok: false, error: 'Ese anuncio ya no está en el historial. Vuelve a generarlo.' };

  const clip = item.plan.clips.find((c) => c.n === n);
  if (!clip) return { ok: false, error: 'Esa toma no existe en el plan.' };

  const puesta = puestaPorId(item.plan.puestaId);
  const tope = puesta ? palabrasQueEntran(puesta, clip.segundos) : (clip.tope ?? 25);

  try {
    const nueva = await reescribirToma({
      // El anuncio ENTERO como contexto: una toma sin las de al lado se reescribe
      // repitiendo lo que ya se dijo o adelantando lo que viene.
      anuncio: item.plan.clips.map((c) => `${c.n === n ? '>>> ' : '    '}${c.n}. ${c.voz}`).join('\n'),
      actual: clip.voz,
      instruccion: pedido,
      tope,
      acentoEsVoseante: !!item.plan.acentoEsVoseante,
    });
    if (!nueva) return { ok: false, error: 'MaKo no pudo reescribir esa toma. Intenta de nuevo o corrígela a mano.' };

    return await editarLineaPlanAction(planId, n, nueva);
  } catch (e) {
    return { ok: false, error: `No se pudo reescribir: ${msg(e)}` };
  }
}
