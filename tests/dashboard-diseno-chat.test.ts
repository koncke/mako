// =============================================================================
// La hoja Chat Analyst con su DISEÑO PROPIO (la copia de Parley): de dónde sale cada número (lib/chat-diseno.ts)
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia… y después la adaptación con Maco» y «Después seguí con la segunda hoja, de a
// una». La hoja la dibuja app/dashboard/disenos/HojaChat.tsx con lo que arma `vistaChat` de las piezas de la hoja. Estos tests
// EJECUTAN esas funciones con datos armados acá (ficticios) y miran lo que sale; sólo el último lee el fuente (el cableado).
//
// Probado rompiéndolo (4/11/2026), cada rotura sola y la base en verde antes: ver el pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Resultado } from '../lib/graficos-agregar';
import {
  casillasDe, diasDe, duracion, enviadosDe, fraseChat, heroDe, inicialesDe, porSemana, rapidosDe, respondidosDe, respuestaDe, settersDe, tiposDe,
  vistaChat,
} from '../lib/chat-diseno';
import { datosChatMuestra } from '../lib/chat-diseno-muestra';
import { DISENOS_HOJA } from '../lib/graficos-catalogo';
import { HOJA_DE_ROL, PLANTILLAS_HOJA, PLANTILLAS_OFRECIDAS, instanciarPlantilla } from '../lib/graficos-plantillas';
import { cableadoDelDiseno } from './_diseno-cableado';

const leer = (r: string) => readFileSync(fileURLToPath(new URL(`../${r}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

const HOY = '2026-11-04';
const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const res = (ids: string[], totales: Array<number | null>, extra: Partial<Resultado> = {}): Resultado =>
  ({ columnas: col(ids), filas: [], totales, fuera: 0, clase: null, ...extra }) as Resultado;
const texto = (t: Array<{ s: string }>) => t.map((x) => x.s).join('');
const dias = (ids: string[], n: number, hasta: string, f: (i: number) => number[]): Resultado => res(ids, [], {
  clase: 'tiempo',
  filas: Array.from({ length: n }, (_, i) => {
    const d = new Date(`${hasta}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - (n - 1 - i));
    return { clave: d.toISOString().slice(0, 10), etiqueta: '', valores: f(i) };
  }),
});

test('la frase: cuántas veces te escribieron, qué parte respondiste y contra el período anterior', () => {
  assert.equal(texto(fraseChat(1890, 94.2, 92.8)), 'Te escribieron 1,890 veces y respondiste el 94.2%, 1.4 pt más que el período anterior.');
  assert.equal(texto(fraseChat(1, 50, 60)), 'Te escribieron 1 vez y respondiste el 50.0%, 10.0 pt menos que el período anterior.');
  assert.equal(texto(fraseChat(40, null, null)), 'Te escribieron 40 veces.');
  assert.equal(texto(fraseChat(0, null, null)), 'Nadie te escribió en este período.');
  assert.deepEqual(fraseChat(null, 90, 80), [], 'sin las veces no hay frase');
});

test('la tarjeta naranja: los recibidos, los chats, su cambio, las últimas ocho columnas y la más alta', () => {
  const porDia = dias(['recibidos', 'enviados'], 30, HOY, (i) => [i === 25 ? 400 : i + 1, 0]);
  const h = heroDe(res(['recibidos'], [4862], { anterior: [4460] }), res(['chats'], [318]), porDia, HOY);
  assert.deepEqual([h.total, h.cambio.cambio, h.cambio.sube, h.chats], [4862, '+9%', true, 318]);
  assert.equal(h.columnas.length, 8, 'como los ocho meses de Parley');
  assert.equal(h.columnas[7].clave, HOY);
  assert.deepEqual(h.columnas.map((c) => c.ahora), [...Array(7).fill(false), true]);
  assert.equal(h.hoy, 30, 'los recibidos de hoy, en lugar del «live»');
  assert.equal(h.pico, 3, 'la más alta lleva su número (la del día 26)');
  assert.deepEqual([h.columnas[0].corto, h.columnas[7].corto], ['28', '4']);
  // Un período que no llega a hoy no dice «hoy».
  assert.equal(heroDe(null, null, dias(['recibidos'], 5, '2026-10-20', () => [3]), HOY).hoy, null);
  // Lo que no llegó es null: ni un «0» ni un cambio ni columnas.
  const nada = heroDe(null, null, null, HOY);
  assert.deepEqual([nada.total, nada.cambio.cambio, nada.chats, nada.hoy, nada.columnas.length, nada.pico], [null, null, null, null, 0, -1]);
});

