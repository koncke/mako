// =============================================================================
// reglas — lo que decide la tab Curso sin tocar la base (puro)
// =============================================================================
// Sin 'use client' ni 'server-only' a propósito: lo usan la página (server), las pantallas
// (navegador) y las escrituras de lib/curso-admin.ts, y un test lo EJECUTA
// (tests/curso-admin.test.ts). Las reglas del curso en sí —qué cierra una etapa, el % visto,
// el saneo de un formulario— viven en lib/curso.ts; acá está lo que es de ESTA pantalla:
// validar lo que guarda el editor, el orden de las clases, de dónde sale el path de un video
// subido y la fila de «Avance». Y desde la mig 0208: las notas del equipo con su adjunto (sin
// pantalla desde el 08/10, las lee lib/curso-notas.ts) y qué archivo de los buckets del curso es
// huérfano (el cron que los barre).
//
// Pedido de Martín (06/10/2026): «implementes la tab de "CURSO"… con todo su programa… los
// formularios con las tareas… cargar vídeos, ya sea con un link o subiendo el video… que se
// mida cuánto del vídeo se vieron, cuáles tareas completaron».

import {
  videoDeLink, sanearCampos, tieneTarea, reproductorDeClase, conteoDeEtapa, vistoDeEtapa, urlDeAgenda,
  MAX_PREGUNTAS, MAX_OPCIONES_QUIZ,
  type Campo, type Clase, type EstadoTarea, type TipoClase, type VideoTipo,
} from '@/lib/curso';
import { nombreDeProveedor } from '@/lib/embeds';

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

/**
 * Los tipos de campo de un formulario, con el nombre que entiende quien lo arma. Los nueve de abajo
 * son la #18 (07/10/2026, ver `CampoTipo` en lib/curso.ts): rótulos de una o dos palabras, que es lo
 * que entra en el selector.
 */
export const TIPOS_CAMPO: ReadonlyArray<{ value: Campo['tipo']; label: string }> = [
  { value: 'texto', label: 'Texto largo' },
  { value: 'linea', label: 'Línea' },
  { value: 'numero', label: 'Número' },
  { value: 'eleccion', label: 'Una opción' },
  { value: 'checks', label: 'Varias opciones' },
  { value: 'tabla', label: 'Tabla' },
  { value: 'archivo', label: 'Archivo' },
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Video' },
  { value: 'link', label: 'Link' },
  { value: 'escala', label: 'Escala' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'checklist', label: 'Checklist' },
  { value: 'agenda', label: 'Agendar llamada' },
  // «Lo hice» no se entendía (audio del 08/10/2026, item 10, 17:30: «no entiendo el campo de lo hice»): se
  // llama como el botón que ve el alumno (TareaAlumno, «Marcar como hecho»). El valor sigue siendo 'si'.
  { value: 'confirmacion', label: 'Marcar como hecho' },
  // Item 17 del 08/10/2026: interactuar en la comunidad del producto (lib/curso-tarea-comunidad.ts).
  { value: 'publicar', label: 'Publicar en la comunidad' },
  { value: 'comentar', label: 'Comentar en la comunidad' },
];

/**
 * Lo que le falta a UN campo para poder guardarse, o `null`. Errores CORTOS: se dibujan tal cual.
 *
 * ⚠️ SE MIRA ANTES DE SANEAR, por lo mismo que la pregunta vacía (ver `validarClase`): `sanearCampos`
 * tira en silencio una pregunta de quiz sin texto o con una sola opción, y un link de agenda inválido.
 * En la base está bien; en el editor sería que la pregunta desaparece al guardar sin que nadie lo diga.
 *
 * Las reglas que NO son de forma sino de sentido, y por eso viven acá:
 *   · un quiz sin una correcta marcada no se puede aprobar nunca (`corregirQuiz` la da por mal);
 *   · una pregunta de UNA respuesta con dos correctas no tiene cómo contestarse bien;
 *   · una escala sin sus dos extremos es «una pregunta muerta» (un 7 de qué);
 *   · una checklist sin acciones o una agenda sin link no piden nada.
 */
