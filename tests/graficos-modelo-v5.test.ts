// Tests del MODELO v5 del Dashboard (12/10/2026, contrato docs/relevo/dashboard-v5.md, «El MODELO»): las
// fechas que miran hacia adelante y los presets nuevos, el filtro de DEFINICIÓN (`fijo`), el período propio
// migrado a un control fijo con el MISMO número, los campos nuevos de un gráfico con su saneo, los tipos y los
// elementos nuevos, la hoja (plantilla y conectores), los campos compartidos, las entidades, la lista positiva
// de lo que viaja a la IA y el autoguardado con versión.
// Correr: npx tsx --test tests/graficos-modelo-v5.test.ts
//
// Probado ROMPIÉNDOLO (12/10/2026, base 13 / 0; arnés del scratchpad del paquete P1, cada rotura restaurada
// DE MEMORIA y verificada por hash; los números, abajo de cada test que la caza).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CAMPOS, COMPARTIDOS_DECLARADOS, ENTIDADES, FUENTES, MAX_CONECTORES, MAX_CONTROLES, MAX_IA_POR_HOJA, MAX_POPUP, PRESETS, TIPOS_ELEMENTO,
  campoDe, conVista, destinoDetalle, efectivoDe, fuenteDe, hastaDe, hojaVacia, metricasPara, nuevoGrafico, rangoDe,
  sanearControlVista, sanearElemento, sanearGrafico, sanearHoja, tipoDe,
  type ControlVista, type Grafico, type Hoja, type Preset, type VistaValores,
} from '../lib/graficos-catalogo';
import { campoDeDimension, controlesQueSeVen, distintoDeEntrada, hayVistaElegida, nuevoControlPara } from '../lib/graficos-controles-texto';
import { DIMENSIONES_PUBLICAS, dimensionPublica } from '../lib/graficos-analisis';

const HOY = '2026-10-11';
const g = (r: Record<string, unknown>): Grafico => sanearGrafico({ id: 'g1', ...r })!;
const ctl = (r: Record<string, unknown>): ControlVista => sanearControlVista({ preset: 'ult30', ...r })!;
const hoja = (componentes: Hoja['componentes'], controles: ControlVista[] = []): Hoja => hojaVacia('H', { componentes, controles });

// Rotura: `futuro` fuera de pagos.vencimiento → 12 / 1 (éste). `hastaDe` cortando siempre en hoy → 12 / 1 (éste).
// `prox30` hasta hoy+30 → 12 / 1 (éste).
test('fechas que miran hacia adelante: el vencimiento no se corta en hoy, y los presets nuevos', () => {
  const pagos = fuenteDe('pagos')!;
  assert.equal(pagos.fechas.find((f) => f.id === 'vencimiento')?.futuro, true, 'lo que vence este mes no termina hoy');
  assert.equal(pagos.fechas.find((f) => f.id === 'pago')?.futuro, undefined, 'lo cobrado sí termina hoy');
  assert.ok(PRESETS.some((p) => p.id === 'este_mes_completo' && p.nombre === 'Este mes completo'));
  assert.ok(PRESETS.some((p) => p.id === 'prox30' && p.nombre === 'Próximos 30 días'));
  assert.deepEqual(rangoDe('este_mes_completo', HOY), { desde: '2026-10-01', hasta: '2026-10-31' });
  assert.deepEqual(rangoDe('este_mes_completo', '2028-02-10'), { desde: '2028-02-01', hasta: '2028-02-29' }, 'febrero bisiesto');
  assert.deepEqual(rangoDe('prox30', HOY), { desde: '2026-10-11', hasta: '2026-11-09' }, 'treinta días contando hoy, como «Últimos 30»');
  // El corte en hoy, en UN lugar: respeta `futuro`.
  assert.equal(hastaDe('pagos', 'vencimiento', '2026-10-01', '2026-10-31', HOY), '2026-10-31');
  assert.equal(hastaDe('pagos', 'pago', '2026-10-01', '2026-10-31', HOY), HOY);
  assert.equal(hastaDe('leads', 'alta', '2026-10-01', '2026-10-05', HOY), '2026-10-05', 'lo que termina antes de hoy no se toca');
  assert.equal(hastaDe('leads', 'alta', '2026-10-20', '2026-11-18', HOY), '2026-10-20', 'un período que empieza después de hoy no se invierte');
});

