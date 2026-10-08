// =============================================================================
// leccion-reglas — lo que decide la LECCIÓN EDITABLE de la tab Curso sin tocar la base (puro)
// =============================================================================
// Pedido de Martín (07/10/2026, items 13 a 17), textual: «Elimina el botón de "Editar", para eso ya
// se edita en cada parte... Si quiero editar el título, le doy click, como la descripción... Si quiero
// agregar un vídeo... debe siempre estar un placeholder donde iría el vídeo para la opción de "Agregar
// vídeo"... Lo mismo con el botón de "Agregar tarea" ahí mismo abajo de la descripción, como
// placeholder». Decisiones: docs/diseno-curso-skool.md, D4.
//
// Y la tanda del 08/10/2026 (20 ajustes, los de la lección son 5, 6, 8, 9, 11, 12, 13, 17, 18 y 20):
// el video sólo por link, los minutos solos, la pregunta como título del campo con su texto de ejemplo,
// los campos que se arrastran, «Obligatoria para avanzar», la comunidad y el «Deshacer».
//
// Y el audio del 08/10/2026 (items 1 a 4 y 7): el BORRADOR de la lección con su botón «Guardar», lo que
// impide guardar, el Ctrl+Z por gesto y «Obligatoria para avanzar» en el menú «…» de la clase (abajo).
//
// Sin 'use client' ni 'server-only' a propósito: lo usa la lección (./LeccionEditable.tsx, navegador)
// y un test que lo EJECUTA (tests/curso-leccion.test.ts, tests/curso-guardado-manual.test.ts). Lo que se
// guarda lo vuelve a decidir el server (`guardarLeccion`, lib/curso-admin.ts): acá está lo que la
// pantalla necesita saber ANTES de mandar, para no mandar algo que va a rebotar.

import type { Campo, Clase, VideoTipo } from '@/lib/curso';
import { erroresDeCampos, reproductorDeClase, tapaDeVideo, tieneTarea, videoDeLink } from '@/lib/curso';
import { porQueNoSeInserta } from '@/lib/embeds';
import { ERROR_OBLIGATORIA_SIN_TAREA } from './reglas';

// ── Lo que dicen los avisos de «Deshacer» (item 18 del 08/10/2026) ───────────
// «Te falta el botón de arrepentimiento para muchas acciones, el de 5 segundos de "Deshacer"». Dos
// palabras cada uno (AGENTS.md: el toast del deshacer, 3-4 palabras como mucho). Lo que se deshace
// vuelve a escribir en el server con el valor de antes: revertir sólo la pantalla mentiría hasta el F5.
export const AVISO_DESHACER = {
  video: 'Video quitado',
  tarea: 'Tarea quitada',
  borrado: 'Campo borrado',
  movido: 'Campo movido',
  // Revisión final del 08/10/2026: dos gestos más que BORRAN lo escrito sin preguntar (ver
  // `pierdeAlCambiarTipo` y `tieneContenido`, abajo).
  tipo: 'Tipo cambiado',
  pregunta: 'Pregunta borrada',
} as const;

// ── Lo que un gesto del formulario se lleva puesto (revisión final del 08/10/2026, item 18) ──
// Cambiar el TIPO de un campo arranca lo propio del tipo nuevo con sus defaults (`conTipo`,
// ./EditorCampos.tsx): pasar un quiz a «Texto» se lleva sus preguntas con sus correctas, y una tabla a
// «Una opción», sus columnas. Y «Quitar pregunta» de un quiz borra su texto y sus opciones. Ninguno de
// los dos preguntaba ni tenía «Deshacer». Con algo escrito que se pierde, avisan para el «Deshacer»; con
// nada (un campo recién creado que todavía elige su tipo), no: un aviso en cada elección sería ruido.