export function faltaEnCampo(c: Record<string, unknown> | null | undefined): string | null {
  const label = typeof c?.label === 'string' ? c.label.trim() : '';
  const nom = `«${label.slice(0, 40)}»`;
  const lleno = (x: unknown) => Array.isArray(x) && x.some((s) => typeof s === 'string' && s.trim());
  const tipo = c?.tipo;
  if ((tipo === 'eleccion' || tipo === 'checks') && !lleno(c?.opciones)) return `Faltan las opciones de ${nom}.`;
  if (tipo === 'checklist' && !lleno(c?.opciones)) return `Faltan las acciones de ${nom}.`;
  if (tipo === 'tabla' && !lleno(c?.columnas)) return `Faltan las columnas de ${nom}.`;
  // `urlDeAgenda` y no `linkValido`: el código `<iframe>` de una agenda conocida también vale (item 15).
  if (tipo === 'agenda' && !urlDeAgenda(c?.url)) return `Falta el link para agendar de ${nom}.`;
  if (tipo === 'escala') {
    const e = (c?.escala ?? {}) as Record<string, unknown>;
    const punta = (x: unknown) => typeof x === 'string' && x.trim().length > 0;
    if (!punta(e.bajo) || !punta(e.alto)) return `Faltan los extremos de ${nom}.`;
  }
  if (tipo === 'quiz') {
    const ps = Array.isArray(c?.preguntas) ? (c!.preguntas as Array<Record<string, unknown> | null>) : [];
    if (!ps.length) return `Faltan las preguntas de ${nom}.`;
    // ⚠️ Los dos topes del saneo (`sanearPreguntas`) cortan EN SILENCIO lo que sobra: una correcta que
    // caía en la opción 13 dejaba la pregunta sin correcta, y el quiz no lo aprobaba nadie (revisión
    // del 08/10/2026). Se dicen acá, antes de guardar.
    if (ps.length > MAX_PREGUNTAS) return `Máximo ${MAX_PREGUNTAS} preguntas en ${nom}.`;
    for (const [i, p] of ps.entries()) {
      const n = `la pregunta ${i + 1} de ${nom}`;
      if (!(typeof p?.texto === 'string' && p.texto.trim())) return `Falta el texto de ${n}.`;
      const opciones = (Array.isArray(p?.opciones) ? p!.opciones as unknown[] : []).filter((s): s is string => typeof s === 'string' && !!s.trim()).map((s) => s.trim());
      if (new Set(opciones).size < 2) return `Faltan opciones en ${n}.`;
      if (new Set(opciones).size > MAX_OPCIONES_QUIZ) return `Máximo ${MAX_OPCIONES_QUIZ} opciones en ${n}.`;
      const correctas = (Array.isArray(p?.correctas) ? p!.correctas as unknown[] : []).filter((s): s is string => typeof s === 'string' && opciones.includes(s.trim()));
      if (!correctas.length) return `Marca la correcta en ${n}.`;
      if (p?.multiple !== true && new Set(correctas).size > 1) return `En ${n} hay dos correctas.`;
    }
  }
  return null;
}

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
  // Panda, Wistia y Bunny se guardan como 'url' (el CHECK de la mig 0202): el nombre sale del proveedor.
  return { hay: video != null, rotulo: (v?.proveedor ? nombreDeProveedor(v.proveedor) : null) ?? ROTULO_VIDEO[v?.tipo ?? c.videoTipo], medible };
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

/**
 * El orden de un módulo con `claseId` metida ANTES de `antesDe` (`null` = al final): la lista
 * entera de ids, que quien escribe renumera 0..n-1 (el mismo criterio que `reordenar`). Sirve para
 * mover dentro del mismo módulo y para traerla de otro. `null` = `antesDe` no es de ese módulo, o
 * es la misma clase.
 */
