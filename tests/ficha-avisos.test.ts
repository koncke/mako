// =============================================================================
// Los avisos de «datos sin marcar» POR FUNNEL, y el MISMO número en las tres puertas
// =============================================================================
// Decisión 1 de docs/diseno-ficha-bloques.md (14/10/2026): los avisos se guardan por funnel y un lead
// avisa según la ficha de SU funnel (su casa). Y «N sin marcar» de la cabecera de la ficha, la fila del
// lead en «A revisar» y el worklist tienen que contar lo mismo para el mismo lead: hasta ese día la ficha
// no miraba el lead entero ignorado (mig 0109) ni la empresa omitida, y decía «3 sin marcar» sobre un
// lead que no aparecía en «A revisar».
//
// Y el arreglo de los dos ignorados (docs/hallazgos-crm.md, «las dos columnas»): la API de MaKo ignoraba
// en `pendientes_ignorados` y el panel en `datos_ignorados`, así que lo que ignoraba MaKo no salía en «Ver
// más». Ahora las tres escriben por `escribirDatosIgnorados`.
//
// Correr: npx tsx --test tests/ficha-avisos.test.ts
//
// ⚠️ VERIFICADO ROMPIÉNDOLO (14/10/2026, base 7/0), cada rotura restaurada antes de la siguiente:
//   · `ignoradosDelLead` sin el lead entero ignorado (mig 0109)                     → 6 / 1
//   · `ignoradosDelLead` sin la empresa omitida                                       → 6 / 1
//   · «volver a avisar» sin convertir el lead entero ignorado a dato por dato         → 6 / 1
//   · el worklist con `apagadosDelNegocio()` en vez de los del funnel del lead        → 6 / 1
//   · una lectura de los funnels POR LEAD adentro del loop del worklist               → 6 / 1
//   · la API de MaKo escribiendo `pendientes_ignorados` otra vez                       → 6 / 1
//   · `funnel_id` fuera de PENDIENTES_COLS                                             → 6 / 1
//
// Y el panel de avisos de la ficha (15/10/2026, base 8/0), restaurando de memoria:
//   · LeadSheet abre el panel sin el funnel del lead                                  → 7 / 1
//   · LeadDetailBody abre el panel sin el funnel del lead                             → 7 / 1
//   · el panel lee siempre los del negocio                                            → 7 / 1
//   · el panel guarda siempre en el negocio                                           → 7 / 1
//   · «A revisar» abre el panel de un funnel                                          → 7 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  avisanDelLead, partirDatosDelLead, ignoradosDelLead, cambioDeIgnorados, IGNORABLES, NO_IGNORABLES, type IgnoradosDelLead,
} from '../lib/datos-aviso';
import { stepsForStage, pasosResueltos, type Step, type StageReqValues } from '../lib/stage-requirements';
import { filasPorLead } from '../lib/a-revisar-filas';
import { fichaEfectiva, RESPALDO_VACIO } from '../lib/ficha/config';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const tramo = (src: string, desde: string, hasta: string): string => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  return src.slice(i, j < 0 ? undefined : j);
};

// Un lead en Ganado con casi todo por cargar: avisa de muchos datos distintos.
const HOY = '2026-10-14';
const GANADO: StageReqValues = {
  fechaJ1: '2026-10-01', asistioJ1: null, calificado: null, hasFathomUrl: false, fechaJ2: '2026-10-05', asistioJ2: true,
  monto: null, tienePlan: false, dealServicioOk: false, dealPromesaOk: false, dealFiscalOk: false, dealObligacionesOk: false,
  closer: '', setter: '', empresa: '', telefono: '', hoyISO: HOY,
};
const FALTAN: Step[] = stepsForStage('ganado', GANADO);
const RESUELTOS: Step[] = pasosResueltos('ganado', GANADO);

const LEADS: Array<[string, IgnoradosDelLead]> = [
  ['limpio', {}],
  ['dos datos ignorados', { datos_ignorados: ['empresa', 'dealPromesa'] }],
  ['el lead entero ignorado (mig 0109)', { pendientes_ignorados: '2026-09-01T00:00:00Z', datos_ignorados: [] }],
  ['la empresa omitida', { empresa_omitido: true }],
  ['una asistencia «ignorada» a mano', { datos_ignorados: ['asistenciaR1', 'monto'] }],
];
const APAGADOS = [[], fichaEfectiva('carrito', {}, RESPALDO_VACIO).apagados, fichaEfectiva('te-escriben', {}, RESPALDO_VACIO).apagados];

