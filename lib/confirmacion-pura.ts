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
  const palabras = norm(t).replace(/\bde una\b/g, 'deuna').split(/[^a-z]+/).filter(Boolean);
  if (!palabras.length || palabras.length > MAX_PALABRAS) return false;
  if (!palabras.every((w) => FUERTES.has(w) || RELLENO.has(w))) return false;
  return palabras.some((w) => FUERTES.has(w));
}

/**
 * La puerta de las acciones que le llegan a un tercero. Devuelve el texto del rechazo —que le llega al modelo como el error de
 * `confirmar_accion`— o null si puede seguir. Sólo en WhatsApp (en la app la persona toca la tarjeta; por HTTP firma el token).
 */
export function rechazoSiNoEsConfirmacionPura(p: {
  canal: string; aTerceros: boolean | undefined; mensaje: string | null | undefined; titulo: string; resumen: string;
}): string | null {
  if (p.canal !== 'whatsapp' || !p.aTerceros) return null;
  if (confirmacionPura(p.mensaje)) return null;
  return `«${p.titulo}» le llega a otra persona (un email, un WhatsApp o una invitación) y no se deshace: sólo se confirma con un «sí» o un «dale» SOLO, sin nada más. El último mensaje trae algo más (o no es un sí claro), así que NO la confirmes: repregúntale al dueño mostrando de nuevo qué va a salir —«${p.resumen}»— y que conteste «sí» si está bien. La pendiente sigue viva.`;
}
