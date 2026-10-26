// =============================================================================
// «Extraer» de un grupo de WhatsApp, a la vista y con el desplegable de la extensión (26/10/2026, extensión 0.72.0)
// =============================================================================
// Martín, textual (26/10): «Quiero que el scraper, con la extensión me redirija a la tab de whatsapp y se vea que está
// interactuando o buscando, que se vea que entra al grupo y ve los contactos. Y que se despliegue la extensión y que allí se
// vea la animación de la extracción... no me gusta que salga el cartel negro abajo y el "extrayendo" arriba... la extensión
// debe tener navegación, que se guarde el registro de las extracciones... pueda seleccionar Scraper o Flow... Que no me diga
// "Completar nombres". No quiero las opciones "Entran a"... Falta un botón, sutil de "Ignorar Admins"... siempre con una
// etiqueta con el nombre del grupo... El botón azul debe ser "Extraer"».
// MEDIDO en su WhatsApp Web (26/10, el grupo de los 221, sólo cantidades): la lista de miembros dibuja el «~nombre» de 53
// personas que `model-storage` no tiene (1 `pushname` de 247), 39 con el teléfono al lado. Recorrerla suma nombres.
//   1. las reglas: qué fila de la lista es un nombre con su teléfono, y que lo visto sólo llena lo vacío;
//   2. el recorrido (wa-recorrer.js) con una pantalla de mentira: busca, entra, abre la lista, baja hasta el final, cuenta
//      cada paso y deja WhatsApp como estaba; sin el grupo, o parado, lo dice;
//   3. el worker, EJECUTADO con un `chrome` de mentira: la pestaña de WhatsApp que YA está al frente (nunca una segunda), el
//      desplegable abierto, el registro de la extracción, el recorrido antes de leer la base, el «Parar» y la vuelta a MaKo;
//   4. el desplegable: Inicio (Scraper o Flow) → el registro → la extracción, y Flow ya no es la puerta de entrada;
//   5. la pantalla de MaKo: «Extraer» arranca la extensión en el acto, sin «Entran a», sin «Completar nombres», con
//      «Ignorar admins», la etiqueta del grupo tal cual, y sin el cartel negro.
// PROBADO ROMPIÉNDOLO: ver el pie. Los números y nombres son inventados.
// Correr: node --import tsx --test tests/wa-extraer-072.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const raiz = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');
const plano = <T,>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const requerir = createRequire(import.meta.url);

type Fila = { titulo: string; secundario?: string };
type Reglas = {
  nombresDeFilas(f: unknown): Map<string, string>;
  sumarVistos(f: unknown[], p: unknown[], v: Map<string, string>): { fichas: Array<Record<string, unknown>>; enPantalla: number };
  esTelefonoDibujado(t: unknown): boolean;
};
const reglas = requerir(join(raiz, 'extension', 'wa-fichas-reglas.js')) as Reglas;

