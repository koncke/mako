// =============================================================================
// La PAPELERA del curso (mig 0223): lo borrado es INVISIBLE para todo lo demás, y se purga después
// =============================================================================
// Borrar una clase o un módulo desde el editor ya no es un `delete`: queda con su marca (`borrada_at` /
// `borrado_at`) para que el «Deshacer» de 5 segundos lo devuelva con la MISMA identidad (item 18 del
// 08/10/2026). El precio de eso es que TODA lectura de clases tiene que filtrar la marca: una que no lo
// haga le muestra al alumno una clase que el equipo borró, la cuenta en su avance o se la nombra en un
// WhatsApp. Esto barre `app/` y `lib/` (el DISCO, no `git ls-files`: un archivo nuevo sin agregar es
// justo el que se olvida) y falla nombrando archivo y línea.
//
// La regla: cada LECTURA de `curso_clases` (un `.from('curso_clases').select(…)` o un `leerTodo` /
// `leerPorPaginas` de la tabla) nombra `borrada_at` en su sentencia —`.is('borrada_at', null)`, o
// `.not('borrada_at', …)` en las que buscan justamente lo borrado—, o está en `EXCEPCIONES` con su
// porqué. Las escrituras no son lecturas (las del editor leen antes con el filtro). Y el `delete` de
// verdad vive sólo en la purga.
//
// PROBADO ROMPIÉNDOLO: la tabla con los números está al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DIAS_PAPELERA, corteDePapelera, vencidoEnPapelera } from '../lib/curso-papelera-reglas';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
// Las líneas PRIMERO y los bloques después (AGENTS.md), y un bloque se vacía pero conserva sus saltos:
// así la línea que se informa es la del archivo.
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));

function fuentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name);
    if (d.isDirectory()) return d.name === 'node_modules' ? [] : fuentes(p);
    return /\.(ts|tsx)$/.test(d.name) ? [p] : [];
  });
}

type Sentencia = { archivo: string; linea: number; texto: string; lectura: boolean };

/**
 * Las sentencias que tocan `curso_clases`, desde el nombre de la tabla:
 *   · `.from('curso_clases')…`: la cadena de llamadas, renglón por renglón mientras el siguiente siga
 *     con `.algo(` (un elemento de un `Promise.all([…])` termina en una coma, no en `;`);
 *   · `leerTodo(…, 'curso_clases', …)`: la llamada entera, hasta su paréntesis de cierre (sus filtros
 *     van en el argumento de opciones, que suele caer en el renglón de abajo).
 * ⚠️ DESDE EL NOMBRE DE LA TABLA y no desde `leerTodo<`: el tipo genérico trae `;` adentro
 *    (`{ id: number; etapa: string }`) y cortaba ahí.
 */
function sentencias(): Sentencia[] {
  const out: Sentencia[] = [];
  for (const f of ['app', 'lib'].flatMap((d) => fuentes(join(RAIZ, d)))) {
    const crudo = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
    if (!crudo.includes("'curso_clases'")) continue;
    const src = sinComentarios(crudo);
    const archivo = f.slice(RAIZ.length + 1).replace(/\\/g, '/');
    const re = /from\('curso_clases'\)|(leerTodo|leerPorPaginas)<[^>]*>\([^,]+,\s*'curso_clases'/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const ini = m.index + m[0].indexOf("'curso_clases'");
      let texto: string;
      if (m[1]) {
        // La llamada entera: se cuentan paréntesis desde el que abre la llamada.
        let k = src.indexOf('(', m.index + m[1].length);
        let prof = 0;
        for (; k < src.length; k++) {
          if (src[k] === '(') prof++;
          else if (src[k] === ')' && --prof === 0) break;
        }
        texto = src.slice(ini, k + 1);
      } else {
        const lineas = src.slice(ini).split('\n');
        const tomadas = [lineas[0]];
        for (const l of lineas.slice(1)) {
          if (tomadas[tomadas.length - 1].includes(';') || !/^\s*\./.test(l)) break;
          tomadas.push(l);
        }
        texto = tomadas.join('\n').split(';')[0];
      }
      out.push({
        archivo, linea: src.slice(0, m.index).split('\n').length, texto,
        lectura: !!m[1] || /^'curso_clases'\)\s*\.select\(/.test(texto),
      });
    }
  }
  return out;
}

/**
 * Las lecturas que NO filtran la papelera, a propósito. Cada una tiene que ver TAMBIÉN lo borrado: si
 * mañana se escribe otra que no filtra, no entra acá sin decir por qué.
 */
