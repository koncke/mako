// =============================================================================
// landing-snapshot — lo que la landing TENÍA la última vez que la miramos
// =============================================================================
// El analizador (lib/landing-analisis.ts) contesta «qué tiene esta página HOY».
// Corría en un solo lugar, en un efecto de React, y el resultado se tiraba al
// desmontar el componente. Con eso, MaKo no podía contestar la pregunta que el
// dueño hizo: «una landing puede NO tener VSL en un principio y luego que los
// dueños le agreguen un VSL, MaKo debería en todo momento saber eso».
//
// No se puede saber que algo CAMBIÓ sin un «antes». Esto es el antes.
//
// ⚠️ POR QUÉ NO VA ADENTRO DE `landing.config`. Esa la escribe la persona desde
// el modal con read-modify-write del JSON entero (`setSetting(CONFIG_KEY, ...)`).
// El cron escribe acá sin sesión y en otro momento. Compartiendo clave, un cron
// que corre mientras alguien borra una landing le devuelve la landing borrada, o
// le pisa el `clarityProjectId` que acaba de cargar. Son dos escritores con dos
// ritmos: son dos claves.
//
// ⚠️ Y LA CLAVE DEL MAPA ES LA URL NORMALIZADA CON `normalizarUrl`, la MISMA que
// usa `landing.config`. Un mapa keyeado por un dato derivado solo sirve si las
// dos puntas derivan igual; con dos normalizaciones distintas el cruce falla en
// silencio y el snapshot queda huérfano — se ve como «esta landing nunca se
// analizó» sobre una que se analiza todos los días.
//
// Sin `server-only`: lo que se puede equivocar es el saneo y la REGLA DE LOS DOS
// TIEMPOS, y tiene que poder testearse sin base de datos.
// =============================================================================

import { normalizarUrl } from './landing-paginas';
import { MAX_LANDINGS } from './landing-config';
import { DETECTORES_VERSION, HOSTS_VIDEO, desdeDePieza } from './landing-analisis';

export const SNAPSHOT_KEY = 'landing.snapshot';

/** Lo que sabemos de UNA página. */
export type SnapshotLanding = {
  /** Las piezas que se dan por CIERTAS. */
  piezas: string[];
  /** Cuándo fue la última lectura BUENA (ISO). Nunca se actualiza con un fallo. */
  visto: string;
  /**
   * Piezas que faltaron en la última lectura y todavía NO se dan por sacadas.
   * Es el purgatorio de la regla de los dos tiempos (ver `aplicarLectura`).
   */
  dudosas?: string[];
  /**
   * La versión del CATÁLOGO DE DETECTORES con la que se tomó esta foto.
   *
   * ⚠️ SIN ESTO, ENSEÑARLE A MaKo UN HOST NUEVO LE MIENTE AL CLIENTE. El snapshot
   * del ws13 decía `["botones","embed-agenda"]` porque el analizador no sabía ver
   * Wistia; el día que aprendió, su VSL —que estaba desde el principio— aparecía
   * como una pieza NUEVA, y el cron le manda «Le agregaste un video a tu página.
   * Ya lo estoy midiendo»: falso dos veces, porque además no se mide hasta que
   * reemplace su copia del código. Con dos URLs declaradas para la misma página,
   * eran dos WhatsApps.
   *
   * Ausente = 1 (los snapshots que ya existían, de antes de que esto existiera).
   */
  det?: number;
};

export type Snapshots = Record<string, SnapshotLanding>;

/** Qué cambió entre el antes y el ahora. */
export type Cambios = {
  nuevas: string[];
  sacadas: string[];
  /** Cuándo fue el «antes». null = no había antes, así que no hay nada que contar. */
  desde: string | null;
};

export const SIN_CAMBIOS: Cambios = { nuevas: [], sacadas: [], desde: null };
export const hayCambios = (c: Cambios): boolean => c.nuevas.length > 0 || c.sacadas.length > 0;

const textos = (v: unknown, max: number): string[] => {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const s = typeof x === 'string' ? x.trim().slice(0, 40) : '';
    if (s && !out.includes(s)) out.push(s);
  }
  return out.slice(0, max);
};

const fecha = (v: unknown): string => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s && Number.isFinite(Date.parse(s)) ? s : '';
};

