// =============================================================================
// Décima tanda (11/10/2026): lo que encontró la REVISIÓN adversarial de motor y datos, arreglado y fijado
// =============================================================================
// Los cuatro defectos, cada uno con lo que se EJECUTA (o, en lib/nutricion.ts, que es `server-only`, el fuente
// sin comentarios recortado a su bloque real):
//   1. La migración del AI Step (lib/ai-step-migrar.ts) le ponía a cada caso el objetivo de la tabla de §8.4, y el
//      objetivo VIAJA al redactor: con --aplicar, la #213 del ws1 (activa, dos casos que salen solos) contestaba
//      otra cosa, y el freno (`loQueContesta`) no lo veía porque no comparaba el objetivo. Ahora no se escribe
//      (§10-A, la tabla queda como sugerencia) y el freno compara todo lo que el redactor recibe.
//      ⚠️ UNDÉCIMA TANDA: la migración que partía se RETIRÓ (`planDeFila` ya no existe; UN AI Step por objetivo). Lo
//      que este punto cuidaba sigue valiendo para la puerta nueva, `juntarPasosIA`: juntar la #213 no le inventa un
//      objetivo (el de la #213 lo pone, sabiendo que cambia lo que se contesta, el script de la ola 4) y el freno
//      (`loQueContesta`) sigue viendo el objetivo. Los dos tests del punto 1 se reescribieron sobre `juntarPasosIA`.
//   2. «Contesta sola» medía el horario de oficina en la zona del motor (Ciudad de México sin `mako.timezone`)
//      mientras su 9 a 21 de siempre iba en `tzActual` (Tijuana): en el ws1 la ventana se corría una hora.
//   3. `limitesParaGuardar` validaba el rango también de lo de FÁBRICA: con un env fuera de rango (lo respeta
//      `limitesDeFabrica`), ningún guardado pasaba.
//   4. El clasificador tomaba «Quiero una reunión sobre el flujo de ventas…» y «Haz el flujo de caja…» como pedido
//      de crear una automatización (el primero llegaba sin las herramientas de la agenda).
//
// PROBADO ROMPIÉNDOLO: ver ROTURAS al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type PasoGrafo, type CasoRespuesta, esPasoIA, escenariosDeRespuesta, juntarPasosIA } from '../lib/flujo-grafo';
import { loQueContesta } from '../lib/ai-step-migrar';
import { dentroDelHorario, HORARIO_SUGERIDO } from '../lib/horario-envio';
import { limitesDeFabrica, limitesParaGuardar, conLimite } from '../lib/limites-envio';
import { clasificarIntencion, esPedidoAutomatizacion } from '../lib/mako-intencion';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string): string => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── 1. La migración del AI Step no cambia lo que se contesta ───────────────────────────────

const msg = (o: Partial<PasoGrafo> = {}): PasoGrafo => ({ canal: 'whatsapp', proveedor: 'no_oficial', delay_horas: 0, asunto: null, cuerpo: 'hola', template_wa: null, ...o });
const caso = (id: string, o: Partial<CasoRespuesta> = {}): CasoRespuesta => ({ id, titulo: `Caso ${id}`, cuando: `cuando ${id}`, siguiente: null, ...o });

/** La forma de la #213 (ws1, activa): un AI Step v1 con los 4 casos del respaldo de la novena, dos que salen solos. */
const como213 = (): PasoGrafo[] => [
  msg({ id: 'o0', siguiente: 'o1' }),
  msg({ id: 'o1', siguiente: null }),
  { ...msg({ cuerpo: '' }), id: 'R', nodo: 'respuesta', paso_ia: true, si_no: null, casos: [
    caso('A', { titulo: 'Confirma o ya vio el video', responder: 'Agradece y confirma', sola: true }),
    caso('B', { titulo: 'Pregunta el precio', responder: 'En la reunión', avisar: true }),
    caso('C', { titulo: 'Pregunta por la reunión', responder: 'Dile cuándo es' }),
    caso('D', { titulo: 'Quiere cambiar el día', responder: 'Ofrece otro horario', sola: true }),
  ] },
];

