// =============================================================================
// La aplicación a MaKo Accelerator (16/11/2026): el formulario de /accelerator/aplicar, su ruta y lo que le llega a Martín
// =============================================================================
// Martín, 16/11/2026: «yo no pondría el botón de agendar llamada, sino justamente el botón de aplicar ahora. Y ahí pondría
// justamente un formulario… El formulario evidentemente tiene que funcionar… deberías mandarme el formulario… para que lo pueda
// ver». Lo que se fija acá:
//   · LAS REGLAS (lib/aplicacion-accelerator.ts): cada tipo de campo, la trampa, un índice fuera de rango, lo muy largo, quién
//     califica (la tabla) y la agenda ya contestada, con los textos EXACTOS de la agenda de Martín;
//   · EL BORRADOR Y LA CAMPAÑA (app/accelerator/aplicar/reglas.ts y origen.ts);
//   · LA RUTA, ENTERA (tests/_aplicacion-accelerator-hijo.ts, en un node aparte): el origen, los topes, el tamaño, la trampa, el
//     lead, su historial, «Quieren entrar», el correo a Martín (escapado) y que nunca se pierde una aplicación; sin leer la sesión;
//   · EL REGISTRO: pública y de escritura EXACTA, la página sólo se lee, sin el cromo de la app, y no abre la app de iPhone;
//   · EL FORMULARIO, MONTADO en un DOM (jsdom): los errores al tocar «Siguiente», el borrador, el POST a `API_APLICAR`, la agenda
//     SÓLO si califica, el campo que marca el servidor, y la aplicación enviada que vuelve;
//   · LA PÁGINA y lo que lee el visitante: en «tú», sin «nuestro equipo» ni «te contactaremos», sin «garantía».
//
// ⚠️ CORRE EN UN DOM (jsdom, que viene en node_modules sin sus tipos, como tests/admin-polar-armazon.test.ts): toca globales
//    (window, document, fetch). Ninguna comparación es sobre un nodo de jsdom: sólo textos, números y booleanos.
// Correr: node --import tsx --test tests/aplicacion-accelerator.test.ts
// PROBADO ROMPIÉNDOLO: la tabla del pie.
// =============================================================================

import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AGENDA_DE_LA_LLAMADA, API_APLICAR, CAMPOS, LARGO_MAXIMO, OPCIONES_DECISION, OPCIONES_EMPEZAR, RUTA_APLICAR, SECCIONES, TOPE_AGENDA,
  aplicacionEnTexto, arrobaDeInstagram, califica, campo, enUnRenglon, errorDelCampo, leerAplicacion, linkDeLaAgenda, type Respuestas,
} from '../lib/aplicacion-accelerator';
import { PROGRAMA_ACELERADOR } from '../lib/planes-mako';
import {
  CLAVE_BORRADOR, CLAVE_ENVIADA, VIGENCIA_BORRADOR_MS, VIGENCIA_ENVIADA_MS, borradorLimpio, enUnaColumna, enviadaLimpia,
  enviadaParaGuardar, filasDeLaSeccion, origenDelReferer, pasoQueVale,
} from '../app/accelerator/aplicar/reglas';
import { CLAVES_ORIGEN, origenDeLaUrl } from '../app/accelerator/aplicar/origen';
import { esPublica, esPublicaDeEscritura, esPublicaSoloLeer } from '../lib/rutas-publicas';
import { esRutaDeVenta } from '../lib/tienda';
import { SIN_APP, aasaCon } from '../scripts/tiendas-asociar.mjs';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** El fuente sin sus comentarios: lo que el código HACE, no lo que cuenta. */
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

