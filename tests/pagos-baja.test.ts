// =============================================================================
// «Baja del cliente» (#871): lo que no pagó deja de ser deuda, y lo cobrado queda — EJECUTADO y barrido
// =============================================================================
// La llamada «Mau <> Martin» del 16/10/2026 (28:34): Francisco Javier Hernández pagó unos US$4.000 de US$6.000 y se
// fue. La ficha sólo ofrecía «Marcar pagada» o «Quitar», y lo que no pagó seguía como «Debe $1,800» a 80 días en la
// tab, en el Outstanding, en «A quién cobrarle» y en la cobranza por WhatsApp.
//
// La forma de una cuota de baja (mig 0307, lib/pagos-baja.ts): impaga, con `baja_at`, SIN vencimiento (el que tenía
// va a `baja_vencia`). Sin fecha, las lecturas que deciden «vencida» por la fecha la dejan afuera solas; las que suman
// lo impago sin fecha usan `noEsDeuda`, que excluye las devueltas y las de baja.
//
// PROBADO ROMPIÉNDOLO (17/10/2026), una rotura por vez con un script que reemplaza, corre y restaura byte a byte. Con
// el código como está: 9 pases, 0 fallos. Rota (pases / fallos):
//   · `noEsDeuda` = sólo `esCuotaDevuelta` (la baja vuelve a ser deuda)                     → 7 / 2
//   · sin la rama «Se dio de baja» de `estadoDeCuenta` (cae en «Faltan $2,000»)             → 8 / 1
//   · el Outstanding total filtrando con `esCuotaDevuelta` (la lectura vieja)               → 8 / 1
//   · la baja SIN pasar el vencimiento a `baja_vencia` (la cobranza la seguía viendo)       → 8 / 1
// Correr: npx tsx --test tests/pagos-baja.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { cobradoDelLead, esCuotaDeBaja, noEsDeuda, type EntradaCobrado } from '../lib/cobrado-lead';
import { estadoDeCuenta, renglonDeCuota } from '../lib/pagos-vistazo';

const HOY = '2026-10-17';
const leer = (p: string) => readFileSync(p, 'utf8');
type Q = { id: number; numero: number; monto_usd: number; pagado: boolean; fecha_esperada: string | null; fecha_pago: string | null; baja_at?: string | null; baja_vencia?: string | null };
const cuota = (id: number, numero: number, monto: number, pagado: boolean, fecha: string | null, extra: Partial<Q> = {}): Q =>
  ({ id, numero, monto_usd: monto, pagado, fecha_esperada: fecha, fecha_pago: pagado ? fecha : null, ...extra });
const lead = (pagos: Q[]): EntradaCobrado => ({
  ventaTipo: 'unico', montoCierreUsd: 6000, suscripcionMontoUsd: null, suscripcionMeses: null, fechaCierre: '2026-05-01', pagos, cobros: [], hoy: HOY,
});

/** El caso de la llamada: US$4.000 cobrados de US$6.000, y US$2.000 en dos cuotas que vencían en julio y agosto. */
const FRANCISCO = (deBaja: boolean): Q[] => [
  cuota(1, 0, 2000, true, '2026-05-01'),
  cuota(2, 1, 2000, true, '2026-06-01'),
  deBaja ? cuota(3, 2, 1000, false, null, { baja_at: '2026-10-17T15:00:00Z', baja_vencia: '2026-07-29' }) : cuota(3, 2, 1000, false, '2026-07-29'),
  deBaja ? cuota(4, 3, 1000, false, null, { baja_at: '2026-10-17T15:00:00Z', baja_vencia: '2026-08-29' }) : cuota(4, 3, 1000, false, '2026-08-29'),
];

test('antes de la baja: debe US$2.000, vencidos (el caso de la llamada)', () => {
  const c = cobradoDelLead(lead(FRANCISCO(false)));
  assert.equal(c.vencidoUsd, 2000);
  assert.equal(c.semaforo.texto, 'Cuota vencida');
  assert.equal(c.baja, null);
});

test('⚠️ dado de baja: lo que no pagó no es deuda ni vencido, lo cobrado queda y se dice cuánto quedó sin cobrar', () => {
  const c = cobradoDelLead(lead(FRANCISCO(true)));
  assert.equal(c.cobradoUsd, 4000);
  assert.equal(c.pendienteUsd, 0);
  assert.equal(c.vencidoUsd, 0);
  assert.equal(c.texto, '$4,000 cobrado de $6,000');
  assert.deepEqual(c.baja, { usd: 2000, at: '2026-10-17T15:00:00Z' });
  assert.deepEqual(c.semaforo, { tono: 'gris', texto: 'Se dio de baja' });
});

test('⚠️ el estado de cuenta dice «Se dio de baja», sin botón y sin «Faltan $2,000 → Agregar la cuota»', () => {
  const pagos = FRANCISCO(true);
  const e = estadoDeCuenta({ cobrado: cobradoDelLead(lead(pagos)), pagos, ganado: true, hoy: HOY });
  assert.ok(e);
  assert.equal(e.titular, 'Se dio de baja');
  assert.equal(e.accion, null);
  assert.equal(e.faltaUsd, 0);
  assert.match(e.detalle ?? '', /Quedó sin cobrar \$2,000/);
});

