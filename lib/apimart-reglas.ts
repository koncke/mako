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
  /** Alto/ancho de lo que DEVUELVE. No es lo que uno pide: hay modelos que ignoran el pedido. */
  readonly formato: '9:16' | '3:4' | '16:9';
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
export const MODELOS_VIDEO = {
  'MiniMax-Hailuo-2.3-Fast': { id: 'MiniMax-Hailuo-2.3-Fast', usdPorSegundo: 0.0253, formato: '3:4', campoImagen: 'first_frame_image' },
  'seedance-2.0-mini':       { id: 'seedance-2.0-mini',       usdPorSegundo: 0.0384, formato: '9:16', campoImagen: 'image_urls' },
  'seedance-2.0-fast-face':  { id: 'seedance-2.0-fast-face',  usdPorSegundo: 0.0836, formato: '9:16', campoImagen: 'image_urls' },
} as const satisfies Record<string, ModeloVideo>;

export type IdModeloVideo = keyof typeof MODELOS_VIDEO;

/**
 * El default.
 *
 * ⚠️ NO es el más barato, a propósito. Hailuo sale un tercio menos pero devuelve **3:4**, y un reel es 9:16.
 * Un formato equivocado no se arregla recortando: recorta la cara, que es justo lo único que no se puede perder.
 */
export const MODELO_VIDEO_POR_DEFECTO: IdModeloVideo = 'seedance-2.0-mini';

/** Los modelos que sirven para una pieza vertical. Es lo que se le puede ofrecer al cliente para un reel. */
export const modelosVerticales = (): ModeloVideo[] =>
  Object.values(MODELOS_VIDEO).filter((m) => m.formato === '9:16');

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
