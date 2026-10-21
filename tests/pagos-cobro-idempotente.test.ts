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
  assert.match(pagos, /if \(!tocadas\?\.length\) return \{ quitada: false, porLink: null, yaEstaba: true \};/);
  assert.match(pagos, /siSigue\(db\.from\('pagos'\)\.update\(upd\)\.eq\('id', pagoId\)\.eq\('lead_id', leadId\), true\)\.select\('id'\)/);
  const cobrar = pagos.slice(pagos.indexOf('export async function cobrarCuota('), pagos.indexOf('export async function registrarPagoSuelto('));
  assert.doesNotMatch(cobrar, /await marcarPago\(/, 'cobrarCuota no escribe en dos pasos');
  assert.match(cobrar, /await trasCobrar\(pagoId, fila\.cobro_id \?\? null\);/, 'y corta los recordatorios como marcarPago');
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
  assert.match(wizard, /const d = new Date\(\(last\?\.fecha \|\| hoyISO\) \+ 'T00:00:00Z'\);/, '«+ Agregar cuota» sin cuotas arranca de hoy, no del UTC');
  // La hora: la del negocio, no la del navegador (alguien en Buenos Aires anotaba un cobro de México con su hora).
  const instante = new Date('2026-10-21T03:30:00Z');
  assert.equal(horaEnTz('America/Mexico_City', instante), '21:30');
  assert.equal(horaEnTz('America/Argentina/Buenos_Aires', instante), '00:30');
  const piezas = leer('app/crm/lead-view/ficha/pagos/piezas.tsx');
  assert.match(piezas, /const useHoraDelNegocio = \(\): string => \{ const tz = useTzWorkspace\(\); return horaEnTz\(tz\); \};/);
  assert.equal((piezas.match(/const horaNegocio = useHoraDelNegocio\(\);\s*const \[hora, setHora\] = useState\(horaNegocio\);/g) ?? []).length, 2);
  assert.doesNotMatch(piezas, /toTimeString\(\)/, 'ni una hora del navegador');
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
