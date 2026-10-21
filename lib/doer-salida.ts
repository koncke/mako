// =============================================================================
// doer-salida — lo que MaKo NO puede mandar al grupo de un cliente, leído en su respuesta
// =============================================================================
// Dos cosas que el prompt pide y el modelo igual hace (medido el 16/10/2026 en el grupo del
// ws18, Pablo Chavez, con Gemini flash-lite):
//
//   1. PROMETER LO QUE NO HACE. «Déjame ver el plan y las tareas para Pablo en este momento»
//      y «Déjame revisar primero el tablero… y te cargo las tareas»: el turno tenía `ver_plan`
//      y `listar_tareas_plan` en la mesa, el modelo contestó en 28 tokens sin llamar a ninguna,
//      y el doer lo mandó. Una respuesta del doer es el FINAL del turno: no hay un «después» en
//      el que MaKo vuelva con el dato. Una promesa así es una mentira con fecha.
//   2. GROSERÍAS. «la cagada es real», «quedé como un vendehumo», «para no clavarte», «bótame»,
//      «sin que lo caguen». La persona de MaKo (lib/mako-persona.ts) dice «puedes putear suave»,
//      que es la voz de Martín hablándose a sí mismo, y se filtró al grupo de un cliente, que
//      también lee su equipo.
//
// Es la segunda capa de «una regla en un prompt no es una regla» (AGENTS.md): el prompt del
// doer lo pide (lib/mako-doer-in.ts, DOER_WA_VOZ), y esto lo mira al salir. NO reescribe:
// saca la ORACIÓN entera, porque reemplazar palabras a mano rompe la frase.
//
// PURO y sin `server-only`: lo usan el doer, el vigía (lib/vigia-mako-grupos.ts) y los tests.
// =============================================================================

/** Sin tildes y en minúsculas: las regex de abajo se escriben así. */
const norm = (s: string): string => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ⚠️ Límites de palabra por Unicode, no `\b`: en JavaScript `\b` es ASCII y en «bótame» no hay
// borde después de la «ó» (AGENTS.md, «La voz de MaKo es rioplatense»). Igual todo se prueba
// sobre el texto SIN tildes, donde `\b` alcanza.
// Sin «creo» («te creo», «ya lo creo») ni «paso» («te paso el link» suele traer el link).
// «aviso», «arreglo», «resuelvo», «soluciono»: «ya le aviso al equipo y te lo arreglo» (17/10/2026, la rotura del test del
// ticket) es una promesa que el turno no cumple, y no la veía nadie.
const VERBOS_ACCION = 'busco|reviso|cargo|anoto|agendo|armo|chequeo|averiguo|preparo|consulto|aviso|arreglo|resuelvo|soluciono|miro';
const PROMESAS: RegExp[] = [
  // «déjame ver / revisar / chequear…», «dejame que lo mire»
  /\bdeja(?:me|nos)\s+(?:que\s+)?(?:ver|revisar|chequear|buscar|mirar|fijarme|consultar|confirmar|cargar|armar|agendar|anotar|preparar|averiguar|lo\s+\w+|la\s+\w+)\b/,
  // «dame un segundo», «dame unos minutos»
  /\bdame\s+(?:un|unos)\s+(?:segundo|segundito|momento|momentito|minuto|minutito)s?\b/,
  // «ya te lo busco», «ahora lo reviso», «enseguida te cargo»
  new RegExp(`\\b(?:ya|ahora|enseguida|al toque|en un (?:momento|minuto|rato|segundo))\\s+(?:(?:te|lo|la|los|las|se|me|le|les)\\s+){0,2}(?:${VERBOS_ACCION})\\b`),
  // «te cargo las tareas», «te lo agendo», «te armo el plan» (presente con valor de futuro)
  new RegExp(`\\bte\\s+(?:(?:lo|la|los|las)\\s+)?(?:${VERBOS_ACCION.replace('|miro', '')})\\b`),
  // «voy a revisar», «voy a cargarte»
  /\bvoy\s+a\s+(?:revisar|ver|cargar|buscar|mirar|agendar|crear|armar|anotar|chequear|consultar|averiguar|preparar|fijarme)\w*/,
  // «lo miro y te paso», «lo reviso y te aviso»
  /\b(?:lo|la|eso)\s+(?:miro|reviso|busco|chequeo|averiguo|veo)\s+y\s+te\b/,
  // «estoy revisando», «me pongo a buscar»
  /\b(?:estoy|me pongo a)\s+(?:revisando|buscando|mirando|cargando|armando|chequeando|consultando|ver|buscar|revisar|cargar|armar)\b/,
];

