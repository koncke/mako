// =============================================================================
// La cabecera de /general — que no certifique lo que no midió, y que muestre el
// objetivo correcto
// =============================================================================
// Las dos piezas que decide este archivo son las que gobiernan el texto MÁS GRANDE
// de la pantalla de entrada del negocio. Un error acá no se ve como un bug: se ve
// como un dato.
//
//   · `elegirFoco` con `sinFuentes` — la otra mitad de la tarea #165. Hasta el
//     08/09/2026 la guarda vivía SÓLO adentro del Semáforo, así que con objetivos y
//     KPIs cargados sobre un workspace sin un solo dato todos los KPIs quedaban
//     `sin-datos` (ni rojo ni ámbar), ninguna de las seis reglas empujaba una alerta,
//     y el último escalón devolvía «Vas al día con todo lo que te comprometiste».
//     Con la cabecera grande, ese verde mentiroso pasaba a ser el titular.
//
//   · `elegirObjetivoPrincipal` — antes no existía: la pantalla tomaba `objetivos[0]`,
//     que es el primero por `orden`, y `listObjectives` mezcla A PROPÓSITO los
//     objetivos ANUALES con los del trimestre. O sea que la cabecera podía mostrar el
//     número del AÑO arriba de una pantalla cuyo resto habla del trimestre, sin decirlo.
//
// ⚠️ LOS DOS TESTS SE PROBARON ROMPIÉNDOLOS, que es lo único que distingue un test
// medido de uno escrito. Los resultados están en el comentario de cada bloque.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elegirFoco, type EntradaFoco } from '../lib/focus';
import { elegirObjetivoPrincipal, type Objective } from '../lib/objectives-modelo';

// ── El foco: «no puedo leer tu negocio» le gana al verde ─────────────────────

/** Un workspace configurado y sano: objetivo puesto, un KPI en verde, cero alertas. */
const SANO: EntradaFoco = {
  kpis: [{
    id: 'k1', nombre: 'Reuniones agendadas', estado: 'verde', cadencia: 'semanal',
    compromiso: 5, unidad: 'cantidad', valor: 6, fuente: 'auto', fuenteId: 'agendas',
    objetivoTitulo: 'Facturación del trimestre', orden: 0,
  }],
  alertas: [],
  tareas: [],
  objetivos: 1,
  cuello: null,
  sinFuentes: false,
  hoy: '2026-09-08',
};

test('#165 · sin una sola fuente con datos, el titular NO dice que todo va bien', () => {
  // ⚠️ VERIFICADO ROMPIÉNDOLO (08/09/2026): quitando el escalón de `sinFuentes` de
  // `lib/focus.ts`, este bloque falla con «Vas al día con todo lo que te
  // comprometiste» y los otros dos tests del archivo siguen pasando — o sea que sin
  // esta aserción el agujero vuelve sin que nada avise.
  const foco = elegirFoco({ ...SANO, sinFuentes: true });

  assert.equal(foco.origen, 'arranque');
  assert.equal(foco.href, '/integraciones');
  assert.equal(foco.nivel, 'ambar');
  assert.match(foco.accion, /[Cc]onecta/);
  // Lo que NUNCA puede decir: que el negocio va bien. Es la frase textual de la #165.
  assert.doesNotMatch(foco.accion, /al día/);
  assert.doesNotMatch(foco.razon, /Ningún KPI en rojo/);
});

test('con fuentes conectadas, el mismo workspace sí puede decir que va al día', () => {
  // El control del test de arriba: si `sinFuentes` no cambiara nada, los dos casos
  // devolverían lo mismo y el primero pasaría por casualidad.
  const foco = elegirFoco(SANO);
  assert.match(foco.accion, /al día/);
  assert.equal(foco.nivel, 'neutro');
});

