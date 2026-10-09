// =============================================================================
// nutricion-hilos — varios caminos A LA VEZ en una inscripción (puro, con test)
// =============================================================================
// Segunda tanda del flujo con ramas (08/10/2026, punto 2 del pedido de Martín: «de un mismo cron
// puedo sacar toda una secuencia para WhatsApp y toda otra secuencia de email»). El modelo
// (`paralelos` en una tarjeta, el nodo `inicio` del CRON) vive en lib/flujo-grafo.ts; el porqué,
// en docs/chatbot-flujo-ramas-diseno.md → «SEGUNDA TANDA», decisiones 2 a 7.
//
// El motor lleva los hilos de un lead en UNA inscripción (`nutricion_inscripciones.hilos`, mig
// 0228). `hilos` NULL = un solo cursor, como siempre: los flujos sin flechas en paralelo nunca
// entran acá. Con hilos, las columnas de siempre (`paso_actual`, `nodo_actual`,
// `proximo_envio_at`) RESUMEN el hilo que vence primero, así la cola de `procesarEnvios` y su
// índice no cambian.
//
// Sin `server-only` y sin base, a propósito: decide cuántas veces le escribimos a una persona
// real. El que ESCRIBE es lib/nutricion.ts (`escribir`, la puerta de la posición).
// =============================================================================

import { HILO_PRINCIPAL, TOPE_HILOS, claseDe, idDe, indicePorId, padreDe, puertosDe, raicesSalida, type PasoGrafo } from './flujo-grafo';

/**
 * Un camino vivo de la inscripción. `h` es su nombre: 'p' el principal, o el id de la tarjeta
 * donde nació (el destino de la flecha en paralelo). `nodo` es la tarjeta en la que está y
 * `proximo` cuándo le toca (ISO).
 */
export type Hilo = { h: string; nodo: string; proximo: string };

/** Lo que cambia de un hilo: o se CIERRA, o se mueve (`nodo`) y/o se reprograma (`proximo`). */
export type CambioHilo =
  | { cierra: true; estado?: 'completada' | 'cancelada' }
  | { cierra?: false; nodo?: string; proximo?: string };

/** Las columnas de siempre, como quedan después del cambio. */
export type ResumenInsc = {
  /** Ausente = no se escribe (la inscripción terminó, o el nodo del hilo ya no existe). */
  paso_actual?: number;
  nodo_actual: string | null;
  proximo_envio_at: string | null;
  estado: 'activa' | 'completada' | 'cancelada';
};

const ms = (iso: string): number => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
};

/** El orden de la cola: por próximo envío y, empatados, por nombre (determinista). */
const porProximo = (a: Hilo, b: Hilo): number => (ms(a.proximo) - ms(b.proximo)) || (a.h < b.h ? -1 : a.h > b.h ? 1 : 0);

/**
 * Lee la columna `hilos` como viene de la base. Lo que no es un hilo no viaja; un array vacío o
 * ilegible es NULL (un solo cursor): nunca se escribe vacío, una inscripción sin hilos terminó.
 */
export function sanearHilos(x: unknown): Hilo[] | null {
  if (!Array.isArray(x)) return null;
  const out: Hilo[] = [];
  for (const o of x) {
    if (!o || typeof o !== 'object') continue;
    const r = o as Record<string, unknown>;
    if (typeof r.h !== 'string' || !r.h || typeof r.nodo !== 'string' || !r.nodo || typeof r.proximo !== 'string') continue;
    if (out.some((y) => y.h === r.h)) continue;
    out.push({ h: r.h, nodo: r.nodo, proximo: r.proximo });
  }
  return out.length ? out : null;
}

/**
 * Los hilos con los que arranca una inscripción NUEVA: uno por raíz de la salida (la principal y
 * las flechas en paralelo del CRON). NULL con una sola raíz: la inscripción sigue siendo de un
 * cursor, como siempre. `proximoDe` es la programación de siempre de cada tarjeta.
 */
export function hilosIniciales(pasos: readonly PasoGrafo[], proximoDe: (nodo: string) => string): Hilo[] | null {
  const raices = raicesSalida(pasos);
  if (raices.length <= 1) return null;
  return raices.slice(0, TOPE_HILOS).map((r, k) => ({ h: k === 0 ? HILO_PRINCIPAL : r, nodo: r, proximo: proximoDe(r) }));
}

/** Los hilos que ya tocan, del que vence primero al último (y por nombre, si empatan). */
export function hilosVencidos(hilos: readonly Hilo[], ahoraMs: number): Hilo[] {
  return hilos.filter((x) => ms(x.proximo) <= ahoraMs).sort(porProximo);
}

