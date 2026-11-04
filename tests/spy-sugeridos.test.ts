// =============================================================================
// «Sugeridos»: los competidores de la PLATAFORMA en todos los negocios, y nunca los de otro cliente (4/11/2026)
// =============================================================================
// Pedido de Martín (por el Cerebro, 4/11): los competidores del negocio de la plataforma aparecen en todos los negocios
// como catálogo, sin cobrarle al cliente; se suman sin duplicar, y los de otro cliente no aparecen en ninguna parte.
//
// Corre lib/spy-sugeridos.ts (lo que usan la pantalla y la API de MaKo) con una base de mentira de TRES negocios: la
// plataforma (9), otro cliente (13) y el que pregunta (5).
//   1. el 5 ve los de la plataforma, no los del 13, y no los que ya mira; la plataforma no se sugiere a sí misma;
//   2. aunque la consulta se equivoque de negocio, una fila ajena no pasa;
//   3. sumarlo copia lo ya leído (sin anuncios ni lo borrado), no pide a Apify y no deja arrancar la traída larga;
//   4. un id de otro cliente no se suma; uno que ya mira no se duplica;
//   5. la pantalla, la acción y la API pasan por el mismo camino, y nada más lee competidores de otro negocio.
//
// PROBADO ROMPIÉNDOLO (4/11/2026), una rotura por vez y restaurada, base en verde (qué tests caen):
//   · `listarSugeridos` sin `soloDeLaPlataforma`                       → 2
//   · `listarSugeridos` sin sacar los que ya mira                      → 1
//   · `piezasACopiar` que copia también los anuncios                   → 3
//   · `agregarSugerido` que acepta cualquier id                        → 4
//   · `competidoresDe` del servidor sin filtrar por negocio           → 5
//   · la API que lee los sugeridos por otro lado                      → 5
// Correr: node --import tsx --test tests/spy-sugeridos.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  agregarSugerido, listarSugeridos, piezasACopiar, type DepsAgregar, type FilaCompetidor, type FilaPieza, type PiezaCopiada,
} from '../lib/spy-sugeridos';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const PLATAFORMA = 9;
const OTRO_CLIENTE = 13;
const STORAGE = 'https://x.supabase.co/storage/v1/object/public/spy-miniaturas/';

const fila = (ws: number, id: number, nombre: string, instagram: string | null, o: Partial<FilaCompetidor> = {}): FilaCompetidor => ({
  id, workspace_id: ws, nombre, instagram, youtube_id: null, tiktok: null, landing_url: null,
  avatar: `${STORAGE}spy/avatar/${instagram ?? id}.jpg`, instagram_seguidores: 1000, youtube_suscriptores: null, ...o,
});
const pieza = (canal: FilaPieza['canal'], ref: string, o: Partial<FilaPieza> = {}): FilaPieza => ({
  canal, tipo: canal === 'anuncios' ? 'anuncio' : 'reel', ref, fuente: canal === 'anuncios' ? 'apify' : 'api', url: null, titulo: null,
  texto: null, etiquetas: null, vistas: 10, megusta: 1, comentarios: 0, duracion: null, publicada_en: '2026-10-01', miniatura: null,
  dejo_de_verse_en: null, ...o,
});

/** Tres negocios: la plataforma, otro cliente y el que pregunta (5), con lo que cada uno mira. */
function base(actual = 5, o: { mezclar?: boolean } = {}) {
  const competidores: FilaCompetidor[] = [
    fila(PLATAFORMA, 17, 'Den Borg', 'den.borgg'),
    fila(PLATAFORMA, 18, 'Víctor Heras', 'victorherasmedia', { youtube_id: '@Victorherasmedia' }),
    fila(PLATAFORMA, 19, 'Alguien que el 5 ya mira', 'yamirado'),
    fila(OTRO_CLIENTE, 70, 'El secreto del cliente 13', 'secreto.del.13'),
    fila(5, 300, 'yamirado', 'yamirado'),
  ];
  const piezas: Record<number, FilaPieza[]> = {
    17: [pieza('instagram', 'p1'), pieza('instagram', 'p2', { dejo_de_verse_en: '2026-10-20' }), pieza('anuncios', 'ad1'), pieza('landing', 'https://denborg.com')],
    70: [pieza('instagram', 'secreta')],
  };
  const llamadas = { agregar: [] as string[], guardar: [] as PiezaCopiada[][], traido: [] as number[], completar: [] as number[], competidoresDe: [] as number[] };
  let siguiente = 400;
  const deps: DepsAgregar = {
    plataforma: async () => PLATAFORMA,
    actual: async () => actual,
    competidoresDe: async (ws) => {
      llamadas.competidoresDe.push(ws);
      // `mezclar`: una consulta mal filtrada que devuelve filas de TODOS los negocios.
      return competidores.filter((c) => o.mezclar || c.workspace_id === ws);
    },
    caricaturasDe: async (ws) => new Map(ws === PLATAFORMA ? [[17, `${STORAGE}spy/caricatura/instagram-den_borgg.png?v=1`]] : []),
    propios: async () => competidores.filter((c) => c.workspace_id === actual),
    piezasDe: async (ws, id) => (competidores.some((c) => c.id === id && c.workspace_id === ws) ? piezas[id] ?? [] : []),
    // El alta de siempre: deduplica por su @ (lo que hace agregarCompetidor).
    agregar: async (pegado, nombre) => {
      llamadas.agregar.push(pegado);
      const ig = pegado.replace(/^@/, '');
      const ya = competidores.find((c) => c.workspace_id === actual && c.instagram === ig);
      if (ya) return { ok: true, id: ya.id };
      const nuevo = fila(actual, siguiente++, nombre, ig, { avatar: null });
      competidores.push(nuevo);
      return { ok: true, id: nuevo.id };
    },
    completar: async (id) => { llamadas.completar.push(id); },
    guardar: async (_id, p) => { llamadas.guardar.push(p); return { nuevas: p.length }; },
    marcarTraido: async (id) => { llamadas.traido.push(id); },
  };
  return { deps, competidores, llamadas };
}

