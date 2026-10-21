// =============================================================================
// El nombre del negocio se entiende y se CONFIRMA antes de escribirlo (20/10/2026)
// =============================================================================
// Florencia (ws21, 18/10): escribió «mi marca personal: Florencia Ayelen Carballo» y eso quedó TAL CUAL como nombre del
// workspace, del funnel principal, del producto («Oferta de mi marca personal: …»), del PDF y de su archivo en El
// Archivero. `extraerNegocio` sólo quitaba «se llama/es» del principio, y nadie preguntaba. El nombre del alta NO se
// ofrece como botón (Martín, 18/10: sin respuestas rápidas en el nombre ni en el negocio; decidido de nuevo el 20/10).
// La revisión del Cerebro (20/10, tarde) encontró lo que bloqueaba: con la pregunta de confirmación abierta, un «Sí» ESCRITO
// con tilde (o «Dale», «Ok», «👍») se guardaba como nombre del negocio, porque `\b` sin la flag u no corta después de «í».
// Ahora lo escrito SIEMPRE se confirma, y con algo pendiente nada se escribe sin un sí explícito.
// docs/hallazgos-onboarding.md, «Florencia (ws21, 18/10)».
//
// ROTURAS (20/10/2026, arnés romper.js + roturas-negocio.json del scratchpad; base 6/0): sin entender «mi marca
// personal» (con guion) → 5/1 · el «Sí» con `\b` sin la flag u → 4/2 · lo escrito sin confirmar → 5/1 · lo que no es sí ni
// no se escribe directo → 5/1 · sin el nombre del alta → 5/1 · el ws de prueba ofrece su nombre → 5/1.
// Y el 20/10 a la noche, sin el botón del alta (romper.js + roturas-sin-chip.json, con onboarding-preguntas y
// onboarding-arranque; base 39/0): vuelve el botón del nombre del alta → 34/5 · vuelve el del nombre de la cuenta → 33/6.
// Y la revisión de la noche (roturas-noche.json, con la batería de tests/onboarding-cifras-escritas.test.ts; base 41/0): un sí
// con más palabras de acuerdo no es sí → 39/2 · un sí con otra cosa adivina el nombre → 40/1.
// Y la tercera revisión (21/10, roturas-tercera.json, base 24/0): una palabra de acuerdo reemplaza al nombre → 23/1 · «sisi»
// no es sí → 23/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  NEGOCIO_CONFIRMAR, extraerNegocio, leerNegocio, leerRespuesta, mensajesDeArranque, siONo,
  type EstadoArranque, type HechosArranque, type Respuesta,
} from '../lib/onboarding-arranque';
import { preguntaQueContesta } from '../app/onboarding/arranque-ui';

const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: 'Florencia Ayelen Carballo', nombreWorkspace: 'Consultora Argentina', faseGuardada: false,
  canalNegocio: null, loQueVende: false, conCrm: true, conTelefono: true, terminado: false,
};
const E: EstadoArranque = { nombre: 'Florencia' };
// Como la pantalla: la respuesta viaja con la pregunta que contesta (cuarta revisión, 21/10).
const responder = (e: EstadoArranque, r: Respuesta, h = H) => leerRespuesta(e, h, { ...preguntaQueContesta(mensajesDeArranque(e, h)), ...r });
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
  assert.deepEqual(responder(PENDIENTE, { opcion: 0, opcionTexto: NEGOCIO_CONFIRMAR[0] }), guarda);
  // El caso que bloqueaba: el TEXTO «Sí», con tilde, no la opción.
  for (const t of ['Sí', 'Sí.', 'Dale', 'Ok', 'Perfecto', '👍']) assert.deepEqual(responder(PENDIENTE, { texto: t }), guarda, `«${t}» escrito`);
  assert.deepEqual(responder(PENDIENTE, { opcion: 1, opcionTexto: NEGOCIO_CONFIRMAR[1] }), { ok: true, patch: { negocioPorConfirmar: undefined } });
  assert.deepEqual(responder(PENDIENTE, { texto: 'No' }), { ok: true, patch: { negocioPorConfirmar: undefined } });
  // Ni sí ni no: otro nombre, que se vuelve a confirmar.
  assert.deepEqual(responder(PENDIENTE, { texto: 'Sí, pero se llama Acme' }), { ok: true, patch: { negocioPorConfirmar: { escrito: 'Sí, pero se llama Acme', nombre: 'Acme' } } });
  assert.deepEqual(responder(PENDIENTE, { texto: 'Florencia Carballo' }), { ok: true, patch: { negocioPorConfirmar: { escrito: 'Florencia Carballo', nombre: 'Florencia Carballo' } } });
});

