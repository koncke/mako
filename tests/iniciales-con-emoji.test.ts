// =============================================================================
// Las iniciales de un avatar, UNA pieza (lib/unicode-seguro.ts → iniciales), sin medio emoji (25/10/2026)
// =============================================================================
// Lo vio Automations: un nombre que empieza con un emoji («🚀 Martín») dibujaba «�M» en el avatar. Cada pantalla tenía su
// copia con `w[0]` / `charAt(0)` / `slice(0, 1)`, que toman la primera UNIDAD UTF-16 (la mitad de un emoji). Esto fija:
//   1. la pieza: la primera letra o número de cada palabra, saltando emojis y símbolos, nunca una mitad;
//   2. la guarda: ninguna pantalla vuelve a sacar iniciales a mano con el primer «carácter» de cada palabra.
//
// PROBADO ROMPIÉNDOLO (25/10/2026, base 2/0): la pieza con `palabra[0]` → 1 rojo (1); una copia vieja de vuelta en
// app/_ui/Avatar.tsx → 1 rojo (2).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { iniciales } from '../lib/unicode-seguro';

const RAIZ = join(__dirname, '..');
const SUELTO = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

test('1. la primera letra de cada palabra, saltando emojis y símbolos; nunca medio emoji', () => {
  assert.equal(iniciales('🚀 Martín Koncke'), 'MK', 'el emoji suelto adelante no es una palabra con letra');
  assert.equal(iniciales('😀Ana'), 'A', 'pegado a la palabra: se saltea');
  assert.equal(iniciales('ana maría lópez'), 'AM', 'dos, como siempre');
  assert.equal(iniciales('élida ñandú'), 'ÉÑ');
  assert.equal(iniciales('Ana'), 'A');
  assert.equal(iniciales('🚀'), '?', 'sin ninguna letra: lo de sin nada');
  assert.equal(iniciales('   ', 2, '·'), '·');
  assert.equal(iniciales(null), '?');
  assert.equal(iniciales('Martín', 1, 'T'), 'M');
  assert.equal(iniciales('3er Piso'), '3P', 'un número también es inicial');
  for (const n of ['🚀 Martín', '👩‍💻Ana Torres', '🇦🇷 Equipo', '𝐀𝐧𝐚 B', '#1 Ventas']) {
    assert.doesNotMatch(iniciales(n), SUELTO, `«${n}» dio medio emoji`);
  }
});

function archivos(dir: string, fuera: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (n !== 'node_modules' && n !== '_opencut') archivos(p, fuera); } else if (/\.tsx?$/.test(n)) fuera.push(p);
  }
  return fuera;
}

