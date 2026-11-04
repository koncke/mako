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
import { cobradoDelLead, siguienteFechaDeCuota, sumarMeses } from '../lib/cobrado-lead';
import { planDelAsistente } from '../lib/pagos-campo';

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
  assert.match(deal, /const r = await cobrarCuota\(pagoId, leadId, datos\);\s*if \(r\.yaEstaba\) return \{ pendiente: null, pendienteEnSuMoneda: null, porLink: null, yaEstaba: true \};/);
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
  // (21/10/2026, mig 0323) Y con el monto que se leyó: el test 12.
  assert.match(pagos, /siSigue\(db\.from\('pagos'\)\.update\(upd\)\.eq\('id', pagoId\)\.eq\('lead_id', leadId\)\.eq\('monto_usd', original\), true\)\.select\('id'\)/);
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
  // (21/10, cuarta revisión: la última + 1 en el día pactado, `siguienteFechaDeCuota`; el test 9 lo prueba.)
  assert.match(wizard, /fecha: siguienteFechaDeCuota\(arr\.map\(\(c\) => c\.fecha\), hoyISO\)/, '«+ Agregar cuota» sin cuotas arranca de hoy, no del UTC');
  assert.equal(siguienteFechaDeCuota([], '2026-10-20'), '2026-10-20');
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
  // (21/10/2026, revisión de 7524ec1c9) La función de ahora es la de la 0323 (con `p_original`): sin ella, eso dice.
  assert.match(conResto, /if \(funcionNoExiste\(error\)\) throw new Error\('Un cobro por menos todavía no se puede guardar: falta la migración 0323/);
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
  // En orden de id, como el delete de la reconciliación (sin orden, los dos podían esperarse: 40P01).
  assert.match(sql, /perform 1 from pagos where lead_id = p_lead and workspace_id = p_ws order by id for update;/);
  assert.match(sql, /where id = p_pago and lead_id = p_lead and workspace_id = p_ws and pagado is not true/);
  assert.match(sql, /if v_id is null then\s*return jsonb_build_object\('tomada', false\);/);
  assert.match(sql, /insert into pagos \(workspace_id, lead_id, numero, monto_usd, fecha_esperada, pagado\)\s*values \(p_ws, p_lead, v_numero, p_resto, p_vence, false\)/);
  assert.match(leer('supabase/migrations/0318_cobrar_cuota_con_resto.sql'), /ORDEN DE DESPLIEGUE: ANTES del código/);
  // ⚠️ Cerrada a la clave pública, como la 0282: el default de la 0280 es por esquema y no le saca el EXECUTE a PUBLIC.
  const firma = 'public\\.cobrar_cuota_con_resto\\(bigint, bigint, bigint, date, text, numeric, text, numeric, boolean, numeric, date\\)';
  assert.match(sql, new RegExp(`revoke execute on function ${firma} from public, anon, authenticated;`));
  assert.match(sql, new RegExp(`grant execute on function ${firma} to service_role;`));
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
  assert.match(wizard, /meses > 0 && totalMonto > 0 && mandaPlanSus \? Array\.from\(\{ length: meses \}, \(_, i\) => \(\{ monto: totalMonto, fecha: sumarMesesISO\(hoyISO, i\) \}\)\) : \[\]/);
  // (21/10, cuarta revisión: «+ Agregar cuota» es la última + 1 en el día pactado; el test 9.)
  assert.deepEqual(['2027-01-31', ...[1, 2, 3].map((n) => sumarMeses('2027-01-31', n))], ['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
  assert.doesNotMatch(wizard, /setUTCMonth/, 'nada de sumar meses a mano');
  // La primera cuota se siembra antes de tener la zona (Tijuana): cuando llega, se corre la que nadie tocó.
  assert.match(wizard, /const hoySembrado = useRef\(hoyISO\);/);
  assert.match(wizard, /setCuotas\(\(arr\) => arr\.map\(\(c, i\) => \(i === 0 && c\.fecha === antes \? \{ \.\.\.c, fecha: hoyISO \} : c\)\)\);/);
  assert.match(wizard, /\}, \[hoyISO\]\);/);
  // ⚠️ El server no rehace un plan que ya existe (volver a confirmar sobre una suscripción ya cerrada rehacía todas sus
  // cuotas desde hoy: deuda inflada y la vencida escondida). Desde la cuarta revisión lo decide `planDelAsistente` (el
  // test 9), y lo que escribe es SU salida, no lo que mandó la pantalla.
  const acciones = sinComentarios(leer('app/crm/actions.ts'));
  const mover = acciones.slice(acciones.indexOf('export async function completeStageMoveAction('));
  assert.match(mover, /const plan = planDelAsistente\(\s*d\.cuotas\.map\(\(c\) => \(\{ monto_usd: c\.monto, fecha_esperada: c\.fecha \}\)\),\s*await getPagosByLead\(id\),/);
  assert.ok(mover.indexOf('const plan = planDelAsistente(') < mover.indexOf('await saveLeadPlanManual(id, {'), 'antes de escribir el plan');
  assert.match(mover, /if \(plan\.cuotas\.length\) \{\s*const cambios = await saveLeadPlanManual\(id, \{[\s\S]*?cuotas: plan\.cuotas,\s*\}\);/);
  // El día del cierre: el del negocio (con el UTC, un Ganado de las 19 h en México cerraba mañana).
  assert.match(sinComentarios(leer('lib/leads.ts')), /desenlaceAlGuardar\(actual, input, await hoyEnWorkspace\(\), actual\.venta_tipo\)/);
});

test('9. ⚠️ un pago suelto previo: nunca nace una cuota por un mes ya cobrado, y lo que no se hizo se DICE', () => {
  const doce = Array.from({ length: 12 }, (_, i) => ({ monto_usd: 500, fecha_esperada: sumarMeses('2026-10-21', i) }));
  const suelto = (f: string) => ({ pagado: true, nacio_cobrada: true, monto_usd: 500, fecha_esperada: f, fecha_pago: f });
  const fichaDel = (hoy: string, cierre: string, pagos: { monto_usd: number; fecha_esperada: string | null; pagado: boolean; fecha_pago?: string | null }[]) =>
    cobradoDelLead({ ventaTipo: 'suscripcion', montoCierreUsd: null, suscripcionMontoUsd: 500, suscripcionMeses: 12, fechaCierre: cierre, suscripcionCanceladaAt: null, pagos: pagos.map((p, i) => ({ id: i + 1, fecha_pago: null, ...p })), cobros: [], hoy });

  // Caso 1: suscripción cerrada el 01/08, registrada mes a mes (3 sueltas). El 21/10 alguien abre el asistente: los 3
  // meses cobrados SON las primeras cuotas, y se arman las 9 que faltan, desde el día del cierre. Antes: 12 más (15).
  const mesAMes = ['2026-08-01', '2026-09-01', '2026-10-01'].map(suelto);
  const p1 = planDelAsistente(doce, mesAMes, { suscripcion: true, ancla: '2026-08-01' });
  assert.equal(p1.yaCobradas, 3);
  assert.equal(p1.cuotas.length, 9, '12 del plazo, ni una más');
  assert.deepEqual([p1.cuotas[0].fecha_esperada, p1.cuotas[8].fecha_esperada], ['2026-11-01', '2027-07-01'], 'el mes siguiente al último cobrado, hasta el fin del plazo');
  const f1 = fichaDel('2026-10-22', '2026-08-01', [...mesAMes, ...p1.cuotas.map((c) => ({ ...c, pagado: false }))]);
  assert.deepEqual([f1.semaforo.tono, f1.pendienteUsd, f1.vencidoUsd], ['verde', 4500, 0], `al día al otro día: ${f1.semaforo.texto}`);
  assert.ok(p1.cuotas.every((c) => (c.fecha_esperada as string) < (f1.suscripcion?.finPlazo as string)), 'ninguna fuera del plazo');

  // Caso 2: pagó el primer mes suelto HOY y se arrastra a Ganado (el cierre es hoy): la cuota de hoy no se duplica.
  const p2 = planDelAsistente(doce, [suelto('2026-10-21')], { suscripcion: true, ancla: '2026-10-21' });
  assert.deepEqual([p2.cuotas.length, p2.cuotas[0].fecha_esperada], [11, '2026-11-21'], 'la primera cuota es el mes que viene');
  const f2 = fichaDel('2026-10-22', '2026-10-21', [suelto('2026-10-21'), ...p2.cuotas.map((c) => ({ ...c, pagado: false }))]);
  assert.equal(f2.semaforo.tono, 'verde', `no «Cuota vencida» al otro día: ${f2.semaforo.texto}`);

  // Caso 3 (baja 4): sin pagos, armado el 21/10 sobre un Ganado del 01/10: las fechas van desde el CIERRE, no desde hoy.
  const p3 = planDelAsistente(doce, [], { suscripcion: true, ancla: '2026-10-01' });
  assert.deepEqual(p3.cuotas.slice(0, 2).map((c) => c.fecha_esperada), ['2026-10-01', '2026-11-01']);
  const f3 = fichaDel('2026-11-05', '2026-10-01', p3.cuotas.map((c) => ({ ...c, pagado: (c.fecha_esperada as string) <= '2026-11-05', fecha_pago: c.fecha_esperada })));
  assert.equal(f3.suscripcion?.sinRegistrar, 0, `el 05/11 pagó lo de octubre y noviembre: ${f3.semaforo.texto}`);

  // Con un plan (una cuota que no nació cobrada, o una impaga), no se toca y se dice.
  for (const existentes of [[{ pagado: false, nacio_cobrada: false }], [{ pagado: true, nacio_cobrada: false }], [{ pagado: false, nacio_cobrada: true }]]) {
    const p = planDelAsistente(doce, existentes, { suscripcion: true, ancla: '2026-10-21' });
    assert.deepEqual([p.cuotas.length, p.aviso], [0, 'Ya tenía un plan de pagos: no se cambió. Se edita en la pestaña Pagos.']);
  }
  // Un pago único con un pago previo: las cuotas las escribió la persona; no se arman, y se dice. Sin pagos, tal cual.
  const unico = [{ monto_usd: 1000, fecha_esperada: '2026-10-21' }, { monto_usd: 2000, fecha_esperada: '2026-11-05' }];
  const p4 = planDelAsistente(unico, [suelto('2026-10-10')], { suscripcion: false, ancla: '2026-10-21' });
  assert.equal(p4.cuotas.length, 0);
  assert.match(String(p4.aviso), /Ya tenía pagos cobrados: el plan no se armó/);
  assert.deepEqual(planDelAsistente(unico, [], { suscripcion: false, ancla: '2026-08-01' }).cuotas, unico, 'las fechas que eligió la persona');

  // El server escribe la salida de `planDelAsistente` y DEVUELVE el aviso; el asistente lo muestra antes de cerrar.
  const acciones = sinComentarios(leer('app/crm/actions.ts'));
  const mover = acciones.slice(acciones.indexOf('export async function completeStageMoveAction('), acciones.indexOf('// 4) Deal Details'));
  assert.match(mover, /\{ suscripcion: \(d\.ventaTipo \?\? before\?\.venta_tipo\) === 'suscripcion', ancla: before\?\.fecha_cierre\?\.slice\(0, 10\) \|\| \(await hoyEnWorkspace\(\)\) \}/);
  assert.match(mover, /if \(plan\.aviso\) sinTocar = plan\.aviso;/);
  assert.doesNotMatch(mover, /console\.log\(/, 'lo que no se hizo no se calla');
  const wizard = sinComentarios(leer('app/crm/StageMoveDialog.tsx'));
  assert.match(wizard, /if \(r\.sinTocar\) \{ setAviso\(\{ texto: r\.sinTocar, r \}\); return; \}\s*onDone\(r\);/);
  // El aviso es otra pantalla, con un solo botón que cierra: «Entendido» no vuelve a guardar, y no hay Atrás.
  const pantalla = wizard.slice(wizard.indexOf('  if (aviso) {'), wizard.indexOf('\n  }\n', wizard.indexOf('  if (aviso) {')));
  assert.match(pantalla, /const salir = \(\) => onDone\(aviso\.r\);/);
  for (const prop of ['onConfirmar', 'onClose', 'onAtras', 'onSiguiente']) assert.match(pantalla, new RegExp(`${prop}=\\{salir\\}`), prop);
  assert.match(pantalla, /hideAtras/);
  assert.doesNotMatch(pantalla, /confirmar\b/, 'ningún camino vuelve a confirmar');
  assert.ok(wizard.indexOf('  if (aviso) {') > wizard.indexOf('const tocado = useRef(false);'), 'después del último hook');
  // La suscripción manda su plan al cerrar o si se preguntó la mensualidad o el plazo (no al completar el teléfono), y
  // sin `!lead.tienePlan`: el tablero no lo sabe; decide el server, igual desde el tablero que desde la ficha.
  assert.match(wizard, /const mandaPlanSus = \(to === 'ganado' && !completarDatos\) \|\| pide\('monto'\) \|\| pide\('susPlazo'\);/);
  assert.doesNotMatch(wizard, /!lead\.tienePlan/);
  // Sin `tienePlan` (el tablero), «Plan de pagos» lo pide sólo el server, que lee los pagos.
  assert.match(wizard, /const local = lead\.tienePlan === undefined \? placeholder\.filter\(\(s\) => s\.id !== 'plan'\) : placeholder;/);
  assert.match(wizard, /unirPasos\(local, reqServer, faltanServer\)/);

  // Baja 5: «+ Agregar cuota» es la ÚLTIMA + 1 mes en el día pactado, sin repetir una fecha.
  assert.equal(siguienteFechaDeCuota(['2026-10-21', '2026-11-05'], '2026-10-21'), '2026-12-05', 'anticipo el 21, mensualidades el 05');
  assert.equal(siguienteFechaDeCuota(['2026-10-21', '2026-11-05', '2026-12-05'], '2026-10-21'), '2027-01-05');
  assert.equal(siguienteFechaDeCuota(['2026-10-21', '2026-12-21'], '2026-10-21'), '2027-01-21', 'quitada la del medio, no repite el 21/12');
  assert.equal(siguienteFechaDeCuota(['2026-10-21', '2026-12-21', '2026-11-21'], '2026-10-21'), '2027-01-21', 'desde la más tardía, no la última de la lista');
  assert.equal(siguienteFechaDeCuota(['2026-10-21'], '2026-10-21'), '2026-11-21');
  assert.equal(siguienteFechaDeCuota(['2026-10-31', '2026-11-30'], '2026-10-31'), '2026-12-31', 'un 30/11 que vino de un 31');
  assert.equal(siguienteFechaDeCuota(['2027-01-31', '2027-02-28'], '2027-01-31'), '2027-03-31');
  assert.equal(siguienteFechaDeCuota(['2026-10-21', '', '2026-11-21'], '2026-10-21'), '2026-12-21', 'una fila sin fecha no cuenta');
});

test('10. ⚠️ quinta revisión: lo que gana lleva su cierre, el plan uniforme no tapa cuotas con una seña, y no tomarla no es «ya estaba»', () => {
  const s = correr() as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- la salida del hijo, campo por campo
  // Una suscripción ganada desde el asistente con su plan quedaba con `fecha_cierre` NULL: no contaba en los cierres del
  // mes, el MRR la daba activa para siempre y nunca «Terminó». Ahora, el día del NEGOCIO (las 20 h del 20/10 en México).
  assert.equal(s.cierreNuevo, '2026-10-20');
  assert.equal(s.cierreQueTenia, '2026-10-01', 'la que ya tenía no se toca');
  // La seña de 100 (número 1) tapaba la cuota 1 de 1000 y la API decía «Listo» con 900 menos: ahora no se arma, y se dice.
  assert.match(String(s.unifSena), /Ya tenía pagos cobrados: el plan no se armó/);
  assert.equal(s.unifSenaFilas, 1, 'no se escribió nada');
  // Con un plan y una seña en el número 2, el plan entero (1000 + 3 × 1000) queda por cobrar: la seña no tapa la cuota 2.
  assert.equal(s.unifPlan, 4000);
  assert.deepEqual(s.unifPlanNumeros, [0, 1, 2, 3, 4], 'ningún número repetido');
  // La cuota se borra mientras se cobra (entera y por menos): no es «ya estaba», y no se escribe nada.
  for (const k of ['borradaEntera', 'borradaMenos']) assert.match(String(s[k]), /La cuota cambió mientras la cobrabas/, k);
  assert.equal(s.borradaMenosFilas, 0, 'ni una diferencia de un cobro que no se anotó');
  // Menos de un centavo: ni el cobro entero, ni en 0.
  assert.match(String(s.centavo), /al menos un centavo/);
  assert.deepEqual([s.centavoCuota.pagado, s.centavoCuota.monto_usd], [false, 500]);

  const pagos = sinComentarios(leer('lib/pagos.ts'));
  const cobrar = pagos.slice(pagos.indexOf('export async function cobrarCuota('), pagos.indexOf('export async function registrarPagoSuelto('));
  assert.doesNotMatch(cobrar, /return yaCobrada\(\);\s*\} else \{|if \(!tomada\?\.length\) return yaCobrada\(\);/, 'no tomarla pasa por `noTomada`');
  assert.equal((cobrar.match(/return noTomada\(\);/g) ?? []).length, 2, 'la transacción y la escritura entera');
  const modal = leer('app/crm/lead-view/ficha/pagos/piezas.tsx');
  assert.match(modal, /const r = Number\.isFinite\(n\) && n > 0 \? Math\.round\(n \* 100\) \/ 100 : 0;\s*return r > 0 \? r : null;/, 'el modal dice «falta el monto»');
  // MaKo no propone el plan uniforme encima de plata suelta (y `savePlanPagos` igual lo frena).
  const run = sinComentarios(leer('lib/api-mako/areas/crm.run.ts'));
  const gpp = run.slice(run.indexOf('  guardar_plan_pagos: {'), run.indexOf('  guardar_cuotas: {'));
  assert.match(gpp, /const sueltos = avisoPlanUniforme\(await getPagosByLead\(lead\.id\)\);\s*if \(sueltos\) return \{ error: sueltos \};/);
  // El tablero pide el plan con el tipo de venta que se ELIGE (pasar de suscripción a pago único lo pide).
  const acciones = sinComentarios(leer('app/crm/actions.ts'));
  assert.match(acciones, /tienePagos\(pagosExistentes\) \|\| \(d\.ventaTipo \?\? before\?\.venta_tipo\) === 'suscripcion'\)/);
  const wizard = sinComentarios(leer('app/crm/StageMoveDialog.tsx'));
  assert.match(wizard, /ventaTipo,\s*\}\)\s*\.then\(\(r\) => \{ if \(vivo\) setReqServer\(r\); \}\)/);
  assert.match(wizard, /\}, \[lead\.id, to, move\.asistioJ1, move\.asistioJ2, yaCalificado, yaMotivo, ventaTipo\]\);/);
});