/** Lo propio de cada tipo que escribe el EQUIPO (lo que se pierde al cambiar de tipo). */
const CONTENIDO_DEL_TIPO = ['opciones', 'columnas', 'filasFijas', 'preguntas', 'url', 'placeholder', 'escala', 'categoriaId', 'postId'] as const;

/**
 * ¿Hay algo ESCRITO acá? Un texto no vacío; un id elegido (un número suelto, `categoriaId`, `postId`);
 * una lista o un objeto con algo escrito adentro. Lo que NO cuenta: el `id` de una pregunta (lo pone la
 * pantalla) y los números de adentro de un objeto (los extremos de una escala vienen con su default).
 */
export function tieneContenido(v: unknown, adentro = false): boolean {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return !adentro;
  if (Array.isArray(v)) return v.some((x) => tieneContenido(x, true));
  if (typeof v === 'object') return Object.entries(v).some(([k, x]) => k !== 'id' && tieneContenido(x, true));
  return false;
}

/** ¿Cambiar el campo `antes` por `despues` (otro tipo) pierde algo que el equipo escribió? */
export function pierdeAlCambiarTipo(antes: Campo, despues: Campo): boolean {
  const a = antes as Record<string, unknown>;
  const d = despues as Record<string, unknown>;
  return CONTENIDO_DEL_TIPO.some((k) => tieneContenido(a[k]) && JSON.stringify(a[k]) !== JSON.stringify(d[k]));
}

// ── «Obligatoria para avanzar» y «Una respuesta por área» (item 9 del 08/10/2026) ──
// «No se entiende el botón de "Cierra módulo"» y, del menú de la clase (item 15), «No entiendo eso de
// "Por área"». El rótulo dice qué ES y la línea de abajo qué PASA: el porqué largo va acá.
export const ROTULO_OBLIGATORIA = 'Obligatoria para avanzar';
/** Lo que pasa con la marca prendida: el cliente se mueve solo al módulo siguiente (`alEnviarTarea`). */
export const AYUDA_OBLIGATORIA = 'Cuando envía todas las obligatorias, pasa al módulo siguiente.';
export const ROTULO_POR_AREA = 'Una respuesta por área';
/** Las áreas son las que el cliente declaró en su tabla de áreas (`CAMPO_AREAS`, lib/curso.ts). */
export const AYUDA_POR_AREA = 'Cada área del cliente la contesta aparte, con su link.';

/**
 * ¿Se ofrece «Una respuesta por área»? Sólo si el curso le PIDE a sus clientes sus áreas (alguna clase
 * del producto tiene el campo de áreas) o si esta clase ya la tiene prendida (apagarla tiene que seguir
 * siendo posible). En un curso sin áreas el interruptor no cambiaría nada: con un cliente sin áreas, la
 * tarea se contesta una vez igual (`progresoEfectivo`).
 */
export const ofrecePorArea = (cursoPideAreas: boolean, porArea: boolean | undefined): boolean => cursoPideAreas || porArea === true;

// ── Los campos del formulario (items 6 y 8 del 08/10/2026) ───────────────────

/**
 * Los campos en el orden de `ids` (lo que devuelve el arrastre). Un id que no está se ignora, y un campo
 * que no venía en `ids` queda al final: reordenar nunca puede perder un campo (las respuestas de los
 * clientes cuelgan de su id).
 */
export function camposEnOrden(campos: readonly Campo[], ids: readonly string[]): Campo[] {
  const porId = new Map(campos.map((c) => [c.id, c]));
  const out: Campo[] = [];
  for (const id of ids) { const c = porId.get(id); if (c) { out.push(c); porId.delete(id); } }
  return [...out, ...porId.values()];
}

// ⚠️ `campoNuevoArriba` SE FUE (revisión final del 08/10/2026): desde el audio de ese día el campo nuevo nace
//    ABAJO del último (item 5, 21:00: «lo pondría abajo de el campo que ya puse»), en ./EditorCampos.tsx con
//    `campoNuevo` (./tarea-editor-reglas.ts). No la llamaba nadie.

