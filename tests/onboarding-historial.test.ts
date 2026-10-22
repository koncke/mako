// =============================================================================
// Las preguntas del arranque se GUARDAN con su respuesta y se ven en el Ops Center (21/10/2026, Florencia, ws21)
// =============================================================================
// Medido en producción el 21/10 (Chrome de Martín, super admin, /second-brain?ws=21): el ws21 tiene 0 chats propios; su
// Ops Center muestra «Mi oferta», la proyección de su conversación de Offer (sesión 14), y ésa SÍ trae las preguntas de
// MaKo. Lo que no estaba en ningún lado era el ARRANQUE (el nombre, el negocio, el PDF, la fase, el CRM, cómo llegó, qué
// resolver primero, el teléfono): ni las preguntas ni las respuestas. La conversación empezaba en «¿Tienes un documento
// de tu oferta…?». Y el documento que ella mandó como respuesta (fila 3, sin texto) tampoco se veía.
// lib/onboarding-historial.ts: lo que MaKo dice se anota la primera vez que se ve, lo que la persona manda se anota tal
// cual, y la proyección y el chat «Onboarding» lo juntan por hora con la conversación de Offer.
//
// ROTURAS: al final del archivo, medidas una por una con el arnés romper.mjs del scratchpad del chat «Onboarding».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CRM_PREGUNTA, CRM_SI, NEGOCIO_CONFIRMAR, NOMBRE_CONFIRMAR, PDF_OPCIONES, VER_OTROS_TIPOS, mensajesDeArranque, mensajesDelHilo,
  type EstadoArranque, type HechosArranque, type MensajeArranque,
} from '../lib/onboarding-arranque';
import {
  ID_CIERRE, TOPE_MENSAJES, anotarCon, conLoNuevo, leerHistorial, loQueContesto, sesionDelArranque, unirConOffer, type MensajeHistorial,
} from '../lib/onboarding-historial';
import { AVISO_RECONSTRUIDO, NOTA_DE_VOZ, mensajesDeOffer } from '../lib/chat-mako-reglas';
import { audioDeBloques, bloqueDeAudio, sanearBloques } from '../lib/chat-mako-bloques';
import { bloquesGuardados } from '../lib/chat-bloques';

const leer = (r: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', r), 'utf8').replace(/\r\n/g, '\n');
const iso = (t: number) => new Date(t).toISOString();
const vistaDe = (antes: MensajeArranque[], despues: MensajeArranque[] = []) => ({ antes, despues });
const m = (id: string, de: 'mako' | 'yo', texto: string, opciones?: string[]): MensajeArranque => ({ id, de, texto, ...(opciones ? { opciones } : {}) });
const hist = (n: number): MensajeHistorial[] => Array.from({ length: n }, (_, i) => ({ id: `x-${i}`, de: i % 2 ? 'yo' as const : 'mako' as const, texto: `t${i}`, at: iso(i + 1) }));

const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: '', nombreWorkspace: '', faseGuardada: false, canalNegocio: null, loQueVende: false,
  conCrm: true, conTelefono: true, terminado: false,
};
const FASE = { canal: 'llamadas' as never, faseResp: Array.from({ length: 20 }, () => 0) };

test('1. de lo dibujado (la reconstrucción): una vez, en orden, siempre después de lo anotado; otro texto es otro mensaje', () => {
  const v1 = vistaDe([m('arr-nombre', 'mako', '¿Cómo te llamas?'), m('arr-nombre-r', 'yo', 'Hola, soy Ana'), m('arr-nombre-ok', 'mako', '¿Te llamo «Ana»?')]);
  const h1 = conLoNuevo([], v1, { ahora: 1_000 })!;
  assert.deepEqual(h1.map((x) => [x.id, x.texto, x.at]), [
    ['arr-nombre', '¿Cómo te llamas?', iso(1_000)], ['arr-nombre-r', 'Hola, soy Ana', iso(1_001)], ['arr-nombre-ok', '¿Te llamo «Ana»?', iso(1_002)],
  ]);
  assert.equal(conLoNuevo(h1, v1, { ahora: 2_000 }), null, 'lo mismo otra vez no anota nada');
  const v2 = vistaDe([m('arr-nombre', 'mako', '¿Cómo te llamas?'), m('arr-nombre-r', 'yo', 'Ana'), m('arr-negocio', 'mako', 'Un gusto, Ana. ¿Cómo se llama tu negocio?')]);
  // `ahora` ANTES de lo anotado (un reloj atrasado): igual va después.
  const h2 = conLoNuevo(h1, v2, { ahora: 500 })!;
  assert.deepEqual(h2.map((x) => x.texto), ['¿Cómo te llamas?', 'Hola, soy Ana', '¿Te llamo «Ana»?', 'Ana', 'Un gusto, Ana. ¿Cómo se llama tu negocio?']);
  assert.deepEqual(h2.slice(3).map((x) => x.at), [iso(1_003), iso(1_004)], 'siempre después de lo anotado');
  assert.equal(conLoNuevo([], vistaDe([m('x', 'mako', '   ')]), { ahora: 1 }), null, 'lo vacío no se anota');
});