// Rotura: sacar `menos` del CAC → 12 / 1 (éste). `minimo` del ciclo en 2 → 12 / 1 (éste). El P90 sin excluir de
// `metricasPara` → 12 / 1 (éste).
test('métricas y dimensiones: menos es mejor, el mínimo de una razón, el percentil, el orden fijo y los colores', () => {
  const neg = fuenteDe('negocio')!;
  const mejor = (f: string, id: string) => fuenteDe(f)!.metricas.find((m) => m.id === id)?.mejor;
  for (const id of ['cac', 'cpl', 'cpa', 'cpm', 'cpc', 'costo_landing', 'costo_vsl']) assert.equal(mejor('negocio', id), 'menos', `negocio.${id}`);
  for (const id of ['costo_landing', 'cpc', 'cpm', 'cpl', 'cpa']) assert.equal(mejor('meta', id), 'menos', `meta.${id}`);
  for (const id of ['roas_cobrado', 'roas_vendido', 'cobrado', 'gasto']) assert.equal(mejor('negocio', id), undefined, `negocio.${id} no es un costo`);
  assert.equal(mejor('leads', 'tasa_no_show'), 'menos');
  assert.ok(neg.metricas.length > 0);

  const leads = fuenteDe('leads')!;
  const met = (id: string) => leads.metricas.find((m) => m.id === id)!;
  assert.equal(met('ciclo').razon?.minimo, 3, 'el SCL con menos de 3 casos dice «—»');
  assert.deepEqual(met('tasa_cierre_calificadas').razon, { num: 'cierres', den: 'limpias', factor: 100, minimo: 3 });
  assert.deepEqual(met('ciclo_cierre').razon?.num, 'dias_ciclo_cierre');
  assert.deepEqual(met('p90_ciclo').percentil, { de: 'ciclo', p: 90 });
  for (const n of [1, 2, 3, 4, 5]) assert.deepEqual(met(`tramo_${n}`).razon, { num: `dias_t${n}`, den: `con_t${n}`, factor: 1 });
  assert.ok(!metricasPara(leads, 'embudo').some((m) => m.id === 'p90_ciclo'), 'un percentil no se suma: fuera de un embudo');
  assert.ok(metricasPara(leads, 'numero').some((m) => m.id === 'p90_ciclo'));

  // En TODOS los conjuntos: la base de un percentil existe y tiene valor por fila; un mínimo es un entero positivo;
  // un color es un token de la casa y nombra un valor de la lista.
  for (const f of FUENTES) {
    for (const m of f.metricas) {
      if (m.percentil) {
        const de = f.metricas.find((x) => x.id === m.percentil!.de);
        assert.ok(de && !de.distinto && !de.percentil, `${f.id}.${m.id}: el percentil sale de ${m.percentil.de}`);
        assert.ok(m.percentil.p >= 1 && m.percentil.p <= 99, `${f.id}.${m.id}`);
      }
      if (m.razon?.minimo !== undefined) assert.ok(Number.isInteger(m.razon.minimo) && m.razon.minimo > 0, `${f.id}.${m.id}`);
    }
    for (const d of f.dimensiones) {
      for (const [v, c] of Object.entries(d.colores ?? {})) {
        assert.match(c, /^var\(--[a-z0-9-]+\)$/, `${f.id}.${d.id}: «${c}» no es un token`);
        if (d.valores) assert.ok(d.valores.includes(v), `${f.id}.${d.id}: el color de «${v}» nombra un valor que no está`);
      }
    }
  }
  assert.deepEqual(leads.dimensiones.find((d) => d.id === 'madurez_semana')?.valores, ['Madura', 'Madurando', 'Reciente']);
});

// Rotura: `conVista` sin la salida del fijo → 11 / 2 (éste y «el período propio…»: la vista movía el período).
// `sanearControlVista` sin copiar `fijo` → 11 / 2 (los mismos dos). Que `distintoDeEntrada` y `hayVistaElegida`
// ignoren el fijo NO tiene una línea propia que romper: lo decide `conVista` (un solo lugar), y una guarda
// repetida ahí dio 13 / 0 al romperla, así que se sacó.
test('el filtro de DEFINICIÓN (fijo): decide igual, la vista no lo mueve, no se dibuja y no cuenta para «Restablecer»', () => {
  const fijo = ctl({ id: 'k', tipo: 'lista', campo: 'llamadas_venta.reunion', valores: ['R1'], fijo: true });
  const libre = ctl({ id: 'k', tipo: 'lista', campo: 'llamadas_venta.reunion', valores: ['R1'] });
  assert.equal(fijo.fijo, true);
  assert.equal('fijo' in libre, false, 'un control para mirar guarda lo mismo que antes de v5');
  assert.equal('fijo' in ctl({ id: 'k', tipo: 'periodo', fijo: 'sí' }), false, 'sólo `true` es fijo');

  const kpi = (c: ControlVista) => g({ tipo: 'numero', fuente: 'llamadas_venta', metricas: ['puntaje'], controles: [c] });
  const h = (c: ControlVista) => hoja([kpi(c)]);
  assert.deepEqual(efectivoDe(kpi(fijo), h(fijo), {}, HOY).filtros, [{ dimension: 'reunion', valores: ['R1'] }], 'se aplica igual');
  const vista = { k: { valores: ['R2'] } };
  assert.deepEqual(efectivoDe(kpi(libre), h(libre), vista, HOY).filtros, [{ dimension: 'reunion', valores: ['R2'] }]);
  assert.deepEqual(efectivoDe(kpi(fijo), h(fijo), vista, HOY).filtros, [{ dimension: 'reunion', valores: ['R1'] }], 'R1 es R1: la vista no lo mueve');
  assert.equal(conVista(fijo, vista), fijo);
  assert.equal(distintoDeEntrada(fijo, vista), false);
  assert.equal(distintoDeEntrada(libre, vista), true);
  assert.equal(hayVistaElegida(h(fijo), vista), false, 'nada que restablecer');
  assert.equal(hayVistaElegida(h(libre), vista), true);
  assert.deepEqual(controlesQueSeVen([fijo, libre]).map((c) => c.fijo), [undefined]);
});

