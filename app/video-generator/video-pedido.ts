// =============================================================================
// video-pedido — catálogos del pedido y el plan como texto (módulo PURO)
// =============================================================================
// SIN 'server-only' a propósito: lo importan la UI (los Select, «Copiar el
// guion») y las server actions. Solo tipos y funciones puras — el tipo del plan
// entra con `import type`, que se borra en compilación y no arrastra el
// server-only de lib/video-planner.ts al bundle del cliente.
//
// El catálogo de puestas viene de lib/puestas-data.ts, que ya es data pura y se
// puede importar de los dos lados. Acá van solo las opciones que son del PEDIDO
// (cuánto dura, cuántos clips) y no de la puesta.

import type { PlanVideo } from '@/lib/video-planner';
import type { Escena } from '@/lib/escenas-core';
import { CATALOGO_PUESTAS, puestaPorId, puestasOfrecidas, type Puesta } from '@/lib/puestas-data';
import { promptDeClip } from '@/lib/prompts-video';

export { CATALOGO_PUESTAS, puestaPorId, puestasOfrecidas };

// ⚠️ ACÁ VIVÍAN `DURACIONES_VIDEO`, `ACENTOS`, `acentoPrompt`, `acentoEsVoseante`,
// `segundosDe`, `clipsParaDuracion` y `duracionReal`. Se borraron el 28/08/2026 y
// conviene saber por qué antes de reescribirlas.
//
// Eran el andamiaje de dos pasos del wizard que el dueño sacó: «¿cuánto tiene que
// durar?» y «¿con qué acento habla?». Los dos preguntaban algo que el sistema ya
// sabe — la duración sale del largo del guion, y el acento es del cliente, no del
// anuncio.
//
// Lo que las reemplaza:
//   · la duración → `cabidaDeGuion()` en lib/puestas-data.ts, que invierte la
//     aritmética (palabras ÷ densidad en vez de segundos × densidad) y además
//     avisa cuando el guion NO entra, que antes se recortaba en silencio.
//   · el acento   → `resolverAcento()` en lib/acento-workspace.ts, por workspace.
//
// Y no eran código muerto cualquiera: **las sostenían sus propios tests**. Siete
// funciones que nadie llamaba, con cobertura verde encima. Un test sobre código
// que no corre no mide nada y hace parecer cubierto lo que ya no existe.
export type { Puesta };

// ⚠️ ACÁ VIVÍAN `DURACIONES_VIDEO`, `ACENTOS`, `acentoPrompt`, `acentoEsVoseante`,
// `segundosDe`, `clipsParaDuracion` y `duracionReal`. Se borraron el 28/08/2026 y
// conviene saber por qué antes de reescribirlas.
//
// Eran el andamiaje de dos pasos del wizard que el dueño sacó: «¿cuánto tiene que
// durar?» y «¿con qué acento habla?». Los dos preguntaban algo que el sistema ya
// sabe — la duración sale del largo del guion, y el acento es del cliente y no
// del anuncio.
//
// Lo que las reemplaza:
//   · la duración → `cabidaDeGuion()` en lib/puestas-data.ts, que invierte la
//     aritmética (palabras ÷ densidad, en vez de segundos × densidad) y además
//     AVISA cuando el guion no entra, que antes se recortaba en silencio.
//   · el acento   → `resolverAcento()` en lib/acento-workspace.ts, por workspace.
//
// Y no era código muerto cualquiera: **lo sostenían sus propios tests**. Siete
// funciones que no llamaba nadie, con cobertura verde encima. Un test sobre
// código que no corre no mide nada, y hace parecer cubierto lo que ya no existe.

/** Lo que la pantalla le pide al server para armar un anuncio. */
export type PedidoVideo = {
  /** `false` = el guion va tal cual. La decisión es del dueño: es su texto. */
  adaptarVoz?: boolean;
  puestaId: string;
  anguloId?: string;
  /**
   * El guion de MaKo que se va a grabar.
   *
   * Reemplaza a los tres campos que había antes —`tema`, `duracion`, `acento`—
   * porque los tres eran preguntas que el sistema ya sabía contestar: el tema lo
   * escribió MaKo en Ads Writer, la duración sale del largo del guion, y el
   * acento es del cliente y no del anuncio.
   */
  guionId: string;
  /** El texto completo CON sus rótulos: el modelo los usa para saber qué es qué. */
  guionTexto: string;
  /** Feedback sobre el plan anterior (regenerar). */
  feedback?: string;
};

/**


/**
 * Compone el texto del pedido que consume generarPlan(). Los topes por campo
 * existen porque el motor corta el tema en 4.000 caracteres: mejor recortar acá
 * cada parte que perder el final del feedback sin aviso.
 */
