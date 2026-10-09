// =============================================================================
// El `origen` de un funnel sale de la COLUMNA `declarado`, nunca de su `data`
// =============================================================================
// La migración 0170 copia `funnel_config` → `funnels` y, a los workspaces que NO
// tenían fila (hoy ws 3, 5 y 9), les crea una con `data = '{}'::jsonb` y
// `declarado = false`. En JavaScript `{}` es TRUTHY, así que un lector traducido
// literal del viejo `if (!data.data) return 'sin-fila'` los leería como
// «declarado» y esos tres pasarían de «no declaró nada» a «declaró el funnel
// genérico», sin error y sin un solo log.
//
// No es cosmético: `origen` lo leen lib/objectives.ts (qué KPIs proponer),
// lib/venta-por-llamada.ts y lib/acento-workspace.ts, y el contrato que se
// rompería es el de «ningún prompt afirma un funnel que nadie declaró».
// «Sin fila» no es «vacío» (docs/hallazgos-crm.md).
//
// ⚠️ Probado ROMPIÉNDOLO: cambiando en lib/funnel-fila.ts la línea
//   const declarado = f.declarado === true;
// por la traducción literal del lector viejo
//   const declarado = Boolean(f.data);
// este archivo pasa de 6/6 a 2 FALLOS y 4 pases: caen «la fila que crea la
// migración…» y «con declarado = false no se emite lo declarado…», que son
// exactamente los dos casos que la 0170 crea en prod (ws 3, 5 y 9).
//
// Y el guard de `funnel_config` también se probó rompiéndolo: con un
// `supabase.from('funnel_config')` de mentira en lib/funnels.ts, 1 fallo y 5 pases.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { filaAFunnel, type FilaFunnel } from '../lib/funnel-fila';
import { DEFAULT_PIPELINE } from '../lib/pipeline';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const fila = (p: Partial<FilaFunnel>): FilaFunnel => ({
  id: 7, nombre: 'Funnel principal', canal: null, data: {}, declarado: false, ...p,
});

const PIPELINE_PROPIO = [
  { key: 'lead', label: 'Contacto nuevo', dot: '#2F6DDB', band: 'pipeline', col: 0 },
  { key: 'ganado', label: 'Cliente', dot: '#3B6D11', band: 'pipeline', col: 1 },
];

test('la fila que crea la migración para un ws sin funnel NO dice «declarado»', () => {
  const f = filaAFunnel(fila({ data: {}, declarado: false }));
  // El `{}` es truthy: esta es exactamente la fila con la que se equivoca el
  // lector traducido literal.
  assert.equal(f.origen, 'sin-fila');
  assert.deepEqual(f.entradas, []);
  assert.equal(f.evento, null);
  // El pipeline igual cae al default: una pantalla en blanco es peor que una con
  // el embudo más común. Lo que NO puede pasar es que el origen lo afirme.
  assert.deepEqual(f.pipeline, DEFAULT_PIPELINE);
});

test('un funnel guardado desde /funnel sí dice «declarado», con lo suyo', () => {
  const f = filaAFunnel(fila({
    declarado: true,
    canal: 'presencial',
    data: { pipeline: PIPELINE_PROPIO, suppressed: ['nopaga>reunion_excepcional'], entradas: ['landing'] },
  }));
  assert.equal(f.origen, 'declarado');
  assert.deepEqual(f.entradas, ['landing']);
  assert.deepEqual(f.pipeline.map((s) => s.key), ['lead', 'ganado']);
  assert.deepEqual(f.suppressed, ['nopaga>reunion_excepcional']);
  assert.equal(f.canal, 'presencial');
});

test('con `declarado = false` no se emite lo declarado, aunque el jsonb lo traiga', () => {
  // Es el caso del clon: `devolver los datos de Mau` vacía el funnel poniendo
  // declarado=false, y una fila a medio limpiar no puede volver a afirmar que
  // los leads de ese negocio entran por una landing que nadie declaró.
  const f = filaAFunnel(fila({
    declarado: false,
    data: { pipeline: PIPELINE_PROPIO, entradas: ['formulario_anuncio'], evento: { lugar: 'Huayacán', dias: [3], hora: '19:00', tz: null, cupo: 20 } },
  }));
  assert.equal(f.origen, 'sin-fila');
  assert.deepEqual(f.entradas, []);
  assert.equal(f.evento, null);
  // El pipeline que hay igual se pinta: la forma del embudo no afirma nada.
  assert.deepEqual(f.pipeline.map((s) => s.key), ['lead', 'ganado']);
});