test('la cabecera, «A revisar» y el worklist dan el MISMO número para el mismo lead', () => {
  assert.ok(FALTAN.length >= 12, `el lead de prueba tiene que avisar de muchas cosas (${FALTAN.length})`);
  for (const [nombre, lead] of LEADS) {
    for (const apagados of APAGADOS) {
      const cabecera = partirDatosDelLead(FALTAN, RESUELTOS, lead, apagados).avisar;
      const worklist = avisanDelLead(FALTAN, lead, apagados);
      assert.deepEqual(cabecera.map((d) => d.id), worklist.map((d) => d.id), `${nombre}: la ficha y el worklist`);
      const [fila] = filasPorLead([{ lead_id: 1, lead_nombre: nombre, tipo: 'A', faltantes: worklist }], 12);
      assert.equal(fila.pasos.length, cabecera.length, `${nombre}: la fila de «A revisar»`);
    }
  }
});

test('lo ignorado de un lead: dato por dato, el lead entero y la empresa omitida', () => {
  assert.deepEqual(ignoradosDelLead({ datos_ignorados: ['monto', 'x', 'monto'] }), ['monto']);
  assert.deepEqual(ignoradosDelLead({ pendientes_ignorados: 'ayer' }), [...IGNORABLES], 'el lead entero cuenta como todos ignorados');
  assert.ok(ignoradosDelLead({ empresa_omitido: true }).includes('empresa'));
  // Las asistencias avisan siempre, ignore lo que ignore.
  const entero = avisanDelLead(FALTAN, { pendientes_ignorados: 'ayer' }, []);
  assert.deepEqual(entero.map((d) => d.id), FALTAN.filter((f) => NO_IGNORABLES.has(f.id)).map((f) => f.id));
  assert.ok(entero.length > 0);
});

test('«volver a avisar» cumple lo que dice, también en un lead ignorado entero o con la empresa omitida', () => {
  const viejo: IgnoradosDelLead = { pendientes_ignorados: '2026-09-01T00:00:00Z', datos_ignorados: [] };
  const c = cambioDeIgnorados(viejo, ['monto'], false);
  assert.equal(c.pendientes_ignorados, null, 'se limpia la marca vieja');
  assert.ok(!c.datos_ignorados.includes('monto'));
  assert.equal(c.datos_ignorados.length, IGNORABLES.length - 1, 'lo demás sigue ignorado: no se despierta nada más');
  const despues = avisanDelLead(FALTAN, { ...viejo, ...c }, []).map((d) => d.id);
  assert.ok(despues.includes('monto') && !despues.includes('empresa'));
  const empresa = cambioDeIgnorados({ empresa_omitido: true }, ['empresa'], false);
  assert.equal(empresa.empresa_omitido, false);
  assert.ok(avisanDelLead(FALTAN, { empresa_omitido: false, ...empresa }, []).some((d) => d.id === 'empresa'));
  // Ignorar nunca ignora una asistencia, y lo que ya estaba queda.
  assert.deepEqual(cambioDeIgnorados({ datos_ignorados: ['monto'] }, ['asistenciaR1', 'plan'], true), { datos_ignorados: ['monto', 'plan'] });
  assert.deepEqual(cambioDeIgnorados({}, [...IGNORABLES], true).datos_ignorados, [...IGNORABLES]);
});

test('el worklist cuenta con la ficha del funnel de CADA lead, con UNA lectura de los funnels', () => {
  const q = sinComentarios(leer('lib/queries.ts'));
  const worklist = tramo(q, 'async function _getPendientesDeMarcar', '\nexport ');
  const loop = tramo(worklist, 'for (const l of data) {', '\n  const porTipo');
  assert.match(worklist, /const avisosPorFunnel = await avisosDelWorkspace\(\);/);
  assert.ok(worklist.indexOf('avisosDelWorkspace()') < worklist.indexOf('for (const l of data) {'), 'la lectura de los funnels va ANTES del loop');
  assert.match(loop, /const faltan = avisanDelLead\(faltanRaw, l, avisosPorFunnel\.apagadosDe\(l\.funnel_id\)\);/);
  assert.doesNotMatch(loop, /apagadosDeFunnel|leerFichaDeFunnel|apagadosDelNegocio|from\('funnels'\)/, 'nada de una lectura por lead');
  assert.doesNotMatch(worklist, /apagadosDelNegocio\(\)/, 'los apagados del negocio son el RESPALDO, no la regla');
  const cols = tramo(q, 'const PENDIENTES_COLS', ';');
  assert.match(cols, /'funnel_id'/, 'sin la casa del lead no se sabe de qué funnel son sus avisos');
});

test('la ficha cuenta con la MISMA regla y la ficha de SU funnel', () => {
  const cfg = sinComentarios(leer('lib/datos-aviso-config.ts'));
  const estado = tramo(cfg, 'export async function estadoDatosDeLead', '\n}\n');
  assert.match(estado, /await apagadosDeFunnel\(lead\.funnel_id \?\? null\)/);
  assert.match(estado, /return partirDatosDelLead\(faltan, resueltosDeLead\(lead, tienePlan, extra\), lead, apagados\);/);
  // Las dos lecturas (todo el workspace y un funnel) arman la ficha por el mismo camino.
  const srv = sinComentarios(leer('lib/ficha/config-server.ts'));
  assert.match(tramo(srv, 'export async function avisosDelWorkspace', '\n}\n'), /armar\(f, canal, respaldo\)\.efectiva\.apagados/);
  assert.match(tramo(srv, 'export async function leerFichaDeFunnel', '\n}\n'), /armar\(fila, canal, respaldo\)/);
});

