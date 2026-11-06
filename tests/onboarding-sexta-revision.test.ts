// =============================================================================
// La sexta revisión del Cerebro (a0cdcfcc6, 21/10/2026): el toque del PDF, y lo que quedaba alrededor
// =============================================================================
// docs/hallazgos-onboarding.md, «Una confirmación con la polaridad al revés que la pregunta anterior no se puede leer con
// DICE_SI». Lo nuevo de la quinta («¿Lo tomo como que falta algo?») invertía el sí: «Está perfecto» o «👍» se anotaban
// como corrección. Ahora la pregunta tiene la misma polaridad que «¿está correcto?», repite lo escrito, y ahí valen sólo
// los dos botones y un sí o un no pelados; lo demás se SUMA a la nota. Y un «no» sin nada escrito deja marca igual.
// Los bajos: el cobro anual en cuotas, el nombre que llegaba a los reportes, nombres que empiezan con «Su» o «Mi», «No,
// Pedro» con un nombre esperando, «Sí, no» con la persona como negocio, el «+» vacío y el CSV con fórmulas.
//
// ROTURAS: ver el final del archivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  NOMBRE_CONFIRMAR, PDF_BIEN, PDF_FALTA, PDF_SIN_DETALLE, cobroDelPrecio, etapaDeArranque, etiquetaCobro, leerRespuesta,
  mensajesDeArranque, notaDelPdf, pdfConfirmarPregunta, type EstadoArranque, type HechosArranque, type Respuesta,
} from '../lib/onboarding-arranque';
import { preguntaQueContesta } from '../app/onboarding/arranque-ui';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: 'Simón Pérez', nombreWorkspace: '', faseGuardada: false,
  canalNegocio: null, loQueVende: true, conCrm: true, conTelefono: false, terminado: false,
};
const CON_EMAIL: HechosArranque = { ...H, nombreCuenta: 'ana@gmail.com' };
const E: EstadoArranque = { nombre: 'Simón', negocio: 'Acme' };
const CAMBIO = { ok: false, error: 'La pregunta cambió.', cambio: true };
/** Como la pantalla: con la pregunta que contesta. */
const responder = (e: EstadoArranque, r: Respuesta, h = H) => leerRespuesta(e, h, { ...preguntaQueContesta(mensajesDeArranque(e, h)), ...r });

test('1. el toque del PDF tiene la misma polaridad que «¿está correcto?», repite lo escrito, y lo que dice que está bien no se anota como corrección', () => {
  assert.deepEqual(responder(E, { texto: 'Todo perfecto' }), { ok: true, patch: { pdfEscritas: ['Todo perfecto'] } });
  const P: EstadoArranque = { ...E, pdfEscritas: ['Todo perfecto'] };
  const m = mensajesDeArranque(P, H).despues.at(-1);
  assert.equal(m?.texto, pdfConfirmarPregunta('Todo perfecto'));
  assert.match(m?.texto ?? '', /^Escribiste «Todo perfecto»\. ¿Lo tomo como que está todo bien\?$/);
  assert.deepEqual(m?.opciones, [PDF_BIEN, PDF_FALTA], 'el sí primero, como en «¿está correcto?»');
  // Antes: las 20 daban pdfOk 'no' con la nota «Todo perfecto». Ahora ninguna decide: se suman y se vuelve a preguntar.
  for (const t of ['Está perfecto', 'Así está bien', 'Está bien así', 'Muy bien', 'Mejor así', 'Genial', 'Listo', 'Gracias', 'Sí, falta la garantía']) {
    const r = responder(P, { texto: t });
    assert.deepEqual(r, { ok: true, patch: { pdfEscritas: ['Todo perfecto', t] } }, `«${t}»`);
  }
  // Los botones y un sí o un no pelados deciden, con la polaridad de la pregunta.
  assert.deepEqual(responder(P, { opcion: 0, opcionTexto: PDF_BIEN }), { ok: true, patch: { pdfOk: 'si' } });
  assert.deepEqual(responder(P, { texto: 'Sí.' }), { ok: true, patch: { pdfOk: 'si' } });
  assert.deepEqual(responder(P, { texto: 'no' }), { ok: true, patch: { pdfOk: 'no' } });
  assert.equal(notaDelPdf({ ...P, pdfOk: 'si' }), null, '«Todo perfecto» no es una corrección');
});

test('2. «Sí, <detalle>» se SUMA a la corrección, no la pisa, y las dos quedan dibujadas', () => {
  const P: EstadoArranque = { ...E, pdfEscritas: ['Todo bien salvo el precio, que es 200 USD'] };
  const r = responder(P, { texto: 'Sí, el precio' });
  assert.deepEqual(r, { ok: true, patch: { pdfEscritas: ['Todo bien salvo el precio, que es 200 USD', 'Sí, el precio'] } });
  const tras: EstadoArranque = { ...P, ...(r.ok ? r.patch : {}) };
  const textos = mensajesDeArranque(tras, H).despues.map((x) => x.texto);
  assert.ok(textos.includes('Todo bien salvo el precio, que es 200 USD'), 'la corrección original desapareció');
  assert.equal(textos.at(-2), 'Sí, el precio');
  assert.equal(textos.at(-1), pdfConfirmarPregunta('Sí, el precio'));
  assert.equal(etapaDeArranque(tras, H), 'pdf');
  assert.equal(notaDelPdf({ ...tras, pdfOk: 'no' }), 'Todo bien salvo el precio, que es 200 USD · Sí, el precio', 'el 200 USD se perdía');
});

