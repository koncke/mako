// =============================================================================
// Los chats que esperan la respuesta de Martín van PRIMERO en la lista del Ops Center (25/10/2026)
// =============================================================================
// Martín (24/10, 23:39): «el tema de los chats de MaKo cuando tienen [...] un espera tu respuesta deberían posicionarse arriba
// porque había muchos que estaban abajo y yo no los veo». Hasta ese día el orden era: lo que trabaja, después lo que avisa (una
// pregunta O un «Completado» sin ✓, juntos), después el resto. Esto fija:
//   1. el orden: espera su respuesta > trabaja > «Completado» sin ✓ > el resto; los que esperan, el más reciente arriba;
//   2. adentro de un grupo: un sub-chat que espera sube a su jefe, y va primero entre los suyos; y lo mismo debajo del Cerebro;
//   3. la computadora y el teléfono le pasan a la lista las preguntas SOLAS (las del renglón de cada fila), no los avisos.
//
// PROBADO ROMPIÉNDOLO (25/10/2026, base 3/0): la espera después de lo que trabaja → 2 rojos (1 y 2); los sub-chats del Cerebro
// sin ordenar → 1 rojo (2); el teléfono sin pasarle las preguntas → 1 rojo (3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SECCION_CEREBRO, SECCION_CHATS, completarChats, esperaDe, porJefe, seccionesDeChats, type CarteroP, type ChatCentro } from '../lib/centro-chats';

const AHORA = Date.parse('2026-10-24T23:40:00Z');
const S = (n: number) => `local_${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
const chat = (n: number, titulo: string, hora: string, busy = false) =>
  ({ local: S(n), titulo, cuenta: 'claude5', vivo: true, estado: busy ? 'busy' as const : 'idle' as const, actividad: `2026-10-24T${hora}:00Z` });

function armar(chats: ReturnType<typeof chat>[]) {
  const carteros: CarteroP[] = [{ cuenta: 'claude5', vistoAt: '2026-10-24T23:39:00Z', chats }];
  return completarChats([], { carteros, trabajos: [], ahora: AHORA });
}
const titulos = (cs: readonly ChatCentro[]) => cs.map((c) => c.titulo);

test('1. primero lo que espera su respuesta (el más reciente arriba), después lo que trabaja, los «Completado» y el resto', () => {
  const cs = armar([
    chat(1, 'CRM', '23:00', true), chat(2, 'Landings', '20:00'), chat(3, 'Planes', '22:00'),
    chat(4, 'Automations', '21:00'), chat(5, 'Clients', '23:30'), chat(6, 'Dashboard', '19:00'),
  ]);
  const de = (t: string) => cs.find((c) => c.titulo === t)!;
  // Esperan su respuesta: Landings (vieja, 20:00) y Planes (22:00). Un «Completado» sin ✓: Automations. Clients, el resto.
  const esperas: Record<string, number> = { [de('Landings').miembros[0]]: 1, [de('Planes').miembros[0]]: 2 };
  const esperanRespuesta = (c: ChatCentro) => esperaDe(c, esperas);
  const avisos = (c: ChatCentro) => esperanRespuesta(c) + (c.titulo === 'Automations' ? 1 : 0);
  const lista = seccionesDeChats(cs, avisos, esperanRespuesta).find((s) => s.clave === SECCION_CHATS)!.chats;
  assert.deepEqual(titulos(lista), ['Planes', 'Landings', 'CRM', 'Automations', 'Clients', 'Dashboard']);
  // Sin las preguntas solas (quien no las distingue), lo de antes: lo que trabaja arriba.
  assert.equal(titulos(seccionesDeChats(cs, avisos).find((s) => s.clave === SECCION_CHATS)!.chats)[0], 'CRM');
});

test('2. adentro de un grupo: un sub-chat que espera sube a su jefe y va primero entre los suyos; lo mismo con el Cerebro', () => {
  const cs = armar([
    chat(1, 'Ventas', '23:00', true), chat(2, 'CRM', '22:00'), chat(3, 'CRM › Ficha', '21:00'), chat(4, 'CRM › Funnels', '18:00'),
    chat(5, 'Cerebro', '23:30', true), chat(6, 'Cerebro › Integración', '23:20'), chat(7, 'Cerebro › Tren', '20:00'),
  ]);
  const de = (t: string) => cs.find((c) => c.titulo === t)!;
  const esperas: Record<string, number> = { [de('CRM › Funnels').miembros[0]]: 1, [de('Cerebro › Tren').miembros[0]]: 1 };
  const esperanRespuesta = (c: ChatCentro) => esperaDe(c, esperas);
  const secs = seccionesDeChats(cs, esperanRespuesta, esperanRespuesta);
  const grupos = porJefe(secs.find((s) => s.clave === SECCION_CHATS)!.chats);
  assert.equal(grupos[0].jefe, 'CRM', 'el grupo del que espera, arriba de lo que trabaja');
  assert.deepEqual(titulos(grupos[0].subs), ['CRM › Funnels', 'CRM › Ficha'], 'el que espera, primero entre los suyos');
  assert.deepEqual(titulos(secs.find((s) => s.clave === SECCION_CEREBRO)!.chats), ['Cerebro', 'Cerebro › Tren', 'Cerebro › Integración'],
    'debajo del Cerebro, el que espera primero');
});

test('3. la computadora y el teléfono le pasan a la lista las preguntas SOLAS (las del renglón de cada fila)', () => {
  const leer = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');
  const pc = leer('app/admin/operaciones/PiezasCentro.tsx');
  assert.match(pc, /const esperanRespuesta = useMemo\(\(\) => \(c: ChatCentro\) => esperaDe\(c, k\.esperas\), \[k\.esperas\]\);/);
  // Sobre lo que va en la lista: sin los dormidos (10/11/2026, `vaEnLaLista`: tests/ops-center-por-tab.test.ts, 4 y 6).
  assert.match(pc, /seccionesDeChats\(enLista, avisos, esperanRespuesta\)/);
  const m = leer('app/m/operaciones/ChatsMovil.tsx');
  assert.match(m, /const esperanRespuesta = useMemo\(\(\) => \(c: ChatCentro\) => esperaDe\(c, esperas\), \[esperas\]\);/);
  assert.match(m, /seccionesDeChats\(enLista, avisos, esperanRespuesta\)/);
});
