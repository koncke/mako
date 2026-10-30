// =============================================================================
// Las acciones EN BLOQUE del tablero: pasar a otro funnel, descalificar con motivo, la papelera y la API (28/10/2026)
// =============================================================================
// Tickets #21 y #22 de Leila (los 394 de «Contacto nuevo» de LíderMente): «limpiar la casilla de contacto nuevo… y pasarlo a
// Funnel general» y «Los podemos borrar de ahí». La decisión del Cerebro: elegir varios o la columna entera (con el conteo
// real, sin truncar en 1.000), pasar a otro funnel y etapa avisando a los que agendaron o pagaron, descalificar en bloque,
// «Eliminar» que manda a una papelera de 30 días, el lugar de la difusión, y lo mismo por la API de MaKo con UNA
// confirmación.
//
// Lo de la base (las funciones de la 0340) NO se prueba acá: es SQL dinámico y un regex no prueba que ande. Se prueba contra
// un Postgres de verdad con scripts/probar-0340-pglite.mjs (9 casos, 11 roturas en rojo; ver su cabecera).
//
// PROBADO ROMPIÉNDOLO (28/10/2026): los números, en docs/hallazgos-crm.md → «Acciones en bloque y la papelera».

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DIAS_PAPELERA_LEADS, contarPapelera, diasQuedan, faltaLaPapelera, motivoDePapelera, preguntaDePapelera, textoQuedan,
} from '../lib/leads-papelera-reglas';
import { aPasar, avisosDePasar, etapaSugerida, etapasElegibles, resumenDePasar } from '../lib/pasar-funnel-reglas';
import { seleccionDeDifusion } from '../app/crm/seleccion-difusion';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const tramo = (src: string, desde: string, hasta = '\n}\n') => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  return src.slice(i, src.indexOf(hasta, i));
};

