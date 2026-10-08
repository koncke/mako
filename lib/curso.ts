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

import type { Bloqueo } from './curso-bloqueo';
// La lista blanca de lo que se inserta (contrato 4, pista VIDEO). Con otro nombre: acá `embedDe` es el
// del video de la clase (una `VideoReconocido`), que es otra cosa.
import { embedDe as embedDeTexto } from './embeds';
import { direccionDeTexto, reconocerUrl, pideCodigo, claseDeProveedor } from './embeds';

export type VideoTipo = 'ninguno' | 'archivo' | 'youtube' | 'vimeo' | 'loom' | 'drive' | 'url';
export type TipoClase = 'concepto' | 'demostracion' | 'clinica' | 'clase' | 'formulario';
export type EstadoTarea = 'pendiente' | 'enviada' | 'aprobada';

/**
 * Un campo del formulario de una tarea. Los seis primeros son el molde del programa viejo
 * (`lib/programa-campos.ts` en 07d07139^), que traía los 114 campos de los Cuestionarios Maestros de
 * Mauricio con este tipo.
 *
 * Los nueve de abajo son la #18 (07/10/2026): «Piensa en qué otras tareas se podría pedir aparte de
 * formularios e impleméntalas». Salen del relevo de Skool, Kajabi y Thinkific (docs/diseno-curso-skool.md,
 * D5): lo más usado en consultoría es el ENTREGABLE con devolución (`archivo`), practicar un pitch
 * grabándolo (`audio`, `video`), el link a lo que ya hizo en otro lado (`link`), la encuesta
 * (`escala`), el quiz corto (`quiz`), las acciones a tildar (`checklist`), la llamada agendada
 * (`agenda`) y el «lo hice» (`confirmacion`).
 *
 * ⚠️ SON UN `tipo` MÁS DEL CAMPO, NO UN TIPO DE CLASE NI UNA TABLA: los `campos` viajan en un jsonb
 * de `curso_clases` que ya pasa por `sanearCampos` en cada guardado, así que un tipo nuevo no pide
 * migrar la clase, ni tocar el editor de la clase, ni el guardado. Lo que cada uno agrega va en sus
 * propias propiedades opcionales de abajo (AGENTS.md, «un CAMPO del nodo es UNA rama»).
 */
export type CampoTipo =
  | 'texto' | 'linea' | 'numero' | 'eleccion' | 'checks' | 'tabla'
  | 'archivo' | 'audio' | 'video' | 'link' | 'escala' | 'quiz' | 'checklist' | 'agenda' | 'confirmacion'
  // Item 17 del 08/10/2026 («faltan opciones en las tareas para interactuar en la comunidad que
  // hicimos»): el alumno PUBLICA un post o COMENTA uno desde la tarea, en la comunidad del producto
  // (D8, lib/comunidad-datos.ts). Ver `esCampoDeComunidad` y lib/curso-tarea-comunidad.ts.
  | 'publicar' | 'comentar'
  // Item 12 del audio del 08/10/2026 (21:30, «sería bueno que se pueda agregar más de una tarea»): una
  // `seccion` NO SE CONTESTA, ABRE OTRA TAREA. Su `label` es el título de esa tarea y su `descripcionHtml`
  // la consigna con formato; los campos que la siguen son suyos, hasta la próxima (`tareasDeClase`). Es
  // un tipo de campo y no una tabla ni una columna por lo mismo que los de la #18: viaja en el jsonb
  // `campos`, que ya pasa por `sanearCampos`, y no pide migrar nada. ⚠️ El costo: TODO lector de
  // `.campos` la tiene que saltear (`camposConRespuesta`), y lo fija tests/curso-tareas-secciones.test.ts.
  | 'seccion';

/**
 * Una pregunta de un quiz. Se contesta con UNA opción (radio) o, con `multiple`, con casillas.
 *
 * ⚠️ LAS CORRECTAS SE GUARDAN POR SU TEXTO, NO POR SU POSICIÓN: el editor escribe las opciones una
 * por renglón y `sanearCampos` tira los renglones vacíos, así que un índice quedaría apuntando a otra
 * opción después de cada guardado. Con el texto, renombrar una opción la desmarca (y el editor lo
 * muestra), que es el error que se ve.
 *
 * ⚠️ `correctas` NUNCA VIAJA AL NAVEGADOR DEL ALUMNO: la saca `camposParaAlumno`, que es lo que usa
 * `claseVista` (lib/curso-portal.ts). El quiz se corrige en el SERVER (`corregirEnvio`).
 */
export type PreguntaQuiz = {
  id: string;
  texto: string;
  opciones: string[];
  correctas?: string[];
  /** Más de una correcta: hay que marcar TODAS y sólo ésas. */
  multiple?: boolean;
};

/**
 * Una escala (encuesta / NPS). ⚠️ LOS DOS EXTREMOS SON OBLIGATORIOS (los exige `validarClase`): «una
 * escala sin extremos explicados es una pregunta muerta» (AGENTS.md, «Una regla en un prompt no es
 * una regla»): un 7 no dice nada si no se sabe qué es el 1 y qué es el 10.
 */
export type Escala = {
  min: 0 | 1; max: 5 | 10; bajo: string; alto: string;
  /**
   * Cómo se contesta (item 9 del audio del 08/10/2026, 14:50: «la escala lineal podría ser una barra
   * deslizable, no simplemente números seleccionables. O si no, de última, la típica de estrellas»).
   * Ausente = `numeros`, los botones de siempre: así una escala guardada antes sale idéntica del saneo.
   * ⚠️ Con `estrellas` el mínimo es 1 (`sanearCampos` lo fuerza): «cero estrellas» no se puede marcar,
   *    se lee igual que «no contestó».
   */
  estilo?: EstiloEscala;
};
export type EstiloEscala = 'numeros' | 'deslizador' | 'estrellas';
export const ESTILOS_ESCALA: readonly EstiloEscala[] = ['numeros', 'deslizador', 'estrellas'];

export type Campo = {
  id: string;
  label: string;
  tipo: CampoTipo;
  ayuda?: string;
  /** eleccion / checks: las opciones. checklist: las ACCIONES que hay que tildar. */
  opciones?: string[];
  columnas?: string[];
  filasFijas?: string[];
  filasMin?: number;
  obligatorio?: boolean;
  /** archivo: cuántos archivos como mucho (1 a `MAX_ARCHIVOS`). */
  maxArchivos?: number;
  /** audio / video: el tope de la grabación, en segundos. */
  maxSeg?: number;
  /** escala: el rango y qué quiere decir cada punta. */
  escala?: Escala;
  /** quiz: las preguntas. */
  preguntas?: PreguntaQuiz[];
  /**
   * quiz: la nota mínima para aprobar, en %.
   *
   * ⚠️ VA EN EL CAMPO Y NO EN LA TAREA, a propósito: (1) una tarea puede tener más de un quiz (el del
   * módulo y el de repaso) y cada uno su vara; (2) el campo ya viaja en el jsonb `campos` y pasa por
   * `sanearCampos`, así que no hace falta una columna nueva en `curso_clases` ni tocar el guardado de
   * la clase; (3) la nota es de las PREGUNTAS que la producen, y moverlas a otra tarea se lleva su vara.
   */
  notaMin?: number;
  /** quiz: cuántos envíos corregidos se permiten. 0 = sin límite. */
  intentos?: number;
  /** agenda: el link para agendar la llamada (Calendly, Cal…). Sólo http/https (`linkValido`). */
  url?: string;
  /**
   * El TEXTO DE EJEMPLO del cuadro donde contesta el alumno (el `placeholder`), opcional. Sólo en los
   * tipos que tienen un cuadro de texto (`conTextoDeEjemplo`).
   *
   * ⚠️ LA PREGUNTA NUNCA VA DE PLACEHOLDER (item 5 del 08/10/2026, Martín: «No podés poner la pregunta
   *    dentro del cuadro de texto donde va a completar el alumno como si fuera un placeholder, eso
   *    confunde... Tenés que poner arriba del cuadro del texto como título... Y también agregar la
   *    opción de placeholder»). La pregunta es `label` y va ARRIBA, como título; esto es otra cosa, y
   *    sin él el cuadro va vacío.
   */
  placeholder?: string;
  /**
   * publicar: en qué categoría de la comunidad cae el post. Ausente = la primera en la que puede
   * publicar un alumno (lo resuelve el server al publicar: una categoría borrada no deja la tarea sin
   * salida).
   */
  categoriaId?: number;
  /** comentar: el post que se comenta. Ausente = el último FIJADO de la comunidad, al comentar. */
  postId?: number;
  /** comentar: el título de ese post cuando se eligió (lo que dibuja la vista previa del equipo). */
  postTitulo?: string;
  /**
   * seccion: la consigna de ESA tarea, con formato (item 11 del audio: «que tenga negrita… como la
   * descripción»). HTML YA SANEADO EN EL SERVER (lib/html-seguro.ts, con `TOPE_HTML_SECCION`): lo
   * escribe `sanearCampos` sólo si le pasan el saneador (`sanearCamposDelServidor`,
   * lib/curso-tarea-html.ts); sin saneador lo descarta y lo anota. Los adjuntos van por referencia
   * (`mako-adjunto:<id>`), como en la descripción de la clase.
   */
  descripcionHtml?: string;
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
  /**
   * Cuándo se abre ESTA clase (mig 0220, lib/curso-bloqueo.ts). `null`/ausente = hereda: abierta si
   * su módulo lo está. Ausente en los literales viejos, igual que `porArea`.
   */
  bloqueo?: Bloqueo | null;
  /**
   * La descripción RICA (mig 0216): HTML ya saneado en el server (lib/html-seguro.ts) y con los
   * adjuntos por referencia (`mako-adjunto:<id>`). `descripcion` sigue siendo su texto plano (la
   * búsqueda, la IA, los mensajes). Ausente/'' = no tiene (se dibuja el texto plano).
   */
  descripcionHtml?: string;
  /**
   * La consigna de la TAREA PRINCIPAL con formato (mig 0226, `curso_clases.tarea_html`; item 11 del
   * audio del 08/10/2026, 18:00: «sería bueno que sea formateable la descripción de la tarea»). HTML
   * ya saneado en el server, con los adjuntos por referencia. `tarea` sigue siendo su texto plano,
   * DERIVADO al guardar (`tareaParaGuardar`, lib/curso-tarea-html.ts), porque lo leen la IA, los
   * mensajes y `tieneTarea`.
   * `null`/ausente = no tiene: se dibuja `tarea` como texto, que es lo de antes de la 0226. Ausente en
   * los literales viejos, igual que `porArea`.
   */
  tareaHtml?: string | null;
};

