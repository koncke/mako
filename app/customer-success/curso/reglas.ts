// =============================================================================
// reglas — lo que decide la tab Curso sin tocar la base (puro)
// =============================================================================
// Sin 'use client' ni 'server-only' a propósito: lo usan la página (server), las pantallas
// (navegador) y las escrituras de lib/curso-admin.ts, y un test lo EJECUTA
// (tests/curso-admin.test.ts). Las reglas del curso en sí —qué cierra una etapa, el % visto,
// el saneo de un formulario— viven en lib/curso.ts; acá está lo que es de ESTA pantalla:
// validar lo que guarda el editor, el orden de las clases, de dónde sale el path de un video
// subido y la fila de «Avance».
//
// Pedido de Martín (06/10/2026): «implementes la tab de "CURSO"… con todo su programa… los
// formularios con las tareas… cargar vídeos, ya sea con un link o subiendo el video… que se
// mida cuánto del vídeo se vieron, cuáles tareas completaron».

import {
  videoDeLink, sanearCampos, tieneTarea, reproductorDeClase,
  type Campo, type Clase, type EstadoTarea, type TipoClase, type VideoTipo,
} from '@/lib/curso';

// ── Catálogos de la pantalla ─────────────────────────────────────────────────

/** Los tipos de clase, en el orden del programa de Mauricio (Concepto → Demostración → Clínica). */
export const TIPOS_CLASE: ReadonlyArray<{ value: TipoClase; label: string }> = [
  { value: 'clase', label: 'Clase' },
  { value: 'concepto', label: 'Concepto' },
  { value: 'demostracion', label: 'Demostración' },
  { value: 'clinica', label: 'Clínica' },
  { value: 'formulario', label: 'Formulario' },
];

export const rotuloTipo = (t: TipoClase): string => TIPOS_CLASE.find((x) => x.value === t)?.label ?? 'Clase';

/** Los tipos de campo de un formulario, con el nombre que entiende quien lo arma. */
export const TIPOS_CAMPO: ReadonlyArray<{ value: Campo['tipo']; label: string }> = [
  { value: 'texto', label: 'Texto largo' },
  { value: 'linea', label: 'Línea' },
  { value: 'numero', label: 'Número' },
  { value: 'eleccion', label: 'Una opción' },
  { value: 'checks', label: 'Varias opciones' },
  { value: 'tabla', label: 'Tabla' },
];

// ── El video subido ──────────────────────────────────────────────────────────

/**
 * Los formatos que acepta el bucket `curso-videos` (mig 0202, `allowed_mime_types`).
 *
 * ⚠️ TIENEN QUE SER LOS MISMOS QUE LOS DEL BUCKET, no «los videos en general». Storage rechaza
 * lo que no esté en su lista recién al terminar de SUBIR: con un archivo de 1 GB eso son
 * minutos de barra para un «no» que se podía decir antes de empezar.
 */
export const MIME_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'] as const;
export type MimeVideo = (typeof MIME_VIDEO)[number];

/**
 * El tope de un archivo: 2 GiB, el `file_size_limit` del bucket (mig 0202).
 *
 * ⚠️ ES EL DEL BUCKET Y NO UNO MÍO (AGENTS.md, «el entorno tiene un tope y tu código declara
 * otro»): un número acá por encima del de Storage no protege nada, promete. Si algún día se
 * sube el del bucket, se sube éste en el mismo cambio.
 */
export const TOPE_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;

const EXT_DE_MIME: Record<MimeVideo, string> = {
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'video/x-m4v': 'm4v',
};
const MIME_DE_EXT: Record<string, MimeVideo> = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', m4v: 'video/x-m4v' };

export const esMimeVideo = (m: string | null | undefined): m is MimeVideo => (MIME_VIDEO as readonly string[]).includes(m ?? '');

/**
 * El tipo de un archivo elegido. El del navegador si lo trae; si no, por la extensión.
 *
 * ⚠️ HAY NAVEGADORES QUE NO LE PONEN TIPO A UN .m4v O A UN .mov (File.type === ''). Subido así,
 * la parte del multipart viaja como `application/octet-stream` y el bucket la rechaza aunque
 * sea un video perfecto. `null` = no es un formato que el bucket acepte.
 */
