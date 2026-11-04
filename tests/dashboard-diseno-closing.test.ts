// La hoja Closing con su DISEÑO PROPIO (la copia de Halden): lo que se guarda, lo que dibuja cada bloque y lo que no
// se inventa. Martín, 4/11/2026: «que sea primero la copia… y después la adaptación con Maco». Ver
// docs/relevo/nube-dashboards.md y lib/closing-diseno.ts.
//
// Probado rompiéndolo (4/11/2026, contra una base de 8 verdes): sacar `diseno` del saneo de la hoja → 5 rojos (1 a 5:
// sin diseño ninguna pieza se encuentra); que la copia de una hoja no siga las piezas → 1 rojo (3); contar como
// agendadas las canceladas y las que ya pasaron → 1 rojo (6); ordenar las últimas por puntaje → 1 rojo (5).
// Y la poda de «Nueva hoja» (9): podar también las piezas → 1 rojo; podar lo que lee la caja de MaKo del diseño → 1 rojo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanearHoja, sanearDiseno, type Hoja } from '../lib/graficos-catalogo';
import { PLANTILLAS_HOJA, instanciarPlantilla } from '../lib/graficos-plantillas';
import { hojaConIdsNuevos } from '../lib/graficos-copia';
import { agendaDe, cuandoEs, lunesDe, relojDe, rotuloDelDia, vistaClosing, type DatosPieza } from '../lib/closing-diseno';
import type { Resultado } from '../lib/graficos-agregar';
import type { LlamadaDeVenta } from '../lib/calendario-llamadas';

const closing = () => instanciarPlantilla(PLANTILLAS_HOJA.find((p) => p.id === 'closing')!);

test('1 · la plantilla Closing nace con su diseño y cada pieza apunta a un componente de la hoja', () => {
  const h = closing();
  assert.equal(h.diseno?.id, 'closing');
  const ids = new Set(h.componentes.map((c) => c.id));
  for (const p of ['tasa', 'puntaje', 'analizadas', 'duracion', 'embudo', 'desenlace', 'semana', 'ultimas', 'closers', 'ia']) {
    assert.ok(h.diseno?.piezas[p], `falta la pieza ${p}`);
    assert.ok(ids.has(h.diseno!.piezas[p]), `la pieza ${p} no apunta a un componente`);
  }
  // Pasa por el saneo (lo que se guarda) igual.
  assert.deepEqual(sanearHoja(h, 0)?.diseno, h.diseno);
});

test('2 · el saneo: sólo un diseño del catálogo, y sólo las piezas que existen', () => {
  const ids = new Set(['a', 'b']);
  assert.deepEqual(sanearDiseno({ id: 'closing', piezas: { tasa: 'a', semana: 'zzz', 'Mal-Nombre': 'b' } }, ids), { id: 'closing', piezas: { tasa: 'a' } });
  assert.equal(sanearDiseno({ id: 'halden', piezas: {} }, ids), null);
  assert.equal(sanearDiseno(null, ids), null);
  // Una hoja de antes (sin diseño) no gana uno: no cambia sola.
  const vieja = { ...closing() } as Hoja;
  delete vieja.diseno;
  assert.equal(sanearHoja(vieja, 0)?.diseno, undefined);
  // Borrar el componente de una pieza la saca del diseño (el bloque no se dibuja; no apunta a la nada).
  const h = closing();
  const sinTasa = { ...h, componentes: h.componentes.filter((c) => c.id !== h.diseno!.piezas.tasa) };
  assert.equal(sanearHoja(sinTasa, 0)?.diseno?.piezas.tasa, undefined);
});

test('3 · duplicar o copiar la hoja: el diseño sigue a sus componentes por el id nuevo', () => {
  const h = closing();
  const c = hojaConIdsNuevos(h);
  assert.equal(c.diseno?.id, 'closing');
  const ids = new Set(c.componentes.map((x) => x.id));
  for (const [k, v] of Object.entries(c.diseno!.piezas)) {
    assert.ok(ids.has(v), `la pieza ${k} quedó apuntando al id viejo`);
    assert.notEqual(v, h.diseno!.piezas[k]);
  }
});

// ── Lo que dibuja cada bloque, con datos de prueba ───────────────────────────────────────────────────────────────
const r = (columnas: string[], totales: Array<number | null>, filas: Resultado['filas'] = [], anterior?: Array<number | null>): DatosPieza => ({
  cargando: false,
  resultado: { columnas: columnas.map((id) => ({ id, nombre: id, formato: 'numero' as const })), filas, totales, fuera: 0, clase: null, ...(anterior ? { anterior } : {}) } as Resultado,
});
const fila = (clave: string, valores: number[], extra?: Record<string, string>) => ({ clave, etiqueta: clave, valores, ...(extra ? { extra } : {}) });

