// =============================================================================
// El histórico de leads de Meta: UNA puerta, y el gate del onboarding la usa
// =============================================================================
// Tarea #171. Había DOS cosas homónimas: la setting `meta_page_id` (minúscula) y
// la credencial `META_PAGE_ID` (mayúscula, cifrada, la que ofrece /integraciones
// y la que MaKo completa sola al pegar el token). `pollMetaLeads` ya leía la
// credencial; el gate del onboarding (`jobAplica`) seguía leyendo la setting, que
// NADIE escribe. Resultado medido: el job `meta_leads` quedaba `skipped` con
// «Falta token de página o ID de página» en un workspace donde la ingesta andaba
// perfecto — el histórico no llegaba nunca, sin un error y con el paso del wizard
// en verde. Es la causa raíz del «desierto» del cliente nuevo.
//
// Lo que este guard fija no es el arreglo: es que la pregunta se conteste en UN
// lugar. Dos lectores de la misma pregunta se separan; uno solo no puede.
//
// Correr: npx tsx --test tests/onboarding-leads-una-puerta.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (13/10/2026), con la base en 0 fallos / 5 pases:
//   - devolver la setting vieja al gate                        → 3 pases / 2 fallos
//   - que el gate lea `credWs('META_PAGE_ID')` por su cuenta   → 4 / 1
//   - sacarle el `?? (ws === OWNER_WS …)` a la puerta           → 4 / 1
//   - que el fallback al literal valga para cualquier ws        → 4 / 1
//   - resolver el page id de nuevo dentro de pollMetaLeads      → 4 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// El clon de Windows tiene archivos en CRLF: sin esto, un patrón con \n no calza
// y el guard pasa en verde leyendo nada.
const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

// Un `doesNotMatch` sobre el archivo entero se acusa a sí mismo: la convención de
// la casa es explicar en el comentario lo que se sacó, nombrándolo.
const sinComentarios = (src: string) =>
  src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/^[ \t]*\*.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const EXTRACT = leer('lib/onboarding-extract.ts');
const LEADS = leer('lib/meta-leads.ts');

/** El bloque de un `case` del gate, hasta el `case` siguiente. */
function bloqueDelCase(src: string, key: string): string {
  const ini = src.indexOf(`case '${key}':`);
  assert.ok(ini > 0, `no existe el case '${key}' en jobAplica`);
  const sig = src.indexOf("case '", ini + 10);
  const fin = sig > 0 ? sig : src.indexOf('\n}', ini);
  const b = src.slice(ini, fin);
  // Si mañana mide diez veces esto, está mirando otra cosa.
  assert.ok(b.length < 2000, 'el bloque del case salió enorme: el recorte está mal');
  return b;
}

/** El cuerpo de una función exportada, hasta el próximo `export`. */
function bloqueDeFuncion(src: string, nombre: string): string {
  const ini = src.indexOf(`export async function ${nombre}`);
  assert.ok(ini > 0, `no existe ${nombre}`);
  const sig = src.indexOf('\nexport ', ini + 10);
  return src.slice(ini, sig > 0 ? sig : src.length);
}

test('el gate del onboarding decide con la MISMA puerta que el ingestor', () => {
  const caso = sinComentarios(bloqueDelCase(EXTRACT, 'meta_leads'));

  assert.match(caso, /credencialesDeLeads\(\)/, 'el gate no pregunta por la puerta compartida');
  // El motivo que ve el cliente sale de la puerta, no de una frase de acá: con
  // una frase propia, el paso del wizard y el error del cron dicen cosas distintas.
  assert.match(caso, /cred\.ok \? \{ aplica: true \} : \{ aplica: false, motivo: cred\.motivo \}/);

  // Y no resuelve NADA por su cuenta: ni la setting vieja ni la credencial.
  assert.doesNotMatch(caso, /meta_page_id/, 'volvió la setting que nadie escribe');
  assert.doesNotMatch(caso, /META_PAGE_ID|META_PAGE_ACCESS_TOKEN/, 'el gate volvió a leer credenciales por su cuenta');
});

test('en todo el motor de extracción no quedó un lector de la setting vieja', () => {
  assert.doesNotMatch(sinComentarios(EXTRACT), /getSetting\('meta_page_id'\)/);
  // …y el VSL lee sus videos con `configWs` (el setting y, si no está, la credencial que guarda
  // /integraciones), el mismo lector de los crons. Hasta el 16/10/2026 acá se exigía `getSetting`,
  // «que para ELLOS es lo correcto»: no lo era, el único escritor de ese setting es la acción 'config'
  // de /api/onboarding, que no llama nadie (tests/historico-al-conectar.test.ts). Esta prueba sigue
  // cayendo si el arreglo se llevó puesto el import de al lado.
  assert.match(EXTRACT, /configWs\('youtube_vsl_video_id'\)/);
  assert.match(EXTRACT, /import \{ pollMetaLeads, credencialesDeLeads \} from '\.\/meta-leads'/);
});

test('la puerta lee la CREDENCIAL, y el literal del dueño no se le presta a un cliente', () => {
  const puerta = sinComentarios(bloqueDeFuncion(LEADS, 'credencialesDeLeads'));

  assert.match(puerta, /credWs\('META_PAGE_ID'\)/, 'la fuente de verdad es la credencial del catálogo');
  // Fail-closed: sin credencial, un cliente NO cae a la página del dueño. Esto es
  // lo que separa «no ingiere» de «ingiere los leads de otro».
  assert.match(puerta, /\?\? \(ws === OWNER_WS \|\| ws == null \? META_PAGE_ID : null\)/);
  assert.match(puerta, /if \(!pageId\) \{/, 'sin page id la puerta tiene que cerrarse');

  // Un token a medio acuñar no es un token: `PENDING…` lo escribe la propia
  // conexión de Meta mientras resuelve, y pasarlo deja al cron pidiendo leads con
  // una credencial que no existe.
  assert.match(puerta, /token\.startsWith\('PENDING'\)/);
});

test('el page id se resuelve UNA vez en el archivo: pollMetaLeads no lo repite', () => {
  const poll = sinComentarios(bloqueDeFuncion(LEADS, 'pollMetaLeads'));

  assert.match(poll, /const cred = await credencialesDeLeads\(\);/);
  assert.match(poll, /if \(!cred\.ok\) throw new Error\(cred\.motivo\);/);
  assert.doesNotMatch(poll, /credWs\(/, 'pollMetaLeads volvió a resolver credenciales por su cuenta');

  const veces = (sinComentarios(LEADS).match(/credWs\('META_PAGE_ID'\)/g) || []).length;
  assert.equal(veces, 1, 'hay más de un lector del page id: se van a separar otra vez');
});

test('la puerta devuelve un motivo LEGIBLE, no un código', () => {
  const puerta = bloqueDeFuncion(LEADS, 'credencialesDeLeads');
  // El motivo viaja al paso del wizard y al log del cron, así que nombra la
  // pantalla donde se arregla.
  assert.match(puerta, /Integraciones → Meta Ads/);
});