test('2. lo de ANTES de Offer que se anota tarde va antes de su primer mensaje; lo de después, ahora', () => {
  const v = vistaDe([m('arr-nombre', 'mako', 'Hola'), m('arr-nombre-r', 'yo', 'Ana')], [m('arr-pdf', 'mako', '¿Está correcto?'), m('arr-pdf-r', 'yo', 'Sí')]);
  const h = conLoNuevo([], v, { ahora: 9_000, primeroDeOffer: 5_000, reconstruido: true })!;
  assert.deepEqual(h.map((x) => x.at), [iso(4_998), iso(4_999), iso(9_000), iso(9_001)]);
  assert.ok(h.every((x) => x.reconstruido === true));
  assert.deepEqual(conLoNuevo([], v, { ahora: 9_000, primeroDeOffer: null })!.map((x) => x.at), [iso(9_000), iso(9_001), iso(9_002), iso(9_003)]);
  assert.equal(conLoNuevo([], v, { ahora: 9_000 })![0].reconstruido, undefined);
});

test('3. el historial guardado: lo que no se entiende no se pisa', () => {
  assert.deepEqual(leerHistorial(null), []);
  assert.deepEqual(leerHistorial(''), []);
  assert.equal(leerHistorial('{roto'), null, 'ilegible: null, y no se escribe encima');
  assert.equal(leerHistorial('[1,2]'), null);
  const mezcla = JSON.stringify({ mensajes: [
    { id: 'a', de: 'mako', texto: 'Hola', at: iso(1) }, { id: 'b', de: 'otro', texto: 'x', at: iso(2) }, { id: 'c', de: 'yo', texto: 'Ana', at: 'ayer' },
    { id: 'd', de: 'yo', texto: 'Ana', at: iso(3), reconstruido: true },
  ] });
  assert.deepEqual(leerHistorial(mezcla), [{ id: 'a', de: 'mako', texto: 'Hola', at: iso(1) }, { id: 'd', de: 'yo', texto: 'Ana', at: iso(3), reconstruido: true }], 'para dibujar');
  assert.equal(leerHistorial(mezcla, { estricto: true }), null, 'para escribir, una entrada que no entiende no se borra en silencio');
  assert.equal(sesionDelArranque(JSON.stringify({ sesionId: 14 })), 14);
  assert.equal(sesionDelArranque(JSON.stringify({ sesionId: '14' })), null);
  assert.equal(sesionDelArranque('no'), null);
});

