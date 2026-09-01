// =============================================================================
// flow-protocolo — el contrato de Google Flow (data y funciones PURAS)
// =============================================================================
// SIN `server-only` a propósito, por dos razones:
//
// 1. `clasificarFalla` decide si una llamada se reintenta y `extraerMediaId`
//    decide qué se guarda. Las dos fallan en silencio si se degradan, así que
//    necesitan test — y un módulo con `server-only` no lo puede importar. Es el
//    mismo criterio que `exigirClienteDePrueba`.
// 2. El PUENTE del navegador necesita la site key y los endpoints. Si viven
//    detrás de `server-only`, hay que copiarlos, y una copia se queda vieja.
//
// Quien habla por red es `lib/flow.ts`, que importa de acá.
// =============================================================================

// ── El protocolo ─────────────────────────────────────────────────────────────

const BASE = 'https://aisandbox-pa.googleapis.com';

/**
 * Los endpoints, relevados de `agent/config.py` de FlowKit.
 *
 * Ojo con la asimetría: las imágenes cuelgan del proyecto
 * (`/v1/projects/{id}/flowMedia:…`) y los videos NO (`/v1/video:…`) — el
 * `projectId` de un video viaja en el `clientContext` del body.
 */
export const ENDPOINTS = {
  generarImagenes: (projectId: string) => `/v1/projects/${projectId}/flowMedia:batchGenerateImages`,
  /** Un solo frame de arranque. */
  clipDesdeImagen: '/v1/video:batchAsyncGenerateVideoStartImage',
  /** Frame inicial Y final: es lo que resuelve la continuidad entre clips. */
  clipEntreImagenes: '/v1/video:batchAsyncGenerateVideoStartAndEndImage',
  /** Sin escena: solo imágenes de referencia (intros, tomas sueltas). */
  clipDesdeReferencias: '/v1/video:batchAsyncGenerateVideoReferenceImages',
  upscaleVideo: '/v1/video:batchAsyncGenerateVideoUpsampleVideo',
  upscaleImagen: '/v1/flow/upsampleImage',
  subirImagen: '/v1/flow/uploadImage',
  estadoVideo: '/v1/video:batchCheckAsyncVideoGenerationStatus',
  creditos: '/v1/credits',
  media: (mediaId: string) => `/v1/media/${mediaId}`,
} as const;

/**
 * La site key del reCAPTCHA Enterprise de Flow.
 *
 * Vive acá porque el PUENTE la necesita para llamar a
 * `grecaptcha.enterprise.execute(siteKey, { action })` en la página. Es pública
 * por definición —va en el HTML de labs.google— y no autoriza nada por sí sola:
 * el token que devuelve lo emite Google evaluando la sesión.
 */
/**
 * Cómo se le pregunta a Flow por UN video en curso.
 *
 * ⚠️ EL CAMPO SE LLAMA `media`, Y CADA ENTRADA ES `{ name, projectId }`.
 *
 * Esto está MEDIDO: es el cuerpo que la propia página de Flow manda a este
 * endpoint, capturado por el espejo y leído del servidor el 31/08/2026:
 *
 *     {"media":[{"name":"b7324be5-…","projectId":"9973383e-…"}]}
 *
 * Durante todo ese día se mandó `{"operations":[{"operation":{"name":…}}]}` — una
 * clave que Flow no tiene— y Google contestó, con toda razón, «Request contains
 * an invalid argument». La forma vieja salió del contrato de FlowKit, que es la
 * doc de un tercero; el `path` de ese contrato resultó correcto y el CUERPO no.
 *
 * Es, otra vez, la regla que este repo ya tenía escrita y que costó tres
 * hipótesis equivocadas antes de aplicarse: **un pedido a una API privada de
 * Google no se reconstruye, se COPIA del que hace la propia app.** El camino que
 * lo resolvió no fue razonar mejor: fue hacer que la plantilla real llegara al
 * servidor y leerla.
 *
 * DEVUELVE PARCHES y no un cuerpo, porque `fundir()` reemplaza los arrays
 * enteros: escribiendo `media.0.name` se cambia esa hoja y el `projectId` que la
 * plantilla ya trae al lado sobrevive.
 *
 * Vive en este módulo —sin `server-only`— para que tenga test.
 */
export function parchesEstadoClip(operacion: string): Record<string, unknown> {
  return { 'media.0.name': operacion };
}

