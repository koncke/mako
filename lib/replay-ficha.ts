// =============================================================================
// replay-ficha — lo que la ficha del lead DICE cuando no hay grabación
// =============================================================================
// El reproductor es lo único que el replay propio compra sobre Clarity: que la
// grabación se vea ACÁ. Pero el estado normal de esta tarjeta, durante semanas,
// va a ser el VACÍO — y «sin grabación» a secas acusa a cualquiera.
//
// ⚠️ UN LEAD SIN GRABACIÓN PUEDE SER SIETE COSAS DISTINTAS, y se leen igual:
//
//   1. el lead no trae `visitor_id`: no hay con qué cruzar y no va a haberlo;
//   2. no se pudo LEER el índice (la migración 0191 todavía no está aplicada, o
//      la consulta falló): no saber no es saber que no hay;
//   3. no tiene NINGUNA visita registrada en la página;
//   4. su visita es ANTERIOR al grabador y su página HOY ya graba: no hay nada que
//      arreglar, sólo decir de cuándo es;
//   5. su visita trajo un código sin grabador y su página SIGUE con ese código:
//      eso sí se arregla, repegándolo;
//   6. la grabación EXISTIÓ y la purga ya la borró por retención;
//   7. su visita podía grabarse y no quedó. Desde acá no se sabe por qué, y no se
//      inventa.
//
// Sólo la 5 manda a hacer algo, y lleva su link. Las demás no se arreglan desde
// ninguna pantalla y hay que decirlo así, porque mandar a alguien a repegar un
// código que ya está al día es el candado sin llave que AGENTS.md prohíbe.
//
// ⚠️ LA 4 Y LA 7 ERAN UNA SOLA FRASE, Y MENTÍA (08/10/2026). Martín, sobre la
// ficha del #2593 (ws1): «Si literalmente dice en el historial que estuvo más de
// 10 segundos». La ficha decía «no volvió a entrar, o su visita duró menos de 10
// segundos», con una visita de 4 minutos a la vista. La visita era del 30/09 con
// el Pixel v14, cinco días antes de que existiera el grabador; la frase afirmaba
// una duración que nadie midió (la ficha no lee el tiempo en la página) y un piso
// que tampoco es el real: medido el 08/10, en ws1 no quedó grabado ninguno de los
// 35 visitantes que estuvieron entre 10 y 30 s, y la foto de su página (115 KB
// sin comprimir) no entra en los 64 KiB del beacon que sale al irse. Por eso la 7
// no da causa: cualquier causa que dijera hoy sería una suposición.
//
// ⚠️ SIN `server-only`, a propósito y por la misma razón que `replay-contrato.ts`:
// lo que se puede equivocar es la DECISIÓN de qué frase sale, y eso tiene que
// poder probarse sin base de datos. Las consultas viven en `lib/replay-leer.ts`.
// =============================================================================

import { REPLAY_TOPE_SEGUNDOS, grabacionVencio, type ReplayCorte } from './replay-contrato';
import { clavePagina, pixelParaActualizar, type MapaVersiones } from './pixel-aviso';
import { TZ_TIJUANA } from './date-utils';

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

/**
 * Desde cuándo EXISTE el grabador: el commit 07540703, 05/10/2026 10:27 -0300.
 * Es la cota más temprana posible —el deploy vino después—, así que una visita
 * anterior a esto no pudo grabarse, traiga el `sv` que traiga.
 *
 * ⚠️ ES LO QUE CONTESTA LAS VISITAS CON `sv` EN NULL. Un `sv` null es «no se sabe»
 * y no acusa a ninguna versión; pero la FECHA sí se sabe. Medido el 08/10/2026: las
 * 3.670 visitas con `sv` null de ws1 y las 49 de ws11 son todas del 15/08 o
 * anteriores, y 24 de los 63 leads de ws1 con `visitor_id` sólo tienen visitas así (o
 * mezcladas con versiones viejas). Sin la fecha, esos 24 caían en «no quedó
 * grabada», que es verdad y no explica nada.
 */
export const REPLAY_DESDE_ISO = '2026-10-05T13:27:15Z';

/**
 * Una visita del lead, como la necesita el vacío. La lee `replayDeLead` de
 * `landing_visits`: `sv` es la versión del Pixel que trajo ESA visita (null = no
 * se sabe: visitas anteriores a la mig 0135), y `url` la página tal como la mandó
 * el beacon, que es de donde sale la clave del mapa de versiones por página.
 */
