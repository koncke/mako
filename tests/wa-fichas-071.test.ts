// =============================================================================
// «Completar desde mi WhatsApp» que funciona de punta a punta (25/10/2026, extensión 0.71.0)
// =============================================================================
// Martín, textual: «Si me dice "Instala la extensión de MaKo", si le apreto debería automáticamente salirme el desplegable.
// Tampoco funcionó la extensión... Si ya sabe el nombre del grupo debería buscarlos dentro. Y en el proceso tampoco pasó nada,
// no hay ninguna acción que el usuario vea para saber que está corriendo bien... Soluciona eso y pruebalo de punta a punta».
// MEDIDO en su WhatsApp Web (sólo nombres de campos y cantidades): los 15.244 participantes de sus 293 grupos son `@lid`, el
// 37 % sin `phoneNumber`, y el nombre está en `displayNameLID` (6.252) y casi nunca en `name`/`pushname` (786).
//   1. las reglas: `displayNameLID` es un nombre, un pedido con `@lid` encuentra al que no tiene teléfono, y el grupo se busca
//      por su nombre (sin acentos ni emojis) devolviendo sólo si está y cuántos son;
//   2. el script de WhatsApp Web: el «ping» no abre la base, y el pedido con grupos los contesta;
//   3. el cliente de la página: espera mientras haya avance, y el «no encontré la extensión» de un puente huérfano no le gana
//      a la respuesta viva;
//   4. el worker, EJECUTADO con un `chrome` de mentira: abre WhatsApp Web si no hay, le pone el script si es de antes, espera
//      la base y dice `sin_sesion` si nunca llega; cuenta cada paso a la pestaña que pidió;
//   5. el puente, la barra del lote, el servidor y las versiones, leyendo los archivos.
// PROBADO ROMPIÉNDOLO: ver el pie. Los números y nombres son inventados.
// Correr: node --import tsx --test tests/wa-fichas-071.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { asuntoComparable as asuntoTs, grupoDelEvento, gruposDelLote, EVENTO_TRAIDO_DE_GRUPO } from '../lib/grupo-wa-reglas';

const raiz = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');
const plano = <T,>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');

type Reglas = {
  indexar(c: unknown[], g: unknown[], p: unknown[], v?: unknown[]): Map<string, unknown>;
  indexarLids(c: unknown[], g: unknown[], p: unknown[], v?: unknown[]): Map<string, unknown>;
  fichasDe(i: Map<string, unknown>, t: unknown[], l?: Map<string, unknown> | null): unknown[];
  buscarGrupos(g: unknown[], p: unknown[], n: unknown[], c?: unknown[], v?: unknown[]): unknown[];
  asuntoComparable(s: unknown): string;
};
function cargarReglas(): Reglas {
  const ctx: Record<string, unknown> = {};
  runInNewContext(leer('extension/wa-fichas-reglas.js'), ctx);
  return ctx.MakoWaFichas as Reglas;
}

// Lo que guarda el WhatsApp Web de Martín, con la forma MEDIDA el 25/10 (los datos, inventados).
const CONTACTOS = [
  { id: '301234567890001@lid', phoneNumber: '5491155550001@c.us', displayNameLID: 'Carla Méndez' }, // nombre sólo acá
  { id: '301234567890002@lid', displayNameLID: 'Lucía Ríos' },                                       // sin teléfono
  { id: '301234567890003@lid', phoneNumber: '5491155550003@c.us', name: 'Pedro (agenda)', displayNameLID: 'Pedrito' },
];
const GRUPOS = [{ id: '120363000000000001@g.us', subject: 'Formación de Jan 🚀' }, { id: '120363000000000002@g.us', subject: 'Afiliados' }];
const PARTICIPANTES = [
  { groupId: '120363000000000001@g.us', participants: ['301234567890001@lid', '301234567890002@lid', '301234567890003@lid'] },
  { groupId: '120363000000000002@g.us', participants: ['301234567890003@lid'] },
];

