// El CRON «Pagos» (11/10/2026): los eventos de la pasarela (Stripe / Mercado Pago) como disparador de una
// automatización. Martín eligió que sea un BOTÓN PROPIO de la primera pantalla (no un evento adentro de
// «Producto»), con la grilla en 4+3 — eso lo mira tests/editor-disparadores.test.ts.
//
// ROTURAS (11/10/2026, de a una, restauradas de memoria): base 6 pass / 0 fail.
//   · sin TRIGGER_PAGO en CON_SUBTIPO (`higiene` borra el subtipo y nunca dispara)  → 4 / 2
//   · disparaPorEvento('pago') que acepta cualquier subtipo                         → 5 / 1
//   · claseDelTipo sin la rama de pagos (se dibuja como «Producto (de antes)»)      → 5 / 1
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  EVENTOS_PAGO, EVENTOS_PAGO_CON_DATOS, TRIGGER_PAGO, TRIGGERS_SOLO_EVENTO, SOLO_DESDE_EL_CRON, borradorDeClase, claseDeDisparador,
  disparaPorEvento, disparadoresDe, eventosDe, esEventoDeAntes, problemaDeDisparador, subtiposDelCronPago, textoDeDisparador,
  traeLosDatosDelPago, type Disparador,
} from '../lib/disparadores';
import { contextoDeTarjeta, problemasDeTokens } from '../lib/tokens-del-flujo';
import { valoresDelPago, datosGuardados, textoConDatos } from '../lib/variables-del-lead';
import { camposDeReactivacion } from '../lib/nutricion-reinscripcion';
import type { PasoGrafo } from '../lib/flujo-grafo';

const leer = (p: string) => readFileSync(resolve(import.meta.dirname, p), 'utf8').replace(/\r\n/g, '\n');
const pago = (subtipo: string | null): Disparador => ({ id: 'd1', trigger_tipo: TRIGGER_PAGO, subtipo });

test('los eventos de pago, en las palabras del CRON (no las del proveedor)', () => {
  // ⚠️ Y desde el 5/11/2026 el quinto, «Te mandan un comprobante»: la foto o el PDF de un lead (tests/comprobantes.test.ts).
  assert.deepEqual(EVENTOS_PAGO.map((e) => e.subtipo), ['aprobado', 'rechazado', 'reembolsado', 'suscripcion_cancelada', 'comprobante']);
  for (const e of EVENTOS_PAGO) assert.match(e.subtipo, /^[a-z_]{1,30}$/, 'el subtipo lo sanea /^[a-z_]{1,30}$/');
  assert.equal(eventosDe('pagos'), EVENTOS_PAGO);
});

test('es un CRON de evento: no barre por horario y se elige sólo en el CRON', () => {
  assert.ok(TRIGGERS_SOLO_EVENTO.has(TRIGGER_PAGO));
  assert.ok(SOLO_DESDE_EL_CRON.has(TRIGGER_PAGO));
  assert.equal(problemaDeDisparador({ ...pago('aprobado'), cron: { tipo: 'diario', hora: '09:00' } as never }, { unico: true }), 'Un evento no se repite por horario');
});

test('su clase es «pagos» (no «Producto (de antes)») y el borrador nace sin evento', () => {
  assert.equal(claseDeDisparador(pago('aprobado')), 'pagos');
  assert.equal(esEventoDeAntes(pago('aprobado')), false);
  assert.deepEqual(borradorDeClase('pagos', 'd9', { tipo: 'diario', hora: '09:00' } as never), { id: 'd9', trigger_tipo: TRIGGER_PAGO, subtipo: null });
  assert.equal(problemaDeDisparador(pago(null), { unico: true }), 'Elige el evento');
  assert.equal(textoDeDisparador(pago('reembolsado'), { deSiempre: () => 'NO' }), 'Se devuelve un pago');
});

test('el subtipo SOBREVIVE a la higiene (si no, la automatización se ve armada y no arranca nunca)', () => {
  const [d] = disparadoresDe({ trigger_tipo: TRIGGER_PAGO, etapa: 'manual', disparadores: [pago('rechazado')] });
  assert.equal(d.subtipo, 'rechazado');
});

