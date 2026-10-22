// =============================================================================
// «Tipo de etapa» en el «⋯» de cada columna del CRM (21/10/2026)
// =============================================================================
// Martín, textual: «En cada columna, a excepción de las que ya sabes que no deberían cambiar, debes poner en los 3 puntos
// una opción de "Tipo de etapa" para poder decidir si es una etapa de reunión, o las otras que tenemos». Y el Cerebro:
// «si se cambia el tipo de una etapa con leads adentro, decí qué les pasa».
//   1. qué columnas lo llevan (`columnaConTipo`): ni la entrada, ni el cierre, ni las terminales; sí las de Nutrición;
//   2. lo que se dice antes de cambiarlo (`avisoCambioDeTipo`): los leads no se mueven, las reuniones que cambian de
//      número, la tercera sin lugar, el evento que deja de caer ahí, la banda;
//   3. el tablero: la opción en el «⋯» y en el clic derecho, y el pop-up guarda por la MISMA op del pop-up de etapas,
//      con su «Deshacer»;
//   4. la API de MaKo: `cambiar_tipo_etapa`, sólo el admin, con «sí», por la MISMA función que la pantalla.
//
// PROBADO ROMPIÉNDOLO (21/10/2026), con el archivo en 4 / 0, una rotura por vez y restaurada:
//   · `columnaConTipo` sin `puedeTenerTipo` (la entrada cambiaría de tipo)             → 3 / 1
//     (sacar el corte de las terminales NO falla, y está bien: `puedeTenerTipo` también las corta; queda de red)
//   · el aviso sin la línea de los leads que se quedan                                → 3 / 1
//   · el «⋯» con «Tipo de etapa» en TODAS las columnas (sin `columnaConTipo(c) ?`)      → 3 / 1
//   · la API con `cambiarTipo` propio en vez de `cambiarTipoDeEtapa`                  → 3 / 1
// Correr: node --import tsx --test tests/crm-tipo-etapa.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avisoCambioDeTipo, columnaConTipo, tipoDeColumna } from '../lib/etapa-reunion';
import { OPCION_CRM, opcionesCrm } from '../app/crm/menu-contextual-crm';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const RECORRIDO = [
  { key: 'lead', label: 'Lead entrante', kind: 'entrada', band: 'pipeline' },
  { key: 'st0', label: 'Calificado', kind: 'paso', band: 'pipeline' },
  { key: 'agenda', label: 'Agenda R1', kind: 'reunion', band: 'pipeline' },
  { key: 'agendaj2', label: 'Agenda R2', kind: 'reunion', band: 'pipeline' },
  { key: 'st1', label: 'Propuesta', kind: 'paso', band: 'pipeline' },
  { key: 'facturando', label: 'Facturando', kind: 'pago', band: 'pipeline' },
  { key: 'ganado', label: 'Ganado', kind: 'cierre', band: 'pipeline' },
];
const col = (key: string) => RECORRIDO.find((e) => e.key === key)!;

test('qué columnas llevan «Tipo de etapa»: ni la entrada, ni el cierre, ni las terminales', () => {
  assert.equal(columnaConTipo(col('lead')), false, 'la entrada');
  assert.equal(columnaConTipo(col('ganado')), false, 'el cierre');
  for (const k of ['perdido', 'descal', 'noresp']) assert.equal(columnaConTipo({ key: k, label: k, band: 'salida' }), false, k);
  assert.equal(columnaConTipo({ key: 'ganado', label: 'Ganado', kind: 'paso', band: 'pipeline' }), false, 'una terminal aunque digan que es un paso');
  for (const k of ['st0', 'agenda', 'st1', 'facturando']) assert.equal(columnaConTipo(col(k)), true, k);
  // Las de la banda Nutrición, propias o derivadas: con Etapa o Reunión suben al recorrido (como en el pop-up).
  assert.equal(columnaConTipo({ key: 'nutri', label: 'Nutrición No Show R1', band: 'nutricion' }), true);
  assert.equal(tipoDeColumna({ key: 'nutri', label: 'x', band: 'nutricion' }), 'nutricion');
  assert.equal(tipoDeColumna(col('agenda')), 'reunion');
  assert.equal(tipoDeColumna(col('st0')), 'etapa');
});

