// =============================================================================
// «Probar» recorre el FLUJO que se está editando (lib/simulador-grafo.ts) — punto 10 del
// pedido de Martín del 08/10/2026
// =============================================================================
// Ejecuta el recorrido puro: ramas que elige quien prueba, esperas y acciones que se nombran y
// no se ejecutan, la pausa de la salida cuando el lead escribe, «Si responde» por el caso que
// eligió el clasificador, sin «Si responde» MaKo no contesta, el «Ir a» que retoma la salida y
// el tope de vueltas. Y la parte pura de la prueba REAL: qué forma tiene un mensaje y qué envíos
// produce (el primero lleva el aviso, el pie del audio sale después).
//
// PROBADO ROMPIÉNDOLO (08/10/2026) con un arnés que rompe, corre y restaura DE MEMORIA (nunca con
// git checkout). Sin romper: todos en verde. Las roturas y lo que cazó cada una están al pie del
// archivo (`ROTURAS`), con el número de fallos.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PasoGrafo } from '../lib/flujo-grafo';
import {
  flujoParaProbar, iniciar, siguiente, elegir, pausarPorRespuesta, entrarEnRespuesta, escenarioParaRedactar,
  textoDeEjemplo, firmaFlujo, sanearMensajePrueba, sanearDestinoPrueba, planDePrueba, AVISO_PRUEBA, TOPE_SALTOS,
  debeSalirDeVerdad, claveDestinoPrueba, reclamarCupoPrueba, TOPE_PRUEBA_REAL, VENTANA_PRUEBA_MIN,
  burbujaDeArchivo, destinoDelQueMira,
  type EstadoSim, type EventoSim,
} from '../lib/simulador-grafo';
import { contenidoDeMensaje } from '../app/whatsapp/_shared/ChatHilo';

const msg = (o: Partial<PasoGrafo> = {}): PasoGrafo => ({ canal: 'whatsapp', proveedor: 'no_oficial', delay_horas: 0, asunto: null, cuerpo: 'hola', template_wa: null, ...o });

/** Corre hasta que el simulador no tiene nada que hacer (fin, una elección o la salida pausada). */
function correr(pasos: PasoGrafo[], estado: EstadoSim): { eventos: EventoSim[]; estado: EstadoSim } {
  const eventos: EventoSim[] = [];
  let e = estado;
  for (let k = 0; k < 500; k++) {
    const r = siguiente(pasos, e);
    e = r.estado;
    if (!r.evento) break;
    eventos.push(r.evento);
    if (r.evento.t === 'condicion' || r.evento.t === 'fin') break;
  }
  return { eventos, estado: e };
}

/** Lo que se ve, en una línea por evento. */
const ver = (ev: EventoSim[]) => ev.map((e) => (e.t === 'mensaje' ? `💬${e.paso.cuerpo}` : e.t === 'condicion' ? `◇${e.opciones.map((o) => o.texto).join('|')}` : e.t === 'fin' ? `■${e.texto}` : e.texto));

// Un flujo con una condición de dos ramas, una espera, una acción y un «Si responde» con un caso.
const FLUJO: PasoGrafo[] = [
  msg({ id: 'm1', cuerpo: 'Hola {{nombre}}', siguiente: 'e1' }),
  { id: 'e1', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 1440 }, siguiente: 'c1', canal: 'whatsapp', cuerpo: '' },
  {
    id: 'c1', nodo: 'condicion', canal: 'whatsapp', cuerpo: '',
    ramas: [{ id: 'r1', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'm2' }],
    si_no: 'a1',
  },
  msg({ id: 'm2', cuerpo: 'Nos vemos', siguiente: null }),
  { id: 'a1', canal: 'whatsapp', cuerpo: '', accion: { operacion: 'mover_lead_etapa', params: {} }, siguiente: 'm3' },
  msg({ id: 'm3', cuerpo: '¿Seguimos?', siguiente: null }),
  {
    id: 'resp', nodo: 'respuesta', canal: 'whatsapp', cuerpo: '',
    casos: [{ id: 'k1', titulo: 'Quiere el precio', cuando: 'pregunta cuánto sale', siguiente: 'ia1' }],
    si_no: 'aviso',
  },
  msg({ id: 'ia1', tipo: 'ia', cuerpo: 'Dile que el precio se ve en la llamada', siguiente: 'salto' }),
  { id: 'salto', nodo: 'ir_a', destino: { nodo: 'm3' }, canal: 'whatsapp', cuerpo: '' },
  { id: 'aviso', canal: 'whatsapp', cuerpo: '', accion: { operacion: 'avisar_al_equipo', params: {} }, siguiente: null },
];

