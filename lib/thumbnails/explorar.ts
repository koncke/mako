// =============================================================================
// thumbnails/explorar — las miniaturas de YouTube que mejor rinden, para copiar su diseño (Image, `?que=thumbnails`, 6/11/2026)
// =============================================================================
// Martín, 6/11/2026: «También quisiera una tab que sea "Thumbnails", para traer de la misma manera miniaturas top en el mercado,
// estoy seguro que debe haber una API o un repo o algo que traiga eso». Es la tercera opción de «Carruseles · Anuncios ·
// Thumbnails» del explorador de Image (app/image-editor/carruseles/ExplorarCarruseles.tsx): la misma pantalla, su tarjeta 16:9.
//
// DE DÓNDE SALEN (docs/carruseles/thumbnails.md tiene la comparación): de la YouTube Data API OFICIAL, con la clave de la
// plataforma, cargada desde la PC (scripts/thumbnails-biblioteca.mts) a una biblioteca global (mig 0409), como la de carruseles:
// una lista de CANALES por rubro de dueño de negocio (ventas, marketing, emprendimiento, servicios) y sus videos largos. La
// imagen NO se guarda ni se baja: se dibuja la de `i.ytimg.com` del video, con el link a YouTube (lo que piden sus términos).
//
// ⚠️ EL MÚLTIPLO ESPERA SU TRÁMITE CON YOUTUBE. Los Developer Policies (III.E.4.h) prohíben «a score that factors in likes, total
// views» salvo con la enmienda III.L (`ENMIENDA_III_L`, lib/spy-reglas.ts). El número es el de toda la app (`multiplosDe`,
// lib/multiplo-rendimiento.ts: las vistas del video frente a la mediana de sus videos largos más cercanos en el tiempo, con 7
// como mínimo), y mientras el interruptor esté apagado contesta «falta-enmienda»: la tarjeta muestra las VISTAS (dato de
// YouTube), el orden por defecto es «Más vistas» y el filtro del múltiplo no se ofrece. El día que se firme, sale solo.
//
// ⚠️ TREINTA DÍAS. Sin la enmienda, lo que se guarda de la API (títulos, vistas) vence a los 30 días: lo leído hace más no se
// muestra (`vigente`) y el script lo borra (`podar`).
//
// Puro (sin `server-only`): lo usan el lector (./servidor.ts), la pantalla, la API de MaKo y los tests
// (tests/thumbnails-explorar.test.ts).
// =============================================================================

import { ENMIENDA_III_L } from '../spy-reglas';
import { multiplosDe, rotuloMultiplo, type Multiplo } from '../multiplo-rendimiento';
import { plano } from '../carruseles/texto';
import { conVariedad } from '../carruseles/variedad';

// Las listas (rubros, idiomas, períodos, órdenes) viven en ../carruseles/opciones.ts, sin dependencias: las importa la API de MaKo
// (lib/api-mako/areas/imagen.def.ts). Acá se re-exportan.
import { IDIOMAS_THUMBNAIL, NICHOS_THUMBNAIL, ORDENES_THUMBNAIL, PERIODOS_THUMBNAIL, type IdiomaThumbnail, type NichoThumbnail, type OrdenThumbnail, type PeriodoThumbnail } from '../carruseles/opciones';
export { IDIOMAS_THUMBNAIL, NICHOS_THUMBNAIL, ORDENES_THUMBNAIL, PERIODOS_THUMBNAIL, type IdiomaThumbnail, type NichoThumbnail, type OrdenThumbnail, type PeriodoThumbnail };

/** Lo que ofrece la pantalla hoy (sin la enmienda, sin «Mayor múltiplo»). */
export const ordenesDisponibles = (conMultiplo = ENMIENDA_III_L) => ORDENES_THUMBNAIL.filter((o) => conMultiplo || o.value !== 'outlier');
/** El orden de entrada: el múltiplo si se puede calcular; si no, las vistas (un dato de YouTube, no una cuenta nuestra). */
export const ORDEN_INICIAL_THUMBNAIL: OrdenThumbnail = ENMIENDA_III_L ? 'outlier' : 'vistas';

const DIA = 86_400_000;
/** Cuánto vale lo leído de la API sin la enmienda III.L (Developer Policies III.E.4.b). */
export const DIAS_VIGENTE = 30;

