import 'server-only';

// =============================================================================
// curso-tarea-html — lo que el SERVER hace con la tarea al guardarla: sanear su HTML y derivar el texto
// =============================================================================
// Audio del 08/10/2026 (la prueba del curso, docs/feedback-curso-08oct.md), items 11 y 12: la consigna
// de la tarea con formato («que tenga negrita… como la descripción», 18:00) y más de una tarea por
// clase («sería bueno que se pueda agregar más de una tarea», 21:30). El modelo vive en lib/curso.ts
// (`Clase.tareaHtml`, el campo `seccion`, `tareasDeClase`); esto es la mitad que necesita
// lib/html-seguro.ts, que es `server-only` (sanitize-html arrastra postcss y htmlparser2, y lo que
// decide qué HTML es seguro no puede vivir en el navegador).
//
// Lo usa `guardarLeccion` (lib/curso-admin.ts, el guardado MANUAL de la lección): UNA regla para
// derivar `tarea` y UNA para sanear los campos, en vez de una copia en cada camino que guarde.
//
// ⚠️ ANTES DE `sanearCamposDelServidor` VA `erroresDeCampos` (lib/curso.ts), y si dice algo, se
//    rechaza: el saneo ya no tira un campo sin pregunta (lo conserva), pero lo que sí descarta
//    —basura— vuelve en `descartes`, y quien guarda decide qué hacer con eso (rechazar). Nada se
//    pierde en silencio: es la cura del «se me borraron los campos» (item 2, 15:30).

import { sanearHtml, validarHtmlRico } from './html-seguro';
import { sanearCampos, type Campo } from './curso';

/** El tope del texto plano derivado: el mismo que el de `tarea` en el editor (`TOPE_TEXTO`, reglas.ts). */
const TOPE_TAREA_TEXTO = 20_000;

/**
 * La tarea principal como se GUARDA: el HTML saneado (o `null` si no queda nada: «sin consigna con
 * formato», no «HTML vacío») y su texto plano, que va a `curso_clases.tarea`.
 *
 * ⚠️ LA REGLA DE LA 0226: `tarea` = el texto de `tarea_html`, SIEMPRE derivado acá. Lo leen la IA (el
 *    paso 5), los mensajes y `tieneTarea`; si se escribiera aparte, el alumno vería una consigna y el
 *    prompt de la IA otra.
 *
 * Pasarse NO se corta: se rechaza con un error corto (`validarHtmlRico`), que la pantalla dibuja.
 */
export function tareaParaGuardar(raw: unknown): { ok: true; tareaHtml: string | null; tarea: string } | { ok: false; error: string } {
  const v = validarHtmlRico(raw);
  if (!v.ok) return { ok: false, error: v.error.replace('La descripción', 'La tarea') };
  if (!v.html) return { ok: true, tareaHtml: null, tarea: '' };
  return { ok: true, tareaHtml: v.html, tarea: v.texto.slice(0, TOPE_TAREA_TEXTO) };
}

/**
 * Los campos como se GUARDAN, con la consigna de cada `seccion` saneada en el server. Devuelve lo que
 * el saneo descartó (`descartes`): con algo adentro, quien guarda RECHAZA en vez de escribir una
 * lista con menos campos de los que la persona ve.
 */
export function sanearCamposDelServidor(raw: unknown): { campos: Campo[]; descartes: string[] } {
  const descartes: string[] = [];
  const campos = sanearCampos(raw, { html: sanearHtml, descartes });
  return { campos, descartes };
}
