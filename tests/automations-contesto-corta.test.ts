// =============================================================================
// «Contestó» CORTA (23/10/2026, P0 de #289; Martín en la llamada con Mauricio, min 49: «¿Contestó corta de verdad?»)
// =============================================================================
// Medido en el ws3 (scripts/arnes-contesto-corta.mts): con la forma de #289, a quien contestaba durante la espera le
// salía igual el seguimiento y la rama «Contestó» (el aviso al equipo) no corría nunca. La regla, por el Cerebro: en una
// automatización que USA «Contestó», una respuesta del lead, en cualquier momento, lo saca de ella (no le sale ningún
// mensaje más) y, si hay rama «Contestó», corre EN ESE MOMENTO. Lo que se fija:
//   · `destinoAlContestar` EJECUTADO con la forma de #289: antes del primer mensaje, en cada espera, y los bordes;
//   · el cableado: `pausarPorRespuesta` → `alContestar` (en el acto), y la guarda de `procesarEnvios` (ningún mensaje más).
//
// PROBADO ROMPIÉNDOLO: ver el pie. Correr: node --import tsx --test tests/automations-contesto-corta.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { usaContesto, destinoAlContestar, ramaDeQuienContesto } from '../lib/nutricion-grafo-motor';
import { indicePorId, type PasoGrafo } from '../lib/flujo-grafo';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const tramo = (src: string, desde: string, hasta: string) => { const i = src.indexOf(desde); assert.ok(i >= 0, `no está «${desde}»`); return src.slice(i, src.indexOf(hasta, i + desde.length)); };

// La forma de #289 (sin los textos): M1 → Contestó? (sí → aviso) / no → 1 día → M2 → 2 días → No contestó? → mover.
const P289 = [
  { id: 'entrada', nodo: 'inicio', canal: 'whatsapp', cuerpo: '', siguiente: 'm1' },
  { id: 'm1', canal: 'whatsapp', cuerpo: 'M1', siguiente: 'c1' },
  { id: 'c1', nodo: 'condicion', canal: 'whatsapp', cuerpo: '', ramas: [{ id: 'r1', modo: 'todas', filas: [{ campo: 'contesto' }], siguiente: 'aviso' }], si_no: 'e1' },
  { id: 'aviso', canal: 'whatsapp', cuerpo: '', accion: { operacion: 'avisar_al_equipo', params: {} }, siguiente: null },
  { id: 'e1', nodo: 'esperar', canal: 'whatsapp', cuerpo: '', espera: { modo: 'tiempo', minutos: 1440 }, siguiente: 'm2' },
  { id: 'm2', canal: 'whatsapp', cuerpo: 'M2', siguiente: 'e2' },
  { id: 'e2', nodo: 'esperar', canal: 'whatsapp', cuerpo: '', espera: { modo: 'tiempo', minutos: 2880 }, siguiente: 'c2' },
  { id: 'c2', nodo: 'condicion', canal: 'whatsapp', cuerpo: '', ramas: [{ id: 'r2', modo: 'todas', filas: [{ no: true, campo: 'contesto' }], siguiente: 'mover' }], si_no: null },
  { id: 'mover', canal: 'whatsapp', cuerpo: '', accion: { operacion: 'proponer_cambio_etapa', params: {} }, siguiente: null },
] as unknown as PasoGrafo[];
const en = (pasos: PasoGrafo[], id: string) => destinoAlContestar(pasos, indicePorId(pasos, id));

test('con la forma de #289, quien contesta en cualquier momento va a la rama «Contestó» (el aviso)', () => {
  assert.equal(usaContesto(P289), true);
  assert.equal(en(P289, 'm1'), 'aviso', 'antes de que le salga M1');
  assert.equal(en(P289, 'm2'), 'aviso', 'durante la espera de 1 día (la fila espera parada en M2)');
  assert.equal(en(P289, 'c2'), 'aviso', 'durante la espera de 2 días (la fila espera parada en «No contestó»)');
  assert.equal(en(P289, 'entrada'), 'aviso', 'recién entró');
});