// Rotura: no migrar el período (dejar el campo) → 12 / 1 (éste). El id del control sin recortar (`${id}-fecha`) →
// 12 / 1 (éste). Migrarlo a un control NO fijo → 12 / 1 (éste: la vista lo movía). `nuevoControlPara` sin mirar el
// control de período que el gráfico ya tiene → 12 / 1 (éste: arrancaba con el de la página).
test('el período propio de un gráfico se migra a un control FIJO en el saneo, y da el MISMO número', () => {
  const casos: Array<[Preset, string | null, string | null]> = [
    ['ult12m', null, null], ['todo', null, null], ['ayer', null, null], ['este_mes_completo', null, null],
    ['personalizado', '2026-09-01', '2026-09-15'], ['personalizado', null, null],
  ];
  const paginas = [[], [ctl({ id: 'p', tipo: 'periodo', preset: 'ult7' })]];
  const vistas: VistaValores[] = [{}, { p: { preset: 'ayer' } }, { 'g1-fecha': { preset: 'hoy' } }];
  for (const fuente of [['leads', 'alta'], ['pagos', 'vencimiento']]) {
    for (const [preset, desde, hasta] of casos) {
      const nuevo = g({ tipo: 'numero', fuente: fuente[0], fecha: fuente[1], periodo: preset, desde, hasta });
      assert.equal(nuevo.periodo, 'auto', 'el campo queda en automático');
      assert.equal(nuevo.desde, null);
      const c = nuevo.controles[0];
      assert.deepEqual([c.id, c.tipo, c.fijo, c.preset], ['g1-fecha', 'periodo', true, preset]);
      // Lo de antes de v5: el mismo gráfico con el período en el CAMPO y sin el control.
      const viejo: Grafico = { ...nuevo, periodo: preset, desde, hasta, controles: [] };
      for (const pag of paginas) {
        for (const vista of vistas) {
          const a = efectivoDe(viejo, hoja([viejo], pag), vista, HOY);
          const b = efectivoDe(nuevo, hoja([nuevo], pag), vista, HOY);
          assert.deepEqual(b, a, `${fuente[0]} ${preset} ${pag.length ? 'con' : 'sin'} control de hoja, vista ${JSON.stringify(vista)}`);
        }
      }
      assert.deepEqual(sanearGrafico(nuevo), nuevo, 'idempotente');
      // Un control de período nuevo arranca con lo que el gráfico YA miraba (su control fijo), no con la página.
      const h = hoja([nuevo], paginas[1]);
      const agregado = nuevoControlPara('periodo', null, { nivel: 'componente', comp: nuevo, hoja: h })!;
      const conAgregado = efectivoDe({ ...nuevo, controles: [agregado] }, h, {}, HOY);
      assert.deepEqual([conAgregado.desde, conAgregado.hasta], [efectivoDe(nuevo, h, {}, HOY).desde, efectivoDe(nuevo, h, {}, HOY).hasta], `agregar un período a ${preset} no cambia lo que se ve`);
    }
  }
  // Un id de 40: el del control se recorta a 34 + «-fecha» (40).
  const largo = 'x'.repeat(40);
  const id = sanearGrafico({ id: largo, tipo: 'numero', fuente: 'leads', periodo: 'todo' })!.controles[0].id;
  assert.equal(id, `${'x'.repeat(34)}-fecha`);
  // Con un control de período propio, el campo era decorativo: se va y el control queda como estaba.
  const ya = g({ tipo: 'numero', fuente: 'leads', periodo: 'todo', controles: [{ id: 'mio', tipo: 'periodo', preset: 'ult7' }] });
  assert.deepEqual([ya.periodo, ya.controles.length, ya.controles[0].id, ya.controles[0].fijo], ['auto', 1, 'mio', undefined]);
  // Sin lugar para un control más (8), el campo queda: `efectivoDe` lo sigue leyendo.
  const ocho = Array.from({ length: MAX_CONTROLES }, (_, i) => ({ id: `c${i}`, tipo: 'lista', campo: i === 0 ? 'campana' : `leads.${['etapa', 'producto', 'origen', 'closer', 'setter', 'motivo', 'lead'][i - 1]}` }));
  const lleno = g({ tipo: 'numero', fuente: 'leads', periodo: 'todo', controles: ocho });
  assert.equal(lleno.controles.length, MAX_CONTROLES);
  assert.equal(lleno.periodo, 'todo');
});

