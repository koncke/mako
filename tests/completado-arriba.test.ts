// =============================================================================
// El último «Completado» de un chat va en un BLOQUE arriba de la caja, como las preguntas (25/10/2026)
// =============================================================================
// Martín (25/10, 09:32): «Hay muchos chats que dicen "completado", pero no veo el mensaje... Tal vez sería bueno hacerlo como
// las preguntas, en bloque arriba del chat, sino se pierde en el scroll». Esto fija:
//   1. cuál va: el último «Ya está» SIN su ✓ (el que hace que la fila diga «Completado»); con el ✓, ninguno;
//   2. cómo se ve: el marco del bloque de preguntas, «Completado», el mensaje entero con su «Revisar», «Visto» y la flecha
//      para plegar; con una pregunta esperando, la pregunta manda y esto queda en su tira; con el ✓, no se dibuja;
//   3. dónde: arriba de la caja en la computadora y en el teléfono, ANTES del bloque de preguntas (la tira, arriba de ella);
//   4. un «Ya está» largo se lee adentro del bloque, que tiene un tope de alto.
// La segunda vuelta (25/10, ~12:00), Martín: «El "completado" me dice "Cortado a los 4000 caracteres..." que no haya nunca un
// limite de caracteres, en todo caso achica el mensaje y hazlo más claro... si no pones antes cual fue mi prompt no se
// entiende... Podrias ponerlo con mi foto de perfil allí». Esto fija también:
//   5. arriba de la respuesta, lo que pidió Martín (su último turno o trabajo antes del «Ya está»), con su foto;
//   6. nunca «Cortado a los N caracteres»: lo cortado termina en «…», y lo largo se pliega a su resumen con «Ver todo».
// Lo que se vio en producción ese día (25/10, ~15:10), mirando el bloque recién desplegado:
//   7. el CRM decía «Completado» y al abrirlo no había bloque: su «Ya está» era del 23/10, de una sesión vieja, y las 6 sesiones
//      juntas pasaban los 60 turnos (`turnosDeLaConversacion` lo trae igual, con lo que respondía);
//   8. el de Offer no tenía pedido: respondía a Integración, no a Martín. Ahora va lo de Martín en el tramo; si no, lo del
//      chat que se lo mandó, con su nombre y nunca con la foto de Martín; si no, lo último de Martín.
// La cuarta vuelta (25/10, ~15:20), Martín al verlo en producción: «Rediseña bien la tarjeta de "completado"... Mira la cantidad
// de botones juntos... Y si tengo varios "completados" pendientes, para eso ya tenemos la opción de "espera tu respuesta" tipo
// modular con varias preguntas con las flechitas». Esto fija también:
//   9. UNA acción («Ya lo vi») y las secundarias («Revisar» y, desde el 26/10, «Responder sobre esto»: Martín la pidió de vuelta,
//      y cita el «Completado» arriba de la caja, tests/completado-responder-y-contexto.test.ts); sin «Ver todo» ni la tarea del
//      Plan: el texto se abre tocándolo;
//  10. varios sin ver, de a uno, con las flechas y los puntos de las preguntas, del más viejo al más nuevo; con una pregunta,
//      su tira dice cuántos;
//  11. sin pedido, no queda el hueco.
//
// PROBADO ROMPIÉNDOLO (25/10/2026, base 4/0): `completadoSinVer` sin mirar el ✓ → 2 rojos (1 y 2); sin la tira con una
// pregunta → 1 rojo (2); el teléfono sin el bloque → 1 rojo (3); el bloque sin tope de alto → 1 rojo (4). La segunda vuelta
// (base 6/0): `pedidoDelCompletado` con un turno que trajo un trabajo → 1 rojo (5); el aviso «Cortado» de vuelta → 1 rojo (6);
// sin plegar lo largo que no tiene cola → 1 rojo (6).
// La tercera vuelta (base 8/0): `leerTurnos` con `unirTurnos` a secas → 1 rojo (7); `turnosDeLaConversacion` sin el «Ya está» de
// antes → 1 rojo (7); sin el mensaje de otro chat → 2 rojos (7, 8); lo de otro chat con la foto de Martín → 1 rojo (8); lo de
// Martín de ANTES del tramo ganándole al del Cerebro → 2 rojos (7, 8); el título sin su mayúscula → 1 rojo (8).
// La cuarta vuelta (base 11/0): de vuelta «Responder sobre esto» → 1 rojo (9; desde el 26/10 lo pidió Martín y el 9 lo pide); de vuelta un «Ver todo» en la respuesta → 1 rojo
// (6); sólo el último sin ver en vez de todos → 1 rojo (10); el más nuevo primero → 1 rojo (10); el hueco del pedido sin pedido
// → 1 rojo (11).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TOPE_TURNO, TURNOS_POR_CHAT, turnosDeLaConversacion, type TurnoChat } from '../lib/operaciones-reglas';
import { MAX_COMPLETADOS_EN_BLOQUE, completadoSinVer, completadosSinVer, esYaEsta, pedidoDelCompletado, yaEstaSinVer, type LineaChat } from '../lib/centro-chats';
import { YaEstaMensaje } from '../app/admin/operaciones/Avance';
import { BloqueCompletado } from '../app/admin/operaciones/BloqueCompletado';