export function ordenConClaseEn(idsDelModulo: readonly number[], claseId: number, antesDe: number | null): number[] | null {
  if (antesDe === claseId) return null;
  const resto = idsDelModulo.filter((id) => id !== claseId);
  if (antesDe == null) return [...resto, claseId];
  const i = resto.indexOf(antesDe);
  if (i < 0) return null;
  return [...resto.slice(0, i), claseId, ...resto.slice(i)];
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
 * El video que llega del editor, validado: uno de tres, y el link sólo si es http/https (va al `src`
 * de un iframe que ve el cliente: `videoDeLink` es el que lo garantiza). Un archivo subido, sólo si es
 * de ESTE producto de ESTE workspace. Lo usan el guardado entero (`validarClase`) y el del video solo
 * (`guardarCampoClase`, lib/curso-admin.ts): una regla, no dos que divergen.
 *
 * Acepta `{ tipo: 'link', url }` (el del editor de siempre) y `{ tipo: 'url', url }` (el contrato
 * de la lección editable). `null` o `{ tipo: 'ninguno' }` = sin video.
 */
export function validarVideoEntrada(
  raw: unknown,
  ctx: { ws: number; productoId: number },
): { ok: true; video: Pick<FilaClaseGuardar, 'video_tipo' | 'video_url' | 'video_path'> } | { ok: false; error: string } {
  const v = (raw ?? { tipo: 'ninguno' }) as { tipo?: unknown; url?: unknown; path?: unknown };
  if (v.tipo === 'link' || v.tipo === 'url') {
    const rec = videoDeLink(typeof v.url === 'string' ? v.url : '');
    if (!rec) return { ok: false, error: 'Ese link no es válido.' };
    return { ok: true, video: { video_tipo: rec.tipo, video_url: rec.url, video_path: null } };
  }
  if (v.tipo === 'archivo') {
    const path = typeof v.path === 'string' ? v.path : '';
    if (!pathEsDelProducto(path, ctx.ws, ctx.productoId)) return { ok: false, error: 'Ese video no es de este curso.' };
    return { ok: true, video: { video_tipo: 'archivo', video_url: null, video_path: path } };
  }
  if (v.tipo != null && v.tipo !== 'ninguno') return { ok: false, error: 'Ese video no se entiende.' };
  return { ok: true, video: { video_tipo: 'ninguno', video_url: null, video_path: null } };
}

/**
 * Los campos del formulario que llegan del editor, revisados uno por uno ANTES de sanear (ver
 * `validarClase`) y saneados. La misma pieza para el guardado entero y para el de los campos solos.
 */
export function validarCamposEntrada(raw: unknown): { ok: true; campos: Campo[] } | { ok: false; error: string } {
  const crudos = Array.isArray(raw) ? (raw as Array<Record<string, unknown> | null>) : [];
  if (crudos.length > 60) return { ok: false, error: 'Son más de 60 campos.' };
  for (const c of crudos) {
    const label = typeof c?.label === 'string' ? c.label.trim() : '';
    if (!label) return { ok: false, error: 'Hay un campo sin pregunta.' };
    const falta = faltaEnCampo(c);
    if (falta) return { ok: false, error: falta };
  }
  // ⚠️ LOS REPETIDOS SE PREGUNTAN ACÁ, ANTES DE SANEAR (revisión del 08/10/2026). Hasta ese día
  //    `sanearCampos` TIRABA el segundo id repetido y esto lo detectaba contando largos; desde el item 2
  //    del audio («se me borraron todos los campos») lo RENOMBRA, así que el largo ya no cambia y la
  //    cuenta daba «ok» sobre dos campos con el mismo id. Se compara el id como lo deja el saneo.
  const ids = crudos.map((c) => (typeof c?.id === 'string' ? c.id.trim().slice(0, 80).replace(/[^\w-]/g, '-') : ''));
  if (new Set(ids).size !== ids.length) return { ok: false, error: 'Hay campos repetidos.' };
  // Y lo que el saneo DESCARTE (basura, o la consigna de una `seccion`, que acá no hay con qué sanear:
  // va por `guardarLeccion`) rechaza en vez de guardar una lista con menos de lo que la persona ve.
  const descartes: string[] = [];
  const campos = sanearCampos(crudos, { descartes });
  if (descartes.length || campos.length !== crudos.length) return { ok: false, error: 'Hay un campo que no se pudo leer.' };
  return { ok: true, campos };
}

/** El error de «Cierra la etapa» en un módulo SUELTO: no es una etapa, no cierra nada. */
export const ERROR_OBLIGATORIA_SUELTO = 'Un módulo suelto no cierra etapas.';

/**
 * «Obligatoria para avanzar» sin nada que pedir. Lo dicen el server (`validarClase`, `guardarCampoClase`) y
 * el motivo del interruptor del menú «…» (`motivoObligatoria`, ./leccion-reglas.ts): un texto, un lugar.
 * Antes era «Para cerrar la etapa, agrega la tarea.», y pegado al interruptor se leyó como un bug (audio
 * del 08/10/2026, 13:00: «Hay uno, un bug cuando dice obligatorio para avanzar que dice… Para cerrar la
 * etapa, agrega la tarea»).
 */
export const ERROR_OBLIGATORIA_SIN_TAREA = 'Necesita una tarea.';

/**
 * Valida y normaliza lo que guarda el editor. Los errores son CORTOS: se dibujan tal cual.
 *
 * ⚠️ LOS CAMPOS SE REVISAN ANTES DE SANEAR, y es a propósito: `sanearCampos` TIRA en silencio
 * un campo sin pregunta. Para la base eso está bien, pero en el editor sería que Mauricio
 * agrega un campo, lo deja a medias, guarda, y el campo desaparece sin que nada se lo diga.
 *
 * `ctx.modulos`: las claves de los MÓDULOS del curso (D1: las etapas que son módulo y los sueltos).
 * `ctx.sueltos`: cuáles de ésos son sueltos — ahí «Cierra la etapa» no tiene etapa que cerrar (el
 * paso automático es sólo de los vinculados) y se rechaza en vez de guardarse sin efecto.
 */
export function validarClase(
  raw: unknown,
  ctx: { ws: number; productoId: number; modulos: readonly string[]; sueltos?: readonly string[] },
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
  if (!ctx.modulos.includes(etapa)) return { ok: false, error: 'Ese módulo no existe.' };

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

  const vv = validarVideoEntrada(r.video, ctx);
  if (!vv.ok) return vv;
  const video = vv.video;

  // Los campos, revisados uno por uno antes del saneo (ver arriba).
  const vc = validarCamposEntrada(r.campos);
  if (!vc.ok) return vc;
  const campos = vc.campos;

  // «Cierra la etapa» sin nada que hacer no cierra nada: `obligatoriasDe` (lib/curso.ts) sólo
  // cuenta las que piden algo, así que la marca quedaría guardada y sin efecto — y la etapa no
  // avanzaría sola sin que nadie entienda por qué.
  const obligatoria = r.obligatoria === true;
  if (obligatoria && !tieneTarea({ tarea, campos })) return { ok: false, error: ERROR_OBLIGATORIA_SIN_TAREA };
  if (obligatoria && ctx.sueltos?.includes(etapa)) return { ok: false, error: ERROR_OBLIGATORIA_SUELTO };

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
export type CeldaEtapa = { enviadas: number; total: number; completa: boolean };

/**
 * Lo que la tabla dice de un cliente: cuántas tareas envió en cada etapa y cuánto vio de los
 * videos de SU etapa. Los números salen de `conteoDeEtapa` y `vistoDeEtapa` (lib/curso.ts), los
 * mismos que usan la ficha y el portal: `completa` es la regla que MUEVE al cliente (las
 * obligatorias enviadas), no «enviadas === total».
 */
export function avanceDeCliente(
  clases: readonly Clase[],
  etapas: readonly string[],
  etapaActual: string | null,
  progreso: ReadonlyMap<number, ProgresoLigero> | undefined,
): { porEtapa: Record<string, CeldaEtapa>; pctVisto: number | null; videosSinMedir: number } {
  const porEtapa: Record<string, CeldaEtapa> = {};
  const estadoDe = (id: number) => progreso?.get(id)?.estado;
  for (const e of etapas) {
    const k = conteoDeEtapa(clases.filter((c) => c.etapa === e), estadoDe);
    porEtapa[e] = { total: k.tareas, enviadas: k.enviadas, completa: k.completa };
  }
  const visto = etapaActual
    ? vistoDeEtapa(clases.filter((c) => c.etapa === etapaActual), (id) => progreso?.get(id)?.pct)
    : { pct: null, sinMedir: 0 };
  return { porEtapa, pctVisto: visto.pct, videosSinMedir: visto.sinMedir };
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
  /** Su email en el CRM: lo prellena «Invitar alumnos» del editor. Ausente = no se leyó. */
  email?: string | null;
};

/** Las filas en el orden del recorrido: por etapa (la primera arriba) y por nombre adentro. */
export function ordenarFilas(filas: readonly FilaAvance[], etapas: readonly string[]): FilaAvance[] {
  const pos = (e: string | null) => (e == null ? etapas.length : Math.max(0, etapas.indexOf(e)));
  return [...filas].sort((a, b) => pos(a.etapa) - pos(b.etapa) || a.nombre.localeCompare(b.nombre, 'es'));
}

// ⚠️ «GRABAR / NO GRABAR» (#693) SE FUE el 08/10/2026 (item 15 de Martín: «Elimina el botón de
// "grabar/no grabar"»), con su regla (`valorGrabar`) y su conteo («N por grabar», `porGrabar`). La
// columna `curso_clases.grabar` (mig 0208) queda con lo que tenía y nadie la lee.

// ── Las notas del equipo (#692, mig 0208) ────────────────────────────────────
// ⚠️ La pantalla de las notas se fue el 08/10/2026 (item 13: «Elimina la sección de "Notas" en todos
// lados»). Quedan la tabla, el bucket, lib/curso-notas.ts y estas reglas: las usa la purga de los
// archivos huérfanos (lib/curso-purga.ts), que sigue barriendo el bucket.

/**
 * Los formatos que acepta el bucket `curso-notas` (mig 0208, `allowed_mime_types`): documentos,
 * planillas e imágenes. ⚠️ LOS MISMOS QUE LOS DEL BUCKET, por la misma razón que `MIME_VIDEO`:
 * Storage rechaza recién al terminar de subir. Un test compara esta lista con la migración.
 */
export const MIME_NOTA = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'text/csv',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;
export type MimeNota = (typeof MIME_NOTA)[number];

/** El tope de un adjunto: 25 MiB, el `file_size_limit` del bucket (mig 0208). El del bucket, no uno mío. */
export const TOPE_NOTA_BYTES = 25 * 1024 * 1024;
/** El tope del texto de una nota. Es un comentario, no un documento: el documento se adjunta. */
export const TOPE_NOTA_TEXTO = 5000;
/** El tope del nombre original de un adjunto (se guarda aparte de la ruta). */
export const TOPE_NOMBRE_ADJUNTO = 160;

const EXT_DE_MIME_NOTA: Record<MimeNota, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods',
  'text/csv': 'csv',
  'text/plain': 'txt',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MIME_NOTA_DE_EXT: Record<string, MimeNota> = {
  ...Object.fromEntries(Object.entries(EXT_DE_MIME_NOTA).map(([m, e]) => [e, m as MimeNota])),
  jpeg: 'image/jpeg',
};
const EXTS_NOTA = [...new Set(Object.values(EXT_DE_MIME_NOTA))].join('|');

export const esMimeNota = (m: string | null | undefined): m is MimeNota => (MIME_NOTA as readonly string[]).includes(m ?? '');

/** Lo que va en el `accept` del input de archivo: los tipos y las extensiones. */
export const ACEPTA_NOTA = [...MIME_NOTA, ...Object.keys(MIME_NOTA_DE_EXT).map((e) => `.${e}`)].join(',');

/**
 * El tipo de un adjunto elegido. PRIMERO la extensión, después lo que diga el navegador.
 *
 * ⚠️ AL REVÉS QUE `mimeDeArchivo`, y es a propósito: con Excel instalado, Windows le pone
 * `application/vnd.ms-excel` a un .csv, y hay navegadores que dejan vacío (o en
 * `application/octet-stream`) un .docx. La extensión es lo único parejo entre máquinas. Y el
 * tipo viaja en la parte del multipart: con el equivocado, el bucket rebota un archivo bueno.
 */
export function mimeDeNota(nombre: string, tipo: string | null | undefined): MimeNota | null {
  const ext = (nombre.includes('.') ? nombre.split('.').pop() ?? '' : '').toLowerCase();
  if (MIME_NOTA_DE_EXT[ext]) return MIME_NOTA_DE_EXT[ext];
  return esMimeNota(tipo) ? tipo : null;
}

/**
 * Dónde se guarda un adjunto: `<ws>/<producto>/<uuid>.<ext>` en `curso-notas`.
 * ⚠️ El workspace primero y puesto por el server, como el video (`pathDeSubida`): es lo que deja
 * preguntar «¿este archivo es de este negocio?» con un prefijo. El nombre original NO entra.
 */
export function pathDeNota(ws: number, productoId: number, mime: string, uuid: string): string | null {
  if (!esMimeNota(mime) || !Number.isInteger(ws) || ws <= 0 || !Number.isInteger(productoId) || productoId <= 0) return null;
  if (!new RegExp(`^${UUID}$`).test(uuid)) return null;
  return `${ws}/${productoId}/${uuid}.${EXT_DE_MIME_NOTA[mime]}`;
}

/** ¿Este path es un adjunto subido para ESTE producto de ESTE workspace? (lo que guarda una nota) */
export function pathEsNotaDelProducto(path: string | null | undefined, ws: number, productoId: number): boolean {
  return typeof path === 'string' && new RegExp(`^${ws}/${productoId}/${UUID}\\.(${EXTS_NOTA})$`).test(path);
}

/** ¿Este path es un adjunto de ESTE workspace? (lo que se puede descartar) */
export function pathEsNotaDelWorkspace(path: string | null | undefined, ws: number): boolean {
  return typeof path === 'string' && new RegExp(`^${ws}/\\d{1,12}/${UUID}\\.(${EXTS_NOTA})$`).test(path);
}

/**
 * El nombre original de un adjunto, para mostrarlo y para el «descargar como». Sin carpetas, sin
 * caracteres de control, y con tope. Viaja desde el navegador: no se cree.
 */
export function nombreDeAdjunto(raw: unknown): string {
  // Los caracteres de control van como escape (AGENTS.md: un byte NUL crudo hace que la búsqueda
  // declare el archivo binario).
  const s = typeof raw === 'string' ? raw.replace(/[\u0000-\u001f\u007f]/g, '').split(/[\\/]/).pop()!.trim() : '';
  return (s || 'archivo').slice(0, TOPE_NOMBRE_ADJUNTO);
}

/**
 * ¿El adjunto se abre en el navegador o se descarga? PDF, imágenes y texto se ven; una planilla o
 * un Word no se pueden ver ahí, así que se bajan con su nombre original (la ruta es un uuid).
 */
export const adjuntoSeVe = (mime: string | null | undefined): boolean =>
  mime === 'application/pdf' || mime === 'text/plain' || (typeof mime === 'string' && mime.startsWith('image/'));

/** De qué cuelga una nota: UNA clase o UNA etapa (la clave de la entrega), nunca las dos. */
export type DestinoNota = { claseId: number } | { etapa: string };

/** Lo que manda el navegador al comentar. Viaja desde el navegador: se valida entero. */
export type EntradaNota = {
  productoId: number;
  claseId?: number | null;
  etapa?: string | null;
  texto?: string;
  archivo?: { path: string; nombre: string; mime: string; bytes: number } | null;
};

/** Las columnas de `curso_clase_notas` que escribe un comentario (sin id, workspace ni autor). */
export type FilaNotaGuardar = {
  producto_id: number;
  clase_id: number | null;
  etapa: string | null;
  texto: string;
  archivo_path: string | null;
  archivo_nombre: string | null;
  archivo_mime: string | null;
  archivo_bytes: number | null;
};

/** Una nota como la dibuja la pantalla. ⚠️ SIN la ruta del adjunto: se abre por el id de la nota. */
export type NotaVista = {
  id: number;
  autor: string;
  texto: string;
  archivo: { nombre: string; mime: string; bytes: number | null } | null;
  createdAt: string;
  /** La puede borrar quien mira: es suya, o es admin. Lo decide el server; el botón sólo se dibuja. */
  borrable: boolean;
};

/**
 * Valida un comentario. Errores CORTOS: se dibujan tal cual.
 *
 * ⚠️ QUE LA CLASE SEA DE ESTE NEGOCIO NO SE PUEDE SABER ACÁ (hace falta la base): lo mira
 * `agregarNota` con `claseDeId`. Acá va lo que se sabe sin leer nada: que cuelgue de UNA cosa,
 * que la etapa exista en la entrega, que el adjunto sea un archivo de este producto y de un tipo
 * que el bucket acepta, y que haya algo que guardar.
 */
export function validarNota(
  raw: unknown,
  ctx: { ws: number; productoId: number; etapas: readonly string[] },
): { ok: true; fila: FilaNotaGuardar } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'No llegó la nota.' };
  const r = raw as Record<string, unknown>;
  if (Number(r.productoId) !== ctx.productoId) return { ok: false, error: 'Ese producto no es este.' };

  const claseId = r.claseId == null ? null : Number(r.claseId);
  const etapa = typeof r.etapa === 'string' && r.etapa ? r.etapa : null;
  if ((claseId == null) === (etapa == null)) return { ok: false, error: 'La nota no tiene dónde ir.' };
  if (claseId != null && (!Number.isInteger(claseId) || claseId <= 0)) return { ok: false, error: 'Esa clase no existe.' };
  if (etapa != null && !ctx.etapas.includes(etapa)) return { ok: false, error: 'Esa etapa no existe.' };

  const texto = typeof r.texto === 'string' ? r.texto.trim() : '';
  if (texto.length > TOPE_NOTA_TEXTO) return { ok: false, error: 'La nota es demasiado larga.' };

  let archivo: Pick<FilaNotaGuardar, 'archivo_path' | 'archivo_nombre' | 'archivo_mime' | 'archivo_bytes'> =
    { archivo_path: null, archivo_nombre: null, archivo_mime: null, archivo_bytes: null };
  if (r.archivo != null) {
    const a = r.archivo as Record<string, unknown>;
    const path = typeof a.path === 'string' ? a.path : '';
    if (!pathEsNotaDelProducto(path, ctx.ws, ctx.productoId)) return { ok: false, error: 'Ese archivo no es de este curso.' };
    const mime = typeof a.mime === 'string' ? a.mime : '';
    if (!esMimeNota(mime)) return { ok: false, error: 'Ese formato no va.' };
    const bytes = Number(a.bytes);
    if (!Number.isFinite(bytes) || bytes <= 0 || bytes > TOPE_NOTA_BYTES) return { ok: false, error: 'Pasa de 25 MB.' };
    archivo = { archivo_path: path, archivo_nombre: nombreDeAdjunto(a.nombre), archivo_mime: mime, archivo_bytes: Math.round(bytes) };
  }

  if (!texto && !archivo.archivo_path) return { ok: false, error: 'La nota está vacía.' };
  return { ok: true, fila: { producto_id: ctx.productoId, clase_id: claseId, etapa, texto, ...archivo } };
}

