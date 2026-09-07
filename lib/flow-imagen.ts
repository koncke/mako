// =============================================================================
// flow-imagen — el pedido de IMAGEN que Flow hace de verdad
// =============================================================================
// SIN `server-only`: es armado de un objeto y necesita test.
//
// ── Por qué existe: el orden es IMAGEN → VIDEO ─────────────────────────────
// El primer clip que el generador produjo de punta a punta salió con el ángulo
// equivocado y sin parecerse a la persona. La causa no fue el prompt: fue el
// ORDEN. Se animaba sobre la nada. El proceso real, el que produjo los cuatro
// anuncios que sí funcionaron, fija primero la imagen del escenario.
//
// ── ⚠️ EL ESQUEMA NO ALCANZÓ, Y ESTO COSTÓ UN 400 ──────────────────────────
// La primera versión de este archivo mandaba `{ userInput: { prompts, seed, … } }`,
// leído del bundle. Google contestó:
//
//     HTTP 400 · Invalid JSON payload received.
//     Unknown name "userInput": Cannot find field.
//
// El esquema existía, era real, y era de OTRO mensaje: el bundle define varias
// formas parecidas y elegir por parecido es adivinar con pasos extra. Lo que
// decide es el CALL SITE — quién construye el objeto que se serializa. Medido ahí,
// el cuerpo verdadero resultó ser casi gemelo del de video:
//
//   {
//     clientContext, mediaGenerationContext: { batchId }, useNewMedia: true,
//     requests: [{
//       clientContext, imageModelName, imageAspectRatio, structuredPrompt, seed,
//       imageInputs: [{ imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE', name }],
//       requestContext, referenceEntities?, referenceLikenesses?,
//     }]
//   }
//
// La regla que queda: **un esquema dice qué campos EXISTEN; sólo el call site dice
// cuáles van en ESTE pedido.** Cuando hay varios mensajes con la misma forma, el
// esquema no desempata — y este proyecto ya tenía escrito que si hay que
// desempatar, todavía estás adivinando.
//
// ── Por qué esto se manda como PARCHES y no como cuerpo ────────────────────
// `fundir()` del espejo reemplaza los arrays enteros, a propósito. Para el clip
// alcanzaba con mandar `requests` completo porque sabíamos armarlo. Acá NO:
// adentro de `requests[0]` conviven lo que decidimos nosotros —el prompt, la
// semilla— con lo que **sólo sabe la plantilla**: `imageModelName`, que es el
// modelo de imagen que Flow eligió, y los `imageInputs`, que traen la cara.
//
// Mandar el array a medias pierde el modelo y la cara. Mandarlo entero exige
// inventar los dos, que es exactamente lo que el espejo existe para no hacer. Por
// eso se manda un PARCHE POR CAMINO: se copia todo el pedido de Flow y se cambia
// sólo la hoja. Es el espejo llevado un paso más adentro.

import { semillaDeToma } from './flow-clip-referencias';
import { PROMPT_IMAGEN } from './prompts-imagen';

export { semillaDeToma };

/** Vertical: son anuncios para el feed. El mismo formato que el clip. */
export const ASPECTO_VERTICAL = 'IMAGE_ASPECT_RATIO_PORTRAIT';

export type PedidoImagenEscena = {
  /** La composición: dónde está, con qué luz, desde qué ángulo. Nunca la cara. */
  prompt: string;
  /**
   * El formato. Si tiene prompt PROPIO, ése manda y el de arriba no se usa.
   *
   * No es una preferencia: el prompt del formato no describe un lugar, describe
   * cómo se FOTOGRAFÍA —exposición medida en la cara, ventanillas quemadas,
   * profundidad de campo de teléfono— y eso es lo que un modelo de texto no
   * puede escribir bien porque no vio la imagen que salió mal.
   */
  puestaId?: string;
  /** El prompt que la persona escribió a mano. Gana sobre todo lo demás. */
  propio?: string;
  seed: number;
  /** El lote. Va uno por escena, como el `batchId` del clip. */
  batchId: string;
  /**
   * El `mediaId` de la cara elegida dentro de Flow, si hay una.
   *
   * ⚠️ Sólo se manda cuando el SERVIDOR verificó que la plantilla ya trae un
   * `imageInputs[0]`. `parchar` INVENTA el tramo que falta: sobre una plantilla
   * sin ese array crearía `[{ name }]` sin su `imageInputType`, devolvería éxito,
   * y saldría un cuerpo mal formado construido por nosotros — sin `PARCHE_FALLO`
   * y sin nada que lo delate. Es exactamente lo que el espejo existe para no
   * hacer.
   */
  cara?: string;
};