// ── La comunidad, para armar un campo «Publicar» o «Comentar» (item 17) ──────

/** Lo que hay en la comunidad del producto para elegir: categorías donde publica un alumno y posts. */
export type OpcionesComunidad = {
  categorias: Array<{ id: number; nombre: string }>;
  posts: Array<{ id: number; titulo: string; fijado: boolean }>;
};

/**
 * Las opciones del desplegable de la categoría. Vacío = «La primera» (la resuelve el server al publicar).
 *
 * ⚠️ LA ELEGIDA ENTRA AUNQUE YA NO ESTÉ (AGENTS.md: un `<select>` cuyo valor no está entre sus opciones
 *    no muestra nada, y el primer clic lo borra). Marcada, para que se note.
 */
export function opcionesDeCategoria(opc: OpcionesComunidad | null, actual: number | undefined): Array<{ value: string; label: string }> {
  const out = [{ value: '', label: 'La primera' }, ...(opc?.categorias ?? []).map((c) => ({ value: String(c.id), label: c.nombre }))];
  if (actual && !out.some((o) => o.value === String(actual))) out.push({ value: String(actual), label: opc ? 'La elegida (ya no está)' : 'La elegida' });
  return out;
}

/** Las opciones del desplegable del post: «El último fijado» y los posts (los fijados primero). Ídem la elegida. */
export function opcionesDePost(opc: OpcionesComunidad | null, actual: number | undefined, titulo?: string): Array<{ value: string; label: string }> {
  const posts = [...(opc?.posts ?? [])].sort((a, b) => Number(b.fijado) - Number(a.fijado));
  const out = [{ value: '', label: 'El último fijado' }, ...posts.map((p) => ({ value: String(p.id), label: p.fijado ? `${p.titulo} · fijado` : p.titulo }))];
  if (actual && !out.some((o) => o.value === String(actual))) out.push({ value: String(actual), label: titulo?.trim() || 'El elegido' });
  return out;
}

// ── La miniatura del video, como portada de la clase (item 20) ───────────────

/**
 * La miniatura del video de una clase (la de `tapaDeVideo`, la MISMA que dibuja la tarjeta cuando nadie
 * eligió portada), o `null` si no tiene video o su plataforma no publica una (un archivo subido). Es lo
 * que ofrece el selector de portada de una CLASE como «Miniatura del video».
 */
export function miniaturaDeClase(c: Pick<Clase, 'videoTipo' | 'videoUrl' | 'videoPath'> | null | undefined): string | null {
  return c ? tapaDeVideo(reproductorDeClase(c).video) : null;
}

// ── El video: la duración de un Loom (item 12) ───────────────────────────────

/**
 * El oEmbed de un link de Loom, que trae la DURACIÓN (medido el 08/10/2026: `duration` en segundos, con
 * CORS abierto). Loom va en un iframe que no dice cuánto dura, así que es la única forma de poner sus
 * minutos solos. `null` = no es un Loom. Drive no tiene nada parecido: ahí no hay minutos.
 */
export function oembedDeLoom(url: string | null | undefined): string | null {
  const v = videoDeLink(url);
  if (!v || v.tipo !== 'loom' || !v.id) return null;
  return `https://www.loom.com/v1/oembed?url=${encodeURIComponent(`https://www.loom.com/share/${v.id}`)}`;
}

// ⚠️ SIN `RESPIRO_DESCRIPCION_MS` NI `RESPIRO_TAREA_MS` desde el audio del 08/10/2026 (item 1, 14:30):
//    la lección ya no se guarda sola con un respiro después de la última tecla. Ver «El borrador de la
//    lección», abajo.