// ── Los archivos huérfanos de los buckets del curso ──────────────────────────

/** Un objeto del bucket, como lo devuelve el listado de Storage. */
export type ArchivoBucket = { path: string; createdAt: string | null };

/**
 * Cuánto tiene que tener un archivo para poder ser huérfano. La URL de subida vive 2 h
 * (`urlSubida`) y el editor guarda en la misma sesión: con 24 h, un archivo sin clase no es una
 * subida en curso, es una subida abandonada (la pestaña se cerró, se cayó la red).
 */
export const EDAD_MIN_HUERFANO_HORAS = 24;

/** ¿Este path tiene la forma de un VIDEO que subió la tab, de cualquier workspace? */
export const esVideoSubido = (p: string): boolean => new RegExp(`^\\d{1,12}/\\d{1,12}/${UUID}\\.(mp4|webm|mov|m4v)$`).test(p);
/** ¿Este path tiene la forma de un ADJUNTO de nota, de cualquier workspace? */
export const esAdjuntoSubido = (p: string): boolean => new RegExp(`^\\d{1,12}/\\d{1,12}/${UUID}\\.(${EXTS_NOTA})$`).test(p);

/**
 * Qué archivos se pueden borrar: los que tienen la forma de lo que sube la tab, que NINGUNA fila
 * de NINGÚN workspace nombra, y que tienen más de 24 h.
 *
 * ⚠️ «NINGÚN WORKSPACE», no el del cron: el bucket es uno solo para toda la plataforma, y un
 * cruce contra las clases de un inquilino declararía huérfanos los videos de todos los demás.
 * ⚠️ SIN FECHA NO HAY EDAD: un objeto cuya fecha no se puede leer no se borra. Y un path con
 * otra forma (un placeholder que crea el panel de Supabase, algo subido a mano) no se toca:
 * esto limpia lo que la tab sube, no el bucket.
 */