test('4. EN VIVO: la respuesta es lo que mandó (también el toque de una confirmación), y MaKo una vez por pregunta', () => {
  let h: MensajeHistorial[] = [];
  let t = 1_000;
  const listo = (e: EstadoArranque, hh: HechosArranque, primero: number | null = null) => {
    h = conLoNuevo(h, mensajesDeArranque(e, hh), { ahora: (t += 10), primeroDeOffer: primero, vivo: true }) ?? h;
  };
  const contesta = (e: EstadoArranque, hh: HechosArranque, r: { texto?: string; opcion?: number }, primero: number | null = null) => {
    const v = mensajesDeArranque(e, hh);
    h = conLoNuevo(h, v, { ahora: (t += 10), primeroDeOffer: primero, vivo: true, respuesta: loQueContesto(v, r) }) ?? h;
  };
  listo({}, H);
  contesta({}, H, { texto: 'Hola, soy Ana' });
  const e1: EstadoArranque = { nombrePorConfirmar: { escrito: 'Hola, soy Ana', nombre: 'Ana' } };
  listo(e1, H);
  contesta(e1, H, { opcion: 0 });
  const e2: EstadoArranque = { nombre: 'Ana' };
  listo(e2, H);
  contesta(e2, H, { texto: 'mi marca: Acme' });
  const e3: EstadoArranque = { nombre: 'Ana', negocioPorConfirmar: { escrito: 'mi marca: Acme', nombre: 'Acme' } };
  listo(e3, H);
  contesta(e3, H, { opcion: 0 });
  const e4: EstadoArranque = { nombre: 'Ana', negocio: 'Acme' };
  listo(e4, H);
  // La conversación de Offer (va por /api/offer: no pasa por acá), y la pregunta del PDF, que aparece sin un POST del arranque.
  const offer = [
    { de: 'mako' as const, texto: '¿Tienes un documento de tu oferta?', at: iso(t + 100) },
    { de: 'yo' as const, texto: '', at: iso(t + 110), adjuntos: [{ nombre: 'oferta.pdf' }] },
    { de: 'mako' as const, texto: 'Ya tengo todas las piezas.', at: iso(t + 120) },
  ];
  const primero = t + 100;
  t += 200;
  const conOferta = { ...H, loQueVende: true };
  contesta(e4, conOferta, { opcion: 0 }, primero);
  const fin: EstadoArranque = { ...e4, pdfOk: 'si', ...FASE, crmTipo: 'llamada', origen: 'Instagram', interes: 'ventas', telefono: 'postergado' };
  const hFin = { ...conOferta, faseGuardada: true, canalNegocio: 'llamadas' as const, terminado: true };
  listo(fin, hFin, primero);

  const yo = h.filter((x) => x.de === 'yo').map((x) => x.texto);
  assert.deepEqual(yo, ['Hola, soy Ana', NOMBRE_CONFIRMAR[0], 'mi marca: Acme', NEGOCIO_CONFIRMAR[0], PDF_OPCIONES[0]], 'lo que mandó, tal cual');
  assert.ok(h.every((x) => !x.reconstruido), 'en vivo no lleva la marca');
  h.forEach((x, i) => { if (x.de === 'yo') assert.equal(h[i - 1]?.de, 'mako', `«${x.texto}» sin su pregunta`); });
  const textos = h.map((x) => x.texto);
  assert.ok(textos.indexOf('¿Te llamo «Ana»?') === textos.indexOf(NOMBRE_CONFIRMAR[0]) - 1, 'el toque, debajo de su confirmación');
  assert.equal(textos.filter((x) => x.startsWith('¡Hola! Soy MaKo')).length, 1, 'el saludo, una vez');
  assert.equal(h[h.length - 1].id, ID_CIERRE);

  const unido = unirConOffer(h, offer).map((x) => x.texto);
  assert.match(unido[0], /^¡Hola! Soy MaKo/, 'empieza por el saludo, no por la oferta');
  assert.ok(unido.indexOf('¿Tienes un documento de tu oferta?') > unido.findIndex((x) => /cuéntame qué vendes en Acme/.test(x)));
  assert.ok(unido.findIndex((x) => /PDF con tu oferta/.test(x)) > unido.indexOf('Ya tengo todas las piezas.'), 'el PDF, después de Offer');
  assert.ok(unido.indexOf(PDF_OPCIONES[0]) === unido.findIndex((x) => /PDF con tu oferta/.test(x)) + 1, 'y su respuesta, debajo');

  // Con el cierre anotado no se anota más: un negocio renombrado después (el script del ws21) no reescribe lo que pasó.
  assert.equal(conLoNuevo(h, mensajesDeArranque({ ...fin, negocio: 'Otro nombre' }, hFin), { ahora: t + 1_000, vivo: true }), null);
  assert.equal(conLoNuevo(h, vistaDe([]), { ahora: t + 1_000, vivo: true, respuesta: 'hola' }), null);
});

