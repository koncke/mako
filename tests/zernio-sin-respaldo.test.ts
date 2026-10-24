// =============================================================================
// Zernio SIN respaldo de la clave de la plataforma: cada negocio con SU key (23/10/2026)
// =============================================================================
// Martín: «que cada usuario traiga su API de Zernio». Hasta hoy, un negocio sin key propia hablaba con la cuenta de Zernio
// de la agencia (`cfg` caía a `envCred('ZERNIO_API_KEY')`) y el aislamiento lo daba un profile por workspace. Medido en
// producción el 23/10/2026 (sólo lectura): el ÚNICO workspace que dependía de ese respaldo era el ws3 (Cliente de Prueba), y no
// hay ni una conversación ni un envío de Instagram o Messenger en toda la historia. El Cerebro decidió sacarlo, también del
// modal de Automations.
//
// Lo que cuida este test, porque ninguna de estas fallas se ve (funciona, y por eso nadie la mira):
//   · `credWs` y `credWsEstricta` caen a `process.env` para el `OWNER_WS` (el ws1: Mauricio, un cliente, que además es «la
//     plataforma» para las claves de entorno). `credDelClienteEstricta` es la lectura propia: sólo la fila del negocio.
//   · «No pude leer» NO es «no tiene Zernio»: con la base caída tira, no devuelve null.
//   · Ningún otro archivo lee la key de la plataforma para un negocio.
//   · La key pasó de opcional a OBLIGATORIA: la tarjeta, el ping y la nota lo dicen.
//
// ⚠️ Un test no puede importar un módulo `server-only`: se fija sobre el FUENTE (sin comentarios), y la rotura de cada regla
// se probó (ver `ROTURAS` al pie).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** Los de línea PRIMERO: un `//` que contenga la apertura de un bloque abriría uno que se cierra páginas después. */
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** El cuerpo de una función por su cabecera, hasta el `\n}\n` que la cierra, con el largo acotado. */
function funcion(src: string, cabecera: string, tope = 1_800): string {
  const i = src.indexOf(cabecera);
  assert.ok(i >= 0, `no encontré «${cabecera}»`);
  const j = src.indexOf('\n}\n', i);
  assert.ok(j > i, `no encontré el cierre de «${cabecera}»`);
  const b = src.slice(i, j);
  assert.ok(b.length < tope, `el recorte de «${cabecera}» mide ${b.length}: está mirando otra cosa`);
  return b;
}

const ZERNIO = sinComentarios(leer('lib/zernio.ts'));
const CRED = sinComentarios(leer('lib/credenciales.ts'));

