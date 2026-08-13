// =============================================================================
// La compuerta de salida de MaKo en WhatsApp
// =============================================================================
// El caso que la trajo, reportado por el dueño el 9/8/2026: mandó dos tareas para
// cargar al plan y MaKo, en vez de crear el borrador y contestar con el LINK, le
// escupió el borrador ENTERO como texto — con las preguntas del formulario ahí
// mismo en el chat y un «**Eliminar** — Nada por ahora» que no significa nada para
// quien lo lee. Sus palabras: «me comenzó a preguntar allí mismo en el chat, cuando
// existe justamente la metodología de enviar el link» y «no entiendo qué hizo».
//
// No entendía porque MaKo no hizo nada: no hubo INSERT, no hubo id, no hubo link.
// Solo redactó. Lo que salió por WhatsApp era el `input_schema` de la tool
// `proponer_tareas_plan` aplanado a markdown, campo por campo — el MOLDE_DETALLE va
// LITERAL en la description del campo `detalle`, y con un modelo chico el schema
// viaja como prompt plano, indistinguible de una instrucción.
//
// LA CAUSA NO FUE EL MODELO. El día anterior acertó cuatro veces con el mismo
// modelo y la misma ruta. La causa es que el código aceptaba cualquier texto:
//
//     if (r.text && !r.text.startsWith('(')) { respuesta = r.text.trim(); break; }
//
// El único filtro era que no empezara con paréntesis. «Este turno crea un borrador»
// no existía como decisión del código: la tomaba el modelo emitiendo un tool_call, y
// si no lo emitía, su prosa salía derecho al WhatsApp del dueño. Es exactamente
// AGENTS.md → «Una regla en un prompt no es una regla»: el preámbulo pedía «llamá
// proponer_tareas_plan» y esa era la única capa.
//
// ⚠️ Y NO alcanza con `toolsUsados > 0`, que es la guarda que ya existía apagada
// detrás de un flag. Ese día el modelo SÍ llamó una tool (`ver_plan`, la de 6 tokens
// del registro de gasto) y después redactó igual. La pregunta correcta no es «¿llamó
// alguna herramienta?» sino **«¿ocurrió el efecto que esta ruta exigía?»** — y de eso
// hay prueba dura: `linkBorrador`, que solo se setea cuando `crearPropuesta` hizo el
// INSERT y devolvió un id real.
//
// Sin `server-only` a propósito, para que se pueda testear sola. Mismo criterio que
// `lib/link-borrador.ts` y `exigirClienteDePrueba`.

import { evaluarDetalle } from './detalle-contrato';

export type VeredictoDoer =
  | { ok: true }
  | { ok: false; razon: 'molde-volcado' | 'link-inventado' | 'sin-borrador'; detalle: string };

/** El link de un borrador. Solo lo puede escribir el código: son 17 caracteres al azar. */
const LINK_REVISAR = /\/plan\/revisar\/[A-Za-z0-9_-]+/;

/** Lo que MaKo contesta cuando bloqueamos su respuesta. Honesto y corto: decir «no
 *  pude» es infinitamente mejor que mandar el payload y que el dueño tenga que
 *  adivinar qué pasó. */
export const AVISO_NO_PUDE =
  'No pude armar el borrador con eso. Reintentá en un momento y si vuelve a pasar, avisame.';

/**
 * La respuesta cuando el borrador SÍ se creó. Vive acá y no suelta en el prompt
 * porque la usan los dos: el preámbulo la muestra como ejemplo y la compuerta la
 * escribe cuando el modelo se fue por las ramas. Copiada en dos lados, la segunda
 * copia se queda vieja — y acá «vieja» significa que MaKo promete algo distinto de
 * lo que la guarda manda.
 */
export const mensajeBorrador = (link: string) =>
  `Listo, te armé el borrador. Revisalo y confirmalo acá 👇\n${link}`;

/** El mismo mensaje en UNA línea, para mostrarlo como ejemplo adentro de un prompt.
 *  Sale de la función y no de un string aparte: el ejemplo que ve el modelo y lo que
 *  la guarda manda tienen que ser la misma frase, siempre. */
export const EJEMPLO_BORRADOR = mensajeBorrador('<link>').replace(/\n/g, ' ');

/**
 * La respuesta cuando se propuso un LEAD. Es la misma jugada que
 * `mensajeBorrador` y existe aparte por una razón concreta.
 *
 * EL CASO (2026-08-13, Leila). El alta funcionó bien —MaKo propuso en vez de
 * escribir— y aun así ella entendió que el contacto YA estaba cargado, porque el
 * modelo redactó: «Anotado los datos de Enrique Duarte. Revisalo y sumalo
 * directo al CRM desde acá.»
 *
 * «Anotado» es pasado y suena a hecho. «Sumalo directo al CRM» suena a atajo, no
 * a requisito. Las dos frases son razonables sueltas y juntas dicen lo contrario
 * de lo que pasó: el lead NO existe hasta que ella confirme.
 *
 * ⚠️ Por eso el texto no se le pide al modelo en el prompt: se le SACA. Que el
 * estado de un dato dependa de cómo le salió la frase a un LLM es la misma
 * trampa que el link de 17 caracteres — y acá el costo es que alguien crea que
 * un lead está en el CRM cuando no está, y lo dé por seguido.
 *
 * Las tres cosas que el mensaje tiene que dejar en claro, en este orden:
 *   1. de quién estamos hablando (para que se vea que MaKo entendió bien);
 *   2. que TODAVÍA NO está en el CRM;
 *   3. qué falta para que lo esté.
 */
