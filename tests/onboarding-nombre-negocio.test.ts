// =============================================================================
// El nombre del negocio se entiende y se CONFIRMA antes de escribirlo (20/10/2026)
// =============================================================================
// Florencia (ws21, 18/10): escribió «mi marca personal: Florencia Ayelen Carballo» y eso quedó TAL CUAL como nombre del
// workspace, del funnel principal, del producto («Oferta de mi marca personal: …»), del PDF y de su archivo en El
// Archivero. `extraerNegocio` sólo quitaba «se llama/es» del principio, y nadie preguntaba. Y el nombre del alta, que
// habría servido, no se ofrecía desde 12ad33b25 (por el ws de prueba, cuyo problema era el RESET).
// docs/hallazgos-onboarding.md, «Florencia (ws21, 18/10)».
//
// ROTURAS (20/10/2026, arnés romper.js + roturas-negocio.json del scratchpad; base 5/0): sin entender «mi marca
// personal» (con guion) → 4/1 · sin confirmar → 3/2 · sin el nombre del alta → 4/1 · el ws de prueba ofrece su nombre → 4/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  NEGOCIO_CONFIRMAR, extraerNegocio, leerNegocio, leerRespuesta, mensajesDeArranque,
  type EstadoArranque, type HechosArranque,
} from '../lib/onboarding-arranque';

const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: 'Florencia Ayelen Carballo', nombreWorkspace: 'Consultora Argentina', faseGuardada: false,
  canalNegocio: null, loQueVende: false, conCrm: true, conTelefono: true, terminado: false,
};
const E: EstadoArranque = { nombre: 'Florencia' };

test('«(es) mi marca personal: X» y «Rubro: Nombre» → el nombre', () => {
  assert.equal(extraerNegocio('mi marca personal: Florencia Ayelen Carballo'), 'Florencia Ayelen Carballo');
  assert.equal(extraerNegocio('Es mi marca personal: Florencia Ayelen Carballo'), 'Florencia Ayelen Carballo');
  assert.equal(extraerNegocio('Consultora: Florencia Carballo'), 'Florencia Carballo');
  assert.equal(extraerNegocio('Mi marca personal - Florencia Carballo'), 'Florencia Carballo', 'con guion en vez de dos puntos');
  assert.equal(extraerNegocio('Mi negocio es Acme.'), 'Acme');
  assert.equal(extraerNegocio('Acme'), 'Acme');
});

test('lo que no es exactamente lo que escribió, o es su nombre, se confirma', () => {
  assert.deepEqual(leerNegocio('Acme', 'Florencia'), { nombre: 'Acme', confirmar: false }, 'un nombre escrito tal cual no se pregunta');
  assert.deepEqual(leerNegocio('Se llama Acme', 'Florencia'), { nombre: 'Acme', confirmar: false }, 'quitar «se llama» no se pregunta');
  assert.deepEqual(leerNegocio('mi marca personal: Florencia Ayelen Carballo', 'Florencia'), { nombre: 'Florencia Ayelen Carballo', confirmar: true });
  assert.deepEqual(leerNegocio('Uso mi nombre', 'Florencia Ayelen Carballo'), { nombre: 'Florencia Ayelen Carballo', confirmar: true });
  assert.equal(leerNegocio('no tiene nombre', ''), null, 'sin el nombre de la persona, no se entiende');
  assert.equal(leerNegocio('Escuela de liderazgo para mujeres emprendedoras de Latinoamérica', '')?.confirmar, true, 'largo: se confirma');
});

test('el nombre NO se escribe hasta el sí; «No» vuelve a preguntar', () => {
  const r = leerRespuesta(E, H, { texto: 'Es mi marca personal: Florencia Ayelen Carballo' });
  assert.deepEqual(r, { ok: true, patch: { negocioPorConfirmar: { escrito: 'Es mi marca personal: Florencia Ayelen Carballo', nombre: 'Florencia Ayelen Carballo' } } });
  assert.ok(r.ok && !('negocio' in r.patch), 'sin el sí, nada llega al workspace');
  const e2: EstadoArranque = { ...E, ...(r.ok ? r.patch : {}) };
  const ultimo = mensajesDeArranque(e2, H).antes.at(-1);
  assert.equal(ultimo?.texto, '¿Tu negocio se llama «Florencia Ayelen Carballo»?');
  assert.deepEqual(ultimo?.opciones, [...NEGOCIO_CONFIRMAR]);
  assert.deepEqual(leerRespuesta(e2, H, { opcion: 0, opcionTexto: NEGOCIO_CONFIRMAR[0] }), { ok: true, patch: { negocio: 'Florencia Ayelen Carballo', negocioPorConfirmar: undefined } });
  assert.deepEqual(leerRespuesta(e2, H, { opcion: 1, opcionTexto: NEGOCIO_CONFIRMAR[1] }), { ok: true, patch: { negocioPorConfirmar: undefined } });
  assert.deepEqual(leerRespuesta(E, H, { texto: 'Acme' }), { ok: true, patch: { negocio: 'Acme' } });
});

test('el nombre del alta vuelve como respuesta rápida, y tocarlo lo deja tal cual', () => {
  const pregunta = mensajesDeArranque(E, H).antes.at(-1);
  assert.deepEqual(pregunta?.opciones, ['Consultora Argentina']);
  assert.deepEqual(leerRespuesta(E, H, { opcion: 0, opcionTexto: 'Consultora Argentina' }), { ok: true, patch: { negocio: 'Consultora Argentina' } });
  assert.equal(mensajesDeArranque(E, { ...H, nombreWorkspace: 'flor@gmail.com' }).antes.at(-1)?.opciones, undefined, 'un email no es un negocio');
});

test('el ws de prueba no ofrece «Cliente de Prueba»', () => {
  const srv = readFileSync(join(__dirname, '..', 'lib/onboarding-arranque-server.ts'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(srv, /nombreWorkspace: w\?\.nombre && w\.nombre !== NOMBRE_WS_PRUEBA \? w\.nombre : '',/);
});
