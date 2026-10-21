// =============================================================================
// El nombre del negocio se entiende y se CONFIRMA antes de escribirlo (20/10/2026)
// =============================================================================
// Florencia (ws21, 18/10): escribió «mi marca personal: Florencia Ayelen Carballo» y eso quedó TAL CUAL como nombre del
// workspace, del funnel principal, del producto («Oferta de mi marca personal: …»), del PDF y de su archivo en El
// Archivero. `extraerNegocio` sólo quitaba «se llama/es» del principio, y nadie preguntaba. Y el nombre del alta, que
// habría servido, no se ofrecía desde 12ad33b25 (por el ws de prueba, cuyo problema era el RESET).
// La revisión del Cerebro (20/10, tarde) encontró lo que bloqueaba: con la pregunta de confirmación abierta, un «Sí» ESCRITO
// con tilde (o «Dale», «Ok», «👍») se guardaba como nombre del negocio, porque `\b` sin la flag u no corta después de «í».
// Ahora lo escrito SIEMPRE se confirma, y con algo pendiente nada se escribe sin un sí explícito.
// docs/hallazgos-onboarding.md, «Florencia (ws21, 18/10)».
//
// ROTURAS (20/10/2026, arnés romper.js + roturas-negocio.json del scratchpad; base 6/0): sin entender «mi marca
// personal» (con guion) → 5/1 · el «Sí» con `\b` sin la flag u → 4/2 · lo escrito sin confirmar → 5/1 · lo que no es sí ni
// no se escribe directo → 5/1 · sin el nombre del alta → 5/1 · el ws de prueba ofrece su nombre → 5/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  NEGOCIO_CONFIRMAR, extraerNegocio, leerNegocio, leerRespuesta, mensajesDeArranque, siONo,
  type EstadoArranque, type HechosArranque,
} from '../lib/onboarding-arranque';

const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: 'Florencia Ayelen Carballo', nombreWorkspace: 'Consultora Argentina', faseGuardada: false,
  canalNegocio: null, loQueVende: false, conCrm: true, conTelefono: true, terminado: false,
};
const E: EstadoArranque = { nombre: 'Florencia' };
const PENDIENTE: EstadoArranque = { ...E, negocioPorConfirmar: { escrito: 'Es mi marca personal: Florencia Ayelen Carballo', nombre: 'Florencia Ayelen Carballo' } };

test('«(es) mi marca personal: X» y «Rubro: Nombre» → el nombre', () => {
  assert.equal(extraerNegocio('mi marca personal: Florencia Ayelen Carballo'), 'Florencia Ayelen Carballo');
  assert.equal(extraerNegocio('Es mi marca personal: Florencia Ayelen Carballo'), 'Florencia Ayelen Carballo');
  assert.equal(extraerNegocio('Consultora: Florencia Carballo'), 'Florencia Carballo');
  assert.equal(extraerNegocio('Mi marca personal - Florencia Carballo'), 'Florencia Carballo', 'con guion en vez de dos puntos');
  assert.equal(extraerNegocio('Mi negocio es Acme.'), 'Acme');
  assert.equal(extraerNegocio('Acme'), 'Acme');
});

test('un sí o un no escrito: con tilde, sin ella y con las formas de siempre', () => {
  for (const t of ['Sí', 'sí', 'Sí.', 'Sí!', 'si', 'Sí, correcto', 'Dale', 'Ok', 'okay', 'Perfecto', 'Está bien', 'Ese mismo', '👍', 'Así es']) {
    assert.equal(siONo(t), 'si', `«${t}»`);
  }
  for (const t of ['No', 'no.', 'Nop', 'No es así']) assert.equal(siONo(t), 'no', `«${t}»`);
  for (const t of ['Sí, pero se llama Acme', 'Acme', 'Sílvia Estudio', 'Nora Diseño']) assert.equal(siONo(t), null, `«${t}» no es un sí ni un no`);
});