/**
 * De dónde se ve —y se baja— un medio de Flow.
 *
 * ⚠️ OTRO DOMINIO. No es `aisandbox-pa.googleapis.com`, que es la API de
 * generación: es la API propia de la app, en `labs.google`. Medido el 31/08/2026
 * leyendo el `src` de los videos en la grilla del proyecto, después de una noche
 * entera buscándolo en el tráfico equivocado — el espejo filtraba por el host de
 * la API de generación, y ese filtro era un resumen de lo que ya habíamos mirado,
 * no una decisión sobre dónde vive el contrato.
 *
 * La forma es la que Flow usa, tal cual:
 *   /fx/api/trpc/media.getMediaUrlRedirect?name=<mediaId>
 * y con `&mediaUrlType=MEDIA_URL_TYPE_THUMBNAIL` devuelve la miniatura.
 *
 * Es un REDIRECT al archivo, autenticado por la cookie de Google del navegador.
 *
 * ⚠️ CONSECUENCIA QUE HAY QUE SABER: esta URL se ve en el navegador de quien está
 * conectado a Flow —que es el mismo que tiene que estar abierto para generar, así
 * que en el producto es siempre el caso— pero NO sirve para el armado final ni
 * para compartir: el servidor no tiene esa cookie. El clip hay que BAJARLO a
 * storage propio, que además es lo que hay que hacer igual para pegar las siete
 * tomas. Esto es lo que lo hace visible hoy, no el destino.
 */
/**
 * Subir una foto a Flow. MEDIDO el 31/08/2026 del pedido que hace la propia
 * página cuando alguien arrastra una imagen.
 *
 *     POST /v1/flow/uploadImage
 *     {"clientContext":{"projectId":"…","tool":"PINHOLE"},"imageBytes":"<base64>"}
 *
 * ⚠️ DOS COSAS QUE FLOWKIT DECÍA MAL, y las dos importan:
 *
 *  · NO lleva `mimeType`. El contrato de terceros lo incluía; el pedido real sólo
 *    manda los bytes. Google los reconoce solo.
 *  · NO lleva `recaptchaContext`. Subir una imagen no acuña captcha, aunque sea
 *    una escritura — por eso `subir_imagen` va en `SIN_CAPTCHA`. Agregarle un
 *    token que la app no manda es inventar un campo, que es exactamente lo que
 *    produjo los dos HTTP 400 de esta noche.
 *
 * La respuesta trae el id en `media.name` — un OBJETO, no un array, a diferencia
 * de las respuestas de generación.
 *
 * `imageBytes` va SIN el prefijo `data:...;base64,`: es base64 pelado.
 */
export function parchesSubirImagen(base64: string): Record<string, unknown> {
  return { imageBytes: base64 };
}

/**
 * Qué `mediaId` de Flow le corresponde a cada foto nuestra.
 *
 * Se guarda para no volver a subir la misma foto en cada anuncio: subirla otra
 * vez no rompe nada pero gasta tráfico contra la sesión del cliente, y este
 * proyecto ya midió lo que cuesta el ritmo de máquina contra Google.
 */
export const KEY_CARAS_FLOW = 'flow.caras';

/** Donde queda anotada la variante que SI trae el video, una vez medida. */
export const KEY_VARIANTE_VIDEO = 'flow.varianteVideo';

/**
 * Los candidatos de `mediaUrlType`, para que el NAVEGADOR diga cual trae el video.
 *
 * ⚠️ ES UNA LISTA DE CANDIDATOS, NO UN CONTRATO. El enum real de Google no lo
 * tenemos; el unico valor MEDIDO es `MEDIA_URL_TYPE_THUMBNAIL`, leido del `src` de
 * la grilla. El resto son formas plausibles del mismo enum y estan aca para que se
 * prueben TODAS DE UNA en el navegador de la persona, en vez de ir probando de a
 * una contra produccion y esperar un reporte entre cada intento — que es el bucle
 * que costo una noche entera.
 *
 * El vacio va PRIMERO porque es lo que se usa hoy: si resultara ser el bueno, el
 * problema esta en otro lado y hay que saberlo antes de tocar nada mas.
 */
export const VARIANTES_MEDIA: readonly string[] = Object.freeze([
  '',
  'MEDIA_URL_TYPE_VIDEO',
  'MEDIA_URL_TYPE_ORIGINAL',
  'MEDIA_URL_TYPE_DOWNLOAD',
  'MEDIA_URL_TYPE_RAW',
  'MEDIA_URL_TYPE_FULL',
  'MEDIA_URL_TYPE_PREVIEW',
  'MEDIA_URL_TYPE_THUMBNAIL',
]);

export function urlDeMedioFlow(mediaId: string, miniatura = false): string {
  const base = `https://labs.google/fx/api/trpc/media.getMediaUrlRedirect?name=${encodeURIComponent(mediaId)}`;
  return miniatura ? `${base}&mediaUrlType=MEDIA_URL_TYPE_THUMBNAIL` : base;
}