// Rotura: `sanearGrafico` sin copiar `tabla` → 12 / 1 (éste). `alClic: 'popup'` sin exigir el pop-up → 12 / 1
// (éste). Un pop-up adentro de un pop-up → 12 / 1 (éste).
test('los campos nuevos de un gráfico: se copian con su tope, y lo que vale lo de siempre no se escribe', () => {
  const NUEVOS = ['mako', 'alClic', 'popup', 'barra', 'secundaria', 'ocultarSiCero', 'ejes', 'referencias', 'colorPor', 'tabla', 'mapa'];
  const viejo = g({ tipo: 'tabla', fuente: 'leads', dimension: 'etapa', metricas: ['leads'] });
  for (const k of NUEVOS) assert.equal(k in viejo, false, `un gráfico de antes no escribe «${k}»`);
  assert.equal('mako' in g({ tipo: 'numero', fuente: 'leads', mako: true }), false, 'ausente = prendido');
  assert.equal(g({ tipo: 'numero', fuente: 'leads', mako: false }).mako, false);

  const t = g({
    tipo: 'tabla_barras', fuente: 'leads', dimension: 'etapa', metricas: ['leads', 'cierres'],
    barra: 'cierres', secundaria: 'agendas', ocultarSiCero: true, colorPor: 'producto',
    tabla: { sinVacios: true, descendente: false, acciones: 'sí', buscar: true, columnas: ['producto', 'etapa', 'inventada', 'closer', 'origen', 'campana', 'anuncio'] },
  });
  assert.equal(t.barra, 'cierres');
  assert.equal(t.secundaria, 'agendas');
  assert.equal(t.ocultarSiCero, true);
  assert.equal(t.colorPor, 'producto');
  assert.deepEqual(t.tabla, { sinVacios: true, buscar: true, columnas: ['producto', 'closer', 'origen', 'campana'] }, 'sólo lo prendido; columnas que existen, sin la principal y hasta 4');
  assert.equal(g({ tipo: 'tabla_barras', fuente: 'leads', metricas: ['leads'], barra: 'cierres' }).barra, undefined, 'la barra va en una de SUS métricas');
  assert.equal(g({ tipo: 'numero', fuente: 'leads', secundaria: 'inventada' }).secundaria, undefined);
  assert.equal(g({ tipo: 'dispersion', fuente: 'leads', dimension: 'etapa', colorPor: 'etapa' }).colorPor, undefined, 'no pinta por la misma dimensión');
  assert.equal(g({ tipo: 'dispersion', fuente: 'leads', dimension: 'etapa', colorPor: 'dia' }).colorPor, undefined, 'pinta por una categoría');

  const d = g({ tipo: 'burbujas', fuente: 'proyectos', ejes: { xMin: 0, xMax: 100, yMin: 50, yMax: 10 }, referencias: { x: 50, y: '50', rotulos: ['a', 'b', 'c'] } });
  assert.deepEqual(d.ejes, { xMin: 0, xMax: 100 }, 'un eje con el mínimo arriba del máximo se descarta');
  assert.deepEqual(d.referencias, { x: 50, y: 50 }, 'rótulos: los cuatro o ninguno');
  const r4 = g({ tipo: 'burbujas', fuente: 'proyectos', referencias: { rotulos: ['  Quick wins ', 'Apuestas', 'x'.repeat(90), ''] } });
  assert.deepEqual(r4.referencias?.rotulos, ['Quick wins', 'Apuestas', 'x'.repeat(40), '']);
  assert.deepEqual(g({ tipo: 'mapa', fuente: 'audiencia', mapa: { pais: 'ar', nivel: 'calle' } }).mapa, { pais: 'AR', nivel: 'region' });
  assert.deepEqual(g({ tipo: 'mapa', fuente: 'audiencia', mapa: { pais: 'ARG', nivel: 'ciudad' } }).mapa, { pais: 'auto', nivel: 'ciudad' });

  // El clic: 'nada' se guarda; 'popup' sin pop-up es el detalle de siempre.
  assert.equal(g({ tipo: 'tabla', fuente: 'leads', alClic: 'nada' }).alClic, 'nada');
  assert.equal('alClic' in g({ tipo: 'tabla', fuente: 'leads', alClic: 'popup' }), false);
  assert.equal('alClic' in g({ tipo: 'tabla', fuente: 'leads', alClic: 'cualquiera' }), false);

  // El pop-up: una mini-hoja, sin pop-ups adentro, con fichas y cajas de IA que leen lo abierto; hasta MAX_POPUP.
  const adentro = Array.from({ length: MAX_POPUP + 5 }, (_, i) => ({ id: `p${i}`, clase: 'grafico', tipo: 'numero', fuente: 'llamadas_venta', metricas: ['puntaje'] }));
  const conPopup = g({
    tipo: 'tabla', fuente: 'llamadas_venta', dimension: 'llamada', alClic: 'popup',
    popup: {
      titulo: 'Llamada',
      componentes: [
        { id: 'ficha', clase: 'elemento', tipo: 'entidad', entidad: { tipo: 'llamada', pieza: 'resumen' } },
        { id: 'mako', clase: 'elemento', tipo: 'ia', ia: { lee: 'entidad', fuentes: ['p0', 'borrado'] } },
        { id: 'anidado', clase: 'grafico', tipo: 'tabla', fuente: 'llamadas_venta', alClic: 'popup', popup: { titulo: 'X', componentes: [] } },
        ...adentro,
      ],
    },
  });
  assert.equal(conPopup.alClic, 'popup');
  const pc = conPopup.popup!.componentes;
  assert.equal(pc.length, MAX_POPUP);
  assert.equal(pc[0].clase === 'elemento' && pc[0].entidad?.pieza, 'resumen', 'una ficha vive en un pop-up');
  assert.equal(pc[1].clase === 'elemento' && pc[1].ia?.lee, 'entidad');
  assert.deepEqual(pc[1].clase === 'elemento' && pc[1].ia?.fuentes, ['p0'], 'la caja lee gráficos que ESTÁN en el pop-up');
  const anidado = pc.find((c) => c.id === 'anidado') as Grafico;
  assert.equal('popup' in anidado || 'alClic' in anidado, false, 'sin pop-ups anidados');
  assert.deepEqual(sanearGrafico(conPopup), conPopup, 'idempotente');
});