test('la API de MaKo ignora IGUAL que la pantalla: en datos_ignorados, por la misma escritura', () => {
  const helpers = sinComentarios(leer('lib/api-mako/areas/crm.helpers.ts'));
  const run = sinComentarios(leer('lib/api-mako/areas/crm.run.ts'));
  const acciones = sinComentarios(leer('app/crm/datos-sin-marcar-actions.ts'));
  assert.match(tramo(helpers, 'export async function ignorarDatosDeUnLead', '\n}\n'), /escribirDatosIgnorados\(leadId, IGNORABLES, ignorar, autor\)/);
  assert.match(acciones, /await escribirDatosIgnorados\(leadId, pasos, ignorar, await autor\(\)\)/);
  for (const [n, src] of [['crm.helpers', helpers], ['crm.run', run], ['datos-sin-marcar-actions', acciones]] as const) {
    assert.doesNotMatch(src, /pendientes_ignorados:\s*(ignorar|new Date)/, `${n} vuelve a escribir la marca vieja del lead entero`);
    assert.doesNotMatch(src, /\.update\(\{ datos_ignorados/, `${n} escribe lo ignorado por su cuenta`);
  }
  assert.match(tramo(run, 'ignorar_datos_sin_marcar: {', 'reactivar_datos_sin_marcar: {'), /ignorarDatosDeUnLead\(Number\(payload\.leadId\), true, autorDe\(ctx\)\)/);
  assert.match(tramo(run, 'reactivar_datos_sin_marcar: {', 'resolver_confirmacion_crm: {'), /ignorarDatosDeUnLead\(Number\(payload\.leadId\), false, autorDe\(ctx\)\)/);
});

test('el panel de avisos que se abre desde la ficha lee y guarda los de SU funnel; el de «A revisar», los del negocio', () => {
  // Por qué importa: un lead de un funnel de Prospección no avisa de «calificado» (su plantilla lo apaga)
  // aunque el negocio no lo apague. Con los del negocio, el panel lo mostraba prendido (ws9, 15/10/2026).
  assert.ok(fichaEfectiva('prospeccion', {}, RESPALDO_VACIO).apagados.includes('calificado'));
  assert.ok(!RESPALDO_VACIO.apagados.includes('calificado'));
  const modal = sinComentarios(leer('app/crm/lead-view/AvisosDatosModal.tsx'));
  assert.match(modal, /avisosDatosAction\(funnelId\)/, 'el panel no lee los avisos del funnel');
  assert.match(modal, /guardarAvisosDatosAction\(nuevos, funnelId\)/, 'el panel no guarda en el funnel');
  for (const r of ['app/crm/LeadSheet.tsx', 'app/crm/[id]/LeadDetailBody.tsx']) {
    const usos = [...sinComentarios(leer(r)).matchAll(/<AvisosDatosModal\b[\s\S]*?\/>/g)].map((m) => m[0]);
    assert.ok(usos.length > 0, `${r}: ya no abre el panel de avisos`);
    for (const u of usos) assert.match(u, /funnelId=\{lead\.funnel_id \?\? null\}/, `${r}: abre el panel de avisos sin el funnel del lead`);
  }
  // «A revisar» mezcla leads de varios funnels: ahí van los del negocio, el respaldo de todos.
  const gate = [...sinComentarios(leer('app/_components/MakoConfirmGate.tsx')).matchAll(/<AvisosDatosModal\b[\s\S]*?\/>/g)].map((m) => m[0]);
  assert.ok(gate.length > 0, '«A revisar» ya no abre el panel de avisos');
  for (const u of gate) assert.doesNotMatch(u, /funnelId/, '«A revisar» abre el panel de un funnel');
});

test('la escritura de lo ignorado es UNA, en lib, con historial', () => {
  const cfg = sinComentarios(leer('lib/datos-aviso-config.ts'));
  const esc = tramo(cfg, 'export async function escribirDatosIgnorados', '\n}\n');
  assert.match(esc, /cambioDeIgnorados\(antes, pasos, ignorar\)/);
  assert.match(esc, /\.update\(upd\)\.eq\('id', leadId\)/);
  assert.match(esc, /await logLeadEvent\(leadId, 'Datos sin marcar'/);
  assert.match(esc, /select\('datos_ignorados, pendientes_ignorados, empresa_omitido'\)/, 'sin leer las marcas viejas, «volver a avisar» no las limpia');
});