const EXCEPCIONES: Array<{ archivo: string; dice: string; porque: string }> = [
  { archivo: 'lib/curso-modulos-datos.ts', dice: "'curso_clases', 'id, etapa'",
    porque: 'clavesUsadas: una clase en la papelera sigue nombrando su clave; reusarla metería la clase devuelta en el módulo nuevo' },
  { archivo: 'lib/curso-admin.ts', dice: ".select('id').eq('video_path', path).limit(1)",
    porque: 'borrarArchivo y descartarVideo: el video de una clase en la papelera sigue siendo suyo (vuelve con «Deshacer»)' },
  { archivo: 'lib/curso-papelera.ts', dice: ".eq('etapa', m.clave)",
    porque: 'la purga de un módulo: una clase en la papelera más nueva todavía necesita su clave' },
];

const excusada = (s: Sentencia) => EXCEPCIONES.some((x) => x.archivo === s.archivo && s.texto.includes(x.dice));

test('el barrido encuentra las lecturas (si da pocas, el patrón dejó de ver la tabla)', () => {
  const l = sentencias().filter((s) => s.lectura);
  assert.ok(l.length >= 15, `sólo ${l.length} lecturas de curso_clases: el barrido quedó ciego`);
  for (const archivo of ['lib/curso-datos.ts', 'lib/curso-admin.ts', 'lib/comunidad-datos.ts', 'lib/curso-adjuntos.ts', 'app/customer-success/curso/onboarding-sync.ts']) {
    assert.ok(l.some((s) => s.archivo === archivo), `el barrido no ve las lecturas de ${archivo}`);
  }
});

test('toda lectura de clases filtra la papelera, o dice por qué no', () => {
  const sinFiltro = sentencias().filter((s) => s.lectura && !/borrada_at/.test(s.texto) && !excusada(s));
  assert.deepEqual(sinFiltro.map((s) => `${s.archivo}:${s.linea}`), [],
    'Estas lecturas de curso_clases no filtran `borrada_at`: le muestran al alumno (o al cron, o a la IA) una clase que el equipo borró.');
});

test('cada excepción sigue existiendo (una que ya no calza es un permiso escrito para la próxima)', () => {
  const todas = sentencias();
  for (const x of EXCEPCIONES) {
    assert.ok(todas.some((s) => s.archivo === x.archivo && s.texto.includes(x.dice)), `la excepción «${x.dice}» de ${x.archivo} ya no calza con nada`);
  }
});

test('las lecturas que ARMAN el curso del alumno filtran: las clases del producto y una clase por id', () => {
  const datos = sinComentarios(leer('lib/curso-datos.ts'));
  assert.match(datos, /from\('curso_clases'\)\.select\(COLUMNAS_CLASE\)\s*\.eq\('producto_id', productoId\)\.is\('borrada_at', null\)/);
  assert.match(datos, /from\('curso_clases'\)\.select\(COLUMNAS_CLASE\)\.eq\('id', claseId\)\.is\('borrada_at', null\)\.maybeSingle\(\)/);
});

test('borrar es poner la marca; el `delete` de verdad vive SÓLO en la purga', () => {
  const deletes = sentencias().filter((s) => /^'curso_clases'\)\s*\.delete\(/.test(s.texto));
  assert.ok(deletes.length >= 1, 'el barrido no ve el delete de la purga: quedó ciego');
  assert.deepEqual([...new Set(deletes.map((s) => s.archivo))], ['lib/curso-papelera.ts']);
  const admin = sinComentarios(leer('lib/curso-admin.ts'));
  const borrar = admin.slice(admin.indexOf('export async function borrarClase('), admin.indexOf('export async function restaurarClases('));
  assert.ok(borrar.length > 200 && borrar.length < 1500, `el recorte de borrarClase mide ${borrar.length}`);
  assert.match(borrar, /\.update\(\{ borrada_at: ahora, updated_at: ahora \}\)\s*\.eq\('id', c\.id\)\.eq\('producto_id', c\.productoId\)\.is\('borrada_at', null\)/);
  // Lo que antes se limpiaba en el acto (el video, lo abierto a mano, la portada) espera a la purga: el
  // «Deshacer» tiene que devolver la clase CON eso.
  assert.doesNotMatch(borrar, /borrarArchivo|curso_desbloqueos|curso_estilo/);
  // Devolver: sólo de este producto y sólo lo que está en la papelera (los ids viajan del navegador).
  const rest = admin.slice(admin.indexOf('export async function restaurarClases('), admin.indexOf('export async function moverClase('));
  assert.match(rest, /\.in\('id', ids\)\.eq\('producto_id', productoId\)\.not\('borrada_at', 'is', null\)/);
});

// ── La purga ──────────────────────────────────────────────────────────────────