test('los bordes: sin rama «Contestó» sale de la automatización; sin «Contestó» en el flujo no se toca', () => {
  // Sólo «No contestó»: quien contestó toma el «si no», que no sigue → sale.
  const soloNo = P289.filter((p) => p.id !== 'c1' && p.id !== 'aviso').map((p) => (p.id === 'm1' ? { ...p, siguiente: 'e1' } : p)) as PasoGrafo[];
  assert.equal(usaContesto(soloNo), true);
  assert.equal(en(soloNo, 'm2'), null);
  // «No contestó → M2 / si no → aviso» (revisión adversarial): quien contestó va al «si no», el aviso.
  const alReves = [
    { id: 'entrada', nodo: 'inicio', canal: 'whatsapp', cuerpo: '', siguiente: 'm1' },
    { id: 'm1', canal: 'whatsapp', cuerpo: 'M1', siguiente: 'e1' },
    { id: 'e1', nodo: 'esperar', canal: 'whatsapp', cuerpo: '', espera: { modo: 'tiempo', minutos: 60 }, siguiente: 'c' },
    { id: 'c', nodo: 'condicion', canal: 'whatsapp', cuerpo: '', ramas: [{ id: 'r', modo: 'todas', filas: [{ no: true, campo: 'contesto' }], siguiente: 'm2' }], si_no: 'aviso' },
    { id: 'm2', canal: 'whatsapp', cuerpo: 'M2', siguiente: null },
    { id: 'aviso', canal: 'whatsapp', cuerpo: '', accion: { operacion: 'avisar_al_equipo', params: {} }, siguiente: null },
  ] as unknown as PasoGrafo[];
  assert.equal(en(alReves, 'e1'), 'aviso', 'el aviso del «si no» se perdía');
  // «Contestó y sigue en la etapa → aviso»: con otra cosa en la fila, no se decide acá (la condición, al despertar).
  const mezcla = P289.map((p) => (p.id === 'c1' ? { ...p, ramas: [{ id: 'r1', modo: 'todas', filas: [{ campo: 'contesto' }, { campo: 'etapa', valor: 'x' }], siguiente: 'aviso' }] } : p)) as PasoGrafo[];
  assert.equal(en(mezcla, 'm2'), undefined);
  // Lo que cuelga de «Contestó» SALE (está dibujado para quien contestó); lo demás, no.
  assert.deepEqual([...ramaDeQuienContesto(P289)].sort(), ['aviso']);
  assert.deepEqual([...ramaDeQuienContesto(alReves)].sort(), ['aviso']);
  // Un flujo sin «Contestó»: contestar no corta nada por su cuenta (14/10/2026).
  const sin = [
    { id: 'entrada', nodo: 'inicio', canal: 'whatsapp', cuerpo: '', siguiente: 'm1' },
    { id: 'm1', canal: 'whatsapp', cuerpo: 'M1', siguiente: 'e1' },
    { id: 'e1', nodo: 'esperar', canal: 'whatsapp', cuerpo: '', espera: { modo: 'tiempo', minutos: 60 }, siguiente: 'm2' },
    { id: 'm2', canal: 'whatsapp', cuerpo: 'M2', siguiente: null },
  ] as unknown as PasoGrafo[];
  assert.equal(usaContesto(sin), false);
  assert.equal(en(sin, 'm2'), undefined);
});