test('la salida arranca en la raíz: mensaje, la espera como píldora, y se para en la condición', () => {
  const { eventos, estado } = correr(FLUJO, iniciar(FLUJO));
  assert.deepEqual(ver(eventos), ['💬Hola {{nombre}}', '⏳ Esperar 1 día', '◇Agendó|Si no']);
  assert.ok(estado.eligiendo, 'espera que quien prueba elija');
  // Mientras no elija, no avanza.
  assert.equal(siguiente(FLUJO, estado).evento, null);
});

test('quien prueba elige la rama: cada una lleva a lo suyo', () => {
  const parado = correr(FLUJO, iniciar(FLUJO)).estado;
  const porAgendo = correr(FLUJO, elegir(parado, 'r1'));
  assert.deepEqual(ver(porAgendo.eventos), ['💬Nos vemos', '■Fin']);
  const porSiNo = correr(FLUJO, elegir(parado, 'si_no'));
  // La acción se NOMBRA y no se ejecuta: es una píldora, no un mensaje.
  assert.deepEqual(ver(porSiNo.eventos), ['⚡ mover lead etapa', '💬¿Seguimos?', '■Fin']);
  assert.equal(porSiNo.eventos[0].t, 'accion');
});

test('el nombre de la acción sale del catálogo cuando se lo pasan', () => {
  const parado = correr(FLUJO, iniciar(FLUJO)).estado;
  const r = siguiente(FLUJO, elegir(parado, 'si_no'), { accion: (op) => (op === 'mover_lead_etapa' ? 'Mover de etapa' : null) });
  assert.deepEqual(r.evento, { t: 'accion', nodo: 'a1', texto: '⚡ Mover de etapa' });
});

test('el lead escribe: la salida se PAUSA y no vuelve a correr sola', () => {
  // Corre sólo el primer mensaje.
  const uno = siguiente(FLUJO, iniciar(FLUJO));
  assert.equal(uno.evento?.t, 'mensaje');
  const p = pausarPorRespuesta(uno.estado);
  assert.equal(p.pausoLaSalida, true);
  assert.equal(p.estado.salidaPausada, true);
  assert.equal(siguiente(FLUJO, p.estado).evento, null, 'con la salida pausada no sale nada más');
  // Una salida que ya terminó no se «pausa»: no había nada corriendo.
  const terminada = correr(FLUJO, elegir(correr(FLUJO, iniciar(FLUJO)).estado, 'r1')).estado;
  assert.equal(pausarPorRespuesta(terminada).pausoLaSalida, false);
});

test('«Si responde» entra por el caso que eligió el clasificador, y su «MaKo contesta» se redacta con la guía local', () => {
  const pausado = pausarPorRespuesta(siguiente(FLUJO, iniciar(FLUJO)).estado).estado;
  const e = entrarEnRespuesta(FLUJO, pausado, 'k1');
  assert.equal(e.sinRespuesta, false);
  assert.equal(e.caso?.titulo, 'Quiere el precio');
  const r = siguiente(FLUJO, e.estado);
  assert.equal(r.evento?.t, 'mensaje');
  assert.equal(r.evento?.t === 'mensaje' && r.evento.enRespuesta, true);
  const paso = r.evento?.t === 'mensaje' ? r.evento.paso : null;
  assert.deepEqual(escenarioParaRedactar(r.estado, paso!), {
    titulo: 'Quiere el precio', cuando: 'pregunta cuánto sale', comoResponder: 'Dile que el precio se ve en la llamada',
  });
  // El «Ir a» de «Si responde» RETOMA la salida en esa tarjeta, como el motor.
  const resto = correr(FLUJO, r.estado);
  assert.deepEqual(ver(resto.eventos), ['↪ Ir a otra tarjeta', '💬¿Seguimos?', '■Fin']);
});