test('1. las reglas: displayNameLID es un nombre, el @lid encuentra al que no tiene teléfono, y el grupo se busca por su nombre', () => {
  const r = cargarReglas();
  const indice = r.indexar(CONTACTOS, GRUPOS, PARTICIPANTES);
  const porLid = r.indexarLids(CONTACTOS, GRUPOS, PARTICIPANTES);
  const fichas = plano(r.fichasDe(indice, [
    { telefono: '5491155550001', lid: '301234567890001@lid' },
    { telefono: '5491155550002', lid: '301234567890002@lid' }, // en su WhatsApp Web no tiene teléfono: sólo por el @lid
    { telefono: '5491155550003', lid: null },
    { telefono: '5491155550099', lid: 'no-es-un-lid' },
  ], porLid)) as Array<{ telefono: string; agenda: string | null; pushname: string | null; grupos: string[] }>;
  assert.deepEqual(fichas.map((f) => [f.telefono, f.agenda, f.pushname]), [
    ['5491155550001', null, 'Carla Méndez'],
    ['5491155550002', null, 'Lucía Ríos'],
    ['5491155550003', 'Pedro (agenda)', 'Pedrito'],
  ]);
  assert.deepEqual(fichas[1].grupos, ['Formación de Jan 🚀'], 'el grupo de quien sólo se conoce por el @lid');
  // Sin el @lid, al que no tiene teléfono no se lo encuentra (por eso el servidor lo manda).
  assert.deepEqual(plano(r.fichasDe(indice, ['5491155550002'], porLid)), []);
  // Los grupos: el nombre sin acentos ni emojis; contesta sólo si está y cuántos son, nunca a quiénes.
  assert.deepEqual(plano(r.buscarGrupos(GRUPOS, PARTICIPANTES, ['Formacion de Jan', 'afiliados', 'No existe'])), [
    { nombre: 'Formacion de Jan', encontrado: true, participantes: 3, conNombre: null },
    { nombre: 'afiliados', encontrado: true, participantes: 1, conNombre: null },
    { nombre: 'No existe', encontrado: false, participantes: null, conNombre: null },
  ]);
  // Con los contactos, de cuántos del grupo WhatsApp sabe el NOMBRE (en el grupo de Martín, 1 de 247: es de anuncios).
  const sinNombre = [...CONTACTOS, { id: '301234567890009@lid', phoneNumber: '5491155550009@c.us' }];
  const conUnoMudo = [{ groupId: '120363000000000001@g.us', participants: [...PARTICIPANTES[0].participants, '301234567890009@lid'] }];
  assert.deepEqual(plano(r.buscarGrupos(GRUPOS, conUnoMudo, ['Formación de Jan'], sinNombre)), [{ nombre: 'Formación de Jan', encontrado: true, participantes: 4, conNombre: 3 }]);
  assert.ok(!JSON.stringify(r.buscarGrupos(GRUPOS, PARTICIPANTES, ['Afiliados'])).includes('@lid'), 'salió un participante');
  // ⚠️ EL NOMBRE DE EMPRESA DE `verified-business-name` (26/10/2026): en el grupo de los 221 de Martín, ninguno tenía nombre en
  // `contact` (la 0.71.0 completó 0) y 83 lo tenían ahí, por su @lid. Con teléfono y con @lid, y cuenta en `conNombre`.
  const mudo = { id: '301234567890007@lid', phoneNumber: '5491155550007@c.us' };                        // sin nombre en `contact`
  const VERIFICADOS = [{ id: '301234567890007@lid', name: 'Panadería Sol', isSmb: true }, { id: 'roto', name: 'x' }, { id: '301234567890008@lid', name: '123' }];
  const conMudo = [...CONTACTOS, mudo];
  const gruposMudo = [{ groupId: '120363000000000001@g.us', participants: [...PARTICIPANTES[0].participants, '301234567890007@lid'] }];
  const porTel = plano(r.fichasDe(r.indexar(conMudo, GRUPOS, gruposMudo, VERIFICADOS), ['5491155550007'])) as Array<{ empresa: string | null; esEmpresa: boolean; grupos: string[] }>;
  assert.deepEqual(porTel.map((f) => [f.empresa, f.esEmpresa, f.grupos]), [['Panadería Sol', true, ['Formación de Jan 🚀']]], 'el nombre de empresa de verified-business-name no se lee por teléfono');
  const soloLid = plano(r.fichasDe(r.indexar([], GRUPOS, gruposMudo, VERIFICADOS), [{ telefono: '5491155550007', lid: '301234567890007@lid' }], r.indexarLids([], GRUPOS, gruposMudo, VERIFICADOS))) as Array<{ empresa: string | null }>;
  assert.deepEqual(soloLid.map((f) => f.empresa), ['Panadería Sol'], 'el nombre de empresa no se lee por @lid');
  assert.deepEqual(plano(r.buscarGrupos(GRUPOS, gruposMudo, ['Formación de Jan'], conMudo, VERIFICADOS)), [{ nombre: 'Formación de Jan', encontrado: true, participantes: 4, conNombre: 4 }]);
  assert.match(leer('extension/wa-fichas.js'), /leerStore\(db, 'verified-business-name'\)/, 'el script no lee la tabla de nombres de empresa');
  // La misma regla de nombre en la extensión y en el servidor (el servidor busca el grupo en su línea con la suya).
  for (const s of ['Formación de Jan 🚀', '  CÍRCULO  tibio #3 ', 'Ñandú · Afiliados']) assert.equal(r.asuntoComparable(s), asuntoTs(s), s);
});

