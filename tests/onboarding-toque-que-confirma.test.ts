// =============================================================================
// El toque que confirma, alrededor de la red: el nombre, la pestaña vieja, el cobro y el nombre de la persona (21/10/2026)
// =============================================================================
// La cuarta revisión del Cerebro (punta 2fbd0f3a5) confirmó que la red de la fase, el canal y el interés funciona: nada
// escrito se guarda sin el toque. Los agujeros quedaban ALREDEDOR:
//   1. «Es mi marca personal» —que quiere decir «uso mi nombre»— confirmaba un pendiente equivocado («Vendo ropa») y lo
//      escribía en workspaces.nombre; las frases que sólo nombran lo preguntado valen como sí sólo detrás de un sí.
//   2. Todas las confirmaciones tienen el mismo botón («Sí, es eso»): un toque o un «sí» de una pestaña vieja confirmaba una
//      lectura que esa pantalla nunca mostró. Ahora la respuesta viaja con la pregunta que contesta.
//   3. El tipo de cobro del producto se leía del precio con reglas y se guardaba sin que nadie lo viera: ahora se propone
//      («Entendí que cobras así: …») y se confirma.
//   6. El nombre de la persona, recortado con reglas, pisaba el que trajo Google en usuarios.nombre.
// lib/onboarding-arranque.ts. docs/hallazgos-onboarding.md, «El parser escrito necesita confirmación».
//
// ROTURAS (21/10/2026, romper.js + roturas-cuarta.json del scratchpad, con onboarding-nombre-negocio, cierre-florencia,
// onboarding-hilo, pdf-confirmar, movil-entrada y second-brain-offer; base 32/0): lo que nombra lo preguntado es un sí
// suelto → 30/2 · «es mi marca personal» no propone a la persona → 31/1 · lo que nombra lo preguntado se vuelve un nombre →
// 30/2 · la pregunta que contesta no se mira → 31/1 · una confirmación sin la pregunta vale → 31/1 · la pantalla no manda la
// pregunta con lo escrito → 31/1 · sin la etapa del cobro → 31/1 · el producto toma el cobro sin confirmar → 31/1 · la
// propuesta del cobro lee lo negado → 31/1 · lo anual o semanal es pago único → 31/1 · el chat «Onboarding» con una sola
// hora → 31/1 · una corrección del PDF es un sí → 31/1 · «no le falta nada» es un no → 31/1 · la nota del PDF no se anota →
// 31/1 · el nombre leído pisa el del perfil → 31/1 · «pero» entra en el nombre → 31/1 · la entrada del teléfono se marca al
// terminar → 31/1 · la conversación de Offer seguida después se esconde igual → 31/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  COBRO_MENSUAL, COBRO_UNICO, NEGOCIO_CONFIRMAR, RECARGA_LA_PAGINA, SI_ES_ESO, cobroDelPrecio, etapaDeArranque, extraerNombre, leerRespuesta, mensajesDeArranque,
  pisaElNombreDelPerfil, type EstadoArranque, type HechosArranque, type Respuesta,
} from '../lib/onboarding-arranque';
import { preguntaQueContesta } from '../app/onboarding/arranque-ui';
import { CANALES, PREGUNTAS } from '../lib/fase-diagnostico';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: 'Florencia Ayelen Carballo', nombreWorkspace: '', faseGuardada: false,
  canalNegocio: null, loQueVende: true, conCrm: true, conTelefono: false, terminado: false,
};
const responder = (e: EstadoArranque, r: Respuesta, h = H) => leerRespuesta(e, h, { ...preguntaQueContesta(mensajesDeArranque(e, h)), ...r });
const CAMBIO = { ok: false, error: 'La pregunta cambió.', cambio: true };

