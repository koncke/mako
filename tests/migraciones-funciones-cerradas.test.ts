// =============================================================================
// Toda función que crea una migración nace CERRADA a la clave pública (anon / authenticated / PUBLIC) y abierta a service_role
// =============================================================================
// Revisión de la 0318 de Pagos (21/10/2026), probada en un Postgres real: la 0280 creía cerrar las funciones nuevas con un default por esquema, pero el EXECUTE
// de PUBLIC viene del default GLOBAL de Postgres, así que toda función creada después nació ejecutable por la clave anon —la que viaja al navegador—. La regla
// «toda función SQL nueva lleva su revoke» estaba en AGENTS.md y en la 0282; nada la hacía cumplir: la 0310 y la 0318 la olvidaron. Este test la hace cumplir sobre
// TODAS las migraciones (la 0282 tiene su propio test, de una sola función), con un analizador estático chico que se prueba aparte con migraciones de mentira.
//
// Qué mira, por cada función que crea alguna migración:
//   1. un `revoke execute|all on function <nombre>(…) from …` que nombre public, anon y authenticated, en la misma migración o en una POSTERIOR;
//   2. si no es la función de un trigger, un `grant execute on function <nombre>(…) to service_role` (lo llama el servidor);
//   3. que ninguna migración abra una función a anon / authenticated / public con un grant (salvo las de ABIERTAS, con su porqué: hoy ninguna).
// No cuenta el bucle de la 0319 (un DO con format()): sólo lo que se lee en el SQL. Y fija la 0319: el default GLOBAL de postgres, y el bucle que cierra las existentes.
//
// ⚠️ PROBADO ROMPIÉNDOLO (21/10/2026): ver el final del archivo.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));

/** Funciones que SÍ tienen que quedar abiertas a la clave pública, con el porqué. Hoy ninguna: todo el servidor llama con la service role. */
const ABIERTAS = new Map<string, string>([]);

type Migracion = { nombre: string; sql: string };

// El SQL sin comentarios (`--` y de bloque), y sin tocar lo que va entre comillas simples ni entre $$ (el cuerpo de las funciones).
function sinComentarios(sql: string): string {
  let out = '';
  let i = 0;
  let enStr = false;
  let enDol: string | null = null;
  while (i < sql.length) {
    const c = sql[i];
    const c2 = sql.slice(i, i + 2);
    if (enDol) { if (sql.startsWith(enDol, i)) { out += enDol; i += enDol.length; enDol = null; } else { out += c; i++; } continue; }
    if (enStr) { out += c; if (c === "'" && sql[i + 1] === "'") { out += "'"; i += 2; continue; } if (c === "'") enStr = false; i++; continue; }
    if (c2 === '--') { while (i < sql.length && sql[i] !== '\n') i++; continue; }
    if (c2 === '/*') { const j = sql.indexOf('*/', i + 2); i = j < 0 ? sql.length : j + 2; continue; }
    if (c === "'") { enStr = true; out += c; i++; continue; }
    if (c === '$') { const m = /^\$[a-zA-Z_]*\$/.exec(sql.slice(i)); if (m) { enDol = m[0]; out += m[0]; i += m[0].length; continue; } }
    out += c; i++;
  }
  return out;
}

