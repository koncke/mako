// =============================================================================
// curso — las reglas del curso de un servicio (puro)
// =============================================================================
// Sin 'use client' ni 'server-only' a propósito: lo usan la tab Curso, la ficha del cliente,
// el portal del alumno, las rutas públicas y el cron, y un test lo EJECUTA
// (tests/curso.test.ts). Acá no se lee ni se escribe nada.
//
// Pedido de Martín (06/10/2026): la tab Curso con el programa de Mauricio, los formularios con
// sus tareas, el paso automático de etapa «según las tareas que vayan completando», videos por
// link o subidos midiendo «cuánto del vídeo se vieron», y un acceso especial para sus clientes.
// El modelo y su porqué están en la cabecera de supabase/migrations/0202_curso.sql.

export type VideoTipo = 'ninguno' | 'archivo' | 'youtube' | 'vimeo' | 'loom' | 'drive' | 'url';
export type TipoClase = 'concepto' | 'demostracion' | 'clinica' | 'clase' | 'formulario';
export type EstadoTarea = 'pendiente' | 'enviada' | 'aprobada';

/**
 * Un campo del formulario de una tarea. Es el molde del programa viejo (`lib/programa-campos.ts`
 * en 07d07139^), que traía los 114 campos de los Cuestionarios Maestros de Mauricio con este tipo.
 */
export type CampoTipo = 'texto' | 'linea' | 'numero' | 'eleccion' | 'checks' | 'tabla';
export type Campo = {
  id: string;
  label: string;
  tipo: CampoTipo;
  ayuda?: string;
  opciones?: string[];
  columnas?: string[];
  filasFijas?: string[];
  filasMin?: number;
  obligatorio?: boolean;
};

export type Clase = {
  id: number;
  productoId: number;
  etapa: string;
  orden: number;
  titulo: string;
  descripcion: string;
  tipo: TipoClase;
  minutos: number | null;
  videoTipo: VideoTipo;
  videoUrl: string | null;
  videoPath: string | null;
  tarea: string;
  campos: Campo[];
  obligatoria: boolean;
};

/** Un valor de un campo: texto, varias opciones, o una tabla (filas x columnas). */
export type ValorCampo = string | string[] | string[][];
export type Valores = Record<string, ValorCampo>;

export type Progreso = {
  claseId: number;
  segundosMax: number;
  duracionSeg: number | null;
  pct: number;
  vistoAt: string | null;
  valores: Valores;
  estado: EstadoTarea;
  enviadaAt: string | null;
};

// ── El video ──────────────────────────────────────────────────────────────────

export type VideoReconocido = {
  tipo: Exclude<VideoTipo, 'ninguno' | 'archivo'>;
  /** El id del video en su plataforma (YouTube, Vimeo, Loom, Drive). */
  id: string | null;
  /**
   * El hash de privacidad de un Vimeo NO LISTADO (`vimeo.com/<id>/<hash>` o `?h=<hash>`). Sin él,
   * el reproductor embebido contesta «este video no existe»: el id solo no alcanza.
   */
  hash?: string | null;
  /** La URL limpia que se guarda. */
  url: string;
  /**
   * ¿Se puede MEDIR cuánto se vio? YouTube y Vimeo tienen API de reproductor; un archivo
   * directo (.mp4/.webm) se reproduce con `<video>`. Drive y Loom se muestran en un iframe que
   * no expone el tiempo: se ven, pero el % no se puede medir (lo probó lib/landing-analisis.ts
   * para Drive). La pantalla lo DICE en vez de mostrar un 0% que se lee como «no lo vio».
   */
  medible: boolean;
};

/**
 * Reconoce un link de video. `null` = no es un link (vacío o no es http/https).
 *
 * ⚠️ SÓLO http/https: lo que se guarda acá termina en el `src` de un iframe que ve el cliente,
 * y un `javascript:` ahí es un script corriendo en su navegador.
 */