test('lo que no encaja va a «Otra cosa» (el hand-off de antes)', () => {
  const e = entrarEnRespuesta(FLUJO, iniciar(FLUJO), null);
  assert.equal(e.caso?.titulo, 'Otra cosa');
  assert.deepEqual(ver(correr(FLUJO, e.estado).eventos), ['⚡ avisar al equipo', '■Fin de la respuesta']);
  // Un id de caso que no existe tampoco inventa una rama: va a «Otra cosa».
  assert.equal(entrarEnRespuesta(FLUJO, iniciar(FLUJO), 'no-existe').caso?.titulo, 'Otra cosa');
});

test('sin «Si responde», MaKo no contesta', () => {
  const sin = FLUJO.filter((p) => p.nodo !== 'respuesta' && !['ia1', 'salto', 'aviso'].includes(String(p.id)));
  const e = entrarEnRespuesta(sin, iniciar(sin), 'k1');
  assert.equal(e.sinRespuesta, true);
  assert.equal(siguiente(sin, e.estado).evento, null);
});

test('un salto hacia atrás con espera no da vueltas para siempre: corta en el tope', () => {
  // La raíz no puede ser el destino de un salto (`raizSalida`): el bucle cuelga de un primer mensaje.
  const bucle: PasoGrafo[] = [
    msg({ id: 'ini', cuerpo: 'hola', siguiente: 'a' }),
    msg({ id: 'a', cuerpo: 'otra vez', siguiente: 'w' }),
    { id: 'w', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 }, siguiente: 'j', canal: 'whatsapp', cuerpo: '' },
    { id: 'j', nodo: 'ir_a', destino: { nodo: 'a' }, canal: 'whatsapp', cuerpo: '' },
  ];
  const { eventos } = correr(bucle, iniciar(bucle));
  assert.equal(eventos.filter((e) => e.t === 'salto').length, TOPE_SALTOS);
  assert.deepEqual(eventos[eventos.length - 1], { t: 'fin', texto: 'Se repite: fin de la prueba' });
});

test('«Ir a» otra automatización la nombra y termina', () => {
  const f: PasoGrafo[] = [msg({ id: 'a', siguiente: 'x' }), { id: 'x', nodo: 'ir_a', destino: { secuencia_id: 7 }, canal: 'whatsapp', cuerpo: '' }];
  const r = correr(f, iniciar(f));
  assert.deepEqual(ver(r.eventos), ['💬hola', '↪ Sigue en «otra automatización»']);
  const conNombre = siguiente(f, siguiente(f, iniciar(f)).estado, { secuencia: (id) => (id === 7 ? 'Bienvenida' : null) });
  assert.equal(conNombre.evento?.t === 'salto' && conNombre.evento.texto, '↪ Sigue en «Bienvenida»');
  assert.equal(conNombre.estado.terminado, true);
});