/** Las funciones que crea un SQL: nombre y si devuelve trigger (se mira el tramo entre la lista de argumentos y el cuerpo). */
function funcionesCreadas(sql: string): { nombre: string; trigger: boolean }[] {
  const salida: { nombre: string; trigger: boolean }[] = [];
  for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?(?:function|procedure)\s+(?:public\.)?"?([a-z0-9_]+)"?\s*\(/gi)) {
    let prof = 0;
    let fin = m.index + m[0].length - 1;
    for (; fin < sql.length; fin++) { if (sql[fin] === '(') prof++; else if (sql[fin] === ')' && --prof === 0) break; }
    const cabecera = sql.slice(fin + 1, fin + 200).split(/\bas\s+(?:\$|')/i)[0];
    salida.push({ nombre: m[1].toLowerCase(), trigger: /returns\s+trigger/i.test(cabecera) });
  }
  return salida;
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** ¿Hay un revoke de `nombre` que nombre public, anon y authenticated? */
const tieneRevoke = (sql: string, nombre: string) => [...sql.matchAll(new RegExp(`revoke\\s+(?:all|execute)(?:\\s+privileges)?\\s+on\\s+(?:function|procedure|routine)\\s+(?:public\\.)?"?${escapar(nombre)}"?\\b[^;]*?\\bfrom\\s+([^;]+);`, 'gi'))]
  .some((m) => /\bpublic\b/i.test(m[1]) && /\banon\b/i.test(m[1]) && /\bauthenticated\b/i.test(m[1]));
const tieneGrantServiceRole = (sql: string, nombre: string) => [...sql.matchAll(new RegExp(`grant\\s+(?:all|execute)(?:\\s+privileges)?\\s+on\\s+(?:function|procedure|routine)\\s+(?:public\\.)?"?${escapar(nombre)}"?\\b[^;]*?\\bto\\s+([^;]+);`, 'gi'))]
  .some((m) => /\bservice_role\b/i.test(m[1]));

/** Todo lo que está mal en esas migraciones (ordenadas por nombre), como líneas legibles. */
function funcionesAbiertas(migraciones: Migracion[], abiertas: ReadonlyMap<string, string> = ABIERTAS): string[] {
  const ordenadas = [...migraciones].sort((a, b) => a.nombre.localeCompare(b.nombre)).map((m) => ({ nombre: m.nombre, sql: sinComentarios(m.sql) }));
  const problemas: string[] = [];
  ordenadas.forEach((mig, i) => {
    const desde = ordenadas.slice(i);
    for (const f of funcionesCreadas(mig.sql)) {
      if (abiertas.has(f.nombre)) continue;
      if (!desde.some((m) => tieneRevoke(m.sql, f.nombre))) problemas.push(`${mig.nombre}: ${f.nombre}() no lleva \`revoke execute on function ${f.nombre}(…) from public, anon, authenticated\` (ni en esa migración ni en una posterior)`);
      if (!f.trigger && !desde.some((m) => tieneGrantServiceRole(m.sql, f.nombre))) problemas.push(`${mig.nombre}: ${f.nombre}() no lleva \`grant execute on function ${f.nombre}(…) to service_role\``);
    }
    for (const g of mig.sql.matchAll(/grant\s+(?:all|execute)(?:\s+privileges)?\s+on\s+(?:(?:function|procedure|routine)\s+(?:public\.)?"?([a-z0-9_]+)"?|all\s+functions\s+in\s+schema\s+public)\b[^;]*?\bto\s+([^;]+);/gi)) {
      const quien = g[2];
      if (/\b(anon|authenticated|public)\b/i.test(quien) && !abiertas.has((g[1] ?? '*').toLowerCase())) problemas.push(`${mig.nombre}: abre ${g[1] ?? 'todas las funciones'} a ${quien.trim()} sin estar en ABIERTAS (con su porqué)`);
    }
  });
  return problemas;
}

const reales = (): Migracion[] => readdirSync(DIR).filter((f) => f.endsWith('.sql')).map((f) => ({ nombre: f, sql: readFileSync(join(DIR, f), 'utf8') }));

// ---------------------------------------------------------------------------
// Las migraciones de verdad
// ---------------------------------------------------------------------------

test('TODAS las migraciones: cada función que crean nace cerrada a public, anon y authenticated, y abierta a service_role', () => {
  const todas = reales();
  assert.ok(todas.length > 250, 'leyó las migraciones');
  assert.deepEqual(funcionesAbiertas(todas), []);
});

test('el analizador ve las funciones conocidas (si no ve ninguna, el test de arriba pasaría en vacío)', () => {
  const todas = reales();
  const vistas = new Set(todas.flatMap((m) => funcionesCreadas(sinComentarios(m.sql)).map((f) => f.nombre)));
  for (const esperada of ['flow_tomar_trabajos', 'montaje_tomar', 'landing_pago_rechazo_sumar', 'retencion_vsl_resumen', 'pagos_funnel_del_momento', 'set_updated_at']) assert.ok(vistas.has(esperada), `no ve ${esperada}`);
  const triggers = new Set(todas.flatMap((m) => funcionesCreadas(sinComentarios(m.sql)).filter((f) => f.trigger).map((f) => f.nombre)));
  assert.ok(triggers.has('pagos_funnel_del_momento') && triggers.has('set_updated_at') && !triggers.has('montaje_tomar'), 'distingue las de trigger');
});

test('la 0319 fija el default GLOBAL de postgres, cierra las existentes con un bucle que respeta extensiones, dueño y procedures, y nombra la que quedó abierta', () => {
  const sql = sinComentarios(readFileSync(join(DIR, '0319_funciones_sin_public.sql'), 'utf8'));
  assert.match(sql, /alter default privileges for role postgres revoke execute on functions from public;/, 'EL default global: sin `in schema`, que es lo que la 0280 no hizo');
  assert.match(sql, /alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;/);
  // `(?:(?!\bloop\b)[\s\S])*` = cualquier cosa SIN cruzar la palabra `loop`: el pg_depend tiene que estar en el SELECT del bucle que cierra, no en el del bloque de avisos.
  assert.match(sql, /for f in(?:(?!\bloop\b)[\s\S])*pg_depend(?:(?!\bloop\b)[\s\S])*deptype = 'e'(?:(?!\bloop\b)[\s\S])*\bloop\b/, 'el BUCLE que cierra no toca las funciones de una extensión');
  assert.match(sql, /pg_get_userbyid\(p\.proowner\) = current_user/, 'sólo las que son del que corre la migración');
  assert.match(sql, /case p\.prokind when 'p' then 'procedure' else 'function' end/, 'un procedure se revoca con `on procedure` (con `on function` Postgres tira 42809)');
  assert.match(sql, /grant execute on %s %s to service_role/);
  assert.match(sql, /revoke execute on function public\.pagos_funnel_del_momento\(\) from public, anon, authenticated;/, 'la 0310 por nombre');
  assert.ok(!/grant[^;]*\b(anon|authenticated)\b/i.test(sql), 'y no abre nada a la clave pública');
});

// ---------------------------------------------------------------------------
// El analizador, con migraciones de mentira
// ---------------------------------------------------------------------------

const CIERRE = 'revoke execute on function public.f(bigint) from public, anon, authenticated;\ngrant execute on function public.f(bigint) to service_role;';
const CREA = 'create or replace function public.f(p bigint) returns int language sql as $$ select 1 $$;';

test('analizador: una función sin revoke se reporta; con revoke y grant en su migración, o en una POSTERIOR, no', () => {
  assert.equal(funcionesAbiertas([{ nombre: '0500_a.sql', sql: CREA }]).length, 2, 'sin revoke ni grant: dos reportes');
  assert.deepEqual(funcionesAbiertas([{ nombre: '0500_a.sql', sql: `${CREA}\n${CIERRE}` }]), []);
  assert.deepEqual(funcionesAbiertas([{ nombre: '0500_a.sql', sql: CREA }, { nombre: '0501_b.sql', sql: CIERRE }]), [], 'cerrada por una migración posterior (como la 0280 hizo con las viejas)');
  assert.equal(funcionesAbiertas([{ nombre: '0500_a.sql', sql: CIERRE }, { nombre: '0501_b.sql', sql: CREA }]).length, 2, 'un revoke ANTERIOR a la creación no cuenta: la función nace después');
});

test('analizador: el revoke tiene que nombrar public, anon Y authenticated; el comentario no cuenta; y el grant de service_role es obligatorio salvo en un trigger', () => {
  const grant = 'grant execute on function public.f(bigint) to service_role;';
  assert.equal(funcionesAbiertas([{ nombre: '0500_a.sql', sql: `${CREA}\nrevoke execute on function public.f(bigint) from public, anon;\n${grant}` }]).length, 1, 'falta authenticated');
  assert.equal(funcionesAbiertas([{ nombre: '0500_a.sql', sql: `${CREA}\nrevoke execute on function public.f(bigint) from public, authenticated;\n${grant}` }]).length, 1, 'falta anon');
  assert.equal(funcionesAbiertas([{ nombre: '0500_a.sql', sql: `${CREA}\nrevoke execute on function public.f(bigint) from anon, authenticated;\n${grant}` }]).length, 1, 'falta public (el defecto de la 0280)');
  assert.equal(funcionesAbiertas([{ nombre: '0500_a.sql', sql: `${CREA}\n-- revoke execute on function public.f(bigint) from public, anon, authenticated;\n${grant}` }]).length, 1, 'un revoke comentado no cuenta');
  assert.equal(funcionesAbiertas([{ nombre: '0500_a.sql', sql: `${CREA}\nrevoke execute on function public.f(bigint) from public, anon, authenticated;` }]).length, 1, 'sin grant a service_role');
  const trig = 'create or replace function public.t() returns trigger language plpgsql as $$ begin return new; end $$;\nrevoke execute on function public.t() from public, anon, authenticated;';
  assert.deepEqual(funcionesAbiertas([{ nombre: '0500_a.sql', sql: trig }]), [], 'la función de un trigger no necesita grant');
});

test('analizador: un grant a anon / authenticated / public se reporta salvo que la función esté en ABIERTAS con su porqué', () => {
  const abre = `${CREA}\n${CIERRE}\ngrant execute on function public.f(bigint) to anon;`;
  assert.equal(funcionesAbiertas([{ nombre: '0500_a.sql', sql: abre }]).length, 1);
  assert.deepEqual(funcionesAbiertas([{ nombre: '0500_a.sql', sql: abre }], new Map([['f', 'webhook público que llama el navegador con la clave anon']])), []);
  assert.equal(funcionesAbiertas([{ nombre: '0500_a.sql', sql: 'grant execute on all functions in schema public to authenticated;' }]).length, 1, 'ni todas de golpe');
});

// =============================================================================
// ⚠️ PROBADO ROMPIÉNDOLO (21/10/2026; se rompe UNA pieza, se corren las 6 pruebas de este archivo, se restaura; 12 de 12 dieron rojo):
//   · la 0319 sin el revoke por nombre de pagos_funnel_del_momento (la 0310 vuelve a quedar abierta)  → 2 rojas
//   · la 0319 sin el default GLOBAL (vuelve la 0280 sola)                                              → 1 roja
//   · la 0319 sin el manejo de procedures · sin excluir las funciones de extensiones                   → 1 roja cada una
//   · la 0319 abre una función a anon                                                                   → 2 rojas
//   · una migración NUEVA que crea una función sin revoke (lo que pasó con la 0310 y la 0318)          → 1 roja
//   · el analizador sin mirar anon · sin mirar public · contando los comentarios · contando un revoke
//     ANTERIOR a la creación · sin mirar los grants abiertos a anon                                     → 1 roja cada una
//   · el analizador sin exigir el grant a service_role                                                  → 2 rojas
//   Dos salieron VERDES en la primera versión y se reforzaron: el patrón «el bucle excluye extensiones» también lo satisfacía el bloque de avisos
//   (que tiene su propio pg_depend), y faltaba el caso «el revoke omite anon».
// La 0319 se probó además en un Postgres real descartable (PGlite) con los default privileges de Supabase y la 0280: ver docs/hallazgos-seguridad.md.
// =============================================================================
