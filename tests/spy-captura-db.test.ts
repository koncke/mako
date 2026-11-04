// =============================================================================
// «Guardar en Spy»: qué se escribe, con una base de mentira (3/11/2026)
// =============================================================================
// Lo que se puede equivocar acá no es la consulta, es la decisión: de quién son los anuncios, si se le crea
// un competidor, qué le pasa a su Página, y que una pestaña a medias no marque nada como «ya no se ve».
// Se carga el módulo real con sus vecinos de la base reemplazados: `server-only` no deja importarlo de otra
// forma, y lo que corre tiene que ser lo que corre en producción.
//
// La ruta se prueba igual: token malo, cuerpo gigante, cuerpo roto y un sitio prohibido no llegan a escribir.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import type { Captura, Token } from '../lib/spy-captura';

type Comp = { id: number; nombre: string; landing_url: string | null; pagina_anuncios: string | null };
type Vista = { canal: string; ref: string; fuente: string; url?: string; dejoDeVerseEn?: string | null };

const estado = {
  competidores: [] as Comp[],
  vistas: [] as Vista[][],
  funnels: [] as Array<{ id: number; ref: string; lector: string; pixeles: string[] }>,
  updates: [] as Array<Record<string, unknown>>,
  altas: [] as string[],
  actos: 0,
  errorVistas: null as string | null,
  workspaces: [] as Array<number | null>,
  tokenBueno: 'flow_bueno',
};

const db = {
  from: () => ({
    update: (fila: Record<string, unknown>) => ({ eq: async () => { estado.updates.push(fila); return { error: null }; } }),
    select: () => ({ order: () => ({ limit: async () => ({ data: estado.competidores, error: null }) }) }),
  }),
};

const falsos: Record<string, unknown> = {
  'server-only': {},
  spy: {
    agregarCompetidor: async (pegado: string) => {
      estado.altas.push(pegado);
      const c: Comp = { id: 50, nombre: pegado.replace(/^https?:\/\/(www\.)?/, '').split('/')[0], landing_url: /^https?:/.test(pegado) ? pegado : null, pagina_anuncios: null };
      estado.competidores.push(c);
      return { ok: true, competidor: c };
    },
    leerCompetidor: async (id: number) => estado.competidores.find((c) => c.id === id) ?? null,
    guardarVistas: async (_id: number, v: Vista[]) => {
      estado.vistas.push(v);
      return estado.errorVistas ? { nuevas: 0, actualizadas: 0, error: estado.errorVistas } : { nuevas: v.length, actualizadas: 0 };
    },
    guardarFunnel: async (id: number, ref: string, lector: string, l: { pixeles: Array<{ proveedor: string }> }) => {
      estado.funnels.push({ id, ref, lector, pixeles: l.pixeles.map((p) => p.proveedor) });
    },
    // Si alguien las llama, el test lo dice: no pueden ni existir en este camino.
    marcarDejadas: () => { throw new Error('una pestaña a medias no marca nada como «ya no se ve»'); },
  },
  'spy-actos': { marcarActosSpy: async () => { estado.actos += 1; } },
  workspace: {
    getTenantDb: async () => db,
    runWithWorkspace: (ws: number | null, fn: () => unknown) => { estado.workspaces.push(ws); return fn(); },
  },
  'flow-cola': { workspaceDeToken: async (t: string) => (t === estado.tokenBueno ? 3 : null) },
  'spy-compartido-db': new Proxy({}, { get: () => () => { throw new Error('lo leído de Meta no se comparte'); } }),
};

