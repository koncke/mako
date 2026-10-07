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
  /**
   * ¿Su tarea se contesta UNA VEZ POR ÁREA del cliente? (#665, mig 0212). Las áreas son las que el
   * cliente declaró en su tabla de áreas y responsables (`areasDelCliente`); el líder de cada área
   * la ve con su propio link. Ausente = false: es lo que había antes de la 0212, y así ningún
   * literal de una clase (los tests, la vista previa) tiene que saber que existe.
   */
  porArea?: boolean;
};

/** Un valor de un campo: texto, varias opciones, o una tabla (filas x columnas). */
export type ValorCampo = string | string[] | string[][];
export type Valores = Record<string, ValorCampo>;

// ── La propuesta de la IA (paso 5 de #665, mig 0213) ─────────────────────────
// Vive ACÁ y no en lib/curso-propuesta.ts porque la dibujan pantallas del navegador (la ficha, el
// portal), y aquel módulo trae los prompts: un import de valor desde un 'use client' los bajaría
// en el bundle. Las reglas (qué se propone, qué valida) siguen allá.

/**
 * `pendiente` = la IA propuso y el cliente todavía no hizo nada. `aprobada` = la aprobó tal cual
 * (su respuesta pasó a ser la de la IA). `corregida` = mandó SU versión después de verla (la
 * corrigió, o se quedó con la suya). Sin propuesta, la fila no tiene estado (`null`).
 */
export type EstadoPropuesta = 'pendiente' | 'aprobada' | 'corregida';
export const ESTADOS_PROPUESTA: readonly EstadoPropuesta[] = ['pendiente', 'aprobada', 'corregida'];

/** Lo que el EQUIPO ve en la ficha. Corto: es un chip. */
export const ROTULO_PROPUESTA: Record<EstadoPropuesta, string> = {
  pendiente: 'IA por aprobar',
  aprobada: 'IA aprobada',
  corregida: 'IA corregida',
};

/** La propuesta de la IA sobre UNA respuesta (una fila de `curso_progreso`). */
export type PropuestaIA = {
  valores: Valores;
  estado: EstadoPropuesta;
  /** Cuándo se propuso. Es el TOKEN del compare-and-set al aprobar (`ia_propuesta_at`). */
  desde: string;
  /** De qué grabación salió (`closing_analyses.recording_id`). */
  recordingId: number | null;
  /** Cuándo la aprobó o la corrigió. */
  resueltaAt: string | null;
};

