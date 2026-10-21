// =============================================================================
// Marcar un cobro dos veces no lo cambia, y «hoy» es el día del NEGOCIO (20/10/2026, Pagos, pedido del Cerebro)
// =============================================================================
// Dos cosas de plata que ve un cliente, encontradas al armar la 2.27 (docs/hallazgos-pagos.md):
//   1. `marcarPago` sobre una cuota YA cobrada le reescribía `fecha_pago` (el cobro saltaba de mes) y el historial decía
//      «Pago registrado» otra vez; `cobrarCuota` le reescribía además el monto y la moneda. Ahora no tocan nada y
//      devuelven `yaEstaba`. Pasa con una lista vieja: General en otra pestaña, el Dashboard, el chat con MaKo, una
//      tarjeta confirmada horas después de que alguien la marcó en la ficha.
//   2. Quien llama lo DICE y no ofrece «Deshacer»: deshacer sería desmarcar el cobro de otro.
//   3. La ficha (y Clients, y los modales de cobro) contaban «hoy» en UTC: de 18 a 24 h en México ya era mañana, y una
//      cuota que vence hoy salía vencida en la ficha y no en General ni en MaKo. Ahora es el día del negocio, con la zona
//      de General (`tzActual` → `zonaDelNegocio`). Un guardián barre Pagos y Clients por el patrón.
// El paso 1 corre las funciones REALES contra una base de mentira, con el reloj a las 20 h de México
// (tests/_cobro-idempotente-hijo.ts).
//
// Probado rompiéndolo (20/10/2026, una rotura por vez, restaurando byte a byte): los números, en ROTURAS al final.
//
// Correr: node --import tsx --test tests/pagos-cobro-idempotente.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { hoyEnTz, horaEnTz } from '../lib/date-utils';
import { cobradoDelLead, sumarMeses } from '../lib/cobrado-lead';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '');

type Salida = {
  remarcar: { yaEstaba: boolean }; remarcarEscrituras: number;
  redesmarcar: { yaEstaba: boolean; quitada: boolean }; redesmarcarEscrituras: number;
  recobrar: { yaEstaba: boolean }; recobrarEscrituras: number;
  cobrarSinFecha: { yaEstaba: boolean };
  carreraMarcar: { yaEstaba: boolean }[];
  carreraCobrar: { yaEstaba: boolean; pendiente: number | null }[];
  cuotas: Record<string, { pagado: boolean; fecha_pago: string | null; monto_usd: number; moneda: string | null; monto_original: number | null } | null>;
  filas: number; totales: Record<string, number | null>; pagosDe9: { id?: number; pagado: boolean; monto_usd: number }[]; red: string[];
};
let salida: Salida | null = null;
const correr = (): Salida => {
  salida ??= JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests/_cobro-idempotente-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 120_000,
  })) as Salida;
  return salida;
};

test('1. ⚠️ marcar o cobrar una cuota que YA está cobrada no toca nada; desmarcar una impaga, tampoco', () => {
  const s = correr();
  assert.deepEqual(s.red, [], 'nada sale a la red');
  // La cuota 10 se cobró el 1/10: marcarla otra vez no le cambia la fecha (antes saltaba al 20/10, y el Cash con ella).
  assert.equal(s.remarcar.yaEstaba, true);
  assert.equal(s.remarcarEscrituras, 0, 'ni una escritura');
  // Cobrarla otra vez por otro monto y en pesos, tampoco: ni el monto ni la moneda del cobro que ya entró.
  assert.equal(s.recobrar.yaEstaba, true);
  assert.equal(s.recobrarEscrituras, 0);
  assert.deepEqual(s.cuotas[10], { pagado: true, fecha_pago: '2026-10-01', monto_usd: 500, moneda: null, monto_original: null });
  // Un pago suelto ya desmarcado: desmarcarlo otra vez no lo QUITA (nació cobrado, y quitar es borrarlo).
  assert.equal(s.redesmarcar.yaEstaba, true);
  assert.equal(s.redesmarcar.quitada, false);
  assert.equal(s.redesmarcarEscrituras, 0);
  assert.ok(s.cuotas[11], 'la fila sigue');
  assert.equal(s.filas, 3, 'no se insertó ninguna diferencia');
});