/**
 * Un archivo que ENTREGÓ el alumno (campos `archivo`, `audio`, `video`). Vive en el bucket privado
 * `curso-entregas` (mig 0218) bajo `pathDeEntrega`; acá sólo va la referencia. `seg` = cuánto dura
 * una grabación (lo cuenta el navegador; se muestra, no decide nada).
 */
export type ArchivoEntregado = { path: string; nombre: string; mime: string; bytes: number; seg?: number };

/**
 * Un valor de un campo: texto, varias opciones, una tabla (filas x columnas) o archivos entregados.
 *
 *   · link / escala → un texto (la URL; el número como texto).
 *   · agenda / confirmacion → `'si'` (lo confirmó el alumno) o nada.
 *   · checklist → la lista de acciones tildadas.
 *   · quiz → una fila por pregunta con lo que marcó (`string[][]`, alineado con `preguntas`).
 *   · archivo / audio / video → `ArchivoEntregado[]`.
 *
 * ⚠️ LA NOTA DEL QUIZ NO VIVE ACÁ: `valores` lo escribe el navegador (y lo pisa cada autoguardado),
 * así que una nota guardada adentro se podría inventar o se borraría sola. Vive en
 * `curso_progreso.calificacion` (mig 0218), que escribe sólo el server (lib/curso-entregas.ts).
 */
export type ValorCampo = string | string[] | string[][] | ArchivoEntregado[];
export type Valores = Record<string, ValorCampo>;

/**
 * Cómo le fue en UN quiz: la nota (%), si aprobó, cuántos envíos se corrigieron, qué preguntas
 * erró (sus posiciones: no se dice la correcta) y cuándo.
 */
export type NotaQuiz = { nota: number; aprobado: boolean; intentos: number; malas?: number[]; at: string };
/** Las notas de los quizzes de UNA respuesta: campoId → nota. Lo escribe sólo el server. */
export type Calificacion = Record<string, NotaQuiz>;

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
  /**
   * Las notas de sus quizzes (mig 0218, `curso_progreso.calificacion`). Ausente = esta lectura no la
   * trae; `null` = no hay. La escribe sólo el server al corregir (lib/curso-entregas.ts), nunca el
   * navegador: por eso no está en `valores`.
   */
  calificacion?: Calificacion | null;
  /**
   * Cuándo el alumno marcó como HECHA esta clase (mig 0220): el tilde de una clase SIN tarea. Es una
   * de las formas de completarla (lib/curso-bloqueo.ts, `claseCompleta`). Ausente/`null` = no la marcó.
   */
  hechaAt?: string | null;
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
  /**
   * Un video de Panda, Wistia o Bunny (lib/embeds.ts): de quién es y el `src` de su reproductor, que
   * arma lib/embeds.ts. Van con `tipo: 'url'` y su `url` ES ese `src` (la columna `video_tipo` tiene
   * un CHECK con siete valores, mig 0202: un tipo nuevo rebotaría el guardado). Lo que decide cómo se
   * dibuja es esto, no la columna.
   */
  proveedor?: 'panda' | 'wistia' | 'bunny';
  embed?: string;
};

/**
 * Reconoce un link de video, o el CÓDIGO para insertar que copia la persona (item 14 del 08/10/2026,
 * 22:40: «tengo que hacer que funcione con URL y con objetos embed. Con HTML embed»). `null` = no es
 * un link (vacío, no es http/https, o un código que no trae uno).
 *
 * ⚠️ QUÉ host es de quién y cuál es el id lo decide lib/embeds.ts (`reconocerUrl`), el MISMO que usa
 *    el bloque «Insertar» del editor: hasta el 08/10/2026 había un reconocedor acá y faltaban formas
 *    reales. Medido con la tabla de tests/curso-video-embed.test.ts: `music.youtube.com`, `/e/<id>`,
 *    el `attribution_link`, Drive con `/file/u/0/d/` (otra cuenta logueada) y `docs.google.com/file/d/`
 *    caían en «afuera» (un botón que abre otra pestaña); `/embed/videoseries` (una lista) se tomaba por
 *    el id «videoseries»; un showcase de Vimeo daba el número del showcase; y TODO código `<iframe>` y
 *    todo link sin `https://` daban «no es válido».
 * ⚠️ SÓLO http/https: lo que se guarda acá termina en el `src` de un iframe que ve el cliente,
 * y un `javascript:` ahí es un script corriendo en su navegador.
 */
