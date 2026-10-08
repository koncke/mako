// =============================================================================
// leccion-reglas — lo que decide la LECCIÓN EDITABLE de la tab Curso sin tocar la base (puro)
// =============================================================================
// Pedido de Martín (07/10/2026, items 13 a 17), textual: «Elimina el botón de "Editar", para eso ya
// se edita en cada parte... Si quiero editar el título, le doy click, como la descripción... Si quiero
// agregar un vídeo... debe siempre estar un placeholder donde iría el vídeo para la opción de "Agregar
// vídeo"... Lo mismo con el botón de "Agregar tarea" ahí mismo abajo de la descripción, como
// placeholder». Decisiones: docs/diseno-curso-skool.md, D4.
//
// Sin 'use client' ni 'server-only' a propósito: lo usa la lección (./LeccionEditable.tsx, navegador)
// y un test que lo EJECUTA (tests/curso-leccion.test.ts). Lo que se guarda lo vuelve a decidir el
// server (`guardarCampoClase`, lib/curso-admin.ts): acá está lo que la pantalla necesita saber ANTES
// de mandar, para no mandar algo que va a rebotar.

import type { Campo, Clase } from '@/lib/curso';
import { reproductorDeClase, tieneTarea, videoDeLink } from '@/lib/curso';
import { validarCamposEntrada } from './reglas';

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

/** Los minutos de la clase desde la duración de un video, en segundos: al menos 1. `null` = no se supo. */
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
