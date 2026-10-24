// =============================================================================
// El bloque «Automatizaciones» de la ficha: el detalle de un lead (23/10/2026)
// =============================================================================
// Martín (23/10, #289 del ws1): en la ficha, todo lo de sus automatizaciones. La pantalla es del CRM; acá se prueba lo que
// la alimenta (`detalleDe`, lib/automatizaciones-del-lead-reglas.ts): las vivas con su paso, lo próximo y su hora, los
// envíos de ESTA corrida con su error, la reentrada, qué se puede hacer y por qué no; las terminadas de los últimos 30
// días debajo; y los «no volvió a entrar» leídos del historial.
//
// Correr: node --import tsx --test tests/automatizaciones-del-lead-detalle.test.ts
// Probado rompiéndolo (23/10/2026, base 5/0): ver el pie del archivo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detalleDe, DIAS_TERMINADAS, type FilaInscripcionDetalle, type FilaEnvioDetalle, type FilaAuditDetalle } from '../lib/automatizaciones-del-lead-reglas';
import { lineaNoVolvio, motivoNoVuelve } from '../lib/reentrada';

const AHORA = Date.parse('2026-10-23T21:00:00Z');
const hace = (dias: number) => new Date(AHORA - dias * 86400_000).toISOString();
const PASOS = [
  { id: 'm1', canal: 'whatsapp', tipo: 'texto', cuerpo: 'Hola {{nombre}}', siguiente: 'c1' },
  { id: 'c1', nodo: 'condicion', siguiente: 'm2' },
  { id: 'm2', canal: 'whatsapp', tipo: 'texto', cuerpo: 'si no me das tu email…' },
];
const SEC = { id: 289, nombre: 'Sprint · apertura', activa: true, archivada_at: null, pasos: PASOS };
const fila = (extra: Partial<FilaInscripcionDetalle>): FilaInscripcionDetalle => ({
  id: 291, lead_id: 3099, secuencia_id: 289, estado: 'activa', paso_actual: 2, nodo_actual: 'm2', proximo_envio_at: '2026-10-24T16:12:11Z',
  inscripto_at: hace(0.2), updated_at: hace(0.1), desenlace: null, ...extra,
});
const envio = (extra: Partial<FilaEnvioDetalle>): FilaEnvioDetalle => ({ inscripcion_id: 291, nodo_id: 'm1', canal: 'whatsapp', estado: 'enviado', error: null, created_at: hace(0.15), ...extra });
const armar = (o: { filas?: FilaInscripcionDetalle[]; envios?: FilaEnvioDetalle[]; audit?: FilaAuditDetalle[]; secs?: typeof SEC[] }) => detalleDe({
  zona: 'America/Tijuana', filas: o.filas ?? [fila({})], secs: o.secs ?? [SEC], reentradaDe: () => 'una_vez',
  envios: o.envios ?? [], audit: o.audit ?? [], ahoraMs: AHORA,
});

test('una viva: su paso de N, lo próximo con su hora, la reentrada y que se puede frenar o empezar de nuevo', () => {
  const [i] = armar({}).inscripciones;
  assert.equal(i.estado, 'activa');
  assert.deepEqual(i.paso && { numero: i.paso.numero, total: i.paso.total }, { numero: 3, total: 3 });
  assert.equal(i.proximo?.at, '2026-10-24T16:12:11Z');
  assert.equal(i.proximo?.canal, 'whatsapp');
  assert.equal(i.reentradaTexto, 'Una sola vez');
  assert.deepEqual(i.puede, { frenar: true, empezarDeNuevo: true });
  assert.equal(i.termino, null);
});

