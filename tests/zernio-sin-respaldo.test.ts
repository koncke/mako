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
  // Qué claves se leen del entorno, no cuántas veces: `asegurarWebhook` y `leadsEnElWebhook` leen la misma.
  const usos = [...new Set([...ZERNIO.matchAll(/envCred\('([A-Z_]+)'\)/g)].map((m) => m[1]))];
  assert.deepEqual(usos, ['ZERNIO_WEBHOOK_SECRET'], `lib/zernio.ts lee del entorno: ${usos.join(', ')}`);
  assert.doesNotMatch(ZERNIO, /import \{[^}]*\bcredWs\b[^}]*\} from '\.\/credenciales'/, 'lib/zernio.ts importa credWs (cae al entorno para el ws1)');
});

test('zernioConfigurado: «no pude leer» NO es «no tienes Zernio»', () => {
  const f = funcion(ZERNIO, 'export async function zernioConfigurado(ws: number): Promise<boolean> {');
  // `false` sólo para «Zernio no está configurado»; todo lo demás (la base caída, una fila que no se descifra) TIRA.
  assert.match(f, /if \(e instanceof ZernioError && e\.status === 0 && e\.message === 'Zernio no está configurado'\) return false;\n\s+throw e;/);
  assert.doesNotMatch(f, /catch \{ return false; \}/, 'volvió a tragar todo');
});

test('ningún código de app ni lib lee la key de Zernio de la plataforma para un negocio', () => {
  const EXT = /\.(tsx?|mjs|cjs|js)$/;
  // «No encontré nada que revisar» y «revisé y está todo bien» son respuestas DISTINTAS: el piso va con `git ls-files`.
  const cuantos = execFileSync('git', ['ls-files', 'app', 'lib', 'scripts'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 50_000_000 })
    .split(/\r?\n/).filter((f) => EXT.test(f.trim())).length;
  assert.ok(cuantos > 500, `git ls-files devolvió ${cuantos} archivos: esto no corrió en el repo`);
  // Los archivos que nombran la key, buscados con `git grep` (en C y en paralelo): leer miles de archivos desde JS tardaba de uno a cuatro
  // minutos en una máquina cargada. `git grep` sale con 1 cuando no encuentra nada.
  let salida = '';
  try {
    salida = execFileSync('git', ['grep', '-l', 'ZERNIO_API_KEY', '--', 'app', 'lib', 'scripts'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 50_000_000 });
  } catch (e) {
    if ((e as { status?: number }).status !== 1) throw e;
  }
  const archivos = salida.split(/\r?\n/).map((f) => f.trim()).filter((f) => EXT.test(f));
  assert.ok(archivos.length >= 3, `git grep devolvió ${archivos.length} archivos que nombren la key: el barrido no está mirando`);
  const SALVO = [/^app\/admin\/dev\//];
  // LA ÚNICA LECTURA PERMITIDA, en positivo (24/10/2026): publicar anuncios por Zernio (lib/zernio-ads.ts, 001b3184b) usa la
  // key de la plataforma SÓLO para el negocio de la PLATAFORMA (`wsSuperAdmin`, el de MaKo), donde esa key ES la suya; a un
  // cliente le lee su fila (`credDelCliente`). El barrido de antes marcaba esa línea sin mirar la guarda y dejó rojo main.
  // Se quita SÓLO esa línea, exacta y dentro de `claveZernioAnuncios`: cualquier otra lectura, o ésa sin la guarda, cae.
  const PERMITIDA = { archivo: 'lib/zernio-ads.ts', linea: "  if (ws === (await wsSuperAdmin().catch(() => null))) return envCred('ZERNIO_API_KEY');" };
  const clave = funcion(sinComentarios(leer(PERMITIDA.archivo)), 'export async function claveZernioAnuncios(ws: number)', 400);
  assert.equal(clave.split(PERMITIDA.linea).length, 2, 'la key de la plataforma en los anuncios dejó de estar detrás de wsSuperAdmin');
  assert.match(clave, /\n  return credDelCliente\('ZERNIO_API_KEY', ws\);$/, 'un cliente dejó de leer SU key en los anuncios');
  const culpables: string[] = [];
  for (const f of archivos) {
    if (SALVO.some((r) => r.test(f))) continue;
    let src = sinComentarios(leer(f));
    if (f === PERMITIDA.archivo) src = src.replace(PERMITIDA.linea, '');
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
// Una por vez, con un arnés que guarda el original en memoria, rompe, corre ESTE archivo y restaura comprobando el contenido. Las 10 cazadas
// (B1 a B9 contra una base de 4 pasan / 0 fallan; B10, agregada tras la revisión adversarial, contra 5 / 0):
//   B1   credDelClienteEstricta cae al entorno                                                        → 3/1 · credDelClienteEstricta: sólo la fila del negocio, y «no pude leer» tir…
//   B2   credDelClienteEstricta traga el error de la base                                             → 3/1 · credDelClienteEstricta: sólo la fila del negocio, y «no pude leer» tir…
//   B3   cfg vuelve a credWs                                                                          → 2/2 · cfg y la key de «¿te sigue?» leen la key PROPIA: sin credWs, sin envCr…
//   B4   keyDeSeguimiento vuelve al respaldo                                                          → 2/2 · cfg y la key de «¿te sigue?» leen la key PROPIA: sin credWs, sin envCr…
//   B5   otro archivo lee la key de la plataforma                                                     → 3/1 · ningún código de app ni lib lee la key de Zernio de la plataforma para…
//   B11  (24/10) los anuncios leen la key de la plataforma sin la guarda de wsSuperAdmin                 → 4/1 · ningún código de app ni lib…
//   B12  (24/10) un cliente lee la key de la plataforma en los anuncios (credWs, no credDelCliente)      → 4/1 · ningún código de app ni lib…
//   B6   la key vuelve a ser opcional                                                                 → 3/1 · la key de Zernio es OBLIGATORIA: la tarjeta, el ping y la nota lo dice…
//   B7   el ping contesta anda sin key                                                                → 3/1 · la key de Zernio es OBLIGATORIA: la tarjeta, el ping y la nota lo dice…
//   B8   la nota pierde la línea del cobro                                                            → 3/1 · la key de Zernio es OBLIGATORIA: la tarjeta, el ping y la nota lo dice…
//   B9   lib/zernio.ts vuelve a importar credWs                                                       → 3/1 · cfg y la key de «¿te sigue?» leen la key PROPIA: sin credWs, sin envCr…
//   B10  zernioConfigurado traga «no pude leer» como «no tiene»                                       → 4/1 · zernioConfigurado: «no pude leer» NO es «no tienes Zernio»…
// Restaurado: 5 / 0.
