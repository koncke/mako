// =============================================================================
// CREAR CON IA: la ruta, la creación vacía, el catálogo, los prompts y la caja (guards de fuente)
// =============================================================================
// Decisión 14 de docs/chatbot-flujo-ramas-diseno.md. Lo puro (deIA, validarIA…) lo prueba
// tests/flujo-ia.test.ts ejecutándolo; acá se fija el CABLEADO que ningún compilador ve: que la
// llamada vaya por la cascada gratis y nunca por Claude, que las keys del registro de prompts sean
// las del call site, que la vacía nazca sin relleno y pausada, que un pedido cancelado no escriba y
// que el cliente tenga un tope.
//
// ⚠️ PROBADO ROMPIENDO LO QUE PERSIGUE, 08/10/2026 (arnés I-romper-ruta.mjs en el scratchpad de la
// sesión, que restaura de memoria): 11 roturas, una por vez, sobre la ruta, lib/setting-secuencias.ts,
// lib/model-catalogo.ts, lib/prompt-registry.ts, la ruta de secuencias y app/automations/CrearConIA.tsx.
// Las 11 cazadas; cada una, con su número de fallos, al lado del test.
//
// Todo lo que se lee se normaliza a LF y se le sacan los comentarios ANTES de buscar (AGENTS.md:
// en un worktree los fuentes llegan en CRLF, y un `doesNotMatch` sobre un fuente con comentarios
// se acusa a sí mismo).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOGO_MODELOS } from '../lib/model-catalogo';
import { FEATURE_CREAR_IA } from '../lib/flujo-ia';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
/** El cuerpo de una función hasta la próxima declaración de primer nivel. */
const funcion = (src: string, nombre: string) => {
  const i = src.indexOf(nombre);
  assert.ok(i >= 0, `no está ${nombre}`);
  const fin = src.slice(i + nombre.length).search(/\n(?:export |async function |function |const [A-Z_]+ =)/);
  return src.slice(i, fin < 0 ? undefined : i + nombre.length + fin);
};

const RUTA = sinComentarios(leer('app/api/chat-agent/secuencias/ia/route.ts'));

