// =============================================================================
// Una transcripción que es un BUCLE no es una transcripción
// =============================================================================
// Medido el 08/10/2026 transcribiendo un audio de 26 minutos de feedback del curso (el tramo
// 0:00-7:00, 1,6 MB) con la cascada de siempre (`transcribirAudio` en lib/ai-cheap.ts). Gemini
// contestó HTTP 200 con `finishReason: STOP` y 3.492 caracteres, y el texto era esto:
//
//   «…ahí se crea también en cursos tus pues puedes seleccionar tu nuevo producto. Sin
//    embargo, eh 1 2 3 4 5 6 7 8 9 10 11 … 697 698 699»
//
// Un minuto de habla bien transcripta (805 caracteres) y después SEISCIENTOS NOVENTA Y NUEVE
// números (2.687 caracteres, el 77% del texto). Los seis minutos que seguían no estaban en
// ningún lado. La cascada lo tomó como un
// ÉXITO —un 200 con texto— y lo devolvió. Whisper (Groq), sobre el mismo tramo partido en tres,
// devolvió las tres partes bien. Por el log de esa corrida, el que contó fue el modelo de
// RESPALDO de Gemini (`gemini-flash-lite-latest`): `gemini-flash-latest` de esa cuenta acababa
// de contestar «HTTP 503 high demand» (inferido del orden de los intentos, no medido aparte).
//
// Es «`res.ok` no es "salió bien"» (AGENTS.md) del lado del CONTENIDO: el proveedor no avisa
// nada, el `finishReason` está limpio, y lo roto sólo se ve leyendo el texto. Y es la falla
// ESPEJO de la que ya tenía guarda: `finishReason` caza la transcripción CORTADA por el techo de
// salida; esto es la transcripción INFLADA por un decodificador que se quedó girando y que
// después terminó «bien».
//
// Dos firmas, las dos clásicas de un decodificador en bucle:
//
//   1. UNA CORRIDA DE ENTEROS CONSECUTIVOS («1 2 3 … 699»). Es la que se midió.
//   2. UN N-GRAMA REPETIDO SEGUIDO («gracias por ver el video. gracias por ver el video. …»),
//      la alucinación conocida de Whisper sobre silencio o música. Se mide como repetición en
//      TÁNDEM: el mismo bloque de n palabras, una vez detrás de la otra.
//
// Las dos se miden sobre PALABRAS normalizadas (minúsculas, sin la puntuación de los bordes), así
// «1, 2, 3.» y «Gracias. Gracias.» cuentan igual que sin comas.
//
// ⚠️ LOS UMBRALES ESTÁN MEDIDOS, NO ELEGIDOS («Un umbral es un proxy», AGENTS.md). Se corrieron
// contra las 9.719 transcripciones reales de public/cono-tx (402.658 textos contando cada
// párrafo suelto) y contra el mismo tramo transcripto bien por Whisper. Los números, lo que cae y
// por qué, están en tests/stt-degenerado.test.ts, que es donde se vuelven a medir.
//
// Puro y sin `server-only`, a propósito: lo importa `transcribirAudio` y lo ejecuta un test.
// =============================================================================

/** Una palabra del texto, ya normalizada, y dónde empieza en el texto ORIGINAL. */
type Palabra = { t: string; ini: number };

const BORDES = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

function palabras(texto: string): Palabra[] {
  const out: Palabra[] = [];
  for (const m of texto.matchAll(/\S+/g)) {
    const t = m[0].toLowerCase().replace(BORDES, '');
    if (t) out.push({ t, ini: m.index ?? 0 });
  }
  return out;
}

/**
 * LOS UMBRALES. Cada uno con lo que se midió al elegirlo (08/10/2026, public/cono-tx):
 *
 * `conteo`: la corrida de enteros consecutivos más larga de las 9.719 transcripciones es de 32
 *   (y ésa misma es sospechosa: «3, 5, 6, … 36, claro» en el medio de una llamada de ventas). Las
 *   cuentas de verdad llegan a 20: una clase de respiración que cuenta «1, 2, … 20», alguien que
 *   cuenta 16 productos en pantalla. Con 50 queda más del doble de aire sobre lo legítimo, y el
 *   bucle medido tenía 699. Va SIN fracción a propósito: nadie cuenta hasta 50 en voz alta, así
 *   que un conteo así es basura aunque el resto del texto sea bueno — y en Gemini, que escucha el
 *   audio entero de una vez, lo que viene después del bucle es habla PERDIDA.
 *
 * `repeticion`: las tres condiciones juntas.
 *   · `veces` ≥ 8: los ejercicios de pronunciación de los cursos de idiomas repiten la frase
 *     4 o 5 veces («I don't think I can», ×4) y no pueden caer. Un bucle de Whisper anda en
 *     12-85 («Thank you» ×85, «la posibilidad de que» ×19).
 *   · `cubre` ≥ 30 palabras: «sí, sí, sí, sí» en una nota de voz es una respuesta, no un bucle.
 *   · `fraccion` ≥ 0,3: el bucle tiene que ser una parte GRANDE del texto. Un «Thank you» ×85
 *     sobre el silencio del final de una reunión de 7.400 palabras (2%) no se lleva nada: lo que
 *     había que transcribir está antes. Tirar esa transcripción por eso deja al cliente sin nada
 *     si no hay otro proveedor. Con la fracción, de las 9.719 transcripciones enteras cae UNA, y
 *     es un acierto: un archivo que es 100% «Thank you. Thank you.» sobre un video sin voz.
 *     Y de los 392.939 párrafos sueltos (el largo de una nota de voz) caen 51: 48 son bucles de
 *     verdad («me ha tocado» ×19, «la posibilidad de que» ×19) y 3 no — una canción («La, la,
 *     la» ×36) y dos dudosos con ×8 justo en el borde (un estribillo, «me voy a bañar»).
 */
