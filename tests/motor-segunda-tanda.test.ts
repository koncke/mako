// =============================================================================
// El motor en la segunda tanda: «Si responde» retoma UN hilo, el reuso vuelve a cero, Activar
// valida lo mismo que Publicar, y la fecha del aviso «no confirmó» va en la zona del negocio
// =============================================================================
// Pasos 5 a 8 de la parte M (docs/chatbot-flujo-ramas-diseno.md → «El contrato del motor»).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { textoFechaReunion } from '../lib/nutricion-grafo-motor';
import { camposDeReactivacion } from '../lib/nutricion-reinscripcion';

const raiz = join(__dirname, '..');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (r: string): string => sinComentarios(readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n'));
const NUTRI = leer('lib/nutricion.ts');
const DESENLACE = leer('lib/nutricion-desenlace.ts');
const cuerpo = (src: string, abre: string, cierra: string): string => {
  const i = src.indexOf(abre);
  assert.ok(i >= 0, `no encontré «${abre}»`);
  const f = src.indexOf(cierra, i + abre.length);
  assert.ok(f > i, `no encontré el cierre de «${abre}»`);
  return src.slice(i, f);
};

// ── 5. «Si responde» ────────────────────────────────────────────────────────

test('«Si responde» → «Ir a {tarjeta}» retoma UN hilo y descarta los congelados; la pausa no cambia', () => {
  // Probado rompiéndolo (08/10/2026): sin el `hilos: null` del retomar → 5 pasan / 1 falla (éste).
  const grafo = cuerpo(NUTRI, 'async function responderConGrafo(', '\nasync function mandarMensajeDeRespuesta(');
  assert.match(grafo, /\.update\(\{ estado: 'activa', paso_actual: j, nodo_actual: d\.nodo, proximo_envio_at: ahoraISO\(\), hilos: null, updated_at: ahoraISO\(\) \}\)/);
  // La pausa congela todos los hilos en su lugar: no los toca (decisión 4).
  const pausa = cuerpo(NUTRI, 'export async function pausarPorRespuesta(', '\nasync function charlaDelLead(');
  assert.doesNotMatch(pausa.slice(0, pausa.indexOf("estado: 'respondio'") + 200), /hilos/, 'pausar no descarta los hilos: los congela');
});

// ── 6. El reuso y la primera programación ───────────────────────────────────

test('el reuso vuelve los hilos a NULL: la reusada es una fila nueva y se reparte otra vez', () => {
  // Probado rompiéndolo (08/10/2026): sin `hilos: null` en `camposDeReactivacion` → 5 pasan / 1 falla.
  const c = camposDeReactivacion({ proximoEnvioAt: '2026-10-08T10:00:00Z', reunionAt: null, ahora: '2026-10-08T09:00:00Z' });
  assert.equal(c.hilos, null);
  assert.equal(c.nodo_actual, null);
  assert.equal(c.paso_actual, 0);
});

test('los lugares que inscriben programan el primer envío con el MÍNIMO entre las raíces', () => {
  // Probado rompiéndolo (08/10/2026): devolviendo una de las tres a `proximoEnvioDePaso(pasoDeEntrada(…))`
  // (lo de antes) → 5 pasan / 1 falla (éste).
  assert.doesNotMatch(NUTRI, /proximoEnvioDePaso\(pasoDeEntrada\(/, 'un lugar que inscribe sigue mirando sólo la raíz principal');
  assert.doesNotMatch(NUTRI, /proximoEnvioDePaso\(entrada, juntas/, 'el cohorte sigue mirando sólo la raíz principal');
  assert.equal((NUTRI.match(/proximoDeEntrada\(/g) ?? []).length, 3, 'el cohorte, el evento y la manual');
  // Y `encadenar`, el quinto (lib/nutricion-desenlace.ts).
  const enc = cuerpo(DESENLACE, 'async function encadenar(', '\n  for (const insc of inscs)');
  assert.match(enc, /const primero = proximoDeEntrada\(pasos, /);
  assert.match(enc, /proximo_envio_at: primero,/);
});

// ── 7. Activar valida lo mismo que Publicar ─────────────────────────────────

test('⚠️ Activar valida lo guardado con las MISMAS reglas que Publicar, sin escribir, y rechaza en palabras', () => {
  // Probado rompiéndolo (08/10/2026): sin la llamada de validación en `setSecuenciaActiva` → 5 pasan /
  // 1 falla (éste).
  const act = cuerpo(NUTRI, 'export async function setSecuenciaActiva(', '\nexport async function setSecuenciaLinea(');
  assert.match(act, /if \(activa\) \{/, 'apagar no valida; prender sí');
  assert.match(act, /await setSecuenciaPasos\(id, Array\.isArray\(guardados\) \? \(guardados as PasoSecuencia\[\]\) : \[\], \{ soloValidar: true \}\);/);
  assert.ok(act.indexOf('soloValidar: true') < act.indexOf(".update({ activa"), 'valida ANTES de prender');
  assert.match(act, /throw new PasosInvalidosError\(e\.message\.replace\(\/\^No se guardó:\/, 'No se activó:'\)\)/, 'el rechazo dice que no se ACTIVÓ');
  const pasos = cuerpo(NUTRI, 'export async function setSecuenciaPasos(', '\nasync function filasCohorte<T>(');
  const corte = pasos.indexOf('if (o?.soloValidar) return;');
  assert.ok(corte > pasos.indexOf('const errores = validarGrafo(grafo);'), 'el corte va DESPUÉS de todas las validaciones (incluido validarGrafo)');
  assert.ok(corte < pasos.indexOf(".update({ pasos: grafo"), 'el corte va ANTES de escribir');
});

// ── 8. La fecha del aviso «no confirmó» ─────────────────────────────────────

test('la fecha del aviso va en la zona del NEGOCIO, no en la del servidor (lo medido en el grupo de Mauricio)', () => {
  // Probado rompiéndolo (08/10/2026): `textoFechaReunion` sin `timeZone` (lo de antes) → 5 pasan /
  // 1 falla (éste: decía «sábado, 10 de octubre, 01:00»).
  // La reunión del viernes 9 a las 18:00 de Tijuana es la 01:00 UTC del sábado 10.
  const lead = { junta_1_at: '2026-10-10T01:00:00Z' };
  assert.equal(textoFechaReunion(lead, 'America/Tijuana'), 'viernes, 9 de octubre, 18:00');
  assert.equal(textoFechaReunion(lead, 'America/Argentina/Buenos_Aires'), 'viernes, 9 de octubre, 22:00');
  assert.equal(textoFechaReunion(lead, 'Marte/Olympus'), 'viernes, 9 de octubre, 19:00', 'una zona rota cae a Ciudad de México');
  // Un día sin hora se dice sin hora, y en ese mismo día.
  assert.equal(textoFechaReunion({ fecha_junta_1: '2026-10-09' }, 'America/Tijuana'), 'viernes, 9 de octubre');
  assert.equal(textoFechaReunion({}, 'America/Tijuana'), '');
});

test('el desenlace lee la zona del negocio UNA vez y la pasa a la fecha del aviso', () => {
  assert.match(DESENLACE, /tzNegocio \?\?= await tzDeWorkspace\(ws\)\.catch\(\(\) => TZ_DEFAULT\);/);
  assert.match(DESENLACE, /const cuando = fechaReunion\(lead, tzNegocio\);/);
  assert.doesNotMatch(DESENLACE, /T12:00:00-06:00/, 'el mediodía de México fijo volvió');
});
