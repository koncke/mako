// Un CRM nuevo alcanza a sus leads AGREGADOS (21/10/2026, la prospección del Sprint de Mauricio)
// =============================================================================
// «No se debe "Mover" se debe agregar al otro producto» (Martín, 06/10/2026): un lead en varios CRM tiene UNA casa
// (`leads.funnel_id`) y una fila de `lead_funnel` por cada otro. Hasta hoy la cohorte de un CRON por etapa miraba
// sólo la casa: un CRM nuevo con sus 1.094 nunca contactados agregados inscribía a CERO, sin un error.
//
// Lo que se fija acá es la regla de `agregadosQueEntran` (lib/nutricion-ambito.ts), EJECUTADA, y el cableado en el
// motor (lib/nutricion.ts arrastra el runtime de Next y no se importa bajo tsx: del fuente sólo se lee eso).
//
// ⚠️ PROBADO ROMPIÉNDOLO: los números de cada rotura van al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { agregadosQueEntran, ambitoDeSecuencia, type FilaAgregado, type LeadDelAgregado } from '../lib/nutricion-ambito';

const NEGOCIO = 1;
const SPRINT = 40;
const DIA = 86_400_000;
const AHORA = Date.parse('2026-10-21T22:00:00Z');
const CORTE = AHORA - 90 * DIA;
const hace = (dias: number) => new Date(AHORA - dias * DIA).toISOString();

const sprint = ambitoDeSecuencia(SPRINT, false);
const negocio = ambitoDeSecuencia(NEGOCIO, true);

/** La base de Mauricio en chico: todos con casa en el CRM principal (NULL), dados de alta hace meses. */
const LEADS: LeadDelAgregado[] = [
  { id: 11, funnel_id: null, estado_lead: 'abierto' },
  { id: 12, funnel_id: null, estado_lead: 'abierto' },
  { id: 13, funnel_id: null, estado_lead: 'ganado' },
  { id: 14, funnel_id: SPRINT, estado_lead: 'abierto' }, // su casa ES el Sprint
  { id: 15, funnel_id: null, estado_lead: 'abierto' },
  { id: 16, funnel_id: SPRINT, estado_lead: 'abierto' }, // casa en el Sprint, agregado al del negocio
];

const fila = (lead: number, funnel: number, etapa: string, creada: number, desde?: number): FilaAgregado =>
  ({ lead_id: lead, funnel_id: funnel, etapa, created_at: hace(creada), etapa_desde: desde == null ? null : hace(desde) });

test('un lead agregado ayer al Sprint, en su etapa de entrada, ENTRA aunque su alta tenga un año', () => {
  assert.deepEqual(agregadosQueEntran(sprint, ['por_contactar'], CORTE, [fila(11, SPRINT, 'por_contactar', 1)], LEADS), [11]);
});

test('la etapa es la que tiene EN ESE CRM: otra etapa del Sprint no entra', () => {
  assert.deepEqual(agregadosQueEntran(sprint, ['por_contactar'], CORTE, [fila(11, SPRINT, 'contactado', 1)], LEADS), []);
  // Varias etapas pedidas (punto 14): cualquiera.
  assert.deepEqual(agregadosQueEntran(sprint, ['por_contactar', 'contactado'], CORTE, [fila(11, SPRINT, 'contactado', 1)], LEADS), [11]);
});

test('una fila de OTRO CRM no entra a éste', () => {
  assert.deepEqual(agregadosQueEntran(sprint, ['por_contactar'], CORTE, [fila(11, 99, 'por_contactar', 1)], LEADS), []);
});

test('sólo leads abiertos, como en la casa: un ganado agregado no entra', () => {
  assert.deepEqual(agregadosQueEntran(sprint, ['por_contactar'], CORTE, [fila(13, SPRINT, 'por_contactar', 1)], LEADS), []);
  // Un lead que la lectura no trajo (la consulta pide sólo abiertos) tampoco.
  assert.deepEqual(agregadosQueEntran(sprint, ['por_contactar'], CORTE, [fila(77, SPRINT, 'por_contactar', 1)], LEADS), []);
});

test('si su CASA es este CRM, decide la etapa de la casa y la fila se ignora', () => {
  assert.deepEqual(agregadosQueEntran(sprint, ['por_contactar'], CORTE, [fila(14, SPRINT, 'por_contactar', 1)], LEADS), []);
  // El CRM del negocio: un lead con casa NULL (= el del negocio) no entra por una fila del negocio.
  assert.deepEqual(agregadosQueEntran(negocio, ['lead'], CORTE, [fila(12, NEGOCIO, 'lead', 1)], LEADS), []);
  // Y uno con casa en el Sprint, agregado al del negocio, sí: la regla vale para cualquier CRM declarado.
  assert.deepEqual(agregadosQueEntran(negocio, ['lead'], CORTE, [fila(16, NEGOCIO, 'lead', 1)], LEADS), [16]);
});