/**
 * Cuántos días sobrevive un token que dejó de usarse.
 *
 * ⚠️ El token del puente es un BEARER: sirve fuera del navegador, desde
 * cualquier lado, y no lo mata cerrar sesión —eso último es a propósito, porque
 * el puente tiene que trabajar mientras la persona no está—. Un secreto así,
 * sin vencimiento, es válido para siempre desde el día que se filtra.
 *
 * El vencimiento es POR INACTIVIDAD y no absoluto, y la diferencia es lo que lo
 * hace aplicable: un puente que trabaja todos los días nunca se corta —así que
 * esto no puede sorprender a nadie con el navegador andando— y uno que quedó
 * copiado en algún lado muere solo.
 *
 * No cubre el caso de un token robado Y usado; contra eso no hay vencimiento que
 * alcance, hay rotación. Rotar es apretar «Conectar», que ya invalida el
 * anterior.
 */
export const VENCE_SIN_USO_DIAS = 60;

/**
 * ¿Este puente dejó de usarse hace tanto que su token ya no vale?
 *
 * Se mide contra `ultimo_visto`, y contra `created_at` mientras no haya latido:
 * un token acuñado y nunca usado también tiene que morir, o quedaría un secreto
 * vivo por una conexión que nunca ocurrió.
 *
 * Sin ninguna de las dos fechas NO se vence: no saber cuándo se usó por última
 * vez es una razón para abstenerse, no para cortarle el puente a alguien.
 */
export function tokenVencido(
  ultimoVisto: string | null | undefined,
  createdAt: string | null | undefined,
  ahora = Date.now(),
): boolean {
  const t = Date.parse(String(ultimoVisto || createdAt || ''));
  if (!Number.isFinite(t)) return false;
  return ahora - t > VENCE_SIN_USO_DIAS * 24 * 3600_000;
}

export const RECAPTCHA_SITE_KEY = '6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV';

/**
 * Los límites que reemplazan a la simulación de actividad humana.
 *
 * No son sugerencias de cortesía: son la diferencia entre generar y comerse un
 * `PUBLIC_ERROR_UNUSUAL_ACTIVITY`. Salen de la config de FlowKit, que los
 * documenta como el ritmo con el que la sesión no se marca.
 */
export const LIMITES = {
  /** Milisegundos entre dos llamadas consecutivas. */
  cooldownMs: 10_000,
  /** Cuántas generaciones de video pueden estar en vuelo a la vez. */
  concurrencia: 5,
  /** Cada cuánto se pregunta por un video en curso. */
  pollMs: 10_000,
  /** Después de esto, el clip se da por perdido. */
  timeoutMs: 420_000,
} as const;

/** Los modelos, de `agent/models.json`. El tier lo decide la cuenta, no nosotros. */
export const MODELOS = {
  /**
   * ⚠️ `veo_3_1_i2v_lite_low_priority` es el que FlowKit declara «true 0-credit»
   * para cuentas TIER_TWO. NO ESTÁ VERIFICADO y decide la economía del pipeline
   * entero: se lee en la pantalla de Flow antes de generar, nunca de una tabla.
   */
  clipTierDos: 'veo_3_1_i2v_lite_low_priority',
  clipTierUno: 'veo_3_1_i2v_s_fast_portrait',
  clipEntreImagenesTierUno: 'veo_3_1_i2v_s_fast_portrait_fl',
  referenciasTierUno: 'veo_3_1_r2v_fast_portrait',
  upscale1080: 'veo_3_1_upsampler_1080p',
  upscale4k: 'veo_3_1_upsampler_4k',
  imagenPro: 'GEM_PIX_2',
  imagenBatch: 'NARWHAL',
} as const;

// ── Lo que entra y lo que sale ───────────────────────────────────────────────

/**
 * Las credenciales de UNA llamada, que las produce el puente.
 *
 * El `captcha` es de un solo uso y por acción: no se cachea. El `bearer` dura
 * 24-48 h y el puente lo recaptura solo.
 */
export type SesionFlow = {
  bearer: string;
  captcha: string;
  projectId: string;
};