const LOCAL = 'local_00000001-0000-4000-8000-000000000000';
const turno = (uuid: string, at: string, texto: string, rol: 'el' | 'yo' = 'el'): LineaChat =>
  ({ tipo: 'turno', instante: Date.parse(at), turno: { local: LOCAL, uuid, rol, de: null, texto, at, trabajo: null } });
const lineas: LineaChat[] = [
  turno('u1', '2026-10-25T10:00:00.000Z', 'Ya está: el viejo'),
  turno('p1', '2026-10-25T10:30:00.000Z', 'no, no era todo. Ordená la lista', 'yo'),
  turno('u2', '2026-10-25T11:00:00.000Z', 'Ya está: **la lista ordena** lo que espera arriba\n\nRevisa en /admin/operaciones.\n\nDecidido: espera > trabaja.'),
  turno('u3', '2026-10-25T11:30:00.000Z', 'Sigo con lo de las preguntas.'),
  turno('u4', '2026-10-25T11:40:00.000Z', 'Ya está: lo dice Martín', 'yo'),
];
const T1 = Date.parse('2026-10-25T10:00:00.000Z');
const T2 = Date.parse('2026-10-25T11:00:00.000Z');
const CHAT = { clave: 'nombre:ops center', sesion: LOCAL, titulo: 'Ops Center' };

test('1. va el último «Ya está» del chat sin su ✓, aunque después haya escrito otra cosa; con el ✓, ninguno', () => {
  assert.equal(completadoSinVer(lineas, null)?.uuid, 'u2');
  assert.equal(completadoSinVer(lineas, T2 - 1)?.uuid, 'u2');
  assert.equal(completadoSinVer(lineas, T2), null, 'con su ✓ no va');
  assert.equal(yaEstaSinVer(lineas, null), 'u2', 'el mismo que busca el hilo al abrir');
  assert.equal(completadoSinVer([turno('x', '2026-10-25T11:00:00.000Z', 'Sigo trabajando')], null), null);
});

