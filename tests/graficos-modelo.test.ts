// Tests del modelo v3 del Dashboard (feedback de Martín del 11/10/2026): las hojas con su tema y sus
// controles, la precedencia de los filtros («que no se pisen sin sentido», punto 13), los campos que
// cruzan de conjunto, el filtro en el agregador, la migración de lo guardado y los temas por página.
// Correr: node --import tsx --test tests/graficos-modelo.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPOS, ENTIDADES, campoDe, destinoDetalle, efectivoDe, fuenteDe, hojaVacia, sanearControles, sanearElemento, sanearGrafico, sanearHoja, sanearTablero,
  type ControlVista, type Grafico, type Hoja,
} from '../lib/graficos-catalogo';
import { filtrarFilas, agregar, SIN_DATO, type Fila } from '../lib/graficos-agregar';
import { PLANTILLAS_TEMA, sanearTema, estiloEfectivo, paletaDe, varsDeTema } from '../lib/graficos-temas';
import { instanciarPlantilla, PLANTILLAS_HOJA, tableroInicial } from '../lib/graficos-plantillas';

const HOY = '2026-10-11';
const g = (r: Record<string, unknown>): Grafico => sanearGrafico({ id: 'g1', ...r })!;
const control = (r: Partial<ControlVista> & { id: string; tipo: ControlVista['tipo'] }): ControlVista =>
  sanearControles([{ campo: null, preset: 'ult30', valores: null, texto: '', agrupar: 'auto', ...r }])[0];
const hoja = (componentes: Grafico[], controles: ControlVista[]): Hoja => hojaVacia('H', { componentes, controles });

test('un informe del v2 se migra: el control de la grilla pasa a la barra y el contenido de «estilo» sube al gráfico', () => {
  const v2 = {
    v: 2, nombre: 'Dashboard',
    hojas: [{
      id: 'marketing', nombre: 'Marketing',
      componentes: [
        { id: 'k1', clase: 'grafico', tipo: 'numero', fuente: 'negocio', metricas: ['gasto'], estilo: { comparar: true, subtitulo: 'contra antes', colores: ['#000000'], fondo: '#123456' } },
        { id: 'c1', clase: 'control', tipo: 'periodo', preset: 'ult7', x: 0, y: 9, w: 4, h: 2 },
      ],
    }],
  };
  const t = sanearTablero(v2)!;
  const h = t.hojas[0];
  assert.equal(t.v, 3);
  assert.equal(h.componentes.length, 1, 'el control ya no es un componente de la grilla');
  assert.deepEqual(h.controles.map((c) => [c.tipo, c.preset]), [['periodo', 'ult7']]);
  const k = h.componentes[0] as Grafico;
  assert.equal(k.comparar, true);
  assert.equal(k.subtitulo, 'contra antes');
  assert.equal((k as unknown as { estilo?: unknown }).estilo, undefined, 'el estilo por gráfico no sobrevive al guardado');
  assert.equal(h.tema.plantilla, 'mako');
});

test('uno por cosa: un período, un «agrupar por» y un control por campo', () => {
  const cs = sanearControles([
    { id: 'a', tipo: 'periodo' }, { id: 'b', tipo: 'periodo', preset: 'ult7' },
    { id: 'c', tipo: 'lista', campo: 'campana' }, { id: 'd', tipo: 'texto', campo: 'campana' },
    { id: 'e', tipo: 'lista', campo: 'no-existe' }, { id: 'f', tipo: 'lista' },
    { id: 'g', tipo: 'agrupar' }, { id: 'h', tipo: 'agrupar' },
  ]);
  assert.deepEqual(cs.map((c) => c.id), ['a', 'c', 'g'], 'el segundo de cada cosa sería decorativo; sin campo no filtra nada');
  assert.equal(control({ id: 'x', tipo: 'lista', campo: 'campana', valores: [] }).valores, null, '«todos» es null, nunca []');
});

test('los campos que cruzan de conjunto son SÓLO los declarados: «estado» no cruza', () => {
  assert.deepEqual(Object.keys(campoDe('campana')!.en).sort(), ['guiones', 'leads', 'meta']);
  assert.equal(campoDe('estado'), undefined, 'estado significa diez cosas en diez conjuntos');
  assert.ok(campoDe('pagos.estado'), 'cada conjunto tiene su propio «Estado»');
  const ids = CAMPOS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'sin campos repetidos');
});

