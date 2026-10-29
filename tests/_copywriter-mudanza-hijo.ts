// =============================================================================
// Hijo de tests/copywriter-mudanza.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre la mudanza REAL (lib/copywriter/mudanza.ts → crearVarias → settings) contra el PostgREST de mentira
// (tests/_postgrest-de-mentira.ts), en un node aparte con `--conditions=react-server` (traen `server-only`), con cortes
// inyectados en el pedido justo. Los escenarios son los de la verificación del Cerebro de 544991179
// (C:/dev/revisiones/2910-verificacion-mudanza-copywriter.md): E2, E5, E5b, E6 y E9, achicados.
// Imprime un JSON con lo que pasó en cada uno; el test lo lee.
// =============================================================================

import { crearPostgrest, type Fila } from './_postgrest-de-mentira';

const TOPE_URL = 8_000;
const pg = crearPostgrest({ tablas: ['app_settings', 'workspaces'] });
type Accion = 'pasar' | 'tirar' | 'aplicar-y-tirar' | Response;
let gancho: ((u: URL, metodo: string, cuerpo: Fila | null) => Accion) | null = null;
const red: string[] = [];

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const href = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
  const u = new URL(href);
  if (u.host !== 'supa.test') { red.push(u.host); return new Response('{}', { status: 500 }); }
  if (href.length > TOPE_URL) throw new TypeError('fetch failed');
  const metodo = (init.method ?? 'GET').toUpperCase();
  let cuerpo: Fila | null = null;
  try { cuerpo = init.body ? JSON.parse(String(init.body)) as Fila : null; } catch { cuerpo = null; }
  const acc = gancho?.(u, metodo, cuerpo) ?? 'pasar';
  if (acc instanceof Response) return acc;
  if (acc === 'tirar') throw new TypeError('fetch failed');
  const r = await pg.responder(u, init);
  if (acc === 'aplicar-y-tirar') throw new TypeError('fetch failed');
  return r;
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
console.warn = () => {};

const MARCA = 'mako.copywriter.mudanza';
const INDICE = 'mako.copywriter.indice';
const err500 = () => new Response(JSON.stringify({ code: 'XX000', message: 'falla de mentira', details: null, hint: null }), { status: 500, headers: { 'content-type': 'application/json' } });
const claveDe = (u: URL, cuerpo: Fila | null): string => {
  const q = u.searchParams.get('key');
  return q?.startsWith('eq.') ? q.slice(3) : typeof cuerpo?.key === 'string' ? cuerpo.key : '';
};
const fila = (ws: number, key: string) => pg.db.app_settings.find((f) => Number(f.workspace_id) === ws && f.key === key);
const valor = (ws: number, key: string) => (fila(ws, key)?.value as string | undefined) ?? null;
const poner = (ws: number, key: string, value: string) => {
  const f = fila(ws, key);
  if (f) { f.value = value; f.updated_at = new Date().toISOString(); } else pg.db.app_settings.push({ workspace_id: ws, key, value, updated_at: new Date().toISOString() });
};
const indice = (ws: number) => { const v = valor(ws, INDICE); return v ? JSON.parse(v) as { id: string; titulo: string; padre: string | null }[] : []; };
const docs = (ws: number) => pg.db.app_settings.filter((f) => Number(f.workspace_id) === ws && String(f.key).startsWith('mako.copywriter.doc.'));
const marca = (ws: number) => { const v = valor(ws, MARCA); return v ? (JSON.parse(v) as { estado: string }).estado : null; };
const envejecer = (ws: number) => { const v = valor(ws, MARCA); if (v) poner(ws, MARCA, JSON.stringify({ ...JSON.parse(v), at: new Date(Date.now() - 11 * 60_000).toISOString() })); };
const rotas = (ws: number) => { const ds = new Set(docs(ws).map((d) => String(d.key).slice('mako.copywriter.doc.'.length))); return indice(ws).filter((p) => !ds.has(p.id)).length; };
const estado = (ws: number) => {
  const ix = indice(ws);
  const tit = ix.map((p) => p.titulo);
  return {
    paginas: ix.length, rotas: rotas(ws), marca: marca(ws),
    padresAds: tit.filter((t) => t === 'Guiones del Ads Writer').length, padresReels: tit.filter((t) => t === 'Reels').length,
    reelsEnLaRaiz: ix.filter((p) => p.titulo.startsWith('Reel pedido') && !p.padre).length,
  };
};

