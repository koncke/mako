// =============================================================================
// Lo que toca un cliente NUEVO en su primera semana corre con la red de la plataforma
// =============================================================================
// Desde el 15/10/2026 un cliente nuevo no trae una API (decisión de Martín, Ticketera
// `clientes-usan-su-claude`): el wizard del primer ingreso ya no la pide
// (tests/onboarding-sin-api.test.ts). Lo que sigue es lo primero que toca después, y sin la
// red de la plataforma le contestaba «conecta tu IA». El orden lo fijó el coordinador sobre
// docs/mapa-ia-24h.md: Ads Writer, Offer, crear landing, crear automatización, Second Brain
// y el análisis del lead. Un test por herramienta, y se suma de a una.
//
// La capacidad se midió antes de extenderla (16/10/2026, docs/hallazgos-ia.md): la key de
// Gemini de la plataforma con más pedidos en un día hizo 29, contra 250 de tope; lo que
// muerde es el tope POR MINUTO.
//
// Correr: npx tsx --test tests/red-primera-semana.test.ts
//
// PROBADO ROMPIÉNDOLO, cada rotura restaurada DE MEMORIA (`redDePlataforma: true` → `false` en UNA llamada):
//   Ads Writer (16/10/2026, base 1/0): generarRazones, sugerirGuion, generarGuion y valorarGuion → 0/1 cada una.
//   Offer (16/10/2026, base 2/0): vuelve el corte «sin IA propia» antes de la red, la ruta lee documentos
//     sin red, y una de las dos lecturas por visión no pasa la red → 1/1 cada una.
//   Crear una landing (16/10/2026, base 3/0): el esquema, las secciones y el reparador de JSON → 2/1 cada una.
//   Crear una automatización (16/10/2026, base 4/0): la pasada sin red, la copia del JSON roto sin red, y
//     `hayIAParaCrear` mirando sólo las keys del negocio → 3/1 cada una.
//   Second Brain (16/10/2026, base 5/0): la búsqueda sin red → 4/1.
//   Análisis del lead (16/10/2026, base 6/0): el corte por datos de clientes que no corta, el corte sin mirar la
//     marca `pii`, el análisis sin red, y `lead_insights` sin la marca → 5/1 cada una. Y sin IA propia, el
//     mensaje de vuelta a «Claude vetado» en vez de decir qué conectar → 5/1.
//   Segunda tanda (16/10/2026, orden de Cerebro, base 10/0): el diagnóstico sin red, el análisis de la landing sin
//     pasarle la red a chatClaude, importar un archivo sin red, carruseles/reels/stories sin red, el plan del anuncio
//     sin red y su reparación sin red → 9/1 cada una.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
// Líneas `//` primero y bloques después, y nada más (un paso que borre las líneas que empiezan
// con `*` se lleva los cierres de JSDoc: docs/hallazgos-ia.md, 16/10/2026).
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** El cuerpo de una función de nivel cero, hasta la próxima declaración de nivel cero. */
function cuerpo(archivo: string, nombre: string): string {
  const src = sinComentarios(leer(archivo));
  // `[(<]`: una función genérica (`generar<R …>(`) también cuenta.
  const ini = src.search(new RegExp(`\\nexport async function ${nombre}[(<]`));
  assert.ok(ini >= 0, `${archivo}: no existe ${nombre}`);
  const resto = src.slice(ini + 1);
  const fin = resto.search(/\n(export |async function |function |const |type )/);
  return fin > 0 ? resto.slice(0, fin) : resto;
}

