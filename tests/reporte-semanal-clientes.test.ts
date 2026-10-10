// =============================================================================
// El reporte semanal le llega a CADA cliente, desde SU workspace
// =============================================================================
// #834. Hasta el 06/10/2026 los tres crons de reporte corrían una vez y fuera de todo
// `runWithWorkspace`: `getWorkspaceActual()` caía al ws1 (lib/notify.ts, lib/settings.ts) y
// salía sólo el de Mauricio — con el semanal en la lista que ve cada cliente
// (AVISOS_DEL_CLIENTE) y prendido por defecto. Decisión de Martín ese día: «b: solo el
// semanal para los clientes». Diario y horario siguen siendo sólo del dueño.
//
// Lo que persigue este archivo: que el cron recorra los workspaces y corra cada uno ADENTRO
// del suyo (es lo que hace que preferencias, destinatarios, números y Chatwoot sean del
// cliente y no del dueño), que un workspace roto no corte a los demás, que saltee al que lo
// tiene apagado —en sus DOS interruptores— o no tiene a quién, y que `?dry=1` no mande nada.
//
// ⚠️ PROBADOS ROMPIÉNDOLOS, 06/10/2026, con un arnés que restaura DE MEMORIA. Las NUEVE
// roturas se cazan, cada una con 1 fallo y 7 pases (8 tests):
//   · llamar `reporteDelWorkspace(w.id, dry)` sin `runWithWorkspace`
//   · sacar el try/catch del bucle
//   · decidir con `prefs.semanal.activo` solo, sin el interruptor del mensaje
//   · `decidirReporte` ignorando `activo`
//   · `decidirReporte` contando teléfonos con el WhatsApp apagado
//   · `destinosDelReporte` sin caer al contacto suelto
//   · `despacharReporte` volviendo a escribir la regla de destinos a mano
//   · armar el reporte antes del `if (dry)`
//   · un `listarWorkspaces()` en el cron diario
//
// Correr: node --import tsx --test tests/reporte-semanal-clientes.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decidirReporte, destinosDelReporte, enmascararDestino } from '../lib/reporte-destino';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');
const sinComentarios = (src: string): string => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const ROUTE = sinComentarios(leer('../app/api/cron/reporte-semanal/route.ts'));
const fnWorkspace = (): string => {
  const ini = ROUTE.indexOf('async function reporteDelWorkspace');
  const fin = ROUTE.indexOf('export async function GET', ini);
  return ROUTE.slice(ini, fin);
};