test('credDelClienteEstricta: sólo la fila del negocio, y «no pude leer» tira', () => {
  const f = funcion(CRED, 'export async function credDelClienteEstricta(');
  assert.match(f, /\.from\('credenciales'\)\.select\('valor_enc'\)\.eq\('workspace_id', ws\)\.eq\('clave', clave\)\.maybeSingle\(\)/);
  assert.match(f, /if \(error\) \{\n\s+throw Object\.assign\(new Error\(/, 'un error de la base se devuelve como «no tiene»');
  assert.match(f, /if \(data && v == null && opts\.ilegibleTira\) throw new Error\(/, 'una fila que no se descifra pasa por «no tiene»');
  assert.match(f, /return esValorReal\(v\) \? v : null;/);
  // Y NUNCA el entorno: ni `process.env`, ni el dueño del entorno (`wsDelEntorno`), ni el lector que traga el error (`credDeBase`).
  assert.doesNotMatch(f, /process\.env|wsDelEntorno|credDeBase|envCred/, 'volvió el respaldo de la plataforma');
});

test('cfg y la key de «¿te sigue?» leen la key PROPIA: sin credWs, sin envCred', () => {
  const cfg = funcion(ZERNIO, 'export async function cfg(ws: number): Promise<ZernioCfg> {');
  assert.match(cfg, /const propia = await credDelClienteEstricta\('ZERNIO_API_KEY', ws, \{ ilegibleTira: true \}\);/);
  assert.match(cfg, /if \(propia\) return \{ apiKey: propia, byok: ws !== OWNER_WS \};/);
  assert.match(cfg, /throw new ZernioError\('Zernio no está configurado', 0, null\);/);
  assert.doesNotMatch(cfg, /credWs\(|envCred\(/, 'cfg volvió a caer a la cuenta de la plataforma');
  const seg = funcion(ZERNIO, 'async function keyDeSeguimiento(ws: number): Promise<string | null> {');
  assert.match(seg, /return credDelClienteEstricta\('ZERNIO_API_KEY', ws\);/);
  assert.doesNotMatch(seg, /envCred|credWs\(/, 'el «¿te sigue?» volvió a la cuenta de la plataforma');
  // El único `envCred` que queda en el archivo es el del secreto maestro del webhook (no es una cuenta de Zernio).
  const usos = [...ZERNIO.matchAll(/envCred\('([A-Z_]+)'\)/g)].map((m) => m[1]);
  assert.deepEqual(usos, ['ZERNIO_WEBHOOK_SECRET'], `lib/zernio.ts lee del entorno: ${usos.join(', ')}`);
  assert.doesNotMatch(ZERNIO, /import \{[^}]*\bcredWs\b[^}]*\} from '\.\/credenciales'/, 'lib/zernio.ts importa credWs (cae al entorno para el ws1)');
});

test('ningún código de app ni lib lee la key de Zernio de la plataforma para un negocio', () => {
  const archivos = execFileSync('git', ['ls-files', 'app', 'lib', 'scripts'], { cwd: RAIZ, encoding: 'utf8' })
    .split(/\r?\n/).map((f) => f.trim()).filter((f) => /\.(tsx?|mjs|cjs|js)$/.test(f));
  assert.ok(archivos.length > 500, `git ls-files devolvió ${archivos.length} archivos: esto no corrió en el repo`);
  const SALVO = [/^app\/admin\/dev\//];
  const culpables: string[] = [];
  for (const f of archivos) {
    if (SALVO.some((r) => r.test(f))) continue;
    // Crudo y filtrado ANTES de normalizar: el barrido pasa por miles de archivos y casi ninguno nombra la key.
    const crudo = readFileSync(join(RAIZ, f), 'utf8');
    if (!crudo.includes('ZERNIO_API_KEY')) continue;
    const src = sinComentarios(crudo.replace(/\r\n/g, '\n'));
    if (/(envCred|credWs)\(\s*['"`]ZERNIO_API_KEY['"`]|process\.env(\.ZERNIO_API_KEY|\[\s*['"`]ZERNIO_API_KEY)/.test(src)) culpables.push(f);
  }
  assert.deepEqual(culpables, [], `leen la key de la plataforma: ${culpables.join(', ')}`);
});

test('la key de Zernio es OBLIGATORIA: la tarjeta, el ping y la nota lo dicen', () => {
  const cat = sinComentarios(leer('lib/metodo-catalogo.ts'));
  const i = cat.indexOf("key: 'zernio',");
  assert.ok(i >= 0);
  const bloque = cat.slice(i, cat.indexOf("key: 'email',", i));
  assert.ok(bloque.length < 1_800, `el recorte de la tarjeta de Zernio mide ${bloque.length}`);
  assert.match(bloque, /\{ env: 'ZERNIO_API_KEY', label: 'API key de Zernio', secreto: true,\n\s+nota: '/);
  assert.doesNotMatch(bloque, /opcional|sinEsto|respaldo|plataforma/i, 'la key volvió a ser opcional o a nombrar la cuenta de la plataforma');
  // La línea del cobro: cada red cuenta aparte, y lo paga el negocio.
  assert.match(bloque, /nota: 'Zernio te cobra a ti\. Cada red cuenta aparte \(página, Instagram, anuncios\): 2 gratis, desde la 3\.ª se paga\.'/);
  const verificar = sinComentarios(leer('lib/metodo-verificar.ts'));
  const iPing = verificar.indexOf('async zernio(v) {');
  assert.ok(iPing >= 0, 'no encontré el ping de Zernio');
  const ping = verificar.slice(iPing, verificar.indexOf('\n  },\n', iPing));
  assert.ok(ping.length > 100 && ping.length < 1_800, `el recorte del ping mide ${ping.length}: está mirando otra cosa`);
  assert.match(ping, /if \(!key\) return \{ ok: false, error: 'Falta la API key de Zernio\.' \};/, 'el ping contesta «anda» sin key');
  assert.doesNotMatch(ping, /la de la plataforma/i);
});

// ── ROTURAS (23/10/2026) ───────────────────────────────────────────────────────
// Una por vez, con un arnés que guarda el original en memoria, rompe, corre ESTE archivo y restaura comprobando el contenido.
// Base: 4 pasan / 0 fallan. Las 9 cazadas (`pasan / fallan` y el test que la cazó):
//   B1. `credDelClienteEstricta` cae a `process.env` al final                          → 1 / 3 · «credDelClienteEstricta: sólo la fila…»
//   B2. `credDelClienteEstricta` traga el error de la base (`if (error && false)`)      → 1 / 3 · «credDelClienteEstricta: sólo la fila…»
//   B3. `cfg` vuelve a `credWs`                                                       → 2 / 2 · «cfg y la key…» y el barrido
//   B4. `keyDeSeguimiento` vuelve a `credWsEstricta` + `envCred`                        → 2 / 2 · «cfg y la key…» y el barrido
//   B5. otro archivo de lib/ lee `process.env.ZERNIO_API_KEY`                          → 1 / 3 · el barrido
//   B6. la key vuelve a ser `opcional: true`                                           → 1 / 3 · «la key de Zernio es OBLIGATORIA…»
//   B7. el ping contesta `ok: true` sin key                                            → 1 / 3 · «la key de Zernio es OBLIGATORIA…»
//   B8. la nota pierde la línea del cobro                                               → 1 / 3 · «la key de Zernio es OBLIGATORIA…»
//   B9. lib/zernio.ts vuelve a importar `credWs`                                        → 1 / 3 · «cfg y la key…»
// Restaurado: 4 / 0.