test('lo escrito se entiende: «uso mi nombre» y «no tengo» proponen su nombre; sin letras no es un nombre', () => {
  assert.equal(leerNegocio('Se llama Acme', 'Florencia'), 'Acme');
  assert.equal(leerNegocio('mi marca personal: Florencia Ayelen Carballo', 'Florencia'), 'Florencia Ayelen Carballo');
  for (const t of ['Uso mi nombre', 'Mi propio nombre', 'No tengo nombre', 'no tengo', 'todavía no', 'Ninguno', 'No sé', 'Soy yo']) {
    assert.equal(leerNegocio(t, 'Florencia Ayelen Carballo'), 'Florencia Ayelen Carballo', `«${t}»`);
  }
  assert.equal(leerNegocio('no tengo nombre', ''), null, 'sin el nombre de la persona, no se entiende');
  assert.equal(leerNegocio('🌸', 'Florencia'), null);
});

test('lo escrito SIEMPRE se confirma; con algo pendiente, nada se escribe sin un sí explícito', () => {
  // Hasta la respuesta más simple se pregunta: es una pregunta más, una sola vez.
  assert.deepEqual(leerRespuesta(E, H, { texto: 'Acme' }), { ok: true, patch: { negocioPorConfirmar: { escrito: 'Acme', nombre: 'Acme' } } });
  const r = leerRespuesta(E, H, { texto: 'Es mi marca personal: Florencia Ayelen Carballo' });
  assert.deepEqual(r, { ok: true, patch: { negocioPorConfirmar: PENDIENTE.negocioPorConfirmar } });
  const ultimo = mensajesDeArranque(PENDIENTE, H).antes.at(-1);
  assert.equal(ultimo?.texto, '¿Tu negocio se llama «Florencia Ayelen Carballo»?');
  assert.deepEqual(ultimo?.opciones, [...NEGOCIO_CONFIRMAR]);
  const guarda = { ok: true, patch: { negocio: 'Florencia Ayelen Carballo', negocioPorConfirmar: undefined } };
  assert.deepEqual(leerRespuesta(PENDIENTE, H, { opcion: 0, opcionTexto: NEGOCIO_CONFIRMAR[0] }), guarda);
  // El caso que bloqueaba: el TEXTO «Sí», con tilde, no la opción.
  for (const t of ['Sí', 'Sí.', 'Dale', 'Ok', 'Perfecto', '👍']) assert.deepEqual(leerRespuesta(PENDIENTE, H, { texto: t }), guarda, `«${t}» escrito`);
  assert.deepEqual(leerRespuesta(PENDIENTE, H, { opcion: 1, opcionTexto: NEGOCIO_CONFIRMAR[1] }), { ok: true, patch: { negocioPorConfirmar: undefined } });
  assert.deepEqual(leerRespuesta(PENDIENTE, H, { texto: 'No' }), { ok: true, patch: { negocioPorConfirmar: undefined } });
  // Ni sí ni no: otro nombre, que se vuelve a confirmar.
  assert.deepEqual(leerRespuesta(PENDIENTE, H, { texto: 'Sí, pero se llama Acme' }), { ok: true, patch: { negocioPorConfirmar: { escrito: 'Sí, pero se llama Acme', nombre: 'Acme' } } });
  assert.deepEqual(leerRespuesta(PENDIENTE, H, { texto: 'Florencia Carballo' }), { ok: true, patch: { negocioPorConfirmar: { escrito: 'Florencia Carballo', nombre: 'Florencia Carballo' } } });
});

test('el nombre del alta vuelve como respuesta rápida, y tocarlo lo deja tal cual', () => {
  const pregunta = mensajesDeArranque(E, H).antes.at(-1);
  assert.deepEqual(pregunta?.opciones, ['Consultora Argentina']);
  assert.deepEqual(leerRespuesta(E, H, { opcion: 0, opcionTexto: 'Consultora Argentina' }), { ok: true, patch: { negocio: 'Consultora Argentina' } });
  assert.equal(mensajesDeArranque(E, { ...H, nombreWorkspace: 'flor@gmail.com' }).antes.at(-1)?.opciones, undefined, 'un email no es un negocio');
  assert.deepEqual(mensajesDeArranque({ ...E, negocioSugerido: 'Córdoba' }, H).antes.at(-1)?.opciones, ['Consultora Argentina'], '«Martín de Córdoba» no ofrece «Córdoba»');
});

test('el ws de prueba no ofrece «Cliente de Prueba»', () => {
  const srv = readFileSync(join(__dirname, '..', 'lib/onboarding-arranque-server.ts'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(srv, /nombreWorkspace: w\?\.nombre && w\.nombre !== NOMBRE_WS_PRUEBA \? w\.nombre : '',/);
});