// Rotura: `tipoAdmite` siempre true → 12 / 1 (éste). `tramos` con soloSumas → 12 / 1 (éste).
test('los tipos nuevos: barra de proporción, línea de tiempo, tarjetas, mapa de calor; y el mapa ya no es sólo México', () => {
  const t = (id: string) => tipoDe(id)!;
  assert.deepEqual([t('barra_proporcion').grupo, t('barra_proporcion').dimension, t('barra_proporcion').minMetricas, t('barra_proporcion').maxMetricas, t('barra_proporcion').soloSumas], ['Cuadro de resultados', 'ninguna', 2, 4, true]);
  assert.deepEqual([t('tramos').nombre, t('tramos').grupo, t('tramos').minMetricas, t('tramos').maxMetricas, t('tramos').soloSumas], ['Línea de tiempo', 'Cuadro de resultados', 2, 8, undefined]);
  assert.deepEqual([t('tarjetas').grupo, t('tarjetas').dimension, t('tarjetas').minMetricas, t('tarjetas').maxMetricas], ['Tabla', 'categoria', 1, 4]);
  assert.deepEqual([t('mapa_calor').nombre, t('mapa_calor').grupo, t('mapa_calor').soloFuentes], ['Mapa de calor de página', 'Mapa', ['toques']]);
  assert.deepEqual([t('mapa').nombre, t('mapa').soloDims], ['Mapa', ['region', 'pais', 'ciudad']]);
  // Los tramos son razones (promedios de días): se aceptan.
  const tr = g({ tipo: 'tramos', fuente: 'leads', metricas: ['tramo_1', 'tramo_2', 'tramo_3', 'tramo_4', 'tramo_5'] });
  assert.deepEqual(tr.metricas, ['tramo_1', 'tramo_2', 'tramo_3', 'tramo_4', 'tramo_5']);
  // La barra de proporción sólo suma.
  assert.deepEqual(g({ tipo: 'barra_proporcion', fuente: 'pagos', metricas: ['cobrado', 'pendiente'] }).metricas, ['cobrado', 'pendiente']);
  // El mapa de calor, sólo sobre los toques.
  assert.equal(g({ tipo: 'mapa_calor', fuente: 'leads' }).tipo, 'barras');
  assert.equal(g({ tipo: 'mapa_calor', fuente: 'toques', metricas: ['toques'] }).tipo, 'mapa_calor');
  assert.equal(nuevoGrafico('mapa_calor', []).fuente, 'toques');
});