export function videoDeLink(raw: string | null | undefined): VideoReconocido | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.replace(/^www\.|^m\./, '').toLowerCase();
  const limpia = u.toString();

  if (host === 'youtu.be') {
    const id = u.pathname.split('/').filter(Boolean)[0] ?? null;
    return { tipo: 'youtube', id, url: limpia, medible: Boolean(id) };
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const partes = u.pathname.split('/').filter(Boolean);
    const id = u.searchParams.get('v')
      ?? (['embed', 'shorts', 'live', 'v'].includes(partes[0] ?? '') ? partes[1] ?? null : null);
    return { tipo: 'youtube', id, url: limpia, medible: Boolean(id) };
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const partes = u.pathname.split('/').filter(Boolean);
    const i = partes.findIndex((p) => /^\d+$/.test(p));
    const id = i >= 0 ? partes[i] : null;
    const crudo = u.searchParams.get('h') ?? (i >= 0 ? partes[i + 1] ?? null : null);
    const hash = crudo && /^[0-9a-f]{6,40}$/i.test(crudo) ? crudo : null;
    return { tipo: 'vimeo', id, hash, url: limpia, medible: Boolean(id) };
  }
  if (host === 'loom.com') {
    const partes = u.pathname.split('/').filter(Boolean);
    const id = ['share', 'embed'].includes(partes[0] ?? '') ? partes[1] ?? null : null;
    return { tipo: 'loom', id, url: limpia, medible: false };
  }
  if (host === 'drive.google.com') {
    const m = u.pathname.match(/\/file\/d\/([^/]+)/);
    const id = m?.[1] ?? u.searchParams.get('id');
    return { tipo: 'drive', id, url: limpia, medible: false };
  }
  // Un archivo directo se reproduce con `<video>` y se mide como uno subido.
  const directo = /\.(mp4|webm|m4v|mov)$/i.test(u.pathname);
  return { tipo: 'url', id: null, url: limpia, medible: directo };
}

/** La URL para un iframe de un video reconocido. `null` = va con `<video>` o no tiene. */
export function embedDe(v: VideoReconocido): string | null {
  if (!v.id && v.tipo !== 'url') return null;
  switch (v.tipo) {
    case 'youtube': return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.id!)}?enablejsapi=1&rel=0&modestbranding=1`;
    case 'vimeo': return `https://player.vimeo.com/video/${encodeURIComponent(v.id!)}${v.hash ? `?h=${encodeURIComponent(v.hash)}` : ''}`;
    case 'loom': return `https://www.loom.com/embed/${encodeURIComponent(v.id!)}`;
    case 'drive': return `https://drive.google.com/file/d/${encodeURIComponent(v.id!)}/preview`;
    case 'url': return null;
  }
}

/**
 * El % visto: lo más lejos que llegó sobre lo que dura, entero y topeado en 100.
 *
 * ⚠️ «Lo más lejos que llegó», no «el tiempo que estuvo mirando»: adelantar hasta el final cuenta
 * como visto. Es la misma medida que la retención del VSL (lib/vsl-retencion.ts) y la única que
 * todos los reproductores pueden dar. Sin duración no hay %: se devuelve 0 y la pantalla dice
 * «sin medir», no «0%».
 */
export function pctVisto(segundosMax: number, duracionSeg: number | null | undefined): number {
  if (!duracionSeg || !Number.isFinite(duracionSeg) || duracionSeg <= 0) return 0;
  if (!Number.isFinite(segundosMax) || segundosMax <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((segundosMax / duracionSeg) * 100)));
}

/** A partir de qué % un video cuenta como visto: los últimos segundos suelen ser el cierre. */
export const PCT_VISTO = 90;

// ── El reproductor de una clase (la tab, la ficha y el portal preguntan acá) ──

/**
 * Qué reproductor lleva una clase. Viaja al navegador del alumno, así que es lo MÍNIMO:
 *   · `archivo`  → `<video>` contra /api/compartido/curso/video (que valida y redirige a una URL
 *                  firmada de vida corta). Nunca viaja la ruta del bucket.
 *   · `directo`  → `<video>` sobre un .mp4/.webm público. Se mide igual que uno subido.
 *   · `youtube`  → IFrame API. Se mide.
 *   · `vimeo`    → Player API. Se mide.
 *   · `iframe`   → Loom o Drive: se ve, pero no expone el tiempo. «Sin medir».
 *   · `afuera`   → un link que no es ninguna de las anteriores: se abre en otra pestaña. «Sin medir».
 */
export type VideoVista =
  | { tipo: 'archivo' }
  | { tipo: 'directo'; url: string }
  | { tipo: 'youtube'; id: string }
  | { tipo: 'vimeo'; embed: string }
  | { tipo: 'iframe'; embed: string }
  | { tipo: 'afuera'; url: string };

/**
 * El reproductor de una clase, desde lo guardado.
 *
 * ⚠️ EL LINK SE VUELVE A RECONOCER ACÁ, no se confía en `video_tipo`: lo guardado termina en el
 * `src` de un iframe en el navegador del cliente, y `videoDeLink` es lo único que garantiza
 * http/https (un `javascript:` ahí es un script corriendo en su navegador). Lo que no reconoce
 * no se dibuja. La plataforma también sale del link y no de la columna: un link de Drive
 * guardado como 'youtube' no se manda a la IFrame API de YouTube.
 */
