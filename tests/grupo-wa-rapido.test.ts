// =============================================================================
// Cargar los grupos de WhatsApp sin esperar 15 s, y traer de a cuatro (25/10/2026, punto 18)
// =============================================================================
// Martín, textual: «La extracción en grupos de WhatsApp tarda bastante, no solo la extracción, sino también el cargar los
// grupos, tarda muchísimo. Hazlo más rapido, optimizalo.»
// MEDIDO antes de tocar (sólo lectura, la línea de la plataforma): la lista completa de WhatsApp (`fetchAllGroups`) tardó
// 33 s con 285 grupos; el código cortaba a los 15 s y caía a la base de Evolution (0,5 s) con 61. Traer, por los eventos ya
// guardados: ~135 ms por lead, uno detrás del otro (221 leads en 37 s).
//   1. la lista guardada se lee como texto ajeno (`gruposGuardados`, ejecutado);
//   2. el server: rápido (lo guardado, o la base) y completo aparte, guardándolo; la pantalla pide la completa por detrás;
//   3. traer: de a cuatro, y los participantes un rato en memoria entre tandas.
// PROBADO ROMPIÉNDOLO: ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gruposGuardados, TOPE_GRUPOS_COMPLETO_MS, TOPE_GRUPOS_MS } from '../lib/grupo-wa-reglas';

const leer = (r: string) => readFileSync(join(import.meta.dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');

test('1. la lista guardada: ida y vuelta, y lo que no se entiende no vuelve', () => {
  const g = { at: 1_700_000_000_000, grupos: [{ jid: '120363000000000001@g.us', nombre: 'Uno', tamano: 12 }, { jid: '120363000000000002@g.us', nombre: 'Dos', tamano: null }] };
  assert.deepEqual(gruposGuardados(JSON.stringify(g)), g);
  assert.equal(gruposGuardados(null), null);
  assert.equal(gruposGuardados('{roto'), null);
  assert.equal(gruposGuardados(JSON.stringify({ at: 1, grupos: [] })), null, 'una lista vacía no es una lista');
  assert.deepEqual(gruposGuardados(JSON.stringify({ at: 1, grupos: [{ jid: 'no-es-un-grupo', nombre: 'x' }, g.grupos[0]] }))?.grupos, [g.grupos[0]]);
  assert.ok(TOPE_GRUPOS_COMPLETO_MS > 33_000, 'la completa tiene que alcanzar los 33 s medidos');
  assert.ok(TOPE_GRUPOS_MS <= 15_000);
});

test('2. rápido primero (lo guardado o la base) y la completa aparte, guardada; la pantalla la pide por detrás', () => {
  const s = leer('app/crm/grupo-wa-server.ts');
  assert.match(s, /const guardada = gruposGuardados\(await getSetting\(claveGrupos\(l\.linea\)\)\.catch\(\(\) => null\)\);/);
  assert.match(s, /await setSetting\(claveGrupos\(l\.linea\), JSON\.stringify\(\{ at: Date\.now\(\), grupos \}\)\)/, 'la completa no se guarda');
  assert.match(s, /ev\(`\/group\/fetchAllGroups\/\$\{inst\}\?getParticipants=false`, TOPE_GRUPOS_COMPLETO_MS\)/);
  const p = leer('app/crm/TraerDeGrupoWA.tsx');
  assert.match(p, /if \(!r\.refrescar\) return;\s*setBuscandoTodos\(true\);\s*void gruposDeLineaAction\(linea, true\)/, 'la pantalla no pide la completa');
});

test('3. traer de a cuatro, y los participantes en memoria entre tandas', () => {
  const s = leer('app/crm/grupo-wa-server.ts');
  assert.match(s, /const PARALELO = 4;/);
  assert.match(s, /await Promise\.all\(quienes\.slice\(i, i \+ PARALELO\)\.map\(uno\)\);/);
  assert.match(s, /if \(!fresco && ya && ya\.hasta > Date\.now\(\)\) return ya\.v;/);
  assert.match(s, /participantesDelGrupo\(p\.linea, p\.jid, true\);/, '«Completar nombres» lee fresco');
});

// PROBADO ROMPIÉNDOLO (25/10/2026), contra una base de 3 / 0, de a una y restaurando de una copia:
//   · `gruposGuardados` aceptando un jid que no es de grupo                                → 2 / 1
//   · la completa sin `setSetting` (no se guarda)                                           → 2 / 1
//   · traer de a uno (el `Promise.all` cambiado por un for)                                → 2 / 1