test('las casillas: respondidos y en 15 minutos, con su cambio en PUNTOS y el conteo que sale de las mismas veces', () => {
  assert.equal(casillasDe(94.2), 38, 'el 94.2 % de Parley son 38 de 40');
  assert.deepEqual([casillasDe(45), casillasDe(0), casillasDe(100), casillasDe(140), casillasDe(null)], [18, 0, 40, 40, 0]);
  const r = respondidosDe(res(['turnos', 'pct_respondidos'], [1890, 94.2], { anterior: [1770, 92.8] }), res(['sin_responder'], [12]));
  assert.deepEqual([r.pct, r.cambio.cambio, r.cambio.sube, r.esperando], [94.2, '+1.4 pt', true, 12]);
  const q = rapidosDe(res(['pct_rapidos'], [45], { anterior: [47.5] }), res(['turnos', 'pct_respondidos'], [1890, 94.2]));
  assert.deepEqual([q.n, q.de, q.pct, q.cambio.cambio, q.cambio.sube], [851, 1890, 45, '−2.5 pt', false]);
  const nada = rapidosDe(null, null);
  assert.deepEqual([nada.n, nada.de, nada.pct, nada.cambio.cambio], [null, null, null, null]);
  assert.deepEqual([respondidosDe(null, null).pct, respondidosDe(null, null).esperando], [null, null]);
});

test('el tiempo de respuesta: la mediana contra los 15 minutos, el p90 y cómo se lee un tiempo', () => {
  const r = respuestaDe(res(['mediana_respuesta'], [6]), res(['p90_respuesta'], [312]));
  assert.deepEqual([r.mediana, r.p90, r.relleno, r.pasa], [6, 312, 0.4, false]);
  const lento = respuestaDe(res(['mediana_respuesta'], [40]), null);
  assert.deepEqual([lento.relleno, lento.pasa, lento.p90], [1, true, null], 'pasa la meta: la barra llena');
  assert.deepEqual([respuestaDe(null, null).mediana, respuestaDe(null, null).relleno], [null, null]);
  assert.deepEqual(duracion(0.4), { n: '<1', u: 'min' });
  assert.deepEqual(duracion(6), { n: '6', u: 'min' });
  assert.deepEqual(duracion(312), { n: '5.2', u: 'h' });
  assert.deepEqual(duracion(4260), { n: '3.0', u: 'días' });
  assert.equal(duracion(null), null);
});

test('los enviados: día por día, el de hoy aparte, y nada si no se leyó', () => {
  const e = enviadosDe(dias(['recibidos', 'enviados'], 10, HOY, (i) => [0, (i + 1) * 10]), HOY)!;
  assert.equal(e.puntos.length, 10);
  assert.deepEqual([e.hoy, e.paso, e.puntos[9].ahora, e.puntos[0].ahora], [100, 'dia', true, false]);
  assert.equal(enviadosDe(dias(['enviados'], 3, '2026-10-01', () => [5]), HOY)?.hoy, null);
  assert.equal(enviadosDe(null, HOY), null);
  assert.equal(enviadosDe(res(['enviados'], [3], { clase: 'categoria', filas: [{ clave: 'x', etiqueta: 'x', valores: [3] }] }), HOY), null);
});

