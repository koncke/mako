// =============================================================================
// Clients: «Pago rechazado» / «Cuota vencida» en la tarjeta, y la cara del cliente en el teléfono (20/10/2026)
// =============================================================================
// docs/pedidos-crm.md B2: la tarjeta del prototipo (docs/prototipos/coherencia-1710.html, «8 · Clients») avisa «Pago
// fallido», y no estaba porque el cobro se leía de a un cliente. Ahora:
//   1. la regla pura (`cobroDelCliente`): el ÚLTIMO cobro falló y no pagó después → rechazado; una cuota sin pagar con
//      la fecha pasada (hoy todavía no) → vencida; rechazado gana;
//   2. el aviso: «Pago rechazado» le gana a todo; «Cuota vencida» va después de «Sin entrar al curso» (rojo) y antes
//      de los amarillos y los días sin moverse;
//   3. el cableado: UNA lectura para toda la cartera que nunca tira, la computadora y el teléfono con la MISMA regla;
//   4. el teléfono dibuja la cara (lo elegido, su WhatsApp, su email) con la misma cadena que la computadora.
//
// PROBADO ROMPIÉNDOLO (20/10/2026), con el archivo en 4 / 0, una rotura por vez y restaurada:
//   · `cobroDelCliente` sin mirar si pagó después del rechazo                       → 3 / 1
//   · la cuota vence HOY (`<=` en vez de `<`)                                       → 3 / 1
//   · «Cuota vencida» ANTES de «Sin entrar al curso»                                → 3 / 1
//   · la tarjeta de la computadora sin pasarle el cobro                             → 3 / 1
//   · el teléfono con la `CaraTarjeta` de antes (sólo iniciales)                    → 3 / 1
// Y lo que encontró la revisión del 21/10/2026 (archivo en 5 / 0, una rotura por vez):
//   · sin la renovación rechazada de una suscripción (queda «pagado» con el motivo)                  → 4 / 1
//   · el rechazo fechado por `created_at` (un pago anterior lo tapaba)                               → 4 / 1
//   · la cartera en una sola consulta (sin tandas: la URL y el techo de 1.000 filas)                 → 4 / 1
//   (el test de la versión de ayer fijaba el mismo supuesto equivocado: el `created_at` del fallido como hora del rechazo)
// Correr: node --import tsx --test tests/cs-tarjeta-cobro.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avanceDeCliente, cobroDelCliente } from '../app/customer-success/aviso-tarjeta';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const HOY = '2026-10-20';
const c = (estado: string, created_at: string, pagado_at: string | null = null, updated_at: string | null = null) => ({ estado, created_at, pagado_at, updated_at });

test('el cobro de un cliente: rechazado si el ÚLTIMO falló y no pagó después; vencida si una cuota pasó su fecha', () => {
  assert.equal(cobroDelCliente([c('pagado', '2026-09-01T10:00:00Z', '2026-09-01T10:01:00Z'), c('fallido', '2026-10-01T10:00:00Z')], [], HOY), 'rechazado');
  assert.equal(cobroDelCliente([c('fallido', '2026-10-01T10:00:00Z'), c('pagado', '2026-10-02T10:00:00Z', '2026-10-02T10:05:00Z')], [], HOY), null,
    'pagó con otra tarjeta después: ya no avisa');
  assert.equal(cobroDelCliente([c('pagado', '2026-09-30T10:00:00Z', '2026-10-03T10:00:00Z'), c('fallido', '2026-10-01T10:00:00Z')], [], HOY), null,
    'un link creado ANTES del rechazo y pagado DESPUÉS también lo resuelve (cuenta cuándo se pagó, no cuándo se creó)');
  assert.equal(cobroDelCliente([c('fallido', '2026-09-01T10:00:00Z'), c('pagado', '2026-08-01T10:00:00Z', '2026-08-01T10:00:00Z')], [], HOY), 'rechazado',
    'un pago VIEJO no tapa un rechazo nuevo');
  assert.equal(cobroDelCliente([], [{ fecha_esperada: '2026-10-19' }], HOY), 'vencida');
  assert.equal(cobroDelCliente([], [{ fecha_esperada: '2026-10-20' }], HOY), null, 'vence hoy: todavía no está vencida');
  assert.equal(cobroDelCliente([c('fallido', '2026-10-10T10:00:00Z')], [{ fecha_esperada: '2026-10-01' }], HOY), 'rechazado', 'rechazado gana');
  assert.equal(cobroDelCliente([], [], HOY), null);
});

