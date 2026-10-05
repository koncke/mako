// =============================================================================
// replay-ficha — lo que la ficha del lead DICE cuando no hay grabación
// =============================================================================
// El reproductor es lo único que el replay propio compra sobre Clarity: que la
// grabación se vea ACÁ. Pero el estado normal de esta tarjeta, durante semanas,
// va a ser el VACÍO — y «sin grabación» a secas acusa a cualquiera.
//
// ⚠️ UN LEAD SIN GRABACIÓN PUEDE SER SEIS COSAS DISTINTAS, y se leen igual:
//
//   1. el lead no trae `visitor_id`: no hay con qué cruzar y no va a haberlo;
//   2. no se pudo LEER el índice (la migración 0191 todavía no está aplicada, o
//      la consulta falló): no saber no es saber que no hay;
//   3. el workspace lo tiene APAGADO (`landing.replay`, apagado por default);
//   4. el código pegado en la página es ANTERIOR al grabador, así que esa visita
//      nunca grabó nada;
//   5. la grabación EXISTIÓ y la purga ya la borró por retención;
//   6. de verdad no hay: no volvió a entrar, o su visita no pasó el piso.
//
// Tres de las seis se arreglan, y en lugares distintos. Las otras tres no se
// arreglan y hay que decirlo, porque mandar a alguien a repegar un código que ya
// está al día es el candado sin llave que AGENTS.md prohíbe.
//
// ⚠️ SIN `server-only`, a propósito y por la misma razón que `replay-contrato.ts`:
// lo que se puede equivocar es la DECISIÓN de qué frase sale, y eso tiene que
// poder probarse sin base de datos. Las consultas viven en `lib/replay-leer.ts`.
// =============================================================================

import { REPLAY_PISO_SEGUNDOS, REPLAY_TOPE_SEGUNDOS, grabacionVencio, type ReplayCorte } from './replay-contrato';

/**
 * La versión del snippet que estrena el GRABADOR.
 *
 * 21 es la versión que estrena el loader del grabador: leído del árbol a las 09:31
 * del 05/10/2026, `SNIPPET_VERSION` (lib/landing-token.ts) vale 21 y su snippet ya
 * baja `/replay/<v>/r.js`. El número se escribe acá como LITERAL y no se deriva de
 * `SNIPPET_VERSION`: eso sube con cualquier mejora del pixel, y la pregunta de esta
 * pantalla es otra —«¿la versión que tiene puesta ESTE negocio incluye el
 * grabador?»—, que se contesta con un número que no se mueve más.
 *
 * (Y tampoco se podría derivar: `landing-token` es del server y esto lo importan dos
 * componentes de cliente.)
 *
 * ⚠️ Y SE PREGUNTA POR LA VERSIÓN QUE TRAJO LA VISITA DE ESTE LEAD, no por el
 * setting del workspace. `landing.snippet_version` lo escribe el ÚLTIMO evento que
 * llega, venga de la página que venga: con dos landings en versiones distintas el
 * veredicto es verdad para una y mentira para la otra. Es la misma trampa que ya
 * costó el botón «Probar» bloqueado para los cuatro clientes (AGENTS.md: «Un
 * bloqueo derivado de una versión GLOBAL bloquea a todos»), y acá la unidad que
 * gana algo es el lead: su `sv` sale de sus propias visitas.
 */
export const REPLAY_DESDE_SNIPPET = 21;

/** Por qué esta ficha no tiene ninguna grabación para mostrar. */
export type ReplayVacio =
  | 'sin_visitor'
  | 'no_se_pudo_leer'
  | 'apagado'
  | 'pixel_viejo'
  | 'vencida'
  | 'sin_grabacion';

/** Lo que hace falta para decidir. Lo junta `replayDeLead` (lib/replay-leer.ts). */
export type SenalesDelVacio = {
  /** El `visitor_id` del lead. null = entró a mano o por formulario de Meta. */
  visitorId: string | null;
  /** false = alguna de las dos lecturas (el índice o el apagador) FALLÓ. */
  leyoTodo: boolean;
  /** ¿Hay al menos una sesión en el índice? */
  hayGrabaciones: boolean;
  /** El apagador del workspace (`landing.replay`). */
  activo: boolean;
  /** La versión de snippet con la que midió ESTE lead. null = no se sabe. */
  snippetDelLead: number | null;
  /** Lo último que este visitante hizo en la página. null = no se sabe. */
  ultimaActividadISO: string | null;
  ahoraISO: string;
  /** La retención configurada del workspace, en días. */
  retencionDias: number;
};

