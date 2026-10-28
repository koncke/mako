// =============================================================================
// Los scripts entran a Postgres por el pooler (IPv4), no por la directa (sólo IPv6)
// =============================================================================
// `db.<ref>.supabase.co` resuelve sólo a IPv6, y la PC de Martín la mayoría de las veces no tiene:
// los scripts morían con `getaddrinfo ENOENT` / `ENETUNREACH`, a veces al arrancar y a veces a
// mitad de una corrida, al reconectar (Aaron, llamada del 26/10/2026; medido el 27/10). La salida
// es UNA función, `urlDeLaBase()` (scripts/url-de-la-base.mjs), que deriva la URL del pooler de
// `DATABASE_URL`. Este test fija la derivación y barre scripts/ para que ninguno vuelva a abrir
// la directa por su cuenta: un script nuevo copiado de uno viejo es justo cómo volvería.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { POOLER_POR_DEFECTO, urlDeLaBase, urlDelPooler } from '../scripts/url-de-la-base.mjs';

const RAIZ = join(__dirname, '..');
// Credenciales de mentira: lo que importa es la forma.
const DIRECTA = 'postgresql://postgres:clave-falsa@db.abcdef123.supabase.co:5432/postgres?sslmode=require';

test('la directa de Supabase se vuelve el pooler en modo sesión: host, puerto 5432 y usuario postgres.<ref>', () => {
  const u = new URL(urlDelPooler(DIRECTA)!);
  assert.equal(u.hostname, POOLER_POR_DEFECTO);
  assert.equal(u.port, '5432');
  assert.equal(u.username, 'postgres.abcdef123');
  assert.equal(u.password, 'clave-falsa');
  assert.equal(u.pathname, '/postgres');
  assert.equal(u.searchParams.get('sslmode'), 'require');
});

test('el prefijo del cluster es aws-1: aws-0 contesta «tenant/user not found» (06/10/2026)', () => {
  assert.equal(POOLER_POR_DEFECTO, 'aws-1-us-west-2.pooler.supabase.com');
});

test('una contraseña con caracteres escapados llega igual (no se re-escapa ni se pierde)', () => {
  const u = new URL(urlDelPooler('postgresql://postgres:a%40b%23c@db.abcdef123.supabase.co:5432/postgres')!);
  assert.equal(decodeURIComponent(u.password), 'a@b#c');
});

test('lo que no es la directa de Supabase no se toca: local, otra base, o ya el pooler', () => {
  assert.equal(urlDelPooler('postgresql://postgres:x@localhost:54322/postgres'), null);
  assert.equal(urlDelPooler('postgresql://postgres.abcdef123:x@aws-1-us-west-2.pooler.supabase.com:5432/postgres'), null);
  assert.equal(urlDelPooler('no es una url'), null);
  const local = 'postgresql://postgres:x@localhost:54322/postgres';
  assert.equal(urlDeLaBase({ DATABASE_URL: local }), local);
});

test('un usuario que ya trae el ref no se duplica', () => {
  const u = new URL(urlDelPooler('postgresql://postgres.abcdef123:x@db.abcdef123.supabase.co:5432/postgres')!);
  assert.equal(u.username, 'postgres.abcdef123');
});

test('urlDeLaBase: sin DATABASE_URL devuelve undefined (el script sigue diciendo «Falta DATABASE_URL»)', () => {
  assert.equal(urlDeLaBase({}), undefined);
  assert.equal(urlDeLaBase({ DATABASE_URL: '' }), undefined);
});

test('urlDeLaBase: MAKO_DB_DIRECTA=1 devuelve la directa tal cual, y SUPABASE_POOLER_HOST cambia el host', () => {
  assert.equal(urlDeLaBase({ DATABASE_URL: DIRECTA, MAKO_DB_DIRECTA: '1' }), DIRECTA);
  assert.equal(new URL(urlDeLaBase({ DATABASE_URL: DIRECTA })!).hostname, POOLER_POR_DEFECTO);
  assert.equal(new URL(urlDeLaBase({ DATABASE_URL: DIRECTA, SUPABASE_POOLER_HOST: 'aws-2-x.pooler.supabase.com' })!).hostname, 'aws-2-x.pooler.supabase.com');
});

// Abrir la directa = pasarle `process.env.DATABASE_URL` a algo que conecta, o guardarlo en una
// variable que después conecta. Preguntar si está (`if (!process.env.DATABASE_URL)`) sí se puede.
const ABRE_LA_DIRECTA = /(postgres\(|connectionString:\s*|Client\(|new URL\(|=\s*)process\.env\.DATABASE_URL\b/;
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));

test('ningún script de scripts/ abre la directa por su cuenta: todos pasan por urlDeLaBase()', () => {
  const archivos = execFileSync('git', ['ls-files', 'scripts'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').filter((f) => /\.(m?js|cjs|m?ts)$/.test(f) && f !== 'scripts/url-de-la-base.mjs' && existsSync(join(RAIZ, f)));
  assert.ok(archivos.length > 50, `se esperaban los scripts de scripts/, llegaron ${archivos.length}`);
  const malos: string[] = [];
  for (const f of archivos) {
    const lineas = sinComentarios(readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n')).split('\n');
    lineas.forEach((l, i) => { if (ABRE_LA_DIRECTA.test(l)) malos.push(`${f}:${i + 1}`); });
  }
  assert.deepEqual(malos, [], 'Estos scripts abren DATABASE_URL directo (sólo IPv6, se cae sin aviso a mitad de corrida). '
    + "Usá `import { urlDeLaBase } from './url-de-la-base.mjs'` y `postgres(urlDeLaBase(), …)`:\n  " + malos.join('\n  '));
});

test('el barrido sí ve un script que abre la directa (el guard no es un verde de mentira)', () => {
  for (const l of [
    "const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 });",
    'const conn = process.env.DATABASE_URL;',
    "const DB = process.env.DATABASE_URL ?? '';",
    'const c = new pg.Client({ connectionString: process.env.DATABASE_URL });',
  ]) assert.ok(ABRE_LA_DIRECTA.test(l), l);
  for (const l of ['if (!process.env.DATABASE_URL) {', "const sql = postgres(urlDeLaBase(), { ssl: 'require' });"]) {
    assert.ok(!ABRE_LA_DIRECTA.test(l), l);
  }
});