test('una secuencia de ANTES se pasa a tarjetas para probarla (la espera del paso se ve)', () => {
  const viejos: PasoGrafo[] = [msg({ orden: 1, cuerpo: 'uno' }), msg({ orden: 2, cuerpo: 'dos', delay_horas: 24 })];
  const { pasos } = flujoParaProbar(viejos, { modo: 'automatico' });
  assert.deepEqual(ver(correr(pasos, iniciar(pasos)).eventos), ['💬uno', '⏳ Esperar 1 día', '💬dos', '■Fin']);
  // Uno que ya es un flujo NO se vuelve a convertir: con la estrategia sin limpiar sumaría un
  // segundo «Si responde».
  const ya = flujoParaProbar(FLUJO, { modo: 'asistido', escenarios: [{ titulo: 'X', cuando: 'y', comoResponder: 'z' }] }).pasos;
  assert.equal(ya.filter((p) => p.nodo === 'respuesta').length, 1);
  assert.equal(ya.length, FLUJO.length);
});

test('las variables salen con el lead de EJEMPLO del catálogo del motor', () => {
  assert.equal(textoDeEjemplo('Hola {{nombre}} de {{empresa}}', 'Mi negocio'), 'Hola Luis de Acme');
  assert.equal(textoDeEjemplo('{{nombre_completo}} · {{negocio}}', 'Mi negocio'), 'Luis Pérez · Mi negocio');
  // Lo que el motor no conoce queda CRUDO, igual que en el envío.
  assert.equal(textoDeEjemplo('Hola {{desconocida}}', null), 'Hola {{desconocida}}');
});

test('la huella cambia cuando cambia el flujo (el «Cambió · ↻» del panel)', () => {
  assert.equal(firmaFlujo(FLUJO), firmaFlujo(FLUJO.map((p) => ({ ...p }))));
  assert.notEqual(firmaFlujo(FLUJO), firmaFlujo([...FLUJO.slice(0, 1).map((p) => ({ ...p, cuerpo: 'otro' })), ...FLUJO.slice(1)]));
});

// ── La prueba REAL ─────────────────────────────────────────────────────────────

test('el primer mensaje real lleva el aviso; los siguientes no', () => {
  const m = sanearMensajePrueba({ canal: 'whatsapp', tipo: 'texto', texto: 'Hola Luis' })!;
  assert.deepEqual(planDePrueba(m, true), [{ via: 'wa-texto', texto: `${AVISO_PRUEBA}\nHola Luis` }]);
  assert.deepEqual(planDePrueba(m, false), [{ via: 'wa-texto', texto: 'Hola Luis' }]);
});

test('un audio sale como audio y su pie DESPUÉS; el aviso va antes porque un audio no lo lleva', () => {
  const m = sanearMensajePrueba({ canal: 'whatsapp', tipo: 'audio', audio_id: 5, texto: 'Te dejo el video' })!;
  assert.deepEqual(planDePrueba(m, true), [
    { via: 'wa-texto', texto: AVISO_PRUEBA }, { via: 'wa-audio', audioId: 5 }, { via: 'wa-texto', texto: 'Te dejo el video' },
  ]);
  assert.deepEqual(planDePrueba(m, false), [{ via: 'wa-audio', audioId: 5 }, { via: 'wa-texto', texto: 'Te dejo el video' }]);
});

test('un archivo lleva el aviso en el caption, y un email en el asunto', () => {
  const f = sanearMensajePrueba({ canal: 'whatsapp', tipo: 'media', media_id: 9, texto: 'El PDF' })!;
  assert.deepEqual(planDePrueba(f, true), [{ via: 'wa-media', mediaId: 9, caption: `${AVISO_PRUEBA}\nEl PDF` }]);
  const e = sanearMensajePrueba({ canal: 'email', tipo: 'texto', texto: 'Cuerpo', asunto: 'Hola' })!;
  assert.deepEqual(planDePrueba(e, true), [{ via: 'email', asunto: '[Prueba] Hola', texto: `${AVISO_PRUEBA}\n\nCuerpo` }]);
});