export type Progreso = {
  claseId: number;
  segundosMax: number;
  duracionSeg: number | null;
  pct: number;
  vistoAt: string | null;
  valores: Valores;
  estado: EstadoTarea;
  enviadaAt: string | null;
  /**
   * La propuesta de la IA sobre esta respuesta (paso 5 de #665, mig 0213). Ausente = esta lectura
   * no la trae (la tabla Avance de la tab no la pide); `null` = no hay. Nunca es `valores`: la IA
   * propone al lado y el cliente decide (lib/curso-propuesta.ts).
   */
  ia?: PropuestaIA | null;
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

/**
 * Cuánto vio de los videos de UNA etapa: el promedio sobre los que se pueden MEDIR, y uno que no
 * abrió cuenta 0 («vio el 50%» quiere decir «de lo que le toca ver»). Los de Drive/Loom no entran
 * al promedio y se cuentan aparte, para que la pantalla diga «Sin medir» en vez de un número que
 * los ignora. `pct: null` = la etapa no tiene videos medibles. Lo usan la tab (Avance) y la ficha.
 */
export function vistoDeEtapa<T extends Pick<Clase, 'id' | 'videoTipo' | 'videoUrl' | 'videoPath'>>(
  clasesDeEtapa: readonly T[],
  pctDe: (claseId: number) => number | undefined,
): { pct: number | null; sinMedir: number; medibles: number } {
  const conVideo = clasesDeEtapa.map((c) => ({ c, r: reproductorDeClase(c) })).filter((x) => x.r.video != null);
  const medibles = conVideo.filter((x) => x.r.medible);
  const pct = medibles.length ? Math.round(medibles.reduce((s, x) => s + (pctDe(x.c.id) ?? 0), 0) / medibles.length) : null;
  return { pct, sinMedir: conVideo.length - medibles.length, medibles: medibles.length };
}

/**
 * Los videos de UNA etapa que el cliente todavía NO vio, en el orden de la etapa. Es lo que
 * nombra el recordatorio de clases (#780, lib/curso-mensajes.ts → `correrRecordatoriosDeClases`).
 *
 *   · Sólo clases con un video que se DIBUJA (`reproductorDeClase`): una clase sin video —o con
 *     un link que no se reconoce— no es un video que se pueda ver, y pedírselo es mandarlo a
 *     buscar algo que no está.
 *   · Medible (YouTube, Vimeo, archivo): no visto = por debajo del umbral. El umbral es
 *     `PCT_VISTO`, el mismo con el que la tab y la ficha dicen «visto»: dos umbrales y el
 *     recordatorio le pediría al cliente un video que su pantalla ya marca como visto.
 *   · ⚠️ SIN MEDIR (Drive, Loom, un link que se abre afuera) NO CUENTA COMO NO VISTO. No se puede
 *     saber si lo vio, y «te falta ver X» sobre algo que pudo haber visto entero es un mensaje
 *     que afirma lo que no se midió — y le enseña al cliente a ignorar los demás. Es la misma
 *     regla de `ROTULO_SIN_MEDIR`: nunca «0%», que se lee «no lo vio».
 */
export function videosSinVer<T extends Pick<Clase, 'id' | 'videoTipo' | 'videoUrl' | 'videoPath'>>(
  clasesDeEtapa: readonly T[],
  pctDe: (claseId: number) => number | undefined,
  umbral: number = PCT_VISTO,
): T[] {
  return clasesDeEtapa.filter((c) => {
    const r = reproductorDeClase(c);
    return r.video != null && r.medible && (pctDe(c.id) ?? 0) < umbral;
  });
}

// ── La tarea ──────────────────────────────────────────────────────────────────

/** ¿La clase pide algo? Una instrucción de llenado o un formulario. */
export const tieneTarea = (c: Pick<Clase, 'tarea' | 'campos'>): boolean =>
  c.tarea.trim().length > 0 || c.campos.length > 0;

/** Las tareas que cuentan para cerrar la etapa: marcadas obligatorias Y que piden algo. */
export const obligatoriasDe = <T extends Pick<Clase, 'obligatoria' | 'tarea' | 'campos'>>(clases: readonly T[]): T[] =>
  clases.filter((c) => c.obligatoria && tieneTarea(c));

const enviada = (e: EstadoTarea | undefined) => e === 'enviada' || e === 'aprobada';

/** ¿La tarea cuenta como hecha? Enviada o ya revisada (una revisada se envió antes). */
export const tareaEnviada = enviada;

/**
 * Cómo se NOMBRA el estado de una tarea, en las tres pantallas (el portal, la tab y la ficha).
 * «aprobada» se dice «Revisada»: es lo que hace el botón del equipo, y el alumno no aprueba nada.
 * Hasta el 06/10/2026 el portal decía «Aprobada» y la ficha «Revisada» sobre la misma fila.
 */
export const ROTULO_TAREA: Record<EstadoTarea, string> = { pendiente: 'Pendiente', enviada: 'Enviada', aprobada: 'Revisada' };

/** Lo que se dice de un video que no se puede medir (Drive, Loom). Nunca «0%»: se leería «no lo vio». */
export const ROTULO_SIN_MEDIR = 'Sin medir';

/**
 * Los números de UNA etapa para un cliente, escritos UNA vez. Hasta el 06/10/2026 el «X de Y»
 * estaba escrito tres veces (el portal, la tab y la ficha) con dos criterios de «completa»: la tab
 * pintaba lista una etapa con todas las tareas enviadas, y lo que mueve al cliente es
 * `etapaCompleta` (las OBLIGATORIAS). Ahora todas las pantallas cuentan acá.
 *
 *   · `tareas` / `enviadas`: TODAS las que piden algo — lo que se le muestra a la persona.
 *   · `obligatorias` / `obligatoriasEnviadas`: las que cierran la etapa.
 *   · `completa`: la regla que MUEVE al cliente (`etapaCompleta`), no «enviadas === tareas».
 */
export type ConteoEtapa = { tareas: number; enviadas: number; obligatorias: number; obligatoriasEnviadas: number; completa: boolean };
export function conteoDeEtapa<T extends Pick<Clase, 'id' | 'obligatoria' | 'tarea' | 'campos'>>(
  clasesDeEtapa: readonly T[],
  estadoDe: (claseId: number) => EstadoTarea | undefined,
): ConteoEtapa {
  const conTarea = clasesDeEtapa.filter((c) => tieneTarea(c));
  const ob = obligatoriasDe(clasesDeEtapa);
  return {
    tareas: conTarea.length,
    enviadas: conTarea.filter((c) => enviada(estadoDe(c.id))).length,
    obligatorias: ob.length,
    obligatoriasEnviadas: ob.filter((c) => enviada(estadoDe(c.id))).length,
    completa: etapaCompleta(clasesDeEtapa, estadoDe),
  };
}

/**
 * ¿El cliente completó la etapa? = ENVIÓ todas sus tareas obligatorias.
 *
 * ⚠️ UNA ETAPA SIN OBLIGATORIAS NO SE COMPLETA SOLA, a propósito: «nada que hacer» no es «ya
 * terminó». Si se tomara como completa, un cliente que entra a una etapa sin tareas cargadas
 * saltaría a la siguiente en el acto, y de ahí a la otra, hasta la primera que tenga algo —
 * sin haber visto nada. Ahí lo mueve Mauricio a mano.
 *
 * ⚠️ UNA OBLIGATORIA POR ÁREA EXIGE TODAS LAS ÁREAS (#665), y eso NO se decide acá sino en el
 * `estadoDe` que llega: el progreso de una clase por área sale de `progresoEfectivo`, que la da
 * por enviada sólo cuando la enviaron TODAS las áreas del cliente. Así lo cumplen solos los seis
 * que preguntan por una etapa (el paso automático, el portal, la ficha, la tab, el cron y la API)
 * sin que ninguno tenga que saber que hay áreas: la capa de datos les da ese progreso
 * (`progresoDelCliente`, lib/curso-datos.ts). Una segunda regla acá, con áreas, sería la copia que
 * diverge.
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

// ── Por área (#665, mig 0212) ─────────────────────────────────────────────────
// Los formularios de palancas, evidencia, umbrales y carta (m6-m9 del programa de Mauricio) se
// contestan UNA VEZ POR ÁREA del cliente, y el de umbrales lo contesta el LÍDER de cada área con su
// propio link. Decisión de Martín del 06/10/2026 («m6-m9 por área con link propio del líder»).

/**
 * El campo donde el cliente lista sus áreas: la tabla «Lista las áreas o funciones que existen
 * hoy… Al lado, quién responde» del formulario «Tus áreas y quién responde» (m1c2, etapa
 * Contexto). La primera columna es el área.
 *
 * ⚠️ SE BUSCA POR EL ID DEL CAMPO, NO POR LA CLASE: `COLUMNAS_CLASE` no trae el `origen` y el id
 * de un campo no cambia al editar la clase (el editor de la tab Curso lo conserva, ver
 * app/customer-success/curso/reglas.ts). Si Mauricio le cambiara el id a ese campo, ningún
 * cliente tendría áreas y todo volvería a contestarse una vez — lo fija el test de la semilla.
 */
export const CAMPO_AREAS = 'areas-y-responsables';
/** Cuántas áreas se toman como mucho: la tabla no tiene tope y cada una es un formulario más. */
export const MAX_AREAS = 20;
/** El largo de un nombre de área. Lo mismo exige la base (mig 0212). */
export const MAX_LARGO_AREA = 80;

/**
 * Un nombre de área como se guarda: sin espacios de más, en NFC y topeado. `''` = no es un área.
 *
 * ⚠️ ESTE STRING ES UNA CLAVE (`curso_progreso.area`, `curso_accesos.area`): un acento o un espacio
 * doble lo parten en dos áreas (AGENTS.md, «Un nombre derivado de datos es una CLAVE»). Por eso se
 * normaliza en UN lugar y todos los que comparan un área la pasan por acá.
 */
export function nombreDeArea(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, MAX_LARGO_AREA).trim();
}

