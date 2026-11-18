// =============================================================================
// flujo-ia-editar — EDITAR (o explicar) una automatización que ya existe, con IA (server-only)
// =============================================================================
// Pendiente O19, P0-7 (18/11/2026, docs/pendientes-verificados-17-11.md): «una acción para editar con IA una automatización
// que ya existe». Hasta acá el motor de editar vivía adentro de la ruta del chat del lienzo
// (app/api/chat-agent/secuencias/ia/route.ts) y la API de MaKo sólo tenía `editar_pasos_secuencia_mensajes`, que reescribe
// la lista por orden y rechaza todo flujo con ramas. Como pasó con crear en la décima tanda (lib/flujo-ia-crear.ts), el motor
// se mudó acá: UNA implementación, DOS puertas.
//   · La ruta (el chat del lienzo, «Discutir» y «Editar»): convierte `alFase` en el stream, guarda el chat y deja lo que
//     cambió en el BORRADOR del lienzo (la persona publica). Crea las etiquetas nuevas recién al final.
//   · La API de MaKo (`editar_armada_con_ia`, lib/api-mako/areas/chatbot.run.ts): lo corre en `preparar` y PROPONE;
//     al confirmar crea las etiquetas y PUBLICA por `publicarPasos` (que valida con `validarGrafo`).
//
// Lo que hace, en el orden de siempre (el porqué de cada paso, en la ruta y en cada módulo):
//   1. el contexto del negocio (`armarContexto`), con el CRON que ya tiene (el anuncio y la mención entran al catálogo);
//   2. las respuestas a las preguntas de MaKo (`aplicarRespuestas`);
//   3. una etapa que no existe se contesta ANTES del modelo (`etapaQueNoExiste`);
//   4. «Discutir» o una pregunta va al prompt que sólo contesta (`vaAExplicar`), nunca al de editar;
//   5. editar: el prompt de editar, y cada intento pasa por `revisarEdicion` (con el control de lo pedido, uno por turno);
//   6. si el modelo contestó en vez de cambiar, eso es lo que vuelve (`respuesta`).
// NO hace: la respuesta del CRON («¿Cambio qué la dispara?», sin modelo: la ruta), crear etiquetas, guardar el chat ni
// publicar. Nunca lanza por un fallo del modelo: vuelve `{ t: 'error' }`.
//
// ⚠️ NUNCA POR CLAUDE, NI POR NADA QUE COBRE: `generar` (lib/flujo-ia-crear.ts) es la cascada gratis de crear, con su red.
// =============================================================================

import 'server-only';
import { runWithWorkspace } from '@/lib/workspace';
import { getPromptText } from '@/lib/prompt-render';
import { EDITAR_IA_SYSTEM_TEMPLATE, userDeEditar, leyendoDe, leyendoTexto, aIA, type EventoIA, type ResultadoEdicion } from '@/lib/flujo-ia';
import type { PasoGrafo } from '@/lib/flujo-grafo';
import { armarContexto, generar } from '@/lib/flujo-ia-crear';
import { esConsulta, deIARespuesta, userDeExplicar, EXPLICAR_IA_SYSTEM_TEMPLATE } from '@/lib/flujo-ia-consulta';
import { extrasDelUser, vaAExplicar, esPreguntaDirecta, lugarInventado, type IntencionChat } from '@/lib/flujo-ia-intencion';
import { revisarEdicion, etapaQueNoExiste, textoEtapaQueNoExiste } from '@/lib/flujo-ia-revision-editar';
import { aplicarRespuestas, textosDeRespuestas } from '@/lib/flujo-ia-preguntas';
import { bloqueDeAdjuntos, type AdjuntoLeido } from '@/lib/chat-adjuntos-automatizacion';
import type { MensajeChatMako, RespuestaMako } from '@/lib/automatizacion-chat';
import { textoDeQuienContesto } from '@/lib/quien-contesto';