test('2. el bloque: el marco de las preguntas, el mensaje, «Ya lo vi» y plegar; con una pregunta, su tira; con el ✓, nada', () => {
  const dibujar = (p: Partial<Parameters<typeof BloqueCompletado>[0]> = {}) => renderToStaticMarkup(createElement(BloqueCompletado, {
    chat: CHAT, lineas, yaVisto: T1, onYaVisto: () => {}, hayPreguntas: false, ...p,
  }));
  const abierto = dibujar();
  // Desde el 10/11/2026 el rótulo dice QUÉ se completó (lib/centro-rotulo-completado.ts; acá, sin el índice de tabs, el nombre del
  // chat): Martín, «que yo rápidamente pueda identificar qué se completó». El lector de pantalla sigue oyendo «Completado».
  assert.match(abierto, /class="co-preg co-preg--arriba co-preg--completado" role="group" aria-label="Completado · Ops Center: [^"]*la lista ordena/);
  assert.match(abierto, /class="co-ya__rotulo">Ops Center</);
  assert.match(abierto, /aria-label="Ya lo vi: marcarlo como visto"[^>]*>.*Ya lo vi<\/button>/, 'darlo por visto');
  assert.match(abierto, /aria-label="Ocultar el completado"/, 'plegarlo');
  assert.match(abierto, /Decidido: espera &gt; trabaja\./, 'el mensaje entero, no sólo el título');
  assert.equal((abierto.match(/class="co-ya__cab"/g) ?? []).length, 0, 'sin la cabecera de la tarjeta del hilo: no dice «Completado» dos veces');
  const tira = dibujar({ hayPreguntas: true });
  assert.match(tira, /^<button type="button" class="co-preg co-preg--arriba co-preg--plegada co-preg--completado" aria-expanded="false"/, 'con una pregunta, en su tira');
  assert.match(tira, /Ops Center: [^<]*la lista ordena/);
  assert.doesNotMatch(tira, /\*\*/, 'la tira es un renglón sin formato: sin los asteriscos del Markdown');
  assert.doesNotMatch(tira, /Decidido/, 'plegado no muestra el cuerpo');
  assert.equal(dibujar({ yaVisto: T2 }), '', 'con el ✓, no hay bloque');
  assert.doesNotMatch(dibujar({ onYaVisto: undefined }), /Ya lo vi/, 'sin cómo marcarlo, no se ofrece');
});

const leer = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

test('3. arriba de la caja en la computadora y en el teléfono, antes del bloque de preguntas', () => {
  for (const [f, chat, visto] of [
    ['app/admin/operaciones/Conversacion.tsx', 'chat', 'yaVisto={yaVisto}'],
    ['app/m/operaciones/ChatsMovil.tsx', 'elegido', 'yaVisto={centro.yaVistos?.[elegido.clave] ?? null}'],
  ] as const) {
    const src = leer(f);
    const i = src.indexOf(`<BloqueCompletado key={\`ya-\${${chat}.clave}\`} chat={${chat}} lineas={lineas} ${visto}`);
    const j = src.indexOf(`<BloqueDePreguntas key={\`b-\${${chat}.clave}\`}`);
    assert.ok(i > 0, `${f}: falta el bloque del «Completado»`);
    assert.ok(i < j, `${f}: el «Completado» va antes (arriba) del bloque de preguntas`);
    assert.ok(src.includes('hayPreguntas={bloque.length + deLaApp.length + preguntas.length > 0}'), `${f}: la pregunta manda`);
  }
});

test('4. un «Ya está» largo se lee adentro del bloque: tiene un tope de alto', () => {
  assert.match(leer('app/admin/operaciones/centro.css'), /\.co-preg__ya-cuerpo \{ max-height: min\(40dvh, 340px\); overflow-y: auto; \}/);
});

test('5. arriba de la respuesta, lo que pidió Martín, como un mensaje suyo con su foto', () => {
  const u2 = { at: '2026-10-25T11:00:00.000Z' };
  assert.deepEqual(pedidoDelCompletado(lineas, u2), { texto: 'no, no era todo. Ordená la lista', de: null }, 'su último turno antes del «Ya está»');
  // Un turno que trajo un trabajo firmado no cuenta (ese trabajo ya está, con su texto); el trabajo sí.
  const conTrabajo: LineaChat[] = [...lineas,
    { tipo: 'turno', instante: Date.parse('2026-10-25T10:50:00.000Z'), turno: { local: LOCAL, uuid: 'p2', rol: 'yo', de: null, texto: '[firmado] Ordena', at: '2026-10-25T10:50:00.000Z', trabajo: 't1' } },
    { tipo: 'trabajo', instante: Date.parse('2026-10-25T10:49:00.000Z'), trabajo: { id: 't1', destino: LOCAL, destino_titulo: 'Ops Center', destino_cuenta: null, created_at: '2026-10-25T10:49:00.000Z', texto: 'Ordena la lista por lo que espera' } },
  ];
  assert.deepEqual(pedidoDelCompletado(conTrabajo, u2), { texto: 'Ordena la lista por lo que espera', de: null });
  assert.equal(pedidoDelCompletado([lineas[0]], { at: '2026-10-25T10:00:00.000Z' }), null, 'sin nada antes, nada');
  const html = renderToStaticMarkup(createElement(BloqueCompletado, { chat: CHAT, lineas, yaVisto: T1, onYaVisto: () => {}, hayPreguntas: false }));
  const i = html.indexOf('class="co-preg__ya-pedido"');
  assert.ok(i > 0 && i < html.indexOf('Respuesta de Ops Center'), 'su pedido arriba, la respuesta abajo');
  assert.match(html, /<div class="co-yo"><div class="co-burbuja"><div class="co-preg__ya-pedido-texto">no, no era todo\. Ordená la lista<\/div><\/div>/, 'como su globo');
  assert.match(leer('app/admin/operaciones/BloqueCompletado.tsx'), /<MiFoto \/>/, 'con su foto');
  assert.doesNotMatch(html, /co-preg__ya-pedido-texto--corto|co-preg__ya-abrir/, 'uno corto va entero');
  // Uno largo se achica a 3 renglones y se abre TOCÁNDOLO, ahí mismo: nada se corta y no hay «Ver todo».
  const largo = [...lineas, turno('p3', '2026-10-25T10:40:00.000Z', `${'Lo que pegué del chat de ventas. '.repeat(12)}`, 'yo')];
  const conLargo = renderToStaticMarkup(createElement(BloqueCompletado, { chat: CHAT, lineas: largo, yaVisto: T1, onYaVisto: () => {}, hayPreguntas: false }));
  assert.match(conLargo, /class="co-preg__ya-pedido-texto co-preg__ya-pedido-texto--corto co-preg__ya-abrir" role="button" tabindex="0" aria-expanded="false"/);
  assert.doesNotMatch(conLargo, /Ver todo/);
});