// ─── El DOM, ANTES de cargar react-dom (decide al cargarse si hay DOM) ────────────────────────────────────────────────────────
type Ventana = Window & typeof globalThis;
const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: new (h: string, o: { url: string; pretendToBeVisual?: boolean }) => { window: Ventana } };
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://hola-mako.com/accelerator/aplicar', pretendToBeVisual: true });
const g = globalThis as unknown as Record<string, unknown>;
for (const k of ['window', 'self', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLButtonElement', 'HTMLFormElement',
  'Node', 'Element', 'Event', 'MouseEvent', 'KeyboardEvent', 'FocusEvent', 'InputEvent', 'CustomEvent', 'MessageEvent', 'MutationObserver',
  'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  g[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
g.IS_REACT_ACT_ENVIRONMENT = true;
// jsdom no mueve la página: lo que mueve, que no rompa.
dom.window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
dom.window.scrollTo = (() => {}) as typeof window.scrollTo;

/** Una aplicación entera y válida, de quien califica. */
const LLENA: Respuestas = {
  nombre: 'Ana', apellido: 'Pérez', whatsapp: '+54 9 11 5555 0101', email: 'ana@estudioana.com',
  negocio: 'Estudio Ana', rubro: 0, red: 'instagram.com/ana.coach', antiguedad: 3, clientes: 2, ticket: 2, audiencia: 1,
  facturacion: 1, equipo: 1, implementa: 0, situacion: 0, canal: [0, 2], tecnologia: 1,
  queHaces: 'Acompaño a coaches de salud a armar su programa grupal.', meta: 'Llegar a US$ 20.000 por mes con el programa.',
  obstaculo: 'Consigo clientes sólo por referidos, sin un sistema.', porQue: 'Porque ya validé la oferta con 14 clientes.',
  horas: 1, inversion: 1, decision: 0, empezar: 0, compromiso: true,
};

// =============================================================================
// LAS REGLAS
// =============================================================================

test('1. cada tipo de campo: lo vacío, lo corto, lo largo y lo que vale', () => {
  const nombre = campo('nombre');
  assert.equal(errorDelCampo(nombre, ''), 'Completa este campo.');
  assert.equal(errorDelCampo(nombre, '  A  '), 'Completa este campo.', 'una letra no es un nombre');
  assert.equal(errorDelCampo(nombre, 'Ana'), null);
  assert.match(errorDelCampo(nombre, 'x'.repeat(LARGO_MAXIMO.texto + 1)) ?? '', /muy largo/);
  const email = campo('email');
  assert.equal(errorDelCampo(email, ''), 'Escribe tu email.');
  assert.match(errorDelCampo(email, 'ana@sin-punto') ?? '', /no parece válido/);
  assert.equal(errorDelCampo(email, ' Ana@Estudio.com '), null);
  const wa = campo('whatsapp');
  assert.equal(errorDelCampo(wa, ''), 'Escribe tu WhatsApp.');
  assert.match(errorDelCampo(wa, '11 1234 5678'.slice(0, 7)) ?? '', /código de país/, 'un número a medias');
  assert.equal(errorDelCampo(wa, '+54 9 11 1234-5678'), null);
  assert.match(errorDelCampo(wa, '+'.repeat(LARGO_MAXIMO.whatsapp + 1)) ?? '', /muy largo/);
  // El ejemplo, con espacios que no cortan: en el teléfono se partía en «+54 9 / 11 1234 5678».
  assert.ok((errorDelCampo(wa, '12345') ?? '').includes(['+54', '9', '11', '1234', '5678'].join(String.fromCharCode(0xa0))), 'el ejemplo del número se parte en dos renglones');
  const red = campo('red');
  assert.equal(red.obligatorio, false);
  assert.equal(errorDelCampo(red, ''), null, 'la red social es opcional');
  assert.match(errorDelCampo(red, `instagram.com/${'a'.repeat(LARGO_MAXIMO.link)}`) ?? '', /muy largo/);
  const largo = campo('meta');
  assert.match(errorDelCampo(largo, '') ?? '', /preparo la llamada/);
  assert.equal(errorDelCampo(largo, 'Vender más.'), 'Cuéntame un poco más.', 'con una frase de diez letras no se prepara una llamada');
  assert.equal(errorDelCampo(largo, 'Llegar a US$ 20.000 por mes.'), null);
  assert.match(errorDelCampo(largo, 'a'.repeat(LARGO_MAXIMO.largo + 1)) ?? '', /hasta 2000/);
  const una = campo('facturacion');
  assert.equal(errorDelCampo(una, undefined), 'Elige una opción.');
  assert.equal(errorDelCampo(una, una.opciones!.length), 'Elige una opción.', 'un índice fuera de rango');
  assert.equal(errorDelCampo(una, 1.5), 'Elige una opción.');
  assert.equal(errorDelCampo(una, 0), null);
  const varias = campo('canal');
  assert.equal(errorDelCampo(varias, []), 'Elige al menos una opción.');
  assert.equal(errorDelCampo(varias, [0, 0]), 'Elige al menos una opción.', 'repetida');
  assert.equal(errorDelCampo(varias, [0, 99]), 'Elige al menos una opción.', 'fuera de rango');
  assert.equal(errorDelCampo(varias, [0, 2, 5]), null);
  const confirmo = campo('compromiso');
  assert.match(errorDelCampo(confirmo, false) ?? '', /confírmalo/);
  assert.equal(errorDelCampo(confirmo, true), null);
  // Las 6 secciones del molde de Mastery Haus, con sus 26 campos, y cada opción una sola vez en su campo.
  assert.deepEqual(SECCIONES.map((s) => s.titulo), ['Tus datos', 'Tu negocio', 'Facturación y equipo', 'Tu situación hoy', 'Tu diagnóstico', 'Tu aplicación']);
  assert.equal(CAMPOS.length, 26);
  for (const c of CAMPOS) if (c.opciones) assert.equal(new Set(c.opciones).size, c.opciones.length, `${c.id}: una opción repetida`);
});

test('2. leerAplicacion: la trampa, un índice fuera de rango, lo muy largo, y las opciones se guardan como TEXTO', () => {
  assert.deepEqual(leerAplicacion({ respuestas: LLENA, web: 'https://spam.example' }), { ok: false, error: 'bot', bot: true });
  const fuera = leerAplicacion({ respuestas: { ...LLENA, facturacion: 7 } });
  assert.equal(fuera.ok, false);
  assert.equal(!fuera.ok && fuera.campo, 'facturacion');
  assert.match(!fuera.ok ? fuera.error : '', /^Facturación por mes \(últimos 3 meses\): Elige una opción\.$/, 'el error nombra el campo');
  const comoTexto = leerAplicacion({ respuestas: { ...LLENA, facturacion: '1' } });
  assert.equal(!comoTexto.ok && comoTexto.campo, 'facturacion', 'una opción como texto no se acepta: viaja como índice');
  const largo = leerAplicacion({ respuestas: { ...LLENA, porQue: 'a'.repeat(LARGO_MAXIMO.largo + 1) } });
  assert.equal(!largo.ok && largo.campo, 'porQue');
  const sinCompromiso = leerAplicacion({ respuestas: { ...LLENA, compromiso: 'true' } });
  assert.equal(!sinCompromiso.ok && sinCompromiso.campo, 'compromiso', 'el «confirmo» es true, no un texto');
  assert.equal(leerAplicacion(null).ok, false);
  assert.equal(leerAplicacion([LLENA]).ok, false);

  const ok = leerAplicacion({ respuestas: { ...LLENA, email: ' Ana@EstudioAna.COM ', otraCosa: 'se ignora' }, web: '' });
  assert.ok(ok.ok);
  const a = ok.aplicacion;
  assert.deepEqual([a.nombre, a.apellido, a.email, a.whatsapp, a.califica], ['Ana', 'Pérez', 'ana@estudioana.com', '5491155550101', true]);
  const r = (id: string) => a.respuestas.find((x) => x.id === id)?.respuesta;
  assert.equal(r('facturacion'), 'Entre US$ 5.000 y 10.000', 'el servidor guarda el TEXTO de la opción, no el índice');
  assert.equal(r('canal'), 'Contenido en redes · Referidos y boca en boca');
  assert.equal(r('whatsapp'), '+5491155550101');
  assert.equal(r('compromiso'), 'Sí');
  assert.ok(!a.respuestas.some((x) => x.id === 'otraCosa'));
  const texto = aplicacionEnTexto(a);
  assert.match(texto, /^CALIFICA para agendar ya/);
  for (const s of SECCIONES) assert.ok(texto.includes(s.titulo.toUpperCase()), `falta la sección ${s.titulo} en el texto`);
});

test('3. califica: factura más de US$ 5.000 por mes, con clientes y oferta validada, y puede invertir (la tabla)', () => {
  assert.equal(califica(LLENA), true);
  const casos: Array<[string, Partial<Respuestas>, boolean]> = [
    ['factura menos de US$ 5.000', { facturacion: 0 }, false],
    ['factura más de US$ 60.000', { facturacion: 4 }, true],
    ['sin clientes todavía', { clientes: 0 }, false],
    ['tiene clientes, desordenado (la oferta ya vende)', { situacion: 1 }, true],
    ['no sabe qué vende', { situacion: 2 }, false],
    ['está validando la oferta', { situacion: 3 }, false],
    ['puede de contado', { inversion: 0 }, true],
    ['lo tendría que conseguir', { inversion: 2 }, false],
    ['hoy no puede invertir', { inversion: 3 }, false],
    ['sin contestar la facturación', { facturacion: undefined }, false],
  ];
  for (const [que, cambio, espera] of casos) assert.equal(califica({ ...LLENA, ...cambio }), espera, que);
  // Lo demás no decide: el equipo, las horas, el rubro.
  assert.equal(califica({ ...LLENA, equipo: 0, horas: 3, rubro: 5 }), true);
});

test('4. la agenda ya contestada: el teléfono en a1, el @ en a2, y en a6 y a7 los textos EXACTOS de la agenda de Martín', () => {
  // Leídos el 16/11/2026 en la consulta pública de Calendly (calendly.com/api/booking/event_types/lookup?event_type_slug=asesoria&
  // profile_slug=koncke, `custom_fields`): con otro texto, la agenda no los marca. Si Martín los cambia allá, cámbialos acá.
  assert.deepEqual([...OPCIONES_DECISION], ['Sí, soy la única persona que toma decisiones en mi negocio.', 'No, necesito consultar con alguien más (invítalo a la llamada).']);
  assert.deepEqual([...OPCIONES_EMPEZAR], ['De inmediato: estoy listo para arrancar ya', 'La próxima semana: sólo ajusto agenda', 'El próximo mes: estoy planeando arranque', 'En 2-3 meses: tengo barreras que resolver antes']);
  assert.equal(AGENDA_DE_LA_LLAMADA, 'https://calendly.com/koncke/asesoria');
  const link = linkDeLaAgenda({ ...LLENA, decision: 1, empezar: 3 });
  assert.ok(link.startsWith(`${AGENDA_DE_LA_LLAMADA}?`));
  const q = new URL(link).searchParams;
  assert.equal(q.get('name'), 'Ana Pérez');
  assert.equal(q.get('email'), 'ana@estudioana.com');
  assert.equal(q.get('a1'), '+5491155550101', 'el WhatsApp, con su +');
  assert.equal(q.get('a2'), '@ana.coach', 'el @ de Instagram, sacado del link');
  assert.equal(q.get('a3'), 'Llegar a US$ 20.000 por mes con el programa. Lo que me frena hoy: Consigo clientes sólo por referidos, sin un sistema.', 'la meta y lo que la frena, en UN renglón');
  assert.equal(q.get('a4'), 'Si');
  assert.equal(q.get('a5'), 'Entre $1000 y $3000');
  assert.equal(q.get('a6'), 'No, necesito consultar con alguien más (invítalo a la llamada).');
  assert.equal(q.get('a7'), 'En 2-3 meses: tengo barreras que resolver antes');
  assert.equal(q.get('embed_domain'), null, 'sin `embed`, es el link para otra pestaña');
  // Adentro de la página: el dominio que la muestra.
  const adentro = new URL(linkDeLaAgenda(LLENA, { embed: 'hola-mako.com' })).searchParams;
  assert.deepEqual([adentro.get('embed_domain'), adentro.get('embed_type'), adentro.get('a6'), adentro.get('a7')],
    ['hola-mako.com', 'Inline', OPCIONES_DECISION[0], OPCIONES_EMPEZAR[0]]);
  // Quien no puede invertir: «No», y el monto no se adivina. Lo que no contestó, no se marca.
  const no = new URL(linkDeLaAgenda({ nombre: 'Ana', inversion: 3 })).searchParams;
  assert.deepEqual([no.get('a4'), no.get('a5'), no.get('a1'), no.get('a6')], ['No', null, null, null]);
  // LOS TOPES DE SU FORMULARIO (medidos el 16/11/2026 con las respuestas cargadas, sin agendar): el @ y «¿Qué quieres lograr…?»
  // son de UNA línea con `maxlength="255"`, el nombre admite 155. Por el link no los frena el `maxlength` (sólo frena al que
  // escribe): la meta de 600 caracteres entraba entera, y sus saltos se borraban y pegaban las frases.
  assert.deepEqual([TOPE_AGENDA.nombre, TOPE_AGENDA.linea], [155, 255]);
  assert.equal(enUnRenglon('Una idea.\n\nOtra   idea.', 50), 'Una idea. Otra idea.');
  assert.equal(enUnRenglon('uno dos tres cuatro', 12), 'uno dos…', 'se corta en una palabra, con «…»');
  const largo = new URL(linkDeLaAgenda({
    ...LLENA, nombre: 'N'.repeat(120), apellido: 'A'.repeat(120), red: `https://youtube.com/${'c'.repeat(280)}`,
    meta: `Primera idea.\n\nSegunda idea, ${'muy larga '.repeat(60)}`, obstaculo: `Lo que\nme frena ${'mucho '.repeat(80)}`,
  })).searchParams;
  const a3 = largo.get('a3') ?? '';
  assert.doesNotMatch(a3, /\n/, 'a3 es de una línea: un salto se borra al dibujarse y pega las frases');
  assert.ok(a3.length <= TOPE_AGENDA.linea && a3.endsWith('…'), `a3 mide ${a3.length}: más que el tope de la agenda`);
  assert.match(a3, /^Primera idea\. Segunda idea, muy larga muy larga/);
  assert.ok((largo.get('a2') ?? '').length <= TOPE_AGENDA.linea, 'a2 pasa del tope de la agenda');
  assert.ok((largo.get('name') ?? '').length <= TOPE_AGENDA.nombre, 'el nombre pasa del tope de la agenda');
  // Sin punto al final de la meta, se le pone antes de seguir; sin meta, lo que frena solo.
  assert.equal(new URL(linkDeLaAgenda({ meta: 'Llegar a 20 clientes', obstaculo: 'El tiempo' })).searchParams.get('a3'), 'Llegar a 20 clientes. Lo que me frena hoy: El tiempo');
  assert.equal(new URL(linkDeLaAgenda({ obstaculo: 'El tiempo' })).searchParams.get('a3'), 'Lo que me frena hoy: El tiempo');
  // El @ de un link: el usuario, no la publicación (instagram.com/p/… daba «@p»).
  assert.equal(arrobaDeInstagram('https://www.instagram.com/ana.coach/'), '@ana.coach');
  assert.equal(arrobaDeInstagram('instagram.com/ana'), '@ana');
  assert.equal(arrobaDeInstagram('https://www.instagram.com/p/Cx12AbC/'), 'https://www.instagram.com/p/Cx12AbC/');
  assert.equal(arrobaDeInstagram('https://youtube.com/@ana'), 'https://youtube.com/@ana');
});

test('5. el borrador: se limpia, vence, no retoma en un paso con uno anterior a medias; la aplicación enviada vuelve una semana', () => {
  const ahora = Date.now();
  const b = borradorLimpio({ v: 1, paso: 5, r: { ...LLENA, rubro: 99, canal: [0, 0, 7, 2], otra: 'x', nombre: 'A'.repeat(500) }, t: ahora }, ahora);
  assert.ok(b);
  assert.equal(b.respuestas.rubro, undefined, 'un índice que no existe se tira');
  assert.deepEqual(b.respuestas.canal, [0, 2]);
  assert.equal(b.respuestas.otra, undefined);
  assert.equal(String(b.respuestas.nombre).length, LARGO_MAXIMO.texto);
  assert.equal(b.paso, 1, 'el rubro quedó sin contestar: retoma en «Tu negocio», no en el paso 6');
  assert.equal(borradorLimpio({ v: 1, paso: 5, r: LLENA, t: ahora }, ahora)?.paso, 5);
  assert.equal(borradorLimpio({ v: 1, paso: 5, r: LLENA, t: ahora - VIGENCIA_BORRADOR_MS - 1 }, ahora), null, 'vencido');
  assert.equal(borradorLimpio({ v: 2, paso: 0, r: LLENA, t: ahora }, ahora), null, 'de otra versión');
  assert.equal(borradorLimpio({ v: 1, paso: 0, r: { otra: 'x' }, t: ahora }, ahora), null, 'nada que retomar');
  assert.equal(borradorLimpio('{"v":1}', ahora), null);
  assert.equal(pasoQueVale(LLENA, 99), SECCIONES.length - 1);
  assert.equal(pasoQueVale({}, 3), 0);
  const e = enviadaLimpia({ v: 1, califica: true, r: LLENA, t: ahora - 1000 }, ahora);
  assert.equal(e?.califica, true);
  assert.equal(e?.agendada, false, 'sin el aviso de Calendly, no agendó');
  assert.equal(enviadaLimpia(JSON.parse(enviadaParaGuardar(true, LLENA, ahora, true)), ahora)?.agendada, true);
  assert.equal(enviadaLimpia({ v: 1, califica: false, agendada: true, r: LLENA, t: ahora }, ahora)?.agendada, false, 'sin calificar no hay agenda: un «agendada» no se cree');
  assert.equal(enviadaLimpia({ v: 1, califica: true, r: LLENA, t: ahora - VIGENCIA_ENVIADA_MS - 1 }, ahora), null, 'una semana');
  assert.equal(enviadaLimpia({ v: 1, califica: 'si', r: LLENA, t: ahora }, ahora), null);
  assert.notEqual(CLAVE_BORRADOR, CLAVE_ENVIADA);
  // Cómo se dibuja: nombre y apellido juntos, WhatsApp y email juntos; las opciones largas en una columna.
  assert.deepEqual(filasDeLaSeccion(SECCIONES[0]).map((f) => f.map((c) => c.id)), [['nombre', 'apellido'], ['whatsapp', 'email']]);
  assert.equal(enUnaColumna(campo('situacion')), true);
  assert.equal(enUnaColumna(campo('facturacion')), false);
});

test('6. la campaña: de la URL y, si no trae, de la página anterior del MISMO sitio', () => {
  assert.deepEqual(origenDeLaUrl({ utm_source: 'fb', utm_campaign: ['a', 'b'], fbclid: 'IwAR1', otra: 'x', landing: 'Accelerator' }),
    { utm_source: 'fb', fbclid: 'IwAR1', landing: 'accelerator' });
  assert.equal(origenDeLaUrl({}), null);
  const claves = [...CLAVES_ORIGEN];
  assert.deepEqual(origenDelReferer('https://hola-mako.com/accelerator?utm_source=ig&utm_content=reel1&x=1', 'https://hola-mako.com/accelerator/aplicar', claves),
    { utm_source: 'ig', utm_content: 'reel1' });
  assert.equal(origenDelReferer('https://otro-sitio.com/?utm_source=ig', 'https://hola-mako.com/accelerator/aplicar', claves), null, 'de otro sitio, no');
  assert.equal(origenDelReferer('', 'https://hola-mako.com/accelerator/aplicar', claves), null);
});

// =============================================================================
// LA RUTA, ENTERA (en un node aparte, sobre una base de mentira)
// =============================================================================

let ruta: Record<string, any> | null = null; // eslint-disable-line @typescript-eslint/no-explicit-any
function laRuta() {
  if (ruta) return ruta;
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_aplicacion-accelerator-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
  ruta = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length));
  return ruta!;
}