test('un `data` que no es un objeto no rompe ni inventa', () => {
  // Pasó de verdad: un `JSON.stringify` donde iba `sql.json` deja un jsonb de
  // TIPO STRING en la columna (ver scripts/reset-chatbot-leila.ts).
  for (const basura of ['{"pipeline":[]}', null, 42, []] as unknown[]) {
    const f = filaAFunnel(fila({ data: basura, declarado: true }));
    assert.deepEqual(f.pipeline, DEFAULT_PIPELINE, `data=${JSON.stringify(basura)}`);
    assert.deepEqual(f.entradas, []);
  }
});

// ── Los dos guards de la migración, que el compilador no ve ─────────────────

function fuentes(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${e}`;
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue;
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) fuentes(rel, out);
    else if (/\.(ts|tsx)$/.test(e)) out.push(rel);
  }
  return out;
}

test('nadie LEE ni ESCRIBE `funnel_config`: quedó de respaldo', () => {
  // La tabla sigue existiendo a propósito (la 0170 no la dropea), y justamente
  // por eso hace falta este test: un select contra ella no falla, devuelve el
  // embudo de antes de la migración y nadie se entera.
  const acceso = /\.from\(\s*['"`]funnel_config['"`]|\b(from|into|update|join)\s+funnel_config\b/;
  const culpables = fuentes('lib').concat(fuentes('app'), fuentes('scripts'))
    .filter((f) => acceso.test(readFileSync(join(ROOT, f), 'utf8')))
    .map((f) => relative('.', f));
  assert.deepEqual(culpables, [], `estos archivos todavía tocan la tabla vieja: ${culpables.join(', ')}`);
});

test('las tablas de la 0169-0171 están en TENANT_TABLES desde el día uno', () => {
  // Con `funnel_config` alcanzaba con el .eq a mano porque era UNA fila por
  // workspace: olvidarlo daba «no encuentra». Con N filas, olvidarlo da los
  // funnels —y las ofertas— de OTRO cliente.
  const src = readFileSync(resolve(ROOT, 'lib/workspace.ts'), 'utf8');
  const m = src.match(/const TENANT_TABLES = new Set<string>\(\[([\s\S]*?)\]\)/);
  assert.ok(m, 'no se encontró el Set TENANT_TABLES en lib/workspace.ts');
  const dentro = new Set([...m![1].replace(/\/\/[^\n]*/g, '').matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1]));
  const faltan = ['funnels', 'ofertas', 'oferta_productos', 'funnel_ofertas', 'lead_magnets'].filter((t) => !dentro.has(t));
  assert.deepEqual(faltan, [], `faltan en TENANT_TABLES: ${faltan.join(', ')}`);
});

// ── El guard de «leer y después guardar», que el compilador tampoco ve ───────