export function huerfanosABorrar(
  archivos: readonly ArchivoBucket[],
  referenciados: ReadonlySet<string>,
  ahoraMs: number,
  esPropio: (path: string) => boolean,
  edadMinHoras: number = EDAD_MIN_HUERFANO_HORAS,
): string[] {
  const limite = ahoraMs - edadMinHoras * 3_600_000;
  return archivos
    .filter((a) => {
      if (!esPropio(a.path) || referenciados.has(a.path)) return false;
      const t = a.createdAt ? Date.parse(a.createdAt) : NaN;
      return Number.isFinite(t) && t < limite;
    })
    .map((a) => a.path);
}

/**
 * La decisión entera de una purga, FAIL-CLOSED: ante la duda no se borra nada.
 *
 * ⚠️ «LAS CLASES VOLVIERON VACÍAS» CON ARCHIVOS EN EL BUCKET NO SE CREE. Una lectura que contesta
 * cero filas sin error (un filtro roto, una tabla que se renombró, un permiso) es indistinguible
 * de «nadie usa nada», y creerla borraría el video de cada clase de cada cliente. Es la misma
 * regla que `borrarArchivo` (lib/curso-admin.ts): un huérfano cuesta disco, uno borrado de más
 * cuesta la clase. El costo aceptado: si de verdad no queda ninguna clase con video, lo que
 * quedó en el bucket se borra a mano.
 */
