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
// v2 (11/10/2026, arnés romper-v2.mjs, mismo método): la base en verde (10 de 10); 14 roturas más sobre la
// ruta (incluido el 502 sin la sesión), el GET del audio, lib/offer-sesiones.ts y el registro, las 14 cazadas
// con «1 fallo, 9 pases». Los
// números de la v1 de arriba son de cuando el archivo tenía 6 tests.
// Revisión adversarial (11/10/2026, arnés romper-revision.mjs): la base en verde (11 de 11); 25 roturas más
// sobre la ruta, lib/offer-ia.ts, lib/offer-contexto.ts y lib/offer-sesiones.ts, las 25 cazadas con «1 fallo,
// 10 pases» (cada una nombrada arriba de su test).
// «A definir» (12/10/2026, arnés romper-a-definir.mjs): la base en verde (13 de 13); 6 roturas más sobre la
// ruta, lib/offer-ia.ts y GET /api/offer/pdf, las 6 cazadas con «1 fallo, 12 pases».

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
  for (const [fn, parse] of [['turnoOffer', 'parse: obligatorio ? parseTurnoConDiagnostico : parseTurno'], ['diagnosticoOffer', 'parse: parseDiagnostico'], ['propuestaOffer', 'parsePropuesta(raw, p.piezas, p.reglas)']]) {
    const i = IA.indexOf(`export async function ${fn}(`);
    assert.ok(i > 0, `no está ${fn}`);
    const cuerpo = IA.slice(i, IA.indexOf('\n}\n', i));
    assert.ok(cuerpo.includes(parse), `${fn} no valida con su parser`);
    // Los plazos, también los dos del turno (con la pregunta del diagnóstico obligatoria son más cortos).
    const redes = [...cuerpo.matchAll(/hastaRedMs: p\.inicio \+ (?:\(obligatorio \? (\d+)_000 : (\d+)_000\)|(\d+)_000)/g)]
      .flatMap((m) => [m[1], m[2], m[3]]).filter(Boolean).map(Number);
    assert.ok(redes.length >= 1, `${fn}: no encuentro el plazo de la red`);
    for (const red of redes) assert.ok(red < 300, `${fn}: la red termina a los ${red} s, por encima del maxDuration de la ruta`);
  }
  // La red de plataforma: después de la cascada, con su motivo, y sus errores NO eligen el texto.
  assert.match(IA, /provsGratisDePlataforma\(\)/);
  assert.match(IA, /motivo: `⚠ red de plataforma \(\$\{r\.provider\}\)/);
  assert.match(IA, /return \{ ok: false, error: await errorDeCascada\(errores, p\.tema\) \};/);
  assert.doesNotMatch(IA, /errorDeCascada\([^)]*erroresRed/);
  // ⚠️ El corte «sin IA propia → "conecta una"» ANTES de la red se sacó el 16/10/2026: un cliente nuevo
  // no trae una API y Offer es de su primera semana. Que no vuelva lo fija tests/red-primera-semana.test.ts.
  assert.doesNotMatch(IA, /await docsIADisponible\(\)/);
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

// v2: rotura (el slot {{diagnostico}} del turno sin declarar en el registro): 1 fallo, 9 pases.
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
  for (const tag of ['contexto_negocio', 'piezas', 'documentos', 'conversacion', 'embudo', 'diagnostico', 'voz']) {
    assert.match(IA, new RegExp(`contenidoNoConfiable\\([^;]*'${tag}'\\)`), `falta envolver ${tag}`);
  }
});

// rotura (resolverWsAdmin en vez de adminDeWorkspaceActual): 1 fallo, 5 pases. rotura (sacar el `finally`
// del borrado): 1 fallo, 5 pases. rotura (sin el regex del path): 1 fallo, 5 pases.
// Desde el 15/10/2026 (decisión de Martín, ref `offer-archivero`) el binario de un ARCHIVO leído y guardado pasa
// a El Archivero en vez de borrarse: el `finally` borra todo lo demás. Ese contrato lo fija tests/offer-archivero.test.ts.
// Re-probado ese día con el arnés de tests/offer-archivero.test.ts sobre ESTE archivo (base 13/0): sin el `finally`
// de 'leer' → 1 fallo, 12 pases; el CAS que se rinde sin nombrar el archivo (forma nueva `{ res, sesionId }`) → 1 fallo, 12 pases.
test('la ruta: gate del admin del negocio, path de ESTE workspace, el binario se borra en el finally si no pasó al Archivero, onboarding en try', () => {
  assert.match(RUTA, /export const dynamic = 'force-dynamic';/);
  assert.match(RUTA, /export const maxDuration = 300;/);
  assert.match(RUTA, /export const runtime = 'nodejs';/);
  assert.match(RUTA, /const ws = await adminDeWorkspaceActual\(\);\n\s*if \(ws == null\) return no\(403,/);
  assert.doesNotMatch(RUTA, /resolverWsAdmin/);
  assert.match(RUTA, /return runWithWorkspace\(ws, async \(\) => \{/);
  // 'leer': el path se valida contra el workspace ANTES de bajarlo, y el borrado está en un finally.
  assert.match(RUTA, /const esPathDeOffer = \(ws: number, path: string\): boolean => new RegExp\(`\^\$\{ws\}\/offer\/\[0-9a-f-\]\{36\}\$`\)\.test\(path\);/);
  const leer = RUTA.slice(RUTA.indexOf('async function leer('), RUTA.indexOf('async function leerLink('));
  const valida = leer.indexOf('if (!esPathDeOffer(ws, path))');
  const baja = leer.indexOf('storage.download(path)');
  const fin = leer.indexOf('} finally {');
  const borra = leer.indexOf('storage.remove([path])');
  assert.ok(valida > 0 && baja > valida && fin > baja && borra > fin, `valida ${valida} · baja ${baja} · finally ${fin} · borra ${borra}`);
  assert.match(leer, /archivoATexto\(file, \{ feature: 'offer', motivo:/);
  // El onboarding de la tab: los dos pasos, por un helper que nunca tira.
  assert.match(RUTA, /try \{ await marcarPasoTab\('offer', paso\); \} catch/);
  assert.match(RUTA, /await marcar\('of_contar'\)/);
  assert.match(RUTA, /await marcar\('of_conclusion'\)/);
  // Un turno que falla no guarda un mensaje de MaKo: devuelve el error con la sesión. La única excepción es
  // la pregunta OBLIGATORIA del diagnóstico, que sale ORIGINAL (mensajeDeMako con turno null).
  assert.match(RUTA, /if \(!ia\.ok && plan\.modo !== 'forzar'\) return no\(502, ia\.error, \{ sesion: await vistaSesion\(fila\) \}\);/);
  assert.match(RUTA, /const turnoIA = ia\.ok \? ia\.valor : null;/);
});

/** El cuerpo de una función de la ruta, hasta la próxima función de primer nivel. */
const funcion = (src: string, nombre: string): string => {
  const i = src.indexOf(`async function ${nombre}(`);
  assert.ok(i >= 0, `no está ${nombre}`);
  const fin = src.indexOf('\nasync function ', i + 10);
  const fin2 = src.indexOf('\nfunction ', i + 10);
  const corte = [fin, fin2].filter((x) => x > 0);
  return src.slice(i, corte.length ? Math.min(...corte) : undefined);
};

// v2, cada rotura con «1 fallo, 9 pases»: 'leer-link' con un fetch propio en vez de extraerLanding; leerAudio sin
// esPathDeOffer; borrar el binario del audio también cuando la IA no pudo escucharlo; el texto del error del
// audio con los errores de la red; dejar 'listar'.
// Revisión adversarial, cada una con «1 fallo, 10 pases»: leerLink bajando la URL cruda; el error viejo de la
// página sin texto («Abrí…, se arma en el navegador»); el documento perdido por el CAS sin nombrar; la
// transcripción sin lugar de documento (`docsLibres: 0`); la transcripción que no viaja como documento nuevo.
test('la ruta v2: árbol, alta atada al funnel, la web por la descarga SSRF-segura y el audio sin perder el binario', () => {
  for (const a of ["case 'arbol':", "case 'nueva':", "case 'leer-link':"]) assert.ok(RUTA.includes(a), `falta ${a}`);
  assert.doesNotMatch(RUTA, /case 'listar':/, "'listar' se reemplazó por 'arbol'");
  // La web del dueño sólo por lib/landing-fetch.ts: ningún fetch de URLs de usuarios en la ruta.
  assert.match(RUTA, /from '@\/lib\/landing-fetch';/);
  assert.doesNotMatch(RUTA, /\bfetch\(/);
  // «Pega el link» baja LA página pegada, TAL CUAL: `linkParaLeer` le saca sólo los parámetros de
  // seguimiento y `talCual: true` conserva el www y el querystring. Sin esa opción un `?page_id=245`
  // bajaba la HOME —otra oferta— y la IA anotaba piezas de ahí sin que nada avisara.
  const link = funcion(RUTA, 'leerLink');
  assert.match(link, /const link = linkParaLeer\(url\);\n\s*if \(!link\.ok\) return no\(422, link\.error\);/);
  assert.ok(link.indexOf('linkParaLeer(url)') < link.indexOf('extraerLanding('), 'se decide ANTES de bajar');
  assert.match(link, /pagina = await extraerLanding\(link\.leida, \{ talCual: true \}\);/);
  // El error de una página sin texto no afirma una causa que no se midió, y no vosea.
  assert.doesNotMatch(link, /Abrí|se arma en el navegador|Framer|Lovable/);
  // Un documento que se pierde porque el CAS se rindió se NOMBRA (su binario se borra: no va al Archivero).
  assert.match(funcion(RUTA, 'guardarDocumento'), /if \(e instanceof ConflictoCAS\) return \{ res: no\(409, `No pude guardar «\$\{doc\.nombre\}»/);
  // 'nueva': el funnel se valida estricto (leerFunnels null ≠ «no existe») antes de crear.
  const nueva = funcion(RUTA, 'nueva');
  assert.ok(nueva.indexOf('validarFunnel(funnelId)') > 0 && nueva.indexOf('validarFunnel(funnelId)') < nueva.indexOf('sesionNueva('));
  assert.match(funcion(RUTA, 'validarFunnel'), /if \(funnels == null\) return no\(502,/);
  // El audio: path de ESTE workspace y tipo de audio, validados antes de bajarlo.
  const leerAudio = RUTA.slice(RUTA.indexOf('function leerAudio('), RUTA.indexOf('async function transcribir('));
  assert.match(leerAudio, /if \(!esPathDeOffer\(ws, path\)\) return 'invalido';/);
  assert.match(leerAudio, /if \(!\/\^\(audio\\\/\|video\\\/webm\)\/\.test\(mime\)\) return 'invalido';/);
  const trans = funcion(RUTA, 'transcribir');
  assert.match(trans, /transcribirAudio\(buf\.toString\('base64'\), audio\.mime,/);
  // El texto del fallo lo eligen los errores de SUS keys (SttSinEscucha.errores), nunca los de la red.
  assert.match(trans, /const delNegocio = e instanceof SttSinEscucha \? e\.errores : \[msg\(e\)\];/);
  assert.match(trans, /errorDeCascada\(delNegocio, 'escuchar tu audio'\)/);
  assert.doesNotMatch(trans, /erroresPlataforma/);
  // El binario del audio se borra SÓLO si no había voz (no sirve); si la IA no pudo, queda para reintentar.
  const removes = [...trans.matchAll(/storage\.remove\(/g)].length;
  assert.equal(removes, 1, 'el audio se borra en un solo camino');
  assert.ok(trans.indexOf('storage.remove(') > trans.indexOf('if (!texto) {'), 'el único borrado es el del audio sin voz');
  // Y en el turno, la transcripción va ANTES de guardar el mensaje del dueño.
  const tur = funcion(RUTA, 'turno');
  assert.ok(tur.indexOf('await transcribir(audio)') > 0 && tur.indexOf('await transcribir(audio)') < tur.indexOf('actualizarSesion('));
  // La respuesta tocada se valida contra lo que MaKo preguntó (en el CAS), no se confía del navegador.
  assert.match(tur, /const r = respuestaDiagnostico\(f\.mensajes, respuestaPedida, estadoDiagnostico\(f\.mensajes, optsDiag\)\);/);
  // Una nota de voz larga no se corta en silencio: el reparto va ADENTRO del CAS (con los documentos de ese
  // momento), la transcripción que no entra se agrega como documento y viaja como documento nuevo.
  assert.doesNotMatch(tur, /recortar\(\[texto, transcripcion\]/);
  const cas = tur.slice(tur.indexOf('actualizarSesion('), tur.indexOf('if (primero.era)'));
  assert.match(cas, /repartirTranscripcion\(texto, transcripcion, \{ tope: TOPE_MENSAJE, topeDoc: TOPE_TEXTO_DOC, docsLibres: MAX_DOCS_SESION - f\.documentos\.length \}\)/);
  assert.match(cas, /documentos: \[\.\.\.f\.documentos, transcripta\]/);
  assert.match(tur, /nuevos: docAudio\.creado \? \[\.\.\.docIds, docAudio\.id\] : docIds/);
  // Borrar la conversación borra sus audios, sólo los de ESTE workspace.
  assert.match(RUTA, /const audios = audiosDe\(fila\)\.filter\(\(p\) => esPathDeOffer\(ws, p\)\);/);
});

// Revisión adversarial (11/10/2026), cada rotura con «1 fallo, 10 pases» sobre la base en verde (11 de 11):
// asegurarFaseGuardada con el upsert del store (setDiagnosticoFase); el insert-if-absent sin la relectura
// estricta (`getSetting`); el canal del funnel en vez de `canalParaElNegocio`; la CLAVE_FASE distinta de FASE_KEY; generar
// con la prioridad vieja (gana el chat); generar sin `diagnosticoFaltante`; el turno sin `parseFlojo`;
// `pedir` sin el flojo; el contexto con otra regla de fase que la de `faseVigenteDe`.
// (v2: rotura generar sin `fase`; rotura el plan de la ruta sin `conDocumentosNuevos`: 1 fallo, 9 pases.)
// (13/10: rotura `guardarFaseSiNoHay` releyendo con `getDiagnosticoFase` —tolerante— y escribiendo con
//  `setSetting` —upsert que pisa—, que es exactamente el bug del 11/10: 1 fallo, 12 pases.)
test('el diagnóstico de fase: se guarda en el negocio SÓLO si no había uno (insert-if-absent), con el canal del negocio, y el PDF usa la regla de los prompts', () => {
  // El «sólo si no había» vive en el STORE, que es el dueño del setting: la ruta ya no repite la clave
  // ni el mecanismo. Lo que no puede usar NUNCA es `setDiagnosticoFase`, que es un upsert y PISA.
  assert.ok(RUTA.includes("import { guardarFaseSiNoHay } from '@/lib/fase-store';"), 'la ruta no importa guardarFaseSiNoHay');
  assert.ok(!RUTA.includes('setDiagnosticoFase'), 'la ruta usa el upsert que pisa');
  assert.ok(!RUTA.includes('CLAVE_FASE'), 'la ruta volvió a copiar la clave');
  assert.ok(!RUTA.includes("'negocio.fase.diagnostico'"), 'la clave del setting está escrita en la ruta');
  // El store lo hace con el insert-if-absent atómico y la relectura ESTRICTA, nunca con `getDiagnosticoFase`
  // (que es TOLERANTE: un error de Supabase devuelve null igual que «no hay», y ahí se pisaba el bueno).
  const STORE = sinComentarios(leer('lib/fase-store.ts'));
  const guardar = funcion(STORE, 'guardarFaseSiNoHay');
  assert.ok(guardar.includes('if (await cambiarSettingSi(FASE_KEY, null, JSON.stringify(d))) return d;'), guardar);
  assert.ok(guardar.includes('const raw = await getSettingEstricto(FASE_KEY);'), guardar);
  assert.ok(guardar.includes('const ya = parseFase(raw);'), guardar);
  assert.ok(guardar.includes('if (raw != null && await cambiarSettingSi(FASE_KEY, raw, JSON.stringify(d))) return d;'), guardar);
  assert.ok(!/setSetting\(|getSetting\(|getDiagnosticoFase/.test(guardar), 'el store usa una lectura tolerante o un upsert');
  const asegura = funcion(RUTA, 'asegurarFaseGuardada');
  assert.ok(asegura.includes('if (ctx.faseGuardada) return;'), asegura);
  assert.ok(asegura.includes('const d: Diagnostico = { ...e.diag, canal: canalParaElNegocio(e, ctx.funnel) };'), asegura);
  assert.ok(asegura.includes('const vigente = await guardarFaseSiNoHay(d);'), asegura);
  assert.ok(asegura.includes('if (vigente) ctx.faseGuardada = vigente;'), asegura);
  // El cálculo es el de `diagnosticar` (adentro de estadoDiagnostico): la ruta no hace otra cuenta.
  assert.doesNotMatch(RUTA, /\bdiagnosticar\(/);
  // El PDF y los prompts: la MISMA regla (`faseVigenteDe`), leída después de asegurar; y lo que falta, dicho.
  const gen = funcion(RUTA, 'generar');
  assert.match(gen, /const fase = faseVigenteDe\(ctx\);/);
  assert.ok(gen.indexOf('await asegurarFaseGuardada(fila, ctx);') < gen.indexOf('const fase = faseVigenteDe(ctx);'), 'la fase se lee DESPUÉS de asegurar');
  assert.doesNotMatch(gen, /ctx\.faseSesion \?\?/);
  assert.match(gen, /const faltante = fase \? null : diagnosticoFaltante\(estadoDiagnostico\(fila\.mensajes, \{ canal: ctx\.canal, yaGuardado: !!ctx\.faseGuardada \}\)\);/);
  assert.match(gen, /\n\s*fase,\n\s*\.\.\.\(faltante \? \{ diagnosticoFaltante: faltante \} : \{\}\),\n/);
  const CTX = sinComentarios(leer('lib/offer-contexto.ts'));
  assert.match(CTX, /const faseVigente = faseVigenteDe\(\{ faseGuardada: fase \?\? null, faseSesion \}\);/);
  // El turno manda a la IA el bloque que arma el código, y la obligatoria cambia el validar.
  const resp = funcion(RUTA, 'responder');
  assert.match(resp, /diagnostico: diagnosticoParaPrompt\(plan, e\), diagnosticoObligatorio: plan\.modo === 'forzar',/);
  // Un turno con documentos nuevos no fuerza la pregunta (en los DOS planes: el de antes y el de después de la IA).
  assert.equal([...resp.matchAll(/conDocumentosNuevos: p\.nuevos\.length > 0/g)].length, 2);
  assert.match(resp, /const m = mensajeDeMako\(\{/);
  // El bloque del diagnóstico NO va envuelto como dato no confiable: trae una orden.
  const turnoIA = IA.slice(IA.indexOf('export async function turnoOffer('), IA.indexOf('export async function diagnosticoOffer('));
  assert.match(turnoIA, /diagnostico: p\.diagnostico\.trim\(\) \|\| '\(nada pendiente\)',/);
  assert.doesNotMatch(turnoIA, /contenidoNoConfiable\(p\.diagnostico/);
  // Con la obligatoria, un turno que no adaptó la pregunta pero trae las piezas NO se tira: es el respaldo
  // (`parseFlojo`), y lo devuelven las keys del cliente y la red con el MISMO validador.
  assert.match(turnoIA, /parse: obligatorio \? parseTurnoConDiagnostico : parseTurno, parseFlojo: obligatorio \? parseTurno : undefined,/);
  const pedir = IA.slice(IA.indexOf('async function pedir<T>('), IA.indexOf('function bloquesComunes('));
  assert.match(pedir, /const v = validadorConRespaldo\(p\.parse, p\.parseFlojo\);/);
  assert.match(pedir, /const delCliente = v\.resultado\(\);\n\s*if \(delCliente != null\) return \{ ok: true, valor: delCliente, modelo: rotulo \};/);
  assert.ok(pedir.indexOf('const delCliente = v.resultado();') < pedir.indexOf('provsGratisDePlataforma()'), 'el respaldo del cliente vuelve ANTES de la red');
  assert.match(pedir, /validar\(out\.text\);\n\s*const valor = v\.resultado\(\);/);
});

const SES = sinComentarios(leer('lib/offer-sesiones.ts'));

// v2: rotura (la liga al funnel siempre como principal): 1 fallo, 9 pases. rotura (sin la liga en el camino
// idempotente): 1 fallo, 9 pases.
// Revisión adversarial, cada una con «1 fallo, 10 pases»: la anotación incondicional (sin `ofertaYaAnotada`);
// sin borrar la oferta recién creada si la anotación tira; sin la lectura estricta del funnel en la liga
// (con el funnel borrado volvía el aviso reintentable); el funnel borrado con el aviso reintentable; la
// siembra con `listarFunnels` (cae a []).
test('«Guardar»: la oferta nueva se liga al funnel, principal sólo si no tenía; dos pedidos no crean dos ofertas, y el funnel borrado no manda a reintentar', () => {
  const liga = SES.slice(SES.indexOf('async function ligarAlFunnel('));
  assert.match(liga, /await ligarOfertaAFunnel\(funnelId, ofertaId, !delFunnel\.some\(\(l\) => l\.es_principal\)\);/);
  // El funnel se mira ESTRICTO antes de ligar: borrado → aviso que no manda a reintentar.
  assert.match(liga, /db\.from\('funnels'\)\.select\('id, activo'\)\.eq\('id', funnelId\)\.limit\(1\);\n\s*if \(error\) throw new Error\(error\.message\);/);
  assert.ok(liga.indexOf("from('funnels')") < liga.indexOf('ligarOfertaAFunnel('), 'se mira el funnel ANTES de ligar');
  assert.match(liga, /if \(estado === 'no-existe'\) \{\n\s*return \{ aviso: '[^']+', avisoReintentable: false \};/);
  assert.equal([...liga.matchAll(/return \{ aviso: AVISO_LIGA_REINTENTABLE, avisoReintentable: true \};/g)].length, 2, 'sólo la base caída es reintentable');
  const guardar = SES.slice(SES.indexOf('export async function guardarComoOferta('), SES.indexOf('async function descartarOferta('));
  // La liga corre en el camino idempotente, en el que ganó otro pedido y en el normal.
  assert.equal([...guardar.matchAll(/await ligarAlFunnel\(f\.funnelId, /g)].length, 3, 'la liga corre en los tres caminos');
  // Nunca pisa la oferta que se analizaba: el upsert de guardar va SIN id (fila nueva).
  assert.match(guardar, /ofertaId = await upsertOferta\(\{ \.\.\.base, nombre \}\);/);
  // La anotación MIRA lo que hay (compare-and-set): si otro pedido ya anotó esta versión, gana ésa y la
  // recién creada se borra; si la anotación tira, también.
  const cas = guardar.slice(guardar.indexOf('fila = await actualizarSesion(id, (cur) => {'));
  assert.match(cas, /const ya = ofertaYaAnotada\(cur, conc\.version, guardada\);\n\s*if \(ya != null\) \{ ganadora\.id = ya; return null; \}/);
  assert.match(cas, /\} catch \(e\) \{\n\s*await descartarOferta\(guardada, '[^']+'\);\n\s*throw e;/);
  assert.match(cas, /if \(ganadora\.id != null\) \{\n\s*await descartarOferta\(guardada, /);
  assert.match(SES, /await borrarOferta\(ofertaId\);/);
  // La siembra de la principal no decide con una lectura que cae a [] (leerFunnels: null = no se pudo leer).
  const siembra = guardar.slice(guardar.indexOf('const funnels = await leerFunnels();'), guardar.indexOf('const base = ofertaDesdePropuesta('));
  assert.match(siembra, /if \(funnels == null\) \{/);
  assert.ok(siembra.indexOf('if (funnels == null)') < siembra.indexOf('seedOfertaDesdeBrief('), 'sin funnels, no se siembra');
  assert.doesNotMatch(guardar, /listarFunnels|\.catch\(\(\) => \[\]\)|\.catch\(\(\) => \(\{\}/);
  // Las columnas nuevas se leen (y la migración que las crea va antes del deploy).
  assert.match(SES, /const COLS = '[^']*funnel_id, oferta_base_id[^']*';/);
  const mig = leer('supabase/migrations/0256_offer_funnel.sql');
  assert.match(mig, /ORDEN DE DESPLIEGUE: \*\*ANTES\*\*/);
  assert.match(mig, /add column if not exists funnel_id bigint;/);
  assert.match(mig, /add column if not exists oferta_base_id bigint;/);
  assert.doesNotMatch(mig.replace(/^--.*$/gm, ''), /references/i, 'sin FK a propósito');
  assert.match(mig, /create index if not exists idx_offer_sesiones_ws_funnel on offer_sesiones \(workspace_id, funnel_id\);/);
});

// Revisión adversarial, cada una con «1 fallo, 10 pases»: el árbol con `.limit(` en vez de leerTodo; el CAS
// con 5 intentos y espera fija; sesionVaciaDe con `.limit(1)`; sesionVaciaDe sin releer la fila entera; la
// vista sin `ligada`; el funnel borrado que invita a ligar (`out.ligada = false`).
test('las conversaciones: el árbol las lee TODAS, el CAS espera creciente, «Nueva oferta» reusa una vacía aunque no sea la última, y la vista dice si falta la liga', () => {
  const arbol = SES.slice(SES.indexOf('export async function arbolOffer('), SES.indexOf('const CANDIDATAS_VACIAS'));
  assert.match(arbol, /leerTodo<Record<string, unknown>>\(db, TABLA, '[^']+', \{ orden: \['id'\] \}\)/);
  assert.doesNotMatch(arbol, /\.limit\(/);
  const act = SES.slice(SES.indexOf('export async function actualizarSesion('), SES.indexOf('export class ConflictoCAS'));
  assert.match(act, /for \(let intento = 0; intento < INTENTOS_CAS; intento\+\+\) \{/);
  assert.match(act, /setTimeout\(r, esperaCAS\(intento\)\)/);
  assert.match(act, /throw new ConflictoCAS\(\);/);
  assert.doesNotMatch(act, /otra pestaña/);
  const vacia = SES.slice(SES.indexOf('export async function sesionVaciaDe('), SES.indexOf('export async function semillaOffer('));
  assert.match(vacia, /\.limit\(CANDIDATAS_VACIAS\)/);
  assert.match(SES, /const CANDIDATAS_VACIAS = (\d+);/);
  assert.ok(Number(SES.match(/const CANDIDATAS_VACIAS = (\d+);/)?.[1]) > 1);
  assert.match(vacia, /const f = id \? await leerFila\(id\) : null;\n\s*if \(f && estaVacia\(f\)\) return f;/);
  assert.match(vacia, /\} catch \(e\) \{[\s\S]*return null;/);
  // La vista: la columna cruda y si falta la liga (lectura tolerante a propósito: si falla, true).
  const vista = SES.slice(SES.indexOf('export function vistaDe('), SES.indexOf('export async function nombresDeSesion('));
  assert.match(vista, /ofertaGuardadaId: f\.ofertaId,/);
  assert.match(vista, /ligada: ligadaParaVista\(f, nombres\.ligada\),/);
  const nombres = SES.slice(SES.indexOf('export async function nombresDeSesion('), SES.indexOf('export async function vistaSesion('));
  assert.match(nombres, /db\.from\('funnel_ofertas'\)\.select\('id'\)\.eq\('funnel_id', f\.funnelId as number\)\.eq\('oferta_id', f\.ofertaId as number\)\.limit\(1\);/);
  assert.match(nombres, /out\.ligada = !\(\(fun\.data \?\? \[\]\) as unknown\[\]\)\.length;/);
});

// rotura (el GET corriendo en otro workspace): 1 fallo, 9 pases. rotura (firmar sin mirar que el path sea del
// workspace): 1 fallo, 9 pases.
test('GET /api/offer/audio: gate del admin, la sesión del workspace, el path propio y un 302 a una URL firmada', () => {
  const AUDIO = sinComentarios(leer('app/api/offer/audio/route.ts'));
  assert.match(AUDIO, /const ws = await adminDeWorkspaceActual\(\);\n\s*if \(ws == null\) return no\(403,/);
  assert.doesNotMatch(AUDIO, /resolverWsAdmin/);
  assert.match(AUDIO, /return runWithWorkspace\(ws, async \(\) => \{/);
  assert.match(AUDIO, /const fila = await leerFila\(id\);/);
  const valida = AUDIO.indexOf('if (!new RegExp(`^${ws}/offer/[0-9a-f-]{36}$`).test(path))');
  const firma = AUDIO.indexOf('.createSignedUrl(path, SEGUNDOS_FIRMA)');
  assert.ok(valida > 0 && firma > valida, `valida ${valida} · firma ${firma}`);
  assert.match(AUDIO, /return Response\.redirect\(data\.signedUrl, 302\);/);
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

// ── Las 13 respuestas de Martín a «A definir» (12/10/2026): el cableado ──────
// Lo puro está en tests/offer-a-definir.test.ts. Acá, lo que sólo se ve leyendo el fuente: que la ruta
// calcule los avisos ANTES de la IA y le pase las piezas al cálculo, que «generar» agregue el PDF al chat en
// el mismo CAS, que «Así está bien» no pague una IA y que GET /api/offer/pdf no caiga a otra versión.
// rotura (los avisos calculados DESPUÉS del diagnóstico): 1 fallo, 12 pases. rotura (el cálculo sin las piezas): 1 fallo, 12 pases.
// rotura (el PDF agregado al chat FUERA del CAS de la conclusión): 1 fallo, 12 pases. rotura (la propuesta sin las fuentes
// de las cifras): 1 fallo, 12 pases. rotura (la ruta del PDF cayendo a la última versión): 1 fallo, 12 pases.
test('«A definir»: avisos antes de la IA, el control final con las piezas, el PDF de cada versión en el chat y por versión', () => {
  const diag = RUTA.slice(RUTA.indexOf("case 'diagnosticar':"), RUTA.indexOf("case 'generar':"));
  const iAvisos = diag.indexOf('avisosAntesDelDiagnostico(');
  assert.ok(iAvisos > 0 && iAvisos < diag.indexOf('await diagnosticoOffer('), 'los avisos van ANTES de la IA (la de Foco tiene que verlos)');
  assert.match(diag, /alertas: \[\.\.\.\(avisos\.foco \? \[avisos\.foco\] : \[\]\), \.\.\.avisos\.otras\],/);
  assert.match(diag, /calcularDiagnostico\(ia\.valor\.dimensiones, \{ foco: avisos\.foco, otras: avisos\.otras, piezas: fila\.piezas \}\)/);
  assert.doesNotMatch(RUTA, /alertaFoco\(/, 'el foco sale de avisosAntesDelDiagnostico (con las otras ofertas)');
  // La IA del diagnóstico lee los avisos (sin envolverlos: los escribe el código).
  const dIA = IA.slice(IA.indexOf('export async function diagnosticoOffer('), IA.indexOf('function diagnosticoParaPrompt('));
  assert.match(dIA, /alertas: p\.alertas\.length \? p\.alertas\.map\(\(a\) => `- \$\{a\}`\)\.join\('\\n'\) : '\(ninguno\)',/);
  assert.match(IA, /AVISOS QUE YA CALCULÓ EL SISTEMA:\n\{\{alertas\}\}/);
  // Generar: las fuentes de las cifras y el nombre del negocio; lo provisional; el PDF en el MISMO CAS.
  const gen = funcion(RUTA, 'generar');
  assert.match(gen, /reglas: \{ fuentes, negocio \}/);
  assert.match(gen, /\.\.\.fila\.mensajes\.filter\(\(m\) => m\.de === 'yo'\)\.map\(\(m\) => m\.texto\),/);
  assert.match(gen, /const provisional = provisionalDe\(borrador\.diagnostico\);/);
  const cas = gen.slice(gen.indexOf('actualizarSesion(id, (f) => {'), gen.indexOf("await marcar('of_conclusion')"));
  assert.match(cas, /\.\.\.\(provisional \? \{ provisional \} : \{\}\),/);
  assert.match(cas, /const conPdf = mensajePdf\(\{/);
  assert.match(cas, /conclusiones: \[\.\.\.f\.conclusiones, conclusion\], mensajes: \[\.\.\.f\.mensajes, conPdf\],/);
  // «Así está bien» lo contesta el código, antes de llamar a la IA.
  const tur = funcion(RUTA, 'turno');
  const iSinIA = tur.indexOf('respuestaSinIA(conMensaje.mensajes, texto,');
  assert.ok(iSinIA > 0 && iSinIA < tur.indexOf('return responder('), 'sin IA y antes de responder');
  // GET /api/offer/pdf?id=&v=: la versión pedida o la última; nunca otra.
  const PDF = sinComentarios(leer('app/api/offer/pdf/route.ts'));
  assert.match(PDF, /if \(version != null && \(!Number\.isInteger\(version\) \|\| version <= 0\)\) return Response\.json\(/);
  assert.match(PDF, /const conclusion = conclusionDeVersion\(fila\.conclusiones, version\);\n\s*if \(!conclusion\) return Response\.json\(\{ ok: false, error: `Esta oferta no tiene la versión \$\{version\}\.` \}, \{ status: 404 \}\);/);
  assert.match(PDF, /pdfDeOferta\(conclusion, /);
});

// rotura (la regla 14 del turno, la de las otras ofertas, sacada del prompt): 1 fallo, 12 pases.
test('«A definir»: ningún texto que lee la IA exige los 10 a 15 casos, y el turno pregunta SIEMPRE por las otras ofertas', () => {
  const grupoOffer = REG.slice(REG.indexOf("group: 'Offer (MaKo conversa"), REG.indexOf('// ── Vista resuelta para la UI'));
  for (const [nombre, src] of [['lib/offer-ia.ts', IA], ['el grupo Offer del registro', grupoOffer]] as const) {
    assert.doesNotMatch(src, /10\s*(?:a|-|–)\s*15\s*casos/i, `${nombre} dice «10 a 15 casos»`);
  }
  const turno = IA.slice(IA.indexOf('export const OFFER_TURNO_SYSTEM_TEMPLATE'), IA.indexOf('export const OFFER_TURNO_USER_TEMPLATE'));
  assert.match(turno, /14\. SIEMPRE, temprano \(en tus primeras preguntas\): pregunta si vende otras ofertas además de ésta/);
  assert.match(turno, /La pieza "otras" empieza SIEMPRE por el número de ofertas/);
  // Las mínimas del prompt salen del catálogo, no de una lista escrita a mano.
  assert.match(turno, /\$\{PIEZAS_MINIMAS\.length\} piezas mínimas/);
  assert.doesNotMatch(turno, /las 5 piezas mínimas/);
});