test('5. EN VIVO: la pregunta que vuelve después de una respuesta se anota otra vez («Ver otros tipos»)', () => {
  const crm = (opciones: string[]) => vistaDe([], [m('arr-crm', 'mako', CRM_PREGUNTA, opciones)]);
  let h = conLoNuevo([], crm([CRM_SI, VER_OTROS_TIPOS]), { ahora: 10, vivo: true })!;
  h = conLoNuevo(h, crm([CRM_SI, VER_OTROS_TIPOS]), { ahora: 20, vivo: true, respuesta: loQueContesto(crm([CRM_SI, VER_OTROS_TIPOS]), { opcion: 1 }) })!;
  h = conLoNuevo(h, crm(['Llamada de venta', 'Sesión presencial']), { ahora: 30, vivo: true })!;
  assert.deepEqual(h.map((x) => x.texto), [CRM_PREGUNTA, VER_OTROS_TIPOS, CRM_PREGUNTA]);
  assert.equal(conLoNuevo(h, crm(['Llamada de venta', 'Sesión presencial']), { ahora: 40, vivo: true }), null, 'pero no a cada rato');
  assert.equal(loQueContesto(crm(['Llamada de venta', 'Sesión presencial']), { opcion: 1 }), 'Sesión presencial');
  assert.equal(loQueContesto(crm(['A']), { opcion: 7 }), null);
  assert.equal(loQueContesto(crm(['A']), { texto: '  hola ' }), 'hola');
});

test('6. EN VIVO sin nada anotado y con respuestas ya dadas (a mitad el día del deploy): lo dibujado, marcado reconstruido', () => {
  const v = vistaDe([m('arr-nombre', 'mako', 'Hola'), m('arr-nombre-r', 'yo', 'Ana'), m('arr-negocio', 'mako', '¿Tu negocio?', ['x'])]);
  const h = conLoNuevo([], v, { ahora: 100, vivo: true, respuesta: 'Acme' })!;
  assert.deepEqual(h.map((x) => [x.texto, !!x.reconstruido]), [['Hola', true], ['Ana', true], ['¿Tu negocio?', true], ['Acme', false]]);
  // Sin respuestas dadas (alguien que recién empieza), nada es reconstruido.
  assert.equal(conLoNuevo([], vistaDe([m('arr-nombre', 'mako', 'Hola')]), { ahora: 1, vivo: true })![0].reconstruido, undefined);
});

test('7. el tope: pasado TOPE_MENSAJES no se anota más, y nunca se descarta lo viejo', () => {
  assert.equal(conLoNuevo(hist(TOPE_MENSAJES), vistaDe([m('n', 'mako', 'nueva')]), { ahora: 1e6 }), null);
  const casi = conLoNuevo(hist(TOPE_MENSAJES - 1), vistaDe([m('n1', 'mako', 'uno'), m('n2', 'mako', 'dos')]), { ahora: 1e6 })!;
  assert.equal(casi.length, TOPE_MENSAJES);
  assert.equal(casi[0].id, 'x-0', 'el principio (el saludo, el nombre) queda');
  assert.equal(casi[casi.length - 1].texto, 'uno');
});

test('8. el compare-and-set: lo ilegible no se pisa, una carrera vuelve a leer, nada nuevo no escribe', async () => {
  const conIo = (lecturas: Array<string | null>, gana: boolean[]) => {
    const escrito: string[] = [];
    let i = 0;
    let j = 0;
    return { escrito, io: { leer: async () => lecturas[Math.min(i++, lecturas.length - 1)], cambiar: async (_: string | null, n: string) => { escrito.push(n); return gana[j++] ?? true; } } };
  };
  const calc = (p: MensajeHistorial[]) => conLoNuevo(p, vistaDe([m('a', 'mako', 'Hola')]), { ahora: 1_000, vivo: true });
  const ilegible = conIo(['{roto'], []);
  await assert.rejects(anotarCon(ilegible.io, calc));
  assert.equal(ilegible.escrito.length, 0);
  const raro = conIo([JSON.stringify({ mensajes: [{ id: 'v2', de: 'sistema', texto: 'x', at: iso(1) }] })], []);
  await assert.rejects(anotarCon(raro.io, calc), 'una entrada de una versión más nueva no se borra');
  assert.equal(raro.escrito.length, 0);
  const otro = JSON.stringify({ mensajes: [{ id: 'b', de: 'mako', texto: 'Otra pestaña', at: iso(500) }] });
  const carrera = conIo([null, otro], [false, true]);
  assert.equal(await anotarCon(carrera.io, calc), 1);
  assert.deepEqual(JSON.parse(carrera.escrito[1]).mensajes.map((x: MensajeHistorial) => x.texto), ['Otra pestaña', 'Hola'], 'lo de la otra pestaña queda');
  const igual = conIo([JSON.stringify({ mensajes: [{ id: 'a', de: 'mako', texto: 'Hola', at: iso(1) }] })], []);
  assert.equal(await anotarCon(igual.io, calc), 0);
  assert.equal(igual.escrito.length, 0);
  const siempre = conIo([null], [false, false, false]);
  await assert.rejects(anotarCon(siempre.io, calc), /cambió 3 veces/);
});

