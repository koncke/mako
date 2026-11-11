// =============================================================================
// La hoja Marketing con su DISEÑO PROPIO (la copia de Kestrel): de dónde sale cada número (lib/marketing-diseno.ts)
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia… y después la adaptación con Maco» y «Después seguí con la segunda hoja, de a
// una». La hoja la dibuja app/dashboard/disenos/HojaMarketing.tsx con lo que arma `vistaMarketing` de las piezas de la hoja.
// Estos tests EJECUTAN esas funciones con datos armados acá (ficticios) y miran lo que sale; sólo el último lee el fuente (el
// cableado).
//
// Probado rompiéndolo (4/11/2026), cada rotura sola y la base en verde antes: ver el pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Resultado } from '../lib/graficos-agregar';
import {
  cambioDe, embudoDe, fraseMarketing, numeroDe, pasoDe, pestanasDe, plata, redesDe, tendenciasDe, veredictoDe, vistaMarketing,
} from '../lib/marketing-diseno';
import { datosMarketingMuestra } from '../lib/marketing-diseno-muestra';
import { DISENOS_HOJA } from '../lib/graficos-catalogo';
import { PLANTILLAS_HOJA, PLANTILLAS_OFRECIDAS, instanciarPlantilla } from '../lib/graficos-plantillas';
import { cableadoDelDiseno } from './_diseno-cableado';