test('lo que llega del navegador se sanea: sin audio no hay audio, sin texto no hay texto', () => {
  assert.equal(sanearMensajePrueba({ canal: 'whatsapp', tipo: 'audio', texto: 'x' }), null);
  assert.equal(sanearMensajePrueba({ canal: 'whatsapp', tipo: 'media', media_id: 0, texto: 'x' }), null);
  assert.equal(sanearMensajePrueba({ canal: 'whatsapp', tipo: 'texto', texto: '   ' }), null);
  assert.equal(sanearMensajePrueba({ canal: 'sms', tipo: 'texto', texto: 'x' }), null);
  assert.equal(sanearMensajePrueba(null), null);
  assert.deepEqual(sanearDestinoPrueba({ telefono: '+52 1 55 1234 5678', email: ' yo@negocio.mx ' }), { telefono: '5215512345678', email: 'yo@negocio.mx' });
  assert.deepEqual(sanearDestinoPrueba({ telefono: '123', email: 'no-es-mail' }), { telefono: null, email: null });
});

// ── La prueba real NO repite y tiene TOPE (revisión adversarial del 08/10/2026, datos-4) ─────────

/**
 * Lo que hace el panel con cada mensaje que aparece: lo dibuja SIEMPRE, y lo manda de verdad sólo
 * si `debeSalirDeVerdad` dice que sí. Devuelve cuántos se dibujaron y cuántos salieron.
 */
function correrConEnvioReal(pasos: PasoGrafo[], estado: EstadoSim, enviados: Set<string>, turno: number) {
  let dibujados = 0;
  let salieron = 0;
  let e = estado;
  for (let k = 0; k < 500; k++) {
    const r = siguiente(pasos, e);
    e = r.estado;
    if (!r.evento) break;
    if (r.evento.t === 'mensaje') {
      dibujados += 1;
      if (debeSalirDeVerdad(enviados, r.evento.nodo, r.evento.enRespuesta, turno)) salieron += 1;
    }
    if (r.evento.t === 'condicion' || r.evento.t === 'fin') break;
  }
  return { dibujados, salieron, estado: e };
}

test('el bucle mensaje → esperar → «Ir a» se DIBUJA entero pero sale de verdad una vez por tarjeta', () => {
  // El caso medido por la revisión: ~21 WhatsApp idénticos en segundos por la línea no oficial.
  const bucle: PasoGrafo[] = [
    msg({ id: 'ini', cuerpo: 'hola', siguiente: 'a' }),
    msg({ id: 'a', cuerpo: 'otra vez', siguiente: 'w' }),
    { id: 'w', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 }, siguiente: 'j', canal: 'whatsapp', cuerpo: '' },
    { id: 'j', nodo: 'ir_a', destino: { nodo: 'a' }, canal: 'whatsapp', cuerpo: '' },
  ];
  const r = correrConEnvioReal(bucle, iniciar(bucle), new Set(), 0);
  assert.equal(r.dibujados, TOPE_SALTOS + 2, 'el teléfono lo sigue mostrando: eso es lo que se prueba');
  assert.equal(r.salieron, 2, 'cada tarjeta sale de verdad UNA vez: «ini» y «a»');
});

test('en «Si responde» cada turno del lead vuelve a salir; dentro del mismo turno, no', () => {
  const enviados = new Set<string>();
  const parado = siguiente(FLUJO, iniciar(FLUJO)); // sale «m1»
  assert.equal(debeSalirDeVerdad(enviados, 'm1', false, 0), true);
  // Turno 1: el lead pregunta el precio → «MaKo contesta» (ia1) → «Ir a» m3, que retoma la salida.
  const t1 = entrarEnRespuesta(FLUJO, pausarPorRespuesta(parado.estado).estado, 'k1');
  const r1 = correrConEnvioReal(FLUJO, t1.estado, enviados, 1);
  assert.deepEqual([r1.dibujados, r1.salieron], [2, 2], 'ia1 y m3 salen');
  // Turno 2: lo mismo. La respuesta del caso es un pedido NUEVO y sale; m3 (de la salida) ya salió.
  const t2 = entrarEnRespuesta(FLUJO, pausarPorRespuesta(r1.estado).estado, 'k1');
  const r2 = correrConEnvioReal(FLUJO, t2.estado, enviados, 2);
  assert.deepEqual([r2.dibujados, r2.salieron], [2, 1], 'ia1 sale de nuevo; m3 no se reenvía');
  // El mismo turno dos veces no repite.
  assert.equal(debeSalirDeVerdad(enviados, 'ia1', true, 2), false);
});