/** Por qué falló, ya clasificado. El caller decide con esto, no con el string. */
export type MotivoFalla =
  /** El prompt disparó el filtro de seguridad. Reintentar no sirve: se reescribe. */
  | 'contenido'
  /** Se acabaron los créditos del día. Reintentar no sirve: se espera. */
  | 'cuota'
  /**
   * Google está limitando el RITMO. No es lo mismo que quedarse sin créditos.
   *
   * ⚠️ Motivo propio y no `cuota`, aunque los dos vengan de un 429: la acción es
   * opuesta. Sin créditos hay que RECARGAR, y con un límite de ritmo hay que
   * ESPERAR — y los créditos están intactos. Decirle «recargá» a alguien que
   * tiene 996 es mandarlo a pagar por un problema que se arregla solo.
   */
  | 'ritmo'
  /** El modelo no existe para este tier. Reintentar no sirve: se baja de modelo. */
  | 'modelo'
  /** La imagen subida venció (TTL ~1 h). Se vuelve a subir y se reencola. */
  | 'medio_vencido'
  /** Google marcó la sesión como automatizada. NO se reintenta: se para. */
  | 'sesion_marcada'
  | 'captcha'
  /** 500 del backend. Reintentar con backoff. */
  | 'transitorio'
  /**
   * Google entendio el pedido y dijo que esta MAL ARMADO. Es nuestro.
   *
   * No es `transitorio`, y la diferencia cuesta dos veces. Primero: caia en el
   * catch-all reintentable, asi que cada consulta rota se comia CINCO llamadas
   * contra la sesion de Google del cliente por algo que no puede cambiar
   * reintentando — y este proyecto ya midio que reintentar contra un bloqueo es
   * lo que causa el bloqueo. Y segundo: `transitorio` mapea a la causa `google`,
   * cuyo texto dice «Google no pudo y no dijo por que, vuelve a intentarlo en
   * unos minutos», que es falso en las tres partes: pudo, dijo, y reintentar no
   * sirve.
   */
  | 'pedido_invalido'
  /** El token venció o el puente no está. Se recaptura y se reencola. */
  | 'sin_sesion'
  /**
   * No hay NINGUNA pestaña de Flow abierta.
   *
   * ⚠️ Es un motivo propio y no un `sin_sesion`, y la diferencia importa: son
   * acciones distintas —abrir Flow contra volver a iniciar sesión— y meter las
   * dos en el mismo cajón hacía que la mitad de las veces se le dijera «tu
   * sesión venció» a alguien cuya sesión estaba perfecta.
   *
   * Antes vivía adentro de `sin_sesion` con un test que defendía, con razón, que
   * son cosas distintas. Lo que faltaba no era elegir entre las dos: era el
   * tercer casillero.
   */
  | 'sin_pestana'
  /**
   * La pestaña de Flow está abierta pero no responde: le falta el content
   * script. NO se reintenta — hace falta que una persona la recargue.
   */
  | 'puente_dormido';

export type FlowOut<T> =
  | { ok: true; data: T }
  | { ok: false; motivo: MotivoFalla; error: string; reintentable: boolean };

