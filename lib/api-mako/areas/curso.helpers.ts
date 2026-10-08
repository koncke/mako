// =============================================================================
// api-mako / curso — lo puro del área (con test): sin `server-only`
// =============================================================================
// ⚠️ ACÁ NO SE LEE `.campos` DE NADA: tests/curso-tareas-secciones.test.ts barre todo lector de
// `.campos` de los archivos que importan lib/curso (una `seccion` no es un campo que se conteste). Lo
// que se recorre acá son las TAREAS, y sus campos se toman por desestructuración.
// =============================================================================

import type { Campo, CampoTipo, TareaDeClase } from '@/lib/curso';

/**
 * Texto plano → párrafos HTML, para quien migra un curso con la descripción en texto (Panda, un
 * CSV): una línea en blanco separa párrafos y un salto suelto es un <br>. Lo que sale pasa igual por
 * el saneo (`validarHtmlRico`, lib/html-seguro.ts): esto sólo le da forma, no lo vuelve seguro.
 */
export function htmlDeTexto(texto: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return texto.replace(/\r\n?/g, '\n').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
}

/**
 * Los tipos de campo que se arman por la API. Quedan afuera, a propósito: `quiz` (preguntas con sus
 * respuestas correctas y la nota), `publicar` y `comentar` (atados a la comunidad del producto) y
 * `seccion` (una tarea nueva se pide como otra tarea, no como un campo). Esos se arman en MaKo.
 */
export const TIPOS_CAMPO_API = [
  'texto', 'linea', 'numero', 'eleccion', 'checks', 'tabla', 'archivo', 'audio', 'video', 'link', 'escala',
  'checklist', 'agenda', 'confirmacion',
] as const satisfies readonly CampoTipo[];

export type CampoEntrada = {
  id?: string; tipo: string; label: string; obligatorio?: boolean; ayuda?: string; placeholder?: string;
  opciones?: string[]; columnas?: string[]; url?: string;
  escala?: { min?: number; max?: number; bajo?: string; alto?: string; estilo?: string };
};
export type TareaEntrada = { titulo?: string; consignaHtml?: string; consigna?: string; campos?: CampoEntrada[] };

/** La tarea como la devuelve la API: la misma forma que se manda (para editar sin perder los ids). */
export type TareaSalida = { titulo: string | null; consignaHtml: string | null; campos: Campo[] };

/** Las tareas de una clase en la forma de la API (la principal primero, sin título). */
export function tareasParaApi(tareas: readonly TareaDeClase[]): TareaSalida[] {
  return tareas.map(({ titulo, descripcionHtml, campos: cs }) => ({ titulo, consignaHtml: descripcionHtml, campos: cs }));
}

/**
 * Las tareas que manda la API → el modelo de la clase (`tareaHtml` + `campos` con sus `seccion`). La
 * primera es la PRINCIPAL (su consigna es `tareaHtml` y no lleva título); cada una de las siguientes
 * abre una `seccion` con su título y su consigna, y sus campos van detrás.
 *
 * LOS IDS SE CONSERVAN: un campo que llega con `id` lo mantiene; uno sin `id` reusa el del campo que ya
 * tenía la clase con la MISMA pregunta y el mismo tipo (las respuestas de los alumnos cuelgan del id:
 * reescribir la tarea con ids nuevos las dejaría sin pregunta). Lo demás nace con `nuevoId()`.
 *
 * Valida la FORMA (tipos, títulos, una consigna por tarea); lo que le falta a cada campo lo dice
 * `erroresDeCampos` (lib/curso.ts), que corre después sobre el resultado.
 */
export function modeloDeTareas(
  entrada: readonly TareaEntrada[], existentes: readonly TareaDeClase[], nuevoId: () => string,
): { tareaHtml: string; consignasHtml: string[]; campos: Campo[] } | { error: string } {
  if (!entrada.length) return { tareaHtml: '', consignasHtml: [], campos: [] };
  if (entrada[0].titulo && entrada[0].titulo.trim()) {
    return { error: 'La primera tarea es la principal y no lleva título: empieza con una tarea sin `titulo` (puede no tener campos).' };
  }
  const previos: Campo[] = [];
  const seccionesPrevias = new Map<string, string>();
  for (const { id, titulo, campos: cs } of existentes) {
    if (id && titulo) seccionesPrevias.set(titulo.trim().toLowerCase(), id);
    previos.push(...cs);
  }
  const usados = new Set<string>();
  const reusar = (label: string, tipo: string): string | null => {
    const p = previos.find((x) => !usados.has(x.id) && x.tipo === tipo && x.label.trim().toLowerCase() === label.trim().toLowerCase());
    return p ? p.id : null;
  };

  const campos: Campo[] = [];
  const consignasHtml: string[] = [];
  let tareaHtml = '';
  for (const [i, t] of entrada.entries()) {
    const donde = i === 0 ? 'la tarea principal' : `la tarea ${i + 1}`;
    if (t.consignaHtml !== undefined && t.consigna !== undefined) return { error: `En ${donde}: pasa la consigna en \`consignaHtml\` O en \`consigna\`, no en las dos.` };
    const html = t.consignaHtml !== undefined ? t.consignaHtml : t.consigna !== undefined ? htmlDeTexto(t.consigna) : '';
    if (i === 0) tareaHtml = html;
    else {
      const titulo = (t.titulo ?? '').replace(/\s+/g, ' ').trim();
      if (!titulo) return { error: `La tarea ${i + 1} no tiene \`titulo\` (sólo la principal va sin título).` };
      const id = seccionesPrevias.get(titulo.toLowerCase()) ?? nuevoId();
      seccionesPrevias.delete(titulo.toLowerCase());
      usados.add(id);
      campos.push({ id, label: titulo, tipo: 'seccion', ...(html ? { descripcionHtml: html } : {}) } as Campo);
      if (html) consignasHtml.push(html);
    }
    const { campos: pedidos = [] } = t;
    for (const [j, c] of pedidos.entries()) {
      if (!(TIPOS_CAMPO_API as readonly string[]).includes(c.tipo)) {
        return { error: `En ${donde}, el campo ${j + 1}: el tipo «${c.tipo}» no se arma por la API (sí: ${TIPOS_CAMPO_API.join(', ')}).` };
      }
      const label = (c.label ?? '').replace(/\s+/g, ' ').trim();
      const pedido = typeof c.id === 'string' && c.id.trim() ? c.id.trim() : null;
      const id = pedido && !usados.has(pedido) ? pedido : reusar(label, c.tipo) ?? nuevoId();
      usados.add(id);
      const campo: Record<string, unknown> = { id, label, tipo: c.tipo };
      if (c.obligatorio !== undefined) campo.obligatorio = c.obligatorio === true;
      for (const k of ['ayuda', 'placeholder', 'url'] as const) if (typeof c[k] === 'string' && c[k]!.trim()) campo[k] = c[k]!.trim();
      for (const k of ['opciones', 'columnas'] as const) if (Array.isArray(c[k])) campo[k] = c[k];
      if (c.escala) campo.escala = { ...c.escala };
      campos.push(campo as Campo);
    }
  }
  return { tareaHtml, consignasHtml, campos };
}