export function videoDeLink(raw: string | null | undefined): VideoReconocido | null {
  const dir = direccionDeTexto(raw);
  if (!dir) return null;
  let u: URL;
  try { u = new URL(dir); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const limpia = u.toString();
  const r = reconocerUrl(u);
  if (r && claseDeProveedor(r.proveedor) === 'video') {
    switch (r.proveedor) {
      case 'youtube': return { tipo: 'youtube', id: r.id, url: limpia, medible: Boolean(r.id) };
      case 'vimeo': return { tipo: 'vimeo', id: r.id, hash: r.hash, url: limpia, medible: Boolean(r.id) };
      case 'loom': return { tipo: 'loom', id: r.id, url: limpia, medible: false };
      case 'drive': return { tipo: 'drive', id: r.id, url: limpia, medible: false };
      case 'panda': case 'wistia': case 'bunny':
        // Sin `src` (un link del reproductor sin el `?v=`) no hay qué mostrar: no es un video.
        // ⚠️ PANDA SE MIDE: su reproductor publica `panda_timeupdate` (los segundos) y `panda_allData`
        //    (la duración) por postMessage — medido el 08/10/2026 en Chrome contra un video real
        //    (Reproductor.tsx, `VideoPanda`). Wistia y Bunny van «sin medir», como Drive.
        return r.src ? { tipo: 'url', id: null, url: r.src, medible: r.proveedor === 'panda', proveedor: r.proveedor, embed: r.src } : null;
    }
  }
  // El panel de Panda (`dashboard.pandavideo.com.br/…`) no trae la biblioteca del reproductor: no es
  // un link que se pueda ver, ni adentro ni afuera (el alumno no tiene cuenta en Panda). Se pide el
  // código (`porQueNoSeInserta`, lib/embeds.ts).
  if (pideCodigo(u) === 'panda') return null;
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
 *   · `panda`    → el reproductor de Panda; se mide por sus mensajes (`panda_timeupdate`/`panda_allData`).
 *   · `iframe`   → Loom, Drive, Wistia o Bunny: se ve, pero no expone el tiempo. «Sin medir».
 *   · `afuera`   → un link que no es ninguna de las anteriores: se abre en otra pestaña. «Sin medir».
 */
export type VideoVista =
  | { tipo: 'archivo' }
  | { tipo: 'directo'; url: string }
  | { tipo: 'youtube'; id: string }
  | { tipo: 'vimeo'; embed: string }
  | { tipo: 'panda'; embed: string }
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
  // Panda, Wistia y Bunny (item 14): adentro, en su reproductor. Antes caían en «afuera».
  if (v.tipo === 'url' && v.embed) return v.proveedor === 'panda' ? { video: { tipo: 'panda', embed: v.embed }, medible: true } : { video: { tipo: 'iframe', embed: v.embed }, medible: false };
  if (v.tipo === 'url') return v.medible ? { video: { tipo: 'directo', url: v.url }, medible: true } : { video: { tipo: 'afuera', url: v.url }, medible: false };
  const embed = embedDe(v);
  if (!embed) return { video: { tipo: 'afuera', url: v.url }, medible: false };
  if (v.tipo === 'vimeo') return { video: { tipo: 'vimeo', embed }, medible: true };
  return { video: { tipo: 'iframe', embed }, medible: false };
}

/**
 * La TAPA de un video, para la tarjeta de la clase: la miniatura que la plataforma ya publica.
 * YouTube la sirve por id; Drive, la del primer fotograma (la misma que usa Conocimientos); Loom, la
 * de su CDN (es la `thumbnail_url` que devuelve su oEmbed, medido el 08/10/2026:
 * `cdn.loom.com/sessions/thumbnails/<id>-00001.jpg`). Un archivo subido no tiene: va sin tapa y la
 * tarjeta queda con el degradé de la casa. `Miniatura` se hace cargo del 404.
 *
 * ⚠️ VIMEO NO SE PUEDE ARMAR CON EL ID: su miniatura es `i.vimeocdn.com/video/<otro id>-<hash>`, y lo
 *    único que la dice es su oEmbed. La pide NUESTRA ruta (`/api/compartido/miniatura`), que la
 *    busca en el server y redirige a la imagen: el navegador del alumno no le pregunta nada a Vimeo hasta
 *    que abre la clase, y la respuesta queda en caché. Item 20 del 08/10/2026: «que por defecto esté
 *    esa [la miniatura del video] siempre que haya vídeo».
 */
export function tapaDeVideo(v: VideoVista | null | undefined): string | null {
  if (!v) return null;
  if (v.tipo === 'youtube') return `https://i.ytimg.com/vi/${encodeURIComponent(v.id)}/hqdefault.jpg`;
  if (v.tipo === 'vimeo') {
    // El embed lo escribió `embedDe`: el id son dígitos y el hash (de un video no listado) hexadecimal.
    const m = /^https:\/\/player\.vimeo\.com\/video\/(\d{1,15})(?:\?h=([0-9a-f]{6,40}))?$/i.exec(v.embed);
    return m ? `${RUTA_MINIATURA}?vimeo=${m[1]}${m[2] ? `&h=${m[2]}` : ''}` : null;
  }
  if (v.tipo === 'iframe') {
    // El id ya viene escapado: lo escribió `embedDe`.
    const drive = /^https:\/\/drive\.google\.com\/file\/d\/([^/]+)\/preview$/.exec(v.embed);
    if (drive) return `https://drive.google.com/thumbnail?id=${drive[1]}&sz=w800`;
    const loom = /^https:\/\/www\.loom\.com\/embed\/([0-9a-z_-]{6,64})$/i.exec(v.embed);
    if (loom) return `https://cdn.loom.com/sessions/thumbnails/${loom[1]}-00001.jpg`;
  }
  return null;
}

/** La ruta que convierte un video de Vimeo en su miniatura (app/api/compartido/miniatura). */
export const RUTA_MINIATURA = '/api/compartido/miniatura';

/**
 * Lo que la ruta de la miniatura acepta de un video de Vimeo: el id (dígitos) y, si es NO LISTADO, su
 * hash. `null` = no es un pedido válido (la ruta contesta 404 sin salir a la red).
 */
export function vimeoDeMiniatura(id: unknown, hash: unknown): { id: string; hash: string | null } | null {
  const i = typeof id === 'string' ? id.trim() : '';
  const h = typeof hash === 'string' ? hash.trim() : '';
  if (!/^\d{1,15}$/.test(i)) return null;
  if (h && !/^[0-9a-f]{6,40}$/i.test(h)) return null;
  return { id: i, hash: h || null };
}

/**
 * ¿La miniatura que contestó Vimeo es de SU CDN? La ruta redirige ahí: comparar el ORIGEN (nunca un
 * prefijo de la url, AGENTS.md) es lo que impide que un oEmbed alterado la vuelva un redirect abierto.
 */
export function esMiniaturaDeVimeo(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  try {
    const u = new URL(raw);
    return u.origin === 'https://i.vimeocdn.com' ? u.toString() : null;
  } catch { return null; }
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

/**
 * ¿La clase pide algo? Una instrucción de llenado (en texto o con formato) o un formulario.
 *
 * ⚠️ UNA `seccion` CUENTA, a propósito: es una tarea más (item 12), aunque todavía no tenga campos —
 *    sin campos se contesta con la respuesta libre, como una tarea de las de antes. `tareaHtml` también
 *    cuenta: una consigna que es sólo una imagen deriva un `tarea` vacío.
 */
export const tieneTarea = (c: Pick<Clase, 'tarea' | 'campos'> & { tareaHtml?: string | null }): boolean =>
  c.tarea.trim().length > 0 || (c.tareaHtml ?? '').trim().length > 0 || c.campos.length > 0;

/**
 * Los campos que se CONTESTAN: todos menos las `seccion` (que abren otra tarea y no piden nada).
 *
 * ⚠️ ES LA PUERTA DE TODO LECTOR DE `.campos` que cuente, sanee, corrija o dibuje respuestas: una
 *    `seccion` contada como campo deja una tarea sin enviar para siempre («contesta al menos una»
 *    sobre algo que no se puede contestar), un rótulo «—» en la ficha y un campo vacío en el prompt
 *    de la IA. Lo fija tests/curso-tareas-secciones.test.ts, que barre app/ y lib/.
 */
export const camposConRespuesta = (campos: readonly Campo[]): Campo[] => campos.filter((c) => c.tipo !== 'seccion');

/** Una TAREA de la clase: la principal (`id: null`) o una `seccion`, con sus campos. */
export type TareaDeClase = { id: string | null; titulo: string | null; descripcionHtml: string | null; campos: Campo[] };

/**
 * Las tareas de una clase, en orden (item 12 del audio del 08/10/2026). La PRINCIPAL va siempre
 * primera (`id: null`, su consigna es `tareaHtml`, o `tarea` como texto si es de antes de la 0226) con
 * los campos de ANTES de la primera `seccion`; cada `seccion` abre la suya, con los campos que la
 * siguen hasta la próxima.
 *
 * `[]` = la clase no pide nada (`tieneTarea`). ⚠️ LA PRINCIPAL VA AUNQUE ESTÉ VACÍA cuando hay
 * secciones: el editor la necesita para dibujar su consigna, y el que dibuja para el alumno la saltea
 * con `tareaVacia`.
 */
export function tareasDeClase(c: Pick<Clase, 'tarea' | 'campos'> & { tareaHtml?: string | null }): TareaDeClase[] {
  if (!tieneTarea(c)) return [];
  const html = (c.tareaHtml ?? '').trim();
  const out: TareaDeClase[] = [{ id: null, titulo: null, descripcionHtml: html || null, campos: [] }];
  for (const x of c.campos) {
    if (x.tipo === 'seccion') {
      out.push({ id: x.id, titulo: x.label, descripcionHtml: (x.descripcionHtml ?? '').trim() || null, campos: [] });
      continue;
    }
    out[out.length - 1].campos.push(x);
  }
  return out;
}

/**
 * ¿Una tarea no tiene nada que mostrarle al alumno? (ni título, ni consigna, ni campos). Para la
 * principal, `tareaTexto` es el `tarea` plano de la clase (la consigna de antes de la 0226).
 */
export const tareaVacia = (t: TareaDeClase, tareaTexto = ''): boolean =>
  !t.titulo && !t.descripcionHtml && !t.campos.length && !(t.id == null && tareaTexto.trim());

/**
 * Todo el HTML de las consignas de una clase: la principal y la de cada `seccion`. Lo leen quien
 * decide qué adjunto le sirve al alumno (lib/curso-adjuntos.ts: un adjunto se sirve sólo si lo nombra
 * lo PUBLICADO de esa clase), quien los firma para la vista previa y quien los vincula al guardar.
 */
export function htmlsDeTareas(c: { tareaHtml?: string | null; campos: readonly Campo[] }): string[] {
  return [c.tareaHtml ?? '', ...c.campos.filter((x) => x.tipo === 'seccion').map((x) => x.descripcionHtml ?? '')].filter((h) => h.trim());
}

// ── Lo que le falta a un campo para guardarse (item 2 del audio del 08/10/2026) ──

/** Cuántas tareas puede tener una clase (la principal más las secciones): el cuerpo de una action topea en 1 MB. */
export const MAX_TAREAS = 10;
/** El largo del título de una tarea (`seccion.label`). */
export const TOPE_TITULO_TAREA = 140;
/** El largo de la pregunta de un campo (lo que corta `sanearCampos`). */
export const TOPE_PREGUNTA = 400;
/** El largo del HTML (saneado) de la consigna de una `seccion`. 10 tareas × esto entran holgadas en 1 MB. */
export const TOPE_HTML_SECCION = 20_000;
/** Cuántos campos (secciones incluidas) entran en una clase. Lo mismo corta `sanearCampos`. */
export const TOPE_CAMPOS = 60;

/**
 * Lo que le falta a cada campo para poder guardarse: `id del campo → motivo CORTO`, o `{}`. Una clave
 * `tarea` = algo de la lista entera (demasiados campos, uno roto).
 *
 * ⚠️ ES LA CURA DEL «SE ME BORRARON LOS CAMPOS» (item 2, 15:30-16:40: «volví para atrás y se me borraron
 *    todos los campos de edición»): `sanearCampos` TIRABA en silencio un campo sin la pregunta escrita, así
 *    que se guardaba sin él y al volver ya no estaba. Pidió «un enmarcado rojo y que diga falta completar la
 *    pregunta». Ahora el editor pinta esto en rojo y el server (`guardarLeccion`) RECHAZA con esto ANTES de
 *    sanear: al server no le llega un campo que el saneo vaya a perder.
 *
 * Los motivos son los de `faltaEnCampo` (app/customer-success/curso/reglas.ts) dichos cortos, porque se
 * dibujan pegados al campo y ya se sabe de cuál se habla (AGENTS.md, «el texto que se DIBUJA es corto»).
 *
 * Recibe lo que manda el navegador (un borrador), no algo ya saneado: por eso lee todo a la defensiva.
 */
export function erroresDeCampos(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw == null) return out;
  if (!Array.isArray(raw)) return { tarea: 'Los campos no llegaron.' };
  if (raw.length > TOPE_CAMPOS) out.tarea = `Máximo ${TOPE_CAMPOS} campos.`;
  if (raw.filter((x) => (x as { tipo?: unknown } | null)?.tipo === 'seccion').length > MAX_TAREAS - 1) out.tarea = `Máximo ${MAX_TAREAS} tareas.`;
  const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const lleno = (x: unknown) => Array.isArray(x) && x.some((s) => typeof s === 'string' && s.trim());
  for (const x of raw) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) { out.tarea ??= 'Un campo llegó roto.'; continue; }
    const c = x as Record<string, unknown>;
    const id = texto(c.id);
    if (!id) { out.tarea ??= 'Un campo llegó roto.'; continue; }
    const label = texto(c.label);
    const falta = (m: string) => { if (!out[id]) out[id] = m; };
    if (c.tipo === 'seccion') {
      if (!label) falta('Falta el título');
      else if (label.length > TOPE_TITULO_TAREA) falta('Título muy largo');
      if (typeof c.descripcionHtml === 'string' && c.descripcionHtml.length > TOPE_HTML_SECCION) falta('Texto muy largo');
      continue;
    }
    if (!label) { falta('Falta la pregunta'); continue; }
    if (label.length > TOPE_PREGUNTA) { falta('Pregunta muy larga'); continue; }
    const tipo = c.tipo;
    if ((tipo === 'eleccion' || tipo === 'checks') && !lleno(c.opciones)) falta('Faltan opciones');
    else if (tipo === 'checklist' && !lleno(c.opciones)) falta('Faltan las acciones');
    else if (tipo === 'tabla' && !lleno(c.columnas)) falta('Faltan las columnas');
    else if (tipo === 'agenda' && !urlDeAgenda(c.url)) falta('Falta el link');
    else if (tipo === 'escala') {
      const e = (c.escala && typeof c.escala === 'object' ? c.escala : {}) as Record<string, unknown>;
      if (!texto(e.bajo) || !texto(e.alto)) falta('Faltan los extremos');
    } else if (tipo === 'quiz') {
      const ps = Array.isArray(c.preguntas) ? (c.preguntas as unknown[]) : [];
      if (!ps.length) { falta('Faltan las preguntas'); continue; }
      if (ps.length > MAX_PREGUNTAS) { falta(`Máximo ${MAX_PREGUNTAS} preguntas`); continue; }
      for (const p of ps) {
        const q = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
        if (!texto(q.texto)) { falta('Falta una pregunta'); break; }
        const opciones = [...new Set((Array.isArray(q.opciones) ? q.opciones : []).map(texto).filter(Boolean))];
        if (opciones.length < 2) { falta('Faltan opciones'); break; }
        if (opciones.length > MAX_OPCIONES_QUIZ) { falta(`Máximo ${MAX_OPCIONES_QUIZ} opciones`); break; }
        const correctas = [...new Set((Array.isArray(q.correctas) ? q.correctas : []).map(texto).filter((s) => opciones.includes(s)))];
        if (!correctas.length) { falta('Falta la respuesta correcta'); break; }
        if (q.multiple !== true && correctas.length > 1) { falta('Hay dos correctas'); break; }
      }
    }
  }
  return out;
}

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