test('1. la papelera: 30 días, cuántos quedan, y la MISMA pregunta en todos lados', () => {
  assert.equal(DIAS_PAPELERA_LEADS, 30);
  const ahora = Date.parse('2026-10-28T12:00:00Z');
  assert.equal(diasQuedan('2026-11-27T12:00:00Z', ahora), 30);
  assert.equal(diasQuedan('2026-10-28T13:00:00Z', ahora), 1, 'la última hora todavía es «queda 1 día»');
  assert.equal(diasQuedan('2026-10-27T12:00:00Z', ahora), 0);
  assert.equal(textoQuedan(0), 'Se borra hoy');
  assert.equal(textoQuedan(1), 'Queda 1 día');
  assert.equal(textoQuedan(12), 'Quedan 12 días');
  const q = preguntaDePapelera(394);
  assert.equal(q.titulo, '¿Mandar 394 leads a la papelera?');
  assert.match(q.mensaje, /30 días/);
  assert.match(q.mensaje, /para siempre/);
  assert.equal(preguntaDePapelera(1, 'Ana').titulo, '¿Mandar a «Ana» a la papelera?');
  // Los tres «Eliminar» de la pantalla dicen lo mismo: la barra, la tarjeta y las dos fichas.
  for (const f of ['app/crm/AccionesLoteLeads.tsx', 'app/crm/CrmBoard.tsx', 'app/crm/LeadSheet.tsx', 'app/crm/[id]/LeadDetailBody.tsx']) {
    const src = sinComentarios(leer(f));
    assert.match(src, /preguntaDePapelera\(/, `${f}: no usa la pregunta de la papelera`);
    assert.doesNotMatch(src, /No se puede deshacer/, `${f}: sigue diciendo que borrar no se deshace`);
    assert.doesNotMatch(src, /Borrar definitivamente/, `${f}: sigue ofreciendo borrar para siempre`);
  }
});

test('2. lo que vuelve de la base se cuenta, y cada «no» dice por qué', () => {
  const r = contarPapelera([
    { lead_id: 1, ok: true }, { lead_id: 2, ok: false, codigo: '23505', error: 'duplicate key' },
    { lead_id: 3, ok: false, codigo: '23505', error: 'duplicate key' }, { lead_id: 4, ok: false, codigo: 'P0002', error: 'x' },
  ], 'recuperar');
  assert.deepEqual(r.ok, [1]);
  assert.equal(r.fallaron, 3);
  assert.equal(r.motivos.length, 2, 'el mismo motivo se dice una vez');
  assert.match(motivoDePapelera({ codigo: '23505' }, 'recuperar'), /volvió a llegar/);
  assert.match(motivoDePapelera({ codigo: 'P0002' }, 'mandar'), /ya no estaba en el CRM/);
  assert.equal(motivoDePapelera({ error: 'papelera: ya no existe la tabla x' }, 'recuperar'), 'ya no existe la tabla x');
  // Sin la migración: la función o la tabla no están.
  assert.ok(faltaLaPapelera({ code: 'PGRST202' }));
  assert.ok(faltaLaPapelera({ code: '42883' }));
  assert.ok(faltaLaPapelera({ message: "Could not find the table 'public.leads_papelera' in the schema cache" }));
  assert.ok(!faltaLaPapelera({ code: '23505', message: 'duplicate key' }));
});

test('3. ⚠️ sin la migración, «Eliminar» NO borra nada: nunca cae al borrado de antes', () => {
  const lib = sinComentarios(leer('lib/leads-papelera.ts'));
  assert.doesNotMatch(lib, /deleteLead|\.delete\(\)/, 'la papelera borra por su cuenta en vez de pasar por la base');
  assert.match(lib, /if \(faltaLaPapelera\(error\)\) throw new Error\(FALTA_LA_PAPELERA\);/, 'sin la función, no lo dice');
  // Corta por tiempo y devuelve lo que no llegó (la regla de los lotes de a uno).
  assert.match(tramo(lib, 'async function enTandas('), /if \(Date\.now\(\) > hasta\) return \{ resultados, pendientes: todos\.slice\(i\) \};/);
  const acc = sinComentarios(leer('app/crm/actions.ts'));
  for (const f of ['deleteLeadAction', 'deleteLeadInlineAction', 'eliminarLeadsAction']) {
    const b = tramo(acc, `export async function ${f}(`);
    assert.doesNotMatch(b, /deleteLead\(/, `${f}: vuelve a borrar para siempre`);
    assert.match(b, /await exigirSesion\(\);/, `${f}: sin sesión`);
    assert.match(b, /mandarUnoAPapelera\(|mandarLeadsAPapelera\(/, `${f}: no manda a la papelera`);
  }
  const el = tramo(acc, 'export async function eliminarLeadsAction(');
  assert.match(el, /const ids = todos\.slice\(0, TOPE_LOTE\);/);
  assert.match(el, /hasta: Date\.now\(\) \+ PRESUPUESTO_LOTE_MS/);
  assert.match(el, /pendientes: \[\.\.\.r\.pendientes, \.\.\.todos\.slice\(TOPE_LOTE\)\]/, 'lo que pasa de 200 se pierde callado');
  assert.match(el, /mandados: r\.hechos/, 'la barra no sabe a quiénes recuperar con el Deshacer');
  // La migración: el negocio en cada consulta, un punto de guardado por lead, y sólo service_role.
  const sql = leer('supabase/migrations/0340_leads_papelera.sql');
  assert.match(sql, /from leads l where l\.id = p_lead and l\.workspace_id = p_ws for update;/);
  assert.match(sql, /ORDEN DE DESPLIEGUE: ANTES del código/);
  assert.equal((sql.match(/exception when others then/g) ?? []).length, 2, 'mandar y recuperar: uno por lead');
  for (const fn of ['mandar_leads_a_papelera', 'recuperar_leads_de_papelera', 'purgar_papelera_leads', 'papelera_leads_uno', 'papelera_leads_fks']) {
    assert.match(sql, new RegExp(`revoke execute on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated;`), `${fn}: la ejecuta cualquiera`);
  }
  assert.match(sql, /revoke all on leads_papelera from anon, authenticated;/);
  // La tabla es de cada negocio: la pantalla la lee con getTenantDb.
  assert.match(leer('lib/workspace.ts'), /^ {2}'leads_papelera',$/m);
  assert.match(leer('lib/tablas-de-inquilino.ts'), /^ {2}'leads_papelera',$/m);
  // Y la purga está agendada (tests/cron-registrado.test.ts lo exige del conjunto; acá, que llame a la de la papelera).
  assert.match(leer('app/api/cron/leads-papelera/route.ts'), /await purgarPapeleraDeLeads\(\)/);
});

test('4. la barra: el Deshacer de la papelera recupera a TODOS los mandados, de a tandas, y vuelve a contar la papelera', () => {
  const barra = sinComentarios(leer('app/crm/AccionesLoteLeads.tsx'));
  const borrar = tramo(barra, "} else if (pide.tipo === 'borrar') {", '\n        }\n');
  assert.match(borrar, /correrEnTandas\(ids, TANDA_LOTE, \(tanda\) => eliminarLeadsAction\(tanda\),/);
  assert.match(borrar, /const mandados = t\.resultados\.flatMap\(\(r\) => r\.mandados\);/);
  assert.match(borrar, /correrEnTandas\(mandados, TANDA_LOTE, \(tanda\) => recuperarLeadsAction\(tanda\)\)/, 'el Deshacer no recupera a todos');
  assert.match(borrar, /if \(v\.error \|\| no\) throw new Error/, 'un Deshacer a medias se lee como hecho');
  assert.match(borrar, /avisarPapelera\(\);/);
  // La tarjeta sola también tiene su Deshacer.
  assert.match(sinComentarios(leer('app/crm/CrmBoard.tsx')), /const v = await recuperarLeadsAction\(\[id\]\)/);
  // La pantalla «Papelera» está en el menú de funnels, se re-cuenta, y no tiene «borrar para siempre».
  const tb = sinComentarios(leer('app/crm/CrmToolbar.tsx'));
  assert.match(tb, /if \(enPapelera > 0\) opciones\.push\(\{ value: PAPELERA, label: `Papelera · \$\{enPapelera\}`, sutil: true \}\);/);
  assert.match(tb, /window\.addEventListener\(EVENTO_PAPELERA, contar\);/, 'el renglón no aparece después de la primera vez');
  const pap = sinComentarios(leer('app/crm/PapeleraLeads.tsx'));
  assert.match(pap, /correrEnTandas\(ids, TANDA_LOTE, \(tanda\) => recuperarLeadsAction\(tanda\)/);
  assert.doesNotMatch(pap, /para siempre[^.]*\}|eliminarEmbudoDefinitivo|Borrar para siempre/, 'la papelera ofrece el botón irreversible');
});

test('5. pasar a otro funnel: la misma etapa si la hay, si no la de entrada; nunca los que pagaron; los agendados sólo si se marca', () => {
  const etapas = [
    { key: 'nuevo', label: 'Nuevo', kind: 'entrada', band: 'pipeline' },
    { key: 'r1', label: 'Reunión 1', band: 'pipeline' },
    { key: 'nut', label: 'Nutrición', band: 'nutricion' },
    { key: 'descal', label: 'Descalificado', band: 'salidas' },
  ];
  assert.deepEqual(etapaSugerida('r1', etapas), { key: 'r1', igual: true });
  assert.deepEqual(etapaSugerida('contacto_nuevo', etapas), { key: 'nuevo', igual: false });
  assert.deepEqual(etapaSugerida('nut', etapas), { key: 'nuevo', igual: false }, 'una nutrición no es un lugar donde caer');
  assert.deepEqual(etapasElegibles(etapas).map((s) => s.key), ['nuevo', 'r1', 'descal']);
  const previa = { agendaron: [2, 3], pagaron: [3, 4], yaEstan: [5] };
  assert.deepEqual(aPasar([1, 2, 3, 4, 5, 5], previa, false), [1, 5]);
  assert.deepEqual(aPasar([1, 2, 3, 4, 5], previa, true), [1, 2, 5], 'el que pagó no pasa ni marcando');
  const avisos = avisosDePasar(previa, [1, 2, 3, 4, 5], 'LíderMente', 'Funnel general');
  assert.equal(avisos.length, 3);
  assert.match(avisos[0], /^2 ya pagaron en «LíderMente»/);
  assert.match(avisos[1], /^1 ya agendó/, 'el que agendó Y pagó se cuenta una vez, en los que pagaron');
  assert.match(avisos[2], /^1 ya estaba en «Funnel general»/);
  assert.deepEqual(avisosDePasar(previa, [1], 'A', 'B'), [], 'un «0 ya pagaron» es ruido');
  assert.equal(resumenDePasar({ pasados: 3, yaEstaban: 1, fallaron: 0, motivos: [] }, 'Funnel general', 'Nuevo'), '3 a «Funnel general» · Nuevo (1 ya estaba ahí)');
});

test('6. ⚠️ pasar NO es el «mover» que se borró: va por agregar + quitar, se pide aparte y frena a los de plata', () => {
  const lf = sinComentarios(leer('lib/lead-funnel.ts'));
  const pasar = tramo(lf, 'export async function pasarAOtroFunnel(');
  assert.match(pasar, /await agregarAProducto\(leadId, hacia, \{ autor: opts\?\.autor, etapa \}\)/, 'no agrega en la etapa elegida');
  assert.match(pasar, /await quitarDeProducto\(leadId, desde, \{ autor: opts\?\.autor, promoverA: hacia \}\)/, 'la casa nueva no es el destino');
  assert.match(pasar, /if \(agregado\) \{\n\s+const \{ error \} = await \(await getTenantDb\(\)\)\.from\('lead_funnel'\)\.delete\(\)\.eq\('lead_id', leadId\)\.eq\('funnel_id', hacia\);/,
    'si no sale del origen, queda en los dos');
  assert.doesNotMatch(pasar, /\.update\(\{ funnel_id/, 'una tercera escritura de la casa');
  // `promoverA` elige ESE funnel como casa, y el guard de plata mira al que de verdad la toma.
  const quitar = tramo(lf, 'export async function quitarDeProducto(');
  assert.match(quitar, /const conPlata = !p\.esCasa \? funnelId : promovido\?\.funnelId \?\? null;/);
  assert.match(quitar, /const nueva = promovido;/);
  // El deshacer devuelve el origen y saca la fila que el pase creó.
  assert.match(tramo(lf, 'export async function deshacerPasar('), /await deshacerQuitar\(d\.quitar, opts\);\n\s+if \(!d\.agregado\) return;/);
  // La pantalla: el desplegable «Funnel» sigue AGREGANDO al toque (tests/leads-por-producto.test.ts) y «Pasar» es su renglón aparte.
  const barra = sinComentarios(leer('app/crm/AccionesLoteLeads.tsx'));
  assert.match(barra, /if \(v === PASAR\) \{ setPide\(\{ tipo: 'pasar' \}\); return; \}/);
  assert.match(barra, /agregarAFunnel\(v === 'default' \? null : Number\(v\)\);/);
  const hoja = sinComentarios(leer('app/crm/PasarAOtroFunnel.tsx'));
  assert.match(hoja, /aPasar\(ids, previa, conAgendados\)/, 'la pregunta pasa a los que pagaron');
  assert.match(hoja, /previaPasarAction\(ids, funnelActivo, fid\)/);
  assert.match(hoja, /correrEnTandas\(lista, TANDA_LOTE,/);
  assert.match(hoja, /const q = await deshacerPasarAction\(tanda\);/);
  // Lo que la pregunta mira: los agendados con la regla de la condición «Agendó», y la plata de la casa Y del CRM.
  const previa = tramo(lf, 'export async function previaDePasar(');
  assert.match(previa, /if \(agendoLead\(l\)\) agendaron\.push\(id\);/);
  assert.match(previa, /if \(casa === desde && \(pagoLead\(l\) \|\| l\.estado_lead === 'ganado'\)\) pagaron\.add\(id\);/);
  assert.match(previa, /for \(const id of await leadsConPlataEn\(desde, ids\)\) pagaron\.add\(id\);/);
});

test('7. descalificar o perder en bloque lleva UN motivo para todos, con el formato del wizard', () => {
  const acc = sinComentarios(leer('app/crm/actions.ts'));
  assert.match(tramo(acc, 'export async function moverLeadsDeEtapaAction('),
    /await setLeadStageAction\(id, stageKey, motivo\?\.trim\(\) \? \{ motivo: motivo\.trim\(\)\.slice\(0, 500\) \} : undefined\)/);
  const barra = sinComentarios(leer('app/crm/AccionesLoteLeads.tsx'));
  assert.match(barra, /const motivo = pideMotivo\(pide\.stage\.key\) && motivoCat \? motivoFinalDe\(motivoCat, motivoDet\) : null;/);
  assert.match(barra, /correrEnTandas\(ids, TANDA_LOTE, \(tanda\) => moverLeadsDeEtapaAction\(tanda, pide\.stage\.key, funnelActivo, motivo\),/);
  assert.match(barra, /motivosDeSalida\(pide\.stage\.key\)\.map\(/, 'los chips no son los de la casa');
});

test('8. la columna entera: más de 1.000 no se truncan, la barra dice de cuál, y la difusión va a la COLUMNA', () => {
  // El tablero lee los agregados paginados (antes, un select solo: PostgREST cortaba en 1.000 sin avisar).
  const filas = tramo(leer('lib/leads.ts'), 'async function filasDeAgregados(');
  assert.match(filas, /await leerTodo<\{ lead_id: number \| string; etapa: string \}>\(supabase, 'lead_funnel', 'lead_id, etapa', \{\s*orden: 'id', filtros: \(q\) => q\.eq\('funnel_id', id\),/);
  assert.doesNotMatch(sinComentarios(filas), /\.from\('lead_funnel'\)\.select/, 'volvió la lectura que corta en 1.000');
  // «Todos los de esta etapa» por la API: la misma regla que la cuenta (`etapaComoTablero`), sobre la lista paginada.
  const ids = tramo(leer('lib/etapas-crm-server.ts'), 'export async function idsDeColumna(');
  assert.match(ids, /listLeadsDeFunnel\(funnelId\)/);
  assert.match(ids, /etapaComoTablero\(l, validas\) === key/);
  // La barra: «Los 394 de «Contacto nuevo»» sólo sin filtros y si lo tildado ES la columna.
  const board = sinComentarios(leer('app/crm/CrmBoard.tsx'));
  assert.match(board, /if \(hayFiltros \|\| !elegidos\.length\) return null;/);
  assert.match(board, /if \(filtered\.filter\(\(l\) => effStage\(l\) === k\)\.length !== elegidos\.length\) return null;/);
  assert.match(board, /columnaEntera=\{columnaEntera\}/);
  assert.deepEqual(seleccionDeDifusion([1, 2], { etapa: 'contacto_nuevo', funnelId: 44 }), { funnelId: 44, etapa: 'contacto_nuevo' });
  assert.deepEqual(seleccionDeDifusion([1, 2], null), { leadIds: [1, 2] });
});

test('9. la API de MaKo: cinco operaciones, al final del área, UNA confirmación con los ids congelados', async () => {
  const { DEFS } = await import('../lib/api-mako/areas/crm.def');
  const ops = ['pasar_en_bloque_otra_columna', 'pasar_en_bloque_otro_funnel', 'mandar_en_bloque_a_papelera', 'ver_papelera_crm', 'recuperar_de_papelera_crm'];
  const ids = DEFS.map((d) => d.id);
  for (const op of ops) assert.ok(ids.includes(op), `falta ${op}`);
  assert.ok(ops.every((op) => ids.indexOf(op) < ids.indexOf('armar_tab_ficha')), 'armar_tab_ficha va última (tests/ficha-tabs.test.ts)');
  const def = (id: string) => DEFS.find((d) => d.id === id)!;
  for (const op of ops.filter((o) => o !== 'ver_papelera_crm')) {
    const d = def(op);
    assert.equal(d.tipo, 'accion');
    assert.equal(d.tipo === 'accion' && d.confirmacion, 'chat', `${op}: no es UNA confirmación`);
    assert.equal(d.gating?.rolMinimo, 'admin', `${op}: un closer lo hace por MaKo`);
    assert.ok(!/\b(mover|cambiar|lead|etapa)\b/.test(op), `${op}: el id suma las palabras de todo pedido (AGENTS.md)`);
  }
  // `reversible: true` exige el camino de vuelta EN la API (AGENTS.md).
  const pap = def('mandar_en_bloque_a_papelera');
  assert.ok(pap.tipo === 'accion' && pap.reversible === true);
  const run = sinComentarios(leer('lib/api-mako/areas/crm.run.ts'));
  for (const op of ops) assert.match(run, new RegExp(`^ {2}${op}: \\{`, 'm'), `${op} sin runner`);
  // Los ids se congelan en `preparar` (la columna entera, paginada) y `ejecutar` trabaja sobre ésos.
  const sel = tramo(run, 'async function seleccionEnBloque(');
  assert.match(sel, /ids = await idsDeColumna\(c\.funnelId, col\.key\)/);
  assert.match(tramo(run, '  mandar_en_bloque_a_papelera: {', '\n  },\n'), /mandarLeadsAPapelera\(idsDe\(payload\.ids\), \{ por: autorDe\(ctx\), hasta: plazoEnBloque\(ctx\) \}\)/);
  assert.match(tramo(run, '  pasar_en_bloque_otro_funnel: {', '\n  },\n'), /const lista = aPasar\(sel\.ids, previa, b\(input\.incluirAgendados\) === true\);/, 'MaKo pasa a los que pagaron');
  // Y lo que no llega en el plazo se dice.
  assert.match(run, /const quedan = \(pendientes: readonly number\[\]\) => \(pendientes\.length \? ` Quedan \$\{pendientes\.length\} que no llegué a tocar/);
  // El de a uno de MaKo y el de la barra mueven por las MISMAS piezas: al agregado, en su fila.
  const bloque = sinComentarios(leer('lib/crm-bloque-server.ts'));
  assert.match(bloque, /if \(real != null\) await moverEtapaEnProducto\(id, real, key, \{ autor: o\.autor, enLote: true \}\);/);
  assert.match(bloque, /requisitos: \{ omitir: OMITIR \}/, 'un movimiento en bloque que saltea lo que la etapa pide sin decirlo');
});