test('3. la pregunta del toque lleva lo escrito: un toque de una pestaña vieja no confirma otro texto', () => {
  const vio = preguntaQueContesta(mensajesDeArranque({ ...E, pdfEscritas: ['Todo perfecto'] }, H));
  const server: EstadoArranque = { ...E, pdfEscritas: ['Falta la garantía de 30 días'] };
  assert.deepEqual(leerRespuesta(server, H, { opcion: 0, opcionTexto: PDF_BIEN, ...vio }), CAMBIO);
  assert.deepEqual(leerRespuesta(server, H, { texto: 'sí', ...vio }), CAMBIO);
  // Una nota larga se acorta en la pregunta, y sigue distinguiéndose.
  assert.ok(pdfConfirmarPregunta('x'.repeat(300)).length < 120);
});

test('4. un «no» al PDF siempre deja marca: sin nada escrito, «sin detalle», y MaKo sabe que tiene que preguntar', () => {
  for (const r of [{ opcion: 1, opcionTexto: 'No, faltan cosas o hay algo mal' }, { texto: 'No' }, { texto: 'Incorrecto' }] as Respuesta[]) {
    const l = responder(E, r);
    assert.deepEqual(l, { ok: true, patch: { pdfOk: 'no' } }, JSON.stringify(r));
    assert.equal(notaDelPdf({ ...E, ...(l.ok ? l.patch : {}) }), PDF_SIN_DETALLE);
  }
  assert.match(leer('lib/onboarding-arranque-server.ts'), /const pdfNota = notaDelPdf\(e\);/);
  const api = sinComentarios(leer('lib/api-mako/areas/negocio.run.ts'));
  assert.match(api, /Si la nota no dice QUÉ falta o qué está mal \(«sin detalle», «No me convence», «Falta algo»\), pregúntale antes de corregir nada\./);
});

test('5. el cobro: las cuotas se leen antes que lo anual', () => {
  for (const [p, meses] of [['Programa anual: 12 cuotas de USD 99', 12], ['Mentoría anual en 12 pagos mensuales de USD 100', 12], ['USD 1.200 anuales, se puede pagar en 6 cuotas', 6]] as const) {
    assert.deepEqual(cobroDelPrecio(p), { tipo: 'suscripcion', meses }, p);
  }
  // Y se propone con «Sí, es eso»: la suscripción de 12 meses se puede cargar.
  const h: HechosArranque = { ...H, cobroLeido: cobroDelPrecio('Programa anual: 12 cuotas de USD 99') };
  const e: EstadoArranque = { ...E, pdfOk: 'si' };
  const m = mensajesDeArranque(e, h).despues.at(-1);
  assert.match(m?.texto ?? '', new RegExp(`«${etiquetaCobro({ tipo: 'suscripcion', meses: 12 })}»`));
  assert.equal(m?.opciones?.[0], 'Suscripción de 12 meses', 'la leída va primera (novena revisión)');
  assert.deepEqual(responder(e, { opcion: 0, opcionTexto: 'Suscripción de 12 meses' }, h), { ok: true, patch: { cobro: { tipo: 'suscripcion', meses: 12 } } });
  // Lo anual puro sigue sin proponerse.
  assert.equal(cobroDelPrecio('Membresía anual USD 400').periodo, 'anual');
});

test('6. el contacto de los reportes toma el nombre del PERFIL, no lo leído sin toque', () => {
  const ruta = sinComentarios(leer('app/api/onboarding/arranque/route.ts'));
  assert.match(ruta, /nombre: previo\?\.nombre \|\| \(!pisaElNombreDelPerfil\(perfil\?\.nombre\) \? perfil\?\.nombre : ''\) \|\| e\.nombre \|\| undefined,/);
});

test('7. un nombre que el corte deja vacío («Su Lin», «Mi Young») se propone con el toque, con cualquier perfil', () => {
  for (const [t, nombre] of [['Su Lin', 'Su Lin'], ['Mi Young', 'Mi Young'], ['Una', 'Una'], ['Tu Anh', 'Tu Anh'], ['En Wang', 'En Wang'], ['Me llamo Su', 'Su'], ['Soy Una Murphy', 'Una Murphy']]) {
    for (const h of [H, CON_EMAIL]) {
      assert.deepEqual(responder({}, { texto: t }, h), { ok: true, patch: { nombrePorConfirmar: { escrito: t, nombre } } }, `«${t}» con ${h.nombreCuenta}`);
    }
  }
  // Lo que no es un nombre sigue pidiéndose de nuevo.
  for (const t of ['¿qué tengo que poner?', 'Ok', 'Sí', 'hola']) assert.equal(responder({}, { texto: t }).ok, false, t);
  // Y con un perfil de verdad, lo que el corte entiende sólo saluda, sin el toque.
  assert.deepEqual(responder({}, { texto: 'Soy Ana' }), { ok: true, patch: { nombre: 'Ana' } });
});