export type VisitaDelLead = { iso: string | null; sv: number | null; url: string | null };

/**
 * ¿Esta visita NO pudo grabarse? Verdadero sólo si se SABE: o trajo un Pixel sin
 * grabador, o es anterior a que el grabador existiera. Una visita sin `sv` y sin
 * fecha legible no se sabe, y eso no autoriza a decir «fue antes del grabador».
 */
export function visitaSinGrabador(v: VisitaDelLead): boolean {
  if (typeof v.sv === 'number' && Number.isFinite(v.sv)) return v.sv < REPLAY_DESDE_SNIPPET;
  const t = v.iso ? Date.parse(v.iso) : NaN;
  return Number.isFinite(t) && t < Date.parse(REPLAY_DESDE_ISO);
}

/** La visita más reciente con fecha legible; `null` si no hay ninguna. */
export function ultimaVisita(visitas: ReadonlyArray<VisitaDelLead>): VisitaDelLead | null {
  let mejor: VisitaDelLead | null = null;
  let tMejor = -Infinity;
  for (const v of visitas) {
    const t = v.iso ? Date.parse(v.iso) : NaN;
    if (Number.isFinite(t) && t > tMejor) { mejor = v; tMejor = t; }
  }
  return mejor;
}

/**
 * ¿La página de ESA visita graba HOY? Decide entre las dos frases de una visita que
 * no se grabó por el código: «es de antes» (nada que hacer) o «tu código es
 * anterior» (con el link para repegarlo).
 *
 * ⚠️ POR PÁGINA, CON LA MISMA CLAVE QUE EL BEACON (`clavePagina`). El mapa
 * `landing.snippet_versiones` lo escribe el beacon con la clave de la URL del
 * pageview; con otra normalización el cruce falla en silencio y la página se lee
 * como «nunca mandó nada». Y es el mapa, no lo que SIRVE la página
 * (`lib/pixel-servido.ts`): eso es un GET a la página del cliente, con 5 s de
 * plazo, en cada apertura de una ficha.
 *
 * Una página que no está en el mapa (no tuvo visitas desde el 06/10, cuando nació,
 * o se cayó del tope de 30) decide con la versión del negocio, que es el mismo
 * respaldo que usa `veredictoPixel` («negocio»). Acá sólo elige si sale el link:
 * las dos frases que elige dicen que esa visita no se grabó por el código, así que
 * no puede volver a esconder un Pixel viejo detrás de uno nuevo, que es lo que
 * hacía el máximo de las dos versiones (ver `replayDeLead`).
 *
 * ⚠️ EL RESPALDO ES DÉBIL DONDE HAY VARIAS PÁGINAS. La versión del negocio es la del
 * último evento: medido el 08/10/2026, en ws11 dice 22 y 7 de las 9 páginas del mapa
 * están en la 18 o la 15. Una página de ws11 fuera del mapa (el #2460, en
 * /onboarding) sale «es de antes» sin link aunque pueda seguir vieja. Lo que la
 * cubre es el aviso fijo de «Actualiza el Pixel», que mira página por página.
 *
 * `null` = no hay ningún dato: ni la página ni el negocio. Quien llama no manda a
 * repegar con eso.
 */
export function paginaGrabaHoy(mapa: MapaVersiones, url: string | null, versionNegocio: string | null): boolean | null {
  const k = clavePagina(url);
  const v = k ? mapa[k]?.v : undefined;
  if (typeof v === 'number') return v >= REPLAY_DESDE_SNIPPET;
  const n = pixelParaActualizar(versionNegocio).instalada;
  return n == null ? null : n >= REPLAY_DESDE_SNIPPET;
}

/**
 * ¿Se puede decir «por eso no graban las visitas» de TODAS las páginas que nombra un
 * aviso? `versiones` son las de las páginas nombradas (`null` = no se pudo saber).
 *
 * ⚠️ «Atrasada» y «no graba» son dos umbrales: una página en la v21 está atrasada
 * respecto de la v22 y GRABA. El WhatsApp de «quedó viejo» calculaba la frase con la
 * versión MÁS BAJA de la lista y la aplicaba a toda la lista, así que con una página en
 * la 21 y otra en la 18 afirmaba que las dos no graban (revisión del 06/10/2026). Y va
 * a pasar en cada subida de versión.
 *
 * Por eso es verdad sólo si lo es para cada una, y una versión que no se sabe no
 * autoriza a afirmar nada. Sin páginas nombradas el mensaje es el genérico y decide la
 * versión del workspace, que es lo único que hay.
 */