test('4 · la tasa, sus cierres, cómo terminaron y los closers salen de sus piezas', () => {
  const h = closing();
  const p = h.diseno!.piezas;
  const datos: Record<string, DatosPieza> = {
    [p.tasa]: r(['tasa_cierre'], [40], [], [34]),
    [p.embudo]: r(['r1', 'r2', 'ganadas_r2'], [20, 15, 6]),
    [p.analizadas]: r(['llamadas'], [35]),
    [p.puntaje]: r(['puntaje'], [7.4]),
    [p.duracion]: r(['duracion'], [42.2]),
    // «Cómo terminaron» lee los totales de la tabla del equipo (la misma pieza): sus columnas de la R2 y de las perdidas.
    [p.closers]: r(['llamadas', 'puntaje', 'ganadas', 'tasa_cierre', 'ganadas_r2', 'perdidas'], [35, 7, 8, 40, 6, 12], [fila('Diego Paz', [10, 6, 2, 25, 2, 5]), fila('Ana Ruiz', [12, 8, 5, 50, 4, 4])]),
  };
  assert.equal(p.desenlace, p.closers);
  const v = vistaClosing(h, datos, null, '2026-11-04');
  assert.deepEqual(v.tasa, { valor: 40, anterior: 34, delta: 6 });
  assert.deepEqual(v.cierres, { ganadas: 6, de: 15 });
  assert.deepEqual(v.stats, { analizadas: 35, puntaje: 7.4, ganadas: 8 });
  // 2 en la R1, 6 en la R2, 12 perdidas y el resto (15) sin decisión: suman las 35.
  assert.deepEqual(v.desenlace?.segmentos.map((s) => [s.id, s.n]), [['r1', 2], ['r2', 6], ['sin', 15], ['perdida', 12]]);
  assert.equal(v.desenlace?.segmentos.reduce((a, s) => a + s.n, 0), 35);
  assert.deepEqual(v.closers.map((c) => c.nombre), ['Ana Ruiz', 'Diego Paz']);
  // Sin datos, null: nunca un cero inventado.
  const vacio = vistaClosing(h, {}, null, '2026-11-04');
  assert.equal(vacio.tasa.valor, null);
  assert.equal(vacio.desenlace, null);
  assert.equal(vacio.semana, null);
  assert.deepEqual(vacio.ultimas, []);
});

test('5 · la semana va de lunes a domingo (lo que viene, rayado y de la agenda) y las últimas, de la más nueva', () => {
  const h = closing();
  const p = h.diseno!.piezas;
  const hoy = '2026-11-04'; // miércoles
  assert.equal(lunesDe(hoy), '2026-11-02');
  const datos: Record<string, DatosPieza> = {
    [p.semana]: r(['llamadas'], [9], [fila('2026-11-02', [3]), fila('2026-11-03', [4]), fila('2026-11-04', [2])]),
    [p.ultimas]: r(['puntaje', 'duracion'], [null, null], [
      fila('Uno', [9, 30], { dia: '2026-11-01', reunion: 'R1' }), fila('Dos', [5, 40], { dia: '2026-11-04', reunion: 'R2', closer: 'Ana Ruiz' }), fila('Tres', [7, 20], { dia: '2026-11-03' }),
    ]),
  };
  const v = vistaClosing(h, datos, { porDia: { '2026-11-05': 2, '2026-11-07': 1 }, proxima: null, tz: 'America/Mexico_City' }, hoy);
  assert.deepEqual(v.semana?.dias.map((d) => [d.etiqueta, d.valor, d.tipo]), [
    ['Lun', 3, 'hecho'], ['Mar', 4, 'hecho'], ['Mié', 2, 'hoy'], ['Jue', 2, 'agenda'], ['Vie', 0, 'agenda'], ['Sáb', 1, 'agenda'], ['Dom', 0, 'agenda'],
  ]);
  assert.equal(v.semana?.hechas, 9);
  assert.equal(v.semana?.agendadas, 3);
  assert.deepEqual(v.ultimas.map((f) => f.nombre), ['Dos', 'Tres', 'Uno']);
  assert.equal(v.ultimas[0].clave, 'Dos');
  // Sin la agenda (el closer, un link compartido), los días que vienen no dicen «0»: no se sabe.
  const sinAgenda = vistaClosing(h, datos, null, hoy);
  assert.equal(sinAgenda.semana?.dias[3].valor, null);
});