test('6. nunca «Cortado a los N caracteres»: lo cortado termina en «…», y lo largo se pliega a su resumen', () => {
  const dibujar = (texto: string) => renderToStaticMarkup(createElement(YaEstaMensaje, {
    t: { local: LOCAL, uuid: 'L', rol: 'el', de: null, texto, at: '2026-10-25T11:00:00.000Z', trabajo: null },
  }));
  const enElBloque = (texto: string) => renderToStaticMarkup(createElement(BloqueCompletado, {
    chat: CHAT, lineas: [turno('L', '2026-10-25T11:00:00.000Z', texto)], yaVisto: null, onYaVisto: () => {}, hayPreguntas: false,
  }));
  const cortado = dibujar(`Ya está: algo grande\n\n${'palabra '.repeat(TOPE_TURNO / 8)}`.slice(0, TOPE_TURNO));
  assert.doesNotMatch(cortado, /Cortado|caracteres|El resto está/, 'ningún aviso de corte');
  assert.match(cortado, /…/, 'lo cortado termina en «…»');
  assert.match(cortado, /co-ya__detalle--plegado/, 'plegado aunque no tenga una cola que dejar a la vista');
  assert.match(cortado, />Ver todo</);
  const medio = `Ya está: algo mediano\n\n${'frase corta. '.repeat(60)}`;
  assert.doesNotMatch(dibujar(medio), /Ver todo/, 'en el hilo, 700 caracteres van enteros');
  const arriba = enElBloque(medio);
  assert.match(arriba, /class="co-ya__md co-el__md co-ya__detalle co-ya__detalle--plegado co-preg__ya-abrir" role="button"/, 'arriba de la caja, más corto: se pliega, y se abre tocándolo');
  assert.doesNotMatch(arriba, /Ver todo/, 'sin «Ver todo»');
  // Lo que sigue y cómo probarlo queda a la vista, aunque el resto se pliegue.
  const conCola = enElBloque(`Ya está: algo mediano\n\n${'frase corta. '.repeat(40)}\n\nPruébalo en /crm`);
  assert.match(conCola, /co-ya__detalle--plegado[\s\S]*class="co-ya__md co-el__md co-ya__cola"[\s\S]*Pruébalo en \/crm/);
  assert.match(enElBloque(`Ya está: algo grande\n\n${'palabra '.repeat(TOPE_TURNO / 8)}`.slice(0, TOPE_TURNO)), /…/, 'lo cortado termina en «…» también arriba');
  assert.doesNotMatch(leer('app/admin/operaciones/Avance.tsx'), /co-ya__corte|TOPE_TURNO\} caracteres/, 'el aviso no vuelve');
});

