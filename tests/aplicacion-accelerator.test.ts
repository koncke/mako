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
//   · EL FORMULARIO, MONTADO en un DOM (jsdom): los errores al tocar «Siguiente», el borrador, el POST a `API_APLICAR`, la pantalla
//     final (la MISMA para todos desde el 16/11 a la tarde: sin agenda; desde esa noche, «Tu siguiente paso» en su tarjeta, con
//     «Crear cuenta de MaKo» o «Ya tengo cuenta», o «Entrar a MaKo»), el campo que marca el servidor, la aplicación enviada que
//     vuelve, y el Instagram y el YouTube con la búsqueda de Competitor Spy;
//   · LA BÚSQUEDA DEL CANAL (tests/_aplicacion-accelerator-canal-hijo.ts): pública, en la plataforma, con sus topes;
//   · LA PÁGINA y lo que lee el visitante: en «tú» y NEUTRO en género, sin «nuestro equipo» ni «te contactaremos», sin «garantía»,
//     sin legales ni la nota de debajo del formulario, y sin una opción sola en la última fila (16/11/2026, a la noche).
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
  AGENDA_DE_LA_LLAMADA, API_APLICAR, API_CANAL, CAMPOS, LARGO_MAXIMO, OPCIONES_A4, OPCIONES_A5, OPCIONES_CUENTA, OPCIONES_DECISION, OPCIONES_EMPEZAR,
  RUTA_APLICAR, SECCIONES, SIN_RED_EN_LA_AGENDA, TEXTO_CANAL_INVALIDO, TEXTO_WHATSAPP_INCOMPLETO, TEXTO_WHATSAPP_SIN_PAIS, TOPE_AGENDA,
  aplicacionEnTexto, califica, campo, campoVisible, enUnRenglon, erroresDeLaSeccion, errorDelCampo, instagramDeLaAplicacion, leerAplicacion,
  linkDeLaAgenda, porQueNoCalifica, queBuscarDelCanal, tieneCuentaDeMako, whatsappDeLaAplicacion, youtubeDeLaAplicacion, type Respuestas,
} from '../lib/aplicacion-accelerator';
import { PROGRAMA_ACELERADOR } from '../lib/planes-mako';
import { TEXTO_FALTA_EL_AREA } from '../lib/paises';
import {
  CLAVE_BORRADOR, CLAVE_ENVIADA, ID_TRAMPA, VIGENCIA_BORRADOR_MS, VIGENCIA_ENVIADA_MS, borradorLimpio, borradorParaGuardar, enUnaColumna, enviadaLimpia,
  enviadaParaGuardar, filasDeLaSeccion, linkDeLaPrueba, origenDelReferer, pasoQueVale, telefonoDelBorrador,
} from '../app/accelerator/aplicar/reglas';
import { CLAVES_ORIGEN, hrefDelFormulario, origenDeLaUrl } from '../app/accelerator/aplicar/origen';
import { pedidoLimpio, pedidoQueVuelve } from '../lib/pedidos-ingreso-reglas';
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
  nombre: 'Ana', apellido: 'Pérez', whatsapp: '+54 9 11 5555 0101', email: 'ana@estudioana.com', cuenta: 2,
  negocio: 'Estudio Ana', rubro: 0, instagram: 'instagram.com/ana.coach', youtube: '@anacoach', antiguedad: 3, clientes: 2, ticket: 2, audiencia: 1,
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
  assert.equal(errorDelCampo(wa, '+54 12345'), TEXTO_WHATSAPP_INCOMPLETO, 'con el país pero a medias');
  // UN NÚMERO LOCAL NO PASA (revisión del 16/11/2026): sólo se contaban los dígitos y se le ponía un «+» adelante, así que cada uno
  // quedaba en otro país (México en Brasil, EE.UU. en Marruecos, Venezuela en un +0412 que no existe).
  for (const [pais, local, conPais, digitos] of [
    ['México', '55 1234 5678', '+52 55 1234 5678', '525512345678'],
    ['Colombia', '300 123 4567', '+57 300 123 4567', '573001234567'],
    ['EE.UU.', '(212) 555-1234', '+1 (212) 555-1234', '12125551234'],
    ['Argentina', '11 5555 0101', '+54 9 11 5555 0101', '5491155550101'],
    ['Venezuela', '0412 123 4567', '+58 412 123 4567', '584121234567'],
  ] as const) {
    assert.equal(errorDelCampo(wa, local), TEXTO_WHATSAPP_SIN_PAIS, `${pais}: «${local}» sin país pasó`);
    const r = leerAplicacion({ respuestas: { ...LLENA, whatsapp: local } });
    assert.equal(!r.ok && r.campo, 'whatsapp', `${pais}: el servidor aceptó «${local}» sin país`);
    assert.equal(whatsappDeLaAplicacion(conPais), digitos, `${pais}: con su país`);
    assert.equal(new URL(linkDeLaAgenda({ ...LLENA, whatsapp: local })).searchParams.get('a1'), null, `${pais}: a la agenda le llegaba el número de otro país`);
  }
  assert.equal(whatsappDeLaAplicacion('0054 9 11 5555 0101'), '5491155550101', 'con 00 también trae el país');
  assert.equal(whatsappDeLaAplicacion('‪+54 9 11 5555 0101‬'), '5491155550101', 'pegado de una app de contactos');
  assert.equal(whatsappDeLaAplicacion('+0412 123 4567'), null, 'ningún código de país empieza con 0');
  // CON +54, SIN EL CÓDIGO DE ÁREA NO PASA y se dice cuál falta (revisión del 16/11/2026, hallazgo 3); el 9 lo agrega el servidor.
  assert.equal(errorDelCampo(wa, '+54 15 2345 6789'), TEXTO_FALTA_EL_AREA, 'el 15 sin el 11 adelante');
  assert.equal(errorDelCampo(wa, '+54 5555 1234'), TEXTO_FALTA_EL_AREA, 'el número local solo');
  assert.equal(errorDelCampo(wa, '+54 11 15 2345 678'), TEXTO_WHATSAPP_INCOMPLETO, 'le falta un dígito');
  assert.equal(whatsappDeLaAplicacion('+54 15 2345 6789'), null);
  assert.equal(whatsappDeLaAplicacion('+54 11 2345 6789'), '5491123456789', 'sin el 9 (una pestaña de antes, un POST directo): el servidor lo agrega');
  const sinArea = leerAplicacion({ respuestas: { ...LLENA, whatsapp: '+54 15 2345 6789' } });
  assert.equal(!sinArea.ok && sinArea.campo, 'whatsapp', 'el servidor aceptó un WhatsApp sin código de área');
  // INSTAGRAM Y YOUTUBE, LOS DOS OPCIONALES (16/11/2026, Martín: «el link de tu Instagram y el link de tu YouTube… pero no… TikTok
  // ni LinkedIn»). Un @, el usuario solo o el link de su perfil o su canal; un nombre suelto, otra red o una publicación, no.
  const ig = campo('instagram');
  const yt = campo('youtube');
  assert.deepEqual([ig.obligatorio, yt.obligatorio, ig.red, yt.red], [false, false, 'instagram', 'youtube']);
  assert.equal(CAMPOS.some((c) => c.id === 'red'), false, 'volvió «tu red social principal»');
  assert.doesNotMatch(CAMPOS.map((c) => `${c.rotulo} ${c.ayuda ?? ''} ${c.placeholder ?? ''}`).join(' '), /tiktok|linkedin/i, 'TikTok o LinkedIn en el formulario');
  assert.equal(errorDelCampo(ig, ''), null, 'el Instagram es opcional');
  assert.equal(errorDelCampo(yt, ''), null, 'el YouTube es opcional');
  for (const [v, sale] of [
    ['@Ana.Coach', '@ana.coach'], ['ana.coach', '@ana.coach'], ['https://www.instagram.com/ana.coach/?igsh=x1', '@ana.coach'], ['instagram.com/ana', '@ana'],
    ['Ana Coach', null], ['https://www.instagram.com/p/Cx12AbC/', null], ['https://youtube.com/@ana', null], ['tiktok.com/@ana', null], ['...', null],
  ] as const) assert.equal(instagramDeLaAplicacion(v), sale, `Instagram «${v}»`);
  for (const [v, sale] of [
    ['@AnaCoach', 'https://www.youtube.com/@AnaCoach'], ['https://youtube.com/@ana', 'https://www.youtube.com/@ana'],
    ['youtube.com/channel/UC1234567890123456789012', 'https://www.youtube.com/channel/UC1234567890123456789012'],
    ['https://www.youtube.com/c/AnaCoach', 'https://www.youtube.com/c/AnaCoach'], ['https://youtu.be/dQw4w9WgXcQ', null],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', null], ['Ana Coach', null], ['instagram.com/ana', null],
  ] as const) assert.equal(youtubeDeLaAplicacion(v), sale, `YouTube «${v}»`);
  assert.equal(errorDelCampo(ig, 'Ana Coach'), TEXTO_CANAL_INVALIDO.instagram, 'un nombre suelto no es un Instagram: que elija su cuenta o escriba el @');
  assert.equal(errorDelCampo(yt, 'https://youtu.be/dQw4w9WgXcQ'), TEXTO_CANAL_INVALIDO.youtube, 'el link de un video no es el canal');
  assert.match(errorDelCampo(ig, `instagram.com/${'a'.repeat(LARGO_MAXIMO.canal)}`) ?? '', /muy largo/);
  // ¿YA TIENE CUENTA EN MaKo? Y su email, sólo si es otro: escondido, ni se valida ni se guarda.
  assert.deepEqual([...OPCIONES_CUENTA], ['Sí, con este mismo email', 'Sí, con otro email', 'Todavía no']);
  const otro = campo('emailCuenta');
  assert.deepEqual([campoVisible(otro, { cuenta: 0 }), campoVisible(otro, { cuenta: 1 }), campoVisible(otro, { cuenta: 2 }), campoVisible(otro, {})], [false, true, false, false]);
  assert.deepEqual(Object.keys(erroresDeLaSeccion(SECCIONES[0], { ...LLENA, cuenta: 1 })), ['emailCuenta'], 'con «otro email», el email de la cuenta es obligatorio');
  assert.deepEqual(Object.keys(erroresDeLaSeccion(SECCIONES[0], { ...LLENA, cuenta: 0 })), [], 'con «este mismo email», no se pide');
  assert.deepEqual([tieneCuentaDeMako({ cuenta: 0 }), tieneCuentaDeMako({ cuenta: 1 }), tieneCuentaDeMako({ cuenta: 2 }), tieneCuentaDeMako({})], [true, true, false, false]);
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
  // Las 6 secciones del molde de Mastery Haus, con sus 29 campos, y cada opción una sola vez en su campo.
  assert.deepEqual(SECCIONES.map((s) => s.titulo), ['Tus datos', 'Tu negocio', 'Facturación y equipo', 'Tu situación hoy', 'Tu diagnóstico', 'Tu aplicación']);
  assert.equal(CAMPOS.length, 29);
  // SIN CUOTAS (16/11/2026, Martín: «elimínalo bien en el formulario. Sería sí de contado o sí en cuotas»).
  const inv = campo('inversion');
  assert.equal(inv.rotulo, `${PROGRAMA_ACELERADOR.nombre} cuesta US$ 1.500 ${PROGRAMA_ACELERADOR.periodo}. Si hay match, ¿puedes invertirlo?`);
  assert.deepEqual(inv.opciones!.slice(0, 2), ['Sí, de contado', 'Sí, en cuotas']);
  assert.doesNotMatch(CAMPOS.flatMap((c) => [c.rotulo, ...(c.opciones ?? [])]).join(' '), /\d\s*cuotas|cuotas de/i, 'el formulario dice cuántas cuotas o de cuánto');
  for (const c of CAMPOS) if (c.opciones) assert.equal(new Set(c.opciones).size, c.opciones.length, `${c.id}: una opción repetida`);
});

