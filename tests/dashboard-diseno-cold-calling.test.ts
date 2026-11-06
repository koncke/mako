// =============================================================================
// La hoja «Cold Calling» con su DISEÑO PROPIO (la copia de Corvane): de dónde sale cada número (lib/cold-calling-diseno.ts)
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia… y después la adaptación con Maco». La hoja la dibuja
// app/dashboard/disenos/HojaColdCalling.tsx con lo que arma `vistaColdCalling` de las piezas de la hoja (las llamadas grabadas con el
// botón «Grabar llamada»). Estos tests EJECUTAN esas funciones con datos armados aquí (ficticios) y miran lo que sale; sólo el último lee
// el fuente (el cableado).
//
// Probado rompiéndolo (6/11/2026), cada rotura sola y la base en verde antes y después: ver el pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Resultado } from '../lib/graficos-agregar';
import { DISENOS_HOJA } from '../lib/graficos-catalogo';
import { PLANTILLAS_HOJA, PLANTILLAS_OFRECIDAS, instanciarPlantilla } from '../lib/graficos-plantillas';
import { ROTULO_RESULTADO, SIN_MARCAR } from '../lib/grabar-llamada-reglas';
import {
  LLAMADOS, MINIMO_AGENDAN, QUIEN, acumuladoCold, cambioDe, diasDe, llamadosDe, numerosDe, pendientesDe, quienDe, terminanDe, vistaColdCalling,
} from '../lib/cold-calling-diseno';
import { datosColdCallingMuestra } from '../lib/cold-calling-diseno-muestra';
import { cableadoDelDiseno } from './_diseno-cableado';