test('1. las reglas: un «~nombre» con su teléfono al lado es un nombre; lo visto sólo llena lo vacío', () => {
  const filas: Fila[] = [
    { titulo: '~ Lucía Ríos', secundario: '+52 1 55 5555 0001' },           // la forma medida: el nombre arriba, el teléfono abajo
    { titulo: '+54 9 11 5555‑0002', secundario: '~Beto' },                  // al revés, y con el guion que no corta
    { titulo: '~ Sin teléfono', secundario: 'Hola, estoy usando WhatsApp' }, // el nombre sin teléfono a la vista: no se cruza
    { titulo: 'Panadería Sol', secundario: '' },                            // de la agenda o una empresa: ya lo da la base
    { titulo: '+52 1 55 5555 0003', secundario: '' },                       // sólo el teléfono
    { titulo: '~ 🙂', secundario: '+52 1 55 5555 0004' },                   // un nombre sin letras no sirve
    { titulo: '~ Lucía otra vez', secundario: '+52 1 55 5555 0001' },       // la primera gana
  ];
  const vistos = reglas.nombresDeFilas(filas);
  // Por sus últimos 10 dígitos, como cruza el resto (con o sin el 9 de Argentina o el 1 de México).
  assert.deepEqual([...vistos.entries()], [['5555550001', 'Lucía Ríos'], ['1155550002', 'Beto']]);
  assert.equal(reglas.esTelefonoDibujado('+52 1 55 5555 0001'), true);
  assert.equal(reglas.esTelefonoDibujado('Hola 123'), false);
  assert.equal(reglas.nombresDeFilas(null).size, 0);
  assert.equal(reglas.nombresDeFilas([{ titulo: '~ Support JanAdmin. del grupo', secundario: '+1 727 239 0298' }]).get('7272390298'), 'Support Jan', 'el rótulo de admin quedó en el nombre');

  // La base gana: a quien ya tiene un nombre no se le pisa; al que no tenía ficha, se le hace una.
  const fichas = [
    { telefono: '5215555550001', agenda: null, pushname: null, empresa: null, esEmpresa: false, grupos: ['RETO'] },
    { telefono: '5491155550002', agenda: 'Roberto (agenda)', pushname: null, empresa: null, esEmpresa: false, grupos: [] },
  ];
  const pedidos = [{ telefono: '5215555550001', lid: null }, { telefono: '5491155550002', lid: null }, '5215555550009'];
  const vistosMas = new Map([...vistos, ['5555550009', 'Nueva']]);
  const r = reglas.sumarVistos(fichas, pedidos, vistosMas);
  assert.deepEqual(plano(r.fichas).map((f) => [f.telefono, f.agenda, f.pushname]), [
    ['5215555550001', null, 'Lucía Ríos'], ['5491155550002', 'Roberto (agenda)', null], ['5215555550009', null, 'Nueva'],
  ]);
  assert.equal(r.enPantalla, 2);
  assert.equal(fichas[0].pushname, null, 'tocó las fichas que le pasaron');
  // Lo que no se pidió no vuelve, aunque se haya visto (la agenda de Martín es suya).
  assert.equal(reglas.sumarVistos([], ['5215555550001'], new Map([['9999999999', 'Otro']])).fichas.length, 0);
  // Y el script de WhatsApp Web lo usa con lo que le pasa el worker.
  const script = sinComentarios(leer('extension/wa-fichas.js'));
  assert.match(script, /const vistos = MakoWaFichas\.nombresDeFilas\(filasVistas\);\n\s+const \{ fichas, enPantalla \} = MakoWaFichas\.sumarVistos\(MakoWaFichas\.fichasDe\(indice, pedidos, porLid\), pedidos, vistos\);/);
  assert.match(script, /const vistas = Array\.isArray\(msg\.vistas\) \? msg\.vistas\.slice\(0, 5000\) : \[\];/);
});

// ── 2. El recorrido, con una pantalla de mentira ─────────────────────────────────────────────────────────────────────
type Recorrido = { ok: boolean; encontrado: boolean; motivo?: string; total?: number; filas: Fila[] };
const recorrer = requerir(join(raiz, 'extension', 'wa-recorrer.js')) as {
  recorrerGrupo(nombre: string, p: unknown, avisar: (paso: string, d: Record<string, unknown>) => void, parado: () => boolean, o?: Record<string, number>): Promise<Recorrido>;
};

/** Una lista de miembros de `n` filas que se ve de a 5; `bajar` avanza 2. */
function pantallaFalsa(o: { grupo?: string | null; n?: number; conVerTodos?: boolean; trabada?: boolean } = {}) {
  const n = o.n ?? 12;
  const miembros: Fila[] = Array.from({ length: n }, (_, i) => (i % 3 === 0 ? { titulo: `~ Persona ${i}`, secundario: `+52 1 55 5555 ${String(i).padStart(4, '0')}` } : { titulo: `+52 1 55 5555 ${String(i).padStart(4, '0')}`, secundario: '' }));
  const r = { escrito: '', abiertos: [] as string[], info: false, lista: false, cerrada: 0, pos: 0 };
  const grupo = o.grupo === undefined ? 'Formación de Jan' : o.grupo;
  const p = {
    escribirBusqueda: async (t: string) => { r.escrito = t; return true; },
    filaDelGrupo: (nombre: string) => (grupo && r.escrito && nombre === grupo ? { fila: grupo } : null),
    abrir: (el: { fila?: string; ver?: boolean }) => { if (el.fila) r.abiertos.push(el.fila); if (el.ver) r.lista = true; },
    grupoAbierto: (nombre: string) => r.abiertos.includes(nombre),
    abrirInfo: () => { r.info = true; },
    info: () => (r.info ? { info: true } : null),
    miembros: () => n,
    verTodos: () => (o.conVerTodos === false ? null : { ver: true }),
    lista: (conDialogo: boolean) => (conDialogo ? (r.lista ? { l: 1 } : null) : { l: 1 }),
    filasVisibles: () => miembros.slice(r.pos, r.pos + 5),
    posicion: () => r.pos,
    bajar: () => { if (!o.trabada) r.pos = Math.min(n - 5, r.pos + 2); },
    alFinal: () => r.pos >= n - 5,
    cerrar: () => { r.cerrada++; },
  };
  return { p, r, miembros };
}
const rapido = { espera: 50, paso: 0, tope: 5000 };