test('7. la ruta: sólo desde un host de MaKo, con tope de tamaño; la trampa y lo que está mal no dejan nada', () => {
  const R = laRuta();
  assert.deepEqual([R.otroSitio.status, R.sinOrigin.status], [403, 403], 'un POST desde otro sitio, o sin Origin, no entra');
  assert.deepEqual(R.trampa, { status: 200, body: { ok: true, califica: false } }, 'el bot ve lo mismo que quien no califica');
  assert.deepEqual([R.whatsappMal.status, R.whatsappMal.body.campo], [400, 'whatsapp']);
  assert.deepEqual([R.indiceFuera.status, R.indiceFuera.body.campo], [400, 'facturacion']);
  assert.deepEqual([R.muyLargaCampo.status, R.muyLargaCampo.body.campo], [400, 'meta']);
  assert.deepEqual([R.cuerpoDeclaradoGrande.status, R.cuerpoGrande.status], [413, 413], 'el tope del cuerpo: lo que dice que mide y lo que midió');
  assert.equal(R.noEsJson.status, 400);
  assert.equal(R.nadaNuevo, true, 'ni la trampa ni un pedido rechazado dejan un lead, un historial, un pedido o un correo');
});

test('8. la ruta guarda el lead, la aplicación ENTERA en su historial, «Quieren entrar» y el correo a Martín (escapado)', () => {
  const R = laRuta();
  assert.deepEqual(R.califica, { status: 200, body: { ok: true, califica: true } });
  assert.deepEqual(R.noCalifica, { status: 200, body: { ok: true, califica: false } });
  assert.deepEqual(R.lead[0], {
    nombre: 'Ana Pérez', email: 'ana@estudioana.com', telefono: '+5491155550101', origen_lead: 'landing', utm_source: 'fb', utm_campaign: 'acc-nov', fbclid: 'IwAR123',
  });
  const h = R.historial.find((x: { lead: number; campo: string }) => x.lead === 1 && x.campo === 'Aplicación');
  assert.ok(h, 'la aplicación no quedó en el historial de la ficha');
  assert.equal(h.autor, `Formulario de ${PROGRAMA_ACELERADOR.nombre}`);
  assert.match(h.valor, /^CALIFICA para agendar ya/);
  for (const s of ['TUS DATOS', 'TU NEGOCIO', 'FACTURACIÓN Y EQUIPO', 'TU SITUACIÓN HOY', 'TU DIAGNÓSTICO', 'TU APLICACIÓN']) assert.ok(h.valor.includes(s), s);
  assert.ok(h.valor.includes('· Facturación por mes (últimos 3 meses): Entre US$ 5.000 y 10.000'));
  assert.ok(h.valor.includes('Acompaño a coaches de salud a armar su programa grupal.\n\nY lo venden'), 'la respuesta larga, con sus párrafos');
  assert.deepEqual(R.pedido[0], {
    email: 'ana@estudioana.com', nombre: 'Ana Pérez', origen: 'planes', detalle: `Aplicó a ${PROGRAMA_ACELERADOR.nombre}: califica para agendar ya`,
    whatsapp: '5491155550101', lead_id: 1,
  });
  // El correo: a la casilla de Martín, con el nombre y si califica en el asunto, todo el texto, de dónde vino y su ficha.
  const c = R.correo;
  assert.equal(c.to, 'equipo@hola-mako.com');
  assert.equal(c.asunto, `Ana Pérez aplicó a ${PROGRAMA_ACELERADOR.nombre} · califica`);
  assert.match(c.cuerpo, /De dónde vino: la landing «accelerator» · utm_source: fb · utm_campaign: acc-nov · un anuncio de Meta \(fbclid\)\./);
  assert.match(c.cuerpo, /WhatsApp: \+5491155550101 · https:\/\/wa\.me\/5491155550101/);
  assert.ok(c.cuerpo.includes(h.valor), 'el correo no trae la aplicación entera');
  assert.match(c.cuerpo, /Su ficha en el CRM de MaKo:\nhttps?:\/\/\S+\/crm\/1\?ws=9$/);
  assert.match(R.correoNoCalifica.asunto, / · no califica$/);
  assert.match(R.correoNoCalifica.cuerpo, /^NO califica para agendar ya/m);
  assert.match(R.correoNoCalifica.cuerpo, /De dónde vino: entró directo, sin campaña\./);
  // Lo que escribe cualquiera en un formulario público llega al correo como TEXTO, nunca como HTML.
  assert.ok(R.html.includes('Me frena &lt;script&gt;alert(1)&lt;/script&gt; y &lt;img src=x onerror=alert(2)&gt;'), 'el HTML de la respuesta no se escapó');
  assert.ok(!/<script>alert|<img src=x/i.test(R.html), 'una etiqueta de la respuesta llegó viva al correo');
});