export function componerTema(input: PedidoVideo, anterior?: PlanVideo): string {
  // El guion viaja ENTERO, con sus rótulos de sección (GANCHO, HISTORIA, CTA…):
  // el modelo los usa para saber qué parte abre y qué parte cierra, y esa
  // estructura es justamente lo que MaKo ya decidió en Ads Writer. Lo que se hace
  // acá NO es pedirle que invente un guion: es pedirle que reparta ESTE en tomas.
  const partes = [`GUION A GRABAR — respeta su contenido, su orden y su cierre:
${input.guionTexto.trim().slice(0, 4000)}`];
  const feedback = input.feedback?.trim();
  if (anterior && feedback) {
    partes.push([
      'YA HAY UN PLAN ANTERIOR DE ESTE ANUNCIO:',
      `- Título: «${anterior.titulo}»`,
      `- Ritmo: ${anterior.ritmo}`,
      `- De corrido: ${anterior.deCorrido.slice(0, 600)}`,
    ].join('\n'));
  }
  return partes.join('\n\n');
}

/**
 * El guion, y nada más que el guion. Es lo que copia el CLIENTE.
 *
 * Sin prompts, sin indicaciones de cámara, sin acción: eso es cómo MaKo fabrica
 * el video, del mismo orden que la query SQL detrás de una tabla. El cliente
 * compró que le hagan el anuncio, no instrucciones para pegar en otra
 * herramienta. Los asteriscos del énfasis se van también — en pantalla se pintan
 * en negrita, y en un texto copiado son ruido.
 */
export function guionATexto(plan: PlanVideo): string {
  const lineas = [plan.titulo, ''];
  plan.clips.forEach((c) => {
    lineas.push(`${c.segundos}s · ${c.voz.replace(/\*\*/g, '')}`);
  });
  return lineas.join('\n').trim();
}

// ── El plan como texto plano ─────────────────────────────────────────────────
// Para PRODUCIR: un bloque por clip, con el prompt. NO se le muestra al cliente
// (para eso está `guionATexto`) — es el molde de los cuatro anuncios que se
// hicieron a mano y lo consume la producción, que hoy todavía es manual.

/** En qué escenario se filma esta toma. Vacío si todavía no se generaron. */
function escenaDe(escenas: Escena[], n: number): string {
  const e = escenas.find((x) => n >= x.desde && n <= x.hasta);
  return e ? `Escenario ${e.n} (${e.lugar})` : '';
}

export function planATexto(plan: PlanVideo, nombrePuesta: string, escenas: Escena[] = []): string {
  const lineas: string[] = [
    `GUION · ${plan.titulo}`,
    '',
    `Puesta en escena: ${nombrePuesta}`,
    `${plan.clips.length} clips · ${plan.duracionTotalSeg} s`,
    `Ritmo: ${plan.ritmo}  (H = habla en cámara · O = voz en off)`,
    '',
    'La identidad sale SIEMPRE de la misma foto real. No describas la cara.',
    '',
  ];

  // Las imágenes van PRIMERO porque el proceso va primero por ahí: se fija el
  // escenario y recién después se anima. Un texto que empieza por los clips
  // describe el paso dos como si fuera el uno.
  if (escenas.length > 0) {
    lineas.push('ESCENARIOS — se generan ANTES de animar');
    escenas.forEach((e) => {
      const tomas = e.desde === e.hasta ? `toma ${e.desde}` : `tomas ${e.desde}-${e.hasta}`;
      lineas.push('', `ESCENARIO ${e.n} · ${tomas} · ${e.lugar}`, e.prompt);
    });
    lineas.push('');
  }

  plan.clips.forEach((c) => {
    lineas.push(
      '---',
      `CLIP ${c.n} · ${c.habla ? 'habla' : 'voz en off'} · ${c.segundos} s`,
      '',
      c.habla ? `Dice: ${c.voz}` : `Voz en off: ${c.voz}`,
      `Qué se ve: ${c.queSeVe}`,
      `Cámara: ${c.camara}`,
      escenaDe(escenas, c.n),
      '',
      'PROMPT:',
      // El MISMO que se le manda a Flow. Resolverlo aparte acá haría que la
      // pantalla mostrara un prompt y el modelo recibiera otro — y el día que un
      // clip salga raro, el texto que se mira para entender por qué sería el
      // equivocado.
      promptDeClip(plan.puestaId, c),
      '',
    );
  });

  lineas.push('---', 'DE CORRIDO', '', plan.deCorrido);

  return lineas.filter((l, i, arr) => l !== '' || arr[i - 1] !== '').join('\n').trim();
}
