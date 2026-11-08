// =============================================================================
// ApiMart — las reglas del proveedor de generación, sin red (7/11/2026)
// =============================================================================
// QUÉ RESUELVE: Flow sólo anda con la cuenta de Google del negocio y por la extensión del navegador.
// Martín, 7/11: «no quiero que sólo dependamos de Flow, muchos clientes no tienen Flow… quiero poder
// ofrecerles otra API». Ésta es esa otra API.
//
// ⚠️ ACÁ LA PAGA MAKO, Y POR ESO **NO VA POR `credWs`**. Ésa es la diferencia con todos los demás clientes de
// `lib/`. La decisión del 22/10 («cada negocio paga SU IA») es sobre IA de TEXTO: su Claude, su GPT, su Gemini.
// Generación es otra capa: no se le puede pedir a una PyME que salga a sacar una clave de un modelo de video.
// Martín, 7/11: «implementalo de punta a punta en MaKo, **para que nosotros costeemos eso**… podemos vender
// MaKo Tokens». Por eso la clave es de PLATAFORMA y el freno es el medidor, no la credencial.
//
// ⚠️ Y por eso mismo `credWs` acá sería un BUG CARO, no un detalle de estilo: para cualquier workspace que no
// sea el dueño devuelve `null` (ver `lib/credenciales.ts`), así que TODA generación de TODO cliente fallaría
// con «clave no configurada» — y las filas quedarían en `status='error'`, que es reintentable, y el cron las
// levantaría para siempre. Es exactamente la trampa anotada en la memoria del BYOK.
//
// Este archivo NO toca la red ni la base: sólo la aritmética y la clasificación, que es lo que se puede probar
// sin gastar un centavo. El cliente HTTP vive en `lib/apimart.ts`.
//
// Todo lo de acá está MEDIDO el 7/11/2026 contra la cuenta real, con la foto real de Mauricio.
// Ver `docs/hallazgos-ai-avatar.md` y `docs/hallazgos-video-pipeline.md`.
// =============================================================================

/** Un modelo de video del catálogo, con lo que hace falta saber ANTES de llamarlo. */
export type ModeloVideo = {
  /** El id tal cual lo espera la API. */
  readonly id: string;
  /** US$ por segundo, MEDIDO. El catálogo de ApiMart no trae precios: sólo aparecen al terminar la tarea. */
  readonly usdPorSegundo: number;
  /**
   * Qué proporción devolvió ESTE modelo, medido con una imagen de entrada 4:5.
   *
   * ⚠️ NO ES UNA PROPIEDAD FIJA DEL MODELO, y acá estaba al revés hasta el 7/11. **La proporción la pone
   * la IMAGEN DE ENTRADA**; cada modelo la respeta o la ignora, y eso es lo que mide este campo.
   * Lo dice el propio error de wan, textual: «image-to-video does not support aspect_ratio; ratio is
   * determined by input image» — y pedir `aspect_ratio` o `size` hace FALLAR la tarea entera.
   *
   * `respeta` = devolvió la misma proporción que la entrada. Es lo único que se puede prometer.
   */
  readonly formato: '9:16' | '3:4' | '16:9';
  /** Si devolvió la MISMA proporción que la imagen de entrada (medido con una entrada 4:5). */
  readonly respetaLaEntrada: boolean;
  /** Cómo se llama el parámetro de la imagen de entrada. Cambia por modelo y no está documentado. */
  readonly campoImagen: 'image_urls' | 'first_frame_image';
};

/**
 * Los modelos medidos, del más barato al más caro.
 *
 * ⚠️ NO HAY UN MODELO «QUE PRESERVA LA CARA». Los tres preservan la identidad porque la preservan por MÉTODO:
 * en image-to-video la foto es el cuadro 0 y la cara se arrastra. La familia `-face` cuesta 2,2× y no compra
 * nada — medido comparando el ÚLTIMO cuadro de cada video, que es donde la deriva aparece.
 */