test('11. ⚠️ revisión de 7524ec1c9: «Cambiar el plan» de la ficha sobre una seña por link o sobre la diferencia de un cobro por menos', () => {
  const s = correr() as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- la salida del hijo, campo por campo
  // La seña de US$100 cobrada por un link sin cuota nace cobrada: no es una cuota del plan.
  assert.deepEqual(s.senaLinkFila, [{ numero: 1, pagado: true, proveedor: 'stripe', nacio_cobrada: true }]);
  // «Armar el plan» 1000 + 3 × 1000 encima: 4000. La cuota a 1200: 4600 (antes 4400: la seña tapaba la cuota 1 y la
  // última quedaba en 1000). El día 10: una cuota por mes (antes noviembre quedaba sin cuota y enero con dos).
  assert.equal(s.senaLinkArmado, 4000);
  assert.equal(s.senaLink1200, 4600);
  assert.deepEqual(s.senaLinkDia10, { deuda: 4600, vencen: ['2026-11-10', '2026-12-10', '2027-01-10'] });
  // La cuota 1 cobrada por 600: la diferencia de 400 nace marcada con la cuota de la que sale, con su vencimiento. El plan
  // pasa a 4 cuotas y al día 10: 1000 + 3 × 1000 + 400 = 4400 (antes 5000: la diferencia se reescribía como la cuota 4 y
  // la nueva quedaba intacta). Con un pago suelto antes (26: la regresión) y sin él (27: venía de antes).
  for (const lead of [26, 27]) {
    assert.deepEqual(s[`resto${lead}Fila`], [{ monto_usd: 400, fecha_esperada: '2026-11-05', resto_de: true }], `${lead}`);
    assert.equal(s[`resto${lead}Crecio`], 4400, `${lead}`);
    assert.deepEqual(s[`resto${lead}Dia10`], { deuda: 4400, vencen: ['2026-12-10', '2027-01-10', '2027-02-10'] }, `${lead}`);
  }
  // La regla es UNA (`esCuotaDelPlan`), y la fila dice de dónde nació desde que se inserta.
  assert.match(sinComentarios(leer('lib/cobrado-lead.ts')), /export const esPlataSuelta = [^\n]*\n\s*!!q\.pagado && !esCuotaDelPlan\(q\);/);
  assert.match(sinComentarios(leer('lib/pagos-campo.ts')), /existentes\.filter\(\(x\) => esCuotaDelPlan\(x\) && !x\.devuelta\)/);
  const pagos = sinComentarios(leer('lib/pagos.ts'));
  // (29/10/2026) La forma vive en `cuotaExistenteDe` (lib/pagos-campo.ts), la misma con que MaKo simula la reconciliación.
  assert.match(sinComentarios(leer('lib/pagos-campo.ts')), /nacio_cobrada: !!q\.nacio_cobrada, resto_de: q\.resto_de \?\? null,/, 'la reconciliación recibe la marca');
  assert.match(pagos, /return pagos\.map\(\(q\) => cuotaExistenteDe\(q, prot\.get\(q\.id\) \?\? \[\]\)\);/, 'el server no arma sus cuotas con esa forma');
  const pasarela = pagos.slice(pagos.indexOf('export async function registrarCobroDeProveedor('), pagos.indexOf('export async function remarcarCobroDeProveedor('));
  assert.match(pasarela, /fecha_pago: p\.fechaPago,\s*nacio_cobrada: true,\s*\.\.\.marca,/, 'el cobro de un link sin cuota nace cobrado');
  // La 0323: la columna, sin clave foránea, y la función de la 0318 con `p_original`, que la escribe.
  const MIG = 'supabase/migrations/0323_cobrar_cuota_original_y_resto.sql';
  const sql = leer(MIG).replace(/^\s*--.*$/gm, '');
  assert.match(sql.trim(), /^begin;[\s\S]*\ncommit;$/, 'en una transacción: no hay un instante sin función');
  assert.match(sql, /alter table pagos add column if not exists resto_de bigint;/);
  // (revisión de e19a5196f) La marca de «Registrar el mes cobrado», y las de antes por su concepto (test 13).
  assert.match(sql, /alter table pagos add column if not exists es_mensualidad boolean not null default false;/);
  assert.match(sql, /update pagos set es_mensualidad = true\s*where nacio_cobrada and proveedor is null and not es_mensualidad and lower\(trim\(coalesce\(concepto, ''\)\)\) = 'mensualidad';/);
  assert.doesNotMatch(sql, /resto_de bigint references/);
  assert.match(sql, /insert into pagos \(workspace_id, lead_id, numero, monto_usd, fecha_esperada, pagado, resto_de\)\s*values \(p_ws, p_lead, v_numero, p_resto, p_vence, false, v_id\)/);
  const sql0318 = leer('supabase/migrations/0318_cobrar_cuota_con_resto.sql').replace(/^\s*--.*$/gm, '');
  for (const igual of ['security invoker', 'perform 1 from pagos where lead_id = p_lead and workspace_id = p_ws order by id for update;', 'where id = p_pago and lead_id = p_lead and workspace_id = p_ws and pagado is not true', "return jsonb_build_object('tomada', true, 'resto', v_resto);"]) {
    assert.ok(sql.includes(igual) && sql0318.includes(igual), igual);
  }
  assert.match(sql, /set search_path = public/);
  // La firma de 11 se borra (con las dos, PostgREST no sabe a cuál llamar), y la nueva acepta la llamada de antes.
  const once = 'bigint, bigint, bigint, date, text, numeric, text, numeric, boolean, numeric, date';
  assert.ok(sql.includes(`drop function if exists public.cobrar_cuota_con_resto(${once});`));
  assert.match(sql, /p_vence date,\s*p_original numeric default null\s*\)/);
  assert.match(sql, /where id = p_pago and lead_id = p_lead and workspace_id = p_ws and pagado is not true\s*and \(p_original is null or monto_usd = p_original\)/);
  const firma = `public\\.cobrar_cuota_con_resto\\(${once}, numeric\\)`;
  assert.match(sql, new RegExp(`revoke execute on function ${firma} from public, anon, authenticated;`));
  assert.match(sql, new RegExp(`grant execute on function ${firma} to service_role;`));
  assert.match(leer(MIG), /ORDEN DE DESPLIEGUE: ANTES del código que manda `p_original`/);
  // La app manda el monto que leyó, en el cobro por menos y en el entero.
  const cobrar = pagos.slice(pagos.indexOf('export async function cobrarCuota('), pagos.indexOf('export async function registrarPagoSuelto('));
  assert.match(cobrar, /p_resto: pend, p_vence: fila\.fecha_esperada \?\? datos\.fecha,\s*p_original: original,/);
  assert.match(cobrar, /\.update\(upd\)\.eq\('id', pagoId\)\.eq\('lead_id', leadId\)\.eq\('monto_usd', original\), true\)/);
});

