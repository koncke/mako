// =============================================================================
// El flujo con RAMAS (lib/flujo-grafo.ts) y el paso de las secuencias de antes a tarjetas
// (lib/flujo-legado.ts) — pedido de Martín del 08/10/2026, puntos 6, 7, 9 y 11
// =============================================================================
// ⚠️ PROBADOS ROMPIENDO LA PIEZA, 08/10/2026: 23 roturas, las 23 cazadas (1 a 4 fallos cada
// una). Dos NO se cazaban en la primera pasada y obligaron a sumar asserts: borrar una
// condición sin sacar un salto que le apuntaba DESDE OTRA RAMA (el salto quedaba colgando),
// y el par de apertura de #210 armado como dos condiciones sueltas (hacía lo mismo, pero el
// lienzo dibujaba dos tarjetas donde había una decisión).
// Después de juntar las partes, 4 roturas más sobre lo que encontraron ellas y la revisión
// adversarial, las 4 cazadas: «Ir a» la primera tarjeta dejaba la salida sin raíz (2 fallos), un
// flujo se reconvertía (1), la operación de mover de etapa no existía (1), la limpieza pisaba el
// logro (2).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type PasoGrafo, type HechosLead,
  idDe, esGrafo, siguienteDe, puertosDe, raizSalida, raizRespuesta, normalizar, validarGrafo,
  elegirSalida, cumpleFila, antiguedadDeEntrada, escenariosDeRespuesta, insertarNodo, borrarNodo,
  nodoPorId, claseDe, textoFila, textoEspera, padreDe, hiloDe, raicesSalida,
} from '../lib/flujo-grafo';
import { legadoAGrafo, tieneLegado, esFlujoExplicito, OP_AVISAR, OP_MOVER_ETAPA, limpiezaPara, puedePisarFlujo, audiosDeLaListaEnElFlujo } from '../lib/flujo-legado';
import { readFileSync } from 'node:fs';
import { porId } from '../lib/api-mako/registro';

// Un generador determinista: los ids de los tests no dependen del azar.
const rndDe = () => { let k = 0; return () => ((k++ * 7919) % 100_000) / 100_000 + 0.00001; };

const msg = (o: Partial<PasoGrafo> = {}): PasoGrafo => ({ canal: 'whatsapp', proveedor: 'no_oficial', delay_horas: 0, asunto: null, cuerpo: 'hola', template_wa: null, ...o });
const H = (o: Partial<HechosLead> = {}): HechosLead => ({
  etiquetas: new Set(), etapa: null, agendo: false, pago: false, yaContactado: false, respondio: false,
  creadoMs: null, tieneTelefono: true, tieneEmail: false, ahoraMs: Date.parse('2026-10-08T12:00:00Z'), ...o,
});

// Recorre la SALIDA como lo haría el motor, con unos hechos fijos. Devuelve la lista de
// lo que pasa: el cuerpo de cada mensaje, «⏳N» por espera, «→#id» por «Ir a» otra.
function recorrer(pasos: PasoGrafo[], h: HechosLead): string[] {
  const out: string[] = [];
  let cur = raizSalida(pasos);
  for (let guard = 0; cur && guard < 100; guard++) {
    const i = pasos.findIndex((p, k) => idDe(p, k) === cur);
    const p = pasos[i];
    switch (claseDe(p)) {
      case 'condicion': cur = elegirSalida(p, h).destino; continue;
      case 'esperar': out.push(`⏳${p.espera!.modo === 'antes_reunion' ? '-' : ''}${p.espera!.minutos}`); break;
      case 'ir_a': {
        const d = p.destino!;
        if ('secuencia_id' in d) { out.push(`→#${d.secuencia_id}`); cur = null; continue; }
        cur = d.nodo; continue;
      }
      case 'accion': out.push(`⚡${String((p.accion as { operacion: string }).operacion)}`); break;
      default: out.push(`${p.tipo ?? 'texto'}:${p.cuerpo}${p.revisar === false ? '' : '✋'}`);
    }
    cur = siguienteDe(pasos, i);
  }
  return out;
}

// ── El dato: una lista de antes ES un grafo ──────────────────────────────────────

test('una secuencia LINEAL de antes se recorre igual que siempre, sin convertir nada', () => {
  const pasos = [msg({ cuerpo: 'a' }), msg({ cuerpo: 'b' }), msg({ cuerpo: 'c' })];
  assert.equal(esGrafo(pasos), false);
  assert.equal(raizSalida(pasos), 'o0');
  assert.equal(siguienteDe(pasos, 0), 'o1');
  assert.equal(siguienteDe(pasos, 2), null);
  assert.deepEqual(recorrer(pasos, H()), ['texto:a✋', 'texto:b✋', 'texto:c✋']);
});