test('1. (undécima) juntar la #213 NO le inventa un objetivo: UN AI Step, los 4 escenarios, y el redactor contesta igual', () => {
  const j = juntarPasosIA(como213());
  assert.deepEqual([j.conflictos, j.perdidos], [[], []]);
  const ias = j.pasos.filter((x) => esPasoIA(x));
  assert.equal(ias.length, 1);
  assert.deepEqual(ias[0].casos!.map((c) => c.id), ['A', 'B', 'C', 'D']);
  assert.ok(!(ias[0].objetivo ?? '').trim() && ias[0].casos!.every((c) => !(c.objetivo ?? '').trim()), 'juntar escribió un objetivo: el redactor contestaría otra cosa');
  // Lo que ve el redactor, por el camino del motor (`escenariosDeRespuesta` sobre lo expandido): ningún objetivo.
  assert.ok(escenariosDeRespuesta(j.pasos, { medio: 'whatsapp' }).every((e) => e.objetivo === undefined));
  assert.equal(loQueContesta(j.pasos), loQueContesta(como213()), 'juntar cambió lo que se contesta');
});

test('1. el freno ve el objetivo: un objetivo en el AI Step CAMBIA lo que se contesta', () => {
  const j = juntarPasosIA(como213());
  const conObjetivo = j.pasos.map((x) => (esPasoIA(x) ? { ...x, objetivo: 'Que confirme que viene a la reunión' } : x));
  assert.notEqual(loQueContesta(conObjetivo), loQueContesta(j.pasos), '`loQueContesta` no compara el objetivo: el freno no lo ve');
});

// ── 2. «Contesta sola»: el horario de oficina en la zona de siempre ─────────────────────────

