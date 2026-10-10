// =============================================================================
// Una tarjeta TAG con VARIAS etiquetas: los lectores que miraban sólo la primera
// =============================================================================
// Sexta tanda (09/10/2026), TAG 2: «Se debería poder seleccionar multiple, si quiero sacar o agragar
// varias etiquetas». La tarjeta guarda la primera en `etiquetaId` y TODAS en `etiquetaIds` cuando son más
// de una (`paramsConEtiquetas`, lib/editor-acciones.ts). La segunda pasada (parte «motor») enchufó a los
// que leían sólo `etiquetaId`, y cada uno fallaba en silencio:
//   · el conteo de uso antes de ARCHIVAR (`usoEnPasos`, lib/etiquetas-reglas.ts): la 2.ª no contaba, y
//     archivarla no preguntaba;
//   · la COPIA a un workspace de prueba (`traducirEtiquetasEnSecuencia`): la 2.ª llegaba con el id del
//     DUEÑO, que en el destino es «no existe» o, por casualidad, OTRA etiqueta;
//   · CREAR / EDITAR CON IA (lib/flujo-ia.ts): el ref de una etiqueta nueva en la 2.ª posición no se
//     cambiaba por su id real (se guardaba NEGATIVO), la validación no miraba la 2.ª, y el contexto de
//     «Editar con IA» decía una sola. Medido acá: Editar con IA NO pierde las demás (sólo agrega).
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { usoEnPasos, traducirEtiquetasEnSecuencia } from '../lib/etiquetas-reglas';
import { deIA, deIAEdicion, validarIA, aIA, conEtiquetasReales, refsSinResolver, LISTA_BLANCA_IA, type CtxIA, type PasoIA } from '../lib/flujo-ia';
import { claseDe, type PasoGrafo } from '../lib/flujo-grafo';
import { porId } from '../lib/api-mako/registro';
import { LEAD_DEL_EVENTO as LEAD } from '../lib/api-mako/flujo-params';

const tag =(id: string, operacion: string, params: Record<string, unknown>, siguiente: string | null = null): PasoGrafo =>
  ({ id, canal: 'whatsapp', delay_horas: 0, cuerpo: '', accion: { operacion, params }, siguiente } as unknown as PasoGrafo);

// ── El conteo de uso, antes de archivar ───────────────────────────────────────

test('usoEnPasos cuenta la 2.ª y la 3.ª etiqueta de una tarjeta TAG, no sólo la primera', () => {
  const pasos = [tag('a', 'poner_etiqueta_lead', { leadId: LEAD, etiquetaId: 7, etiquetaIds: [7, 8, 9] })];
  assert.deepEqual(usoEnPasos(pasos, 8), { condiciones: 0, acciones: 1 }, 'archivar la 2.ª no preguntaría: «nada la usa»');
  assert.deepEqual(usoEnPasos(pasos, 9), { condiciones: 0, acciones: 1 });
  assert.deepEqual(usoEnPasos(pasos, 7), { condiciones: 0, acciones: 1 });
  assert.deepEqual(usoEnPasos(pasos, 5), { condiciones: 0, acciones: 0 });
  // Una sola (la forma de siempre) sigue igual.
  assert.deepEqual(usoEnPasos([tag('b', 'sacar_etiqueta_lead', { etiquetaId: 4 })], 4), { condiciones: 0, acciones: 1 });
});

// ── La copia a otro workspace ─────────────────────────────────────────────────

test('la copia traduce la lista entera; lo que no está en el mapa sale, y la primera vuelve a `etiquetaId`', () => {
  const mapa = new Map([[7, 70], [9, 90]]);
  const pasos = [tag('a', 'poner_etiqueta_lead', { leadId: LEAD, etiquetaId: 7, etiquetaIds: [7, 8, 9] })];
  const t = traducirEtiquetasEnSecuencia(pasos, null, (id) => mapa.get(id) ?? null);
  const p = (t.pasos as Array<{ accion: { params: Record<string, unknown> } }>)[0].accion.params;
  assert.deepEqual(p, { leadId: LEAD, etiquetaId: 70, etiquetaIds: [70, 90] }, 'la 2.ª o la 3.ª viajaron con el id del dueño');
  assert.equal(t.sinTraducir, 1);
  // Si de la lista queda una sola, queda la forma de una (sin la lista).
  const una = traducirEtiquetasEnSecuencia(pasos, null, (id) => (id === 9 ? 90 : null));
  assert.deepEqual((una.pasos as Array<{ accion: { params: Record<string, unknown> } }>)[0].accion.params, { leadId: LEAD, etiquetaId: 90 });
  // Ninguna: sin las dos (Publicar la frena: «falta elegir la etiqueta»).
  const ninguna = traducirEtiquetasEnSecuencia(pasos, null, () => null);
  assert.deepEqual((ninguna.pasos as Array<{ accion: { params: Record<string, unknown> } }>)[0].accion.params, { leadId: LEAD });
  // Y la forma de una sigue como siempre.
  const vieja = traducirEtiquetasEnSecuencia([tag('b', 'poner_etiqueta_lead', { etiquetaId: 7 })], null, (id) => mapa.get(id) ?? null);
  assert.deepEqual((vieja.pasos as Array<{ accion: { params: Record<string, unknown> } }>)[0].accion.params, { etiquetaId: 70 });
});

// ── Crear y editar con IA ─────────────────────────────────────────────────────

