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
const enElGrupo = (texto: string, respaldado = false, propuesto = false, leyo = false) =>
  sanearSalida(texto, { corrioHerramientas: respaldado || propuesto || leyo, finDeTurno: true, enElGrupo: { respaldado, propuesto, leyo } });
/** Lo que el grupo ve como hecho (el chat de la app no corta «he», «dejo» ni «ya quedó»). */
const hechoEnElGrupo = (texto: string, leyo = false) => afirmacionesDeHecho(texto, { enElGrupo: { leyo } });

const REALES = [
  'He reportado el error al equipo de MaKo. Solo queda esperar su respuesta.',
  'Perfecto. Te lo dejo anotado.',
  'Ya quedó registrado que le escribiste.',
  'Ya te abrí la agenda de Google.',
  'Ya quedó agendado el recordatorio.',
];

test('1. las cinco frases reales se ven como «hecho»', () => {
  for (const f of REALES) assert.ok(hechoEnElGrupo(f).length > 0, `«${f}» no se ve como hecho`);
});

test('2. sin nada que lo respalde, el «hecho» no sale al grupo y se dice la verdad', () => {
  for (const f of REALES) {
    const s = enElGrupo(f);
    assert.deepEqual(hechoEnElGrupo(s.texto), [], `salió igual: «${s.texto}»`);
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
    assert.deepEqual(hechoEnElGrupo(f), [], `«${f}» se ve como hecho`);
    assert.equal(enElGrupo(f).texto, f);
  }
});

test('7. lo que el turno LEYÓ es la respuesta: «he encontrado», «he consultado», «te dejo detallados» salen tal cual', () => {
  // La revisión adversarial de 92d23e11d: con cualquier participio, todas éstas salían como «Eso no lo llegué a hacer».
  for (const f of [
    'He encontrado 2 reuniones para mañana, con Juan a las 10 y con Ana a las 15.',
    'He consultado tu CRM y tienes 14 leads en Seguimiento, 3 en Ganado.',
    'He verificado tu cuenta de Meta y está activa.',
    'He analizado tus métricas de octubre. El CAC subió a US$ 40.',
    'He calculado tu CAC de octubre y quedó en US$ 40.',
    'He buscado a Juan en el CRM y está en Seguimiento.',
    'Te dejo detallados los 3 leads más calientes. Juan está en Propuesta.',
    // La revisión de 36e06b35f: «hecho», «abierto» y «escrito» sin a quién también cuentan una lectura.
    'He hecho una búsqueda en tu CRM y Juan está en Seguimiento.',
    'He hecho la cuenta y llevas 14 leads este mes.',
    'He escrito un resumen de la llamada con Ana.',
    'He abierto tu agenda y mañana tienes 2 reuniones.',
    'Hice una búsqueda en tu CRM y Juan está en Seguimiento.',
    'Abrí tu agenda y mañana tienes 2 reuniones.',
  ]) {
    assert.deepEqual(hechoEnElGrupo(f, true), [], `«${f}» se ve como hecho`);
    assert.equal(enElGrupo(f, false, false, true).texto, f);
  }
  // «ya quedó + participio» sin primera persona: con una lectura en el turno, puede ser lo que leyó.
  const leido = 'La reunión con Juan ya quedó agendada para el lunes (la agendó Ana desde Calendly).';
  assert.equal(enElGrupo(leido, false, false, true).texto, leido);
  // Un verbo de ESCRITURA sigue cortándose aunque el turno haya leído: leer no respalda «He agendado» ni «Le he escrito».
  for (const f of ['He agendado la reunión con Juan para el lunes.', 'Le he escrito a Juan por WhatsApp.', 'He escrito a Ana para el lunes.']) {
    const s = enElGrupo(f, false, false, true);
    assert.ok(s.texto.endsWith(SIN_HACER), `«${f}» → «${s.texto}»`);
    assert.ok(s.sinRespaldo?.length);
  }
  // Y sin una lectura en el turno, «Ya te abrí la agenda de Google» (P6) sigue siendo un hecho sin respaldo.
  assert.ok(hechoEnElGrupo('Ya te abrí la agenda de Google.').length > 0);
});