test('1. «Es mi marca personal» sobre un pendiente equivocado propone a la persona; no confirma «Vendo ropa»', () => {
  const MAL: EstadoArranque = { nombre: 'Florencia', negocioPorConfirmar: { escrito: 'Vendo ropa', nombre: 'Vendo ropa' } };
  const persona = { ok: true, patch: { negocioPorConfirmar: { escrito: 'Es mi marca personal', nombre: 'Florencia Ayelen Carballo' } } };
  assert.deepEqual(responder(MAL, { texto: 'Es mi marca personal' }), persona);
  assert.deepEqual(responder(MAL, { texto: 'Mi marca personal' }), { ok: true, patch: { negocioPorConfirmar: { escrito: 'Mi marca personal', nombre: 'Florencia Ayelen Carballo' } } });
  assert.deepEqual(responder(MAL, { texto: 'No, es mi marca personal' }), { ok: true, patch: { negocioPorConfirmar: { escrito: 'No, es mi marca personal', nombre: 'Florencia Ayelen Carballo' } } },
    'antes entraba en bucle');
  // Lo que sólo nombra lo preguntado no confirma ni es un nombre: se pregunta de nuevo.
  for (const t of ['es mi marca', 'Es mi emprendimiento', 'Es mi negocio', 'el nombre', 'es']) {
    const r = responder(MAL, { texto: t });
    assert.equal(r.ok, false, `«${t}» guardó algo`);
  }
  // Detrás de un sí explícito, sí confirma.
  assert.deepEqual(responder(MAL, { texto: 'Sí, es mi negocio' }), { ok: true, patch: { negocio: 'Vendo ropa', negocioPorConfirmar: undefined } });
});

test('2. un toque o un «sí» de una pestaña vieja no confirma una lectura que esa pantalla no mostró', () => {
  const iVolumen = PREGUNTAS.findIndex((q) => q.id === 'volumen');
  const antesDelCanal: EstadoArranque = { nombre: 'F', negocio: 'N', pdfOk: 'si', faseResp: PREGUNTAS.map((_, i) => (i < iVolumen ? 0 : -1)) };
  const iLlamadas = CANALES.findIndex((c) => c.id === 'llamadas');
  const iCarrito = CANALES.findIndex((c) => c.id === 'carrito');
  // El teléfono vio la confirmación de «Llamada de venta»…
  const telefono: EstadoArranque = { ...antesDelCanal, opcionPorConfirmar: { id: 'canal', opcion: iLlamadas, escrito: 'agendo por zoom' } };
  const loQueVio = preguntaQueContesta(mensajesDeArranque(telefono, H));
  // …y en la compu se escribió otra cosa: el server quedó con «Carrito».
  const server: EstadoArranque = { ...antesDelCanal, opcionPorConfirmar: { id: 'canal', opcion: iCarrito, escrito: 'compran solos en la web' } };
  assert.deepEqual(leerRespuesta(server, H, { opcion: 0, opcionTexto: SI_ES_ESO, ...loQueVio }), CAMBIO, 'el toque viejo confirmó «Carrito»');
  assert.deepEqual(leerRespuesta(server, H, { texto: 'sí', ...loQueVio }), CAMBIO, 'el «sí» viejo confirmó «Carrito»');
  // Sin la pregunta tampoco vale, y es una pantalla de antes del despliegue: se le dice que recargue (quinta revisión).
  assert.deepEqual(leerRespuesta(server, H, { opcion: 0, opcionTexto: SI_ES_ESO }), { ...CAMBIO, error: RECARGA_LA_PAGINA }, 'sin la pregunta, una confirmación no vale');
  // Con la pregunta que el server tiene, sí.
  const ok = responder(server, { opcion: 0, opcionTexto: SI_ES_ESO });
  assert.ok(ok.ok && ok.patch.canal === 'carrito', ok.ok ? JSON.stringify(ok.patch) : ok.error);
  // Igual con el nombre del negocio.
  const vioAcme = preguntaQueContesta(mensajesDeArranque({ nombre: 'F', negocioPorConfirmar: { escrito: 'Acme', nombre: 'Acme' } }, H));
  const enBeta: EstadoArranque = { nombre: 'F', negocioPorConfirmar: { escrito: 'Beta Studio', nombre: 'Beta Studio' } };
  assert.deepEqual(leerRespuesta(enBeta, H, { opcion: 0, opcionTexto: NEGOCIO_CONFIRMAR[0], ...vioAcme }), CAMBIO);
  // Y la pantalla manda la pregunta con el toque y con lo escrito.
  const chat = leer('app/onboarding/ChatArranque.tsx');
  assert.match(chat, /return responder\(\{ texto: t, \.\.\.preguntaQueContesta\(vista\) \}, t\);/);
  assert.match(chat, /void responder\(\{ opcion: idx, \.\.\.\(texto !== undefined \? \{ opcionTexto: texto \} : \{\}\), \.\.\.preguntaQueContesta\(vista\) \}, texto \?\? null\);/);
  assert.match(leer('app/api/onboarding/arranque/route.ts'), /const lectura = leerRespuesta\(e, h, \{ texto, opcion, opcionTexto, pregunta \}\);/);
});