test('el tope del server: 10 mensajes por destino cada 10 minutos, y la ventana se libera', async () => {
  // Un `reclamarEspaciado` de mentira con la MISMA regla: un casillero está libre si su marca
  // salió de la ventana, y reclamarlo lo marca con «ahora».
  let ahora = Date.parse('2026-10-08T12:00:00Z');
  const marcas = new Map<number, number>();
  const reclamar = async (i: number) => {
    const t = marcas.get(i);
    if (t != null && ahora - t < VENTANA_PRUEBA_MIN * 60_000) return false;
    marcas.set(i, ahora);
    return true;
  };
  const resultados: boolean[] = [];
  for (let k = 0; k < TOPE_PRUEBA_REAL + 3; k++) { resultados.push(await reclamarCupoPrueba(reclamar)); ahora += 5_000; }
  assert.equal(TOPE_PRUEBA_REAL, 10);
  assert.equal(resultados.filter(Boolean).length, 10, 'en un tramo de la ventana salen como mucho 10');
  assert.deepEqual(resultados.slice(10), [false, false, false]);
  // Pasada la ventana desde el primero, vuelve a haber lugar.
  ahora = Date.parse('2026-10-08T12:10:00Z');
  assert.equal(await reclamarCupoPrueba(reclamar), true);
  // Un error al contar SUBE: quien llama corta (sin poder contar, no se manda).
  await assert.rejects(reclamarCupoPrueba(async () => { throw new Error('base caída'); }));
});

test('el tope se cuenta por canal y destino normalizados', () => {
  assert.equal(claveDestinoPrueba({ canal: 'whatsapp' }, { telefono: '5215512345678', email: 'x@y.mx' }), 'wa:5215512345678');
  assert.equal(claveDestinoPrueba({ canal: 'email' }, { telefono: '5215512345678', email: 'Yo@Negocio.MX' }), 'email:yo@negocio.mx');
  assert.equal(claveDestinoPrueba({ canal: 'whatsapp' }, { telefono: null, email: 'x@y.mx' }), null);
});

// ── «Probar» dibuja el archivo como le llega al lead (costuras-8) ──────────────────────────────

test('un documento se llama como el ARCHIVO y el caption sale aparte', () => {
  const b = burbujaDeArchivo({ url: 'https://x/c.pdf', mime: 'application/pdf', nombre: 'catalogo.pdf' }, 'Te dejo el catálogo');
  assert.deepEqual(b, { tipo: 'document', mediaUrl: 'https://x/c.pdf', mediaMime: 'application/pdf', nombreArchivo: 'catalogo.pdf', texto: 'Te dejo el catálogo' });
  // Y la burbuja de verdad (la de ChatHilo) lo dibuja así: el nombre es el del archivo.
  const c = contenidoDeMensaje({ id: 1, fromMe: false, ...b });
  assert.equal(c.media?.nombre, 'catalogo.pdf');
  assert.equal(c.texto, 'Te dejo el catálogo');
  // Sin caption no se inventa uno; sin la biblioteca, «Archivo».
  assert.equal(burbujaDeArchivo({ url: null, mime: 'application/pdf', nombre: 'a.pdf' }, '  ').texto, null);
  assert.equal(burbujaDeArchivo(null, 'hola').nombreArchivo, 'Archivo');
  // Una imagen no lleva nombre de archivo: el caption va debajo.
  assert.deepEqual(burbujaDeArchivo({ url: 'u', mime: 'image/png', nombre: 'foto.png' }, 'Mira'), { tipo: 'image', mediaUrl: 'u', mediaMime: 'image/png', nombreArchivo: null, texto: 'Mira' });
});