const TIPOS_CAMPO: readonly CampoTipo[] = [
  'texto', 'linea', 'numero', 'eleccion', 'checks', 'tabla',
  'archivo', 'audio', 'video', 'link', 'escala', 'quiz', 'checklist', 'agenda', 'confirmacion',
  'publicar', 'comentar', 'seccion',
];

// ── El texto de ejemplo y la comunidad (items 5 y 17 del 08/10/2026) ─────────

/** El largo del texto de ejemplo de un campo: es una pista adentro de un cuadro, no un párrafo. */
export const TOPE_TEXTO_EJEMPLO = 120;

/** ¿Este tipo tiene un CUADRO donde el alumno escribe? Sólo ésos llevan texto de ejemplo. */
export const conTextoDeEjemplo = (t: CampoTipo | string | undefined): boolean =>
  t === 'texto' || t === 'linea' || t === 'numero' || t === 'link';

/** ¿Este tipo se contesta en la COMUNIDAD del producto (un post o un comentario)? */
export const esCampoDeComunidad = (t: CampoTipo | string | undefined): t is 'publicar' | 'comentar' =>
  t === 'publicar' || t === 'comentar';

/**
 * Lo que queda guardado de un campo de comunidad: QUÉ escribió el alumno, por referencia.
 *   · publicar → `"<postId>"`
 *   · comentar → `"<postId>/<comentarioId>"` (el post va adelante: es a dónde lleva el link de la ficha)
 * `null` = no es una referencia de ese tipo.
 *
 * ⚠️ LA FORMA NO DICE QUE SEA SUYO: un número lo escribe cualquiera. Que el post (o el comentario) sea
 *    de ESTE alumno en ESTE producto lo verifica la ruta de la tarea contra la base, antes de guardar
 *    (lib/curso-tarea-comunidad.ts, `verificarComunidad`), igual que las entregas.
 */
export function refDeComunidad(tipo: CampoTipo | string, v: unknown): { postId: number; comentarioId: number | null } | null {
  if (typeof v !== 'string') return null;
  const m = tipo === 'publicar' ? /^(\d{1,12})$/.exec(v.trim()) : tipo === 'comentar' ? /^(\d{1,12})\/(\d{1,12})$/.exec(v.trim()) : null;
  if (!m) return null;
  const postId = Number(m[1]);
  const comentarioId = m[2] ? Number(m[2]) : null;
  if (!(postId > 0) || (tipo === 'comentar' && !(comentarioId! > 0))) return null;
  return { postId, comentarioId };
}

/** La referencia escrita, en la forma de `refDeComunidad`. */
export const valorDeComunidad = (postId: number, comentarioId?: number | null): string =>
  comentarioId ? `${postId}/${comentarioId}` : String(postId);