test('cableado: la respuesta corta EN EL ACTO y, después, ningún mensaje más', () => {
  const motor = leer('lib/nutricion.ts');
  // `pausarPorRespuesta` → `alContestar` con lo que acaba de pasar a 'respondio', antes de atender la charla.
  const pausar = tramo(motor, 'export async function pausarPorRespuesta(', '\n}\n');
  assert.match(pausar, /if \(pausadas\.length\) await alContestar\(leadId, pausadas, secsActivas\);\n\n\s+\/\/ Best-effort y en segundo plano conceptual/);
  // `alContestar`: no toca «Si responde», los hilos ni el carril; compare-and-set; la rama corre ya (vía rápida).
  const al = tramo(motor, 'export async function alContestar(', '\n}\n');
  assert.match(al, /if \(!sec \|\| raizRespuesta\(sec\.pasos\) != null \|\| sanearHilos\(f\.hilos\)\) continue;/);
  // Sólo si ya le salió algo (le escribió por otra cosa: le sale su primer mensaje).
  assert.match(al, /if \(!\(await yaLeSalioAlgo\(db, f\.id\)\)\) continue;/);
  // ⚠️ Sin rama «Contestó», queda en 'respondio' sin próximo envío: un 'completada' directo la daba por FALLIDA.
  assert.match(al, /: \{ proximo_envio_at: null, updated_at: ahoraISO\(\) \};/);
  assert.doesNotMatch(al, /estado: 'completada'/, 'alContestar cierra con completada: el desenlace la da por fallida');
  assert.match(al, /if \(idx < 0 \|\| esHiloDelCarril\(sec\.pasos, idx\)\) continue;/);
  assert.match(al, /\.eq\('id', f\.id\)\.eq\('estado', 'respondio'\)\.eq\('paso_actual', f\.paso_actual\)/);
  // (Salvo cuando lo llama el motor, que ya es la corrida: `sinViaRapida`, 24/10/2026.)
  assert.match(al, /if \(movidas && !o\?\.sinViaRapida\) await viaRapidaConTurno\(leadId\)/);
  // La guarda: a quien contestó no le sale ningún MENSAJE más de una automatización que usa «Contestó».
  assert.match(motor, /const nodoAhora = sec\.pasos\[insc\.paso_actual\];\n\s+if \(enRespuesta && nodoAhora && cierraAlContestar\(sec\.pasos, insc\.paso_actual\) && await yaLeSalioAlgo\(supabase, insc\.id\)\) \{\n\s+if \(await escribir\(insc, \{ estado: 'completada', proximo_envio_at: null \}, \{ modo: 'cas', alcance: 'hilo' \}\)\) \{/);
  // La regla vive en una función porque el aviso al activar pregunta lo mismo (lib/ritmo-al-activar.ts): que no se separen.
  assert.match(motor, /function cierraAlContestar\(pasos: readonly PasoGrafo\[\], i: number\): boolean \{\n\s+const n = pasos\[i\];\n\s+return !!n && claseDe\(n\) === 'mensaje' && usaContesto\(pasos\) && raizRespuesta\(pasos\) == null && !esHiloDelCarril\(pasos, i\) && !ramaDeQuienContesto\(pasos\)\.has\(idDe\(n, i\)\);/);
  // Y va ANTES de la condición de arriba y de las guardas del mensaje.
  assert.ok(motor.indexOf('«CONTESTÓ» CORTA (23/10/2026, P0 de #289, lib/nutricion-grafo-motor.ts') < motor.indexOf('LA CONDICIÓN DE ARRIBA, OTRA VEZ (14/10/2026'));
});

// ── ROTURAS (23/10/2026) ───────────────────────────────────────────────────────────────────────────
// Con romper-varios.mjs del scratchpad, una por vez. Base 3 / 0:
//   H1. sin la guarda de `procesarEnvios` (a quien contestó le sale el seguimiento)            → rojo
//   H2. `pausarPorRespuesta` no llama a `alContestar` (la rama «Contestó» no corre en el acto)  → rojo
//   H3. `destinoAlContestar` no busca hacia arriba (contestó durante la espera: no hay aviso)    → rojo
//   H4. `alContestar` también corta las que tienen «Si responde»                                 → rojo
//   H5. un flujo sin «Contestó» también corta                                                    → rojo
//   H6. `alContestar` cierra con 'completada' (el desenlace la da por fallida)                   → rojo
//   H7. el «si no» de «No contestó» no cuenta como la rama de quien contestó (se pierde el aviso)→ rojo
//   H8. la guarda corta los mensajes de la rama «Contestó»                                       → rojo
