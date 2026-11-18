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
  const { crear, crearVarias, papelera, restaurar } = await import('../lib/copywriter/server');
  const { guionALaVista } = await import('../lib/copywriter/compartir');
  const { masReciente } = await import('../lib/copywriter/arbol');
  const mudar = (ws: number) => runWithWorkspace(ws, mudarLoDeAntes);
  for (const id of [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]) pg.db.workspaces.push({ id, nombre: `ws${id}` });
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

  // ── Las cuatro bajas que quedaban de la verificación (18/11/2026) ──────────────────────────────────────────────
  type Pag = { id: string; titulo: string; padre: string | null; actualizado: string; papelera?: string };
  const indiceEntero = (ws: number) => { const v = valor(ws, INDICE); return v ? JSON.parse(v) as Pag[] : []; };
  const pagina = (i: number): Pag & { emoji: null; tipo: 'ad'; orden: number } =>
    ({ id: `g${(0xa00000000000 + i).toString(16)}`, titulo: `Propia ${i}`, emoji: null, tipo: 'ad', padre: null, orden: i, actualizado: '2026-11-01T00:00:00.000Z' });

  // B3 · el negocio ya tenía una página propia: después de mudar, /copywriter sigue abriendo ÉSA (no un Reel mudado), y lo
  // mudado nace con la fecha de su origen (un Reel con `at`, un guion con `creadoEn`), nunca con «ahora».
  {
    const ws = 18;
    const propia = await runWithWorkspace(ws, () => crear({ tipo: 'ad', titulo: 'Mi guion de hoy' }));
    if (!propia.ok) throw new Error(`crear: ${propia.error}`);
    poner(ws, 'mako.razones', JSON.stringify([{ id: 'c1', nombre: 'Salario', guiones: [{ ...guion('g1', 'GANCHO\nA'), creadoEn: Date.parse('2026-10-05T12:00:00.000Z') }, guion('g2', 'GANCHO\nB')] }]));
    poner(ws, 'reels.historial', JSON.stringify([{ id: 'r1', pedido: 'Reel pedido 1', at: '2026-10-20T10:00:00.000Z', pieza: pieza('R1') }, { id: 'r2', pedido: 'Reel pedido 2', at: '2099-01-01T00:00:00.000Z', pieza: pieza('R2') }]));
    await mudar(ws);
    const ix = indiceEntero(ws);
    const de = (t: string) => ix.find((p) => p.titulo === t)?.actualizado ?? null;
    out.B3 = {
      abre: masReciente(ix as never)?.id === propia.pagina.id,
      ningunaLeGana: ix.filter((p) => p.id !== propia.pagina.id).every((p) => p.actualizado < propia.pagina.actualizado),
      reel1: de('Reel pedido 1'), guion1: de('Salario · Dolor'), padreReels: de('Reels'), marca: marca(ws), paginas: ix.length,
    };
  }

  // B4 · el índice casi lleno: no entra nada y la marca NO queda «hecha»; al liberar lugar, el reintento trae todo.
  {
    const ws = 19;
    sembrar(ws);
    poner(ws, INDICE, JSON.stringify(Array.from({ length: 485 }, (_, i) => pagina(i))));
    const r1 = await mudar(ws);
    const tras1 = { paginas: indiceEntero(ws).length, marca: marca(ws) };
    poner(ws, INDICE, JSON.stringify(Array.from({ length: 400 }, (_, i) => pagina(i))));
    envejecer(ws);
    const r2 = await mudar(ws);
    out.B4 = { r1, tras1, r2, paginas: indiceEntero(ws).length, marca: marca(ws) };
  }

  // B4c · `crearVarias` contra un índice con una sola página de lugar: crea una y dice cuántas no entraron.
  {
    const ws = 20;
    poner(ws, INDICE, JSON.stringify(Array.from({ length: 499 }, (_, i) => pagina(i))));
    const ids = ['gb00000000001', 'gb00000000002', 'gb00000000003'];
    const r = await runWithWorkspace(ws, () => crearVarias(ids.map((id) => ({ id, padreId: null, titulo: id, tipo: 'ad' as const }))));
    out.B4c = r.ok ? { creadas: r.creadas, faltan: r.faltan, sinLugar: r.sinLugar, paginas: indiceEntero(ws).length } : { error: r.error };
  }

  // B5 · un `reels.historial` que no es JSON: lo que se puede leer se muda, la marca no queda «hecha», y con el historial
  // arreglado el reintento trae los Reels.
  {
    const ws = 21;
    sembrar(ws);
    const bueno = valor(ws, 'reels.historial')!;
    poner(ws, 'reels.historial', bueno.slice(0, 40));
    const r1 = await mudar(ws);
    const tras1 = { ...estado(ws) };
    poner(ws, 'reels.historial', bueno);
    envejecer(ws);
    const r2 = await mudar(ws);
    out.B5 = { r1, tras1, r2, ...estado(ws) };
  }

  // B6 · el link de una página que cuelga de otra en la Papelera no abre ni escribe; si la madre vuelve, el link vuelve.
  {
    const ws = 22;
    const vista = (id: string) => runWithWorkspace(ws, () => guionALaVista(id)).then((g) => (g ? g.pagina.id === id : false));
    const madre = await runWithWorkspace(ws, () => crear({ tipo: 'pagina', titulo: 'Campaña de noviembre' }));
    if (!madre.ok) throw new Error(`crear madre: ${madre.error}`);
    const hija = await runWithWorkspace(ws, () => crear({ tipo: 'ad', titulo: 'Anuncio 1', padre: madre.pagina.id }));
    if (!hija.ok) throw new Error(`crear hija: ${hija.error}`);
    const antes = { madre: await vista(madre.pagina.id), hija: await vista(hija.pagina.id) };
    await runWithWorkspace(ws, () => papelera(madre.pagina.id));
    const enPapelera = { madre: await vista(madre.pagina.id), hija: await vista(hija.pagina.id), noExiste: await vista('gfffffffffff0') };
    await runWithWorkspace(ws, () => restaurar(madre.pagina.id));
    const vuelta = { madre: await vista(madre.pagina.id), hija: await vista(hija.pagina.id) };
    // Otro negocio no ve la hija de éste, aunque esté a la vista acá.
    const otro = await runWithWorkspace(11, () => guionALaVista(hija.pagina.id));
    out.B6 = { antes, enPapelera, vuelta, otroNegocio: otro !== null };
  }

  out.red = red;
  process.stdout.write(JSON.stringify(out));
}

main().catch((e) => { process.stdout.write(JSON.stringify({ error: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) })); });