const M = Module as unknown as { _load: (pedido: string, padre: unknown, main: boolean) => unknown };
const original = M._load;
M._load = (pedido, padre, main) => {
  const nombre = pedido.split('/').pop() as string;
  const propio = pedido.startsWith('.') || pedido.startsWith('@/');
  if (pedido === 'server-only') return falsos['server-only'];
  if (propio && nombre in falsos) return falsos[nombre];
  return original(pedido, padre, main);
};
// eslint-disable-next-line @typescript-eslint/no-require-imports -- los falsos de arriba tienen que estar puestos antes de cargarlo
const { guardarCaptura, fichasParaLaExtension } = require('../lib/spy-captura-db') as typeof import('../lib/spy-captura-db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('../app/api/competitor-spy/extension/route') as typeof import('../app/api/competitor-spy/extension/route');

beforeEach(() => {
  estado.competidores = [];
  estado.vistas = [];
  estado.funnels = [];
  estado.updates = [];
  estado.altas = [];
  estado.actos = 0;
  estado.errorVistas = null;
  estado.workspaces = [];
});

const tarjeta = (id: string, pagina: string, handle: string, destino: string): Token[] => [
  ['t', 'Activo'],
  ['t', `Identificador de la biblioteca: ${id}`],
  ['t', 'En circulación desde el 29 jul 2026'],
  ['a', `https://www.facebook.com/${handle}/`, pagina],
  ['t', 'Publicidad'],
  ['t', `El texto de ${pagina}`],
  ['a', `https://l.facebook.com/l.php?u=${encodeURIComponent(`https://${destino}/x`)}`, `${destino.toUpperCase()}\nEl titular\nMás información`],
];
const biblioteca = (extra: Partial<Extract<Captura, { modo: 'biblioteca' }>> = {}): Captura => ({
  modo: 'biblioteca', busqueda: '"ana.com"', pagina: '', id: '',
  tokens: [
    ...tarjeta('1000000000000001', 'Ana', 'anaoficial', 'ana.com'),
    ...tarjeta('1000000000000002', 'Ana', 'anaoficial', 'ana.com'),
    ...tarjeta('1000000000000003', 'Otra Marca', 'otramarca', 'otra.com'),
  ],
  ...extra,
});
const sitio = (url = 'https://www.ana.com/vsl'): Captura => ({
  modo: 'sitio', url, titulo: 'Su VSL',
  recursos: ['https://www.googletagmanager.com/gtm.js?id=GTM-ABCD123'], scripts: [], enlaces: ['https://pay.hotmart.com/A1'], iframes: [], formularios: [],
});

test('a su ficha entran sólo los suyos, y se avisa cuántos quedaron afuera', async () => {
  estado.competidores = [{ id: 7, nombre: 'Ana', landing_url: null, pagina_anuncios: null }];
  const r = await guardarCaptura(biblioteca(), 7);
  assert.deepEqual(r, { ok: true, tipo: 'anuncios', competidor: { id: 7, nombre: 'Ana' }, guardados: 2, nuevos: 2, otros: 1 });
  assert.deepEqual(estado.vistas[0].map((v) => v.ref), ['1000000000000001', '1000000000000002']);
  assert.ok(estado.vistas[0].every((v) => v.canal === 'anuncios' && v.fuente === 'recorrido'));
  assert.equal(estado.altas.length, 0, 'ya existía: no se crea otro');
  assert.equal(estado.actos, 0);
});

test('su Página: el id gana al nombre, y un id nunca se cambia por un nombre', async () => {
  estado.competidores = [{ id: 7, nombre: 'Ana', landing_url: null, pagina_anuncios: null }];
  await guardarCaptura(biblioteca(), 7);
  assert.equal(estado.updates[0].pagina_anuncios, 'anaoficial', 'sin id, el nombre que tiene en la dirección');

  estado.updates = [];
  estado.competidores = [{ id: 7, nombre: 'Ana', landing_url: null, pagina_anuncios: 'anaoficial' }];
  await guardarCaptura(biblioteca({ pagina: '555566667777' }), 7);
  assert.equal(estado.updates[0].pagina_anuncios, '555566667777', 'el id reemplaza al nombre');

  estado.updates = [];
  estado.competidores = [{ id: 7, nombre: 'Ana', landing_url: null, pagina_anuncios: '555566667777' }];
  await guardarCaptura(biblioteca(), 7);
  assert.deepEqual(estado.updates, [], 'y al revés, no');
});

test('en la Página de un anunciante todo es suyo', async () => {
  estado.competidores = [{ id: 7, nombre: 'Un nombre que no coincide', landing_url: null, pagina_anuncios: null }];
  const r = await guardarCaptura(biblioteca({ pagina: '555566667777' }), 7);
  assert.ok(r.ok && r.tipo === 'anuncios' && r.guardados === 3 && r.otros === 0);
});

test('«Agregar como competidor» crea al que más aparece, y marca el paso del onboarding', async () => {
  const r = await guardarCaptura(biblioteca(), null);
  assert.deepEqual(estado.altas, ['Ana']);
  assert.equal(estado.actos, 1);
  assert.ok(r.ok && r.tipo === 'anuncios' && r.guardados === 2 && r.otros === 1);
});

test('nada que guardar se dice, y no se crea a nadie', async () => {
  const sin = await guardarCaptura(biblioteca({ tokens: [['t', 'Biblioteca'], ['a', 'https://www.facebook.com/ads/library/', 'x']] }), null);
  assert.ok(!sin.ok && sin.motivo === 'sin-anuncios');
  assert.equal(estado.altas.length, 0, 'una pestaña que no cargó no crea un competidor');
  assert.equal(estado.vistas.length, 0);

  estado.competidores = [{ id: 7, nombre: 'Nadie Parecido', landing_url: null, pagina_anuncios: null }];
  const deOtro = await guardarCaptura(biblioteca(), 7);
  assert.ok(!deOtro.ok && deOtro.motivo === 'de-otro');
  assert.match(deOtro.ok ? '' : deOtro.error, /Nadie Parecido/);
  assert.equal(estado.vistas.length, 0, 'los de otro no entran en su ficha');
});

test('si la base falla se dice, y no se toca su Página', async () => {
  estado.competidores = [{ id: 7, nombre: 'Ana', landing_url: null, pagina_anuncios: null }];
  estado.errorVistas = 'se cayó';
  const r = await guardarCaptura(biblioteca(), 7);
  assert.ok(!r.ok && r.motivo === 'falla');
  assert.deepEqual(estado.updates, []);
});

test('un competidor que no existe en este negocio no recibe nada', async () => {
  const r = await guardarCaptura(biblioteca(), 999);
  assert.ok(!r.ok && r.motivo === 'sin-competidor');
  assert.equal(estado.vistas.length, 0);
});

test('un sitio: su fila, su lector y su landing si no la tenía', async () => {
  estado.competidores = [{ id: 7, nombre: 'Ana', landing_url: null, pagina_anuncios: null }];
  const r = await guardarCaptura(sitio(), 7);
  assert.ok(r.ok && r.tipo === 'sitio');
  assert.deepEqual(r.ok && r.tipo === 'sitio' ? r.lineas : [], ['Píxeles: Tag Manager (GTM-ABCD123)', 'Cobra con: Hotmart']);
  assert.equal(estado.vistas[0][0].ref, 'https://www.ana.com/vsl');
  assert.equal(estado.vistas[0][0].fuente, 'recorrido');
  assert.deepEqual(estado.funnels, [{ id: 7, ref: 'https://www.ana.com/vsl', lector: 'navegador', pixeles: ['gtm'] }]);
  assert.equal(estado.updates[0].landing_url, 'https://www.ana.com/vsl');
});

test('la misma página que ya se lee desde el servidor cae en SU fila', async () => {
  // Con otra llave quedaría partida en dos filas, y lo del servidor y lo del navegador no se unirían.
  estado.competidores = [{ id: 7, nombre: 'Ana', landing_url: 'https://www.ana.com/vsl/', pagina_anuncios: null }];
  await guardarCaptura(sitio('https://www.ana.com/vsl'), 7);
  assert.equal(estado.vistas[0][0].ref, 'https://www.ana.com/vsl/');
  assert.equal(estado.funnels[0].ref, 'https://www.ana.com/vsl/');
  assert.deepEqual(estado.updates, [], 'no le pisa la landing que tenía');
});

test('una red no tiene funnel: se suma como canal y nada más', async () => {
  const r = await guardarCaptura(sitio('https://www.instagram.com/anaoficial/'), null);
  assert.ok(r.ok && r.tipo === 'alta');
  assert.deepEqual(estado.altas, ['https://www.instagram.com/anaoficial/']);
  assert.equal(estado.vistas.length, 0);
  assert.equal(estado.funnels.length, 0);
});

test('lo que se le pasa a la extensión: el dominio y su Página, nada de lo leído', async () => {
  estado.competidores = [{ id: 7, nombre: 'Ana', landing_url: 'https://www.ana.com/vsl', pagina_anuncios: '123' }, { id: 8, nombre: 'Sin web', landing_url: null, pagina_anuncios: null }];
  assert.deepEqual(await fichasParaLaExtension(), [
    { id: 7, nombre: 'Ana', dominio: 'ana.com', pagina: '123' },
    { id: 8, nombre: 'Sin web', dominio: null, pagina: null },
  ]);
});

// ── La ruta ─────────────────────────────────────────────────────────────────────────────────────

const pedir = (cuerpo: unknown, token: string | null = estado.tokenBueno, crudo = false) => POST(new Request('https://hola-mako.com/api/competitor-spy/extension', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { 'x-flow-token': token } : {}) },
  body: crudo ? (cuerpo as string) : JSON.stringify(cuerpo),
}) as never);