// ⚠️ Probado ROMPIÉNDOLO: borrando el `if (actual.origen === 'error')` de
// app/api/onboarding/route.ts, este archivo pasa de 8/8 a 1 FALLO y 7 pases.
// (Y la primera versión del test, que buscaba sobre el archivo CRUDO, daba 8/8
// con el guard borrado: la condición aparece también en el comentario de al
// lado. Por eso `sinComentarios`.)
test('quien LEE el funnel y después lo GUARDA corta si la lectura falló', () => {
  // Los tres caminos que caen a DEFAULT_PIPELINE NO son el mismo, y el que más
  // duele es `origen: 'error'`: con Supabase caído, lo que se acaba de leer es la
  // plantilla del código, así que GUARDARLO le pisa al cliente su funnel real.
  // El caso vivo que este test caza: en app/api/onboarding/route.ts el paso
  // «funnel por canal» decide sembrar con
  //     mismoPipeline(actual.pipeline, DEFAULT_PIPELINE) && !actual.suppressed.length
  // y con la lectura caída eso da true SIEMPRE — el guard en positivo se volvía
  // su contrario y sembraba encima de un funnel editado.
  const lee = /getFunnelDe(fault)?\(/;
  const guarda = /saveFunnelDe(fault)?\(/;
  const guard = /origen === 'error'/;
  // ⚠️ SIN LOS COMENTARIOS. Los tres call-sites explican el guard en prosa y
  // nombran la condición entre backticks, así que buscándola sobre el archivo
  // crudo el test pasa aunque la línea de código no esté: probado rompiéndolo,
  // borrar el `if` de app/api/onboarding/route.ts daba 8/8 igual.
  const sinComentarios = (s: string) => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const culpables = fuentes('lib').concat(fuentes('app'))
    .filter((f) => { const s = sinComentarios(readFileSync(join(ROOT, f), 'utf8')); return lee.test(s) && guarda.test(s) && !guard.test(s); })
    .map((f) => relative('.', f));
  assert.deepEqual(culpables, [], `leen el funnel y lo vuelven a guardar sin mirar si la lectura falló: ${culpables.join(', ')}`);
});

// ── Una VISTA no tiene RLS, y ese es el agujero que se olvida ────────────────

// ⚠️ Probado ROMPIÉNDOLO: quitando el `revoke all on v_funnel_productos` de la
// 0171, este archivo pasa de 8/8 a 1 FALLO y 7 pases, nombrando la vista.
test('toda vista nueva de una migración revoca a anon', () => {
  // `alter table … enable row level security` NO existe para una vista, y una
  // vista corre con los permisos de SU DUEÑO: aunque las tablas de abajo tengan
  // RLS, quien pueda hacerle SELECT lee las filas de TODOS los workspaces. Por eso
  // el revoke explícito, igual que en cada tabla.
  //
  // Medido en prod el 26/09 y por eso esto no es teórico:
  //   · v_cohortes_semanales / v_cohortes_mensuales (mig 0001) tienen HOY
  //     `anon=arwdDxtm` y `security_invoker` apagado, leyendo `leads` (que sí
  //     tiene RLS). Son el leak conocido que la bitácora de /admin/dev ya nombra.
  //   · Las tablas aplicadas con el `postgres` de scripts/apply-migration.mjs
  //     quedan sólo con postgres+service_role — o sea que hoy el camino depende
  //     de QUIÉN aplique el DDL, que es justo lo que no se puede dejar al azar.
  //
  // ✅ CERRADO el 09/10/2026 (mig 0231, decisión de Martín): las dos vistas de cohortes
  // contestaban 200 con 54 y 19 filas a la clave anon y a la publishable; después de
  // aplicarla, 401 «permission denied», y la service role las sigue leyendo igual.
  // Por eso ya no hay lista de excusas.
  //
  // Probado ROMPIÉNDOLO el 09/10: sacar el revoke de v_cohortes_mensuales de la 0231
  // pasa de 8/8 a 1 fallo nombrando «0084 → v_cohortes_mensuales»; sacar el de
  // v_funnel_productos de la 0171, 1 fallo nombrando esa vista.
  //
  // La regla que queda: el revoke tiene que estar en el MISMO archivo que crea la vista
  // o en uno POSTERIOR al ÚLTIMO que la crea. `v_cohortes_semanales` se crea en la 0001,
  // la 0013 y la 0084, y la cierra la 0231: un revoke anterior a la última creación no
  // cuenta, porque un `drop` + `create` le devuelve los permisos por defecto.
  const dir = resolve(ROOT, 'supabase/migrations');
  const archivos = readdirSync(dir).filter((x) => x.endsWith('.sql')).sort();
  // Las líneas de comentario SQL se sacan antes: la 0013 tiene un «CREATE OR
  // REPLACE VIEW exige…» adentro de un `--` y no es una vista.
  const sqlDe = new Map(archivos.map((f) => [f, readFileSync(join(dir, f), 'utf8').replace(/^\s*--[^\n]*$/gm, '')]));
  const ultimaCreacion = new Map<string, number>();
  archivos.forEach((f, i) => {
    for (const m of sqlDe.get(f)!.matchAll(/create\s+(?:or\s+replace\s+)?view\s+([a-z0-9_]+)/gi)) {
      ultimaCreacion.set(m[1].toLowerCase(), i);
    }
  });
  const culpables: string[] = [];
  for (const [vista, i] of ultimaCreacion) {
    const re = new RegExp(String.raw`revoke\s+all\s+on\s+(?:[a-z0-9_]+\s*,\s*)*${vista}\b`, 'i');
    const revoca = archivos.slice(i).some((f) => re.test(sqlDe.get(f)!));
    if (!revoca) culpables.push(`${archivos[i]} → ${vista}`);
  }
  assert.deepEqual(culpables, [], `estas vistas quedan legibles por anon: ${culpables.join(', ')}`);
});