test('una cuota nueva cargada después de la baja vuelve a mandar (es deuda de verdad)', () => {
  const pagos = [...FRANCISCO(true), cuota(5, 4, 300, false, '2026-10-01')];
  const e = estadoDeCuenta({ cobrado: cobradoDelLead(lead(pagos)), pagos, ganado: true, hoy: HOY });
  assert.equal(e?.titular, 'Debe $300');
});

test('el renglón de una cuota de baja se ve, sin botón ni edición, con el vencimiento que tenía', () => {
  const r = renglonDeCuota(FRANCISCO(true)[2], HOY);
  assert.equal(r.estado, 'baja');
  assert.equal(r.accion, 'ninguna');
  assert.equal(r.editable, false);
  assert.match(r.cuando, /baja del cliente · vencía el 29\/07/);
});

test('cobrada, ya no es «de baja»: el cliente volvió y pagó esa cuota', () => {
  const q = { ...FRANCISCO(true)[2], pagado: true };
  assert.equal(esCuotaDeBaja(q), false);
  assert.equal(noEsDeuda({ ...q, proveedor: null, cobro_id: null }), false);
});

test('⚠️ la baja deja la cuota SIN vencimiento y guarda el que tenía; deshacerla se lo devuelve', () => {
  const src = leer('lib/pagos-baja.ts');
  assert.match(src, /update\(\{ baja_at: ahora, baja_vencia: q\.fecha_esperada, fecha_esperada: null \}\)/,
    'sin fecha, la cobranza (`.not(fecha_esperada is null)`), Customer Success y Automations la dejan afuera solas');
  assert.match(src, /update\(\{ baja_at: null, baja_vencia: null, fecha_esperada: q\.baja_vencia \?\? null \}\)/);
  // Compare-and-set: una cuota que se cobró en el medio no se da de baja.
  assert.match(src, /\.eq\('pagado', false\)\.is\('baja_at', null\)/);
  // Un link vivo se anula ANTES, y la que sigue con link no se da de baja (fail-closed: `proteccionesDeCuotas` tira).
  assert.ok(src.indexOf('anularLinksDeCuota(ws') < src.indexOf('baja_at: ahora'));
  assert.match(src, /proteccionesDeCuotas\(leadId/);
  assert.match(src, /cerrarCorridasDeCuota\(ws, q\.id\)/);
});

test('⚠️ barrido: toda suma de lo impago sin fecha excluye la baja (usa `noEsDeuda`, no `esCuotaDevuelta` sola)', () => {
  // Las lecturas que suman cuotas impagas SIN mirar el vencimiento. Si una vuelve a `!esCuotaDevuelta(`, quien se dio
  // de baja vuelve a deber en esa pantalla.
  const LECTURAS: Record<string, RegExp> = {
    'lib/cobrado-lead.ts': /e\.pagos\.filter\(\(q\) => !noEsDeuda\(q\)\)/,
    'lib/pagos.ts': /filter\(\(p\) => !noEsDeuda\(p\)\)\.reduce/,
    'lib/graficos-datos-extra.ts': /!noEsDeuda\(\{ pagado: false,[^}]*baja_at: x\.baja_at/,
    'lib/api-mako/areas/crm.run.ts': /!c\.pagada && !noEsDeuda\(plan\.pagos\[i\]\)/,
    'lib/pagos-vistazo.ts': /!q\.pagado && !noEsDeuda\(q\) && q\.fecha_esperada/,
  };
  for (const [archivo, re] of Object.entries(LECTURAS)) assert.match(leer(archivo), re, archivo);
  // Y ninguna lectura de deuda en todo app/ y lib/ filtra con `!esCuotaDevuelta(` (lo que sólo saca las devueltas).
  const archivos = execFileSync('git', ['ls-files', 'app', 'lib'], { encoding: 'utf8' }).split('\n').filter((f) => /\.(ts|tsx)$/.test(f));
  const viejas = archivos.filter((f) => /!esCuotaDevuelta\(/.test(leer(f)));
  assert.deepEqual(viejas, [], 'una suma de deuda con !esCuotaDevuelta( cuenta a quien se dio de baja: usa !noEsDeuda(');
  // Las que leen `pagos` con un select explícito y filtran en memoria traen la columna.
  assert.match(leer('lib/pagos.ts'), /select\('monto_usd, pagado, fecha_esperada, proveedor, cobro_id, baja_at'\)/);
  assert.match(leer('lib/pagos.ts'), /proveedor, cobro_id, baja_at, leads\(nombre, monto_cierre_usd, fecha_cierre\)/);
});

test('sólo lib/pagos-baja.ts escribe la baja, y una suscripción no se da de baja (se cancela)', () => {
  const archivos = execFileSync('git', ['ls-files', 'app', 'lib'], { encoding: 'utf8' }).split('\n').filter((f) => /\.(ts|tsx)$/.test(f));
  const escriben = archivos.filter((f) => /baja_at:\s*(ahora|null|new Date)/.test(leer(f)));
  assert.deepEqual(escriben, ['lib/pagos-baja.ts']);
  assert.match(leer('lib/pagos-baja.ts'), /venta_tipo === 'suscripcion'\) return \{ ok: false, error: 'Una suscripción no se da de baja: se cancela\.' \}/);
});
