// =============================================================================
// La opción de CREAR de un desplegable no desaparece al buscar
// =============================================================================
// Estaba en docs/relevo/crm.md («Lo que quedó sin hacer», 12/10/2026): «El buscador de etiquetas
// con más de 7 esconde "＋ Nueva"». El buscador aparece pasadas las 7 opciones y su filtro
// (`coincide`, app/components/Dropdown.tsx) miraba también el título de la opción de crear
// («Nueva»): escribir el nombre de una etiqueta que no existe la escondía, justo cuando hace falta.
//
// Correr: npx tsx --test tests/dropdown-crear-visible.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (13/10/2026): sacar el `!!o.crear ||` del filtro → 0 pases / 1 fallo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync('app/components/Dropdown.tsx', 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');

test('el filtro del buscador deja pasar siempre la opción de crear', () => {
  const linea = src.split('\n').find((l) => l.includes('const coincide = (o: DropdownOption) =>'));
  assert.ok(linea, 'no encontré el filtro del buscador');
  assert.match(linea!, /=> !!o\.crear \|\|/, 'buscar vuelve a esconder «＋ Nueva»');
});