/** Un id positivo, o `undefined` (lo que se guarda en `categoriaId` / `postId`). */
const idPositivo = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 1e15 ? v : undefined;
const corta = (s: unknown, n: number): string => (typeof s === 'string' ? s.trim().slice(0, n) : '');
/** Un entero dentro de [min, max]; lo que no es un número finito es `def`. */
const entero = (v: unknown, min: number, max: number, def: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : def;

// ── Los topes de los tipos nuevos (#18) ──────────────────────────────────────

/** Cuántos archivos puede pedir un campo `archivo`. */
export const MAX_ARCHIVOS = 10;
/** La nota mínima de un quiz cuando nadie la eligió. */
export const NOTA_MIN_DEFAULT = 70;
/** El tope de una grabación cuando nadie lo eligió, y los límites del que se elija. */
export const MAX_SEG_DEFAULT = 120;
export const MAX_SEG_MIN = 15;
export const MAX_SEG_MAX = 600;
/**
 * Cuántas preguntas tiene un quiz como mucho, y cuántas opciones cada una. Exportadas para que el
 * editor las diga ANTES de guardar (`faltaEnCampo`, app/customer-success/curso/reglas.ts): el saneo
 * corta lo que sobra en silencio, y una correcta que caía en la opción 13 dejaba la pregunta sin
 * correcta — o sea un quiz que no aprueba nadie (revisión del 08/10/2026).
 */
export const MAX_PREGUNTAS = 50;
export const MAX_OPCIONES_QUIZ = 12;

/** ¿Este tipo de campo se contesta con ARCHIVOS (subidos o grabados)? */
export const esCampoDeArchivo = (t: CampoTipo | string | undefined): t is 'archivo' | 'audio' | 'video' =>
  t === 'archivo' || t === 'audio' || t === 'video';

/**
 * Un link que se puede guardar y DIBUJAR como `href`: http o https, con un dominio. `null` = no es un
 * link. A lo que llega sin esquema y parece un dominio («loom.com/share/x») se le pone `https://`: es
 * como lo pega la gente desde el teléfono, y rebotarlo sería perder lo que escribió.
 *
 * ⚠️ SÓLO http/https, por lo mismo que `videoDeLink`: termina en un `href` que alguien toca, y un
 * `javascript:` ahí es un script corriendo en su navegador.
 */
export function linkValido(raw: unknown): string | null {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s || s.length > 2000 || /\s/.test(s)) return null;
  const intentar = (x: string): URL | null => { try { return new URL(x); } catch { return null; } };
  let u = intentar(s);
  if (!u && /^[\w-]+(\.[\w-]+)+([/?#]|$)/.test(s)) u = intentar(`https://${s}`);
  if (!u || (u.protocol !== 'https:' && u.protocol !== 'http:') || !u.hostname.includes('.')) return null;
  return u.toString();
}

/**
 * El link de un campo «Agendar»: un link (`linkValido`) o, si lo pegado es el CÓDIGO de una agenda de la
 * lista blanca (el `<iframe>` de Calendly, el de citas de Google, que con el link solo no se inserta),
 * su dirección. `null` = no hay con qué agendar.
 *
 * ⚠️ Item 15 del audio del 08/10/2026 (24:30: «el Calendar para agendar la llamada directamente desde
 *    ahí»): el alumno la agenda EMBEBIDA si es una agenda conocida (`embedDe`, lib/embeds.ts, sin
 *    `server-only`: la lista vive ahí). Sin esto, pegar el código lo tiraba el saneo y la tarea quedaba
 *    con «Falta el link» sobre algo que el equipo sí puso.
 */
export function urlDeAgenda(raw: unknown): string | null {
  const u = linkValido(raw);
  if (u) return u;
  if (typeof raw !== 'string' || !raw.includes('<')) return null;
  const e = embedDeTexto(raw);
  return e && claseDeProveedor(e.proveedor) === 'agenda' ? linkValido(e.src) : null;
}

/** Las preguntas de un quiz: lo que no cierra (sin texto, menos de dos opciones) se tira. */
function sanearPreguntas(raw: unknown): PreguntaQuiz[] {
  if (!Array.isArray(raw)) return [];
  const out: PreguntaQuiz[] = [];
  const vistos = new Set<string>();
  for (const [i, x] of raw.slice(0, MAX_PREGUNTAS).entries()) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const texto = corta(o.texto, 600);
    const opciones = [...new Set((Array.isArray(o.opciones) ? o.opciones : []).map((s) => corta(s, 200)).filter(Boolean))].slice(0, MAX_OPCIONES_QUIZ);
    if (!texto || opciones.length < 2) continue;
    let id = corta(o.id, 80).replace(/[^\w-]/g, '-') || `p${i}`;
    while (vistos.has(id)) id = `${id}-${i}`;
    vistos.add(id);
    const multiple = o.multiple === true;
    // Sólo las que son opciones de la pregunta, sin repetir; una de una sola respuesta tiene UNA.
    const correctas = [...new Set((Array.isArray(o.correctas) ? o.correctas : []).map((s) => corta(s, 200)).filter((s) => opciones.includes(s)))];
    const p: PreguntaQuiz = { id, texto, opciones, correctas: multiple ? correctas : correctas.slice(0, 1) };
    if (multiple) p.multiple = true;
    out.push(p);
  }
  return out;
}

/**
 * Los campos de un formulario, como los manda la pantalla de Mauricio. Lo que no cierra se tira.
 *
 * ⚠️ LOS SEIS TIPOS DE SIEMPRE SALEN EXACTAMENTE IGUAL que antes de la #18: los programas cargados
 * se verifican con `isDeepStrictEqual(sanearCampos(c), c)` (scripts/curso-cargar-programa.ts y sus
 * tests), así que a un `texto` no se le agrega ninguna propiedad. Los tipos nuevos sí salen con sus
 * defaults puestos (un `archivo` sin `maxArchivos` sale con 1): es idempotente igual.
 *
 * ⚠️ UN QUIZ ES SIEMPRE OBLIGATORIO: un quiz que se puede dejar en blanco no tiene nota que pedir, y
 * la regla «se aprueba con la nota mínima» no tendría a quién aplicarse.
 *
 * ⚠️ DESDE EL 08/10/2026 SÓLO SE DESCARTA LA BASURA, Y LO DESCARTADO SE ANOTA (`opts.descartes`). Antes
 *    un campo sin la pregunta escrita se tiraba EN SILENCIO: se guardaba sin él y, al volver, «se me
 *    borraron todos los campos» (item 2 del audio, 15:30). Ahora:
 *      · Un campo sin pregunta (o una `seccion` sin título) SE CONSERVA con el rótulo vacío. Lo que
 *        frena es `erroresDeCampos`, que el server mira ANTES de sanear (`guardarLeccion`) y el editor
 *        pinta en rojo: una regla que decide y se ve, no un filtro que borra.
 *      · Un id repetido NO SE TIRA: el segundo recibe uno nuevo (`<id>-2`), que no esté en la lista.
 *        Las respuestas se guardan por id, así que el primero conserva las suyas y el segundo nace
 *        sin ninguna, que es lo que es (una copia). Tirarlo era perder un campo que la persona ve.
 *      · Se descarta y se ANOTA: lo que no es un objeto, lo que no tiene id, lo que pasa de
 *        `TOPE_CAMPOS`, y la consigna de una `seccion` cuando no hay con qué sanearla (`opts.html`) o
 *        saneada pasa de `TOPE_HTML_SECCION`.
 *
 * `opts.html`: el saneador del HTML de una `seccion` (`sanearHtml`, lib/html-seguro.ts, que es
 * `server-only`: por eso se pasa y no se importa, como en `conHtmlSaneado`). Sin él, la consigna con
 * formato NO se guarda: un HTML sin sanear no viaja a la base. El server lo pasa siempre
 * (`sanearCamposDelServidor`, lib/curso-tarea-html.ts).
 */
export function sanearCampos(raw: unknown, opts: { html?: (h: string) => string; descartes?: string[] } = {}): Campo[] {
  if (!Array.isArray(raw)) return [];
  const anotar = (m: string) => { opts.descartes?.push(m); };
  if (raw.length > TOPE_CAMPOS) anotar(`${raw.length - TOPE_CAMPOS} campos de más (tope ${TOPE_CAMPOS})`);
  const limpiarId = (v: unknown) => corta(v, 80).replace(/[^\w-]/g, '-');
  // Todos los ids que llegaron, para que el nuevo de un repetido no pise el de un campo que viene después.
  const todos = new Set(raw.slice(0, TOPE_CAMPOS).map((x) => (x && typeof x === 'object' ? limpiarId((x as Record<string, unknown>).id) : '')));
  const vistos = new Set<string>();
  const out: Campo[] = [];
  for (const [i, x] of raw.slice(0, TOPE_CAMPOS).entries()) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) { anotar(`campo ${i + 1}: no es un campo`); continue; }
    const o = x as Record<string, unknown>;
    let id = limpiarId(o.id);
    const tipo = TIPOS_CAMPO.includes(o.tipo as CampoTipo) ? (o.tipo as CampoTipo) : 'texto';
    if (!id) { anotar(`campo ${i + 1}: sin id`); continue; }
    if (vistos.has(id)) {
      const base = id.slice(0, 74);
      let n = 2;
      while (vistos.has(`${base}-${n}`) || todos.has(`${base}-${n}`)) n++;
      id = `${base}-${n}`;
    }
    vistos.add(id);
    if (tipo === 'seccion') {
      // Una tarea más: su título y su consigna. Nada de lo que es de un campo que se contesta.
      const s: Campo = { id, label: corta(o.label, TOPE_TITULO_TAREA), tipo };
      const crudo = typeof o.descripcionHtml === 'string' ? o.descripcionHtml.trim() : '';
      if (crudo) {
        if (!opts.html) anotar(`tarea «${s.label.slice(0, 40)}»: consigna sin sanear`);
        else {
          const h = opts.html(crudo).trim();
          if (h.length > TOPE_HTML_SECCION) anotar(`tarea «${s.label.slice(0, 40)}»: consigna de ${h.length} caracteres (tope ${TOPE_HTML_SECCION})`);
          else if (h) s.descripcionHtml = h;
        }
      }
      out.push(s);
      continue;
    }
    const label = corta(o.label, TOPE_PREGUNTA);
    const lista = (v: unknown, n: number) => (Array.isArray(v) ? v.map((s) => corta(s, 200)).filter(Boolean).slice(0, n) : undefined);
    const c: Campo = { id, label, tipo };
    const ayuda = corta(o.ayuda, 600); if (ayuda) c.ayuda = ayuda;
    const opciones = lista(o.opciones, 30); if (opciones?.length && (tipo === 'eleccion' || tipo === 'checks' || tipo === 'checklist')) c.opciones = opciones;
    const columnas = lista(o.columnas, 12); if (columnas?.length && tipo === 'tabla') c.columnas = columnas;
    const filasFijas = lista(o.filasFijas, 40); if (filasFijas?.length && tipo === 'tabla') c.filasFijas = filasFijas;
    if (tipo === 'tabla' && typeof o.filasMin === 'number' && o.filasMin > 0) c.filasMin = Math.min(40, Math.round(o.filasMin));
    if (tipo === 'archivo') c.maxArchivos = entero(o.maxArchivos, 1, MAX_ARCHIVOS, 1);
    if (tipo === 'audio' || tipo === 'video') c.maxSeg = entero(o.maxSeg, MAX_SEG_MIN, MAX_SEG_MAX, MAX_SEG_DEFAULT);
    if (tipo === 'escala') {
      const e = (o.escala && typeof o.escala === 'object' ? o.escala : {}) as Record<string, unknown>;
      // El estilo (item 9) sólo si no es el de siempre: una escala guardada antes sale idéntica.
      const estilo = e.estilo === 'deslizador' || e.estilo === 'estrellas' ? e.estilo : null;
      c.escala = { min: e.min === 0 && estilo !== 'estrellas' ? 0 : 1, max: e.max === 5 ? 5 : 10, bajo: corta(e.bajo, 60), alto: corta(e.alto, 60) };
      if (estilo) c.escala.estilo = estilo;
    }
    if (tipo === 'quiz') {
      c.preguntas = sanearPreguntas(o.preguntas);
      c.notaMin = entero(o.notaMin, 0, 100, NOTA_MIN_DEFAULT);
      c.intentos = entero(o.intentos, 0, 20, 0);
    }
    if (tipo === 'agenda') { const u = urlDeAgenda(o.url); if (u) c.url = u; }
    // El texto de ejemplo, sólo donde hay un cuadro (item 5). Ausente en un campo que no lo tiene: los
    // programas cargados siguen saliendo idénticos (ver la cabecera).
    if (conTextoDeEjemplo(tipo)) { const p = corta(o.placeholder, TOPE_TEXTO_EJEMPLO).replace(/\s+/g, ' '); if (p) c.placeholder = p; }
    if (tipo === 'publicar') { const n = idPositivo(o.categoriaId); if (n) c.categoriaId = n; }
    if (tipo === 'comentar') {
      const n = idPositivo(o.postId);
      if (n) {
        c.postId = n;
        const t = corta(o.postTitulo, 200);
        if (t) c.postTitulo = t;
      }
    }
    if (o.obligatorio === true || tipo === 'quiz') c.obligatorio = true;
    out.push(c);
  }
  return out;
}

/**
 * Los campos como los ve el ALUMNO: iguales, menos las respuestas correctas de los quizzes.
 *
 * ⚠️ ES LA ÚNICA PUERTA por la que los campos llegan a su navegador (`claseVista`, lib/curso-portal.ts,
 * que arman el portal, /mi-curso y la vista previa). Un quiz con las correctas en el HTML se aprueba
 * leyendo el código de la página. No muta lo que recibe: la misma clase la usa el server para corregir.
 */