export function noGrabanTodas(versiones: ReadonlyArray<number | null>, instaladaWs: number): boolean {
  if (!versiones.length) return instaladaWs < REPLAY_DESDE_SNIPPET;
  return versiones.every((v) => typeof v === 'number' && v < REPLAY_DESDE_SNIPPET);
}

/** Por qué esta ficha no tiene ninguna grabación para mostrar. */
export type ReplayVacio =
  | 'sin_visitor'
  | 'no_se_pudo_leer'
  | 'sin_visitas'
  | 'antes_del_grabador'
  | 'pixel_viejo'
  | 'vencida'
  | 'no_quedo';

/** Lo que hace falta para decidir. Lo junta `replayDeLead` (lib/replay-leer.ts). */
export type SenalesDelVacio = {
  /** El `visitor_id` del lead. null = entró a mano o por formulario de Meta. */
  visitorId: string | null;
  /** false = alguna de las dos lecturas (el índice o la configuración) FALLÓ. */
  leyoTodo: boolean;
  /** ¿Hay al menos una sesión en el índice? */
  hayGrabaciones: boolean;
  /**
   * Las visitas de ESTE lead, de la más nueva a la más vieja. `null` = la lectura
   * falló y no se sabe; `[]` = se leyó y no hay ninguna. Son dos frases distintas.
   */
  visitas: ReadonlyArray<VisitaDelLead> | null;
  /** ¿La página de su última visita graba hoy? Ver `paginaGrabaHoy`. null = no se sabe. */
  suPaginaGrabaHoy: boolean | null;
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
 *   · Una grabación que existe gana sobre todo lo demás.
 *   · «Este lead no trae identificador» va antes que «no pude leer»: es un hecho
 *     que no depende de ninguna consulta —el lead entró a mano o por un formulario
 *     de Meta— y no cambia si la lectura se arregla. Decir «no pude leer» ahí manda
 *     a reintentar algo que va a contestar lo mismo siempre.
 *   · «No pude leer» va antes que cualquier afirmación de ausencia. Es la regla de
 *     la casa: no poder leer un dato no es un valor del dato.
 *   · Desde el 06/10/2026 no hay apagador: la grabación está siempre prendida
 *     (lib/replay-contrato.ts), así que el caso «apagado» ya no existe y se sacó.
 *   · «No hay visitas» va antes que todo lo que habla de SU visita: sin visita no
 *     hay versión que mirar ni nada que se haya podido vencer. Y sólo sale si la
 *     lectura de las visitas CONTESTÓ: si falló, no se sabe, y se sigue de largo.
 *   · El código de la visita va antes de la retención: si la página no tenía el
 *     grabador, no hubo nada que vencer — decir «ya la borramos» inventaría una
 *     grabación.
 *   · El último caso no da causa. Ver la cabecera de este archivo.
 */
export function motivoDelVacio(s: SenalesDelVacio): ReplayVacio | null {
  if (s.hayGrabaciones) return null;
  if (!s.visitorId) return 'sin_visitor';
  if (!s.leyoTodo) return 'no_se_pudo_leer';
  if (s.visitas && s.visitas.length === 0) return 'sin_visitas';
  // ⚠️ TODAS, no la última ni la más nueva: con UNA visita que pudo grabarse, una
  // grabación pudo existir, y «fue antes del grabador» sería falso para esa.
  if (s.visitas && s.visitas.every(visitaSinGrabador)) {
    // Sólo `false` manda a repegar. `null` (no se sabe qué versión tiene hoy la
    // página) no autoriza un link a arreglar algo que puede estar al día.
    return s.suPaginaGrabaHoy === false ? 'pixel_viejo' : 'antes_del_grabador';
  }
  // `tieneLead: true` por construcción —esto se dibuja en la ficha de un lead—, así
  // que la retención que aplica es la larga. Se reusa la decisión del contrato en vez
  // de restar fechas acá: con dos cuentas, la purga y esta pantalla se separan.
  if (s.ultimaActividadISO && grabacionVencio(s.ultimaActividadISO, s.ahoraISO, true, s.retencionDias)) return 'vencida';
  return 'no_quedo';
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
 * ⚠️ Y `vencida` NO AFIRMA QUE HUBO UNA. Cuando la purga borra, borra también la
 * fila del índice: desde esta pantalla no hay forma de distinguir «existió y se
 * venció» de «nunca hubo». La frase dice la condición —su visita es más vieja que
 * lo que guardamos— y no el hecho.
 *
 * ⚠️ `sin_visitas` DICE LO QUE REGISTRAMOS, no lo que pasó en el mundo. Medido el
 * 08/10/2026 en ws1: de los 12 leads con `visitor_id` y ninguna visita, 11 no tienen
 * ningún evento, pero uno (el #329) tiene dos reproducciones de junio sin su visita.
 *
 * `visita` y `tz` sólo los usa `antes_del_grabador`, que escribe la fecha: el día en
 * la zona del negocio (en la ficha la da `useTzWorkspace`; sin zona, la de la casa).
 */
export function textoDelVacio(
  motivo: ReplayVacio,
  retencionDias: number,
  visita?: { iso: string; varias: boolean } | null,
  tz?: string,
): TextoVacio {
  const dias = Math.max(1, Math.trunc(retencionDias));
  switch (motivo) {
    case 'sin_visitor':
      return { que: 'Este lead no trae identificador: no hay con qué cruzar una grabación.', donde: null };
    case 'no_se_pudo_leer':
      return { que: 'No pude leer sus grabaciones. No significa que no haya.', donde: null };
    case 'sin_visitas':
      return { que: 'No registramos visitas suyas a tu página.', donde: null };
    case 'antes_del_grabador': {
      // Sin link: no hay nada que arreglar. Su página ya graba; esa visita fue antes.
      const dia = visita ? diaMes(visita.iso, tz ?? TZ_TIJUANA) : null;
      return dia
        ? { que: `Su ${visita?.varias ? 'última ' : ''}visita es del ${dia}, antes de que MaKo grabara tu página.`, donde: null }
        : { que: 'Su visita es anterior a que MaKo grabara tu página.', donde: null };
    }
    case 'pixel_viejo':
      return {
        que: 'El código de tu página es anterior a la grabación, así que esa visita no se grabó.',
        donde: { texto: 'Actualizar el código', href: '/integraciones?abrir=landing' },
      };
    case 'vencida':
      return { que: `Su última visita es anterior a los ${dias} días que guardamos.`, donde: null };
    case 'no_quedo':
      return { que: 'Su visita no quedó grabada.', donde: null };
  }
}

/** `30/09`, en la zona dada. `null` si la fecha no se puede leer. */
function diaMes(iso: string, tz: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', timeZone: tz }).format(d);
  } catch {
    // Una zona que el runtime no conoce no tira la ficha: sale el día en UTC.
    return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(d);
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
  /**
   * Su última visita registrada, para escribir de cuándo es. `varias` = tiene más
   * de una («Su última visita…»). null = no hay visitas, o no se pudieron leer.
   */
  visita: { iso: string; varias: boolean } | null;
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

/**
 * ¿Trae la FOTO de la página? Es el evento de rrweb `type: 2` (FullSnapshot): todo
 * lo demás son cambios sobre esa foto, y sin ella el reproductor no tiene qué
 * dibujar — un cuadro negro con un play que avanza sobre nada.
 *
 * ⚠️ CONTAR EVENTOS NO ALCANZA (08/10/2026). El modal sólo exigía dos, y medido ese
 * día: 7 de las 28 sesiones selladas de ws1 empiezan con un `type: 3` y no tienen
 * foto, y las dos del #2611 de ws11 —el único lead con grabaciones de toda la base—
 * tampoco. Las nueve se ofrecían con «Ver la grabación». La foto se pierde en el
 * grabador (no entra en el beacon al irse, o no entra en el tope por lote en una
 * página pesada), así que acá no se arregla: se dice.
 */
export function tieneFoto(eventos: ReadonlyArray<unknown>): boolean {
  return eventos.some((e) => !!e && typeof e === 'object' && (e as { type?: unknown }).type === 2);
}