test('normalizar deja ids y `siguiente` explícitos, conserva los o<i> de antes y es idempotente', () => {
  const pasos = normalizar([msg({ cuerpo: 'a' }), msg({ cuerpo: 'b' })]);
  assert.deepEqual(pasos.map((p) => [p.id, p.siguiente]), [['o0', 'o1'], ['o1', null]]);
  assert.deepEqual(normalizar(pasos), pasos);
  // Insertar en el medio del ARRAY ya no cambia quién sigue a quién.
  const conIntruso = [pasos[0], msg({ id: 'x', cuerpo: 'intruso', siguiente: null }), pasos[1]];
  assert.equal(siguienteDe(conIntruso, 0), 'o1');
});

test('un id repetido se desempata al normalizar (si no, nodoPorId devolvería siempre el primero)', () => {
  const pasos = normalizar([msg({ id: 'a', cuerpo: '1' }), msg({ id: 'a', cuerpo: '2' })]);
  assert.notEqual(pasos[0].id, pasos[1].id);
  assert.equal(nodoPorId(pasos, pasos[1].id)?.cuerpo, '2');
});

// ── La condición: N ramas, gana la primera, y «si no» ─────────────────────────────

test('la condición elige la PRIMERA rama que se cumple, de arriba hacia abajo, y si no «si no»', () => {
  const cond: PasoGrafo = {
    nodo: 'condicion',
    ramas: [
      { id: 'r1', modo: 'todas', filas: [{ campo: 'etiqueta', valor: 7 }, { campo: 'agendo' }], siguiente: 'A' },
      { id: 'r2', modo: 'cualquiera', filas: [{ campo: 'etiqueta', valor: 7 }, { campo: 'pago' }], siguiente: 'B' },
    ],
    si_no: 'C',
  };
  assert.equal(elegirSalida(cond, H({ etiquetas: new Set([7]), agendo: true })).destino, 'A');
  assert.equal(elegirSalida(cond, H({ etiquetas: new Set([7]) })).destino, 'B');   // r1 exige las dos
  assert.equal(elegirSalida(cond, H({ pago: true })).destino, 'B');
  assert.equal(elegirSalida(cond, H()).destino, 'C');
});

test('una rama sin filas NUNCA se cumple, y un campo desconocido tampoco (ni negado)', () => {
  assert.equal(elegirSalida({ nodo: 'condicion', ramas: [{ id: 'r', modo: 'todas', filas: [], siguiente: 'A' }], si_no: 'B' }, H()).destino, 'B');
  assert.equal(cumpleFila({ campo: 'inventado' as never, no: true }, H()), false);
});

test('la antigüedad es la misma regla de antes: sin fecha de alta no es «reciente»', () => {
  const f = { campo: 'antiguedad' as const, valor: 72 };
  const ahora = Date.parse('2026-10-08T12:00:00Z');
  assert.equal(cumpleFila(f, H({ creadoMs: ahora - 71 * 3_600_000 })), true);
  assert.equal(cumpleFila(f, H({ creadoMs: ahora - 73 * 3_600_000 })), false);
  assert.equal(cumpleFila(f, H({ creadoMs: null })), false);
  assert.equal(cumpleFila({ ...f, no: true }, H({ creadoMs: ahora - 73 * 3_600_000 })), true);
});

test('la etapa de un PRODUCTO se mira en ese producto, no en la casa', () => {
  const f = { campo: 'etapa' as const, valor: 'agenda', funnel_id: 14 };
  assert.equal(cumpleFila(f, H({ etapa: 'agenda' })), false);
  assert.equal(cumpleFila(f, H({ etapasPorProducto: new Map([[14, 'agenda']]) })), true);
});

// ── Validar: lo que no se guarda ─────────────────────────────────────────────────