/** Un indexedDB de mentira que cuenta si se abrió la base. */
function indexedDbFalso(existe: boolean) {
  const registro = { abiertas: 0 };
  const stores: Record<string, unknown[]> = { contact: CONTACTOS, 'group-metadata': GRUPOS, participant: PARTICIPANTES };
  const db = {
    objectStoreNames: Object.assign(Object.keys(stores), { contains: (n: string) => n in stores }),
    transaction: (n: string) => ({ objectStore: () => ({ getAll() {
      const req: { result?: unknown; onsuccess?: () => void } = {};
      setTimeout(() => { req.result = stores[n]; req.onsuccess?.(); }, 0);
      return req;
    } }) }),
    close() {},
  };
  return {
    registro,
    api: {
      databases: async () => (existe ? [{ name: 'model-storage' }] : []),
      open() {
        registro.abiertas++;
        const req: Record<string, unknown> & { result?: unknown } = {};
        setTimeout(() => { req.result = db; (req.onsuccess as () => void)(); }, 0);
        return req;
      },
    },
  };
}
async function alScript(existe: boolean, msg: unknown) {
  const idb = indexedDbFalso(existe);
  let oyente: ((m: unknown, s: unknown, r: (x: unknown) => void) => unknown) | null = null;
  const ctx: Record<string, unknown> = { indexedDB: idb.api, setTimeout, console, chrome: { runtime: { onMessage: { addListener: (f: typeof oyente) => { oyente = f; } } } } };
  runInNewContext(leer('extension/wa-fichas-reglas.js'), ctx);
  runInNewContext(leer('extension/wa-fichas.js'), ctx);
  const respuesta = await new Promise((resolve) => { oyente!(msg, {}, (x) => resolve(plano(x))); setTimeout(() => resolve(undefined), 300); });
  return { respuesta, abiertas: idb.registro.abiertas };
}

test('2. el script de WhatsApp Web: el «ping» no abre la base; el pedido con @lid y grupos los contesta', async () => {
  assert.deepEqual(await alScript(true, { tipo: 'WA_FICHAS_PING' }), { respuesta: { ok: true, base: true }, abiertas: 0 }, 'el ping abrió la base');
  assert.deepEqual(await alScript(false, { tipo: 'WA_FICHAS_PING' }), { respuesta: { ok: true, base: false }, abiertas: 0 });
  const { respuesta } = await alScript(true, { tipo: 'WA_FICHAS', pedidos: [{ telefono: '5491155550002', lid: '301234567890002@lid' }], grupos: ['Formación de Jan'] });
  const r = respuesta as { ok: boolean; fichas: Array<{ telefono: string; pushname: string }>; grupos: unknown[] };
  assert.equal(r.ok, true);
  assert.deepEqual(r.fichas.map((f) => [f.telefono, f.pushname]), [['5491155550002', 'Lucía Ríos']]);
  assert.deepEqual(r.grupos, [{ nombre: 'Formación de Jan', encontrado: true, participantes: 3, conNombre: 3 }]);
});

