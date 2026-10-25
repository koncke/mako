// =============================================================================
// El editor del CRM (la ficha personalizándose): MaKo como bloque flotante, y sacar un dato desde su fila (24/10/2026)
// =============================================================================
// Martín, textual (punto 12 del 24/10): «En el editor del CRM no me gusta que MaKo sea un cuadrado, cuando ya lo venimos
// haciendo tipo bloque flotante con cuadros un poco redondeados... Unifica ese diseño. Y aún no hiciste que se pueda editar
// cada cosa, por ejemplo en el bloque de "Contacto" no puedo sacar EMPRESA, y en general debes revisas que todo sea
// editable...» (captura c06: «Editar con MaKo» como panel cuadrado pegado a la izquierda, con una raya de color arriba; el
// bloque Contacto elegido, con «Datos ▾» en su barra y las filas Teléfono/Email/Empresa sin nada para sacarlas).
//   1. la regla de la ✕ (`datosSinUno`, ejecutada): sale el dato, nunca el último;
//   2. cada fila de los bloques que eligen sus datos o sus redes está marcada, y el Armador dibuja la ✕ en el elegido;
//   3. el panel de MaKo de la ficha es el bloque flotante del Dashboard (aire, bordes redondeados, sombra; sin la raya).
// PROBADO ROMPIÉNDOLO: ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { datosSinUno } from '../app/crm/lead-view/ficha/armar';

const leer = (r: string) => readFileSync(join(import.meta.dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');

test('1. la ✕ saca ese dato; el último no se saca (para no tenerlo, se quita el bloque)', () => {
  assert.deepEqual(datosSinUno(['telefono', 'email', 'empresa'], 'empresa'), ['telefono', 'email']);
  assert.equal(datosSinUno(['telefono'], 'telefono'), null, 'el último');
  assert.equal(datosSinUno(['telefono', 'email'], 'web'), null, 'uno que no está');
});

test('2. las filas marcadas, y la ✕ en el bloque elegido con la MISMA operación que «Datos ▾»', () => {
  const c = leer('app/crm/lead-view/ficha/resumen/contacto.tsx');
  for (const d of ['telefono', 'email', 'empresa']) assert.match(c, new RegExp(`<Prop k="[^"]+" dato="${d}"`), `la fila ${d} no está marcada`);
  assert.match(c, /<Prop key=\{x\} k=\{NOMBRE_EXTRA\[x\]\} dato=\{x\}/, 'las redes y la dirección del contacto');
  assert.match(c, /<DatoEnChip key=\{k\} dato=\{k\}/, 'el diseño en renglón (chips)');
  assert.match(c, /<Prop key=\{r\} k=\{NOMBRE_RED\[r\]\} dato=\{r\}/, '«Redes y web»');
  assert.match(leer('app/crm/lead-view/ficha/resumen/piezas.tsx'), /<div className="fr-prop" data-dato=\{dato\} data-dato-nombre=\{dato \? k : undefined\}>/);
  assert.match(leer('app/crm/lead-view/ficha/resumen/datos.tsx'), /dato=\{c\}/, 'setter y closer');
  const a = leer('app/crm/lead-view/ficha/Armador.tsx');
  assert.match(a, /\{elegido && \(b\.def\.datos \|\| b\.def\.opciones\?\.includes\('redes'\)\) && \(\s*<QuitarDeLaFila/);
  assert.match(a, /onCambio\(\{ op: 'opciones', tab, bloque: b\.def\.id, n: b\.n, opciones: redes \? \{ redes: quedan as Red\[\] \} : \{ datos: quedan \} \}\)/);
  assert.match(a, /querySelectorAll<HTMLElement>\('\[data-dato\]'\)/);
  assert.match(leer('app/crm/lead-view/ficha/ficha-css.ts'), /\.fb-quitar-dato \{ position: absolute; z-index: 3;/, 'la ✕ queda debajo del cuerpo inerte');
});

test('3. el panel de MaKo de la ficha flota: aire, bordes de 14, sombra, y sin la raya de color', () => {
  const f = leer('app/crm/lead-view/ficha/FichaPorBloques.tsx');
  assert.match(f, /\.fb-mako-panel\{position:fixed;top:12px;left:12px;bottom:12px;/);
  assert.match(f, /border-radius:14px;box-shadow:0 18px 44px rgba\(18,21,27,\.18\)/, 'el mismo marco que `.an` del Dashboard');
  assert.doesNotMatch(f, /borderTop: '3px solid var\(--mako\)'/, 'volvió la raya de color del cuadrado');
  assert.match(leer('app/dashboard/PanelAnalista.tsx'), /border-radius: 14px;\s*box-shadow: 0 18px 44px rgba\(18,21,27,\.18\)/, 'el del Dashboard cambió: unificar de nuevo');
});

// PROBADO ROMPIÉNDOLO (25/10/2026), contra una base de 3 / 0, de a una y restaurando de una copia:
//   · `datosSinUno` (./armar.ts) dejando sacar el último (`hoy.length < 1`)                         → 2 / 1
//   · la fila «Empresa» sin `dato`                                                      → 2 / 1
//   · el panel volviendo a `top:0;left:0;bottom:0`                                      → 2 / 1
