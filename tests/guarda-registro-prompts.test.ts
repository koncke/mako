// =============================================================================
// La guarda del registro de prompts, PROBADA ROMPIÉNDOLE los parsers
// =============================================================================
// `scripts/prompts-registro-sincronizado.mjs` corre en cada push y es lo único que exige
// que todo prompt de MaKo esté declarado en `lib/prompt-registry.ts`. El 6/11/2026 se
// probó rompiéndola 17 veces con un arnés que vivía en el scratchpad de la sesión — y el
// scratchpad se borra. Dos días después la prueba ya no existía y NINGÚN test del repo
// nombraba la guarda: `git grep -l prompts-registro-sincronizado -- tests/` daba 0.
//
// Eso importa porque la guarda falla en silencio hacia el lado bueno: si alguien
// "simplifica" un parser, deja de ver call-sites y sigue dando EXIT 0. Verde midiendo
// nada — exactamente la falla que ella existe para cazar. Un pase no distingue "está
// sincronizado" de "no miré".
//
// Así que los parsers viven afuera, en `scripts/prompts-parseo.mjs`, y acá se les mete
// cada una de las entradas que de verdad los rompió. Son puros: no leen disco ni git, así
// que esto corre en milisegundos y no necesita `tsx` ni el registro.
//
// ⚠️ Lo que este test NO cubre: los modos 3 y 4 de la skill `verify-prompt-registry-sync`
// (default a la deriva, `contenidoNoConfiable` faltante) siguen siendo manuales, y el
// cruce entero sobre el árbol real lo hace la guarda en el push, no acá.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  slotsDe,
  nombraLiteral,
  objetoEn,
  clavesDeVars,
  resolverIndirecto,
  argumentosDe,
  esBitacora,
} from '../scripts/prompts-parseo.mjs';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) =>
  readFileSync(join(RAIZ, rel), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

// ── clavesDeVars: el falso verde ────────────────────────────────────────────────────

test('clavesDeVars lee el shorthand: un parser que sólo busca `k:` da falso verde', () => {
  // La rotura real: la primera medición del 6/11 dijo "0 call-sites pasan una clave que el
  // template no tiene" porque `renderPrompt(k, TPL, { titulo, contexto })` NO tiene dos
  // puntos. Cero no era "está todo bien", era "no vi nada".
  assert.deepEqual(clavesDeVars('{ titulo, contexto }'), ['titulo', 'contexto']);
  assert.deepEqual(clavesDeVars('{ titulo: t, contexto: c }'), ['titulo', 'contexto']);
  assert.deepEqual(clavesDeVars('{ titulo, contexto: c }'), ['titulo', 'contexto']);
  assert.deepEqual(clavesDeVars('{}'), []);
});

test('clavesDeVars no se corta en una coma anidada', () => {
  // Partir el objeto por comas a secas rompe el objeto en pedazos y las claves salen mal.
  assert.deepEqual(clavesDeVars('{ a: unir(x, y), b: 3 }'), ['a', 'b']);
  assert.deepEqual(clavesDeVars('{ a: [1, 2, 3], b: { c: 1, d: 2 } }'), ['a', 'b']);
});

test('clavesDeVars NO lee un valor template con coma, y lo dice en vez de adivinar', () => {
  // Medido el 8/11/2026 escribiendo este test: el contador de profundidad cuenta `{` y `}`,
  // y en `` `${x}, ${y}` `` el `${x}` ya cerró cuando llega la coma, así que parte el objeto
  // por el medio. No es un bug: el pedazo que queda no es un identificador y sale '…', con lo
  // que la guarda manda TODO el call-site al tercer estado (NO MEDIBLE, aviso visible) en vez
  // de inventar una clave o de callarse. El límite es real y queda escrito acá.
  assert.deepEqual(clavesDeVars('{ a: `${x}, ${y}`, b: 1 }'), ['a', '…', 'b']);
});

test('clavesDeVars marca lo que NO se puede medir, en vez de decir que no hay claves', () => {
  // El tercer estado. Si un spread devolviera [] la guarda concluiría "este call-site no
  // llena ningún slot" y se comería todo el cruce de ese prompt sin avisar.
  assert.deepEqual(clavesDeVars('{ ...vars }'), ['…']);
  assert.deepEqual(clavesDeVars('{ ...vars, extra: 1 }'), ['…', 'extra']);
  assert.ok(clavesDeVars('{ [clave]: v }').includes('…'));
});

// ── argumentosDe: el silencio ───────────────────────────────────────────────────────

test('argumentosDe lee una llamada cuyo PRIMER argumento tiene una coma', () => {
  // La rotura 15 del arnés. Con un regex `([^,]*?)` la llamada entera no matchea y el
  // call-site no se ve EN ABSOLUTO: ni medido ni reportado. Un silencio es peor que un
  // aviso, porque no deja rastro de que algo quedó sin chequear.
  const src = 'renderPrompt(elegir(a, b), TPL, { x: 1 })';
  const args = argumentosDe(src, src.indexOf('('));
  assert.equal(args.length, 3);
  assert.equal(args[0], 'elegir(a, b)');
  assert.equal(args[2], '{ x: 1 }');
});

test('argumentosDe balancea llaves, corchetes y paréntesis', () => {
  const src = "getPromptText('k', DEF, { a: [1, 2], b: f(g(3, 4)) })";
  const args = argumentosDe(src, src.indexOf('('));
  assert.equal(args.length, 3);
  assert.equal(args[0], "'k'");
  assert.equal(args[2], '{ a: [1, 2], b: f(g(3, 4)) }');
});

test('argumentosDe devuelve null si la llamada no cierra', () => {
  // Nunca un array a medias: la guarda tiene que poder distinguir "no se pudo leer".
  assert.equal(argumentosDe('renderPrompt(abc, def', 'renderPrompt'.length), null);
});

// ── resolverIndirecto: los 60 falsos positivos ──────────────────────────────────────

const FUENTES_FALSAS = new Map<string, string>([
  [
    'lib/tabla.ts',
    "export const PROMPTS_X = {\n  campo: { key: 'x.campo.system', tpl: 'hola {{a}}' },\n  otro: { key: 'x.otro.user', tpl: '' },\n};\n",
  ],
  [
    'lib/constantes.ts',
    "export const CLAVE_ALGO = 'algo.system';\nexport const KEY_OTRA: string = 'otra.user';\n",
  ],
  // El vecino peligroso: `app_settings` tiene constantes de nombre parecido que NO son
  // prompts. Barrerlas trajo 60 huérfanas falsas (`recorridos`, `resend_reply_to`,
  // `vigia.paneles`…) el 6/11/2026.
  ['lib/ajustes.ts', "export const recorridos = 'recorridos';\nconst vigiaPaneles = 'vigia.paneles';\n"],
]);

test('resolverIndirecto sigue la tabla PROMPTS_* hasta el literal', () => {
  assert.equal(resolverIndirecto('PROMPTS_X.campo.key', FUENTES_FALSAS), 'x.campo.system');
  assert.equal(resolverIndirecto('PROMPTS_X.otro.key', FUENTES_FALSAS), 'x.otro.user');
});

test('resolverIndirecto sigue la constante CLAVE_*/KEY_*, con y sin anotación de tipo', () => {
  assert.equal(resolverIndirecto('CLAVE_ALGO', FUENTES_FALSAS), 'algo.system');
  assert.equal(resolverIndirecto('KEY_OTRA', FUENTES_FALSAS), 'otra.user');
});

test('resolverIndirecto NO barre identificadores que no son SCREAMING_CASE', () => {
  // Acá estaban los 60 falsos positivos: resolver cualquier identificador que "pareciera"
  // una clave traía keys de app_settings y la guarda las contaba como prompts huérfanos.
  assert.equal(resolverIndirecto('recorridos', FUENTES_FALSAS), null);
  assert.equal(resolverIndirecto('vigiaPaneles', FUENTES_FALSAS), null);
});

test('resolverIndirecto devuelve null cuando no encuentra la declaración', () => {
  // Null es lo que la guarda convierte en «KEY QUE NO SE PUEDE SEGUIR»: el aviso de que
  // por ahí puede entrar una huérfana. Si devolviera algo inventado, el aviso se perdería.
  assert.equal(resolverIndirecto('CLAVE_QUE_NO_EXISTE', FUENTES_FALSAS), null);
  assert.equal(resolverIndirecto('PROMPTS_Z.campo.key', FUENTES_FALSAS), null);
  assert.equal(resolverIndirecto('PROMPTS_X.inexistente.key', FUENTES_FALSAS), null);
});

// ── esBitacora: la prosa leída como código ──────────────────────────────────────────

test('esBitacora reconoce las bitácoras de /admin/dev y nada más', () => {
  // Las bitácoras son DOCUMENTACIÓN en `.ts` y varias escriben `renderPrompt(…)` dentro de
  // un string. Leídas como call-sites daban una key opaca que no existe (una decía
  // literalmente «) con `razones.system`»).
  assert.equal(esBitacora('app/admin/dev/ads-writer/bitacora.ts'), true);
  assert.equal(esBitacora('bitacora.ts'), true);
  assert.equal(esBitacora('lib/bitacora-de-algo.ts'), false);
  assert.equal(esBitacora('lib/mi-bitacora.ts'), false);
  assert.equal(esBitacora('app/admin/dev/areas.ts'), false);
});

// ── slotsDe / nombraLiteral / objetoEn ──────────────────────────────────────────────

test('slotsDe saca los {{slot}} sin repetir y ordenados', () => {
  assert.deepEqual(slotsDe('{{b}} y {{a}} y {{b}}'), ['a', 'b']);
  assert.deepEqual(slotsDe(''), []);
  assert.deepEqual(slotsDe(null), []);
});

test('slotsDe NO cuenta un {{ con espacios }}: renderTemplate tampoco lo reemplaza', () => {
  // Si el test aceptara `{{ x }}` como slot, la guarda pediría declarar una variable que
  // `lib/prompt-render-pure.ts` nunca va a llenar.
  assert.deepEqual(slotsDe('{{ x }}'), []);
  assert.deepEqual(slotsDe('{{x-y}}'), []);
});

test('nombraLiteral ve la key en los tres comillados', () => {
  assert.equal(nombraLiteral("const k = 'offer.system';", 'offer.system'), true);
  assert.equal(nombraLiteral('const k = "offer.system";', 'offer.system'), true);
  assert.equal(nombraLiteral('const k = `offer.system`;', 'offer.system'), true);
  assert.equal(nombraLiteral('const k = offer.system;', 'offer.system'), false);
});

test('objetoEn corta el objeto balanceando llaves, no en la primera que encuentra', () => {
  const src = 'const X = { a: { b: 1 }, c: 2 }; const Y = 3;';
  assert.equal(objetoEn(src, src.indexOf('{')), '{ a: { b: 1 }, c: 2 }');
  assert.equal(objetoEn('const X = { a: 1', 10), null);
});

// ── El cableado: que la guarda use ESTOS parsers y siga enganchada al push ──────────

test('la guarda importa los parsers y no tiene una copia propia', () => {
  // Sin esto el test se vuelve decorativo: alguien pega las funciones de vuelta adentro de
  // la guarda, el test sigue en verde probando un módulo que ya nadie usa, y los cuatro
  // bugs pueden volver sin que nada se queje.
  const guarda = leer('scripts/prompts-registro-sincronizado.mjs');
  assert.match(guarda, /from '\.\/prompts-parseo\.mjs'/);
  for (const f of [
    'slotsDe',
    'nombraLiteral',
    'objetoEn',
    'clavesDeVars',
    'resolverIndirecto',
    'argumentosDe',
    'esBitacora',
  ]) {
    assert.doesNotMatch(
      guarda,
      new RegExp(`(function|const)\\s+${f}\\s*[=(]`),
      `scripts/prompts-registro-sincronizado.mjs volvió a definir ${f} adentro: los parsers viven en scripts/prompts-parseo.mjs, que es lo que este test prueba`,
    );
  }
});

test('guardas-push.sh sigue llamando a la guarda y cortando el push si da rojo', () => {
  // La preocupación de Martín en el pedido: «una guarda que no resuelva eso es ruido y la
  // van a apagar». Apagarla ahora obliga a borrar este test también.
  const sh = leer('scripts/guardas-push.sh');
  assert.match(sh, /node --import tsx scripts\/prompts-registro-sincronizado\.mjs/);
  assert.match(sh, /if ! node --import tsx scripts\/prompts-registro-sincronizado\.mjs; then[\s\S]*?exit 1/);
});
