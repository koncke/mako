// =============================================================================
// `probar_secuencia` de la API manda UN escenario, no todos los pasos (14/10/2026)
// =============================================================================
// Relevo de Automations, punto 2: «`probar_secuencia` de la API manda TODOS los pasos: que acepte un escenario». Con
// una condición, el array tiene el «Sí» y el «No» juntos: la prueba le mandaba al dueño los dos caminos, que ningún
// lead recibe. Ahora sale el camino de UN escenario, el MISMO de «Probar» y de `escenarios_secuencia`.
//
// Lo puro se EJECUTA (`mensajesDelEscenario`, `escenariosDeLaSecuencia`); lo `server-only`, sobre el FUENTE sin
// comentarios. PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mensajesDelEscenario, escenariosDeLaSecuencia } from '../lib/simulador-grafo';
import { ID_INICIO, type PasoGrafo } from '../lib/flujo-grafo';
import { porId } from '../lib/api-mako/registro';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const bloque = (src: string, ini: string, fin: string): string => {
  const i = src.indexOf(ini);
  assert.ok(i >= 0, `no encontré «${ini}»`);
  const j = src.indexOf(fin, i + ini.length);
  assert.ok(j > i, `no encontré el cierre «${fin}» después de «${ini}»`);
  return src.slice(i, j);
};

// Un saludo, una condición «Es cliente» con dos ramas, y un mensaje en cada una.
const FLUJO: PasoGrafo[] = [
  { id: 'm0', canal: 'whatsapp', cuerpo: 'Hola', siguiente: 'c1' },
  { id: 'c1', nodo: 'condicion', ramas: [{ id: 'r1', titulo: 'Ya compró', filas: [{ campo: 'cliente', op: 'es', valor: 'si' }], siguiente: 'mSi' }], si_no: 'mNo' } as PasoGrafo,
  { id: 'mSi', canal: 'whatsapp', cuerpo: 'Gracias por tu compra', siguiente: null },
  { id: 'mNo', canal: 'whatsapp', cuerpo: '¿Te cuento cómo funciona?', siguiente: null },
  { id: ID_INICIO, nodo: 'inicio', siguiente: 'm0' },
];

test('cada escenario manda SU camino, y ninguno manda los dos', () => {
  const { pasos, escenarios } = escenariosDeLaSecuencia({ pasos: FLUJO, estrategia: null }, () => null);
  assert.equal(escenarios.length, 2, `escenarios: ${escenarios.map((e) => e.id).join(' / ')}`);
  const caminos = escenarios.map((e) => mensajesDelEscenario(pasos, e.elecciones).map((p) => p.cuerpo));
  for (const c of caminos) {
    assert.equal(c[0], 'Hola');
    assert.equal(c.length, 2, `un escenario manda ${c.length} mensajes: ${c.join(' | ')}`);
  }
  assert.deepEqual(new Set(caminos.map((c) => c[1])), new Set(['Gracias por tu compra', '¿Te cuento cómo funciona?']));
  // Lo que cuenta `escenarios_secuencia` es lo que manda la prueba.
  escenarios.forEach((e, k) => assert.equal(e.mensajes, caminos[k].length));
});

test('una condición que el escenario no eligió corta ahí: no se inventa el camino', () => {
  const { pasos } = escenariosDeLaSecuencia({ pasos: FLUJO, estrategia: null }, () => null);
  assert.deepEqual(mensajesDelEscenario(pasos, {}).map((p) => p.cuerpo), ['Hola']);
  assert.deepEqual(mensajesDelEscenario(pasos, { c1: 'puerto-que-no-existe' }).map((p) => p.cuerpo), ['Hola']);
});

test('la prueba en vivo y la API leen el MISMO escenario', () => {
  const sec = sinComentarios(leer('lib/setting-secuencias.ts'));
  const esc = bloque(sec, 'export async function escenarioDePrueba(', '\n}\n');
  assert.match(esc, /escenariosDeLaSecuencia\(sec, /);
  assert.match(esc, /mensajesDelEscenario\(pasos, elegido\.elecciones\)/);
  const probar = bloque(sec, 'export async function probarSecuencia(', '\n}\n');
  assert.match(probar, /const e = await escenarioDePrueba\(secuenciaId, op\.escenario \?\? null\);/);
  assert.doesNotMatch(probar, /sec\.pasos\.filter\(/, 'volvió a mandar cada mensaje del array');
  assert.match(probar, /const total = mensajes\.length;/);
  assert.doesNotMatch(probar, /paso\.orden/, 'el número de la prueba es la posición en el escenario, no la del array');
  assert.match(probar, /if \(esCanalSocial\(paso\.canal\)\) \{ avisos\.push\(/, 'un paso de Instagram se mandaba como email');
  const run = sinComentarios(leer('lib/api-mako/areas/chatbot.run.ts'));
  const op = bloque(run, '  probar_secuencia: {', '\n  },\n');
  assert.match(op, /if \(pedido == null && e\.total > 1\) \{/, 'con varios escenarios, sin elegir, se probaba el primero sin decirlo');
  assert.match(op, /payload: \{ secuenciaId: id, escenario: e\.numero \}/);
  assert.match(op, /probarSecuencia\(Number\(payload\.secuenciaId\), \{ escenario: Number\(payload\.escenario\) \|\| 1 \}\)/);
  const lista = bloque(run, '  escenarios_secuencia: {', '\n  },\n');
  assert.match(lista, /escenariosDeLaSecuencia\(s, /);
});

test('la definición pide el escenario y dice de dónde sale', () => {
  const d = porId('probar_secuencia');
  assert.ok(d, 'no está probar_secuencia');
  const p = d!.parametros.find((x) => x.nombre === 'escenario');
  assert.ok(p && p.tipo === 'number' && !p.obligatorio, 'el escenario es un número opcional');
  assert.match(d!.descripcion, /UN escenario/);
  assert.match(d!.descripcion, /escenarios_secuencia/);
  assert.doesNotMatch(d!.descripcion, /TODOS los pasos/);
});

// ── ROTURAS (14/10/2026) ────────────────────────────────────────────────────────────────────────
// Con el arnés del scratchpad (rompe UNA, corre este archivo, restaura DE MEMORIA; nunca git). Base: 4 / 0.
//   · la prueba volviendo a mandar cada mensaje del array → 3 / 1 · el escenario eligiendo siempre la primera
//     opción → 2 / 2 · la API probando el primero sin pedir cuál → 3 / 1 · un paso de Instagram probado como
//     email → 3 / 1 · la definición sin el parámetro → 3 / 1.
// Restaurado: 4 / 0.
