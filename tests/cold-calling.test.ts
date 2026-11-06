// =============================================================================
// Cold Calling (04/11/2026): la plantilla del Dashboard con el botón de grabar y los números de una tanda de llamadas
// =============================================================================
// Martín: «quiero que implementes el botón de "grabar" en el detail de un lead y en un dashboard template que sea "Call Calling"».
// Corre el código y mira el resultado: la fila de una llamada grabada (`filaDeLlamadaGrabada`, lib/grabar-llamada-reglas.ts), el
// agregador del Dashboard sobre esas filas, y la hoja que sale de la plantilla (instanciada, con su composición densa).
//
// Probado rompiéndolo (04/11/2026, base 7/0):
//   · `contestaron` contando también las sin marcar (`contesto(r) || !r`)                          → 5/2 (tests 1 y 2)
//   · `tasa_contacto` dividida por `contestaron` en vez de `llamadas`                               → 6/1 (test 2)
//   · `comoDenso` sin `deArriba` (el botón vuelve al pie)                                           → 6/1 (test 3)
//   · `arriba: true` también en «Sincronizar llamadas»                                              → 6/1 (test 4)
// Los datos son inventados (ningún cliente).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { filaDeLlamadaGrabada, SIN_MARCAR, VALORES_RESULTADO } from '../lib/grabar-llamada-reglas';
import { agregar } from '../lib/graficos-agregar';
import { fuenteDe, type Grafico } from '../lib/graficos-catalogo';
import { PLANTILLAS_HOJA, instanciarPlantilla } from '../lib/graficos-plantillas';
import { accionElementoDe } from '../lib/graficos-acciones';
import { sinBloquesDeDiseno } from '../lib/disenos-partes';

const llamada = (o: Partial<Parameters<typeof filaDeLlamadaGrabada>[0]> = {}) => filaDeLlamadaGrabada({
  lead_id: 7, origen: 'cold-calling', autor: 'Ana', estado: 'lista', resultado: null, duracion_seg: 60, created_at: '2026-11-03T15:00:00Z', ...o,
}, { fecha: '2026-11-03', lead: 'Juan Prueba' });

test('1. la fila de una llamada: cómo terminó lo dice la persona, y sin marcar no es «no contestó»', () => {
  const agendo = llamada({ resultado: 'agendo', duracion_seg: 90 });
  assert.deepEqual(
    { c: agendo.v.contestaron, a: agendo.v.agendaron, nc: agendo.v.no_contesto, s: agendo.v.sin_marcar, m: agendo.v.minutos },
    { c: 1, a: 1, nc: 0, s: 0, m: 1.5 },
  );
  assert.equal(agendo.d.resultado, 'Agendó');
  assert.equal(agendo.d.origen, 'En frío');
  const noContesto = llamada({ resultado: 'no_contesto' });
  assert.equal(noContesto.v.contestaron, 0);
  assert.equal(noContesto.v.no_contesto, 1);
  const sinMarcar = llamada({ resultado: null, estado: 'grabando', duracion_seg: null });
  assert.deepEqual({ c: sinMarcar.v.contestaron, nc: sinMarcar.v.no_contesto, s: sinMarcar.v.sin_marcar, m: sinMarcar.v.minutos }, { c: 0, nc: 0, s: 1, m: 0 });
  assert.equal(sinMarcar.d.resultado, SIN_MARCAR);
  // Un resultado que no existe (una fila de otra versión) cuenta como sin marcar, nunca como uno de los cuatro.
  assert.equal(llamada({ resultado: 'colgo' }).d.resultado, SIN_MARCAR);
  // La entidad es el lead: el detalle lista leads y abre su ficha.
  assert.equal(agendo.r.lead, '7');
  assert.equal(agendo.u.leads_llamados, '7');
  // Sin nombre, el lead se nombra por su número (nunca una fila en blanco).
  assert.equal(filaDeLlamadaGrabada({ lead_id: 9, origen: 'ficha', autor: null, estado: 'lista', resultado: null, duracion_seg: 0, created_at: '' }, { fecha: null, lead: null }).d.lead, 'Lead #9');
  // Todos los resultados que salen están en el orden fijo de la dimensión.
  for (const r of ['agendo', 'hablo', 'no_interesa', 'no_contesto', null]) assert.ok(VALORES_RESULTADO.includes(llamada({ resultado: r }).d.resultado!));
});

test('2. el agregador del Dashboard: la tasa de contacto es de TODAS las llamadas, y la de agenda, de las que contestaron', () => {
  const filas = [
    llamada({ resultado: 'agendo' }), llamada({ resultado: 'hablo' }), llamada({ resultado: 'no_interesa' }),
    llamada({ resultado: 'no_contesto' }), llamada({ resultado: null }),
  ];
  assert.ok(fuenteDe('llamadas_grabadas'), 'el conjunto está en el catálogo');
  const g = { id: 'x', fuente: 'llamadas_grabadas', fecha: 'fecha', tipo: 'tabla', dimension: null, metricas: ['llamadas', 'contestaron', 'agendaron', 'tasa_contacto', 'duracion'] } as unknown as Grafico;
  const r = agregar(g, filas, '2026-11-01', '2026-11-07');
  const total = Object.fromEntries(r.columnas.map((c, i) => [c.id, r.totales[i]]));
  assert.equal(total.llamadas, 5);
  assert.equal(total.contestaron, 3);
  assert.equal(total.agendaron, 1);
  assert.equal(Math.round(Number(total.tasa_contacto)), 60);
  assert.equal(total.duracion, 1);
  // «Agendan de los que contestan» no se da con menos de 5 que contestaron: «X de Y» o vacío, nunca 33 %.
  const ga = { ...g, metricas: ['tasa_agenda'] } as Grafico;
  const ra = agregar(ga, filas, '2026-11-01', '2026-11-07');
  assert.notEqual(Math.round(Number(ra.totales[0])), 33, 'con 3 que contestaron no se afirma un porcentaje');
});

