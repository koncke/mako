// =============================================================================
// El Closing cuando el Claude DEL NEGOCIO no puede (sin crédito, clave borrada, sin permiso) — 26/10/2026
// =============================================================================
// Pedido del Cerebro (docs/hallazgos-closing.md): en el ws11 había 168 análisis de llamadas en error (165 hasta el 08/10,
// 3 más hasta el 19/10) porque su clave de Claude se quedó sin crédito, y nadie se enteró en tres semanas. Lo que fija:
//   1. QUÉ es de su cuenta: sin crédito, clave inválida, sin permiso. Un 429, un 5xx, un timeout o la pausa de MaKo, NO.
//   2. El incidente: UNO por caída (conserva su `desde` y su aviso); se avisa una sola vez.
//   3. El cableado: lo de su cuenta NO deja fila en error, corta la vuelta y avisa; cuando vuelve a analizar, se cierra.
//   4. El aviso: un evento de la plataforma con su texto literal por motivo, que nace PRENDIDO.
// Probado rompiéndolo (26/10/2026): ver el pie.
// Correr: node --import tsx --test tests/closing-ia-caida.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conFallo, datosIaCaida, falloDeSuCuenta, leerIaCaida, queHacerConSuIa, tocaAvisar } from '../lib/closing-ia-caida-reglas';
import { EVENTOS_MAKO } from '../lib/disparadores';
import { AVISOS_SOLO_SUPERADMIN, CATALOGO_AVISOS } from '../lib/avisos-catalogo';

const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const bloque = (src: string, desde: string, hasta: string) => src.slice(src.indexOf(desde), src.indexOf(hasta, src.indexOf(desde)));

test('qué es de SU cuenta: sin crédito, clave inválida, sin permiso — y nada más', () => {
  // El texto que guarda `analyzeMeeting` (lib/closing.ts) con lo que contesta Anthropic.
  const de = (e: string) => `Tu clave de Claude no pudo analizar la llamada: ${e}`;
  assert.equal(falloDeSuCuenta(de('Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.')), 'sin crédito');
  assert.equal(falloDeSuCuenta(de('invalid x-api-key')), 'clave inválida');
  assert.equal(falloDeSuCuenta(de('permission_error: Your API key does not have permission to use the specified resource.')), 'sin permiso');
  // Lo que se arregla solo, o que es de MaKo: NO es de su cuenta (no se le avisa ni se corta por eso).
  for (const e of ['Overloaded', 'Anthropic 529', 'Anthropic 429 rate_limit_error', 'The operation was aborted due to timeout', 'fetch failed',
    'Tu Claude está conectado, pero MaKo lo tiene en pausa por un rato: no lo estoy usando. Vuelve a intentar más tarde.',
    'No pude comprobar tu clave de Claude. Se reintenta en la próxima corrida.', 'Claude contestó vacío']) {
    assert.equal(falloDeSuCuenta(de(e)), null, e);
  }
  assert.equal(falloDeSuCuenta(''), null);
  assert.match(queHacerConSuIa('sin crédito'), /crédito/);
  assert.match(queHacerConSuIa('clave inválida'), /clave nueva/);
});

test('UN incidente por caída: conserva su «desde» y su aviso; se avisa una sola vez', () => {
  const primera = conFallo(null, 'sin crédito', '2026-10-08T10:00:00.000Z');
  assert.deepEqual(primera, { motivo: 'sin crédito', desde: '2026-10-08T10:00:00.000Z', avisadoAt: null });
  assert.equal(tocaAvisar(primera), true);
  const avisada = { ...primera, avisadoAt: '2026-10-08T10:00:05.000Z' };
  const segunda = conFallo(avisada, 'clave inválida', '2026-10-19T10:00:00.000Z');
  assert.equal(segunda.desde, '2026-10-08T10:00:00.000Z', 'una llamada más que falla no reinicia el incidente');
  assert.equal(segunda.motivo, 'clave inválida', 'el motivo sí se actualiza');
  assert.equal(tocaAvisar(segunda), false, 'ya se avisó: no se avisa por cada llamada');
  assert.deepEqual(leerIaCaida(JSON.stringify(segunda)), segunda);
  assert.equal(leerIaCaida(''), null);
  assert.equal(leerIaCaida('{roto'), null);
  assert.equal(leerIaCaida(JSON.stringify({ motivo: 'otro', desde: '2026-10-08' })), null);
  assert.deepEqual(datosIaCaida({ motivo: 'sin crédito', desdeDia: '8 de octubre', pendientes: 1, link: 'L' }),
    { ia_caida_motivo: 'sin crédito', ia_caida_desde: '8 de octubre', ia_caida_pendientes: '1 llamada', ia_caida_link: 'L' });
  assert.equal(datosIaCaida({ motivo: 'sin crédito', desdeDia: 'x', pendientes: 12, link: 'L' }).ia_caida_pendientes, '12 llamadas');
});

