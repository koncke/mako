// =============================================================================
// confirmacion-pura — un «sí» que confirma lo que le llega a un TERCERO es un «sí» y nada más
// =============================================================================
// El doer de WhatsApp toma como confirmación de una pendiente cualquier mensaje que ARRANCA con «sí», «dale», «ok», «perfecto»…
// (`CONFIRMACION`, lib/mako-intencion.ts, un `^` sin `$`): «ok, esperá que lo reviso», «perfecto, después lo veo», «sí pero
// cambiale la hora», «dale que lo pienso» llegan como `confirmar` con `confirmar_accion`, y lo que decide si se ejecuta es el
// criterio del modelo. Para casi todo, ejecutar de más cuesta poco. Pero hay acciones con confirmación por chat que LE LLEGAN A
// OTRA PERSONA —un email y un WhatsApp al alumno, el aviso de Calendly o la invitación de Google al lead—: eso no se deshace.
//
// La red no es una lista más de palabras en el clasificador (docs/hallazgos-ia.md, «la red es la tarjeta, no la regla»): es una
// puerta de código en `confirmarPendiente` (lib/api-mako/acciones.ts) que sólo vale para las acciones marcadas `aTerceros`. Esas
// se confirman con un mensaje que es SÓLO una confirmación. Cualquier otra cosa —un «pero», un «esperá», un cambio, una
// pregunta— no confirma: MaKo repregunta mostrando de nuevo qué va a salir, y la pendiente sigue viva.
//
// PURO y sin `server-only`: lo importan lib/api-mako/acciones.ts y tests/confirmacion-terceros.test.ts.
// =============================================================================

const norm = (s: string): string => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Las palabras que SON la confirmación (sobre texto sin tildes). Con una de éstas alcanza; sola, «ok» o «perfecto» no: acusan recibo. */
const FUERTES: ReadonlySet<string> = new Set([
  'si', 'dale', 'mandalo', 'mandala', 'mandalos', 'mandalas', 'envialo', 'enviala', 'enviarlo', 'enviarla', 'confirmo', 'confirmado', 'confirmada',
  'hacelo', 'hacela', 'hazlo', 'hazla', 'adelante', 'deuna', 'agendalo', 'agendala', 'invitalo', 'invitala', 'confirma', 'confirmalo', 'confirmala', 'ejecutalo', 'ejecutala',
]);
/** Las que acompañan sin cambiar nada: cortesías y acuses. Sin una FUERTE, no confirman. */
const RELLENO: ReadonlySet<string> = new Set([
  'por', 'favor', 'porfa', 'gracias', 'ya', 'ok', 'okey', 'okay', 'listo', 'perfecto', 'genial', 'bueno', 'vale', 'entonces', 'mako',
]);
const MAX_PALABRAS = 6;

/**
 * ¿El mensaje es SÓLO una confirmación («sí», «dale, mandalo», «sí, hacelo por favor», «confirmo 👍»)? Sin un «pero», un «esperá», un cambio,
 * una pregunta ni ninguna palabra más. Ante la duda es falso: lo que no se reconoce no confirma, se repregunta.
 */

export function confirmacionPura(mensaje: string | null | undefined): boolean {
  // Un lote de mensajes seguidos lleva un encabezado nuestro y la numeración «(1) », «(2) » (lib/mako-doer-buffer.ts): no son palabras de la persona.
  let t = String(mensaje ?? '');
  if (/^\[Te mandó \d+ mensajes seguidos\./.test(t)) t = t.replace(/^\[[^\]]*\]\s*/, '').replace(/(^|\n)\(\d+\) /g, '$1');
  // Un NÚMERO es una palabra de más (22/10/2026, la revisión adversarial): «sí 17» contesta otra hora, «dale, $500» otro monto.
  const palabras = norm(t).replace(/\bde una\b/g, 'deuna').split(/[^a-z0-9]+/).filter(Boolean);
  if (!palabras.length || palabras.length > MAX_PALABRAS) return false;
  if (!palabras.every((w) => FUERTES.has(w) || RELLENO.has(w))) return false;
  return palabras.some((w) => FUERTES.has(w));
}

/**
 * ⚠️ EL WHATSAPP A UN LEAD SE APRUEBA CON UN TOQUE EN LA APP, NUNCA CON UN «SÍ» POR WHATSAPP (29/10/2026, el Cerebro con las
 * reglas de Martín, por la llamada con Thiago: «moveme la reunión y mandale un WhatsApp»). Desde el grupo, MaKo deja el mensaje
 * propuesto y el link a Pendientes; un «sí» escrito en el grupo —puro o no— no lo manda. Las demás de `aTerceros` (un email, una
 * invitación) siguen con el «sí» puro de arriba.
 */