/**
 * `null` = hay grabaciones y se muestran. Cualquier otra cosa = por qué no hay.
 *
 * ⚠️ EL ORDEN NO ES ESTÉTICO: es el orden en que las causas se TAPAN entre sí.
 *
 *   · Una grabación que existe gana sobre todo lo demás, incluido el apagador: si
 *     el negocio apagó la grabación ayer, lo que ya se grabó sigue estando y
 *     esconderlo sería tirar un dato por una configuración de hoy.
 *   · «Este lead no trae identificador» va antes que «no pude leer»: es un hecho
 *     que no depende de ninguna consulta —el lead entró a mano o por un formulario
 *     de Meta— y no cambia si la lectura se arregla. Decir «no pude leer» ahí manda
 *     a reintentar algo que va a contestar lo mismo siempre.
 *   · «No pude leer» va antes que cualquier afirmación de ausencia. Es la regla de
 *     la casa: no poder leer un dato no es un valor del dato.
 *   · El apagador va antes que el pixel: con el interruptor en false, repegar el
 *     código no cambia NADA, así que mandar a repegarlo es trabajo inútil.
 *   · La retención va después del pixel: si la página nunca tuvo el grabador, no
 *     hubo nada que vencer — decir «ya la borramos» inventaría una grabación.
 */
export function motivoDelVacio(s: SenalesDelVacio): ReplayVacio | null {
  if (s.hayGrabaciones) return null;
  if (!s.visitorId) return 'sin_visitor';
  if (!s.leyoTodo) return 'no_se_pudo_leer';
  if (!s.activo) return 'apagado';
  // `null` es «no se sabe» y NO acusa: un lead que entró por un formulario de Meta
  // no tiene visitas con `sv`, y ahí el código de la página no es el problema.
  if (s.snippetDelLead != null && s.snippetDelLead < REPLAY_DESDE_SNIPPET) return 'pixel_viejo';
  // `tieneLead: true` por construcción —esto se dibuja en la ficha de un lead—, así
  // que la retención que aplica es la larga. Se reusa la decisión del contrato en vez
  // de restar fechas acá: con dos cuentas, la purga y esta pantalla se separan.
  if (s.ultimaActividadISO && grabacionVencio(s.ultimaActividadISO, s.ahoraISO, true, s.retencionDias)) return 'vencida';
  return 'sin_grabacion';
}

export type TextoVacio = {
  /** UNA frase. Es un estado vacío: el techo lo fija AGENTS.md. */
  que: string;
  /** Dónde se arregla, si se arregla. null = no hay nada que apretar. */
  donde: { texto: string; href: string } | null;
};

/**
 * La frase de cada caso, y el link SÓLO donde hay algo que hacer.
 *
 * ⚠️ `apagado` NO LLEVA LINK, y no es un olvido: el interruptor `landing.replay`
 * todavía no tiene pantalla —se prende con `setSetting`—, así que un botón acá
 * llevaría a una pantalla donde no está. «Si no sabés DÓNDE está algo, el mensaje
 * dice qué pasó y se calla» (AGENTS.md). El día que exista la pantalla, el link va
 * acá y en ningún otro lado.
 *
 * ⚠️ Y `vencida` NO AFIRMA QUE HUBO UNA. Cuando la purga borra, borra también la
 * fila del índice: desde esta pantalla no hay forma de distinguir «existió y se
 * venció» de «nunca hubo». La frase dice la condición —su visita es más vieja que
 * lo que guardamos— y no el hecho.
 */
export function textoDelVacio(motivo: ReplayVacio, retencionDias: number): TextoVacio {
  const dias = Math.max(1, Math.trunc(retencionDias));
  switch (motivo) {
    case 'sin_visitor':
      return { que: 'Este lead no trae identificador: no hay con qué cruzar una grabación.', donde: null };
    case 'no_se_pudo_leer':
      return { que: 'No pude leer sus grabaciones. No significa que no haya.', donde: null };
    case 'apagado':
      return { que: 'La grabación de sesión está apagada en este negocio.', donde: null };
    case 'pixel_viejo':
      return {
        que: 'El código de tu página es anterior a la grabación, así que esa visita no se grabó.',
        donde: { texto: 'Actualizar el código', href: '/integraciones?abrir=landing' },
      };
    case 'vencida':
      return { que: `Su última visita es anterior a los ${dias} días que guardamos.`, donde: null };
    case 'sin_grabacion':
      return { que: `No hay grabación suya: no volvió a entrar, o su visita duró menos de ${REPLAY_PISO_SEGUNDOS} segundos.`, donde: null };
  }
}