test('2. la ventana de «Contesta sola» se mide con `tz` (tzActual), no con la zona del motor', () => {
  // UNDÉCIMA TANDA (11/10/2026), revisado: desde la decisión 4 de la décima la zona del motor (`zonaDeLaVentana`) y
  // `tzActual` son la MISMA lectura con el MISMO default (Tijuana), así que el bug de Ciudad de México ya no puede
  // volver por acá. El test se queda por lo que todavía distingue: «Contesta sola» mide con `tzActual`, que NUNCA
  // tira, y no con la ventana del motor, que con la zona ilegible corta la corrida entera ('zona-ilegible').
  const nut = leer('lib/nutricion.ts');
  const i = nut.indexOf('4.5) ¿SALE SOLA?');
  const j = nut.indexOf('const enAudio = ', i);
  assert.ok(i > 0 && j > i, 'no encontré el bloque de «Contesta sola»');
  const bloque = sinComentarios(nut.slice(i, j));
  assert.ok(bloque.length < 4000, `el recorte mide ${bloque.length}: está mirando otra cosa`);
  assert.match(bloque, /tzActual\(\)\.catch\(\(\) => TZ_DEFAULT\),/);
  assert.match(bloque, /enHorario: horario \? dentroDelHorario\(Date\.now\(\), tz, horario\) : undefined,/);
  assert.doesNotMatch(bloque, /dentroDeVentana\(|zonaDeLaVentana\(/, 'volvió la ventana del motor a «Contesta sola»');
});

test('2. por qué importa: con 9 a 21, Tijuana y Ciudad de México dan distinto la misma noche y la misma mañana', () => {
  const noche = Date.parse('2026-10-12T03:30:00Z'); // 20:30 en Tijuana (PDT), 21:30 en Ciudad de México
  assert.equal(dentroDelHorario(noche, 'America/Tijuana', HORARIO_SUGERIDO), true);
  assert.equal(dentroDelHorario(noche, 'America/Mexico_City', HORARIO_SUGERIDO), false);
  const manana = Date.parse('2026-10-11T15:30:00Z'); // 08:30 en Tijuana, 09:30 en Ciudad de México
  assert.equal(dentroDelHorario(manana, 'America/Tijuana', HORARIO_SUGERIDO), false);
  assert.equal(dentroDelHorario(manana, 'America/Mexico_City', HORARIO_SUGERIDO), true);
});

// ── 3. Lo de fábrica no se valida contra el rango ──────────────────────────────────────────

test('3. con un env fuera de rango (WhatsApp por día = 200) se puede guardar, y lo que la persona cambia sí se valida', () => {
  const fab = limitesDeFabrica({ NUTRICION_MAX_POR_DIA: '200' });
  assert.equal(fab.wa.dia, 200);
  assert.deepEqual(limitesParaGuardar(fab, fab), { ok: true, valor: '{}' }, 'todo de fábrica no se pudo guardar');
  assert.deepEqual(limitesParaGuardar(conLimite(fab, 'mako', 'solasPor24h', 1), fab), { ok: true, valor: JSON.stringify({ mako: { solasPor24h: 1 } }) });
  assert.deepEqual(limitesParaGuardar(conLimite(fab, 'wa', 'dia', 150), fab), { ok: true, valor: JSON.stringify({ wa: { dia: 150 } }) });
  const fuera = limitesParaGuardar(conLimite(fab, 'wa', 'dia', 151), fab);
  assert.equal(fuera.ok, false);
  if (!fuera.ok) assert.match(fuera.error, /WhatsApp por día: entre 1 y 150/);
});

// ── 4. El clasificador: una reunión o la caja no son una automatización ──────────────────────

const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

test('4. «reunión sobre el flujo…» y «flujo de caja» no son un pedido de crear una automatización', () => {
  for (const m of ['Quiero una reunión sobre el flujo de ventas mañana a las 10', 'Haz el flujo de caja de octubre', 'Créame una reunión del flujo nuevo con Juan']) {
    assert.equal(esPedidoAutomatizacion(norm(m)), false, `«${m}» se toma como pedido de crear una automatización`);
    assert.notEqual(clasificarIntencion(m, {}).porque, 'pedido de crear una automatización', m);
  }
  assert.match(clasificarIntencion('Créame una reunión del flujo nuevo con Juan', {}).porque, /pedido de agenda/);
  // Lo que SÍ es (el resto, en tests/automatizacion-whatsapp.test.ts).
  for (const m of ['Quiero una nueva automatización de bienvenida', 'Hazme un flujo de mensajes para los que no pagaron', 'Créame una automatización que le escriba a los que no vinieron a la reunión']) {
    assert.equal(esPedidoAutomatizacion(norm(m)), true, `«${m}» dejó de ser un pedido`);
  }
});

// ── ROTURAS ─────────────────────────────────────────────────────────────────────────────
// Arnés `cierre10-roturas.mjs` en el scratchpad: guarda cada original en memoria, rompe, corre ESTE archivo y
// restaura byte a byte con sha1 igual (nunca `git checkout`). Medido el 11/10/2026. Base: 6 / 0. «pass / fail»:
//   R1 la migración vuelve a escribir el objetivo de la tabla (`convertir`)            → 4 / 2 (y ai-step-v2 14 / 1)
//   R2 `loQueContesta` sin el objetivo                                                 → 5 / 1 (ai-step-v2 sigue 15 / 0)
//   R3 «Contesta sola» con `dentroDeVentana(horario)` (la zona del motor)               → 5 / 1 (y configuraciones 15 / 1)
//   R4 `limitesParaGuardar` valida el rango antes de comparar con lo de fábrica        → 5 / 1 (configuraciones sigue 16 / 0)
//   R5 el clasificador sin el corte de «otro objeto» ni el de «flujo de caja»          → 5 / 1 (automatizacion-whatsapp sigue 5 / 0)
// Lo que las roturas dicen de los tests de al lado: R2, R4 y R5 sólo los caza ESTE archivo.
// UNDÉCIMA (11/10/2026, w1-aistep-modelo): R1 rompía `convertir` (se borró con la migración que partía). Su reemplazo:
//   U1 `juntarPasosIA` sube un objetivo de la tabla §8.4 al AI Step que no tiene                 → 4 / 2 (y ai-step-v2 13 / 2, ai-step-unico 11 / 1)