/**
 * Los parches que se aplican sobre el pedido que Flow hizo de verdad.
 *
 * Las claves son CAMINOS dentro del cuerpo copiado. Todo lo que no está acá se
 * conserva de la plantilla: el modelo, la cara, el `clientContext`, el
 * `requestContext` y lo que Google agregue mañana sin avisar.
 *
 * ⚠️ `imageInputs` se parchea SÓLO si la persona eligió una cara y el servidor
 * comprobó que la plantilla ya tiene ese array. Sin eso, la cara sale de la
 * plantilla —de la imagen que
 * la persona generó a mano con su foto— y por eso es la misma cara que ya usa el
 * paso de video. El día que haga falta cambiarla, se parchea ese camino con la
 * forma medida: `{ imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE', name: <id> }`.
 */
/**
 * LO QUE EL MÉTODO VALIDADO PONE Y NUESTRO PROMPT NO PONÍA.
 *
 * ⚠️ POR CÓDIGO Y NO EN EL PROMPT DEL MODELO, por dos razones que se suman:
 *
 *  1. Es CONSTANTE. No depende de la escena, así que pedírselo al modelo en cada
 *     llamada es pagar tokens para que reescriba —peor— algo que ya está escrito.
 *  2. NUESTRO PROPIO GUARD LO RECHAZA. `mencionaCara()` prohíbe `facial` y
 *     `freckles` para que el modelo no invente una persona, y este bloque los usa
 *     para lo contrario: para pedir que RESPETE la de la foto. Es la misma trampa
 *     ya cosechada («el vocabulario de una instrucción y el de su guard son el
 *     mismo vocabulario»), y la salida no es abrir el guard: es que este texto no
 *     pase por él, porque no lo escribe el modelo.
 *
 * De dónde sale cada línea, todas verificadas en su fuente:
 *  · IDENTIDAD  → `docs/guia-produccion-mauricio.md`, el bloqueo de identidad.
 *    Adaptado a UNA referencia: el original habla de dos imágenes y nosotros
 *    mandamos sólo la cara.
 *  · LUZ        → `lib/curso-avatar.ts`, el ANTÍDOTO del C5 del método 6C.
 *    El C5 por defecto pide «direct harsh iPhone flash» y sirve para nocturno o
 *    fiesta; para interior, auto o luz natural —que es todo lo que filmamos— el
 *    curso manda esta otra línea. Usar el C5 crudo es lo que quema los altos.
 *  · REALISMO   → el cierre del 6C (`app/conocimientos/curso-ugc-recursos.ts`).
 */
const IDENTIDAD =
  'The reference image is provided ONLY as an identity reference: match the subject\'s '
  + 'facial features, proportions, physical traits and clothing exactly. Do NOT copy its '
  + 'background, framing or pose — those come from the description above.';

const LUZ =
  'Natural iPhone photo with soft ambient daylight, no dramatic flash, low contrast, '
  + 'muted tones, slight grain, authentic smartphone exposure, realistic shadows, '
  + 'candid UGC vibe.';

const REALISMO =
  'Realistic skin with visible pores, freckles, subtle blemishes, natural texture, and '
  + 'small imperfections. Natural anatomy, realistic hands, believable proportions, '
  + 'consistent facial identity, accurate clothing folds, realistic reflections, and '
  + 'authentic iPhone exposure. No text, no watermark, no distortion.';

/**
 * El prompt que se manda de verdad: el de la escena + el método.
 *
 * Sin `server-only` y exportada a propósito: es lo único que un test puede mirar
 * para saber qué se está pidiendo. Un prompt que sólo existe adentro del que lo
 * manda es un prompt que nadie puede revisar.
 */