/** Nunca lanza: un snapshot corrupto es «no hay antes», no una pantalla rota. */
export function parsearSnapshots(crudo: string | null): Snapshots {
  if (!crudo?.trim()) return {};
  let v: unknown;
  try { v = JSON.parse(crudo); } catch { return {}; }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Snapshots = {};
  let n = 0;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (n >= MAX_LANDINGS) break;
    const url = normalizarUrl(k);
    if (!url || out[url]) continue;
    const o = (val && typeof val === 'object' ? val : {}) as Record<string, unknown>;
    const visto = fecha(o.visto);
    if (!visto) continue; // sin fecha de lectura buena no es un «antes» utilizable
    const piezas = textos(o.piezas, 20);
    const dudosas = textos(o.dudosas, 20).filter((d) => piezas.includes(d));
    // ⚠️ TODO CAMPO NUEVO HAY QUE CONSERVARLO ACÁ. Este parser reconstruye la fila
    // campo por campo, así que uno que se agregue al tipo y no se lea acá se pierde
    // en la lectura siguiente — y un `det` que siempre vuelve ausente hace que el
    // re-baseline silencioso se repita para siempre (o nunca), según el default.
    const det = typeof o.det === 'number' && Number.isFinite(o.det) && o.det >= 1 ? Math.floor(o.det) : 1;
    out[url] = { piezas, visto, det, ...(dudosas.length ? { dudosas } : {}) };
    n++;
  }
  return out;
}

export const snapshotDe = (m: Snapshots, url: string | null | undefined): SnapshotLanding | null => {
  const u = url ? normalizarUrl(url) : '';
  return u ? m[u] ?? null : null;
};

/**
 * Aplica UNA lectura buena y dice qué cambió.
 *
 * ⚠️ LA ASIMETRÍA ES EL CORAZÓN DE ESTE MÓDULO, y no es una preferencia estética:
 *
 *   · APARECER se cree a la primera. Un `<video>` no se alucina: si el detector
 *     lo encontró, está. Y si por algún motivo se equivocara, el costo es un
 *     renglón de más que se corrige solo en la lectura siguiente.
 *
 *   · DESAPARECER necesita DOS lecturas buenas seguidas. El analizador se queda
 *     sin decir nada por media docena de motivos que no tienen NADA que ver con
 *     que el cliente haya tocado su página: el CDN devolvió una versión cacheada
 *     (medido en la landing del ws13: `X-Vercel-Cache: HIT` con `Age` de casi 4
 *     horas), un chunk del bundle tardó más que el timeout, el host contestó 403
 *     a un user-agent que no reconoce. Decirle a un cliente «sacaste el video de
 *     tu landing» cuando lo único que pasó es que un chunk tardó no es un aviso
 *     equivocado: es el aviso que le enseña a ignorar todos los demás.
 *
 * Y la tercera regla, que vive en el llamador y por eso esta función NO tiene
 * rama de error: una lectura FALLIDA no llega hasta acá. No hay que llamar a
 * `aplicarLectura` con las piezas vacías de un timeout — eso convertiría «no sé»
 * en «no tiene», que es exactamente la confusión que este repo ya pagó cara.
 */
export function aplicarLectura(
  previo: SnapshotLanding | null,
  leidas: readonly string[],
  ahora: string,
  /** La versión del catálogo de detectores con la que se hizo ESTA lectura. */
  det: number = DETECTORES_VERSION,
): { snapshot: SnapshotLanding; cambios: Cambios } {
  const ahoraLimpio = fecha(ahora) || new Date(0).toISOString();
  const hoy = textos([...leidas], 20);

  // Sin un antes no hay diff: se estrena el snapshot y no se anuncia nada. La
  // primera vez que miramos una página, todo lo que tiene es «nuevo» para
  // nosotros y nada de eso es un cambio que el cliente haya hecho.
  if (!previo) return { snapshot: { piezas: hoy, visto: ahoraLimpio, det }, cambios: SIN_CAMBIOS };

  const antesDudosas = previo.dudosas ?? [];
  // ⚠️ LO QUE TRAJO UN DETECTOR NUEVO SE ABSORBE EN SILENCIO. Una pieza que este
  // catálogo aprendió a ver DESPUÉS de la foto anterior no es un cambio que el
  // cliente haya hecho en su página: es un cambio nuestro. Anunciarla manda «le
  // agregaste un video» sobre un VSL que estaba desde el principio (el caso del
  // ws13 con Wistia). Se incorpora a las piezas, sin aviso, y la próxima vez ya
  // forma parte del «antes» — así un cambio REAL de esa misma pieza sí se anuncia.
  const detPrevio = previo.det ?? 1;
  const aprendida = (p: string): boolean => desdeDePieza(p) > detPrevio;
  const nuevas = hoy.filter((p) => !previo.piezas.includes(p) && !aprendida(p));
  const absorbidas = hoy.filter((p) => !previo.piezas.includes(p) && aprendida(p));
  const faltan = previo.piezas.filter((p) => !hoy.includes(p));

  // Confirmadas: las que faltan por SEGUNDA vez seguida.
  const sacadas = faltan.filter((p) => antesDudosas.includes(p));
  // En purgatorio: las que faltan por primera vez. Siguen contando como presentes.
  const dudosas = faltan.filter((p) => !antesDudosas.includes(p));

  const piezas = [...previo.piezas.filter((p) => !sacadas.includes(p)), ...nuevas, ...absorbidas];
  const snapshot: SnapshotLanding = {
    piezas, visto: ahoraLimpio, det,
    ...(dudosas.length ? { dudosas } : {}),
  };

  return { snapshot, cambios: { nuevas, sacadas, desde: previo.visto } };
}