export type OptsEditarIA = {
  ws: number;
  /** Lo que se edita: el borrador del lienzo (la ruta) o lo publicado (la API). */
  base: PasoGrafo[];
  pedido: string;
  /** El CRON que tiene hoy, como valor de la IA (`valorIADeDisparador`), o null si no se pudo leer. */
  disparadorActual: string | null;
  respuestas?: readonly RespuestaMako[];
  historial?: readonly MensajeChatMako[];
  /** «Discutir» o «Editar» (lib/flujo-ia-intencion.ts); null = lo de antes (la API, un cliente viejo). */
  intencion?: IntencionChat | null;
  /** Lo adjuntado con el «+», ya leído a texto: va al modelo como un bloque aparte del pedido. */
  adjuntos?: readonly AdjuntoLeido[];
  /** Hasta cuándo tiene la cascada (epoch ms). */
  hastaMs: number;
  /** Las fases reales (el stream de la ruta). */
  alFase?: (e: EventoIA) => void;
};

/** `ia`: qué IA lo escribió, ya en palabras (lib/quien-contesto.ts); null si se contestó sin el modelo. */
export type ResultadoEditarIA =
  | { t: 'contesta'; respuesta: string; falta?: string; ia: string | null }
  | { t: 'error'; error: string; link?: string }
  | { t: 'edicion'; r: ResultadoEdicion; ia: string | null };

/**
 * EDITA (o explica) la automatización `base` con el pedido, en el workspace `ws`. No escribe nada: lo que cambió vuelve en
 * `{ t: 'edicion', r }` (los pasos con las etiquetas nuevas por ref, sin crear, y el CRON pedido como valor).
 */