test('la revisión del 21/10: el rechazo cuenta por CUÁNDO pasó, y la renovación rechazada avisa', () => {
  // El link de la cuota 2 se creó el 01/10; la cuota 1 se pagó el 05/10; la 2 rebotó el 20/10 (el EVENTO del rechazo).
  assert.equal(cobroDelCliente([c('pagado', '2026-09-25T10:00:00Z', '2026-10-05T10:00:00Z'), c('fallido', '2026-10-01T10:00:00Z')], [], HOY, ['2026-10-20T10:00:00Z']), 'rechazado',
    'un pago anterior al rechazo no lo tapa, aunque el link rechazado se haya creado antes');
  // Segunda revisión: el link A rebotó el 01/10, el B se pagó el 05/10, y el 10/10 alguien abrió el link A viejo (updated_at).
  assert.equal(cobroDelCliente([c('fallido', '2026-09-30T10:00:00Z', null, '2026-10-10T10:00:00Z'), c('pagado', '2026-10-04T10:00:00Z', '2026-10-05T10:00:00Z')], [], HOY, ['2026-10-01T10:00:00Z']), null,
    'abrir un link viejo no es un rechazo nuevo: la hora es la del EVENTO');
  assert.equal(cobroDelCliente([c('pagado', '2026-10-01T10:00:00Z', '2026-10-02T10:00:00Z')], [], HOY, ['2026-10-01T09:00:00Z']), null, 'un evento sin un cobro todavía fallido no avisa');
  assert.equal(cobroDelCliente([c('fallido', '2026-10-01T10:00:00Z', null, '2026-10-02T10:00:00Z'), c('pagado', '2026-09-30T10:00:00Z', '2026-10-03T10:00:00Z')], [], HOY), null,
    'pagó después del rechazo: no avisa');
  const renovacion = (o: Record<string, string>) => ({ estado: 'pagado', created_at: '2026-09-01T10:00:00Z', pagado_at: '2026-09-01T10:00:00Z', tipo: 'suscripcion', motivo: 'Falló el cobro de la renovación: card_declined', ...o });
  assert.equal(cobroDelCliente([renovacion({ suscripcion_estado: 'activa' })], [], HOY), 'rechazado', 'la renovación rechazada de una suscripción activa');
  assert.equal(cobroDelCliente([renovacion({ suscripcion_estado: 'cancelada' })], [], HOY), null, 'una cancelada ya no se cobra');
  assert.equal(cobroDelCliente([renovacion({ suscripcion_estado: 'activa', motivo: 'Renovado' })], [], HOY), null, 'sin el motivo del rechazo, al día');
});

test('el aviso: «Pago rechazado» le gana a todo; «Cuota vencida» va después de «Sin entrar al curso»', () => {
  const base = { etapa: 0, etapas: 3, ahoraMs: Date.parse(`${HOY}T12:00:00Z`) };
  const nuncaEntro = { existe: true, revocado: false, ingresos: 0, ultimoIngresoAt: null, invitacionEnviadaAt: '2026-10-01T00:00:00Z' };
  assert.deepEqual(avanceDeCliente({ ...base, enEtapa: { frase: 'hace 30 días', trabado: true }, acceso: nuncaEntro, cobro: 'rechazado' }).aviso,
    { texto: 'Pago rechazado', tono: 'mal' });
  assert.deepEqual(avanceDeCliente({ ...base, enEtapa: null, acceso: nuncaEntro, cobro: 'vencida' }).aviso,
    { texto: 'Sin entrar al curso', tono: 'mal' }, 'el rojo del curso le gana al amarillo de la cuota');
  assert.deepEqual(avanceDeCliente({ ...base, enEtapa: { frase: 'hace 21 días', trabado: true }, acceso: { existe: true, revocado: false, ingresos: 3, ultimoIngresoAt: '2026-09-01T00:00:00Z' }, cobro: 'vencida' }).aviso,
    { texto: 'Cuota vencida', tono: 'riesgo' }, 'la plata antes que los días sin entrar o sin moverse');
  assert.equal(avanceDeCliente({ ...base, enEtapa: null, cobro: null }).aviso, null);
});

