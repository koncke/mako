// =============================================================================
// El renglón que sobrevive al borrado de un lead (mig 0356, 30/10/2026)
// =============================================================================
// Medido ese día: 4.457 filas de historial de 1.371 leads que ya no existen, y ninguna dice quién los borró. Si un cliente
// preguntaba «¿qué pasó con estos leads?», la respuesta era «no sabemos». Medido contra producción, en el Cliente de Prueba, con
// leads propios: la papelera, unificar, un delete suelto, un lote y un script dejan cada uno su renglón; con otro negocio no
// borra ni anota; la clave pública no puede leer; y con la tabla rota adentro de una transacción, el lead se borra igual.
//
// PROBADO ROMPIÉNDOLO: una rotura por regla, cada una con su rojo (ver el commit).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { AVISO_DESDE_CUANDO, MISMO_BORRADO_MS, agruparBajas, queFueLaBaja, type FilaBaja } from '../lib/leads-bajas-reglas';
import { porId } from '../lib/api-mako/registro';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(resolve(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sql = () => leer('supabase/migrations/0356_leads_bajas.sql');

const fila = (at: string, ids: number[], extra: Partial<FilaBaja> = {}): FilaBaja =>
  ({ at, cuantos: ids.length, lead_ids: ids, camino: 'papelera', por: 'ana@x.com', rol: 'service_role', app: 'postgrest', ...extra });

test('nadie más borra leads: sólo lib/leads-bajas.ts, y por su camino', () => {
  const fuera: string[] = [];
  const recorrer = (dir: string) => {
    for (const n of readdirSync(dir)) {
      if (n === 'node_modules' || n.startsWith('.')) continue;
      const p = join(dir, n);
      if (statSync(p).isDirectory()) { recorrer(p); continue; }
      if (!/\.tsx?$/.test(n)) continue;
      if (/from\(\s*'leads'\s*\)\s*\.delete\(/.test(readFileSync(p, 'utf8'))) fuera.push(relative(RAIZ, p).replace(/\\/g, '/'));
    }
  };
  recorrer(resolve(RAIZ, 'lib'));
  recorrer(resolve(RAIZ, 'app'));
  assert.deepEqual(fuera, ['lib/leads-bajas.ts'], 'un camino nuevo que borra leads: que pase por la papelera o por borrarLeadConCamino');
  assert.match(leer('lib/leads-unificar.ts'), /ok\(await borrarLeadConCamino\(db, ws, plan\.seVa, 'unificar', autor\), 'borrar la ficha que se va'\);/);
  assert.match(leer('lib/zernio-entrante.ts'), /await borrarLeadConCamino\(db, ws, huerfano, 'zernio_duplicado', 'MaKo'\);/);
  assert.doesNotMatch(leer('lib/leads.ts'), /export async function deleteLead\(/, 'volvió el borrado sin camino');
});

test('si la función no contesta, borra igual, acotado al negocio', () => {
  const lib = leer('lib/leads-bajas.ts');
  assert.match(lib, /if \(!error\) return \{ error: null \};[\s\S]*return db\.from\('leads'\)\.delete\(\)\.eq\('id', id\)\.eq\('workspace_id', ws\);/);
});

test('la migración: un trigger que no se esquiva, nunca frena, le sobrevive al lead y sólo guarda ids', () => {
  const m = sql();
  assert.match(m, /after delete on leads\s+referencing old table as viejos\s+for each statement/);
  const fn = m.slice(m.indexOf('function public.leads_bajas_anotar'), m.indexOf('drop trigger if exists trg_leads_bajas'));
  assert.match(fn, /exception when others then[\s\S]*raise warning[\s\S]*return null;/, 'anotar puede frenar un borrado');
  assert.match(fn, /group by v\.workspace_id/, 'un borrado de dos negocios quedaría en uno');
  const tabla = m.slice(m.indexOf('create table if not exists leads_bajas'), m.indexOf('create index if not exists leads_bajas_ws_idx'));
  assert.doesNotMatch(tabla, /references/i, 'con una FK se iría con el lead');
  assert.doesNotMatch(tabla, /nombre|telefono|email/, 'esto queda para siempre: sólo ids');
  assert.match(m, /revoke all on leads_bajas from anon, authenticated;/);
  assert.doesNotMatch(leer('lib/leads-papelera.ts'), /leads_bajas/, 'la purga de la papelera no toca este registro');
  // Las dos que dicen el camino.
  const borrar = m.slice(m.indexOf('function public.borrar_lead_anotado'), m.indexOf('-- La misma de la 0340'));
  assert.match(borrar, /delete from leads where id = p_id and workspace_id = p_ws;/, 'el id de otro negocio');
  const papelera = m.slice(m.indexOf('function public.mandar_leads_a_papelera'));
  assert.match(papelera, /set_config\('mako\.baja_camino', 'papelera', true\)/);
  assert.match(papelera, /set_config\('mako\.baja_por', coalesce\(p_por, ''\), true\)/);
});

test('de un inquilino vaciado no queda nada: el barrido va después de borrar los leads', () => {
  assert.match(leer('lib/tablas-de-inquilino.ts'), /^ {2}'leads_bajas',$/m);
  assert.match(leer('lib/workspace.ts'), /^ {2}'leads_bajas',$/m);
  const reset = leer('lib/reset-workspace.ts');
  const fin = reset.indexOf("await sb.from('leads_bajas').delete().eq('workspace_id', ws)");
  assert.ok(fin > reset.indexOf('pendientes = fallaron;') && fin < reset.indexOf('return { borrado, avisos };'), 'el trigger deja un renglón después de vaciar');
});

test('un borrado se lee como UNO: mismo camino y persona, sin pausas largas', () => {
  const r = agruparBajas([
    fila('2026-11-01T10:00:00Z', [1]),
    fila('2026-11-01T10:05:00Z', [2, 3]),
    fila('2026-11-01T10:09:00Z', [4]),
  ]);
  assert.equal(r.length, 1, 'los de una tanda se leen como varios');
  assert.equal(r[0].cuantos, 4);
  assert.deepEqual([...r[0].leadIds].sort((a, b) => a - b), [1, 2, 3, 4]);
  assert.equal(r[0].desde, '2026-11-01T10:00:00Z');
  assert.equal(r[0].hasta, '2026-11-01T10:09:00Z');
  assert.equal(MISMO_BORRADO_MS, 10 * 60_000);
});

test('no se junta lo que es otra cosa, y sale de lo más nuevo a lo más viejo', () => {
  const r = agruparBajas([
    fila('2026-11-01T10:00:00Z', [1]),
    fila('2026-11-01T10:01:00Z', [2], { por: 'otra@x.com' }),
    fila('2026-11-01T10:02:00Z', [3], { camino: 'unificar' }),
    fila('2026-11-01T11:00:00Z', [4]),
  ]);
  assert.deepEqual(r.map((x) => x.leadIds[0]), [4, 3, 2, 1]);
  assert.equal(agruparBajas([]).length, 0);
  // Misma persona y mismo camino, con más de 10 minutos en el medio: son dos borrados. Justo a los 10, todavía es uno.
  assert.equal(agruparBajas([fila('2026-11-01T10:00:00Z', [1]), fila('2026-11-01T10:10:01Z', [2])]).length, 2, 'dos borrados distintos se leen como uno');
  assert.equal(agruparBajas([fila('2026-11-01T10:00:00Z', [1]), fila('2026-11-01T10:10:00Z', [2])]).length, 1);
});

test('dice de dónde vino, aunque no sepa el camino', () => {
  assert.match(queFueLaBaja({ camino: 'papelera', rol: null, app: null }), /papelera/);
  assert.match(queFueLaBaja({ camino: 'unificar', rol: null, app: null }), /unificó/);
  assert.match(queFueLaBaja({ camino: 'zernio_duplicado', rol: null, app: null }), /Duplicado/);
  assert.match(queFueLaBaja({ camino: 'sin_camino', rol: 'service_role', app: 'postgrest' }), /desde la app/);
  assert.match(queFueLaBaja({ camino: 'sin_camino', rol: 'postgres', app: 'Supavisor' }), /por fuera de la app \(postgres, Supavisor\)/);
  assert.match(queFueLaBaja({ camino: 'otro', rol: null, app: null }), /«otro»/, 'un camino nuevo no se esconde');
});

test('la API de MaKo lo contesta, sólo para el admin, y avisa desde cuándo', () => {
  const def = porId('ver_bajas_de_leads');
  assert.ok(def, 'no está en la API');
  assert.equal(def.tipo, 'lectura');
  assert.equal(def.gating?.rolMinimo, 'admin');
  assert.match(leer('lib/leads-bajas.ts'), /return \{ renglones: agruparBajas\(filas\), aviso: AVISO_DESDE_CUANDO \};/, 'un «no hay nada» se lee como «no se borró nada»');
  assert.match(AVISO_DESDE_CUANDO, /30\/10\/2026/);
  assert.match(leer('lib/leads-bajas.ts'), /await getTenantDb\(\);\s*let q = db\.from\('leads_bajas'\)/, 'sin el cliente del negocio se leería lo de otro');
});