test('2. ninguna pantalla saca las iniciales a mano con el primer «carácter» de cada palabra', () => {
  // Las formas de las copias viejas: `.map((w) => w[0]…)` sobre un `split(/\s+/)`, y `${p[0][0]}${p[1][0]}`.
  const VIEJAS = [/split\(\/\\s\+\/\)[^;\n]*\.map\(\((\w+)\) => \1\[0\]/, /\$\{(\w+)\[0\]\[0\]\}\$\{\1\[1\]\[0\]\}/, /\(\(\w+\[0\]\?\.\[0\] \|\| ''\) \+ \(\w+\[1\]\?\.\[0\]/];
  const malos: string[] = [];
  for (const f of archivos(join(RAIZ, 'app'))) {
    const src = readFileSync(f, 'utf8');
    if (VIEJAS.some((re) => re.test(src))) malos.push(relative(RAIZ, f).replace(/\\/g, '/'));
  }
  assert.deepEqual(malos, [], 'iniciales a mano: usa `iniciales` de lib/unicode-seguro.ts (un nombre con emoji dibuja «�»)');
});

/**
 * 3. LA INICIAL DE UNA SOLA LETRA, que es por donde se escapó dos veces (6/11/2026).
 *
 * El caso 2 busca las formas de MUCHAS palabras (`split` + `map`). Una inicial de UNA letra
 * —`nombre.charAt(0).toUpperCase()`— no tiene esa forma, así que pasaba. Y cuesta la pantalla entera:
 * el HTML del server no puede llevar media pieza de emoji («�»), el navegador sí la tiene, y React
 * tira el árbol al hidratar con un #418. Pasó en /calendario (ticket #10, 27/10) y en el CRM
 * (ticket #39, 1/11). El 6/11 seguía vivo en los TRES lugares de Competitors Spy, donde los nombres
 * vienen de Instagram y el emoji en el nombre es la norma.
 *
 * ⚠️ LO QUE NO SE MARCA: poner la mayúscula a una palabra conocida
 * (`charAt(0).toUpperCase() + x.slice(1)`) conserva el resto, así que no corta nada. Por eso la
 * línea con `slice(1)` queda afuera: lo peligroso es tomar la primera unidad y TIRAR el resto.
 *
 * ⚠️ `_opencut`, `_doory` y `_polar` son ports de código ajeno y van afuera, como ya hacía el
 * recorrido de archivos. `_polar` además limpia todo lo que no sea `[a-zA-Z ]` antes de indexar,
 * así que su `charAt(0)` no puede partir un emoji: no es un falso negativo, es que no aplica.
 *
 * PROBADO ROMPIÉNDOLO (6/11/2026): devolver `charAt(0).toUpperCase()` en el `inicial` de
 * app/competitor-spy/SpyApp.tsx da 1 rojo con ese archivo nombrado; dejarlo con `iniciales`, verde.
 */
test('3. ni la inicial de UNA letra: la primera unidad UTF-16 puede ser media pieza de emoji', () => {
  const PELIGRO = /(?:\.charAt\(0\)|\.slice\(0, ?1\)|\[0\])\s*\.toUpperCase\(\)/;
  const CONSERVA_EL_RESTO = /slice\(1\)/;
  const PORTADO = /[/\\]_(?:opencut|doory|polar)[/\\]/;
  const malos: string[] = [];
  for (const f of archivos(join(RAIZ, 'app'))) {
    if (PORTADO.test(f)) continue;
    const rel = relative(RAIZ, f).replace(/\\/g, '/');
    readFileSync(f, 'utf8').split('\n').forEach((linea, i) => {
      if (PELIGRO.test(linea) && !CONSERVA_EL_RESTO.test(linea)) malos.push(`${rel}:${i + 1}`);
    });
  }
  assert.deepEqual(malos, [], 'la inicial sale de `iniciales(nombre, 1, …)` de lib/unicode-seguro.ts: `charAt(0)` de «🔥 Alex» es media pieza del emoji y tira la pantalla al hidratar (#418)');
});

/**
 * 4. LAS FORMAS QUE SE ESCAPABAN DE LOS CASOS 2 Y 3 (18/11/2026, O14 de docs/pendientes-verificados-17-11.md).
 *
 * El 3 busca el índice PEGADO a `.toUpperCase()`. Una inicial con su respaldo (`(x.trim()[0] ?? '?').toUpperCase()`, la de
 * app/_components/ServicioVisual.tsx) o la primera y la última palabra armadas con `+` (`partes[0][0] + partes[partes.length - 1][0]`,
 * la del avatar del TELÉFONO, app/m/_ui/formato.ts, que se dibuja en el server en la barra de cada pantalla de /m) no tienen esa
 * forma, así que pasaban. Tres seguían vivas ese día: el avatar del teléfono, la tarjeta del kanban (lib/tarjeta-kanban.ts, la de
 * CRM, Clients y Plan) y la lista de quién ve un curso compartido (app/conocimientos/Compartir.tsx). Y `lib/` no se miraba.
 *
 * ⚠️ LO QUE NO SE MARCA: `[...x][0]` y `Array.from(x)` cortan por punto de código (no dejan media letra), y `.match(…)?.[0]` es lo
 * que encontró una regex con la bandera `u`. Por eso las formas son estas cuatro y no «todo `[0]` cerca de una mayúscula», que
 * marcaba las coordenadas de un gráfico (`pts[0][0]`) y los datos de una muestra (`GANADORES[0][0]`).
 *
 * PROBADO ROMPIÉNDOLO: ver el pie del caso.
 */
test('4. ni la primera unidad con un respaldo, ni la primera y la última palabra por unidad, en app/ (con /m) y lib/', () => {
  const FORMAS = [
    /\.trim\(\)\[0\]/, // la primera unidad de un texto recortado
    /\(\s*\w+\[0\]\s*(?:\?\?|\|\|)\s*'[^']*'\s*\)\s*\.toUpperCase\(\)/, // `(nm[0] || '·').toUpperCase()`
    /(\w+)\[0\](?:\?\.)?\[0\][^;\n]*\1\[\1\.length - 1\]\[0\]/, // la primera unidad de la primera y de la última palabra
    /\w\[0\]\??\.slice\(0, ?2\)/, // las dos primeras unidades de una palabra
  ];
  const PORTADO = /[/\\]_(?:opencut|doory|polar)[/\\]/;
  const mirados: string[] = [];
  const malos: string[] = [];
  for (const base of ['app', 'lib']) {
    for (const f of archivos(join(RAIZ, base))) {
      if (PORTADO.test(f)) continue;
      const rel = relative(RAIZ, f).replace(/\\/g, '/');
      mirados.push(rel);
      readFileSync(f, 'utf8').split('\n').forEach((linea, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(linea)) return;
        if (FORMAS.some((re) => re.test(linea))) malos.push(`${rel}:${i + 1}`);
      });
    }
  }
  // El denominador: el barrido mira el teléfono y lib/ (un cero sin esto no dice nada).
  for (const f of ['app/m/_ui/formato.ts', 'app/m/layout.tsx', 'lib/tarjeta-kanban.ts', 'lib/unicode-seguro.ts']) {
    assert.ok(mirados.includes(f), `el barrido no miró ${f}`);
  }
  assert.deepEqual(malos, [], 'iniciales por unidad UTF-16: usa `iniciales` de lib/unicode-seguro.ts (o `Array.from`): media letra en el HTML del server tira la pantalla al hidratar (#418)');
});
// PROBADO ROMPIÉNDOLO el caso 4 (18/11/2026, base 4/0), de a una y restaurado: `inicialesM` de vuelta a su forma vieja
// (app/m/_ui/formato.ts) → 3 / 1; `iconFor` con `(k.trim()[0] ?? '?').toUpperCase()` → 3 / 1; `inicialesDe` del kanban con
// `palabras[0].slice(0, 2)` → 3 / 1.