export function reproductorDeClase(c: Pick<Clase, 'videoTipo' | 'videoUrl' | 'videoPath'>): { video: VideoVista | null; medible: boolean } {
  if (c.videoTipo === 'ninguno') return { video: null, medible: false };
  if (c.videoTipo === 'archivo') return c.videoPath ? { video: { tipo: 'archivo' }, medible: true } : { video: null, medible: false };
  const v = videoDeLink(c.videoUrl);
  if (!v) return { video: null, medible: false };
  if (v.tipo === 'youtube') return v.id ? { video: { tipo: 'youtube', id: v.id }, medible: true } : { video: { tipo: 'afuera', url: v.url }, medible: false };
  if (v.tipo === 'url') return v.medible ? { video: { tipo: 'directo', url: v.url }, medible: true } : { video: { tipo: 'afuera', url: v.url }, medible: false };
  const embed = embedDe(v);
  if (!embed) return { video: { tipo: 'afuera', url: v.url }, medible: false };
  if (v.tipo === 'vimeo') return { video: { tipo: 'vimeo', embed }, medible: true };
  return { video: { tipo: 'iframe', embed }, medible: false };
}

// ── La tarea ──────────────────────────────────────────────────────────────────

/** ¿La clase pide algo? Una instrucción de llenado o un formulario. */
export const tieneTarea = (c: Pick<Clase, 'tarea' | 'campos'>): boolean =>
  c.tarea.trim().length > 0 || c.campos.length > 0;

/** Las tareas que cuentan para cerrar la etapa: marcadas obligatorias Y que piden algo. */
export const obligatoriasDe = <T extends Pick<Clase, 'obligatoria' | 'tarea' | 'campos'>>(clases: readonly T[]): T[] =>
  clases.filter((c) => c.obligatoria && tieneTarea(c));

const enviada = (e: EstadoTarea | undefined) => e === 'enviada' || e === 'aprobada';

/**
 * ¿El cliente completó la etapa? = ENVIÓ todas sus tareas obligatorias.
 *
 * ⚠️ UNA ETAPA SIN OBLIGATORIAS NO SE COMPLETA SOLA, a propósito: «nada que hacer» no es «ya
 * terminó». Si se tomara como completa, un cliente que entra a una etapa sin tareas cargadas
 * saltaría a la siguiente en el acto, y de ahí a la otra, hasta la primera que tenga algo —
 * sin haber visto nada. Ahí lo mueve Mauricio a mano.
 */
export function etapaCompleta<T extends Pick<Clase, 'id' | 'obligatoria' | 'tarea' | 'campos'>>(
  clasesDeEtapa: readonly T[],
  estadoDe: (claseId: number) => EstadoTarea | undefined,
): boolean {
  const ob = obligatoriasDe(clasesDeEtapa);
  return ob.length > 0 && ob.every((c) => enviada(estadoDe(c.id)));
}

/** Las tareas de la etapa que todavía no envió, en el orden de la etapa. */
export function pendientesDe<T extends Pick<Clase, 'id' | 'tarea' | 'campos'>>(
  clasesDeEtapa: readonly T[],
  estadoDe: (claseId: number) => EstadoTarea | undefined,
): T[] {
  return clasesDeEtapa.filter((c) => tieneTarea(c) && !enviada(estadoDe(c.id)));
}

/** La etapa que sigue a `actual` en el orden de la entrega. `null` = era la última (o no existe). */
export function etapaSiguiente(etapas: readonly string[], actual: string): string | null {
  const i = etapas.indexOf(actual);
  return i >= 0 && i + 1 < etapas.length ? etapas[i + 1] : null;
}

// ── Lo que se guarda: saneo ────────────────────────────────────────────────────

const TIPOS_CAMPO: readonly CampoTipo[] = ['texto', 'linea', 'numero', 'eleccion', 'checks', 'tabla'];
const corta = (s: unknown, n: number): string => (typeof s === 'string' ? s.trim().slice(0, n) : '');

