// =============================================================================
// La tab Pagos en BLOQUES (16/10/2026): nada de plata se pierde, y cada bloque se calla cuando no tiene qué decir
// =============================================================================
// Martín (por Cerebro): «la tab de PAGOS que está un desastre también en funcionalidad, no se entiende... NO tengas
// miedo a ELIMINAR todo». La tab era DealDetailsCard entera; ahora es un bloque por cosa (app/crm/lead-view/ficha/
// registro-pagos.tsx). El relevamiento de lo que no se podía perder es la tabla de docs/hallazgos-pagos.md §1. Lo
// que se fija acá:
//   1. las plantillas de la tab (la galería del CRM): cada bloque tiene componente, su ancho es del catálogo y su
//      diseño uno que el bloque dibuja; todas arrancan con el estado de cuenta;
//   2. cuándo se calla cada bloque, EJECUTANDO las reglas: un lead sin compra ve la oferta y los links; un dato que
//      se está pidiendo nunca queda sin dónde cargarse;
//   3. «Leer con IA» llena SÓLO lo vacío (se EJECUTA), y su acción corta sin sesión y con un lead ajeno;
//   4. cada función de plata del relevamiento sigue en un bloque, con la misma acción de server;
//   5. el link de UNA cuota: el asistente manda la cuota y no pregunta lo que la cuota ya dice.
//
// PROBADO ROMPIÉNDOLO (16/10/2026), una rotura por vez con un script que reemplaza en el fuente, corre y restaura.
// Con el código como está: 8 pases, 0 fallos. Rota, cada una da 7 / 1 (las 31 primeras, medidas con 7 tests: 6 / 1):
//   · reglas: `venta` sin regla para callarse; sin el «salvo lo que se pide»; los movimientos sin mirar los cobros;
//     la suscripción dibujada siempre;
//   · plantillas: un diseño que el bloque no dibuja; un ancho que no acepta; la épica sin el estado de cuenta
//     primero; sugerida para un tipo de funnel que no existe;
//   · «Leer con IA»: pisa lo cargado; mezcla las listas; la acción sin mirar de quién es el lead; sin sesión;
//   · los modales: Deshacer aunque quede una diferencia; sin la pregunta de la diferencia; marcar pagada sin mandar
//     qué pasa con ella; el pago suelto por otro camino; la mensualidad por el modal del pago;
//   · los bloques: Deshacer en la cobrada por la pasarela; cancelar la suscripción sin ser admin; la de la pasarela
//     cancelada en el CRM; cancelar sin confirmación; la cuota editada sin su id; los cobros sin lo del admin; un
//     bloque sin la marca de «Solucionar»; un bloque que refresca la página a mano; agregar una cuota sin las vistas;
//     la suscripción a los cobros sin memorizar;
//   · el link de una cuota: como suscripción; sin su paso; preguntando el monto en dólares; sin la cuota.
//   · la API de MaKo sin el estado de cuenta de la tab, o sin los movimientos (crm.run.ts, `cobranza_lead`).
// Correr: node --import tsx --test tests/pagos-tab-bloques.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { bloqueDef, vaEnTab } from '../lib/ficha/catalogo';
import { IDS_PLANTILLA } from '../lib/ficha/plantillas';
import { PLANTILLAS_TAB_PAGOS } from '../lib/ficha/plantillas-pagos';
import { REGLAS_PAGOS } from '../app/crm/lead-view/ficha/reglas-pagos';
import { loQueLlenaElDocumento } from '../lib/pagos-vistazo';
import type { CtxFicha } from '../app/crm/lead-view/ficha/tipos';

const RAIZ = join(__dirname, '..');
// ⚠️ Los comentarios de bloque se sacan sólo si EMPIEZAN la línea: `accept=".pdf,image/*"` abre un «/*» en el medio
// del código, y sacarlo desde ahí se comía medio archivo (y el test pasaba o fallaba por lo que no estaba).
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '').replace(/^[ \t]*\/\/.*$/gm, '');
const DIR = 'app/crm/lead-view/ficha/pagos';
const COBRO = fuente(`${DIR}/bloques-cobro.tsx`);
const DEAL = fuente(`${DIR}/bloques-deal.tsx`);
const PIEZAS = fuente(`${DIR}/piezas.tsx`);
const COBRAR = fuente(`${DIR}/cobrar.tsx`);
type Regla = { estaVacio?: (c: CtxFicha) => boolean; disenos?: readonly string[] };
const R = REGLAS_PAGOS as Record<string, Regla>;

