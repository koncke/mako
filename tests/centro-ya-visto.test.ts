// =============================================================================
// El ✓ del «Completado»: «Espera tu respuesta» hasta que Martín lo toca (18/10/2026, pedido 1d15877a)
// =============================================================================
// Martín: «No me aparece el mensaje de "Completado" y la notificación de todos los chats siempre debe ser "Espera tu
// respuesta", y no desaparecer hasta que yo le dé un check al mensaje de completado». Medido ese día en MaKo: los «Ya
// está» de CRM, Dashboard, Ticketera y Second Brain ESTABAN (y eran lo último del chat); el aviso se apagaba por otra cosa:
//   · era por dispositivo y se apagaba al abrir el chat (`avisaYaEsta`);
//   · sólo contaba si el «Ya está» era lo ÚLTIMO del chat (Onboarding y Ops Center escribieron después);
//   · la lista recibe 3 turnos por chat (`resumirTurnos`): con 3 mensajes después, el «Ya está» ni llegaba.
// Lo que se fija:
//   1. el último «Ya está» cuenta aunque después el chat haya escrito otra cosa, y espera el ✓ hasta que se lo marca;
//   2. la fila dice «Espera tu respuesta» (no «Completado · para revisar»), en la computadora y en el teléfono;
//   3. la lista recibe el último «Ya está» aunque no esté entre los 3 últimos;
//   4. el ✓ se guarda en MaKo con su guarda y viaja en cada refresco (vale en las dos pantallas);
//   5. la tarjeta lleva el ✓: vacío hasta tocarlo, «Visto» después.
//
// Probado rompiéndolo (18/10/2026, con la base en 0 fallos):
//   · `esperaCheck` sin comparar con el ✓ (siempre true) → 1 fallo (1);
//   · `segundoRenglon` otra vez con `sinVer && p?.ya` → 1 fallo (2);
//   · `resumirTurnos` sin sumar el «Ya está» → 1 fallo (3);
//   · la tarjeta sin `tieneCheck` (siempre sin ✓) → 1 fallo (5).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  YA_VISTOS_DESDE, esYaEsta, esperaCheck, leerYaVistos, segundoRenglon, tieneCheck, ultimoYaEsta, vistaPrevia, type LineaChat,
} from '../lib/centro-chats';
import { ULTIMOS_POR_CHAT, resumirTurnos, type TurnoChat } from '../lib/operaciones-reglas';
import { YaEstaMensaje } from '../app/admin/operaciones/Avance';

const LOCAL = 'local_11111111-1111-4111-8111-111111111111';
const t = (rol: TurnoChat['rol'], texto: string, at: string): TurnoChat => ({ local: LOCAL, uuid: `u-${rol}-${at}`, rol, de: null, texto, at, trabajo: null });
const linea = (x: TurnoChat): LineaChat => ({ tipo: 'turno', instante: Date.parse(x.at), turno: x });
// Lo que pasó en Onboarding el 18/10: su «Ya está» y, después, el Cerebro y el chat siguieron escribiendo.
const ONBOARDING = [
  t('el', 'Ya está: el onboarding nuevo está en producción.', '2026-10-18T14:47:00Z'),
  t('el', 'El onboarding nuevo del 18/10 está en producción, con el hito.', '2026-10-18T14:48:00Z'),
  t('otro', 'Cerebro → Onboarding: un cambio chico, de Martín.', '2026-10-18T15:00:00Z'),
  t('el', 'Voy a trabajar en que, mientras MaKo procesa…', '2026-10-18T15:01:00Z'),
];
const YA = Date.parse('2026-10-18T14:47:00Z');

test('1. el último «Ya está» espera el ✓ aunque el chat haya escrito después, y hasta que se lo marca', () => {
  const lineas = ONBOARDING.map(linea);
  assert.equal(vistaPrevia(lineas)?.ya, undefined, 'lo último ya no es el «Ya está» (por eso antes no avisaba)');
  assert.equal(ultimoYaEsta(lineas), YA);
  assert.equal(esperaCheck(YA, {}, 'onboarding'), true, 'sin ✓: espera');
  assert.equal(esperaCheck(YA, { onboarding: YA - 1 }, 'onboarding'), true, 'con el ✓ de un «Ya está» anterior: espera');
  assert.equal(esperaCheck(YA, { onboarding: YA }, 'onboarding'), false, 'con su ✓: no');
  assert.equal(esperaCheck(YA, null, 'onboarding'), false, 'sin saber los ✓ (antes de leer): no avisa');
  assert.equal(esperaCheck(YA_VISTOS_DESDE - 1, {}, 'viejo'), false, 'los de antes del 18/10 no vuelven todos juntos');
  assert.equal(esperaCheck(null, {}, 'sin'), false);
});