test('9. los topes: por email (4 por hora) y por IP (10 por hora)', () => {
  const R = laRuta();
  assert.deepEqual(R.porEmail, [200, 200, 200, 200, 429]);
  assert.deepEqual(R.porIp, [200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 429]);
});

test('10. nunca se pierde: con el correo caído, ok; con la base caída y el correo que sale, ok y lo dice; sin ninguno, 503', () => {
  const R = laRuta();
  assert.deepEqual(R.conElCorreoCaido.body, { ok: true, califica: true });
  assert.equal(R.leadSinCorreo, true);
  assert.deepEqual(R.conLaBaseCaida.body, { ok: true, califica: true });
  assert.match(R.correoSinBase[0], /No se pudo guardar en el CRM de MaKo: este correo es la única copia de la aplicación\.$/);
  assert.deepEqual(R.conTodoCaido, { status: 503, body: { error: R.textoNoSeGuardo } });
  assert.match(R.textoNoSeGuardo, /lo que escribiste sigue guardado/);
});

test('11. sin sesión: la ruta y lo que guarda no leen la cookie ni piden la sesión', () => {
  const R = laRuta();
  assert.equal(R.lecturasDeSesion, 0);
  for (const f of ['app/api/accelerator/aplicar/route.ts', 'lib/aplicacion-accelerator-servidor.ts', 'app/accelerator/aplicar/page.tsx']) {
    const s = sinComentarios(leer(f));
    assert.doesNotMatch(s, /cookies\(|req\.cookies|getSesion|getUsuarioActual|headers\(\)/, `${f} lee la sesión o la cookie`);
  }
  const r = sinComentarios(leer('app/api/accelerator/aplicar/route.ts'));
  assert.match(r, /origenDelPago\(req\.headers\.get\('origin'\)/);
  assert.match(r, /limitePorIp\(/);
  assert.match(r, /limitePorClave\(/);
  assert.doesNotMatch(r, /export (async )?function (GET|PUT|PATCH|DELETE)\b/, 'sólo POST');
});

// =============================================================================
// EL REGISTRO
// =============================================================================

test('12. pública y de escritura EXACTA; la página sólo se lee, sin el cromo de la app, y no abre la app de iPhone', async () => {
  assert.equal(API_APLICAR, '/api/accelerator/aplicar');
  assert.equal(RUTA_APLICAR, '/accelerator/aplicar');
  assert.equal(esPublica(API_APLICAR), true);
  assert.equal(esPublicaDeEscritura(API_APLICAR), true);
  assert.equal(esPublicaSoloLeer(API_APLICAR), false);
  assert.equal(esPublicaDeEscritura(`${API_APLICAR}/x`), false, 'exacta: una subruta no hereda el permiso de escribir');
  assert.equal(esPublica('/api/accelerator/otra'), false);
  assert.equal(esPublica(RUTA_APLICAR), true);
  assert.equal(esPublicaSoloLeer(RUTA_APLICAR), true, 'una página pública que acepta POST ejecuta server actions sin sesión');
  // El proxy de verdad, con el gate activo: el POST del formulario pasa sin sesión (el Origin lo mira la ruta); un POST a la
  // página, no.
  process.env.AUTH_SECRET ??= 'secreto-de-prueba-de-la-aplicacion-0123456789abcdef';
  const { proxy } = await import('../proxy');
  const { NextRequest } = await import('next/server');
  const pedir = (metodo: string, url: string) => proxy(new NextRequest(`https://hola-mako.com${url}`, {
    method: metodo, headers: { host: 'hola-mako.com', origin: 'https://hola-mako.com', 'content-type': 'application/json' }, ...(metodo === 'GET' ? {} : { body: '{}' }),
  }));
  const pasa = (r: Response) => r.headers.get('x-middleware-next') === '1' || r.headers.has('x-middleware-rewrite');
  assert.equal(pasa(pedir('POST', API_APLICAR)), true, 'el proxy corta el POST del formulario');
  assert.equal(pasa(pedir('GET', RUTA_APLICAR)), true, 'el proxy corta la página');
  assert.equal(pedir('POST', RUTA_APLICAR).status, 405);
  // Sin el cromo de la app (los avisos, el título «MaKo - …» y los pollers): es una página de afuera.
  const { isPublicLandingPath } = await import('../app/_components/PublicRouteGate');
  assert.equal(isPublicLandingPath(RUTA_APLICAR), true);
  assert.equal(isPublicLandingPath('/acceleratorx'), false);
  // Vende: no abre la app de iPhone (lib/tienda.ts y el archivo de Apple, regenerado con el mismo Team ID).
  assert.equal(esRutaDeVenta(RUTA_APLICAR), true);
  assert.ok((SIN_APP as string[]).includes('/accelerator/*'));
  const apple = JSON.parse(leer('public/.well-known/apple-app-site-association'));
  assert.deepEqual(apple, aasaCon('99V2VV9FP2'), 'public/.well-known/apple-app-site-association no es el que arma scripts/tiendas-asociar.mjs');
});

// =============================================================================
// EL FORMULARIO, MONTADO
// =============================================================================

type Pedido = { url: string; metodo: string; cuerpo: Record<string, unknown> };
const pedidos: Pedido[] = [];
let respuesta: { status: number; body: unknown } | 'sin-red' = { status: 200, body: { ok: true, califica: true } };
g.fetch = async (url: string, init: RequestInit = {}) => {
  pedidos.push({ url: String(url), metodo: String(init.method), cuerpo: JSON.parse(String(init.body)) });
  if (respuesta === 'sin-red') throw new TypeError('Failed to fetch');
  return new Response(JSON.stringify(respuesta.body), { status: respuesta.status, headers: { 'content-type': 'application/json' } });
};

/**
 * Lo montado se desmonta SIEMPRE, también si el test falla a la mitad: sin esto, un formulario que quedaba montado (con su iframe)
 * tiraba el archivo entero y los tests de después ni se informaban (16/11/2026, probándolo roto).
 */
const montados = new Map<{ unmount(): void }, HTMLElement>();
async function desmontarUno(root: { unmount(): void }, cont: HTMLElement) {
  if (!montados.delete(root)) return;
  const React = await import('react');
  await React.act(async () => { root.unmount(); cont.remove(); });
}
afterEach(async () => {
  for (const [root, cont] of [...montados]) await desmontarUno(root, cont);
});

async function montar() {
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { FormularioAplicacion } = await import('../app/accelerator/aplicar/FormularioAplicacion');
  const cont = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(cont);
  const root = createRoot(cont);
  montados.set(root, cont);
  await React.act(async () => {
    root.render(React.createElement(FormularioAplicacion, { origen: { utm_source: 'fb' }, clavesOrigen: [...CLAVES_ORIGEN], rutaPlanes: '/planes' }));
  });
  const q = <T extends Element = HTMLElement>(sel: string) => cont.querySelector(sel) as T | null;
  const esperar = (ms = 0) => React.act(async () => { await new Promise((r) => setTimeout(r, ms)); });
  return {
    cont, q,
    texto: () => cont.textContent ?? '',
    errores: () => cont.querySelectorAll('.apl-error').length,
    foco: () => dom.window.document.activeElement?.id ?? '',
    escribir: async (id: string, v: string) => {
      const el = cont.querySelector(`#apl-${id}`) as HTMLInputElement | HTMLTextAreaElement;
      const proto = el.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
      await React.act(async () => {
        Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, v);
        el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      });
    },
    elegir: async (id: string, i: number) => React.act(async () => { (cont.querySelector(`input[name="${id}"][value="${i}"]`) as HTMLInputElement).click(); }),
    siguiente: async () => { await React.act(async () => { (cont.querySelector('.apl-nav button[type="submit"]') as HTMLButtonElement).click(); }); await esperar(5); },
    esperar,
    desmontar: async () => { await desmontarUno(root, cont); },
  };
}
const guardar = (clave: string, v: unknown) => dom.window.localStorage.setItem(clave, JSON.stringify(v));
const guardado = (clave: string) => JSON.parse(dom.window.localStorage.getItem(clave) ?? 'null');

test('13. los errores aparecen al tocar «Siguiente» (con el foco en el primero), se corrigen en vivo, y el borrador se guarda', async () => {
  dom.window.localStorage.clear();
  const f = await montar();
  assert.match(f.texto(), /Paso 1 de 6 · Tus datos/);
  assert.equal(f.errores(), 0, 'sin tocar «Siguiente», ningún error');
  await f.siguiente();
  assert.equal(f.errores(), 4);
  assert.match(f.texto(), /Paso 1 de 6/, 'con errores no avanza');
  assert.equal(f.foco(), 'apl-nombre', 'el foco va al primer campo con error');
  assert.equal(f.q('#apl-nombre')?.getAttribute('aria-invalid'), 'true');
  assert.equal(f.q('#apl-nombre')?.getAttribute('aria-describedby'), 'apl-nombre-error');
  assert.match(f.q('[role="status"][aria-live="polite"]')?.textContent ?? '', /Revisa los 4 campos marcados\./);
  await f.escribir('nombre', 'Ana');
  assert.equal(f.errores(), 3, 'después del primer intento, los errores se corrigen en vivo');
  await f.escribir('apellido', 'Pérez');
  await f.escribir('whatsapp', '+54 9 11 5555 0101');
  await f.escribir('email', 'ana@estudioana.com');
  assert.equal(f.errores(), 0);
  await f.siguiente();
  assert.match(f.texto(), /Paso 2 de 6 · Tu negocio/);
  assert.equal(f.foco(), 'apl-titulo-paso', 'en un paso nuevo, el foco va a su título');
  assert.equal(f.q('input[name="rubro"]')?.getAttribute('type'), 'radio', 'una opción es un radio de verdad');
  assert.ok(f.q('fieldset legend'), 'las opciones van en un fieldset con su legend');
  const b = guardado(CLAVE_BORRADOR);
  assert.deepEqual([b.v, b.paso, b.r.nombre, b.r.email], [1, 1, 'Ana', 'ana@estudioana.com'], 'el borrador se guarda en el navegador');
  // Atrás vuelve con lo escrito.
  await f.elegir('rubro', 2);
  await clicEn(f, '.apl-atras');
  assert.match(f.texto(), /Paso 1 de 6/);
  assert.equal((f.q('#apl-nombre') as HTMLInputElement | null)?.value, 'Ana');
  await f.desmontar();
});

/** Un clic en un botón cualquiera del formulario (Atrás, Empezar de nuevo). */
async function clicEn(f: Awaited<ReturnType<typeof montar>>, sel: string) {
  const React = await import('react');
  await React.act(async () => { (f.q(sel) as HTMLButtonElement).click(); });
  await f.esperar(5);
}

test('14. «Enviar aplicación» postea a API_APLICAR { respuestas, web, origen }, y la agenda aparece SÓLO si califica', async () => {
  // Califica: retoma del borrador en el último paso, manda, y la agenda de Martín se abre ADENTRO, con lo que escribió.
  dom.window.localStorage.clear();
  guardar(CLAVE_BORRADOR, { v: 1, paso: 5, r: LLENA, t: Date.now() });
  pedidos.length = 0;
  respuesta = { status: 200, body: { ok: true, califica: true } };
  const f = await montar();
  assert.match(f.texto(), /Paso 6 de 6 · Tu aplicación/, 'retoma donde lo dejó');
  assert.match(f.texto(), /Lo que habías escrito sigue aquí/);
  assert.match(f.q('.apl-nav button[type="submit"]')?.textContent ?? '', /Enviar aplicación/);
  // Dos «Enter» seguidos (antes de que el botón se deshabilite) mandan UNA aplicación.
  const { act: actuar } = await import('react');
  await actuar(async () => {
    const form = f.q<HTMLFormElement>('form.apl-tarjeta')!;
    form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  });
  await f.esperar(10);
  assert.equal(pedidos.length, 1, 'el doble envío mandó dos aplicaciones');
  assert.equal(pedidos[0].url, API_APLICAR);
  assert.equal(pedidos[0].metodo, 'POST');
  assert.deepEqual(Object.keys(pedidos[0].cuerpo).sort(), ['origen', 'respuestas', 'web']);
  assert.deepEqual(pedidos[0].cuerpo.origen, { utm_source: 'fb' });
  assert.equal(pedidos[0].cuerpo.web, '');
  assert.deepEqual(pedidos[0].cuerpo.respuestas, LLENA, 'viajan las respuestas tal cual: las opciones como índices');
  assert.match(f.q('h1')?.textContent ?? '', /^¡Gracias, Ana!$/);
  assert.match(f.texto(), /Por lo que me cuentas, tiene sentido que hablemos\. Elige el día y la hora de tu llamada conmigo:/);
  const iframe = f.q('.apl-agenda iframe');
  assert.ok(iframe, 'quien califica no ve la agenda');
  const src = iframe.getAttribute('src') ?? '';
  assert.ok(src.startsWith(`${AGENDA_DE_LA_LLAMADA}?`));
  const q = new URL(src).searchParams;
  assert.deepEqual([q.get('embed_domain'), q.get('a1'), q.get('a6'), q.get('a7')], ['hola-mako.com', '+5491155550101', OPCIONES_DECISION[0], OPCIONES_EMPEZAR[0]]);
  assert.ok(iframe.getAttribute('title'), 'el iframe sin título');
  const aparte = f.q<HTMLAnchorElement>('.apl-agenda-pie a');
  assert.match(aparte?.textContent ?? '', /Ábrela aquí/);
  assert.equal(aparte?.getAttribute('target'), '_blank');
  assert.equal(new URL(aparte?.getAttribute('href') ?? '').searchParams.get('embed_domain'), null, 'el link de otra pestaña va sin `embed`');
  assert.equal(f.foco(), '', 'el foco va al título (sin id): no se queda en el botón que ya no existe');
  assert.equal(dom.window.document.activeElement?.tagName, 'H1');
  assert.equal(guardado(CLAVE_BORRADOR), null, 'enviada bien, el borrador se borra');
  assert.equal(guardado(CLAVE_ENVIADA)?.califica, true);
  // Calendly avisa su alto: la agenda lo toma (sin barra adentro). Los avisos de otro origen, no.
  const { act } = await import('react');
  const avisar = (origin: string, data: unknown) => act(async () => { dom.window.dispatchEvent(new dom.window.MessageEvent('message', { origin, data })); });
  await avisar('https://otro.com', { event: 'calendly.page_height', payload: { height: '1500px' } });
  await avisar('https://calendly.com', { event: 'calendly.page_height', payload: { height: '26px' } });
  assert.equal(f.q('.apl-agenda iframe')?.getAttribute('style') ?? null, null, 'un alto de otro origen, o el de mientras carga, no se toma');
  await avisar('https://otro.com', { event: 'calendly.event_scheduled', payload: {} });
  assert.doesNotMatch(f.texto(), /quedó agendada/, 'un aviso de otro origen no agenda');
  assert.equal(guardado(CLAVE_ENVIADA)?.agendada, undefined);
  await avisar('https://calendly.com', { event: 'calendly.page_height', payload: { height: '927px' } });
  await avisar('https://calendly.com', { event: 'calendly.event_scheduled', payload: {} });
  assert.equal(f.q('.apl-agenda iframe')?.getAttribute('style'), 'height: 927px;');
  assert.match(f.q('[role="status"] .apl-agendada')?.textContent ?? '', /^¡Listo! Te llegó la confirmación por email/, 'el «¡Listo!», adentro de su región viva');
  assert.equal(f.q('.apl-fin-texto')?.textContent, 'Tu llamada conmigo ya quedó agendada.', 'agendada, arriba ya no dice «elige el día y la hora»');
  assert.doesNotMatch(f.texto(), /sólo elige el horario/, 'agendada, la nota de elegir el horario se va');
  assert.ok(f.q('.apl-agenda iframe'), 'recién agendada, la agenda sigue: ahí Calendly muestra el día y la hora');
  assert.equal(guardado(CLAVE_ENVIADA)?.agendada, true, 'el aviso de Calendly no quedó guardado: al volver, agendaría otra vez');
  await f.desmontar();

  // Vuelve a entrar DESPUÉS de agendar: su llamada ya está agendada, y SIN la agenda (no agenda dos).
  const ya = await montar();
  assert.match(ya.q('h1')?.textContent ?? '', /^¡Gracias, Ana!$/);
  assert.match(ya.texto(), /Tu llamada conmigo ya quedó agendada\./);
  assert.equal(ya.q('iframe') === null, true, 'ya agendó y vuelve a ver la agenda: podría agendar dos llamadas');
  await ya.desmontar();

  // Vuelve a entrar sin haber elegido horario: su agenda otra vez, sin llenar nada. Y «Empezar de nuevo» la borra.
  guardar(CLAVE_ENVIADA, { v: 1, califica: true, r: LLENA, t: Date.now() });
  const otra = await montar();
  assert.ok(otra.q('.apl-agenda iframe'), 'la aplicación enviada no volvió a su agenda');
  await clicEn(otra, '.apl-otra button');
  assert.match(otra.texto(), /Paso 1 de 6/);
  assert.equal((otra.q('#apl-nombre') as HTMLInputElement | null)?.value, '');
  assert.equal(guardado(CLAVE_ENVIADA), null);
  await otra.desmontar();

  // No califica: «la leo personalmente», y NINGUNA agenda.
  dom.window.localStorage.clear();
  guardar(CLAVE_BORRADOR, { v: 1, paso: 5, r: { ...LLENA, facturacion: 0 }, t: Date.now() });
  respuesta = { status: 200, body: { ok: true, califica: false } };
  const n = await montar();
  await n.siguiente();
  await n.esperar(10);
  assert.match(n.q('h1')?.textContent ?? '', /^¡Gracias, Ana!$/);
  assert.match(n.texto(), /Recibí tu aplicación\. La leo personalmente y, si hay match, te escribo por WhatsApp\./);
  assert.equal(n.q('iframe') === null, true, 'quien no califica ve una agenda');
  assert.doesNotMatch(n.cont.innerHTML, /calendly/i);
  assert.equal(n.q<HTMLAnchorElement>('.apl-mako a')?.getAttribute('href'), '/planes', 'el link suave a los planes de MaKo');
  await n.desmontar();
});

test('15. lo que marca el servidor vuelve a su paso; sin red, lo dice y no se pierde nada', async () => {
  dom.window.localStorage.clear();
  guardar(CLAVE_BORRADOR, { v: 1, paso: 5, r: LLENA, t: Date.now() });
  respuesta = { status: 400, body: { error: 'WhatsApp: Ese número no parece completo.', campo: 'whatsapp' } };
  const f = await montar();
  await f.siguiente();
  await f.esperar(10);
  assert.match(f.texto(), /Paso 1 de 6 · Tus datos/, 'no volvió al paso del campo que marcó el servidor');
  assert.equal(f.foco(), 'apl-whatsapp');
  assert.equal(f.q('#apl-whatsapp')?.getAttribute('aria-invalid'), 'true');
  assert.match(f.q('#apl-whatsapp-error')?.textContent ?? '', /^Ese número no parece completo\.$/, 'el texto del servidor, sin el nombre del campo adelante');
  await f.escribir('whatsapp', '+54 9 11 5555 0102');
  assert.equal(f.q('#apl-whatsapp-error') === null, true, 'cambiado el valor, el error del servidor se va');
  await f.desmontar();

  guardar(CLAVE_BORRADOR, { v: 1, paso: 5, r: LLENA, t: Date.now() });
  respuesta = 'sin-red';
  const s = await montar();
  await s.siguiente();
  await s.esperar(10);
  assert.match(s.q('.apl-aviso-error[role="status"][aria-live="assertive"]')?.textContent ?? '', /No se pudo conectar\. Revisa tu internet/);
  assert.match(s.texto(), /Paso 6 de 6/);
  assert.ok(guardado(CLAVE_BORRADOR), 'sin red, el borrador sigue');
  respuesta = { status: 503, body: { error: 'No se pudo enviar tu aplicación. Prueba otra vez en un minuto: lo que escribiste sigue guardado.' } };
  await s.siguiente();
  await s.esperar(10);
  assert.match(s.q('.apl-aviso-error[role="status"][aria-live="assertive"]')?.textContent ?? '', /Prueba otra vez en un minuto/);
  await s.desmontar();
  respuesta = { status: 200, body: { ok: true, califica: true } };
});

// =============================================================================
// LA PÁGINA Y LO QUE LEE EL VISITANTE
// =============================================================================

async function paginaDibujada(sp: Record<string, string> = {}): Promise<string> {
  const React = await import('react');
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: Pagina } = await import('../app/accelerator/aplicar/page');
  return renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve(sp) }));
}