export const SE_APRUEBAN_EN_LA_APP: ReadonlySet<string> = new Set(['enviar_borrador_whatsapp']);
/** Lo que le llega al modelo cuando le piden confirmarla por WhatsApp. */
export const rechazoApruebaEnLaApp = (titulo: string): string =>
  `«${titulo}» le llega a un lead y sale sólo cuando lo aprueban con un toque en la app (en Pendientes): un «sí» por WhatsApp no alcanza. NO la confirmes: dile en una línea que lo apruebe en la app; el link lo pone el código.`;

/**
 * ¿Le CONFIRMA algo a otra persona? Lo que `confirmacionPura` acepta («sí, hacelo», «dale, confirmalo», «sí, mandalo», «sí,
 * agendalo», «sí, confirmá») y «sí, confirmalo vos» / «sí, hacelo tú» (que le devuelve la acción a quien preguntó). Lo usa la
 * respuesta corta del lote (lib/doer-para-quien.ts, `esRespuestaCorta`): la verificación de 9cef25dba vio que sin los verbos, «sí,
 * hacelo» detrás de «@Pedro ¿lo confirmo?» entraba al turno y ejecutaba lo que le llega a un tercero. Vive acá porque nombra las
 * formas de vos (este archivo está fuera de la guarda de voseo).
 */
export function confirmaAOtro(mensaje: string | null | undefined): boolean {
  if (confirmacionPura(mensaje)) return true;
  const t = norm(String(mensaje ?? '')).trim();
  return /^(?:si|dale|ok)[\s,.!]+[a-z]+(?:lo|la|los|las)\s+(?:vos|tu)[\s.!]*$/.test(t);
}

/**
 * La puerta de las acciones que le llegan a un tercero. Devuelve el texto del rechazo —que le llega al modelo como el error de
 * `confirmar_accion`— o null si puede seguir. Sólo en WhatsApp (en la app la persona toca la tarjeta; por HTTP firma el token).
 */
export function rechazoSiNoEsConfirmacionPura(p: {
  canal: string; aTerceros: boolean | undefined; mensaje: string | null | undefined; titulo: string; resumen: string;
  /** Mueve plata (D2, `plata` del registro): la misma puerta, con su razón. */
  plata?: boolean | undefined;
  /** El grupo de WhatsApp: quién pidió la acción, quién confirma, y si el «sí» le habla a MaKo (`elSiEsDeQuienPidio`). */
  enElGrupo?: ElSiEnElGrupo;
  /** El id de la acción del registro: las de `SE_APRUEBAN_EN_LA_APP` no se confirman por WhatsApp con NINGÚN «sí». */
  id?: string;
  /** Se propuso en un turno SÓLO de la app (`SOLO_APP`): el grupo de WhatsApp nunca vio la pregunta. */
  nacioEnLaApp?: boolean;
  /** Este turno es entero de la app (un lote de varias personas no tiene quién: `confirma` viene null). */
  turnoDeLaApp?: boolean;
}): string | null {
  // ⚠️ UN «DALE» EN WHATSAPP NO CONFIRMA LO QUE SE PROPUSO SÓLO EN LA APP (3/11/2026). Ana pide en la app «mandale el mail a Pérez»; Pedro, en WhatsApp, le contesta «dale» a otra persona:
  // sin esto sale un mail que no se deshace, confirmado por alguien que nunca vio la pregunta. Va ANTES de todo y para cualquier acción, no sólo plata o terceros. Al revés no:
  // lo propuesto en WhatsApp se puede confirmar desde la app, que ve el grupo.
  if (p.canal === 'whatsapp' && p.nacioEnLaApp && !p.turnoDeLaApp && !/@app\.mako$/.test(p.enElGrupo?.confirma ?? '')) return lineaSeConfirmaEnLaApp(p.titulo);
  if (p.canal === 'whatsapp' && p.id && SE_APRUEBAN_EN_LA_APP.has(p.id)) return rechazoApruebaEnLaApp(p.titulo);
  if (p.canal !== 'whatsapp' || !(p.aTerceros || p.plata)) return null;
  if (!confirmacionPura(p.mensaje)) {
    if (!p.aTerceros) return `«${p.titulo}» mueve plata (un gasto, un monto) y no se toma a la ligera: sólo se confirma con un «sí» o un «dale» SOLO, sin nada más. El último mensaje trae algo más (o no es un sí claro), así que NO la confirmes: repregúntale al dueño mostrando de nuevo qué va a pasar —«${p.resumen}»— y que conteste «sí» si está bien. La pendiente sigue viva.`;
    return `«${p.titulo}» le llega a otra persona (un email, un WhatsApp o una invitación) y no se deshace: sólo se confirma con un «sí» o un «dale» SOLO, sin nada más. El último mensaje trae algo más (o no es un sí claro), así que NO la confirmes: repregúntale al dueño mostrando de nuevo qué va a salir —«${p.resumen}»— y que conteste «sí» si está bien. La pendiente sigue viva.`;
  }
  if (p.plata && p.enElGrupo && !elSiEsDeQuienPidio(p.enElGrupo)) return `«${p.titulo}» mueve plata, y en el grupo este «sí» no es de quien la pidió ni le habla a MaKo: puede ser la respuesta a otra persona. NO la confirmes. Contesta en una sola línea, exactamente: ${PIDE_EL_SI_A_MAKO} La pendiente sigue viva.`;
  return null;
}