const acciones = LISTA_BLANCA_IA.map((id) => {
  const d = porId(id)!;
  return { id: d.id, titulo: d.titulo, parametros: d.parametros };
});
const ctxBase = (o: Partial<CtxIA> = {}): CtxIA => ({
  etiquetas: [{ id: 7, nombre: 'Cualificado' }, { id: 8, nombre: 'Llamar' }],
  productos: [{ funnelId: 3, productoId: null, nombre: 'Mentoría', esDefault: true, etapas: [{ value: 'nuevo', label: 'Nuevo' }] }],
  disparadores: [{ value: 'trigger:instant_form_sin_agenda', label: 'Formulario sin agenda' }],
  audios: [], archivos: [], acciones, links: {},
  ...o,
});
const rndDe = () => { let k = 0; return () => ((k++ * 0.137) % 1); };
const tagsDe = (pasos: readonly PasoGrafo[]) => pasos.filter((p) => claseDe(p) === 'accion').map((p) => (p as PasoIA).accion!.params);

test('crear con IA: una tarjeta con varias (una nueva en la 2.ª) se guarda con el id REAL de todas', () => {
  const ctx = ctxBase();
  const r = deIA({ inicio: 't1', tarjetas: [{ id: 't1', tipo: 'etiqueta', poner: ['Cualificado', 'Seguimiento'] }] }, ctx, rndDe());
  assert.deepEqual(tagsDe(r.pasos), [{ leadId: LEAD, etiquetaId: 7, etiquetaIds: [7, -1] }]);
  assert.deepEqual(r.etiquetasNuevas.map((n) => n.nombre), ['Seguimiento'], 'la etiqueta nueva de la 2.ª posición no se iba a crear');
  assert.deepEqual(refsSinResolver(r.pasos), [-1], 'el ref de la 2.ª no se ve: se guardaría NEGATIVO');
  const reales = conEtiquetasReales(r.pasos, new Map([[-1, 40]]));
  assert.deepEqual(tagsDe(reales), [{ leadId: LEAD, etiquetaId: 7, etiquetaIds: [7, 40] }]);
  assert.deepEqual(refsSinResolver(reales), []);
});

test('la validación mira TODAS las etiquetas de la tarjeta', () => {
  const ctx = ctxBase();
  const pasos = [tag('a', 'poner_etiqueta_lead', { leadId: LEAD, etiquetaId: 7, etiquetaIds: [7, 99] })];
  assert.ok(validarIA(pasos, ctx).includes('una etiqueta de una acción no existe'), 'una 2.ª que no existe pasaba');
  assert.deepEqual(validarIA([tag('a', 'poner_etiqueta_lead', { leadId: LEAD, etiquetaId: 7, etiquetaIds: [7, 8] })], ctx), []);
});

test('«Editar con IA» lee las etiquetas de la tarjeta y NO las pierde: sólo agrega', () => {
  const ctx = ctxBase();
  const base: PasoGrafo[] = [
    { id: 'm1', canal: 'whatsapp', delay_horas: 0, cuerpo: 'Hola', siguiente: 'g1' } as unknown as PasoGrafo,
    tag('g1', 'poner_etiqueta_lead', { leadId: LEAD, etiquetaId: 7, etiquetaIds: [7, 8] }),
  ];
  // Lo que LEE el modelo: las dos.
  const leido = aIA(base, ctx).tarjetas.find((t) => t.id === 'g1');
  assert.deepEqual(leido?.poner, ['Cualificado', 'Llamar'], 'el contexto decía una sola');
  // Lo que queda después de agregar: la tarjeta de antes, idéntica.
  const r = deIAEdicion({ agregar: [{ despues_de: 'g1', salida: 'sig', tarjetas: [{ id: 'x1', tipo: 'mensaje', texto: 'Listo' }] }] }, base, ctx, rndDe());
  assert.deepEqual((r.pasos.find((p) => p.id === 'g1') as PasoIA).accion!.params, { leadId: LEAD, etiquetaId: 7, etiquetaIds: [7, 8] });
});

test('el aviso dice «Quité una etiqueta» con el verbo de la casa (TAG 1)', () => {
  const ctx = ctxBase({ acciones: acciones.filter((a) => a.id !== 'sacar_etiqueta_lead') });
  const r = deIA({ inicio: 't1', tarjetas: [{ id: 't1', tipo: 'etiqueta', sacar: 'Cualificado' }] }, ctx, rndDe());
  assert.ok(r.avisos.includes('Quité una etiqueta: eliminar etiquetas no está disponible aquí'), r.avisos.join(' | '));
  assert.ok(!r.avisos.some((a) => /\b(poner|sacar|Saqué una etiqueta)\b/.test(a)), r.avisos.join(' | '));
});

// ── ROTURAS (09/10/2026) ───────────────────────────────────────────────────────────────────────
// Con el arnés del scratchpad (rompe UNA, corre este archivo, restaura DE MEMORIA con md5; nunca git).
// Base: 6 / 0 (y 27 / 0 con tests/flujo-ia.test.ts). Las siete cayeron:
//   · `usoEnPasos` mirando sólo `etiquetaId`                                  → 5 / 1
//   · la copia sin traducir la lista                                          → 5 / 1
//   · el aviso de vuelta a «Saqué una etiqueta: poner etiquetas…»             → 5 / 1
//   · `refsEnPasos`, `conEtiquetasReales`, `validarIA` y `aIA` con sólo la primera → 26 / 1 cada una
// Restaurado: 6 / 0.
