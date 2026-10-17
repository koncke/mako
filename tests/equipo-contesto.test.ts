// =============================================================================
// #849: la condición «El equipo no contestó en el grupo» (17/10/2026)
// =============================================================================
// Brigitte: después de un aviso al grupo, esperar y, si nadie del equipo contestó, volver a avisar (o hacer otra cosa).
// La condición `equipo_contesto` (lib/condiciones-catalogo.ts) lee `equipoContestoEnEsta`, que pone el motor sólo si el
// flujo la pregunta (`usaEquipoContesto`): ¿hay una fila `user` en `mako_doer_conv` del grupo de MaKo desde la última
// tarjeta MaKo de ESTA inscripción? Sin aviso todavía o sin grupo, `null`: no se cumple, ni negada. «Probar» la da en false.
//
// PROBADO ROMPIÉNDOLO (17/10/2026, arnés `romper.py` + `roturas-849.json`; base 4 / 0). Pasan / fallan:
//   E1 `evaluar` sin `tri` (un `null` pasa a false y la negada se cumple sin saber)            → 3 / 1
//   E2 `contestoElEquipo` sin descartar el eco del propio aviso                               → 3 / 1
//   E3 el motor sin inyectar el hecho en la corrida (primer sitio)                            → 3 / 1
//   E4 «Si responde» sin el hecho                                                             → 3 / 1
//   E5 el ancla en cualquier envío (sin `.eq('asunto', OP_AVISAR)`)                            → 3 / 1
//
// Correr: node --import tsx --test tests/equipo-contesto.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cumpleFila, normalizar, type HechosLead, type PasoGrafo } from '../lib/flujo-grafo';
import { CONDICIONES } from '../lib/condiciones-catalogo';
import { usaEquipoContesto, contestoElEquipo, CAMPO_EQUIPO_CONTESTO } from '../lib/equipo-contesto';
import { hechosDeLeadNuevo } from '../lib/simulador-grafo';

const leer = (rel: string): string => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const H = (o: Partial<HechosLead> = {}): HechosLead => ({
  etiquetas: new Set(), etapa: null, agendo: false, pago: false, yaContactado: true, respondio: false,
  creadoMs: null, tieneTelefono: true, tieneEmail: false, ahoraMs: Date.parse('2026-10-17T12:00:00Z'), ...o,
});
const NO_CONTESTO = { campo: CAMPO_EQUIPO_CONTESTO, no: true } as const;

test('la condición existe en «Mensajes», se niega, y «no sé» no se cumple ni negada', () => {
  const c = CONDICIONES.find((x) => x.id === CAMPO_EQUIPO_CONTESTO);
  assert.ok(c, 'falta `equipo_contesto` en el catálogo');
  assert.equal(c!.seccion, 'Mensajes');
  assert.equal(c!.ambito, 'ambos');
  assert.deepEqual(c!.rotulo, ['Contestó el equipo', 'No contestó el equipo']);
  assert.equal(cumpleFila(NO_CONTESTO, H({ equipoContestoEnEsta: false })), true, 'nadie contestó: sale el segundo aviso');
  assert.equal(cumpleFila(NO_CONTESTO, H({ equipoContestoEnEsta: true })), false);
  assert.equal(cumpleFila({ campo: CAMPO_EQUIPO_CONTESTO }, H({ equipoContestoEnEsta: true })), true);
  // Sin aviso todavía, sin grupo o sin poder leer: no se inventa que nadie contestó.
  for (const v of [null, undefined]) {
    assert.equal(cumpleFila(NO_CONTESTO, H({ equipoContestoEnEsta: v })), false, `con ${v} la negada se cumplió`);
    assert.equal(cumpleFila({ campo: CAMPO_EQUIPO_CONTESTO }, H({ equipoContestoEnEsta: v })), false);
  }
  // Lo del lead no la mueve: es del equipo.
  assert.equal(cumpleFila(NO_CONTESTO, H({ respondio: true, contestoEnEsta: true, equipoContestoEnEsta: false })), true);
});

test('cualquier fila del grupo cuenta, salvo el eco del propio aviso; y sólo se lee si el flujo la pregunta', () => {
  assert.equal(contestoElEquipo([]), false);
  assert.equal(contestoElEquipo([{ role: 'assistant', wa_message_id: 'A1' }]), false, 'sólo MaKo: nadie contestó');
  assert.equal(contestoElEquipo([{ role: 'assistant', wa_message_id: 'A1' }, { role: 'user', wa_message_id: 'U1' }]), true);
  assert.equal(contestoElEquipo([{ role: 'user', wa_message_id: null }]), true, 'un «ok» sin id también cuenta');
  assert.equal(contestoElEquipo([{ role: 'assistant', wa_message_id: 'A1' }, { role: 'user', wa_message_id: 'A1' }]), false, 'el eco no es respuesta');

  const conCondicion = normalizar([
    { id: 'c', nodo: 'condicion', ramas: [{ id: 'c_si', modo: 'todas', filas: [NO_CONTESTO], siguiente: null }], si_no: null },
  ] as PasoGrafo[]);
  const sin = normalizar([
    { id: 'c', nodo: 'condicion', ramas: [{ id: 'c_si', modo: 'todas', filas: [{ campo: 'contesto', no: true }], siguiente: null }], si_no: null },
  ] as PasoGrafo[]);
  assert.equal(usaEquipoContesto(conCondicion), true);
  assert.equal(usaEquipoContesto(sin), false, 'un flujo que no la pregunta no paga la lectura');
});

test('el motor pone el hecho en los TRES lugares donde decide una condición, anclado en el último aviso', () => {
  const nut = leer('lib/nutricion.ts');
  const inyecta = nut.match(/contestoEnEsta: enRespuesta, \.\.\.\(await equipoDeLaInscripcion\(sec\.pasos, insc\.id\)\)/g) ?? [];
  assert.equal(inyecta.length, 2, 'la corrida y el reintento antes de mandar');
  assert.match(nut, /if \(hechos && inscId != null\) hechos = \{ \.\.\.hechos, \.\.\.\(await equipoDeLaInscripcion\(pasos, inscId\)\) \};/,
    'dentro de «Si responde» la condición no vería al equipo');
  assert.match(nut, /if \(!usaEquipoContesto\(pasos\)\) return \{\};/);
  const i = nut.indexOf('async function equipoContestoDesdeElAviso(');
  assert.ok(i > 0);
  const f = nut.slice(i, nut.indexOf('\n}\n', i));
  assert.match(f, /\.eq\('inscripcion_id', inscripcionId\)\.eq\('asunto', OP_AVISAR\)\.eq\('estado', 'accion'\)/, 'el ancla es el aviso que salió de ESTA inscripción');
  assert.match(f, /\.order\('created_at', \{ ascending: false \}\)\.limit\(1\)/, 'el ÚLTIMO aviso');
  assert.match(f, /if \(!desde\) return null;/);
  assert.match(f, /const jid = await grupoJidEstricto\(ws\);\n\s*if \(!jid\) return null;/);
  assert.match(f, /\.eq\('grupo_jid', jid\)\.gt\('created_at', desde\)/);
  assert.match(f, /return contestoElEquipo\(/);
});

test('«Probar» la da en false (nadie del equipo escribe en la prueba)', () => {
  const h = hechosDeLeadNuevo({});
  assert.equal(h.equipoContestoEnEsta, false);
});