/**
 * El cartel de una sesión que CORTAMOS NOSOTROS.
 *
 * Sin esto, una grabación que termina en el minuto 10 se lee como que la persona se
 * fue en el minuto 10 — una conclusión equivocada servida como dato, que es justo lo
 * que esta pantalla existe para no hacer.
 */
export function textoDelCorte(corte: ReplayCorte): string | null {
  if (corte === 'tiempo') return `La cortamos a los ${Math.round(REPLAY_TOPE_SEGUNDOS / 60)} minutos: no se fue en ese momento.`;
  if (corte === 'bytes') return 'La cortamos al llegar al tope de tamaño: no se fue en ese momento.';
  return null;
}

/**
 * Una sesión, como la ve la ficha. El CUERPO no viaja acá: son hasta 2 MiB
 * comprimidos por sesión y la ficha se abre siempre.
 *
 * ⚠️ EL TIPO VIVE EN ESTE MÓDULO Y NO EN `replay-leer.ts`, que es el que lo
 * produce. `replay-leer` tiene `server-only`, y las dos pantallas que dibujan esto
 * son `'use client'`: un `import type` se borra en compilación y no rompe nada,
 * pero deja un import de un módulo de server en un archivo de cliente, que es la
 * primera cosa que alguien convierte en un import de VALOR sin querer.
 */
export type SesionDeLead = {
  id: string;
  inicio: string;
  segundos: number;
  eventos: number;
  corte: ReplayCorte;
  /**
   * ¿Se puede reproducir? `storage_path` en null es una sesión que todavía está
   * grabando (la persona está en la página ahora) o una que nunca se selló: las dos
   * se ven igual en el índice y ninguna se puede abrir.
   */
  lista: boolean;
};

export type ReplayEnLaFicha = {
  sesiones: SesionDeLead[];
  /** null = hay sesiones. Si no, POR QUÉ no hay (ver `textoDelVacio`). */
  vacio: ReplayVacio | null;
  /** La retención del workspace, para poder escribir el número en la pantalla. */
  retencionDias: number;
};

/** `4:07`. Para una lista: lo que distingue una sesión de otra es cuánto dura. */
export function duracionCorta(segundos: number): string {
  const s = Math.max(0, Math.trunc(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * El cuerpo de una sesión sellada, de texto a eventos de rrweb.
 *
 * ⚠️ EL FORMATO DEL OBJETO NO ESTÁ EN EL CONTRATO, y es el hueco entre dos paquetes
 * que no se ven. La ruta dice `.jsonl.gz` y nada más: un EVENTO por línea y un LOTE
 * (un array) por línea son las dos JSON Lines válidas, y elegir la que no es deja un
 * reproductor que no dibuja nada sobre un objeto que está perfecto. Acá se aceptan
 * las dos y se cuenta lo que no se entendió.
 *
 * Medido sobre el árbol a las 09:31 del 05/10/2026: `lineaDeLote` (lib/replay-sellado.ts,
 * el paquete del receptor, sin commitear) escribe UN LOTE por línea —`JSON.stringify`
 * de un array, y `'[]'` cuando el lote vino vacío—. O sea que la rama que corre es la
 * de `Array.isArray`, y las líneas `[]` no son un error: no aportan eventos y tampoco
 * cuentan como ilegibles.
 *
 * Una línea ilegible NO tira la sesión: con 600 segundos de eventos, perder el final
 * de un lote es perder el final de la grabación, no la grabación. Pero el número de
 * líneas perdidas VUELVE, porque una sesión a la que le falta la mitad no se puede
 * mostrar como completa — es la regla de «lo que se descarta queda escrito».
 */
export function parsearCuerpo(texto: string): { eventos: unknown[]; ilegibles: number } {
  const eventos: unknown[] = [];
  let ilegibles = 0;
  for (const linea of texto.split('\n')) {
    const l = linea.trim();
    if (!l) continue;
    let x: unknown;
    try { x = JSON.parse(l); } catch { ilegibles++; continue; }
    if (Array.isArray(x)) { for (const e of x) if (e && typeof e === 'object') eventos.push(e); continue; }
    if (x && typeof x === 'object') { eventos.push(x); continue; }
    ilegibles++;
  }
  return { eventos, ilegibles };
}

/**
 * ¿Hay suficiente para reproducir?
 *
 * rrweb necesita el snapshot completo + al menos un evento más: con menos de dos
 * eventos el reproductor dibuja un cuadro negro y un play que no avanza, que se lee
 * como que el reproductor está roto. Es mejor decir que la grabación llegó cortada.
 */
export const REPLAY_MINIMO_EVENTOS = 2;