const leer = (r: string) => readFileSync(fileURLToPath(new URL(`../${r}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

const HOY = '2026-11-04';
const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const res = (ids: string[], totales: Array<number | null>, extra: Partial<Resultado> = {}): Resultado =>
  ({ columnas: col(ids), filas: [], totales, fuera: 0, clase: null, ...extra }) as Resultado;
const texto = (t: Array<{ s: string }>) => t.map((x) => x.s).join('');
const dias = (n: number, f: (i: number) => [number, number, number]): Resultado => res(['gasto', 'leads', 'agendas'], [], {
  clase: 'tiempo',
  filas: Array.from({ length: n }, (_, i) => { const d = new Date('2026-10-01T12:00:00Z'); d.setUTCDate(d.getUTCDate() + i); return { clave: d.toISOString().slice(0, 10), etiqueta: '', valores: f(i) }; }),
});

test('la frase: lo gastado, lo que trajo y lo que costó cada agenda; sin «0» inventados', () => {
  assert.equal(texto(fraseMarketing(2460, 27, 91.11)), 'Gastaste US$2,460 en anuncios, trajeron 27 agendas y cada una costó US$91.11.');
  assert.equal(texto(fraseMarketing(83.4, 27, null)), 'Gastaste US$83 en anuncios y trajeron 27 agendas.', 'lo gastado, sin centavos');
  assert.equal(texto(fraseMarketing(800, 0, null)), 'Gastaste US$800 en anuncios y no trajeron agendas.');
  assert.equal(texto(fraseMarketing(null, 1, null)), 'Llegaron 1 agenda.');
  assert.deepEqual(fraseMarketing(null, null, null), []);
  // Sin pauta (ws 3, 10/11/2026): cero invertido no «trajo» nada ni costó US$0.00 cada una.
  assert.equal(texto(fraseMarketing(0, 3, 0)), 'Llegaron 3 agendas.', 'cero gastado se dice como sin gasto');
  assert.equal(texto(fraseMarketing(0, 0, null)), 'No llegaron agendas.');
});

test('los seis números: cada cambio en SU unidad, y bueno o malo según la métrica', () => {
  assert.equal(cambioDe('plata', 91.11, 95.31)?.texto, '−US$4.20');
  assert.equal(cambioDe('veces', 3.4, 3.1)?.texto, '+0.3×');
  assert.equal(cambioDe('pct', 27, 24.8)?.texto, '+9%');
  assert.equal(cambioDe('puntos', 2.8, 3.0)?.texto, '−0.2 pt');
  assert.equal(cambioDe('pct', 5, 0), null, 'contra cero no hay porcentaje');
  const cpa = numeroDe('cpa', res(['cpa'], [91.11], { anterior: [95.31] }));
  assert.deepEqual([cpa.texto, cpa.cambio, cpa.sube, cpa.bueno], ['US$91.11', '−US$4.20', false, true], 'el costo que BAJA es bueno');
  const ctr = numeroDe('ctr', res(['ctr'], [2.8], { anterior: [3.0] }));
  assert.deepEqual([ctr.texto, ctr.sube, ctr.bueno], ['2.8%', false, false], 'el CTR que baja es malo');
  const gasto = numeroDe('gasto', res(['gasto'], [2460], { anterior: [2299] }));
  assert.deepEqual([gasto.texto, gasto.cambio, gasto.sube, gasto.bueno], ['US$2,460', '+7%', true, null], 'gastar más no es bueno ni malo, solo');
  // Lo que no llegó es null: ni un «0» ni un cambio.
  const nada = numeroDe('agendas', null);
  assert.deepEqual([nada.valor, nada.texto, nada.cambio], [null, null, null]);
  assert.equal(numeroDe('cpl', res(['cpl'], [14.73])).cambio, null, 'sin el período anterior no hay cambio');
});

test('las tendencias: de a 7 días contra la primera semana, y sin base no se indexa', () => {
  const t = tendenciasDe(dias(28, (i) => [100, 10, i < 7 ? 0 : 2]))!;
  assert.equal(t.paso, 'dia');
  assert.equal(t.ventana, 7);
  assert.deepEqual(t.series.map((s) => s.id), ['gasto', 'leads'], 'las agendas no tienen base: la primera semana tuvo cero');
  assert.deepEqual(t.sinBase, ['Agendas']);
  assert.equal(t.series[0].pct[5], null, 'antes de juntar 7 días no hay punto');
  assert.equal(t.series[0].pct[6], 0, 'la primera ventana es el cero');
  assert.equal(t.series[0].fin, 0);
  const sube = tendenciasDe(dias(28, (i) => [i < 7 ? 100 : 150, 10, 2]))!;
  assert.equal(sube.series[0].fin, 50, 'el gasto subió 50% contra la primera semana');
  assert.equal(sube.tope, 50, 'el eje se ajusta al mayor movimiento');
  // Con pocas filas (un período corto) se compara de a una.
  assert.equal(tendenciasDe(dias(10, () => [1, 1, 1]))!.ventana, 1);
  assert.equal(pasoDe(['2026-10-05', '2026-10-12']), 'semana');
  assert.equal(pasoDe(['2026-09-01', '2026-10-01']), 'mes');
  assert.equal(tendenciasDe(null), null);
});

test('el costo por agenda contra el promedio: barata, en el promedio, cara, y sin agendas es lo peor', () => {
  assert.equal(veredictoDe(612, 9, 68, 91.11).v, 'barata');
  assert.equal(veredictoDe(488, 6, 81.33, 91.11).v, 'media');
  assert.equal(veredictoDe(318, 2, 159, 91.11).v, 'cara');
  assert.equal(veredictoDe(83, 0, null, 91.11).v, 'sin-agendas');
  assert.equal(veredictoDe(83, 0, null, 91.11).porque, 'Gastó US$83 y no trajo agendas');
  assert.equal(veredictoDe(0, 0, null, 91.11).v, null, 'sin gasto no hay nada que marcar');
  assert.equal(veredictoDe(100, 2, 50, null).v, 'media', 'sin promedio no se marca barata ni cara');
});

test('las pestañas: por anuncio (con su campaña), por campaña (con cuántos anuncios) y día por día (el de hoy primero)', () => {
  const anuncios = res(['agendas', 'gasto', 'leads', 'cpa'], [12, 1000, 50, 83.33], {
    clase: 'categoria',
    filas: [{ clave: 'a1', etiqueta: 'Reel', ref: 'a1', extra: { campana: 'Otoño' }, valores: [10, 600, 40, 60] }, { clave: 'a2', etiqueta: 'Imagen', valores: [0, 400, 10, null] }],
  });
  const campanas = res(['agendas', 'gasto', 'leads', 'cpa', 'anuncios'], [12, 1000, 50, 83.33, 2], { clase: 'categoria', filas: [{ clave: 'Otoño', etiqueta: 'Otoño', valores: [12, 1000, 50, 83.33, 2] }] });
  const t = tendenciasDe(dias(35, (i) => [10, 1, i === 34 ? 1 : 0]));
  const hoy = t!.filas[34].clave;
  const [pa, pc, pt] = pestanasDe(anuncios, campanas, t, hoy);
  assert.deepEqual(pa.filas.map((f) => [f.nombre, f.segunda, f.veredicto, f.abre]), [['Reel', 'Otoño', 'barata', true], ['Imagen', null, 'sin-agendas', false]]);
  assert.equal(pc.filas[0].segunda, '2 anuncios');
  assert.equal(pt.nombre, 'Día por día');
  assert.equal(pt.filas.length, 10, 'hasta 10, como Kestrel');
  assert.deepEqual([pt.filas[0].nombre, pt.filas[0].hoy], ['Hoy', true], 'la más nueva primero, y la de hoy se llama «Hoy»');
  // Sin la pieza, lo dicen (no una tabla vacía muda).
  assert.equal(pestanasDe(null, null, null, HOY)[0].vacio, 'No pude leer los anuncios de Meta.');
});

test('lo que trae la pauta: impresiones y clics con su cambio, cuántos llegan a la página y los que más agendas trajeron', () => {
  const funnel = res(['impresiones', 'clics', 'vistas_landing', 'vistas_vsl', 'leads', 'agendas'], [48210, 1356, 1003, 412, 167, 27], { anterior: [45110, 1264, 902, 380, 151, 25] });
  const anuncios = res(['agendas', 'gasto'], [], { clase: 'categoria', filas: [{ clave: 'a1', etiqueta: 'Video testimonio', valores: [9, 600], imagen: 'https://x/y.jpg' }, { clave: 'a2', etiqueta: 'Sin agendas', valores: [0, 80] }] });
  const e = embudoDe(funnel, anuncios)!;
  assert.deepEqual([e.impresiones.cambio, e.clics.cambio, e.llega], ['+3,100', '+92', 74]);
  assert.deepEqual(e.filas.map((f) => f.valor), [1003, 412, 167, 27]);
  assert.deepEqual(e.mosaico.map((m) => [m.nombre, m.agendas, m.imagen, m.iniciales]), [['Video testimonio', 9, 'https://x/y.jpg', 'VT']], 'sólo los que trajeron agendas');
  assert.equal(embudoDe(res(['impresiones', 'clics'], [100, 0]), null)!.llega, null, 'sin clics no hay anillo');
  assert.equal(embudoDe(null, null), null);
});

test('qué red trae agendas: las de Meta, con sus totales', () => {
  const r = redesDe(res(['agendas', 'impresiones', 'ctr', 'cpm'], [27, 48210, 2.81, 51.03], { clase: 'categoria', filas: [{ clave: 'ig', etiqueta: 'Instagram', valores: [16, null, null, null] }] }))!;
  assert.deepEqual([r.agendas, r.redes[0].nombre, r.redes[0].agendas], [27, 'Instagram', 16]);
  assert.deepEqual(r.filas.map((f) => f.texto), ['48,210', '2.8%', 'US$51.03']);
  assert.equal(redesDe(null), null);
});

test('la plata: con centavos debajo de US$100, sin centavos arriba', () => {
  assert.equal(plata(14.4), 'US$14.40');
  assert.equal(plata(2460), 'US$2,460');
  assert.equal(plata(-4.2), '−US$4.20');
});

test('la plantilla trae el diseño, la muestra pasa por el mismo modelo, y el editor lo dibuja', () => {
  assert.ok((DISENOS_HOJA as readonly string[]).includes('marketing'));
  const pl = PLANTILLAS_HOJA.find((x) => x.id === 'marketing')!;
  assert.ok(PLANTILLAS_OFRECIDAS.some((x) => x.id === 'marketing'), '«Nueva hoja» la ofrece: ya trae su diseño copiado');
  const h = instanciarPlantilla(pl);
  assert.equal(h.diseno?.id, 'marketing');
  const pieza = (k: string) => h.componentes.find((c) => c.id === h.diseno!.piezas[k]) as { metricas?: string[]; comparar?: boolean; fuente?: string } | undefined;
  for (const k of ['apertura', 'cpa', 'roas', 'agendas', 'gasto', 'ctr', 'cpl', 'tendencias', 'funnel', 'plataforma', 'campanas', 'anuncios']) assert.ok(pieza(k), `la pieza ${k}`);
  for (const k of ['cpa', 'roas', 'agendas', 'gasto', 'ctr', 'cpl']) assert.equal(pieza(k)?.comparar, true, `${k} se compara con el período anterior`);
  assert.deepEqual(pieza('tendencias')?.metricas, ['gasto', 'leads', 'agendas']);
  assert.deepEqual(pieza('funnel')?.metricas, ['impresiones', 'clics', 'vistas_landing', 'vistas_vsl', 'leads', 'agendas']);
  // La muestra (la miniatura de «Nueva hoja») arma la vista entera con el modelo de verdad.
  const v = vistaMarketing(h, datosMarketingMuestra(h, HOY), HOY);
  assert.equal(texto(v.frase), 'Gastaste US$2,460 en anuncios, trajeron 27 agendas y cada una costó US$91.11.');
  assert.deepEqual(v.numeros.map((n) => n.texto), ['US$91.11', '3.4×', '27', 'US$2,460', '2.8%', 'US$14.73']);
  assert.equal(v.pestanas[0].filas.length, 10);
  assert.equal(v.embudo?.llega, 74);
  cableadoDelDiseno(h, 'marketing', 'MarketingVivo', ['extras={extras?.marketing ?? null}']);
  assert.ok(leer('app/dashboard/page.tsx').includes('marketing: hayDisenoMarketing ? { quien } : null'));
});

// Probado rompiéndolo (4/11/2026), cada rotura sola y la base en verde antes (9 de 9):
//   · el costo que BAJA pintado como malo: 1 fallo, 8 pases;
//   · un número que no llegó como 0 (`?? 0`): 1 fallo, 8 pases;
//   · una serie sin base (la primera semana en cero) indexada igual: 1 fallo, 8 pases;
//   · gastar sin agendas sin marcar: 2 fallos, 7 pases;
//   · día por día de la más vieja a la más nueva: 1 fallo, 8 pases;
//   · los anuncios sin agendas en «Los que más agendas trajeron»: 1 fallo, 8 pases.