const leer = (r: string) => readFileSync(fileURLToPath(new URL(`../${r}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const res = (ids: string[], totales: Array<number | null>, extra: Partial<Resultado> = {}): Resultado =>
  ({ columnas: col(ids), filas: [], totales, fuera: 0, clase: null, ...extra }) as Resultado;
const filas = (ids: string[], fs: Array<[string, ...Array<number | null>]>, extra: Partial<Resultado> = {}): Resultado =>
  res(ids, ids.map(() => null), { clase: 'categoria', filas: fs.map(([k, ...v]) => ({ clave: k, etiqueta: k, valores: v })), ...extra });
const HOY = '2026-11-06';
const hoja = () => instanciarPlantilla(PLANTILLAS_HOJA.find((p) => p.id === 'cold-calling')!);
const { agendo, hablo, no_interesa, no_contesto } = ROTULO_RESULTADO;

test('el cambio contra el período anterior: en %, con su flecha; sin el anterior (o con cero antes) no hay cambio', () => {
  assert.deepEqual(cambioDe(126, 104), { texto: '21%', sube: true, tono: 'bueno' });
  assert.deepEqual(cambioDe(90, 100), { texto: '10%', sube: false, tono: 'malo' });
  assert.deepEqual(cambioDe(104, 100), { texto: '4%', sube: true, tono: 'bueno' });
  assert.equal(cambioDe(100, 100)?.tono, 'neutro');
  assert.deepEqual([cambioDe(10, null), cambioDe(10, 0), cambioDe(null, 5)], [null, null, null]);
});

test('los días: en orden, con su rótulo, y el acumulado suma los de antes', () => {
  const d = diasDe(res(['llamadas', 'contestaron', 'agendaron'], [30, 12, 3], {
    clase: 'tiempo', filas: [['2026-11-03', 10, 4, 1], ['2026-11-01', 8, 3, 1], ['2026-11-02', 12, 5, 1]].map(([k, a, b, c]) => ({ clave: String(k), etiqueta: '', valores: [Number(a), Number(b), Number(c)] })),
  }))!;
  assert.deepEqual(d.filas.map((f) => f.clave), ['2026-11-01', '2026-11-02', '2026-11-03']);
  assert.equal(d.paso, 'dia');
  assert.deepEqual(acumuladoCold(d.filas).map((f) => [f.llamadas, f.contestaron, f.agendaron]), [[8, 3, 1], [20, 8, 2], [30, 12, 3]]);
  assert.equal(diasDe(null), null);
});

test('cómo terminan: en el orden de la fuente, sin los que tienen cero ni «(sin dato)», y cuántas faltan marcar', () => {
  const t = terminanDe(filas(['llamadas'], [[agendo, 3], [hablo, 0], [no_interesa, 2], [no_contesto, 9], [SIN_MARCAR, 4], ['(sin dato)', 50]], { totales: [18] }))!;
  assert.deepEqual(t.filas.map((x) => [x.nombre, x.valor]), [[agendo, 3], [no_interesa, 2], [no_contesto, 9], [SIN_MARCAR, 4]]);
  assert.deepEqual([t.total, t.sinMarcar], [18, 4]);
  assert.notEqual(t.filas.find((x) => x.clave === agendo)?.color, t.filas.find((x) => x.clave === no_interesa)?.color, 'agendó y no le interesa no comparten color');
  assert.equal(terminanDe(filas(['llamadas'], [[agendo, 2], [hablo, 1]]))!.total, 3, 'sin total, la suma');
  assert.equal(terminanDe(null), null);
});

test('lo que sigue: sólo los resultados que tienen llamadas, sin marcar primero; «Sin marcar» nunca se cuenta como «No contestó»', () => {
  const p = pendientesDe(terminanDe(filas(['llamadas'], [[agendo, 1], [hablo, 5], [no_interesa, 0], [no_contesto, 7], [SIN_MARCAR, 3]])));
  assert.deepEqual(p.map((x) => x.clave), [SIN_MARCAR, no_contesto, agendo], 'lo que tiene cero no aparece; «Habló» no pide nada');
  assert.deepEqual([p[0].titulo, p[1].titulo, p[2].titulo], ['3 llamadas sin marcar', '7 no contestaron', '1 agendó una reunión']);
  assert.equal(pendientesDe(terminanDe(filas(['llamadas'], [[no_interesa, 1]])))[0].titulo, 'A 1 no le interesa');
  assert.deepEqual(pendientesDe(null), []);
});

test('los cuatro números: contestan, agendaron, agendan de los que contestan (con su mínimo) y los minutos, sin inventar', () => {
  const dias = diasDe(res(['llamadas', 'contestaron', 'agendaron'], [30, 12, 3], {
    clase: 'tiempo', filas: [['2026-11-01', 10, 4, 1], ['2026-11-02', 0, 0, 0], ['2026-11-03', 20, 8, 2]].map(([k, a, b, c]) => ({ clave: String(k), etiqueta: '', valores: [Number(a), Number(b), Number(c)] })),
  }))!.filas;
  const [con, ag, agn, min] = numerosDe({ contacto: res(['tasa_contacto'], [40]), agendaron: res(['agendaron'], [3]), dias, leads: res(['llamadas', 'minutos'], [30, 75]), llamadas: 30, contestaron: 12 });
  assert.deepEqual([con.texto, ag.texto, agn.texto, min.texto, min.sub], ['40%', '3', '25%', '75', '2.5 min por llamada']);
  assert.deepEqual(con.linea, [40, 40], 'un día sin llamadas no entra en la línea (no es 0%)');
  assert.deepEqual(ag.linea, [1, 0, 2]);
  assert.equal(min.linea, null, 'los minutos no tienen día');
  const pocos = numerosDe({ contacto: null, agendaron: res(['agendaron'], [1]), dias: null, leads: null, llamadas: 10, contestaron: MINIMO_AGENDAN - 1 });
  assert.equal(pocos[2].texto, null, `con menos de ${MINIMO_AGENDAN} que contesten no se calcula`);
  assert.equal(pocos[0].texto, null, 'la tasa que no llegó no es 0');
  assert.equal(pocos[3].texto, null);
  assert.equal(pocos[1].linea, null, 'sin días no hay línea');
});

test('a quién llamaste: hasta siete, sin «(sin dato)»; el total cuenta los que el límite dejó afuera', () => {
  const r = filas(['llamadas', 'minutos'], [['Ana Ruiz', 2, 6], ['(sin dato)', 9, 9], ['Nadie', 0, 0], ...Array.from({ length: 8 }, (_, i) => [`Lead ${i}`, 1, null] as [string, ...Array<number | null>])], { fuera: 5 });
  r.filas[0].extra = { resultado: agendo };
  r.filas[3].extra = { resultado: '(sin dato)' };
  const l = llamadosDe(r)!;
  assert.equal(l.filas.length, LLAMADOS);
  assert.deepEqual([l.filas[0].nombre, l.filas[0].iniciales, l.filas[0].resultado, l.filas[0].minutos], ['Ana Ruiz', 'AR', agendo, 6]);
  assert.deepEqual([l.filas[1].resultado, l.filas[1].minutos], [null, null], 'sin resultado ni minutos no se inventan');
  assert.equal(l.total, 9 + 5);
  assert.equal(llamadosDe(null), null);
});

test('quién llamó: por llamadas o por agendadas, con su barra relativa al primero; hasta seis', () => {
  const r = filas(['llamadas', 'contestaron', 'agendaron'], [['Luis', 20, 9, 1], ['Marta', 10, 6, 4], ['(sin dato)', 99, 9, 9], ['Sin llamar', 0, 0, 0], ...Array.from({ length: 6 }, (_, i) => [`P${i}`, 5 - i * 0.5, 1, 0] as [string, ...number[]])]);
  const l = quienDe(r, 'llamadas')!;
  assert.equal(l.length, QUIEN);
  assert.deepEqual(l.slice(0, 2).map((x) => [x.nombre, x.valor, x.ancho]), [['Luis', 20, 1], ['Marta', 10, 0.5]]);
  const a = quienDe(r, 'agendaron')!;
  assert.deepEqual(a.slice(0, 2).map((x) => [x.nombre, x.valor, x.ancho]), [['Marta', 4, 1], ['Luis', 1, 0.25]], 'por agendadas cambia el orden');
  assert.deepEqual(quienDe(filas(['llamadas', 'agendaron'], [['Ana', 2, 0], ['Sin llamar', 0, 0]]), 'agendaron')!.map((x) => x.nombre), ['Ana'], 'el que no llamó no está');
  assert.equal(quienDe(null, 'llamadas'), null);
});

test('la hoja entera con la muestra: las cifras cierran entre tarjetas', () => {
  const h = hoja();
  const v = vistaColdCalling(h, datosColdCallingMuestra(h, HOY));
  assert.deepEqual([v.vacia, v.cargando], [false, false]);
  const llamadas = v.llamadas!;
  assert.equal(v.dias!.filas.reduce((a, d) => a + d.llamadas, 0), llamadas, 'los días suman la cabecera');
  assert.equal(v.terminan!.total, llamadas, 'cómo terminan suma la cabecera');
  assert.equal(quienDe(v.quien, 'llamadas')!.reduce((a, q) => a + q.valor, 0), llamadas, 'quién llamó suma la cabecera');
  const t = (k: string) => v.terminan!.filas.find((x) => x.clave === k)?.valor ?? 0;
  assert.equal(t(agendo) + t(hablo) + t(no_interesa), v.contestaron, 'contestaron = agendó + habló + no le interesa');
  assert.equal(t(agendo), v.agendaron);
  assert.equal(v.cambio?.tono, 'bueno');
  assert.ok(v.numeros.every((n) => n.texto != null));
  assert.equal(v.llamados!.filas.length, LLAMADOS);
});

test('sin llamadas, la hoja lo dice; leyendo o caída, cada tarjeta espera sin inventar', () => {
  const h = hoja(), p = h.diseno!.piezas;
  assert.equal(vistaColdCalling(h, { [p.llamadas]: { resultado: res(['llamadas'], [0]) } }).vacia, true);
  assert.equal(vistaColdCalling(h, {}).vacia, false, 'sin saber cuántas hubo no se declara vacía');
  const cargando = vistaColdCalling(h, Object.fromEntries(Object.values(p).map((id) => [id, { cargando: true }])));
  assert.deepEqual([cargando.vacia, cargando.cargando, cargando.llamadas, cargando.dias, cargando.terminan, cargando.llamados, cargando.pendientes], [false, true, null, null, null, null, []]);
  const caida = vistaColdCalling(h, Object.fromEntries(Object.values(p).map((id) => [id, { error: 'caída' }])));
  assert.deepEqual([caida.vacia, caida.numeros.map((n) => n.texto)], [false, [null, null, null, null]]);
});

test('el cableado: la plantilla trae su diseño con sus siete piezas, se ofrece, el editor la dibuja mirando y graba con la misma grabadora', () => {
  assert.ok((DISENOS_HOJA as readonly string[]).includes('cold-calling'));
  assert.ok(PLANTILLAS_OFRECIDAS.some((p) => p.id === 'cold-calling'));
  const h = hoja();
  const porId = new Map(h.componentes.map((c) => [c.id, c as { fuente?: string; metricas?: string[]; dimension?: string | null; tabla?: { columnas?: string[] } }]));
  const pieza = (k: string) => porId.get(h.diseno!.piezas[k]);
  assert.equal(Object.keys(h.diseno!.piezas).length, 7);
  for (const k of Object.keys(h.diseno!.piezas)) assert.equal(pieza(k)?.fuente, 'llamadas_grabadas', `la pieza ${k} es de las llamadas grabadas`);
  assert.deepEqual(pieza('dias')?.metricas, ['llamadas', 'contestaron', 'agendaron']);
  assert.deepEqual([pieza('terminan')?.dimension, pieza('quien')?.dimension, pieza('leads')?.dimension], ['resultado', 'autor', 'lead']);
  assert.deepEqual(pieza('leads')?.tabla?.columnas, ['resultado'], 'cada lead trae cómo terminó');
  assert.ok(pieza('leads')?.metricas?.includes('minutos'));
  cableadoDelDiseno(h, 'cold-calling', 'ColdCallingVivo', ['onCambio={onCambio}']);
  assert.match(leer('app/dashboard/EditorInforme.tsx'), /<BloqueDeDiseno[\s\S]{0,800}onCambio=\{refrescar\}/, 'después de grabar, la hoja vuelve a leer');
  assert.ok(leer('app/dashboard/disenos/DisenoEnMiniatura.tsx').includes('vistaColdCalling(hoja, datosColdCallingMuestra(hoja, hoy))'));
  const hojaSrc = leer('app/dashboard/disenos/HojaColdCalling.tsx');
  assert.ok(hojaSrc.includes("import('@/app/_components/grabar/GrabarEnFrio')"), 'la grabadora es la de la ficha del lead');
  assert.match(hojaSrc, /const puedeGrabar = !compartido && !quieta;/, 'compartida o en miniatura no se graba');
});

// Probado rompiéndolo (6/11/2026), cada rotura sola y la base en verde antes y después (16 de 16):
//   · un cambio contra cero antes: 1 fallo, 9 pases;
//   · el cambio al revés (sube = malo): 2 fallos, 8 pases;
//   · los días al revés: 2 fallos, 8 pases;
//   · el acumulado mal arrancado: 1 fallo, 9 pases;
//   · un resultado en cero en la barra: 1 fallo, 9 pases;
//   · «Sin marcar» contado como «No contestó»: 1 fallo, 9 pases;
//   · «Lo que sigue» sin las sin marcar: 1 fallo, 9 pases;
//   · «Agendan» sin su mínimo de 5: 1 fallo, 9 pases;
//   · un día sin llamadas como 0% en la línea: 1 fallo, 9 pases;
//   · «(sin dato)» como resultado de un lead: 1 fallo, 9 pases;
//   · el total de leads sin los que el límite dejó afuera: 1 fallo, 9 pases;
//   · «Quién llamó» sin ordenar por la métrica elegida: 1 fallo, 9 pases;
//   · el que no llamó en la lista: 1 fallo, 9 pases (con la primera versión del test daba 0: se sumó el caso);
//   · la hoja vacía sin saber cuántas hubo: 1 fallo, 9 pases;
//   · compartida, con la grabadora: 1 fallo, 9 pases;
//   · grabar sin que la hoja vuelva a leer: 1 fallo, 9 pases.