test('por día: las últimas doce, respondido y sin respuesta, el eje redondo, y por semana de lunes', () => {
  const d = diasDe(dias(['turnos', 'respondidos'], 30, HOY, (i) => [i + 10, i === 29 ? 999 : i]), HOY)!;
  assert.equal(d.columnas.length, 12);
  assert.equal(d.fuera, 18);
  assert.deepEqual(d.columnas.map((c) => c.ahora), [...Array(11).fill(false), true]);
  assert.deepEqual([d.columnas[0].turnos, d.columnas[0].respondidos], [28, 18]);
  assert.equal(d.columnas[11].respondidos, 39, 'nunca más respondidos que veces');
  assert.deepEqual([d.tope, d.pasoEje], [40, 10]);
  // Por semana: el miércoles 4/11 cae en la semana del lunes 2/11, con los dos días anteriores.
  const s = porSemana(d, HOY);
  assert.equal(s.paso, 'semana');
  assert.equal(s.columnas[s.columnas.length - 1].clave, '2026-11-02');
  assert.equal(s.columnas[s.columnas.length - 1].turnos, 37 + 38 + 39);
  assert.ok(s.columnas[s.columnas.length - 1].ahora);
  assert.equal(s.columnas.reduce((a, c) => a + c.turnos, 0), d.columnas.reduce((a, c) => a + c.turnos, 0), 'juntar no pierde ni suma');
  assert.equal(diasDe(null, HOY), null);
});

test('por tipo: lo recibido y lo enviado salen del cruce por su NOMBRE, en tres partes que suman el total', () => {
  // El cruce llega con «Enviado» primero: se lee por nombre, no por posición.
  const r = res(['mensajes'], [0], {
    clase: 'categoria',
    filas: ['Texto', 'Audio', 'Imagen', 'Video', '(sin dato)'].map((n) => ({ clave: n, etiqueta: n, valores: [0] })),
    cruce: { claves: ['Enviado', 'Recibido'], celdas: [[90, 50], [5, 30], [3, 10], [2, 6], [0, 4]] },
  });
  const t = tiposDe(r)!;
  assert.deepEqual(t.totales, { recibidos: 100, enviados: 100 });
  assert.deepEqual(t.recibidos.map((x) => [x.nombre, x.valor, x.otros]), [['Texto', 50, false], ['Audio', 30, false], ['Otros', 20, true]], 'con más de tres, los dos primeros y «Otros»');
  assert.equal(t.recibidos.reduce((a, x) => a + x.pct, 0), 100);
  assert.deepEqual(t.enviados.map((x) => x.nombre), ['Texto', 'Audio', 'Otros']);
  const tres = tiposDe(res(['mensajes'], [0], { clase: 'categoria', filas: [{ clave: 'a', etiqueta: '(sin dato)', valores: [0] }], cruce: { claves: ['Recibido'], celdas: [[7]] } }))!;
  assert.deepEqual(tres.recibidos.map((x) => [x.nombre, x.pct]), [['Sin tipo', 100]]);
  assert.deepEqual(tres.enviados, [], 'sin enviados, nada');
  assert.equal(tiposDe(null), null);
});

test('por setter: los cinco con más mensajes, su parte del total, sus iniciales y «Sin setter»', () => {
  // El total del período (250) es más que la suma de las filas (200): el gráfico recorta las que no entran.
  const r = res(['turnos', 'pct_rapidos'], [250, 50], {
    clase: 'categoria',
    filas: [['Ana Ruiz', 20, 60], ['(sin dato)', 80, null], ['Luis Pérez', 50, 40], ['Inés', 30, 70], ['Kenji Mora', 10, 10], ['Rita Abad', 10, 20], ['Sin mensajes', 0, 0]]
      .map(([n, t, p]) => ({ clave: String(n), etiqueta: String(n), valores: [t as number, p as number | null] })),
  });
  const s = settersDe(r);
  assert.equal(s.length, 5, 'los cinco de Parley');
  assert.deepEqual(s.map((x) => x.nombre), ['Sin setter', 'Luis Pérez', 'Inés', 'Ana Ruiz', 'Kenji Mora']);
  assert.deepEqual([s[0].iniciales, s[1].iniciales, s[2].iniciales], ['—', 'LP', 'IN']);
  assert.deepEqual([s[1].parte, s[1].rapidos, s[0].rapidos], [20, 40, null], 'la parte es sobre el TOTAL del período, no sobre las filas que llegaron');
  assert.equal(inicialesDe('🙂 Ana'), '🙂A', 'un emoji no se parte');
  assert.deepEqual(settersDe(null), []);
});