test('las plantillas de la tab: cada bloque tiene componente, ancho del catálogo y un diseño que sabe dibujar', () => {
  assert.ok(PLANTILLAS_TAB_PAGOS.length >= 3, 'el pedido son 2 o 3 plantillas, más la épica');
  assert.equal(new Set(PLANTILLAS_TAB_PAGOS.map((p) => p.id)).size, PLANTILLAS_TAB_PAGOS.length);
  assert.ok(PLANTILLAS_TAB_PAGOS.some((p) => p.epico), 'falta la épica');
  for (const p of PLANTILLAS_TAB_PAGOS) {
    assert.equal(p.tab, 'pagos');
    assert.ok(p.nombre.length <= 20 && p.bajada.length <= 70, `${p.id}: el texto de la tarjeta es largo`);
    assert.equal(p.bloques[0]?.id, 'cobrado', `${p.id}: no arranca con el estado de cuenta (qué debe, qué pagó, qué hago)`);
    assert.equal(new Set(p.bloques.map((b) => b.id)).size, p.bloques.length, `${p.id}: un bloque repetido`);
    for (const s of p.sugeridaPara ?? []) assert.ok(IDS_PLANTILLA.includes(s), `${p.id}: sugerida para «${s}», que no es un tipo de funnel`);
    for (const b of p.bloques) {
      const def = bloqueDef(b.id);
      assert.ok(def && vaEnTab(def, 'pagos'), `${p.id}: «${b.id}» no va en Pagos`);
      assert.ok(R[b.id], `${p.id}: «${b.id}» no tiene componente (no se dibujaría)`);
      if (b.ancho != null) assert.ok(def!.anchos.includes(b.ancho), `${p.id}: «${b.id}» no acepta ancho ${b.ancho}`);
      if (b.diseno != null) assert.ok(R[b.id].disenos?.includes(b.diseno), `${p.id}: «${b.id}» no sabe dibujar «${b.diseno}»`);
    }
  }
});

const ctx = (lead: Record<string, unknown>, data: Record<string, unknown> = {}) => ({
  lead: { id: 1, estado_lead: 'abierto', venta_tipo: null, monto_cierre_usd: null, suscripcion_monto_usd: null, suscripcion_meses: null, fecha_cierre: null, cobro_inicial_usd: null, total_cuotas: null, ...lead },
  data: { pagos: [], cobro: { pasarelaConectada: true, hayCobros: false }, faltantes: [], ...data }, etapa: 'agenda', hoy: '2026-10-16',
}) as unknown as CtxFicha;
const dibuja = (c: CtxFicha) => Object.keys(R).filter((id) => !R[id].estaVacio?.(c));

test('cuándo se calla cada bloque: un lead sin compra ve la oferta y los links; un ganado ve su cobro y su deal', () => {
  assert.deepEqual(dibuja(ctx({})), ['oferta', 'links-de-pago'], 'a un lead que todavía no compró le quedan la oferta y los links');
  const ganado = dibuja(ctx({ estado_lead: 'ganado', monto_cierre_usd: 3000 }));
  for (const id of ['cobrado', 'venta', 'cuotas', 'contrato', 'datos-fiscales', 'servicio-vendido', 'promesa-y-garantia', 'obligaciones']) assert.ok(ganado.includes(id), `un ganado no ve «${id}»`);
  assert.ok(!ganado.includes('suscripcion'), 'la suscripción, sólo en una suscripción');
  assert.ok(!ganado.includes('movimientos'), 'sin plata movida, los movimientos se callan');
  assert.ok(dibuja(ctx({ estado_lead: 'ganado', venta_tipo: 'suscripcion', suscripcion_monto_usd: 800 })).includes('suscripcion'));
  assert.ok(dibuja(ctx({}, { cobro: { pasarelaConectada: true, hayCobros: true } })).includes('movimientos'), 'un link rechazado ya es un movimiento');
  assert.ok(!dibuja(ctx({ estado_lead: 'ganado', venta_tipo: 'sin_cobro' })).includes('cobrado'), 'un becado no tiene estado de cuenta');
});

