// =============================================================================
// «¿Era calificado?» sin reunión — una sola regla, un solo estado
// =============================================================================
// Pedido textual de Martín (05/10/2026): «es bien importante que esté claro la
// sección de "¿Era calificado?" que hoy en día lo tenemos solo editable en las
// reuniones… con todos los funnels que tenemos y algunos funnel NO tienen
// reuniones, esa data tan valiosa que le envía a Meta CAPI para que nos traigan
// mejores leads, jamás se pueden editar… Entonces, el botón para marcar como
// calificado lo pondría tal vez en tracking».
//
// ⚠️ LO MEDIDO PRIMERO, porque el diagnóstico obvio era el equivocado: el problema
// NO era que faltara un botón. `updateLead` (lib/leads.ts) forzaba
// `calificado = null` cuando faltaba `fecha_junta_1` y cuando `asistio_j1` no era
// `true`, así que un botón nuevo en Tracking habría guardado y la siguiente lectura
// habría traído la columna en null — el control rebotando, sin error y sin aviso.
// Lo que había que mover era la INVARIANTE; el control es la consecuencia.
//
// Y queda UNA sola regla, en un módulo puro, porque ahora la miran tres lugares
// (updateLead, las dos tarjetas de la ficha y el canal de MaKo). Con tres copias, el
// día que una cambie los otros dos siguen contestando lo de antes y la misma
// pregunta tiene dos respuestas según la pestaña.
//
// Probado rompiéndolo, las ONCE roturas, mutando un archivo, corriendo el test y
// restaurándolo desde memoria (nunca `git checkout --`: en este clon se llevaría
// trabajo sin commitear de otra sesión). Con el código como está: 7 pases, 0 fallos.
//
//   · vuelve la invariante vieja (`asistio_j1 !== true` → calificado null)   → 6 / 1
//   · la rama sin fecha de R1 vuelve a borrar el calificado                  → 6 / 1
//   · `calificadoSeDescarta` vuelve a ser `asistio_j1 !== true`              → 6 / 1
//   · la ruta /crm/[id] deja de montar <CalificacionCard>                    → 6 / 1
//   · el modal deja de montar <CalificacionCard>                             → 6 / 1
//   · la tarjeta de Reuniones vuelve a esconderlo tras `asistio_j1 === true`  → 6 / 1
//   · el canal de MaKo vuelve a exigir la asistencia                         → 6 / 1
//   · la tarjeta de Tracking copia el candado a mano (`asistio_j1 === false`) → 6 / 1
//   · el formulario de «Editar» vuelve a exigir la asistencia                → 6 / 1
//   · borrar la fecha de R1 vuelve a borrar el calificado (formulario)       → 6 / 1
//   · la asistencia sin marcar vuelve a limpiar el calificado (formulario)   → 6 / 1
//
// ⚠️ DOS MUTACIONES HABRÍAN DADO «NO MUTÓ» con anclas de `\n`: `core.autocrlf` deja
// este árbol MEZCLADO (lib/leads.ts y ReunionesCard.tsx son CRLF, page.tsx es LF).
// El arnés convierte sus anclas al salto DEL archivo que va a mutar.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { calificadoSeDescarta } from '../lib/calificado-reunion';

/** Normalizado a \n: este árbol está mezclado entre CRLF y LF. */
const crudo = (p: string) => readFileSync(join(import.meta.dirname, p), 'utf8').replace(/\r\n/g, '\n');
// Sin comentarios: la convención de la casa explica en prosa lo que se sacó, así que
// un test que persigue la AUSENCIA de algo encontraría su propia explicación.
const leer = (p: string) => crudo(p).replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const MONTAJES: Array<[string, string]> = [
  ['../app/crm/LeadSheet.tsx', 'modal'],
  ['../app/crm/[id]/page.tsx', 'ruta /crm/[id]'],
];

// ── 1 · La regla, ejecutada ──────────────────────────────────────────────────

test('sin reunión el calificado se conserva; sólo se descarta si consta que no vino', () => {
  // El caso que no se podía cargar: funnel de WhatsApp, ninguna llamada.
  assert.equal(calificadoSeDescarta({ fecha_junta_1: null, asistio_j1: null }), false,
    'sin reunión no hay contradicción: es otro funnel');
  // R1 agendada y nadie marcó la asistencia: tampoco se descarta.
  assert.equal(calificadoSeDescarta({ fecha_junta_1: '2026-10-01', asistio_j1: null }), false,
    'la asistencia sin marcar no es un «no vino»');
  // Asistió: el caso de siempre.
  assert.equal(calificadoSeDescarta({ fecha_junta_1: '2026-10-01', asistio_j1: true }), false);
  // El ÚNICO que se descarta.
  assert.equal(calificadoSeDescarta({ fecha_junta_1: '2026-10-01', asistio_j1: false }), true,
    'consta que no vino: calificarlo no significa nada');
  // Y sin fecha, un `false` colgado no borra nada: `updateLead` ya anuló esa
  // asistencia (no hay reunión de la que faltar).
  assert.equal(calificadoSeDescarta({ fecha_junta_1: null, asistio_j1: false }), false);
});

// ── 2 · updateLead aplica ESTA regla y no la vieja ───────────────────────────