test('dispara SÓLO con el mismo evento; sin subtipo, nada', () => {
  assert.equal(disparaPorEvento(pago('aprobado'), 'pago', { subtipo: 'aprobado' }), true);
  assert.equal(disparaPorEvento(pago('aprobado'), 'pago', { subtipo: 'rechazado' }), false);
  assert.equal(disparaPorEvento(pago('aprobado'), 'pago', {}), false, 'un aviso que no dice qué pasó no cae en «entonces todos»');
  assert.equal(disparaPorEvento({ id: 'd1', trigger_tipo: 'email_recibido' }, 'pago', { subtipo: 'aprobado' }), false);
  assert.equal(disparaPorEvento({ ...pago('aprobado'), cron: { tipo: 'diario', hora: '09:00' } as never }, 'pago', { subtipo: 'aprobado' }), false, 'un Recurrente nunca responde a un evento');
});

test('la puerta del motor: enrolarPorPago pasa el subtipo por el ctx, sin casts, y el motor mira TRIGGER_PAGO', () => {
  const puerta = leer('../lib/pago-entrante.ts');
  assert.match(puerta, /enrolarPorEvento\(leadId, 'pago', ctx\)/);
  assert.doesNotMatch(puerta, / as (any|never|unknown)\b/, 'el ctx va tipado, no con un cast');
  assert.doesNotMatch(puerta.replace(/\/\/.*$/gm, ''), /lead_nuevo/, 'un lead que entra pagando no es uno «sin agendar»');
  // La tabla de eventos del motor vive en un módulo puro desde el 21/10/2026 (la lee también el aviso de duplicada).
  const motor = leer('../lib/nutricion-eventos.ts');
  assert.match(motor, /\n\s+pago: \[TRIGGER_PAGO\],/);
});
// =============================================================================
// LOS DATOS DEL PAGO VIAJAN POR EL CRON (6/11/2026, el pendiente 288)
// =============================================================================
// Hasta hoy una tarjeta «MaKo en WhatsApp» de este CRON no podía decir de CUÁNTO era el pago: `{{pago_monto}}` tiene
// `alcance: 'pago'` y `alcanzaPara` lo daba sólo con `conPago`, que ponía únicamente el Evento de MaKo
// `pago_recibido` — su emisor los pasa en `datos`. `enrolarPorPago` mandaba `{ subtipo }` y nada más, así que el
// equipo se enteraba de un pago rechazado y tenía que ir a la ficha a ver qué cobrarle.
//
// El viaje, de punta a punta: `alCron` (lib/cobros.ts, con el cobro en la mano) → `enrolarPorPago` →
// `CtxEvento.datos` → `nutricion_inscripciones.datos_evento` (mig 0411) → el paso de acción → `ejecutarDesdeFlujo`
// → `Ctx.datosDelEvento` → `textoDelAviso`. Cada tramo tiene su test abajo, y uno mide el TEXTO que sale.

/** Una tarjeta «MaKo en WhatsApp» (la ⚡ Acción `avisar_al_equipo`), como la arma el lienzo. */
const mako = (id: string, params: Record<string, unknown>): PasoGrafo => ({
  id, orden: 0, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null, proveedor: 'no_oficial',
  siguiente: null, accion: { operacion: 'avisar_al_equipo', params: { leadId: 'evento', ...params } },
}) as unknown as PasoGrafo;

/** Un WhatsApp al lead. */
const alLead = (id: string, cuerpo: string): PasoGrafo => ({
  id, orden: 0, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo, template_wa: null, proveedor: 'no_oficial', siguiente: null,
}) as unknown as PasoGrafo;

test('⚠️ qué eventos del CRON traen el pago: los cuatro de la pasarela, NO el comprobante', () => {
  // `comprobante` lo emite lib/evolution-mensajes.ts con una foto o un PDF del lead: ahí no hay ningún pago leído.
  assert.deepEqual([...EVENTOS_PAGO_CON_DATOS].sort(), ['aprobado', 'rechazado', 'reembolsado', 'suscripcion_cancelada']);
  const fuera = EVENTOS_PAGO.map((e) => e.subtipo).filter((s) => !EVENTOS_PAGO_CON_DATOS.has(s));
  assert.deepEqual(fuera, ['comprobante'], 'un evento nuevo del CRON entra a la lista sólo si su emisor pasa los datos');
  for (const s of EVENTOS_PAGO_CON_DATOS) assert.equal(traeLosDatosDelPago(s), true, s);
  assert.equal(traeLosDatosDelPago('comprobante'), false);
  // Con la LISTA de los CRON de la fila: TODO o nada. Uno que no los trae publicaría un token que a veces sale crudo.
  assert.equal(traeLosDatosDelPago(['rechazado', 'aprobado']), true);
  assert.equal(traeLosDatosDelPago(['rechazado', 'comprobante']), false, 'con un evento sin pago, nadie cita el monto');
  assert.equal(traeLosDatosDelPago([]), false, 'una fila sin CRON de pago no trae ningún pago');
  assert.equal(traeLosDatosDelPago(undefined), false);
  assert.equal(traeLosDatosDelPago(null), false);
  assert.equal(traeLosDatosDelPago(['rechazado', 7]), false, 'lo que no es un subtipo no cuenta como uno');
  // Los subtipos de una fila salen de SUS disparadores (uno por evento), ya pasados por la higiene.
  assert.deepEqual(
    subtiposDelCronPago({ trigger_tipo: TRIGGER_PAGO, etapa: 'manual', disparadores: [pago('rechazado'), { id: 'd2', trigger_tipo: TRIGGER_PAGO, subtipo: 'comprobante' }] }),
    ['rechazado', 'comprobante'],
  );
  assert.deepEqual(subtiposDelCronPago({ trigger_tipo: 'etapa_actual', etapa: 'manual' }), [], 'una fila de etapa no tiene ninguno');
});