test('2. leerAplicacion: la trampa, un índice fuera de rango, lo muy largo, los caracteres de control, y las opciones se guardan como TEXTO', () => {
  // La trampa llena con una aplicación válida SE LEE (revisión del 16/11/2026): la ruta se la manda a Martín como «Posible bot».
  const trampa = leerAplicacion({ respuestas: LLENA, web: 'https://spam.example' });
  assert.deepEqual([trampa.ok, !trampa.ok && trampa.bot, !trampa.ok && trampa.aplicacion?.email], [false, true, 'ana@estudioana.com']);
  assert.deepEqual(leerAplicacion({ respuestas: { ...LLENA, facturacion: 9 }, web: 'x' }), { ok: false, error: 'bot', bot: true }, 'con la trampa llena, el error de un campo no se le dice al bot');
  // Un \u0000 pegado de un PDF: Postgres no lo guarda en un `text`, y el lead y «Quieren entrar» fallaban. Se va; los saltos, no.
  const control = leerAplicacion({ respuestas: { ...LLENA, nombre: 'An\u0000a', meta: 'Llegar a\u0007 US$ 20.000\npor mes con el programa.' } });
  assert.ok(control.ok);
  assert.equal(control.aplicacion.nombre, 'Ana');
  assert.equal(control.aplicacion.respuestas.find((x) => x.id === 'meta')?.respuesta, 'Llegar a US$ 20.000\npor mes con el programa.');
  assert.ok(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(aplicacionEnTexto(control.aplicacion)), 'un carácter de control llegó al texto que se guarda');
  assert.equal(errorDelCampo(campo('nombre'), '\u0000\u0001'), 'Completa este campo.', 'sólo caracteres de control: vacío');
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
  assert.equal(r('instagram'), '@ana.coach', 'el Instagram, como su @');
  assert.equal(r('youtube'), 'https://www.youtube.com/@anacoach', 'el YouTube, como el link del canal');
  assert.equal(r('cuenta'), 'Todavía no');
  // El email de la cuenta ESCONDIDO (no dijo «con otro email») no se guarda, aunque llegue.
  const conOtro = leerAplicacion({ respuestas: { ...LLENA, emailCuenta: 'otra@x.com' } });
  assert.ok(conOtro.ok && !conOtro.aplicacion.respuestas.some((x) => x.id === 'emailCuenta'), 'se guardó el email de la cuenta escondido');
  const conCuenta = leerAplicacion({ respuestas: { ...LLENA, cuenta: 1, emailCuenta: 'Cuenta@MaKo.com' } });
  assert.equal(conCuenta.ok && conCuenta.aplicacion.respuestas.find((x) => x.id === 'emailCuenta')?.respuesta, 'cuenta@mako.com');
  assert.equal(!(leerAplicacion({ respuestas: { ...LLENA, cuenta: 1 } })).ok, true, 'con «otro email» y sin el email, pasó');
  const texto = aplicacionEnTexto(a);
  assert.match(texto, /^CALIFICA: factura más de US\$ 5\.000 por mes, con clientes y oferta validada, y puede invertir\.\n/);
  assert.match(texto, /le respondes en máximo 24 horas/, 'el texto no le recuerda a Martín lo que se prometió');
  assert.doesNotMatch(texto, /agenda/i, 'nadie agenda solo: el texto no puede decir que se le abrió la agenda');
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
  // Lo que le falta, para la primera línea del correo de Martín: vacío si califica.
  assert.deepEqual(porQueNoCalifica(LLENA), []);
  assert.deepEqual(porQueNoCalifica({ ...LLENA, facturacion: 0, inversion: 3 }), ['factura menos de US$ 5.000 por mes', 'hoy no puede invertir el programa']);
  assert.deepEqual(porQueNoCalifica({ ...LLENA, clientes: 0, situacion: 3 }), ['todavía no tiene clientes', 'su oferta todavía no está validada']);
  for (const [, cambio] of casos) assert.equal(porQueNoCalifica({ ...LLENA, ...cambio }).length === 0, califica({ ...LLENA, ...cambio }), `porQueNoCalifica y califica no dicen lo mismo: ${JSON.stringify(cambio)}`);
});