test('la ventana de 90 días mira cuándo se lo AGREGÓ o se lo movió en ese CRM', () => {
  assert.deepEqual(agregadosQueEntran(sprint, ['por_contactar'], CORTE, [fila(11, SPRINT, 'por_contactar', 100)], LEADS), []);
  assert.deepEqual(agregadosQueEntran(sprint, ['por_contactar'], CORTE, [fila(11, SPRINT, 'por_contactar', 100, 100)], LEADS), []);
  assert.deepEqual(agregadosQueEntran(sprint, ['por_contactar'], CORTE, [fila(11, SPRINT, 'por_contactar', 100, 10)], LEADS), [11]);
  assert.deepEqual(agregadosQueEntran(sprint, ['por_contactar'], CORTE, [fila(11, SPRINT, 'por_contactar', 89)], LEADS), [11]);
});

test('una secuencia SIN CRM declarado (las de antes del ámbito) no suma agregados', () => {
  assert.deepEqual(agregadosQueEntran(ambitoDeSecuencia(null, null), ['por_contactar'], CORTE, [fila(11, SPRINT, 'por_contactar', 1)], LEADS), []);
});

test('sin etapas pedidas, nadie; y nadie dos veces', () => {
  assert.deepEqual(agregadosQueEntran(sprint, [], CORTE, [fila(11, SPRINT, 'por_contactar', 1)], LEADS), []);
  const dos = [fila(11, SPRINT, 'por_contactar', 1), fila(11, SPRINT, 'por_contactar', 2), fila(15, SPRINT, 'por_contactar', 3)];
  assert.deepEqual(agregadosQueEntran(sprint, ['por_contactar'], CORTE, dos, LEADS).sort(), [11, 15]);
});

// ── El cableado: la cohorte de `etapa_actual` suma los agregados, con el MISMO corte de 90 días ──────────────────────
const motor = readFileSync(join(__dirname, '..', 'lib/nutricion.ts'), 'utf8');

test('la cohorte por etapa del motor junta la casa Y los agregados', () => {
  const ini = motor.indexOf("if (triggerTipo === 'etapa_actual') {");
  assert.ok(ini > 0, 'no encontré la rama etapa_actual de cohorteDeTrigger');
  const rama = motor.slice(ini, motor.indexOf("if (triggerTipo === 'instant_form_sin_agenda')", ini));
  assert.match(rama, /if \(ambito\.modo === 'todos'\) return deLaCasa;/, 'sin CRM declarado, sólo la casa (como siempre)');
  assert.match(rama, /agregadosEnEtapa\(supabase, ambito, keys, corte\)/, 'los agregados, con las mismas etapas y el mismo corte');
  assert.match(rama, /new Set\(\[\.\.\.deLaCasa,/, 'unidos sin repetir');
});

test('la lectura de los agregados pide las filas de ESE CRM y sólo leads abiertos', () => {
  const ini = motor.indexOf('async function agregadosEnEtapa(');
  assert.ok(ini > 0, 'no encontré agregadosEnEtapa');
  // El cierre de la función, con CRLF o LF (el árbol de Windows tiene CRLF: con '\n}\n' a secas la rebanada
  // llegaba al final del archivo y el test leía otra función — medido: la rotura 6 daba 0 fallos).
  const fin = /\r?\n\}\r?\n/.exec(motor.slice(ini));
  assert.ok(fin, 'no encontré el cierre de agregadosEnEtapa');
  const cuerpo = motor.slice(ini, ini + fin.index);
  assert.match(cuerpo, /'lead_funnel'/);
  assert.match(cuerpo, /\.eq\('funnel_id', ambito\.id\)/);
  assert.match(cuerpo, /\.eq\('estado_lead', 'abierto'\)/);
  assert.match(cuerpo, /return agregadosQueEntran\(ambito, keys, corteMs, filas, leads\)/);
  assert.match(cuerpo, /throw new Error/, 'una lectura que falla corta la corrida (no sigue con una cohorte a medias)');
});

// ── Las roturas, con su conteo (10 tests; sin romper nada: 10 pases, 0 fallos) ───────────────────────────────────────
// Cada una con un script de node que reemplaza el texto y vuelve a correr este archivo (no `sed -i`: ver
// tests/nutricion-ambito-embudo.test.ts, en este entorno no avisó que no aplicaba).
// 1. Sin el `if (leadEnAmbito(...)) continue` (la casa también por la fila): 1 fallo / 9 pases.
// 2. Sin el filtro de estado (`estado_lead !== 'abierto'`): 1 fallo / 9 pases.
// 3. El hito sin `etapa_desde` (sólo cuándo se lo agregó, no cuándo se lo movió en ese CRM): 1 fallo / 9 pases.
// 4. Sin la salida temprana de `todos`: 0 fallos / 10 pases. Es REDUNDANTE: `todos` no tiene id, así que ninguna fila
//    coincide y sale vacío igual. Queda por claridad; el test de `todos` lo cubre por cualquiera de los dos lados.
// 5. La rama del motor devolviendo `deLaCasa` siempre (lo de antes): 1 fallo / 9 pases.
// 6. La lectura sin `.eq('estado_lead', 'abierto')`: 1 fallo / 9 pases.