test('⚠️ la tarjeta de MaKo de este CRON OFRECE el pago, y Publicar la deja publicar', () => {
  const tarjeta = mako('rp_mk', { mensaje: '💰 {{pago_monto}} de {{pago_concepto}} por {{pago_pasarela}} · {{pago_tipo}}' });
  assert.deepEqual(contextoDeTarjeta(tarjeta, { trigger_tipo: TRIGGER_PAGO, subtipo: ['rechazado'] }),
    { tipo: 'catalogo', datos: { destino: 'equipo', conLead: true, conPago: true } });
  assert.deepEqual(problemasDeTokens([tarjeta], TRIGGER_PAGO, ['rechazado']), [], 'Publicar frena un dato que sí se resuelve');
  // Y con `comprobante` en la misma fila NO: el dato no llegaría y saldría crudo al grupo del negocio.
  assert.deepEqual(contextoDeTarjeta(tarjeta, { trigger_tipo: TRIGGER_PAGO, subtipo: ['rechazado', 'comprobante'] }),
    { tipo: 'catalogo', datos: { destino: 'equipo', conLead: true } });
  assert.deepEqual(problemasDeTokens([tarjeta], TRIGGER_PAGO, ['rechazado', 'comprobante']),
    [{ tarjeta: 'rp_mk', motivo: 'No existe: {{pago_monto}}, {{pago_concepto}}, {{pago_pasarela}}, {{pago_tipo}}' }]);
  // Sin saber el evento (una fila vieja, un llamador que no lo pasa) tampoco: no se ofrece lo que no se sabe que llega.
  assert.equal(problemasDeTokens([tarjeta], TRIGGER_PAGO).length, 1);
  // Y SIGUE SIENDO del equipo: un mensaje al LEAD no lo cita (`soloPara: 'equipo'`), en este CRON tampoco.
  assert.deepEqual(problemasDeTokens([alLead('w1', 'Te rechazaron {{pago_monto}}')], TRIGGER_PAGO, ['rechazado']),
    [{ tarjeta: 'w1', motivo: 'No existe: {{pago_monto}}' }]);
});

test('⚠️ los valores: el monto por código, y `pago_tipo` sólo si quien emite sabe si es renovación', () => {
  const base = { monto: 2300, moneda: 'USD', concepto: 'Mentoría 1:1', proveedor: 'stripe' as const, modo: 'real' };
  // El CRON de un rechazo: dice el tipo porque `aplicarPagoFallido` sabe por cuál de sus tres caminos entró.
  assert.deepEqual(valoresDelPago({ ...base, renovacion: true }), {
    pago_monto: 'US$ 2.300', pago_concepto: 'Mentoría 1:1', pago_pasarela: 'Stripe', pago_tipo: 'Renovación',
  });
  // Una suscripción cancelada no habla de ningún pago: sin `renovacion`, `pago_tipo` NO sale (y su renglón se va).
  assert.equal('pago_tipo' in valoresDelPago(base), false);
  // Y el alta es del Evento de MaKo: el CRON no la relee por un renglón.
  assert.equal('pago_alta' in valoresDelPago(base), false);
  assert.equal(valoresDelPago({ ...base, modo: 'prueba', renovacion: false }).pago_modo, 'Prueba');
  // EL TEXTO QUE SALE, con la regla de todo envío (el renglón de un dato sin valor se va).
  const texto = '💳 Le rechazaron el pago a {{nombre_completo}}\n💰 {{pago_monto}} por {{pago_pasarela}}\n🧾 {{pago_concepto}} · {{pago_tipo}}';
  assert.equal(textoConDatos(texto, { nombre_completo: 'Ana Ruiz', ...valoresDelPago({ ...base, renovacion: false }) }),
    '💳 Le rechazaron el pago a Ana Ruiz\n💰 US$ 2.300 por Stripe\n🧾 Mentoría 1:1 · Primer pago');
  // Un cobro sin concepto se lleva SU renglón y deja el monto: por eso van en renglones distintos.
  assert.equal(textoConDatos(texto, { nombre_completo: 'Ana Ruiz', ...valoresDelPago({ ...base, concepto: '  ', renovacion: false }) }),
    '💳 Le rechazaron el pago a Ana Ruiz\n💰 US$ 2.300 por Stripe');
});

