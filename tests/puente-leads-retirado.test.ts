// =============================================================================
// El puente de leads de Meta por Make o Zapier se RETIRÓ (23/10/2026): que no vuelva a medias
// =============================================================================
// Martín, 23/10/2026: «Y no entiendo porque seguimos teniendo "zapier" o "Make" si ya resolvimos todo con Zernio...».
// Los leads de Meta entran con la app propia de cada negocio y Zernio trae los formularios. Se sacó la tarjeta, su servicio, el
// endpoint, el ruteo y el aviso de la API. Medido antes, en producción: 0 claves, 0 ruteos, 0 entregas y 0 leads por ahí.
//
// Retirar una integración es enumerar SUS REGISTROS (AGENTS.md: «Una integración son TRES registros» y «Retirar una RUTA es
// enumerar sus links»): la tarjeta, los campos y el ping, el logo, las slides, el ruteo (`ROUTING_CREDS`, `RUTEO_POR_HASH`, el
// tipo de servicio de ruteo), la ruta y los archivos que sólo existían para ella. Ninguno falla ruidoso al volver: una tarjeta
// sin su ping deja un tilde que contesta «servicio inválido», y una fila de ruteo sin ruta es una clave que nadie lee.
//
// Lo que este guard NO tocaba, a propósito, y comprobaba que seguía: Skool, Hotmart y Apify. Se fueron el 25/10/2026, con su
// propio guard (tests/leads-scraper-retirado.test.ts), y el control de abajo pasó a mirar lo que queda: Stripe y Mercado Pago.
//
// ⚠️ SE BUSCA UNA CADENA O UN NOMBRE PROPIO DEL PUENTE, NO LA PALABRA «Zapier» (AGENTS.md): la palabra aparece en prosa de medio
// repo (los tokens de la API de MaKo se nombran «Zapier Prod», el aviso de Calendly mira `hooks.zapier.com`). Y se saltean los
// comentarios, porque la convención de la casa es explicar en un comentario lo que el guard prohíbe.
//
// PROBADO ROMPIÉNDOLO (23/10/2026), con un arnés que guarda el original en memoria, rompe, corre ESTE archivo y restaura
// comprobando el contenido. Base: 6 pasan / 0 fallan. Cada rotura dio 5 / 1 en el test que la cuida (ver `ROTURAS` al pie).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFS } from '../lib/integraciones-catalogo';
import { SLIDES } from '../lib/servicio-slides';
import { RUTEO_POR_HASH } from '../lib/ruteo-hash';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** Los de línea PRIMERO: un `//` que contenga la apertura de un bloque abriría uno que se cierra páginas después. */
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** Quien conserva la historia del puente a propósito (bitácoras, historial generado, transcripciones de cursos). */
const HISTORIA = [
  /^app\/admin\/dev\/.*bitacora\.ts$/,
  /^app\/admin\/dev\/areas\.ts$/,
  /^app\/admin\/dev\/_historial\.generado\.ts$/,
  /^app\/conocimientos\//,
];
const ESTE = 'tests/puente-leads-retirado.test.ts';

const EXT = /\.(tsx?|mjs|cjs|js)$/;

/**
 * Cuántos archivos de código hay EN GIT (`app/`, `lib/`, `tests/`, `scripts/`). «No encontré nada que revisar» y «revisé y está todo bien»
 * son respuestas DISTINTAS: sin este piso, un `git` que no corre en el repo daría verde sin haber mirado nada.
 * ⚠️ `git ls-files` y `git grep` miran lo que está en GIT: un archivo nuevo sin commitear no se ve. Por eso los archivos del puente se
 * miran también en el DISCO (`ARCHIVOS_DEL_PUENTE`), y lo que se despliega es el commit.
 */
function cuantosArchivos(): number {
  const todos = execFileSync('git', ['ls-files', 'app', 'lib', 'tests', 'scripts'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 50_000_000 })
    .split(/\r?\n/).filter((f) => EXT.test(f.trim()) && !/\.d\.ts$/.test(f));
  assert.ok(todos.length > 500, `git ls-files devolvió ${todos.length} archivos: esto no corrió en el repo`);
  return todos.length;
}