test('8. «hecho», «abierto» y «escrito» dependen de QUÉ: una escritura se corta aunque el turno haya leído; una lectura, no', () => {
  // La verificación de 4d1d0a010: sacar «hecho» y «abierto» de la lista dejó pasar escrituras que 8644f121a cortaba.
  for (const f of [
    'He abierto un ticket para el equipo.', 'Abrí un ticket para el equipo.', 'He hecho el cambio de etapa de Juan a Ganado.',
    'He hecho la reserva para el lunes.', 'Hice el cambio de etapa de Juan a Ganado.', 'Te abrí la reunión en Google Meet.',
    'Ya te abrí la agenda de Google.', 'He escrito un mensaje a Juan por WhatsApp.',
  ]) for (const leyo of [false, true]) {
    const s = enElGrupo(f, false, false, leyo);
    assert.ok(s.texto.endsWith(SIN_HACER), `«${f}» (leyó: ${leyo}) salió igual: «${s.texto}»`);
  }
  // Sin una lectura en el turno, lo que queda dicho con «dejé», «ya quedó hecho» o «ya quedó abierto».
  for (const f of ['Te dejé hecho el cambio de Juan.', 'Ya quedó abierto el ticket para el equipo.', 'Ya quedó hecho el cambio.']) {
    assert.ok(enElGrupo(f).texto.endsWith(SIN_HACER), `«${f}» salió igual`);
  }
  // Y lo que se hace o se abre para LEER sigue pasando (test 7), con plurales, sin artículo y con «te/le hice» (la verificación
  // de bb41ede4a: sin «imagen», la respuesta a la foto de Leila salía como «Eso no lo llegué a hacer»).
  for (const f of [
    'He hecho la cuenta y llevas 14 leads este mes.', 'He abierto tu agenda y mañana tienes 2 reuniones.',
    'He abierto la imagen y la cuota de Nadia figura en USD 4235,29.', 'He abierto el archivo y dice que la cuota es USD 97.',
    'He abierto la captura y se ve el error de Fathom.', 'He hecho las cuentas y llevas 14 leads este mes.', 'He hecho los cálculos y te quedan USD 300.',
    'He abierto Google Calendar y mañana tienes 2 reuniones.', 'He abierto el panel y hay 3 leads nuevos.', 'He abierto el reporte de Meta y gastaste USD 40.',
    'He abierto tus campañas y la del webinar va bien.', 'He hecho un chequeo y está todo en orden.', 'He hecho una comparación y octubre va mejor.',
    'He abierto el chat de Juan y pidió la propuesta.', 'He abierto el PDF y dice que la cuota es USD 97.',
  ]) for (const leyo of [false, true]) assert.equal(enElGrupo(f, false, false, leyo).texto, f, `«${f}» (leyó: ${leyo})`);
  // Los pretéritos, con una lectura en el turno.
  for (const f of [
    'Abrí tu agenda y mañana tienes 2 reuniones.', 'Hice las cuentas y llevas 14 leads.', 'Te hice el cálculo y te quedan USD 300.', 'Le hice una búsqueda a Juan y está en Seguimiento.',
    'Abrí tus campañas y la del webinar va bien.', 'Abrí la conversación con Juan y pidió la propuesta.', 'Abrí el Excel que mandaste y son 40 filas.',
  ]) assert.equal(enElGrupo(f, false, false, true).texto, f, `«${f}»`);
  // Lo que se CREA no es una lectura, aunque se nombre igual que algo que se abre.
  assert.ok(enElGrupo('He hecho la campaña del webinar.', false, false, true).texto.endsWith(SIN_HACER));
});