test('validarGrafo rechaza destinos que no existen, esperas en «Si responde» y saltos hacia atrás sin espera (y desde la sexta tanda, NO dos padres)', () => {
  // SEXTA TANDA (punto 13): dos flechas que llegan a la misma tarjeta se publican. Antes era «cuelga de
  // 2 lugares (para juntar ramas se usa «Ir a»)». La tarjeta `b` de este flujo es suelta: lo que se mira
  // es que el error de los dos padres no está.
  const dosPadres = [msg({ id: 'a', siguiente: 'c' }), msg({ id: 'b', siguiente: 'c' }), msg({ id: 'c', siguiente: null })];
  assert.ok(!validarGrafo(dosPadres).some((e) => e.includes('cuelga de')));
  assert.ok(validarGrafo([msg({ id: 'a', siguiente: 'zz' })]).some((e) => e.includes('no existe')));
  const esperaEnRespuesta: PasoGrafo[] = [
    msg({ id: 'a', siguiente: null }),
    { id: 'r', nodo: 'respuesta', casos: [{ id: 'c1', titulo: 'precio', cuando: 'pregunta el precio', siguiente: 'e' }], si_no: null },
    { id: 'e', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 }, siguiente: null },
  ];
  assert.ok(validarGrafo(esperaEnRespuesta).some((e) => e.includes('no puede tener esperas')));
  const bucle: PasoGrafo[] = [msg({ id: 'a', siguiente: 'b' }), msg({ id: 'b', siguiente: 'j' }), { id: 'j', nodo: 'ir_a', destino: { nodo: 'a' } }];
  assert.ok(validarGrafo(bucle).some((e) => e.includes('vuelve atrás')));
  const bucleConEspera: PasoGrafo[] = [msg({ id: 'a', siguiente: 'w' }), { id: 'w', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 }, siguiente: 'j' }, { id: 'j', nodo: 'ir_a', destino: { nodo: 'a' } }];
  assert.deepEqual(validarGrafo(bucleConEspera), []);
});

test('validarGrafo marca las tarjetas sueltas y una condición con una rama vacía', () => {
  const suelta: PasoGrafo[] = [msg({ id: 'a', siguiente: null }), { id: 'r', nodo: 'respuesta', casos: [], si_no: null }, msg({ id: 'b', siguiente: null })];
  // `b` no la apunta nadie y no es la primera: queda suelta.
  assert.ok(validarGrafo(suelta).some((e) => e.includes('sueltas: b')));
  const vacia: PasoGrafo[] = [{ id: 'c', nodo: 'condicion', ramas: [{ id: 'r1', modo: 'todas', filas: [], siguiente: null }], si_no: null }];
  assert.ok(validarGrafo(vacia).some((e) => e.includes('no tiene ninguna condición')));
});

// ── Editar: insertar y borrar ────────────────────────────────────────────────────

test('insertar en un puerto: lo que colgaba pasa a colgar del nuevo; una condición lo toma en su PRIMERA rama', () => {
  const base = normalizar([msg({ id: 'a', cuerpo: 'a' }), msg({ id: 'b', cuerpo: 'b' })]);
  const conEspera = insertarNodo(base, { nodo: 'a', puerto: 'sig' }, { id: 'w', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 } } as PasoGrafo);
  assert.deepEqual(recorrer(conEspera, H()), ['texto:a✋', '⏳60', 'texto:b✋']);
  const conCond = insertarNodo(base, { nodo: 'a', puerto: 'sig' }, { id: 'c', nodo: 'condicion', ramas: [{ id: 'r', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: null }], si_no: null } as PasoGrafo);
  assert.deepEqual(recorrer(conCond, H({ agendo: true })), ['texto:a✋', 'texto:b✋']);
  assert.deepEqual(recorrer(conCond, H()), ['texto:a✋']);
  assert.deepEqual(validarGrafo(conCond), []);
  const alInicio = insertarNodo(base, { inicio: true }, msg({ id: 'z', cuerpo: 'z' }));
  assert.deepEqual(recorrer(alInicio, H()), ['texto:z✋', 'texto:a✋', 'texto:b✋']);
});