test('4. la agenda ya contestada (para el correo de Martín): el teléfono en a1, el @ en a2 (siempre), y las opciones por su NÚMERO', () => {
  // Leídos el 16/11/2026 en la consulta pública de Calendly (calendly.com/api/booking/event_types/lookup?event_type_slug=asesoria&
  // profile_slug=koncke, `custom_fields`). Viajan por número (la primera es 1: medido ese día, a4=2 marcó «No», y a5=3, a6=2 y a7=4
  // también): una tilde que cambie allá ya no los deja sin marcar, pero si Martín cambia el ORDEN, cámbialo acá.
  assert.deepEqual([...OPCIONES_DECISION], ['Sí, soy la única persona que toma decisiones en mi negocio.', 'No, necesito consultar con alguien más (invítalo a la llamada).']);
  // La primera, NEUTRA en el formulario (16/11/2026, a la noche: en Calendly dice «De inmediato: estoy listo para arrancar ya»): como
  // viaja por su número, la agenda la sigue marcando igual.
  assert.deepEqual([...OPCIONES_EMPEZAR], ['De inmediato: puedo arrancar ya', 'La próxima semana: sólo ajusto agenda', 'El próximo mes: estoy planeando arranque', 'En 2-3 meses: tengo barreras que resolver antes']);
  assert.equal(new URL(linkDeLaAgenda({ ...LLENA, empezar: 0 })).searchParams.get('a7'), '1', 'la primera de «empezar» no marca la primera de la agenda');
  assert.deepEqual([...OPCIONES_A4], ['Si', 'No']);
  assert.deepEqual([...OPCIONES_A5], ['Menos de $1000', 'Entre $1000 y $3000', 'Entre $3000 y $10000']);
  assert.equal(AGENDA_DE_LA_LLAMADA, 'https://calendly.com/koncke/asesoria');
  const link = linkDeLaAgenda({ ...LLENA, decision: 1, empezar: 3 });
  assert.ok(link.startsWith(`${AGENDA_DE_LA_LLAMADA}?`));
  const q = new URL(link).searchParams;
  assert.equal(q.get('name'), 'Ana Pérez');
  assert.equal(q.get('email'), 'ana@estudioana.com');
  assert.equal(q.get('a1'), '+5491155550101', 'el WhatsApp, con su +');
  assert.equal(q.get('a2'), '@ana.coach', 'el @ de Instagram, sacado del link');
  assert.equal(q.get('a3'), 'Llegar a US$ 20.000 por mes con el programa. Lo que me frena hoy: Consigo clientes sólo por referidos, sin un sistema.', 'la meta y lo que la frena, en UN renglón');
  assert.equal(OPCIONES_A4[Number(q.get('a4')) - 1], 'Si');
  assert.equal(OPCIONES_A5[Number(q.get('a5')) - 1], 'Entre $1000 y $3000');
  assert.deepEqual([q.get('a6'), q.get('a7')], ['2', '4'], 'la decisión y el arranque, por su número (el índice + 1)');
  assert.equal(OPCIONES_DECISION[Number(q.get('a6')) - 1], 'No, necesito consultar con alguien más (invítalo a la llamada).');
  assert.equal(OPCIONES_EMPEZAR[Number(q.get('a7')) - 1], 'En 2-3 meses: tengo barreras que resolver antes');
  // Nadie la ve adentro de la página desde el 16/11 a la tarde: es el link que Martín manda por WhatsApp, sin `embed`.
  assert.equal(q.get('embed_domain'), null);
  // Sin Instagram, su YouTube; sin ninguno, «No lo indicó».
  assert.equal(new URL(linkDeLaAgenda({ ...LLENA, instagram: undefined })).searchParams.get('a2'), 'https://www.youtube.com/@anacoach');
  // Quien no puede invertir: «No», y el monto no se adivina. Lo que no contestó, no se marca. El @ va SIEMPRE: allá es obligatorio.
  const no = new URL(linkDeLaAgenda({ nombre: 'Ana', inversion: 3 })).searchParams;
  assert.deepEqual([no.get('a4'), no.get('a5'), no.get('a1'), no.get('a6')], ['2', null, null, null]);
  assert.equal(no.get('a2'), SIN_RED_EN_LA_AGENDA, 'sin red social, la agenda chocaba con un campo obligatorio vacío');
  // LOS TOPES DE SU FORMULARIO (medidos el 16/11/2026 con las respuestas cargadas, sin agendar): el @ y «¿Qué quieres lograr…?»
  // son de UNA línea con `maxlength="255"`, el nombre admite 155. Por el link no los frena el `maxlength` (sólo frena al que
  // escribe): la meta de 600 caracteres entraba entera, y sus saltos se borraban y pegaban las frases.
  assert.deepEqual([TOPE_AGENDA.nombre, TOPE_AGENDA.linea], [155, 255]);
  assert.equal(enUnRenglon('Una idea.\n\nOtra   idea.', 50), 'Una idea. Otra idea.');
  assert.equal(enUnRenglon('uno dos tres cuatro', 12), 'uno dos…', 'se corta en una palabra, con «…»');
  const largo = new URL(linkDeLaAgenda({
    ...LLENA, nombre: 'N'.repeat(120), apellido: 'A'.repeat(120), instagram: undefined, youtube: `https://youtube.com/c/${'c'.repeat(100)}`,
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
  // El @ de un link: el usuario, no la publicación (instagram.com/p/… daba «@p»): el link de una publicación no es un Instagram.
  assert.equal(instagramDeLaAplicacion('https://www.instagram.com/p/Cx12AbC/'), null);
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
  // LA ENVIADA, SÓLO LO QUE LA PANTALLA FINAL USA (revisión del 16/11/2026: quedaba entera una semana, y en un navegador compartido
  // el siguiente la leía). Desde el 16/11 a la tarde es la misma pantalla para todos: el nombre y si tiene cuenta, nada más.
  assert.deepEqual(JSON.parse(enviadaParaGuardar(LLENA, ahora)), { v: 2, r: { nombre: 'Ana', cuenta: 2 }, t: ahora });
  assert.deepEqual(enviadaLimpia(JSON.parse(enviadaParaGuardar(LLENA, ahora)), ahora), { respuestas: { nombre: 'Ana', cuenta: 2 }, reescribir: false });
  // Una de la versión 1 (con lo que leía la agenda: el email, el WhatsApp, la meta): se lee sólo lo de la pantalla, y se reescribe.
  assert.deepEqual(enviadaLimpia({ v: 1, califica: true, r: LLENA, t: ahora - 1000 }, ahora), { respuestas: { nombre: 'Ana', cuenta: 2 }, reescribir: true });
  assert.equal(enviadaLimpia({ v: 2, r: LLENA, t: ahora - VIGENCIA_ENVIADA_MS - 1 }, ahora), null, 'una semana');
  assert.equal(enviadaLimpia({ v: 3, r: LLENA, t: ahora }, ahora), null, 'de otra versión');
  assert.equal(enviadaLimpia({ v: 2, r: { otra: 'x' }, t: ahora }, ahora), null, 'nada que mostrar');
  assert.notEqual(CLAVE_BORRADOR, CLAVE_ENVIADA);
  // La prueba gratuita de la pantalla final: el checkout de MaKo Pro con la campaña, y `landing=accelerator` si no traía una.
  assert.equal(linkDeLaPrueba('/planes/pro', { utm_source: 'fb', otra: 'x' }, [...CLAVES_ORIGEN]), '/planes/pro?utm_source=fb&landing=accelerator');
  assert.equal(linkDeLaPrueba('/planes/pro', { landing: 'vsl' }, [...CLAVES_ORIGEN]), '/planes/pro?landing=vsl');
  assert.equal(linkDeLaPrueba('/planes/pro', null, [...CLAVES_ORIGEN]), '/planes/pro?landing=accelerator');
  // LA CAMPAÑA, EN EL BORRADOR: quien vuelve otro día a terminarlo ya no la trae en la URL. Sólo sus claves, sin control, con tope.
  const conCampaña = borradorLimpio(JSON.parse(borradorParaGuardar(2, LLENA, ahora, { utm_source: 'fb', fbclid: 'IwA\u0000R1', otra: 'x' })), ahora, [...CLAVES_ORIGEN]);
  assert.deepEqual(conCampaña?.origen, { utm_source: 'fb', fbclid: 'IwAR1' });
  assert.equal(borradorLimpio(JSON.parse(borradorParaGuardar(2, LLENA, ahora)), ahora, [...CLAVES_ORIGEN])?.origen, null);
  // UN BORRADOR DE ANTES DEL SELECTOR DE PAÍS, con un número suelto: abre sin romperse, en «Tus datos», con la lada de donde está.
  const viejo = borradorLimpio({ v: 1, paso: 4, r: { ...LLENA, whatsapp: '55 1234 5678' }, t: ahora }, ahora);
  assert.equal(viejo?.paso, 0, 'con el WhatsApp sin país retoma en «Tus datos», donde lo puede mirar');
  assert.deepEqual(telefonoDelBorrador('55 1234 5678', '+52'), { lada: '+52', numero: '55 1234 5678', whatsapp: '+525512345678', revisar: true });
  assert.deepEqual(telefonoDelBorrador('+54 9 11 5555 0101', '+52'), { lada: '+54', numero: '91155550101', whatsapp: '+5491155550101', revisar: false });
  assert.deepEqual(telefonoDelBorrador('+5491155550101', '+52'), { lada: '+54', numero: '91155550101', whatsapp: '+5491155550101', revisar: false });
  assert.deepEqual(telefonoDelBorrador('0054 9 11 5555 0101', '+52'), { lada: '+54', numero: '91155550101', whatsapp: '+5491155550101', revisar: false });
  assert.deepEqual(telefonoDelBorrador(undefined, '+57'), { lada: '+57', numero: '', whatsapp: undefined, revisar: false });
  // Cómo se dibuja: nombre y apellido juntos, WhatsApp y email juntos; las opciones largas en una columna.
  assert.deepEqual(filasDeLaSeccion(SECCIONES[0]).map((f) => f.map((c) => c.id)), [['nombre', 'apellido'], ['whatsapp', 'email'], ['cuenta'], ['emailCuenta']]);
  assert.equal(enUnaColumna(campo('situacion')), true);
  // IMPARES, EN UNA COLUMNA (16/11/2026, Martín: «no me gusta que las opciones de 3 estén 2 y 1 abajo. En todo caso, tendría 1, 1 y
  // 1, pero no me gusta que quede 1 suelto abajo»): la de 3 (la cuenta de MaKo) y las de 5 (clientes, ticket, facturación, equipo).
  // Las pares y cortas, en dos (2 y 2, 3 y 3).
  for (const id of ['cuenta', 'clientes', 'ticket', 'facturacion', 'equipo']) assert.equal(enUnaColumna(campo(id)), true, `«${id}» (${campo(id).opciones?.length} opciones) deja una sola abajo`);
  for (const id of ['antiguedad', 'implementa', 'canal', 'horas', 'inversion']) assert.equal(enUnaColumna(campo(id)), false, `«${id}» (${campo(id).opciones?.length} opciones, cortas) ya no va en dos columnas`);
  for (const c of CAMPOS.filter((x) => x.opciones && x.opciones.length % 2 === 1)) assert.equal(enUnaColumna(c), true, `«${c.id}» tiene ${c.opciones!.length} opciones y va en dos columnas: una queda sola abajo`);
});

test('6. la campaña: de la URL y, si no trae, de la página anterior del MISMO sitio; y los «Aplica ahora» la llevan', () => {
  assert.deepEqual(origenDeLaUrl({ utm_source: 'fb', utm_campaign: ['a', 'b'], fbclid: 'IwAR1', otra: 'x', landing: 'Accelerator' }),
    { utm_source: 'fb', fbclid: 'IwAR1', landing: 'accelerator' });
  assert.equal(origenDeLaUrl({}), null);
  // Los botones de la landing llevan la campaña al formulario (revisión del 16/11/2026: sin el referrer, se perdía).
  assert.equal(hrefDelFormulario(null), RUTA_APLICAR);
  assert.equal(hrefDelFormulario(origenDeLaUrl({ fbclid: 'IwAR1', utm_source: 'fb', otra: 'x' })), `${RUTA_APLICAR}?utm_source=fb&fbclid=IwAR1`);
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

test('7. la ruta: sólo desde un host de MaKo, con tope de tamaño; lo que está mal no deja nada, y la trampa deja rastro sin guardar', () => {
  const R = laRuta();
  assert.deepEqual([R.otroSitio.status, R.sinOrigin.status], [403, 403], 'un POST desde otro sitio, o sin Origin, no entra');
  assert.deepEqual([R.whatsappMal.status, R.whatsappMal.body.campo], [400, 'whatsapp']);
  assert.deepEqual([R.whatsappLocal.status, R.whatsappLocal.body.campo], [400, 'whatsapp'], 'un número local, sin país, no se guarda con el país equivocado');
  assert.deepEqual([R.indiceFuera.status, R.indiceFuera.body.campo], [400, 'facturacion']);
  assert.deepEqual([R.muyLargaCampo.status, R.muyLargaCampo.body.campo], [400, 'meta']);
  assert.deepEqual([R.cuerpoDeclaradoGrande.status, R.cuerpoGrande.status], [413, 413], 'el tope del cuerpo: lo que dice que mide y lo que midió');
  assert.equal(R.noEsJson.status, 400);
  assert.equal(R.nadaNuevo, true, 'un pedido rechazado no deja un lead, un historial, un pedido o un correo');
  // LA TRAMPA (revisión del 16/11/2026): el bot ve lo mismo que quien no califica y no se guarda nada; pero queda en el log y, con
  // una aplicación válida, le llega a Martín como «Posible bot» (puede ser una persona a la que un autocompletado le llenó el campo).
  assert.deepEqual(R.trampa, { status: 200, body: { ok: true } }, 'el bot ve lo mismo que cualquiera');
  const d = R.trampaDeja;
  assert.deepEqual([d.leads, d.audit, d.pedidos], [d.antes.leads, d.antes.audit, d.antes.pedidos], 'la trampa guardó algo');
  assert.equal(d.correos, d.antes.correos + 1, 'la aplicación con la trampa llena no le llegó a Martín');
  assert.match(R.trampaCorreo.asunto, /^Posible bot · Ana Pérez aplicó a MaKo Accelerator · califica$/);
  assert.match(R.trampaCorreo.cuerpo, /^El campo trampa del formulario llegó lleno/);
  assert.doesNotMatch(R.trampaCorreo.cuerpo, /No se pudo guardar en el CRM/, 'no es que no se pudo: no se guardó a propósito');
  assert.ok(R.trampaLog.some((l: string) => /campo trampa lleno/.test(l) && l.includes('bo***@ejemplo.com')), `la trampa no dejó rastro en el log: ${R.trampaLog}`);
  assert.equal(R.trampaMal.status, 200);
  assert.equal(R.trampaMalDeja, true, 'con la trampa llena y una aplicación que no vale, no sale ni el correo');
  assert.ok(R.trampaMalLog.some((l: string) => /sin una aplicación válida/.test(l)), 'la trampa con basura no dejó rastro');
});

test('8. la ruta guarda el lead, la aplicación ENTERA en su historial, «Quieren entrar» y el correo a Martín (escapado)', () => {
  const R = laRuta();
  // A TODOS LO MISMO (16/11/2026, a la tarde): nadie agenda solo, así que el navegador no necesita saber si califica.
  assert.deepEqual(R.califica, { status: 200, body: { ok: true } });
  assert.deepEqual(R.noCalifica, { status: 200, body: { ok: true } });
  assert.deepEqual(R.lead[0], {
    nombre: 'Ana Pérez', email: 'ana@estudioana.com', telefono: '+5491155550101', origen_lead: 'landing', utm_source: 'fb', utm_campaign: 'acc-nov', fbclid: 'IwAR123',
  });
  const h = R.historial.find((x: { lead: number; campo: string }) => x.lead === 1 && x.campo === 'Aplicación');
  assert.ok(h, 'la aplicación no quedó en el historial de la ficha');
  assert.equal(h.autor, `Formulario de ${PROGRAMA_ACELERADOR.nombre}`);
  assert.match(h.valor, /^CALIFICA: /);
  for (const s of ['TUS DATOS', 'TU NEGOCIO', 'FACTURACIÓN Y EQUIPO', 'TU SITUACIÓN HOY', 'TU DIAGNÓSTICO', 'TU APLICACIÓN']) assert.ok(h.valor.includes(s), s);
  assert.ok(h.valor.includes('· Facturación por mes (últimos 3 meses): Entre US$ 5.000 y 10.000'));
  assert.ok(h.valor.includes('Acompaño a coaches de salud a armar su programa grupal.\n\nY lo venden'), 'la respuesta larga, con sus párrafos');
  assert.deepEqual(R.pedido[0], {
    email: 'ana@estudioana.com', nombre: 'Ana Pérez', origen: 'planes', detalle: `Aplicó a ${PROGRAMA_ACELERADOR.nombre}: califica`,
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
  // Su agenda ya contestada, para que Martín se la mande si hay match (nadie la ve al aplicar).
  assert.match(c.cuerpo, /\nSu agenda, ya contestada, para mandársela si hay match:\nhttps:\/\/calendly\.com\/koncke\/asesoria\?\S*a2=%40ana\.coach/);
  // EL HALLAZGO 5: el correo lleva su Idempotency-Key (con ella el envío corta a los 15 s y no se manda dos veces).
  assert.match(R.claveDelCorreo ?? '', /^accelerator-aplicacion:[0-9a-f]{48}$/, 'el correo salió sin idempotencyKey');
  assert.match(R.correoNoCalifica.asunto, / · no califica$/);
  assert.match(R.correoNoCalifica.cuerpo, /^NO califica: factura menos de US\$ 5\.000 por mes\.$/m, 'el correo no dice por qué no califica');
  assert.match(R.correoNoCalifica.cuerpo, /De dónde vino: entró directo, sin campaña\./);
  // Lo que escribe cualquiera en un formulario público llega al correo como TEXTO, nunca como HTML.
  assert.ok(R.html.includes('Me frena &lt;script&gt;alert(1)&lt;/script&gt; y &lt;img src=x onerror=alert(2)&gt;'), 'el HTML de la respuesta no se escapó');
  assert.ok(!/<script>alert|<img src=x/i.test(R.html), 'una etiqueta de la respuesta llegó viva al correo');
});

test('8b. la misma aplicación otra vez no se guarda ni se avisa dos veces; corregida, sí llega', () => {
  const R = laRuta();
  // La respuesta se perdió (la red del teléfono) y volvió a tocar «Enviar»: lo mismo que la primera vez, y nada nuevo.
  assert.deepEqual(R.repetida, { status: 200, body: { ok: true } });
  assert.deepEqual(R.repetidaDeja, R.repetidaAntes, 'el reenvío dejó otra aplicación, otro pedido o otro correo');
  assert.deepEqual(R.pedidoDeAna, [1], 'el reenvío sumó un intento en «Quieren entrar»');
  // Con una respuesta corregida es la versión nueva: llega, en su ficha (que ya existía, así que va «sin verificar»).
  assert.equal(R.corregida.status, 200);
  assert.equal(R.historialDeAna.length, 2, `la aplicación corregida no llegó: ${R.historialDeAna}`);
  assert.match(R.historialDeAna[0], /^CALIFICA: /);
  assert.match(R.historialDeAna[1], /^Sin verificar: esta ficha ya existía/);
  assert.equal(R.correosTrasCorregir, 1, 'el reenvío mandó otro correo, o la corregida no lo mandó');
  // EL REENVÍO VUELVE A PEDIR EL CORREO, CON LA MISMA CLAVE (hallazgo 5): si la primera vez salió, Resend no manda otro.
  assert.equal(R.repetidaPideElCorreo, 2, 'el reenvío no volvió a pedir el correo con la misma clave');
});

test('8e. el Resend colgado (hallazgo 5): la aplicación queda, el aviso en la app sale, y al reenviar el correo llega UNA vez', () => {
  const R = laRuta();
  // Antes: el envío no tenía tiempo máximo, la ruta se cortaba a los 60 s, la persona reenviaba y `yaLlego` contestaba «ok» SIN el
  // correo. A Martín no le llegaba nunca. Ahora el envío corta a los 15 s (la clave) y el reenvío lo vuelve a pedir.
  assert.equal(R.colgadaPrimera.status, 200, 'con la aplicación en la ficha, quien aplica ve su pantalla final');
  assert.equal(R.colgadaAvisoEnLaApp, 1, 'el correo colgado no dejó el aviso en la app');
  assert.equal(R.colgadaReenvio.status, 200);
  assert.equal(R.colgadaAplicaciones, 1, 'el reenvío dejó otra aplicación en la ficha');
  assert.equal(R.colgadaCorreos, 1, 'al reenviar, el correo a Martín no llegó (o llegó dos veces)');
  assert.equal(R.colgadaMismaClave, true, 'el reenvío pidió el correo con otra clave: Resend lo mandaría dos veces');
});

test('8c. la ficha y la fila de «Quieren entrar» de OTRA persona: la aplicación no completa ni pisa nada; lo suyo va al historial, sin verificar', () => {
  const R = laRuta();
  // Alguien escribe el email de Laura (una ficha de un opt-in, sin teléfono) y SU número: la ficha queda como estaba.
  assert.equal(R.fichaAjena.status, 200);
  assert.deepEqual(R.laura, { nombre: 'Laura Gómez', telefono: null, norm: null }, 'la aplicación le escribió el WhatsApp a la ficha de otra persona');
  const wa = R.historialDeLaura.find((h: { campo: string }) => h.campo === 'WhatsApp');
  assert.match(wa?.valor ?? '', /^Dejó este WhatsApp al aplicar a MaKo Accelerator: \+5215599998888 \(sin verificar\)\. No se escribió en la ficha\.$/);
  const ap = R.historialDeLaura.find((h: { campo: string }) => h.campo === 'Aplicación');
  assert.match(ap?.valor ?? '', /^Sin verificar: esta ficha ya existía y la aplicación llegó del formulario público/, 'la aplicación en una ficha ajena no dice que no está verificada');
  assert.ok(!R.historialDeLaura.some((h: { campo: string }) => h.campo === 'Teléfono'), 'cambió el teléfono de la ficha');
  // El mismo número que una ficha de un grupo (sin email): la aplicación va ahí, y el email NO se le escribe.
  assert.equal(R.mismoNumero.status, 200);
  assert.deepEqual(R.juan, { nombre: 'Juan (grupo)', email: null }, 'la aplicación le escribió el email a la ficha del mismo número');
  assert.ok(R.historialDeJuan.some((h: { campo: string; valor: string }) => h.campo === 'Email' && /otra@persona\.com \(sin verificar\)/.test(h.valor)), 'el email que dejó no quedó en el historial');
  assert.ok(R.historialDeJuan.some((h: { campo: string; valor: string }) => h.campo === 'Aplicación' && /^Sin verificar:/.test(h.valor)));
  // «Quieren entrar»: la fila que Google verificó sólo suma el intento (antes pasaba a «Impostor Xu», con su número, y seguía verificada).
  assert.deepEqual(R.marta, { nombre: 'Marta Verificada', whatsapp: null, origen: 'google', correo_verificado: true, detalle: null, lead_id: null, intentos: 2 });
  assert.equal(R.filasDeMarta, 1);
});

test('8d. «Quieren entrar» y el checkout: `sinCompletar` sólo suma el intento; sin él, el pedido de /planes completa como siempre', () => {
  const fila = { nombre: 'Marta', correo_verificado: true, detalle: null, whatsapp: null, lead_id: null, intentos: 1 };
  const deLaAplicacion = pedidoLimpio({ email: 'marta@x.com', nombre: 'Otro', origen: 'planes', verificado: false, whatsapp: '13055550000', leadId: 7, sinCompletar: true })!;
  assert.deepEqual(pedidoQueVuelve(fila, deLaAplicacion, 'ahora'), { intentos: 2, ultimo_at: 'ahora' });
  const delCheckout = pedidoLimpio({ email: 'marta@x.com', nombre: 'Otro', origen: 'planes', verificado: false, whatsapp: '13055550000', leadId: 7 })!;
  assert.equal('sinCompletar' in delCheckout, false, 'el pedido de /planes no lleva la marca');
  assert.deepEqual(pedidoQueVuelve(fila, delCheckout, 'ahora'), {
    intentos: 2, ultimo_at: 'ahora', origen: 'planes', correo_verificado: true, nombre: 'Otro', detalle: null, whatsapp: '13055550000', lead_id: 7,
  }, 'el checkout cambió lo que hace con una fila que vuelve');
});

test('9. los topes: por email (4 por hora) y por IP (10 por hora)', () => {
  const R = laRuta();
  assert.deepEqual(R.porEmail, [200, 200, 200, 200, 429]);
  assert.deepEqual(R.porIp, [200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 429]);
});

test('10. nunca se pierde: con el correo caído, ok y un aviso en la app; con la base caída y el correo que sale, ok y lo dice; sin ninguno, 503', () => {
  const R = laRuta();
  assert.deepEqual(R.conElCorreoCaido.body, { ok: true });
  assert.equal(R.leadSinCorreo, true);
  // EL CORREO NO SALIÓ: antes quedaba sólo un `console.warn`. Ahora, un aviso en la app de MaKo (la bandeja y el push), con su ficha.
  assert.equal(R.avisoSinCorreo.length, 1, 'con el correo caído, nadie se enteraba');
  assert.equal(R.avisoSinCorreo[0].ws, 9, 'el aviso es de la plataforma');
  assert.match(R.avisoSinCorreo[0].texto, /^Ana Pérez aplicó a MaKo Accelerator \(califica\) y el correo a equipo@hola-mako\.com no salió \(Resend no contestó\)\. Está en su ficha: https?:\/\/\S+\/crm\/\d+\?ws=9$/);
  assert.deepEqual(R.conLaBaseCaida.body, { ok: true });
  assert.match(R.correoSinBase[0], /No se pudo guardar en el CRM de MaKo: este correo es la única copia de la aplicación\.$/);
  assert.equal(R.avisoConLaBaseCaida, 0, 'con el correo que salió, no hace falta el aviso');
  assert.deepEqual(R.conTodoCaido, { status: 503, body: { error: R.textoNoSeGuardo } });
  assert.match(R.avisoConTodoCaido[0]?.texto ?? '', /Tampoco quedó en el CRM\. Email: nada@ejemplo\.com · WhatsApp: \+5491155550101\.$/);
  assert.match(R.textoNoSeGuardo, /lo que escribiste sigue guardado/);
});

test('11. sin sesión: la ruta y lo que guarda no leen la cookie ni piden la sesión', () => {
  const R = laRuta();
  assert.equal(R.lecturasDeSesion, 0);
  for (const f of ['app/api/accelerator/aplicar/route.ts', 'lib/aplicacion-accelerator-servidor.ts', 'app/accelerator/aplicar/page.tsx']) {
    const s = sinComentarios(leer(f));
    assert.doesNotMatch(s, /cookies\(|req\.cookies|getSesion|getUsuarioActual/, `${f} lee la sesión o la cookie`);
  }
  for (const f of ['app/api/accelerator/aplicar/route.ts', 'lib/aplicacion-accelerator-servidor.ts']) assert.doesNotMatch(sinComentarios(leer(f)), /headers\(\)/, `${f} lee los encabezados del pedido`);
  // LA PÁGINA LEE UN SOLO ENCABEZADO (16/11/2026): el país de la IP, para que el WhatsApp arranque con el código de país de quien
  // aplica, como el checkout. No es la sesión ni una cookie. Cualquier otro encabezado que lea, se pone rojo acá.
  const pagina = sinComentarios(leer('app/accelerator/aplicar/page.tsx'));
  assert.deepEqual([...pagina.matchAll(/\.get\('([^']+)'\)/g)].map((m) => m[1]), ['x-vercel-ip-country']);
  assert.equal((pagina.match(/headers\(\)/g) ?? []).length, 1, 'la página lee los encabezados en más de un lugar');
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
  // EXACTA DE VERDAD (revisión del 16/11/2026): se comparaba por prefijo, y `/api/accelerator/aplicar/<algo>` entraba sin sesión y sin
  // el chequeo de Origin que el early-return del proxy saltea.
  assert.equal(esPublica(`${API_APLICAR}/x`), false, 'una subruta de la pública que escribe entra sin sesión');
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
let respuesta: { status: number; body: unknown } | 'sin-red' = { status: 200, body: { ok: true } };
/** La búsqueda del Instagram y el YouTube (GET a API_CANAL): lo que contesta, y lo que se le pidió. */
const pedidosDeCanal: string[] = [];
let canal: Record<string, unknown> = { ok: true, candidatos: [], vacio: null };
g.fetch = async (url: string, init: RequestInit = {}) => {
  if (String(url).startsWith(API_CANAL)) {
    pedidosDeCanal.push(String(url));
    return new Response(JSON.stringify(canal), { status: 200, headers: { 'content-type': 'application/json' } });
  }
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

async function montar(o: { ladaInicial?: string; origen?: Record<string, string> | null } = {}) {
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { FormularioAplicacion } = await import('../app/accelerator/aplicar/FormularioAplicacion');
  const cont = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(cont);
  const root = createRoot(cont);
  montados.set(root, cont);
  await React.act(async () => {
    root.render(React.createElement(FormularioAplicacion, {
      origen: o.origen === undefined ? { utm_source: 'fb' } : o.origen, clavesOrigen: [...CLAVES_ORIGEN], rutaPrueba: '/planes/pro', rutaEntrar: '/login',
      ladaInicial: o.ladaInicial ?? '+54',
    }));
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
  // Sin la promesa de escribirle por WhatsApp (16/11/2026, Martín: «en tus datos no debería decir te escribo por WhatsApp, porque en
  // este caso no le vamos a escribir por WhatsApp»): «Tus datos» no lleva bajada.
  assert.equal(f.q('.apl-tarjeta-bajada') === null, true, '«Tus datos» volvió a tener bajada');
  assert.doesNotMatch(f.texto(), /te escribo/i, '«Tus datos» volvió a prometer que le escribe por WhatsApp');
  assert.equal(f.errores(), 0, 'sin tocar «Siguiente», ningún error');
  await f.siguiente();
  assert.equal(f.errores(), 5);
  assert.match(f.texto(), /Paso 1 de 6/, 'con errores no avanza');
  assert.equal(f.foco(), 'apl-nombre', 'el foco va al primer campo con error');
  assert.equal(f.q('#apl-nombre')?.getAttribute('aria-invalid'), 'true');
  assert.equal(f.q('#apl-nombre')?.getAttribute('aria-describedby'), 'apl-nombre-error');
  assert.match(f.q('.apl-tarjeta > [role="status"][aria-live="polite"]')?.textContent ?? '', /Revisa los 5 campos marcados\./);
  await f.escribir('nombre', 'Ana');
  assert.equal(f.errores(), 4, 'después del primer intento, los errores se corrigen en vivo');
  await f.escribir('apellido', 'Pérez');
  // El WhatsApp: el código de país se ELIGE (arranca en el de donde está la persona) y el campo es el número sin él.
  assert.equal(f.q('button[aria-label="Código de país"]')?.textContent?.includes('+54'), true, 'no arranca con la lada de donde está');
  assert.equal(f.q('#apl-whatsapp')?.getAttribute('aria-invalid'), 'true', 'el número del WhatsApp sin su aria-invalid');
  assert.equal(f.q('#apl-whatsapp')?.getAttribute('aria-describedby'), 'apl-whatsapp-error');
  await f.escribir('whatsapp', '11 5555');
  assert.match(f.q('#apl-whatsapp-error')?.textContent ?? '', /no parece completo/, 'un número a medias, con la lada elegida');
  // Pegado con su «+código» (copiado de WhatsApp): el código va al selector y el número queda sin él.
  await f.escribir('whatsapp', '+54 9 11 5555 0101');
  assert.equal((f.q('#apl-whatsapp') as HTMLInputElement | null)?.value, '91155550101');
  await f.escribir('email', 'ana@estudioana.com');
  assert.equal(f.errores(), 1, 'falta decir si tiene cuenta de MaKo');
  // «Sí, con otro email» pide el email de la cuenta; «Todavía no» lo esconde (y ya no lo exige).
  await f.elegir('cuenta', 1);
  assert.equal(!!f.q('#apl-emailCuenta'), true, 'con «otro email» no aparece el email de la cuenta');
  assert.equal(f.errores(), 1, 'el email de la cuenta, a la vista y sin escribir, no marca el error');
  await f.elegir('cuenta', 2);
  assert.equal(!!f.q('#apl-emailCuenta'), false, 'con «Todavía no» sigue el email de la cuenta');
  assert.equal(f.errores(), 0);
  await f.siguiente();
  assert.match(f.texto(), /Paso 2 de 6 · Tu negocio/);
  assert.equal(f.foco(), 'apl-titulo-paso', 'en un paso nuevo, el foco va a su título');
  assert.equal(f.q('input[name="rubro"]')?.getAttribute('type'), 'radio', 'una opción es un radio de verdad');
  assert.ok(f.q('fieldset legend'), 'las opciones van en un fieldset con su legend');
  const b = guardado(CLAVE_BORRADOR);
  assert.deepEqual([b.v, b.paso, b.r.nombre, b.r.email, b.r.whatsapp, b.o?.utm_source], [1, 1, 'Ana', 'ana@estudioana.com', '+5491155550101', 'fb'], 'el borrador se guarda en el navegador, con su país y la campaña');
  // LOS GRUPOS DE OPCIONES Y SU ERROR (revisión del 16/11/2026): el foco va al radio, y el radio no decía el error.
  await f.siguiente();
  assert.equal(f.foco(), 'apl-negocio', 'el foco va al primer campo con error del paso (el nombre del negocio)');
  assert.match(f.q('input[name="rubro"][value="3"]')?.getAttribute('aria-describedby') ?? '', /apl-rubro-error/, 'una opción del grupo no dice el error');
  assert.equal(f.q('input[name="rubro"][value="3"]')?.getAttribute('aria-invalid'), 'true');
  assert.deepEqual([f.q('#apl-rubro')?.closest('fieldset')?.getAttribute('role'), f.q('#apl-rubro')?.closest('fieldset')?.getAttribute('aria-required')], ['radiogroup', 'true']);
  // Atrás vuelve con lo escrito.
  await f.elegir('rubro', 2);
  await clicEn(f, '.apl-atras');
  assert.match(f.texto(), /Paso 1 de 6/);
  assert.equal((f.q('#apl-nombre') as HTMLInputElement | null)?.value, 'Ana');
  await f.desmontar();

  // Con la lada de México elegida, un número local de México: se guarda con su +52 (antes, +5512345678: Brasil).
  dom.window.localStorage.clear();
  const mx = await montar({ ladaInicial: '+52' });
  await mx.escribir('nombre', 'Ana');
  await mx.escribir('whatsapp', '55 1234 5678');
  assert.equal(guardado(CLAVE_BORRADOR)?.r?.whatsapp, '+525512345678');
  await mx.desmontar();

  // UN BORRADOR DE ANTES DEL SELECTOR, con el número suelto: abre sin romperse, en «Tus datos», con la lada de donde está y el aviso.
  dom.window.localStorage.clear();
  guardar(CLAVE_BORRADOR, { v: 1, paso: 4, r: { ...LLENA, whatsapp: '55 1234 5678' }, t: Date.now() });
  const viejo = await montar({ ladaInicial: '+52' });
  assert.match(viejo.texto(), /Paso 1 de 6 · Tus datos/, 'el borrador con el WhatsApp sin país no volvió a «Tus datos»');
  assert.match(viejo.texto(), /Revisa el código de país de tu WhatsApp/);
  assert.equal((viejo.q('#apl-whatsapp') as HTMLInputElement | null)?.value, '55 1234 5678');
  assert.equal(viejo.q('button[aria-label="Código de país"]')?.textContent?.includes('+52'), true);
  await viejo.desmontar();
});

/** Un clic en un botón cualquiera del formulario (Atrás, Empezar de nuevo). */
async function clicEn(f: Awaited<ReturnType<typeof montar>>, sel: string) {
  const React = await import('react');
  await React.act(async () => { (f.q(sel) as HTMLButtonElement).click(); });
  await f.esperar(5);
}

test('14. «Enviar aplicación» postea a API_APLICAR { respuestas, web, origen }; la pantalla final es la MISMA para todos: sin agenda, con «Tu siguiente paso»', async () => {
  dom.window.localStorage.clear();
  guardar(CLAVE_BORRADOR, { v: 1, paso: 5, r: LLENA, t: Date.now() });
  pedidos.length = 0;
  respuesta = { status: 200, body: { ok: true } };
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
  // Tal cual, con el WhatsApp como lo arma el selector de país («+» y los dígitos): las opciones como índices.
  assert.deepEqual(pedidos[0].cuerpo.respuestas, { ...LLENA, whatsapp: '+5491155550101' }, 'viajan las respuestas tal cual: las opciones como índices');
  // LA PANTALLA FINAL (Martín, 16/11: «siempre debería ser gracias, voy a revisar tu aplicación, te responderé en máximo 24 horas…»),
  // NEUTRA (esa noche: «dice, estate atento a tu WhatsApp y a tu email… para una mujer atento no aplica»).
  assert.match(f.q('h1')?.textContent ?? '', /^¡Gracias, Ana!$/);
  assert.match(f.texto(), /Voy a revisar tu aplicación y te respondo en máximo 24 horas\. Revisa tu WhatsApp y tu email\./);
  assert.doesNotMatch(f.texto(), /atent[oa]/i, 'volvió «estate atento»');
  // NADIE VE LA AGENDA al aplicar («no tiene sentido de que automaticemos»).
  assert.equal(f.q('iframe') === null, true, 'volvió la agenda (o un iframe) a la pantalla final');
  assert.doesNotMatch(f.cont.innerHTML, /calendly/i);
  // Sin el video de Martín, no hay bloque del video (revisión del 16/11/2026: «Muy pronto, un video mío para ti» lo veía todo el que
  // aplicaba); y TU SIGUIENTE PASO, en su propia tarjeta con su título (esa noche: «pondría como una sección más visible del
  // siguiente paso»), con «Crear cuenta de MaKo» (la ruta de la prueba, con la campaña) o «Ya tengo cuenta» («yo no pondría iniciar
  // la prueba gratuita de 7 días, sino que tu siguiente paso es crear cuenta de MaKo o ya tengo cuenta»).
  assert.equal(f.q('.apl-video') === null, true, 'sin video, volvió el bloque del video a la pantalla final');
  assert.doesNotMatch(f.texto(), /Muy pronto/);
  assert.equal(f.q('section.apl-siguiente > h2#apl-siguiente-titulo')?.textContent, 'Tu siguiente paso', 'el siguiente paso no es una sección con su título');
  assert.equal(f.q('section.apl-siguiente')?.getAttribute('aria-labelledby'), 'apl-siguiente-titulo');
  const botones = [...f.cont.querySelectorAll('section.apl-siguiente .apl-siguiente-botones a')].map((a) => `${a.textContent} → ${a.getAttribute('href')}`);
  assert.deepEqual(botones, ['Crear cuenta de MaKo → /planes/pro?utm_source=fb&landing=accelerator', 'Ya tengo cuenta → /login']);
  assert.doesNotMatch(f.texto(), /prueba gratuita/i, 'volvió «Iniciar prueba gratuita»');
  assert.equal(f.foco(), '', 'el foco va al título (sin id): no se queda en el botón que ya no existe');
  assert.equal(dom.window.document.activeElement?.tagName, 'H1');
  assert.equal(guardado(CLAVE_BORRADOR), null, 'enviada bien, el borrador se borra');
  assert.deepEqual(guardado(CLAVE_ENVIADA)?.r, { nombre: 'Ana', cuenta: 2 }, 'guardada, sólo el nombre y si tiene cuenta');
  await f.desmontar();

  // Vuelve en la semana: su pantalla final otra vez, sin llenar nada. Y «Empezar de nuevo» la borra.
  const otra = await montar();
  assert.match(otra.q('h1')?.textContent ?? '', /^¡Gracias, Ana!$/);
  await clicEn(otra, '.apl-otra button');
  assert.match(otra.texto(), /Paso 1 de 6/);
  assert.equal((otra.q('#apl-nombre') as HTMLInputElement | null)?.value, '');
  assert.equal(guardado(CLAVE_ENVIADA), null);
  await otra.desmontar();

  // Una enviada de ANTES (la que abría la agenda): vuelve a la pantalla de hoy, y el navegador se queda sólo con el nombre.
  guardar(CLAVE_ENVIADA, { v: 1, califica: true, r: LLENA, t: Date.now() });
  const vieja = await montar();
  assert.equal(vieja.q('iframe') === null, true, 'una enviada de antes volvió a abrir la agenda');
  assert.match(vieja.texto(), /Crear cuenta de MaKo/);
  assert.deepEqual(guardado(CLAVE_ENVIADA)?.r, { nombre: 'Ana', cuenta: 2 }, 'la enviada de antes siguió guardando el email, el WhatsApp y la meta');
  await vieja.desmontar();

  // Con cuenta de MaKo: «Entrar a MaKo», sin la prueba. Y quien NO califica ve lo mismo que quien califica.
  dom.window.localStorage.clear();
  guardar(CLAVE_BORRADOR, { v: 1, paso: 5, r: { ...LLENA, cuenta: 0, facturacion: 0 }, t: Date.now() });
  const n = await montar();
  await n.siguiente();
  await n.esperar(10);
  assert.match(n.texto(), /Voy a revisar tu aplicación y te respondo en máximo 24 horas/);
  const entrar = [...n.cont.querySelectorAll('section.apl-siguiente .apl-siguiente-botones a')].map((a) => `${a.textContent} → ${a.getAttribute('href')}`);
  assert.deepEqual(entrar, ['Entrar a MaKo → /login']);
  assert.match(n.texto(), /Tu siguiente paso/);
  assert.doesNotMatch(n.texto(), /prueba gratuita|Crear cuenta|Ya tengo cuenta/i, 'con cuenta de MaKo, le ofrece crearla');
  await n.desmontar();
});

test('14b. el Instagram y el YouTube: escribe, la búsqueda trae cuentas y elige la suya; si no anda, lo escrito vale', async () => {
  dom.window.localStorage.clear();
  guardar(CLAVE_BORRADOR, { v: 1, paso: 1, r: { ...LLENA, instagram: undefined, youtube: undefined }, t: Date.now() });
  pedidosDeCanal.length = 0;
  canal = { ok: true, vacio: null, candidatos: [
    { valor: '@ana.coach', nombre: 'Ana Coach', usuario: '@ana.coach', foto: null, seguidores: 12400 },
    { valor: '@anacoach.ok', nombre: 'Ana P.', usuario: '@anacoach.ok', foto: null, seguidores: null },
  ] };
  const f = await montar();
  assert.match(f.texto(), /Paso 2 de 6 · Tu negocio/);
  // Un nombre: espera a que deje de escribir y busca UNA vez.
  await f.escribir('instagram', 'Ana');
  await f.esperar(100);
  await f.escribir('instagram', 'Ana Coach');
  await f.esperar(800);
  assert.deepEqual(pedidosDeCanal, [`${API_CANAL}?red=instagram&q=Ana%20Coach`], 'buscó de más, o no buscó');
  assert.match(f.q('#apl-instagram-busqueda')?.textContent ?? '', /^Elige la tuya:$/);
  const opciones = [...f.cont.querySelectorAll('.apl-canal-op')].map((b) => b.textContent);
  assert.deepEqual(opciones, ['AAna Coach@ana.coach · 12.400 seguidoresEs la mía', 'AAna P.@anacoach.okEs la mía']);
  // Elige la suya: queda escrita como su @, y no vuelve a buscar.
  const React = await import('react');
  await React.act(async () => { (f.cont.querySelector('.apl-canal-op') as HTMLButtonElement).click(); });
  await f.esperar(800);
  assert.equal((f.q('#apl-instagram') as HTMLInputElement | null)?.value, '@ana.coach');
  assert.match(f.q('.apl-canal-ok')?.textContent ?? '', /^Ana Coach@ana\.coach$/);
  assert.equal(pedidosDeCanal.length, 1, 'elegida, volvió a buscar');
  // YouTube por @, y la búsqueda no anda (sin crédito): lo dice, y el @ escrito vale igual.
  canal = { ok: true, candidatos: [], vacio: 'no-anda' };
  await f.escribir('youtube', '@anacoach');
  await f.esperar(800);
  assert.equal(pedidosDeCanal[1], `${API_CANAL}?red=youtube&q=%40anacoach`);
  assert.match(f.q('#apl-youtube-busqueda')?.textContent ?? '', /^No pude buscarla ahora: escribe tu @ o pega el link\.$/);
  // Un nombre sin elegir en el Instagram: al tocar «Siguiente», el error dice qué hacer.
  canal = { ok: true, candidatos: [], vacio: null };
  await f.escribir('instagram', 'Ana Coach Otra');
  await f.esperar(800);
  assert.match(f.q('#apl-instagram-busqueda')?.textContent ?? '', /^No la encontré: revisa el @ o pega el link\.$/);
  await f.siguiente();
  assert.equal(f.q('#apl-instagram-error')?.textContent ?? '', TEXTO_CANAL_INVALIDO.instagram, 'un nombre sin elegir pasó como Instagram');
  assert.equal(f.q('#apl-youtube-error') === null, true, 'el @ del YouTube, escrito sin la búsqueda, no vale');
  await f.desmontar();
  // Lo que pide la búsqueda: un @, el link o un nombre; con menos de 3 letras, nada.
  assert.deepEqual(queBuscarDelCanal('instagram', '@Ana.Coach'), { exacto: 'ana.coach', nombre: null });
  assert.deepEqual(queBuscarDelCanal('instagram', 'Ana Coach'), { exacto: null, nombre: 'Ana Coach' });
  assert.deepEqual(queBuscarDelCanal('instagram', '@an'), { exacto: null, nombre: null });
  assert.deepEqual(queBuscarDelCanal('youtube', 'https://www.youtube.com/@AnaCoach'), { exacto: '@AnaCoach', nombre: null });
  assert.deepEqual(queBuscarDelCanal('youtube', 'youtube.com/channel/UC1234567890123456789012'), { exacto: 'UC1234567890123456789012', nombre: null });
  assert.deepEqual(queBuscarDelCanal('youtube', 'anacoach'), { exacto: '@anacoach', nombre: null });
  assert.deepEqual(queBuscarDelCanal('youtube', 'https://www.youtube.com/c/AnaCoach'), { exacto: null, nombre: null }, 'un /c/ no tiene cómo leerse: vale como link, sin buscar');
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
  respuesta = { status: 200, body: { ok: true } };
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

test('16. la página: noindex, dinámica, sin cookies ni <Suspense>; la barra del programa y el formulario, SIN el pie del sitio', async () => {
  const pagina = await import('../app/accelerator/aplicar/page');
  assert.equal(pagina.metadata.title, `Aplica a ${PROGRAMA_ACELERADOR.nombre}`);
  assert.deepEqual(pagina.metadata.robots, { index: false, follow: false });
  assert.equal(pagina.dynamic, 'force-dynamic');
  // Una página sólo exporta lo suyo (Next rechaza otro export al compilar).
  assert.deepEqual(Object.keys(pagina).sort(), ['default', 'dynamic', 'metadata', 'revalidate']);
  const fuente = sinComentarios(leer('app/accelerator/aplicar/page.tsx'));
  // Sin <Suspense>. `next/headers` sí, para UN encabezado: el país de la IP (lo fija el test 11).
  assert.doesNotMatch(fuente, /Suspense/);
  const html = await paginaDibujada({ utm_source: 'fb' });
  assert.match(html, /<div class="acl-root apl-root">/);
  // La marca vuelve a la LANDING del programa (16/11/2026, Martín: «cuando aprieto el botón de MaKo Accelerator, debería llevarme
  // nuevamente a la landing»); en la landing, a la portada.
  assert.match(html, /<header class="acl-hdr"><a class="acl-hdr-marca" href="\/accelerator" aria-label="MaKo Accelerator: volver al programa"/, 'la marca del formulario no vuelve a la landing');
  assert.match(html, /<a class="acl-hdr-link" href="\/planes">Ver planes<\/a><a class="acl-btn acl-btn-sm" href="\/accelerator">El programa<\/a>/, 'la vuelta al programa');
  assert.match(html, /Paso 1 de 6/);
  assert.match(html, /<span class="acl-pill">Aplicación<\/span><h1>MaKo <em>Accelerator<\/em><\/h1>/);
  // SIN EL PIE DEL SITIO NI EL WHATSAPP QUE FLOTA (Martín: «durante el formulario no debería salir la bottom bar»; y el botón que
  // flota pisaba «Siguiente» en el teléfono, hallazgo 7 de la revisión).
  assert.equal(html.includes('<footer'), false, 'volvió el pie del sitio al formulario');
  assert.equal(html.includes('mk-wa-flota'), false, 'volvió el WhatsApp que flota al formulario');
  assert.doesNotMatch(sinComentarios(leer('app/accelerator/aplicar/page.tsx')), /PieGlobal/);
  // NI LEGALES NI LA NOTA DE ABAJO (16/11/2026, a la noche, Martín: «en el formulario no pongas ni términos, ni privacidad, ni
  // reembolso. Eso no hace falta en el formulario. Tampoco el texto de abajo de lo que escribes se guarda en este navegador. No
  // pongas textos innecesarios»). Desde la revisión de esa mañana (hallazgo 5) iban debajo de «Enviar aplicación». Los legales siguen
  // en el pie de la landing del programa.
  const sinHojas = html.replace(/<style[\s\S]*?<\/style>/g, '');
  assert.doesNotMatch(sinHojas, /apl-legales|apl-nota|href="\/(terminos|privacidad|reembolsos)"|>(Términos|Privacidad|Reembolsos)</, 'volvieron los legales al formulario');
  assert.doesNotMatch(sinHojas, /se guarda en este navegador/i, 'volvió la nota de debajo del formulario');
  const { CSS_APLICAR: hoja } = await import('../app/accelerator/aplicar/estilo');
  assert.doesNotMatch(hoja.replace(/\/\*[\s\S]*?\*\//g, ''), /\.apl-(legales|nota)\b/, 'quedó el CSS de los legales o de la nota');
  // El logo de MaKo, blanco (16/11/2026, Martín: «como Accelerator solamente es Dark Mode, el logo de MaKo en todos lados siempre lo
  // pondría en White»): la barra es la de la landing (app/accelerator/Barra.tsx).
  assert.match(html, /<span class="acl-estrella" aria-hidden="true"><svg [^>]*><path d="[^"]+" fill="#fff"><\/path><\/svg><\/span>/, 'la estrella de la barra del formulario no es blanca');
  assert.ok(html.includes('class="apl-trampa"') && html.includes(`id="${ID_TRAMPA}"`), 'el campo trampa');
  // Con un nombre que ningún autocompletado reconoce (revisión del 16/11/2026): «web» y su rótulo «Web» los llenaba un gestor.
  assert.doesNotMatch(html, /id="apl-web"|name="web"|>Web<\/label>/, 'el campo trampa volvió a llamarse «web»');
  // El WhatsApp con el código de país que se ELIGE (el del checkout), y arrancando en el de donde está la persona.
  assert.match(html, /<button type="button" aria-label="Código de país"/, 'el WhatsApp sin el selector de país');
  assert.match(html, /<input class="apl-input"[^>]*id="apl-whatsapp"/, 'el número del WhatsApp no es un campo del formulario');
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
  const final = (conCuenta: boolean, video: string | null = null) => renderToStaticMarkup(React.createElement(PantallaFinal, {
    nombre: 'Ana', conCuenta, rutaPrueba: '/planes/pro?landing=accelerator', rutaEntrar: '/login', video,
  }));
  assert.doesNotMatch(final(false) + final(true), /<iframe|calendly/i, 'la pantalla final no tiene agenda');
  // Con el video de Martín (`VIDEO_DE_GRACIAS`), su reproductor en el marco; sin él, no hay bloque ni «Muy pronto» (revisión del 16/11).
  assert.match(final(false, 'https://player.example/embed/?v=1'), /<div class="apl-video">(<span[^>]*><\/span>){4}<iframe src="https:\/\/player\.example\/embed\/\?v=1"/);
  assert.doesNotMatch(final(false) + final(true), /apl-video|Muy pronto/, 'sin video, el bloque del video sigue');
  const preguntas = SECCIONES.flatMap((s) => [s.titulo, s.bajada ?? '', ...s.campos.flatMap((c) => [c.rotulo, c.ayuda ?? '', c.placeholder ?? '', ...(c.opciones ?? [])])]);
  const errores = CAMPOS.flatMap((c) => [errorDelCampo(c, undefined), errorDelCampo(c, c.tipo === 'largo' ? 'corto' : 'x')]).filter(Boolean);
  const literales = (f: string) => [...sinComentarios(leer(f)).matchAll(/'([^'\n]*[a-záéíóúñ][^'\n]*)'/gi)].map((m) => m[1]);
  const visible = [
    await paginaDibujada(), final(false), final(true), ...preguntas, ...errores,
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
    // 16/11/2026, a la noche, Martín: «en tus datos no debería decir te escribo por WhatsApp, porque en este caso no le vamos a
    // escribir por WhatsApp».
    [/te escribo por WhatsApp/i, 'no se le promete que se le escribe por WhatsApp'],
    // Y lo que antes estaba: «Iniciar prueba gratuita de 7 días» / «Ya hice la prueba gratuita» («tu siguiente paso es crear cuenta de
    // MaKo o ya tengo cuenta»), los legales y la nota de debajo del formulario («no pongas textos innecesarios»).
    [/Iniciar prueba gratuita|Ya hice la prueba gratuita/i, 'el siguiente paso es «Crear cuenta de MaKo» o «Ya tengo cuenta»'],
    [/se guarda en este navegador/i, 'sin la nota de debajo del formulario'],
  ] as const) assert.doesNotMatch(visible, mal, por);
  // NEUTRO EN GÉNERO (16/11/2026, a la noche, Martín: «revisa bien los copies, porque por ejemplo dice, estate atento a tu WhatsApp y
  // a tu email… para una mujer atento no aplica. O sea, que sea neutro»). Lo que se lee: la página, las dos pantallas finales, las
  // preguntas, los errores y las frases del formulario (sin las palabras sueltas del código, como el estado 'listo' de la búsqueda).
  const frases = [
    await paginaDibujada(), final(false), final(true), ...preguntas, ...errores,
    ...literales('app/accelerator/aplicar/FormularioAplicacion.tsx').filter((t) => /\s/.test(t)),
  ].join('\n').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');
  const MASCULINO = /(?<!\p{L})(listo|atento|bienvenido|preparado|interesado)(?!\p{L})/giu;
  assert.deepEqual([...frases.matchAll(MASCULINO)].map((m) => m[0]), [], 'un texto le habla en masculino a quien aplica');
  assert.match(campo('compromiso').rotulo, /, si hay match, me comprometo con el programa\.$/, 'el compromiso volvió a «estoy listo para comprometerme»');
  // Y con el generador del guard del repo (lib/voseo.ts: las formas salen de los verbos, no de una lista a mano). Ese guard lista
  // con `git ls-files`: estos archivos, nuevos y sin `git add`, no los revisa (docs/hallazgos-pruebas.md, 13/11).
  const { marcasDeVoseo } = await import('../lib/voseo');
  assert.deepEqual(marcasDeVoseo(visible), [], 'voseo en lo que lee quien aplica');
  assert.match(visible, /Leo cada aplicación personalmente/);
  assert.match(visible, /te respondo en máximo 24 horas/);
});

// =============================================================================
// LA BÚSQUEDA DEL INSTAGRAM Y EL YOUTUBE (la de Competitor Spy, en un node aparte con Spy de mentira)
// =============================================================================

test('18. la búsqueda del canal: pública y de sólo lectura, en la plataforma, con Spy; con topes por IP y por día, y si no anda lo dice', () => {
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_aplicacion-accelerator-canal-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length));
  assert.equal(API_CANAL, '/api/accelerator/canal');
  assert.deepEqual([esPublica(API_CANAL), esPublicaDeEscritura(API_CANAL)], [true, false], 'la búsqueda tiene que ser pública y de sólo lectura');
  const r = sinComentarios(leer('app/api/accelerator/canal/route.ts'));
  assert.doesNotMatch(r, /export (async )?function (POST|PUT|PATCH|DELETE)\b/, 'sólo GET');
  assert.doesNotMatch(r + sinComentarios(leer('lib/aplicacion-accelerator-canal.ts')), /cookies\(|getSesion|getUsuarioActual|getWorkspaceActual/, 'lee la sesión o el workspace del pedido');
  // Instagram por @: Spy por @ (`leerExacto`) en la PLATAFORMA (ws 9), dejando lecturas de Spy del día para Martín.
  assert.deepEqual(R.igExacto.body, { ok: true, candidatos: [{ valor: '@ana.coach', nombre: 'Ana Coach', usuario: '@ana.coach', foto: 'https://cdn.example/ana.jpg', seguidores: 12400 }], vacio: null });
  assert.deepEqual(R.llamadas.leerExacto[0], { ws: 9, usuario: 'ana.coach', reserva: 100 });
  assert.equal(R.todoEnLaPlataforma, true, 'la búsqueda no corrió en el workspace de la plataforma');
  // Una foto que no es https no se ofrece.
  assert.equal(R.igFotoHttp.body.candidatos[0].foto, null);
  // Por nombre: Google de Spy, hasta 5; YouTube por @: la API oficial (`leerCanalHallado`).
  assert.deepEqual(R.igNombre.body.candidatos.map((k: { valor: string }) => k.valor), ['@uno', '@dos', '@tres', '@cuatro', '@cinco']);
  assert.deepEqual(R.ytExacto.body.candidatos, [{ valor: 'https://www.youtube.com/@anacoach', nombre: 'Ana Coach TV', usuario: '@anacoach', foto: null, seguidores: 900 }]);
  // El canal por la API oficial: el de la prueba, el que tiró y 20 del tope por IP (el 21 no se pidió).
  assert.deepEqual([R.llamadas.leerCanalHallado[0], R.llamadas.leerCanalHallado.length], ['@anacoach', 22]);
  // Si Spy no anda (sin clave o sin crédito: el 13/11 la clave contestaba 401), lo dice; si no existe, lista vacía sin «vacio».
  assert.deepEqual(R.igSinCredito.body, { ok: true, candidatos: [], vacio: 'no-anda' });
  assert.deepEqual(R.igNoEsta.body, { ok: true, candidatos: [], vacio: null });
  assert.deepEqual(R.ytTira.body, { ok: true, candidatos: [], vacio: 'no-anda' }, 'una búsqueda que tira no puede romper el formulario');
  // Lo que no pide nada no gasta nada.
  assert.deepEqual(R.corto.body, { ok: true, candidatos: [], vacio: null });
  assert.equal(R.cortoNoLlama, true, 'con dos letras se gastó una búsqueda');
  assert.equal(R.sinRed.status, 400);
  // Desde otro sitio, no; el tope por IP (20 por hora) y el del día por nombre (15) no llaman a Spy: dicen «limite».
  assert.equal(R.otroSitio.status, 403);
  assert.equal(R.porIp.at(-1), 'limite', `el tope por IP no cortó: ${R.porIp}`);
  assert.equal(R.porIp.filter((x: string) => x === 'ok').length, 20);
  assert.equal(R.porDia.filter((x: string) => x === 'limite').length, 1, `el tope del día por nombre no cortó: ${R.porDia}`);
  assert.equal(R.googleTrasElTope, 15, 'pasado el tope del día, igual se llamó a Google por Apify');
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
// LA REVISIÓN DEL 16/11/2026 (base 20 / 0; con scratchpad/arreglos-16-11/formulario/romper.cjs, una rotura por vez y restaurada):
//   · el WhatsApp vuelve a contar sólo dígitos: un número local pasa (1, 5, 7, 13) · los caracteres de control pasan (2)
//   · la trampa corta antes de leer la aplicación (2, 7) · la trampa sin rastro en el log (7) · a2 sólo con red social (4)
//   · la decisión vuelve a viajar por texto (4, 14) · CAMPOS_DE_LA_AGENDA sin el @ (4) · la enviada se guarda entera (5, 14)
//   · el borrador no guarda la campaña (5, 13) · el borrador viejo no avisa que revise el país (5, 13)
//   · la aplicación completa el WhatsApp de una ficha ajena (8c) · le escribe el email a la ficha del mismo número (8c)
//   · la aplicación en una ficha ajena sin «Sin verificar» (8b, 8c) · «Quieren entrar» completa una fila que existe (8c, 8d)
//   · la marca de no completar le llega también al checkout (8d) · el reenvío se guarda y se avisa otra vez (8b)
//   · con el correo caído no hay aviso en la app (10) · las públicas que escriben, otra vez por prefijo (12)
//   · un aviso de OTRA ventana de calendly.com cuenta (14) · el radio del grupo no dice el error (13)
//   · el WhatsApp no arranca con la lada de donde está (13) · la página lee otro encabezado (11) · la trampa vuelve a «web» (16)
// =============================================================================
// TERCERA TANDA (16/11/2026, a la tarde; base 23 / 0; con scratchpad/ronda-3/accelerator/romper.cjs, una rotura por vez y
// restaurada; entre paréntesis, los tests que se pusieron rojos):
//   · un nombre suelto pasa como Instagram (1, 14b, 18) · el email de la cuenta, siempre a la vista (1, 2, 5, 7, 8, 8b…)
//   · vuelven las 3 cuotas de 500 a la pregunta de la inversión (1, 5, 13) · `porQueNoCalifica` no mira los clientes (3)
//   · a2 sólo con el Instagram (4) · el texto vuelve a decir que se le abrió la agenda (2)
//   · el correo sin `idempotencyKey`, el hallazgo 5 (7, 8, 8b, 8e, 10) · el reenvío no vuelve a pedir el correo (8b, 8e)
//   · la clave cambia con cada envío (8b, 8e) · sin la agenda ya contestada en el correo de Martín (8)
//   · la ruta vuelve a decir si califica (8, 8b, 10) · la enviada se guarda entera (5, 14) · la prueba sin la campaña (5, 14)
//   · la búsqueda sale con cada tecla (14b: hasta que se esperó 100 ms entre teclas, 23 / 0: no lo veía) · elegir no escribe la
//     cuenta (14b) · con cuenta, igual la prueba (14) · vuelve el pie del sitio al formulario (16) · la marca del formulario vuelve a
//     la portada (16) · sin el tope del día por nombre (18) · sin el tope por IP de la búsqueda (18) · la búsqueda entra desde otro
//     sitio (18) · la lectura por @ sin la reserva de Spy (18) · la búsqueda fuera del workspace de la plataforma (18) · una foto
//     http se ofrece (18)
// Revisión del 16/11/2026 (hallazgos 3 y 5, y el video del 11; base 23 / 0, cada una en el repo y restaurada): el formulario sin
//   los legales (16) · sin video vuelve el bloque del video (14, 17) · sin el código de área se dice «no parece completo» (1) · el
//   servidor no agrega el 9 (1) · el servidor acepta el WhatsApp sin código de área (1): 22 / 1 cada una, la del video 21 / 2.
// CUARTA TANDA (16/11/2026, a la noche; base 23 / 0; con scratchpad/acelerador-artefacto/romper3.py, una rotura por vez y restaurada):
//   · las opciones impares otra vez en dos columnas (5) · vuelven los legales al formulario (16) · vuelve la nota «se guarda en este
//   navegador» (16, 17) · vuelve «Te escribo por WhatsApp» a «Tus datos» (13, 17) · vuelve «Estate atento» (14, 17) · vuelve
//   «Iniciar prueba gratuita de 7 días» (14, 17) · el siguiente paso, otra vez una ceja suelta (14) · vuelve «estoy listo para
//   arrancar ya» (4, 17) · vuelve «estoy listo para comprometerme» (17) · la estrella del formulario, dorada otra vez (16).
// =============================================================================
