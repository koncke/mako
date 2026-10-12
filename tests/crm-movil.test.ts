// =============================================================================
// MaKo Mobile — las reglas puras del CRM en el teléfono (app/m/crm/reglas.ts)
// =============================================================================
// Fija lo que se rompe sin un solo error:
//   · el buscador devuelve como mucho 20 filas compactas (la cartera no baja) y busca
//     con la regla del tablero (sin acentos, «#id» exacto);
//   · tel: y wa.me con el número canónico, SIN inventar el país;
//   · qué etapas se mueven desde el teléfono: nunca las del wizard (reunión, manual),
//     nunca Ganado ni las de cobro/cierre;
//   · qué reunión agenda el botón, decidido con los DATOS (r1 / r2, crear o mover);
//   · el orden de la «siguiente acción»;
//   · y que la acción del server use LA MISMA regla que el sheet (no una copia).
//
// Verificado ROMPIÉNDOLO (11/10/2026), cada rotura contra la base en verde (9/9), restaurando
// de memoria (scratchpad/crm/romper.cjs):
//   · seMueveEnElTelefono sin el chequeo de «ganado»: 1 fallo, 8 pases.
//   · seMueveEnElTelefono sin pideWizardAlElegir (todo se mueve): 3 fallos, 6 pases.
//   · telHref agregando «+» a los 10 dígitos pelados: 1 fallo, 8 pases.
//   · cualAgendar sin la rama de la R2: 1 fallo, 8 pases.
//   · buscarEnCartera sin el tope de 20: 1 fallo, 8 pases.
//   · siguienteAccion con el insight antes que la llamada: 1 fallo, 8 pases.
//   · acciones.ts sin «seMueveEnElTelefono(» en el server: 1 fallo, 8 pases.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buscarEnCartera, chipsDeDia, cualAgendar, etapasMovibles, rotuloAgendar, seMueveEnElTelefono,
  siguienteAccion, telHref, waMeHref, MAX_RESULTADOS, type EtapaM,
} from '../app/m/crm/reglas';

const ETAPAS: EtapaM[] = [
  { key: 'lead', label: 'Lead', kind: 'entrada' },
  { key: 'contactado', label: 'Contactado', kind: 'paso' },
  { key: 'agenda', label: 'Agenda R1', kind: 'reunion' },
  { key: 'agendaj2', label: 'Agenda R2', kind: 'reunion' },
  { key: 'facturando', label: 'Facturando', kind: 'pago' },
  { key: 'ganado', label: 'Ganado', kind: 'cierre' },
  { key: 'manual', label: 'Nutrición manual' },
  { key: 'perdido', label: 'Perdido' },
];

test('mover: no se ofrecen las del wizard, ni Ganado, ni cobros', () => {
  assert.equal(seMueveEnElTelefono(ETAPAS, 'contactado'), true);
  assert.equal(seMueveEnElTelefono(ETAPAS, 'perdido'), true);
  assert.equal(seMueveEnElTelefono(ETAPAS, 'agenda'), false, 'reunión → al sheet de agendar');
  assert.equal(seMueveEnElTelefono(ETAPAS, 'manual'), false, 'manual pide el plazo');
  assert.equal(seMueveEnElTelefono(ETAPAS, 'facturando'), false, 'cobro');
  assert.equal(seMueveEnElTelefono(ETAPAS, 'inexistente'), false);
});

test('mover: Ganado nunca, aunque el embudo no declare kind', () => {
  const sinKind: EtapaM[] = [{ key: 'lead', label: 'Lead' }, { key: 'ganado', label: 'Ganado' }, { key: 'agenda', label: 'Agenda' }];
  assert.equal(seMueveEnElTelefono(sinKind, 'ganado'), false);
  assert.equal(seMueveEnElTelefono(sinKind, 'agenda'), false, 'sin kind, las dos keys canónicas siguen siendo reunión');
});

test('mover: la lista no incluye la etapa actual', () => {
  assert.deepEqual(etapasMovibles(ETAPAS, 'lead').map((e) => e.key), ['contactado', 'perdido']);
  assert.deepEqual(etapasMovibles(ETAPAS, 'perdido').map((e) => e.key), ['lead', 'contactado']);
});

test('contacto: número canónico, sin inventar el país', () => {
  assert.equal(telHref('+52 1 55 1234 5678'), 'tel:+525512345678', '521·10 = 52·10');
  assert.equal(telHref('55 1234 5678'), 'tel:5512345678', '10 pelados: sin «+» (no se inventa el 52)');
  assert.equal(telHref('12345'), null);
  assert.equal(telHref(null), null);
  assert.equal(waMeHref('+54 9 11 2505 2605'), 'https://wa.me/5491125052605');
  assert.equal(waMeHref('55 1234 5678'), null, 'wa.me sin código de país abre otro número');
});