test('9. Florencia (ws21): terminó el 18/10 sin historial; reconstruido, su conversación empieza por su nombre', () => {
  const e: EstadoArranque = {
    introVista: true, nombre: 'Florencia', negocio: 'mi marca personal: Florencia Ayelen Carballo', sesionId: 14, pdfOk: 'si',
    faseResp: [1, 0, 0, 2, 0, 2], canal: 'llamadas', crmTipo: 'llamada', origen: 'Me lo recomendaron', interes: 'anuncios',
    telefono: 'verificado', telefonoNumero: '+543874747059',
  };
  const hh: HechosArranque = { ...H, loQueVende: true, faseGuardada: true, canalNegocio: 'llamadas', terminado: true };
  const primero = Date.parse('2026-10-18T22:24:41.169Z');
  const historial = conLoNuevo([], mensajesDeArranque(e, hh), { ahora: Date.parse('2026-10-18T23:07:30.832Z') - 1_000, primeroDeOffer: primero, reconstruido: true })!;
  const offer = [
    { de: 'mako' as const, texto: '¿Tienes un documento de tu oferta, tu guion de ventas o el link de tu web o landing?', at: '2026-10-18T22:24:41.169Z' },
    { de: 'yo' as const, texto: 'https://www.instagram.com/florencia__consultora_tesis/', at: '2026-10-18T22:25:21.500Z' },
    { de: 'mako' as const, texto: 'Perfecto: en la primera semana logran claridad absoluta. ¡Gracias!', at: '2026-10-18T22:53:45.918Z' },
  ];
  const unido = unirConOffer(historial, offer);
  assert.deepEqual(unido.slice(0, 4).map((x) => [x.de, x.texto.slice(0, 22)]), [
    ['mako', '¡Hola! Soy MaKo. Para '], ['yo', 'Florencia'], ['mako', 'Un gusto, Florencia. ¿'], ['yo', 'mi marca personal: Flo'],
  ]);
  const iUltimoOffer = unido.findIndex((x) => x.texto.startsWith('Perfecto: en la primera semana'));
  assert.ok(unido.slice(iUltimoOffer + 1).every((x) => 'reconstruido' in x && x.reconstruido), 'lo de después, todo después de Offer');
  assert.ok(unido.some((x) => x.de === 'yo' && x.texto === 'Me lo recomendaron'));
});

test('10. juntar por hora: cada lista conserva su orden; un mensaje de Offer sin hora queda donde estaba', () => {
  const h = [
    { id: 'b', de: 'yo' as const, texto: 'B', at: iso(20) },
    { id: 'a', de: 'mako' as const, texto: 'A', at: iso(10) },
    { id: 'd', de: 'mako' as const, texto: 'D', at: iso(40) },
  ];
  const o = [{ de: 'mako' as const, texto: 'C', at: iso(20) }, { de: 'yo' as const, texto: 'C2' }, { de: 'mako' as const, texto: 'E', at: iso(50) }];
  assert.deepEqual(unirConOffer(h, o).map((x) => x.texto), ['A', 'B', 'C', 'C2', 'D', 'E'], 'a la misma hora, primero el arranque');
  assert.deepEqual(unirConOffer([], o).map((x) => x.texto), ['C', 'C2', 'E']);
});