export function camposParaAlumno(campos: readonly Campo[]): Campo[] {
  // Las `seccion` viajan tal cual (título y consigna: es lo que el alumno tiene que leer); la consigna
  // la vuelve a sanear `conHtmlSaneado` (lib/curso-portal.ts) antes de que salga del server.
  return campos.map((c) => (c.tipo === 'quiz' && c.preguntas
    ? { ...c, preguntas: c.preguntas.map(({ correctas: _fuera, ...p }) => p) }
    : c));
}

// ── Las entregas: los archivos que sube o graba el alumno (mig 0218) ─────────
// Puro, para que lo usen la ruta que firma la subida, la que guarda la tarea, la pantalla del alumno
// (el `accept` y el tope ANTES de subir) y el test. Lo que toca Storage vive en lib/curso-entregas.ts.

/**
 * Los formatos del bucket `curso-entregas` (mig 0218, `allowed_mime_types`), por familia.
 *
 * ⚠️ TIENEN QUE SER LOS MISMOS QUE LOS DEL BUCKET (un test los compara con el `.sql`): Storage
 * rechaza recién al TERMINAR de subir, y con un video de 80 MB eso son minutos de barra para un «no»
 * que se podía decir antes de empezar.
 */
export const MIME_ENTREGA_DOC = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'text/csv',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;
/**
 * ⚠️ `audio/webm` y `video/webm` son lo que graba Chrome y Firefox; `audio/mp4` y `video/mp4`, lo que
 * graba Safari (iPhone). El `MediaRecorder` los nombra con sus códecs (`audio/webm;codecs=opus`): la
 * pantalla manda el tipo PELADO (`mimeBase`), que es lo que el bucket compara.
 */
export const MIME_ENTREGA_AUDIO = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/x-m4a', 'audio/wav', 'audio/aac'] as const;
export const MIME_ENTREGA_VIDEO = ['video/webm', 'video/mp4', 'video/quicktime'] as const;
export const MIME_ENTREGA: readonly string[] = [...MIME_ENTREGA_DOC, ...MIME_ENTREGA_AUDIO, ...MIME_ENTREGA_VIDEO];

/**
 * El tope de UN archivo: 100 MiB, el `file_size_limit` del bucket (mig 0218). ⚠️ EL DEL BUCKET Y NO UNO
 * MÍO (AGENTS.md, «el entorno tiene un tope y tu código declara otro»): si se sube uno, se sube el
 * otro en el mismo cambio. Un pitch grabado acá (720p a 1 Mbps) son ~8 MB por minuto; un video de
 * teléfono en 1080p pasa de 100 MB al minuto, y para eso está el campo `link` (Loom, Drive).
 */
export const TOPE_ENTREGA_BYTES = 100 * 1024 * 1024;

/** Los formatos que acepta UN campo: un `audio` no se contesta con un PDF. */
export function mimesDeCampo(tipo: CampoTipo | string): readonly string[] {
  if (tipo === 'audio') return MIME_ENTREGA_AUDIO;
  if (tipo === 'video') return MIME_ENTREGA_VIDEO;
  if (tipo === 'archivo') return MIME_ENTREGA;
  return [];
}

const EXT_ENTREGA: Record<string, string> = {
  'application/pdf': 'pdf', 'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.oasis.opendocument.text': 'odt', 'application/vnd.oasis.opendocument.spreadsheet': 'ods',
  'application/vnd.oasis.opendocument.presentation': 'odp',
  'text/csv': 'csv', 'text/plain': 'txt', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
  'audio/webm': 'weba', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/x-m4a': 'm4a', 'audio/wav': 'wav', 'audio/aac': 'aac',
  'video/webm': 'webm', 'video/mp4': 'mp4', 'video/quicktime': 'mov',
};
/**
 * Qué tipos puede ser un archivo por su extensión, en orden de preferencia. ⚠️ `.webm` y `.mp4` son
 * AMBIGUOS (audio o video): se elige el primero que el campo acepte.
 */
const MIMES_DE_EXT: Record<string, readonly string[]> = {
  ...Object.fromEntries(Object.entries(EXT_ENTREGA).filter(([m]) => !m.startsWith('audio/') && !m.startsWith('video/')).map(([m, e]) => [e, [m]])),
  jpeg: ['image/jpeg'], webm: ['video/webm', 'audio/webm'], weba: ['audio/webm'], mp4: ['video/mp4', 'audio/mp4'],
  m4a: ['audio/mp4', 'audio/x-m4a'], ogg: ['audio/ogg'], oga: ['audio/ogg'], mp3: ['audio/mpeg'], wav: ['audio/wav'], aac: ['audio/aac'], mov: ['video/quicktime'],
};
const EXTS_ENTREGA = [...new Set(Object.values(EXT_ENTREGA))].join('|');
const UUID_RE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** El tipo sin sus parámetros: `audio/webm;codecs=opus` → `audio/webm`. */
export const mimeBase = (m: string | null | undefined): string => (m ?? '').split(';')[0].trim().toLowerCase();

/**
 * El tipo de un archivo elegido o grabado, contra lo que acepta el campo. El del navegador si es uno
 * de ésos; si no, por la extensión. `null` = ese campo no acepta ese archivo.
 *
 * ⚠️ AL REVÉS DE `mimeDeNota` (app/customer-success/curso/reglas.ts), primero el navegador: acá
 * entran audio y video, y una grabación de Chrome se llama `.webm` sea audio o video — la extensión
 * sola mandaría el audio como video. Para lo demás manda la extensión (Windows le pone
 * `application/vnd.ms-excel` a un .csv).
 */
export function mimeDeEntrega(nombre: string, tipo: string | null | undefined, permitidos: readonly string[]): string | null {
  const base = mimeBase(tipo);
  if (base && permitidos.includes(base) && (base.startsWith('audio/') || base.startsWith('video/') || base.startsWith('image/') || base === 'application/pdf')) return base;
  const ext = (nombre.includes('.') ? nombre.split('.').pop() ?? '' : '').toLowerCase();
  const porExt = (MIMES_DE_EXT[ext] ?? []).find((m) => permitidos.includes(m));
  if (porExt) return porExt;
  return base && permitidos.includes(base) ? base : null;
}

/** Lo que va en el `accept` del input de archivo de un campo. */
export function aceptaDeCampo(tipo: CampoTipo | string): string {
  const mimes = mimesDeCampo(tipo);
  const exts = Object.entries(MIMES_DE_EXT).filter(([, ms]) => ms.some((m) => mimes.includes(m))).map(([e]) => `.${e}`);
  return [...mimes, ...exts].join(',');
}

/** De quién y de qué es una entrega: lo pone el SERVER, nunca el pedido. */
export type DuenoEntrega = { ws: number; productoId: number; leadId: number; claseId: number };

/**
 * Dónde se guarda una entrega: `<ws>/<producto>/<lead>/<clase>/<uuid>.<ext>` en `curso-entregas`.
 *
 * ⚠️ EL WORKSPACE, EL ALUMNO Y LA CLASE VAN EN LA RUTA Y LOS PONE EL SERVER, como el video del curso
 * (`pathDeSubida`): es lo que deja preguntar «¿este archivo es de ESTE alumno y de ESTA clase?» con
 * un prefijo (`pathEsDeEntrega`), sin una tabla aparte. Un guardado que nombre la entrega de otro
 * alumno no pasa. El nombre original NO entra (acentos, espacios, el nombre de un cliente): va aparte
 * en `ArchivoEntregado.nombre`.
 */
export function pathDeEntrega(d: DuenoEntrega, mime: string, uuid: string): string | null {
  const ext = EXT_ENTREGA[mime];
  if (!ext || !MIME_ENTREGA.includes(mime)) return null;
  if (![d.ws, d.productoId, d.leadId, d.claseId].every((n) => Number.isInteger(n) && n > 0)) return null;
  if (!new RegExp(`^${UUID_RE}$`).test(uuid)) return null;
  return `${d.ws}/${d.productoId}/${d.leadId}/${d.claseId}/${uuid}.${ext}`;
}

/** ¿Este path es una entrega de ESTE alumno, en ESTA clase, de ESTE workspace? */
export function pathEsDeEntrega(path: unknown, d: DuenoEntrega): boolean {
  return typeof path === 'string'
    && new RegExp(`^${d.ws}/${d.productoId}/${d.leadId}/${d.claseId}/${UUID_RE}\\.(${EXTS_ENTREGA})$`).test(path);
}

/** ¿Este path tiene la FORMA de una entrega, de quien sea? (lo que se puede guardar sin saber el dueño) */
export const esEntregaSubida = (path: unknown): path is string =>
  typeof path === 'string' && new RegExp(`^\\d{1,12}/\\d{1,12}/\\d{1,12}/\\d{1,12}/${UUID_RE}\\.(${EXTS_ENTREGA})$`).test(path);

/** ¿Este path es una entrega de ESTE cliente (cualquier clase) de ESTE workspace? Lo que abre el EQUIPO. */
export const pathEsDelCliente = (path: unknown, ws: number, leadId: number): boolean =>
  esEntregaSubida(path) && path.startsWith(`${ws}/`) && path.split('/')[2] === String(leadId);

