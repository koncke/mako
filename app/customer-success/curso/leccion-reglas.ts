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
// Sin 'use client' ni 'server-only' a propósito: lo usa la lección (./LeccionEditable.tsx, navegador)
// y un test que lo EJECUTA (tests/curso-leccion.test.ts). Lo que se guarda lo vuelve a decidir el
// server (`guardarCampoClase`, lib/curso-admin.ts): acá está lo que la pantalla necesita saber ANTES
// de mandar, para no mandar algo que va a rebotar.

import type { Campo, Clase } from '@/lib/curso';
import { reproductorDeClase, tapaDeVideo, tieneTarea, videoDeLink } from '@/lib/curso';
import { validarCamposEntrada } from './reglas';

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

/**
 * «+ Nuevo campo» está ARRIBA de todo (item 8), así que el campo nace ARRIBA: donde se tocó y a la vista.
 * Con veinte campos, uno nuevo al final aparecía fuera de la pantalla (el «+ Campo» de antes estaba
 * abajo por eso). Después se arrastra a donde vaya.
 */
export const campoNuevoArriba = (campos: readonly Campo[], id: string): Campo[] => [{ id, label: '', tipo: 'texto' }, ...campos];

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

/**
 * Cuánto se espera después de la última tecla para guardar. La descripción se escribe de corrido
 * (un guardado por tecla serían sesenta por segundo, y las server actions se ENCOLAN: AGENTS.md); la
 * tarea, un poco menos, porque es más corta y lo que se arma es un formulario.
 */
export const RESPIRO_DESCRIPCION_MS = 1200;
export const RESPIRO_TAREA_MS = 900;

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
const PLATAFORMA: Record<string, string> = { youtube: 'YouTube', vimeo: 'Vimeo', loom: 'Loom', drive: 'Drive', url: 'Link' };

/**
 * El link que pega quien edita: el que se guarda y lo que se dice de él, o por qué no va. La regla de
 * qué es un link es la de `videoDeLink` (sólo http/https: termina en el `src` de un iframe que ve el
 * cliente), y el server la vuelve a aplicar al guardar (`validarVideoEntrada`).
 */
export function linkDeVideo(raw: string): { ok: true; url: string; rotulo: string } | { ok: false; error: string } {
  if (!raw.trim()) return { ok: false, error: 'Pega un link.' };
  const v = videoDeLink(raw);
  if (!v) return { ok: false, error: 'Ese link no es válido.' };
  // «Sin medir»: Drive, Loom y un link cualquiera se ven, pero no avisan cuánto se vio (decisión del
  // 06/10). Se dice al pegarlo, no después.
  return { ok: true, url: v.url, rotulo: `${PLATAFORMA[v.tipo] ?? 'Link'}${v.medible ? '' : ' · sin medir'}` };
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

/**
 * «Cierra el módulo» se ofrece SÓLO en un módulo vinculado (una etapa del kanban): completarlo es lo
 * que mueve al cliente de etapa. Un módulo suelto no es una etapa (D1) y no mueve a nadie, así que la
 * marca ahí no haría nada — y el server la rechaza nueva (`ERROR_OBLIGATORIA_SUELTO`).
 */
export const ofreceCierraModulo = (vinculado: boolean): boolean => vinculado;

/**
 * Lo que le falta al formulario de la tarea para poder guardarse, en una frase corta (la de
 * `validarCamposEntrada`, la MISMA que aplica el server). `null` = se puede guardar.
 *
 * ⚠️ SE PREGUNTA ANTES DE MANDAR, y no se manda lo incompleto: mientras alguien arma un quiz, cada
 *    tecla deja un formulario a medias (una pregunta sin correcta, un campo sin texto). Mandarlo sería
 *    un rebote por tecla; la pantalla dice qué falta y guarda cuando está completo.
 */
export function faltaEnFormulario(campos: readonly Campo[]): string | null {
  const v = validarCamposEntrada(campos);
  return v.ok ? null : v.error;
}

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

/**
 * Los cambios para QUITAR la tarea, en orden y sólo los que hacen falta (una escritura por parte:
 * `guardarCampoClase` acepta un cambio por vez). Al quedar sin nada que pedir, el server apaga «Cierra
 * el módulo» en la misma escritura.
 */
export function cambiosParaQuitarTarea(c: Pick<Clase, 'tarea' | 'campos'>): Array<{ tarea: string } | { campos: Campo[] }> {
  const out: Array<{ tarea: string } | { campos: Campo[] }> = [];
  if (c.tarea.trim()) out.push({ tarea: '' });
  if (c.campos.length) out.push({ campos: [] });
  return out;
}

/** En qué quedó lo último que se guardó de una parte de la lección. */
export type EstadoGuardado = 'limpio' | 'sucio' | 'guardando' | 'guardado' | 'error' | { falta: string };

/**
 * Lo que dice la pantalla de ese estado: dos o tres palabras (AGENTS.md, «el texto que se dibuja es
 * corto»). Lo que falta para guardar va entero: es lo único accionable.
 */
export function textoDeGuardado(e: EstadoGuardado): string {
  if (typeof e === 'object') return e.falta;
  switch (e) {
    case 'sucio': return 'Sin guardar';
    case 'guardando': return 'Guardando…';
    case 'guardado': return 'Guardado';
    case 'error': return 'No se guardó';
    default: return '';
  }
}