test('⚠️ lo guardado se vuelve a mirar al leerlo: nada que no sea un texto con valor llega al grupo', () => {
  assert.deepEqual(datosGuardados({ pago_monto: ' US$ 2.300 ', pago_concepto: 'Mentoría' }), { pago_monto: 'US$ 2.300', pago_concepto: 'Mentoría' });
  // Un número o un objeto en el lugar de un monto llegaría como «2300» o «[object Object]»: afuera, queda crudo.
  assert.deepEqual(datosGuardados({ pago_monto: 2300, pago_concepto: { a: 1 }, pago_pasarela: null, pago_tipo: '' }), {});
  assert.deepEqual(datosGuardados({ 'Pago Monto': 'x', 'pago-monto': 'x', _pago: 'x' }), {}, 'sólo claves como las del catálogo');
  assert.equal(datosGuardados({ pago_concepto: 'x'.repeat(900) }).pago_concepto.length, 500, 'un dato no crece sin tope');
  for (const malo of [null, undefined, 'x', 7, [1, 2]]) assert.deepEqual(datosGuardados(malo), {});
});

test('⚠️ una inscripción REUSADA no cita el monto de la corrida anterior', () => {
  const r = { proximoEnvioAt: '2026-11-06T10:00:00.000Z', reunionAt: null, ahora: '2026-11-06T09:00:00.000Z' };
  assert.deepEqual(camposDeReactivacion({ ...r, datos: { pago_monto: 'US$ 97' } }).datos_evento, { pago_monto: 'US$ 97' });
  // Sin datos en ESTE arranque, los de antes se BORRAN. Un monto viejo en el grupo es peor que ninguno: nadie duda
  // de un número. (La renovación rechazada de marzo diría el monto de la de febrero.)
  assert.equal(camposDeReactivacion({ ...r, datos: null }).datos_evento, null);
  assert.equal(camposDeReactivacion({ ...r, datos: {} }).datos_evento, null);
  assert.equal(camposDeReactivacion(r).datos_evento, null);
});