test('un dato que se está pidiendo nunca queda sin dónde cargarse, aunque el lead no figure ganado', () => {
  const pidiendo = (id: string) => dibuja(ctx({}, { faltantes: [{ id, label: id }] }));
  assert.ok(pidiendo('monto').includes('venta'));
  assert.ok(pidiendo('plan').includes('cuotas'));
  assert.ok(pidiendo('dealFiscal').includes('datos-fiscales'));
  assert.ok(pidiendo('dealFiscalDoc').includes('datos-fiscales'));
  assert.ok(pidiendo('dealServicio').includes('servicio-vendido'));
  assert.ok(pidiendo('dealPromesa').includes('promesa-y-garantia'));
  assert.ok(pidiendo('dealObligaciones').includes('obligaciones'));
  // Y cada bloque pone la marca que busca «Solucionar» sobre su campo.
  for (const [archivo, pasos] of [[COBRO, ['monto', 'plan', 'comprobante']], [DEAL, ['dealFiscal', 'dealFiscalDoc', 'dealServicio', 'dealPromesa', 'dealObligaciones']]] as const) {
    for (const p of pasos) assert.match(archivo, new RegExp(`marcaDato\\('${p}'\\)`), `nadie marca «${p}»`);
  }
});

test('«Leer con IA» llena SÓLO lo vacío: un campo cargado no se pisa, y una lista con renglones no se mezcla', () => {
  const r = loQueLlenaElDocumento(
    { deal_fiscal: { razon: 'Ya cargada SA', id_fiscal: '' }, deal_servicio: null, deal_promesa: { resultado: 'Lo que dijo' }, deal_obligaciones: { cliente: ['Asistir'], prestador: [] } },
    {
      fiscal: { razon: 'Otra SA', id_fiscal: '  XAXX010101000 ', domicilio: null },
      servicio: { que_es: 'Mentoría', duracion: '16 semanas' },
      promesa: { resultado: 'Otro resultado', garantia: 'Si no, devolución' },
      obligaciones: { cliente: ['Hacer la tarea'], prestador: ['Dar 16 sesiones', ' ', 'Responder en 24 h'] },
    },
  );
  assert.deepEqual(r.campos, [
    { seccion: 'fiscal', campo: 'id_fiscal', valor: 'XAXX010101000' },
    { seccion: 'servicio', campo: 'que_es', valor: 'Mentoría' },
    { seccion: 'servicio', campo: 'duracion', valor: '16 semanas' },
    { seccion: 'promesa', campo: 'garantia', valor: 'Si no, devolución' },
  ], 'la razón social y el resultado ya estaban: no se pisan');
  assert.deepEqual(r.obligaciones, [{ parte: 'prestador', texto: 'Dar 16 sesiones' }, { parte: 'prestador', texto: 'Responder en 24 h' }], 'la lista del cliente tenía renglones: no se mezcla');
  assert.deepEqual(r.secciones, ['datos fiscales', 'servicio', 'promesa', 'obligaciones']);
  // Y la acción corta sin sesión, mira que el lead sea del negocio ANTES de escribir, y escribe con los de la tab.
  const acc = fuente(`${DIR}/documento-actions.ts`);
  const fn = acc.slice(acc.indexOf('export async function completarConDocumentoAction'));
  assert.ok(fn.indexOf('if (!(await haySesion()))') > 0 && fn.indexOf('if (!(await haySesion()))') < fn.indexOf('await asegurarLeadDelNegocio(leadId)'));
  assert.ok(fn.indexOf('await asegurarLeadDelNegocio(leadId)') < fn.indexOf('escribirCampoDeal('), 'escribe antes de mirar de quién es el lead');
  assert.match(fn, /escribirObligacion\(leadId, \{ accion: 'agregar', parte: o\.parte, texto: o\.texto \}, quien\)/);
});