test('8. con un nombre esperando: «No, Pedro» propone a Pedro, «Sí, soy Ana» y «Ana» otra vez confirman', () => {
  const P: EstadoArranque = { nombrePorConfirmar: { escrito: 'Soy Ana', nombre: 'Ana' } };
  for (const t of ['No, me llamo Pedro', 'No, Pedro', 'no soy Pedro']) {
    assert.deepEqual(responder(P, { texto: t }, CON_EMAIL), { ok: true, patch: { nombrePorConfirmar: { escrito: t, nombre: 'Pedro' } } }, t);
  }
  for (const t of ['Sí, soy Ana', 'sí, me llamo Ana', 'Ana']) {
    assert.deepEqual(responder(P, { texto: t }, CON_EMAIL), { ok: true, patch: { nombre: 'Ana', nombrePorConfirmar: undefined } }, t);
  }
  assert.deepEqual(responder(P, { texto: 'No, no' }, CON_EMAIL), { ok: true, patch: { nombrePorConfirmar: undefined } });
  assert.equal(responder(P, { texto: 'Sí, no' }, CON_EMAIL).ok, false, '«Sí, no» no es un sí');
  assert.deepEqual(responder(P, { opcion: 0, opcionTexto: NOMBRE_CONFIRMAR[0] }, CON_EMAIL), { ok: true, patch: { nombre: 'Ana', nombrePorConfirmar: undefined } });
});

test('9. «Sí, no» con la persona como nombre del negocio esperando no guarda nada', () => {
  const P: EstadoArranque = { nombre: 'Simón', negocioPorConfirmar: { escrito: 'uso mi nombre', nombre: 'Simón Pérez' } };
  for (const t of ['Sí, no', 'sí... no', 'Si no', 'Sí no']) assert.equal(responder(P, { texto: t }).ok, false, `«${t}» guardó a la persona como negocio`);
  assert.deepEqual(responder(P, { texto: 'Sí, se llama así' }), { ok: true, patch: { negocio: 'Simón Pérez', negocioPorConfirmar: undefined } });
});

test('10. la caja: sin nada que ofrecer el «+» queda apagado, y lo pegado cuando no se puede sumar se dice', () => {
  const caja = sinComentarios(leer('app/_chat/CajaChat.tsx'));
  assert.match(caja, /<MasCaja a=\{adjuntos\} apagado=\{quieto \|\| \(!adjuntos\?\.puede && !p\.mas\)\}/);
  const offer = sinComentarios(leer('app/offer/OfferApp.tsx'));
  assert.match(offer, /onNoPuede: \(\) => setErrorChat\(ocupado \? 'Espera a que MaKo conteste para sumar archivos\.'/);
});

test('11. el CSV de clientes no deja entrar una fórmula', () => {
  // Desde el 6/11/2026 el CSV de clientes es «Export Customers» de Admin › Customers (la copia de Polar; era el de AdminView).
  const lista = sinComentarios(leer('app/admin/_polar/web/Customer/CustomerListSidebar.tsx'));
  // El escape vive en el helper único de Infra (lib/csv-celda.ts; la guarda es tests/csv-una-sola-via.test.ts): el CSV de clientes lo usa.
  assert.ok(lista.includes("import { armarCsv } from '@/lib/csv-celda'"), 'la lista de clientes importa el helper único de CSV');
  assert.ok(lista.includes('const texto = armarCsv(filasDeExportacion(customers))'), 'el CSV de clientes se arma con el helper');
});

// ROTURAS (21/10/2026, romper.js + roturas-sexta.json del scratchpad; con quinta-revision, pdf-confirmar,
// toque-que-confirma, preguntas, nombre-negocio, cierre-florencia y llegada-superadmin; base 48/0), 18 de 18: el toque del
// PDF lee con DICE_SI → 47/1 · la polaridad al revés → 45/3 · lo escrito pisa la corrección → 45/3 · la pregunta del toque
// es fija → 46/2 · el «no» sin detalle no deja marca → 46/2 · el cierre no usa la nota → 46/2 · MaKo no sabe preguntar el
// detalle → 47/1 · lo anual antes que las cuotas → 47/1 · los reportes con lo leído → 47/1 · sin el nombre sin cortar →
// 47/1 · el nombre sin cortar sin el toque → 47/1 · una pregunta como nombre → 47/1 · «No, Pedro» no propone → 47/1 · el
// mismo nombre otra vez no confirma → 47/1 · «Sí, no» guarda a la persona → 47/1 · el «+» vacío → 47/1 · lo pegado se
// traga → 47/1 · el CSV con fórmulas → 47/1.