export const mensajeLeadPropuesto = (link: string, nombre?: string | null) => {
  const quien = (nombre ?? '').trim();
  return [
    `Preparé la ficha${quien ? ` de *${quien}*` : ''} para el CRM.`,
    '',
    '⚠️ *Todavía no está cargado.* Revisá los datos y confirmá acá para que entre 👇',
    link,
  ].join('\n');
};

/** El mismo, en una línea, para mostrarlo como ejemplo adentro de un prompt. */
export const EJEMPLO_LEAD = mensajeLeadPropuesto('<link>', '<nombre>').replace(/\n+/g, ' ');

/**
 * ¿Esta respuesta se puede mandar por WhatsApp?
 *
 * Dos señales, con severidades distintas a propósito:
 *
 * **A) `molde-volcado` — bloqueo duro.** El texto trae los títulos del MOLDE_DETALLE
 * («Qué hay que hacer», «Por qué», «Detalles concretos», «Listo cuando»). Ese molde
 * es el contrato del campo `detalle` de una tarea; no hay ninguna razón legítima para
 * que aparezca en un mensaje de chat. Si está, el modelo volcó el payload en vez de
 * ejecutarlo. Reusa `evaluarDetalle`, que ya sabe reconocerlos con o sin asteriscos y
 * sin depender de acentos ni mayúsculas — la respuesta mala del 9/8 traía tres de los
 * cuatro. Vale para cualquier proveedor: atrapa el caso venga de mistral o de Claude.
 *
 * **B) `sin-borrador` — señal blanda.** La ruta era «cargar al plan» y no hay link.
 * No bloquea el mensaje: hay turnos legítimos en esa ruta que no crean nada («¿qué
 * tengo pendiente?»). Sirve para dejar rastro — el modo de falla grave era el único
 * que no logueaba NADA, y por eso del 9/8 no quedó ni una línea en los logs.
 */
export function validarRespuestaDoer(
  texto: string,
  ctx: { motivoRuta: string; linkBorrador: string | null },
): VeredictoDoer {
  const t = (texto ?? '').trim();
  if (!t) return { ok: false, razon: 'sin-borrador', detalle: 'respuesta vacía' };

  const ev = evaluarDetalle(t);
  if (ev.conForma) {
    return {
      ok: false,
      razon: 'molde-volcado',
      detalle: `la respuesta trae el molde del detalle (${ev.partes.join(' · ')}): el modelo redactó el borrador en vez de crearlo`,
    };
  }

  // ⚠️ EL LINK INVENTADO. Esta señal NO mira la ruta, y ahí está la gracia.
  //
  // El caso (10/8/2026): el dueño mandó ideas para cargar al plan y MaKo contestó
  // «Listo, te armé el borrador» con un link. Al abrirlo: «este borrador ya no
  // existe». No existía porque nunca se creó — la herramienta no corrió (tres
  // llamadas de 79, 6 y 47 tokens, ningún INSERT) y el modelo escribió un id
  // plausible: `propmsn956x9qg48`, un carácter más corto que uno de verdad.
  //
  // Por qué no lo atajó `sin-borrador`: el router clasificó ese turno como
  // `(dato/acción)`, no `(plan)`, así que la señal de abajo ni se evaluó. Colgar la
  // detección de que el router acierte es colgarla de otra heurística.
  //
  // Esta no depende de nada: el link de un borrador son 17 caracteres al azar y su
  // ÚNICA fuente legítima es el valor que devolvió la tool (`linkBorrador`). Si hay
  // un link en el texto y no hay borrador, es inventado — venga de la ruta que venga
  // y del proveedor que sea. Es el corolario de AGENTS.md: «un dato exacto que pasa
  // por las manos de un LLM deja de ser exacto».
  if (!ctx.linkBorrador && LINK_REVISAR.test(t)) {
    return {
      ok: false,
      razon: 'link-inventado',
      detalle: `la respuesta trae un link de borrador (${LINK_REVISAR.exec(t)?.[0]}) que nadie creó`,
    };
  }

  if (esRutaPlan(ctx.motivoRuta) && !ctx.linkBorrador) {
    return { ok: false, razon: 'sin-borrador', detalle: 'ruta de plan sin link de borrador' };
  }
  return { ok: true };
}

/** El `motivo` del router llega como «mistral router:sonnet (plan)». La ruta va entre
 *  paréntesis; se busca así y no por `includes('plan')` a secas para no matchear la
 *  palabra «plan» del recorte del mensaje del usuario, que va en el mismo string. */
/**
 * ⚠️ Ahora reconoce DOS marcas y las dos tienen que quedar: `(plan)` es la del
 * router (elige el modelo) y `→ capturar` la de la intención
 * (lib/mako-intencion.ts), que es la que de verdad decide. Mientras el router
 * siga existiendo, un turno puede traer una sola de las dos: quedarse con una
 * apagaría la validación justo en los turnos que la necesitan.
 */
export const esRutaPlan = (motivoRuta: string): boolean =>
  /\(plan\)/.test(motivoRuta ?? '') || /→\s*capturar\b/.test(motivoRuta ?? '');
