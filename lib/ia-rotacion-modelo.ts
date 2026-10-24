// =============================================================================
// Cuando un PEDIDO del loop de herramientas falla: otro modelo, esperar, o tirar.
// =============================================================================
// Lo usa `chatCheapTools` (lib/ai-cheap.ts) en cada paso del turno. SIN `server-only`, a
// propósito: la decisión tiene test (tests/ia-rotacion-modelo.test.ts), y adentro de un
// módulo con `server-only` ningún test la puede importar.
//
// EL CASO (07/10/2026, grupo de Brigitte, ws15, UNA sola key: la de Gemini). Contestó la
// primera pregunta y en la segunda —«¿tenés la información del lead Rosana Grandoli?»—
// MaKo le dijo «te quedaste sin cuota de IA». Medido en `anthropic_usage` y en los logs:
//
//   · Una pregunta con herramientas son 6 a 8 PEDIDOS de ~15.000 tokens cada uno: el loop
//     re-manda la conversación entera en cada paso. La primera pregunta fueron 5 en 19 s.
//   · La segunda hizo 6 en 13 s y el SÉPTIMO volvió 429. El tope era el del MINUTO: 57
//     minutos después la misma key contestó 200. No era el del día.
//   · Ese 429 tiraba el turno ENTERO, con seis pasos de trabajo hecho adentro. Y el modelo
//     de respaldo (`gemini-flash-lite-latest`, MODELOS_RESPALDO), que en el plan gratis
//     tiene SU PROPIO balde de cuota, no se probaba nunca en este camino: sólo lo usaban
//     los documentos y el audio.
//   · La red de plataforma tampoco tenía salida: las tres Gemini de la agencia dieron 503
//     («high demand») en `gemini-flash-latest`, y la tercera ni contestó — un timeout que
//     salía como excepción del `fetch` y no pasaba por ningún reintento.
//
// Las tres reglas que salen de ahí, y que esto implementa:
//
//  1. REINTENTAR UN PEDIDO QUE FALLÓ NO REPITE NINGUNA HERRAMIENTA. Las tools corren sólo
//     con una respuesta buena, y los resultados de los pasos anteriores ya están en la
//     conversación. Lo que SÍ duplicaría es re-arrancar el turno desde cero con otro
//     proveedor (eso lo cuida `chatCheapToolsCascade`). Por eso esto vale en CUALQUIER
//     paso, no sólo antes de la primera tool.
//  2. UN 429 Y UN 503 SE CUBREN CON OTRO MODELO del mismo proveedor y la misma key: cada
//     modelo tiene su propio cupo y su propia capacidad. Medido esa noche: `flash-latest`
//     503 y `flash-lite-latest` 200 en 560 ms; una hora después, al revés.
//  3. UN 429 DEL MINUTO SE ESPERA cuando no queda a dónde ir, con la espera que dice el
//     PROVEEDOR («Please retry in 17s») y nunca una inventada. Uno del día trae una espera
//     de horas y no entra en el tope, así que no se espera. Y es una sola vez por turno:
//     del otro lado hay alguien mirando el chat.
//
// EL SEGUNDO CASO (23/10/2026 14:05 UTC, otra vez Brigitte, ws15, una sola key de Gemini). «Si contacte Eli»: dos pasos
// bien con `flash-lite` y el tercero no volvió — «The operation was aborted due to timeout» — y MaKo le contestó con el
// cartel «Tu proveedor de IA se cayó justo ahora… carga una segunda (son gratis)». Lo que faltaba:
//
//  4. UN TIMEOUT NO ES UNA SATURACIÓN MÁS. Compartía con el 503 el ÚNICO reintento del paso, y un 503 rápido antes de
//     él lo dejaba sin nada: el timeout que venía después tiraba el turno. (Los logs de Vercel ya no existían; sale de
//     los relojes: el cartel llegó a +83 s = el 200 de +34 s + 45 s de timeout + ~4 s. Un timeout sin reintento sólo
//     es posible con el del paso ya gastado.) Un timeout cuesta el plazo entero del pedido (45 s), así que tiene su
//     regla: otro modelo de la misma key si queda, y si no, el MISMO modelo UNA vez por turno.
//  5. LOS REINTENTOS TIENEN PLAZO (`hastaMs`). Sin él, un paso podía quemar 45 + 45 + 45 s y el turno no tenía techo
//     (medido: 170 s el más largo desde el 17/10). Con plazo, un reintento que no tiene 15 s por delante no arranca, y
//     el que arranca va cortado a lo que queda. El PRIMER pedido de cada paso no se corta nunca: después de una
//     herramienta, cortar el cierre es dejar una acción hecha sin decirla (la regla de «nada por detrás»).
// =============================================================================

