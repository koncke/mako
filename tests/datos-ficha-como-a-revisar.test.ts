// =============================================================================
// El «Ver» de datos sin marcar de la ficha tiene la MISMA fila que «A revisar»
// =============================================================================
// Feedback de Martín del 16/10/2026, punto 6 del CRM: «El desplegable en el detail del lead, de datos sin marcar
// debería ser igual que en todo el CRM... Solo que en lugar de foto de perfil del lead, un ícono del bloque que falta
// marcar». La fila de «A revisar» vive en app/_components/MakoConfirmGate.tsx; ésta, en
// app/crm/lead-view/DatosSinMarcarCard.tsx.
//
// Correr: node --import tsx --test tests/datos-ficha-como-a-revisar.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (16/10/2026, base 2/0): volver al lápiz para completar → 1 / 1; volver al ícono de silenciar
// para ignorar → 1 / 1; sacar el ícono del bloque de la fila → 1 / 1; la primera fila con raya → 1 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const card = readFileSync('app/crm/lead-view/DatosSinMarcarCard.tsx', 'utf8').replace(/\r\n/g, '\n');
const filaDe = (src: string) => src.slice(src.indexOf('  const fila = (d: DatoDeLaFicha, i: number) => {'), src.indexOf('  const visibles = '));

test('la fila: el ícono del bloque, el basurero rojo y la flecha azul, sin raya la primera', () => {
  const fila = filaDe(card);
  assert.ok(fila.length > 400, 'no encontré la fila');
  assert.match(fila, /<IconoMenu nombre=\{ICONO_DATO\[d\.id\]\} size=\{15\} \/>/, 'sin el ícono del bloque');
  assert.match(fila, /style=\{ignorarBtn\} onClick=\{\(\) => onIgnorar\(d\.id, true\)\}[\s\S]{0,160}<IconoMenu nombre="borrar"/);
  assert.match(fila, /style=\{completarBtn\} onClick=\{\(\) => onSolucionar\(d\.id\)\}[\s\S]{0,160}<IconoMenu nombre="mover"/);
  assert.match(fila, /borderTop: i === 0 \? 'none' : '1px solid var\(--border\)'/);
  assert.doesNotMatch(fila, /nombre="editar"|nombre="silenciar"/, 'volvió el lápiz o el silenciar');
});

test('cada dato tiene su ícono (un Record: uno nuevo sin ícono no compila) y los botones son los de «A revisar»', () => {
  assert.match(card, /const ICONO_DATO: Record<StepId, NombreIconoMenu> = \{/);
  assert.match(card, /const ignorarBtn: CSSProperties = \{ \.\.\.iconoBtn, color: 'var\(--bad\)'/);
  assert.match(card, /const completarBtn: CSSProperties = \{ \.\.\.iconoBtn, border: 'none', background: 'var\(--primary\)', color: '#fff' \};/);
});