test('cada función de plata del relevamiento sigue en un bloque, con la MISMA acción del server', () => {
  // Marcar pagada (comprobante o a mano), con la diferencia de un pago de menos, y Deshacer sólo sin diferencia.
  assert.match(PIEZAS, /fetch\('\/api\/extract-receipt'/);
  assert.match(PIEZAS, /marcarPagoManualAction\(cuota\.id, leadId, \{ monto: p\.monto, fecha, hora: hora \|\| null, resto,/);
  assert.match(PIEZAS, /const falta = p\.ok && p\.monto != null && p\.monto < valorUsd \?/, 'la diferencia se mide contra la cuota, en dólares');
  assert.match(PIEZAS, /\{falta > 0 && \(\s*<div role="radiogroup" aria-label="Qué pasa con la diferencia"/);
  assert.match(PIEZAS, /onHecho\(r\.pendiente != null \? [^\n]*, r\.pendiente == null\)/, 'con diferencia pendiente no hay Deshacer');
  // Un pago que no es una cuota, y la mensualidad de una suscripción manual: el mismo camino (marcarPago).
  assert.match(PIEZAS, /await registrarPagoSueltoAction\(leadId, \{ monto: p\.monto as number, fecha,/);
  assert.match(COBRAR, /registrarMes: \(\) => setAbierto\(\{ que: 'registrar', modo: 'mensualidad'/);
  // El renglón de la cuota: Marcar pagada en las impagas, Deshacer sólo en la cobrada A MANO (la de la pasarela se
  // revierte con «Devolver», en su cobro).
  assert.match(COBRO, /\{r\.accion === 'marcar' && <Button[^\n]*onClick=\{\(\) => cobrar\.marcar\(q\)\}>Marcar pagada<\/Button>\}/);
  assert.match(COBRO, /\{r\.accion === 'deshacer' && <Button[^\n]*onClick=\{\(\) => cobrar\.desmarcar\(q\)\}>Deshacer<\/Button>\}/);
  assert.match(COBRO, /\{q\.pagado && q\.comprobante_path && <Button[^\n]*cobrar\.verComprobante\(q\)/);
  // Editar una cuota POR ID, armar el plan sin ganar el lead, y agregar una sin borrar ni reinsertar las otras.
  assert.match(COBRO, /editarCuotaAction\(lead\.id, q\.id, cambio\)/);
  assert.match(COBRO, /await ajustarPlanAction\(l\.id, nuevo\)/);
  assert.match(COBRAR, /guardarCuotasAction\(ctx\.lead\.id,\s*\[\.\.\.impagas\.map\(\(q\) => \(\{ id: q\.id,[^\n]*\{ id: null, monto: m, fecha \}\],\s*null, impagas\.map\(\(q\) => q\.id\)\)/);
  // Cobrar con link, la lista de cobros con lo del admin, y el link de UNA cuota.
  assert.match(COBRO, /<CobrarConLink lead=\{/);
  assert.match(COBRO, /<CobrosDelLead cobros=\{lista\} error=\{errLeer\} esAdmin=\{!!opciones\?\.ok && opciones\.esAdmin\}/);
  assert.match(COBRAR, /<CobrarCuotaConLink lead=\{leadCobro\} pasarelas=\{pasarelas\} cuota=\{\{ pagoId: q\.id,/);
  // Cancelar una suscripción: sólo el admin, con confirmación; la de la pasarela en la pasarela, la manual en el CRM.
  assert.match(COBRO, /\{ctx\.esAdmin && s\.estado === 'activa' && <Button[^\n]*setPreguntar\(true\)/);
  assert.match(COBRO, /activaPasarela\s*\? await cancelarSuscripcionAction\(activaPasarela\.id\)[\s\S]{0,200}: await cambiarEstadoSuscripcionAction\(lead\.id, 'cancelada'\)/);
  assert.match(COBRO, /<Confirm title="¿Cancelar la suscripción\?"/);
  // La venta, el contrato y los datos del deal: campo por campo, y «Leer con IA».
  assert.match(COBRO, /guardarVentaAction\(lead\.id, c, \{ tipoVisto: tipo \}\)/);
  assert.match(DEAL, /guardarCampoDealAction\(ctx\.lead\.id, \{ seccion, campo, valor: v \|\| null \}\)/);
  assert.match(DEAL, /guardarObligacionAction\(lead\.id, cambio\)/);
  assert.match(DEAL, /useLeerDocumento\(ctx, '\/api\/extract-contract'\)/);
  assert.match(DEAL, /useLeerDocumento\(ctx, '\/api\/extract-deal-fiscal'\)/);
  assert.match(DEAL, /href=\{`\/api\/contract\?leadId=\$\{lead\.id\}`\}/);
});

test('los bloques no refrescan la página a mano y piden los cobros UNA vez por lead', () => {
  for (const f of readdirSync(join(RAIZ, DIR)).filter((x) => /\.tsx?$/.test(x))) {
    const src = fuente(`${DIR}/${f}`);
    assert.doesNotMatch(src, /router\.refresh\(\)/, `${f}: refresca a mano (la ficha se relee con ctx.releer)`);
    if (f !== 'datos.ts') assert.doesNotMatch(src, /cobrosDelLeadAction\(/, `${f}: pide los cobros por su cuenta (van por useCobrosDelLead)`);
  }
  const datos = fuente(`${DIR}/datos.ts`);
  assert.match(datos, /const sub = useCallback\(\(o: \(\) => void\) => suscribir\(leadId, o\), \[leadId\]\);/, 'sin memorizar, una lectura por render');
  assert.match(datos, /if \(primero\) \{ leerCobros\(leadId\); leerOpciones\(leadId\); \}/, 'se lee sólo con el primer bloque que mira');
});

test('una cuota con un link vivo o un recordatorio corriendo lo dice, no ofrece lo que el server rechaza, y el recordatorio se corta', () => {
  // Revisión del 16/10/2026: el server no deja editar una cuota con un recordatorio en curso («córtalo para editarla»)
  // ni cambiar el monto con un link sin pagar, y la tab no tenía dónde cortarlo: un callejón sin salida.
  assert.match(COBRO, /proteccionesDeCuotasAction\(lead\.id\)\.then\(\(p\) => \{ if \(vivo\) setProtegidas\(p\); \}\)/);
  assert.match(COBRO, /const montoEditable = r\.editable && !prot\.includes\('link'\) && !prot\.includes\('recordatorio'\);/);
  assert.match(COBRO, /const fechaEditable = r\.editable && !prot\.includes\('recordatorio'\);/);
  assert.match(COBRO, /\{montoEditable && !editando\s*\? <EnLinea valor=\{String\(Number\(q\.monto_usd\)\)\}/);
  assert.match(COBRO, /\{r\.accion === 'marcar' && prot\.includes\('recordatorio'\) && <Button[^\n]*onClick=\{\(\) => cortar\(q\)\}>Cortar el recordatorio<\/Button>/);
  assert.match(COBRO, /await cortarRecordatoriosCuotaAction\(lead\.id, q\.id\)/);
  const acc = fuente(`${DIR}/cuotas-actions.ts`);
  const fn = acc.slice(acc.indexOf('export async function proteccionesDeCuotasAction'));
  assert.ok(fn.indexOf('if (!(await haySesion())) return {};') > 0 && fn.indexOf('await asegurarLeadDelNegocio(leadId);') > fn.indexOf('haySesion'), 'sin sesión o con un lead ajeno, nada');
});

test('el campo en el lugar guarda UNA vez: Enter y el blur que le sigue no son dos guardados', () => {
  // Revisión del 16/10/2026: la segunda llamada iba contra el valor VIEJO del prop; en una obligación volvía con
  // «otra pestaña lo cambió» sobre lo que sí se guardó.
  const src = fuente(`${DIR}/EnLinea.tsx`);
  const salir = src.slice(src.indexOf('const salir = async () => {'), src.indexOf('const tecla ='));
  assert.ok(salir.indexOf('if (enCurso.current) return;') >= 0 && salir.indexOf('if (enCurso.current) return;') < salir.indexOf('await onGuardar(v)'));
  assert.ok(salir.indexOf('enCurso.current = true;') < salir.indexOf('await onGuardar(v)') && salir.indexOf('enCurso.current = false;') > salir.indexOf('await onGuardar(v)'));
});

test('la API de MaKo cuenta el estado de cuenta y los movimientos con las MISMAS funciones que la tab', () => {
  // AGENTS.md: toda feature nueva va a la API. `cobranza_lead` es la lectura que MaKo usa para «¿qué hago con X?».
  const run = fuente('lib/api-mako/areas/crm.run.ts');
  const cob = run.slice(run.indexOf('cobranza_lead: {'), run.indexOf('cuotas,', run.indexOf('cobranza_lead: {')));
  assert.match(cob, /estadoDeCuenta\(\{ cobrado: cob, pagos: plan\.pagos, ganado: lead\.estado_lead === 'ganado', hoy \}\)/);
  assert.match(cob, /que_hacer: e\.accion \? \{ accion: e\.accion\.tipo, boton: e\.accion\.boton,/);
  assert.match(cob, /movimientosDelLead\(\{ pagos: plan\.pagos, cobros \}\)/);
});

test('el link de UNA cuota: manda la cuota, es un pago único, y en dólares no pregunta el monto', () => {
  const c = fuente('app/crm/[id]/CobrarConLink.tsx');
  assert.match(c, /pagoId: cuota\?\.pagoId \?\? null,/);
  assert.match(c, /const tipo: TipoCobro \| null = cuota \? 'unico' :/);
  assert.match(c, /const necesitaMonto = cuota \? moneda !== 'USD' :/, 'en dólares el valor ES el de la cuota');
  assert.match(c, /const necesitaUsd = !cuota && /, 'el valor en dólares de un link de cuota es el de la cuota, no uno declarado');
  assert.match(c, /\.\.\.\(cuota \? \['cuota' as const\] : \['que' as const\]\),/, 'la cuota tiene su paso (con una pasarela en USD sería el asistente vacío)');
});
