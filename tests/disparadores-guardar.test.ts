// =============================================================================
// Guardar los CRON (lib/disparadores-guardar.ts + la ruta): el cableado
// =============================================================================
// Sexta tanda del Chatbot (09/10/2026), CRON punto 10. Lo que decide qué se escribe es puro y lo
// prueba tests/disparadores.test.ts EJECUTÁNDOLO (`columnasDeDisparador`, `conProximas`,
// `nuevosOCambiados`, `problemaDeDisparadores`); esto fija que el módulo con `server-only` —que bajo
// tsx no carga— lo USE, y que la ruta lo exponga con su 400. Se lee el fuente sin comentarios.
//
// PROBADO ROMPIÉNDOLO (09/10/2026), contra una base de 4 pass / 0 fail, una rotura por vez y
// restaurando de memoria:
//   · el update de la lista sin `.eq('disparadores_rev', fila.rev)` (sin compare-and-set)   → 3 / 1
//   · sin la 0241 guardando igual los N (sólo el primero, en silencio)                       → 3 / 1
//   · la ruta sin el 400 de `TriggerInvalidoError` en 'disparadores'                         → 3 / 1
//   · validando la lista entera en vez de lo nuevo o distinto                                → 3 / 1
// Restaurado: 4 / 0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const G = sinComentarios(leer('lib/disparadores-guardar.ts'));
const RUTA = sinComentarios(leer('app/api/chat-agent/secuencias/route.ts'));

test('la lista se escribe con compare-and-set por la revisión, y el primero va a las columnas', () => {
  assert.match(G, /\.update\(\{ \.\.\.cols, disparadores: conProxima, disparadores_rev: fila\.rev \+ 1 \}\)\n\s*\.eq\('id', secuenciaId\)\.eq\('disparadores_rev', fila\.rev\)/);
  assert.match(G, /const cols = \{ \.\.\.columnasDeDisparador\(primero\), cron_proxima_at: primero\.cron \? primero\.cron_proxima_at : null,/);
  assert.match(G, /const conProxima = conProximas\(lista, previos, ahora, tz\);/, 'el horario que no cambió pierde su ocurrencia');
  assert.match(G, /for \(let intento = 0; intento < 3; intento\+\+\) \{/);
});

test('⚠️ sin la 0241: UNO se guarda en las columnas; dos o más, 400 (nunca «sólo el primero» en silencio)', () => {
  assert.match(G, /if \(fila\.rev == null\) \{\n\s*if \(conProxima\.length > 1\) throw new TriggerInvalidoError\('Aún no se pueden varios CRON\.'\);/);
  // Y la lectura tolera SÓLO la columna que falta.
  assert.match(G, /if \(!esColumnaInexistente\(con\.error\)\) throw new Error/);
});

test('se valida contra el negocio lo NUEVO o distinto, una vez', () => {
  assert.match(G, /if \(intento === 0\) await validarContraElNegocio\(nuevosOCambiados\(lista, previos\)\);/);
  // Lo que se valida: la etapa en su producto, la entrega en el suyo, la etiqueta viva, y el resto contra el catálogo.
  const v = G.slice(G.indexOf('async function validarContraElNegocio('), G.indexOf('export async function guardarDisparadores('));
  assert.match(v, /if \(et\.archivada_at\) throw new TriggerInvalidoError/);
  assert.match(v, /!TRIGGERS_NUEVOS\.includes\(t\) && !TRIGGERS\.some\(\(x\) => x\.value === t\)/);
  // La lista que llega se sanea y se rechaza ENTERA si algo no se entiende o le falta algo.
  assert.match(G, /if \(lista\.length !== entrada\.length\) throw new TriggerInvalidoError\('Hay un CRON que no se entiende\.'\);/);
  assert.match(G, /const problema = problemaDeDisparadores\(lista\);\n\s*if \(problema\) throw new TriggerInvalidoError\(problema\);/);
});

test('la ruta: «disparadores» con su 400, y los canales por GET aparte', () => {
  assert.match(RUTA, /if \(body\.action === 'disparadores'\) \{[\s\S]{0,300}return Response\.json\(\{ ok: true, disparadores: await guardarDisparadores\(id, body\.disparadores\) \}\);\n\s*\} catch \(e\) \{\n\s*if \(e instanceof TriggerInvalidoError\) return Response\.json\(\{ ok: false, error: e\.message \}, \{ status: 400 \}\);/);
  assert.match(RUTA, /if \(req\.nextUrl\?\.searchParams\.get\('canales'\) === '1'\) \{[\s\S]{0,120}estadoCanalesDisparo\(\)/);
  // El GET de los canales va DESPUÉS de los guards de sesión.
  assert.ok(RUTA.indexOf("searchParams.get('canales')") > RUTA.indexOf("'Sin acceso a Setting en este workspace.'"));
});
