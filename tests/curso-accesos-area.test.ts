// =============================================================================
// Toda consulta a `curso_accesos` dice de QUIÉN es el acceso: el cliente o un líder
// =============================================================================
// Desde la 0212 (#665) un cliente tiene en `curso_accesos` su fila (`area` NULL) y una más por
// cada líder de área. Una consulta que filtra sólo por `lead_id` ya no lee «el acceso del
// cliente»: lee UNA de varias filas, la que PostgREST devuelva primero.
//
// Lo encontró la integración del 07/10/2026, no un test: el recordatorio de clases (#780) se
// escribió sobre un árbol SIN líderes y el link del líder entró por otro worktree. Juntos, el
// recordatorio armaba su mapa por cliente con `new Map(filas.map(f => [lead_id, f]))` — la fila
// del líder pisaba la del cliente y «hace 3 días que no entra» se decidía con las fechas del
// líder, para mandarle el WhatsApp al CLIENTE. Cinco consultas de lib/curso-mensajes.ts.
//
// La regla: cada `.from('curso_accesos')` (o lectura paginada de esa tabla) nombra el área
// —`.is('area', null)`, `conArea(...)` o la columna `area` en el filtro— o apunta a UNA fila por
// su `id`. Se mira la SENTENCIA entera (hasta el `;`), sobre el texto sin comentarios.
//
// Probado rompiéndolo: sacarle el `.is('area', null)` a la lectura fresca del recordatorio
// (lib/curso-mensajes.ts) → 1 fail que nombra lib/curso-mensajes.ts:905; restaurado → 2 pass.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  // Un bloque se vacía pero conserva sus saltos: así la línea que se informa es la del archivo.
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));

const archivos = execFileSync('git', ['ls-files', 'app', 'lib'], { encoding: 'utf8' })
  .split('\n').filter((f) => /\.(ts|tsx)$/.test(f));

/** Las sentencias que tocan `curso_accesos`, con la línea donde empiezan. */
function sentencias(): Array<{ archivo: string; linea: number; texto: string }> {
  const out: Array<{ archivo: string; linea: number; texto: string }> = [];
  for (const archivo of archivos) {
    const crudo = readFileSync(archivo, 'utf8').replace(/\r\n/g, '\n');
    if (!crudo.includes("'curso_accesos'")) continue;
    const src = sinComentarios(crudo);
    const re = /from\('curso_accesos'\)|leerTodo<[^>]*>\([^,]+,\s*'curso_accesos'|leerPorPaginas[^(]*\([^,]+,\s*'curso_accesos'/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const fin = src.indexOf(';', m.index);
      out.push({
        archivo,
        linea: src.slice(0, m.index).split('\n').length,
        texto: src.slice(m.index, fin < 0 ? undefined : fin),
      });
    }
  }
  return out;
}

test('el barrido encuentra las consultas (si da cero, el patrón dejó de ver la tabla)', () => {
  const s = sentencias();
  assert.ok(s.length >= 10, `sólo ${s.length} consultas a curso_accesos: el regex quedó ciego`);
  assert.ok(s.some((x) => x.archivo === 'lib/curso-mensajes.ts'), 'el recordatorio no aparece en el barrido');
});

test('toda consulta a curso_accesos dice de quién es el acceso', () => {
  const sinArea = sentencias().filter((x) =>
    !/\.is\('area',\s*null\)|conArea\(|\barea\b|\.eq\('id',/.test(x.texto));
  assert.deepEqual(
    sinArea.map((x) => `${x.archivo}:${x.linea}`),
    [],
    'Estas consultas a curso_accesos no nombran el área: desde la 0212 leen la fila de un LÍDER como si fuera la del cliente.',
  );
});
