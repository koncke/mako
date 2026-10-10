// La CONDITION que escucha la respuesta («Si responde», nodo 'respuesta') cuelga del CRON en el dibujo,
// como en el motor. Martín, 10/10/2026, sobre la 198 del ws1: «hay una condición suelta que no esta
// conectado a nada... me deja probarlo y guardarlo». No estaba suelta en el dato —una respuesta del lead
// pausa la salida y corre esto—: la segunda pasada de la sexta tanda le había sacado la flecha al sacar la
// fila «Si responde» del CRON. Y sin casos, su única fila decía «Si no», que se lee como que falta algo.
//
// ROTURAS (10/10/2026), restaurando de memoria, base 4 / 0:
//   E1. sin la flecha del CRON a la que escucha                                  → 3 / 1
//   E2. la flecha sin `sinMas` (el ＋ del medio y la papelera la tocarían)          → 3 / 1
//   E3. la única fila vuelve a decir «Si no»                                     → 3 / 1
//   E4. `validarGrafo` deja pasar una tarjeta suelta de verdad                   → 3 / 1
import test from 'node:test';
import assert from 'node:assert/strict';
import { grafoDeSecuencia } from '../lib/flujo-conversacion';
import { validarGrafo } from '../lib/flujo-grafo';

const base = { canal: 'whatsapp', delay_horas: 0, asunto: null, template_wa: null } as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Paso = any;
const conEscucha = (casos: Paso[] = []): Paso[] => [
  { ...base, id: 'm1', orden: 1, cuerpo: 'Hola', siguiente: null },
  { ...base, id: 'r', orden: 2, nodo: 'respuesta', cuerpo: '', casos, si_no: 'k', siguiente: null },
  { ...base, id: 'k', orden: 3, cuerpo: 'Aviso al equipo', siguiente: null },
];

test('la CONDITION que escucha se dibuja colgando del CRON, con su etiqueta y sin ＋ ni papelera', () => {
  const g = grafoDeSecuencia(conEscucha(), { disparador: 'Dejó el formulario' });
  const a = g.aristas.filter((x) => x.hasta === 'r');
  assert.equal(a.length, 1, 'la CONDITION que escucha quedó sin flecha de entrada (se lee suelta)');
  assert.equal(a[0].desde, 'entrada');
  assert.equal(a[0].etiqueta, 'Si responde');
  assert.equal(a[0].sinMas, true, 'la flecha no es del dato: el ＋ del medio y la papelera no la pueden tocar');
});

test('sin casos, su única fila dice «Respondió»; con casos, la última sigue siendo «Si no»', () => {
  const sola = grafoDeSecuencia(conEscucha(), { disparador: 'x' }).nodos.find((n) => n.id === 'r')!;
  assert.deepEqual(sola.puertos?.map((p) => p.rotulo), ['Respondió']);
  const conCaso = grafoDeSecuencia(conEscucha([{ id: 'c1', titulo: 'Precio', siguiente: null }]), { disparador: 'x' }).nodos.find((n) => n.id === 'r')!;
  assert.equal(conCaso.puertos?.at(-1)?.rotulo, 'Si no');
});

test('Publicar y Probar (validarGrafo) frenan una tarjeta suelta de verdad, y no la que escucha', () => {
  assert.deepEqual(validarGrafo(conEscucha()), [], 'la que escucha no es una tarjeta suelta');
  const conSuelta = [...conEscucha(), { ...base, id: 'x', orden: 4, cuerpo: 'Nadie me llama', siguiente: null }];
  assert.ok(validarGrafo(conSuelta).some((e) => /tarjetas sueltas: x/.test(e)), 'una tarjeta sin flecha pasa Publicar y Probar');
});

test('la única flecha nueva del CRON es la de la escucha (no se dibuja sin una que escuche)', () => {
  const sin = conEscucha().filter((p: Paso) => p.id !== 'r');
  const g = grafoDeSecuencia(sin, { disparador: 'x' });
  assert.ok(!g.aristas.some((a) => a.etiqueta === 'Si responde'));
});