/**
 * Lo que dice HECHO (20/10/2026, ola 1, pieza 1.5): «Listo, ya lo armé», «te creé la automatización», «quedó programado».
 * Sólo con la primera persona o con «quedó»: «tu landing está publicada» puede ser un dato del contexto, y se deja. Sin
 * tildes. Si es mentira lo decide quien llama (`RespaldoDeHecho`): la frase sola no lo dice.
 */
const VERBOS_HECHO = 'arme|cree|cargue|agende|mande|envie|hice|publique|cambie|movi|borre|guarde|configure|programe|deje|anote|actualice|subi|edite|agregue|elimine|active|pause|prendi|apague|inscribi|asigne';
/** En primera persona: MaKo dice que LO HIZO él. */
const HECHO_POR_MI: RegExp[] = [
  // «ya lo armé», «ya te lo agendé», «ya quedó»
  new RegExp(`\\bya\\s+(?:(?:te|lo|la|los|las|se|le|les)\\s+){0,2}(?:${VERBOS_HECHO})\\b`),
  // «Listo, armé…», «Hecho: te lo cargué»
  new RegExp(`\\b(?:listo|hecho)\\s*[,.:!]?\\s+(?:(?:te|lo|la|los|las|se|le|les)\\s+){0,2}(?:${VERBOS_HECHO})\\b`),
  // «te creé la automatización», «te dejé armado»
  new RegExp(`\\bte\\s+(?:(?:lo|la|los|las)\\s+)?(?:${VERBOS_HECHO})\\b`),
];
/** Un ESTADO: «quedó programada», «quedaron cargadas». Puede ser lo que MaKo leyó. */
const QUEDO_HECHO = /\bqued(?:o|aron)\s+(?:ya\s+)?(?:cread|hech|armad|cargad|programad|guardad|agendad|enviad|mandad|publicad|actualizad|configurad|listo|lista)\w*/;

/** Lo que el texto dice HECHO, tal como aparece. Vacío = no dice nada hecho. `soloPorMi`: sin el «quedó …». */
export function afirmaHechoDe(texto: string, { soloPorMi = false }: { soloPorMi?: boolean } = {}): string[] {
  const t = norm(texto);
  return [...HECHO_POR_MI, ...(soloPorMi ? [] : [QUEDO_HECHO])].flatMap((re) => t.match(re)?.[0] ?? []);
}

/** La oración pide un dato a la persona («dime», «pásame», «confirmame»). Sin tildes. */
const PIDE_DATO = /\b(?:pasame|dime|decime|mandame|enviame|confirmame|indicame|contame|cuentame|avisame)\b/;

/**
 * Las promesas de una acción FUTURA que trae el texto («déjame ver», «te cargo»), tal como
 * aparecen. Vacío = no promete nada.
 *
 * ⚠️ Sólo significa «no lo hizo» si el turno NO corrió ninguna herramienta: con una lectura
 * hecha, «te cargo las tareas» puede ser el ofrecimiento de un paso siguiente. Eso lo decide
 * quien llama (el doer cuenta las corridas; el vigía no las ve y lo marca como sospecha).
 */