/** El nombre de un archivo para mostrarlo: sin carpetas, sin caracteres de control ni comillas, con tope. */
export function nombreDeEntrega(raw: unknown): string {
  // Los caracteres de control van como escape (AGENTS.md: un byte NUL crudo vuelve binario el archivo).
  const s = typeof raw === 'string' ? raw.replace(/[\u0000-\u001f\u007f"]/g, '').split(/[\\/]/).pop()!.trim() : '';
  return (s || 'archivo').slice(0, 160);
}

/**
 * Las entregas de un campo, saneadas. Sin `dueno` sólo se mira la FORMA del path; con `dueno`, que
 * sea de ese alumno y esa clase (`pathEsDeEntrega`).
 *
 * ⚠️ LA RUTA DE LA TAREA PASA EL DUEÑO (lib/curso-entregas.ts, `verificarEntregas`) ANTES de guardar,
 * y es ésa la que cierra «nombrar la entrega de otro alumno»: `guardarTarea` vuelve a sanear sin dueño
 * (no lo conoce), y lo que ya pasó por la puerta estricta pasa igual por la floja.
 */
export function archivosDeValor(c: Pick<Campo, 'tipo' | 'maxArchivos'>, v: unknown, dueno?: DuenoEntrega): ArchivoEntregado[] {
  if (!Array.isArray(v)) return [];
  const permitidos = mimesDeCampo(c.tipo);
  const tope = c.tipo === 'archivo' ? Math.min(MAX_ARCHIVOS, Math.max(1, c.maxArchivos ?? 1)) : 1;
  const out: ArchivoEntregado[] = [];
  const vistos = new Set<string>();
  for (const x of v) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) continue;
    const o = x as Record<string, unknown>;
    if (!(dueno ? pathEsDeEntrega(o.path, dueno) : esEntregaSubida(o.path))) continue;
    const path = o.path as string;
    const mime = mimeBase(typeof o.mime === 'string' ? o.mime : '');
    const bytes = typeof o.bytes === 'number' && Number.isFinite(o.bytes) ? Math.round(o.bytes) : NaN;
    if (vistos.has(path) || !permitidos.includes(mime) || !(bytes > 0 && bytes <= TOPE_ENTREGA_BYTES)) continue;
    vistos.add(path);
    const a: ArchivoEntregado = { path, nombre: nombreDeEntrega(o.nombre), mime, bytes };
    if (typeof o.seg === 'number' && Number.isFinite(o.seg) && o.seg > 0) a.seg = Math.min(MAX_SEG_MAX + 5, Math.round(o.seg));
    out.push(a);
    if (out.length >= tope) break;
  }
  return out;
}

/**
 * Todas las rutas de entregas que nombran unos valores, de cualquier campo. Lo necesita quien quiera
 * barrer los huérfanos del bucket (lib/curso-purga.ts lo hace hoy por COLUMNA, y acá la referencia
 * vive adentro del jsonb `valores`) y la ruta, para no volver a preguntarle a Storage por lo que ya
 * se había guardado.
 */
export function pathsDeEntregas(valores: Valores | null | undefined): string[] {
  const out = new Set<string>();
  for (const v of Object.values(valores ?? {})) {
    if (!Array.isArray(v)) continue;
    for (const x of v as unknown[]) {
      const p = x && typeof x === 'object' && !Array.isArray(x) ? (x as { path?: unknown }).path : null;
      if (esEntregaSubida(p)) out.add(p);
    }
  }
  return [...out];
}

// ── El tope de lo que sube un alumno (revisión del 08/10/2026) ──────────────

/**
 * Cuánto puede SUBIR un alumno en un día a las entregas de UN programa, sumando todas sus clases:
 * objetos y bytes creados en las últimas 24 h, leídos del bucket (lib/curso-entregas.ts,
 * `urlSubidaEntrega`, antes de firmar).
 *
 * ⚠️ POR QUÉ HACE FALTA: la ruta de las entregas es PÚBLICA (el token del portal) y cada firma deja
 * subir UN archivo de hasta `TOPE_ENTREGA_BYTES`. Sin tope, un link filtrado (o un alumno con un
 * script) firmaba 30 por minuto = 3 GB por minuto, contra un Storage con 5 GiB de tope para TODA la
 * plataforma (lib/curso-admin.ts): en dos minutos se le cortaban las subidas a todos los clientes.
 *
 * ⚠️ LOS BYTES SE CUENTAN CON EL PEOR CASO DEL PRÓXIMO: el tamaño que manda el navegador al pedir la
 * firma no lo hace cumplir nadie (la URL firmada acepta hasta el tope del bucket), así que se firma
 * sólo si lo ya subido MÁS un archivo entero del tope entra en el día.
 *
 * Lo legítimo queda lejos: 40 archivos y ~400 MB por día es un pitch grabado diez veces, o tres
 * entregables de diez archivos. Lo que NO cubre, y está escrito en la ruta: varias firmas pedidas
 * de golpe antes de que llegue la primera subida (el bucket todavía no las ve). Eso lo acota el
 * rate limit por alumno de la ruta, que es por instancia.
 */
export const TOPE_SUBIDAS_DIA = 40;
export const TOPE_BYTES_SUBIDAS_DIA = 500 * 1024 * 1024;
export const VENTANA_SUBIDAS_MS = 24 * 3600 * 1000;

/** Un objeto que el alumno ya subió, como lo lista el bucket. */
export type SubidaHecha = { creado: string | null; bytes: number | null };

/**
 * ¿Ya no se le puede firmar otra subida hoy? `true` = alcanzó el tope de objetos, o el próximo
 * (contado con el tope del bucket) pasaría el de bytes.
 *
 * ⚠️ UN OBJETO SIN FECHA LEGIBLE CUENTA COMO DE HOY: «no sé cuándo se subió» no es «es viejo», y
 * contarlo de menos es justo el lado que abre la puerta.
 */
export function topeDeSubidasAlcanzado(subidas: readonly SubidaHecha[], ahora: number): boolean {
  const desde = ahora - VENTANA_SUBIDAS_MS;
  let n = 0;
  let bytes = 0;
  for (const s of subidas) {
    const t = s.creado ? Date.parse(s.creado) : NaN;
    if (Number.isFinite(t) && t < desde) continue;
    n++;
    if (typeof s.bytes === 'number' && Number.isFinite(s.bytes) && s.bytes > 0) bytes += s.bytes;
  }
  return n >= TOPE_SUBIDAS_DIA || bytes + TOPE_ENTREGA_BYTES > TOPE_BYTES_SUBIDAS_DIA;
}

/**
 * Lo que contestó el cliente, contra los campos de SU clase. Las claves que la clase no tiene se
 * tiran (los valores viajan desde un navegador sin sesión), y cada valor se corta a su forma.
 * Sin campos, la tarea es una respuesta libre: `{respuesta}`.
 *
 * `dueno`: de quién son las entregas (ver `archivosDeValor`). Sin él, sólo la forma del path.
 */