test('⚠️ el cron semanal recorre los workspaces y corre cada uno ADENTRO del suyo', () => {
  assert.match(ROUTE, /listarWorkspaces\(\)/, 'el cron dejó de recorrer los workspaces: vuelve a salir sólo el del dueño');
  const ini = ROUTE.indexOf('for (const w of objetivo)');
  assert.ok(ini > 0, 'no encuentro el bucle por workspace');
  const bucle = ROUTE.slice(ini, ROUTE.indexOf('const errores', ini));
  assert.ok(bucle.length > 50 && bucle.length < 800, `el recorte del bucle mide ${bucle.length}: mira otra cosa`);
  // Sin el contexto, `getWorkspaceActual()` cae al ws1 y cada «cliente» recibe el reporte
  // del dueño, con los destinatarios del dueño.
  assert.match(bucle, /runWithWorkspace\(w\.id, \(\) => reporteDelWorkspace\(w\.id, dry\)\)/,
    'el reporte de cada workspace corre fuera de su contexto: lee y manda como el dueño');
  assert.match(bucle, /try \{[\s\S]*\} catch \(err\) \{[\s\S]*modo: 'error'/,
    'un workspace que falla corta la corrida de los demás');
  // Y el único camino al despacho es esa función: declarada una vez y llamada una vez,
  // adentro del `runWithWorkspace`.
  assert.equal((ROUTE.match(/reporteDelWorkspace\(/g) ?? []).length, 2, 'apareció otro camino al reporte');
  assert.equal((ROUTE.match(/despacharReporte\(/g) ?? []).length, 1, 'el reporte se despacha desde otro lado');
  assert.match(fnWorkspace(), /despacharReporte\(rep, prefs\.semanal, perfil\)/, 'el despacho salió de la función por workspace');
});

test('saltea al que lo apagó —en sus DOS interruptores— o no tiene a quién mandárselo', () => {
  const fn = fnWorkspace();
  // `notification_prefs.semanal.activo` Y el interruptor del mensaje en /mensajes, que es
  // el que ve el cliente: leyendo sólo el primero, apagarlo en su lista no hacía nada.
  assert.match(fn, /estadoAviso\(ws, idDeMensaje\('reporte_semanal'\)\)/, 'no lee el interruptor del mensaje');
  assert.match(fn, /activo: prefs\.semanal\.activo && mensaje\.activo/, 'el reporte ignora uno de sus dos interruptores');
  assert.match(fn, /if \(!decision\.sale\) return \{ ws, modo: 'salteado'/, 'el que no tiene a quién igual arma el reporte');
});

test('?dry=1 lista a quién le mandaría y no arma ni manda nada', () => {
  const fn = fnWorkspace();
  const iDry = fn.indexOf('if (dry)');
  const iArma = fn.indexOf('buildReporteSemanal(');
  const iManda = fn.indexOf('despacharReporte(');
  assert.ok(iDry > 0 && iDry < iArma && iArma < iManda, 'el dry-run arma o manda el reporte');
  const dry = fn.slice(iDry, iArma);
  assert.match(dry, /enmascararDestino/, 'el dry-run imprime los teléfonos y correos enteros en el log del cron');
  // Desde el 09/10/2026 el WhatsApp del reporte no tiene por dónde salir (salía por Chatwoot).
  assert.match(dry, /waSinCanal/, 'el dry-run no dice que el WhatsApp no tiene por dónde salir');
});

test('los reportes diario y horario siguen siendo sólo del dueño (decisión del 06/10/2026)', () => {
  // «b: solo el semanal». Si mañana se quiere el diario para todos, es OTRA decisión:
  // este test lo nombra para que no entre de paso.
  for (const r of ['reporte-diario', 'reporte-horario']) {
    const src = sinComentarios(leer(`../app/api/cron/${r}/route.ts`));
    assert.ok(!/listarWorkspaces\(|correrPorWorkspace\(/.test(src), `el cron ${r} empezó a recorrer los clientes`);
  }
});

test('decidirReporte: apagado, sin destinatario por los canales elegidos, o sale', () => {
  const destinos = { telefonos: ['5215511112222'], emails: ['dueno@negocio.com'] };
  assert.deepEqual(decidirReporte({ activo: false, canal: { wa: true, email: true }, destinos }), { sale: false, motivo: 'apagado' });
  // ⛔ Un reporte no sale por WhatsApp (decisión de Martín, 10/10/2026, `REPORTE_POR_WHATSAPP`): con los dos
  // canales pedidos, cuenta sólo el email.
  assert.deepEqual(decidirReporte({ activo: true, canal: { wa: true, email: true }, destinos }), { sale: true, wa: 0, email: 1 });
  // Un teléfono no cuenta si el WhatsApp está apagado, y al revés.
  assert.deepEqual(
    decidirReporte({ activo: true, canal: { wa: true, email: false }, destinos: { telefonos: [], emails: ['x@y.com'] } }),
    { sale: false, motivo: 'sin_destinatario' },
  );
  assert.deepEqual(
    decidirReporte({ activo: true, canal: { wa: false, email: true }, destinos: { telefonos: ['5215511112222'], emails: [] } }),
    { sale: false, motivo: 'sin_destinatario' },
  );
  assert.deepEqual(
    decidirReporte({ activo: true, canal: { wa: false, email: true }, destinos }),
    { sale: true, wa: 0, email: 1 },
  );
});

test('destinosDelReporte: la lista del negocio y, si está vacía, el contacto suelto', () => {
  const contacto = { telefono: '5215599998888', email: 'viejo@negocio.com' };
  assert.deepEqual(
    destinosDelReporte({ telefonos: ['5215511112222'], emails: ['a@b.com', 'c@d.com'] }, contacto),
    { telefonos: ['5215511112222'], emails: ['a@b.com', 'c@d.com'] },
  );
  assert.deepEqual(destinosDelReporte({ telefonos: [], emails: [] }, contacto), { telefonos: ['5215599998888'], emails: ['viejo@negocio.com'] });
  assert.deepEqual(destinosDelReporte({ telefonos: [], emails: [] }, { telefono: '', email: '' }), { telefonos: [], emails: [] });
});

test('despacharReporte usa la MISMA regla de destinos que el cron', () => {
  // Con dos copias, el cron decide «tiene a quién» con una y el despacho reparte con otra.
  const src = sinComentarios(leer('../lib/notify.ts'));
  const desp = src.slice(src.indexOf('export async function despacharReporte'));
  assert.match(desp, /destinosDelReporte\(await getDestinatarios\(\), perfil\)/, 'el despacho dejó de usar la regla compartida');
  assert.ok(!/\.telefonos\.length > 0 \?/.test(src), 'la regla de destinos volvió a escribirse a mano en lib/notify.ts');
});

test('enmascararDestino deja lo justo para reconocerlo', () => {
  assert.equal(enmascararDestino('5215511112222'), '…2222');
  assert.equal(enmascararDestino('maria@negocio.com'), 'ma…@negocio.com');
  assert.equal(enmascararDestino('12'), '…');
});