test('precedencia: el control del gráfico REEMPLAZA al de la hoja en ese campo; campos distintos se suman con Y', () => {
  const pagina = [
    control({ id: 'p-per', tipo: 'periodo', preset: 'ult7' }),
    control({ id: 'p-camp', tipo: 'lista', campo: 'campana', valores: ['A'] }),
    control({ id: 'p-closer', tipo: 'lista', campo: 'closer', valores: ['Ana'] }),
  ];
  const leads = g({ tipo: 'tabla', fuente: 'leads', dimension: 'etapa' });
  const h = hoja([leads], pagina);
  const e1 = efectivoDe(leads, h, {}, HOY);
  assert.deepEqual(e1.filtros, [{ dimension: 'campana', valores: ['A'] }, { dimension: 'closer', valores: ['Ana'] }]);
  assert.equal(e1.desde, '2026-10-05');

  const propio = { ...leads, controles: [control({ id: 'g-camp', tipo: 'lista', campo: 'campana', valores: ['B'] })] };
  const e2 = efectivoDe(propio, h, {}, HOY);
  assert.deepEqual(e2.filtros, [{ dimension: 'campana', valores: ['B'] }, { dimension: 'closer', valores: ['Ana'] }], 'reemplaza, no intersecta (A∩B daría cero)');
  assert.deepEqual(e2.propio.campos, ['campana']);

  const todos = { ...leads, controles: [control({ id: 'g-camp', tipo: 'lista', campo: 'campana', valores: null })] };
  assert.deepEqual(efectivoDe(todos, h, {}, HOY).filtros, [{ dimension: 'closer', valores: ['Ana'] }], '«todos» en la tarjeta es decidir no filtrar por eso');

  // Lo que se eligió MIRANDO gana sobre lo de entrada, sin tocar el informe.
  const e3 = efectivoDe(leads, h, { 'p-camp': { valores: ['C', 'D'] }, 'p-per': { preset: 'ayer' } }, HOY);
  assert.deepEqual(e3.filtros[0], { dimension: 'campana', valores: ['C', 'D'] });
  assert.deepEqual([e3.desde, e3.hasta], ['2026-10-10', '2026-10-10']);
});

test('un filtro que el conjunto no puede aplicar no se aplica: se avisa', () => {
  const kpi = g({ tipo: 'numero', fuente: 'negocio', metricas: ['gasto'] });
  const h = hoja([kpi], [control({ id: 'p-camp', tipo: 'lista', campo: 'campana', valores: ['A'] })]);
  const e = efectivoDe(kpi, h, {}, HOY);
  assert.deepEqual(e.filtros, []);
  assert.deepEqual(e.noAplica, ['Campaña'], 'la tarjeta tiene que decir que NO está filtrada');
});

test('período: el control del gráfico > su período propio > el control de la hoja > 30 días', () => {
  const base = g({ tipo: 'numero', fuente: 'leads' });
  const h = hoja([base], [control({ id: 'p', tipo: 'periodo', preset: 'ult7' })]);
  assert.equal(efectivoDe(base, h, {}, HOY).desde, '2026-10-05');
  assert.equal(efectivoDe({ ...base, periodo: 'ayer' }, h, {}, HOY).desde, '2026-10-10');
  const conControl = { ...base, periodo: 'ayer' as const, controles: [control({ id: 'gp', tipo: 'periodo', preset: 'ult14' })] };
  assert.equal(efectivoDe(conControl, h, {}, HOY).desde, '2026-09-28');
  assert.equal(efectivoDe(base, hoja([base], []), {}, HOY).desde, '2026-09-12');
});

test('agrupar por: sólo a la dimensión de TIEMPO, y «automático» según el largo del período', () => {
  const serie = g({ tipo: 'serie', fuente: 'negocio', dimension: 'dia' });
  const tabla = g({ tipo: 'tabla', fuente: 'leads', dimension: 'etapa' });
  const pag = (preset: string) => [control({ id: 'p', tipo: 'periodo', preset: preset as never }), control({ id: 'a', tipo: 'agrupar', agrupar: 'auto' })];
  assert.equal(efectivoDe(serie, hoja([serie], pag('ult30')), {}, HOY).agrupar, 'dia');
  assert.equal(efectivoDe(serie, hoja([serie], pag('ult90')), {}, HOY).agrupar, 'semana');
  assert.equal(efectivoDe(serie, hoja([serie], pag('este_anio')), {}, HOY).agrupar, 'mes');
  assert.equal(efectivoDe(tabla, hoja([tabla], pag('ult30')), {}, HOY).agrupar, null, 'a una categoría no se la agrupa por tiempo');
});