test('6. el doer: cuenta lo que se escribió de verdad (no lo propuesto) y le pasa el respaldo al saneo', () => {
  const doer = leer('lib/mako-doer-in.ts');
  assert.match(doer, /if \(propuesta\) propuestasDelTurno\.set\(propuesta\.id, propuesta\);\n\s*else if \(escribeDeVerdad\(name\) && hizoAlgo\(out\) && [^\n]*\) escribioDelTurno\+\+;/);
  assert.match(doer, /enElGrupo: \{ respaldado: escribioDelTurno > 0, propuesto: propuestasDelTurno\.size > 0, leyo: leyoDelTurno \},/);
  assert.match(doer, /else if \(!escribeDeVerdad\(name\)\) leyoDelTurno = true;/);
  assert.match(doer, /const memo = crearMemoDeAcciones\(escribeDeVerdad\);/);
});

test('9. lo que también se CREA (un reporte, una campaña, una planilla) con «un/una», «nuevo» o «para el equipo» es una escritura', () => {
  // La verificación de 8cb034a18: LO_QUE_SE_ABRE_PARA_LEER sumó reportes, campañas, chats y planillas, y perdonaba «He abierto un
  // reporte del error para el equipo»: la mentira de Leila que dio origen al saneo.
  for (const f of [
    'He abierto una campaña nueva en Meta con USD 10 por día.', 'He abierto un reporte del error para el equipo.', 'Te dejé abierto un reporte para el equipo.',
    'He abierto una conversación con Juan por WhatsApp.', 'He abierto un chat con Juan para mandarle el precio.', 'He abierto una planilla nueva con tus leads.',
    'Te dejé abierta la planilla con los pagos cargados.', 'He abierto un panel nuevo para el cliente.', 'He hecho la verificación de tu número.',
    'He abierto la campaña nueva de Noviembre.', 'He abierto el reporte del error para el equipo.',
  ]) for (const leyo of [false, true]) assert.ok(enElGrupo(f, false, false, leyo).texto.endsWith(SIN_HACER), `«${f}» (leyó: ${leyo}) salió igual`);
  for (const f of ['Ya quedó abierta la campaña de Noviembre.', 'Ya quedó abierto el reporte para el equipo.'])
    assert.ok(enElGrupo(f).texto.endsWith(SIN_HACER), `«${f}» salió igual`);
  // Con una lectura en el turno: lo que se abrió nuevo, y lo que se hizo PARA OTRO.
  for (const f of [
    'Abrí una campaña nueva para Leads Noviembre.', 'Abrí un reporte con el error para soporte.', 'Abrí un archivo nuevo con las tareas de hoy.',
    'Le hice una consulta al equipo de soporte.', 'Les hice un resumen a todos por mail.', 'Les he hecho un resumen.',
  ]) assert.ok(enElGrupo(f, false, false, true).texto.endsWith(SIN_HACER), `«${f}» salió igual`);
  // Las lecturas del test 8 siguen pasando: «el panel y hay 3 leads nuevos» no es un panel nuevo.
  for (const f of ['He abierto el panel y hay 3 leads nuevos.', 'Abrí la conversación con Juan y pidió la propuesta.', 'Le hice una búsqueda a Juan y está en Seguimiento.'])
    assert.equal(enElGrupo(f, false, false, true).texto, f, `«${f}»`);
});

test('10. «nuevo» cuenta como creado sólo PEGADO al objeto: «la planilla de clientes nuevos» se lee', () => {
  // La verificación de 9cef25dba: con «nuevos» dos palabras después, una lectura salía como «Eso no lo llegué a hacer».
  for (const f of ['Abrí la planilla de clientes nuevos y son 4.', 'He abierto el informe de leads nuevos: son 12.'])
    assert.equal(enElGrupo(f, false, false, true).texto, f, `«${f}»`);
  for (const f of ['He abierto la campaña nueva de Noviembre.', 'He abierto el reporte del error para el equipo.'])
    for (const leyo of [false, true]) assert.ok(enElGrupo(f, false, false, leyo).texto.endsWith(SIN_HACER), `«${f}» (leyó: ${leyo})`);
});