test('lo urgente le gana al arranque: una alerta roja se lleva el titular aunque falten fuentes', () => {
  // `sinFuentes` es el ANTEÚLTIMO escalón, no el primero. Un negocio con una cuota
  // vencida tiene algo que hacer hoy, y decirle «conecta una fuente» sería cambiar
  // una orden de cobro por una tarea de configuración.
  const foco = elegirFoco({
    ...SANO,
    sinFuentes: true,
    alertas: [{ nivel: 'rojo', titulo: '3 cuotas VENCIDAS', detalle: 'Cóbralas.', href: '/comercial', hrefLabel: 'Comercial' }],
  });
  assert.equal(foco.origen, 'alerta');
  assert.equal(foco.alertaIdx, 0);
});

// ── El objetivo que ocupa la cabecera ────────────────────────────────────────

const obj = (p: Partial<Objective>): Objective => ({
  id: 'o', anio: 2026, quarter: 3, titulo: 'x', metrica: 'cierres', metaValor: 10,
  unidad: 'cantidad', avanceManual: null, orden: 0, estado: 'activo', origen: 'manual', funnelIds: [],
  ...p,
});

test('el objetivo principal es el de FACTURACIÓN del trimestre, no el primero por orden', () => {
  // ⚠️ VERIFICADO ROMPIÉNDOLO (08/09/2026): reemplazando el cuerpo de
  // `elegirObjetivoPrincipal` por `objetivos[0] ?? null` —que es exactamente lo que
  // la pantalla hacía antes— quedan 4 pases y 3 fallos: éste, el del anual y el de
  // «sin cobrado, lo firmado». El cuarto (un anual solo) sigue pasando, y está bien
  // que pase: con un solo objetivo las dos reglas coinciden.
  const elegido = elegirObjetivoPrincipal([
    obj({ id: 'cierres', metrica: 'cierres', orden: 0 }),
    obj({ id: 'cash', metrica: 'cash_usd', unidad: 'usd', metaValor: 20000, orden: 1 }),
  ]);
  assert.equal(elegido?.id, 'cash');
});

test('a igualdad de métrica gana el del TRIMESTRE, nunca el anual', () => {
  // `listObjectives` devuelve los anuales mezclados con los del Q, ordenados por
  // `orden`: sin esta regla, la cabecera muestra el número del año entero arriba de
  // una pantalla que dice «Q3 · quedan 22 días».
  const elegido = elegirObjetivoPrincipal([
    obj({ id: 'anual', metrica: 'cash_usd', unidad: 'usd', quarter: null, orden: 0 }),
    obj({ id: 'delQ', metrica: 'cash_usd', unidad: 'usd', quarter: 3, orden: 5 }),
  ]);
  assert.equal(elegido?.id, 'delQ');
});

test('sin cobrado se muestra lo firmado; sin ninguno de los dos, el que haya; sin objetivos, null', () => {
  assert.equal(elegirObjetivoPrincipal([
    obj({ id: 'agendas', metrica: 'agendas' }),
    obj({ id: 'sold', metrica: 'sold_usd', unidad: 'usd' }),
  ])?.id, 'sold');

  assert.equal(elegirObjetivoPrincipal([obj({ id: 'solo', metrica: 'leads' })])?.id, 'solo');

  // Cero objetivos NO es un objetivo vacío: es null, y la cabecera pide cargar la
  // meta en vez de dibujar un «0 / 0» que nadie se comprometió a cumplir.
  assert.equal(elegirObjetivoPrincipal([]), null);
});

test('un objetivo anual solo también manda, pero sigue siendo el anual', () => {
  const elegido = elegirObjetivoPrincipal([obj({ id: 'anual', metrica: 'cash_usd', unidad: 'usd', quarter: null })]);
  assert.equal(elegido?.id, 'anual');
  // La cabecera usa esto para rotular «2026» en vez de «Q3 2026»: si se perdiera el
  // `quarter: null`, el período que se muestra sería el equivocado.
  assert.equal(elegido?.quarter, null);
});