test('11. en el Ops Center: el adjunto y el audio sin texto se ven, y «Reconstruido» lo lee sólo el super admin', () => {
  const ms = [
    { de: 'mako' as const, texto: '¿Cómo te llamas?', at: iso(1), reconstruido: true },
    { de: 'yo' as const, texto: 'Ana', at: iso(2), reconstruido: true },
    { de: 'mako' as const, texto: '¿Tienes un documento?', at: iso(3) },
    { de: 'yo' as const, texto: '', at: iso(4), adjuntos: [{ nombre: 'tesis.pdf' }] },
    { de: 'mako' as const, texto: '¿Está correcto?', at: iso(5), reconstruido: true },
  ];
  assert.deepEqual(mensajesDeOffer(ms).map((x) => x.content), ['¿Cómo te llamas?', 'Ana', '¿Tienes un documento?', 'Adjunto: tesis.pdf', '¿Está correcto?']);
  assert.deepEqual(mensajesDeOffer(ms, { avisoReconstruido: true }).map((x) => x.content),
    [AVISO_RECONSTRUIDO, '¿Cómo te llamas?', 'Ana', '¿Tienes un documento?', 'Adjunto: tesis.pdf', AVISO_RECONSTRUIDO, '¿Está correcto?'], 'un aviso por tramo');
  assert.doesNotMatch(AVISO_RECONSTRUIDO, /\b(vos|tenés|podés)\b/, 'español neutro');
  const voz = mensajesDeOffer([
    { de: 'yo', texto: 'El 100% logró el éxito.', at: iso(1), audio: { url: '/api/offer/audio?id=14&m=137906e0', secs: 3 } },
    { de: 'yo', texto: '', at: iso(2), audio: { url: '/api/offer/audio?id=14&m=x', secs: 5 } },
  ]);
  assert.deepEqual(voz[0], { role: 'user', content: 'El 100% logró el éxito.', created_at: iso(1), audio: { url: '/api/offer/audio?id=14&m=137906e0', secs: 3 } });
  assert.equal(voz[1].content, NOTA_DE_VOZ, 'sin transcripción, nunca una burbuja vacía');
});

test('12. el chat «Onboarding» guarda qué mensaje de Offer tiene el audio, y el bloque no lleva ruta de Storage', () => {
  const hilo = mensajesDelHilo([
    { de: 'mako', texto: '¿Cuánto cobras?' },
    { de: 'yo', texto: 'Seis cuotas', id: '4ac9f6df-0000-4000-8000-000000000000', audio: { secs: 110.4 } },
    { de: 'yo', texto: '', id: 'b6caad71-0000-4000-8000-000000000000', audio: { secs: 2 } },
  ], 'anuncios');
  assert.deepEqual(hilo[1], { role: 'user', content: 'Seis cuotas', audio: { mensaje: '4ac9f6df-0000-4000-8000-000000000000', secs: 110 } });
  assert.equal(hilo[2].content, NOTA_DE_VOZ);
  assert.equal(hilo[0].audio, undefined);
  const b = bloqueDeAudio(14, '4ac9f6df-0000-4000-8000-000000000000', 110);
  assert.deepEqual(audioDeBloques([b]), b);
  assert.equal(audioDeBloques([{ k: 'audio', sesion: 14, mensaje: '../21/offer/x' }]), null);
  assert.equal(audioDeBloques([{ k: 'audio', sesion: '14', mensaje: 'a' }]), null);
  assert.deepEqual(sanearBloques(21, [b]), [], 'los adjuntos lo saltean');
  assert.deepEqual(bloquesGuardados([b]), [], 'los bloques de la vista también');
});

