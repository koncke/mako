// =============================================================================
// El esqueleto de un prompt de formato — lo que ya sabemos, en un molde
// =============================================================================
// SIN `server-only`: es armado de texto y necesita test. Lo que decide si el
// avatar sale pareciéndose a la persona no puede quedarse sin red.
//
// ── De dónde sale este molde ───────────────────────────────────────────────
// Del prompt de Car Talks, que Martín escribió probando contra Flow hasta que el
// clip salió bien. Leído de cerca, ese prompt tiene SIETE bloques y sólo tres
// hablan del auto:
//
//   1. IDENTIDAD      «mantén a la persona totalmente inalterada»   ← genérico
//   2. LA ESCENA      «dentro de un coche, mientras conduce…»       ← del lugar
//   3. EXPOSICIÓN     «la cámara mide sobre su rostro»              ← genérico
//   4. LUZ            «la única luz viene del parabrisas»           ← del lugar
//   5. FONDO          «la vista exterior sobreexpuesta»             ← del lugar
//   6. ENFOQUE        «sólo su rostro y torso están nítidos»        ← genérico
//   7. LOS OBJETOS    «común y con señales de uso»                  ← del lugar
//
// Los cuatro genéricos son los que hacen que la foto parezca real y que la cara
// sea la de la persona: no cambian de un formato a otro, y son justo los que un
// modelo escribiendo desde cero se olvida. Se ponen acá, escritos una vez.
//
// Lo que sí cambia por formato son los tres del lugar, y ésos salen de mirar el
// video de referencia.
//
// ── Por qué NO se le pide el prompt entero a un modelo ─────────────────────
// Ya se probó y por eso existen `PROMPT_IMAGEN` y `PROMPT_VIDEO`: el prompt que
// escribía el modelo reinventaba la escena desde cero, describía la cara —que es
// la regla que más caro se paga romper— y perdía el tratamiento fotográfico. Un
// molde con huecos acota lo que el modelo puede arruinar a los tres bloques que
// de verdad son del formato.

/** Los tres bloques que cambian de un formato a otro. */
export type LugarDelFormato = {
  /** Dónde se filma y qué hace la persona. Una frase. */
  escena: string;
  /** De dónde viene la luz. Una frase. */
  luz: string;
  /** Qué se ve detrás, y cómo. Una frase. */
  fondo: string;
  /** Los objetos del lugar y su estado. Una frase. */
  objetos: string;
};

/**
 * ⚠️ LA REGLA QUE MÁS CARO SE PAGA ROMPER, y por eso está PRIMERO y es fija.
 *
 * Si el prompt describe la cara, el modelo prefiere el texto por sobre la foto
 * de referencia y devuelve a alguien que cumple la descripción sin ser la
 * persona. No es un parecido malo: es otra persona, con el nombre y la marca del
 * cliente encima.
 */
const IDENTIDAD =
  'Mantén a la persona totalmente inalterada: mismo rostro, mismos rasgos, misma '
  + 'piel, mismo cabello, mismas gafas, misma sonrisa, misma ropa.';

/**
 * Cómo mide la cámara. Genérico: es lo que hace que la cara se vea.
 *
 * Sin esto el modelo expone para el fondo y deja a la persona en sombra — y una
 * cara en sombra no se lee como una decisión de estilo, se lee como un video
 * mal hecho.
 */
const EXPOSICION =
  'EXPOSICIÓN. La cámara mide la exposición basándose en su rostro. Su cara y su torso '
  + 'permanecen claramente visibles y bien iluminados, con una exposición correcta. Todo lo '
  + 'que no está orientado hacia la luz aparece entre uno y dos pasos más oscuro que él: con '
  + 'menos luz, pero aún legible; nunca negro ni con los detalles perdidos en la sombra.';

/** Qué está nítido. Genérico: es lo que hace que parezca un teléfono y no un render. */
const ENFOQUE =
  'ENFOQUE. Solo su rostro y su torso están nítidos. Todo lo demás queda progresivamente '
  + 'desenfocado, de manera suave y natural, tal como lo haría el objetivo de un teléfono a '
  + 'esta distancia.';

/**
 * El prompt de IMAGEN del formato, armado del molde.
 *
 * El orden no es libre: la identidad va primera porque es la instrucción que no
 * se puede perder, y el resto va de lo general a lo particular.
 */
export function promptImagenDeFormato(l: LugarDelFormato): string {
  return [
    IDENTIDAD,
    `Cambia únicamente la forma en que se fotografía la escena para que parezca una foto real tomada con un teléfono ${l.escena.trim()}`,
    EXPOSICION,
    `DIRECCIÓN DE LA LUZ. ${l.luz.trim()}`,
    `EL FONDO. ${l.fondo.trim()}`,
    ENFOQUE,
    `EL LUGAR. ${l.objetos.trim()}`,
  ].join('\n\n');
}