test('1. el negocio ve los de la plataforma, no los de otro cliente ni los que ya mira; la plataforma no se sugiere', async () => {
  const b = base();
  const s = await listarSugeridos(b.deps);
  assert.deepEqual(s.map((x) => x.nombre), ['Den Borg', 'Víctor Heras']);
  assert.equal(s[0].cara, `${STORAGE}spy/caricatura/instagram-den_borgg.png?v=1`, 'con su caricatura, si la plataforma ya la tiene');
  assert.ok(!JSON.stringify(s).includes('secreto'), 'nada del cliente 13');
  assert.deepEqual(b.llamadas.competidoresDe, [PLATAFORMA], 'sólo se le pregunta a la plataforma');
  assert.deepEqual(Object.keys(s[0]).sort(), ['cara', 'id', 'instagram', 'landing_url', 'nombre', 'seguidores', 'suscriptores', 'tiktok', 'youtube_id'], 'ni su oferta ni lo que la plataforma concluyó');
  assert.deepEqual(await listarSugeridos(base(PLATAFORMA).deps), [], 'la plataforma ya los mira');
});

test('2. aunque la consulta traiga filas de todos los negocios, una ajena no pasa', async () => {
  const s = await listarSugeridos(base(5, { mezclar: true }).deps);
  assert.ok(!s.some((x) => x.id === 70 || x.id === 300), 'ni el del cliente 13 ni el propio del 5');
  assert.deepEqual(s.map((x) => x.id), [17, 18]);
});

test('3. sumarlo copia lo ya leído, sin anuncios ni lo borrado, sin pedirle nada a Apify', async () => {
  const b = base();
  const r = await agregarSugerido(b.deps, 17);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(b.llamadas.agregar, ['@den.borgg'], 'el alta de siempre, con su @ (pasa por la misma deduplicación)');
  assert.deepEqual(b.llamadas.guardar[0].map((p) => `${p.canal}:${p.ref}`), ['instagram:p1', 'landing:https://denborg.com']);
  assert.equal(r.piezas, 2);
  assert.deepEqual(b.llamadas.traido, [r.id], 'la traída larga no arranca ya con la clave del cliente');
  assert.deepEqual(b.llamadas.completar, [r.id]);
  assert.deepEqual(piezasACopiar([pieza('anuncios', 'a'), pieza('youtube', 'v')]).map((p) => p.canal), ['youtube']);
});

test('4. un id de otro cliente no se suma; uno que ya mira no se duplica; la plataforma no se suma a sí misma', async () => {
  const b = base();
  assert.deepEqual(await agregarSugerido(b.deps, 70), { ok: false, error: 'Ese no está entre los sugeridos.' });
  assert.deepEqual(b.llamadas.agregar, [], 'ni se intentó');
  const r = await agregarSugerido(b.deps, 19);
  assert.deepEqual(r.ok && r.id, 300, 'el que ya miraba: se abre ese, no se crea otro');
  assert.equal(b.competidores.filter((c) => c.workspace_id === 5 && c.instagram === 'yamirado').length, 1);
  assert.equal((await agregarSugerido(base(PLATAFORMA).deps, 17)).ok, false);
});

test('5. la pantalla, la acción y la API pasan por el mismo camino, y nada más lee competidores de otro negocio', () => {
  const server = sinComentarios(leer('lib/spy-sugeridos-server.ts'));
  assert.match(server, /plataforma: \(\) => wsSuperAdmin\(\)/, 'la plataforma por capa, nunca por número');
  assert.match(server, /from\('spy_competidores'\)\.select\(COLS_COMPETIDOR\)\s*\.eq\('workspace_id', ws\)/, 'filtrado por el negocio que se pide');
  assert.match(server, /eq: \{ workspace_id: ws, competidor_id: id \}/);
  const run = sinComentarios(leer('lib/api-mako/areas/spy.run.ts'));
  assert.match(run, /ver_sugeridos: \{\s*leer: async \(\): Promise<SalidaLectura> => \{\s*const lista = await sugeridosDelNegocio\(\);/);
  assert.match(run, /const r = await sumarSugeridoAlNegocio\(id\);/);
  const acciones = sinComentarios(leer('app/competitor-spy/actions.ts'));
  assert.match(acciones, /sugeridos: await sugeridosDelNegocio\(\)/);
  assert.match(acciones, /await sumarSugeridoAlNegocio\(id\)/);
  // Nadie más en la app lee competidores con la clave de servicio (que salta el negocio): sólo los sugeridos.
  const conClave = execFileSync('git', ['grep', '-l', '-e', 'getSupabaseServer', '--', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').filter(Boolean)
    .filter((f) => /from\('spy_competidores'\)/.test(sinComentarios(leer(f))));
  assert.deepEqual(conClave, ['lib/spy-sugeridos-server.ts']);
});