export type Thumbnail = {
  /** La fila (`thumbnails_videos.id`). */
  id: number;
  /** El id del video en YouTube (11 caracteres). */
  video: string;
  /** El canal: la fila de la biblioteca (para filtrar y repartir) y lo que se dibuja. */
  canalId: number;
  canal: { nombre: string; handle: string | null; foto: string | null };
  titulo: string | null;
  publicado: string | null;
  duracion: string | null;
  vistas: number | null;
  megusta: number | null;
  comentarios: number | null;
  nicho: NichoThumbnail | null;
  idioma: IdiomaThumbnail | null;
  /** Cuántas veces lo que suele hacer su canal: null sin la enmienda o sin datos (y `multiplo` dice por qué). */
  outlier: number | null;
  multiplo?: Multiplo;
};

/** Las filas como se leen de la base (mig 0409). */
export type FilaVideo = {
  id: number; video_id: string; canal_id: number; titulo: string | null; publicado_en: string | null; duracion: string | null;
  vistas: number | null; megusta: number | null; comentarios: number | null; leido_en: string; oculto?: boolean | null;
};
export type FilaCanal = {
  id: number; canal_id: string; nombre: string; handle: string | null; foto: string | null; nicho: string | null; idioma: string | null;
  estado?: string | null;
};

const ID_VIDEO = /^[A-Za-z0-9_-]{11}$/;
export const esIdDeVideo = (v: unknown): v is string => typeof v === 'string' && ID_VIDEO.test(v);

/** La imagen del video en YouTube (no se guarda: se dibuja la suya). `hq` siempre existe; `maxres` no en todos. */
export const imagenDeVideo = (video: string, tamano: 'hq' | 'max' = 'hq'): string =>
  `https://i.ytimg.com/vi/${encodeURIComponent(video)}/${tamano === 'max' ? 'maxresdefault' : 'hqdefault'}.jpg`;
export const urlDeVideo = (video: string): string => `https://www.youtube.com/watch?v=${encodeURIComponent(video)}`;

const unoDe = <T extends string>(v: unknown, lista: readonly { value: T }[]): T | null => (lista.find((x) => x.value === v)?.value ?? null);

/** ¿Lo leído sigue vigente? (30 días sin la enmienda). Sin fecha, no. */
export function vigente(leidoEn: string | null | undefined, ahora = Date.now()): boolean {
  const t = Date.parse(leidoEn ?? '');
  return Number.isFinite(t) && ahora - t <= DIAS_VIGENTE * DIA;
}

/** El corte de vigencia: lo leído ANTES de esto ya no se muestra y hay que borrarlo (`podar`). */
export const limiteDeVigencia = (ahora: number = Date.now()): string => new Date(ahora - DIAS_VIGENTE * DIA).toISOString();

/**
 * ¿Alcanza esta cadencia de renovación para que la galería nunca se vea vacía por vencimiento? Pide que entren DOS corridas
 * antes del vencimiento, no una: con una sola oportunidad, cualquier corrida que falle (la cuota de YouTube, un 403, el deploy
 * caído) vacía la pantalla y nadie se entera. Vive acá, con `DIAS_VIGENTE`, porque es una propiedad de la regla de los 30 días
 * — y acá no hay `server-only`, así que la prueba el test (lib/thumbnails/renovar.ts la usa; tests/thumbnails-renovar.test.ts).
 */
export const cadenciaAlcanza = (diasEntreCorridas: number): boolean =>
  Number.isFinite(diasEntreCorridas) && diasEntreCorridas > 0 && diasEntreCorridas * 2 <= DIAS_VIGENTE;

/**
 * Cada cuántos días dispara un schedule de cron de Vercel, para las formas que usamos (cada tantos minutos u horas, un día de
 * la semana, un día del mes). `null` si no lo sabe leer: quien pregunte decide qué hacer con eso, y no se devuelve un número
 * tranquilizador inventado. El día del mes vale 31, que es el PEOR caso — y es justo el que no alcanza.
 */