test('buscador: tope de 20 filas compactas y la regla del tablero', () => {
  const leads = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, nombre: `Martín ${i + 1}`, empresa: i === 0 ? 'Acme' : null, email: null, telefono: null }));
  const r = buscarEnCartera(leads, 'martin');
  assert.equal(r.filas.length, MAX_RESULTADOS);
  assert.equal(r.hayMas, true);
  assert.deepEqual(Object.keys(r.filas[0]).sort(), ['id', 'nombre', 'segunda']);
  assert.equal(r.filas[0].segunda, 'Acme');
  assert.deepEqual(buscarEnCartera(leads, '#7').filas.map((f) => f.id), [7]);
  assert.equal(buscarEnCartera(leads, 'm').filas.length, 0, 'una letra no busca');
});

test('agendar: qué reunión decide el botón, con los datos', () => {
  const ahora = Date.parse('2026-10-11T15:00:00Z');
  const hoy = '2026-10-11';
  const vacio = { fecha_junta_1: null, junta_1_at: null, fecha_junta_2: null, junta_2_at: null };
  assert.deepEqual(cualAgendar(vacio, ahora, hoy), { cual: 'r1', mueve: false, titulo: 'Agendar R1' });
  assert.equal(cualAgendar({ ...vacio, fecha_junta_1: '2026-10-12', junta_1_at: '2026-10-12T16:00:00Z' }, ahora, hoy).titulo, 'Mover la R1');
  assert.deepEqual(cualAgendar({ ...vacio, fecha_junta_1: '2026-10-09', junta_1_at: '2026-10-09T16:00:00Z' }, ahora, hoy), { cual: 'r2', mueve: false, titulo: 'Agendar R2' });
  assert.equal(cualAgendar({ ...vacio, fecha_junta_1: '2026-10-11', junta_1_at: '2026-10-11T14:00:00Z' }, ahora, hoy).cual, 'r2', 'hoy, pero ya pasó por la hora');
  assert.equal(cualAgendar({ ...vacio, fecha_junta_1: '2026-10-01', fecha_junta_2: '2026-10-05' }, ahora, hoy).titulo, 'Mover la R2');
});

test('agendar: chips y rótulo del botón', () => {
  const c = chipsDeDia('2026-10-14');
  assert.deepEqual(c.map((x) => x.fecha), ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17']);
  assert.equal(c[0].rotulo, 'Hoy');
  assert.equal(c[1].rotulo, 'Mañana');
  assert.match(c[2].rotulo, /^\S+ 16$/);
  assert.match(rotuloAgendar({ cual: 'r2', mueve: false, titulo: '' }, '2026-10-16', '10:00'), /^Agendar R2 \S+ 16, 10:00$/);
});

test('siguiente acción: el orden de las fuentes', () => {
  const base = { proximaReunion: null, proximoPasoLlamada: null, proximaAccionInsight: null, faltantes: [] as string[], seguimientoSinEnviar: false };
  assert.equal(siguienteAccion(base), null, 'sin nada escrito no se inventa');
  assert.equal(siguienteAccion({ ...base, seguimientoSinEnviar: true })?.tipo, 'seguimiento');
  assert.equal(siguienteAccion({ ...base, seguimientoSinEnviar: true, faltantes: ['Monto'] })?.tipo, 'etapa');
  assert.equal(siguienteAccion({ ...base, faltantes: ['Monto'], proximaAccionInsight: 'Llamar' })?.tipo, 'insight');
  assert.equal(siguienteAccion({ ...base, proximaAccionInsight: 'Llamar', proximoPasoLlamada: 'Mandar propuesta' })?.tipo, 'llamada');
  assert.equal(siguienteAccion({ ...base, proximoPasoLlamada: 'x', proximaReunion: { cual: 'R1', cuando: 'hoy 10:00' } })?.titulo, 'R1 hoy 10:00');
});

test('la acción del server usa LA MISMA regla que el sheet, y nunca manda señales de Meta', () => {
  const src = readFileSync(join(__dirname, '..', 'app', 'm', 'crm', 'acciones.ts'), 'utf8').replace(/\r\n/g, '\n')
    .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(src, /seMueveEnElTelefono\(/, 'moverEtapaAction revisa la regla en el server');
  assert.match(src, /setLeadStageAction\(leadId, etapa\)/, 'sin opts: ni calificado ni asistencia');
  assert.doesNotMatch(src, /calificado|asistio_j/, 'el teléfono no manda toques de Meta');
  assert.match(src, /moverEtapaEnProducto\(/, 'un agregado se mueve en su producto');
});