test('12. ⚠️ la cuota se cobra con el monto que se LEYÓ: editada en el medio, no se toma (mig 0323, `p_original`)', () => {
  const s = correr() as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- la salida del hijo, campo por campo
  // Cobrar 300 de una cuota de 500 que alguien pasó a 400 justo antes: antes, 300 cobrados + 200 pendientes (500 de una
  // cuota de 400). Ahora no se escribe nada y se dice.
  assert.match(String(s.originalMenos), /La cuota cambió mientras la cobrabas/);
  assert.deepEqual(s.originalMenosFilas, [{ pagado: false, monto_usd: 400 }], 'ni cobrada ni con una diferencia');
  // Lo mismo con el cobro entero: no queda cobrada por los 500 de antes.
  assert.match(String(s.originalEntero), /La cuota cambió mientras la cobrabas/);
  assert.deepEqual(s.originalEnteroFilas, [{ pagado: false, monto_usd: 400 }]);
  // Sin cambios en el medio, cobra como siempre (los otros tests): acá, el control.
  assert.deepEqual(s.originalControl, [{ pagado: true, monto_usd: 300 }, { pagado: false, monto_usd: 200 }]);
});

test('13. ⚠️ «Registrar el mes cobrado» marca la fila como la mensualidad; «Registrar un pago», no (mig 0323)', () => {
  const s = correr() as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- la salida del hijo, campo por campo
  assert.deepEqual(s.mensualidadFilas, [{ monto_usd: 1000, pagado: true, es_mensualidad: true }, { monto_usd: 300, pagado: true, es_mensualidad: false }]);
  // La pantalla lo dice según el modo, y la acción lo deja pasar.
  assert.match(leer('app/crm/lead-view/ficha/pagos/piezas.tsx'), /concepto: concepto\.trim\(\) \|\| null, mensualidad: modo === 'mensualidad', crm \}\);/);
  assert.match(leer('app/crm/[id]/deal-actions.ts'), /registrarPagoSueltoAction\(leadId: number, datos: \{ monto: number; fecha: string; hora\?: string \| null; mensualidad\?: boolean; crm\?: number \| null \} & DatosDeMoneda\)/);
  // Sólo la marca, si viene: sin la migración, un pago suelto se sigue guardando.
  assert.match(sinComentarios(leer('lib/pagos.ts')), /nacio_cobrada: true,\s*\.\.\.\(datos\.mensualidad \? \{ es_mensualidad: true \} : \{\}\),/);
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