test('3. el cliente de la página: espera mientras hay avance, y un puente huérfano no le gana a la respuesta viva', async () => {
  const ventana = new EventTarget();
  (globalThis as unknown as { window: EventTarget }).window = ventana;
  const { pedirFichasDeWhatsappWeb } = await import('../lib/wa-fichas-cliente');
  const contestar = (id: string, detail: object, cual = 'MAKO_WA_FICHAS') => ventana.dispatchEvent(new CustomEvent(cual, { detail: { id, ...detail } }));
  const pedidos: Array<{ id: string; pedidos: unknown; grupos: unknown }> = [];
  let modo = 'avance';
  ventana.addEventListener('MAKO_WA_FICHAS_PIDO', (ev) => {
    const d = (ev as CustomEvent).detail as { id: string; pedidos: unknown; grupos: unknown };
    pedidos.push(d);
    if (modo === 'avance') {
      // El worker cuenta pasos durante más que el silencio permitido: cada paso lo vuelve a contar.
      setTimeout(() => contestar(d.id, { paso: 'abriendo', texto: 'Abriendo WhatsApp Web en otra pestaña…' }, 'MAKO_WA_FICHAS_AVANCE'), 30);
      setTimeout(() => contestar(d.id, { paso: 'leyendo', texto: 'Buscando el grupo «Formación de Jan» en tu WhatsApp Web…' }, 'MAKO_WA_FICHAS_AVANCE'), 60);
      setTimeout(() => contestar(d.id, { ok: true, fichas: [{ telefono: '1' }], grupos: [{ nombre: 'Formación de Jan', encontrado: true, participantes: 3 }] }), 90);
    } else if (modo === 'huerfano') {
      contestar(d.id, { ok: false, motivo: 'extension' }); // el puente viejo, al toque
      setTimeout(() => contestar(d.id, { ok: true, fichas: [], grupos: [] }), 200); // el vivo, después
    }
  });
  const pasos: string[] = [];
  const r1 = await pedirFichasDeWhatsappWeb([{ telefono: '5491155550002', lid: '301234567890002@lid' }], { grupos: ['Formación de Jan'], alAvanzar: (t) => pasos.push(t), silencioMs: 45 });
  assert.equal(r1.ok, true, 'cortó por silencio con el worker contando pasos');
  assert.deepEqual(pasos, ['Abriendo WhatsApp Web en otra pestaña…', 'Buscando el grupo «Formación de Jan» en tu WhatsApp Web…']);
  assert.deepEqual(plano(pedidos[0].pedidos), [{ telefono: '5491155550002', lid: '301234567890002@lid' }]);
  assert.deepEqual(plano(pedidos[0].grupos), ['Formación de Jan']);
  modo = 'huerfano';
  const r2 = await pedirFichasDeWhatsappWeb(['5491155550002']);
  assert.equal(r2.ok, true, 'el «no encontré la extensión» del puente huérfano le ganó a la respuesta viva');
  modo = 'mudo';
  const r3 = await pedirFichasDeWhatsappWeb(['5491155550002'], { silencioMs: 40 });
  assert.deepEqual(r3, { ok: false, motivo: 'sin_respuesta' });
});

/** El worker, de verdad: las ayudas de WhatsApp Web de background.js y su `esperarCarga`, con un `chrome` de mentira. */
function cargarWorker(c: { tabs: Array<Record<string, unknown>>; pings: Array<unknown>; ahora?: () => number }) {
  const bg = leer('extension/background.js');
  const ayudas = bg.slice(bg.indexOf('const WA_WEB = '), bg.indexOf('/** Abre Flow, o enfoca la pestana que ya esta. */'));
  const esperar = bg.slice(bg.indexOf('function esperarCarga(tabId) {'), bg.indexOf('\n}\n', bg.indexOf('function esperarCarga(tabId) {')) + 3);
  const registro = { creadas: [] as unknown[], recargadas: [] as unknown[], inyectados: [] as unknown[], avisos: [] as string[] };
  let t = 0;
  const fakeChrome = {
    tabs: {
      query: async () => c.tabs,
      create: async (o: Record<string, unknown>) => { registro.creadas.push(o); const tab = { id: 99, url: o.url, status: 'complete' }; c.tabs.push(tab); return tab; },
      reload: async (id: number) => { registro.recargadas.push(id); },
      sendMessage: async () => { const p = c.pings.length ? c.pings.shift() : { ok: true, base: true }; if (p === 'falla') throw new Error('Receiving end does not exist'); return p; },
      onUpdated: { addListener: (f: (id: number, info: { status: string }) => void) => { setTimeout(() => f(99, { status: 'complete' }), 0); for (const x of c.tabs) setTimeout(() => f(x.id as number, { status: 'complete' }), 0); }, removeListener: () => {} },
    },
    scripting: { executeScript: async (o: unknown) => { registro.inyectados.push(o); } },
  };
  const ctx: Record<string, unknown> = {
    chrome: fakeChrome, Promise,
    setTimeout: (f: () => void) => setTimeout(f, 0),
    clearTimeout,
    Date: { now: c.ahora ?? (() => (t += 1000)) },
  };
  runInNewContext(`${esperar}\n${ayudas}\nglobalThis.lista = pestanaDeWhatsappLista;`, ctx);
  const lista = ctx.lista as (avisar: (paso: string, texto: string) => void) => Promise<{ tab: { id: number }; motivo: string | null }>;
  return { registro, correr: () => lista((_p, texto) => registro.avisos.push(texto)) };
}