test('un sí con más palabras de acuerdo es un sí, y un sí con otra cosa no adivina un nombre (revisión, 20/10 noche)', () => {
  // La revisión de la noche: «Sí, está bien» se volvía «¿Tu negocio se llama «está bien»?» y el nombre bueno se perdía.
  const guarda = { ok: true, patch: { negocio: 'Florencia Ayelen Carballo', negocioPorConfirmar: undefined } };
  for (const t of ['Sí, está bien', 'Sí, ese es', 'Si, es ese', 'Sí, por favor', 'sí así se llama', 'Correcto, así se llama', 'Siii',
    'Exactamente', 'Claro que sí', 'Obvio', 'Dale, perfecto', 'Sí, Florencia Ayelen Carballo', 'Sí, tal cual 👍',
    // La tercera revisión (21/10): estas proponían «así», «perfecto», «mi negocio», «sisi», «Vale»… y perdían el nombre bueno.
    'Sí, es así', 'Sí, es perfecto', 'Sí, es exacto', 'Sí, es eso', 'Sí, es el nombre', 'Sí, es mi negocio', 'Sí, mejor así',
    'Sí, en realidad sí', 'sisi', 'Si es asi', 'Sí, es mi marca personal', 'Ajá', 'Eso mismo',
    'es así', 'es ese', 'Sí, mi emprendimiento', 'Sí, es mi negocio']) {
    assert.deepEqual(responder(PENDIENTE, { texto: t }), guarda, `«${t}»`);
  }
  for (const t of ['No, lo escribo de nuevo', 'No, gracias', 'Nop', 'No es ese']) {
    assert.deepEqual(responder(PENDIENTE, { texto: t }), { ok: true, patch: { negocioPorConfirmar: undefined } }, `«${t}»`);
  }
  // Un sí con algo que no es acuerdo ni un nombre presentado: se pregunta de nuevo y NO se pierde lo pendiente. Y nunca una
  // palabra de acuerdo reemplaza al nombre («No, está bien» no propone «está bien»).
  for (const t of ['Sí, Acme también', 'No, está bien', 'No, perfecto', 'es mi negocio', 'Es mi emprendimiento', 'el nombre', 'es']) {
    const duda = responder(PENDIENTE, { texto: t });
    assert.equal(duda.ok, false, `«${t}»`);
    assert.match(duda.ok ? '' : duda.error, /¿Tu negocio se llama «Florencia Ayelen Carballo»\? Dime sí o no, o escribe el nombre\./);
  }
  // «Vale», «Listo», «Simón», «Ándale» eran un sí (tercera revisión), pero también son nombres reales: con otro nombre
  // esperando, se pregunta cuál de los dos es (séptima revisión, 21/10; tests/onboarding-septima-revision.test.ts).
  for (const t of ['Vale', 'Listo', 'Simón', 'Ándale']) {
    const duda = responder(PENDIENTE, { texto: t });
    assert.match(duda.ok ? '' : duda.error, new RegExp(`^«${t}», ¿es el nombre de tu negocio\\?`), `«${t}»`);
  }
  // «No, Acme» y «Sí, pero es Acme»: el nombre nuevo, que se vuelve a confirmar.
  assert.deepEqual(responder(PENDIENTE, { texto: 'No, Acme Estudio' }), { ok: true, patch: { negocioPorConfirmar: { escrito: 'No, Acme Estudio', nombre: 'Acme Estudio' } } });
  assert.deepEqual(responder(PENDIENTE, { texto: 'Sí, pero es Acme' }), { ok: true, patch: { negocioPorConfirmar: { escrito: 'Sí, pero es Acme', nombre: 'Acme' } } });
  // Un nombre que empieza como «sí» o «no» no se confunde: «Sinergia», «Nora Diseño».
  assert.deepEqual(responder(PENDIENTE, { texto: 'Nora Diseño' }), { ok: true, patch: { negocioPorConfirmar: { escrito: 'Nora Diseño', nombre: 'Nora Diseño' } } });
  assert.deepEqual(responder(PENDIENTE, { texto: 'Sinergia' }), { ok: true, patch: { negocioPorConfirmar: { escrito: 'Sinergia', nombre: 'Sinergia' } } });
});

test('el nombre y el negocio no ofrecen NINGUNA opción, tampoco el nombre del alta (Martín, 18/10)', () => {
  // «Sin respuestas rápidas en las preguntas del nombre y del nombre del negocio». El Cerebro había pedido el 20/10 ofrecer
  // el nombre del alta y lo retiró esa noche: el pedido de Martín es literal y anterior.
  assert.equal(mensajesDeArranque({}, H).antes.at(-1)?.opciones, undefined, 'el nombre');
  assert.equal(mensajesDeArranque(E, H).antes.at(-1)?.opciones, undefined, 'el negocio, con un nombre del alta que parece un negocio');
  assert.equal(mensajesDeArranque({ ...E, negocioSugerido: 'Córdoba' }, H).antes.at(-1)?.opciones, undefined, '«Martín de Córdoba» no ofrece «Córdoba»');
  // Un toque viejo (una pestaña con el botón de antes) no escribe nada: la pregunta cambió.
  assert.deepEqual(leerRespuesta(E, H, { opcion: 0, opcionTexto: 'Consultora Argentina' }), { ok: false, error: 'La pregunta cambió.', cambio: true });
  // Escrito, se confirma como cualquier otro.
  assert.deepEqual(leerRespuesta(E, H, { texto: 'Consultora Argentina' }), { ok: true, patch: { negocioPorConfirmar: { escrito: 'Consultora Argentina', nombre: 'Consultora Argentina' } } });
});

test('el ws de prueba no ofrece «Cliente de Prueba»', () => {
  const srv = readFileSync(join(__dirname, '..', 'lib/onboarding-arranque-server.ts'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(srv, /nombreWorkspace: w\?\.nombre && w\.nombre !== NOMBRE_WS_PRUEBA \? w\.nombre : '',/);
});