test('16. la página: noindex, dinámica, sin cookies ni <Suspense>; la barra del programa, el formulario y el pie del sitio', async () => {
  const pagina = await import('../app/accelerator/aplicar/page');
  assert.equal(pagina.metadata.title, `Aplica a ${PROGRAMA_ACELERADOR.nombre}`);
  assert.deepEqual(pagina.metadata.robots, { index: false, follow: false });
  assert.equal(pagina.dynamic, 'force-dynamic');
  // Una página sólo exporta lo suyo (Next rechaza otro export al compilar).
  assert.deepEqual(Object.keys(pagina).sort(), ['default', 'dynamic', 'metadata', 'revalidate']);
  const fuente = sinComentarios(leer('app/accelerator/aplicar/page.tsx'));
  assert.doesNotMatch(fuente, /Suspense|next\/headers/);
  const html = await paginaDibujada({ utm_source: 'fb' });
  assert.match(html, /<div class="acl-root apl-root">/);
  assert.match(html, /<header class="acl-hdr"><a class="acl-hdr-marca" href="\/"/, 'la estrella de MaKo vuelve a la portada');
  assert.match(html, /<a class="acl-hdr-link" href="\/planes">Ver planes<\/a><a class="acl-btn acl-btn-sm" href="\/accelerator">El programa<\/a>/, 'la vuelta al programa');
  assert.match(html, /Paso 1 de 6/);
  assert.match(html, /<span class="acl-pill">Aplicación<\/span><h1>MaKo <em>Accelerator<\/em><\/h1>/);
  assert.equal(html.split('<footer class="s-pie">').length - 1, 1, 'el pie del sitio, una vez');
  assert.ok(html.includes('class="apl-trampa"') && html.includes('id="apl-web"'), 'el campo trampa');
  // Sin JavaScript no se manda: un <form> sin `action` iría por GET a esta URL, con el nombre, el email y el WhatsApp en la barra.
  assert.match(html, /<form class="apl-tarjeta"[^>]*\smethod="post"/, 'sin `method="post"`, un envío sin JavaScript va por GET con los datos en la URL');
  assert.match(html, /<button type="submit" class="acl-btn" disabled="">Siguiente/, 'el botón tiene que nacer deshabilitado hasta que el formulario despierte');
  assert.match(sinComentarios(leer('app/accelerator/aplicar/FormularioAplicacion.tsx')), /fetch\(API_APLICAR, \{\s*method: 'POST'/);
  // El CSS del formulario no se pisa con el resto de la app: todo lleva `apl-`.
  const { CSS_APLICAR } = await import('../app/accelerator/aplicar/estilo');
  const selectores = CSS_APLICAR.replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\("[^"]*"\)/g, '');
  const sueltas = [...selectores.matchAll(/\.([a-z][\w-]*)/g)].map((m) => m[1]).filter((c) => !/^(apl|acl)-/.test(c));
  assert.deepEqual([...new Set(sueltas)], [], 'una clase sin el prefijo apl- (o acl- de la landing)');
  assert.ok(!CSS_APLICAR.includes('`'));
  // ⚠️ NINGUNA COMPARACIÓN CON UN NODO DE JSDOM, ni en este archivo: si falla, el reporte inspecciona el nodo entero (con su
  // ventana) y el proceso se come la memoria. Pasó el 16/11/2026: `assert.equal(n.q('iframe'), null)` con la agenda rota tardaba
  // 35 a 100 s, tiraba el archivo sin decir por qué, y fue lo que corría cuando la PC se quedó sin memoria. Sólo booleanos y textos.
  const nodosComparados = sinComentarios(leer('tests/aplicacion-accelerator.test.ts')).match(/assert\.(equal|notEqual|deepEqual|strictEqual)\(\s*\w+\.q(<[^>]*>)?\([^)]*\)\s*,/g);
  assert.deepEqual(nodosComparados, null, 'un nodo de jsdom en un assert: si falla, se come la memoria');
  assert.match(CSS_APLICAR, /\.apl-input \{[^}]*font-size: 17px/, 'con menos de 16 px el iPhone agranda la página al tocar el campo');
  // El gris tenue de la landing (#7C766C) daba 4,28:1 en la nota y 3,86:1 sobre la tarjeta (medido el 16/11/2026): el del
  // formulario da 4,9:1 o más. Lo mínimo para texto chico es 4,5:1.
  assert.match(CSS_APLICAR, /--apl-tenue: #8E887E;/);
  assert.doesNotMatch(CSS_APLICAR, /var\(--acl-muted\)|#67635c/i, 'el gris de la landing no llega a 4,5:1 en el formulario');
  assert.match(CSS_APLICAR, /prefers-reduced-motion: reduce/);
});

test('17. lo que lee el visitante: en «tú», sin «nuestro equipo» ni «te contactaremos», y ninguna garantía', async () => {
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PantallaFinal } = await import('../app/accelerator/aplicar/FormularioAplicacion');
  const final = (c: boolean, yaAgendada = false) => renderToStaticMarkup(React.createElement(PantallaFinal, {
    nombre: 'Ana', califica: c, yaAgendada, agenda: c && !yaAgendada ? linkDeLaAgenda(LLENA, { embed: 'x' }) : '', agendaAparte: c && !yaAgendada ? linkDeLaAgenda(LLENA) : '', rutaPlanes: '/planes',
  }));
  assert.doesNotMatch(final(true, true), /<iframe/, 'ya agendada, sin la agenda');
  const preguntas = SECCIONES.flatMap((s) => [s.titulo, s.bajada ?? '', ...s.campos.flatMap((c) => [c.rotulo, c.ayuda ?? '', c.placeholder ?? '', ...(c.opciones ?? [])])]);
  const errores = CAMPOS.flatMap((c) => [errorDelCampo(c, undefined), errorDelCampo(c, c.tipo === 'largo' ? 'corto' : 'x')]).filter(Boolean);
  const literales = (f: string) => [...sinComentarios(leer(f)).matchAll(/'([^'\n]*[a-záéíóúñ][^'\n]*)'/gi)].map((m) => m[1]);
  const visible = [
    await paginaDibujada(), final(true), final(false), final(true, true), ...preguntas, ...errores,
    ...literales('app/api/accelerator/aplicar/route.ts'), ...literales('lib/aplicacion-accelerator-servidor.ts').filter((t) => /aplicación|intenta|Prueba/.test(t)),
    ...literales('app/accelerator/aplicar/FormularioAplicacion.tsx'),
  ].join('\n').replace(/<[^>]+>/g, ' ');
  for (const [mal, por] of [
    [/nuestro equipo|el equipo te|nuestros consultores/i, 'Martín no tiene equipo: habla él, en primera persona'],
    [/te contactaremos|nos pondremos en contacto|te escribiremos/i, 'en primera persona: «te escribo»'],
    [/garant[ií]a|garantizad/i, 'ninguna garantía en ninguna parte'],
    [/sin tope/i, '«Ilimitado», nunca «sin tope»'],
    // Sin `\b`: en JavaScript (sin la bandera u) la «í» y la «á» no son letras, y `\belegí\b` no encontraba «Elegí tu horario».
    [/(?<!\p{L})(vos|tenés|querés|podés|contanos|escribinos|elegí|completá|revisá|contá|agendá|aplicá|probá|tocá|mirá)(?!\p{L})/iu, 'en «tú», no en «vos»'],
  ] as const) assert.doesNotMatch(visible, mal, por);
  // Y con el generador del guard del repo (lib/voseo.ts: las formas salen de los verbos, no de una lista a mano). Ese guard lista
  // con `git ls-files`: estos archivos, nuevos y sin `git add`, no los revisa (docs/hallazgos-pruebas.md, 13/11).
  const { marcasDeVoseo } = await import('../lib/voseo');
  assert.deepEqual(marcasDeVoseo(visible), [], 'voseo en lo que lee quien aplica');
  assert.match(visible, /Leo cada aplicación personalmente/);
  assert.match(visible, /te escribo por WhatsApp/);
});

// =============================================================================
// PROBADO ROMPIÉNDOLO (16/11/2026; base 17 / 0). Cada rotura, restaurada; entre paréntesis, los tests que se pusieron rojos:
//   · el mínimo de una respuesta larga baja a 5 (1) · sin el campo trampa (2, 7) · califica con cualquier facturación (3, 8)
//   · la decisión viaja como índice a la agenda (4, 14) · el @ de una publicación vuelve a ser «@p» (4) · el borrador no vence (5)
//   · retoma en el paso guardado con uno anterior a medias (5) · la campaña se toma de cualquier sitio (6)
//   · la ruta acepta cualquier Origin (7) · sin tope de tamaño (7) · la aplicación no queda en el historial (8)
//   · «Quieren entrar» sin decir si califica (8) · el tope por email sube a 40 (9) · con la base caída, 503 aunque el correo salió (10)
//   · la ruta lee la cookie (11) · fuera de PUBLICOS_ESCRITURA (12) · la página con el cromo de la app (12) · abre la app de iPhone (12)
//   · «Siguiente» no marca los errores (13) · el foco no va al primer error (13) · el POST sin el origen (14)
//   · el campo que marca el servidor no vuelve a su paso (15) · sin el pie del sitio (16) · la página se indexa (16)
//   · «te contactaremos» (14, 17) · el botón nace habilitado (16) · el formulario sin method="post" (16) · sin la guarda del doble
//     envío (14) · la aplicación enviada no se guarda (14) · la agenda aunque no califique, rotas las DOS guardas (14)
//   · a3 con saltos y sin tope (4) · a3 sin el tope de 255 (4) · el nombre sin el de 155 (4) · a2 sin el de 255 (4) · la meta sin
//     punto antes de lo que la frena (4) · `enUnRenglon` no junta los espacios (4)
//   · el aviso de Calendly no se guarda (14) · quien ya agendó ve la agenda otra vez (14, 17) · un «agendada» sin calificar se cree (5)
//   · un aviso de otro origen cuenta (14) · el «¡Listo!» fuera de su región viva (14) · al agendar, el texto sigue en «Elige el día»
//     (14) · al agendar, la nota «sólo elige el horario» se queda (14) · «elegí» en la pantalla (17) · «decime» en la pantalla (17:
//     lo ve `marcasDeVoseo`, no la lista a mano) · el ejemplo del WhatsApp sin espacios duros (1) · el gris de la landing en la
//     nota (16) · un nodo de jsdom en un `assert.equal` (16)
//   El control: con el `\b` de antes y «elegí» en la pantalla, 17 / 0 (no lo veía). Y en tests/compra-plan-lead.test.ts, el
//   checkout que deja de firmar «Checkout de MaKo» (3).
// =============================================================================
