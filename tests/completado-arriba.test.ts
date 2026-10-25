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
//
// PROBADO ROMPIÉNDOLO (25/10/2026, base 4/0): `completadoSinVer` sin mirar el ✓ → 2 rojos (1 y 2); sin la tira con una
// pregunta → 1 rojo (2); el teléfono sin el bloque → 1 rojo (3); el bloque sin tope de alto → 1 rojo (4). La segunda vuelta
// (base 6/0): `pedidoDelCompletado` con un turno que trajo un trabajo → 1 rojo (5); el aviso «Cortado» de vuelta → 1 rojo (6);
// sin plegar lo largo que no tiene cola → 1 rojo (6).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TOPE_TURNO } from '../lib/operaciones-reglas';
import { completadoSinVer, pedidoDelCompletado, yaEstaSinVer, type LineaChat } from '../lib/centro-chats';
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
    chat: CHAT, lineas, yaVisto: null, onYaVisto: () => {}, hayPreguntas: false, ...p,
  }));
  const abierto = dibujar();
  assert.match(abierto, /class="co-preg co-preg--arriba co-preg--completado" role="group" aria-label="Completado: [^"]*la lista ordena/);
  assert.match(abierto, /class="co-ya__rotulo">Completado</);
  assert.match(abierto, /aria-label="Ya lo vi: marcarlo como visto"[^>]*>.*Ya lo vi<\/button>/, 'darlo por visto');
  assert.match(abierto, /aria-label="Ocultar el completado"/, 'plegarlo');
  assert.match(abierto, /Decidido: espera &gt; trabaja\./, 'el mensaje entero, no sólo el título');
  assert.equal((abierto.match(/class="co-ya__cab"/g) ?? []).length, 0, 'sin la cabecera de la tarjeta del hilo: no dice «Completado» dos veces');
  const tira = dibujar({ hayPreguntas: true });
  assert.match(tira, /^<button type="button" class="co-preg co-preg--arriba co-preg--plegada co-preg--completado" aria-expanded="false"/, 'con una pregunta, en su tira');
  assert.match(tira, /Completado: [^<]*la lista ordena/);
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
  assert.equal(pedidoDelCompletado(lineas, u2), 'no, no era todo. Ordená la lista', 'su último turno antes del «Ya está»');
  // Un turno que trajo un trabajo firmado no cuenta (ese trabajo ya está, con su texto); el trabajo sí.
  const conTrabajo: LineaChat[] = [...lineas,
    { tipo: 'turno', instante: Date.parse('2026-10-25T10:50:00.000Z'), turno: { local: LOCAL, uuid: 'p2', rol: 'yo', de: null, texto: '[firmado] Ordena', at: '2026-10-25T10:50:00.000Z', trabajo: 't1' } },
    { tipo: 'trabajo', instante: Date.parse('2026-10-25T10:49:00.000Z'), trabajo: { id: 't1', destino: LOCAL, destino_titulo: 'Ops Center', destino_cuenta: null, created_at: '2026-10-25T10:49:00.000Z', texto: 'Ordena la lista por lo que espera' } },
  ];
  assert.equal(pedidoDelCompletado(conTrabajo, u2), 'Ordena la lista por lo que espera');
  assert.equal(pedidoDelCompletado([lineas[0]], { at: '2026-10-25T10:00:00.000Z' }), null, 'sin nada antes, nada');
  const html = renderToStaticMarkup(createElement(BloqueCompletado, { chat: CHAT, lineas, yaVisto: null, onYaVisto: () => {}, hayPreguntas: false }));
  const i = html.indexOf('class="co-preg__ya-pedido"');
  assert.ok(i > 0 && i < html.indexOf('Respuesta de Ops Center'), 'su pedido arriba, la respuesta abajo');
  assert.match(html, /<div class="co-yo"><div class="co-burbuja"><p class="co-preg__ya-pedido-texto[^"]*">no, no era todo\. Ordená la lista<\/p><\/div>/, 'como su globo');
  assert.match(leer('app/admin/operaciones/BloqueCompletado.tsx'), /<MiFoto \/>/, 'con su foto');
  assert.doesNotMatch(html, /co-preg__ya-pedido-mas/, 'uno corto va entero, sin «Ver todo»');
  // Uno largo se achica a 4 renglones y se lee entero ahí mismo: nada se corta.
  const largo = [...lineas, turno('p3', '2026-10-25T10:40:00.000Z', `${'Lo que pegué del chat de ventas. '.repeat(12)}`, 'yo')];
  const conLargo = renderToStaticMarkup(createElement(BloqueCompletado, { chat: CHAT, lineas: largo, yaVisto: null, onYaVisto: () => {}, hayPreguntas: false }));
  assert.match(conLargo, /co-preg__ya-pedido-texto co-preg__ya-pedido-texto--corto/);
  assert.match(conLargo, /class="co-chip co-preg__ya-pedido-mas" aria-expanded="false">Ver todo</);
});

test('6. nunca «Cortado a los N caracteres»: lo cortado termina en «…», y lo largo se pliega a su resumen con «Ver todo»', () => {
  const dibujar = (texto: string, enBloque = false) => renderToStaticMarkup(createElement(YaEstaMensaje, {
    t: { local: LOCAL, uuid: 'L', rol: 'el', de: null, texto, at: '2026-10-25T11:00:00.000Z', trabajo: null }, enBloque,
  }));
  const cortado = dibujar(`Ya está: algo grande\n\n${'palabra '.repeat(TOPE_TURNO / 8)}`.slice(0, TOPE_TURNO));
  assert.doesNotMatch(cortado, /Cortado|caracteres|El resto está/, 'ningún aviso de corte');
  assert.match(cortado, /…/, 'lo cortado termina en «…»');
  assert.match(cortado, /co-ya__detalle--plegado/, 'plegado aunque no tenga una cola que dejar a la vista');
  assert.match(cortado, />Ver todo</);
  const medio = `Ya está: algo mediano\n\n${'frase corta. '.repeat(60)}`;
  assert.doesNotMatch(dibujar(medio), /Ver todo/, 'en el hilo, 700 caracteres van enteros');
  assert.match(dibujar(medio, true), />Ver todo</, 'arriba de la caja, más corto: se pliega');
  assert.doesNotMatch(leer('app/admin/operaciones/Avance.tsx'), /co-ya__corte|TOPE_TURNO\} caracteres/, 'el aviso no vuelve');
});