/** Para no repetir un área que se escribió dos veces con otra mayúscula o sin acento. */
const comparable = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Las áreas que contestó el cliente: la primera columna de cada fila de su tabla de áreas, en el
 * orden en que las escribió, sin repetir (gana la primera forma escrita). Lo guardado como
 * borrador también cuenta: las áreas son un dato del cliente, no una tarea que alguien revisa.
 *
 * Recibe las respuestas DEL CLIENTE (las filas con área `''`). Si dos clases tuvieran el campo,
 * se juntan en el orden de las clases: elegir una sería tirar las áreas de la otra.
 */
export function areasDelCliente(respuestas: Iterable<{ claseId: number; valores: Valores }>): string[] {
  const out: string[] = [];
  const vistas = new Set<string>();
  const filas = [...respuestas].filter((p) => Array.isArray(p.valores?.[CAMPO_AREAS])).sort((a, b) => a.claseId - b.claseId);
  for (const p of filas) {
    for (const fila of p.valores[CAMPO_AREAS] as unknown[]) {
      const area = nombreDeArea(Array.isArray(fila) ? fila[0] : null);
      const k = comparable(area);
      if (!area || vistas.has(k)) continue;
      vistas.add(k);
      out.push(area);
      if (out.length >= MAX_AREAS) return out;
    }
  }
  return out;
}