test('borrar un nodo simple lo saca de la cadena; borrar una condición se lleva sus ramas (y los saltos a ellas)', () => {
  const base = normalizar([msg({ id: 'a', cuerpo: 'a' }), msg({ id: 'b', cuerpo: 'b' }), msg({ id: 'c', cuerpo: 'c' })]);
  assert.deepEqual(recorrer(borrarNodo(base, 'b'), H()), ['texto:a✋', 'texto:c✋']);
  const conCond: PasoGrafo[] = normalizar([
    msg({ id: 'a', cuerpo: 'a', siguiente: 'k' }),
    { id: 'k', nodo: 'condicion', ramas: [{ id: 'r', modo: 'todas', filas: [{ campo: 'pago' }], siguiente: 'x' }], si_no: 'y' },
    msg({ id: 'x', cuerpo: 'x', siguiente: null }),
    msg({ id: 'y', cuerpo: 'y', siguiente: 'j' }),
    { id: 'j', nodo: 'ir_a', destino: { nodo: 'x' } },
  ]);
  const sin = borrarNodo(conCond, 'k');
  assert.deepEqual(sin.map((p) => p.id), ['a']);
  assert.equal(sin[0].siguiente, null);
  assert.deepEqual(validarGrafo(sin), []);
  // Un salto desde OTRA rama (acá, «Si responde») a algo borrado se va, y su padre queda cortado.
  const conSaltoAfuera: PasoGrafo[] = normalizar([
    ...conCond.slice(0, 3),
    { id: 'r', nodo: 'respuesta', casos: [], si_no: 'j2' },
    { id: 'j2', nodo: 'ir_a', destino: { nodo: 'x' } },
  ]);
  const sin2 = borrarNodo(conSaltoAfuera, 'k');
  assert.equal(sin2.some((p) => p.id === 'j2'), false);
  assert.equal(nodoPorId(sin2, 'r')?.si_no, null);
  assert.deepEqual(validarGrafo(sin2), []);
});

// ── «Si responde» ────────────────────────────────────────────────────────────────

test('los casos de «Si responde» salen en la forma del clasificador de siempre, con la guía y el «sale solo» del mensaje', () => {
  const pasos: PasoGrafo[] = normalizar([
    msg({ id: 'a', siguiente: null }),
    { id: 'r', nodo: 'respuesta', casos: [
      { id: 'c1', titulo: 'Cambiar el día', cuando: 'pide otro horario', siguiente: 'm1' },
      { id: 'c2', titulo: 'Precio', cuando: 'pregunta cuánto cuesta', siguiente: 'm2' },
    ], si_no: null },
    msg({ id: 'm1', tipo: 'ia', cuerpo: 'ofrécele otro horario', revisar: false, siguiente: null }),
    msg({ id: 'm2', tipo: 'ia', cuerpo: 'explícale el precio', siguiente: null }),
  ]);
  assert.equal(raizRespuesta(pasos), 'r');
  assert.equal(raizSalida(pasos), 'a');
  const esc = escenariosDeRespuesta(pasos);
  assert.deepEqual(esc.map((e) => [e.titulo, e.comoResponder, e.contestaSolo ?? false]), [
    ['Cambiar el día', 'ofrécele otro horario', true],
    ['Precio', 'explícale el precio', false],
  ]);
  assert.deepEqual(puertosDe(pasos, 1).map((p) => p.puerto), ['c1', 'c2', 'si_no']);
});

// ── De antes a tarjetas: las secuencias VIVAS del ws1 (medidas el 08/10/2026) ─────────

// #198 «Bienvenida — dejó sus datos y no agendó»: [audio a 1 h], tope 72 h, sale sola,
// asistido SIN casos, «Termina si agenda» → post-agenda conocido (#212), perdida a las 24 h.
const P198 = [msg({ orden: 1, tipo: 'audio', audio_id: 1, delay_horas: 1, cuerpo: 'Te dejo el link' })];
const E198 = {
  modo: 'asistido', objetivo: 'agendar', escenarios: [], envio_automatico: true, antiguedad_max_horas: 72,
  desenlace: { logrado: 'agendo', logradoEtapa: null, logradoSecuencia: 'chat-agent-post-agenda-conocido', falloHoras: 24, falloEtapa: null, falloSecuencia: null },
};

