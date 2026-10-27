// =============================================================================
// Calendario y Classroom: ninguna inicial se corta por índice (ticket #10, 27/10/2026)
// =============================================================================
// `charAt(0)` y `trim()[0]` toman la primera UNIDAD UTF-16, no el primer carácter: con «🚀 Ana» es media pieza del emoji.
// El HTML del server no puede llevar medio emoji (sale «�») y el navegador sí lo tiene: React ve dos textos distintos y
// tira #418, y la pantalla entera se cae. Pasaba en la lista «Llamadas» de /calendario (la inicial del lead:
// app/calendario/ListaLlamadas.tsx) y en el sello de un programa sin portada del Classroom (app/classroom/ClientsShell.tsx).
// Fija que en esas áreas las iniciales salen de `iniciales` (lib/unicode-seguro.ts) y que no queda ninguna cortada a mano.
// Automations tiene el suyo (tests/automations-iniciales.test.ts); la guarda de toda la app, tests/iniciales-con-emoji.test.ts.
// Correr: node --import tsx --test tests/calendario-classroom-iniciales.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { iniciales } from '../lib/unicode-seguro';

const RAIZ = join(__dirname, '..');
/** Las carpetas del Calendario y del Classroom (el curso, su portal y su comunidad), en escritorio y en el teléfono. */
const AREAS = [
  'app/calendario', 'app/m/calendario', 'app/classroom', 'app/customer-success', 'app/_cursos', 'app/_comunidad',
  'app/compartido/curso', 'app/mi-curso', 'app/conocimientos',
];
/** La primera unidad de un texto recortado: es la forma de sacar una inicial. */
const CORTE = /\.trim\(\)(\[0\]|\.charAt\(0\)|\.slice\(0, ?1\)|\.at\(0\))/;
/** La primera unidad en mayúscula y SOLA (sin el resto pegado detrás, que es poner la mayúscula y no rompe nada). */
const SUELTA = /(\[0\]|\.charAt\(0\)|\.slice\(0, ?1\)|\.at\(0\))\??\.to(?:Locale)?UpperCase\([^)]*\)(?!\s*\+\s*[\w.?]+\.slice\(1\)|\}\$\{[\w.?]+\.slice\(1\)\})/;
const SUELTO = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

function archivos(dir: string, fuera: string[] = []): string[] {
  if (!existsSync(dir)) return fuera;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) archivos(p, fuera);
    else if (/\.tsx?$/.test(n)) fuera.push(p);
  }
  return fuera;
}

test('1. en el Calendario y el Classroom ninguna inicial sale del primer «carácter» por índice', () => {
  const vistos = AREAS.flatMap((a) => archivos(join(RAIZ, a)));
  assert.ok(vistos.length > 50, `el barrido dejó de ver las áreas (vio ${vistos.length})`);
  const malos = vistos.filter((f) => { const s = readFileSync(f, 'utf8'); return CORTE.test(s) || SUELTA.test(s); })
    .map((f) => relative(RAIZ, f).replace(/\\/g, '/'));
  assert.deepEqual(malos, [], 'una inicial cortada por índice: un nombre con emoji rompe la pantalla (React #418). Usa `iniciales` de lib/unicode-seguro.ts');
});

test('2. la fila de «Llamadas» y el sello del programa usan la pieza de la casa', () => {
  const lista = readFileSync(join(RAIZ, 'app/calendario/ListaLlamadas.tsx'), 'utf8');
  assert.match(lista, /import \{ iniciales \} from '@\/lib\/unicode-seguro';/);
  assert.match(lista, /<span className="gl-ini" aria-hidden>\{iniciales\(l\.nombre, 1, '·'\)\}<\/span>/, 'la inicial del lead en «Llamadas»');
  const shell = readFileSync(join(RAIZ, 'app/classroom/ClientsShell.tsx'), 'utf8');
  assert.match(shell, /import \{ iniciales \} from '@\/lib\/unicode-seguro';/);
  assert.match(shell, /\{t\.tapa \|\| t\.fondo \? null : iniciales\(p\.nombre, 1, '·'\)\}/, 'la inicial del sello del programa');
});

test('3. una letra, como antes, y nunca media pieza de un emoji', () => {
  // El lead de prueba del ws3 empieza con un emoji; un programa también puede.
  assert.equal(iniciales('🧪 Lead de prueba', 1, '·'), 'L');
  assert.equal(iniciales('🎸Fiesta Music', 1, '·'), 'F');
  assert.equal(iniciales('ana', 1, '·'), 'A', 'en mayúscula, como el `toUpperCase` de antes');
  assert.equal(iniciales('   ', 1, '·'), '·', 'sin nombre, el punto de antes');
  assert.equal(iniciales('🚀', 1, '·'), '·', 'sólo un emoji: el punto, no media pieza');
  for (const n of ['🧪 Lead', '👩‍💻 Ana', '🇦🇷', '𝐀𝐧𝐚']) assert.doesNotMatch(iniciales(n, 1, '·'), SUELTO, `«${n}» dio medio emoji`);
  // La forma vieja, para que se vea qué se arregló: la primera unidad de «🧪 Lead» ES medio emoji.
  assert.match('🧪 Lead'.trim().charAt(0), SUELTO);
});

// ROTURAS (27/10/2026, una por vez y restaurada; base 3 / 0): la fila de «Llamadas» vuelve a
// `l.nombre.trim().charAt(0).toUpperCase() || '·'` → 1 / 2 (caen 1 y 2); el sello del programa vuelve a
// `(p.nombre.trim()[0] ?? '·').toUpperCase()` → 1 / 2 (caen 1 y 2); una inicial nueva `{nombre.charAt(0).toUpperCase()}` en
// app/_cursos/tipos.ts → 2 / 1 (cae 1).