/**
 * Los ids que arrancan A LA VEZ cuando la tarjeta `idx` termina (sus flechas en paralelo).
 *
 * ⚠️ UNA CONDICIÓN NO «TERMINA»: sale por UN resultado, y sólo arrancan las flechas de ése (cuarta
 * tanda, punto 8; las arranca `resolverControl` con `paralelosDeResultado`). Sus puertos `par:` son
 * los de TODOS sus resultados: devolverlos acá le mandaría al lead lo del «Sí» y lo del «Si no».
 */
export function repartosDe(pasos: readonly PasoGrafo[], idx: number): string[] {
  if (!pasos[idx] || claseDe(pasos[idx]) === 'condicion') return [];
  return puertosDe(pasos, idx).flatMap((pt) => (pt.puerto.startsWith('par:') && pt.destino ? [pt.destino] : []));
}

/** Un hilo nuevo por cada reparto, con su próximo envío. Su nombre es la tarjeta donde nace. */
export function hilosNuevos(destinos: readonly string[], proximoDe: (nodo: string) => string): Hilo[] {
  return destinos.map((d) => ({ h: d, nodo: d, proximo: proximoDe(d) }));
}

/**
 * Aplica un cambio al hilo `h` y suma los `nuevos`, y devuelve los hilos que quedan con el
 * RESUMEN para las columnas de siempre.
 *
 *  · Un hilo que se cierra sale del array; si no queda ninguno, la inscripción TERMINA
 *    (`completada`, o `cancelada` si el último se canceló), con `hilos` NULL y sin próximo envío:
 *    la inscripción termina cuando no queda hilo (decisión 3).
 *  · Un hilo nuevo con el nombre de uno vivo no se suma (sería la misma tarjeta dos veces: el
 *    mismo mensaje dos veces al lead), ni pasado el tope de `TOPE_HILOS`. `validarGrafo` ya lo
 *    impide al guardar; esto es la red. Se cuentan en `descartados` para que el motor lo diga.
 */
export function aplicarAHilo(
  pasos: readonly PasoGrafo[], hilos: readonly Hilo[], h: string, cambio: CambioHilo, nuevos: readonly Hilo[] = [],
): { hilos: Hilo[] | null; resumen: ResumenInsc; descartados: number } {
  const out: Hilo[] = [];
  for (const x of hilos) {
    if (x.h !== h) { out.push({ ...x }); continue; }
    if (cambio.cierra) continue;
    out.push({ ...x, nodo: cambio.nodo ?? x.nodo, proximo: cambio.proximo ?? x.proximo });
  }
  let descartados = 0;
  for (const n of nuevos) {
    if (out.some((x) => x.h === n.h) || out.length >= TOPE_HILOS) { descartados += 1; continue; }
    out.push({ ...n });
  }
  if (!out.length) {
    const estado = cambio.cierra && cambio.estado === 'cancelada' ? 'cancelada' : 'completada';
    return { hilos: null, resumen: { nodo_actual: null, proximo_envio_at: null, estado }, descartados };
  }
  const primero = [...out].sort(porProximo)[0];
  const i = indicePorId(pasos, primero.nodo);
  return {
    hilos: out,
    resumen: { ...(i >= 0 ? { paso_actual: i } : {}), nodo_actual: primero.nodo, proximo_envio_at: primero.proximo, estado: 'activa' },
    descartados,
  };
}

/**
 * ¿El hilo `h` sigue en la tarjeta `nodo`? Es la pregunta del compare-and-set cuando la escritura
 * perdió contra otra (por `hilos_rev`): se relee la fila y el cambio se vuelve a aplicar SÓLO si
 * este hilo sigue donde se lo leyó. Si otra corrida ya lo movió o lo cerró, el cambio es de ella.
 */
export function hiloSigueEn(hilos: readonly Hilo[] | null, h: string, nodo: string | null | undefined): boolean {
  return !!hilos?.some((x) => x.h === h && x.nodo === nodo);
}

/** ¿Quedan OTROS hilos vivos además de `h`? Lo pregunta lo terminal de un email (decisión 7). */
export function hayOtrosHilos(hilos: readonly Hilo[] | null, h: string | null): boolean {
  return !!hilos && hilos.some((x) => x.h !== h);
}