test('2. quien marca lo DICE y no ofrece «Deshacer» (sería desmarcar el cobro de otro); el historial no se repite', () => {
  const acciones = sinComentarios(leer('app/crm/actions.ts'));
  const marcar = acciones.slice(acciones.indexOf('export async function marcarPagoAction('), acciones.indexOf('export async function deleteLeadAction('));
  assert.match(marcar, /const \{ quitada, porLink, yaEstaba \} = await marcarPago\(pagoId, pagado, fechaPago\);\s*if \(yaEstaba\) return \{ quitada: false, yaEstaba: true \};/,
    'ya estaba: vuelve ANTES del historial');
  const deal = sinComentarios(leer('app/crm/[id]/deal-actions.ts'));
  assert.match(deal, /const r = await cobrarCuota\(pagoId, leadId, datos\);\s*if \(r\.yaEstaba\) return \{ pendiente: null, porLink: null, yaEstaba: true \};/);
  // Las cuatro listas que marcan desde afuera de la ficha: sin Deshacer cuando ya estaba.
  for (const [f, dice] of [
    ['app/general/Cobranza.tsx', "if (r.yaEstaba) show('Ya estaba cobrada');"],
    ['app/m/dashboard/CobranzaM.tsx', "if (r.yaEstaba) toast('Ya estaba cobrada');"],
    ['app/dashboard/Detalle.tsx', "if (r.yaEstaba) show('Ya estaba cobrada', undefined, 'good');"],
    ['app/dashboard/entidades/acciones-fila.tsx', "if (r.yaEstaba) show('Ya estaba cobrada', undefined, 'good');"],
  ] as const) assert.ok(sinComentarios(leer(f)).includes(dice), `${f} ofrece Deshacer sobre un cobro que ya estaba`);
  // La ficha: desmarcar lo que ya estaba sin cobrar no ofrece volver a cobrarlo, y el modal lo dice.
  assert.match(sinComentarios(leer('app/crm/lead-view/ficha/pagos/cobrar.tsx')), /if \(yaEstaba\) \{ show\(`\$\{nombreCuota\(q\.numero\)\} ya estaba sin cobrar`\); return; \}/);
  assert.match(leer('app/crm/lead-view/ficha/pagos/piezas.tsx'), /if \(r\.yaEstaba\) \{ onHecho\(`\$\{nombre\} ya estaba cobrada`, false\); return; \}/);
  // MaKo: la tarjeta se confirma hasta dos horas después; si alguien la marcó en el medio, lo dice y no escribe.
  const run = sinComentarios(leer('lib/api-mako/areas/crm.run.ts'));
  const mp = run.slice(run.indexOf('marcar_pago_cobrado: {'), run.indexOf('registrar_pago_suelto: {'));
  assert.match(mp, /if \(r\.yaEstaba\) return \{ ok: true, resumen: YA_ESTABA_COBRADA \};/);
  assert.match(mp, /if \(yaEstaba\) return \{ ok: true, resumen: pagado \? YA_ESTABA_COBRADA : /);
  assert.ok(mp.indexOf('if (yaEstaba)') < mp.indexOf("await logLeadEvent(Number(payload.leadId), pagado ? 'Pago registrado'"), 'antes del historial');
});

test('3. ⚠️ «hoy» es el día del NEGOCIO: a las 20 h de México el cobro sin fecha queda el 20, no el 21 de UTC', () => {
  const s = correr();
  const instante = new Date('2026-10-21T02:00:00Z');
  assert.equal(instante.toISOString().slice(0, 10), '2026-10-21', 'en UTC ya es mañana');
  assert.equal(hoyEnTz('America/Mexico_City', instante), '2026-10-20');
  assert.equal(s.cobrarSinFecha.yaEstaba, false);
  assert.equal(s.cuotas[12]?.fecha_pago, '2026-10-20');

  // La ficha y Clients cuentan el día con la zona de General (el hook de la ficha → `tzActual`), no con el UTC.
  assert.match(sinComentarios(leer('app/crm/lead-view/ficha/FichaPorBloques.tsx')), /const hoy = hoyEnTz\(useTzWorkspace\(\)\);/);
  assert.match(sinComentarios(leer('app/customer-success/PagosCliente.tsx')), /const hoy = hoyEnTz\(useTzWorkspace\(\)\);/);
  assert.match(leer('app/crm/lead-view/useTzWorkspace.ts'), /import \{ tzWorkspaceAction \} from '\.\/tz-workspace';/);
  assert.match(leer('app/crm/lead-view/tz-workspace.ts'), /return tzActual\(\);/);
  // Los modales de cobro proponen ese día.
  const piezas = leer('app/crm/lead-view/ficha/pagos/piezas.tsx');
  assert.equal((piezas.match(/const \[fecha, setFecha\] = useState\(hoy\);/g) ?? []).length, 2, 'Marcar pagada y Registrar pago');
  const cobrar = leer('app/crm/lead-view/ficha/pagos/cobrar.tsx');
  assert.match(cobrar, /<MarcarPagada [^>]*hoy=\{ctx\.hoy\}/);
  assert.match(cobrar, /<RegistrarPago [^>]*hoy=\{ctx\.hoy\}/);
});

test('4. el guardián: ningún «hoy» en UTC en Pagos ni en Clients', () => {
  const PATRON = /new Date\(\)\.toISOString\(\)\.(slice\(0, ?10\)|split\('T'\)\[0\]|substring\(0, ?10\))/;
  const archivos = [
    ...readdirSync(join(RAIZ, 'app/crm/lead-view/ficha/pagos')).map((f) => `app/crm/lead-view/ficha/pagos/${f}`),
    ...readdirSync(join(RAIZ, 'app/customer-success')).filter((f) => /\.tsx?$/.test(f)).map((f) => `app/customer-success/${f}`),
    'app/crm/lead-view/ficha/FichaPorBloques.tsx', 'lib/pagos.ts', 'lib/cobrado-lead.ts', 'lib/pagos-vistazo.ts', 'lib/pagos-campo.ts',
    'lib/suscripciones-por-cobrar.ts', 'lib/pagos-baja.ts',
    // (revisión del 20/10, noche) la cartera de Clients y la del Dashboard, y el asistente de Ganado que arma el plan.
    ...readdirSync(join(RAIZ, 'lib')).filter((f) => /^cs-.*\.ts$/.test(f)).map((f) => `lib/${f}`),
    'lib/graficos-datos-extra.ts', 'app/crm/StageMoveDialog.tsx',
  ];
  assert.ok(archivos.length > 20, `barrió ${archivos.length} archivos`);
  const conUtc = archivos.filter((f) => /\.tsx?$/.test(f) && PATRON.test(sinComentarios(leer(f))));
  assert.deepEqual(conUtc, [], 'el día de hoy sale de la zona del negocio (`hoyEnTz` con `tzActual`, o `hoyEnWorkspace`)');
});

test('5. ⚠️ dos cobros A LA VEZ sobre la misma cuota: gana uno, el otro «ya estaba», y nada queda mezclado', () => {
  const s = correr();
  // Dos «Marcar cobrada» con fechas distintas: uno escribe, el otro no; la fecha es la del que escribió.
  const ganoMarcar = s.carreraMarcar.findIndex((r) => !r.yaEstaba);
  assert.deepEqual(s.carreraMarcar.map((r) => r.yaEstaba).sort(), [false, true], 'uno y sólo uno');
  assert.equal(s.cuotas[20]?.fecha_pago, ['2026-10-20', '2026-10-19'][ganoMarcar]);
  assert.equal(s.totales[8], 500, 'lo cobrado del lead, sincronizado una vez');
  // MaKo cobra 300 (el resto pendiente) mientras la ficha guarda 500 en pesos: la cuota queda con UNO de los dos, entero.
  const ganoCobrar = s.carreraCobrar.findIndex((r) => !r.yaEstaba);
  assert.deepEqual(s.carreraCobrar.map((r) => r.yaEstaba).sort(), [false, true]);
  const c = s.cuotas[21];
  if (ganoCobrar === 0) {
    assert.deepEqual([c?.monto_usd, c?.moneda, c?.fecha_pago], [300, null, '2026-10-20']);
    assert.deepEqual(s.pagosDe9.filter((p) => !p.pagado).map((p) => p.monto_usd), [200], 'la diferencia, una vez');
  } else {
    assert.deepEqual([c?.monto_usd, c?.moneda, c?.monto_original, c?.fecha_pago], [500, 'MXN', 8600, '2026-10-19']);
    assert.deepEqual(s.pagosDe9.filter((p) => !p.pagado), [], 'sin una diferencia que ya no se debe');
  }
  const cobrado = s.pagosDe9.filter((p) => p.pagado).reduce((a, p) => a + p.monto_usd, 0);
  assert.equal(s.totales[9], cobrado, 'lo cobrado del lead coincide con sus cuotas');
  // La escritura que reserva: en marcarPago y en cobrarCuota, condicional y con las filas que tocó.
  const pagos = sinComentarios(leer('lib/pagos.ts'));
  assert.match(pagos, /siSigue\(supabase\.from\('pagos'\)\.update\(\{ pagado, fecha_pago: fecha \}\)\.eq\('id', pagoId\), pagado\)\.select\('id'\)/);
  // (21/10: el «ya estaba» cura lo de después, `yaEstabaAsi`; el test 7 lo prueba.)
  assert.match(pagos, /if \(!tocadas\?\.length\) return yaEstabaAsi\(pagoId, pago, pagado\);/);
  assert.match(pagos, /siSigue\(db\.from\('pagos'\)\.update\(upd\)\.eq\('id', pagoId\)\.eq\('lead_id', leadId\), true\)\.select\('id'\)/);
  const cobrar = pagos.slice(pagos.indexOf('export async function cobrarCuota('), pagos.indexOf('export async function registrarPagoSuelto('));
  assert.doesNotMatch(cobrar, /await marcarPago\(/, 'cobrarCuota no escribe en dos pasos');
  assert.match(cobrar, /await curarDespues\(pagoId, leadId, true, fila\.cobro_id \?\? null\);/, 'y corta los recordatorios como marcarPago');
  assert.match(pagos.slice(pagos.indexOf('async function curarDespues(')), /if \(cobrada\) await trasCobrar\(pagoId, cobroId\);/);
});

test('6. la cartera de Clients y la del Dashboard dicen «vencida» como la ficha; el cobro se anota con la hora del negocio', () => {
  const cartera = sinComentarios(leer('lib/cs-cartera.ts'));
  assert.match(cartera, /const hoy = await hoyEnWorkspace\(\);/);
  assert.match(cartera, /p\.fecha_vencimiento\.slice\(0, 10\) < hoy\)/, 'vencida es ANTES de hoy (no `<=`)');
  assert.match(cartera, /cuotaVencidaDias: vencidaMasVieja \? diasDeCalendario\(vencidaMasVieja, hoy\) : null,/);
  const extra = sinComentarios(leer('lib/graficos-datos-extra.ts'));
  const filas = extra.slice(extra.indexOf('async function filasCartera('), extra.indexOf('\n}\n', extra.indexOf('async function filasCartera(')));
  assert.match(filas, /const hoy = await hoyEnWorkspace\(\)\.catch\(\(\) => hoyEnTijuana\(\)\);/);
  assert.match(filas, /p\.fecha_esperada\.slice\(0, 10\) < hoy\)/, 'la deuda vencida, con la MISMA vara que la cartera');
  // El asistente de Ganado: la primera cuota y las de una suscripción salen del día del negocio.
  const wizard = sinComentarios(leer('app/crm/StageMoveDialog.tsx'));
  assert.match(wizard, /const hoyISO = hoyEnTz\(useTzWorkspace\(\)\);/);
  // (21/10: con el tope de fin de mes y desde la primera cuota, `sumarMesesISO`; el test 8 lo prueba.)
  assert.match(wizard, /sumarMesesISO\(arr\[0\]\?\.fecha \|\| hoyISO, arr\.length\)/, '«+ Agregar cuota» sin cuotas arranca de hoy, no del UTC');
  // La hora: la del negocio, no la del navegador (alguien en Buenos Aires anotaba un cobro de México con su hora).
  const instante = new Date('2026-10-21T03:30:00Z');
  assert.equal(horaEnTz('America/Mexico_City', instante), '21:30');
  assert.equal(horaEnTz('America/Argentina/Buenos_Aires', instante), '00:30');
  const piezas = leer('app/crm/lead-view/ficha/pagos/piezas.tsx');
  assert.match(piezas, /const useHoraDelNegocio = \(\): string => \{ const tz = useTzWorkspace\(\); return horaEnTz\(tz\); \};/);
  assert.equal((piezas.match(/const horaNegocio = useHoraDelNegocio\(\);\s*const \[hora, setHora\] = useState\(horaNegocio\);/g) ?? []).length, 2);
  assert.doesNotMatch(piezas, /toTimeString\(\)/, 'ni una hora del navegador');
});

