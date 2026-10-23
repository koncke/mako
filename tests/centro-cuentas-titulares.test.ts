// =============================================================================
// La G del 17/10/2026: cada cuenta del Uso con su NOMBRE (editable) y su email, el logo de Claude, y sin los avisos que
// se repetían aunque el Runner anduviera
// =============================================================================
// Martín: «"Cuenta 1" trae su NOMBRE, editable, y debajo el email de esa cuenta»; fuera «Abre su Runner…» y los botones
// «Runners» / «Nuevo Runner». El titular sale de ~/.claude/cuentas.tsv de la PC (cartero 1.15.2 → titularDe), MaKo lo
// guarda en `operaciones.cuentas` (lib/centro-titulares-db.ts) y el nombre que pone Martín gana (`alias`).
//
// Probado ROMPIÉNDOLO (17/10/2026, base en 5 pases): `titularDe` leyendo el renglón de OTRA cuenta (el primero) → 1 fallo;
// `nombreDeLaCuenta` con el titular antes que el alias → 1 fallo; la acción del alias sin `puedeOperar` → 1 fallo; el
// aviso «Abre su Runner…» de vuelta en el Uso → 1 fallo; `cicloCartero` sin guardar el titular → 1 fallo.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { aliasValido, nombreDeLaCuenta, sanearCuentasConNombre, titularDeRenglon } from '../lib/centro-titulares';
import { ListaUso } from '../app/admin/operaciones/Uso';
import { cuentasDeUso } from '../lib/centro-uso';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const TSV = '# cuenta<TAB>titular\nclaude1\tMauricio Ejemplo <dueno@negocio-uno.com>\nclaude2\tLeandro Ejemplo <ejemplo.colaborador.mako@gmail.com>\nclaude3\tSólo un nombre\n';

test('la PC sube el titular de SU cuenta (nombre y email), con el mismo molde que MaKo', async () => {
  const { titularDe } = await import('../scripts/operaciones/cartero.mjs');
  assert.deepEqual(titularDe('claude2', TSV), { nombre: 'Leandro Ejemplo', email: 'ejemplo.colaborador.mako@gmail.com' });
  assert.deepEqual(titularDe('claude3', TSV), { nombre: 'Sólo un nombre', email: null });
  assert.equal(titularDe('claude4', TSV), null, 'sin renglón, nada (MaKo dice «Cuenta 4»)');
  assert.deepEqual(titularDe('claude1', TSV), titularDeRenglon('Mauricio Ejemplo <dueno@negocio-uno.com>'));
});

test('el nombre: el que puso Martín, si no el titular, si no «Cuenta N»; lo guardado se sanea', () => {
  assert.equal(nombreDeLaCuenta('claude2', { nombre: 'Leandro Ejemplo', email: null, alias: 'Leandro 2' }), 'Leandro 2');
  assert.equal(nombreDeLaCuenta('claude2', { nombre: 'Leandro Ejemplo', email: null, alias: null }), 'Leandro Ejemplo');
  assert.equal(nombreDeLaCuenta('claude3', null), 'Cuenta 3');
  assert.deepEqual(aliasValido('  '), { ok: true, alias: null }, 'vacío vuelve al del titular');
  assert.equal(aliasValido('x'.repeat(41)).ok, false);
  assert.deepEqual(sanearCuentasConNombre({ claude1: { nombre: 'A', email: 'no es mail', alias: 'B' }, otra: { nombre: 'X' } }), { claude1: { nombre: 'A', email: null, alias: 'B' } });
});

test('el Uso: logo de Claude, el nombre con su lápiz y el email debajo; sin «Abre su Runner…» ni los botones de Runners', () => {
  const cuentas = cuentasDeUso([{ cuenta: 'claude2', vistoAt: null, cuota: null }]).map((c) => ({
    ...c, titular: c.cuenta === 'claude2' ? { nombre: 'Leandro Ejemplo', email: 'ejemplo.colaborador.mako@gmail.com', alias: null } : null,
  }));
  const h = renderToStaticMarkup(createElement(ListaUso, { cuentas, ahora: Date.UTC(2026, 9, 17, 18), onRenombrar: async () => null }));
  assert.match(h, /aria-label="Claude"/);
  assert.match(h, /Leandro Ejemplo/);
  assert.match(h, /ejemplo\.colaborador\.mako@gmail\.com/);
  assert.match(h, /aria-label="Renombrar Leandro Ejemplo"/);
  const uso = leer('app/admin/operaciones/Uso.tsx').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(uso, /Abre su Runner|Nuevo Runner|>Runners</);
  assert.doesNotMatch(leer('app/m/operaciones/RunnerMovil.tsx'), /'Abre su Runner/);
});

test('el alias pasa por `puedeOperar`, y la vuelta del cartero guarda el titular', () => {
  const acc = leer('app/admin/operaciones/acciones.ts');
  const cuerpo = acc.slice(acc.indexOf('export async function guardarAliasCuentaAction'));
  assert.match(cuerpo.slice(0, 500), /getSesionAdmin\(\);[\s\S]{0,40}puedeOperar/);
  const ciclo = leer('lib/operaciones.ts');
  const c = ciclo.slice(ciclo.indexOf('export async function cicloCartero'));
  assert.match(c.slice(0, 2500), /guardarTitular\(cuenta, e\.titular\)/);
  assert.doesNotMatch(leer('lib/centro-titulares-db.ts'), /node:fs|writeFile/, 'MaKo no escribe cuentas.tsv');
});
