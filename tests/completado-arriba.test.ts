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
//
// PROBADO ROMPIÉNDOLO (25/10/2026, base 4/0): `completadoSinVer` sin mirar el ✓ → 2 rojos (1 y 2); sin la tira con una
// pregunta → 1 rojo (2); el teléfono sin el bloque → 1 rojo (3); el bloque sin tope de alto → 1 rojo (4).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { completadoSinVer, yaEstaSinVer, type LineaChat } from '../lib/centro-chats';
import { BloqueCompletado } from '../app/admin/operaciones/BloqueCompletado';

const LOCAL = 'local_00000001-0000-4000-8000-000000000000';
const turno = (uuid: string, at: string, texto: string, rol: 'el' | 'yo' = 'el'): LineaChat =>
  ({ tipo: 'turno', instante: Date.parse(at), turno: { local: LOCAL, uuid, rol, de: null, texto, at, trabajo: null } });
const lineas: LineaChat[] = [
  turno('u1', '2026-10-25T10:00:00.000Z', 'Ya está: el viejo'),
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

test('2. el bloque: el marco de las preguntas, el mensaje entero, «Visto» y plegar; con una pregunta, su tira; con el ✓, nada', () => {
  const dibujar = (p: Partial<Parameters<typeof BloqueCompletado>[0]> = {}) => renderToStaticMarkup(createElement(BloqueCompletado, {
    chat: CHAT, lineas, yaVisto: null, onYaVisto: () => {}, hayPreguntas: false, ...p,
  }));
  const abierto = dibujar();
  assert.match(abierto, /class="co-preg co-preg--arriba co-preg--completado" role="group" aria-label="Completado: [^"]*la lista ordena/);
  assert.match(abierto, /class="co-ya__rotulo">Completado</);
  assert.match(abierto, /aria-label="Marcar como visto"[^>]*>.*Visto<\/button>/, 'darlo por visto');
  assert.match(abierto, /aria-label="Ocultar el completado"/, 'plegarlo');
  assert.match(abierto, /Decidido: espera &gt; trabaja\./, 'el mensaje entero, no sólo el título');
  assert.equal((abierto.match(/class="co-ya__cab"/g) ?? []).length, 0, 'sin la cabecera de la tarjeta del hilo: no dice «Completado» dos veces');
  const tira = dibujar({ hayPreguntas: true });
  assert.match(tira, /^<button type="button" class="co-preg co-preg--arriba co-preg--plegada co-preg--completado" aria-expanded="false"/, 'con una pregunta, en su tira');
  assert.match(tira, /Completado: [^<]*la lista ordena/);
  assert.doesNotMatch(tira, /\*\*/, 'la tira es un renglón sin formato: sin los asteriscos del Markdown');
  assert.doesNotMatch(tira, /Decidido/, 'plegado no muestra el cuerpo');
  assert.equal(dibujar({ yaVisto: T2 }), '', 'con el ✓, no hay bloque');
  assert.doesNotMatch(dibujar({ onYaVisto: undefined }), /Marcar como visto/, 'sin cómo marcarlo, no se ofrece');
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