/**
 * EL «SÍ» DE PLATA EN UN GRUPO (la verificación de 8cb034a18, decidido por el Cerebro el 28/10/2026). El lote junta sólo lo que
 * entra en 8 s (lib/mako-doer-buffer.ts): si Pedro contesta «sí» a «@Pedro ¿lo confirmo?» de Ana más tarde, el «sí» llega solo, y
 * un «sí» puro confirmaba la pendiente de plata. Ahora la confirma:
 *   · el «sí» de QUIEN LA PIDIÓ (el caso de casi siempre: el que pide, confirma);
 *   · un «sí» que le habla a MaKo, de cualquiera: «sí, MaKo», «@MaKo sí», o la respuesta CITADA a un mensaje de MaKo.
 * Otro «sí» no ejecuta: MaKo pide `PIDE_EL_SI_A_MAKO` y la pendiente sigue viva. Sin saber quién la pidió (una pendiente de antes,
 * un lote de varios), también. Lo que le llega a un tercero (`aTerceros`) queda afuera de esta primera versión.
 */
export type ElSiEnElGrupo = { pidio: string | null; confirma: string | null; aMaKo: boolean };
export function elSiEsDeQuienPidio(s: ElSiEnElGrupo): boolean {
  return s.aMaKo || (!!s.pidio && !!s.confirma && s.pidio === s.confirma);
}
/** Lo que MaKo contesta cuando el «sí» no alcanza. */
export const PIDE_EL_SI_A_MAKO = '¿Lo confirmo? Respóndeme «sí, MaKo» y lo hago.';

/** Quién escribe en el grupo, para comparar al que pidió con el que confirma: el `participant` sin el `:device`. */
export function quienEnElGrupo(participant: string | null | undefined): string | null {
  const p = (participant ?? '').trim().replace(/:\d+(?=@)/, '');
  return p || null;
}

/** Dónde guarda la pendiente quién la pidió: en su `payload` (jsonb, sin migración). No es un parámetro de la acción: se saca al
 *  leerla (lib/mako-pendientes.ts, `toP`), antes de mostrarla o ejecutarla. */
export const PIDIO = '__pidio';
/** Y si nació en un turno SÓLO de la app (`rechazoSiNoEsConfirmacionPura`). Como `__pidio`: no es un parámetro de la acción. */
export const SOLO_APP = '__soloApp';
/** Lo que le llega al modelo si se la quieren confirmar por WhatsApp. */
export const lineaSeConfirmaEnLaApp = (titulo: string): string =>
  `«${titulo}» se pidió en el grupo de la app, y por aquí nadie vio la pregunta: NO la confirmes. Dile en una línea que eso se confirma en el grupo de la app.`;
export function conQuienPidio(payload: Record<string, unknown>, pidio: string | null | undefined, soloApp?: boolean): Record<string, unknown> {
  return { ...payload, ...(pidio ? { [PIDIO]: pidio } : {}), ...(soloApp ? { [SOLO_APP]: true } : {}) };
}
export function sinQuienPidio(payload: Record<string, unknown>): { payload: Record<string, unknown>; pidio: string | null; soloApp?: boolean } {
  if (!(PIDIO in payload) && !(SOLO_APP in payload)) return { payload, pidio: null };
  const { [PIDIO]: pidio, [SOLO_APP]: soloApp, ...resto } = payload;
  return { payload: resto, pidio: typeof pidio === 'string' && pidio ? pidio : null, ...(soloApp === true ? { soloApp: true } : {}) };
}