/**
 * Dónde va el video de una clase en la lección del equipo:
 *   · `marco`  → el reproductor adentro del 16:9 (y abajo, «Cambiar» y «Quitar»);
 *   · `afuera` → un link que no se reproduce acá (se abre en otra pestaña): va debajo del título;
 *   · `vacio`  → no tiene (o lo guardado no es un video): el recuadro punteado de «Agregar video».
 *
 * ⚠️ SALE DE `reproductorDeClase`, LA MISMA REGLA QUE EL PORTAL: si la tab decidiera con la columna
 *    `video_tipo`, mostraría un video que el alumno no ve (un `javascript:` guardado, un archivo sin
 *    ruta) y no ofrecería arreglarlo.
 */
export type LugarDelVideo = 'marco' | 'afuera' | 'vacio';
export function lugarDelVideo(c: Pick<Clase, 'videoTipo' | 'videoUrl' | 'videoPath'>): LugarDelVideo {
  const { video } = reproductorDeClase(c);
  if (!video) return 'vacio';
  return video.tipo === 'afuera' ? 'afuera' : 'marco';
}

/** De qué plataforma es un link reconocido, como lo dice la pantalla. */
const PLATAFORMA: Record<string, string> = { youtube: 'YouTube', vimeo: 'Vimeo', loom: 'Loom', drive: 'Drive', panda: 'Panda', wistia: 'Wistia', bunny: 'Bunny', url: 'Link' };

/**
 * El link que pega quien edita: el que se guarda y lo que se dice de él, o por qué no va. La regla de
 * qué es un link es la de `videoDeLink` (sólo http/https: termina en el `src` de un iframe que ve el
 * cliente), y el server la vuelve a aplicar al guardar (`validarVideoEntrada`).
 */
export function linkDeVideo(raw: string): { ok: true; url: string; tipo: VideoTipo; rotulo: string } | { ok: false; error: string } {
  if (!raw.trim()) return { ok: false, error: 'Pega un link.' };
  const v = videoDeLink(raw);
  // Por qué no (pista VIDEO, item 14): el panel de Panda pide su código, un código sin link lo dice.
  if (!v) return { ok: false, error: porQueNoSeInserta(raw) };
  // «Sin medir»: Drive, Loom y un link cualquiera se ven, pero no avisan cuánto se vio (decisión del
  // 06/10). Se dice al pegarlo, no después. El `tipo` es lo que el borrador dibuja hasta «Guardar» (el
  // server lo vuelve a decidir con la misma `videoDeLink`, `validarVideoEntrada`).
  return { ok: true, url: v.url, tipo: v.tipo as VideoTipo, rotulo: `${PLATAFORMA[v.proveedor ?? v.tipo] ?? 'Link'}${v.medible ? '' : ' · sin medir'}` };
}

/**
 * Los minutos de la clase desde la duración de un video, en segundos: al menos 1. `null` = no se supo.
 * Desde el 08/10/2026 (item 12: «los minutos, eso debería tomarlo automáticamente el tiempo del vídeo»)
 * es la ÚNICA forma de ponerlos: la duración la dice el reproductor del editor (YouTube, Vimeo, un
 * archivo) o el oEmbed de Loom; Drive no la dice, y ahí no hay minutos.
 */
export function minutosDeDuracion(seg: number | null | undefined): number | null {
  if (seg == null || !Number.isFinite(seg) || seg <= 0) return null;
  return Math.min(600, Math.max(1, Math.round(seg / 60)));
}

// ⚠️ `ofreceCierraModulo` Y `faltaEnFormulario` SE FUERON con el autoguardado (audio del 08/10/2026):
//    «Obligatoria para avanzar» vive en el menú «…» de la clase (`ofreceObligatoria`, abajo) y lo que
//    impide guardar son los motivos POR CAMPO (`erroresDelBorrador`), no una frase para la lista entera.
//    `faltaEnFormulario` fue la mitad del «se me borraron los campos» (ver «El borrador de la lección»).

/** Un texto plano, escapado para ir adentro de un HTML. */
const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Un texto plano como HTML de párrafos: una línea en blanco separa párrafos y un salto suelto es un
 * `<br>`. Es lo que se dibujaba hasta hoy (`parrafos`), dicho en HTML para el editor rico.
 */