const T = (local: string, uuid: string, at: string, texto: string, rol: TurnoChat['rol'] = 'el', de: string | null = null): TurnoChat =>
  ({ local, uuid, rol, de, texto, at, trabajo: null });
const enLineas = (ts: readonly TurnoChat[]): LineaChat[] => ts.map((t) => ({ tipo: 'turno', instante: Date.parse(t.at), turno: t }));

test('7. el chat abierto trae su último «Ya está» y lo que respondía, aunque sus sesiones juntas pasen los 60 turnos', () => {
  // El CRM del 25/10: el «Ya está» del 23/10 en una sesión vieja; después, más de 60 turnos en las sesiones nuevas.
  const VIEJA = 'local_00000002-0000-4000-8000-000000000000';
  const vieja = [
    T(VIEJA, 'v0', '2026-10-22T10:00:00.000Z', 'Ordená los leads', 'yo'),
    T(VIEJA, 'v1', '2026-10-22T11:00:00.000Z', 'Ya está: los leads, ordenados'),
    T(VIEJA, 'v2', '2026-10-23T00:40:00.000Z', 'Arreglá «Tus reuniones»', 'otro', 'Cerebro'),
    T(VIEJA, 'v3', '2026-10-23T00:50:00.000Z', 'Voy con «Tus reuniones».'),
    T(VIEJA, 'v4', '2026-10-23T01:25:00.000Z', 'Ya está en producción el arreglo de «Tus reuniones»'),
  ];
  const nuevas = Array.from({ length: TURNOS_POR_CHAT + 5 }, (_, i) =>
    T(LOCAL, `n${i}`, new Date(Date.parse('2026-10-24T00:00:00.000Z') + i * 60_000).toISOString(), `Avance ${i}.`));
  const conv = turnosDeLaConversacion([...vieja, ...nuevas], esYaEsta);
  const lineasConv = enLineas(conv);
  assert.equal(completadoSinVer(lineasConv, null)?.uuid, 'v4', 'el «Completado» que dice la lista está al abrirlo');
  assert.deepEqual(pedidoDelCompletado(lineasConv, { at: '2026-10-23T01:25:00.000Z' }), { texto: 'Arreglá «Tus reuniones»', de: 'Cerebro' },
    'con lo que respondía, igual que con todos los turnos');
  assert.deepEqual(pedidoDelCompletado(lineasConv, { at: '2026-10-23T01:25:00.000Z' }), pedidoDelCompletado(enLineas([...vieja, ...nuevas]), { at: '2026-10-23T01:25:00.000Z' }));
  assert.deepEqual(conv.slice(-TURNOS_POR_CHAT).map((t) => t.uuid), nuevas.slice(-TURNOS_POR_CHAT).map((t) => t.uuid), 'los últimos 60, como siempre');
  assert.ok(!conv.some((t) => t.uuid === 'v3'), 'del tramo, sólo lo que hace falta (no la conversación entera)');
  assert.deepEqual(conv.slice(0, -TURNOS_POR_CHAT).map((t) => t.uuid), ['v0', 'v1', 'v2', 'v4'], 'el de antes, el pedido de Martín de antes, el del Cerebro y el «Ya está»');
  // Con el «Ya está» y su pedido entre los 60, nada de más.
  assert.equal(turnosDeLaConversacion([...nuevas.slice(-10), T(LOCAL, 'p', '2026-10-25T09:00:00.000Z', 'Hacé algo', 'yo'), T(LOCAL, 'y', '2026-10-25T10:00:00.000Z', 'Ya está: algo')], esYaEsta).length, 12);
  // Y la base lo usa (no `unirTurnos` a secas): la conversación, la API y el teléfono leen por ahí.
  assert.match(leer('lib/centro-turnos-db.ts'), /return turnosDeLaConversacion\(listas\.flat\(\), esYaEsta\);/);
});

