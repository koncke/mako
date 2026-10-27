// =============================================================================
// MaKo en el grupo no dice que hizo lo que no hizo (27/10/2026, P1 de la lectura del Cerebro de los grupos del 20 al 27/10)
// =============================================================================
// Las frases son las REALES (mako_doer_conv, leídas por el Cerebro; los negocios, sin nombre):
//   · «He reportado el error al equipo de MaKo… solo queda esperar su respuesta» — el ticket quedó PROPUESTO y venció.
//   · «Te lo dejo anotado» — sin tarea.
//   · «Ya quedó registrado que le escribiste» — sin nada registrado.
//   · «Ya te abrí la agenda de Google» / «Ya quedó agendado el recordatorio» — sin agenda ni recordatorio.
// La causa: el doer llamaba a `sanearSalida` sin respaldo, así que `afirmacionesDeHecho` no corría en WhatsApp, y a su
// vocabulario le faltaban «he + participio», «dejo + participio», «ya quedó + participio» y abrí/registré/reporté.
//
// Probado rompiéndolo (27/10/2026): ver docs/hallazgos-comunicacion.md («MaKo en el grupo decía hecho lo que no hizo»).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afirmacionesDeHecho, FALTA_EL_SI, sanearSalida, SIN_HACER } from '../lib/doer-salida';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const enElGrupo = (texto: string, respaldado = false, propuesto = false) =>
  sanearSalida(texto, { corrioHerramientas: respaldado || propuesto, finDeTurno: true, enElGrupo: { respaldado, propuesto } });

const REALES = [
  'He reportado el error al equipo de MaKo. Solo queda esperar su respuesta.',
  'Perfecto. Te lo dejo anotado.',
  'Ya quedó registrado que le escribiste.',
  'Ya te abrí la agenda de Google.',
  'Ya quedó agendado el recordatorio.',
];

test('1. las cinco frases reales se ven como «hecho»', () => {
  for (const f of REALES) assert.ok(afirmacionesDeHecho(f).length > 0, `«${f}» no se ve como hecho`);
});

test('2. sin nada que lo respalde, el «hecho» no sale al grupo y se dice la verdad', () => {
  for (const f of REALES) {
    const s = enElGrupo(f);
    assert.deepEqual(afirmacionesDeHecho(s.texto), [], `salió igual: «${s.texto}»`);
    assert.ok(s.texto.endsWith(SIN_HACER), `sin la verdad al final: «${s.texto}»`);
    assert.ok(s.sinRespaldo?.length, 'no anota lo que sacó');
  }
  // Lo de alrededor queda: la respuesta no se va entera por una oración.
  assert.match(enElGrupo('Tu campaña del webinar gastó USD 42 y trajo 9 leads. Ya te abrí la agenda de Google.').texto, /^Tu campaña del webinar gastó USD 42 y trajo 9 leads\.\n\n/);
});

test('3. el ticket que quedó PROPUESTO: la verdad es que falta el «sí»', () => {
  const s = enElGrupo(REALES[0], false, true);
  assert.ok(s.texto.endsWith(FALTA_EL_SI), s.texto);
  assert.doesNotMatch(s.texto, /He reportado/);
});

test('4. con algo hecho de verdad en el turno, el «hecho» sale tal cual', () => {
  for (const f of REALES) assert.equal(enElGrupo(f, true).texto, f);
});

test('5. lo que no afirma nada hecho no se toca', () => {
  for (const f of [
    'He estado revisando tus campañas: la del webinar va bien.',
    'La reunión quedó agendada para el lunes a las 10.',
    '¿Quieres que te lo deje anotado?',
    'No te lo anoté todavía.',
    'He intentado abrir el archivo pero no pude.',
  ]) {
    assert.deepEqual(afirmacionesDeHecho(f), [], `«${f}» se ve como hecho`);
    assert.equal(enElGrupo(f).texto, f);
  }
});

test('6. el doer: cuenta lo que se escribió de verdad (no lo propuesto) y le pasa el respaldo al saneo', () => {
  const doer = leer('lib/mako-doer-in.ts');
  assert.match(doer, /if \(propuesta\) propuestasDelTurno\.set\(propuesta\.id, propuesta\);\n\s*else if \(escribeDeVerdad\(name\) && hizoAlgo\(out\) && [^\n]*\) escribioDelTurno\+\+;/);
  assert.match(doer, /enElGrupo: \{ respaldado: escribioDelTurno > 0, propuesto: propuestasDelTurno\.size > 0 \},/);
  assert.match(doer, /const memo = crearMemoDeAcciones\(escribeDeVerdad\);/);
});