test('4. el worker abre WhatsApp Web si no hay, le pone el script si es de antes, y espera los chats (o dice sin_sesion)', async () => {
  // a) Sin pestaña: la abre DE FONDO y la usa.
  const a = cargarWorker({ tabs: [], pings: [{ ok: true, base: true }] });
  assert.deepEqual(plano(await a.correr()).motivo, null);
  assert.deepEqual(plano(a.registro.creadas), [{ url: 'https://web.whatsapp.com/', active: false }], 'no la abrió, o la abrió al frente sacando a la persona de MaKo');
  assert.equal(a.registro.avisos[0], 'Abriendo WhatsApp Web en otra pestaña…');
  // b) Pestaña de antes de instalar: el ping falla, se le pone el script y contesta; sin recargarla.
  const b = cargarWorker({ tabs: [{ id: 7, url: 'https://web.whatsapp.com/', status: 'complete' }], pings: ['falla', { ok: true, base: true }] });
  assert.equal(plano(await b.correr()).motivo, null);
  assert.deepEqual(plano(b.registro.inyectados), [{ target: { tabId: 7 }, files: ['wa-fichas-reglas.js', 'wa-fichas.js'] }]);
  assert.deepEqual(b.registro.recargadas, [], 'recargó la pestaña de WhatsApp sin hacer falta');
  // c) Descartada por Chrome: la despierta.
  const c = cargarWorker({ tabs: [{ id: 8, url: 'https://web.whatsapp.com/', discarded: true }], pings: [{ ok: true, base: true }] });
  await c.correr();
  assert.deepEqual(c.registro.recargadas, [8]);
  // d) Abierta pero sin la base (sin la sesión iniciada): espera contándolo y, si nunca llega, `sin_sesion`.
  const d = cargarWorker({ tabs: [{ id: 9, url: 'https://web.whatsapp.com/' }], pings: Array(40).fill({ ok: true, base: false }), ahora: (() => { let x = 0; return () => (x += 7000); })() });
  assert.equal(plano(await d.correr()).motivo, 'sin_sesion');
  assert.ok(d.registro.avisos.includes('Esperando que WhatsApp Web cargue tus chats…'), 'esperó sin decirlo');
  // e) No contesta nunca (ni con el script puesto, ni recargada): `sin_respuesta_wa`, no un «no contestó» genérico.
  const e = cargarWorker({ tabs: [{ id: 10, url: 'https://web.whatsapp.com/' }], pings: Array(60).fill('falla'), ahora: (() => { let x = 0; return () => (x += 7000); })() });
  assert.equal(plano(await e.correr()).motivo, 'sin_respuesta_wa');
  assert.deepEqual(e.registro.recargadas, [10]);
});