test('7. ⚠️ los bordes del cobro: una falla no lo deja a medias, el reintento lo cura, y la pasarela no pisa un cobro a mano', () => {
  const s = correr() as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- la salida del hijo, campo por campo
  // El cobro de menos falla en la base: la transacción no escribe NADA (ni la cuota, ni una diferencia FANTASMA que la
  // cobranza le reclamaría al cliente), y el reintento cobra entero, con UNA diferencia.
  assert.match(String(s.leerFalla), /Error cobrando el pago 22/);
  assert.deepEqual([s.leerFallaCuota.pagado, s.leerFallaCuota.monto_usd], [false, 500], 'la cuota sigue impaga, con su monto');
  assert.equal(s.leerFallaFilas, 1, 'sin una diferencia fantasma');
  assert.deepEqual([s.leerFallaReintento.yaEstaba, s.leerFallaReintento.pendiente], [false, 200]);
  assert.deepEqual(s.leerFallaFilasFin, [{ pagado: true, monto_usd: 300 }, { pagado: false, monto_usd: 200 }], 'una sola diferencia');
  // La respuesta se pierde con todo escrito: el reintento dice «ya estaba», cura lo cobrado, y la diferencia está UNA vez.
  assert.match(String(s.ambiguo), /fetch failed/);
  assert.equal(s.ambiguoReintento.yaEstaba, true);
  assert.deepEqual(s.ambiguoFilas, [{ pagado: true, monto_usd: 300 }, { pagado: false, monto_usd: 200 }], 'ni dos diferencias ni ninguna');
  assert.equal(s.ambiguoTotal, 300);
  // Sincronizar falla DESPUÉS de tomarla: el cobro queda, y el reintento dice «ya estaba» y sincroniza lo cobrado.
  assert.match(String(s.sincFalla), /sincronizando total_cobrado del lead 11/);
  assert.equal(s.sincFallaTotal, null);
  assert.equal(s.sincFallaReintento.yaEstaba, true);
  assert.equal(s.sincCuradoTotal, 500, 'el «ya estaba» curó lo cobrado del lead');
  // Otro escritor toma el número de la diferencia: la transacción falla entera (23505) y el reintento numera bien.
  assert.deepEqual([s.choque.yaEstaba, s.choque.pendiente], [false, 200]);
  assert.deepEqual([s.choqueCuota.pagado, s.choqueCuota.monto_usd], [true, 300]);
  const choque = s.choqueFilas as { numero: number; pagado: boolean; monto_usd: number }[];
  assert.deepEqual(choque.filter((p) => !p.pagado).map((p) => [p.monto_usd, p.numero]), [[200, 3]], 'la diferencia, con el número siguiente');
  assert.equal(new Set(choque.map((p) => p.numero)).size, choque.length, 'ningún número repetido');
  // Otro la cobró justo antes: «ya estaba», y no queda ninguna diferencia de un cobro que no fue.
  assert.equal(s.perdio.yaEstaba, true);
  assert.deepEqual(s.perdioFilas, [{ id: 26, pagado: true, monto_usd: 500 }], 'sin una cuota pendiente de un cobro que no fue');
  // La pasarela leyó la cuota impaga y un cobro a mano la tomó antes de que escribiera: entra como cuota NUEVA.
  const filas = s.pasarelaFilas as { id: number; pagado: boolean; proveedor: string | null; cobro_id: number | null; moneda: string | null; monto_original: number | null }[];
  const aMano = filas.find((p) => p.id === 30);
  assert.deepEqual([aMano?.pagado, aMano?.proveedor, aMano?.moneda, aMano?.monto_original], [true, null, 'MXN', 8600], 'el cobro a mano no se pisa');
  const nueva = filas.find((p) => p.id !== 30);
  assert.deepEqual([nueva?.pagado, nueva?.proveedor, nueva?.cobro_id], [true, 'stripe', 77], 'el de la pasarela, aparte');
  assert.notEqual(s.pasarela.pagoId, 30);
  assert.equal(s.pasarelaTotal, 1000, 'entraron dos pagos y se ven los dos');
  // La pasarela marca y sincronizar falla: los recordatorios se cortan IGUAL (primero), y su reintento cura.
  assert.match(String(s.curaFalla), /sincronizando total_cobrado del lead 16/);
  assert.equal(s.curaCortesPrimera, 1, 'cortó antes de que fallara sincronizar');
  assert.equal(s.curaReintento.yaEstaba, true);
  assert.equal(s.curaCortesTotal, 2, 'el «ya estaba» de la pasarela vuelve a cortar');
  assert.equal(s.curaTotal, 500, 'y sincroniza');
  // El casamiento por monto: si la elegida la cobraron a mano en el medio, el pago salda la SIGUIENTE del mismo monto.
  assert.equal(s.casa.pagoId, 44);
  assert.deepEqual(s.casaFilas, [{ id: 43, pagado: true, proveedor: null }, { id: 44, pagado: true, proveedor: 'stripe' }], 'sin una cuota nueva');
  assert.equal(s.casaTotal, 1000);

  const pagos = sinComentarios(leer('lib/pagos.ts'));
  const cobrar = pagos.slice(pagos.indexOf('export async function cobrarCuota('), pagos.indexOf('export async function registrarPagoSuelto('));
  assert.match(cobrar, /if \(pend > 0\) \{\s*const r = await cobrarConResto\(db, \{/, 'un cobro de menos va por la transacción');
  assert.doesNotMatch(cobrar, /\.from\('pagos'\)\.insert\(/, 'la diferencia no es un insert suelto');
  assert.doesNotMatch(cobrar, /update\(\{ pagado: false/, 'nunca devuelve a impaga una cuota que tomó');
  assert.ok(cobrar.indexOf('await asegurarLeadDelNegocio(leadId)') < cobrar.indexOf('await cobrarConResto('), 'el lead es del negocio ANTES de escribir');
  const conResto = pagos.slice(pagos.indexOf('async function cobrarConResto('));
  assert.match(conResto, /db\.rpc\('cobrar_cuota_con_resto', \{ p_ws: ws, \.\.\.p \}\)/);
  assert.match(conResto, /if \(funcionNoExiste\(error\)\) throw new Error\('Un cobro por menos todavía no se puede guardar: falta la migración 0318/);
  assert.match(conResto, /if \(error\.code !== PG_DUPLICADO\) throw/);
  const pasarela = pagos.slice(pagos.indexOf('export async function registrarCobroDeProveedor('), pagos.indexOf('export async function remarcarCobroDeProveedor('));
  assert.doesNotMatch(pasarela, /await marcarPago\(/, 'la pasarela no marca en dos pasos');
  assert.equal((pasarela.match(/siSigue\(db\.from\('pagos'\)\.update\(\{ \.\.\.marca, pagado: true, fecha_pago: p\.fechaPago \}\)/g) ?? []).length, 2, 'la cuota del link y la que casa por monto');
  assert.match(pasarela, /for \(const casa of impagas\) \{/, 'prueba las impagas del mismo monto de a una');
  const cura = pagos.slice(pagos.indexOf('async function curarDespues('), pagos.indexOf('async function trasCobrar('));
  assert.ok(cura.indexOf('await trasCobrar(') < cura.indexOf('await sincronizarTotalCobrado('), 'corta ANTES de sincronizar (cortar no tira)');

  // La función de la transacción (supabase/migrations/0318): la toma condicional y la diferencia, juntas.
  const sql = leer('supabase/migrations/0318_cobrar_cuota_con_resto.sql').replace(/^\s*--.*$/gm, '');
  assert.match(sql, /create or replace function public\.cobrar_cuota_con_resto\(/);
  assert.match(sql, /returns jsonb/);
  assert.match(sql, /security invoker/);
  assert.match(sql, /perform 1 from pagos where lead_id = p_lead and workspace_id = p_ws for update;/);
  assert.match(sql, /where id = p_pago and lead_id = p_lead and workspace_id = p_ws and pagado is not true/);
  assert.match(sql, /if v_id is null then\s*return jsonb_build_object\('tomada', false\);/);
  assert.match(sql, /insert into pagos \(workspace_id, lead_id, numero, monto_usd, fecha_esperada, pagado\)\s*values \(p_ws, p_lead, v_numero, p_resto, p_vence, false\)/);
  assert.match(leer('supabase/migrations/0318_cobrar_cuota_con_resto.sql'), /ORDEN DE DESPLIEGUE: ANTES del código/);
});

test('8. el asistente de Ganado: un mes por cuota desde el cierre, nunca rehace un plan, y el cierre es el día del negocio', () => {
  const desde31 = Array.from({ length: 12 }, (_, i) => sumarMeses('2026-10-31', i));
  assert.deepEqual(desde31.map((f) => f.slice(0, 7)), ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06', '2027-07', '2027-08', '2027-09'], 'ni un mes sin cuota ni uno con dos');
  assert.deepEqual(desde31.slice(0, 5), ['2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28'], 'el tope es el último día, y vuelve al 31');
  // ⚠️ El plan del asistente y lo cobrado cuentan igual: la PRIMERA cuota es el día del cierre. Con la del mes siguiente, un
  // cliente al día quedaba para siempre en «Falta registrar 1 mes».
  const cierre = '2026-10-31';
  for (const hoy of ['2026-10-31', '2026-11-30', '2027-03-31', '2027-09-30']) {
    const pagos = desde31.map((f, i) => ({ id: i + 1, monto_usd: 500, fecha_esperada: f, pagado: f <= hoy, fecha_pago: f <= hoy ? f : null }));
    const c = cobradoDelLead({ ventaTipo: 'suscripcion', montoCierreUsd: null, suscripcionMontoUsd: 500, suscripcionMeses: 12, fechaCierre: cierre, suscripcionCanceladaAt: null, pagos, cobros: [], hoy });
    assert.equal(c.suscripcion?.sinRegistrar, 0, `al día el ${hoy}`);
    assert.notEqual(c.semaforo.tono, 'ambar', `al día el ${hoy}: ${c.semaforo.texto}`);
  }
  const wizard = sinComentarios(leer('app/crm/StageMoveDialog.tsx'));
  assert.match(wizard, /const sumarMesesISO = sumarMeses;/);
  assert.match(wizard, /meses > 0 && totalMonto > 0 && !lead\.tienePlan \? Array\.from\(\{ length: meses \}, \(_, i\) => \(\{ monto: totalMonto, fecha: sumarMesesISO\(hoyISO, i\) \}\)\) : \[\]/);
  // «+ Agregar cuota» cuenta desde la PRIMERA (después de un 31 el día vuelve), no desde la anterior.
  assert.match(wizard, /setCuotas\(\(arr\) => \[\.\.\.arr, \{ monto: '', fecha: sumarMesesISO\(arr\[0\]\?\.fecha \|\| hoyISO, arr\.length\) \}\]\)/);
  assert.deepEqual(['2027-01-31', ...[1, 2, 3].map((n) => sumarMeses('2027-01-31', n))], ['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
  assert.doesNotMatch(wizard, /setUTCMonth/, 'nada de sumar meses a mano');
  // La primera cuota se siembra antes de tener la zona (Tijuana): cuando llega, se corre la que nadie tocó.
  assert.match(wizard, /const hoySembrado = useRef\(hoyISO\);/);
  assert.match(wizard, /setCuotas\(\(arr\) => arr\.map\(\(c, i\) => \(i === 0 && c\.fecha === antes \? \{ \.\.\.c, fecha: hoyISO \} : c\)\)\);/);
  assert.match(wizard, /\}, \[hoyISO\]\);/);
  // ⚠️ El server no rehace un plan que ya existe (volver a confirmar sobre una suscripción ya cerrada rehacía todas sus
  // cuotas desde hoy: deuda inflada y la vencida escondida).
  const acciones = sinComentarios(leer('app/crm/actions.ts'));
  const mover = acciones.slice(acciones.indexOf('export async function completeStageMoveAction('));
  assert.match(mover, /const yaTienePlan = d\.cuotas\?\.length \? \(await getPagosByLead\(id\)\)\.some\(\(q\) => !q\.nacio_cobrada\) : false;/);
  assert.ok(mover.indexOf('if (yaTienePlan) {') > 0 && mover.indexOf('if (yaTienePlan) {') < mover.indexOf('await saveLeadPlanManual(id, {'), 'antes de escribir el plan');
  assert.match(mover, /\} else if \(d\.cuotas\?\.length\) \{\s*const cambios = await saveLeadPlanManual\(id, \{/);
  // El día del cierre: el del negocio (con el UTC, un Ganado de las 19 h en México cerraba mañana).
  assert.match(sinComentarios(leer('lib/leads.ts')), /desenlaceAlGuardar\(actual, input, await hoyEnWorkspace\(\), actual\.venta_tipo\)/);
});

// ROTURAS (20/10/2026). Base: 4 pases, 0 fallos (los tests 1 a 4). Rota (pases / fallos):
//   · `marcarPago` sin la vuelta de «ya estaba»                                       → 3 / 1 (1)
//   · `cobrarCuota` reescribe una cuota cobrada (monto y moneda)                      → 3 / 1 (1)
//   · `marcarPagoAction` escribe el historial aunque ya estaba                         → 3 / 1 (2)
//   · General ofrece Deshacer sobre un cobro que ya estaba                              → 3 / 1 (2)
//   · MaKo confirma y escribe aunque alguien la marcó en el medio                       → 3 / 1 (2)
//   · la ficha ofrece volver a cobrar lo que otra pestaña desmarcó                      → 3 / 1 (2)
//   · `marcarPago` sin fecha vuelve al día UTC                                          → 2 / 2 (3 y 4)
//   · la ficha vuelve a contar hoy en UTC                                               → 2 / 2 (3 y 4)
//   · Clients vuelve a contar hoy en UTC                                                → 2 / 2 (3 y 4)
//   · «Registrar pago» propone el día UTC                                               → 2 / 2 (3 y 4)
//
// ROTURAS de la revisión adversarial (20/10/2026, noche). Base: 6 pases, 0 fallos. Rota (pases / fallos):
//   · `marcarPago` escribe sin condición (en la carrera pasan las dos)               → 5 / 1 (5)
//   · `cobrarCuota` escribe sin condición                                           → 5 / 1 (5)
//   · `marcarPago` ignora que no tocó ninguna fila                                  → 5 / 1 (5)
//   · `cobrarCuota` no corta los recordatorios (`trasCobrar`)                       → 5 / 1 (5)
//   · la cartera de Clients vuelve al día UTC                                       → 4 / 2 (4 y 6)
//   · la cartera vuelve a `<=` (una cuota de HOY, vencida)                          → 5 / 1 (6)
//   · la deuda vencida del Dashboard vuelve a `<=`                                  → 5 / 1 (6)
//   · el asistente de Ganado vuelve al día UTC                                  → 4 / 2 (4 y 6)
//   · «+ Agregar cuota» sin cuotas arranca del instante UTC                     → 5 / 1 (6)
//   · la hora del cobro vuelve a la del navegador                               → 5 / 1 (6)
//
// ROTURAS de la segunda revisión (21/10/2026). Base: 8 pases, 0 fallos. Rota (pases / fallos):
//   · el asistente: `sumarMesesISO` vuelve a desbordar el mes                         → 7 / 1 (8)
//   · «+ Agregar cuota» vuelve a `setUTCMonth`                                       → 6 / 2 (6 y 8)
//   · la primera cuota no sigue al día del negocio cuando llega la zona               → 7 / 1 (8)
//   · la diferencia otra vez DESPUÉS de tomar la cuota, con la vuelta a impaga        → 7 / 1 (7)
//   · la diferencia sin renumerar ante el choque del número                           → 4 / 4 (el hijo tira: 1, 3, 5 y 7)
//   · el «ya estaba» de `cobrarCuota` no cura lo cobrado del lead                     → 7 / 1 (7)
//   · la pasarela marca la cuota del link sin condición                               → 7 / 1 (7)
//   · la diferencia de un cobro que no fue se queda (sin la reconciliación)            → 6 / 2 (5 y 7)
//   · la pasarela no sigue a cuota nueva si la del link ya no estaba impaga            → 7 / 1 (7)
//   (y «si falla la etiqueta»: no se puede romper, `etiquetarPago` no tira; ese try/catch sobraba y salió)
//
// ROTURAS de la tercera revisión (21/10/2026). Base: 8 pases, 0 fallos. Rota (pases / fallos):
//   · el cobro de menos vuelve a la escritura suelta (sin la transacción)            → 6 / 2 (5 y 7)
//   · la transacción sin reintento ante el choque del número                         → 4 / 4 (el hijo tira: 1, 3, 5 y 7)
//   · la función SQL sin la condición «sigue impaga»                                 → 7 / 1 (7)
//   · `curarDespues` sincroniza ANTES de cortar                                      → 7 / 1 (7)
//   · el «ya estaba» de la pasarela sólo sincroniza                                  → 7 / 1 (7)
//   · el casamiento por monto prueba sólo la primera                                 → 7 / 1 (7)
//   · el server vuelve a rehacer un plan que ya existe                               → 7 / 1 (8)
//   · el asistente manda el plan aunque el lead ya tenga uno                         → 7 / 1 (8)
//   · la primera cuota de la suscripción, un mes después del cierre                  → 7 / 1 (8)
//   · «+ Agregar cuota» suma desde la anterior                                       → 6 / 2 (6 y 8)
//   · el día del cierre vuelve al UTC                                                → 7 / 1 (8)