test('#198 pasa a tarjetas y hace LO MISMO: tope 72 h, espera 1 h, si ya agendó no manda el audio y sigue con #212', () => {
  const r = legadoAGrafo(P198, E198, { idDeClave: (c) => (c === 'chat-agent-post-agenda-conocido' ? 212 : null), rnd: rndDe() });
  assert.equal(r.convertida, true);
  assert.deepEqual(validarGrafo(r.pasos), []);
  const ahora = Date.parse('2026-10-08T12:00:00Z');
  const reciente = ahora - 2 * 3_600_000;
  // Recién llegado, no agenda nunca: espera 1 h, audio (sale solo), espera 24 h, termina.
  assert.deepEqual(recorrer(r.pasos, H({ creadoMs: reciente })), ['⏳60', 'audio:Te dejo el link', '⏳1440']);
  // Ya agendó: no hay audio, sigue con la post-agenda.
  assert.deepEqual(recorrer(r.pasos, H({ creadoMs: reciente, agendo: true })), ['⏳60', '→#212']);
  // Llegó hace 5 días: no le sale nada (y el motor puede no inscribirlo).
  assert.deepEqual(recorrer(r.pasos, H({ creadoMs: ahora - 120 * 3_600_000 })), []);
  assert.equal(antiguedadDeEntrada(r.pasos), 72);
  // «Si responde» sin casos: toda respuesta va a «Otra cosa», que te avisa (el hand-off).
  const resp = nodoPorId(r.pasos, raizRespuesta(r.pasos))!;
  assert.deepEqual(resp.casos, []);
  const otra = nodoPorId(r.pasos, resp.si_no)!;
  assert.equal((otra.accion as { operacion: string }).operacion, OP_AVISAR);
  // La limpieza CONSERVA el logro («agendo»): lo leen el cierre de lo logrado y el redactor.
  assert.deepEqual(r.limpieza, limpiezaPara(E198));
  assert.equal(r.limpieza.desenlace.logrado, 'agendo');
  assert.equal(r.limpieza.desenlace.falloHoras, 0);
  assert.equal(r.limpieza.desenlace.logradoSecuencia, null);
});

// #212/#213 post-agenda: [audio a 1 h + pie, IA a 24 h «si no contestó»], 4 casos (2 salen
// solos), objetivo preparar, «Termina si contesta», perdida a las 12 h.
const P212 = [
  msg({ orden: 1, tipo: 'audio', audio_id: 5, delay_horas: 1, cuerpo: 'Te dejo el link' }),
  msg({ orden: 2, tipo: 'ia', delay_horas: 24, requiere: 'sin_respuesta', cuerpo: 'Recuérdale la reunión' }),
];
const E212 = {
  modo: 'asistido', objetivo: 'preparar', envio_automatico: true,
  escenarios: [
    { titulo: 'Vio el video', cuando: 'dice que vio el video', comoResponder: 'agradécele' },
    { titulo: 'Precio', cuando: 'pregunta el precio', comoResponder: 'no des números' },
    { titulo: 'Confirma', cuando: 'confirma la reunión', comoResponder: 'confírmale', contestaSolo: true },
    { titulo: 'Cambiar el día', cuando: 'pide otro día', comoResponder: 'ofrécele horarios', contestaSolo: true },
  ],
  desenlace: { logrado: 'respondio', logradoEtapa: null, logradoSecuencia: null, falloHoras: 12, falloEtapa: null, falloSecuencia: null },
};

test('#212 pasa a tarjetas: espera, audio, espera 24 h, IA, y a las 12 h sin respuesta te avisa «no confirmó»', () => {
  const r = legadoAGrafo(P212, E212, { rnd: rndDe() });
  assert.deepEqual(validarGrafo(r.pasos), []);
  assert.deepEqual(recorrer(r.pasos, H()), ['⏳60', 'audio:Te dejo el link', '⏳1440', 'ia:Recuérdale la reunión', '⏳720', `⚡${OP_AVISAR}`]);
  assert.ok(r.notas.some((n) => n.includes('si no contestó')));
});

test('#212: los 4 casos son ramas de «Si responde», y salen solos EXACTAMENTE los dos que salían solos', () => {
  const r = legadoAGrafo(P212, E212, { rnd: rndDe() });
  const esc = escenariosDeRespuesta(r.pasos);
  assert.deepEqual(esc.map((e) => [e.titulo, e.comoResponder, e.contestaSolo ?? false]), [
    ['Vio el video', 'agradécele', false],
    ['Precio', 'no des números', false],
    ['Confirma', 'confírmale', true],
    ['Cambiar el día', 'ofrécele horarios', true],
  ]);
  const resp = nodoPorId(r.pasos, raizRespuesta(r.pasos))!;
  assert.equal((nodoPorId(r.pasos, resp.si_no)!.accion as { operacion: string }).operacion, OP_AVISAR);
});