/**
 * Los archivos que dicen alguna palabra del puente, buscados con `git grep` (en C y en paralelo) y no leyendo miles de archivos desde
 * JS: ese barrido tardaba entre uno y cuatro minutos en una máquina cargada. `git grep` sale con 1 cuando no encuentra nada.
 */
function candidatos(): string[] {
  let salida = '';
  try {
    salida = execFileSync('git', ['grep', '-l', '-i', '-E', 'zapier|tarjetaDelPuente|idDeLeadParaElUpsert', '--', 'app', 'lib', 'tests', 'scripts'],
      { cwd: RAIZ, encoding: 'utf8', maxBuffer: 50_000_000 });
  } catch (e) {
    if ((e as { status?: number }).status !== 1) throw e;
  }
  return salida.split(/\r?\n/).map((f) => f.trim()).filter((f) => EXT.test(f) && f !== ESTE && !HISTORIA.some((h) => h.test(f)));
}

/** Lo que sólo existía para el puente: ninguno puede estar, ni en el índice ni en el disco. */
const ARCHIVOS_DEL_PUENTE = [
  'app/api/webhooks/zapier/route.ts',
  'lib/zapier-lead.ts',
  'lib/zapier-leads.ts',
  'lib/zapier-estado.ts',
  'tests/zapier-leads.test.ts',
  'docs/guia-leads-por-zapier.md',
];

