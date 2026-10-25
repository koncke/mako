// =============================================================================
// Las iniciales vuelven iguales del HTML del servidor (25/10/2026, ticket #10)
// =============================================================================
// Ticket #10: «La pantalla «CRM» se rompió» en /crm/3445?ws=3, React #418 con «text» (el texto del servidor no coincide
// con el del navegador al hidratar). El lead se llama «🧪 Martín arnés contestó…» (leído en la base): la marca de la
// cabecera tomaba `w[0]`, medio emoji, que el servidor manda como «�». En la pantalla se leía «�M».
//   1. lo que sale de `inicialesPorLetra` pasa por UTF-8 (lo que hace el HTML) y vuelve igual, ejecutado;
//   2. las letras: enteras, sólo letras y números, las dos primeras palabras que tienen;
//   3. las tres que dibujan iniciales en el CRM la usan y ninguna corta con `w[0]`.
// PROBADO ROMPIÉNDOLO: ver el pie.
// Correr: node --import tsx --test tests/iniciales-hidratacion.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inicialesPorLetra } from '../lib/iniciales';

const leer = (r: string) => readFileSync(join(import.meta.dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');
/** Lo que llega al navegador: el servidor escribe el HTML en UTF-8, y medio emoji no se puede escribir. */
const porElHtml = (s: string) => new TextDecoder().decode(new TextEncoder().encode(s));

const NOMBRES = [
  '🧪 Martín arnés contestó H 10-24 06:42', // el del ticket, tal cual está en la base
  '🔥Ana Gómez', '👩‍💻 Sofía', '🇦🇷 Juan Pérez', 'Ana 🧪 Gómez', '🧪', '𝒜na Gómez', '😀😀 😀',
];

test('1. las iniciales pasan por el HTML del servidor y vuelven iguales (si no, React #418)', () => {
  for (const n of NOMBRES) {
    const i = inicialesPorLetra(n);
    assert.equal(porElHtml(i), i, `«${n}» → «${i}»: el servidor mandaría otro texto que el navegador`);
  }
  // El caso del ticket, como estaba: el corte viejo da medio emoji, y el HTML lo cambia.
  const viejo = '🧪 Martín'.split(/\s+/).map((w) => w[0]).join('');
  assert.notEqual(porElHtml(viejo), viejo, 'el test ya no reproduce el ticket');
});

test('2. letras enteras: sólo letras y números, de las dos primeras palabras que tienen', () => {
  assert.equal(inicialesPorLetra('🧪 Martín arnés contestó H 10-24 06:42'), 'MA');
  assert.equal(inicialesPorLetra('Ana Gómez'), 'AG');
  assert.equal(inicialesPorLetra('Juan (ventas)'), 'JV', 'un paréntesis no es una inicial');
  assert.equal(inicialesPorLetra('ñandú'), 'Ñ');
  assert.equal(inicialesPorLetra('ana@x.com'), 'A');
  assert.equal(inicialesPorLetra('🧪'), '?');
  assert.equal(inicialesPorLetra(''), '?');
  assert.equal(inicialesPorLetra(null, '·'), '·');
});

// Desde el 25/10/2026 la regla es UNA (`iniciales`, lib/unicode-seguro.ts, que además barre toda app/:
// tests/iniciales-con-emoji.test.ts): `inicialesPorLetra` la llama, y las tres pantallas usan esa pieza.
test('3. la marca de la ficha, el avatar y el historial usan la misma regla; ninguno corta con `w[0]`', () => {
  assert.match(leer('lib/iniciales.ts'), /export const inicialesPorLetra = \(nombre: string \| null \| undefined, vacio = '\?'\): string => iniciales\(nombre, 2, vacio\);/,
    'una sola pieza: inicialesPorLetra llama a la de lib/unicode-seguro.ts');
  for (const [archivo, uso] of [
    ['app/_components/Marca.tsx', 'const inicialesDe = (nombre: string) => iniciales(nombre);'],
    ['app/_ui/Avatar.tsx', "import { iniciales } from '@/lib/unicode-seguro';"],
    ['app/crm/lead-view/AuditHistory.tsx', 'const initials = (name: string) => iniciales(name);'],
  ] as const) {
    const s = leer(archivo);
    assert.ok(s.includes(uso), `${archivo} no usa la pieza de las iniciales (lib/unicode-seguro.ts)`);
    assert.doesNotMatch(s, /\(w\) => w\[0\]/, `${archivo} vuelve a cortar la primera unidad de UTF-16`);
  }
});

// PROBADO ROMPIÉNDOLO (25/10/2026), contra una base de 3 / 0, de a una y restaurando de una copia:
//   · `inicialesPorLetra` cortando con `[0]` en vez de `[...w][0]` (cae en «𝒜na», letra de dos unidades)  → 2 / 1
//   · sin el `replace` de lo que no es letra ni número (el emoji vuelve a ser inicial)                  → 2 / 1
//   · la marca de vuelta con su `w[0]?.toUpperCase()`                                                   → 2 / 1
