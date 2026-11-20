// EL TICKET #120 (20/11/2026, ws 23): en el grupo, alguien que no administra el negocio escribió «Hola Mako, Marcela quiere probar la
// funcionalidad de agregar un evento al calendario de google». MaKo no tenía qué agendar (ni qué, ni qué día, ni a qué hora), el turno
// terminó sin proponer y la acción se DELEGÓ: «Lo pasé al equipo de MaKo (pedido #120)», y el pedido quedó esperando a Martín. Agendar
// un evento es una escritura SIMPLE: MaKo la hace sola. Leído en producción, dos minutos después la dueña lo pidió con los datos y
// MaKo lo agendó. Lo que fija este archivo (lib/despacho-grupo.ts y la rama de la delegación en lib/mako-doer-in.ts):
//   1. agendar sin qué ni cuándo se PREGUNTA, no se delega; con fecha, o si cancela o borra, como antes;
//   2. un pedido del dato sin signo de pregunta («pásame el día y la hora») también es preguntar;
//   3. el doer escribe el pedido de los datos y no abre el ticket.
//
// PROBADO ROMPIÉNDOLO (20/11/2026), cada rotura por separado y vuelta atrás:
//   T1 `pideDatosEnVezDeDelegar` siempre null                   → falla 1
//   T2 pide los datos aunque el pedido traiga la fecha           → falla 1
//   T3 pide los datos aunque cancele                             → falla 1
//   T4 `preguntaUnDato` otra vez sólo con el signo final         → falla 2
//   T5 el doer abre el ticket igual                              → falla 3
//   T6 el doer no pone el pedido de los datos como respuesta     → falla 3
import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCIONES_SIMPLES, PIDE_DATOS_AGENDA, delegaLaAccion, pideDatosEnVezDeDelegar, preguntaUnDato } from '../lib/despacho-grupo';
import { fuenteSinComentarios } from './_fuente-sin-comentarios';

test('1. agendar sin qué ni cuándo se pregunta; con la fecha, o si cancela o borra, no', () => {
  assert.ok(ACCIONES_SIMPLES.has('crear_evento_google'), 'agendar en Google es de lo que MaKo hace sola');
  assert.equal(pideDatosEnVezDeDelegar('Hola Mako, Marcela quiere probar la funcionalidad de agregar un evento al calendario de google'), PIDE_DATOS_AGENDA, 'el pedido del ticket, tal cual');
  for (const t of ['MaKo, agéndame una reunión', 'Quiero crear un evento en el calendario', 'Pon una cita en mi calendario', 'Agrega una llamada con Pedro']) {
    assert.equal(pideDatosEnVezDeDelegar(t), PIDE_DATOS_AGENDA, t);
  }
  for (const t of [
    'Agendar mañana a las 10 una reunión con Ana', 'Agenda el 25 de noviembre la llamada', 'agrega un evento el viernes', 'Agendar reunión 16 hs',
    'Cancela la reunión con Ana', 'Borra el evento de hoy', 'Crea una campaña de anuncios', 'Agrega un lead: Juan Pérez',
  ]) assert.equal(pideDatosEnVezDeDelegar(t), null, t);
  assert.match(PIDE_DATOS_AGENDA, /qué es, qué día y a qué hora/);
  assert.match(PIDE_DATOS_AGENDA, /«MaKo, agenda la reunión con Ana el 25 de noviembre de 16 a 17»/, 'el ejemplo es un pedido que sí agenda');
  assert.equal(pideDatosEnVezDeDelegar(PIDE_DATOS_AGENDA.split('«')[1].replace('»', '').replace(/[.»]+$/, '')), null, 'el ejemplo, dicho tal cual, ya trae la fecha');
});

test('2. pedir el dato sin signo de pregunta también es preguntar (no se delega)', () => {
  for (const r of ['Pásame el título, el día y la hora y lo agendo.', 'Dime qué día y a qué hora quieres la reunión.', 'Necesito saber el día y la hora.', 'Indícame la fecha y te la dejo lista.']) {
    assert.ok(preguntaUnDato(r), r);
    assert.ok(!delegaLaAccion({ propuso: false, escribio: false, respuesta: r }), `no se delega: ${r}`);
  }
  for (const r of ['Listo, ya quedó creada la automatización.', 'Te mando el reporte en un rato.', 'Escríbeme cuando quieras.']) assert.ok(!preguntaUnDato(r), r);
  assert.ok(preguntaUnDato('¿A qué hora la agendo?'), 'el signo final, como siempre');
});

test('3. el doer escribe el pedido de los datos y no abre el ticket', () => {
  const d = fuenteSinComentarios('lib/mako-doer-in.ts');
  const rama = d.slice(d.indexOf('&& delegaLaAccion({'), d.indexOf('respuesta = respuestaDeLaDelegacion(abierto.id'));
  const pide = rama.indexOf('const pideDatos = pideDatosEnVezDeDelegar(sinPrefijoDeLote(texto));');
  const fijo = rama.indexOf('respuesta = pideDatos;\n        textoFijo = true;');
  const ticket = rama.indexOf('const abierto = pideDatos ? null : await abrirTicketDelGrupo({');
  assert.ok(pide > 0 && fijo > pide && ticket > fijo, 'se pregunta, y el ticket sólo si no');
});
