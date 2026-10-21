// =============================================================================
// Toda función que crea una migración nace CERRADA a la clave pública (anon / authenticated / PUBLIC) y abierta a service_role
// =============================================================================
// Revisión de la 0318 de Pagos (21/10/2026), probada en un Postgres real: la 0280 creía cerrar las funciones nuevas con un default por esquema, pero el EXECUTE
// de PUBLIC viene del default GLOBAL de Postgres, así que toda función creada después nació ejecutable por la clave anon —la que viaja al navegador—. La regla
// «toda función SQL nueva lleva su revoke» estaba en AGENTS.md y en la 0282; nada la hacía cumplir: la 0310 y la 0318 la olvidaron. Este test la hace cumplir sobre
// TODAS las migraciones (la 0282 tiene su propio test, de una sola función), con un analizador estático que se prueba aparte con migraciones de mentira.
//
// CÓMO LEE: parte cada migración en sentencias (respetando comillas, identificadores entre comillas y $$ del cuerpo de las funciones), y recorre TODAS las migraciones en orden
// llevando el estado de cada función por (esquema, nombre, FIRMA): `create function` la deja abierta, `create or replace` conserva su estado, `drop` la borra, un
// `revoke` que nombre public, anon Y authenticated la cierra, un `grant … to service_role` le da la ejecución. Al final, cada función viva tiene que estar cerrada y,
// si no es la función de un trigger, abierta a service_role. Por eso cuenta el ORDEN (un revoke anterior a un drop+create no sirve) y las SOBRECARGAS (revocar f(bigint)
// no cierra f(text)). Entiende `"public"."f"` (el formato de pg_dump y de Studio), `on function|procedure|routine`, varias funciones en un mismo revoke, y que `int` e
// `integer` son el mismo tipo.
// Además frena lo que REABRE: un grant de EXECUTE a anon / authenticated / public sobre una función, sobre `all functions|routines|procedures in schema …`, o un
// `alter default privileges … grant … on functions|routines to …` (global o por esquema), salvo las funciones de ABIERTAS, con su porqué: hoy ninguna.
// No cuenta el bucle de la 0319 (un DO con format()): sólo lo que se lee en el SQL. Y fija la 0319: el default GLOBAL de postgres, el grant a service_role, el bucle y los avisos.
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
    if (c === '$') { const m = /^\$[a-zA-Z_]*\$/.exec(sql.slice(i, i + 40)); if (m) { enDol = m[0]; out += m[0]; i += m[0].length; continue; } }
    out += c; i++;
  }
  return out;
}

/** Parte un SQL (ya sin comentarios) en sentencias por los `;` de primer nivel: no corta dentro de comillas simples, identificadores "…" ni cuerpos $$…$$. */
function sentencias(sql: string): string[] {
  const out: string[] = [];
  let ini = 0;
  let i = 0;
  let enStr = false;
  let enIdent = false;
  let enDol: string | null = null;
  while (i < sql.length) {
    const c = sql[i];
    if (enDol) { if (sql.startsWith(enDol, i)) { i += enDol.length; enDol = null; } else i++; continue; }
    if (enStr) { if (c === "'") { if (sql[i + 1] === "'") { i += 2; continue; } enStr = false; } i++; continue; }
    if (enIdent) { if (c === '"') { if (sql[i + 1] === '"') { i += 2; continue; } enIdent = false; } i++; continue; }
    if (c === "'") { enStr = true; i++; continue; }
    if (c === '"') { enIdent = true; i++; continue; }
    if (c === '$') { const m = /^\$[a-zA-Z_]*\$/.exec(sql.slice(i, i + 40)); if (m) { enDol = m[0]; i += m[0].length; continue; } }
    if (c === ';') { out.push(sql.slice(ini, i)); ini = i + 1; }
    i++;
  }
  out.push(sql.slice(ini));
  return out.map((s) => s.trim()).filter(Boolean);
}