test('la purga: sólo lo que TIENE marca y la tiene desde antes del corte; ante la duda, nada', () => {
  const ahora = Date.parse('2026-10-20T12:00:00Z');
  const hace = (dias: number) => new Date(ahora - dias * 86_400_000).toISOString();
  assert.equal(vencidoEnPapelera(hace(DIAS_PAPELERA + 1), ahora), true);
  assert.equal(vencidoEnPapelera(hace(DIAS_PAPELERA - 1), ahora), false, 'todavía se puede devolver');
  assert.equal(vencidoEnPapelera(null, ahora), false, 'sin marca está viva');
  assert.equal(vencidoEnPapelera('cualquier cosa', ahora), false);
  assert.equal(vencidoEnPapelera(new Date(ahora + 86_400_000).toISOString(), ahora), false, 'una marca del futuro (un reloj corrido) no se purga');
  assert.equal(vencidoEnPapelera(hace(DIAS_PAPELERA + 1), ahora, 30), false, 'los días se pueden pasar (el cron usa los de la regla)');
  assert.equal(corteDePapelera(ahora), hace(DIAS_PAPELERA));
});

test('la purga borra con COMPARE-AND-SET, limpia lo que la nombra sin FK, y la corre el cron ANTES de los buckets', () => {
  const pap = sinComentarios(leer('lib/curso-papelera.ts'));
  // El `delete` vuelve a exigir la marca y su edad: una clase devuelta entre la lectura y el borrado se salva.
  assert.match(pap, /from\('curso_clases'\)\.delete\(\)\s*\.in\('id', ids\)\.not\('borrada_at', 'is', null\)\.lt\('borrada_at', corte\)/);
  assert.match(pap, /from\('curso_modulos'\)\.delete\(\)\s*\.eq\('id', m\.id\)\.not\('borrado_at', 'is', null\)\.lt\('borrado_at', corte\)/);
  // Un módulo con clases que todavía nombran su clave (más nuevas en la papelera) no se purga.
  assert.match(pap, /if \(\(count \?\? 0\) > 0\) continue;/);
  assert.match(pap, /from\('curso_desbloqueos'\)\.delete\(\)[^;]*\.eq\('objeto', 'clase'\)\.eq\('clave', String\(c\.id\)\)/);
  assert.match(pap, /from\('curso_estilo'\)\.delete\(\)[^;]*\.eq\('clave', `portada:etapa:\$\{m\.clave\}`\)/);
  const cron = sinComentarios(leer('app/api/cron/curso-purga/route.ts'));
  const iPap = cron.indexOf('await purgarPapeleraDelCurso()');
  assert.ok(iPap > 0 && iPap < cron.indexOf('await purgarHuerfanosDelCurso('), 'la papelera va antes que los buckets (deja sin fila el video de lo purgado)');
  assert.match(cron, /const conError = !!papelera\.error \|\|/, 'un error de la papelera contesta 500, como el de los buckets');
});

test('los módulos: lo borrado no se lista, y devolverlo saca la marca SÓLO de lo que se borró con él', () => {
  const datos = sinComentarios(leer('lib/curso-modulos-datos.ts'));
  assert.match(datos, /leerTodo<FilaBD>\(db, 'curso_modulos', COLS_MODULO, \{ filtros: \(q\) => q\.in\('producto_id', \[\.\.\.productoIds\]\)\.is\('borrado_at', null\)/);
  const rest = datos.slice(datos.indexOf('export async function restaurarModulo('), datos.indexOf('export async function vincularModulo('));
  assert.match(rest, /from\('curso_clases'\)\.update\(\{ borrada_at: null, updated_at: ahora \}\)\s*\.in\('id', ids\)\.eq\('producto_id', productoId\)\.eq\('etapa', clave\)\.not\('borrada_at', 'is', null\)/);
  assert.match(rest, /if \(raw\?\.quitada && \(!etapaRaw \|\| etapaRaw\.key !== clave\)\) return \{ ok: false/, 'la etapa que devuelve el navegador tiene que ser la de ESE módulo');
});

// ── Probado ROMPIÉNDOLO (08/10/2026) ──────────────────────────────────────────
// Una rotura por vez, restaurada deshaciendo el reemplazo (scratchpad/estructura/romper.mjs y
// romper2.mjs). Sin romper: 8/0.
//   · el portal lista las borradas · una clase borrada por id                  → 6 / 2 cada una
//   · la comunidad, un adjunto, el onboarding o el editor leen sin el filtro ·
//     borrar vuelve a ser un `delete` · devolver sin el producto · la purga sin
//     compare-and-set · la purga sin los días · el cron no la corre · los
//     módulos borrados se listan                                              → 7 / 1 cada una
// (El barrido falló primero contra el código BUENO: el tipo genérico de un `leerTodo<{ id: number;
// etapa: string }>` trae un `;` y cortaba ahí la sentencia, y los filtros de un `leerTodo` caen en el
// renglón de abajo. Por eso la sentencia arranca en el nombre de la tabla y se lee hasta el paréntesis.)
// La línea «una marca del futuro no se purga» se sacó del código al romperla: quedaba en verde porque
// una marca del futuro ya cae después del corte. Era una condición sin trabajo.