/**
 * Con qué estado se cierra un mensaje que no va a poder salir NUNCA (el lead sin email o dado de
 * baja del email: reintentar no lo arregla).
 *
 *  · Un solo cursor → `cancelada`, lo de siempre.
 *  · Con hilos → `completada`. Con otros hilos vivos da igual (`aplicarAHilo` cierra SÓLO éste y la
 *    inscripción sigue activa); decide cuando el del email es el ÚLTIMO hilo vivo. Con `cancelada`
 *    la inscripción entera terminaba cancelada, el desenlace la sellaba «cancelado» y no miraba
 *    nada más: ni el «no confirmó», ni la etapa de fallo, ni el encadenado, sobre un lead que había
 *    recibido todos sus WhatsApp. Y si el email fallaba PRIMERO, el WhatsApp cerraba después como
 *    `completada`: el mismo lead terminaba distinto según qué hilo cerrara último (revisión del
 *    09/10/2026). Así termina igual en los dos órdenes.
 *
 * El remitente sandbox llega al mismo cierre sólo con otros hilos vivos (decisión 7), donde el estado
 * no decide nada; sin ellos espera, como siempre.
 */
export function estadoDeCierrePermanente(hilos: readonly Hilo[] | null): 'completada' | 'cancelada' {
  return hilos ? 'completada' : 'cancelada';
}

/**
 * ¿La fila vuelve a la cola en esta misma corrida? Sí si lo que sigue por el cursor ya toca, o si
 * una flecha en paralelo arrancó un hilo ya vencido (un destino «Enseguida»).
 *
 * Lo pregunta el paso «⚡ Acción» después de correr. Miraba sólo `proximo`: sin siguiente (null) o
 * con un siguiente con demora («en 2 h»), el hilo nuevo que la acción acababa de arrancar quedaba
 * vencido y sin mirar hasta el cron siguiente — una hora, o ~16 h si la acción corría a las 23 UTC
 * (revisión del 09/10/2026). Los otros dos caminos (el mensaje y la tarjeta de control) ya miraban
 * los hilos nuevos.
 */
export function vuelveALaCola(proximo: string | null, nuevos: readonly Hilo[], ahoraMs: number): boolean {
  return (proximo != null && Date.parse(proximo) <= ahoraMs) || nuevos.some((n) => Date.parse(n.proximo) <= ahoraMs);
}

// ── La puerta de la posición: qué se escribe ────────────────────────────────────

/** Lo que la puerta sabe de la fila cuando escribe. `nodo` es la tarjeta en la que está el cursor (o el hilo). */
export type LeidoPosicion = {
  hilos: readonly Hilo[] | null;
  /** El hilo que se está moviendo. Con `hilos` NULL no importa: el cursor es el principal. */
  h: string | null;
  nodo: string | null;
  proximo_envio_at: string | null;
};

const POSICION = new Set(['paso_actual', 'nodo_actual', 'proximo_envio_at', 'estado']);
const TERMINAL = new Set(['completada', 'cancelada']);

/**
 * QUÉ ESCRIBE LA PUERTA DE LA POSICIÓN (`escribir`, lib/nutricion.ts), sin base, para que tenga test.
 *
 * `campos` son los de siempre —los que escribía cada una de las 23 escrituras sueltas: el avance,
 * la espera, el cierre, el reintento— y esto decide si van tal cual o hay que traducirlos a hilos:
 *
 *  · `hilos` NULL y nada que repartir → `cursor`: los campos van TAL CUAL. Es el camino de los 6
 *    flujos vigentes (ninguno tiene flechas en paralelo), byte a byte lo de antes.
 *  · con hilos, o con repartos nuevos (la primera flecha en paralelo convierte el cursor en el hilo
 *    'p') → `hilos`: el cambio se aplica SÓLO al hilo `h` (`aplicarAHilo`) y las columnas de siempre
 *    resumen el que vence primero. Un `estado` terminal o un `proximo_envio_at` en null CIERRA el
 *    hilo; la inscripción termina cuando no queda ninguno.
 *  · `alcance: 'inscripcion'` (la reunión ya pasó, el residuo ya no aplica, el tope de saltos)
 *    cierra TODO: los campos tal cual y `hilos` en NULL.
 *
 * Lo que no es la posición (`ultimo_paso_at`, …) viaja igual en los tres casos.
 */