// ⛔⛔ REGLA DE MARTÍN (8/11/2026), TEXTUAL: «TENÉS PROHIBIDO USAR OTRO MODELO QUE NO SEA OMNI… Es el
// único que podemos usar, porque el resto NO sale bien.»
//
// Es sobre **una persona hablando a cámara** (avatar, testimonial, pieza con cara). Lo dijo mirando un
// clip hecho con `wan2.5-preview`: la boca se mueve «como si» hablara, pero no sincroniza fonemas, así
// que se ve mal ANTES de tocarle la voz. Los de abajo que NO son Omni sirven para plano sin habla
// (producto, paisaje, b-roll); para una cara que habla, **no se eligen aunque sean más baratos o
// respeten mejor la proporción**. Ese ahorro es el que produjo el clip que él rechazó.
//
// ⚠️ `kling-v3-omni` devuelve **16:9**: una pieza vertical sale recortada. Eso NO habilita volver a
// `wan2.5` ni a `kling-v4` — se resuelve con el encuadre o se le pide a Martín, no cambiando de modelo.
export const MODELOS_VIDEO = {
  // ⚠️ `formato` y `respetaLaEntrada` se RE-MIDIERON el 7/11 con una entrada 4:5, y estaban al revés:
  // Hailuo devolvió 4:5 (respetó la entrada) y seedance la cambió a 3:4. Ver el tipo de arriba.
  'MiniMax-Hailuo-2.3-Fast': { id: 'MiniMax-Hailuo-2.3-Fast', usdPorSegundo: 0.0253, formato: '3:4',  respetaLaEntrada: true,  campoImagen: 'first_frame_image' },
  'seedance-2.0-mini':       { id: 'seedance-2.0-mini',       usdPorSegundo: 0.0384, formato: '3:4',  respetaLaEntrada: false, campoImagen: 'image_urls' },
  'seedance-2.0-fast-face':  { id: 'seedance-2.0-fast-face',  usdPorSegundo: 0.0836, formato: '9:16', respetaLaEntrada: false, campoImagen: 'image_urls' },
  // Los de voz nativa (`audio: true`), medidos el 7/11 con 10 s. Son los que generan el habla Y los
  // labios juntos: montar un audio encima de un video mudo NO sincroniza nada.
  'wan2.5-preview':          { id: 'wan2.5-preview',          usdPorSegundo: 0.0664, formato: '3:4',  respetaLaEntrada: true,  campoImagen: 'image_urls' },
  'kling-v3-omni':           { id: 'kling-v3-omni',           usdPorSegundo: 0.0896, formato: '16:9', respetaLaEntrada: false, campoImagen: 'image_urls' },
  'kling-v4':                { id: 'kling-v4',                usdPorSegundo: 0.1400, formato: '3:4',  respetaLaEntrada: true,  campoImagen: 'image_urls' },
  // ⚠️ 36 VECES Hailuo. Devuelve 1920×1080 y cambia el encuadre: para una pieza vertical no sirve,
  // por caro Y por formato. Está acá para que nadie lo vuelva a elegir sin ver el número.
  'seedance-2.5':            { id: 'seedance-2.5',            usdPorSegundo: 0.5368, formato: '16:9', respetaLaEntrada: false, campoImagen: 'image_urls' },
} as const satisfies Record<string, ModeloVideo>;

/**
 * El modelo con el que se PRUEBA un método, que no es el mismo con el que se entrega.
 *
 * ⚠️ Esto costó US$ 12,96 para entregar un clip de US$ 1,40 (7/11): el 89% se tiró validando con
 * modelos caros preguntas que NO dependen del modelo (¿se mueven los labios?, ¿aguanta la cara?,
 * ¿se rompe el texto?, ¿respeta la proporción?). Hailuo las contesta por 36 veces menos.
 */
export const MODELO_PARA_PROBAR: IdModeloVideo = 'MiniMax-Hailuo-2.3-Fast';

export type IdModeloVideo = keyof typeof MODELOS_VIDEO;

/**
 * El default: el MÁS BARATO de los que respetan la proporción de entrada.
 *
 * ⚠️ ERA `seedance-2.0-mini` «porque Hailuo devuelve 3:4 y un reel es 9:16». Esa razón se cayó al medir
 * (7/11): **la proporción la pone la imagen de entrada**, y Hailuo es justamente de los que la RESPETAN —
 * con una entrada 4:5 devolvió 4:5, y seedance la cambió. O sea que con una imagen 9:16 Hailuo da 9:16.
 * El default estaba pagando **52% de más** para evitar un problema que no existía.
 */
export const MODELO_VIDEO_POR_DEFECTO: IdModeloVideo = 'MiniMax-Hailuo-2.3-Fast';

/**
 * Los modelos que devuelven la MISMA proporción que la imagen que se les da.
 *
 * ⚠️ Reemplaza a `modelosVerticales()`, que filtraba por `formato === '9:16'` dando por sentado que la
 * proporción era una propiedad del modelo. No lo es. Un reel sale vertical porque la IMAGEN es vertical
 * y el modelo la respeta: eso es lo que hay que poder preguntar, y es lo único que se puede prometer.
 */
export const modelosQueRespetanLaEntrada = (): ModeloVideo[] =>
  Object.values(MODELOS_VIDEO).filter((m) => m.respetaLaEntrada);

// -----------------------------------------------------------------------------
// LA TRAMPA QUE COBRA DOS VECES
// -----------------------------------------------------------------------------