test('filtrarFilas: la misma normalización que agrupa, búsqueda sin acentos, y la lista vacía no filtra', () => {
  const filas: Fila[] = [
    { f: '2026-10-01', d: { campana: ' Verano ' }, v: { leads: 1 } },
    { f: '2026-10-01', d: { campana: null }, v: { leads: 1 } },
    { f: '2026-10-01', d: { campana: 'Promoción' }, v: { leads: 1 } },
  ];
  assert.equal(filtrarFilas(filas, [{ dimension: 'campana', valores: ['Verano'] }]).length, 1, 'con espacios alrededor también');
  assert.equal(filtrarFilas(filas, [{ dimension: 'campana', valores: [SIN_DATO] }]).length, 1, '«(sin dato)» se puede elegir');
  assert.equal(filtrarFilas(filas, [{ dimension: 'campana', texto: 'promo' }]).length, 1, 'sin mayúsculas ni acentos');
  assert.equal(filtrarFilas(filas, [{ dimension: 'campana', valores: [] }]).length, 3, 'una lista vacía no filtra');
});

test('el alcance no tiene total (la misma persona en dos plataformas se contaría dos veces)', () => {
  const graf = g({ tipo: 'barras', fuente: 'audiencia', dimension: 'plataforma', metricas: ['impresiones', 'alcance'] });
  const filas: Fila[] = [
    { f: '2026-10-01', d: { plataforma: 'Facebook' }, v: { impresiones: 10, alcance: 5 } },
    { f: '2026-10-01', d: { plataforma: 'Instagram' }, v: { impresiones: 20, alcance: 8 } },
  ];
  const r = agregar(graf, filas, '2026-10-01', '2026-10-31');
  assert.deepEqual(r.totales, [30, null]);
});

test('una imagen sólo con https, y un elemento nuevo trae todo lo suyo', () => {
  assert.equal(sanearElemento({ tipo: 'imagen', url: 'javascript:alert(1)' })!.url, '');
  assert.equal(sanearElemento({ tipo: 'imagen', url: 'data:image/png;base64,AAAA' })!.url, '');
  assert.equal(sanearElemento({ tipo: 'imagen', url: 'https://ejemplo.com/a.png' })!.url, 'https://ejemplo.com/a.png');
  assert.equal(sanearElemento({ tipo: 'no-existe' }), null);
});

// La hoja Closing (decisión 6 de Martín, 11/10/2026): lo que el catálogo le pone a las llamadas para que el
// Dashboard tenga lo de la tab. Probado ROMPIÉNDOLO (11/10/2026, base 14 / 0 en este archivo; arnés del
// paquete P1, cada rotura restaurada de memoria y verificada por hash): `estado` fuera de `llamadas` → 13 / 1
// (este); `llamadas_venta` fuera de ENTIDADES → 13 / 1 (este); `destinoDetalle` de vuelta a FUENTES_BASE →
// 13 / 1 (este: la entidad quedaba declarada y su número no se abría). Al final, 14 / 0.
test('la hoja Closing: las llamadas tienen su estado, y el número de una llamada de VENTA abre su lista', () => {
  assert.ok(fuenteDe('llamadas')!.dimensiones.some((d) => d.id === 'estado' && d.clase === 'categoria'), 'llamadas.estado');
  assert.deepEqual(campoDe('llamadas.estado')?.en, { llamadas: 'estado' }, '«Estado» de las llamadas es SU estado: no cruza');
  // La misma forma que `llamadas` (la ficha de la llamada y la del lead, desde la misma fila).
  assert.deepEqual(ENTIDADES.llamadas_venta, ENTIDADES.llamadas);
  assert.deepEqual(ENTIDADES.llamadas_venta, {
    entidad: 'llamada', plural: 'Llamadas', ref: 'llamada', nombre: ['llamada'], linea: ['closer', 'reunion'], ids: { llamada: 'llamada', lead: 'lead' }, unidad: ['llamadas', 'con_puntaje'],
  });
  // Un conjunto de las tabs de Analysts (lib/graficos-fuentes-extra.ts) con entidad SÍ abre su detalle: hasta el
  // 11/10 se buscaba sólo entre los de siempre y la entidad quedaba declarada sin poder abrirse nunca.
  assert.deepEqual(destinoDetalle('llamadas_venta', 'fecha', 'puntaje'), { fuente: 'llamadas_venta', fecha: 'fecha', incluye: 'puntaje', columnas: ['puntaje', 'puntos'] });
  assert.deepEqual(destinoDetalle('llamadas_venta', 'fecha', 'llamadas')?.columnas, [], 'una llamada vale 1: no es una columna');
  // v5 (12/10/2026): los factores del cierre SÍ abren sus llamadas (contrato: ENTIDADES de llamadas_dimensiones).
  assert.deepEqual(destinoDetalle('llamadas_dimensiones', 'fecha', 'puntaje'), { fuente: 'llamadas_dimensiones', fecha: 'fecha', incluye: 'puntaje', columnas: ['puntaje', 'puntos'] });
  assert.equal(destinoDetalle('visitas', 'fecha', 'visitas'), null, 'sin entidad, no lista');
  assert.equal(destinoDetalle('llamadas_venta', 'inventada', 'puntaje'), null);
});

