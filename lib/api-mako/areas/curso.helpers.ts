// =============================================================================
// api-mako / curso — lo puro del área (con test): sin `server-only`
// =============================================================================

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