/** Parte `texto` por `sep` en el primer nivel (fuera de paréntesis, corchetes y comillas). */
function partirPrimerNivel(texto: string, sep: string): string[] {
  const partes: string[] = [];
  let prof = 0;
  let enStr = false;
  let enIdent = false;
  let ini = 0;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enStr) { if (c === "'") enStr = false; continue; }
    if (enIdent) { if (c === '"') enIdent = false; continue; }
    if (c === "'") enStr = true;
    else if (c === '"') enIdent = true;
    else if (c === '(' || c === '[') prof++;
    else if (c === ')' || c === ']') prof--;
    else if (c === sep && prof === 0) { partes.push(texto.slice(ini, i)); ini = i + 1; }
  }
  partes.push(texto.slice(ini));
  return partes.map((p) => p.trim()).filter(Boolean);
}

// Un identificador (con o sin comillas) y un nombre calificado `esquema.nombre`.
const ID = '(?:"(?:[^"]|"")+"|[a-zA-Z_][a-zA-Z0-9_$]*)';
const QNAME = `(?:(${ID})\\s*\\.\\s*)?(${ID})`;
const ident = (s: string) => (s.startsWith('"') ? s.slice(1, -1).replace(/""/g, '"') : s.toLowerCase());

const ALIAS: Record<string, string> = {
  int: 'integer', int4: 'integer', int2: 'smallint', int8: 'bigint', bool: 'boolean', float8: 'double precision', float4: 'real', varchar: 'character varying',
  char: 'character', bpchar: 'character', decimal: 'numeric', timestamptz: 'timestamp with time zone', timetz: 'time with time zone',
  timestamp: 'timestamp without time zone', time: 'time without time zone', serial: 'integer', bigserial: 'bigint',
};
/** El tipo en su forma canónica, para que `int`, `INTEGER` e `int4` sean el mismo. */
function canonico(tipo: string): string {
  let t = tipo.toLowerCase().replace(/\(\s*[^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  t = t.replace(/^(?:public|pg_catalog)\./, '').replace(/\s+array\b/g, '[]');
  const m = /^([^[]*?)\s*((?:\[\s*\d*\s*\])*)$/.exec(t);
  const base = (m?.[1] ?? t).trim();
  const dims = (m?.[2] ?? '').replace(/\s+/g, '');
  return `${ALIAS[base] ?? base}${dims}`;
}

const SOLO_TIPO = /^(?:double precision|character varying|char(?:acter)? varying|national char(?:acter)?(?: varying)?|bit varying|timestamp(?: with(?:out)? time zone)?|time(?: with(?:out)? time zone)?|interval)\b/i;
/** Los tipos de una lista de argumentos: sin el nombre del argumento, sin el DEFAULT y sin los OUT (que no entran en la identidad de la función). */
function tiposDeArgs(args: string): string[] {
  const tipos: string[] = [];
  for (let a of partirPrimerNivel(args, ',')) {
    a = a.replace(/\s+default\s+[\s\S]*$/i, '').replace(/\s*=[\s\S]*$/, '').trim();
    const modo = /^(out|inout|in|variadic)\s+/i.exec(a);
    if (modo) { if (modo[1].toLowerCase() === 'out') continue; a = a.slice(modo[0].length); }
    const sinMods = a.replace(/\(\s*[^)]*\)/g, '');
    const fichas = partirPrimerNivel(sinMods.replace(/\s+/g, ','), ',');
    if (!SOLO_TIPO.test(sinMods.trim()) && fichas.length >= 2) a = a.replace(/^(?:"(?:[^"]|"")+"|\S+)\s+/, '');
    tipos.push(canonico(a));
  }
  return tipos;
}

/** `esquema.nombre(tipos)` de un item de un DROP / REVOKE / GRANT. `tipos` es null si no trae paréntesis (vale para todas las sobrecargas). */
function itemDeFuncion(item: string): { esq: string; nombre: string; tipos: string[] | null } | null {
  const m = new RegExp(`^${QNAME}\\s*(\\(([\\s\\S]*)\\))?\\s*(?:cascade|restrict)?$`, 'i').exec(item.trim());
  if (!m) return null;
  return { esq: m[1] ? ident(m[1]) : 'public', nombre: ident(m[2]), tipos: m[3] === undefined ? null : tiposDeArgs(m[4]) };
}

const iguales = (a: string[], b: string[]) => a.length === b.length && a.every((t, i) => t === b[i]);
const rolesCierran = (roles: string) => /\bpublic\b/i.test(roles) && /\banon\b/i.test(roles) && /\bauthenticated\b/i.test(roles);
const rolesAbren = (roles: string) => /\b(anon|authenticated|public)\b/i.test(roles);

type Fn = { esq: string; nombre: string; tipos: string[]; donde: string; trigger: boolean; cerrada: boolean; otorgada: boolean };

/** Todo lo que está mal en esas migraciones (ordenadas por nombre), como líneas legibles. */
function funcionesAbiertas(migraciones: Migracion[], abiertas: ReadonlyMap<string, string> = ABIERTAS): string[] {
  const problemas: string[] = [];
  const vivas = new Map<string, Fn>();
  const clave = (esq: string, nombre: string, tipos: string[]) => `${esq}.${nombre}(${tipos.join(',')})`;
  const buscar = (esq: string, nombre: string | null, tipos: string[] | null) =>
    [...vivas.values()].filter((f) => f.esq === esq && (nombre === null || f.nombre === nombre) && (tipos === null || iguales(f.tipos, tipos)));

  for (const mig of [...migraciones].sort((a, b) => a.nombre.localeCompare(b.nombre))) {
    for (const s of sentencias(sinComentarios(mig.sql))) {
      // CREATE [OR REPLACE] FUNCTION|PROCEDURE esquema.nombre(args) …
      const crea = new RegExp(`^create\\s+(or\\s+replace\\s+)?(?:function|procedure)\\s+${QNAME}\\s*\\(`, 'i').exec(s);
      if (crea) {
        let prof = 0;
        let fin = crea[0].length - 1;
        for (; fin < s.length; fin++) { if (s[fin] === '(') prof++; else if (s[fin] === ')' && --prof === 0) break; }
        const esq = crea[2] ? ident(crea[2]) : 'public';
        const nombre = ident(crea[3]);
        const tipos = tiposDeArgs(s.slice(crea[0].length, fin));
        const trigger = /returns\s+trigger/i.test(s.slice(fin + 1).split(/\bas\s+(?:\$|')/i)[0]);
        const k = clave(esq, nombre, tipos);
        const previa = vivas.get(k);
        // OR REPLACE sobre una que ya existe conserva sus permisos. (Un CREATE sin OR REPLACE sobre una existente es un error de Postgres: sólo se crea de nuevo después de un DROP.)
        if (previa) previa.trigger = trigger;
        else vivas.set(k, { esq, nombre, tipos, donde: mig.nombre, trigger, cerrada: false, otorgada: false });
        continue;
      }
      // DROP FUNCTION|PROCEDURE|ROUTINE [IF EXISTS] a(args), b(args)
      const borra = /^drop\s+(?:function|procedure|routine)\s+(?:if\s+exists\s+)?([\s\S]+)$/i.exec(s);
      if (borra) {
        for (const item of partirPrimerNivel(borra[1], ',')) {
          const f = itemDeFuncion(item);
          if (f) for (const v of buscar(f.esq, f.nombre, f.tipos)) vivas.delete(clave(v.esq, v.nombre, v.tipos));
        }
        continue;
      }
      // REVOKE|GRANT … ON FUNCTION|PROCEDURE|ROUTINE a(args), b(args) FROM|TO roles
      const sobreFunciones = /^(revoke|grant)\s+(?:grant\s+option\s+for\s+)?(?:all(?:\s+privileges)?|execute)\s+on\s+(?:function|procedure|routine)\s+([\s\S]+?)\s+(?:from|to)\s+([\s\S]+)$/i.exec(s);
      if (sobreFunciones) {
        const [, verbo, lista, roles] = sobreFunciones;
        for (const item of partirPrimerNivel(lista, ',')) {
          const f = itemDeFuncion(item);
          if (!f) continue;
          const objetivo = buscar(f.esq, f.nombre, f.tipos);
          if (verbo.toLowerCase() === 'revoke') { if (rolesCierran(roles)) for (const v of objetivo) v.cerrada = true; }
          else {
            if (/\bservice_role\b/i.test(roles)) for (const v of objetivo) v.otorgada = true;
            if (rolesAbren(roles) && !abiertas.has(f.nombre)) problemas.push(`${mig.nombre}: abre ${f.esq}.${f.nombre}() a ${roles.trim()} sin estar en ABIERTAS (con su porqué)`);
          }
        }
        continue;
      }
      // REVOKE|GRANT … ON ALL FUNCTIONS|PROCEDURES|ROUTINES IN SCHEMA s FROM|TO roles
      const sobreTodas = /^(revoke|grant)\s+(?:grant\s+option\s+for\s+)?(?:all(?:\s+privileges)?|execute)\s+on\s+all\s+(?:functions|procedures|routines)\s+in\s+schema\s+([\s\S]+?)\s+(?:from|to)\s+([\s\S]+)$/i.exec(s);
      if (sobreTodas) {
        const [, verbo, esquemas, roles] = sobreTodas;
        for (const e of partirPrimerNivel(esquemas, ',').map(ident)) {
          if (verbo.toLowerCase() === 'revoke') { if (rolesCierran(roles)) for (const v of buscar(e, null, null)) v.cerrada = true; }
          else {
            if (/\bservice_role\b/i.test(roles)) for (const v of buscar(e, null, null)) v.otorgada = true;
            if (rolesAbren(roles) && !abiertas.has('*')) problemas.push(`${mig.nombre}: abre TODAS las funciones de ${e} a ${roles.trim()} sin estar en ABIERTAS (con su porqué)`);
          }
        }
        continue;
      }
      // ALTER DEFAULT PRIVILEGES … GRANT … ON FUNCTIONS|ROUTINES TO roles: abre las que vengan
      const porDefecto = /^alter\s+default\s+privileges\s+(?:[\s\S]*?\s)?grant\s+(?:all(?:\s+privileges)?|execute)\s+on\s+(?:functions|routines)\s+to\s+([\s\S]+)$/i.exec(s);
      if (porDefecto && rolesAbren(porDefecto[1]) && !abiertas.has('*')) problemas.push(`${mig.nombre}: \`alter default privileges … grant … on functions\` abre a ${porDefecto[1].trim()} toda función que venga`);
    }
  }
  for (const f of vivas.values()) {
    if (abiertas.has(f.nombre)) continue;
    const firma = `${f.esq}.${f.nombre}(${f.tipos.join(', ')})`;
    if (!f.cerrada) problemas.push(`${f.donde}: ${firma} no lleva \`revoke execute on function ${f.nombre}(…) from public, anon, authenticated\` DESPUÉS de crearse`);
    if (!f.trigger && !f.otorgada) problemas.push(`${f.donde}: ${firma} no lleva \`grant execute on function ${f.nombre}(…) to service_role\``);
  }
  return problemas;
}

/** Las firmas de todas las funciones que alguna migración crea (para saber que el analizador ve algo). */
function funcionesCreadas(migraciones: Migracion[]): { firma: string; trigger: boolean }[] {
  const salida: { firma: string; trigger: boolean }[] = [];
  for (const mig of migraciones) {
    for (const s of sentencias(sinComentarios(mig.sql))) {
      const m = new RegExp(`^create\\s+(?:or\\s+replace\\s+)?(?:function|procedure)\\s+${QNAME}\\s*\\(([\\s\\S]*?)\\)\\s*(?:returns|language|as|security|set|volatile|stable|immutable)`, 'i').exec(s);
      if (m) salida.push({ firma: `${m[1] ? ident(m[1]) : 'public'}.${ident(m[2])}(${tiposDeArgs(m[3]).join(', ')})`, trigger: /returns\s+trigger/i.test(s.split(/\bas\s+(?:\$|')/i)[0]) });
    }
  }
  return salida;
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

test('el analizador ve las funciones conocidas, con su firma y si son de trigger (si no ve ninguna, el test de arriba pasaría en vacío)', () => {
  const vistas = funcionesCreadas(reales());
  const firmas = new Set(vistas.map((f) => f.firma));
  for (const esperada of ['public.flow_tomar_trabajos(bigint, integer)', 'public.flow_cerrar_abandonados(integer)', 'public.montaje_tomar(integer)', 'public.landing_pago_rechazo_sumar(bigint, text)', 'public.pagos_funnel_del_momento()', 'public.set_updated_at()']) {
    assert.ok(firmas.has(esperada), `no ve ${esperada} (ve: ${[...firmas].join(' | ')})`);
  }
  const triggers = new Set(vistas.filter((f) => f.trigger).map((f) => f.firma));
  assert.ok(triggers.has('public.pagos_funnel_del_momento()') && triggers.has('public.set_updated_at()') && !triggers.has('public.montaje_tomar(integer)'), 'distingue las de trigger');
  assert.ok([...firmas].some((f) => f.startsWith('public.retencion_vsl_resumen(')), 've la de los argumentos con default');
});

test('la 0319 fija el default GLOBAL de postgres (cerrado a PUBLIC y abierto a service_role), cierra las existentes con un bucle que respeta extensiones y dueño, y avisa lo que no cierra', () => {
  const sql = sinComentarios(readFileSync(join(DIR, '0319_funciones_sin_public.sql'), 'utf8'));
  assert.match(sql, /alter default privileges for role postgres revoke execute on functions from public;/, 'EL default global: sin `in schema`, que es lo que la 0280 no hizo');
  assert.match(sql, /alter default privileges for role postgres grant execute on functions to service_role;/, 'y el global le da EXECUTE a service_role: una función de postgres en OTRO esquema nace sin PUBLIC y sin él, y el servidor no podría llamarla');
  assert.match(sql, /alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;/);
  // `(?:(?!\bloop\b)[\s\S])*` = cualquier cosa SIN cruzar la palabra `loop`: el pg_depend tiene que estar en el SELECT del bucle que cierra, no en el de los bloques de avisos.
  assert.match(sql, /for f in(?:(?!\bloop\b)[\s\S])*pg_depend(?:(?!\bloop\b)[\s\S])*deptype = 'e'(?:(?!\bloop\b)[\s\S])*\bloop\b/, 'el BUCLE que cierra no toca las funciones de una extensión');
  assert.match(sql, /pg_get_userbyid\(p\.proowner\) = current_user/, 'sólo las que son del que corre la migración');
  assert.match(sql, /revoke execute on routine %s from public, anon, authenticated/, '`on routine` cubre funciones, procedures y agregados (con `on function` un procedure tira 42809 y la migración entera)');
  assert.match(sql, /grant execute on routine %s to service_role/);
  assert.ok(!/for f in(?:(?!\bloop\b)[\s\S])*prokind in/.test(sql), 'el bucle no filtra por prokind: también agregados y de ventana');
  assert.match(sql, /revoke execute on function public\.pagos_funnel_del_momento\(\) from public, anon, authenticated;/, 'la 0310 por nombre');
  assert.match(sql, /pg_extension[\s\S]*raise warning/, 'las funciones de extensiones en public, que el bucle no toca, se AVISAN aparte');
  assert.match(sql, /'http'[\s\S]*'pg_net'[\s\S]*'dblink'/, 'y las peligrosas (SSRF) se marcan: http, pg_net, dblink');
  assert.ok(!/grant[^;]*\b(anon|authenticated)\b/i.test(sql), 'y no abre nada a la clave pública');
});

// ---------------------------------------------------------------------------
// El analizador, con migraciones de mentira
// ---------------------------------------------------------------------------

const un = (sql: string, nombre = '0500_a.sql') => funcionesAbiertas([{ nombre, sql }]);
const CIERRE = 'revoke execute on function public.f(bigint) from public, anon, authenticated;\ngrant execute on function public.f(bigint) to service_role;';
const CREA = 'create or replace function public.f(p bigint) returns int language sql as $$ select 1 $$;';

test('analizador: una función sin revoke se reporta; con revoke y grant en su migración, o en una POSTERIOR, no; un revoke ANTERIOR a la creación no cuenta', () => {
  assert.equal(un(CREA).length, 2, 'sin revoke ni grant: dos reportes');
  assert.deepEqual(un(`${CREA}\n${CIERRE}`), []);
  assert.deepEqual(funcionesAbiertas([{ nombre: '0500_a.sql', sql: CREA }, { nombre: '0501_b.sql', sql: CIERRE }]), [], 'cerrada por una migración posterior (como la 0280 hizo con las viejas)');
  assert.equal(funcionesAbiertas([{ nombre: '0500_a.sql', sql: CIERRE }, { nombre: '0501_b.sql', sql: CREA }]).length, 2, 'un revoke ANTERIOR a la creación no cuenta: la función nace después');
});

test('analizador: el revoke tiene que nombrar public, anon Y authenticated; el comentario no cuenta; y el grant de service_role es obligatorio salvo en un trigger', () => {
  const grant = 'grant execute on function public.f(bigint) to service_role;';
  assert.equal(un(`${CREA}\nrevoke execute on function public.f(bigint) from public, anon;\n${grant}`).length, 1, 'falta authenticated');
  assert.equal(un(`${CREA}\nrevoke execute on function public.f(bigint) from public, authenticated;\n${grant}`).length, 1, 'falta anon');
  assert.equal(un(`${CREA}\nrevoke execute on function public.f(bigint) from anon, authenticated;\n${grant}`).length, 1, 'falta public (el defecto de la 0280)');
  assert.equal(un(`${CREA}\n-- revoke execute on function public.f(bigint) from public, anon, authenticated;\n${grant}`).length, 1, 'un revoke comentado no cuenta');
  assert.equal(un(`${CREA}\nrevoke execute on function public.f(bigint) from public, anon, authenticated;`).length, 1, 'sin grant a service_role');
  const trig = 'create or replace function public.t() returns trigger language plpgsql as $$ begin return new; end $$;\nrevoke execute on function public.t() from public, anon, authenticated;';
  assert.deepEqual(un(trig), [], 'la función de un trigger no necesita grant');
});

test('analizador: un grant a anon / authenticated / public se reporta (sobre una función, sobre TODAS las functions|routines|procedures de un esquema, o como DEFAULT de las que vengan) salvo ABIERTAS', () => {
  const abre = `${CREA}\n${CIERRE}\ngrant execute on function public.f(bigint) to anon;`;
  assert.equal(un(abre).length, 1);
  assert.deepEqual(funcionesAbiertas([{ nombre: '0500_a.sql', sql: abre }], new Map([['f', 'webhook público que llama el navegador con la clave anon']])), []);
  for (const variante of [
    'grant execute on all functions in schema public to authenticated;',
    'grant execute on all routines in schema public to anon;',
    'grant execute on all procedures in schema public to anon;',
    'grant all on all routines in schema public to anon, authenticated;',
    'GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA "public" TO PUBLIC;',
    'alter default privileges for role postgres grant execute on functions to public;',
    'alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated;',
    'alter default privileges in schema public grant all on routines to anon;',
    'alter default privileges for role postgres in schema public grant all on functions to postgres, anon, authenticated, service_role;',
  ]) assert.equal(un(variante).length, 1, `no lo ve: ${variante}`);
  for (const inocua of [
    'grant execute on all functions in schema public to service_role;',
    'alter default privileges for role postgres grant execute on functions to service_role;',
    'alter default privileges for role postgres revoke execute on functions from public;',
    'alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;',
    'revoke execute on all routines in schema public from public, anon, authenticated;',
  ]) assert.deepEqual(un(inocua), [], `reportó de más: ${inocua}`);
});

test('analizador: entiende `"public"."f"` (pg_dump y Studio), mayúsculas entre comillas, otros esquemas y varias funciones en un mismo revoke', () => {
  const cerrar = (esq: string, n: string, args: string) => `revoke execute on function ${esq}.${n}(${args}) from public, anon, authenticated;\ngrant execute on function ${esq}.${n}(${args}) to service_role;`;
  const crearPgDump = 'CREATE OR REPLACE FUNCTION "public"."f"("p" bigint) RETURNS integer LANGUAGE sql AS $$ select 1 $$;';
  assert.equal(un(crearPgDump).length, 2, 'una función creada con el esquema entre comillas se registra (antes no se veía y pasaba)');
  assert.deepEqual(un(`${crearPgDump}\n${cerrar('"public"', '"f"', 'bigint')}`), []);
  assert.equal(un('create function "MiFuncion"() returns int language sql as $$ select 1 $$;').length, 2, 'un nombre con mayúsculas entre comillas');
  assert.deepEqual(un(`create function "MiFuncion"() returns int language sql as $$ select 1 $$;\n${cerrar('public', '"MiFuncion"', '')}`), []);
  assert.equal(un(`create function privado.helper() returns int language sql as $$ select 1 $$;`).length, 2, 'una función de otro esquema también se reporta');
  assert.deepEqual(un(`create function privado.helper() returns int language sql as $$ select 1 $$;\n${cerrar('privado', 'helper', '')}`), []);
  assert.equal(un(`${CREA}\n${cerrar('privado', 'f', 'bigint')}`).length, 2, 'el revoke de OTRO esquema no cierra la de public');
  assert.deepEqual(un(`${CREA}\nrevoke execute on function public.f(bigint), public.g(text) from public, anon, authenticated;\ngrant execute on function public.f(bigint) to service_role;`), [], 'dos funciones en un revoke (g no existe: se ignora)');
});

test('analizador: las SOBRECARGAS se distinguen por firma; int = integer; los OUT y los DEFAULT no cuentan; sin paréntesis vale para todas', () => {
  const cerrarF = (args: string) => `revoke execute on function public.f(${args}) from public, anon, authenticated;\ngrant execute on function public.f(${args}) to service_role;`;
  const crear = (args: string) => `create or replace function public.f(${args}) returns int language sql as $$ select 1 $$;`;
  assert.equal(un(`${crear('p bigint')}\n${crear('p text')}\n${cerrarF('bigint')}`).length, 2, 'f(bigint) cerrada y f(text) NO: dos reportes (revoke y grant de la de text)');
  assert.deepEqual(un(`${crear('p bigint')}\n${crear('p text')}\n${cerrarF('bigint')}\n${cerrarF('text')}`), [], 'cerradas las dos');
  assert.deepEqual(un(`${crear('p_ws bigint, p_cuantos int')}\n${cerrarF('bigint, integer')}`), [], 'int e integer son el mismo tipo');
  assert.deepEqual(un(`${crear('p numeric(10, 2) default 0, q timestamptz')}\n${cerrarF('numeric, timestamp with time zone')}`), [], 'modificadores, DEFAULT y alias');
  assert.deepEqual(un(`${crear('p double precision, q timestamp with time zone, r text[]')}\n${cerrarF('double precision, timestamptz, text[]')}`), [], 'tipos de varias palabras y arreglos');
  assert.deepEqual(un(`${crear('p bigint, out total int')}\n${cerrarF('bigint')}`), [], 'un argumento OUT no entra en la identidad de la función');
  assert.deepEqual(un(`${crear('p bigint')}\n${crear('p text')}\nrevoke execute on function public.f from public, anon, authenticated;\ngrant execute on function public.f to service_role;`), [], 'sin paréntesis: todas las sobrecargas');
});

test('analizador: el ORDEN cuenta (un revoke antes de un drop+create no sirve; un create or replace conserva el estado); `revoke … on all functions` cubre las que YA existen, no las que vengan', () => {
  assert.equal(un(`${CREA}\n${CIERRE}\ndrop function public.f(bigint);\n${CREA.replace('create or replace', 'create')}`).length, 2, 'drop + create nuevo: nace abierta otra vez');
  assert.deepEqual(un(`${CREA}\n${CIERRE}\n${CREA}`), [], 'create or replace de una ya cerrada conserva los permisos');
  assert.deepEqual(un(`${CREA}\n${CIERRE}\ndrop function if exists public.f(bigint);`), [], 'una función borrada ya no cuenta');
  const todas = 'revoke execute on all functions in schema public from public, anon, authenticated;\ngrant execute on all functions in schema public to service_role;';
  assert.deepEqual(un(`${CREA}\n${todas}`), [], 'cubre las existentes');
  assert.equal(un(`${todas}\n${CREA}`).length, 2, 'y NO las que se crean después');
});

test('analizador: un `;` dentro de un cuerpo $$ no parte la sentencia, y un revoke que sólo aparece DENTRO de un cuerpo o de un string no cuenta', () => {
  const conPuntoYComa = 'create or replace function public.f(p bigint) returns int language plpgsql as $cuerpo$ begin perform 1; perform 2; return 1; end $cuerpo$;';
  assert.equal(un(conPuntoYComa).length, 2);
  assert.deepEqual(un(`${conPuntoYComa}\n${CIERRE}`), []);
  const falso = `${CREA}\ndo $$ begin execute 'revoke execute on function public.f(bigint) from public, anon, authenticated'; end $$;\nselect 'grant execute on function public.f(bigint) to service_role';`;
  assert.equal(un(falso).length, 2, 'lo que está dentro de un DO o de un string no es un revoke');
  // Un `revoke` escrito DENTRO del cuerpo de la función, justo después de un `;`: sin respetar los $$ el analizador lo tomaría por una sentencia suelta y daría la función por cerrada.
  const enElCuerpo = 'create or replace function public.f(p bigint) returns int language plpgsql as $x$ begin perform 1; revoke execute on function public.f(bigint) from public, anon, authenticated; grant execute on function public.f(bigint) to service_role; return 1; end $x$;';
  assert.equal(un(enElCuerpo).length, 2, 'un revoke/grant dentro del cuerpo no cierra la función: corre cuando se la llama, no al aplicar la migración');
});

// =============================================================================
// ⚠️ PROBADO ROMPIÉNDOLO (21/10/2026; se rompe UNA pieza, se corren las pruebas de este archivo, se restaura):
//   RONDA 1 (la primera versión, 6 pruebas): 12 roturas, 12 rojas — la 0319 sin el revoke por nombre / sin el default global / sin procedures / sin excluir extensiones / abriendo
//   a anon; una migración nueva sin revoke; el analizador sin mirar anon, public, los comentarios, el orden ni los grants abiertos ni el grant a service_role.
//   RONDA 2 (después de la revisión del Cerebro, que encontró seis variantes que el analizador no veía; 10 pruebas): 19 roturas: 18 rojas (1 roja cada una salvo `int`≠`integer`: 3) y 1 mutante
//   equivalente que se simplificó (abajo). En total, con la ronda 1: 31 roturas, 30 rojas:
//   · la 0319 sin el grant GLOBAL a service_role · con `on function` en el bucle · sin avisar las extensiones · sin marcar dblink · filtrando por prokind otra vez
//   · una migración nueva: una función en OTRO esquema sin revoke · `grant … on all routines` a anon · `alter default privileges … grant … to public`
//   · el analizador: sin nombres entre comillas · sobrecargas por nombre · contando los OUT · `all procedures|routines` invisible · sin `alter default privileges` · sin respetar los
//     $$ (salió VERDE la primera vez: faltaba el caso de un `revoke` escrito DENTRO del cuerpo de una función; ahora roja) · `int` ≠ `integer` · el revoke sin exigir authenticated ·
//     un drop que no borra · el esquema ignorado.
//   Un mutante dio verde y era EQUIVALENTE (un `create` sin `or replace` sobre una función que ya existe es un error de Postgres, nunca se da): se simplificó el código.
// La 0319 se probó además en un Postgres real descartable (PGlite) con los default privileges de Supabase y la 0280: ver docs/hallazgos-seguridad.md.
// =============================================================================