test('6 · la agenda: cuenta las agendadas de los días que vienen y elige la próxima; una cancelada o una que pasó no cuentan', () => {
  const tz = 'America/Mexico_City';
  const ll = (id: number, inicio: string, extra: Partial<LlamadaDeVenta> = {}): LlamadaDeVenta =>
    ({ id: `crm:${id}:R1`, leadId: id, nombre: `Lead ${id}`, cual: 'R1', inicio, diaCompleto: false, closer: 'Ana Ruiz', asistio: null, cancelada: false, ...extra });
  const ahora = '2026-11-04T16:00:00Z'; // 10:00 en Ciudad de México
  const lista = [
    ll(1, '2026-11-04T15:00:00Z'), // ya pasó
    ll(2, '2026-11-04T20:30:00Z'), // hoy 14:30: la próxima
    ll(3, '2026-11-05T18:00:00Z'),
    ll(4, '2026-11-05T19:00:00Z', { cancelada: true }),
    ll(5, '2026-11-06T18:00:00Z', { cual: 'R2' }),
  ];
  const a = agendaDe(lista, '2026-11-04', tz, ahora);
  assert.deepEqual(a.porDia, { '2026-11-05': 1, '2026-11-06': 1 });
  assert.equal(a.proxima?.leadId, 2);
  assert.equal(cuandoEs(a.proxima!, Date.parse(ahora), '2026-11-04', tz), 'En 4 h 30 min');
  assert.equal(cuandoEs({ inicio: '2026-11-05T18:00:00Z', diaCompleto: false }, Date.parse(ahora), '2026-11-04', tz), 'Mañana');
  assert.equal(cuandoEs({ inicio: '2026-11-04T15:00:00Z', diaCompleto: false }, Date.parse(ahora), '2026-11-04', tz), null);
  // El renglón de abajo dice el día en la zona del negocio: a las 20:30 UTC del 4 en Ciudad de México sigue siendo hoy.
  assert.equal(rotuloDelDia('2026-11-04T20:30:00Z', '2026-11-04', tz), 'Hoy');
  assert.equal(rotuloDelDia('2026-11-05T05:30:00Z', '2026-11-04', tz), 'Hoy'); // 23:30 del 4 en la zona
  assert.equal(rotuloDelDia('2026-11-05T07:30:00Z', '2026-11-04', tz), 'Mañana');
  assert.equal(rotuloDelDia('2026-11-06T18:00:00Z', '2026-11-04', tz), 'vie 6');
});

test('7 · el reloj de la duración: minutos a horas, minutos y segundos', () => {
  assert.deepEqual(relojDe(42.2), [0, 42, 12]);
  assert.deepEqual(relojDe(75.5), [1, 15, 30]);
  assert.deepEqual(relojDe(null), [0, 0, 0]);
});

test('8 · la hoja de estilos del diseño: todo adentro de .hc, sin comillas invertidas y sin tocar la página', async () => {
  const { CSS_CLOSING } = await import('../app/dashboard/disenos/closing-css');
  assert.ok(CSS_CLOSING.length > 5000);
  assert.ok(!CSS_CLOSING.includes('`'));
  const sinCom = CSS_CLOSING.replace(/\/\*[\s\S]*?\*\//g, '');
  // Cada selector de una regla arranca con .hc (o es una regla @): ni :root, ni body, ni una clase suelta.
  const selectores = [...sinCom.matchAll(/(?:^|})\s*([^{}@]+)\{/g)].map((m) => m[1].trim()).filter((s) => s && !/^(from|to|\d+%)$/.test(s));
  // Las comas de adentro de un paréntesis (`:where(a,button)`) no separan selectores.
  const partir = (s: string) => { const out: string[] = []; let hondo = 0, actual = ''; for (const ch of s) { if (ch === '(') hondo++; if (ch === ')') hondo--; if (ch === ',' && !hondo) { out.push(actual); actual = ''; } else actual += ch; } out.push(actual); return out.map((x) => x.trim()); };
  const fuera = selectores.flatMap(partir).filter((x) => !x.startsWith('.hc'));
  // Los resets van con :where() para no ganarle a las clases del diseño (un `.hc button` le ganaba a `.hc-btn--primary`).
  assert.doesNotMatch(sinCom, /\.hc\s+(button|a|svg)\s*\{/);
  assert.deepEqual(fuera, []);
  assert.doesNotMatch(sinCom, /:root|(^|[\s,}])body\b|(^|[\s,}])html\b/);
});

test('9 · «Nueva hoja» no le poda al diseño un bloque sin datos de hoy: el bloque queda con su vacío y se llena cuando haya', async () => {
  const { podarSinDatos } = await import('../lib/graficos-con-datos');
  const h = closing();
  const p = h.diseno!.piezas;
  const graficos = h.componentes.filter((c) => c.clase === 'grafico');
  // Un gráfico suelto, fuera del diseño, para ver que la poda de siempre sigue andando.
  const suelto = { ...graficos[0], id: 'suelto-sin-datos' };
  const hoja = { ...h, componentes: [...h.componentes, suelto] } as Hoja;
  // Hoy sólo tiene datos la tasa: lo demás daría vacío.
  const medidas = new Map(hoja.componentes.filter((c) => c.clase === 'grafico').map((c) => [c.id, c.id === p.tasa ? 'con' : 'sin'] as const));
  const r = podarSinDatos(hoja, medidas);
  const ids = new Set(r.hoja.componentes.map((c) => c.id));
  for (const [k, v] of Object.entries(p)) assert.ok(ids.has(v), `se podó la pieza ${k}`);
  assert.ok(!ids.has('suelto-sin-datos'), 'el gráfico que no es del diseño se poda como siempre');
  // Lo que no es del diseño ni lo lee una caja suya se poda como siempre (la plantilla trae dos así, más el suelto).
  assert.ok(r.quitados >= 1 && r.quitados < graficos.length);
});
