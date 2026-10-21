// =============================================================================
// El nombre del negocio lo cambia su admin, en Configuración del negocio › Tu negocio (21/10/2026)
// =============================================================================
// Florencia (ws21) no podía cambiarlo en ningún lado: el onboarding del 18/10 le guardó «mi marca personal: Florencia
// Ayelen Carballo», y General (/configuraciones) es sólo del super admin. lib/nombre-negocio.ts (la regla),
// app/configuraciones/negocio-actions.ts (el guardado), NombreNegocioPanel.tsx y /configuraciones/negocio.
//
// ROTURAS: ver el final del archivo.
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

test('«Tu negocio» la ve todo el negocio, no sólo el super admin', () => {
  const cliente = seccionesNegocio({ general: false, integraciones: false, metodo: false, plan: true });
  assert.equal(cliente[0]?.key, 'negocio', 'un cliente no ve dónde cambiar el nombre');
  assert.equal(cliente[0]?.href, '/configuraciones/negocio');
  const pagina = sinComentarios(leer('app/configuraciones/negocio/page.tsx'));
  assert.match(pagina, /await requireRolWs\(\[\], \{ nav: 'configuraciones' \}\);/);
  assert.match(pagina, /activa="negocio"/);
  assert.match(pagina, /<NombreNegocioPanel \/>/);
});

test('lo guarda sólo el admin del negocio, en workspaces.nombre, y se vuelve a dibujar la app', () => {
  const acc = sinComentarios(leer('app/configuraciones/negocio-actions.ts'));
  assert.match(acc, /if \(rol !== 'admin'\) return \{ ok: false/, 'cualquiera del equipo cambiaba el nombre');
  assert.match(acc, /const r = limpiarNombreNegocio\(crudo\);\n\s*if \(!r\.ok\) return r;/, 'se guardaba sin validar');
  assert.match(acc, /await actualizarWorkspace\(ws, \{ nombre: r\.nombre \}\);/);
  assert.match(acc, /revalidatePath\('\/', 'layout'\);/, 'la tarjeta y el encabezado seguían con el nombre viejo');
  assert.match(acc, /puedeEditar: rol === 'admin' && ws != null/);
});

test('en el teléfono, la MISMA lectura y el MISMO guardado (Florencia puede cambiarlo desde el celular)', () => {
  const pagina = sinComentarios(leer('app/m/configuraciones/negocio/page.tsx'));
  assert.match(pagina, /requireMovil\(\{ navKey: 'configuraciones' \}\)/);
  assert.match(pagina, /await nombreDelNegocioAction\(\)/);
  const cliente = sinComentarios(leer('app/m/configuraciones/negocio/NegocioM.tsx'));
  assert.match(cliente, /await guardarNombreNegocioAction\(nombre\)/, 'el teléfono guarda por otro lado');
  assert.match(cliente, /readOnly=\{!leido\.puedeEditar\}/, 'alguien del equipo que no es admin ve un campo que no guarda');
});

// ROTURAS (21/10/2026, romper.js + roturas-nombre.json del scratchpad; con ajustes-cuenta-negocio; base 11/0), 5 de 5:
// cualquiera del equipo lo cambia → 10/1 · sin validar → 10/1 · un nombre sin letras pasa → 10/1 · sin volver a dibujar
// la app → 10/1 · la sección sólo para el super admin → 9/2.
// Y el teléfono (roturas-movil.json, con m-configuraciones; base 10/0), 2 de 2: sin su pantalla en `SECCIONES_NEGOCIO_M`
// → 9/1 · el campo editable para quien no es admin → 9/1.