// Rotura: dejar el rectángulo en TIPOS_ELEMENTO → 12 / 1 (éste). La sección sin forzar x=0/w=12 → 12 / 1 (éste).
// La ficha aceptada en la hoja → 12 / 1 (éste). Sin el tope de cajas de IA → 12 / 1 (éste).
test('elementos: fuera las formas; sección a lo ancho; IA, ficha y acción con sus objetos y topes', () => {
  assert.deepEqual(TIPOS_ELEMENTO.map((t) => t.id).sort(), ['accion', 'enlace', 'entidad', 'flecha', 'ia', 'imagen', 'insertado', 'linea', 'seccion', 'texto', 'video']);
  assert.equal(sanearElemento({ tipo: 'rectangulo' }), null);
  assert.equal(sanearElemento({ tipo: 'circulo' }), null);

  const s = sanearElemento({ id: 's', tipo: 'seccion', texto: 'A quién cobrarle', x: 5, w: 4, seccion: { fondo: 9, plegable: true } })!;
  assert.deepEqual([s.x, s.w, s.seccion], [0, 12, { fondo: null, plegable: true, abierto: true }], 'una sección va siempre a lo ancho');

  const ia = sanearElemento({ tipo: 'ia', ia: { pedido: ` ${'p'.repeat(700)} `, fuentes: ['g1', 'g1', 'mal id!'], vista: 'otra', largo: 'corto', formato: 'tarjetas', lee: 'entidad', cron: { unidad: 'semana', hora: 30 } } })!;
  assert.equal(ia.ia!.pedido.length, 600);
  assert.deepEqual(ia.ia!.fuentes, ['g1']);
  assert.deepEqual([ia.ia!.vista, ia.ia!.largo, ia.ia!.formato, ia.ia!.lee], ['resumen', 'corto', 'tarjetas', 'hoja'], 'en la hoja no hay entidad abierta');
  assert.deepEqual(ia.ia!.cron, { unidad: 'semana', hora: 23 });
  assert.deepEqual(sanearElemento({ tipo: 'ia' })!.ia, { pedido: '', fuentes: null, vista: 'resumen', largo: 'medio', formato: 'parrafo', lee: 'hoja', cron: null });
  assert.equal(sanearElemento({ tipo: 'ia', ia: { cron: { unidad: 'año', hora: 9 } } })!.ia!.cron, null);

  const ficha = { tipo: 'entidad', entidad: { tipo: 'anuncio', pieza: 'completo' } };
  assert.equal(sanearElemento(ficha), null, 'en la hoja no hay qué abrir');
  assert.deepEqual(sanearElemento(ficha, { enPopup: true })!.entidad, { tipo: 'anuncio', pieza: 'completo' });
  assert.equal(sanearElemento({ tipo: 'entidad', entidad: { tipo: 'persona', pieza: 'x' } }, { enPopup: true }), null);
  assert.equal(sanearElemento({ tipo: 'entidad', entidad: { tipo: 'lead', pieza: '<b>' } }, { enPopup: true }), null);

  assert.deepEqual(sanearElemento({ tipo: 'accion', accion: { id: 'sincronizar_llamadas', rotulo: `  ${'r'.repeat(60)}` } })!.accion, { id: 'sincronizar_llamadas', rotulo: 'r'.repeat(40) });
  assert.equal(sanearElemento({ tipo: 'accion', accion: { id: 'Borrar-Todo' } }), null);
  assert.equal(sanearElemento({ tipo: 'accion' }), null);
  // Cada objeto, SÓLO en su tipo.
  const texto = sanearElemento({ tipo: 'texto', ia: { pedido: 'x' }, seccion: {}, accion: { id: 'a' } })!;
  assert.deepEqual(['ia', 'seccion', 'entidad', 'accion'].filter((k) => k in texto), []);

  // Hasta MAX_IA_POR_HOJA cajas de IA por hoja: cada una gasta cuota al correr.
  const h = sanearHoja({ id: 'h', componentes: Array.from({ length: MAX_IA_POR_HOJA + 2 }, (_, i) => ({ id: `ia${i}`, clase: 'elemento', tipo: 'ia' })) }, 0)!;
  assert.equal(h.componentes.length, MAX_IA_POR_HOJA);
});

// Rotura: los conectores sin podar los que apuntan a la nada → 12 / 1 (éste). Sin copiar `plantilla` → 12 / 1 (éste).
test('la hoja: de qué plantilla nació, y los conectores entre componentes que ESTÁN', () => {
  const comps = [
    { id: 'a', clase: 'grafico', tipo: 'numero', fuente: 'leads' },
    { id: 'b', clase: 'grafico', tipo: 'numero', fuente: 'leads' },
  ];
  const conectores = [
    { id: 'c1', desde: 'a', hasta: 'b', punta: 'ambas', trazo: 'codo', color: 3 },
    { id: 'c2', desde: 'a', hasta: 'borrado' },
    { id: 'c3', desde: 'a', hasta: 'a' },
    { id: 'c1', desde: 'b', hasta: 'a', punta: 'rara', color: 12 },
    ...Array.from({ length: MAX_CONECTORES + 5 }, (_, i) => ({ id: `x${i}`, desde: 'a', hasta: 'b' })),
  ];
  const h = sanearHoja({ id: 'h', plantilla: 'closing', componentes: comps, conectores }, 0)!;
  assert.equal(h.plantilla, 'closing');
  assert.equal(h.conectores!.length, MAX_CONECTORES);
  assert.deepEqual(h.conectores![0], { id: 'c1', desde: 'a', hasta: 'b', punta: 'ambas', trazo: 'codo', color: 3 });
  assert.notEqual(h.conectores![1].id, 'c1', 'un id repetido se renombra');
  assert.deepEqual([h.conectores![1].desde, h.conectores![1].punta, h.conectores![1].trazo, h.conectores![1].color], ['b', 'fin', 'curva', null]);
  assert.ok(!h.conectores!.some((c) => c.hasta === 'borrado' || c.desde === c.hasta));
  const sin = sanearHoja({ id: 'h', plantilla: '<x>', componentes: comps, conectores: [{ desde: 'a', hasta: 'z' }] }, 0)!;
  assert.equal('plantilla' in sin || 'conectores' in sin, false, 'ausentes cuando no hay');
  assert.deepEqual(sanearHoja(h, 0), h, 'idempotente');
});