test('5. el cableado: el worker cuenta los pasos y repone el puente; el puente no contesta huérfano; la barra abre la instalación', () => {
  const bg = sinComentarios(leer('extension/background.js'));
  const bloque = bg.slice(bg.indexOf("if (msg?.tipo === 'WA_FICHAS_PEDIDO')"), bg.indexOf("if (msg?.tipo === 'WA_ENFOCAR')"));
  assert.match(bloque, /chrome\.tabs\.sendMessage\(origen, \{ tipo: 'WA_FICHAS_AVANCE', id: pedidoId, paso, texto \}\)/, 'los pasos no llegan a la pestaña que pidió');
  assert.match(bloque, /const origen = _s\?\.tab\?\.id;/);
  assert.match(bloque, /conTope\(chrome\.tabs\.sendMessage\(lista\.tab\.id, \{\n\s+tipo: 'WA_FICHAS',/, 'un mensaje a una pestaña congelada esperaba para siempre');
  assert.match(bg, /chrome\.runtime\.onInstalled\.addListener\(\(\) => \{ void asegurarAlarma\(\); void reponerPuenteEnMako\(\); \}\);/);
  assert.match(bg, /func: \(\) => globalThis\.__makoPuenteCargado === true/, 'repone el puente donde ya corre: dos copias en el mismo mundo');
  assert.match(bg, /files: \['mako-puente\.js'\]/);
  const puente = sinComentarios(leer('extension/mako-puente.js'));
  assert.match(puente, /globalThis\.__makoPuenteCargado = true;/);
  const pide = puente.slice(puente.indexOf("window.addEventListener('MAKO_WA_FICHAS_PIDO'"));
  assert.match(pide.slice(0, 300), /if \(huerfano\(\)\) return;/, 'un puente huérfano contesta «no encontré la extensión»');
  assert.match(pide, /chrome\.runtime\.sendMessage\(\{ tipo: 'WA_FICHAS_PEDIDO', id, telefonos, pedidos, grupos \}/);
  assert.match(puente, /new CustomEvent\('MAKO_WA_FICHAS_AVANCE', \{ detail: \{ id: msg\.id, paso: msg\.paso, texto: msg\.texto \} \}\)/);
  // La barra del lote: tocar la opción sin la extensión abre la instalación y espera; al aparecer, arranca sola.
  const barra = sinComentarios(leer('app/crm/AccionesLoteLeads.tsx'));
  assert.match(barra, /setEsperaExt\(true\);\n[\s\S]{0,300}window\.open\('\/extension\/instalar', '_blank', 'noopener'\);/);
  assert.match(barra, /useEffect\(\(\) => \{ if \(esperaExt && extWa === 'si'\) arrancarAlInstalar\(\); \}, \[esperaExt, extWa\]\);/, 'no arranca sola al instalarla');
  assert.match(barra, /const extWa = useExtensionFichas\(\);/, 'la barra no se entera de la extensión en vivo');
  // Corto, para que entre al lado de los botones (en el Chrome de Martín, 25/10, salía «cuando esté, emp…»).
  assert.match(barra, /\{extWa === 'vieja' \? 'Actualiza' : 'Instala'\} la extensión: empieza sola\n/);
  assert.match(barra, /alAvanzar: \(texto, paso\) => setAvance\(avanceCorto\(paso, texto\)\),/, 'el paso de la extensión, largo y cortado con «…»');
  assert.match(barra, /if \(f\.motivo === 'sin_sesion'\) enfocarWhatsappWeb\(\);/, 'sin la sesión, no lleva a WhatsApp Web');
  assert.match(barra, /resumenDeFichas\(t\.pedidos\.length, fichas, a\) \+ gruposEnWhatsappDichos\(f\.grupos\)/, 'el final no dice qué grupo encontró');
});

test('5b. el avance en la barra del lote: frases que entran enteras, nunca cortadas', async () => {
  const { avanceCorto } = await import('../app/crm/enriquecer-cliente');
  assert.equal(avanceCorto('abriendo', 'Abriendo WhatsApp Web en otra pestaña…'), 'Abriendo WhatsApp Web…');
  assert.equal(avanceCorto('abriendo', 'Despertando la pestaña de WhatsApp Web…'), 'Despertando WhatsApp Web…');
  assert.equal(avanceCorto('cargando', 'Esperando que WhatsApp Web cargue tus chats…'), 'Esperando tus chats de WhatsApp…');
  assert.equal(avanceCorto('leyendo', 'Buscando el grupo «Formación de Jan» en tu WhatsApp Web…'), 'Buscando «Formación de Jan»…');
  const largo = 'Buscando el grupo «PROSPECCIÓN · Círculo TIBIO de emprendedores 2026» en tu WhatsApp Web…';
  assert.equal(avanceCorto('leyendo', largo), 'Buscando el grupo en tu WhatsApp…', 'un nombre que no entra se corta en vez de decirse sin él');
  assert.equal(avanceCorto('leyendo', 'Buscando 3 grupos en tu WhatsApp Web…'), 'Buscando los grupos en tu WhatsApp…');
  assert.equal(avanceCorto('otro', 'Completando 37 de 180…'), 'Completando 37 de 180…');
  for (const t of ['Abriendo WhatsApp Web…', 'Esperando tus chats de WhatsApp…', 'Buscando el grupo en tu WhatsApp…']) assert.ok([...t].length <= 44, t);
  // El final dice de cuántos sabe el nombre WhatsApp: sin eso, «1 completado» en un grupo de anuncios se lee como que no anda.
  const { gruposEnWhatsappDichos } = await import('../app/crm/enriquecer-cliente');
  assert.equal(gruposEnWhatsappDichos([{ nombre: 'RETO', encontrado: true, participantes: 247, conNombre: 1 }]), ' El grupo «RETO» está en tu WhatsApp: de sus 247, WhatsApp sabe el nombre de 1.');
  assert.equal(gruposEnWhatsappDichos([{ nombre: 'Otro', encontrado: false, participantes: null, conNombre: null }]), ' El grupo «Otro» no está en tu WhatsApp Web.');
});

test('6. el servidor: el grupo sale del historial del lead; y las versiones de las dos puntas coinciden', async () => {
  assert.equal(grupoDelEvento('«Formación de Jan», a «Prospección › Tibio»'), 'Formación de Jan');
  assert.equal(grupoDelEvento('otra cosa'), null);
  assert.deepEqual(gruposDelLote(['«Afiliados», a «X»', '«Formación de Jan», a «X»', '«formacion de jan», a «Y»', null, 'roto']), ['Formación de Jan', 'Afiliados']);
  assert.match(leer('app/crm/grupo-wa-server.ts'), /await logLeadEvent\(lead\.id, EVENTO_TRAIDO_DE_GRUPO, `«\$\{p\.nombreGrupo\}», a «\$\{destino\.label\}»`/, 'el evento que se escribe no es el que se lee');
  assert.equal(EVENTO_TRAIDO_DE_GRUPO, 'Traído de un grupo de WhatsApp');
  const { VERSION_FICHAS } = await import('../lib/wa-fichas-cliente');
  const man = JSON.parse(leer('extension/manifest.json')) as { version: string };
  assert.equal(VERSION_FICHAS, '0.71.0');
  // La 0.71.1 (26/10/2026) suma `alDiaConSuCarpeta`; la pantalla sigue pidiendo la 0.71.0, que ya lee fichas así.
  const { esMasVieja } = await import('../lib/version-comparar');
  assert.ok(!esMasVieja(man.version, VERSION_FICHAS), 'la pantalla pide una versión más nueva que el paquete');
  assert.match(leer('lib/extension-version.ts'), new RegExp(`EXTENSION_VERSION = '${man.version.replace(/\./g, '\\.')}'`), 'el ZIP no se rearmó (node scripts/zip-extension.mjs)');
  assert.ok(existsSync(join(raiz, `public/mako-puente-${man.version}.zip`)), 'falta el ZIP de la versión nueva');
});

/** `alDiaConSuCarpeta` de background.js, de verdad, con un `chrome` y un `fetch` de mentira. */
function cargarAlDia(o: { corre: string; carpeta: string; tienda?: boolean; intentada?: string; trabajo?: boolean; ciclo?: boolean }) {
  const bg = leer('extension/background.js');
  const desde = bg.indexOf('let fichasEnVuelo = 0;');
  const funcion = bg.slice(desde, bg.indexOf('/** Sin llamadores desde el 01/09/2026.', desde));
  const comparar = bg.slice(bg.indexOf('function esMasVieja(a, b) {'), bg.indexOf('\n}\n', bg.indexOf('function esMasVieja(a, b) {')) + 3);
  const registro = { recargas: 0, guardado: null as unknown };
  const storage: Record<string, unknown> = o.intentada ? { recargaPorCarpeta: o.intentada } : {};
  const ctx: Record<string, unknown> = {
    console: { log() {} },
    corriendo: o.ciclo === true,
    FASES_EN_CURSO: ['generando'],
    registrosInterfaz: async () => (o.trabajo ? [{ fase: 'generando' }] : [{ fase: 'listo' }]),
    fetch: async () => ({ json: async () => ({ version: o.carpeta }) }),
    chrome: {
      runtime: { getManifest: () => ({ version: o.corre, ...(o.tienda ? { update_url: 'https://clients2.google.com' } : {}) }), getURL: (p: string) => `chrome-extension://x/${p}`, reload: () => { registro.recargas++; } },
      storage: { local: { get: async (k: string) => ({ [k]: storage[k] }), set: async (x: Record<string, unknown>) => { Object.assign(storage, x); registro.guardado = x; } } },
    },
  };
  runInNewContext(`${comparar}\n${funcion}\nglobalThis.alDia = alDiaConSuCarpeta;`, ctx);
  return { registro, correr: ctx.alDia as () => Promise<void> };
}

test('7. la extensión se pone al día con su carpeta SOLA: una vez por versión, nunca de la tienda ni a mitad de un trabajo', async () => {
  // Martín no estaba para tocar «Recargar» (25/10): la 0.71.0 quedó en su carpeta y su Chrome siguió con la 0.70.0.
  const a = cargarAlDia({ corre: '0.71.1', carpeta: '0.71.2' });
  await a.correr();
  assert.equal(a.registro.recargas, 1, 'la carpeta trae una versión nueva y no se recargó');
  assert.deepEqual(plano(a.registro.guardado), { recargaPorCarpeta: '0.71.2' });
  for (const [por, o] of [
    ['la carpeta es la misma versión (el reinicio viejo: recargarse no sirve)', { corre: '0.71.1', carpeta: '0.71.1' }],
    ['la carpeta es más vieja', { corre: '0.71.1', carpeta: '0.70.0' }],
    ['viene de la tienda (ahí actualiza Chrome)', { corre: '0.71.1', carpeta: '0.71.2', tienda: true }],
    ['ya lo intentó con esta versión (si no la levanta, no queda en bucle)', { corre: '0.71.1', carpeta: '0.71.2', intentada: '0.71.2' }],
    ['hay un trabajo de Flow en curso', { corre: '0.71.1', carpeta: '0.71.2', trabajo: true }],
    // La revisión adversarial de tren-l (26/10/2026): con un ciclo andando, la recarga cortaba el POST a /api/flow/puente.
    ['hay un ciclo andando (cortaría el POST a /api/flow/puente con los trabajos ya tomados)', { corre: '0.71.1', carpeta: '0.71.2', ciclo: true }],
  ] as const) {
    const x = cargarAlDia(o);
    await x.correr();
    assert.equal(x.registro.recargas, 0, `se recargó aunque ${por}`);
  }
  // Se mira al arrancar, después de cada latido y cuando la pantalla ve una extensión vieja (MAKO_EXTENSION_REVISAR).
  const bg = sinComentarios(leer('extension/background.js'));
  assert.match(bg, /\nvoid alDiaConSuCarpeta\(\);/);
  assert.match(bg, /if \(a\.name === 'ciclo'\) void ciclo\(\)\.then\(\(\) => alDiaConSuCarpeta\(\)\);/);
  assert.match(bg, /if \(msg\?\.tipo === 'REVISAR_CARPETA'\) \{\n\s+void alDiaConSuCarpeta\(\)/);
  assert.match(sinComentarios(leer('extension/mako-puente.js')), /window\.addEventListener\('MAKO_EXTENSION_REVISAR'[\s\S]{0,200}tipo: 'REVISAR_CARPETA'/);
  assert.match(sinComentarios(leer('app/crm/AccionesLoteLeads.tsx')), /window\.dispatchEvent\(new CustomEvent\('MAKO_EXTENSION_REVISAR'\)\);\n\s+window\.open\('\/extension\/instalar'/);
});

// PROBADO ROMPIÉNDOLO (25/10/2026), contra una base de 27 / 0 (éste, enriquecer-lote y wa-fichas-extension), de a una y
// restaurando de una copia (scratchpad romper071.py):
//   · `displayNameLID` no es un nombre (por teléfono)                                       → 26 / 1
//   · el `@lid` del pedido no se usa                                                         → 25 / 2
//   · WhatsApp Web se abre AL FRENTE (saca a la persona de MaKo)                             → 26 / 1
//   · sin reponer el script en la pestaña de antes                                           → 26 / 1
//   · el puente huérfano contesta «no encontré la extensión»                                 → 26 / 1
//   · la página le cree al primer «no encontré la extensión»                                 → 26 / 1
//   · la opción «Desde mi WhatsApp» vuelve a ser gris                                        → 26 / 1
//   · sin arrancar sola al instalarse la extensión                                           → 26 / 1
//   · (0.71.2, 26/10) `hayTrabajoEnCurso` sin el chequeo de `corriendo` (la recarga corta un ciclo) → 7 / 1, sólo éste