// ── El destino precargado es el de QUIEN PRUEBA (lienzo-3) ──────────────────────────────────────

test('«A mi WhatsApp» se precarga con el teléfono y el email de la persona, o vacío', () => {
  assert.deepEqual(destinoDelQueMira({ email: 'martin@hola-mako.com', perfil: { telefono: ' +54 9 11 2505 2605 ' } }), { telefono: '+54 9 11 2505 2605', email: 'martin@hola-mako.com' });
  // Sin fila propia (sesión sin usuario), vacío: se escribe a mano. Nunca el contacto del negocio.
  assert.deepEqual(destinoDelQueMira(null), { telefono: '', email: '' });
  assert.deepEqual(destinoDelQueMira({ email: 'a@b.mx', perfil: null }), { telefono: '', email: 'a@b.mx' });
  assert.deepEqual(destinoDelQueMira({ email: 'a@b.mx', perfil: ['x'] }), { telefono: '', email: 'a@b.mx' });
});

// ROTURAS (08/10/2026), una por vez, restaurando de memoria y verificando con md5 que cada
// archivo volviera idéntico. Sin romper: 16 pass / 0 fail. Pasan / fallan con cada una:
//   1. `siguiente`, caso 'condicion', sin `eligiendo` en el estado            → 12 / 4
//   2. `siguiente`, caso 'esperar' sin avanzar el cursor                        → 11 / 5
//   3. `siguiente`, caso 'accion' devolviendo un evento 'mensaje'               → 13 / 3
//   4. `pausarPorRespuesta` sin marcar `salidaPausada`                          → 15 / 1
//   5. `entrarEnRespuesta` entrando siempre por `si_no`                         → 15 / 1
//   6. `entrarEnRespuesta` sin `sinRespuesta` cuando no hay tarjeta              → 15 / 1
//   7. el «Ir a» de «Si responde» sin volver a la rama 'salida'                  → 15 / 1
//   8. sin el tope de saltos (`saltos > TOPE_SALTOS`)                            → 15 / 1
//   9. `flujoParaProbar` sin la guarda `yaEsFlujo`                               → 15 / 1
//  10. `textoDeEjemplo` con el `nombre` en vez del `nombre_completo` de ejemplo  → 15 / 1
//  11. `planDePrueba` con el aviso también en los siguientes                     → 15 / 1
//  12. `planDePrueba` con el pie del audio ANTES del audio                       → 15 / 1
//  13. `sanearMensajePrueba` aceptando un audio sin `audio_id`                   → 15 / 1
//  14. `sanearDestinoPrueba` sin limpiar los dígitos del teléfono                → 15 / 1
//  15. la condición sin la opción «Si no»                                         → 13 / 3
// 15 roturas, 15 cazadas. (Antes de eso, el test del bucle daba 0 saltos sobre un flujo cuya
// raíz era el destino del salto: `raizSalida` no la toma, y el test se corrigió, no el módulo.)
//
// ROTURAS de la revisión adversarial (08/10/2026, parte P), con el mismo arnés. Sin romper:
// 22 pass / 0 fail. Pasan / fallan con cada una:
//  16. `debeSalirDeVerdad` sin mirar lo ya mandado (el bucle de ~21 WhatsApp)   → 20 / 2
//  17. la clave de «Si responde» sin el turno del lead                          → 21 / 1
//  18. `reclamarCupoPrueba` con un lugar de más (`i <= tope`)                    → 21 / 1
//  19. `claveDestinoPrueba` sin normalizar el email                              → 21 / 1
//  20. `burbujaDeArchivo` sin `nombreArchivo` (el documento con el caption de nombre) → 21 / 1
//  21. `burbujaDeArchivo` con el caption como nombre, como antes                 → 21 / 1
//  22. `destinoDelQueMira` leyendo el teléfono de otro lado que el perfil        → 21 / 1
// 7 roturas, 7 cazadas.