export const UMBRAL_DEGENERADO = {
  conteo: 50,
  repeticion: { veces: 8, cubre: 30, fraccion: 0.3 },
} as const;

export type MedidaDegeneracion = {
  palabras: number;
  /** La corrida más larga de enteros consecutivos (n, n+1, n+2…). `desde`: carácter donde empieza. */
  conteo: { largo: number; primero: number; ultimo: number; desde: number };
  /** La repetición en tándem que más palabras tapa: `n` palabras repetidas `veces` seguidas. */
  repeticion: { n: number; veces: number; cubre: number; fraccion: number; desde: number; muestra: string };
};

/** Hasta qué largo de frase se buscan repeticiones. Las de los bucles medidos andan en 1-11. */
const N_MAX = 24;

/** Las dos medidas crudas, sin veredicto. La usa el test para recalibrar. */
export function medirDegeneracion(texto: string): MedidaDegeneracion {
  const ps = palabras(texto);
  const N = ps.length;

  // ── 1. La corrida de enteros consecutivos ──
  let conteo = { largo: 0, primero: 0, ultimo: 0, desde: 0 };
  let ini = -1, largo = 0, prev = NaN;
  for (let i = 0; i < N; i++) {
    const t = ps[i].t;
    const v = /^\d{1,7}$/.test(t) ? Number(t) : NaN;
    if (Number.isNaN(v)) { ini = -1; largo = 0; prev = NaN; continue; }
    if (largo > 0 && v === prev + 1) largo++;
    else { ini = i; largo = 1; }
    prev = v;
    if (largo > conteo.largo) conteo = { largo, primero: Number(ps[ini].t), ultimo: v, desde: ps[ini].ini };
  }

  // ── 2. La repetición en tándem ──
  // Para cada período n, `corrida` cuenta cuántas palabras seguidas son iguales a la que está n
  // lugares antes. Una corrida de L sobre el período n es un bloque de n palabras que se repite y
  // tapa L + n palabras. Es O(palabras × N_MAX) y sin estructuras: una clase de 52 minutos
  // (~7.000 palabras) son ~170.000 comparaciones.
  let rep = { n: 0, veces: 0, cubre: 0, fraccion: 0, desde: 0, muestra: '' };
  for (let n = 1; n <= Math.min(N_MAX, Math.floor(N / 2)); n++) {
    let corrida = 0;
    for (let i = n; i < N; i++) {
      if (ps[i].t === ps[i - n].t) corrida++;
      else corrida = 0;
      const cubre = corrida + n;
      // Cuenta sólo si el bloque aparece entero al menos DOS veces. Con `>` estricto, entre un
      // período y sus múltiplos (que tapan lo mismo) queda el más chico, que es el de verdad.
      if (corrida >= n && cubre > rep.cubre) {
        const d = i - corrida - n + 1;
        rep = {
          n, veces: Math.floor(cubre / n), cubre, fraccion: cubre / N,
          desde: ps[d].ini, muestra: ps.slice(d, d + n).map((p) => p.t).join(' '),
        };
      }
    }
  }
  return { palabras: N, conteo, repeticion: rep };
}

export type SalidaDegenerada = {
  /**
   * Lo que va a la lista de errores de la cascada. ⚠️ SIN NÚMEROS Y SIN LA FRASE, a propósito:
   * esa lista la lee `causaDelFallo` (lib/fallo-ia-texto.ts) con regex, y un conteo «1…429» o
   * «…503», o una frase en inglés que diga «insufficient» o «quota», haría que el bucle se leyera
   * como cuota agotada o proveedor saturado — y el cliente leería un texto que no le pasó.
   */
  motivo: string;
  /** Con los números y la muestra: para el log, que nadie clasifica con regex. */
  detalle: string;
  /** El carácter donde empieza el bucle. Lo de antes es habla bien transcripta. */
  desde: number;
};

/**
 * ¿Esto es una transcripción, o el bucle de un decodificador? `null` = es una transcripción.
 *
 * ⚠️ El veredicto NO recorta. Lo de antes del bucle está bien transcripto y aun así no se
 * devuelve: en el caso medido era un minuto de siete, y media transcripción se lee igual que una
 * completa (es la misma regla que el chequeo de `finishReason` en lib/ai-cheap.ts). Quien llama
 * prueba el proveedor que sigue, y si no queda ninguno, falla a la vista.
 */
export function salidaDegenerada(texto: string): SalidaDegenerada | null {
  if (!texto) return null;
  const m = medirDegeneracion(texto);
  const U = UMBRAL_DEGENERADO;
  if (m.conteo.largo >= U.conteo) {
    return {
      motivo: 'salida degenerada: la transcripción terminó en un conteo de números en bucle',
      detalle: `un conteo de ${m.conteo.largo} números seguidos (${m.conteo.primero}…${m.conteo.ultimo}) desde el carácter ${m.conteo.desde} de ${texto.length}`,
      desde: m.conteo.desde,
    };
  }
  const r = m.repeticion;
  if (r.veces >= U.repeticion.veces && r.cubre >= U.repeticion.cubre && r.fraccion >= U.repeticion.fraccion) {
    return {
      motivo: 'salida degenerada: la transcripción repite la misma frase en bucle',
      detalle: `«${r.muestra.slice(0, 80)}» repetido ${r.veces} veces seguidas (${Math.round(r.fraccion * 100)}% de las palabras) desde el carácter ${r.desde} de ${texto.length}`,
      desde: r.desde,
    };
  }
  return null;
}