export type TipoFallo = 'cuota' | 'saturacion' | 'timeout' | 'modelo' | 'otro';

export interface ErrorProveedor {
  /** El texto del proveedor, o `HTTP <n>` si no mandó ninguno. */
  mensaje: string;
  /** Lo que el proveedor dice que hay que esperar, en ms. `null` si no lo dijo. */
  esperaMs: number | null;
  /** Si la cuota que se acabó es la del DÍA. */
  porDia: boolean;
}

type Violacion = { quotaId?: unknown; quotaMetric?: unknown };
type Detalle = { retryDelay?: unknown; violations?: Violacion[] };

/**
 * El error que vino en el cuerpo de un proveedor compatible con OpenAI.
 *
 * ⚠️ GEMINI LO MANDA EN UN ARRAY: `[{ "error": { "code": 503, "message": …, "status":
 * "UNAVAILABLE" } }]` (medido el 07/10/2026). `chatCheapTools` leía `data.error.message`,
 * que sobre un array es `undefined`, así que todo error de Gemini llegaba a los logs como
 * «HTTP 429» pelado: ni qué cuota, ni cuánto esperar. El diagnóstico de ese caso hubo que
 * hacerlo pegándole a mano a la key del cliente.
 */
export function leerErrorProveedor(data: unknown, status: number): ErrorProveedor {
  const cuerpo = Array.isArray(data) ? data[0] : data;
  const err = cuerpo && typeof cuerpo === 'object' ? (cuerpo as { error?: unknown }).error : undefined;
  const obj = err && typeof err === 'object' ? (err as { message?: unknown; details?: unknown }) : null;
  const texto = typeof err === 'string' ? err : typeof obj?.message === 'string' ? obj.message : '';
  const detalles: Detalle[] = Array.isArray(obj?.details) ? (obj!.details as Detalle[]) : [];

  // Qué cuota fue: la nombra el detalle (`QuotaFailure`), no siempre el mensaje.
  const cuotas = detalles
    .flatMap((d) => (Array.isArray(d?.violations) ? d.violations : []))
    .map((v) => [v?.quotaId, v?.quotaMetric].filter((x) => typeof x === 'string').join(' '))
    .filter(Boolean)
    .join(' · ');
  // Qué cuota fue va ADELANTE: la marca del rebote (`anotarRebote429`) guarda los primeros
  // 300 caracteres y el log los primeros 240, y el texto de Google ya ocupa ~250. Puesto
  // al final, justo el dato que decide «minuto o día, pedidos o tokens» se cortaba.
  let mensaje = (texto || `HTTP ${status}`).trim();
  if (cuotas && !mensaje.includes(cuotas)) mensaje = `[${cuotas}] ${mensaje}`;

  // Cuánto esperar: el `RetryInfo` estructurado primero, y si no, la frase del mensaje.
  let esperaMs: number | null = null;
  for (const d of detalles) {
    const m = typeof d?.retryDelay === 'string' ? /^\s*([\d.]+)\s*s\s*$/.exec(d.retryDelay) : null;
    if (m) { esperaMs = Math.ceil(parseFloat(m[1]) * 1000); break; }
  }
  if (esperaMs == null) {
    const m = /retry in ([\d.]+)\s*s/i.exec(texto);
    if (m) esperaMs = Math.ceil(parseFloat(m[1]) * 1000);
  }
  return { mensaje, esperaMs: esperaMs != null && Number.isFinite(esperaMs) ? esperaMs : null, porDia: /PerDay|per[ _-]?day/i.test(cuotas) };
}

/**
 * Qué clase de fallo es, por el status y el texto.
 *
 * ⚠️ El 413 de Groq va PRIMERO: su mensaje trae `rate-limits` en la URL de la
 * documentación y se leía como cuota (ver «El 413 de Groq» en lib/fallo-ia-texto.ts).
 * Es un pedido que no entra en el tope del modelo: ni otro intento ni una espera lo
 * arreglan.
 */
