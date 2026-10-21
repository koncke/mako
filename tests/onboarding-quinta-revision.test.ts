// =============================================================================
// La quinta revisión del Cerebro (c7226ab77, 21/10/2026): lo que el toque que confirma no puede romper
// =============================================================================
// docs/hallazgos-onboarding.md, «Una palabra de acuerdo no confirma un pendiente, pero tampoco impide que un NOMBRE sea
// esa palabra». Los seis puntos:
//   1. [media] Sin pendiente, un negocio que se llama como una palabra de acuerdo («Claro», «Listo», «Tal Cual», «Simón»)
//      quedaba en bucle: se cortaba como si fuera un «sí». Ahora se propone y el toque decide. «El nombre es Listo»
//      proponía la frase entera.
//   2. Una pestaña con el JS de antes del despliegue (sin la pregunta) quedaba en un 409 en bucle: ahora se le dice que
//      recargue.
//   3. Lo anual o semanal se proponía como «Suscripción mensual», sin ninguna opción cierta: ahora se pregunta sin proponer.
//   4. PDF: una corrección dicha con otras palabras era un sí (tests/onboarding-pdf-confirmar.test.ts), y la nota del «no»
//      no la leía nadie: ahora la leen la tabla de clientes del super admin y `ver_estado_onboarding`.
//   5. El nombre de la persona, con el perfil vacío o en un email, iba a usuarios.nombre sin confirmar («Gracias»).
//   6. La caja única: el doble toque en ➤ arrancaba el micrófono, y lo juntado mientras MaKo contesta se perdía.
//
// ROTURAS: ver el final del archivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  COBRO_MENSUAL, COBRO_UNICO, NOMBRE_CONFIRMAR, RECARGA_LA_PAGINA, SI_ES_ESO, cobroDelPrecio, cobroSinPropuesta, etapaDeArranque,
  leerRespuesta, mensajesDeArranque, type EstadoArranque, type HechosArranque, type Respuesta,
} from '../lib/onboarding-arranque';
import { preguntaQueContesta } from '../app/onboarding/arranque-ui';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: 'Simón Pérez', nombreWorkspace: '', faseGuardada: false,
  canalNegocio: null, loQueVende: false, conCrm: true, conTelefono: true, terminado: false,
};
/** El perfil que trae el alta de customer-success: el email como nombre provisorio. */
const CON_EMAIL: HechosArranque = { ...H, nombreCuenta: 'ana@gmail.com' };
/** Como la pantalla: con la pregunta que contesta. */
const responder = (e: EstadoArranque, r: Respuesta, h = H) => leerRespuesta(e, h, { ...preguntaQueContesta(mensajesDeArranque(e, h)), ...r });
const propone = (r: ReturnType<typeof leerRespuesta>) => (r.ok ? r.patch.negocioPorConfirmar?.nombre : `ERR ${r.error}`);

test('1. sin pendiente, un negocio que se llama como una palabra de acuerdo se PROPONE, no se corta', () => {
  const E: EstadoArranque = { nombre: 'Simón' };
  for (const t of ['Claro', 'Genial', 'Listo', 'Tal Cual', 'De Una', 'Dale', 'Venga', 'Simón', 'Órale', 'Mi Negocio', 'Exacto', 'Vale']) {
    assert.equal(propone(responder(E, { texto: t })), t, `«${t}» no se propuso`);
  }
  assert.equal(propone(responder(E, { texto: 'Se llama Tal Cual' })), 'Tal Cual');
  assert.equal(propone(responder(E, { texto: 'Se llama «Exacto»' })), 'Exacto');
  assert.equal(propone(responder(E, { texto: 'Mi negocio se llama Genial' })), 'Genial');
  // «El nombre es Listo» proponía la frase entera.
  assert.equal(propone(responder(E, { texto: 'El nombre es Listo' })), 'Listo');
  // Y el toque lo guarda: «Claro» es el nombre.
  const pend: EstadoArranque = { ...E, negocioPorConfirmar: { escrito: 'Claro', nombre: 'Claro' } };
  assert.deepEqual(responder(pend, { texto: 'sí' }), { ok: true, patch: { negocio: 'Claro', negocioPorConfirmar: undefined } });
});

test('1b. CON pendiente, un sí sin duda confirma; lo que sólo nombra lo preguntado vuelve a preguntar; lo presentado es otro nombre', () => {
  const P: EstadoArranque = { nombre: 'Simón', negocioPorConfirmar: { escrito: 'Acme', nombre: 'Acme' } };
  for (const t of ['Sí', 'Ok', 'Correcto']) assert.deepEqual(responder(P, { texto: t }), { ok: true, patch: { negocio: 'Acme', negocioPorConfirmar: undefined } }, t);
  // «Claro», «Simón», «Listo» también pueden ser el nombre real: se pregunta cuál (séptima revisión, tests/onboarding-septima-revision.test.ts).
  for (const t of ['Claro', 'Simón', 'Listo']) assert.equal(responder(P, { texto: t }).ok, false, t);
  for (const t of ['Es mi negocio', 'No, está bien']) assert.equal(responder(P, { texto: t }).ok, false, `«${t}» reemplazó el pendiente`);
  assert.equal(propone(responder(P, { texto: 'Se llama Tal Cual' })), 'Tal Cual');
  assert.equal(propone(responder(P, { texto: 'El nombre es Listo' })), 'Listo');
});