test('⚠️ el viaje completo, tramo por tramo (si uno se corta, el token sale CRUDO al grupo)', () => {
  // 1. La migración, ANTES del deploy: el motor lee la columna en el `select` de la cola.
  assert.match(leer('../supabase/migrations/0411_inscripcion_datos_evento.sql'), /add column if not exists datos_evento jsonb/);
  // 2. `alCron` arma los datos con el cobro en la mano y los manda al CRON. Y cada sitio DICE si es renovación
  //    (o calla a propósito): el rechazo del cobro pendiente y el de la suscripción ya pagada son el mismo subtipo.
  const cobros = leer('../lib/cobros.ts');
  assert.match(cobros, /monto: p\?\.monto \?\? c\.monto, moneda: p\?\.moneda \|\| c\.moneda, concepto: c\.concepto, proveedor: c\.proveedor,/);
  assert.match(cobros, /await enrolarPorPago\(c\.lead_id, subtipo, datos\);/);
  assert.match(cobros, /await alCron\(actual, 'aprobado', \{ renovacion, monto: montoDeEstePago, moneda: \(renovacion && p\.moneda\) \|\| actual\.moneda \}\);/);
  assert.match(cobros, /await alCron\(c, 'rechazado', \{ renovacion: true \}\);/);
  assert.equal((cobros.match(/await alCron\(c, 'rechazado', \{ renovacion: false \}\);/g) ?? []).length, 2, 'los dos rechazos de un cobro que todavía no cobró');
  assert.match(cobros, /await alCron\(c, 'reembolsado', \{ renovacion: !esElPrimero \}\);/);
  assert.match(cobros, /await alCron\(c, 'suscripcion_cancelada'\);/, 'una cancelación no afirma si era renovación');
  assert.equal((cobros.match(/await alCron\(/g) ?? []).length, 6, 'un `alCron` nuevo tiene que decidir qué dice de `renovacion`');
  // 3. La puerta pasa los datos por el ctx, sin casts.
  assert.match(leer('../lib/pago-entrante.ts'), /const ctx: CtxEvento = \{ subtipo, \.\.\.\(datos && Object\.keys\(datos\)\.length \? \{ datos \} : \{\}\) \};/);
  // 4. El motor los GUARDA en la inscripción (y los repone en la fila reusada), y los LEE en la cola.
  const nut = leer('../lib/nutricion.ts');
  assert.match(nut, /const datosDelEvento: Record<string, string> \| null = Object\.keys\(sane\)\.length \? sane : null;/);
  assert.match(nut, /\.\.\.\(datosDelEvento \? \{ datos_evento: datosDelEvento \} : \{\}\),/);
  assert.match(nut, /datos: datosDelEvento,/, 'la fila reusada arranca con los datos de ESTE evento');
  assert.match(nut, /\.select\('id, lead_id, secuencia_id, paso_actual, nodo_actual, proximo_envio_at, hilos, hilos_rev, estado, desenlace, inscripto_at, datos_evento'\)/);
  // 5. El paso de acción los pasa a quien ejecuta.
  assert.match(nut, /datos: datosGuardados\(insc\.datos_evento\),/);
  assert.match(leer('../lib/nutricion-paso-accion.ts'), /\.\.\.\(e\.datos && Object\.keys\(e\.datos\)\.length \? \{ datos: e\.datos \} : \{\}\),/);
  // 6. Y llegan al Ctx y a los CUATRO textos del aviso. ⚠️ NO como parámetro de la acción: el `enum` y las
  //    descripciones del registro se pagan en el presupuesto del turno (tests/ops-center-bateria.test.ts, el 4).
  const flujo = leer('../lib/api-mako/flujo.ts');
  assert.match(flujo, /const ctx = ctxDeFlujo\(opts\.ws, opts\.origen, opts\.nombre, opts\.datos\);/);
  assert.match(flujo, /\.\.\.\(datos && Object\.keys\(datos\)\.length \? \{ datosDelEvento: datos \} : \{\}\),/);
  const run = leer('../lib/api-mako/areas/chatbot.run.ts');
  assert.match(run, /const base: Record<string, string> = \{ \.\.\.delEvento, \.\.\.delLead \};/);
  for (const sitio of [
    /textoDelAviso\(mensajeCrudo, lead, ctx\.ws, ctx\.datosDelEvento\)/,
    /textoDelAviso\(String\(payload\.titulo \?\? ''\), lead, ctx\.ws, ctx\.datosDelEvento\)/,
    /textoDelAviso\(asuntoDeMako\(payload\), lead, ctx\.ws, ctx\.datosDelEvento\)/,
    /textoDelAviso\(t, lead, ctx\.ws, ctx\.datosDelEvento\)/,
  ]) assert.match(run, sitio);
  assert.doesNotMatch(leer('../lib/api-mako/areas/chatbot.def.ts'), /nombre: 'datos'/, 'los datos del evento no son un parámetro de la acción: cuestan presupuesto');
});

// ROTURAS DE ESTA TANDA (6/11/2026, de a una y restaurando). Base 12 pass / 0 fail. Las 8 CAYERON.
//   · `alCron` sin pasar `datos` a `enrolarPorPago` (la inscripción entra sin el pago)        → 11 / 1
//   · `EVENTOS_PAGO_CON_DATOS` con `comprobante` adentro                                     → 10 / 2
//   · `traeLosDatosDelPago` con `some` en vez de `every` (un evento alcanza)                 → 10 / 2
//   · `camposDeReactivacion` sin `datos_evento` (la reusada hereda el monto viejo)           → 11 / 1
//   · el `select` de la cola sin `datos_evento` (el motor no los ve nunca)                   → 11 / 1
//   · `datosGuardados` sin el filtro de `typeof v !== 'string'` (sale «[object Object]»)     → 11 / 1
//   · `valoresDelPago` con `pago_tipo` siempre (una cancelación dice «Primer pago»)          → 11 / 1
//   · `contextoDeTarjeta` con `conPago: true` para TODO el CRON «Pagos»                      → 11 / 1