const guion = (id: string, texto: string) => ({ id, anguloId: 'dolor', anguloNombre: 'Dolor', estructuraId: 'pas', texto });
const pieza = (tag: string) => ({ hook: { frase: `FRASE-${tag}`, tituloEnPantalla: 't', visual: 'v' }, escenas: [{ texto: 'e', indicacionVisual: 'c' }], moraleja: 'm', cta: 'c', palabraClave: 'PK', caption: 'cap', duracionEstimadaSeg: 40 });
// Lo de antes de cada negocio: 3 guiones con texto en dos celdas, una celda vieja (sólo `guion`) y 2 Reels → 8 páginas.
function sembrar(ws: number) {
  poner(ws, 'mako.razones', JSON.stringify([
    { id: 'c1', nombre: 'Un mejor salario', guiones: [guion('g11', 'GANCHO\nA\nCTA\nYa'), guion('g12', 'GANCHO\nB')] },
    { id: 'c2', nombre: 'Viajar', guiones: [guion('g21', 'GANCHO\nC'), { id: 'vacio', texto: '  ' }] },
    { id: 'c3', nombre: 'Celda vieja', guion: 'GANCHO\nLEGADO' },
  ]));
  poner(ws, 'reels.historial', JSON.stringify([1, 2].map((i) => ({ id: `r${i}`, pedido: `Reel pedido ${i}`, pieza: pieza(`R${i}`) }))));
}

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  const { mudarLoDeAntes } = await import('../lib/copywriter/mudanza');
  const mudar = (ws: number) => runWithWorkspace(ws, mudarLoDeAntes);
  for (const id of [11, 12, 13, 14, 15, 16, 17]) pg.db.workspaces.push({ id, nombre: `ws${id}` });
  const out: Record<string, unknown> = {};

  // E2 · dos corridas seguidas: la segunda no hace nada. Y la celda vieja entra.
  {
    const ws = 11;
    sembrar(ws);
    const r1 = await mudar(ws);
    const r2 = await mudar(ws);
    out.E2 = { r1, r2, ...estado(ws), legado: indice(ws).some((p) => p.titulo === 'Celda vieja · General') };
  }

  // E5 · la última escritura (la marca «hecha») no llega; a los 10 minutos se vuelve a correr.
  {
    const ws = 12;
    sembrar(ws);
    gancho = (u, m, c) => (m !== 'GET' && claveDe(u, c) === MARCA && String(c?.value ?? '').includes('"hecha"') ? 'tirar' : 'pasar');
    const r1 = await mudar(ws);
    gancho = null;
    const tras1 = estado(ws);
    envejecer(ws);
    const r2 = await mudar(ws);
    out.E5 = { r1, tras1, r2, ...estado(ws) };
  }

  // E5b · el índice LLEGA a la base pero la respuesta se pierde (un timeout): nada se borra, y el reintento no duplica.
  {
    const ws = 13;
    sembrar(ws);
    let una = true;
    gancho = (u, m, c) => { if (una && m !== 'GET' && claveDe(u, c) === INDICE) { una = false; return 'aplicar-y-tirar'; } return 'pasar'; };
    const r1 = await mudar(ws);
    gancho = null;
    const tras1 = estado(ws);
    envejecer(ws);
    const r2 = await mudar(ws);
    out.E5b = { r1, tras1, r2, ...estado(ws) };
  }

  // E6 · el documento del Reel 2 contesta 500 una vez: la marca NO queda «hecha» y el reintento lo muda.
  {
    const ws = 14;
    sembrar(ws);
    let una = true;
    gancho = (u, m, c) => { if (una && m === 'POST' && claveDe(u, c).startsWith('mako.copywriter.doc.') && String(c?.value ?? '').includes('FRASE-R2')) { una = false; return err500(); } return 'pasar'; };
    const r1 = await mudar(ws);
    gancho = null;
    const tras1 = { ...estado(ws), reel2: indice(ws).some((p) => p.titulo === 'Reel pedido 2') };
    envejecer(ws);
    const r2 = await mudar(ws);
    out.E6 = { r1, tras1, r2, ...estado(ws), reel2: indice(ws).some((p) => p.titulo === 'Reel pedido 2') };
  }

  // E6p · falla el documento del PADRE «Reels»: sus hijas esperan (no van a la raíz) y el reintento las pone debajo.
  {
    const ws = 15;
    sembrar(ws);
    let una = true;
    gancho = (u, m, c) => { if (una && m === 'POST' && claveDe(u, c).startsWith('mako.copywriter.doc.') && String(c?.value ?? '').includes('tab Reels del Editor')) { una = false; return err500(); } return 'pasar'; };
    const r1 = await mudar(ws);
    gancho = null;
    const tras1 = estado(ws);
    envejecer(ws);
    const r2 = await mudar(ws);
    out.E6p = { r1, tras1, r2, ...estado(ws) };
  }

  // E9 · un negocio con más guiones que el tope: los Reels entran igual (van primero).
  {
    const ws = 16;
    poner(ws, 'mako.razones', JSON.stringify([{ id: 'grande', nombre: 'Grande', guiones: Array.from({ length: 320 }, (_, i) => guion(`m${i}`, `GANCHO\nGuion ${i}`)) }]));
    poner(ws, 'reels.historial', JSON.stringify([1, 2, 3].map((i) => ({ id: `r${i}`, pedido: `Reel pedido ${i}`, pieza: pieza(`R${i}`) }))));
    const r1 = await mudar(ws);
    out.E9 = { r1, ...estado(ws), reels: indice(ws).filter((p) => p.titulo.startsWith('Reel pedido')).length };
  }

  // Dos negocios con lo mismo: ids distintos (la charla `copywriter:<id>` nunca se cruza).
  {
    const ids = (ws: number) => new Set(indice(ws).map((p) => p.id));
    const a = ids(11);
    sembrar(17);
    await mudar(17);
    out.dosNegocios = { comparten: [...ids(17)].filter((x) => a.has(x)).length, paginas: ids(17).size };
  }

  out.red = red;
  process.stdout.write(JSON.stringify(out));
}

main().catch((e) => { process.stdout.write(JSON.stringify({ error: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) })); });