test('2. una pantalla de antes del despliegue (sin la pregunta) recibe «recarga la página», no un 409 en bucle', () => {
  const P: EstadoArranque = { nombre: 'Simón', negocioPorConfirmar: { escrito: 'Acme', nombre: 'Acme' } };
  for (const r of [{ texto: 'sí' }, { texto: 'Acme Studio' }, { opcion: 0, opcionTexto: 'Sí, se llama así' }] as Respuesta[]) {
    assert.deepEqual(leerRespuesta(P, H, r), { ok: false, error: RECARGA_LA_PAGINA, cambio: true }, JSON.stringify(r));
  }
  // Con la pregunta de otra pantalla sigue siendo «La pregunta cambió».
  assert.deepEqual(leerRespuesta(P, H, { texto: 'sí', pregunta: '¿Otra?' }), { ok: false, error: 'La pregunta cambió.', cambio: true });
  // Sin confirmación abierta, la pantalla de antes sigue pudiendo contestar.
  assert.equal(leerRespuesta({ nombre: 'Simón' }, H, { texto: 'Acme' }).ok, true);
  // La pantalla muestra el error que manda el server (no uno propio), y la ruta lo manda con la vista de hoy.
  assert.match(sinComentarios(leer('app/onboarding/ChatArranque.tsx')), /if \(r\.ok === false\) \{ setAviso\(r\.error \?\? /);
  assert.match(leer('app/api/onboarding/arranque/route.ts'), /if \(!lectura\.ok && lectura\.cambio\) return NextResponse\.json\(\{ ok: false, error: lectura\.error, vista: await vistaArranque\(\) \}, \{ status: 409 \}\);/);
});

test('3. lo anual o semanal no se propone como mensual: se pregunta sin lectura, con las dos formas que el producto cobra', () => {
  assert.deepEqual(cobroDelPrecio('Membresía anual USD 400'), { tipo: 'suscripcion', meses: null, periodo: 'anual' });
  assert.deepEqual(cobroDelPrecio('USD 1.200 por año'), { tipo: 'suscripcion', meses: null, periodo: 'anual' });
  assert.deepEqual(cobroDelPrecio('USD 99 por semana'), { tipo: 'suscripcion', meses: null, periodo: 'semanal' });
  assert.equal(cobroDelPrecio('USD 150 por mes').periodo, undefined, 'lo mensual sí se propone');
  const h: HechosArranque = { ...H, loQueVende: true, cobroLeido: cobroDelPrecio('Membresía anual USD 400') };
  const e: EstadoArranque = { nombre: 'Simón', negocio: 'Acme', pdfOk: 'si' };
  assert.equal(etapaDeArranque(e, h), 'cobro');
  const m = mensajesDeArranque(e, h).despues.at(-1);
  assert.equal(m?.texto, cobroSinPropuesta('anual'));
  assert.deepEqual(m?.opciones, [COBRO_UNICO, COBRO_MENSUAL], 'sin «Sí, es eso»: no hay lectura que confirmar');
  assert.ok(!/Suscripción mensual»/.test(m?.texto ?? ''), 'volvió a proponer «Suscripción mensual»');
  // Un sí no guarda nada: no hay qué confirmar. La opción, sí, sin el periodo (el producto no lo sabe cobrar).
  assert.equal(responder(e, { texto: 'sí' }, h).ok, false);
  assert.equal(responder(e, { opcion: 0, opcionTexto: SI_ES_ESO }, h).ok, false);
  assert.deepEqual(responder(e, { opcion: 0, opcionTexto: COBRO_UNICO }, h), { ok: true, patch: { cobro: { tipo: 'unico', meses: null } } });
  // Ya elegido, queda dibujado con lo que eligió.
  const tras = mensajesDeArranque({ ...e, cobro: { tipo: 'unico', meses: null } }, h).despues;
  const i = tras.findIndex((x) => x.id === 'arr-cobro');
  assert.equal(tras[i + 1]?.texto, COBRO_UNICO);
});

test('4. la nota del PDF la leen: la tabla de clientes del super admin y `ver_estado_onboarding`', () => {
  const api = sinComentarios(leer('lib/api-mako/areas/negocio.run.ts'));
  assert.match(api, /pdfNota: typeof v\.pdfNota === 'string' \? v\.pdfNota : null/);
  assert.match(api, /encuesta\?\.pdfNota \? 'encuesta\.pdfNota: /, 'MaKo no sabe qué hacer con la nota');
  // La tabla y llegadaDe: tests/onboarding-llegada-superadmin.test.ts.
});

test('5. el nombre de la persona que va al PERFIL (vacío o un email) se confirma con un toque', () => {
  for (const t of ['Gracias', 'Dale', 'Jaja', 'Hola, ¿cómo estás?']) {
    const r = responder({}, { texto: t }, CON_EMAIL);
    assert.ok(r.ok && !('nombre' in r.patch) && r.patch.nombrePorConfirmar, `«${t}» fue al perfil sin el toque: ${JSON.stringify(r)}`);
  }
  const pend: EstadoArranque = { nombrePorConfirmar: { escrito: 'Gracias', nombre: 'Gracias' } };
  assert.equal(etapaDeArranque(pend, CON_EMAIL), 'nombre', 'sin el toque no se avanza');
  const m = mensajesDeArranque(pend, CON_EMAIL).antes;
  assert.equal(m.at(-2)?.texto, 'Gracias', 'se dibuja lo que escribió');
  assert.equal(m.at(-1)?.texto, '¿Te llamo «Gracias»?');
  assert.deepEqual(m.at(-1)?.opciones, [...NOMBRE_CONFIRMAR]);
  assert.deepEqual(responder(pend, { opcion: 1, opcionTexto: NOMBRE_CONFIRMAR[1] }, CON_EMAIL), { ok: true, patch: { nombrePorConfirmar: undefined } });
  assert.deepEqual(responder(pend, { texto: 'Me llamo Ana' }, CON_EMAIL), { ok: true, patch: { nombrePorConfirmar: { escrito: 'Me llamo Ana', nombre: 'Ana' } } });
  assert.deepEqual(responder(pend, { opcion: 0, opcionTexto: NOMBRE_CONFIRMAR[0] }, CON_EMAIL), { ok: true, patch: { nombre: 'Gracias', nombrePorConfirmar: undefined } });
  // Sin la pregunta (la pantalla de antes) no confirma.
  assert.equal(leerRespuesta(pend, CON_EMAIL, { texto: 'sí' }).ok, false);
  // Con un nombre de verdad en el perfil, lo leído no va al perfil: sólo saluda, sin el toque.
  assert.deepEqual(responder({}, { texto: 'Soy Ana' }), { ok: true, patch: { nombre: 'Ana' } });
  // Y al perfil va SÓLO lo confirmado: la ruta escribe `patch.nombre`, que sale recién con el toque.
  assert.match(leer('app/api/onboarding/arranque/route.ts'), /if \(patch\.nombre\) await guardarNombre\(patch\.nombre\);/);
});

test('6. la caja única: el ➤ que se vuelve micrófono no graba con el segundo toque, y en el onboarding nada se junta mientras MaKo contesta', () => {
  const caja = sinComentarios(leer('app/_chat/CajaChat.tsx'));
  // Justo después de mandar, un instante sin micrófono (grabar y dictar).
  assert.match(caja, /const MS_MISMO_GESTO = 600;/);
  assert.match(caja, /if \(habia !== hayAlgo\) \{\s*setHabia\(hayAlgo\);\s*setRecien\(habia && !hayAlgo\);\s*\}/);
  assert.match(caja, /onClick=\{\(\) => void grabacion\.start\(\)\} disabled=\{quieto \|\| recien \|\| !!p\.voz\?\.apagada\}/);
  assert.match(caja, /<BotonMandar [\s\S]*?apagado=\{apagado \|\| recien\}/);
  // El onboarding no deja grabar ni sumar archivos mientras MaKo contesta: su respuesta puede cerrar la etapa.
  const offer = sinComentarios(leer('app/offer/OfferApp.tsx'));
  assert.match(offer, /puede: !!sesion && !ocupado,/);
  assert.match(offer, /rotuloEnviar: 'Enviar audio', apagada: ocupado,/);
});

// ROTURAS (21/10/2026, romper.js + roturas-quinta.json del scratchpad; con onboarding-pdf-confirmar,
// onboarding-llegada-superadmin, onboarding-toque-que-confirma, onboarding-preguntas, onboarding-nombre-negocio y
// onboarding-cierre-florencia; base 37/0), 19 de 19: sin pendiente la palabra de acuerdo se corta → 36/1 · un nombre
// presentado se corta igual → 36/1 · «el nombre es» queda en el nombre → 35/2 · sin la pregunta, «La pregunta cambió» en
// bucle → 35/2 · lo anual sin su periodo → 36/1 · lo anual propuesto como mensual → 36/1 · un sí guarda lo anual → 36/1 ·
// el PDF leído con reglas → 35/2 · «No está mal» es un no → 36/1 · el toque del PDF al revés → 35/2 · MaKo no lee la nota
// → 36/1 · llegadaDe sin la nota sola → 36/1 · la tabla sin la nota → 36/1 · el nombre al perfil sin el toque → 35/2 · sin
// la pregunta del toque del nombre → 35/2 · el toque del nombre sin la pregunta vale → 36/1 · el doble toque graba → 36/1 ·
// se graba mientras MaKo contesta → 36/1 · el «+» mientras MaKo contesta → 36/1.
