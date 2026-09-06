// =============================================================================
// Un prop que la pantalla no dibuja es un botón que no existe
// =============================================================================
// `pantalla({ … })` destructura una lista fija de campos. Todo lo que se le pase de
// más se acepta sin chistar —JavaScript no se queja de una propiedad extra— y NO SE
// DIBUJA. El resultado es una pantalla a la que le falta el botón que la línea de
// arriba dice que tiene.
//
// ⚠️ ESTE TEST EXISTE PORQUE PASÓ MIENTRAS SE ESCRIBÍA EL BOTÓN DE PROBAR: se pasó
// `secundaria` / `accionSecundaria` y los nombres reales son `boton2` / `accion2`.
// Sin este test, la pantalla habría salido con un solo botón y nadie lo habría
// notado hasta abrirla.
//
// Es la misma familia que el repo ya tiene escrita —«escribir la salida no es
// ofrecerla»— en su forma más barata de cazar: la lista de campos válidos está a la
// vista, en la firma de la función.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const popup = readFileSync(
  resolve(import.meta.dirname, '..', 'extension', 'popup.js'), 'utf8',
);

/** Los campos que `pantalla` sabe dibujar, leídos de su firma. */
function camposQueDibuja(): string[] {
  const m = /function pantalla\(\{([^}]*)\}\)/.exec(popup);
  assert.ok(m, 'no encontré la firma de `pantalla`');
  return m[1].split(',').map((x) => x.trim()).filter(Boolean);
}

/** Los campos que cada llamada le pasa. */
function camposQuePasan(): { campo: string; contexto: string }[] {
  const sinComentarios = popup
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const out: { campo: string; contexto: string }[] = [];
  for (const m of sinComentarios.matchAll(/pantalla\(\{([\s\S]*?)\n\s*\}\)/g)) {
    const bloque = m[1];
    for (const c of bloque.matchAll(/^\s*([a-zA-Z_$][\w$]*)\s*:/gm)) {
      out.push({ campo: c[1], contexto: bloque.slice(0, 60).replace(/\s+/g, ' ') });
    }
  }
  return out;
}

test('toda llamada a `pantalla` usa campos que la pantalla dibuja', () => {
  const dibuja = new Set(camposQueDibuja());
  assert.ok(dibuja.size >= 5, 'la firma de `pantalla` se leyó mal');

  const invalidos = camposQuePasan().filter((x) => !dibuja.has(x.campo));
  assert.deepEqual(
    invalidos.map((x) => `${x.campo}  (en «${x.contexto}…»)`), [],
    'Estos campos se le pasan a `pantalla` y NO se dibujan:\n\n'
    + '  ' + invalidos.map((x) => x.campo).join(', ') + '\n\n'
    + 'JavaScript acepta una propiedad de más sin quejarse, así que la pantalla sale\n'
    + 'con un botón menos y nadie lo nota hasta abrirla.\n\n'
    + 'Los que sí dibuja: ' + [...dibuja].join(', '),
  );
});

test('toda acción tiene su rótulo, y todo rótulo su acción', () => {
  // Un `boton` sin `accion` es un botón muerto; una `accion` sin `boton` es una
  // acción que nadie puede disparar. Las dos se leen como una pantalla rota.
  const sinComentarios = popup
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const fallos: string[] = [];
  for (const m of sinComentarios.matchAll(/pantalla\(\{([\s\S]*?)\n\s*\}\)/g)) {
    const b = m[1];
    const ctx = b.slice(0, 60).replace(/\s+/g, ' ');
    const tiene = (c: string) => new RegExp(`^\\s*${c}\\s*:`, 'm').test(b);
    if (tiene('boton') !== tiene('accion')) fallos.push(`«${ctx}…» → boton/accion desparejos`);
    if (tiene('boton2') !== tiene('accion2')) fallos.push(`«${ctx}…» → boton2/accion2 desparejos`);
  }
  assert.deepEqual(fallos, [], 'Botones sin acción o acciones sin botón:\n  ' + fallos.join('\n  '));
});