/** Los nombres propios del puente en el CÓDIGO (sin comentarios). Cada uno nombra algo que se sacó. */
const NOMBRES_DEL_PUENTE: ReadonlyArray<[RegExp, string]> = [
  [/ZAPIER_LEADS_CLAVE/, 'la credencial del puente'],
  [/webhooks\/zapier/, 'la ruta del receptor'],
  [/zapier-(lead|leads|estado)\b/, 'un import del lector, la puerta o el estado'],
  [/\b(ingresarLeadDeZapier|leerLeadDeZapier|idDeLeadParaElUpsert|parsearEstadoZapier|tarjetaDelPuente|estadoPuenteZapier|KEY_ESTADO_ZAPIER)\b/, 'una función o constante del puente'],
  [/['"`]zapier['"`]/, 'la key del servicio (de la tarjeta, del ruteo o del logo)'],
  [/\bzapier\s*:\s*[[{]/, 'una entrada `zapier:` de un registro (slides, logo)'],
  [/\bzapier\.estado\b/, 'el ajuste donde el receptor anotaba la última entrega'],
];

// ── 1. Los archivos ───────────────────────────────────────────────────────────

test('los archivos del puente no están: ni en git ni en el disco, y no hay otro `zapier-*` en lib', () => {
  const indice = new Set(execFileSync('git', ['ls-files'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 50_000_000 }).split(/\r?\n/));
  for (const f of ARCHIVOS_DEL_PUENTE) {
    assert.equal(existsSync(join(RAIZ, f)), false, `volvió ${f} (está en el disco)`);
    assert.equal(indice.has(f), false, `volvió ${f} (está en git)`);
  }
  const sueltos = readdirSync(join(RAIZ, 'lib')).filter((f) => /^zapier/i.test(f));
  assert.deepEqual(sueltos, [], `un archivo nuevo de lib/ con el nombre del puente: ${sueltos.join(', ')}`);
  assert.equal(existsSync(join(RAIZ, 'app/api/webhooks/zapier')), false, 'volvió la carpeta de la ruta');
  // La guía no se borró: pasó a historia, con su aviso de retirada.
  assert.match(leer('docs/archivo/guia-leads-por-zapier.md'), /RETIRADA el 23\/10\/2026/);
});

// ── 2. El código no nombra nada del puente ────────────────────────────────────

test('ningún código de app, lib, tests ni scripts nombra la credencial, la ruta, los módulos ni la key del puente', () => {
  const culpables: string[] = [];
  cuantosArchivos();
  const lista = candidatos();
  // Los que SÍ dicen «Zapier» hoy (Skool avisa por Zapier, los tokens de la API se nombran «Zapier Prod»): el barrido tiene que verlos,
  // y mirarlos sin comentarios para no acusarlos por prosa.
  assert.ok(lista.length >= 3, `git grep devolvió ${lista.length} archivos que digan Zapier: el barrido no está mirando`);
  for (const f of lista) {
    const src = sinComentarios(leer(f));
    for (const [patron, que] of NOMBRES_DEL_PUENTE) {
      if (patron.test(src)) culpables.push(`${f}: ${que}`);
    }
  }
  assert.deepEqual(culpables, [], `el puente volvió a medias:\n${culpables.join('\n')}`);
});

// ── 3. Los registros, ejecutados ──────────────────────────────────────────────

test('la tarjeta, los campos, las slides y el ruteo por hash ya no tienen el servicio', () => {
  assert.equal(DEFS.some((d) => d.key === 'zapier' || d.envs.includes('ZAPIER_LEADS_CLAVE')), false, 'la tarjeta sigue en el catálogo');
  // El método (`lib/metodo-catalogo.ts`) es `server-only`: se lee del fuente, como los demás tests de tutoriales.
  const metodo = sinComentarios(leer('lib/metodo-catalogo.ts'));
  assert.doesNotMatch(metodo, /key:\s*'zapier'|ZAPIER_LEADS_CLAVE/, 'sus campos siguen en el método');
  assert.doesNotMatch(sinComentarios(leer('lib/metodo-verificar.ts')), /async zapier\(/, 'su ping sigue en el verificador');
  assert.equal('zapier' in SLIDES, false, 'sus slides siguen');
  assert.equal(RUTEO_POR_HASH.has('ZAPIER_LEADS_CLAVE'), false, 'su clave sigue ruteando por hash');
  // (`esIntegracionDeLeads` se fue el 25/10/2026 con el Leads Scraper: no queda una lista de «opcionales de leads» que lo nombre.)
});

test('el ruteo y el logo, leídos del fuente (los módulos son `server-only` o de la pantalla)', () => {
  const routing = sinComentarios(leer('lib/webhook-routing.ts'));
  assert.doesNotMatch(routing, /ZAPIER_LEADS_CLAVE|zapier/i, 'ROUTING_CREDS sigue nombrándolo');
  const huella = sinComentarios(leer('lib/webhook-ruteo-huella.ts'));
  assert.doesNotMatch(huella, /zapier/i, 'el tipo de servicio de ruteo sigue nombrándolo');
  const logo = sinComentarios(leer('app/_components/ServicioVisual.tsx'));
  assert.doesNotMatch(logo, /zapier/i, 'su logo sigue en el registro');
  const board = sinComentarios(leer('app/integraciones/IntegracionesBoard.tsx'));
  assert.doesNotMatch(board, /\.callada\b/, 'la grilla sigue leyendo el estado «callada» del puente');
  assert.doesNotMatch(sinComentarios(leer('lib/integraciones.ts')), /\bcallada\b/, 'la integración sigue teniendo el campo «callada»');
});

// ── 4. Lo que NO se tocó ──────────────────────────────────────────────────────

// El control (25/10/2026): Skool, Hotmart y Apify se fueron con el Leads Scraper (tests/leads-scraper-retirado.test.ts). Lo que
// queda del lado de cobros, y que un retiro torpe podría llevarse, son las pasarelas.
test('Stripe y Mercado Pago siguen: un retiro torpe no se lleva lo que no era', () => {
  for (const k of ['stripe', 'mercadopago']) assert.ok(DEFS.some((d) => d.key === k), `se fue la tarjeta de ${k}`);
  const metodo = sinComentarios(leer('lib/metodo-catalogo.ts'));
  for (const k of ['stripe', 'mercadopago']) assert.match(metodo, new RegExp(`key:\\s*'${k}'`), `se fueron los campos de ${k}`);
  assert.deepEqual([...RUTEO_POR_HASH], [], 'el ruteo por hash cambió de contenido (vacío desde el 25/10/2026)');
  assert.ok(existsSync(join(RAIZ, 'app/api/webhooks/stripe/route.ts')), 'se fue el webhook de Stripe');
});

test('el guard sabe leer: el barrido ve cientos de archivos y reconoce lo que busca', () => {
  assert.ok(cuantosArchivos() > 500);
  // Un fuente con el nombre del puente, escrito a propósito acá, tiene que ser reconocido por cada patrón.
  const trampa = "import { x } from './zapier-estado'; const a = 'ZAPIER_LEADS_CLAVE'; fetch('/api/webhooks/zapier'); const k = 'zapier'; const m = { zapier: [] }; getSetting('zapier.estado'); await ingresarLeadDeZapier(3, l);";
  for (const [patron, que] of NOMBRES_DEL_PUENTE) assert.match(trampa, patron, `el patrón de «${que}» no reconoce lo que busca`);
  // Y no se acusa por la prosa: «Zapier» en una frase, o en el nombre de un token, no es el puente.
  const prosa = "const t = 'Zapier Prod'; const h = 'https://hooks.zapier.com/x'; // la tarjeta zapier se retiró";
  for (const [patron, que] of NOMBRES_DEL_PUENTE) assert.doesNotMatch(sinComentarios(prosa), patron, `el patrón de «${que}» se acusa por prosa`);
});

// ── ROTURAS (23/10/2026) ───────────────────────────────────────────────────────
// Una por vez, restaurando de memoria y comprobando el contenido. Base: 6 pasan / 0 fallan. Las 14 cazadas; el número es
// «pasan / fallan» y, tras la flecha, QUÉ test la cazó:
//   R1. la tarjeta de vuelta en DEFS (`{ key: 'zapier', … }`)                        → 2 / 4 · el barrido y «la tarjeta, los campos…»
//   R2. `ZAPIER_LEADS_CLAVE` de vuelta en RUTEO_POR_HASH                             → 3 / 3 · el barrido, «la tarjeta…» y «Skool, Hotmart…» (el set cambió)
//   R3. `ZAPIER_LEADS_CLAVE` de vuelta en ROUTING_CREDS                              → 2 / 4 · el barrido y «el ruteo y el logo…»
//   R4. el tipo de servicio de ruteo con `'zapier'`                                  → 2 / 4 · el barrido y «el ruteo y el logo…»
//   R5. el logo de vuelta en ServicioVisual                                          → 2 / 4 · el barrido y «el ruteo y el logo…»
//   R6. un `lib/zapier-nuevo.ts` suelto en el disco, sin git add                     → 1 / 5 · «los archivos del puente no están»
//   R7. un `fetch('/api/webhooks/zapier')` en un fuente cualquiera                   → 1 / 5 · el barrido
//   R8. se saca `skool` de RUTEO_POR_HASH (el control)                              → 1 / 5 · «Skool, Hotmart y Apify siguen»
//   R9. se saca la guía archivada                                                    → 1 / 5 · «los archivos del puente no están»
//   R10. `key: 'zapier'` de vuelta en el método                                      → 2 / 4 · el barrido y «la tarjeta, los campos…»
//   R11. el ping `async zapier(v)` de vuelta                                         → 1 / 5 · «la tarjeta, los campos…»
//   R12. `zapier: []` de vuelta en las slides                                        → 2 / 4 · el barrido y «la tarjeta, los campos…»
//   R13. `&& !i.callada` de vuelta en la grilla                                      → 1 / 5 · «el ruteo y el logo…»
//   R14. `'zapier'` de vuelta en `esIntegracionDeLeads`                              → 2 / 4 · el barrido y «la tarjeta, los campos…»
// Y una trampa que cazó la primera corrida, no el arnés: el patrón del método se había escrito con `key:s*` (la barra se la comió el
// shell) y el test pasaba sin mirar nada. Lo cazó la lectura del test, no la rotura: por eso el guard tiene la prueba «sabe leer»,
// que le muestra a cada patrón un texto que DEBE reconocer.
// Restaurado: 6 / 0.