export function decidirPurga(p: {
  archivos: readonly ArchivoBucket[];
  referencias: { ok: true; paths: readonly string[] } | { ok: false; error: string };
  ahoraMs: number;
  esPropio: (path: string) => boolean;
}): { borrar: string[]; motivo: string | null } {
  if (!p.referencias.ok) return { borrar: [], motivo: `No pude leer qué se usa: ${p.referencias.error}` };
  const propios = p.archivos.filter((a) => p.esPropio(a.path));
  if (p.referencias.paths.length === 0 && propios.length > 0) {
    return { borrar: [], motivo: `La lectura volvió sin ninguna referencia y el bucket tiene ${propios.length}: no borro nada.` };
  }
  return { borrar: huerfanosABorrar(propios, new Set(p.referencias.paths), p.ahoraMs, p.esPropio), motivo: null };
}

/**
 * ¿Esta vuelta de la purga BORRA, o sólo cuenta? Borra únicamente con un `'1'` explícito: en la
 * URL (`?borrar=1`, una corrida a mano después de leer la de prueba) o en el entorno
 * (`CURSO_PURGA_BORRAR=1`, que es lo que prende el cron diario). Cualquier otra cosa —ausente,
 * vacía, `'true'`, `'0'`— es modo PRUEBA.
 *
 * ⚠️ EL DEFAULT ES NO BORRAR, a propósito: el contenido de los buckets nunca se midió, y sin esto
 * lo primero que hacía el cron en producción era un `remove` real. Primero se lee la salida en
 * modo prueba (qué borraría y cuánto pesa), y recién ahí se prende.
 */
export function pideBorrarPurga(query: string | null | undefined, env: string | null | undefined): boolean {
  return query === '1' || env === '1';
}
