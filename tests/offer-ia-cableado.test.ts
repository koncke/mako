// =============================================================================
// La tab Offer: el CABLEADO que ningún compilador ve (guards de fuente)
// =============================================================================
// Lo puro (parsers, cálculo, segunda capa) lo prueba tests/offer-reglas.test.ts EJECUTÁNDOLO. Acá se
// fija lo que sólo se ve leyendo el fuente, porque lib/offer-ia.ts y la ruta son `server-only` y no se
// pueden importar en un test:
//   · que la feature no pague nunca (catálogo, veto de Claude, lista de proveedores);
//   · que cada prompt registrado en /configuraciones tenga como default LA MISMA constante que lee el
//     call site, con los mismos slots en el template, en el registro y en el render;
//   · que la ruta gatee con `adminDeWorkspaceActual`, valide el path del archivo y borre el binario
//     siempre;
//   · que la tabla esté en los dos registros de inquilino.
//
// Todo lo que se lee se normaliza a LF y se le sacan los comentarios ANTES de buscar (AGENTS.md: en un
// worktree los fuentes llegan en CRLF, y un `doesNotMatch` sobre un fuente con comentarios se acusa a
// sí mismo).
//
// ⚠️ PROBADO ROMPIENDO LO QUE PERSIGUE (11/10/2026, arnés romper-offer.mjs en el scratchpad de la sesión,
// que restaura DE MEMORIA). La base, en verde (6 de 6) antes de cada rotura; 13 roturas (11 sobre fuentes
// propios y 2 simuladas), las 13 cazadas, cada una con «1 fallo, 5 pases». Lo que vive en archivos AJENOS (lib/veto-claude.ts, lib/workspace.ts, con
// trabajo sin commitear de otras sesiones) no se tocó: se simuló en una copia de este test cambiando lo
// que el test LEE (una fila offer agregada al veto; offer_sesiones sacada del texto de TENANT_TABLES).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOGO_MODELOS } from '../lib/model-catalogo';
import { CLAUDE_PERMITIDO } from '../lib/veto-claude';
import { TABLAS_DE_INQUILINO } from '../lib/tablas-de-inquilino';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const IA = sinComentarios(leer('lib/offer-ia.ts'));
const REG = sinComentarios(leer('lib/prompt-registry.ts'));
const RUTA = sinComentarios(leer('app/api/offer/route.ts'));

// rotura (def: SONNET con pagoPorque): 1 fallo, 5 pases. rotura (reusar el tag 'ofertas'): 1 fallo, 5 pases.
test('la feature offer: gratis por default (gemini), sin permiso pago y distinta del paso «ofertas»', () => {
  const f = CATALOGO_MODELOS.find((x) => x.feature === 'offer');
  assert.ok(f, 'falta la fila offer en lib/model-catalogo.ts');
  assert.equal(f.def.provider, 'gemini');
  assert.equal(f.pagoPorque, undefined);
  assert.equal(f.fallback, undefined);
  assert.equal(f.grupo, 'Análisis');
  assert.equal(CATALOGO_MODELOS.filter((x) => x.feature === 'offer').length, 1);
  assert.match(IA, /export const FEATURE_OFFER = 'offer';/);
});

// rotura simulada (una fila 'offer' agregada al veto en una copia del test): 1 fallo, 5 pases.
test('no hay permiso de Claude para offer: el veto la deja afuera', () => {
  assert.equal(CLAUDE_PERMITIDO.some((p) => p.feature === 'offer'), false);
});