// Rotura: `cliente` sin `cobranza` en el compartido → 12 / 1 (éste). El campo viejo sin traducir
// (`campoVigente` = `campoDe`) → 11 / 2 (éste y «el período propio…», que arma sus 8 controles con `leads.setter`).
test('campos compartidos de v5: video, línea, setter, cliente y producto; sólo se materializa lo que existe', () => {
  const declarado = (id: string) => COMPARTIDOS_DECLARADOS.find((c) => c.id === id)?.en;
  assert.deepEqual(declarado('video'), { vsl: 'video', retencion_vsl: 'video' });
  assert.deepEqual(declarado('linea'), { whatsapp: 'linea', conversaciones: 'linea' });
  assert.deepEqual(declarado('setter'), { leads: 'setter', whatsapp: 'setter', conversaciones: 'setter' });
  assert.deepEqual(declarado('cliente'), { entrega: 'cliente', pagos: 'cliente', cartera: 'cliente', cobranza: 'cliente' });
  assert.equal(declarado('producto')?.cartera, 'producto');
  // Lo que no se materializa: un conjunto NUEVO de v5 que todavía no se declaró, o una dimensión pendiente de
  // datos. Cualquier otra cosa es un error de tipeo, y se perdería en silencio.
  const NUEVOS_V5 = ['revenue', 'cobranza', 'suscripciones', 'vsl_leads', 'cartera', 'conversaciones', 'ubicacion'];
  const PENDIENTES = ['whatsapp.setter'];
  for (const c of COMPARTIDOS_DECLARADOS) {
    for (const [f, d] of Object.entries(c.en)) {
      if (campoDe(c.id)?.en[f] === d) continue;
      assert.ok((!fuenteDe(f) && NUEVOS_V5.includes(f)) || PENDIENTES.includes(`${f}.${d}`), `${c.id}: ${f}.${d} no existe`);
    }
  }
  assert.equal(campoDe('whatsapp.setter'), undefined);
  // Un control guardado sobre el campo PROPIO de antes pasa al compartido (si no, el saneo lo tiraba).
  for (const [viejo, nuevo] of [['leads.setter', 'setter'], ['pagos.cliente', 'cliente'], ['whatsapp.linea', 'linea'], ['vsl.video', 'video'], ['entrega.cliente', 'cliente']]) {
    assert.equal(ctl({ id: 'k', tipo: 'lista', campo: viejo })?.campo, nuevo, viejo);
  }
  const ids = CAMPOS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'sin campos repetidos');
});

// Rotura: `cobranza` con `lead: 'cuota'` → 12 / 1 (éste). DETALLE_REVENUE sin `pendiente` → 12 / 1 (éste).
test('entidades nuevas y el detalle del Revenue: cada número abre su lista', () => {
  assert.deepEqual(ENTIDADES.cobranza.ids, { pago: 'cuota', lead: 'cliente' }, 'los dos ids de la MISMA fila');
  assert.deepEqual([ENTIDADES.guiones.entidad, ENTIDADES.guiones.ref, ENTIDADES.guiones.ids], ['anuncio', 'anuncio', { anuncio: 'anuncio' }]);
  assert.deepEqual([ENTIDADES.ejecucion.entidad, ENTIDADES.ejecucion.nombre, ENTIDADES.ejecucion.ids], ['tarea', ['tarea'], { tarea: 'tarea' }]);
  assert.deepEqual([ENTIDADES.llamadas_dimensiones.entidad, ENTIDADES.llamadas_dimensiones.ids], ['llamada', { llamada: 'llamada' }]);
  assert.deepEqual([ENTIDADES.cartera.entidad, ENTIDADES.cartera.ids], ['lead', { lead: 'cliente' }]);
  const fecha = fuenteDe('revenue')?.fechas[0].id ?? 'fecha';
  const esperado: Record<string, [string, string, string]> = {
    vendido: ['leads', 'cierre', 'vendido'], cierres: ['leads', 'cierre', 'cierres'], cobrado: ['pagos', 'pago', 'cobrado'], pendiente: ['pagos', 'vencimiento', 'pendiente'],
  };
  for (const [m, [f, fe, inc]] of Object.entries(esperado)) {
    const d = destinoDetalle('revenue', fecha, m)!;
    assert.deepEqual([d.fuente, d.fecha, d.incluye], [f, fe, inc], m);
    const destino = fuenteDe(d.fuente)!;
    assert.ok(destino.fechas.some((x) => x.id === d.fecha) && ENTIDADES[d.fuente], m);
    for (const id of [d.incluye, ...d.columnas]) assert.ok(destino.metricas.some((x) => x.id === id), `${m}: ${id}`);
  }
  assert.equal(destinoDetalle('revenue', fecha, 'inventada'), null);
});