test('la ruta: sin un token válido no existe, y no llega a leer el cuerpo', async () => {
  for (const t of [null, 'flow_otro', 'cualquiera']) {
    const r = await pedir({ accion: 'lista' }, t);
    assert.equal(r.status, 404, String(t));
  }
  assert.deepEqual(estado.workspaces, []);
});

test('la ruta corre en el negocio del token', async () => {
  estado.competidores = [{ id: 7, nombre: 'Ana', landing_url: null, pagina_anuncios: null }];
  const r = await pedir({ accion: 'lista' });
  assert.equal(r.status, 200);
  assert.deepEqual(estado.workspaces, [3]);
  assert.equal(((await r.json()) as { competidores: unknown[] }).competidores.length, 1);
});

test('la ruta: lo que no se puede usar no llega a escribir', async () => {
  assert.equal((await pedir('{no es json', estado.tokenBueno, true)).status, 400);
  assert.equal((await pedir({ accion: 'otra' })).status, 400);
  assert.equal((await pedir({ accion: 'guardar', captura: { modo: 'sitio', url: 'https://web.whatsapp.com/', recursos: [] } })).status, 400, 'WhatsApp Web no entra aunque llegue');
  assert.equal((await pedir('x'.repeat(4_000_001), estado.tokenBueno, true)).status, 413);
  assert.equal(estado.vistas.length, 0);
});