// rotura (sumar 'openai' a PROVS_OFFER): 1 fallo, 5 pases. rotura (importar chatClaude): 1 fallo, 5 pases.
// rotura (pasar `[...errores, ...erroresRed]` a errorDeCascada): 1 fallo, 5 pases.
test('offer-ia va por la cascada GRATIS de las keys del cliente y la red de plataforma, nunca por algo pago', () => {
  assert.doesNotMatch(IA, /chatClaude|from '\.\/anthropic'|from '@\/lib\/anthropic'/);
  const lista = IA.match(/export const PROVS_OFFER: readonly ProvName\[\] = \[([^\]]*)\];/);
  assert.ok(lista, 'no encuentro PROVS_OFFER');
  assert.deepEqual(lista[1].split(',').map((s) => s.trim().replace(/'/g, '')), ['gemini', 'groq', 'openrouter']);
  assert.doesNotMatch(lista[1], /openai|mistral|anthropic|cerebras/);
  assert.doesNotMatch(IA, /CASCADA_DOCS|CASCADA_GRATIS/);
  // El modelo gratis de OpenRouter, copiado de lib/flujo-ia.ts (MODELOS_CREAR_IA) con su comentario.
  assert.match(IA, /openrouter: 'nvidia\/nemotron-3-super-120b-a12b:free',/);
  // El pin, primero y sólo si es gratis.
  assert.match(IA, /overrideDeFeature\(FEATURE_OFFER\)/);
  assert.match(IA, /PROVS_OFFER\.includes\(pin\.provider as ProvName\)/);
  // La cascada: directa, con el validar del MISMO parser, plazos y esfuerzo.
  const cascada = IA.slice(IA.indexOf('await chatCheapCascade({'), IA.indexOf('});', IA.indexOf('await chatCheapCascade({')));
  for (const k of ['json: true', 'provs', 'modelos', 'validar', 'erroresOut: errores', 'timeoutMs', 'esfuerzo', 'hastaMs']) {
    assert.ok(cascada.includes(k), `la cascada no pasa ${k}`);
  }
  for (const [fn, parse] of [['turnoOffer', 'parse: parseTurno'], ['diagnosticoOffer', 'parse: parseDiagnostico'], ['propuestaOffer', 'parsePropuesta(raw, p.piezas)']]) {
    const i = IA.indexOf(`export async function ${fn}(`);
    assert.ok(i > 0, `no está ${fn}`);
    const cuerpo = IA.slice(i, IA.indexOf('\n}\n', i));
    assert.ok(cuerpo.includes(parse), `${fn} no valida con su parser`);
    assert.match(cuerpo, /hastaMs: p\.inicio \+ \d+_000, hastaRedMs: p\.inicio \+ (\d+)_000/);
    const red = Number((cuerpo.match(/hastaRedMs: p\.inicio \+ (\d+)_000/) ?? [])[1]);
    assert.ok(red < 300, `${fn}: la red termina a los ${red} s, por encima del maxDuration de la ruta`);
  }
  // La red de plataforma: después de la cascada, con su motivo, y sus errores NO eligen el texto.
  assert.match(IA, /provsGratisDePlataforma\(\)/);
  assert.match(IA, /motivo: `⚠ red de plataforma \(\$\{r\.provider\}\)/);
  assert.match(IA, /return \{ ok: false, error: await errorDeCascada\(errores, p\.tema\) \};/);
  assert.doesNotMatch(IA, /errorDeCascada\([^)]*erroresRed/);
  assert.match(IA, /await docsIADisponible\(\)/);
  // La voz es neutra: ni brandSystem ni la persona de MaKo.
  assert.doesNotMatch(IA, /brandSystem|getActivePersona/);
});

/** El texto de un template exportado de offer-ia (entre la primera comilla invertida y la que cierra con «;»). */
function template(nombre: string): string {
  const i = IA.indexOf(`export const ${nombre} = \``);
  assert.ok(i >= 0, `no está ${nombre}`);
  const desde = i + `export const ${nombre} = \``.length;
  return IA.slice(desde, IA.indexOf('`;', desde));
}
const slots = (s: string) => [...new Set([...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))].sort();

const PROMPTS: Array<[string, string]> = [
  ['offer.turno.system', 'OFFER_TURNO_SYSTEM_TEMPLATE'], ['offer.turno.user', 'OFFER_TURNO_USER_TEMPLATE'],
  ['offer.diagnostico.system', 'OFFER_DIAGNOSTICO_SYSTEM_TEMPLATE'], ['offer.diagnostico.user', 'OFFER_DIAGNOSTICO_USER_TEMPLATE'],
  ['offer.propuesta.system', 'OFFER_PROPUESTA_SYSTEM_TEMPLATE'], ['offer.propuesta.user', 'OFFER_PROPUESTA_USER_TEMPLATE'],
];

// rotura (el call site con otra key que la del registro): 1 fallo, 5 pases. rotura (un slot nuevo en el
// template sin declarar en el registro): 1 fallo, 5 pases. rotura (el call site con la constante de OTRO
// prompt como default): 1 fallo, 5 pases.
test('cada prompt offer.*: registrado con la MISMA key, el MISMO default y los MISMOS slots que el call site', () => {
  assert.match(REG, /from '\.\/offer-ia';/);
  const enRegistro = [...REG.matchAll(/key: '(offer\.[\w.]+)'/g)].map((m) => m[1]).sort();
  const enCallSite = [...IA.matchAll(/renderPrompt\('(offer\.[\w.]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(enRegistro, PROMPTS.map(([k]) => k).sort(), 'las keys del registro no son las seis');
  assert.deepEqual(enCallSite, enRegistro, 'el call site lee keys que el registro no tiene (o al revés)');
  for (const [key, constante] of PROMPTS) {
    const i = REG.indexOf(`key: '${key}'`);
    const fila = REG.slice(i, REG.indexOf('\n      },', i));
    assert.match(fila, new RegExp(`default: ${constante},`), `${key}: el default no es ${constante}`);
    const declarados = [...fila.matchAll(/v\('(\w+)'/g)].map((m) => m[1]).sort();
    const delTemplate = slots(template(constante));
    assert.deepEqual(declarados, delTemplate, `${key}: los slots del registro no son los del template`);
    const render = IA.match(new RegExp(`renderPrompt\\('${key.replace(/\./g, '\\.')}', ${constante}, \\{([\\s\\S]*?)\\}\\)`));
    assert.ok(render, `${key}: el call site no usa ${constante} como default`);
    const pasados = [...render[1].matchAll(/(\w+):/g)].map((m) => m[1]).sort();
    assert.deepEqual(pasados, delTemplate, `${key}: el render no llena los slots del template`);
    // Los system definen el JSON: van static-only. Todos tienen la cláusula de datos no confiables.
    if (key.endsWith('.system')) {
      assert.match(fila, /scope: 'static-only'/);
      assert.ok(template(constante).includes('${SEGURIDAD}'), `${key}: falta la cláusula de seguridad`);
      assert.ok(template(constante).includes('${IDIOMA}'), `${key}: falta el bloque de idioma`);
      assert.ok(delTemplate.includes('marco'), `${key}: falta el marco`);
    }
  }
  // Los datos del dueño viajan envueltos como dato no confiable.
  for (const tag of ['contexto_negocio', 'piezas', 'documentos', 'conversacion', 'embudo', 'diagnostico']) {
    assert.match(IA, new RegExp(`contenidoNoConfiable\\([^;]*'${tag}'\\)`), `falta envolver ${tag}`);
  }
});

// rotura (resolverWsAdmin en vez de adminDeWorkspaceActual): 1 fallo, 5 pases. rotura (sacar el `finally`
// del borrado): 1 fallo, 5 pases. rotura (sin el regex del path): 1 fallo, 5 pases.
test('la ruta: gate del admin del negocio, path de ESTE workspace, el binario se borra siempre, onboarding en try', () => {
  assert.match(RUTA, /export const dynamic = 'force-dynamic';/);
  assert.match(RUTA, /export const maxDuration = 300;/);
  assert.match(RUTA, /export const runtime = 'nodejs';/);
  assert.match(RUTA, /const ws = await adminDeWorkspaceActual\(\);\n\s*if \(ws == null\) return no\(403,/);
  assert.doesNotMatch(RUTA, /resolverWsAdmin/);
  assert.match(RUTA, /return runWithWorkspace\(ws, async \(\) => \{/);
  // 'leer': el path se valida contra el workspace ANTES de bajarlo, y el borrado está en un finally.
  const leer = RUTA.slice(RUTA.indexOf('async function leer('), RUTA.indexOf('async function turno('));
  const valida = leer.indexOf('new RegExp(`^${ws}/offer/[0-9a-f-]{36}$`).test(path)');
  const baja = leer.indexOf('storage.download(path)');
  const fin = leer.indexOf('} finally {');
  const borra = leer.indexOf('storage.remove([path])');
  assert.ok(valida > 0 && baja > valida && fin > baja && borra > fin, `valida ${valida} · baja ${baja} · finally ${fin} · borra ${borra}`);
  assert.match(leer, /archivoATexto\(file, \{ feature: 'offer', motivo:/);
  // El onboarding de la tab: los dos pasos, por un helper que nunca tira.
  assert.match(RUTA, /try \{ await marcarPasoTab\('offer', paso\); \} catch/);
  assert.match(RUTA, /await marcar\('of_contar'\)/);
  assert.match(RUTA, /await marcar\('of_conclusion'\)/);
  // Un turno que falla no guarda un mensaje de MaKo: devuelve el error con la sesión.
  assert.match(RUTA, /if \(!ia\.ok\) return no\(502, ia\.error, \{ sesion: vistaDe\(conMensaje\) \}\);/);
});

// rotura simulada (offer_sesiones sacada del texto de TENANT_TABLES en una copia del test): 1 fallo, 5 pases.
test('offer_sesiones está en los DOS registros de inquilino', () => {
  assert.ok((TABLAS_DE_INQUILINO as readonly string[]).includes('offer_sesiones'));
  const ws = sinComentarios(leer('lib/workspace.ts'));
  const set = ws.slice(ws.indexOf('const TENANT_TABLES = new Set<string>(['), ws.indexOf(']);', ws.indexOf('const TENANT_TABLES')));
  assert.ok(set.includes("'offer_sesiones'"), 'falta offer_sesiones en TENANT_TABLES (getTenantDb sería passthrough)');
  const sql = leer('supabase/migrations/0254_offer_sesiones.sql');
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on offer_sesiones from anon, authenticated;/);
  assert.match(sql, /ORDEN DE DESPLIEGUE: \*\*ANTES o JUNTO\*\*/);
});