export function diasEntreCorridas(schedule: string): number | null {
  const campos = schedule.trim().split(/\s+/);
  if (campos.length !== 5) return null;
  const [, , dia, mes, semana] = campos;
  if (mes !== '*') return null;
  if (dia === '*' && semana === '*') return 1;
  if (dia === '*' && /^[0-6]$/.test(semana)) return 7;
  if (/^(?:[1-9]|1\d|2\d|3[01])$/.test(dia) && semana === '*') return 31;
  return null;
}

/** Un Short (hasta 3 minutos) no es una miniatura que se diseñe: se dibuja el cuadro del video. */
export function esCorto(duracion: string | null): boolean {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duracion ?? '');
  if (!m) return false;
  const s = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return s > 0 && s <= 180;
}

/**
 * Las miniaturas de la biblioteca: sólo videos largos de canales activos, leídos hace menos de 30 días y no escondidos, cada uno
 * con su múltiplo (calculado sobre TODOS los de su canal, también los que no se muestran: el mismo número que diría Spy).
 */
export function thumbnailsDe(videos: readonly FilaVideo[], canales: readonly FilaCanal[], ahora = Date.now()): Thumbnail[] {
  const porId = new Map(canales.filter((c) => (c.estado ?? 'activo') === 'activo').map((c) => [c.id, c]));
  const vivos = videos.filter((v) => porId.has(v.canal_id) && esIdDeVideo(v.video_id) && vigente(v.leido_en, ahora));
  const multiplos = multiplosDe(vivos.map((v) => ({
    id: v.id, competidor_id: v.canal_id, canal: 'youtube', tipo: 'video', duracion: v.duracion, publicada_en: v.publicado_en,
    vistas: v.vistas, megusta: v.megusta, comentarios: v.comentarios, titulo: v.titulo,
  })), ahora);
  const out: Thumbnail[] = [];
  for (const v of vivos) {
    if (v.oculto || esCorto(v.duracion)) continue;
    const c = porId.get(v.canal_id)!;
    const m = multiplos.get(v.id);
    out.push({
      id: v.id, video: v.video_id, canalId: c.id,
      canal: { nombre: c.nombre, handle: c.handle, foto: c.foto },
      titulo: v.titulo, publicado: v.publicado_en, duracion: v.duracion,
      vistas: v.vistas, megusta: v.megusta, comentarios: v.comentarios,
      nicho: unoDe(c.nicho, NICHOS_THUMBNAIL), idioma: unoDe(c.idioma, IDIOMAS_THUMBNAIL),
      outlier: m?.veces ?? null, multiplo: m,
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtros, orden y la URL
// ─────────────────────────────────────────────────────────────────────────────

export type FiltrosThumbnail = {
  /** Palabras del título, o un @canal. */
  q: string;
  nicho: NichoThumbnail | '';
  idioma: IdiomaThumbnail | '';
  periodo: PeriodoThumbnail;
  /** El múltiplo mínimo y máximo (0 = sin tope). Sólo cuentan con la enmienda. */
  outlierMin: number;
  outlierMax: number;
  orden: OrdenThumbnail;
  /** Los canales elegidos (filas de la biblioteca). */
  canales: number[];
  vista: 'todos' | 'guardados';
};

export const FILTROS_THUMBNAIL: FiltrosThumbnail = {
  q: '', nicho: '', idioma: '', periodo: 'todo', outlierMin: 0, outlierMax: 0, orden: ORDEN_INICIAL_THUMBNAIL, canales: [], vista: 'todos',
};

/** Los topes del deslizador del múltiplo (los mismos de los carruseles). */
export const PASOS_MULTIPLO_THUMBNAIL = [0, 1, 2, 3, 4, 6, 10, 25, 50] as const;

export function coincideThumbnail(t: Thumbnail, q: string): boolean {
  const s = plano(q);
  if (!s) return true;
  if (s.startsWith('@')) {
    const u = s.slice(1).replace(/\s+/g, '');
    return !u || plano(t.canal.handle ?? '').replace(/^@/, '').replace(/\s+/g, '').includes(u) || plano(t.canal.nombre).replace(/\s+/g, '').includes(u);
  }
  const donde = plano([t.titulo, t.canal.nombre, t.canal.handle].filter(Boolean).join(' '));
  return s.split(' ').every((p) => donde.includes(p));
}

const fecha = (iso: string | null): number | null => { const t = Date.parse(iso ?? ''); return Number.isFinite(t) ? t : null; };

/** El orden. Lo que no tiene el número va al final (no se afirma un cero). */
export function ordenarThumbnails(xs: readonly Thumbnail[], orden: OrdenThumbnail): Thumbnail[] {
  const clave = (t: Thumbnail): number | null => (orden === 'outlier' ? t.outlier : orden === 'vistas' ? t.vistas : fecha(t.publicado));
  const asc = orden === 'viejos';
  return [...xs].sort((a, b) => {
    const ka = clave(a); const kb = clave(b);
    if (ka == null && kb == null) return (b.vistas ?? -1) - (a.vistas ?? -1) || b.id - a.id;
    if (ka == null) return 1;
    if (kb == null) return -1;
    return (asc ? ka - kb : kb - ka) || (b.vistas ?? -1) - (a.vistas ?? -1) || b.id - a.id;
  });
}

/** Lo que se ve con estos filtros, en su orden y repartido (que un canal no llene la pantalla: lib/carruseles/variedad.ts). */
export function filtrarThumbnails(todos: readonly Thumbnail[], f: FiltrosThumbnail, guardados: ReadonlySet<number>, ahora = Date.now(), conMultiplo = ENMIENDA_III_L): Thumbnail[] {
  const canales = new Set(f.canales);
  const desde = f.periodo === 'todo' ? null : ahora - Number(f.periodo) * DIA;
  const xs = todos.filter((t) => {
    if (f.vista === 'guardados' && !guardados.has(t.id)) return false;
    if (f.nicho && t.nicho !== f.nicho) return false;
    if (f.idioma && t.idioma !== f.idioma) return false;
    if (canales.size && !canales.has(t.canalId)) return false;
    if (desde != null) { const p = fecha(t.publicado); if (p == null || p < desde) return false; }
    if (conMultiplo && f.outlierMin > 0 && (t.outlier == null || t.outlier < f.outlierMin)) return false;
    if (conMultiplo && f.outlierMax > 0 && (t.outlier == null || t.outlier > f.outlierMax)) return false;
    return coincideThumbnail(t, f.q);
  });
  const orden = !conMultiplo && f.orden === 'outlier' ? 'vistas' : f.orden;
  const ordenados = ordenarThumbnails(xs, orden);
  return canales.size || plano(f.q).startsWith('@') ? ordenados : conVariedad(ordenados, (t) => t.canalId);
}

/**
 * ⚠️⚠️ LAS CLAVES DE THUMBNAILS VAN CON PREFIJO `t`, Y SALEN DE ACÁ LAS DOS VECES (8/11/2026).
 *
 * Antes se escribían `q`, `periodo`, `min`, `omax`, `orden`, `de` y `vista` — **exactamente las
 * mismas que lee el explorador de carruseles** (`lib/carruseles/explorar.ts`, `filtrosDeQuery`), y
 * con valores que se solapan: `periodo` 30 y 90 existen en los dos, `vista=guardados` también, y
 * `PASOS_MULTIPLO` y `PASOS_MULTIPLO_THUMBNAIL` son la MISMA lista. Las dos pantallas leen la misma
 * query con las DOS funciones, así que el usuario ponía «Últimos 90 días» y «Guardados» en
 * Thumbnails, copiaba el link, y al abrirlo la pestaña Carruseles aparecía filtrada por 90 días y
 * por Guardados sin que nadie la hubiera tocado. Lo confirmó la revisión de
 * `punta/carruseles-thumbnails`.
 *
 * La tabla es UNA para que el lector y el escritor no se puedan separar: renombrar acá los mueve a
 * los dos. `que` NO lleva prefijo a propósito — es el selector de pestaña y es compartido de verdad.
 */
const CLAVE = {
  q: 'tq', nicho: 'tnicho', idioma: 'tidioma', periodo: 'tperiodo',
  min: 'tmin', omax: 'tomax', orden: 'torden', de: 'tde', vista: 'tvista',
} as const;

/** Los filtros que dice una URL (lo que no se entiende vuelve al valor inicial). */
export function filtrosThumbnailDeQuery(q: URLSearchParams | Record<string, string | string[] | undefined>): FiltrosThumbnail {
  const get = (k: string): string | null => {
    if (q instanceof URLSearchParams) return q.get(k);
    const v = q[k];
    return Array.isArray(v) ? v[0] ?? null : v ?? null;
  };
  const paso = (k: string) => { const n = Number(get(k)); return (PASOS_MULTIPLO_THUMBNAIL as readonly number[]).includes(n) ? n : 0; };
  const canales = (get(CLAVE.de) ?? '').split(',').filter((x) => x.trim() !== '').map(Number).filter((n) => Number.isSafeInteger(n) && n > 0).slice(0, 25);
  return {
    q: (get(CLAVE.q) ?? '').slice(0, 120),
    nicho: unoDe(get(CLAVE.nicho), NICHOS_THUMBNAIL) ?? '',
    idioma: unoDe(get(CLAVE.idioma), IDIOMAS_THUMBNAIL) ?? '',
    periodo: unoDe(get(CLAVE.periodo), PERIODOS_THUMBNAIL) ?? 'todo',
    outlierMin: paso(CLAVE.min),
    outlierMax: paso(CLAVE.omax),
    orden: unoDe(get(CLAVE.orden), ORDENES_THUMBNAIL) ?? ORDEN_INICIAL_THUMBNAIL,
    canales,
    vista: get(CLAVE.vista) === 'guardados' ? 'guardados' : 'todos',
  };
}

/** La query, sólo con lo que no es el valor inicial, más `que=thumbnails` (es la tercera opción del explorador). */
export function queryDeThumbnails(f: FiltrosThumbnail): string {
  const q = new URLSearchParams({ que: 'thumbnails' });
  if (f.q.trim()) q.set(CLAVE.q, f.q.trim());
  if (f.nicho) q.set(CLAVE.nicho, f.nicho);
  if (f.idioma) q.set(CLAVE.idioma, f.idioma);
  if (f.periodo !== 'todo') q.set(CLAVE.periodo, f.periodo);
  if (f.outlierMin) q.set(CLAVE.min, String(f.outlierMin));
  if (f.outlierMax) q.set(CLAVE.omax, String(f.outlierMax));
  if (f.orden !== ORDEN_INICIAL_THUMBNAIL) q.set(CLAVE.orden, f.orden);
  if (f.canales.length) q.set(CLAVE.de, f.canales.join(','));
  if (f.vista !== 'todos') q.set(CLAVE.vista, f.vista);
  return q.toString();
}

export const sinFiltrosThumbnail = (f: FiltrosThumbnail): boolean => queryDeThumbnails(f) === 'que=thumbnails';

/** Los canales que tienen algo, con cuántas miniaturas: el filtro «Cuentas». */
export function canalesDe(todos: readonly Thumbnail[]): Array<{ id: number; nombre: string; handle: string | null; foto: string | null; n: number }> {
  const m = new Map<number, { id: number; nombre: string; handle: string | null; foto: string | null; n: number }>();
  for (const t of todos) {
    const x = m.get(t.canalId) ?? { id: t.canalId, nombre: t.canal.nombre, handle: t.canal.handle, foto: t.canal.foto, n: 0 };
    x.n += 1;
    m.set(t.canalId, x);
  }
  return [...m.values()].sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, 'es'));
}

/** «4,2×» si hay múltiplo; si no, null (la tarjeta muestra las vistas). */
export const rotuloOutlierThumbnail = (t: Pick<Thumbnail, 'outlier'>): string | null => (t.outlier == null ? null : rotuloMultiplo(t.outlier));

/** «12:04» o «1:02:33»: la duración como se lee en YouTube. */
export function duracionLegible(iso: string | null): string | null {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso ?? '');
  if (!m) return null;
  const h = Number(m[1] ?? 0); const min = Number(m[2] ?? 0); const s = Number(m[3] ?? 0);
  if (!h && !min && !s) return null;
  const dos = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${dos(min)}:${dos(s)}` : `${min}:${dos(s)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Guardados (del NEGOCIO, como los de carruseles, en su propio setting: los ids de esta tabla chocarían con los de Spy)
// ─────────────────────────────────────────────────────────────────────────────

export const CLAVE_GUARDADOS_THUMBNAIL = 'thumbnails.guardados';