test('updateLead ya no exige reunión para el calificado', () => {
  const src = leer('../lib/leads.ts');
  const i = src.indexOf('export async function updateLead');
  assert.ok(i > 0, 'updateLead tiene que existir');
  const cuerpo = src.slice(i, i + 4000);

  // La invariante vieja: cualquier asistencia que no fuera `true` borraba el dato.
  assert.ok(!/merged\.asistio_j1 !== true/.test(cuerpo),
    'la invariante vieja dejaba sin marcar a los funnels sin reuniones');
  // Y la rama sin fecha de R1 ya sólo anula la ASISTENCIA.
  assert.match(cuerpo, /if \(!merged\.fecha_junta_1\) \{\n\s*merged\.asistio_j1 = null;\n\s*\}/,
    'sin fecha de R1 se anula la asistencia, no el calificado');
  // El único borrado que queda pasa por el módulo puro: si se escribiera a mano acá,
  // la ficha bloquearía en un caso y el servidor borraría en otro.
  assert.match(cuerpo, /if \(calificadoSeDescarta\(merged\)\) \{\n\s*merged\.calificado = null;\n\s*\}/,
    'el borrado usa la regla compartida');
});

// ── 3 · El control está en Tracking, por las DOS puertas ─────────────────────

test('la pestaña Tracking ofrece marcar calificado en los dos montajes', () => {
  for (const [ruta, cual] of MONTAJES) {
    const f = leer(ruta);
    assert.ok(/<CalificacionCard lead=\{lead\} \/>/.test(f), `${cual}: falta el control de calificación`);
    // El orden que pidió Martín para esta pestaña se respeta: Origen va primero y
    // Comportamiento después, con la calificación entre los dos (es el par de Meta).
    const iOrigen = f.indexOf('<OrigenCard');
    const iCal = f.indexOf('<CalificacionCard');
    const iComp = f.indexOf('<ComportamientoCard');
    assert.ok(iOrigen >= 0 && iCal > iOrigen, `${cual}: «Origen del lead» va primero`);
    assert.ok(iComp > iCal, `${cual}: «Comportamiento» va después`);
  }
});

test('el control de Tracking escribe por el camino que avisa a Meta', () => {
  const card = leer('../app/crm/lead-view/CalificacionCard.tsx');
  // El MISMO control que la tarjeta de Reuniones: `TriEditable` ya rutea por
  // `guardarCampoLeadAction` → `updateLead`, que es el único que manda el evento.
  assert.match(card, /campo="calificado"/, 'escribe la columna calificado');
  assert.match(card, /import \{ TriEditable \} from '\.\/CampoEditable'/, 'reusa el control de la ficha');
  // Una escritura propia sería un segundo camino: la pantalla diría que sí y Meta no
  // se enteraría, que es exactamente lo que Martín preguntó el mismo día.
  assert.ok(!/from '\.\.\/actions'/.test(card), 'no llama a ninguna action por su cuenta');
  assert.ok(!/updateLead|saveLeadMeta/.test(card), 'ni escribe la columna directo');
  // Y el candado es el compartido, no una copia escrita a mano.
  assert.match(card, /calificadoSeDescarta\(lead\)/, 'usa la regla compartida');
  assert.ok(!/asistio_j1 === false/.test(card), 'ninguna copia del candado');
});

// ── 4 · Un solo estado: las dos tarjetas bloquean en el mismo caso ───────────

test('Reuniones y Tracking muestran el MISMO estado del calificado', () => {
  const card = leer('../app/crm/lead-view/ReunionesCard.tsx');
  // Antes el chip se escondía si no constaba la asistencia. Con el control de
  // Tracking a la vista, eso hacía que la misma pregunta tuviera dos respuestas
  // según la pestaña: acá «no existe», allá «sin marcar».
  assert.ok(!/lead\.asistio_j1 === true && \(/.test(card),
    'el calificado ya no se esconde detrás de la asistencia');
  assert.match(card, /campo="calificado"[^>]*bloqueado=\{calificadoSeDescarta\(lead\)\}/,
    'y bloquea por la misma regla que la tarjeta de Tracking');
});

test('el formulario de «Editar» tampoco exige la asistencia', () => {
  // Es el CUARTO control de la misma pregunta, y escribe por el mismo camino
  // (`saveLeadEditorAction` → `updateLead`). Con la regla vieja acá, el mismo lead
  // tenía el dato editable en Tracking y gris en el formulario.
  const form = leer('../app/crm/[id]/EditLeadForm.tsx');
  assert.ok(!/calificadoDisabled = asistioJ1 !== true/.test(form),
    'la regla vieja dejaba gris lo que la ficha permite');
  assert.match(form, /calificadoDisabled = calificadoSeDescarta\(/, 'usa la regla compartida');
  // Y borrar la fecha de la R1 ya no borra el calificado: `updateLead` no lo hace.
  assert.match(form, /if \(!v\) setAsistioJ1\(null\);/, 'sin fecha se limpia la asistencia, no el calificado');
  assert.match(form, /if \(v === false\) setCalificado\(null\)/, 'sólo un «no asistió» lo limpia');
});

// ── 5 · El canal de MaKo no puede ser más estricto que la ficha ──────────────

test('MaKo propone el calificado sin exigir reunión', () => {
  const run = leer('../lib/api-mako/areas/crm.run.ts');
  const i = run.indexOf('marcar_calificado: {');
  assert.ok(i > 0, 'la acción tiene que existir');
  const cuerpo = run.slice(i, i + 1200);
  assert.ok(!/lead\.asistio_j1 !== true/.test(cuerpo),
    'exigir la asistencia dejaba al canal rechazando lo que la ficha permite');
  assert.match(cuerpo, /calificadoSeDescarta\(lead\)/, 'usa la misma regla que la ficha');
});