test('el cableado: una lectura para la cartera que nunca tira, y la misma regla en computadora y teléfono', () => {
  const lector = leer('app/customer-success/cobro-tarjeta.ts');
  // De a tandas de 150 y paginado (revisión 21/10): un `.in()` va en la URL y PostgREST corta en 1.000 sin avisar.
  assert.match(lector, /leerTodo<FilaCobro>\(db, 'cobros', 'id, lead_id, estado, created_at, updated_at, pagado_at, tipo, suscripcion_estado, motivo'/, 'la regla necesita cuándo falló y el motivo de la renovación');
  assert.match(lector, /q\.in\('lead_id', t\)\.in\('estado', \['fallido', 'pagado'\]\)/);
  assert.match(lector, /q\.in\('lead_id', t\)\.eq\('pagado', false\)\.lt\('fecha_esperada', hoy\)/);
  assert.match(lector, /const TANDA = 150;/);
  assert.match(lector, /q\.in\('lead_id', t\)\.eq\('campo', 'Pago rechazado'\)/, 'la hora del rechazo sale del evento que sólo escribe el rechazo');
  assert.match(lector, /cobroDelCliente\(cobrosDe\.get\(id\) \?\? \[\], cuotasDe\.get\(id\) \?\? \[\], hoy, rechazosDe\.get\(id\)\)/);
  assert.match(lector, /catch \(e\) \{\n[^\n]*\n\s+return null;/, 'una lectura caída no inventa un «Pago rechazado»');
  const pantalla = leer('app/customer-success/pantalla.tsx');
  assert.match(pantalla, /const lecturaCobros = cobrosDeLaCartera\(clientes\.map\(\(c\) => c\.leadId\)\);/);
  assert.match(pantalla, /cobro: cobros\?\.\[c\.leadId\] \?\? null,/);
  assert.match(leer('app/customer-success/KanbanEntrega.tsx'), /avanceDeCliente\(\{[^\n]*cobro: c\.ficha\?\.cobro \?\? null,/);
  const pagina = leer('app/m/cs/page.tsx');
  assert.match(pagina, /cobrosDeLaCartera\(ganados\.map\(\(c\) => c\.leadId\)\)/);
  assert.match(pagina, /cobro: cobros\?\.\[c\.leadId\] \?\? null,/);
  assert.match(leer('app/m/cs/CustomerSuccessM.tsx'), /avanceDeCliente\(\{[^\n]*cobro: cli\?\.cobro \?\? null,/, 'el teléfono, la MISMA regla');
});

test('el teléfono: la cara del cliente con la misma cadena que la computadora', () => {
  const m = leer('app/m/cs/CustomerSuccessM.tsx');
  assert.match(m, /<CaraCliente nombre=\{nombreDe\(id\)\} cara=\{cli\?\.cara\} tam=\{44\} \/>/);
  const comp = m.slice(m.indexOf('function CaraCliente('));
  assert.match(comp, /useFotoContacto\(\{/);
  assert.match(comp, /foto=\{cara\?\.avatarUrl \|\| auto\}/, 'lo que alguien eligió gana');
  const pagina = leer('app/m/cs/page.tsx');
  assert.match(pagina, /'id, telefono, foto_auto_url'/, 'la foto de WhatsApp guardada');
  assert.match(pagina, /fotoEmail: c\.email\?\.trim\(\) \? urlGravatar\(c\.email, 176\) : null,/);
});