export function tipoDeFallo(status: number, mensaje: string): TipoFallo {
  if (status === 413 || /request too large|reduce your message size/i.test(mensaje)) return 'otro';
  if (status === 429 || /RESOURCE_EXHAUSTED|exceeded your current quota|quota exceeded/i.test(mensaje)) return 'cuota';
  if (status === 404 || /no longer available|does not exist|unavailable for free|model not found/i.test(mensaje)) return 'modelo';
  // ⚠️ Sin status es que NO HUBO RESPUESTA: lo cortó nuestro `AbortSignal.timeout` (la regla 4 de arriba). Un 408 o un
  // 504 sí volvieron, rápido o no, y siguen siendo saturación.
  if (!status && ES_TIMEOUT.test(mensaje)) return 'timeout';
  if ((status >= 500 && status <= 599) || ES_TIMEOUT.test(mensaje) || /aborted|fetch failed|ECONNRESET|overloaded|high demand|\bUNAVAILABLE\b/i.test(mensaje)) return 'saturacion';
  return 'otro';
}

/** El texto de un pedido que no volvió a tiempo («The operation was aborted due to timeout», el de `AbortSignal.timeout`). */
const ES_TIMEOUT = /timeout|timed out|ETIMEDOUT/i;

/**
 * ⏱ Lo mínimo que tiene que quedar del plazo para ARRANCAR un reintento. El mismo número y el mismo criterio que
 * `MIN_INTENTO_MS` de la cascada de texto (lib/ai-cheap.ts): menos es un pedido que nace muerto. Medido en el doer
 * desde el 10/10: un paso de `flash-lite` tarda 2,3 s la mitad de las veces y uno de `flash-latest`, 6,7 s.
 */
export const MIN_REINTENTO_MS = 15_000;

/**
 * ⏱ El plazo de los reintentos de UN proveedor en un turno de MaKo por WhatsApp (lib/mako-doer-in.ts), desde que se
 * le pide por primera vez. Por qué 100 s, con lo medido (turnos del doer con Gemini, 17 al 24/10/2026, contados desde
 * el mensaje de la persona):
 *   · No toca el camino que anda: el primer pedido de cada paso no se corta. Los turnos que contestan tardan 15,6 s la
 *     mitad y 60 s el p90.
 *   · Pone techo al que falla: hoy un paso podía ir a 136 s (tres timeouts de 45 y la pausa) y el turno más largo fue
 *     de 170 s.
 *   · Y le deja su reintento al caso del ws15: el timeout volvió a +81 s del mensaje, y el plazo arranca después (con
 *     el primer pedido), así que a los 100 le quedan 19 s o más (≥ 15).
 * ⚠️ Es POR PROVEEDOR, no por turno: una IA de otra marca es el respaldo de verdad de un proveedor lento, y no se le
 * niega su intento porque el primero se comió el plazo.
 */
export const PLAZO_REINTENTOS_TURNO_MS = 100_000;

/** ¿Entra otro intento (después de esperar `esperaMs`) antes de `hastaMs`? */
export const hayTiempoParaOtroIntento = (hastaMs: number, ahora: number = Date.now(), esperaMs = 0): boolean =>
  ahora + esperaMs + MIN_REINTENTO_MS <= hastaMs;

export type PasoRotacion = {
  accion: 'rotar' | 'reintentar' | 'esperar';
  /** El modelo con el que se vuelve a pedir. */
  modelo: string | undefined;
  /** Cuánto esperar antes del pedido, en ms (0 = enseguida). */
  esperaMs: number;
};

export interface RotacionModelo {
  /** El modelo con el que se pide ahora. */
  readonly modelo: string | undefined;
  /** `true` si el último `null` de `trasFallo` fue por el plazo y no porque no quedara qué probar. */
  readonly cortadoPorPlazo: boolean;
  /** Arranca un paso nuevo del loop: el reintento por saturación es UNO por paso. */
  nuevoPaso(): void;
  /** Qué hacer con este fallo, o `null` si no queda nada que probar (se tira). */
  trasFallo(f: { tipo: TipoFallo; esperaMs: number | null; porDia: boolean }): PasoRotacion | null;
  /**
   * El techo de espera del pedido que sale ahora. El primero de cada paso va con `baseMs` siempre (ver la regla 5);
   * un reintento, con lo que quede del plazo, si es menos.
   */
  plazoDelIntentoMs(baseMs: number): number;
}

/** La pausa del reintento de una saturación, cuando no hay otro modelo al que ir. */
export const PAUSA_SATURACION_MS = 1200;

/**
 * La rotación de modelos de UN turno, sobre una key.
 *
 * `modelos` es el pedido y atrás sus respaldos (`modelosAProbar` en lib/ai-cheap.ts).
 * `esperaMaxMs` es el tope de una espera por cuota del minuto; 0 = no se espera nunca,
 * que es el default porque sólo el que llama sabe si tiene OTRA cuenta a la que saltar.
 *
 * Una vez que se rotó, no se vuelve al modelo anterior en ese turno salvo por la espera:
 * pegarle de nuevo a un modelo que acaba de decir que no es pagar otro rebote.
 *
 * `hastaMs` (epoch ms) es el plazo de los REINTENTOS (la regla 5 de arriba); sin él, como antes. `ahora` es para el test.
 */
