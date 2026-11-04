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
  assert.match(script, /const vistos = MakoWaFichas\.nombresDeFilas\(filasVistas\);\n\s+const sumadas = MakoWaFichas\.sumarVistos\(MakoWaFichas\.fichasDe\(indice, pedidos, porLid\), pedidos, vistos\);/);
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
function cargarWorker(c: { tabs: Array<Record<string, unknown>>; sinPopup?: boolean; escala?: number; recorrer?: (m: Record<string, unknown>) => Promise<unknown> }) {
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
        if (m.tipo === 'WA_RECORRER') return c.recorrer ? c.recorrer(m) : { ok: true, encontrado: true, total: 2, filas: [{ titulo: '~ Lucía', secundario: '+52 1 55 5555 0001' }] };
        if (m.tipo === 'WA_FICHAS') return { ok: true, fichas: [{ telefono: '5215555550001', pushname: 'Lucía' }], grupos: [], diagnostico: { base: true } };
        if (m.tipo === 'WA_PERFILES') return { ok: true, perfiles: [{ telefono: '5215555550001', perfil: { web: 'https://lucia.mx' } }], diag: { intentados: 1, abiertos: 1, conDatos: 1, fallos: {} } };
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
  // Con `escala`, los tiempos del worker corren `escala` veces más rápido (el latido de 10 s, en 10 ms con escala 1000).
  const ctx: Record<string, unknown> = c.escala
    ? { chrome: fakeChrome, setTimeout: (f: () => void, ms?: number) => setTimeout(f, (ms || 0) / c.escala!), clearTimeout, setInterval: (f: () => void, ms: number) => setInterval(f, ms / c.escala!), clearInterval, console }
    : { chrome: fakeChrome, setTimeout: (f: () => void) => setTimeout(f, 0), clearTimeout, setInterval, clearInterval, console };
  runInNewContext(`${esperar}\n${ayudas}\nlet fichasEnVuelo = 0;\nglobalThis.atender = (msg, _s, responder) => {\n${bloques}\n  return false;\n};`, ctx);
  const atender = ctx.atender as (m: unknown, s: unknown, r: (x: unknown) => void) => boolean;
  const pedir = (m: Record<string, unknown>, origen = 5) => new Promise<unknown>((resolve) => { atender(m, { tab: { id: origen, url: 'https://hola-mako.com/crm' } }, (x) => resolve(plano(x))); setTimeout(() => resolve('sin respuesta'), 2000); });
  const mandar = (m: Record<string, unknown>, origen?: number) => atender(m, origen != null ? { tab: { id: origen, url: 'https://hola-mako.com/crm' } } : {}, () => {});
  const cambiarTabs = (t: Array<Record<string, unknown>>) => { c.tabs.splice(0, c.tabs.length, ...t); };
  return { reg, pedir, mandar, cambiarTabs };
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
  // Los perfiles NO van en este pedido (0.73.2): los pide la pantalla de a tandas (un pedido de 5 minutos mata al worker).
  assert.deepEqual(aWa.filter((t) => t !== 'WA_FICHAS_PING'), ['WA_RECORRER', 'WA_FICHAS']);
  const fichas = w.reg.aTabs.find(([, m]) => m.tipo === 'WA_FICHAS')![1];
  assert.deepEqual(fichas.vistas, [{ titulo: '~ Lucía', secundario: '+52 1 55 5555 0001' }]);
  // El registro: la fila de esta extracción, y el desplegable abre en ella.
  await dormir(20);
  const reg = w.reg.storage.extracciones as Array<Record<string, unknown>>;
  assert.equal(reg.length, 1);
  assert.deepEqual([reg[0].id, reg[0].titulo, reg[0].estado, reg[0].fase, reg[0].total], ['w1', 'Formación de Jan', 'corriendo', 'leyendo', 1]);
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

test('3d. vuelve a la pestaña EXACTA desde la que se tocó «Extraer» (con dos CRM y otra de MaKo abiertas), también si se corta', async () => {
  // Martín, 26/10: «tiene que identificar cuál tab es, porque puede tener varios CRM abiertos u otras tab de MaKo».
  const pestanas = () => [
    { id: 5, url: 'https://hola-mako.com/crm', windowId: 1, active: false },
    { id: 6, url: 'https://hola-mako.com/crm', windowId: 2, active: true },
    { id: 8, url: 'https://hola-mako.com/video-generator', windowId: 1, active: false },
    { id: 7, url: 'https://web.whatsapp.com/', status: 'complete', windowId: 1 },
  ];
  for (const final of ['listo', 'error', 'parado']) {
    const w = cargarWorker({ tabs: pestanas() });
    await w.pedir({ tipo: 'WA_FICHAS_PEDIDO', id: 'v1', visible: true, grupos: ['G'], pedidos: [] }, 6);
    w.mandar({ tipo: 'WA_EXTRACCION', id: 'v1', estado: final });
    await dormir(30);
    assert.deepEqual(w.reg.activadas, [7, 6], `con «${final}» no volvió a la pestaña desde la que se tocó (la 6)`);
    assert.deepEqual(w.reg.enfocadas, [1, 2], 'no enfocó la ventana de esa pestaña');
    assert.equal((w.reg.storage.extracciones as Array<Record<string, unknown>>)[0].origenTab, 6, 'el registro no guarda la pestaña de origen');
  }
  // La pestaña de origen ya no está: no elige otra; lo deja dicho para el desplegable.
  const sin = cargarWorker({ tabs: pestanas() });
  await sin.pedir({ tipo: 'WA_FICHAS_PEDIDO', id: 'v2', visible: true, grupos: ['G'], pedidos: [] }, 6);
  // Se cerró la 6 mientras extraía (WhatsApp sigue al frente).
  sin.cambiarTabs(pestanas().filter((t) => t.id !== 6).map((t) => (t.id === 7 ? { ...t, active: true } : t)));
  sin.mandar({ tipo: 'WA_EXTRACCION', id: 'v2', estado: 'listo' });
  await dormir(30);
  assert.deepEqual(sin.reg.activadas, [7], 'eligió otra pestaña de MaKo al azar');
  assert.equal((sin.reg.storage.extracciones as Array<Record<string, unknown>>)[0].volver, 'sin_pestana');
  // ⚠️ CHROME MATÓ EL WORKER a mitad de camino (30/10/2026): la memoria se perdió, y el aviso final igual trae la pestaña de origen.
  const revivido = cargarWorker({ tabs: pestanas().map((x) => (x.id === 7 ? { ...x, active: true } : x)) });
  revivido.mandar({ tipo: 'WA_EXTRACCION', id: 'v3', estado: 'listo' }, 6);
  await dormir(30);
  assert.deepEqual(revivido.reg.activadas, [6], 'sin la memoria del worker no volvió a la pestaña que mandó el aviso');
  // Si la persona se fue de WhatsApp Web a otra cosa, tampoco ahí se la saca.
  const seFue = cargarWorker({ tabs: pestanas() });
  seFue.mandar({ tipo: 'WA_EXTRACCION', id: 'v4', estado: 'listo' }, 6);
  await dormir(30);
  assert.deepEqual(seFue.reg.activadas, [], 'la sacó de donde estaba');
  const popup = sinComentarios(leer('extension/popup.js'));
  assert.match(popup, /b\.addEventListener\('click', \(\) => void abrirMakoEn\('\/crm', e\.origenTab\)\);/, '«Ver en MaKo» va a cualquier pestaña de MaKo');
  assert.match(popup, /if \(e\.volver === 'sin_pestana'\)/);
});

test('3e. mientras WhatsApp Web tarda, un LATIDO cada 10 s; «ocupado» se dice; y al terminar, el recorrido se PARA (MEDIDO 27/10)', async () => {
  const tabs = () => [{ id: 5, url: 'https://hola-mako.com/crm', windowId: 1, active: true }, { id: 7, url: 'https://web.whatsapp.com/', status: 'complete', windowId: 1 }];
  // a. Un recorrido de «150 s» (150 ms a escala): la pantalla recibe latidos sin texto (su espera de 30 s no se corta).
  const lento = cargarWorker({ tabs: tabs(), escala: 1000, recorrer: () => new Promise((ok) => setTimeout(() => ok({ ok: true, encontrado: true, total: 1, filas: [] }), 150)) });
  const r = await lento.pedir({ tipo: 'WA_FICHAS_PEDIDO', id: 'l1', visible: true, grupos: ['G'], pedidos: [] }) as { ok: boolean };
  assert.equal(r.ok, true);
  const latidos = lento.reg.aTabs.filter(([id, m]) => id === 5 && m.tipo === 'WA_FICHAS_AVANCE' && m.paso === 'latido');
  assert.ok(latidos.length >= 2, `sin latidos mientras esperaba (${latidos.length}): la pantalla se rinde a los 30 s`);
  assert.ok(latidos.every(([, m]) => m.texto === undefined), 'el latido cambió lo que dice la pantalla');
  const despues = latidos.length;
  await dormir(40);
  assert.equal(lento.reg.aTabs.filter(([id, m]) => id === 5 && m.paso === 'latido').length, despues, 'el latido siguió después de contestar');

  // b. Otro recorrido sigue en esa pestaña: «ocupado», dicho; ni se lee la base ni se sigue como si nada.
  const ocup = cargarWorker({ tabs: tabs(), recorrer: async () => ({ ok: false, motivo: 'ocupado', filas: [] }) });
  const o = await ocup.pedir({ tipo: 'WA_FICHAS_PEDIDO', id: 'o1', visible: true, grupos: ['G'], pedidos: [] }) as { ok: boolean; motivo: string };
  assert.deepEqual([o.ok, o.motivo], [false, 'ocupado'], 'con otro recorrido andando siguió como si nada');
  assert.ok(!ocup.reg.aTabs.some(([, m]) => m.tipo === 'WA_FICHAS'), 'leyó la base con el recorrido ocupado');
  await dormir(20);
  const fo = (ocup.reg.storage.extracciones as Array<Record<string, unknown>>)[0];
  assert.deepEqual([fo.estado, fo.motivo], ['error', 'ocupado']);

  // c. La pantalla se rinde (o la para) mientras el recorrido anda: se le manda PARAR, y el worker no sigue ni pisa el registro.
  let soltar: (x: unknown) => void = () => {};
  // A escala: con los tiempos instantáneos del arnés, el tope del recorrido vencía antes y el PARAR salía por ese lado.
  const colgado = cargarWorker({ tabs: tabs(), escala: 1000, recorrer: () => new Promise((ok) => { soltar = ok; }) });
  const pendiente = colgado.pedir({ tipo: 'WA_FICHAS_PEDIDO', id: 'c1', visible: true, grupos: ['G'], pedidos: [] });
  await dormir(20);
  colgado.mandar({ tipo: 'WA_EXTRACCION', id: 'c1', estado: 'error', texto: 'La extensión no contestó.' });
  assert.ok(colgado.reg.aTabs.some(([id, m]) => id === 7 && m.tipo === 'WA_RECORRER_PARAR' && m.id === 'c1'), 'el recorrido quedó andando en WhatsApp Web');
  soltar({ ok: false, motivo: 'parado', filas: [] });
  const c = await pendiente as { ok: boolean; motivo: string };
  assert.deepEqual([c.ok, c.motivo], [false, 'parado']);
  assert.ok(!colgado.reg.aTabs.some(([, m]) => m.tipo === 'WA_FICHAS'), 'siguió leyendo la base de una extracción terminada');
  await dormir(20);
  assert.equal((colgado.reg.storage.extracciones as Array<Record<string, unknown>>)[0].estado, 'error', 'pisó el registro de la extracción terminada');
});

test('3f. con la pestaña de WhatsApp OCULTA, la búsqueda se escribe de una vez (Chrome frena cada pausa a 1 por minuto)', async () => {
  const rec = requerir(join(raiz, 'extension', 'wa-recorrer.js')) as { pantallaWhatsapp(d: unknown): { escribirBusqueda(t: string): Promise<boolean> } };
  const escribir = async (hidden: boolean) => {
    const escritos: string[] = [];
    const caja = { tagName: 'INPUT', focus() {}, select() {} };
    const doc = {
      hidden,
      querySelector: (q: string) => (q === 'input[data-tab="3"]' ? caja : null),
      querySelectorAll: () => [],
      execCommand: (cmd: string, _u: boolean, v?: string) => { if (cmd === 'insertText') escritos.push(String(v)); return true; },
    };
    assert.equal(await rec.pantallaWhatsapp(doc).escribirBusqueda('Grupo G'), true);
    return escritos;
  };
  assert.deepEqual(await escribir(true), ['Grupo G'], 'oculta, escribió letra por letra: con Chrome tapado tarda minutos');
  assert.deepEqual(await escribir(false), ['G', 'r', 'u', 'p', 'o', ' ', 'G'], 'a la vista ya no se ve que busca');
});

test('3g. cada etapa con su segundo y la duración total; y si WhatsApp Web corre OCULTA (Chrome tapado), se anota y se dice (27/10)', async () => {
  const w = cargarWorker({ tabs: [{ id: 5, url: 'https://hola-mako.com/crm', windowId: 1, active: true }, { id: 7, url: 'https://web.whatsapp.com/', status: 'complete', windowId: 1 }] });
  await w.pedir({ tipo: 'WA_FICHAS_PEDIDO', id: 't1', visible: true, grupos: ['G'], pedidos: [] });
  w.mandar({ tipo: 'WA_RECORRER_AVANCE', id: 't1', paso: 'recorriendo', vistos: 11, total: 126, oculta: true });
  await dormir(20);
  let fila = (w.reg.storage.extracciones as Array<Record<string, unknown>>)[0];
  assert.equal(fila.oculta, true, 'no quedó anotado que WhatsApp Web corría oculta');
  assert.equal(fila.vecesOculta, 1);
  const alCrm = w.reg.aTabs.filter(([id, m]) => id === 5 && m.tipo === 'WA_FICHAS_AVANCE' && m.paso === 'recorriendo').map(([, m]) => m.texto);
  assert.match(String(alCrm[alCrm.length - 1]), /Chrome quedó tapado por otra ventana/, 'la pantalla de MaKo no dice por qué se arrastra');
  // A la vista otra vez: la marca se apaga (el desplegable vuelve a lo de siempre).
  w.mandar({ tipo: 'WA_RECORRER_AVANCE', id: 't1', paso: 'recorriendo', vistos: 60, total: 126, oculta: false });
  w.mandar({ tipo: 'WA_EXTRACCION', id: 't1', estado: 'listo' });
  await dormir(20);
  fila = (w.reg.storage.extracciones as Array<Record<string, unknown>>)[0];
  assert.equal(fila.oculta, false);
  // Los tiempos: el segundo en que empezó cada fase, y la duración al terminar.
  const tiempos = fila.tiempos as Record<string, number>;
  assert.ok(tiempos && ['abriendo', 'leyendo', 'recorriendo'].every((f) => typeof tiempos[f] === 'number'), `faltan tiempos por etapa: ${JSON.stringify(tiempos)}`);
  assert.equal(typeof fila.duracion, 'number', 'no quedó cuánto tardó todo');
  const popup = sinComentarios(leer('extension/popup.js'));
  assert.match(popup, /e\.fase === 'qr' \? TEXTO_QR : e\.oculta \? TEXTO_OCULTA :/, 'el desplegable no dice que Chrome está tapado');
  assert.match(sinComentarios(leer('extension/wa-recorrer.js')), /oculta: document\.hidden === true/);
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
  assert.match(popup, /const ATRAS = \{ flow: 'inicio', scraper: 'inicio', extraccion: 'scraper', spy: 'inicio' \};/, 'la flecha no vuelve un paso');
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
  const pide = cuerpo.indexOf('const fichasP = conExt ? pedirFichasDeWhatsappWeb(pedidos, { grupos: [grupo.nombre], visible: true, titulo: grupo.nombre, id, alAvanzar: (texto) => avanzarExtraccion(id, { texto }) }) : null;');
  const trae = cuerpo.indexOf('t = tels.length ? await traerTandas(tels, id) : null;');
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
  assert.match(barra, /r = \{ texto: resumenDeFichas\(t\.pedidos\.length, fichas, a\) \+ gruposEnWhatsappDichos\(f\.grupos\) \+ cortePerfiles, hubo: a\.nombres \+ a\.empresas > 0, enLaExtension: true \};/);
  // Sin la extensión el desplegable no tiene nada: ese aviso sí queda.
  assert.match(barra, /enLaExtension: f\.motivo !== 'extension' && f\.motivo !== 'sin_respuesta'/);
});

// ── 6. El QR y el estado de WhatsApp Web, como con Flow (0.72.3) ─────────────────────────────────────────────────────
// Martín, 26/10: «revisa las cosas que tenemos en la extensión de Flow para replicarlas en Scraper, por ejemplo, si el usuario
// no tiene abierto la pestaña de WhatsApp web que la abra sola, si el usuario no escaneó el QR, que la extensión le diga y se
// quede esperando unos minutos... Aprovecha lo que tenemos». ⚠️ El QR NO se probó en vivo: la sesión de Martín está abierta y
// cerrarla (o abrir una segunda pestaña) se la saca. Se prueba acá, con la pantalla y el tiempo de mentira.
type Doc = { querySelector(s: string): unknown; body?: { innerText: string } };
const doc = (o: { side?: boolean; canvasQr?: boolean; texto?: string }): Doc => ({
  querySelector: (sel: string) => {
    if (o.side && sel.includes('#side')) return {};
    if (o.canvasQr && sel.includes('canvas[aria-label]')) return {};
    return null;
  },
  body: { innerText: o.texto ?? '' },
});

test('6. la pantalla de WhatsApp Web: con chats, con el QR (por el lienzo o por el texto), o cargando', () => {
  const r = requerir(join(raiz, 'extension', 'wa-recorrer.js')) as { estadoDeSesion(d: unknown): string | null };
  assert.equal(r.estadoDeSesion(doc({ side: true, canvasQr: true })), 'lista', 'con la columna de chats, está lista aunque haya otro lienzo');
  assert.equal(r.estadoDeSesion(doc({ canvasQr: true })), 'qr');
  assert.equal(r.estadoDeSesion(doc({ texto: 'Pasos para iniciar sesión. Escanea el código QR con tu teléfono' })), 'qr');
  assert.equal(r.estadoDeSesion(doc({ texto: 'Use WhatsApp on your computer. Link with phone number instead. Scan the QR code' })), 'qr');
  assert.equal(r.estadoDeSesion(doc({ texto: 'Cargando tus chats [57%]' })), 'cargando');
  assert.equal(r.estadoDeSesion(null), null);
  // El ping lo manda; lo mira wa-recorrer.js (wa-fichas.js no toca la pantalla: tests/wa-fichas-extension.test.ts, 5).
  assert.match(sinComentarios(leer('extension/wa-fichas.js')), /const sesion = typeof globalThis\.__makoWaSesion === 'function' \? globalThis\.__makoWaSesion\(\) : null;/);
  assert.match(sinComentarios(leer('extension/wa-recorrer.js')), /raiz\.__makoWaSesion = \(\) => estadoDeSesion\(document\);/);
});

/** La espera de `pestanaDeWhatsappLista`, ejecutada: los pings que devuelve la pestaña, y un reloj que avanza 7 s por vuelta. */
function cargarLista(pings: Array<Record<string, unknown>>) {
  const bg = leer('extension/background.js');
  const ayudas = bg.slice(bg.indexOf('const WA_WEB = '), bg.indexOf('/** Abre Flow, o enfoca la pestana que ya esta. */'));
  const esperar = bg.slice(bg.indexOf('function esperarCarga(tabId) {'), bg.indexOf('\n}\n', bg.indexOf('function esperarCarga(tabId) {')) + 3);
  const reg = { creadas: 0, activadas: [] as number[], avisos: [] as Array<[string, string]> };
  let x = 0;
  const fakeChrome = {
    tabs: {
      query: async () => [{ id: 7, url: 'https://web.whatsapp.com/', status: 'complete', windowId: 1 }],
      create: async () => { reg.creadas++; return { id: 99 }; },
      update: async (id: number) => { reg.activadas.push(id); },
      reload: async () => {},
      sendMessage: async () => (pings.length > 1 ? pings.shift() : pings[0]),
      onUpdated: { addListener: () => {}, removeListener: () => {} },
    },
    windows: { update: async () => {} },
    scripting: { executeScript: async () => {} },
  };
  const ctx: Record<string, unknown> = { chrome: fakeChrome, setTimeout: (f: () => void) => setTimeout(f, 0), clearTimeout, console, Date: { now: () => (x += 7000) } };
  runInNewContext(`${esperar}\n${ayudas}\nglobalThis.lista = pestanaDeWhatsappLista;`, ctx);
  const lista = ctx.lista as (avisar: (paso: string, texto: string) => void) => Promise<{ motivo: string | null }>;
  return { reg, correr: () => lista((paso, texto) => reg.avisos.push([paso, texto])) };
}

test('6b. con el QR: lo dice, pone la pestaña al frente y espera MINUTOS (no el minuto de «cargando»); escaneado, sigue', async () => {
  const qr = { ok: true, base: true, recorre: true, sesion: 'qr' };
  // Escanea a la vuelta 12 (~84 s: más que el minuto de antes), después sincroniza, y queda lista.
  const a = cargarLista([qr, ...Array(12).fill(qr), { ok: true, base: true, recorre: true, sesion: 'cargando' }, { ok: true, base: true, recorre: true, sesion: 'lista' }]);
  assert.equal(plano(await a.correr()).motivo, null, 'no esperó a que escaneara');
  assert.ok(a.reg.avisos.some(([p, t]) => p === 'qr' && /Escanea el QR en WhatsApp Web/.test(t)), 'no dijo que escanee el QR');
  assert.deepEqual(a.reg.activadas, [7], 'no puso la pestaña del QR al frente (o la puso en cada vuelta)');
  assert.equal(a.reg.creadas, 0, '⚠️ abrió otra pestaña de WhatsApp Web');
  // Nunca escanea: espera los cinco minutos y dice `sin_sesion`.
  const b = cargarLista([qr]);
  assert.equal(plano(await b.correr()).motivo, 'sin_sesion');
  const vueltasQr = b.reg.avisos.filter(([p]) => p === 'qr').length;
  assert.ok(vueltasQr * 7 >= 4 * 60, `se rindió a los ${vueltasQr * 7} s: tiene que esperar unos minutos`);
  // Y la que sólo está cargando (sin QR) sigue con su minuto.
  const c = cargarLista([{ ok: true, base: false, recorre: true, sesion: 'cargando' }]);
  assert.equal(plano(await c.correr()).motivo, 'sin_sesion');
  assert.ok(c.reg.avisos.length * 7 <= 70, 'cargando, esperó más de un minuto');
});

test('6c. el desplegable dice cómo está WhatsApp Web, como con Flow, y SÓLO mira (nunca abre una pestaña)', async () => {
  const sin = cargarWorker({ tabs: [] });
  assert.deepEqual(await sin.pedir({ tipo: 'WA_ESTADO' }), { pestana: false });
  assert.deepEqual(sin.reg.creadas, [], 'mirar el estado abrió WhatsApp Web');
  const con = cargarWorker({ tabs: [{ id: 7, url: 'https://web.whatsapp.com/', status: 'complete', windowId: 1 }] });
  assert.deepEqual(await con.pedir({ tipo: 'WA_ESTADO' }), { pestana: true, sesion: 'lista' });
  const dormida = cargarWorker({ tabs: [{ id: 7, url: 'https://web.whatsapp.com/', discarded: true, windowId: 1 }] });
  assert.deepEqual(await dormida.pedir({ tipo: 'WA_ESTADO' }), { pestana: true, sesion: 'dormida' });
  const popup = sinComentarios(leer('extension/popup.js'));
  assert.match(popup, /const s = await enviar\(\{ tipo: 'WA_ESTADO' \}\);/);
  assert.match(popup, /ir\('Abrir WhatsApp Web'\)/);
  assert.match(popup, /ir\('Ir a WhatsApp Web'\)/);
  assert.match(popup, /void enviar\(\{ tipo: 'WA_ENFOCAR' \}\)/, 'el botón no usa el camino que nunca abre una segunda pestaña');
  // Durante la extracción, con el QR, la línea de abajo del título dice qué hacer.
  assert.match(popup, /a\.tenue\.textContent = e\.fase === 'qr' \? TEXTO_QR : e\.oculta \? TEXTO_OCULTA : e\.fase === 'perfiles' && e\.ahora \? e\.ahora : TEXTO_A_LA_VISTA;/);
  assert.match(popup, /\{ texto: 'Abro tu WhatsApp', pasos: \['abriendo', 'cargando', 'qr'\] \}/);
});

// ── 7. Los PERFILES de cada contacto (0.73.0) ───────────────────────────────────────────────────────────────────────────
// Martín, 26/10: «Creo que el scraper solo está extrayendo los nombres, cuando podría entrar a cada perfil y fijarse si tiene
// links, redes sociales, email, etc...». ⚠️ La pantalla del perfil no se midió todavía (ver la corrida en vivo): acá, que se
// clasifique bien lo que se lee, que se abra de a uno con tope y pausa, y que se guarde sólo en lo vacío.
test('7. el perfil leído: la web, el Instagram, las otras redes y el correo; los de WhatsApp no; y sin nada, nada', () => {
  const r = reglas as Reglas & { perfilDeInfo(i: unknown): Record<string, unknown> | null };
  const p = r.perfilDeInfo({
    textos: ['Agencia de marketing', 'Escríbenos a hola@agencia.com', 'IG: @otra.cuenta', 'Visítanos https://agencia.mx/contacto.'],
    links: ['https://www.instagram.com/agencia.mx/', 'https://facebook.com/agenciamx', 'https://wa.me/5215555550001', 'https://www.instagram.com/p/abc123'],
  });
  assert.deepEqual(plano(p), {
    web: 'https://agencia.mx/contacto', instagram: 'agencia.mx', email: 'hola@agencia.com', direccion: null, rubro: null, descripcion: null,
    redes: ['facebook: https://facebook.com/agenciamx'],
  });
  // Un «@cuenta» escrito a mano, sin link, también es su Instagram.
  assert.equal(r.perfilDeInfo({ textos: ['Ventas por Insta: @tienda_sol'], links: [] })!.instagram, 'tienda_sol');
  // Lo de WhatsApp no es una web, y un jid no es un correo.
  assert.equal(r.perfilDeInfo({ textos: ['5491155550001@s.whatsapp.net'], links: ['https://wa.me/549115555', 'https://chat.whatsapp.com/abc'] }), null);
  assert.equal(r.perfilDeInfo({ textos: ['Hola, estoy usando WhatsApp', 'Disponible'], links: [] }), null, 'un perfil sin nada inventó algo');
  // ⚠️ La web escrita SIN «https://» (MEDIDO 27/10: así estaba en el primer panel de empresa, y WhatsApp no la dibuja como link).
  const sinHttp = (t: string[]) => r.perfilDeInfo({ textos: t, links: [] });
  assert.equal(sinHttp(['Info. y número de teléfono', 'www.consultoriasol.co', '+57 300 000 0000'])?.web, 'https://www.consultoriasol.co', 'no vio la web escrita sin «https://»');
  assert.equal(sinHttp(['Pedidos en tiendasol.com.mx/pedidos.'])?.web, 'https://tiendasol.com.mx/pedidos');
  assert.equal(sinHttp(['WWW.MiTienda.Store'])?.web, 'https://WWW.MiTienda.Store');
  assert.equal(sinHttp(['Síguenos: instagram.com/tienda_sol'])?.instagram, 'tienda_sol', 'un Instagram sin «https://» no se leyó como Instagram');
  assert.equal(sinHttp(['Síguenos: instagram.com/tienda_sol'])?.web, null, 'el Instagram quedó como su web');
  // Lo que NO es una web: no se inventa.
  assert.equal(sinHttp(['Lunes a viernes.De 9 a 18', 'Gracias.Me encanta', 'S.A. de C.V.', 'Versión 2.5', 'Dr.Juan Pérez']), null, 'inventó una web');
  const correo = sinHttp(['Escríbenos: ventas@agencia.com', 'ventas.mx@gmail.com']);
  assert.equal(correo?.web, null, 'tomó el dominio de un correo como su web');
  assert.equal(correo?.email, 'ventas@agencia.com');
  assert.equal(sinHttp(['wa.me/5215555550001']), null, 'un link de WhatsApp quedó como web');
  assert.equal(r.perfilDeInfo(null), null);
});

test('7b. de a uno, con tope y pausa: busca, abre, lee, vuelve; cuenta cada paso y qué falló', async () => {
  const rec = requerir(join(raiz, 'extension', 'wa-recorrer.js')) as {
    leerPerfiles(g: string, c: unknown[], p: unknown, avisar: (paso: string, d: Record<string, unknown>) => void, parado: () => boolean, o?: Record<string, number>): Promise<{ perfiles: Array<{ telefono: string; perfil: unknown }>; diag: Record<string, unknown> }>;
  };
  // `perfilDeInfo` vive en el global de las reglas, como en la pestaña.
  (globalThis as Record<string, unknown>).MakoWaFichas = reglas;
  const abiertos: string[] = [];
  let vueltas = 0;
  const p = {
    abrirPerfil: async (_g: string, tel: string) => (tel.endsWith('0009') ? { ok: false, motivo: 'sin_fila', busqueda: 'ninguna' }
      // La fila de éste dice su nombre, pero su panel no se pudo leer: el nombre igual vale (0.73.8, lo de Leandro).
      : tel.endsWith('0005') ? { ok: false, motivo: 'sin_panel', busqueda: 'con_mas', nombreFila: { pushname: 'Quinto' } }
      : { ok: true, info: { tel }, busqueda: 'con_mas', menu: ['Mensaje a ~aaa', 'Ver ~aaa'], nombreFila: tel.endsWith('0002') ? { pushname: 'Segundo' } : null }),
    leerPerfil: (info: { tel: string }) => { abiertos.push(info.tel); return info.tel.endsWith('0001') ? { textos: ['hola@sol.com'], links: [] } : { textos: ['Disponible'], links: [] }; },
    volverDelPerfil: async () => { vueltas++; },
    forma: () => ({ lineas: ['Info. del contacto'] }),
    cerrar: () => {},
  };
  const avisos: Array<Record<string, unknown>> = [];
  const candidatos = ['5215555550001', '5215555550002', '5215555550009', '5215555550004', '5215555550005'].map((telefono) => ({ telefono, nombre: null }));
  const r = await rec.leerPerfiles('Formación de Jan', candidatos, p, (paso, d) => avisos.push({ paso, ...d }), () => false, { tope: 5, pausaMin: 0, pausaMax: 0 });
  assert.deepEqual(abiertos, ['5215555550001', '5215555550002', '5215555550004'], 'pasó el tope, o abrió al que no encontró');
  assert.deepEqual(plano(r.perfiles), [
    { telefono: '5215555550001', perfil: { web: null, instagram: null, email: 'hola@sol.com', direccion: null, rubro: null, descripcion: null, redes: [] }, nombre: null },
    { telefono: '5215555550002', perfil: null, nombre: { pushname: 'Segundo' } },
    { telefono: '5215555550005', perfil: null, nombre: { pushname: 'Quinto' } },
  ], 'el nombre de la fila se perdió (o el del que no abrió su panel)');
  assert.deepEqual(plano(r.diag), { intentados: 5, abiertos: 3, conDatos: 1, fallos: { sin_fila: 1, sin_panel: 1 }, forma: { lineas: ['Info. del contacto'] }, menu: ['Mensaje a ~aaa', 'Ver ~aaa'], busqueda: 'con_mas', conNombreFila: 2 });
  assert.equal(vueltas, 5, 'no volvió del perfil (ni del que falló): el siguiente se busca con el panel abierto');
  assert.deepEqual(avisos.slice(0, 2).map((a) => [a.paso, a.hechos, a.total]), [['perfiles', 0, 5], ['perfiles', 1, 5]]);
  assert.match(String(avisos[0].texto), /^Leyendo el perfil de \+5215555550001…$/);
  // Parado: no abre el siguiente.
  let n = 0;
  const parado = await rec.leerPerfiles('X', candidatos, p, () => {}, () => ++n > 1, { tope: 10, pausaMin: 0, pausaMax: 0 });
  assert.equal(parado.diag.intentados, 1);
  // Y en la pantalla de verdad: pausa de persona por defecto, tope 60, y la forma del panel sin datos de nadie.
  const src = sinComentarios(leer('extension/wa-recorrer.js'));
  assert.match(src, /const t = Object\.assign\(\{ tope: 60, espera: 5000, pausaMin: 1200, pausaMax: 2600, desde: 0, total: 0 \}, o \|\| \{\}\);/);
  assert.match(src, /w\.replace\(\/\[\\p\{L\}\]\/gu, 'a'\)\.replace\(\/\\d\/g, '#'\)/, 'la forma del panel deja ver letras de una persona');
});

test('7c. de a TANDAS desde la pantalla: empresas primero, tope 60, 12 por pedido; el perfil sumado y limpio; y el server sólo llena lo vacío', async () => {
  const { candidatosDePerfil, sumarPerfiles, perfilesEnTandas, TOPE_PERFILES, TANDA_PERFILES } = await import('../lib/wa-fichas-cliente');
  assert.deepEqual([TOPE_PERFILES, TANDA_PERFILES], [60, 12]);
  const pedidos = [{ telefono: '5215555550001' }, { telefono: '5215555550002' }, '5215555550003', { telefono: '5215555550002' }];
  const fichas = [
    { telefono: '5215555550002', agenda: null, pushname: null, empresa: 'Panadería Sol', esEmpresa: true, grupos: [] },
    { telefono: '5215555550003', agenda: null, pushname: 'Beto', empresa: null, esEmpresa: false, grupos: [] },
  ];
  // Las empresas primero, después los que NO tienen nombre (0.73.8: la fila del buscador lo dice), al final los que sí.
  assert.deepEqual(candidatosDePerfil(pedidos, fichas), [
    { telefono: '5215555550002', nombre: 'Panadería Sol' }, { telefono: '5215555550001', nombre: null }, { telefono: '5215555550003', nombre: 'Beto' },
  ], 'las empresas no van primero, o se repitió un teléfono');
  // El nombre de la fila: el de la agenda gana al que la persona se puso, y nunca pisa uno que ya había.
  const conNombres = sumarPerfiles(fichas, [
    { telefono: '5215555550003', perfil: null, nombre: { pushname: 'Otro Beto' } },
    { telefono: '5215555550001', perfil: null, nombre: { agenda: 'Ana (agenda)', pushname: 'Ana' } },
    { telefono: '5215555550009', perfil: null, nombre: { pushname: '🙂' } },
  ]);
  assert.deepEqual(conNombres.map((f) => [f.telefono, f.agenda, f.pushname]), [['5215555550002', null, null], ['5215555550003', null, 'Beto'], ['5215555550001', 'Ana (agenda)', null]]);
  // Lo que vuelve del navegador se limpia: una web que no es http(s) no entra; sin ficha, la gana.
  const sumadas = sumarPerfiles(fichas, [{ telefono: '5215555550001', perfil: { web: 'https://a.mx' } }, { telefono: '5215555550002', perfil: { web: 'javascript:alert(1)', email: 'x@y.co' } }, { telefono: '', perfil: {} }]);
  assert.deepEqual(sumadas.map((f) => [f.telefono, f.perfil?.web ?? null, f.perfil?.email ?? null]), [['5215555550002', null, 'x@y.co'], ['5215555550003', null, null], ['5215555550001', 'https://a.mx', null]]);
  // De a tandas: 130 pedidos → 60 (el tope) → 5 pedidos de 12; el avance sabe en qué tanda va; para entre tandas.
  const muchos = Array.from({ length: 130 }, (_, k) => `52155555${String(k).padStart(5, '0')}`);
  const tandas: Array<[number, number, number]> = [];
  const pedir = async (c: ReadonlyArray<{ telefono: string }>, o: { desde: number; total: number }) => {
    tandas.push([c.length, o.desde, o.total]);
    return { ok: true as const, perfiles: c.slice(0, 1).map((x) => ({ telefono: x.telefono, perfil: { email: 'hola@sol.com' } })), diag: { abiertos: c.length, conDatos: 1 } };
  };
  const r = await perfilesEnTandas(muchos, [], { grupo: 'G', id: 'w1', parar: () => false, pedir });
  assert.deepEqual(tandas, [[12, 0, 60], [12, 12, 60], [12, 24, 60], [12, 36, 60], [12, 48, 60]]);
  assert.deepEqual([r.leidos, r.conDatos, r.fichas.length, r.corte], [60, 5, 5, null]);
  let n = 0;
  const parada = await perfilesEnTandas(muchos, [], { grupo: 'G', id: 'w1', parar: () => ++n > 2, pedir });
  assert.equal(parada.corte, 'parado');
  const falla = await perfilesEnTandas(muchos, [], { grupo: 'G', id: 'w1', parar: () => false, pedir: async () => ({ ok: false as const, motivo: 'sin_respuesta_wa' }) });
  assert.equal(falla.corte, 'sin_respuesta_wa', 'una tanda que falla no corta');
  // El worker: el pedido de una tanda es corto (≤ 20, con tope de 4 minutos) y le dice a WhatsApp Web en qué tanda va.
  const w = cargarWorker({ tabs: [{ id: 7, url: 'https://web.whatsapp.com/', status: 'complete', windowId: 1 }] });
  const rp = await w.pedir({ tipo: 'WA_PERFILES_PEDIDO', id: 'w9', grupo: 'G', candidatos: [{ telefono: '5215555550001', nombre: null }], desde: 12, total: 60 }) as { ok: boolean; perfiles: unknown[] };
  assert.equal(rp.ok, true);
  assert.deepEqual(rp.perfiles, [{ telefono: '5215555550001', perfil: { web: 'https://lucia.mx' } }]);
  const alWa = w.reg.aTabs.find(([, m]) => m.tipo === 'WA_PERFILES')![1];
  assert.deepEqual([alWa.desde, alWa.total, alWa.tope], [12, 60, 1]);
  assert.deepEqual(w.reg.creadas, [], '⚠️ abrió una segunda pestaña de WhatsApp Web');
  assert.match(leer('extension/background.js'), /\.slice\(0, 20\) : \[\];[\s\S]{0,1500}\}\), 4 \* 60000\)/, 'una tanda sin tope de tamaño o de tiempo');
  // El server: el perfil se escribe por el camino de «Datos de empresa» (sólo lo vacío).
  const server = leer('app/crm/grupo-wa-server.ts');
  assert.match(server, /if \(f\.perfil\) \{\n\s+const \{ data \} = await db\.from\('leads'\)\.select\(`id, \$\{CAMPOS_DEL_PERFIL\.join\(', '\)\}`\)\.eq\('id', id\)\.maybeSingle\(\);\n\s+const escritos = data \? await completarCamposVacios\(id, parcheDePerfil\(/, 'el perfil pisa lo que el lead ya tiene');
  // Las dos pantallas los piden ANTES de guardar (se guarda todo junto).
  assert.match(leer('app/crm/TraerDeGrupoWA.tsx'), /const pf = await perfilesEnTandas\(pedidos,[\s\S]{0,500}a = await guardarFichasEnTandas\(fichas,/);
  assert.match(leer('app/crm/AccionesLoteLeads.tsx'), /await perfilesEnTandas\(t\.pedidos\.map[\s\S]{0,700}const a = await guardarFichasEnTandas\(fichas,/);
  // Y si los perfiles se cortaron, las dos lo DICEN al final (27/10: antes quedaba «0 nombres» y nada más).
  const traer = leer('app/crm/TraerDeGrupoWA.tsx');
  assert.match(traer, /if \(pf\.corte && pf\.corte !== 'parado'\) cortePerfiles = motivoDeFichas\(pf\.corte\);/, 'un corte de los perfiles quedó mudo');
  assert.match(traer, /cortePerfiles \? ` Los perfiles: \$\{cortePerfiles\}` : ''/);
  assert.match(leer('app/crm/AccionesLoteLeads.tsx'), /const cortePerfiles = pf\?\.corte && pf\.corte !== 'parado' \? ` Los perfiles: \$\{motivoDeFichas\(pf\.corte\)\}` : '';/);
  const { motivoDeFichas } = await import('../lib/wa-fichas-cliente');
  assert.match(motivoDeFichas('ocupado'), /terminando otra extracción/, '«ocupado» sin su texto: cae en «No pude leer tu WhatsApp Web»');
  // El desplegable: la fase y su conteo.
  const popup = sinComentarios(leer('extension/popup.js'));
  assert.match(popup, /\{ texto: 'Leo sus perfiles', pasos: \['perfiles'\] \}/);
  assert.match(popup, /a\.conteo\.lastChild\.textContent = `de \$\{miles\(e\.perfilesTotal\)\} perfiles`;/);
});

// ── 8. Los nombres que FIRMAN los mensajes de un grupo (0.73.5) ───────────────────────────────────────────────────────
// Leandro (26/10): en un grupo cerrado donde la gente escribe, «había un montón de personas que tenían nombres y no extrajo
// nada». El grupo de los 221 de Martín era de anuncios: esa fuente (`notifyName` de cada mensaje) nunca se había probado.
test('7d. los datos de una EMPRESA llegan después de abrir su panel: se espera a que aparezcan, y se lee el panel como quedó (MEDIDO 27/10)', async () => {
  const rec = requerir(join(raiz, 'extension', 'wa-recorrer.js')) as {
    pantallaWhatsapp(d: unknown): { esperarDatos(panel: unknown, tel: string, tope?: number): Promise<{ innerText: string }>; leerPerfil(panel: unknown): { textos: string[] } };
  };
  (globalThis as Record<string, unknown>).MakoWaFichas = reglas;
  const doc = { querySelector: () => null, querySelectorAll: () => [], body: null };
  const pant = rec.pantallaWhatsapp(doc);
  // Una cuenta de empresa: abre sin datos, y el correo y la web llegan a los 400 ms.
  const panel = { innerText: 'Info. del contacto\nSol Panadería\nEsta es una cuenta de empresa.', querySelectorAll: () => [] };
  setTimeout(() => { panel.innerText += '\nhola@sol.com\nhttps://sol.mx'; }, 400);
  const t0 = Date.now();
  const leido = await pant.esperarDatos(panel, '5215555550001', 3000);
  const p = (reglas as Reglas & { perfilDeInfo(i: unknown): Record<string, unknown> | null }).perfilDeInfo(pant.leerPerfil(leido));
  assert.deepEqual([p?.email, p?.web], ['hola@sol.com', 'https://sol.mx'], 'leyó la empresa antes de que llegaran sus datos (la 0.74.0: 0 de 60)');
  assert.ok(Date.now() - t0 < 2500, 'esperó de más con los datos ya a la vista');
  // Una empresa que no tiene ningún dato: espera hasta el tope, no para siempre.
  const t1 = Date.now();
  await pant.esperarDatos({ innerText: 'Info. del contacto\nEsta es una cuenta de empresa.' }, '5215555550002', 900);
  assert.ok(Date.now() - t1 < 1600, 'una empresa sin datos colgó la lectura');
  // Una persona (no empresa): con el panel quieto, sigue enseguida.
  const t2 = Date.now();
  await pant.esperarDatos({ innerText: 'Info. del contacto\nAna' }, '5215555550003', 3000);
  assert.ok(Date.now() - t2 < 1200, 'esperó los datos de empresa en una persona');
  // Y `leerPerfiles` lee el panel que devolvió la espera, no el de antes.
  const conLeer = requerir(join(raiz, 'extension', 'wa-recorrer.js')) as {
    leerPerfiles(g: string, c: unknown[], p: unknown, avisar: () => void, parado: () => boolean, o?: Record<string, number>): Promise<unknown>;
  };
  const leidos: unknown[] = [];
  const fresco = { fresco: true };
  await conLeer.leerPerfiles('G', [{ telefono: '5215555550001', nombre: null }], {
    abrirPerfil: async () => ({ ok: true, info: { viejo: true } }),
    esperarDatos: async () => fresco,
    forma: () => ({}),
    leerPerfil: (x: unknown) => { leidos.push(x); return { textos: [], links: [] }; },
    volverDelPerfil: async () => {},
    cerrar: () => {},
  }, () => {}, () => false, { tope: 1, pausaMin: 0, pausaMax: 0 });
  assert.deepEqual(leidos, [fresco], 'leyó el panel de antes de esperar sus datos');
});

test('8. el `notifyName` de los mensajes: por autor, el último gana, y sólo llena lo vacío; y se lee SÓLO de ese grupo', () => {
  const r = reglas as Reglas & {
    nombresDeMensajes(x: unknown): Map<string, string>;
    sumarNotify(f: unknown[], p: unknown[], n: Map<string, string>): { fichas: Array<Record<string, unknown>>; conNotify: number };
    grupoNombrado(g: unknown[], n: string): { id: string } | null;
  };
  const mapa = r.nombresDeMensajes([
    { author: '301234567890001@lid', notifyName: 'Ana' }, { author: '301234567890001@lid', notifyName: 'Ana Ríos' },
    { author: { _serialized: '5491155550002:12@c.us' }, notifyName: 'Beto' }, { author: '120363@g.us', notifyName: 'grupo' },
    { author: '301234567890003@lid', notifyName: '🙂' }, null,
  ]);
  assert.deepEqual([...mapa], [['301234567890001@lid', 'Ana Ríos'], ['5491155550002@c.us', 'Beto']]);
  const fichas = [{ telefono: '5491155550002', agenda: 'Roberto (agenda)', pushname: null, empresa: null, esEmpresa: false, grupos: [] }];
  const pedidos = [{ telefono: '5215555550001', lid: '301234567890001@lid' }, { telefono: '5491155550002', lid: null }];
  const x = r.sumarNotify(fichas, pedidos, mapa);
  assert.deepEqual(plano(x.fichas).map((f) => [f.telefono, f.agenda, f.pushname]), [['5491155550002', 'Roberto (agenda)', null], ['5215555550001', null, 'Ana Ríos']]);
  assert.equal(x.conNotify, 1, 'pisó el nombre de la agenda');
  assert.equal(r.grupoNombrado([{ id: '1@g.us', subject: 'INFRAGROWTH AI COMMUNITY' }, { id: '2@g.us', subject: 'Otro' }], 'Infragrowth AI')!.id, '1@g.us');
  // El script lee los mensajes de ESE grupo por un rango de claves (sin recorrer la tabla entera) y con tope.
  const script = sinComentarios(leer('extension/wa-fichas.js'));
  assert.match(script, /store\.openCursor\(IDBKeyRange\.bound\(`false_\$\{gid\}_`, `false_\$\{gid\}_\\uffff`\)\)/);
  assert.match(script, /if \(!c \|\| n >= 30000\) \{ listo\(\); return; \}/);
  assert.match(script, /if \(nombre\) \{ diag\.conNombre\+\+; registros\.push\(\{ author: autor, notifyName: nombre \}\); \}/, 'saca del mensaje algo más que el autor y su nombre');
  assert.match(script, /for \(const k of Object\.keys\(v\)\) diag\.campos\[k\]/, 'el diagnóstico de los campos manda valores');
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
// Y el QR (0.72.3), contra 11 / 0:
//   · con el QR se rinde al minuto (sin los cinco de espera)                                → 10 / 1
//   · la pestaña del QR no va al frente                                                     → 10 / 1
//   · una sesión abierta (con la columna de chats) se lee como QR                           → 10 / 1
//   · el estado de WhatsApp Web sin el botón para abrirlo                                   → 10 / 1
//   · con el QR, el desplegable no dice qué hacer                                           → 10 / 1
// Y los perfiles (0.73.0), contra 14 / 0 (el 7 encontró uno de verdad: una publicación de Instagram quedaba como «web»):
//   · sin el tope por corrida                                                              → 13 / 1
//   · no vuelve del perfil que falló (el siguiente se busca con el panel abierto)          → 13 / 1
//   · las empresas no van primero                                                          → 13 / 1 (hoy en lib/wa-fichas-cliente.ts)
//   · una publicación de una red queda como web                                            → 13 / 1
//   · una web que no es http(s) entra (el server)                                          → 13 / 1
// Y las tandas (0.73.2), contra 14 / 0: un solo pedido de 60 → 13 / 1; una tanda que falla no corta → 13 / 1.
// Y la vuelta a la pestaña exacta (0.74.0), contra 16 / 0: volver sólo con «listo» → 15 / 1; volver a «la primera pestaña de
// hola-mako.com» en vez de la que mandó el pedido → 15 / 1.