test('2. la fila dice «Espera tu respuesta» hasta el ✓, en la computadora y en el teléfono', () => {
  const p = vistaPrevia(ONBOARDING.map(linea));
  void p;
  assert.equal(segundoRenglon({ estado: 'abierto', viejo: false }, 0, true), 'revisar', 'aunque lo último no sea el «Ya está»');
  assert.equal(segundoRenglon({ estado: 'abierto', viejo: false }, 0, false), null, 'con su ✓, sin subtítulo (20/10/2026)');
  const leer = (r: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', r), 'utf8');
  // Las palabras son las de la regla (lib/centro-chats.ts → TEXTO_SEGUNDO_RENGLON), en las dos listas.
  assert.match(leer('app/admin/operaciones/PiezasCentro.tsx'), /\{TEXTO_SEGUNDO_RENGLON\[r\]\}/);
  assert.match(leer('app/m/operaciones/ChatsMovil.tsx'), /\{TEXTO_SEGUNDO_RENGLON\[renglon\]\}/);
  const motor = leer('app/admin/operaciones/useCentro.ts');
  assert.match(motor, /filter\(\(\[k, l\]\) => esperaCheck\(ultimoYaEsta\(l\), yaVistos, k\)\)/, 'del ✓ guardado, no de lo que vio el dispositivo');
  assert.doesNotMatch(motor, /k !== mirando && avisaYaEsta/, 'abrir el chat ya no lo apaga');
});

test('3. la lista recibe el último «Ya está» aunque no esté entre los 3 últimos', () => {
  const ahora = Date.parse('2026-10-18T16:00:00Z');
  const sin = resumirTurnos(ONBOARDING, ahora);
  assert.equal(sin.length, ULTIMOS_POR_CHAT);
  assert.equal(sin.some((x) => esYaEsta(x.texto)), false, 'así se perdía');
  const con = resumirTurnos(ONBOARDING, ahora, esYaEsta);
  assert.equal(con.length, ULTIMOS_POR_CHAT + 1);
  assert.equal(con[0].texto, ONBOARDING[0].texto, 'el «Ya está», primero (es el más viejo)');
  assert.equal(resumirTurnos(ONBOARDING.slice(0, 2), ahora, esYaEsta).length, 2, 'si ya está entre los últimos, no se repite');
  const leer = (r: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', r), 'utf8');
  assert.match(leer('lib/centro-turnos-db.ts'), /resumirTurnos\(ULTIMOS_EN_MEMORIA\.get\(f\.key\)\?\.turnos \?\? \[\], ahora, esYaEsta\)/);
});

test('4. el ✓ se guarda en MaKo, sólo avanza, y viaja en cada refresco', () => {
  assert.deepEqual(leerYaVistos({ crm: 5, '': 3, malo: 'x', nan: Number.NaN }), { crm: 5 });
  assert.deepEqual(leerYaVistos(null), {});
  assert.deepEqual(leerYaVistos([1, 2]), {});
  const leer = (r: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', r), 'utf8').replace(/\r\n/g, '\n');
  const db = leer('lib/centro-ya-vistos-db.ts');
  assert.match(db, /if \(\(actual\[chat\] \?\? 0\) >= instante\) return actual;/, 'sólo avanza');
  assert.match(db, /getSettingEstricto\(CLAVE\)/, 'lee estricto antes de escribir');
  const acc = leer('app/admin/operaciones/acciones.ts');
  assert.match(acc, /export async function marcarYaVistoAction\(chat: string, instante: number\)[^\n]*\{\n  const admin = await getSesionAdmin\(\);\n  if \(!puedeOperar\(admin, await wsSuperAdmin\(\)\)\) return \{ ok: false, error: NO_PUEDE \};/);
  assert.match(acc, /leerUltimosTurnos\(\), leerYaVistosDe\(\)\]\);\n    return \{ ok: true, [^}]*yaVistos \};/, 'en la foto de cada refresco');
});

test('5. la tarjeta del «Completado» lleva el ✓: vacío hasta tocarlo, «Visto» después', () => {
  const ya = t('el', 'Ya está: el filtro del CRM.\nPruébalo en /crm.', '2026-10-18T14:46:00Z');
  const instante = Date.parse(ya.at);
  const sinCheck = renderToStaticMarkup(createElement(YaEstaMensaje, { t: ya, yaVisto: null, onYaVisto: () => {} }));
  assert.match(sinCheck, /class="co-ya__check" aria-pressed="false" aria-label="Marcar como visto"/);
  const conCheck = renderToStaticMarkup(createElement(YaEstaMensaje, { t: ya, yaVisto: instante, onYaVisto: () => {} }));
  assert.match(conCheck, /class="co-ya__check co-ya__check--ok" aria-pressed="true" disabled="" aria-label="Visto"/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(YaEstaMensaje, { t: ya })), /co-ya__check/, 'sin cómo marcarlo, sin ✓');
  assert.equal(tieneCheck(YA_VISTOS_DESDE - 1, null), true, 'los de antes del 18/10 ya cuentan con su ✓');
});