export function crearRotacion(
  modelos: Array<string | undefined>,
  opts: { esperaMaxMs?: number; hastaMs?: number; ahora?: () => number } = {},
): RotacionModelo {
  const lista = modelos.length ? modelos : [undefined];
  const esperaMax = Math.max(0, opts.esperaMaxMs ?? 0);
  const ahora = opts.ahora ?? Date.now;
  let i = 0;
  let reintentoDelPaso = false;
  /** El primer modelo que dio una cuota del MINUTO con una espera que entra en el tope. */
  let cuotaMinuto: { indice: number; esperaMs: number } | null = null;
  let esperado = false;
  /** El reintento del MISMO modelo tras un timeout: uno por turno (la regla 4), aparte del de la saturación. */
  let timeoutReintentado = false;
  /** ¿El pedido que sale ahora es un reintento? Lo que decide si el plazo lo corta. */
  let enReintento = false;
  let cortadoPorPlazo = false;

  const esperar = (): PasoRotacion | null => {
    if (!cuotaMinuto || esperado) return null;
    esperado = true;
    i = cuotaMinuto.indice;
    reintentoDelPaso = true; // la espera ya es el reintento de este paso
    // Medio segundo de margen: la ventana es móvil y la espera que dicen es al ras.
    return { accion: 'esperar', modelo: lista[i], esperaMs: cuotaMinuto.esperaMs + 500 };
  };
  const rotar = (): PasoRotacion | null => {
    if (esperado || i + 1 >= lista.length) return null;
    i++;
    reintentoDelPaso = false;
    return { accion: 'rotar', modelo: lista[i], esperaMs: 0 };
  };

  const decidir = ({ tipo, esperaMs, porDia }: { tipo: TipoFallo; esperaMs: number | null; porDia: boolean }): PasoRotacion | null => {
    // ⚠️ EL TIMEOUT VA PRIMERO Y CON SU PROPIA CUENTA (la regla 4). El modelo que se colgó es la peor apuesta para el
    // reintento inmediato: si hay otro en la lista, va ése; si no, el mismo, UNA vez por turno. No mira
    // `reintentoDelPaso`: un 503 rápido antes no le quita su intento, que es justo lo que tiró el turno del ws15.
    if (tipo === 'timeout') {
      const r = rotar();
      if (r) return r;
      if (timeoutReintentado) return null;
      timeoutReintentado = true;
      return { accion: 'reintentar', modelo: lista[i], esperaMs: 0 };
    }
    // Después de la espera no se sigue probando: el turno ya se tomó su tiempo.
    if (esperado && (tipo === 'cuota' || tipo === 'saturacion' || tipo === 'modelo')) return null;
    if (tipo === 'cuota') {
      if (!porDia && esperaMs != null && esperaMs <= esperaMax && !cuotaMinuto) cuotaMinuto = { indice: i, esperaMs };
      return rotar() ?? esperar();
    }
    if (tipo === 'saturacion') {
      const r = rotar();
      if (r) return r;
      if (!reintentoDelPaso) {
        reintentoDelPaso = true;
        return { accion: 'reintentar', modelo: lista[i], esperaMs: PAUSA_SATURACION_MS };
      }
      return esperar();
    }
    if (tipo === 'modelo') return rotar() ?? esperar();
    return null;
  };

  return {
    get modelo() { return lista[i]; },
    get cortadoPorPlazo() { return cortadoPorPlazo; },
    nuevoPaso() { reintentoDelPaso = false; enReintento = false; },
    trasFallo(f) {
      const paso = decidir(f);
      if (!paso) return null;
      // El plazo se mira DESPUÉS de decidir: lo que se corta es un intento que existía, y se dice (`cortadoPorPlazo`).
      if (opts.hastaMs != null && !hayTiempoParaOtroIntento(opts.hastaMs, ahora(), paso.esperaMs)) {
        cortadoPorPlazo = true;
        return null;
      }
      enReintento = true;
      return paso;
    },
    plazoDelIntentoMs(baseMs) {
      if (!enReintento || opts.hastaMs == null) return baseMs;
      return Math.min(baseMs, Math.max(MIN_REINTENTO_MS, opts.hastaMs - ahora()));
    },
  };
}