test('8. lo que respondía: lo de Martín en el tramo; si no, lo del chat que se lo mandó, con su nombre; si no, lo de Martín de antes', () => {
  const ya = { at: '2026-10-25T12:00:00.000Z' };
  const base = [
    T(LOCAL, 'a', '2026-10-25T09:00:00.000Z', 'Ordená la lista', 'yo'),
    T(LOCAL, 'b', '2026-10-25T10:00:00.000Z', 'Ya está: la lista'),
  ];
  const cerebro = T(LOCAL, 'c', '2026-10-25T11:00:00.000Z', 'Integración: ya está en producción', 'otro', 'Cerebro   Integración');
  // El de Offer: después de su «Ya está» de antes, sólo le habló Integración.
  assert.deepEqual(pedidoDelCompletado(enLineas([...base, cerebro, T(LOCAL, 'd', ya.at, 'Ya está: verificado')]), ya),
    { texto: 'Integración: ya está en producción', de: 'Cerebro › Integración' }, 'lo del otro chat, con su nombre legible');
  // Martín en el tramo le gana al Cerebro, aunque el Cerebro haya escrito después.
  const conMartin = [...base, T(LOCAL, 'm', '2026-10-25T10:30:00.000Z', 'Y que espere arriba', 'yo'), cerebro];
  assert.deepEqual(pedidoDelCompletado(enLineas(conMartin), ya), { texto: 'Y que espere arriba', de: null });
  // Nadie le dijo nada desde el «Ya está» de antes: lo de Martín de antes.
  assert.deepEqual(pedidoDelCompletado(enLineas(base), ya), { texto: 'Ordená la lista', de: null });
  // El bloque: lo del otro chat con su nombre y el ícono de chats, nunca con la foto de Martín.
  const html = renderToStaticMarkup(createElement(BloqueCompletado, {
    chat: CHAT, lineas: enLineas([...base, cerebro, T(LOCAL, 'd', ya.at, 'Ya está: verificado')]), yaVisto: Date.parse('2026-10-25T10:00:00.000Z'), onYaVisto: () => {}, hayPreguntas: false,
  }));
  assert.match(html, /<div class="co-burbuja"><span class="co-burbuja__cita">Cerebro › Integración<\/span><div class="co-preg__ya-pedido-texto">Integración: ya está en producción<\/div><\/div><span class="co-mifoto co-mifoto--otro" aria-hidden="true">/);
  assert.doesNotMatch(html, /co-mifoto(?!--otro| co-mifoto--otro)/, 'sin la foto de Martín');
  // Y el título, con mayúscula: «Ya está: verificado» se lee «Verificado».
  assert.match(html, /class="co-ya__titulo">Verificado</);
});

const leerBloque = () => leer('app/admin/operaciones/BloqueCompletado.tsx');

test('9. UNA acción y las secundarias: «Ya lo vi», «Revisar» y «Responder sobre esto»; sin «Ver todo» ni la tarea del Plan', () => {
  const html = renderToStaticMarkup(createElement(BloqueCompletado, { chat: CHAT, lineas, yaVisto: T1, onYaVisto: () => {}, hayPreguntas: false, onResponderSobre: () => {} }));
  assert.equal((html.match(/co-chip--primario/g) ?? []).length, 1, 'una sola acción principal');
  assert.match(html, /<div class="co-preg__ya-pie"><button type="button" class="co-chip co-preg__ya-responder">.*Responder sobre esto<\/button><span class="co-preg__ya-acciones"><a [^>]*class="co-chip co-preg__ya-revisar"[^>]*>.*Revisar<\/a><button type="button" class="co-chip co-chip--primario co-preg__ya-visto"/,
    'abajo: «Responder sobre esto» y «Revisar» (las secundarias) y «Ya lo vi» (la principal)');
  assert.doesNotMatch(html, /Ver todo|co-ya__plan|co-ya__check/, 'nada más: la tarea del Plan queda en la tarjeta del hilo');
  // Sin página que revisar, sólo «Ya lo vi».
  const sinRuta = renderToStaticMarkup(createElement(BloqueCompletado, {
    chat: { clave: 'nombre:zzz', sesion: null, titulo: 'Zzz' }, lineas: [turno('s', '2026-10-25T11:00:00.000Z', 'Ya está: algo')], yaVisto: null, onYaVisto: () => {}, hayPreguntas: false,
  }));
  assert.doesNotMatch(sinRuta, /Revisar/);
  assert.match(sinRuta, /Ya lo vi<\/button>/);
  // Y los que lo montan no le pasan la tarea; «Responder sobre esto», sí (26/10/2026).
  for (const f of ['app/admin/operaciones/Conversacion.tsx', 'app/m/operaciones/ChatsMovil.tsx']) {
    assert.doesNotMatch(leer(f), /<BloqueCompletado [^/]*(tareas=|onFeedback=)/, `${f}: el bloque no lleva la tarea`);
    assert.match(leer(f), /<BloqueCompletado [^/]*onResponderSobre=/, `${f}: el bloque sin «Responder sobre esto»`);
  }
});