/**
 * El estado de una tarea por área, mirando TODAS las áreas del cliente: enviada sólo si la
 * enviaron todas (revisada si además el equipo las revisó todas). Un área que no contestó deja la
 * tarea pendiente: «falta Operación» no es «ya está».
 */
export function estadoDeAreas(estados: readonly (EstadoTarea | undefined)[]): EstadoTarea {
  if (!estados.length || !estados.every((e) => enviada(e))) return 'pendiente';
  return estados.every((e) => e === 'aprobada') ? 'aprobada' : 'enviada';
}

/**
 * El progreso que CUENTA de cada clase, con las clases por área resueltas: lo que leen todos los
 * que preguntan si una tarea está enviada o una etapa completa (`etapaCompleta`, `conteoDeEtapa`,
 * `pendientesDe`, el paso automático).
 *
 *   · Una clase que no es por área: su fila de siempre (la del cliente, área `''`).
 *   · Una clase por área, con el cliente SIN áreas declaradas: también su fila de siempre — se
 *     contesta una vez, como antes de la 0212. Sin esto, un cliente que todavía no llenó su tabla
 *     de áreas no podría cerrar nunca una etapa con una obligatoria por área.
 *   · Una clase por área con áreas: el estado de TODAS (`estadoDeAreas`). Lo demás (cuánto vio
 *     del video, que es del cliente y no de un área) sale de su fila de siempre.
 *
 * ⚠️ UN ÁREA QUE YA NO ESTÁ EN SU TABLA NO CUENTA, y una respuesta suya no se borra: si el cliente
 * renombra «Ventas» a «Comercial», la etapa espera a «Comercial» (el nombre es la clave; ver
 * `nombreDeArea`). Lo contestado como «Ventas» sigue en la base y la ficha lo muestra.
 *
 * ⚠️ `valores` ES EL DEL CLIENTE (área `''`), nunca el de un área: lo que contestó cada área viaja
 * aparte (`porArea`) y sólo a quien le toca verlo.
 */
export function progresoEfectivo(
  delCliente: ReadonlyMap<number, Progreso>,
  porArea: ReadonlyMap<number, ReadonlyMap<string, Progreso>>,
  clasesPorArea: ReadonlySet<number>,
  areas: readonly string[],
): Map<number, Progreso> {
  const out = new Map(delCliente);
  if (!areas.length) return out;
  for (const id of clasesPorArea) {
    const deAreas = porArea.get(id);
    const propia = delCliente.get(id);
    const filas = areas.map((a) => deAreas?.get(a));
    if (!propia && !filas.some(Boolean)) { out.delete(id); continue; }
    const estado = estadoDeAreas(filas.map((f) => f?.estado));
    const fechas = filas.map((f) => f?.enviadaAt).filter((x): x is string => !!x).sort();
    const base: Progreso = propia ?? { claseId: id, segundosMax: 0, duracionSeg: null, pct: 0, vistoAt: null, valores: {}, estado: 'pendiente', enviadaAt: null };
    out.set(id, { ...base, estado, enviadaAt: estado === 'pendiente' ? null : fechas.at(-1) ?? null });
  }
  return out;
}