test('la ruta: un id raro no es un competidor, es «uno nuevo»', async () => {
  for (const competidorId of [null, 0, -3, 'abc', 1.5]) {
    estado.altas = [];
    estado.competidores = [];
    const r = await pedir({ accion: 'guardar', competidorId, captura: biblioteca() });
    assert.equal(r.status, 200, String(competidorId));
    assert.deepEqual(estado.altas, ['Ana'], String(competidorId));
  }
});

test('la ruta: una falla nuestra se contesta en palabras, sin el mensaje de adentro', async () => {
  const antes = (falsos.spy as { guardarVistas: unknown }).guardarVistas;
  (falsos.spy as { guardarVistas: unknown }).guardarVistas = async () => { throw new Error('secreto de la base'); };
  estado.competidores = [{ id: 7, nombre: 'Ana', landing_url: null, pagina_anuncios: null }];
  const silencio = console.error;
  console.error = () => {};
  try {
    const r = await pedir({ accion: 'guardar', competidorId: 7, captura: biblioteca() });
    assert.equal(r.status, 500);
    assert.doesNotMatch(JSON.stringify(await r.json()), /secreto/);
  } finally {
    console.error = silencio;
    (falsos.spy as { guardarVistas: unknown }).guardarVistas = antes;
  }
});