test('2. el recorrido: busca, entra, abre la lista, la baja hasta el final contando, y deja WhatsApp como estaba', async () => {
  const { p, r, miembros } = pantallaFalsa({ n: 12 });
  const pasos: Array<[string, Record<string, unknown>]> = [];
  const out = await recorrer.recorrerGrupo('Formación de Jan', p, (paso, d) => pasos.push([paso, d]), () => false, rapido);
  assert.equal(out.ok, true);
  assert.equal(out.encontrado, true);
  assert.equal(out.total, 12);
  assert.equal(r.escrito, 'Formación de Jan', 'no buscó el grupo por su nombre');
  assert.deepEqual(r.abiertos, ['Formación de Jan']);
  assert.equal(new Set(out.filas.map((f) => f.titulo)).size, 12, 'no leyó la lista entera');
  assert.deepEqual(new Set(out.filas.map((f) => f.titulo)), new Set(miembros.map((f) => f.titulo)));
  assert.equal(r.cerrada, 1, 'no dejó WhatsApp como estaba');
  // Cada paso se cuenta, en orden, y el último dice cuántos vio y cuántos con nombre.
  assert.deepEqual([...new Set(pasos.map(([x]) => x))], ['buscando', 'entrando', 'miembros', 'recorriendo']);
  assert.deepEqual(plano(pasos.at(-1)![1]), { vistos: 12, total: 12, conNombre: 4 });
  // Un grupo chico: sin «Ver todos», se lee ahí mismo.
  const chico = pantallaFalsa({ n: 6, conVerTodos: false });
  assert.equal((await recorrer.recorrerGrupo('Formación de Jan', chico.p, () => {}, () => false, rapido)).filas.length, 6);
});