test('10. varios sin ver, de a uno, con las flechas y los puntos de las preguntas, del más viejo al más nuevo', () => {
  const tres: LineaChat[] = [
    turno('a', '2026-10-25T08:00:00.000Z', 'Ya está: el primero'),
    turno('b', '2026-10-25T09:00:00.000Z', 'Ya está: el segundo'),
    turno('c', '2026-10-25T10:00:00.000Z', 'Ya está: el tercero'),
  ];
  assert.deepEqual(completadosSinVer(tres, null).map((t) => t.uuid), ['a', 'b', 'c'], 'del más viejo al más nuevo');
  assert.deepEqual(completadosSinVer(tres, Date.parse('2026-10-25T09:00:00.000Z')).map((t) => t.uuid), ['c'], 'el ✓ es «hasta éste»');
  const muchos = Array.from({ length: MAX_COMPLETADOS_EN_BLOQUE + 3 }, (_, i) => turno(`m${i}`, new Date(Date.parse('2026-10-25T00:00:00.000Z') + i * 60_000).toISOString(), `Ya está: ${i}`));
  assert.equal(completadosSinVer(muchos, null).length, MAX_COMPLETADOS_EN_BLOQUE, 'como mucho los últimos 8');
  assert.equal(completadosSinVer(muchos, null).at(-1)?.uuid, completadoSinVer(muchos, null)?.uuid, 'el último es el de la fila');
  const html = renderToStaticMarkup(createElement(BloqueCompletado, { chat: CHAT, lineas: tres, yaVisto: null, onYaVisto: () => {}, hayPreguntas: false }));
  assert.match(html, /class="co-preg__pasos"/, 'las flechas de las preguntas');
  assert.equal((html.match(/class="co-preg__punto"/g) ?? []).length, 3, 'un punto por cada uno');
  assert.match(html, /aria-label="Completado 1" aria-current="step"/, 'abre en el más viejo');
  assert.match(html, /aria-label="Completado · Ops Center: El primero"/);
  assert.match(html, /aria-label="Ocultar los completados"/);
  assert.doesNotMatch(html, />[^<]*\d de \d[^<]*</, 'sin «1 de 3» a la vista (sólo en el rótulo, para el lector)');
  // Uno solo, sin flechas.
  assert.doesNotMatch(renderToStaticMarkup(createElement(BloqueCompletado, { chat: CHAT, lineas: tres.slice(2), yaVisto: null, onYaVisto: () => {}, hayPreguntas: false })), /co-preg__pasos/);
  // Con una pregunta, su tira dice cuántos.
  const tira = renderToStaticMarkup(createElement(BloqueCompletado, { chat: CHAT, lineas: tres, yaVisto: null, onYaVisto: () => {}, hayPreguntas: true }));
  assert.match(tira, /<span class="co-preg__ya-titulo">3 completados sin ver<\/span>/);
  // «Ya lo vi» marca el que se ve (y los de antes) y vuelve al primero que queda.
  assert.match(leerBloque(), /onClick=\{\(\) => \{ onYaVisto\(instante\); setPos\(0\); \}\}/);
});

test('11. sin pedido, no queda el hueco', () => {
  const html = renderToStaticMarkup(createElement(BloqueCompletado, {
    chat: CHAT, lineas: [turno('s', '2026-10-25T11:00:00.000Z', 'Ya está: algo')], yaVisto: null, onYaVisto: () => {}, hayPreguntas: false,
  }));
  assert.doesNotMatch(html, /co-preg__ya-pedido|co-yo/);
  assert.match(html, /<div class="co-preg__ya-cuerpo"><p class="co-preg__ya-de">Respuesta de Ops Center<\/p>/);
});