// rotura 1 (chatClaude en vez de la cascada): 1 fallo. rotura 2 (CASCADA_GRATIS, sin Gemini): 1 fallo.
// TERCERA TANDA (09/10/2026): la lista es `PROVS_CREAR_IA` (sin OpenAI, que cobra y estaba en
// CASCADA_DOCS, ni Mistral, que rebota siempre), el pin va PRIMERO y uno pago se ignora, y el error
// sale de `falloDeIA` (el motivo por proveedor) y no de `errorDeCascada` (la bolsa entera).
// PROBADO ROMPIÉNDOLO (09/10/2026, scratchpad F-romper.mjs, restaura de memoria), de 9 tests: volver a
// `: CASCADA_DOCS` → 1 fallo; el pin sin `PROVS_GRATIS_PIN` → 1 fallo; `errorDeCascada` → 1 fallo.
test('la ruta va por la cascada GRATIS (gemini → groq → openrouter), con el pin primero, y nunca por algo pago', () => {
  assert.doesNotMatch(RUTA, /chatClaude|anthropic\.ts|@\/lib\/anthropic'/);
  assert.match(RUTA, /chatCheapCascade\(\{/);
  assert.doesNotMatch(RUTA, /CASCADA_DOCS|CASCADA_GRATIS/);
  assert.match(RUTA, /: \[\.\.\.PROVS_CREAR_IA\];/);
  assert.match(RUTA, /overrideDeFeature\(FEATURE_CREAR_IA\)/);
  assert.match(RUTA, /PROVS_GRATIS_PIN\.includes\(pin\.provider as ProvName\)/);
  assert.match(RUTA, /\[pinGratis\.provider as ProvName, \.\.\.PROVS_CREAR_IA\.filter\(/);
  assert.match(RUTA, /\.\.\.MODELO_DOCS, \.\.\.MODELOS_CREAR_IA,/);
  assert.match(RUTA, /return falloDeIA\(errores, hayIA\);/);
  assert.doesNotMatch(RUTA, /errorDeCascada/);
  assert.match(RUTA, /export const maxDuration = 300;/);
});

// rotura (volver a `maxTokens: 6000` fijo): 1 fallo.
test('la salida se dimensiona con la MISMA cuenta que usa la cascada para saltear a Groq', () => {
  assert.match(RUTA, /const maxTokens = salidaParaIA\(tokensAprox\(p\.system\) \+ tokensAprox\(p\.user\), techoDeEntrada\('groq'\)\);/);
  assert.doesNotMatch(RUTA, /maxTokens: 6000/);
});

// rotura 3 (crear etiquetas antes de mirar la cancelación): 1 fallo.
test('un pedido cancelado no escribe nada: se mira la señal ANTES de crear etiquetas y guardar', () => {
  const i = RUTA.indexOf('if (req.signal.aborted) return;');
  const j = RUTA.indexOf('await crearNuevas(');
  const k = RUTA.indexOf('await setSecuenciaPasos(');
  assert.ok(i > 0 && j > i && k > j, `señal ${i} · etiquetas ${j} · guardar ${k}`);
});

// rotura 4 (crear sin exigir la vacía): 1 fallo.
test('crear exige la automatización VACÍA, la vuelve a mirar antes de guardar, y la deja PAUSADA', () => {
  // Desde la revisión del 09/10/2026 el 409 trae lo guardado (`guardado`): ver tests/flujo-ia-arreglos.test.ts.
  assert.match(RUTA, /if \(modo === 'crear' && guardados\.length\) \{[^}]*\{[\s\S]*?return Response\.json\(\{ ok: false, error: '[^']+', guardado \}, \{ status: 409 \}\);/);
  assert.match(RUTA, /await setSecuenciaActiva\(secuenciaId, false\);/);
  assert.match(RUTA, /select\('pasos'\)\.eq\('id', secuenciaId\)/);
});

// rotura 5 (la key del call site distinta de la del registro): 1 fallo.
test('los dos prompts: registrados con la MISMA key y el MISMO default que el call site, sin slots', () => {
  const reg = sinComentarios(leer('lib/prompt-registry.ts'));
  assert.match(reg, /import \{ CREAR_IA_SYSTEM_TEMPLATE, EDITAR_IA_SYSTEM_TEMPLATE \} from '\.\/flujo-ia';/);
  for (const [key, def] of [['chatbot.crear-ia.system', 'CREAR_IA_SYSTEM_TEMPLATE'], ['chatbot.editar-ia.system', 'EDITAR_IA_SYSTEM_TEMPLATE']]) {
    const i = reg.indexOf(`key: '${key}'`);
    assert.ok(i > 0, `falta ${key} en el registro`);
    const fila = reg.slice(i, reg.indexOf('},', i));
    assert.match(fila, new RegExp(`default: ${def},`));
    assert.match(fila, /variables: \[\],/);
    assert.match(RUTA, new RegExp(`getPromptText\\('${key.replace(/\./g, '\\.')}', ${def}\\)`));
  }
});

// rotura 6 (la feature con un default pago): 1 fallo.
test('la feature chatbot-crear-ia: gratis por default, sin PII y sin permiso pago', () => {
  const f = CATALOGO_MODELOS.find((x) => x.feature === FEATURE_CREAR_IA);
  assert.ok(f, 'falta la fila en lib/model-catalogo.ts');
  assert.equal(f.def.provider, 'gemini');
  assert.equal(f.pii, false);
  assert.equal(f.pagoPorque, undefined);
  assert.doesNotMatch(sinComentarios(leer('lib/veto-claude.ts')), /chatbot-crear-ia/);
});

// rotura 7 (la vacía con los pasos de relleno): 1 fallo. rotura 8 (nace activa): 1 fallo.
test('crear vacía: sin pasos de relleno, pausada y con el disparador que no inscribe a nadie', () => {
  const src = sinComentarios(leer('lib/setting-secuencias.ts'));
  const cuerpo = funcion(src, 'export async function crearSecuenciaVacia(');
  assert.match(cuerpo, /\.insert\(\{ clave, nombre: n, etapa: 'manual', trigger_tipo: 'manual', activa: false, pasos: \[\] \}\)/);
  assert.doesNotMatch(cuerpo, /\[MaKo/);
  const ruta = sinComentarios(leer('app/api/chat-agent/secuencias/route.ts'));
  assert.match(ruta, /if \(body\.action === 'crear_vacia'\) \{\n\s*const r = await crearSecuenciaVacia\(/);
  assert.match(ruta, /return Response\.json\(\{ ok: true, secuenciaId: r\.id, nombre: r\.nombre \}\);/);
});

// rotura 9 (el fetch sin signal): 1 fallo. rotura 10 (un tope del cliente menor que el de la ruta): 1 fallo.
test('la caja: el fetch lleva signal con el tope de la ruta + margen, y Cancelar corta', () => {
  const src = sinComentarios(leer('app/automations/CrearConIA.tsx'));
  assert.match(src, /signal: c\.signal,/);
  const tope = Number(/const TOPE_CLIENTE_MS = ([\d_]+);/.exec(src)?.[1].replace(/_/g, ''));
  const max = Number(/export const maxDuration = (\d+);/.exec(RUTA)?.[1]) * 1000;
  assert.ok(tope > max, `el cliente corta a ${tope} ms y la ruta a ${max} ms`);
  assert.match(src, /setTimeout\(\(\) => c\.abort\(\), TOPE_CLIENTE_MS\)/);
  assert.match(funcion(src, 'const cancelar = () => {'), /ctrl\.current\?\.abort\(\);/);
});

// rotura 11 (un rótulo propio en vez de GRAMATICA.analizando): 1 fallo.
test('la caja: el estado de MaKo sale de GRAMATICA, sin <select> nativo', () => {
  const src = sinComentarios(leer('app/automations/CrearConIA.tsx'));
  assert.match(src, /GRAMATICA\.analizando\.rotulo/);
  assert.doesNotMatch(src, /'Revisando'|"Revisando"|>Revisando</);
  assert.doesNotMatch(src, /<select\b/);
});