/**
 * El prompt de VIDEO del formato.
 *
 * ⚠️ EL HUECO `{{voz}}` NO ES OPCIONAL, y `promptDeClip` descarta la plantilla
 * que no lo traiga. Un prompt de video sin la línea que la persona dice no
 * produce un clip mudo: produce uno donde el modelo INVENTA qué decir. Sale un
 * video plausible que dice otra cosa, y eso no se detecta mirando por encima.
 *
 * Y describe QUÉ HACE la persona, no rehace la escena: el clip sale de una
 * imagen de referencia que ya tiene el lugar, la luz y la cara resueltos.
 * Redescribirlos ahí es darle al modelo dos fuentes para lo mismo.
 */
export function promptVideoDeFormato(movimiento: string): string {
  return `Esta persona dice: "{{voz}}", ${movimiento.trim()} Todo natural.`;
}

/**
 * ¿El prompt que quedó es usable? Devuelve el motivo por el que no, o `null`.
 *
 * ⚠️ ES LA SEGUNDA CAPA, y la regla de la casa exige las dos: el texto en el
 * prompt para que el modelo acierte, y una validación determinista para cuando
 * no acierte. Sin esto, «no describas la cara» es una expresión de deseo.
 */
export function porQueNoSirveElPrompt(imagen: string, video: string): string | null {
  if (!video.includes('{{voz}}')) {
    return 'Al prompt del video le falta dónde va lo que la persona dice.';
  }
  // ⚠️ La cara. Se mira el bloque del LUGAR, no el prompt entero: la identidad
  // fija nombra el rostro a propósito —para pedir que NO se cambie— y buscarla
  // en todo el texto daría un falso positivo siempre.
  // ⚠️ SE MIRA LO QUE ESCRIBIÓ EL MODELO, NO EL PROMPT ARMADO — y lo aprendí
  // rompiéndolo. Los TRES bloques fijos nombran la cara a propósito: la identidad
  // pide que NO se cambie el rostro, y la exposición dice que la cámara «mide
  // basándose en su rostro» y que «su cara permanece visible». Buscando las
  // palabras en el texto completo, la guarda marcaba como malo a TODO prompt
  // —incluido el de Car Talks, que es el que la inspiró—. Y una guarda que
  // rechaza todo se apaga a la semana.
  const delLugar = [IDENTIDAD, EXPOSICION, ENFOQUE].reduce((t, fijo) => t.replace(fijo, ''), imagen);
  const cara = PALABRAS_DE_CARA.filter((p) => new RegExp(`(?<!\\p{L})${p}(?!\\p{L})`, 'iu').test(delLugar));
  if (cara.length) {
    return `El prompt describe a la persona (${cara.join(', ')}). Eso compite con su foto y hace que salga otra cara.`;
  }
  if (imagen.trim().length < 200) {
    return 'El prompt de la imagen quedó demasiado corto para describir un lugar.';
  }
  return null;
}

/**
 * Las palabras que no pueden aparecer describiendo a la persona.
 *
 * ⚠️ LA LISTA LARGA NO FUNCIONABA, Y LO MIDIÓ EL TEST DE CALIBRE.
 *
 * La primera versión tenía 25 palabras —rostro, cara, piel, ojos, alto, bajo…— y
 * al correrla contra el ÚNICO prompt real que existe, el de Car Talks, dio
 * **10 coincidencias y las 10 falsas**:
 *
 *     rostro  ×5   «la cámara mide la exposición basándose en su rostro»
 *     cara    ×2   «sin dejar la mitad de la cara a oscuras»
 *     bajo    ×2   «imagen lavada, de bajo contraste»
 *     piel    ×1   «mismo rostro, mismos rasgos, misma piel» (la identidad)
 *
 * Cero verdaderos positivos. Y tiene sentido: un prompt de fotografía habla de
 * la cara todo el tiempo —dónde cae la luz, qué está enfocado, qué no queda en
 * sombra— sin describirla ni una vez. La diferencia no está en la palabra sino
 * en su papel: «el rostro está iluminado» dice dónde cae la luz, «de rostro
 * anguloso» describe a alguien. Una lista de palabras no distingue eso.
 *
 * Así que quedan sólo las que NO tienen uso legítimo en un prompt de foto. Es
 * una red para lo obvio, no una prueba — y la protección de verdad sigue siendo
 * el bloque de identidad, que le dice al modelo que no cambie a la persona.
 *
 * Es la regla de la casa: antes de shippear un umbral, corrélo contra los datos
 * que ya tenés y contá los falsos positivos. Son diez minutos.
 *
 * ⚠️ Y LOS LÍMITES VAN POR UNICODE (`\p{L}`), NO POR `\b`. El `\b` de JavaScript
 * es ASCII incluso con el flag `u`: en «años» no hay borde entre la `ñ` y la
 * `o`. Con `\b` este detector daría cero coincidencias sobre justo las palabras
 * que quedaron.
 */
const PALABRAS_DE_CARA = [
  'barba', 'bigote', 'patilla', 'patillas', 'calv[oa]', 'canos[oa]',
  'rubi[oa]', 'moren[oa]', 'pelirroj[oa]', 'pecas', 'arrugas', 'lunar',
  'años', 'joven', 'anciano', 'guapo', 'atractiv[oa]', 'delgad[oa]', 'gord[oa]',
];