test('2b. sin el grupo, parado, o con la lista trabada: lo dice y no se queda colgado', async () => {
  const sin = pantallaFalsa({ grupo: null });
  const a = await recorrer.recorrerGrupo('Otro grupo', sin.p, () => {}, () => false, rapido);
  assert.deepEqual([a.ok, a.encontrado, a.motivo], [false, false, 'no_encontrado']);
  assert.equal(sin.r.cerrada, 1, 'dejó la búsqueda escrita');
  assert.deepEqual(sin.r.abiertos, [], 'abrió algo sin encontrar el grupo');
  let llamadas = 0;
  const parar = pantallaFalsa({ n: 40 });
  const b = await recorrer.recorrerGrupo('Formación de Jan', parar.p, () => {}, () => ++llamadas > 3, rapido);
  assert.deepEqual([b.ok, b.motivo], [false, 'parado']);
  assert.ok(b.filas.length > 0 && b.filas.length < 40, 'paró sin devolver lo que ya había visto, o no paró');
  const trabada = pantallaFalsa({ n: 40, trabada: true });
  const t0 = Date.now();
  const c = await recorrer.recorrerGrupo('Formación de Jan', trabada.p, () => {}, () => false, rapido);
  assert.equal(c.ok, true);
  assert.ok(Date.now() - t0 < 2000, 'una lista que no baja se esperó hasta el tope');
  // Y en la pantalla de verdad, los selectores medidos y nada de clases.
  const src = sinComentarios(leer('extension/wa-recorrer.js'));
  assert.match(src, /s\.querySelector\('input\[data-tab="3"\]'\)/);
  assert.match(src, /\[data-testid="cell-frame-title"\] span\[title\]/);
  assert.match(src, /for \(const t of \['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'\]\)/);
  assert.match(src, /d\.querySelectorAll\('\[role="complementary"\]'\)/);
  assert.doesNotMatch(src, /className|\.x[0-9a-z]{4,}|classList/, 'un selector por clase: WhatsApp las cambia en cada versión');
  assert.doesNotMatch(src, /data-tab="10"|aria-label="Escribir/, 'toca la caja para escribir mensajes');
  assert.match(src, /if \(enCurso\) \{ responder\(\{ ok: false, motivo: 'ocupado', filas: \[\] \}\); return false; \}/, 'dos recorridos a la vez en la misma pestaña');
});

// ── 3. El worker, ejecutado ──────────────────────────────────────────────────────────────────────────────────────────
function cargarWorker(c: { tabs: Array<Record<string, unknown>>; sinPopup?: boolean }) {
  const bg = leer('extension/background.js');
  const ayudas = bg.slice(bg.indexOf('const WA_WEB = '), bg.indexOf('/** Abre Flow, o enfoca la pestana que ya esta. */'));
  const esperar = bg.slice(bg.indexOf('function esperarCarga(tabId) {'), bg.indexOf('\n}\n', bg.indexOf('function esperarCarga(tabId) {')) + 3);
  const bloques = bg.slice(bg.indexOf("  if (msg?.tipo === 'WA_FICHAS_PEDIDO') {"), bg.indexOf('  // «Ir a WhatsApp Web» desde MaKo'));
  const reg = {
    creadas: [] as unknown[], activadas: [] as number[], enfocadas: [] as number[], popups: [] as unknown[], aTabs: [] as Array<[number, Record<string, unknown>]>,
    storage: {} as Record<string, unknown>,
  };
  const fakeChrome = {
    tabs: {
      query: async () => c.tabs,
      get: async (id: number) => c.tabs.find((t) => t.id === id),
      create: async (o: Record<string, unknown>) => { reg.creadas.push(o); const tab = { id: 99, url: o.url, status: 'complete', windowId: 1 }; c.tabs.push(tab); return tab; },
      update: async (id: number, o: Record<string, unknown>) => { if (o.active) { reg.activadas.push(id); for (const t of c.tabs) t.active = t.id === id; } },
      reload: async () => {},
      sendMessage: async (id: number, m: Record<string, unknown>) => {
        reg.aTabs.push([id, plano(m)]);
        if (m.tipo === 'WA_FICHAS_PING') return { ok: true, base: true, recorre: true };
        if (m.tipo === 'WA_RECORRER') return { ok: true, encontrado: true, total: 2, filas: [{ titulo: '~ Lucía', secundario: '+52 1 55 5555 0001' }] };
        if (m.tipo === 'WA_FICHAS') return { ok: true, fichas: [{ telefono: '5215555550001', pushname: 'Lucía' }], grupos: [], diagnostico: { base: true } };
        return undefined;
      },
      onUpdated: { addListener: () => {}, removeListener: () => {} },
    },
    windows: { update: async (id: number) => { reg.enfocadas.push(id); } },
    action: c.sinPopup ? {} : { openPopup: async (o: unknown) => { reg.popups.push(o); } },
    scripting: { executeScript: async () => {} },
    storage: { local: {
      get: async (k: string | string[]) => { const ks = Array.isArray(k) ? k : [k]; return Object.fromEntries(ks.filter((x) => x in reg.storage).map((x) => [x, plano(reg.storage[x])])); },
      set: async (o: Record<string, unknown>) => { Object.assign(reg.storage, plano(o)); },
    } },
  };
  const ctx: Record<string, unknown> = { chrome: fakeChrome, setTimeout: (f: () => void) => setTimeout(f, 0), clearTimeout, console };
  runInNewContext(`${esperar}\n${ayudas}\nlet fichasEnVuelo = 0;\nglobalThis.atender = (msg, _s, responder) => {\n${bloques}\n  return false;\n};`, ctx);
  const atender = ctx.atender as (m: unknown, s: unknown, r: (x: unknown) => void) => boolean;
  const pedir = (m: Record<string, unknown>, origen = 5) => new Promise<unknown>((resolve) => { atender(m, { tab: { id: origen } }, (x) => resolve(plano(x))); setTimeout(() => resolve('sin respuesta'), 2000); });
  const mandar = (m: Record<string, unknown>) => atender(m, {}, () => {});
  return { reg, pedir, mandar };
}
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('3. el worker «a la vista»: SU pestaña de WhatsApp al frente, el desplegable, el registro, y el recorrido antes de leer', async () => {
  const w = cargarWorker({ tabs: [{ id: 5, url: 'https://hola-mako.com/crm', windowId: 1, active: true }, { id: 7, url: 'https://web.whatsapp.com/', status: 'complete', windowId: 1 }] });
  const r = await w.pedir({ tipo: 'WA_FICHAS_PEDIDO', id: 'w1', visible: true, titulo: 'Formación de Jan', grupos: ['Formación de Jan'], pedidos: [{ telefono: '5215555550001', lid: null }] }) as { ok: boolean };
  assert.equal(r.ok, true);
  assert.deepEqual(w.reg.creadas, [], '⚠️ abrió una SEGUNDA pestaña de WhatsApp Web: le cierra la sesión');
  assert.deepEqual(w.reg.activadas, [7], 'no llevó a la persona a su pestaña de WhatsApp');
  assert.deepEqual(w.reg.enfocadas, [1]);
  assert.deepEqual(plano(w.reg.popups), [{ windowId: 1 }], 'no abrió el desplegable');
  // El recorrido va ANTES de leer la base, y lo que vio viaja con el pedido.
  const aWa = w.reg.aTabs.filter(([id]) => id === 7).map(([, m]) => m.tipo);
  assert.deepEqual(aWa.filter((t) => t !== 'WA_FICHAS_PING'), ['WA_RECORRER', 'WA_FICHAS']);
  const fichas = w.reg.aTabs.find(([, m]) => m.tipo === 'WA_FICHAS')![1];
  assert.deepEqual(fichas.vistas, [{ titulo: '~ Lucía', secundario: '+52 1 55 5555 0001' }]);
  // El registro: la fila de esta extracción, y el desplegable abre en ella.
  await dormir(20);
  const reg = w.reg.storage.extracciones as Array<Record<string, unknown>>;
  assert.equal(reg.length, 1);
  assert.deepEqual([reg[0].id, reg[0].titulo, reg[0].estado, reg[0].fase, reg[0].total], ['w1', 'Formación de Jan', 'corriendo', 'guardando', 1]);
  assert.deepEqual(w.reg.storage.popupVista, { pantalla: 'extraccion', id: 'w1' });
  // Cada paso del recorrido, al registro y a la pestaña de MaKo que pidió (su espera vive de esos avisos).
  w.mandar({ tipo: 'WA_RECORRER_AVANCE', id: 'w1', paso: 'recorriendo', vistos: 120, total: 247, conNombre: 53 });
  await dormir(20);
  const fila = (w.reg.storage.extracciones as Array<Record<string, unknown>>)[0];
  assert.deepEqual([fila.vistos, fila.miembros, fila.conNombre], [120, 247, 53]);
  assert.ok(w.reg.aTabs.some(([id, m]) => id === 5 && m.tipo === 'WA_FICHAS_AVANCE' && m.paso === 'recorriendo'), 'la pestaña de MaKo no se enteró: su espera de 30 s se corta');
  // Un aviso con un id que no está no inventa una fila (de antes de recargarse la extensión).
  w.mandar({ tipo: 'WA_EXTRACCION', id: 'otro', estado: 'listo', nombres: 3 });
  w.mandar({ tipo: 'WA_RECORRER_AVANCE', id: 'otro', paso: 'recorriendo', vistos: 1 });
  await dormir(20);
  assert.equal((w.reg.storage.extracciones as unknown[]).length, 1, 'un aviso suelto creó una extracción');
  // El desplegable, anotado (si no se abre, el porqué queda ahí).
  assert.equal((w.reg.storage.extracciones as Array<Record<string, unknown>>)[0].desplegable, 'abierto');
  // El final que cuenta MaKo: al registro, y de vuelta a MaKo si la persona sigue en WhatsApp.
  w.mandar({ tipo: 'WA_EXTRACCION', id: 'w1', estado: 'listo', nombres: 77, nuevos: 105, texto: '105 leads nuevos en «Lead entrante».' });
  await dormir(30);
  const fin = (w.reg.storage.extracciones as Array<Record<string, unknown>>)[0];
  assert.deepEqual([fin.estado, fin.nombres, fin.nuevos], ['listo', 77, 105]);
  assert.deepEqual(w.reg.activadas, [7, 5], 'no volvió a MaKo al terminar');
});

test('3b. sin `visible` (la 0.71) no toca nada a la vista; el «Parar» llega a WhatsApp y a MaKo; sin desplegable, sigue igual', async () => {
  const w = cargarWorker({ tabs: [{ id: 7, url: 'https://web.whatsapp.com/', status: 'complete', windowId: 1 }] });
  await w.pedir({ tipo: 'WA_FICHAS_PEDIDO', id: 'w2', grupos: ['Formación de Jan'], pedidos: [{ telefono: '5215555550001', lid: null }] });
  assert.deepEqual(plano([w.reg.activadas, w.reg.popups, w.reg.storage.extracciones ?? null]), [[], [], null], 'sin pedirlo, trajo WhatsApp al frente o escribió el registro');
  assert.ok(!w.reg.aTabs.some(([, m]) => m.tipo === 'WA_RECORRER'), 'recorrió el grupo sin que lo pidieran');

  const s = cargarWorker({ tabs: [{ id: 7, url: 'https://web.whatsapp.com/', status: 'complete', windowId: 1 }], sinPopup: true });
  const r = await s.pedir({ tipo: 'WA_FICHAS_PEDIDO', id: 'w3', visible: true, grupos: ['X'], pedidos: [] }) as { ok: boolean };
  assert.equal(r.ok, true, 'sin `chrome.action.openPopup` (Chrome viejo) se cayó');

  const p = cargarWorker({ tabs: [{ id: 7, url: 'https://web.whatsapp.com/', status: 'complete', windowId: 1 }] });
  const enCurso = p.pedir({ tipo: 'WA_FICHAS_PEDIDO', id: 'w4', visible: true, grupos: ['X'], pedidos: [] });
  await dormir(5);
  p.mandar({ tipo: 'WA_PARAR', id: 'w4' });
  await enCurso;
  assert.ok(p.reg.aTabs.some(([id, m]) => id === 7 && m.tipo === 'WA_RECORRER_PARAR'), 'el «Parar» no llegó a WhatsApp Web');
  assert.ok(p.reg.aTabs.some(([id, m]) => id === 5 && m.tipo === 'WA_FICHAS_PARAR'), 'el «Parar» no llegó a MaKo');
  // Y mientras corre, la extensión no se recarga sola a la mitad (`hayTrabajoEnCurso` mira `fichasEnVuelo`).
  assert.match(leer('extension/background.js'), /if \(fichasEnVuelo > 0\) return true;/);
});

test('3c. el manifest y las versiones: el recorrido en WhatsApp Web, aislado; y la pantalla pide la 0.72', async () => {
  const man = JSON.parse(leer('extension/manifest.json')) as { version: string; content_scripts: Array<{ matches: string[]; js: string[]; world?: string }> };
  const wa = man.content_scripts.filter((c) => c.matches.some((m) => m.includes('web.whatsapp.com')));
  assert.deepEqual(wa.map((c) => [c.js, c.world ?? 'ISOLATED']), [[['wa-fichas-reglas.js', 'wa-fichas.js', 'wa-recorrer.js'], 'ISOLATED']]);
  const { VERSION_FICHAS } = await import('../lib/wa-fichas-cliente');
  const { esMasVieja } = await import('../lib/version-comparar');
  assert.equal(VERSION_FICHAS, '0.72.0', 'con una extensión 0.71 la pantalla pediría «a la vista» y no pasaría nada');
  assert.ok(!esMasVieja(man.version, VERSION_FICHAS), 'la pantalla pide una versión más nueva que el paquete');
  assert.ok(leer('extension/injected.js').includes(`VERSION_ESPEJO = '${man.version}'`), 'el espejo de Flow no dice la versión del paquete');
  // El puente pasa `visible` y el título, y trae y lleva el avance de MaKo y el «Parar».
  const puente = sinComentarios(leer('extension/mako-puente.js'));
  assert.match(puente, /window\.addEventListener\('MAKO_WA_EXTRACCION', \(ev\) => \{\n\s+if \(!ev \|\| ev\.target !== window \|\| huerfano\(\)\) return;/);
  assert.match(puente, /new CustomEvent\('MAKO_WA_PARAR', \{ detail: \{ id: msg\.id \} \}\)/);
});

// ── 4. El desplegable ───────────────────────────────────────────────────────────────────────────────────────────────
test('4. el desplegable: Inicio (Scraper o Flow) → el registro → la extracción; Flow ya no es la puerta de entrada', () => {
  const popup = sinComentarios(leer('extension/popup.js'));
  const html = leer('extension/popup.html');
  assert.match(html, /<button id="atras" class="atras" type="button" aria-label="Atrás"/);
  assert.match(popup, /const ATRAS = \{ flow: 'inicio', scraper: 'inicio', extraccion: 'scraper' \};/, 'la flecha no vuelve un paso');
  assert.match(popup, /opcion\('Scraper de WhatsApp',/);
  assert.match(popup, /opcion\('Google Flow',[\s\S]{0,300}\(\) => void ir\(\{ pantalla: 'flow' \}\)\);/);
  assert.match(popup, /void arrancar\(\);\s*$/, 'el desplegable arranca en Flow (`pintar`) en vez de en Inicio');
  assert.doesNotMatch(popup, /^void pintar\(\);/m);
  // Lo de Flow no pisa otra pantalla (un `pintar` que llega tarde).
  assert.match(popup, /function pantalla\(\{[^}]*\}\) \{\n\s+if \(vista\.pantalla !== 'flow'\) return;/);
  // Al abrir: la que está corriendo; si no, donde se dejó.
  assert.match(popup, /if \(viva\) vista = \{ pantalla: 'extraccion', id: viva\.id \};/);
  assert.match(popup, /chrome\.storage\.onChanged\.addListener\(\(c, area\) => \{\n\s+if \(area !== 'local' \|\| !c\.extracciones\) return;/, 'el avance no se dibuja en vivo');
  // La animación: un punto por miembro que se enciende al leerlo (azul con nombre), y las fases con su tilde.
  assert.match(popup, /p\.className = azul \? 'n' : j < leidos \? 'v' : '';/);
  assert.match(html, /\.puntos i\.n \{ background: #2f6df6;/);
  assert.match(html, /@media \(prefers-reduced-motion: reduce\) \{\n\s+\.puntos i \{ transition: none; \}/);
  assert.match(popup, /void enviar\(\{ tipo: 'WA_PARAR', id: e\.id \}\)/, 'sin «Parar» en el desplegable');
  // Una que quedó «corriendo» sin noticias (el navegador cerró la extensión) no se dibuja como viva.
  assert.match(popup, /const enCurso = \(e\) => !!e && e\.estado === 'corriendo' && Date\.now\(\) - \(Number\(e\.actualizado\) \|\| 0\) < CORTADA_MS;/);
  // El registro guarda las últimas 30 (el worker).
  assert.match(leer('extension/background.js'), /await chrome\.storage\.local\.set\(\{ extracciones: lista\.slice\(0, TOPE_REGISTRO\) \}\);/);
});

// ── 5. La pantalla de MaKo ──────────────────────────────────────────────────────────────────────────────────────────
test('5. «Extraer»: arranca la extensión en el acto, sin «Entran a», sin «Completar nombres», con «Ignorar admins»', () => {
  const ui = sinComentarios(leer('app/crm/TraerDeGrupoWA.tsx'));
  // El botón azul dice «Extraer».
  assert.match(ui, /texto: extrayendo \? 'Extrayendo…' : sel\.size \? `Extraer \$\{miles\(sel\.size\)\}` : 'Extraer'/);
  assert.doesNotMatch(ui, /`Traer \$\{|'Traer'|Trayendo/, 'volvió «Traer»');
  // La extensión arranca ANTES de crear los leads (no después), a la vista, con el nombre del grupo.
  const cuerpo = ui.slice(ui.indexOf('const extraer = async'));
  const pide = cuerpo.indexOf('const fichasP = conExt ? pedirFichasDeWhatsappWeb(pedidos, { grupos: [grupo.nombre], visible: true, titulo: grupo.nombre, id }) : null;');
  const trae = cuerpo.indexOf('t = tels.length ? await traerTandas(tels) : null;');
  assert.ok(pide > 0 && trae > pide, 'la extensión arranca después de crear los leads: «al darle a Extraer automáticamente que comience»');
  // Ni «Entran a» (funnel, etapa, etiqueta) ni chips.
  assert.doesNotMatch(ui, /destino=\{|ariaLabel="A qué etapa"|ariaLabel="A qué funnel"|Etiqueta de origen|Sin las etapas que mandan algo|No les manda nada|sin número`/);
  assert.match(ui, /etapa: entrada\?\.key \?\? '', telefonos: tanda \}\)/, 'no entran a la etapa de entrada');
  assert.doesNotMatch(ui, /traerDeGrupoAction\(\{[^}]*etiqueta/, 'la pantalla vuelve a mandar una etiqueta: tiene que ser el nombre del grupo, tal cual');
  assert.match(ui, /funnelId: funnel,/);
  assert.match(ui, /const funnel = destino;/, 'no entran al CRM en el que está parado');
  // «Ignorar admins»: sutil, recordado, y destilda a los admins.
  assert.match(ui, /aria-pressed=\{sinAdmins\}/);
  assert.match(ui, /for \(const p of nuevos\) if \(p\.admin\) \{ if \(v\) n\.delete\(p\.telefono\); else n\.add\(p\.telefono\); \}/);
  assert.match(ui, /window\.localStorage\.setItem\(CLAVE_SIN_ADMINS, v \? '1' : '0'\)/);
  // Lo que pasa, al desplegable: guardando N de M y el final.
  assert.match(ui, /avisarExtraccion\(id, \{\n\s+estado: parar\.current \? 'parado' : 'listo', nombres,/);
  const molde = leer('app/crm/MoldeTraer.tsx');
  assert.match(molde, /\{resumen\.extra\}/);
  // El server: la etiqueta del grupo (la que ya existe, o nueva; una archivada no cuenta) y, si no sirve, sin ella.
  const server = leer('app/crm/grupo-wa-server.ts');
  assert.match(server, /const e = todas\.find\(\(t\) => !t\.archivada_at && claveNombre\(t\.nombre\) === claveNombre\(nombre\)\) \?\? null;/);
  // Y el CRM: sin el cartel negro, ni al extraer de un grupo ni en la barra del lote.
  const board = leer('app/crm/CrmBoard.tsx');
  assert.match(board, /titulo=\{nuevoLead\.traer === 'grupo' \? 'Extraer de un grupo de WhatsApp' :/);
  assert.match(board, /onTraidos=\{\(\) => router\.refresh\(\)\}/, 'volvió el aviso de abajo al extraer');
  assert.match(board, /if \(r\.enLaExtension\) \{ router\.refresh\(\); return; \}/, 'volvió el aviso de abajo en la barra del lote');
  const barra = sinComentarios(leer('app/crm/AccionesLoteLeads.tsx'));
  assert.match(barra, /grupos: t\.grupos, visible: true, titulo, id,/);
  assert.match(barra, /r = \{ texto: resumenDeFichas\(t\.pedidos\.length, fichas, a\) \+ gruposEnWhatsappDichos\(f\.grupos\), hubo: a\.nombres \+ a\.empresas > 0, enLaExtension: true \};/);
  // Sin la extensión el desplegable no tiene nada: ese aviso sí queda.
  assert.match(barra, /enLaExtension: f\.motivo !== 'extension' && f\.motivo !== 'sin_respuesta'/);
});

// PROBADO ROMPIÉNDOLO (26/10/2026), contra una base de 8 / 0, de a una y restaurando de una copia:
//   · el worker sin traer al frente la pestaña de WhatsApp                                 → 7 / 1
//   · el worker sin abrir el desplegable                                                   → 7 / 1
//   · el worker sin el recorrido a la vista                                                → 6 / 2
//   · lo visto en pantalla pisa un nombre que la base ya tenía                             → 7 / 1
//   · el recorrido sin el corte de «la lista no baja»                                      → 7 / 1
//   · el recorrido sin cerrar la información ni borrar la búsqueda                         → 6 / 2
//   · el desplegable sin la guarda de Flow (un `pintar` tarde pisa otra pantalla)          → 7 / 1
//   · «Extraer» crea los leads ANTES de arrancar la extensión                              → 7 / 1
//   · el tablero vuelve a poner el cartel negro con un lote que ya se dijo en la extensión → 7 / 1