// ── El cableado (regex sobre el código: lo que una función pura no puede mostrar) ─────────────────────────────────────
test('13. se anota al CONTESTAR (la ruta, con lo que mandó), nunca al mirar, y con las lecturas confirmadas', () => {
  const ruta = leer('app/api/onboarding/arranque/route.ts');
  assert.match(ruta, /vista: await vistaArranque\(\{ anotar: true \}\) \}\);/);
  const get = ruta.slice(ruta.indexOf('export async function GET'), ruta.indexOf('export async function POST'));
  assert.match(get, /vista: await vistaArranque\(\) \}/, 'el GET no anota');
  assert.match(leer('app/onboarding/page.tsx'), /const vista = await vistaArranque\(\);/, 'la página no anota');
  assert.match(ruta, /const nuevo = await guardarEstadoArranque\(patch\);\n[\s\S]{0,300}?await anotarRespuesta\(e, h, loQueContesto\(mensajesDeArranque\(e, h\), \{ texto, opcion \}\)\);/, 'después de guardar');
  assert.match(ruta, /await anotarRespuesta\(e, h, CODIGO_CARGADO\);/, 'el código no se guarda');
  assert.match(ruta, /await anotarRespuesta\(e, h, `\+\$\{digitos\}`\);/);
  const srv = leer('lib/onboarding-arranque-server.ts');
  const vista = srv.slice(srv.indexOf('export async function vistaArranque'));
  assert.match(vista, /try \{ e = parseEstado\(await getSettingEstricto\(CLAVE\)\); estricto = true; \} catch \{ e = \{\}; \}/, 'el estado, estricto');
  assert.match(vista, /if \(estricto && \(await hechosConfirmados\(h\)\)\) \{/);
  const conf = srv.slice(srv.indexOf('export async function hechosConfirmados'), srv.indexOf('export async function anotarHistorial'));
  for (const lectura of ["getSupabaseServer().from('workspaces').select('capa')", 'getDiagnosticoFaseEstricto()', 'getEstadoOnboardingEstricto()']) {
    assert.ok(conf.includes(lectura), `relee ${lectura}`);
  }
  assert.match(conf, /return modo === h\.modo && capa\.onboarding\.includes\('tabs'\) === h\.conTelefono && \(diag != null\) === h\.faseGuardada\n      && canal === h\.canalNegocio && \(onb\.status === 'done'\) === h\.terminado;/);
  assert.match(srv.slice(srv.indexOf('export async function anotarRespuesta')), /if \(!\(await hechosConfirmados\(h\)\)\) return;/);
  assert.match(srv, /\{ leer: \(\) => getSettingEstricto\(CLAVE_HISTORIAL\), cambiar: \(raw, nuevo\) => cambiarSettingSi\(CLAVE_HISTORIAL, raw, nuevo\) \}/);
  assert.match(leer('lib/fase-store.ts'), /return parseFase\(await getSettingEstricto\(FASE_KEY\)\);/);
});

test('14. el Ops Center pega el historial SÓLO a la conversación del onboarding, con el audio y el aviso sólo al super admin', () => {
  const ind = leer('lib/chat-mako-indice.ts');
  const hilo = ind.slice(ind.indexOf('export async function hiloDeOffer'));
  assert.match(hilo, /runWithWorkspace\(ws, \(\) => Promise\.all\(\[\n    leerConversacionOffer\(id\),\n    getSetting\('onboarding\.arranque'\)\.catch\(\(\) => null\),\n    getSetting\(CLAVE_HISTORIAL\)\.catch\(\(\) => null\),\n    getSesionAdmin\(\)\.catch\(\(\) => null\),\n  \]\)\)/);
  assert.match(hilo, /const deOffer = c\.mensajes\.map\(\(\{ audio, \.\.\.m \}\) => \(audio \? \{ \.\.\.m, audio: \{ url: urlAudio\(c\.id, m\.id\), secs: audio\.secs \} \} : m\)\);/, 'la ruta de Storage no sale');
  assert.match(hilo, /const conversacion = sesionDelArranque\(arranque\) === c\.id \? unirConOffer\(leerHistorial\(historial\) \?\? \[\], deOffer\) : deOffer;/);
  assert.match(hilo, /mensajes: mensajesDeOffer\(conversacion, \{ avisoReconstruido: !!superAdmin \}\)/);
  assert.match(ind, /titulo: s\.id === delOnboarding && !copiada \? TITULO_HILO : s\.titulo/, '«Onboarding» para quien no tiene su copia');
  assert.match(leer('lib/mako-turno-app-reglas.ts'), /audio\?: \{ url: string; secs: number \};/);
});

