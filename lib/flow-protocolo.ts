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
  /** El modelo no existe para este tier. Reintentar no sirve: se baja de modelo. */
  | 'modelo'
  /** La imagen subida venció (TTL ~1 h). Se vuelve a subir y se reencola. */
  | 'medio_vencido'
  /** Google marcó la sesión como automatizada. NO se reintenta: se para. */
  | 'sesion_marcada'
  | 'captcha'
  /** 500 del backend. Reintentar con backoff. */
  | 'transitorio'
  /** El token venció o el puente no está. Se recaptura y se reencola. */
  | 'sin_sesion'
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
    return {
      motivo: 'cuota',
      error: 'Google está limitando el ritmo de esta cuenta. Hay que esperar antes de volver a intentar.',
      reintentable: false,
    };
  }
  if (status === 401 || /invalid.*credential|unauthenticated/i.test(texto)) {
    return { motivo: 'sin_sesion', error: 'El token de Flow venció. Hay que recapturarlo desde el navegador.', reintentable: true };
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
  if (/^SIN_PLANTILLA:/i.test(m)) {
    const clase = m.split(':')[1] || '';
    return {
      motivo: 'puente_dormido',
      error: `Todavía no vimos a Google Flow hacer este pedido${clase ? ` (${clase})` : ''}. Abre Flow, genera algo una vez, y vuelve a intentar.`,
      reintentable: false,
    };
  }

  if (m === 'NO_FLOW_TAB') {
    return {
      motivo: 'sin_sesion',
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