test('el cableado: lo de su cuenta NO deja fila en error, corta la vuelta y avisa; cuando vuelve, se cierra', () => {
  const C = sinComentarios(leer('../lib/closing.ts'));
  // processCandidate: el «return» de su cuenta va ANTES del upsert de la fila en error.
  const pc = bloque(C, 'export async function processCandidate(', '\n}\n');
  const iCuenta = pc.indexOf('if (suCuenta) return { status: \'error\', category: \'sin_clasificar\', suCuenta };');
  assert.ok(iCuenta > 0, 'processCandidate ya no distingue lo de su cuenta');
  assert.ok(iCuenta < pc.indexOf("status: 'error', error: res.error"), 'la fila en error se escribe ANTES de mirar si es de su cuenta');
  // syncClosingCalls: corta, anota (y avisa) y no sigue con las demás.
  const sync = bloque(C, 'export async function syncClosingCalls(', '\n}\n');
  assert.match(sync, /if \(suCuenta\) \{[\s\S]{0,400}await anotarIaCaida\(ws, suCuenta, [\s\S]{0,200}result\.corto_por = 'ia_del_negocio';[\s\S]{0,80}break;/);
  assert.match(sync, /if \(status !== 'error' && caida\) \{ await anotarQueVolvio\(\); caida = null; \}/);
  // El análisis por lead (el botón y el drenaje de insights): lo mismo, y el error que ve la persona es el paso a seguir.
  const porLead = bloque(C, 'export async function analizarLlamadasDeLead(', '\n}\n');
  // (Revisión del tren m: sólo si el error vino de SU clave, `deSuClave` — tests/grabadores-revision-tren-m.test.ts → 10.)
  assert.match(porLead, /else if \(res\.deSuClave && falloDeSuCuenta\(res\.error\)\) \{[\s\S]{0,700}await anotarIaCaida\([\s\S]{0,200}ultimoError = queHacerConSuIa\(suCuenta\);\s*break;/);
  // El aviso sale sólo si este incidente no se avisó, y queda «avisado» sólo si había una fila que lo mande.
  const A = sinComentarios(leer('../lib/closing-ia-caida.ts'));
  assert.match(A, /if \(tocaAvisar\(marca\)\) \{[\s\S]{0,600}emitirEventoDePlataforma\('closing-ia-caida'/);
  assert.match(A, /avisado = r\.filas > 0;\s*if \(avisado\) marca\.avisadoAt = /);
  // Con su Claude caído, el cron no gasta el drenaje de insights (la prueba la hace el sync, con UNA llamada).
  assert.match(sinComentarios(leer('../app/api/cron/closing-sync/route.ts')), /const insights = caida \? null : await drenarInsightsDeLlamada/);
  // Y la API del Closing lo dice primero.
  assert.match(sinComentarios(leer('../lib/api-mako/areas/closing.run.ts')), /\.\.\.\(caida \? \{ ia_del_negocio: \{ problema: caida\.motivo/);
});

test('el aviso: un evento de la plataforma, con un texto literal por motivo, que nace PRENDIDO', () => {
  const ev = EVENTOS_MAKO.find((e) => e.subtipo === 'closing_ia_caida');
  assert.ok(ev, 'falta el evento');
  assert.equal(ev.aviso, 'closing-ia-caida');
  assert.equal(ev.plataforma, true);
  assert.deepEqual([...ev.trae], ['iacaida']);
  assert.ok(AVISOS_SOLO_SUPERADMIN.includes('closing-ia-caida'));
  assert.equal(CATALOGO_AVISOS.find((a) => a.id === 'closing-ia-caida')?.porDefecto, 'on', 'sin «on» la mudanza crea su fila PAUSADA y no le avisa a nadie');
  const P = leer('../lib/plantillas-automatizaciones.ts');
  const p = P.slice(P.indexOf("id: 'mako-closing-ia-caida'"), P.indexOf('\n  },\n', P.indexOf("id: 'mako-closing-ia-caida'")));
  assert.match(p, /cron: \{ fijo: TRIGGER_AVISO_MAKO, evento: 'closing_ia_caida' \},/);
  for (const m of ['sin crédito', 'clave inválida']) assert.ok(p.includes(`{ campo: 'dato:ia_caida_motivo', valor: '${m}' }`), `la CONDITION no pregunta «${m}»`);
  for (const id of ['ic_credito_mk', 'ic_clave_mk', 'ic_permiso_mk']) assert.ok(p.includes(`mako('${id}',`), `falta el texto de ${id}`);
  for (const v of ['ia_caida_desde', 'ia_caida_pendientes', 'ia_caida_link']) assert.ok(p.includes(`{{${v}}}`), `la plantilla no usa {{${v}}}`);
  assert.match(leer('../scripts/mudanza-avisos-plataforma.mts'), /\{ plantilla: 'mako-closing-ia-caida', evento: 'closing_ia_caida' \},/);
});

// Probado rompiéndolo (26/10/2026), cada rotura sola y restaurada después — 4/0 de nuevo al final:
//   · la fila en error ANTES de mirar si es de su cuenta (processCandidate) ............... 1 fallo
//   · el sync sigue con las demás (`continue` en vez de `break`) ........................... 1 fallo
//   · el sync no cierra el incidente cuando vuelve a analizar ............................... 1 fallo
//   · el análisis por lead no corta ........................................................ 1 fallo
//   · cada fallo reinicia el incidente (= un aviso por llamada) ............................ 1 fallo
//   · INVERTIDA: `tocaAvisar` al revés ..................................................... 1 fallo
//   · todo error de Claude cuenta como de su cuenta (un 429 avisaría al dueño) ............. 1 fallo
//   · INVERTIDA: la condición de «es de su cuenta» al revés ................................. 1 fallo
//   · «avisado» aunque la plataforma no tenga la fila que lo mande ......................... 1 fallo
//   · el aviso nace apagado (`porDefecto: 'off'`) .......................................... 1 fallo
//   · el cron drena insights con su Claude caído ........................................... 1 fallo