test('los envíos son los de ESTA inscripción, del más nuevo al más viejo, con su paso y su error', () => {
  const [i] = armar({ envios: [
    envio({ created_at: hace(0.15) }),
    envio({ nodo_id: 'm2', estado: 'fallo', error: 'No salió el aviso: El aviso quedó vacío.', created_at: hace(0.05) }),
    envio({ inscripcion_id: 999, created_at: hace(0.01) }),
    envio({ inscripcion_id: null, created_at: hace(0.02) }),  // de una corrida anterior: `reactivarInscripcion` lo desligó
  ] }).inscripciones;
  assert.equal(i.enviados.length, 2);
  assert.equal(i.enviados[0].estado, 'fallo');
  assert.equal(i.enviados[0].error, 'No salió el aviso: El aviso quedó vacío.');
  assert.equal(i.enviados[0].paso?.numero, 3);
  assert.equal(i.enviados[1].paso?.numero, 1);
});

test('las terminadas van debajo, sólo las de los últimos 30 días; una cancelada no se puede empezar de nuevo y dice por qué', () => {
  const d = armar({ filas: [
    fila({ id: 1, secuencia_id: 289, estado: 'cancelada', updated_at: hace(2), inscripto_at: hace(3) }),
    fila({ id: 2, secuencia_id: 290, estado: 'completada', updated_at: hace(DIAS_TERMINADAS + 1), inscripto_at: hace(40) }),
    fila({ id: 3, secuencia_id: 291, estado: 'activa', inscripto_at: hace(1) }),
  ], secs: [SEC, { ...SEC, id: 290, nombre: 'Vieja' }, { ...SEC, id: 291, nombre: 'Viva' }] });
  assert.deepEqual(d.inscripciones.map((i) => i.nombre), ['Viva', 'Sprint · apertura'], 'la terminada de hace más de 30 días se muestra, o el orden no pone las vivas arriba');
  const c = d.inscripciones[1];
  assert.deepEqual(c.termino?.texto, 'La frenaron');
  assert.equal(c.puede.empezarDeNuevo, false);
  assert.equal(c.puede.frenar, false);
  assert.match(c.puede.porQueNo ?? '', /frenada no vuelve a empezar/);
  assert.equal(c.paso, null);
  // Viva pero con el desenlace «cancelado» (una baja): tampoco.
  const [b] = armar({ filas: [fila({ desenlace: 'cancelado' })] }).inscripciones;
  assert.equal(b.puede.empezarDeNuevo, false);
});

test('con la automatización en pausa no se ofrece empezar de nuevo, y lo dice', () => {
  const [i] = armar({ secs: [{ ...SEC, activa: false }] }).inscripciones;
  assert.equal(i.puede.empezarDeNuevo, false);
  assert.equal(i.puede.porQueNo, 'La automatización está en pausa.');
});

test('los «no volvió a entrar» salen del historial, con el id de su inscripción y quién lo movió', () => {
  const m = motivoNoVuelve('una_vez', { estado: 'activa', desenlace: null });
  const d = armar({ audit: [
    { valor_nuevo: lineaNoVolvio('Sprint · apertura', m.texto), autor: 'martinkoncke@gmail.com', created_at: hace(0.1) },
    { valor_nuevo: lineaNoVolvio('Otra que ya no tiene', m.texto), autor: 'x', created_at: hace(0.2) },
    { valor_nuevo: 'Entró a «Sprint · apertura».', autor: 'MaKo', created_at: hace(0.3) },
  ] });
  assert.deepEqual(d.noEntro, [{ secuenciaId: 289, nombre: 'Sprint · apertura', at: hace(0.1), porque: 'una_sola_vez', texto: m.texto, quien: 'martinkoncke@gmail.com' }]);
  assert.equal(d.zona, 'America/Tijuana');
});

// ── Probado rompiéndolo (23/10/2026), de a una y restaurando. Base 5/0 ──
// R1 los envíos sin filtrar por la inscripción                                      → 4/1
// R2 sin el corte de `DIAS_TERMINADAS`                                              → 4/1
// R3 `reabre` sin `!cancelada`                                                      → 4/1
// R4 `noEntro` sin cruzar el nombre con las inscripciones del lead                  → 4/1