test('#210 (ws4): el par de apertura ya_contactado/primer_contacto es UNA condición, sale exactamente uno', () => {
  const pasos = [
    msg({ orden: 1, cuerpo: 'retomo', requiere: 'ya_contactado', delay_horas: 1 }),
    msg({ orden: 2, cuerpo: 'me presento', requiere: 'primer_contacto', delay_horas: 1 }),
    msg({ orden: 3, cuerpo: 'recordatorio', delay_horas: 24 }),
  ];
  const r = legadoAGrafo(pasos, { modo: 'automatico' }, { rnd: rndDe() });
  assert.deepEqual(validarGrafo(r.pasos), []);
  assert.equal(r.pasos.filter((p) => claseDe(p) === 'condicion').length, 1);
  assert.deepEqual(recorrer(r.pasos, H({ yaContactado: true })), ['⏳60', 'texto:retomo✋', '⏳1440', 'texto:recordatorio✋']);
  assert.deepEqual(recorrer(r.pasos, H()), ['⏳60', 'texto:me presento✋', '⏳1440', 'texto:recordatorio✋']);
  // Sin modo asistido no hay «Si responde»: una respuesta sólo pausa, como antes.
  assert.equal(raizRespuesta(r.pasos), null);
});

test('el ancla a la reunión pasa a «N antes de la reunión», y lo que esperaba respuesta va a «Si responde»', () => {
  const pasos = [
    msg({ orden: 1, cuerpo: 'falta un día', delay_horas: 24, ancla: 'reunion' }),
    msg({ orden: 2, cuerpo: 'el regalo', requiere: 'respondio', delay_horas: 2 }),
  ];
  const r = legadoAGrafo(pasos, { modo: 'automatico' }, { rnd: rndDe() });
  assert.deepEqual(validarGrafo(r.pasos), []);
  assert.deepEqual(recorrer(r.pasos, H()), ['⏳-1440', 'texto:falta un día✋']);
  const resp = nodoPorId(r.pasos, raizRespuesta(r.pasos))!;
  assert.equal(nodoPorId(r.pasos, resp.si_no)?.cuerpo, 'el regalo');
  assert.ok(r.notas.some((n) => n.includes('tenía una espera')));
});

test('una secuencia SIN nada de antes no se convierte (sólo se normaliza)', () => {
  const pasos = [msg({ cuerpo: 'a' })];
  assert.equal(tieneLegado(pasos, { modo: 'automatico' }), false);
  assert.equal(legadoAGrafo(pasos, { modo: 'automatico' }).convertida, false);
  // parseEstrategia pone 'asistido' por default: sin `modo` es asistido, y se convierte.
  assert.equal(tieneLegado(pasos, {}), true);
});

test('conservar ids: el audio de #198 sigue siendo o0 (una inscripción parada ahí no se mueve)', () => {
  const r = legadoAGrafo(P198, E198, { rnd: rndDe(), idDeClave: () => 212 });
  const audio = r.pasos.find((p) => p.tipo === 'audio')!;
  assert.equal(audio.id, 'o0');
  assert.equal(audio.delay_horas, 0);
  assert.equal(padreDe(r.pasos, 'o0') != null, true);
});

// ── Lo que dibuja la tarjeta ─────────────────────────────────────────────────────

test('los textos de la tarjeta son cortos y dicen la condición, no un rótulo', () => {
  assert.equal(textoFila({ campo: 'etiqueta', valor: 3 }, { etiqueta: () => 'Cualificado' }), 'Tiene «Cualificado»');
  assert.equal(textoFila({ campo: 'agendo', no: true }), 'No agendó');
  assert.equal(textoFila({ campo: 'antiguedad', valor: 72 }), 'Llegó hace menos de 3 días');
  assert.equal(textoEspera({ modo: 'tiempo', minutos: 1440 }), 'Esperar 1 día');
  assert.equal(textoEspera({ modo: 'tiempo', minutos: 90 }), 'Esperar 90 min');
  assert.equal(textoEspera({ modo: 'antes_reunion', minutos: 15 }), '15 min antes de la reunión');
});

// ── Lo que encontraron las partes al construir encima (08/10/2026) ──────────────────

test('«volver al principio»: un «Ir a» a la PRIMERA tarjeta no deja la salida sin raíz', () => {
  const pasos: PasoGrafo[] = [
    msg({ id: 'm1', cuerpo: 'a', siguiente: 'w' }),
    { id: 'w', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 1440 }, siguiente: 'j' },
    { id: 'j', nodo: 'ir_a', destino: { nodo: 'm1' } },
  ];
  assert.equal(raizSalida(pasos), 'm1');
  assert.deepEqual(validarGrafo(pasos), []);
});