/** Los campos de un formulario, como los manda la pantalla de Mauricio. Lo que no cierra se tira. */
export function sanearCampos(raw: unknown): Campo[] {
  if (!Array.isArray(raw)) return [];
  const vistos = new Set<string>();
  const out: Campo[] = [];
  for (const x of raw.slice(0, 60)) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const id = corta(o.id, 80).replace(/[^\w-]/g, '-');
    const label = corta(o.label, 400);
    const tipo = TIPOS_CAMPO.includes(o.tipo as CampoTipo) ? (o.tipo as CampoTipo) : 'texto';
    if (!id || !label || vistos.has(id)) continue;
    vistos.add(id);
    const lista = (v: unknown, n: number) => (Array.isArray(v) ? v.map((s) => corta(s, 200)).filter(Boolean).slice(0, n) : undefined);
    const c: Campo = { id, label, tipo };
    const ayuda = corta(o.ayuda, 600); if (ayuda) c.ayuda = ayuda;
    const opciones = lista(o.opciones, 30); if (opciones?.length && (tipo === 'eleccion' || tipo === 'checks')) c.opciones = opciones;
    const columnas = lista(o.columnas, 12); if (columnas?.length && tipo === 'tabla') c.columnas = columnas;
    const filasFijas = lista(o.filasFijas, 40); if (filasFijas?.length && tipo === 'tabla') c.filasFijas = filasFijas;
    if (tipo === 'tabla' && typeof o.filasMin === 'number' && o.filasMin > 0) c.filasMin = Math.min(40, Math.round(o.filasMin));
    if (o.obligatorio === true) c.obligatorio = true;
    out.push(c);
  }
  return out;
}

/**
 * Lo que contestó el cliente, contra los campos de SU clase. Las claves que la clase no tiene se
 * tiran (los valores viajan desde un navegador sin sesión), y cada valor se corta a su forma.
 * Sin campos, la tarea es una respuesta libre: `{respuesta}`.
 */
export function sanearValores(campos: readonly Campo[], raw: unknown): Valores {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  if (!campos.length) {
    const r = corta(o.respuesta, 20_000);
    return r ? { respuesta: r } : {};
  }
  const out: Valores = {};
  for (const c of campos) {
    const v = o[c.id];
    if (c.tipo === 'checks') {
      if (Array.isArray(v)) out[c.id] = v.map((s) => corta(s, 300)).filter((s) => !c.opciones || c.opciones.includes(s)).slice(0, 30);
    } else if (c.tipo === 'tabla') {
      if (Array.isArray(v)) {
        const ncol = Math.max(1, c.columnas?.length ?? 1);
        out[c.id] = v.slice(0, 60).map((fila) => (Array.isArray(fila) ? fila : []).slice(0, ncol).map((s) => corta(s, 1000)));
      }
    } else {
      const s = corta(v, c.tipo === 'texto' ? 20_000 : 500);
      if (s) out[c.id] = c.tipo === 'eleccion' && c.opciones && !c.opciones.includes(s) ? '' : s;
    }
  }
  return out;
}

/**
 * ¿Este campo tiene algo contestado?
 *
 * ⚠️ EN UNA TABLA CON FILAS FIJAS, LA PRIMERA COLUMNA NO CUENTA: el portal guarda ahí la etiqueta
 * de la fila (la puso el formulario, no el alumno). Contada, toda tabla de filas fijas saldría
 * «contestada» sin una sola celda llena — y como `respuestaCompleta` decide si la tarea queda
 * ENVIADA, un pedido armado a mano cerraba la etapa. Lo encontró la revisión del 06/10/2026: la
 * pantalla ya lo miraba bien y el server no, con la misma regla escrita dos veces. Ahora es una.
 */
export function campoLleno(c: Pick<Campo, 'tipo' | 'filasFijas'>, v: ValorCampo | undefined): boolean {
  if (typeof v === 'string') return v.trim().length > 0;
  if (!Array.isArray(v)) return false;
  if (c.tipo === 'tabla') {
    const desde = c.filasFijas?.length ? 1 : 0;
    return (v as unknown[]).some((f) => Array.isArray(f) && f.slice(desde).some((x) => String(x ?? '').trim().length > 0));
  }
  return (v as unknown[]).some((x) => String(x ?? '').trim().length > 0);
}

/** ¿Lo que contestó alcanza para ENVIAR? Sin campos: la respuesta libre no vacía. Con campos: los obligatorios. */
export function respuestaCompleta(c: Pick<Clase, 'tarea' | 'campos'>, valores: Valores): boolean {
  if (!c.campos.length) return typeof valores.respuesta === 'string' && valores.respuesta.trim().length > 0;
  const obligatorios = c.campos.filter((x) => x.obligatorio);
  // Sin ninguno marcado obligatorio, alcanza con que haya contestado ALGO: enviar un formulario
  // vacío no es haber hecho la tarea.
  return obligatorios.length
    ? obligatorios.every((x) => campoLleno(x, valores[x.id]))
    : c.campos.some((x) => campoLleno(x, valores[x.id]));
}