test('la plantilla trae el diseño, la muestra pasa por el mismo modelo, y el editor lo dibuja', () => {
  assert.ok((DISENOS_HOJA as readonly string[]).includes('chat'));
  const pl = PLANTILLAS_HOJA.find((x) => x.id === 'chat-analyst')!;
  assert.ok(PLANTILLAS_OFRECIDAS.some((x) => x.id === 'chat-analyst'), '«Nueva hoja» la ofrece: ya trae su diseño copiado');
  const h = instanciarPlantilla(pl);
  assert.equal(h.diseno?.id, 'chat');
  const pieza = (k: string) => h.componentes.find((c) => c.id === h.diseno!.piezas[k]) as { metricas?: string[]; comparar?: boolean; fuente?: string; dimension?: string; desglose?: string; tipo?: string } | undefined;
  for (const k of ['apertura', 'recibidos', 'chats', 'esperando', 'rapidos', 'mediana', 'lento', 'dias', 'respondidos', 'tipos', 'setters']) assert.ok(pieza(k), `la pieza ${k}`);
  for (const k of ['apertura', 'recibidos', 'rapidos']) assert.equal(pieza(k)?.comparar, true, `${k} se compara con el período anterior`);
  assert.deepEqual([pieza('tipos')?.fuente, pieza('tipos')?.dimension, pieza('tipos')?.desglose], ['whatsapp', 'tipo', 'direccion']);
  assert.deepEqual(pieza('respondidos')?.metricas, ['turnos', 'respondidos']);
  // Es la hoja del setter: todo lo que dibuja sale de SUS conjuntos.
  const setter = HOJA_DE_ROL.setter!;
  for (const c of h.componentes) if ((c as { fuente?: string }).fuente) assert.ok(setter.conjuntos.includes((c as { fuente: string }).fuente), `${c.id}: ${(c as { fuente: string }).fuente} es del setter`);
  // La muestra (la miniatura de «Nueva hoja») arma la vista entera con el modelo de verdad, y lo que dice cada tarjeta cuadra.
  const v = vistaChat(h, datosChatMuestra(h, HOY), HOY);
  assert.match(texto(v.frase), /^Te escribieron [\d,]+ veces y respondiste el [\d.]+%, 1\.4 pt más que el período anterior\.$/);
  assert.deepEqual(v.hero.columnas.map((c) => c.valor), [212, 268, 242, 345, 298, 386, 351, 318], 'las de Parley');
  assert.equal(v.hero.columnas[v.hero.pico].valor, 386);
  assert.equal(v.tipos?.totales.recibidos, v.hero.total, 'el reparto por tipo suma los recibidos');
  assert.equal(v.setters.reduce((a, s) => a + s.turnos, 0), v.rapidos.de, 'los setters suman las veces');
  assert.equal(v.dias?.columnas.length, 12);
  cableadoDelDiseno(h, 'chat', 'ChatVivo', ['extras={extras?.chat ?? null}']);
  assert.ok(leer('app/dashboard/page.tsx').includes('chat: hayDisenoChat ? { quien } : null'));
});

// Probado rompiéndolo (4/11/2026), cada rotura sola y la base en verde antes y después (9 de 9):
//   · los recibidos de «hoy» aunque el período no llegue a hoy: 1 fallo, 8 pases;
//   · el cruce por tipo leído por posición y no por nombre: 2 fallos, 7 pases;
//   · la parte de un setter sobre las filas que llegaron y no sobre el total: 1 fallo, 8 pases;
//   · un número que no llegó como 0: 3 fallos, 6 pases;
//   · más respondidos que veces (una columna negativa): 1 fallo, 8 pases;
//   · las casillas redondeadas para abajo (94.2 % → 37): 1 fallo, 8 pases;
//   · las semanas desde el domingo y no desde el lunes: 1 fallo, 8 pases;
//   · el cambio de un porcentaje en % y no en puntos: 1 fallo, 8 pases.