test('lo que se dice antes de cambiarlo: los leads se quedan, las reuniones que cambian de número, el evento, la banda', () => {
  assert.deepEqual(avisoCambioDeTipo({ recorrido: RECORRIDO, columna: col('st0'), tipo: 'etapa', leads: 9 }), [], 'el mismo tipo: nada que decir');
  // Calificado → Reunión: va ANTES de la R1, así que la corre al segundo lugar y la R2 queda tercera, sin lugar.
  const aR = avisoCambioDeTipo({ recorrido: RECORRIDO, columna: col('st0'), tipo: 'reunion', leads: 12 });
  assert.equal(aR[0], 'Los 12 leads que están acá se quedan en esta etapa.');
  assert.ok(aR.includes('Cada lead que pase por acá lleva la fecha y la asistencia de la reunión.'));
  assert.ok(aR.includes('«Agenda R1» pasa a ser la reunión 2.'));
  assert.ok(aR.includes('Las fechas ya cargadas van por número: pueden verse en otra etapa.'));
  // Propuesta → Reunión: sería la tercera.
  const tercera = avisoCambioDeTipo({ recorrido: RECORRIDO, columna: col('st1'), tipo: 'reunion', leads: 1 });
  assert.equal(tercera[0], 'El lead que está acá se queda en esta etapa.');
  assert.ok(tercera.includes('Sería la tercera reunión del funnel: no tiene dónde guardar la fecha.'));
  assert.ok(!tercera.some((l) => l.includes('Calendly')), 'sin lugar no se le puede asignar un evento');
  // Agenda R1 → Etapa, con un evento vinculado: deja de llevar la reunión, el evento deja de caer y la R2 pasa a ser la 1.
  const baja = avisoCambioDeTipo({ recorrido: RECORRIDO, columna: col('agenda'), tipo: 'etapa', leads: 0, evento: 'Llamada de 30' });
  assert.ok(!baja.some((l) => l.includes('se queda')), 'sin leads no hay nada que decir de ellos');
  assert.ok(baja.includes('Deja de llevar la fecha y la asistencia de la reunión.'));
  assert.ok(baja.includes('Las reservas de «Llamada de 30» dejan de caer acá: vuelven al CRM principal.'));
  assert.ok(baja.includes('«Agenda R2» pasa a ser la reunión 1.'));
  // A Nutrición y de vuelta.
  assert.ok(avisoCambioDeTipo({ recorrido: RECORRIDO, columna: col('st1'), tipo: 'nutricion', leads: 3 }).includes('La columna pasa a la banda Nutrición.'));
  const sube = avisoCambioDeTipo({ recorrido: RECORRIDO, columna: { key: 'nutri', label: 'Nutrición', band: 'nutricion' }, tipo: 'etapa', leads: 2 });
  assert.ok(sube.includes('La columna vuelve al recorrido, antes del cierre.'));
  // Una nutrición que sube como reunión entra ANTES del cierre: después de la R2, es la tercera.
  assert.ok(avisoCambioDeTipo({ recorrido: RECORRIDO, columna: { key: 'nutri', label: 'Nutrición', band: 'nutricion' }, tipo: 'reunion', leads: 0 })
    .includes('Sería la tercera reunión del funnel: no tiene dónde guardar la fecha.'));
});

test('el tablero: «Tipo de etapa» en el «⋯» y en el clic derecho de las columnas que lo llevan, guardado por la op de siempre', () => {
  const b = sinComentarios(leer('app/crm/CrmBoard.tsx'));
  assert.match(b, /\.\.\.\(columnaConTipo\(c\) \? \[\{ value: 'tipo', label: 'Tipo de etapa', icono: 'etapa' as const \}\] : \[\]\),/);
  assert.match(b, /if \(v === 'tipo'\) \{ setTipoDe\(c\.key\); return; \}/);
  assert.match(b, /case 'col_tipo': if \(c\) setTipoDe\(c\.key\); return;/);
  assert.match(b, /tipo: columnaConTipo\(c\),/, 'el clic derecho con la MISMA condición');
  // El pop-up guarda por la op `tipo` (la del pop-up de etapas) y deja deshacer al tipo de antes.
  assert.match(b, /const r = await opEtapa\(\{ op: 'tipo', key: col\.key, tipo \}\);/);
  assert.match(b, /mostrarAviso\(`«\$\{col\.label\}» es \$\{NOMBRE_TIPO_ETAPA\[tipo\]\}`, \(\) => \{ void opEtapa\(\{ op: 'tipo', key: col\.key, tipo: previo \}\); \}\);/);
  assert.match(b, /leads=\{leads\.filter\(\(l\) => effStage\(l\) === col\.key\)\.length\}/, 'los leads de la columna, no los del filtro');
  const m = sinComentarios(leer('app/crm/TipoEtapaModal.tsx'));
  assert.match(m, /const aviso = avisoCambioDeTipo\(\{ recorrido, columna, tipo: elegido, leads, evento \}\);/);
  assert.match(m, /\{TIPOS_ETAPA\.map\(\(t\) => \{/, 'los tres tipos de siempre');
  // El clic derecho.
  assert.equal(OPCION_CRM.col_tipo.texto, 'Tipo de etapa');
  assert.ok(opcionesCrm({ sobre: 'columna', mover: true, entrada: false, curso: null, borrable: true, tipo: true }).includes('col_tipo'));
  assert.ok(!opcionesCrm({ sobre: 'columna', mover: false, entrada: true, curso: null, borrable: false, tipo: false }).includes('col_tipo'));
});

test('la API de MaKo: `cambiar_tipo_etapa`, sólo el admin, con «sí», por la MISMA función que la pantalla', () => {
  const def = sinComentarios(leer('lib/api-mako/areas/crm.def.ts'));
  const i = def.indexOf("id: 'cambiar_tipo_etapa'");
  assert.ok(i > 0, 'la API no declara «Tipo de etapa»');
  const op = def.slice(i, def.indexOf('\n  },', i));
  assert.match(op, /tipo: 'accion', confirmacion: 'chat'/);
  assert.match(op, /gating: TAB_ADMIN/);
  assert.match(op, /enum: \[\.\.\.TIPOS_ETAPA\]/);
  const run = sinComentarios(leer('lib/api-mako/areas/crm.run.ts'));
  const j = run.indexOf('cambiar_tipo_etapa: {');
  const cuerpo = run.slice(j, run.indexOf('ver_campanas_funnels: {', j));
  assert.match(cuerpo, /if \(!columnaConTipo\(col\)\) return \{ error:/, 'la entrada o el cierre cambiarían de tipo');
  assert.match(cuerpo, /const r = await cambiarTipoDeEtapa\(/, 'una segunda forma de guardar un tipo');
  assert.doesNotMatch(cuerpo, /cambiarTipo\(\{/);
  assert.match(cuerpo, /invalidar\('pipeline', 'leads'\);/);
  assert.match(sinComentarios(leer('app/crm/actions.ts')), /const r = await cambiarTipoDeEtapa\(funnelId \?\? null, op\.key, op\.tipo, op\.at\);/, 'la pantalla por la misma');
});