/**
 * ¿La dirección firmada de una imagen de Flow ya venció?
 *
 * ⚠️ Las urls de Flow vienen firmadas con `Expires` y duran ~6 h. La tira de
 * variantes las conserva para siempre —que es lo correcto: son las versiones que
 * la persona puede querer recuperar— así que al día siguiente esas miniaturas se
 * dibujan ROTAS. Y una imagen rota no se lee como «venció el enlace»: se lee como
 * que la app perdió el archivo.
 *
 * Lo que NO vence es el `mediaId`, que es con lo que se filma. O sea que el clip
 * sigue saliendo bien: lo único perdido es poder MIRAR la variante vieja.
 *
 * Sin `Expires` se considera vigente: no saber cuándo vence no es saber que
 * venció.
 */
export function urlDeFlowVencida(url: string, ahora = Date.now()): boolean {
  const m = /[?&]Expires=(\d+)/.exec(url || '');
  if (!m) return false;
  return Number(m[1]) * 1000 < ahora;
}

export function promptFinal(
  escena: string,
  opts: {
    conCara: boolean;
    puestaId?: string;
    /**
     * Lo que la persona escribió a mano para ESTA escena.
     *
     * ⚠️ GANA SOBRE TODO, incluso sobre el prompt validado del formato — la misma
     * precedencia que en el video, y por la misma razón: alguien que abrió el
     * prompt, lo leyó y lo cambió sabe algo de esta escena que ninguna plantilla
     * puede saber. Si el sistema le pisara el texto, el paso de editarlo sería un
     * formulario decorativo.
     */
    propio?: string;
    /**
     * El prompt validado de un formato que creó el CLIENTE.
     *
     * ⚠️ ENTRA POR PARÁMETRO Y NO POR `PROMPT_IMAGEN`, y no es un detalle de
     * estilo: ese mapa es una constante de código, y los formatos del cliente
     * viven en la base, por workspace. Buscarlos acá obligaría a este módulo
     * —que es puro y testeable— a leer la base y a saber de qué workspace es
     * quien pregunta.
     *
     * Ocupa exactamente el lugar del prompt de fábrica en la precedencia: abajo
     * de lo que la persona escribió a mano, arriba del bloque genérico.
     */
    plantilla?: string;
  },
): string {
  const aMano = (opts.propio ?? '').trim();
  if (aMano) return aMano;

  // ⚠️ EL PROMPT DEL FORMATO GANA, ENTERO. No se le concatena nada: ya trae su
  // propia identidad («mantén a la persona totalmente inalterada»), su propia luz
  // y su propio negativo. Pegarle además el bloque genérico sería darle dos
  // instrucciones para lo mismo, y el modelo elige — que es exactamente el modo
  // de falla que este prompt vino a cerrar.
  const propio = opts.puestaId ? PROMPT_IMAGEN[opts.puestaId] : undefined;
  if (propio) return propio;

  // El del formato del cliente, con la MISMA regla: gana entero y no se le
  // concatena nada. Va después del de fábrica porque un id de fábrica nunca
  // llega con plantilla —son fuentes distintas— y el orden deja explícito cuál
  // manda si algún día se cruzaran.
  const delCliente = (opts.plantilla ?? '').trim();
  if (delCliente) return delCliente;

  return [escena.trim(), opts.conCara ? IDENTIDAD : '', LUZ, REALISMO]
    .filter(Boolean)
    .join('\n\n');
}

export function parchesImagenEscena(p: PedidoImagenEscena): Record<string, unknown> {
  return {
    // El prompt viaja igual que en el clip: partes de texto, no un string suelto.
    // ⚠️ Y va el prompt FINAL, no el que escribió el modelo: la identidad, la luz
    // y el realismo los pone el código. Antes se mandaba `p.prompt` pelado —40 a
    // 70 palabras de composición y nada más— y el resultado era una persona
    // parecida a nadie, con otra ropa y con la luz que el modelo quisiera.
    'requests.0.structuredPrompt': { parts: [{ text: promptFinal(p.prompt, { conCara: !!p.cara, puestaId: p.puestaId, propio: p.propio }) }] },
    // ⚠️ LA CARA, cuando la persona eligió una. MEDIDO: en el pedido real vive en
    // `requests[0].imageInputs[0].name`, al lado de un `imageInputType` que NO se
    // toca — por eso va por parche y no por cuerpo: `fundir` reemplazaría el array
    // entero y se llevaría ese campo puesto.
    //
    // Sin `cara` no se escribe nada y la plantilla manda, que es como funcionaba
    // antes: la foto que la persona ya tenía en Flow.
    ...(p.cara ? { 'requests.0.imageInputs.0.name': p.cara } : {}),
    // La semilla explícita: reintentar la misma escena tiene que dar la misma
    // imagen, o «cambié el prompt y salió distinto» sería indistinguible de
    // «salió distinto porque sí».
    'requests.0.seed': p.seed,
    'requests.0.imageAspectRatio': ASPECTO_VERTICAL,
    // El lote propio, para que nuestras imágenes no se mezclen con las que la
    // persona genera a mano en la misma sesión.
    'mediaGenerationContext.batchId': p.batchId,
  };
}