// ── Cómo se le NOMBRA al cliente lo que cambió ──────────────────────────────
// Vive acá, con el diff, para que la pantalla y el aviso digan lo mismo. Dos
// listas de nombres separadas se desincronizan a la primera pieza nueva.

// ⚠️ LOS DE VIDEO SALEN DEL CATÁLOGO. Esta lista era la sexta copia de la misma
// enumeración, y su falla era muda de una forma particular: `nombresDe` descarta
// sin decir nada la pieza que no tiene nombre, así que una pieza registrada en el
// filtro del cron pero no acá NO produce aviso — ni el falso ni el verdadero.
const NOMBRES: Record<string, string> = {
  ...Object.fromEntries(HOSTS_VIDEO.map((h) => [h.pieza, h.nombre])),
  formulario: 'un formulario',
  'embed-agenda': 'una agenda para reservar',
  'link-whatsapp': 'un botón de WhatsApp',
  botones: 'botones',
};

/**
 * Las piezas que se ANUNCIAN. `pixel` queda afuera a propósito, y no por ruido:
 * el detector lo busca solo en el HTML crudo, así que una landing que lo inyecta
 * desde un bundle o por GTM «pierde el pixel» en cada lectura. Y la pregunta que
 * el cliente necesita —¿siguen llegando mis datos?— ya la contesta el cron
 * `tracking-apagado`, que la mide en vez de inferirla de un HTML.
 */
export const nombrePieza = (p: string): string | null => NOMBRES[p] ?? null;

export const nombresDe = (piezas: readonly string[]): string[] =>
  piezas.map(nombrePieza).filter((n): n is string => !!n);

/** «un video», «un video y un formulario», «un video, botones y una agenda». */
export function enumerar(nombres: readonly string[]): string {
  if (nombres.length === 0) return '';
  if (nombres.length === 1) return nombres[0];
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

/** «hace 6 días», «hace unas horas». Sin librería: es una sola frase. */
export function haceCuanto(desde: string | null, ahora: Date = new Date()): string {
  if (!desde) return '';
  const ms = ahora.getTime() - Date.parse(desde);
  if (!Number.isFinite(ms) || ms < 0) return '';
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return 'hace un rato';
  if (h < 24) return `hace ${h} hora${h === 1 ? '' : 's'}`;
  const d = Math.floor(h / 24);
  return `hace ${d} día${d === 1 ? '' : 's'}`;
}

/** Guarda el snapshot de una página. Poda lo que ya no está declarado. */
export function conSnapshot(
  actuales: Snapshots,
  url: string,
  snapshot: SnapshotLanding,
  vigentes?: readonly string[],
): Snapshots {
  const u = normalizarUrl(url);
  if (!u) return actuales;
  const vivas = vigentes?.map((v) => normalizarUrl(v)).filter(Boolean);
  const out: Snapshots = {};
  for (const [k, v] of Object.entries(actuales)) {
    // Una página que el cliente borró de su lista deja de ocupar lugar. Pero si
    // no nos pasaron la lista vigente, no se poda nada: no saber cuáles siguen
    // vivas no autoriza a borrar.
    if (k !== u && vivas && !vivas.includes(k)) continue;
    out[k] = v;
  }
  out[u] = snapshot;
  return out;
}
