// Lee la fuente de un archivo SIN comentarios, para las guardias que miran código (23/10/2026).
// Con un regex por línea una guardia pasaba gracias a una nota «antes: …» con el código viejo adentro, y en este repo esas
// notas abundan. Los comentarios se reemplazan por espacios: las posiciones y los renglones no se mueven.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

export function sinComentarios(src: string): string {
  const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true);
  const rangos = new Map<number, number>();
  const visitar = (n: ts.Node) => {
    for (const r of [...(ts.getLeadingCommentRanges(src, n.pos) ?? []), ...(ts.getTrailingCommentRanges(src, n.end) ?? [])]) rangos.set(r.pos, r.end);
    for (const h of n.getChildren(sf)) visitar(h);
  };
  visitar(sf);
  let salida = src;
  for (const [ini, fin] of rangos) salida = salida.slice(0, ini) + salida.slice(ini, fin).replace(/[^\n]/g, ' ') + salida.slice(fin);
  return salida;
}

/** `rel` es relativo a la raíz del repo. */
export const fuenteSinComentarios = (rel: string): string =>
  sinComentarios(readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n'));