test('una hoja guarda emoji, subtítulo, tema y controles (lo que no se sanea, se borra en el primer guardado)', () => {
  const h = sanearHoja({ id: 'x', nombre: 'Ventas', emoji: '💰', subtitulo: 'Lo del mes', tema: { plantilla: 'suave', acento: '#ABCDEF', fuente: 'lora' }, controles: [{ id: 'p', tipo: 'periodo' }] }, 0)!;
  assert.equal(h.emoji, '💰');
  assert.equal(h.subtitulo, 'Lo del mes');
  assert.deepEqual(h.tema, { plantilla: 'suave', acento: '#abcdef', fuente: 'lora' });
  assert.equal(h.controles.length, 1);
});

test('temas: un id roto cae a MaKo, y cada color de serie se lee sobre la superficie clara y la oscura', () => {
  assert.deepEqual(sanearTema({ plantilla: 'inventada', acento: 'red', fuente: '<script>' }), { plantilla: 'mako', acento: null, fuente: null });
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const contraste = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  for (const p of PLANTILLAS_TEMA) {
    assert.equal(p.paleta.length, 8, p.id);
    for (const col of p.paleta) {
      // 2:1 sobre las dos superficies: un trazo o una barra (no un texto) se distingue del fondo.
      assert.ok(contraste(col, '#FFFFFF') >= 2, `${p.id} ${col} sobre claro: ${contraste(col, '#FFFFFF').toFixed(2)}`);
      assert.ok(contraste(col, '#2A2F39') >= 2, `${p.id} ${col} sobre oscuro: ${contraste(col, '#2A2F39').toFixed(2)}`);
    }
    // La tarjeta va con TOKENS: nada en hex que no se dé vuelta en oscuro.
    const vars = varsDeTema({ plantilla: p.id, acento: null, fuente: null });
    for (const k of ['--dash-tarjeta-fondo', '--dash-tarjeta-borde']) assert.ok(!/#[0-9a-f]{3,6}/i.test(vars[k]), `${p.id} ${k} = ${vars[k]}`);
  }
  assert.equal(paletaDe({ plantilla: 'mako', acento: '#111111', fuente: null })[0], '#111111', 'el acento elegido va primero');
  assert.equal(estiloEfectivo({ plantilla: 'contraste', acento: null, fuente: null }).etiquetas, true);
});

test('una plantilla de la galería sale con ids NUEVOS cada vez (se puede agregar dos veces)', () => {
  for (const p of PLANTILLAS_HOJA) {
    const a = instanciarPlantilla(p);
    const b = instanciarPlantilla(p);
    assert.notEqual(a.id, b.id, p.id);
    const ids = new Set(a.componentes.map((c) => c.id));
    for (const c of b.componentes) assert.ok(!ids.has(c.id), `${p.id}: ${c.id} repetido`);
    assert.ok(a.componentes.length > 0, p.id);
  }
  assert.deepEqual(tableroInicial().hojas.map((h) => h.id), ['marketing', 'comercial'], 'el inicial con sus ids fijos');
});