export function promesasDe(texto: string): string[] {
  const out: string[] = [];
  const todas = oraciones(texto).flat().map((o) => o.trim()).filter(Boolean);
  // ⚠️ UNA PROPUESTA QUE TERMINA PIDIENDO EL «SÍ» NO ES UNA PROMESA: «Voy a agendar la visita con Demo Lead el martes 13
  // a las 11:00. ¿Confirmas con un «sí»?» (ws9, 10/10/2026) dice lo que VA a hacer cuando la persona diga que sí, y el
  // «sí» que sigue lo hace (lib/mako-intencion.ts, la regla del «sí» a un ofrecimiento). Lo marcó el vigía en su
  // primera pasada: con la regla de abajo sola, toda propuesta honesta era una promesa.
  if (/[?]\s*[*_»"')\]]*\s*$/.test(todas[todas.length - 1] ?? '')) return [];
  for (const o of todas) {
    // Una PREGUNTA no promete: ofrece («¿Te la agendo mañana a las 12?»). Desde el 08/10/2026
    // MaKo ofrece la acción en una consulta (decisión de Martín, «la ofrece»), y sacarla sería
    // sacarle a la persona el «sí» que la hace.
    if (/[¿?]/.test(o)) continue;
    const t = norm(o);
    // Y la que PIDE un dato para hacerlo tampoco: «Dime a qué hora y te lo agendo» (ws13, 13/10) es una condición,
    // no un «ya lo hago». Lo que no se puede es decirlo sin pedir nada.
    if (PIDE_DATO.test(t)) continue;
    for (const re of PROMESAS) {
      const m = re.exec(t);
      if (m && !out.includes(m[0])) out.push(m[0]);
    }
  }
  return out;
}

/**
 * Las groserías y el lunfardo que no van en el grupo de un negocio. Lista CERRADA a propósito:
 * es lo que se vio salir (16/10/2026) más lo inequívoco. Una palabra que también es neutra
 * («clavar la idea», «quemar las naves») no entra suelta: entra la forma que se vio. Por eso no están
 * «forro» (el del celular) ni «coño» (sin tilde es «cono»).
 */
const GROSERIAS = /\b(?:cagad[ao]s?|cagar(?:on|se|la|lo)?|cagaste|cagamos|cague[sn]?|caguen|cagando|carajo|mierdas?|put[ao]s?|putea\w*|boludo?s?|boluda?s?|boludez|pelotud[ao]s?|pelotudez|chot[ao]s?|garcha|vergas?|joder|jodid[ao]s?|culos?|chantas?|vendehumos?|clavarte|clavarme|clavaron|te clavan|botame|cojones|huevadas?|pendej[ao]s?|ching\w+|ojete|orto)\b/g;

/** Las groserías que trae el texto, tal como aparecen (sin tildes). Vacío = limpio. */
export function groseriasDe(texto: string): string[] {
  const t = norm(texto);
  return [...new Set(t.match(GROSERIAS) ?? [])];
}

/** Parte un texto en oraciones sin perder las líneas: [línea][oración]. */
function oraciones(texto: string): string[][] {
  return texto.split('\n').map((l) => l.split(/(?<=[.!?…])\s+/));
}

/**
 * El texto sin las ORACIONES que cumplen `fuera`. Devuelve null si no queda nada que valga la
 * pena mandar (menos de 15 letras): quien llama pone su propia línea.
 */
export function sinOraciones(texto: string, fuera: (oracion: string) => boolean): string | null {
  const lineas = oraciones(texto)
    .map((ors) => ors.filter((o) => !fuera(o)).join(' ').trimEnd());
  // Sin líneas vacías repetidas: sacar una oración que era un párrafo entero deja un hueco.
  const limpio = lineas.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return (limpio.match(/\p{L}/gu) ?? []).length >= 15 ? limpio : null;
}

/**
 * Lo que se le suma a una respuesta a la que se le sacó una promesa: la verdad, en una línea. ⚠️ No promete otra cosa
 * («ya lo hago»): pide el pedido de nuevo, que es lo único que hace que el próximo turno lo haga.
 */
export const SIN_HACER = 'Eso no lo llegué a hacer en este mensaje: pídemelo otra vez y lo hago.';
/**
 * La nota que va cuando MaKo dice que HIZO algo y el código no ve nada que lo respalde (1.5; la tercera revisión,
 * 21/10/2026). ⚠️ LA ORACIÓN NO SE BORRA: borrar una verdad («sí, ya te la agendé» después de confirmar la tarjeta) es peor
 * que dejar pasar una mentira, porque le dice al cliente «no hice nada» sobre algo que sí se hizo. Las dos versiones que
 * borraban (por si corrió algo, y por las raíces de las palabras) terminaron borrando verdades: leer texto libre con reglas
 * falla en lo obvio (AGENTS.md). Un falso positivo cuesta esta nota, no una respuesta. ⚠️ No pide repetirlo.
 */
export const NOTA_SIN_RESPALDO = 'No veo esa acción en este chat: revísala antes de darla por hecha.';
/** Lo que va cuando la respuesta entera era grosera. */
export const SIN_GROSERIA = 'Perdón, me expresé mal. ¿Seguimos?';

/** `sinRespaldo`: lo que dice HECHO y el código no respalda (lleva la nota). */
export type Saneo = { texto: string; promesas: string[]; groserias: string[]; sinRespaldo?: string[] };

/**
 * Lo que respalda, en el chat de la app, una frase que dice HECHO (1.5; las revisiones del 21/10/2026). En ese chat el
 * turno no ejecuta nada: lo que escribe deja una tarjeta o una pantalla, y se hace al confirmar. El respaldo lo pone el
 * CÓDIGO, nunca el texto: lo que se ejecutó, o la tarjeta confirmada, ya se ve en el hilo.
 */
export type RespaldoDeHecho = {
  /** Corrió en el turno algo que ESCRIBE de verdad (un control como `cancelar_accion`, sin error), o el hilo tiene una
   *  tarjeta confirmada («Hecho: …») después del último pedido de la persona. Con eso, no hay nota. */
  respaldado: boolean;
  /** Corrió una LECTURA: «quedó agendada» puede ser lo que leyó. «Ya le mandé», no. */
  leyo: boolean;
  /** El turno dejó algo para confirmar: «te dejé la reunión para confirmar» habla de eso. */
  tarjeta: boolean;
  /** MaKo preguntó: la pregunta cierra el mensaje, sin nota. */
  pregunta: boolean;
};

/**
 * La respuesta del doer lista para salir, con lo que se le sacó.
 *
 * `corrioHerramientas`: si el turno corrió al menos UNA herramienta. Con una corrida, una
 * promesa puede ser el ofrecimiento honesto del paso siguiente, y se deja; sin ninguna, es
 * seguro que no la cumplió.
 *
 * Sin la promesa, la respuesta dice lo que hizo y nada de lo que no: se le suma `SIN_HACER`,
 * porque una charla que termina en «Jajaja, acepto el reto.» deja a la persona esperando lo que
 * se le prometió en la oración que se sacó.
 *
 * Lo que dice HECHO sin respaldo (`hecho`, el chat de la app) NO se saca: queda, y se le suma UNA vez `NOTA_SIN_RESPALDO`.
 */
export function sanearSalida(texto: string, { corrioHerramientas, hecho }: {
  corrioHerramientas: boolean;
  /** También lo que dice HECHO sin respaldo («Listo, ya lo armé»): el chat de la app (1.5). */
  hecho?: RespaldoDeHecho;
}): Saneo {
  const prometidas = corrioHerramientas ? [] : promesasDe(texto);
  const groserias = groseriasDe(texto);
  let salida = texto;
  if (prometidas.length || groserias.length) {
    const sacada = sinOraciones(texto, (o) => (prometidas.length > 0 && promesasDe(o).length > 0) || groseriasDe(o).length > 0);
    salida = prometidas.length ? (sacada ? `${sacada}\n\n${SIN_HACER}` : SIN_HACER) : (sacada ?? SIN_GROSERIA);
  }
  // Lo que dice HECHO y el código no respalda: sobre lo que QUEDA (una oración con una promesa o una grosería ya salió).
  // «Te dejé la reunión para confirmar» con una tarjeta en el turno habla de ella.
  const sinRespaldo = hecho && !hecho.respaldado && !hecho.pregunta
    ? afirmaHechoDe(salida, { soloPorMi: hecho.leyo }).filter((h) => !(hecho.tarjeta && /\bdeje\b/.test(h)))
    : [];
  if (sinRespaldo.length && !salida.includes(NOTA_SIN_RESPALDO)) salida = `${salida}\n\n${NOTA_SIN_RESPALDO}`;
  return { texto: salida, promesas: prometidas, groserias, ...(sinRespaldo.length ? { sinRespaldo } : {}) };
}