// Rotura: `cobranza.cliente` en DIMENSIONES_PUBLICAS → 12 / 1 (éste). Un tipeo (`ejecucion: ['prioridda']`) → 12 / 1 (éste).
test('lo que viaja a la IA: las dimensiones de Analysts y las nuevas, nunca una persona, y nada que no exista', () => {
  for (const [f, dims] of Object.entries(DIMENSIONES_PUBLICAS)) {
    const fuente = fuenteDe(f);
    if (!fuente) continue; // un conjunto nuevo que todavía no se declaró: se cruza cuando exista
    for (const d of dims) assert.ok(fuente.dimensiones.some((x) => x.id === d), `${f}.${d} no existe`);
  }
  for (const f of ['guiones', 'clics', 'scroll', 'toques', 'retencion_vsl', 'landing_analisis', 'llamadas_venta', 'llamadas_dimensiones', 'proyectos', 'ejecucion', 'cobranza', 'vsl_leads', 'cartera', 'conversaciones', 'ubicacion']) {
    assert.ok(DIMENSIONES_PUBLICAS[f]?.length, `${f} no tiene ninguna dimensión pública`);
  }
  const PERSONAS = [
    'leads.closer', 'leads.setter', 'leads.lead', 'leads.motivo', 'pagos.cliente', 'entrega.cliente', 'tareas.tarea', 'tareas.responsable',
    'llamadas_venta.closer', 'llamadas_venta.llamada', 'llamadas_dimensiones.closer', 'llamadas_dimensiones.llamada', 'ejecucion.tarea',
    'cobranza.cliente', 'cartera.cliente', 'cartera.motivo', 'conversaciones.setter',
  ];
  for (const p of PERSONAS) { const [f, d] = p.split('.'); assert.equal(dimensionPublica(f, d), false, p); }
  assert.equal(dimensionPublica('ejecucion', 'prioridad'), true);
  assert.equal(dimensionPublica('leads', 'madurez_semana'), true);
});

// Rotura: `campoDeDimension` que devuelve la dimensión cruda → 12 / 1 (éste).
test('campoDeDimension: el campo que filtra la dimensión de un conjunto', () => {
  assert.equal(campoDeDimension('meta', 'campana'), 'campana');
  assert.equal(campoDeDimension('guiones', 'angulo'), 'guiones.angulo');
  assert.equal(campoDeDimension(fuenteDe('leads')!, 'setter'), 'setter');
  assert.equal(campoDeDimension('llamadas_venta', 'reunion'), 'llamadas_venta.reunion');
  assert.equal(campoDeDimension('leads', 'dia'), null, 'el tiempo no se filtra con un campo');
  assert.equal(campoDeDimension('leads', null), null);
  assert.equal(campoDeDimension('leads', 'inventada'), null);
});

// El autoguardado con VERSIÓN (pendiente «Dos escritores del mismo tablero», hallazgos-graficos.md). El módulo es
// `server-only`: se pregunta sobre el FUENTE sin comentarios y sobre el BLOQUE de cada función.
// Rotura: `leerTableroDe` de vuelta a `getSettingEstricto` → 12 / 1 (éste). `guardarTableroVersion` por
// `guardarTableroDe` (upsert ciego) → 12 / 1 (éste). Sin la versión nueva en el resultado → 12 / 1 (éste).
test('el autoguardado del editor escribe con compare-and-set y devuelve la versión nueva', () => {
  const src = readFileSync(join(__dirname, '..', 'lib', 'graficos-tablero.ts'), 'utf8').replace(/\r\n/g, '\n')
    .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const bloque = (ini: string) => {
    const i = src.indexOf(ini);
    assert.ok(i >= 0, `no encuentro ${ini}`);
    const fin = src.indexOf('\n}\n', i);
    return src.slice(i, fin);
  };
  const leer = bloque('export async function leerTableroDe(');
  assert.match(leer, /leerTableroVersionado\(sub\)/, 'la versión sale de la MISMA lectura que compara el guardado');
  assert.match(leer, /version: v\.version/);
  assert.doesNotMatch(leer, /getSettingEstricto/);
  const guardar = bloque('export async function guardarTableroVersion(');
  assert.match(guardar, /return guardarTableroSi\(s\.sub, raw, version\)/);
  assert.doesNotMatch(guardar, /setSetting|guardarTableroDe/, 'el autoguardado no es un upsert ciego');
  const si = bloque('export async function guardarTableroSi(');
  assert.match(si, /const nueva = versionDe\(valor\)/);
  assert.equal((si.match(/\{ ok: true, tablero: t, version: nueva \}/g) ?? []).length, 2, 'la versión nueva en las DOS salidas buenas');
  assert.match(src, /\| \{ estado: 'propio'; tablero: Tablero; version: string \| null \}/);
});