export function mimeDeArchivo(nombre: string, tipo: string | null | undefined): MimeVideo | null {
  if (esMimeVideo(tipo)) return tipo;
  if (tipo) return null;
  const ext = (nombre.split('.').pop() ?? '').toLowerCase();
  return MIME_DE_EXT[ext] ?? null;
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/**
 * Dónde se guarda un video subido: `<ws>/<producto>/<uuid>.<ext>`.
 *
 * ⚠️ EL WORKSPACE VA PRIMERO EN LA RUTA Y LO PONE EL SERVER, nunca el navegador: es lo que
 * deja preguntar «¿este archivo es de este negocio?» con un prefijo, y lo que impide que un
 * guardado apunte una clase al video de otro inquilino. El nombre original NO entra (puede
 * traer acentos, espacios o el nombre de un cliente): para mostrarlo está el editor.
 */
export function pathDeSubida(ws: number, productoId: number, mime: string, uuid: string): string | null {
  if (!esMimeVideo(mime) || !Number.isInteger(ws) || ws <= 0 || !Number.isInteger(productoId) || productoId <= 0) return null;
  if (!new RegExp(`^${UUID}$`).test(uuid)) return null;
  return `${ws}/${productoId}/${uuid}.${EXT_DE_MIME[mime]}`;
}

/** ¿Este path es un video subido para ESTE producto de ESTE workspace? (lo que guarda una clase) */
export function pathEsDelProducto(path: string | null | undefined, ws: number, productoId: number): boolean {
  return typeof path === 'string' && new RegExp(`^${ws}/${productoId}/${UUID}\\.(mp4|webm|mov|m4v)$`).test(path);
}

/** ¿Este path es un video de ESTE workspace? (lo que se puede previsualizar) */
export function pathEsDelWorkspace(path: string | null | undefined, ws: number): boolean {
  return typeof path === 'string' && new RegExp(`^${ws}/\\d{1,12}/${UUID}\\.(mp4|webm|mov|m4v)$`).test(path);
}

// ── El video de una clase, como lo dibuja la lista ───────────────────────────

const ROTULO_VIDEO: Record<Exclude<VideoTipo, 'ninguno'>, string> = {
  archivo: 'Archivo', youtube: 'YouTube', vimeo: 'Vimeo', loom: 'Loom', drive: 'Drive', url: 'Link',
};

/**
 * ¿Tiene video, de qué tipo, y se puede MEDIR cuánto se vio?
 *
 * ⚠️ «MEDIBLE» SE VUELVE A PREGUNTAR AL LINK, no se cree del `video_tipo` guardado: un `url`
 * se mide sólo si es un archivo directo (.mp4/.webm), y eso lo sabe `videoDeLink`. Un archivo
 * subido siempre se mide (se reproduce con `<video>`). Drive y Loom se ven pero no se miden, y
 * la pantalla lo DICE en vez de mostrar un 0% (decisión del 06/10).
 */
export function videoDeClase(c: Pick<Clase, 'videoTipo' | 'videoUrl' | 'videoPath'>): { hay: boolean; rotulo: string; medible: boolean } {
  if (c.videoTipo === 'ninguno') return { hay: false, rotulo: '', medible: false };
  // ⚠️ «hay» y «medible» salen de la MISMA función que usa el portal (`reproductorDeClase`,
  // lib/curso.ts): si la tab dijera «se mide» con su propia cuenta, podría decirlo sobre un video
  // que el reproductor del alumno no puede medir. Acá sólo se agrega el rótulo.
  const { video, medible } = reproductorDeClase(c);
  if (c.videoTipo === 'archivo') return { hay: video != null, rotulo: ROTULO_VIDEO.archivo, medible };
  const v = videoDeLink(c.videoUrl);
  return { hay: video != null, rotulo: ROTULO_VIDEO[v?.tipo ?? c.videoTipo], medible };
}

// ── El orden ─────────────────────────────────────────────────────────────────

type Ordenable = { id: number; etapa: string; orden: number };

/** Las clases de una etapa, en su orden (y por id en un empate, para que no bailen). */
export function clasesDeEtapa<T extends Ordenable>(clases: readonly T[], etapa: string): T[] {
  return clases.filter((c) => c.etapa === etapa).sort((a, b) => a.orden - b.orden || a.id - b.id);
}

/** El orden de una clase que entra AL FINAL de una etapa. */
export function siguienteOrden(clases: readonly Ordenable[], etapa: string): number {
  const de = clases.filter((c) => c.etapa === etapa);
  return de.length ? Math.max(...de.map((c) => c.orden)) + 1 : 0;
}

/**
 * Sube o baja una clase un lugar. Devuelve la LISTA ENTERA de ids en su orden nuevo, o `null`
 * si no se puede mover (ya es la primera/última, o no está).
 *
 * ⚠️ DEVUELVE LA LISTA Y NO UN «CAMBIÁ ESTOS DOS ÓRDENES»: los `orden` de la base pueden tener
 * huecos o empates (una carga, un borrado), y un intercambio de dos números con un empate no
 * mueve nada. Quien escribe renumera la etapa entera 0..n-1 desde esta lista.
 */
export function reordenar(ids: readonly number[], id: number, dir: 'arriba' | 'abajo'): number[] | null {
  const i = ids.indexOf(id);
  if (i < 0) return null;
  const j = dir === 'arriba' ? i - 1 : i + 1;
  if (j < 0 || j >= ids.length) return null;
  const out = [...ids];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** Mueve un elemento de una lista un lugar (los campos de un formulario). La misma lista si no se puede. */
export function moverEnLista<T>(lista: readonly T[], i: number, dir: 'arriba' | 'abajo'): T[] {
  const j = dir === 'arriba' ? i - 1 : i + 1;
  if (i < 0 || i >= lista.length || j < 0 || j >= lista.length) return [...lista];
  const out = [...lista];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/**
 * Las clases repartidas en las etapas de la entrega, más las que quedaron SIN etapa.
 *
 * ⚠️ LAS HUÉRFANAS EXISTEN y no se pueden perder de vista: borrar una columna en el editor de
 * etapas de Customer Success no toca `curso_clases`, así que sus clases siguen apuntando a una
 * clave que ya no está. Sin esta lista desaparecerían de la pantalla con su video y su avance
 * adentro — y el portal del cliente tampoco las mostraría.
 */
export function porEtapas<T extends Ordenable>(clases: readonly T[], etapas: readonly string[]): { porEtapa: Record<string, T[]>; huerfanas: T[] } {
  const porEtapa: Record<string, T[]> = {};
  for (const e of etapas) porEtapa[e] = clasesDeEtapa(clases, e);
  const set = new Set(etapas);
  const huerfanas = clases.filter((c) => !set.has(c.etapa)).sort((a, b) => a.etapa.localeCompare(b.etapa) || a.orden - b.orden || a.id - b.id);
  return { porEtapa, huerfanas };
}

// ── Los campos del formulario ────────────────────────────────────────────────

/**
 * El id de un campo nuevo.
 *
 * ⚠️ AL AZAR Y NO `c1, c2, c3…`: las respuestas de los clientes se guardan por id de campo
 * (`curso_progreso.valores`). Con un contador, borrar el campo «c2» y agregar otro le daría
 * el «c2» de nuevo — y las respuestas viejas aparecerían contestando la pregunta nueva. Por eso
 * también el id NO SE EDITA nunca: cambiar la pregunta no cambia de quién son las respuestas.
 */
export function nuevoIdCampo(existentes: readonly { id: string }[], azar: () => number = Math.random): string {
  const usados = new Set(existentes.map((c) => c.id));
  for (let i = 0; i < 50; i++) {
    const id = `c${Math.floor(azar() * 36 ** 6).toString(36).padStart(6, '0')}`;
    if (!usados.has(id)) return id;
  }
  // Cincuenta choques seguidos sólo pasan con un azar roto: se sale por un contador que no
  // choca con nada de lo que hay.
  let n = existentes.length + 1;
  while (usados.has(`c-${n}`)) n++;
  return `c-${n}`;
}

// ── Lo que guarda el editor ──────────────────────────────────────────────────

export type VideoEntrada = { tipo: 'ninguno' } | { tipo: 'link'; url: string } | { tipo: 'archivo'; path: string };

/** Lo que manda el editor al guardar. Viaja desde el navegador: se valida entero. */
export type EntradaClase = {
  /** `null` = clase nueva. */
  id?: number | null;
  productoId: number;
  etapa: string;
  titulo: string;
  descripcion?: string;
  tipo?: string;
  minutos?: number | string | null;
  video?: VideoEntrada;
  tarea?: string;
  campos?: unknown;
  obligatoria?: boolean;
};

/** Las columnas de `curso_clases` que escribe un guardado (sin id, workspace, producto ni orden). */
export type FilaClaseGuardar = {
  etapa: string;
  titulo: string;
  descripcion: string;
  tipo: TipoClase;
  minutos: number | null;
  video_tipo: VideoTipo;
  video_url: string | null;
  video_path: string | null;
  tarea: string;
  campos: Campo[];
  obligatoria: boolean;
};

export const TOPE_TITULO = 200;
export const TOPE_TEXTO = 20_000;
const TIPOS_OK = new Set<string>(TIPOS_CLASE.map((t) => t.value));

/**
 * Valida y normaliza lo que guarda el editor. Los errores son CORTOS: se dibujan tal cual.
 *
 * ⚠️ LOS CAMPOS SE REVISAN ANTES DE SANEAR, y es a propósito: `sanearCampos` TIRA en silencio
 * un campo sin pregunta. Para la base eso está bien, pero en el editor sería que Mauricio
 * agrega un campo, lo deja a medias, guarda, y el campo desaparece sin que nada se lo diga.
 */
export function validarClase(
  raw: unknown,
  ctx: { ws: number; productoId: number; etapas: readonly string[] },
): { ok: true; id: number | null; fila: FilaClaseGuardar } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'No llegó la clase.' };
  const r = raw as Record<string, unknown>;
  const idCrudo = r.id == null ? null : Number(r.id);
  if (idCrudo !== null && (!Number.isInteger(idCrudo) || idCrudo <= 0)) return { ok: false, error: 'Esa clase no existe.' };
  if (Number(r.productoId) !== ctx.productoId) return { ok: false, error: 'Ese producto no es este.' };

  const titulo = typeof r.titulo === 'string' ? r.titulo.trim() : '';
  if (!titulo) return { ok: false, error: 'Falta el título.' };
  if (titulo.length > TOPE_TITULO) return { ok: false, error: `El título pasa de ${TOPE_TITULO} letras.` };

  const etapa = typeof r.etapa === 'string' ? r.etapa : '';
  if (!ctx.etapas.includes(etapa)) return { ok: false, error: 'Esa etapa no existe.' };

  const tipo = (typeof r.tipo === 'string' && TIPOS_OK.has(r.tipo) ? r.tipo : 'clase') as TipoClase;

  let minutos: number | null = null;
  if (r.minutos !== null && r.minutos !== undefined && r.minutos !== '') {
    const m = Number(r.minutos);
    if (!Number.isFinite(m) || m < 0 || m > 600) return { ok: false, error: 'Los minutos no cierran.' };
    minutos = Math.round(m);
  }

  const descripcion = typeof r.descripcion === 'string' ? r.descripcion.trim() : '';
  const tarea = typeof r.tarea === 'string' ? r.tarea.trim() : '';
  if (descripcion.length > TOPE_TEXTO || tarea.length > TOPE_TEXTO) return { ok: false, error: 'El texto es demasiado largo.' };

  // El video: uno de tres, y el link sólo si es http/https (va al `src` de un iframe que ve el
  // cliente: `videoDeLink` es el que lo garantiza).
  const v = (r.video ?? { tipo: 'ninguno' }) as Partial<VideoEntrada> & { url?: unknown; path?: unknown };
  let video: Pick<FilaClaseGuardar, 'video_tipo' | 'video_url' | 'video_path'>;
  if (v.tipo === 'link') {
    const rec = videoDeLink(typeof v.url === 'string' ? v.url : '');
    if (!rec) return { ok: false, error: 'Ese link no es válido.' };
    video = { video_tipo: rec.tipo, video_url: rec.url, video_path: null };
  } else if (v.tipo === 'archivo') {
    const path = typeof v.path === 'string' ? v.path : '';
    if (!pathEsDelProducto(path, ctx.ws, ctx.productoId)) return { ok: false, error: 'Ese video no es de este curso.' };
    video = { video_tipo: 'archivo', video_url: null, video_path: path };
  } else {
    video = { video_tipo: 'ninguno', video_url: null, video_path: null };
  }

  // Los campos, revisados uno por uno antes del saneo (ver arriba).
  const crudos = Array.isArray(r.campos) ? (r.campos as Array<Record<string, unknown> | null>) : [];
  if (crudos.length > 60) return { ok: false, error: 'Son más de 60 campos.' };
  for (const c of crudos) {
    const label = typeof c?.label === 'string' ? c.label.trim() : '';
    if (!label) return { ok: false, error: 'Hay un campo sin pregunta.' };
    const lleno = (x: unknown) => Array.isArray(x) && x.some((s) => typeof s === 'string' && s.trim());
    if ((c?.tipo === 'eleccion' || c?.tipo === 'checks') && !lleno(c.opciones)) return { ok: false, error: `Faltan las opciones de «${label.slice(0, 40)}».` };
    if (c?.tipo === 'tabla' && !lleno(c.columnas)) return { ok: false, error: `Faltan las columnas de «${label.slice(0, 40)}».` };
  }
  const campos = sanearCampos(crudos);
  if (campos.length !== crudos.length) return { ok: false, error: 'Hay campos repetidos.' };

  // «Cierra la etapa» sin nada que hacer no cierra nada: `obligatoriasDe` (lib/curso.ts) sólo
  // cuenta las que piden algo, así que la marca quedaría guardada y sin efecto — y la etapa no
  // avanzaría sola sin que nadie entienda por qué.
  const obligatoria = r.obligatoria === true;
  if (obligatoria && !tieneTarea({ tarea, campos })) return { ok: false, error: 'Para cerrar la etapa, agrega la tarea.' };

  return { ok: true, id: idCrudo, fila: { etapa, titulo, descripcion, tipo, minutos, ...video, tarea, campos, obligatoria } };
}

// ── El avance de los clientes ────────────────────────────────────────────────

/**
 * La etapa en la que está un cliente: la de su fila si sigue existiendo, y si no, la PRIMERA.
 *
 * ⚠️ ES LA MISMA REGLA QUE `etapaActualDe` (lib/curso-datos.ts), que es la que usa el paso
 * automático, escrita para un lote: aquélla pregunta de a un cliente y la tabla tiene a todos.
 * Si se cambia una, se cambia la otra — dos reglas distintas harían que la tabla diga una
 * etapa y la automatización mueva desde otra.
 */
export function etapaDelCliente(etapas: readonly string[], etapaDeSuFila: string | null | undefined): string | null {
  if (etapaDeSuFila && etapas.includes(etapaDeSuFila)) return etapaDeSuFila;
  return etapas[0] ?? null;
}

export type ProgresoLigero = { pct: number; estado: EstadoTarea };
export type CeldaEtapa = { enviadas: number; total: number };

const enviada = (e: EstadoTarea | undefined) => e === 'enviada' || e === 'aprobada';

/**
 * Lo que la tabla dice de un cliente: cuántas tareas envió en cada etapa y cuánto vio de los
 * videos de SU etapa.
 *
 * ⚠️ EL % ES SOBRE LOS VIDEOS QUE SE PUEDEN MEDIR, y uno que no abrió cuenta 0: «vio el 50%»
 * tiene que querer decir «de lo que le toca ver ahora». Los de Drive/Loom no entran al promedio
 * (no hay forma de saber cuánto se vio) y se cuentan aparte, para que la pantalla diga «sin
 * medir» en vez de un número que los ignora sin avisar. `null` = su etapa no tiene videos medibles.
 */
export function avanceDeCliente(
  clases: readonly Clase[],
  etapas: readonly string[],
  etapaActual: string | null,
  progreso: ReadonlyMap<number, ProgresoLigero> | undefined,
): { porEtapa: Record<string, CeldaEtapa>; pctVisto: number | null; videosSinMedir: number } {
  const porEtapa: Record<string, CeldaEtapa> = {};
  for (const e of etapas) {
    const tareas = clases.filter((c) => c.etapa === e && tieneTarea(c));
    porEtapa[e] = { total: tareas.length, enviadas: tareas.filter((c) => enviada(progreso?.get(c.id)?.estado)).length };
  }
  let pctVisto: number | null = null;
  let videosSinMedir = 0;
  if (etapaActual) {
    const conVideo = clases.filter((c) => c.etapa === etapaActual).map((c) => ({ c, v: videoDeClase(c) })).filter((x) => x.v.hay);
    const medibles = conVideo.filter((x) => x.v.medible);
    videosSinMedir = conVideo.length - medibles.length;
    if (medibles.length) {
      const suma = medibles.reduce((s, x) => s + (progreso?.get(x.c.id)?.pct ?? 0), 0);
      pctVisto = Math.round(suma / medibles.length);
    }
  }
  return { porEtapa, pctVisto, videosSinMedir };
}

/** El acceso del cliente a su portal, como lo dibuja la tabla. */
export type AccesoFila = { estado: 'sin-link' | 'activo' | 'cortado'; ingresos: number; ultimoIngresoAt: string | null };

/** Una fila de «Avance». */
export type FilaAvance = {
  leadId: number;
  nombre: string;
  empresa: string | null;
  etapa: string | null;
  porEtapa: Record<string, CeldaEtapa>;
  pctVisto: number | null;
  videosSinMedir: number;
  /** `null` = no se pudo leer (no «nunca entró»). */
  acceso: AccesoFila | null;
};

/** Las filas en el orden del recorrido: por etapa (la primera arriba) y por nombre adentro. */
export function ordenarFilas(filas: readonly FilaAvance[], etapas: readonly string[]): FilaAvance[] {
  const pos = (e: string | null) => (e == null ? etapas.length : Math.max(0, etapas.indexOf(e)));
  return [...filas].sort((a, b) => pos(a.etapa) - pos(b.etapa) || a.nombre.localeCompare(b.nombre, 'es'));
}