test('una tarjeta a la que sólo se llega con un «Ir a» es una tarjeta suelta', () => {
  const pasos: PasoGrafo[] = [
    msg({ id: 'a', cuerpo: 'a', siguiente: 'j' }),
    { id: 'j', nodo: 'ir_a', destino: { nodo: 'b' } },
    msg({ id: 'b', cuerpo: 'b', siguiente: null }),
  ];
  assert.ok(validarGrafo(pasos).some((e) => e.includes('sueltas: b')));
});

test('un flujo de tarjetas NO se vuelve a convertir (aplastaría sus ramas), pero una lista con ids sí', () => {
  const conv = legadoAGrafo(P212, E212, { rnd: rndDe() });
  assert.equal(esFlujoExplicito(conv.pasos), true);
  // La API le volvió a poner una espera a un mensaje: sigue siendo un flujo.
  const tocado = conv.pasos.map((p) => (p.id === 'o0' ? { ...p, delay_horas: 2 } : p));
  assert.equal(tieneLegado(tocado, E212), false);
  const again = legadoAGrafo(tocado, E212, { rnd: rndDe() });
  assert.equal(again.convertida, false);
  assert.equal(again.pasos.filter((p) => claseDe(p) === 'respuesta').length, 1);
  // Una lista de antes que ya pasó por normalizar (ids o<i>, `siguiente` lineal) se convierte.
  const lista = normalizar(P212);
  assert.equal(esFlujoExplicito(lista), false);
  assert.equal(legadoAGrafo(lista, E212, { rnd: rndDe() }).convertida, true);
});

test('las acciones que genera el conversor EXISTEN en el registro de la API (si no, la secuencia no se puede publicar)', () => {
  // «Termina si agenda → mover a etapa X» se convierte en una acción: con un nombre que no existe
  // (era 'mover_lead_etapa'), Publicar rechazaba la secuencia entera.
  for (const op of [OP_AVISAR, OP_MOVER_ETAPA]) {
    const def = porId(op);
    assert.ok(def, `no existe la operación ${op}`);
    assert.equal(def!.tipo, 'accion');
  }
  const conEtapa = legadoAGrafo(P198, { ...E198, desenlace: { ...E198.desenlace, logradoEtapa: 'agenda' } }, { rnd: rndDe(), idDeClave: () => 212 });
  const ops = conEtapa.pasos.filter((p) => claseDe(p) === 'accion').map((p) => (p.accion as { operacion: string }).operacion);
  assert.ok(ops.includes(OP_MOVER_ETAPA));
  for (const op of ops) assert.ok(porId(op), `el conversor generó ${op}, que no existe`);
});

test('la limpieza conserva lo que la secuencia daba por logrado (cierra al que contestó y lo lee el redactor)', () => {
  assert.equal(limpiezaPara(E212).desenlace.logrado, 'respondio');
  assert.equal(limpiezaPara(E212).desenlace.falloHoras, 0);
  assert.equal(limpiezaPara(null).desenlace.logrado, 'ninguno');
  assert.equal(limpiezaPara({ desenlace: { logrado: 'inventado' } }).desenlace.logrado, 'ninguno');
});

// ── Lo que encontró la cosecha: escritores que no saben de ramas (08/10/2026) ────────
// El armado de las secuencias de audios del onboarding (lib/secuencias-audios.ts) corre en cada
// carga de su paso y reescribía `pasos` directo: sobre #198/#212/#213 ya convertidas, las
// devolvía a una lista y se perdían «Si responde» y sus casos, sin error.

test('una lista sin ids NO puede pisar un flujo de tarjetas; el lienzo (con ids) sí', () => {
  const flujo = legadoAGrafo(P212, E212, { rnd: rndDe() }).pasos;
  assert.equal(puedePisarFlujo(flujo, P212), false);          // la lista de dos pasos del onboarding
  assert.equal(puedePisarFlujo(flujo, flujo), true);           // el lienzo, con sus ids
  assert.equal(puedePisarFlujo(P212, P212), true);             // una lista sobre una lista, como siempre
});