/** Cada llamada a la IA del cuerpo, con su objeto de opciones. */
function llamadas(b: string): string[] {
  const out: string[] = [];
  for (const m of b.matchAll(/\b(chatCheapCascade\(\{|chatClaude\(|leerDocumentoIA\(\{)/g)) {
    const fin = b.indexOf('});', m.index);
    out.push(b.slice(m.index, fin > 0 ? fin : m.index + 1500));
  }
  return out;
}

/** Afirma que la función llama a la IA al menos una vez, y siempre con la red. */
function conRed(archivo: string, nombre: string): void {
  const ls = llamadas(cuerpo(archivo, nombre));
  assert.ok(ls.length >= 1, `${archivo} → ${nombre}: no encuentro ninguna llamada a la IA (el test quedó mirando nada)`);
  ls.forEach((l, i) => assert.match(l, /redDePlataforma: true/,
    `${archivo} → ${nombre}, llamada ${i + 1}: sin redDePlataforma, un cliente nuevo sin API ve «conecta tu IA»`));
}

test('Offer: sin IA propia no corta antes de la red, y lee los documentos con red', () => {
  // Offer tiene su propia red (un bucle sobre provsGratisDePlataforma en `pedir`). Lo que la dejaba
  // sin probar era un corte ANTES: «sin ninguna IA conectada → "conecta una"».
  const src = sinComentarios(leer('lib/offer-ia.ts'));
  const ini = src.indexOf('async function pedir<T>(');
  assert.ok(ini > 0, 'no encuentro pedir en lib/offer-ia.ts');
  const b = src.slice(ini, src.indexOf('\n}\n', ini));
  const red = b.indexOf('provsGratisDePlataforma()');
  const primerFallo = b.indexOf('return { ok: false');
  assert.ok(red > 0, 'pedir ya no prueba la red de la plataforma');
  assert.ok(primerFallo > red, 'pedir devuelve un error ANTES de probar la red: un cliente sin API ve «conecta tu IA»');
  assert.doesNotMatch(b, /docsIADisponible\(/, 'volvió el corte por «no tiene IA propia» antes de la red');
  // Los documentos que se suben a Offer: la lectura por visión con la red.
  assert.match(sinComentarios(leer('app/api/offer/route.ts')), /archivoATexto\(file, \{ feature: 'offer'[^\n]*redDePlataforma: true \}\)/);
  const lector = sinComentarios(leer('lib/archivo-a-texto.ts'));
  assert.equal((lector.match(/leerDocumentoIA\(\{[^\n]*redDePlataforma: opts\.redDePlataforma/g) || []).length, 2,
    'las dos lecturas por visión (PDF escaneado e imagen) tienen que pasar la red que pide el que llama');
});

test('Análisis del lead: con red, pero NUNCA por las keys gratis (son datos de los clientes del cliente)', () => {
  // Regla del 16/10/2026: los datos de los clientes de un cliente nunca van a un proveedor que entrena con
  // lo que recibe. El plan gratis de Gemini entrena; el crédito de Claude de la plataforma no.
  conRed('lib/lead-insights.ts', 'generarInsightLead');
  const catalogo = leer('lib/model-catalogo.ts');
  assert.match(catalogo, /feature: 'lead_insights'[^\n]*pii: true/, 'el análisis del lead tiene que estar marcado como datos de clientes');
  // En la cascada: el crédito, después el corte por datos de clientes, y recién después las keys gratis.
  const src = sinComentarios(leer('lib/ai-cheap.ts'));
  const red = src.indexOf('if (opts.redDePlataforma) {');
  const credito = src.indexOf('conCreditoDeLaPlataforma(', red);
  const corte = src.indexOf('if (conPII) {', red);
  const gratis = src.indexOf('provsGratisDePlataforma()', red);
  assert.ok(red > 0 && credito > red && corte > credito && gratis > corte,
    'el corte por datos de clientes tiene que ir DESPUÉS del crédito de Claude y ANTES de las keys gratis');
  assert.match(src.slice(corte, gratis), /return '';/, 'el corte tiene que terminar ahí, no seguir a las keys gratis');
  assert.match(src, /const conPII = opts\.pii \?\? CATALOGO_MODELOS\.some\(\(f\) => f\.feature === opts\.feature && f\.pii === true\);/);
  // Y como el crédito NO está habilitado para el análisis del lead («Por ahora solo en onboarding»), sin una
  // key propia no hay análisis: el mensaje dice qué conectar, no «Claude vetado».
  const lead = sinComentarios(leer('lib/lead-insights.ts'));
  assert.match(lead, /if \(!\(await tieneIAPropia\(\)\)\) \{\s*return \{ ok: false, motivo: 'Conecta tu Claude/, 'sin IA propia, el análisis del lead no dice qué conectar');
});

test('Second Brain: buscar por significado', () => {
  // La ruta exporta POST, no una función con nombre: se mira su única llamada.
  const ls = llamadas(sinComentarios(leer('app/api/second-brain/buscar/route.ts')));
  assert.equal(ls.length, 1, 'la búsqueda hace UNA llamada a la IA');
  assert.match(ls[0], /redDePlataforma: true/, 'la búsqueda del Second Brain sin red: un cliente sin API ve el error de «no hay IA»');
});

test('Crear una automatización: la pasada, la reparación, y la pregunta previa de la API de MaKo', () => {
  const src = sinComentarios(leer('lib/flujo-ia-crear.ts'));
  // `pasada` y la copia del JSON roto (en `generar`): las dos llamadas a la cascada.
  const pasada = src.slice(src.indexOf('async function pasada<'), src.indexOf('\n}\n', src.indexOf('async function pasada<')));
  const ls = llamadas(pasada);
  assert.equal(ls.length, 1, 'pasada hace UNA llamada a la cascada');
  assert.match(ls[0], /redDePlataforma: true/);
  conRed('lib/flujo-ia-crear.ts', 'generar');
  // La pregunta que hace la API de MaKo ANTES de proponer tiene que contar la red: si sólo mira las keys del
  // negocio, MaKo le contesta «conecta tu IA» por WhatsApp a un cliente que la pantalla atiende sin problema.
  const ini = src.indexOf('export async function hayIAParaCrear(');
  assert.ok(ini > 0, 'no encuentro hayIAParaCrear');
  assert.match(src.slice(ini, src.indexOf('\n}\n', ini)), /provsGratisDePlataforma\(\)/, 'hayIAParaCrear no cuenta la red de la plataforma');
  // Y la ruta de la pantalla no corta antes.
  assert.doesNotMatch(sinComentarios(leer('app/api/chat-agent/secuencias/ia/route.ts')), /if \(!\(await (hayIAParaCrear|docsIADisponible|cheapDisponible)\(\)/);
});

test('Crear una landing: el esquema, las secciones y la reparación del JSON', () => {
  conRed('lib/editor-landing/ia.ts', 'esquema');
  conRed('lib/editor-landing/ia.ts', 'secciones');
  // El reparador no es una función exportada: se mira su única llamada.
  const src = sinComentarios(leer('lib/editor-landing/ia.ts'));
  const ini = src.indexOf('function reparador(');
  assert.ok(ini > 0, 'no encuentro el reparador de JSON');
  const ls = llamadas(src.slice(ini, src.indexOf('\n}\n', ini)));
  assert.equal(ls.length, 1, 'el reparador hace UNA llamada');
  assert.match(ls[0], /redDePlataforma: true/, 'el reparador sin red tira lo que la red ya escribió');
});

// ── La segunda tanda (16/10/2026, orden de Cerebro): sin datos de clientes, red gratis ─────────────

test('El diagnóstico de una landing: la red llega hasta la IA, y nada la corta antes', () => {
  // Ya la tenía desde el 15/10 (`comoAnalizar`); este test la fija entera, de la ruta a la llamada.
  const diag = sinComentarios(leer('lib/editor-landing/diagnostico-server.ts'));
  assert.match(diag, /const comoAnalizar = \(\) => \(\{ redDePlataforma: true,/);
  assert.match(diag, /analizarLanding\([^)]*\.\.\.comoAnalizar\(\)/, 'el diagnóstico no le pasa la red al análisis');
  const analista = sinComentarios(leer('lib/landing-analyst.ts'));
  const ini = analista.indexOf('chatClaude(system, [{ role: \'user\', content: await buildUserPrompt(pagina, comp) }]');
  assert.ok(ini > 0, 'no encuentro la llamada del análisis');
  assert.match(analista.slice(ini, analista.indexOf('});', ini)), /redDePlataforma: opts\.redDePlataforma/, 'el análisis no le pasa la red a chatClaude');
  for (const f of ['lib/editor-landing/diagnostico-server.ts', 'app/api/landing-generator/diagnostico/route.ts', 'lib/landing-analyst.ts']) {
    assert.doesNotMatch(sinComentarios(leer(f)), /if \(!\(await (docsIADisponible|cheapDisponible)\(\)/, `${f} corta antes de la red`);
  }
});

test('Importar un archivo para armar la landing: la lectura por visión con red', () => {
  assert.match(sinComentarios(leer('app/api/landing-generator/importar/route.ts')), /archivoATexto\(file, \{ redDePlataforma: true \}\)/);
});

test('Carruseles, reels y stories: la pieza con red', () => {
  conRed('lib/ig-writer.ts', 'generarPieza');
});

test('Planificar el anuncio en video: el plan y la reparación de su JSON', () => {
  conRed('lib/video-planner.ts', 'generarPlan');
  const src = sinComentarios(leer('lib/video-planner.ts'));
  const ini = src.indexOf('async function objetoDelPlan(');
  assert.ok(ini > 0, 'no encuentro la reparación del plan');
  const ls = llamadas(src.slice(ini, src.indexOf('\n}\n', ini)));
  assert.equal(ls.length, 1, 'la reparación hace UNA llamada');
  assert.match(ls[0], /redDePlataforma: true/, 'la reparación sin red tira el plan que la red ya escribió');
});

test('Ads Writer: motivaciones, sugerir y generar guiones, y valorarlos', () => {
  conRed('lib/razones.ts', 'generarRazones');
  conRed('lib/razones.ts', 'sugerirGuion');
  conRed('lib/razones.ts', 'generarGuion');
  conRed('lib/ads-analyst.ts', 'valorarGuion');
});