export function htmlDeTexto(texto: string): string {
  const t = texto.replace(/\r\n?/g, '\n').trim();
  if (!t) return '';
  return t.split(/\n{2,}/).map((p) => `<p>${escapar(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');
}

/**
 * Con qué arranca el editor de la descripción: la rica si la clase la tiene; si no, su texto plano en
 * párrafos (las clases de antes del editor rico). Arrancar vacío sobre una clase con texto haría creer
 * que no tiene descripción, y el primer guardado la borraría.
 *
 * ⚠️ LA CONVERSIÓN NO SE GUARDA SOLA: recién se escribe cuando alguien edita. Abrir una clase vieja no
 *    puede cambiar lo que tiene guardado.
 */
export function htmlInicialDeDescripcion(c: Pick<Clase, 'descripcion' | 'descripcionHtml'>): string {
  return c.descripcionHtml?.trim() ? c.descripcionHtml : htmlDeTexto(c.descripcion ?? '');
}

/**
 * ¿Se dibuja la tarea abierta (la instrucción y el formulario)? Con tarea, siempre; sin tarea, sólo
 * cuando alguien tocó «Agregar tarea». Si no, va el botón punteado.
 */
export const tareaAbierta = (c: Pick<Clase, 'tarea' | 'campos'>, tocada: boolean): boolean => tieneTarea(c) || tocada;

// ⚠️ `cambiosParaQuitarTarea` SE FUE: quitar la tarea es un cambio más del borrador (la consigna vacía y
//    sin campos), y se guarda con el resto. El server apaga «Obligatoria» en la misma escritura si la
//    clase queda sin nada que pedir (`guardarLeccion`).

/** Con qué arranca el editor de la consigna de la tarea: la rica si la hay; si no, `tarea` en párrafos. */
export function htmlInicialDeTarea(c: Pick<Clase, 'tarea'> & { tareaHtml?: string | null }): string {
  return c.tareaHtml?.trim() ? c.tareaHtml : htmlDeTexto(c.tarea ?? '');
}

// =============================================================================
// EL BORRADOR DE LA LECCIÓN (audio del 08/10/2026, items 1, 2, 3 y 4)
// =============================================================================
// «Prefiero que haya un botón que me obligue a guardar de forma manual frente a que simplemente cambie y
// que se guarde solo, porque siento que esto puede llegar a traer bugs» (14:30). Martín: «lo más fácil es
// un botón de guardar y que diga guardando» (15:40).
//
// Todo lo que se edita ADENTRO de una clase vive en un borrador del navegador hasta «Guardar», que lo
// escribe de una vez (`guardarLeccionAction`, ./modulos-actions.ts). Lo ESTRUCTURAL (el menú «…», crear y
// borrar clases y módulos, el arrastre) sigue inmediato con su «Deshacer»: no es la lección.
//
// ⚠️ EL «SE ME BORRARON LOS CAMPOS» (15:30-16:40) NO ERA EL SANEO DEL SERVER: era la PANTALLA. Con el
//    autoguardado, la lista de campos se mandaba ENTERA y sólo si estaba completa (`faltaEnFormulario`):
//    con UN campo sin pregunta no se mandaba ninguno, y al salir de la clase el guardado de la salida
//    volvía a preguntar, volvía a no mandar, y se desmontaba. Se perdían TODOS los campos de la tanda, no
//    sólo el incompleto — que es literal lo que dijo: «se me borraron todos los campos de edición». El
//    server ya rechazaba un campo sin pregunta (`validarCamposEntrada`); nunca llegaba a verlo. Ahora lo
//    incompleto se queda en el borrador, se marca en rojo, y salir pregunta.

/** El video del borrador: las tres columnas de la clase, como las dibuja `reproductorDeClase`. */
export type VideoDelBorrador = Pick<Clase, 'videoTipo' | 'videoUrl' | 'videoPath'>;

/** Dónde va el texto de la lección: un ajuste del CURSO (`curso_estilo`), editado desde la lección. */
export type DisposicionBorrador = 'costado' | 'abajo';

/** Lo que se edita adentro de una clase (contrato (1) del pedido del 08/10/2026). */
export type BorradorLeccion = {
  titulo: string;
  video: VideoDelBorrador;
  descripcionHtml: string;
  disposicion: DisposicionBorrador;
  tareaHtml: string;
  campos: Campo[];
  porArea: boolean;
};

export const PARTES_BORRADOR = ['titulo', 'video', 'descripcionHtml', 'disposicion', 'tareaHtml', 'campos', 'porArea'] as const;
export type ParteBorrador = (typeof PARTES_BORRADOR)[number];

/**
 * El borrador con el que arranca una clase: lo guardado. La descripción y la consigna de una clase de
 * antes del editor rico arrancan con su texto plano en párrafos (`htmlInicialDeDescripcion`): esa
 * conversión es también la BASE, así que abrir la clase no la deja «Sin guardar».
 */
export function borradorDe(c: Clase & { tareaHtml?: string | null }, disposicion: DisposicionBorrador): BorradorLeccion {
  return {
    titulo: c.titulo,
    video: { videoTipo: c.videoTipo, videoUrl: c.videoUrl, videoPath: c.videoPath },
    descripcionHtml: htmlInicialDeDescripcion(c),
    disposicion: disposicion === 'abajo' ? 'abajo' : 'costado',
    tareaHtml: htmlInicialDeTarea(c),
    campos: c.campos,
    porArea: c.porArea === true,
  };
}

/**
 * La clase como la DIBUJA la lección mientras se edita: lo guardado con el borrador encima. Lo que no se
 * edita adentro (los minutos, «Obligatoria», el candado, la etapa) es lo guardado.
 */
export function claseDelBorrador<T extends Clase>(c: T, b: BorradorLeccion): T & { tareaHtml: string } {
  return {
    ...c, titulo: b.titulo, ...b.video, descripcionHtml: b.descripcionHtml, tareaHtml: b.tareaHtml, campos: b.campos, porArea: b.porArea,
  };
}

/** ¿Dicen lo mismo? Por valor: los campos y el video son objetos que se reconstruyen en cada gesto. */
export const igualParte = (a: unknown, b: unknown): boolean => a === b || JSON.stringify(a) === JSON.stringify(b);

/** Las partes que el borrador cambió respecto de `base`, en el orden de `PARTES_BORRADOR`. */
export const partesCambiadas = (base: BorradorLeccion, b: BorradorLeccion): ParteBorrador[] =>
  PARTES_BORRADOR.filter((k) => !igualParte(base[k], b[k]));

/**
 * El borrador sobre una base NUEVA (otra pestaña guardó, un gesto del menú cambió la clase, el server
 * devolvió lo guardado ya saneado): cada parte que la persona NO tocó (igual a la base vieja) toma la
 * nueva; la que tocó se queda como la dejó. Es lo que deja guardar encima después de un choque, y lo que
 * hace que el título renombrado desde el menú aparezca en una lección con la descripción a medio escribir.
 */
export function rebasar(baseVieja: BorradorLeccion, b: BorradorLeccion, baseNueva: BorradorLeccion): BorradorLeccion {
  const out = { ...b };
  for (const k of PARTES_BORRADOR) if (igualParte(b[k], baseVieja[k])) (out as Record<ParteBorrador, unknown>)[k] = baseNueva[k];
  return out;
}

/** El video del borrador como lo pide el server (`CambioVideo`): `null` = sin video. */
export type VideoParaGuardar = { tipo: 'url'; url: string } | { tipo: 'archivo'; path: string } | null;
export function videoParaGuardar(v: VideoDelBorrador): VideoParaGuardar {
  if (v.videoTipo === 'archivo' && v.videoPath) return { tipo: 'archivo', path: v.videoPath };
  if (v.videoTipo !== 'ninguno' && v.videoTipo !== 'archivo' && v.videoUrl) return { tipo: 'url', url: v.videoUrl };
  return null;
}

/** La clave de un video (cambiarlo remonta sus controles y separa los minutos medidos de cada uno). */
export const claveDeVideo = (v: VideoDelBorrador): string => `${v.videoTipo}:${v.videoUrl ?? v.videoPath ?? ''}`;

/**
 * Lo que se le manda al server, SÓLO las partes que cambiaron de la CLASE (la disposición es del curso y
 * va por su camino). `antes` lleva lo que la persona tenía como base de cada una: el server compara la
 * fila contra eso y, si otra pestaña la cambió en el medio, no la pisa (`guardarLeccion`).
 */
export type CambiosLeccion = {
  titulo?: string;
  video?: VideoParaGuardar;
  descripcionHtml?: string;
  tareaHtml?: string;
  campos?: Campo[];
  porArea?: boolean;
  /** Los minutos del video NUEVO, si el reproductor ya los midió (van con el video, nunca solos). */
  minutos?: number | null;
};

export function cambiosParaGuardar(
  base: BorradorLeccion, b: BorradorLeccion, minutosDe: (clave: string) => number | null | undefined,
): { cambios: CambiosLeccion | null; antes: CambiosLeccion; disposicion: DisposicionBorrador | null } {
  const cambios: CambiosLeccion = {};
  const antes: CambiosLeccion = {};
  for (const k of partesCambiadas(base, b)) {
    if (k === 'disposicion') continue;
    if (k === 'video') {
      cambios.video = videoParaGuardar(b.video);
      antes.video = videoParaGuardar(base.video);
      const m = minutosDe(claveDeVideo(b.video));
      if (m != null) cambios.minutos = m;
      continue;
    }
    (cambios as Record<string, unknown>)[k] = b[k];
    (antes as Record<string, unknown>)[k] = base[k];
  }
  return {
    cambios: Object.keys(cambios).length ? cambios : null,
    antes,
    disposicion: base.disposicion !== b.disposicion ? b.disposicion : null,
  };
}

/**
 * Lo que impide guardar, por parte: los motivos de cada campo (`erroresDeCampos`, lib/curso.ts, la MISMA
 * regla con la que rechaza el server) y el título vacío. Es lo que se pinta en rojo (item 2: «un enmarcado
 * rojo y que diga falta completar la pregunta»). `{}` = se puede guardar.
 */
export function erroresDelBorrador(b: Pick<BorradorLeccion, 'titulo' | 'campos'>): Record<string, string> {
  const out = { ...erroresDeCampos(b.campos) };
  if (!b.titulo.trim()) out.titulo = 'Falta el título';
  return out;
}

// ── El Ctrl+Z del borrador (item 4, 20:50: «cuando aprieto control Z me deje deshacer») ──
// Se apila UNA VEZ POR GESTO (AGENTS.md, «Una pila de deshacer se llena en el CHOKE POINT»): escribir un
// párrafo es un gesto, no cuarenta. El gesto se reconoce por QUÉ cambió y por el HUECO desde el anterior.

/** Cuánto tiene que pasar entre dos teclas para que la segunda empiece otro gesto. */
export const GESTO_MS = 1000;

/** La forma del formulario: qué campos hay, en qué orden y de qué tipo. Lo demás es texto adentro. */
const formaDeCampos = (cs: readonly Campo[]) => cs.map((c) => `${c.id}:${c.tipo}`).join('|');

/**
 * Qué gesto es pasar de `antes` a `despues`. `continuo` = se escribe de corrido (un texto, la pregunta de
 * UN campo): varios cambios seguidos de la misma clave son UN paso. Lo demás (el video, la disposición,
 * agregar, borrar, mover o cambiar el tipo de un campo, «Una respuesta por área») es un paso por cambio.
 * `null` = no cambió nada.
 */
export function gestoDe(antes: BorradorLeccion, despues: BorradorLeccion): { clave: string; continuo: boolean } | null {
  const partes = partesCambiadas(antes, despues);
  if (!partes.length) return null;
  if (partes.length === 1) {
    const k = partes[0];
    if (k === 'titulo' || k === 'descripcionHtml' || k === 'tareaHtml') return { clave: k, continuo: true };
    if (k === 'campos' && formaDeCampos(antes.campos) === formaDeCampos(despues.campos)) {
      const tocados = despues.campos.filter((c, i) => !igualParte(c, antes.campos[i])).map((c) => c.id);
      return { clave: `campos:${tocados.join(',')}`, continuo: tocados.length === 1 };
    }
  }
  return { clave: partes.join(','), continuo: false };
}

/** ¿Este cambio empieza un paso nuevo de la pila? */
export function esGestoNuevo(previo: { clave: string; en: number } | null, g: { clave: string; continuo: boolean }, ahora: number): boolean {
  return !g.continuo || !previo || previo.clave !== g.clave || ahora - previo.en > GESTO_MS;
}

// ── La barra de guardar ───────────────────────────────────────────────────────

/** En qué está la lección: lo que dice la barra. */
export type EstadoBarra = 'limpio' | 'sucio' | 'guardando' | 'guardado' | 'falta' | 'conflicto' | 'error';

/**
 * Lo que dice la barra (AGENTS.md: el texto que se DIBUJA es corto, tres palabras como mucho). Lo que
 * falta se marca en cada campo; acá sólo se dice que hay algo marcado.
 */
export function textoDeBarra(e: EstadoBarra): string {
  switch (e) {
    case 'sucio': return 'Sin guardar';
    case 'guardando': return 'Guardando…';
    case 'guardado': return 'Guardado';
    case 'falta': return 'Completa lo marcado';
    case 'conflicto': return 'Cambió en otra pestaña';
    case 'error': return 'No se guardó';
    default: return '';
  }
}

// ── «Obligatoria para avanzar», en el menú «…» de la clase (item 7, 13:00) ───────

/**
 * Sin tarea guardada no se prende. Es el MISMO texto con que rechaza el server (`ERROR_OBLIGATORIA_SIN_TAREA`,
 * ./reglas.ts): antes decía «Para cerrar la etapa, agrega la tarea.», que al lado del interruptor se leía
 * como un bug (13:00: «Hay uno, un bug cuando dice obligatorio para avanzar… Para cerrar la etapa, agrega
 * la tarea»).
 */
export const MOTIVO_SIN_TAREA = ERROR_OBLIGATORIA_SIN_TAREA;
/** La tarea está en el borrador y todavía no se guardó: la marca la valida el server contra lo guardado. */
export const MOTIVO_TAREA_SIN_GUARDAR = 'Guarda la tarea primero.';

/**
 * Por qué «Obligatoria para avanzar» se ve apagada, o `null` si se puede tocar. Prendida, siempre se puede
 * apagar. Apagada sin tarea GUARDADA, no se puede prender: el server la rechazaría.
 */
export function motivoObligatoria(o: { prendida: boolean; tareaGuardada: boolean; tareaEnBorrador: boolean }): string | null {
  if (o.prendida || o.tareaGuardada) return null;
  return o.tareaEnBorrador ? MOTIVO_TAREA_SIN_GUARDAR : MOTIVO_SIN_TAREA;
}

/**
 * ¿Se ofrece en el menú? En un módulo VINCULADO (una etapa del kanban: completarlo es lo que mueve al
 * cliente). En un suelto sólo si ya está prendida —llegó ahí arrastrada—, para poder apagarla.
 */
export const ofreceObligatoria = (vinculado: boolean, prendida: boolean): boolean => vinculado || prendida;