export async function editarFlujoConIA(o: OptsEditarIA): Promise<ResultadoEditarIA> {
  // ⚠️ EL WORKSPACE ES LA PRIMERA LÍNEA (AGENTS.md): todo lo de abajo lee el del contexto (un turno del doer no tiene cookies).
  return runWithWorkspace(o.ws, async () => {
    const { ws, pedido, base, disparadorActual, hastaMs } = o;
    const respuestas = o.respuestas ?? [];
    const historial = o.historial ?? [];
    const intencion = o.intencion ?? null;
    const adjuntos = o.adjuntos ?? [];
    const send = (e: EventoIA) => o.alFase?.(e);

    // ⚠️ CON EL CRON DEL ANUNCIO GUARDADO, EL CONTEXTO LO TRAE (la revisión del Cerebro, 28/10/2026): el anuncio entra al
    // catálogo sólo si el pedido lo nombra (el techo de Groq), y «¿Qué hace esta automatización?» no lo nombra: el rótulo
    // del CRON no se encontraba y MaKo contestaba «no tiene CRON».
    const leido = await armarContexto(ws, pedido, { anuncio: /:anuncio$/.test(disparadorActual ?? ''), mencion: /:mencion$/.test(disparadorActual ?? ''), textos: textosDeRespuestas(respuestas) });
    const { perfil, voz } = leido;
    const leyendo = leyendoDe(leido.ctx, perfil);
    send({ t: 'fase', fase: 'contexto', leyendo, texto: leyendoTexto(leyendo) });
    // Lo que contestó (una condición, «Otra cosa») va al pedido; el canal, a `canalElegido`. El CRON que ya tiene decide el
    // ámbito de las condiciones y si un DM puede salir sin preguntar (`cronActual`, lib/flujo-ia.ts).
    const { ctx, pedido: pedidoEditar } = aplicarRespuestas({ ...leido.ctx, disparadorActual }, pedido, respuestas);

    // UNA ETAPA QUE NO EXISTE se dice ANTES del modelo (22/10/2026, el arnés contra producción: el modelo no devolvía nada y
    // salía «No cambió nada»). Sin inventarla ni poner otra a escondidas: el CRON no se toca (lib/flujo-ia-revision-editar.ts).
    const sinEtapa = respuestas.length === 0 ? etapaQueNoExiste(pedido, ctx) : null;
    if (sinEtapa) return { t: 'contesta', respuesta: textoEtapaQueNoExiste(sinEtapa), ia: null };
    // ⚠️ UNA PREGUNTA NO PASA POR EDITAR (15/10/2026, lib/flujo-ia-consulta.ts): «¿Qué hace esta automatización? No cambies
    // nada, sólo explícamelo.» terminaba en «Cambié 1». Va a un prompt que sólo puede devolver {"respuesta"}; con respuestas a
    // una pregunta de MaKo, es un pedido y sigue abajo. Y DESDE EL 22/10/2026 LO ELIGE LA PERSONA: «Discutir» va siempre acá,
    // «Editar» nunca; sin elegir, lo de antes. En los tres, lo último de la charla (y lo adjuntado, leído) viaja.
    const extras = [...extrasDelUser(intencion, historial), ...(adjuntos.length ? [bloqueDeAdjuntos(adjuntos)] : [])];
    if (vaAExplicar(intencion, respuestas.length > 0, esConsulta(pedido), esPreguntaDirecta(pedido))) {
      const system = await getPromptText('chatbot.explicar-ia.system', EXPLICAR_IA_SYSTEM_TEMPLATE);
      const cron = ctx.disparadores.find((x) => x.value === disparadorActual)?.label ?? null;
      const user = [userDeExplicar({ cron, flujo: JSON.stringify(aIA(base, ctx)), pregunta: pedido }), ...extras].join('\n\n');
      send({ t: 'fase', fase: 'respuesta' });
      // Y un lugar de Configuraciones que no existe es un error, como en Editar (24/10/2026, f22: `lugarInventado`).
      const traducirRespuesta = (obj: Record<string, unknown>) => {
        const x = deIARespuesta(obj);
        const falso = x.r.respuesta ? lugarInventado(x.r.respuesta) : null;
        return falso ? { ...x, errores: [...x.errores, falso] } : x;
      };
      const g = await generar({ system, user, hastaMs, traducir: traducirRespuesta, motivo: 'Contestar una pregunta sobre una automatización' });
      if ('error' in g) return { t: 'error', error: g.error, ...(g.link ? { link: g.link } : {}) };
      return { t: 'contesta', respuesta: g.r.respuesta, ...(g.r.falta ? { falta: g.r.falta } : {}), ia: textoDeQuienContesto(g.quien) };
    }

    // Sin slots: lo variable va en el `user` (un override guardado no conoce bloques nuevos).
    const system = await getPromptText('chatbot.editar-ia.system', EDITAR_IA_SYSTEM_TEMPLATE);
    const user = [userDeEditar(ctx, { perfil, voz, pedido: pedidoEditar }, base), ...extras].join('\n\n');
    // Cada intento del modelo pasa por la misma revisión (lib/flujo-ia-revision-editar.ts, la prueban sus tests con la
    // respuesta grabada): en «Editar» contestar sin cambiar es un error salvo lo que vale (`errorDeRespuestaEnEditar`); pedir
    // SUMAR y cambiar lo que había, también; y «hazlo» con lo pedido ya hecho se contesta en vez de «No cambió nada».
    // Y EL CONTROL DE LO PEDIDO (22/10/2026, Martín: «creó a la mitad las cosas que le pedí»): lo pegado entre comillas que
    // no quedó en el flujo es un error la PRIMERA vez (`control`, uno por turno) y después se dice en ROJO (`noHecho`).
    const control = { yaPidioLoQueFalta: false };
    const traducir = (obj: Record<string, unknown>): { r: ResultadoEdicion; errores: string[] } =>
      revisarEdicion({ obj, base, ctx, pedido, historial, intencion, control });

    send({ t: 'fase', fase: 'modelo' });
    const g = await generar({
      system, user, hastaMs, traducir, motivo: 'Editar una automatización con IA',
      alIntento: (n) => { if (n > 1) send({ t: 'fase', fase: 'modelo', intento: n }); },
    });
    if ('error' in g) return { t: 'error', error: g.error, ...(g.link ? { link: g.link } : {}) };
    const r = g.r;
    const ia = textoDeQuienContesto(g.quien);
    // La capa 2 de la consulta: el modelo de editar contestó en vez de cambiar (`deIAEdicion` no aplicó nada).
    if (r.respuesta) return { t: 'contesta', respuesta: r.respuesta, ...(r.falta ? { falta: r.falta } : {}), ia };
    return { t: 'edicion', r, ia };
  });
}