export function planDePosicion(
  pasos: readonly PasoGrafo[], leido: LeidoPosicion, campos: Record<string, unknown>,
  o: { alcance?: 'hilo' | 'inscripcion'; nuevos?: readonly Hilo[] } = {},
): { modo: 'cursor'; update: Record<string, unknown> } | { modo: 'hilos'; update: Record<string, unknown>; hilos: Hilo[] | null; descartados: number } {
  const nuevos = o.nuevos ?? [];
  if (!leido.hilos && !nuevos.length) return { modo: 'cursor', update: { ...campos } };
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(campos)) if (!POSICION.has(k)) extra[k] = v;
  if (o.alcance === 'inscripcion' && TERMINAL.has(String(campos.estado))) {
    return { modo: 'hilos', update: { ...campos, nodo_actual: null, hilos: null }, hilos: null, descartados: 0 };
  }
  // El cursor de siempre pasa a ser el hilo principal la primera vez que algo se reparte.
  const h = leido.hilos ? (leido.h ?? HILO_PRINCIPAL) : HILO_PRINCIPAL;
  const base: Hilo[] = leido.hilos
    ? [...leido.hilos]
    : leido.nodo ? [{ h, nodo: leido.nodo, proximo: leido.proximo_envio_at ?? new Date(0).toISOString() }] : [];
  const cierra = TERMINAL.has(String(campos.estado)) || ('proximo_envio_at' in campos && campos.proximo_envio_at === null);
  const cambio: CambioHilo = cierra
    ? { cierra: true, estado: campos.estado === 'cancelada' ? 'cancelada' : 'completada' }
    : {
      ...(typeof campos.nodo_actual === 'string' ? { nodo: campos.nodo_actual } : {}),
      ...(typeof campos.proximo_envio_at === 'string' ? { proximo: campos.proximo_envio_at } : {}),
    };
  const r = aplicarAHilo(pasos, base, h, cambio, nuevos);
  return { modo: 'hilos', update: { ...extra, ...r.resumen, hilos: r.hilos }, hilos: r.hilos, descartados: r.descartados };
}

/**
 * Las tarjetas que el motor puede tocar de una fila en esta corrida: las de sus hilos, las raíces
 * de una fila NUEVA (que se va a repartir), o la de su cursor. Lo pregunta el lote para saber si
 * tiene que leer los hechos del lead (una condición en cualquiera de ellas).
 */
export function nodosDeLaFila(pasos: readonly PasoGrafo[], fila: { hilos?: unknown; nodo_actual?: string | null; paso_actual: number }, indiceDelCursor: number): number[] {
  const hs = sanearHilos(fila.hilos);
  if (hs) return hs.map((x) => indicePorId(pasos, x.nodo)).filter((i) => i >= 0);
  if (esFilaNueva(fila) && raicesSalida(pasos).length > 1) return raicesSalida(pasos).map((r) => indicePorId(pasos, r)).filter((i) => i >= 0);
  return indiceDelCursor >= 0 ? [indiceDelCursor] : [];
}

/** Una fila que nunca avanzó: así la dejan los cinco lugares que inscriben (y el reuso). */
export const esFilaNueva = (fila: { hilos?: unknown; nodo_actual?: string | null; paso_actual: number }): boolean =>
  sanearHilos(fila.hilos) == null && (fila.nodo_actual == null || fila.nodo_actual === '') && Number(fila.paso_actual) === 0;

/**
 * El primer envío de una inscripción NUEVA: el MÍNIMO entre las raíces (la principal y las flechas
 * en paralelo del CRON). Con una sola raíz es la programación de siempre de la entrada. Lo usan los
 * lugares que inscriben (`proximoDeEntrada` en vez de `proximoEnvioDePaso(pasoDeEntrada(…))`): con
 * la de la principal sola, un hilo de email «ya» detrás de una principal «en 2 h» esperaba 2 h.
 */
export function proximoDeEntrada<P extends PasoGrafo>(pasos: readonly P[], proximoDe: (p: P | undefined) => string): string {
  const raices = raicesSalida(pasos);
  if (!raices.length) return proximoDe(undefined);
  const todos = raices.map((r) => proximoDe(pasos[indicePorId(pasos, r)]));
  return todos.reduce((a, b) => (ms(b) < ms(a) ? b : a));
}

/**
 * El MENSAJE del que cuelga una tarjeta, subiendo por las de control (una condición, una espera, el
 * inicio). -1 = no hay ninguno arriba (es la primera del hilo) o arriba hay una acción.
 *
 * Lo pregunta una ACCIÓN antes de correr: espera el borrador de SU mensaje anterior, no el de
 * cualquier hilo del lead (decisión de la segunda tanda, R4 §3.6). Con un solo cursor el motor
 * sigue mirando «cualquier borrador del lead», como siempre.
 */
export function mensajeAnteriorDe(pasos: readonly PasoGrafo[], idx: number): number {
  const vistos = new Set<string>();
  let cur = pasos[idx] ? idDe(pasos[idx], idx) : null;
  while (cur && !vistos.has(cur)) {
    vistos.add(cur);
    const pa = padreDe(pasos, cur);
    if (!pa) return -1;
    const j = indicePorId(pasos, pa.id);
    const c = j >= 0 ? claseDe(pasos[j]) : null;
    if (c === 'mensaje') return j;
    if (c !== 'condicion' && c !== 'esperar' && c !== 'inicio') return -1;
    cur = pa.id;
  }
  return -1;
}