/**
 * En qué quedó un pedido de generación. **Son TRES estados, no dos.**
 *
 * ⚠️ `desconocido` NO es `rechazado`, y confundirlos cuesta plata de verdad. ApiMart devuelve el `task_id` en
 * dos formas distintas SEGÚN EL MODELO:
 *
 *     { "data": { "task_id": "…" } }        ← seedance, wan
 *     { "data": [ { "task_id": "…" } ] }    ← MiniMax
 *
 * Un extractor que sólo mira `data.task_id` devuelve `undefined` con el segundo y el código concluye que falló.
 * **No falló: arrancó, y se está cobrando.** El reintento genera de nuevo y se paga dos veces la misma pieza.
 * Pasó el 7/11 mientras se medía esto.
 *
 * Por eso: si hay id, `aceptado`. Si el proveedor dijo explícitamente que no, `rechazado` (y ahí sí se puede
 * reintentar). Si no se entiende la respuesta, `desconocido` — **y eso NO se reintenta solo.**
 */
export type Arranque =
  | { estado: 'aceptado'; taskId: string }
  | { estado: 'rechazado'; porque: string }
  | { estado: 'desconocido'; porque: string; crudo: string };

/** ¿Un error del proveedor dice que NO arrancó? Sólo entonces es seguro reintentar. */
const RECHAZOS_SEGUROS = /invalid_request|invalid format|not supported|is required|unsupported|bad request/i;

/**
 * Lee la respuesta de un `POST /v1/videos/generations` y dice en qué quedó.
 *
 * Tolera las dos formas del `task_id` a propósito: la alternativa es que el día que el proveedor agregue un
 * modelo con la otra forma, empecemos a pagar doble sin que nada se ponga rojo.
 */
export function comoQuedo(cuerpo: unknown, httpStatus: number): Arranque {
  const j = cuerpo as Record<string, unknown> | null | undefined;
  const data = j?.data as Record<string, unknown> | Array<Record<string, unknown>> | undefined;

  const id = (Array.isArray(data) ? data[0]?.task_id : data?.task_id) as unknown;
  if (typeof id === 'string' && id.length > 0) return { estado: 'aceptado', taskId: id };

  // Un error con forma conocida y texto de «esto está mal pedido»: no arrancó, y se puede corregir y repetir.
  const err = (j?.error ?? j) as Record<string, unknown> | undefined;
  const msg = [err?.message, err?.code, err?.type].filter((x) => typeof x === 'string').join(' ');
  if (msg && RECHAZOS_SEGUROS.test(msg)) return { estado: 'rechazado', porque: String(err?.message ?? msg) };

  // Cualquier otra cosa —un 500, un timeout, un cuerpo que no entendemos— puede estar corriendo y cobrándose.
  return {
    estado: 'desconocido',
    porque: `El proveedor respondió ${httpStatus} y no pude leer si la generación arrancó.`,
    crudo: JSON.stringify(cuerpo ?? null).slice(0, 500),
  };
}

/**
 * ¿Se puede reintentar este arranque sin arriesgar pagar dos veces?
 *
 * Sólo `rechazado`. `desconocido` necesita que alguien mire; `aceptado` no se reintenta porque ya corre.
 */
export const sePuedeReintentar = (a: Arranque): boolean => a.estado === 'rechazado';

// -----------------------------------------------------------------------------
// Lo que cuesta, antes de llamar
// -----------------------------------------------------------------------------

/**
 * US$ estimados de una generación. **Es una ESTIMACIÓN y no puede no serlo**: el costo real sólo llega en
 * `GET /v1/tasks/{id}` cuando la tarea termina. Por eso el medidor redondea hacia arriba y el ledger ajusta
 * al cerrar.
 */
export const usdDeVideo = (modelo: IdModeloVideo, segundos: number): number =>
  Math.max(0, segundos) * MODELOS_VIDEO[modelo].usdPorSegundo;

/** El cuerpo del pedido, con el nombre de campo que ESTE modelo espera. */
export function cuerpoDePedido(
  modelo: IdModeloVideo,
  fotoUrl: string,
  prompt: string,
  segundos: number,
): Record<string, unknown> {
  const m = MODELOS_VIDEO[modelo];
  // ⚠️ `data:` NO sirve: /v1/videos/generations contesta 400 «Only http/https URLs or asset:// … are supported».
  // La ruta de imágenes SÍ las acepta, así que una prueba que anda en imágenes no prueba nada sobre video.
  if (!/^https?:\/\//.test(fotoUrl)) {
    throw new Error('La foto de referencia tiene que ser una URL http(s) — una data: URL la rechaza el proveedor.');
  }
  const base: Record<string, unknown> = { model: m.id, prompt, duration: Math.max(1, Math.round(segundos)) };
  if (m.campoImagen === 'image_urls') { base.image_urls = [fotoUrl]; base.aspect_ratio = m.formato; }
  else base.first_frame_image = fotoUrl;
  return base;
}