export function sanearValores(todos: readonly Campo[], raw: unknown, dueno?: DuenoEntrega): Valores {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  // Las `seccion` no se contestan: un valor con su id es una clave que la clase no tiene. Y una clase
  // con secciones y SIN campos que se contesten es de respuesta libre, como una sin ningún campo.
  const campos = camposConRespuesta(todos);
  if (!campos.length) {
    const r = corta(o.respuesta, 20_000);
    return r ? { respuesta: r } : {};
  }
  const out: Valores = {};
  for (const c of campos) {
    const v = o[c.id];
    if (esCampoDeArchivo(c.tipo)) {
      if (Array.isArray(v)) out[c.id] = archivosDeValor(c, v, dueno);
    } else if (c.tipo === 'quiz') {
      // Una fila por pregunta, con lo que marcó y sólo opciones de ESA pregunta. Una de una sola
      // respuesta guarda una. ⚠️ La nota NO se lee de acá: la pone el server (`corregirEnvio`).
      if (Array.isArray(v)) {
        out[c.id] = (c.preguntas ?? []).map((p, i) => {
          const dadas = Array.isArray(v[i]) ? (v[i] as unknown[]) : [];
          const ok = [...new Set(dadas.map((s) => corta(s, 200)).filter((s) => p.opciones.includes(s)))];
          return p.multiple ? ok : ok.slice(0, 1);
        });
      }
    } else if (c.tipo === 'checklist') {
      if (Array.isArray(v)) out[c.id] = [...new Set(v.map((s) => corta(s, 300)).filter((s) => !!s && (c.opciones ?? []).includes(s)))];
    } else if (c.tipo === 'escala') {
      const e = c.escala ?? { min: 1, max: 10 };
      const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d{1,2}$/.test(v.trim()) ? Number(v.trim()) : NaN;
      if (Number.isInteger(n) && n >= e.min && n <= e.max) out[c.id] = String(n);
    } else if (c.tipo === 'agenda' || c.tipo === 'confirmacion') {
      if (v === 'si') out[c.id] = 'si';
    } else if (esCampoDeComunidad(c.tipo)) {
      // Sólo la FORMA de la referencia: que sea SUYA lo mira la ruta contra la base (ver `refDeComunidad`).
      const r = refDeComunidad(c.tipo, v);
      if (r) out[c.id] = valorDeComunidad(r.postId, r.comentarioId);
    } else if (c.tipo === 'link') {
      const u = linkValido(v);
      if (u) out[c.id] = u;
    } else if (c.tipo === 'checks') {
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
  // ⚠️ Un link que no es un link y un «ya agendé» que no es `'si'` no cuentan: el server los tira al
  // sanear, y la pantalla (que mira lo que se está escribiendo, sin sanear) tiene que decir lo mismo
  // o mandaría un envío que vuelve con «faltan respuestas».
  if (c.tipo === 'link') return linkValido(v) != null;
  if (c.tipo === 'agenda' || c.tipo === 'confirmacion') return v === 'si';
  if (typeof v === 'string') return v.trim().length > 0;
  if (!Array.isArray(v)) return false;
  if (c.tipo === 'tabla') {
    const desde = c.filasFijas?.length ? 1 : 0;
    return (v as unknown[]).some((f) => Array.isArray(f) && f.slice(desde).some((x) => String(x ?? '').trim().length > 0));
  }
  // Un archivo cuenta por su path, no por su nombre: «[object Object]» también es un texto lleno.
  if (esCampoDeArchivo(c.tipo)) return (v as unknown[]).some((x) => !!x && typeof x === 'object' && typeof (x as { path?: unknown }).path === 'string' && !!(x as { path: string }).path);
  if (c.tipo === 'quiz') return (v as unknown[]).some((f) => Array.isArray(f) && f.length > 0);
  return (v as unknown[]).some((x) => String(x ?? '').trim().length > 0);
}

/**
 * ¿Este campo está COMPLETO? Para la mayoría es lo mismo que «lleno»; dos tipos piden más:
 *   · checklist → TODAS sus acciones tildadas (es lo que significa una checklist).
 *   · quiz → TODAS sus preguntas contestadas. Contestado no es aprobado: eso lo decide la nota
 *     (`corregirEnvio`), en el server.
 * Es lo que pide `respuestaCompleta` a un campo obligatorio, y `queFalta` en la pantalla.
 */
export function campoCompleto(c: Pick<Campo, 'tipo' | 'filasFijas' | 'opciones' | 'preguntas'>, v: ValorCampo | undefined): boolean {
  if (c.tipo === 'checklist' && c.opciones?.length) {
    const marcadas = Array.isArray(v) ? (v as unknown[]).map((x) => String(x ?? '')) : [];
    return c.opciones.every((o) => marcadas.includes(o));
  }
  if (c.tipo === 'quiz') {
    const ps = c.preguntas ?? [];
    // Un quiz sin preguntas no pregunta nada: no frena (`validarClase` no deja guardarlo así).
    if (!ps.length) return true;
    const filas = Array.isArray(v) ? (v as unknown[]) : [];
    return ps.every((_, i) => Array.isArray(filas[i]) && (filas[i] as unknown[]).length > 0);
  }
  return campoLleno(c, v);
}

/** ¿Lo que contestó alcanza para ENVIAR? Sin campos: la respuesta libre no vacía. Con campos: los obligatorios. */
export function respuestaCompleta(c: Pick<Clase, 'tarea' | 'campos'>, valores: Valores): boolean {
  // Sin las `seccion`: una no se puede contestar, así que contada como campo la tarea no se enviaba nunca.
  const campos = camposConRespuesta(c.campos);
  if (!campos.length) return typeof valores.respuesta === 'string' && valores.respuesta.trim().length > 0;
  const obligatorios = campos.filter((x) => x.obligatorio);
  // Sin ninguno marcado obligatorio, alcanza con que haya contestado ALGO: enviar un formulario
  // vacío no es haber hecho la tarea.
  return obligatorios.length
    ? obligatorios.every((x) => campoCompleto(x, valores[x.id]))
    : campos.some((x) => campoLleno(x, valores[x.id]));
}

// ── El quiz: se corrige en el SERVER ──────────────────────────────────────────

/**
 * La nota de UN quiz sobre lo que marcó: el % de preguntas bien, y cuáles erró (sus posiciones).
 * `null` = el quiz no tiene preguntas. Una pregunta está bien si marcó EXACTAMENTE sus correctas
 * (ni una de más ni una de menos).
 *
 * ⚠️ UNA PREGUNTA SIN CORRECTAS CUENTA MAL, a propósito: si por algún camino llegaran los campos SIN
 * las correctas (los del alumno, `camposParaAlumno`), corregir con ellos aprobaría a cualquiera o a
 * nadie; así no aprueba a nadie, que es el error que se ve y se reporta.
 */
export function corregirQuiz(c: Pick<Campo, 'preguntas'>, v: ValorCampo | undefined): { nota: number; malas: number[] } | null {
  const ps = c.preguntas ?? [];
  if (!ps.length) return null;
  const filas = Array.isArray(v) ? (v as unknown[]) : [];
  const malas: number[] = [];
  ps.forEach((p, i) => {
    const dadas = new Set((Array.isArray(filas[i]) ? (filas[i] as unknown[]) : []).filter((x): x is string => typeof x === 'string'));
    const buenas = new Set(p.correctas ?? []);
    const bien = buenas.size > 0 && dadas.size === buenas.size && [...buenas].every((x) => dadas.has(x));
    if (!bien) malas.push(i);
  });
  return { nota: Math.round(((ps.length - malas.length) / ps.length) * 100), malas };
}

/** Lo que pasó al corregir un envío. `null` = la tarea no tiene quiz (se envía como siempre). */
export type ResultadoQuiz =
  | { tipo: 'sin-intentos'; calificacion: Calificacion }
  | { tipo: 'corregido'; calificacion: Calificacion; aprobado: boolean };

const quizzesDe = (campos: readonly Campo[]) => campos.filter((c) => c.tipo === 'quiz' && (c.preguntas?.length ?? 0) > 0);

/**
 * Corrige los quizzes de un ENVÍO. Lo llama la ruta de la tarea con los campos DE LA BASE (con las
 * correctas) y la calificación que ya tenía esa respuesta.
 *
 *   · Un quiz YA APROBADO no se vuelve a corregir ni gasta intentos: quedó aprobado (y sus respuestas
 *     no se tocan, `conQuizzesAprobadosIntactos`).
 *   · Con un tope de intentos agotado y sin aprobar: `sin-intentos`, y no se corrige nada (no se
 *     guarda un intento de más). El equipo lo destraba (`darOtroIntento`, lib/curso-entregas.ts).
 *   · Si no: se corrige, se suma el intento, y `aprobado` = TODOS los quizzes de la tarea con su nota
 *     mínima. Sin aprobar, la tarea NO queda enviada (la ruta la guarda como borrador): un quiz
 *     desaprobado no cierra una etapa.
 */
export function corregirEnvio(campos: readonly Campo[], valores: Valores, previa: Calificacion | null | undefined, ahora: string): ResultadoQuiz | null {
  const quizzes = quizzesDe(campos);
  if (!quizzes.length) return null;
  const antes = previa ?? {};
  for (const c of quizzes) {
    const a = antes[c.id];
    if (!a?.aprobado && (c.intentos ?? 0) > 0 && (a?.intentos ?? 0) >= (c.intentos ?? 0)) {
      return { tipo: 'sin-intentos', calificacion: { ...antes } };
    }
  }
  const out: Calificacion = { ...antes };
  let aprobado = true;
  for (const c of quizzes) {
    if (antes[c.id]?.aprobado) continue;
    const r = corregirQuiz(c, valores[c.id])!;
    const ok = r.nota >= (c.notaMin ?? NOTA_MIN_DEFAULT);
    out[c.id] = { nota: r.nota, aprobado: ok, intentos: (antes[c.id]?.intentos ?? 0) + 1, malas: r.malas, at: ahora };
    if (!ok) aprobado = false;
  }
  return { tipo: 'corregido', calificacion: out, aprobado };
}

/**
 * Lo que manda el navegador, con las respuestas de los quizzes YA APROBADOS puestas de vuelta como
 * estaban guardadas. Un quiz aprobado no se vuelve a contestar: si un pedido trae otras respuestas
 * (una pestaña vieja, uno armado a mano), dejarlas pasar dejaría «aprobado» al lado de respuestas
 * que nadie corrigió.
 */
export function conQuizzesAprobadosIntactos(campos: readonly Campo[], raw: unknown, guardados: Valores | null | undefined, calificacion: Calificacion | null | undefined): unknown {
  const aprobados = campos.filter((c) => c.tipo === 'quiz' && calificacion?.[c.id]?.aprobado);
  if (!aprobados.length || !raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const out: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  for (const c of aprobados) {
    if (guardados && c.id in guardados) out[c.id] = guardados[c.id];
    else delete out[c.id];
  }
  return out;
}

/**
 * Los tipos que NO necesitan que una persona los mire para dar la tarea por buena: lo que se corrige
 * solo (quiz) y lo que el alumno declara de sí mismo (una escala, una opción, «lo hice»).
 * Un texto, una tabla, un link o un archivo son un ENTREGABLE: alguien del equipo tiene que verlo.
 */
const SIN_REVISION: ReadonlySet<CampoTipo> = new Set<CampoTipo>(['quiz', 'escala', 'eleccion', 'checks', 'checklist', 'confirmacion', 'agenda', 'numero', 'publicar', 'comentar']);

/**
 * ¿Una tarea con el quiz aprobado queda APROBADA sola (sin que el equipo la marque revisada)?
 * Sólo si tiene un quiz y nada más que pida una revisión (ver `SIN_REVISION`). Una tarea con un quiz
 * y un entregable queda ENVIADA: el quiz la habilita, pero el entregable lo mira el equipo.
 */
export function seApruebaSola(campos: readonly Campo[]): boolean {
  // Una `seccion` no pide revisión (no se contesta): sin saltearla, un quiz en la segunda tarea dejaba
  // de aprobarse solo.
  return quizzesDe(campos).length > 0 && camposConRespuesta(campos).every((c) => SIN_REVISION.has(c.tipo));
}

/** La calificación como se lee de la base (jsonb que escribió el server): lo que no cierra se tira. */
export function leerCalificacion(raw: unknown): Calificacion | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: Calificacion = {};
  for (const [k, x] of Object.entries(raw as Record<string, unknown>)) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    if (typeof o.nota !== 'number' || typeof o.aprobado !== 'boolean') continue;
    const n: NotaQuiz = {
      nota: entero(o.nota, 0, 100, 0), aprobado: o.aprobado, intentos: entero(o.intentos, 0, 1000, 0),
      at: typeof o.at === 'string' ? o.at : '',
    };
    if (Array.isArray(o.malas)) n.malas = o.malas.filter((i): i is number => Number.isInteger(i) && i >= 0).slice(0, MAX_PREGUNTAS);
    out[k] = n;
  }
  return Object.keys(out).length ? out : null;
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