/** Saneo mínimo compartido. Se exporta: el cliente parsea con los mismos. */
export const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
export const obj = (v: unknown): Record<string, unknown> =>
  (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

// ── Sacar el id de un medio ──────────────────────────────────────────────────

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * El id de un medio es un UUID, y hay que ir a buscarlo.
 *
 * ⚠️ NO sirve `mediaGenerationId`: es un protobuf en base64 (arranca con `CAMS…`)
 * y guardarlo rompe todo lo que venga después, sin dar error en el momento. Si
 * el UUID no viene suelto, se extrae de la URL firmada.
 */
export function extraerMediaId(fuente: unknown): string | null {
  const o = obj(fuente);
  for (const clave of ['mediaId', 'name', 'id']) {
    const v = str(o[clave]);
    if (UUID.test(v)) return v.match(UUID)![0];
  }
  for (const clave of ['fifeUrl', 'imageUri', 'videoUri', 'url']) {
    const v = str(o[clave]);
    const m = v.match(UUID);
    if (m) return m[0];
  }
  return null;
}

// ── Clasificar el error ──────────────────────────────────────────────────────

/**
 * Traduce la respuesta de Flow a un motivo accionable.
 *
 * Los tres primeros son TERMINALES y reintentarlos quema cuota sin cambiar nada.
 * `sesion_marcada` es el peor y el único que obliga a frenar todo: seguir
 * pegando con la sesión marcada es lo que la termina de quemar.
 *
 * ⚠️ Se clasifica por `reason` estructurado ANTES que por el texto. El texto de
 * un proveedor cambia sin aviso; el enum, mucho menos.
 */
/**
 * Qué tiene que hacer la persona cuando falta una plantilla, POR CLASE.
 *
 * El espejo copia el último pedido que hizo la propia app de Flow, así que una
 * plantilla que falta se arregla haciendo ESA cosa a mano una vez. Y son cosas
 * distintas: generar un video no enseña a pedir una imagen.
 *
 * La clave es el último tramo del path, que es como la extensión nombra cada
 * clase (extension/injected.js).
 */
const QUE_HACER_SIN_PLANTILLA: Record<string, string> = {
  'flowMedia:batchGenerateImages':
    // ⚠️ DICE «ADENTRO DE UN PROYECTO» Y «NO ALCANZA CON SUBIR UNA FOTO», y las
    // dos aclaraciones salen de ver a una clienta hacer exactamente lo otro.
    // Medido en su puente: espejó `uploadImage` —subió su foto— y ninguna
    // llamada de generación, con el projectId vacío porque nunca entró a un
    // proyecto. Leyó «genera una imagen a mano» y entendió «subí tu foto», que
    // es una lectura razonable de esa frase.
    'Todavía no vi a Google Flow generar una imagen. Abre Flow, entra a un proyecto y genera UNA imagen escribiendo un prompt — no alcanza con subir una foto. Deja esa pestaña abierta y vuelve a intentar',
  'video:batchAsyncGenerateVideoReferenceImages':
    'Todavía no vi a Google Flow generar un video con tu foto de referencia. Abre Flow, genera UNO a mano usando tu foto, y vuelve a intentar',
  'video:batchAsyncGenerateVideoStartImage':
    'Todavía no vi a Google Flow animar una imagen. Abre Flow, anima UNA imagen a mano, y vuelve a intentar',
  credits:
    'Todavía no vi a Google Flow leer tu saldo. Abre Flow y espera unos segundos con la pestaña a la vista',
  // Se hace UNA vez por navegador y queda guardada del lado del servidor, así que
  // ningún cliente la va a leer dos veces.
  uploadImage:
    'Todavía no vi a Google Flow recibir una foto. Abre Flow y arrastra CUALQUIER imagen a un proyecto, una sola vez, y vuelve a intentar',
};

export function clasificarFalla(status: number, cuerpo: unknown): { motivo: MotivoFalla; error: string; reintentable: boolean } {
  // ⚠️ El cuerpo NO siempre es JSON. Cuando Google decide que el tráfico es
  // automatizado no contesta un error de la API: sirve su página HTML de bloqueo
  // («Sorry… our systems have detected unusual traffic»). Con `obj()` eso da un
  // objeto vacío, el mensaje queda en `HTTP <status>` y todo cae al `transitorio`
  // del final — que es REINTENTABLE.
  //
  // El costo de esa ruta no es un trabajo perdido: cada reintento contra el
  // bloqueo empeora el score de la sesión. Medido en producción el 26/08/2026:
  // 25 pedidos consecutivos contra la página de bloqueo, todos automáticos, sin
  // que nada frenara. El propio comentario de `sesion_marcada`, tres ramas más
  // abajo, ya decía «frenar, no reintentar» — pero solo miraba el JSON.
  const crudo = typeof cuerpo === 'string' ? cuerpo : '';
  if (/unusual traffic|<title>\s*Sorry|\/sorry\/index/i.test(crudo)) {
    return {
      motivo: 'sesion_marcada',
      error: 'Google bloqueó la sesión por «tráfico inusual». Hay que parar un rato, entrar a Flow a mano y comprobar que la cuenta no pida un captcha.',
      reintentable: false,
    };
  }

  const raiz = obj(cuerpo);
  const err = obj(raiz.error ?? obj(raiz.data).error);
  const mensaje = str(err.message) || str(raiz.message) || `HTTP ${status}`;
  const detalles = arr(err.details).map((d) => str(obj(d).reason)).filter(Boolean);
  const reason = detalles[0] ?? '';
  const texto = `${reason} ${mensaje}`;

  if (reason === 'PUBLIC_ERROR_UNSAFE_GENERATION') {
    return { motivo: 'contenido', error: 'El prompt disparó el filtro de contenido de Google.', reintentable: false };
  }
  if (reason === 'PUBLIC_ERROR_USER_QUOTA_REACHED') {
    return { motivo: 'cuota', error: 'Se agotaron los créditos de Flow de esta cuenta.', reintentable: false };
  }
  if (reason === 'PUBLIC_ERROR_MODEL_ACCESS_DENIED') {
    return { motivo: 'modelo', error: 'Este modelo no está disponible para el plan de esta cuenta.', reintentable: false };
  }
  // 403 + este reason = la sesión quedó marcada como bot. Frenar, no reintentar:
  // el ritmo o la IP la delataron y seguir empeora el score.
  if (reason === 'PUBLIC_ERROR_UNUSUAL_ACTIVITY') {
    return {
      motivo: 'sesion_marcada',
      error: 'Google marcó la sesión como automatizada. Hay que parar, limpiar cookies de google.com y labs.google, y volver a entrar a Flow.',
      reintentable: false,
    };
  }
  // ⚠️ «reCAPTCHA evaluation failed» NO es lo mismo, y meterlos en la misma rama
  // costó caro: apagaba el PUENTE ENTERO y le decía al dueño que limpiara sus
  // cookies, cuando el problema estaba de este lado.
  //
  // Lo que dice ese 403 es que el TOKEN no sirvió, y la causa más común es
  // nuestra: acuñarlo con un nombre de acción distinto del endpoint que se llama
  // (reCAPTCHA Enterprise ata el token a la acción). Un token también vence solo
  // por quedarse en la cola. Ninguna de las dos cosas se arregla limpiando
  // cookies, y ninguna justifica apagar el puente.
  //
  // Reintentable: el siguiente intento acuña un token nuevo. Si el problema fuera
  // de verdad la sesión, el reintento cae en la rama de arriba —la página de
  // bloqueo— y ahí sí se frena.
  if (/recaptcha evaluation failed/i.test(texto)) {
    return {
      motivo: 'captcha',
      error: 'Google rechazó el token de reCAPTCHA de este pedido.',
      // ⚠️ NO reintentable. Era `true`, y eso es peligroso justo acá: si la causa
      // fuera el SCORE de la sesión, cada reintento acuña otro token desde la
      // misma pestaña y lo empeora — que es exactamente el modo de falla que este
      // proyecto ya midió («reintentar contra un bloqueo causa el bloqueo»).
      //
      // Un token mal acuñado tampoco mejora reintentando: se arregla acuñándolo
      // bien, que es un cambio de código, no otra vuelta.
      reintentable: false,
    };
  }
  // El medio subido vive ~1 h. No es un fallo del pedido: hay que resubir.
  if (/requested entity was not found|not found/i.test(texto)) {
    return { motivo: 'medio_vencido', error: 'La imagen de referencia venció en el storage de Google.', reintentable: true };
  }
  if (status === 429) {
    // ⚠️ `ritmo` y NO `cuota`. El texto de acá abajo ya decía la verdad —«está
    // limitando el ritmo»— y el MOTIVO decía otra cosa; y como el motivo es el
    // que elige el mensaje que ve el cliente, la pantalla terminaba diciendo «tu
    // cuenta de Google se quedó sin créditos» con 996 créditos en la cuenta.
    //
    // Medido el 31/08/2026: la marca guardaba `saldoAntes: 996` JUNTO al error
    // que decía que no alcanzaban. El dato que lo desmentía estaba al lado.
    //
    // El 429 por créditos agotados existe y se detecta por su `reason`
    // (`PUBLIC_ERROR_USER_QUOTA_REACHED`), que se mira más arriba. Un 429 sin ese
    // reason es ritmo.
    return {
      motivo: 'ritmo',
      error: 'Google está limitando el ritmo de esta cuenta. Hay que esperar antes de volver a intentar.',
      reintentable: false,
    };
  }
  if (status === 401 || /invalid.*credential|unauthenticated/i.test(texto)) {
    return { motivo: 'sin_sesion', error: 'El token de Flow venció. Hay que recapturarlo desde el navegador.', reintentable: true };
  }
  // ⚠️ ANTES DEL CATCH-ALL: un argumento invalido no es un bache de Google.
  //
  // Medido el 31/08/2026: el 400 «Request contains an invalid argument» de la
  // consulta de estado caia justo aca, en `transitorio`, con `reintentable: true`.
  // Dos danos, y los dos silenciosos. Cada trabajo se comia CINCO llamadas contra
  // la sesion de Google del cliente por un pedido que estaba mal armado de este
  // lado y que no podia mejorar reintentando. Y `transitorio` mapea a la causa
  // `google`, cuyo texto le dice al cliente «Google no pudo y no dijo por que,
  // vuelve a intentarlo en unos minutos» — falso en las tres partes.
  //
  // Google SI dijo por que. Es de los pocos errores que vienen con el diagnostico
  // adentro, y estabamos tirandolo.
  if (/invalid_argument|invalid argument|invalid json payload|unknown name|cannot find field/i.test(texto)) {
    return {
      motivo: 'pedido_invalido',
      error: 'El pedido que sale de MaKo tiene un campo que Google no reconoce.',
      reintentable: false,
    };
  }

  return { motivo: 'transitorio', error: mensaje.slice(0, 300), reintentable: true };
}

/**
 * Clasifica las fallas que NO vienen de la API de Flow sino del NAVEGADOR.
 *
 * Existe porque el `catch` de la extensión clasifica por descarte —todo lo que no
 * sea `NO_FLOW_TAB` es «transitorio y reintentable»— y eso hace que un problema
 * permanente se reintente cinco veces y muera igual, sin decir nunca qué había
 * que hacer. Medido: tres trabajos consecutivos quemados contra lo mismo.
 *
 * Se resuelve en el SERVER a propósito: mejorar la clasificación no puede exigir
 * que cada cliente reinstale la extensión. El navegador manda el error crudo; qué
 * significa lo decide acá.
 *
 * Devuelve `null` cuando no reconoce el error, para no pisar lo que ya clasificó
 * bien el que lo generó.
 */
export function clasificarFallaDelNavegador(
  mensaje: string,
): { motivo: MotivoFalla; error: string; reintentable: boolean } | null {
  const m = mensaje.trim();

  // Chrome cuando `tabs.sendMessage` no encuentra receptor: la pestaña de Flow
  // existe, pero su content script no. Pasa siempre que la pestaña se cargó ANTES
  // de instalar la extensión —Chrome no inyecta hacia atrás— y también cuando
  // Chrome la descartó por inactividad.
  if (/Receiving end does not exist|Could not establish connection/i.test(m)) {
    return {
      motivo: 'puente_dormido',
      error: 'La pestaña de Google Flow está abierta pero no responde. Recárgala (F5) y vuelve a intentar.',
      reintentable: false,
    };
  }

  // El widget de reCAPTCHA no contestó. Recargar la pestaña lo vuelve a cargar.
  if (/CAPTCHA_TIMEOUT|SIN_GRECAPTCHA/i.test(m)) {
    return {
      motivo: 'puente_dormido',
      error: 'Google Flow no entregó el permiso de seguridad. Recarga la pestaña de Flow (F5) y vuelve a intentar.',
      reintentable: false,
    };
  }

  // El pedido lo hace la PÁGINA de Flow (ver extension/injected.js). Si no
  // contesta en 60 s, la pestaña quedó en un estado del que no sale sola.
  if (/FETCH_TIMEOUT|FETCH_FALLO/i.test(m)) {
    return {
      motivo: 'puente_dormido',
      error: 'La pestaña de Google Flow no respondió al pedido. Recárgala (F5) y vuelve a intentar.',
      reintentable: false,
    };
  }

  // La extensión no reconstruye los pedidos: los calca del último que hizo la
  // propia app de Flow (ver extension/injected.js). Si nunca vio uno de esa clase,
  // NO inventa uno — que es lo que no funcionó — y avisa que falta.
  // El espejo copia el pedido de Flow y le cambia solo las hojas que decidimos
  // nosotros (el prompt, la semilla). Si una de esas hojas no se pudo escribir, el
  // pedido NO sale — y tiene que decirse, porque el modo de falla silencioso es
  // peor que cualquier error: una imagen perfecta del escenario equivocado no se
  // lee como un fallo, se lee como una imagen.
  // La extensión intentó reponer el content script y la pestaña sigue sin
  // contestar. Se distingue del «Receiving end does not exist» crudo a
  // propósito: dice que la reparación automática YA se intentó y no alcanzó, o
  // sea que el F5 es de verdad el único camino.
  if (/^PUENTE_MUDO$/i.test(m)) {
    return {
      motivo: 'puente_dormido',
      error: 'La pestaña de Google Flow no responde ni siquiera después de reponer el puente. Recárgala (F5) y vuelve a intentar.',
      reintentable: false,
    };
  }

  if (/^PARCHE_FALLO:/i.test(m)) {
    const camino = m.slice(m.indexOf(':') + 1).trim();
    return {
      motivo: 'puente_dormido',
      error: `El pedido que Google Flow hace hoy cambió de forma y no pude escribirle el prompt (${camino}). No se generó nada. Avísanos: hay que volver a copiar el pedido.`,
      reintentable: false,
    };
  }

  if (/^SIN_PLANTILLA:/i.test(m)) {
    // ⚠️ La clase lleva DOS puntos adentro (`flowMedia:batchGenerateImages`), así
    // que `split(':')[1]` la partía a la mitad y el mensaje nombraba un endpoint
    // que no existe. Se corta en el PRIMER dos puntos y el resto es la clase.
    const clase = m.slice(m.indexOf(':') + 1).trim();
    return {
      motivo: 'puente_dormido',
      // «Genera algo una vez» no alcanza: generar un video no enseña a pedir una
      // imagen, y son plantillas distintas. Un error que no dice cuál de las dos
      // cosas hacer manda a probar la que ya estaba hecha.
      error: `${QUE_HACER_SIN_PLANTILLA[clase] ?? 'Todavía no vimos a Google Flow hacer este pedido'}${
        clase ? ` (${clase})` : ''
      }.`,
      reintentable: false,
    };
  }

  // Su propio motivo: ver el comentario de `sin_pestana` en `MotivoFalla`.
  if (m === 'NO_FLOW_TAB') {
    return {
      motivo: 'sin_pestana',
      error: 'No hay ninguna pestaña de Google Flow abierta en este navegador.',
      reintentable: false,
    };
  }

  return null;
}


/** Lo que se puede afirmar del saldo de una cuenta de Flow. */
export type SaldoFlow = {
  /** Créditos disponibles. `null` si la respuesta no los trae. */
  creditos: number | null;
  /** Cómo mostrarlo en una línea. Nunca inventa lo que no vino. */
  etiqueta: string;
  /** true SOLO si Google lo dice explícitamente. */
  esGratuito: boolean;
};

/**
 * Interpreta la respuesta de `GET /v1/credits`.
 *
 * Medido el 26/08/2026 contra una cuenta real:
 *   {"sku":"WS_FREEMIUM","credits":1012,"serviceTier":"SERVICE_TIER_ENTRY",
 *    "userPaygateTier":"PAYGATE_TIER_NOT_PAID","subscriptionCredits":1012}
 *
 * ⚠️ NO convierte créditos a «videos que te quedan», y es a propósito. El costo
 * por clip que circula en el corpus (20 créditos por 8 s) sale de la
 * documentación de un tercero y **no está medido** — y hoy se pagó un día entero
 * por tratar un dato de esa misma fuente como si fuera un hecho. El número sale
 * el día que se genere el primer video y se mire el saldo antes y después.
 */
export function leerSaldo(data: unknown): SaldoFlow {
  const d = obj(data);
  const n = typeof d.credits === 'number' ? d.credits : null;
  const sku = str(d.sku);
  const paygate = str(d.userPaygateTier);

  // En POSITIVO: se afirma «gratuito» solo con la marca explícita de Google. Lo
  // que no matchea no se declara «de pago» — se muestra tal cual vino.
  const esGratuito = paygate === 'PAYGATE_TIER_NOT_PAID' || sku === 'WS_FREEMIUM';

  const plan = esGratuito ? 'plan gratuito' : sku ? `plan ${sku}` : '';
  const cuantos = n == null ? 'saldo no informado' : `${n.toLocaleString('es-MX')} créditos`;

  return { creditos: n, esGratuito, etiqueta: plan ? `${cuantos} · ${plan}` : cuantos };
}

// ── Qué necesita cada clase de trabajo ──────────────────────────────────────
//
// ⚠️ Esto vive en el SERVER a propósito, y viaja DENTRO del pedido.
//
// El motivo es el ritmo de las actualizaciones: cada versión de la extensión
// pasa por revisión de la Chrome Web Store, y en un solo día esto fue de 0.1.0 a
// 0.5.0. Dos de esos cambios —agregar `generar_imagen` al mapa de acciones y
// marcar qué tipos solo leen— eran TABLAS, no lógica: si hubieran viajado en el
// pedido, esas dos versiones no habrían existido.
//
// La regla que queda: **lo que es una tabla se manda; lo que es una capacidad se
// instala.** Un tipo de trabajo nuevo no le da a la extensión ningún poder que no
// tuviera — le dice qué hacer con el que ya tiene. Cambiar el `world`, los
// permisos o los hosts sí es una capacidad, y eso no hay forma de mandarlo.
//
// ⚠️ Y NO es «remote code», que Google prohíbe: no se descarga ni se ejecuta
// JavaScript. Viajan parámetros —una acción de captcha, un booleano— igual que
// los manda cualquier cliente de una API. La extensión no gana nada nuevo.

export type PerfilTrabajo = {
  /**
   * La `action` del reCAPTCHA. Google la evalúa contra la que el sitio registra,
   * así que tiene que ser la del método real de Flow, no una inventada.
   */
  accion: string;
  /**
   * Un trabajo que solo LEE: no lleva cuerpo, no necesita captcha, y si la página
   * ya preguntó lo mismo hace poco se contesta con su respuesta, sin tráfico.
   */
  soloLectura: boolean;
};

const PERFILES: Record<string, PerfilTrabajo> = {
  creditos: { accion: 'getCredits', soloLectura: true },
  estado_clips: { accion: 'batchCheckAsyncVideoGenerationStatus', soloLectura: true },
  // No sale por el espejo —lo atiende `background.js` antes—, pero necesita perfil:
  // sin entrada, `perfilDeTrabajo` cae al default y le pediria un captcha a algo
  // que solo mira un redirect.
  enlace_clip: { accion: 'getMediaUrl', soloLectura: true },
  subir_imagen: { accion: 'uploadImage', soloLectura: false },
  generar_imagen: { accion: 'batchGenerateImages', soloLectura: false },
  generar_clip: { accion: 'batchAsyncGenerateVideo', soloLectura: false },
};

/**
 * El perfil de un tipo de trabajo.
 *
 * El default es el MÁS restrictivo —lleva captcha y lleva cuerpo— porque un tipo
 * que nadie registró no puede terminar salteándose el captcha por omisión. Es la
 * misma regla de siempre: el fallback es más débil que el camino feliz, nunca más
 * fuerte.
 */
export function perfilDeTrabajo(tipo: string): PerfilTrabajo {
  return PERFILES[tipo] ?? { accion: 'generate', soloLectura: false };
}