test('3. cómo cobra se PROPONE desde el precio y se guarda recién con el toque', () => {
  const conPrecio: HechosArranque = { ...H, cobroLeido: { tipo: 'suscripcion', meses: 6 } };
  const trasPdf: EstadoArranque = { nombre: 'F', negocio: 'N', pdfOk: 'si' };
  assert.equal(etapaDeArranque(trasPdf, conPrecio), 'cobro');
  assert.equal(etapaDeArranque(trasPdf, { ...H, cobroLeido: null }), 'fase', 'sin precio dicho, no se pregunta');
  const ultimo = mensajesDeArranque(trasPdf, conPrecio).despues.at(-1)!;
  // Las opciones son todas las lecturas, con la leída primera (novena revisión; tests/onboarding-novena-revision.test.ts).
  assert.equal(ultimo.texto, 'Entendí que cobras así: «Suscripción de 6 meses». ¿Es así?');
  assert.deepEqual(ultimo.opciones, ['Suscripción de 6 meses', COBRO_UNICO, COBRO_MENSUAL]);
  assert.deepEqual(responder(trasPdf, { opcion: 0, opcionTexto: 'Suscripción de 6 meses' }, conPrecio), { ok: true, patch: { cobro: { tipo: 'suscripcion', meses: 6 } } });
  assert.deepEqual(responder(trasPdf, { texto: 'sí' }, conPrecio), { ok: true, patch: { cobro: { tipo: 'suscripcion', meses: 6 } } }, 'un sí elige la leída');
  assert.deepEqual(responder(trasPdf, { opcion: 1, opcionTexto: COBRO_UNICO }, conPrecio), { ok: true, patch: { cobro: { tipo: 'unico', meses: null } } });
  assert.equal(responder(trasPdf, { texto: 'cobro por mes, creo' }, conPrecio).ok, false, 'lo escrito no se vuelve a leer con reglas');
  assert.equal(etapaDeArranque({ ...trasPdf, cobro: { tipo: 'unico', meses: null } }, conPrecio), 'fase');
  // El producto toma SÓLO lo confirmado (tests/onboarding-cierre-florencia.test.ts mira el cierre).
});

test('3b. la propuesta del cobro lee mejor: la negación no cuenta, y lo anual o semanal es periódico', () => {
  for (const p of ['USD 997, acceso de por vida, sin mensualidades', 'USD 1.000, sin cuotas', 'USD 1.500, nada de cuotas mensuales', 'USD 1.000, no es mensual']) {
    assert.deepEqual(cobroDelPrecio(p), { tipo: 'unico', meses: null }, p);
  }
  for (const p of ['Suscripción anual de USD 1.200', 'Membresía anual USD 400', 'USD 99 por semana']) {
    assert.equal(cobroDelPrecio(p).tipo, 'suscripcion', p);
  }
});

test('6. el nombre de la persona: no pisa el que ya tiene el perfil, y no se lleva palabras de más', () => {
  assert.equal(pisaElNombreDelPerfil('María del Carmen Pérez'), false, 'el nombre de Google no se pisa');
  assert.equal(pisaElNombreDelPerfil(''), true);
  assert.equal(pisaElNombreDelPerfil(null), true);
  assert.equal(pisaElNombreDelPerfil('maria@gmail.com'), true, 'un email no es un nombre');
  assert.equal(extraerNombre('Me llamo Ana pero me dicen Anita').nombre, 'Ana');
  for (const t of ['Hola, ¿qué tengo que poner?', 'Ok', 'Sí']) assert.equal(extraerNombre(t).nombre, '', `«${t}» se tomó como nombre`);
  const srv = leer('lib/onboarding-arranque-server.ts');
  assert.match(srv, /try \{ actual = \(await getPerfil\(\)\)\?\.nombre; \} catch \{ return;/, 'sin leer el perfil no se decide pisarlo');
  assert.match(srv, /if \(!pisaElNombreDelPerfil\(actual\)\) return;/);
});