/**
 * Las imágenes que devolvió Flow.
 *
 * La respuesta viene anidada y el campo que trae el archivo cambió de nombre
 * entre versiones del contrato. Por eso se buscan varios y se devuelve lo que
 * haya, en vez de exigir uno: un campo que cambia de nombre no puede dejar la
 * pantalla en blanco.
 */
export function imagenesDeRespuesta(data: unknown): { url: string; mediaId?: string }[] {
  const out: { url: string; mediaId?: string }[] = [];
  const vistos = new Set<unknown>();

  // Búsqueda recursiva en vez de un camino fijo: la respuesta de este endpoint
  // todavía no se midió con una corrida real, y un camino fijo que no acierta
  // devuelve cero imágenes con la misma cara que «Flow no generó nada».
  const recorrer = (v: unknown) => {
    // ⚠️ EL FLOW NUEVO (BOQ) CONTESTA UN ARRAY POSICIONAL, SIN NOMBRES DE CAMPO.
    //
    // Medido el 07/09/2026 con la primera imagen real generada por el replay
    // (trabajo #670): la url firmada viaja como un string suelto dentro del
    // anidado —`https://flow-content.google/image/<mediaId>?Expires=…&Signature=…`—
    // y el `mediaId` es el uuid del path. La búsqueda por nombre de campo de abajo
    // no la veía, y la pantalla decía «Flow aceptó el pedido y no devolvió ninguna
    // imagen» sobre una imagen que ya estaba en la grilla de Flow.
    //
    // ⚠️ La url firmada VENCE (`Expires`, ~1 h). Alcanza para confirmarla en
    // pantalla; para volver a mostrarla más tarde hay que pedir un enlace fresco
    // por `mediaId` (el mismo camino que ya usan los clips).
    if (typeof v === 'string') {
      const m = /^https:\/\/[^\s"'<>]+\/image\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[?#/]|$)/i.exec(v);
      if (m && !out.some((x) => x.url === v)) out.push({ url: v, mediaId: m[1] });
      return;
    }
    if (!v || typeof v !== 'object' || vistos.has(v)) return;
    vistos.add(v);
    if (Array.isArray(v)) { v.forEach(recorrer); return; }

    const o = v as Record<string, unknown>;
    const url = [o.fifeUrl, o.fifeUri, o.servingBaseUri, o.uri, o.url]
      .find((x) => typeof x === 'string' && /^https?:\/\//.test(x));
    const bytes = [o.encodedImage, o.rawImageBytes].find((x) => typeof x === 'string' && x.length > 100);
    const mediaId = [o.mediaId, o.mediaGenerationId, o.name]
      .find((x) => typeof x === 'string' && x) as string | undefined;

    if (typeof url === 'string') out.push({ url, mediaId });
    // Cuando viene el binario y no una URL, se sirve como data: URI. No es lo
    // ideal —pesa en el historial— pero una imagen que no se puede mirar no se
    // puede confirmar, y confirmarla es todo el paso.
    else if (typeof bytes === 'string') out.push({ url: `data:image/png;base64,${bytes}`, mediaId });

    Object.values(o).forEach(recorrer);
  };
  recorrer(data);
  return out;
}

/**
 * Una semilla estable por escenario.
 *
 * ⚠️ El multiplicador es 1000 y no 100 a propósito: con `n * 100 + intento`, la
 * escena 1 en el intento 101 y la escena 2 en el intento 1 dan el mismo número.
 * Es improbable y es gratis evitarlo; una colisión de semillas produce dos
 * escenas con la misma imagen y eso se lee como un error del modelo.
 */
export function semillaDeEscena(planId: string, escena: number, intento: number): number {
  return semillaDeToma(`${planId}#img`, escena * 1000 + intento);
}