test('3. la hoja Cold Calling: «Grabar llamada» es la primera tarjeta (no a lo ancho), y todo lo demás mira las llamadas grabadas', () => {
  const p = PLANTILLAS_HOJA.find((x) => x.id === 'cold-calling');
  assert.ok(p, 'la plantilla está en la galería');
  const hoja = instanciarPlantilla(p);
  // Desde el 6/11/2026 la hoja abre con las tarjetas de su diseño como BLOQUES (lib/disenos-partes.ts): la primera es la del
  // título con «Grabar llamada». Las piezas de la plantilla siguen como se escribieron, plegadas en «Todas las piezas».
  const primero = [...hoja.componentes].sort((a, b) => a.y - b.y || a.x - b.x)[0] as { tipo?: string; diseno?: { id: string; parte: string } };
  assert.deepEqual([primero.tipo, primero.diseno?.id, primero.diseno?.parte], ['diseno', 'cold-calling', 'cabecera'], 'lo primero es el título con «Grabar llamada»');
  const comps = sinBloquesDeDiseno(hoja.componentes) as Array<Record<string, unknown>>;
  const boton = comps.find((c) => c.tipo === 'accion');
  assert.ok(boton, 'la hoja tiene el botón');
  assert.equal((boton.accion as { id: string }).id, 'grabar_llamada');
  assert.equal(boton.y, 0, 'el botón va arriba');
  assert.equal(boton.x, 0, 'y primero');
  // Nunca a lo ancho (Martín rechazó «el bloque gigante primero»: tests/graficos-corbel.test.ts): una tarjeta de la fila de números.
  assert.ok(Number(boton.w) < 12, 'a lo ancho');
  const numeros = comps.filter((c) => c.tipo === 'numero_tendencia');
  assert.ok(numeros.some((c) => c.y === boton.y), 'al lado de los números');
  const graficos = comps.filter((c) => c.clase === 'grafico');
  assert.ok(graficos.length >= 6, `${graficos.length} gráficos`);
  for (const c of graficos) assert.equal(c.fuente, 'llamadas_grabadas', `${String(c.titulo)}: otro conjunto`);
  // Nada queda arriba del botón.
  assert.ok(comps.every((c) => Number(c.y) >= Number(boton.y)), 'algo se dibuja encima del botón');
});

test('4. «Sincronizar llamadas» de Closing sigue al pie: lo de arriba es sólo de la acción que ES la hoja', () => {
  assert.equal(accionElementoDe('grabar_llamada')?.arriba, true);
  assert.notEqual(accionElementoDe('sincronizar_llamadas')?.arriba, true);
  const closing = PLANTILLAS_HOJA.find((x) => x.id === 'closing');
  assert.ok(closing);
  const comps = instanciarPlantilla(closing).componentes as Array<Record<string, unknown>>;
  const sync = comps.find((c) => c.tipo === 'accion' && (c.accion as { id: string }).id === 'sincronizar_llamadas');
  assert.ok(sync, 'Closing tiene su botón');
  const fondo = Math.max(...comps.map((c) => Number(c.y)));
  assert.equal(sync.y, fondo, 'el botón de Closing ya no está al pie');
});

test('5. el conjunto declara lo que cuenta la hoja, y la entidad es el lead', async () => {
  const f = fuenteDe('llamadas_grabadas')!;
  for (const id of ['llamadas', 'contestaron', 'agendaron', 'tasa_contacto', 'tasa_agenda', 'minutos', 'duracion', 'leads_llamados']) {
    assert.ok(f.metricas.some((m) => m.id === id), `falta la métrica ${id}`);
  }
  for (const id of ['resultado', 'origen', 'autor', 'lead', 'dia']) assert.ok(f.dimensiones.some((d) => d.id === id), `falta la dimensión ${id}`);
  const { ENTIDADES } = await import('../lib/graficos-catalogo');
  assert.equal(ENTIDADES.llamadas_grabadas?.entidad, 'lead');
  // La dimensión que nombra a una persona no viaja a ningún modelo.
  const { DIMENSIONES_PUBLICAS } = await import('../lib/graficos-analisis');
  assert.ok(!(DIMENSIONES_PUBLICAS.llamadas_grabadas ?? []).includes('lead'));
  assert.ok(!(DIMENSIONES_PUBLICAS.llamadas_grabadas ?? []).includes('autor'));
});

test('6. «Grabar llamada» es un botón de la hoja: no escribe al tocarlo y la API lo ofrece', async () => {
  const a = accionElementoDe('grabar_llamada')!;
  assert.equal(a.donde, 'hoja');
  assert.equal(a.escribe, false);
  assert.equal(a.tipo, 'grabar');
  assert.equal(a.puerta, undefined);
});

test('7. la galería: Cold Calling tiene su color, sus etiquetas y su linea corta', async () => {
  const { COLOR_DASHBOARD, identidadDe } = await import('../lib/graficos-identidad');
  const { ETIQUETAS_DASHBOARD } = await import('../lib/graficos-plantillas-etiquetas');
  assert.ok(identidadDe(COLOR_DASHBOARD['cold-calling']), 'sin color');
  // Sólo por la entrada en frío: por el canal «llamadas» le sacaba el lugar a Marketing a quien recibe leads de anuncios.
  assert.deepEqual(ETIQUETAS_DASHBOARD['cold-calling'], { entrada: ['chat_saliente'] });
  const p = PLANTILLAS_HOJA.find((x) => x.id === 'cold-calling')!;
  assert.ok(p.linea.length <= 110);
});