test('re-grabar el audio sobre un flujo cambia SÓLO el audio de su tarjeta y conserva lo demás', () => {
  const flujo = legadoAGrafo(P212, E212, { rnd: rndDe() }).pasos;
  const regrabada = [msg({ orden: 1, tipo: 'audio', audio_id: 99, delay_horas: 1, cuerpo: 'otro pie' }), P212[1]];
  const r = audiosDeLaListaEnElFlujo(flujo, regrabada);
  assert.equal(nodoPorId(r, 'o0')?.audio_id, 99);
  assert.equal(nodoPorId(r, 'o0')?.cuerpo, 'Te dejo el link');   // el pie que el dueño editó no se pisa
  assert.equal(r.length, flujo.length);
  assert.ok(raizRespuesta(r));
  assert.deepEqual(validarGrafo(r), []);
  // Y el lugar que escribe lo usa, en vez de escribir la lista entera.
  const src = readFileSync(new URL('../lib/secuencias-audios.ts', import.meta.url), 'utf8');
  assert.match(src, /const pasos = esFlujoExplicito\(actuales\) \? audiosDeLaListaEnElFlujo\(actuales, plan\.pasos\) : plan\.pasos;/);
  const motor = readFileSync(new URL('../lib/nutricion.ts', import.meta.url), 'utf8');
  assert.match(motor, /if \(puedePisarFlujo\(antes, pasos\) === false\) \{/);
});

// ── SEGUNDA TANDA: los flujos vigentes no cambian (08/10/2026, noche) ─────────────────
// La regla de «Si responde» sin padre, el inicio y las flechas en paralelo no pueden mover a
// nadie: #198, #212/#213 y #210 siguen sin errores y con la MISMA raíz. «La regla de hoy» se
// escribe acá a mano (el primer nodo que ningún `siguiente`/rama/caso/«si no» apunta y que no es
// «Si responde»), sin pasar por `puertosDe`, que es justo lo que la tanda cambió.
// ⚠️ PROBADO ROMPIENDO (08/10/2026): «hiloDe sin "Si responde"», «normalizar deja `paralelos: []`
// en todo paso» y «la regla de "Si responde" con padre cuenta sus casos» caen acá (la última, en
// 9 tests de 54). «raizSalida devuelve el inicio» NO cae acá —ninguno de los seis tiene inicio— y la
// caza tests/flujo-grafo-paralelos.test.ts.
function raizDeHoy(pasos: readonly PasoGrafo[]): string | null {
  const ap = new Set<string>();
  pasos.forEach((p, i) => {
    const c = claseDe(p);
    if (c === 'condicion') { for (const r of p.ramas ?? []) if (r.siguiente) ap.add(r.siguiente); if (p.si_no) ap.add(p.si_no); }
    else if (c === 'respuesta') { for (const x of p.casos ?? []) if (x.siguiente) ap.add(x.siguiente); if (p.si_no) ap.add(p.si_no); }
    else if (c !== 'ir_a') { const s = siguienteDe(pasos, i); if (s) ap.add(s); }
  });
  for (let i = 0; i < pasos.length; i++) if (claseDe(pasos[i]) !== 'respuesta' && !ap.has(idDe(pasos[i], i))) return idDe(pasos[i], i);
  return null;
}

test('segunda tanda: #198, #212/#213 y #210 siguen sin errores, con la misma raíz y en UN solo camino', () => {
  const P210 = [
    msg({ orden: 1, cuerpo: 'retomo', requiere: 'ya_contactado', delay_horas: 1 }),
    msg({ orden: 2, cuerpo: 'me presento', requiere: 'primer_contacto', delay_horas: 1 }),
    msg({ orden: 3, cuerpo: 'recordatorio', delay_horas: 24 }),
  ];
  const vigentes = [
    legadoAGrafo(P198, E198, { idDeClave: () => 212, rnd: rndDe() }).pasos,
    legadoAGrafo(P212, E212, { rnd: rndDe() }).pasos,
    legadoAGrafo(P210, { modo: 'automatico' }, { rnd: rndDe() }).pasos,
  ];
  for (const pasos of vigentes) {
    assert.deepEqual(validarGrafo(pasos), []);
    assert.ok(raizDeHoy(pasos));
    assert.equal(raizSalida(pasos), raizDeHoy(pasos));
    assert.deepEqual(raicesSalida(pasos), [raizDeHoy(pasos)]);
    // Ni un `paralelos` ni un inicio: guardarlos de nuevo deja el MISMO dato.
    assert.equal(pasos.some((p) => 'paralelos' in p || p.nodo === 'inicio'), false);
    assert.deepEqual(normalizar(pasos), pasos);
    // Un solo camino de salida («p») y lo de «Si responde» («r»), nada más.
    assert.deepEqual([...new Set(hiloDe(pasos).values())].sort(), raizRespuesta(pasos) ? ['p', 'r'] : ['p']);
  }
  // Y el «Solo a leads recientes» de #198 se sigue mirando al inscribir.
  assert.equal(antiguedadDeEntrada(vigentes[0]), 72);
});