// ROTURAS de la cuarta revisión (21/10/2026). Base: 9 pases, 0 fallos. Rota (pases / fallos):
//   · los meses ya cobrados sueltos no cuentan (vuelven las 12)                     → 8 / 1 (9)
//   · un suelto impago vuelve a no ser plan                                         → 8 / 1 (9)
//   · el pago único con un pago previo arma igual                                   → 8 / 1 (9)
//   · la suscripción conserva las fechas de la pantalla (desde hoy)                 → 8 / 1 (9)
//   · el server ancla en hoy y no en el cierre                                      → 8 / 1 (9)
//   · el server se calla el aviso                                                   → 8 / 1 (9)
//   · el server escribe lo que mandó la pantalla                                    → 8 / 1 (8)
//   · el asistente cierra sin mostrar el aviso                                      → 8 / 1 (9)
//   · «Entendido» vuelve a confirmar                                                → 8 / 1 (9)
//   · la suscripción manda el plan siempre (completar el teléfono)                  → 8 / 1 (9)
//   · el tablero vuelve a pedir «Plan de pagos» sin saber                           → 8 / 1 (9)
//   · «+ Agregar cuota» vuelve a contar desde la primera                            → 8 / 1 (6)
//   · el día pactado sale de la primera cuota (el anticipo)                         → 8 / 1 (9)
//   · la siguiente, desde la última de la lista y no la más tardía                  → 8 / 1 (9)
//   · sin la regla del 31 (un 30/11 que vino de un 31)                              → 8 / 1 (9)
//   · la 0318 sin el revoke                                                         → 8 / 1 (7)
//   · la 0318 sin el grant a service_role                                           → 8 / 1 (7)
//   · la 0318 toma las cuotas sin orden                                             → 8 / 1 (7)
//
// ROTURAS de la quinta revisión (21/10/2026). Base: 10 pases, 0 fallos. Rota (pases / fallos):
//   · lo que gana con el plan, sin fecha de cierre                                   → 9 / 1 (10)
//   · `savePlanPagos` arma encima de una seña                                        → 9 / 1 (10)
//   · la cuota borrada en el medio es «ya estaba» (entera)                           → 9 / 1 (10)
//   · la cuota borrada en el medio es «ya estaba» (por menos)                        → 9 / 1 (10)
//   · menos de un centavo se cobra                                                   → 9 / 1 (10)
//   · MaKo propone el plan uniforme encima de una seña                               → 9 / 1 (10)
//   · el tablero no vuelve a preguntar al cambiar el tipo                            → 9 / 1 (10)
//   · «Plan de pagos» con el tipo guardado, no el elegido                            → 9 / 1 (10)
//   · el modal toma 0,004 como un monto                                              → 9 / 1 (10)
//
// ROTURAS de la revisión de 7524ec1c9 y de la 0323 (21/10/2026). Base: 12 pases, 0 fallos. Rota (pases / fallos):
//   · la pasarela inserta el cobro de un link sin `nacio_cobrada`                    → 11 / 1 (11)
//   · la reconciliación no recibe `resto_de`                                         → 11 / 1 (11)
//   · el lugar vuelve a mirar sólo `nacio_cobrada`                                   → 11 / 1 (11)
//   · `cobrarCuota` no manda `p_original`                                            → 10 / 2 (11 y 12)
//   · el cobro entero no mira el monto                                               → 9 / 3 (5, 11 y 12)
//   · la 0323 no mira el monto                                                       → 11 / 1 (11)
//   · la 0323 no borra la firma de 11 argumentos                                     → 11 / 1 (11)
//   · la 0323 sin transacción                                                        → 11 / 1 (11)
//   · `p_original` sin default (el código de antes del deploy no la encuentra)       → 11 / 1 (11)
//   · el revoke sobre la firma vieja                                                 → 11 / 1 (11)
//   · la 0323 inserta la diferencia sin `resto_de`                                   → 11 / 1 (11)
//   · la columna con clave foránea (`on delete set null`)                            → 11 / 1 (11)
//   · la 0323 toma las cuotas sin orden                                              → 11 / 1 (11)
//   · el mensaje vuelve a decir «falta la migración 0318»                            → 11 / 1 (7)
//
// ROTURAS de la revisión de e19a5196f (21/10/2026). Base: 13 pases, 0 fallos. Rota (pases / fallos):
//   · `registrarPagoSuelto` no escribe la marca de la mensualidad                    → 12 / 1 (13)
//   · la pantalla no manda el modo                                                   → 12 / 1 (13)
//   · la 0323 sin la columna `es_mensualidad`                                        → 12 / 1 (11)
//   · la 0323 no rellena las de antes (por su concepto)                              → 12 / 1 (11)