test('15. el chat «Onboarding» sale del historial (con sus audios), no del estado de hoy', () => {
  const srv = leer('lib/onboarding-arranque-server.ts');
  const f = srv.slice(srv.indexOf('async function mensajesParaElHilo'), srv.indexOf('const primeroDeOffer'));
  assert.match(f, /if \(!\(await hechosConfirmados\(h\)\)\) throw new Error/);
  assert.match(f, /await anotarHistorial\(mensajesDeArranque\(e, h\), \{ primeroDeOffer: primeroDeOffer\(h\) \}\);/);
  assert.match(f, /return mensajesDelHilo\(unirConOffer\(historial, h\.sesion\?\.mensajes \?\? \[\]\), e\.interes\);/);
  assert.doesNotMatch(f, /\.\.\.antes|\.\.\.despues/, 'sin armarlo otra vez del estado');
  assert.match(srv, /bloques: m\.audio && previo\.sesionId \? \[bloqueDeAudio\(previo\.sesionId, m\.audio\.mensaje, m\.audio\.secs\)\] : null,/);
  assert.match(srv, /if \(error && conAudio\) \{/, 'sin la columna, el texto se copia igual');
  assert.match(leer('lib/mako-turno-app.ts'), /\.\.\.\(audio \? \{ audio: \{ url: urlAudio\(audio\.sesion, audio\.mensaje\), secs: audio\.secs \} \} : \{\}\),/);
});

test('16. el script de reconstrucción: en seco por defecto, y no toca un historial que ya existe', () => {
  const s = leer('scripts/reconstruir-historial-onboarding.mts');
  assert.match(s, /const APLICAR = process\.argv\.includes\('--aplicar'\);/);
  assert.match(s, /const previo = leerHistorial\(raw, \{ estricto: true \}\);/);
  assert.match(s, /if \(previo\.length\) return fila\(`ya tiene historial/);
  assert.match(s, /if \(!\(await hechosConfirmados\(h\)\)\) return fila/);
  assert.match(s, /if \(!APLICAR\) return fila\('se reconstruiría'/);
  assert.match(s, /reconstruido: true \}\);/);
  assert.match(s, /cambiarSettingSi\(CLAVE_HISTORIAL, raw, JSON\.stringify\(\{ mensajes: nuevo \}\)\)/);
});

// ROTURAS (22/10/2026, con tests/second-brain-offer.test.ts; base 22/0, una por vez y restaurada):
//   · dedupe por id sin el texto → 21/1 (1) · lo de antes de Offer con la hora de ahora → 20/2 (2, 9)
//   · leer sin `estricto` (escribir borra lo que no entiende) → 20/2 (3, 8) · Offer antes que el historial → 19/3 (4, 9, 10)
//   · en vivo, la respuesta sacada de lo dibujado (se pierde el toque) → 21/1 (4) · la pregunta que vuelve no se anota → 21/1 (5)
//   · a mitad el día del deploy, sin marcar reconstruido → 21/1 (6) · sin congelar con el cierre → 21/1 (4)
//   · el tope que tira lo viejo → 21/1 (7) · `loQueContesto` con el índice crudo → 20/2 (4, 5)
//   · el adjunto sin texto se tira → 21/1 (11) · el audio sin texto deja la burbuja vacía → 21/1 (11)
//   · el aviso «Reconstruido» para cualquiera: en la regla → 21/1 (11) · en el índice → 21/1 (14)
//   · la ruta no anota lo que dice MaKo → 21/1 (13) · ni lo que mandó la persona → 21/1 (13)
//   · anotar con el estado tolerante → 21/1 (13) · confirmar los hechos sin mirar la fase → 21/1 (13)
//   · el historial pegado a CUALQUIER conversación → 21/1 (14) · el chat «Onboarding» sin el historial → 21/1 (15)
//   · audio: el Ops Center lo tira → 21/1 (11) · el índice pasa el mensaje guardado, con su path → 21/1 (14)
//     · la copia no lo guarda → 21/1 (12) · el bloque sin validar el id → 21/1 (12) · el insert sin `bloques` → 21/1 (15)
//     · la lectura del chat no lo da → 21/1 (15)
//   · el título «Onboarding» también para quien tiene su copia → 21/1 (14) · el script encima de un historial → 21/1 (16)
