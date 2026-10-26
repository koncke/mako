// =============================================================================
// El nombre del negocio lo cambia su admin, en el PERFIL (21/10/2026)
// =============================================================================
// Florencia (ws21) no podía cambiarlo en ningún lado: el onboarding del 18/10 le guardó «mi marca personal: Florencia
// Ayelen Carballo», y General (/configuraciones) es sólo del super admin. lib/nombre-negocio.ts (la regla) y
// app/configuraciones/negocio-actions.ts (el guardado). La fila del perfil la fija tests/nombre-negocio-perfil.test.ts.
// «Tu negocio» fue una sección de Configuraciones unas horas: Martín pidió quitarla (21/10), el nombre vive en el perfil
// y /configuraciones/negocio lleva al perfil.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { limpiarNombreNegocio, NOMBRE_NEGOCIO_MAX } from '../lib/nombre-negocio';
import { seccionesNegocio } from '../lib/ajustes-secciones';

const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('la regla: limpio, con letras y con tope', () => {
  assert.deepEqual(limpiarNombreNegocio('  Florencia   Ayelen Carballo '), { ok: true, nombre: 'Florencia Ayelen Carballo' });
  for (const malo of ['', ' ', 'a', '123', null, 42]) assert.equal(limpiarNombreNegocio(malo).ok, false, JSON.stringify(malo));
  assert.equal(limpiarNombreNegocio('x'.repeat(NOMBRE_NEGOCIO_MAX + 1)).ok, false);
  assert.equal(limpiarNombreNegocio('x'.repeat(NOMBRE_NEGOCIO_MAX)).ok, true);
});

test('«Tu negocio» ya no es una sección de Configuraciones: el nombre se cambia en el perfil (Martín, 21/10/2026)', () => {
  for (const quien of [{ integraciones: false, plan: true }, { integraciones: true, plan: true }]) {
    assert.ok(!seccionesNegocio(quien).some((s) => s.key === 'negocio'), 'volvió la sección «Tu negocio»');
  }
  assert.match(sinComentarios(leer('app/configuraciones/negocio/page.tsx')), /redirect\('\/perfil'\)/, 'la dirección vieja no lleva al perfil');
});

test('lo guarda sólo el admin del negocio, en workspaces.nombre, y se vuelve a dibujar la app', () => {
  const acc = sinComentarios(leer('app/configuraciones/negocio-actions.ts'));
  assert.match(acc, /if \(rol !== 'admin'\) return \{ ok: false/, 'cualquiera del equipo cambiaba el nombre');
  assert.match(acc, /const r = limpiarNombreNegocio\(crudo\);\n\s*if \(!r\.ok\) return r;/, 'se guardaba sin validar');
  assert.match(acc, /await actualizarWorkspace\(ws, \{ nombre: r\.nombre \}\);/);
  assert.match(acc, /revalidatePath\('\/', 'layout'\);/, 'la tarjeta y el encabezado seguían con el nombre viejo');
  assert.match(acc, /puedeEditar: rol === 'admin' && ws != null/);
});
