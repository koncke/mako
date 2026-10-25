// =============================================================================
// El Media Buyer con la estructura de AdAmigo (25/10/2026): lo puro de la pantalla nueva
// =============================================================================
// Martín, 25/10/2026: «Me gusta el de "AdAmigo" implementalo de punta en punta... en el onboarding, me imagino a la
// calculadora que hicimos para saber cuanto invertir, todo con el chat de MaKo, como Offer... recuerda que tenemos varios
// CRM, varios productos». Lo que fija: el arranque pregunta SÓLO lo que falta y nunca inventa el costo del cliente; la cuenta
// por producto no inventa productos y respeta la precedencia del CRM (un conjunto gana a su campaña); y la tarjeta dice el
// cambio y lo que hace con el artículo correcto.
// Correr: node --import tsx --test tests/media-buyer-adamigo.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COSTO_SUPUESTO, configDelArranque, entradaDelArranque, leerRespuesta, mensajesDeArranque, pasoDeArranque, sanearRespuestas, tramoDe,
  type ProductoArranque, type RespuestasArranque,
} from '../lib/media-buyer/arranque';
import { lienzo, mapaDeProductos, porProducto, productoDeAccion } from '../lib/media-buyer/productos';
import { cambioDe, impactoEsperado, pestanaAutopilot, queHace } from '../app/ads-manager/mb-modelo';
import { fmtDinero } from '../lib/format';

test('un solo formato de plata en toda la pantalla: el de la casa, con dos decimales sólo si hay centavos', () => {
  // El Cerebro (25/10): la tarjeta decía «US$ 6,40» y la columna «US$ 9.07», «US$ 7.8» y «US$ 2,140».
  assert.deepEqual([9.07, 7.8, 30, 36, 2140, 1250.5].map((n) => fmtDinero(n)), ['$9.07', '$7.80', '$30', '$36', '$2,140', '$1,251']);
  assert.equal(fmtDinero(1250, 'MXN'), 'MX$1,250');
  assert.equal(fmtDinero(null), '—');
});

const P: ProductoArranque[] = [{ id: '1', nombre: 'Mentoría 1 a 1', precio: null }, { id: '2', nombre: 'Curso online', precio: null }];
const sinMedir = { costoMedido: null };

test('el arranque pregunta SÓLO lo que falta, en orden, y con un solo producto no pregunta cuál', () => {
  const paso = (conectada: boolean, r: RespuestasArranque, productos = P, costoMedido: number | null = null) => pasoDeArranque({ conectada, r, productos, costoMedido });
  assert.equal(paso(false, {}), 'cuenta');
  assert.equal(paso(true, {}), 'producto');
  assert.equal(paso(true, {}, [P[0]]), 'resultado', 'un solo producto: no se pregunta cuál');
  assert.equal(paso(true, { producto: P[0] }), 'resultado');
  assert.equal(paso(true, { producto: P[0], kpi: 'lead' }), 'ticket');
  assert.equal(paso(true, { producto: P[0], kpi: 'lead', ticket: 600 }), 'costo');
  assert.equal(paso(true, { producto: P[0], kpi: 'lead', ticket: 600 }, P, 6.4), 'inversion', 'con el costo medido de sus anuncios no se pregunta');
  const casi = { producto: P[0], kpi: 'lead' as const, ticket: 600, costo: { valor: 5, supuesto: true }, inversionMes: 600 };
  assert.equal(paso(true, casi), 'plan');
  assert.equal(paso(true, { ...casi, plan: true }), 'modo');
  assert.equal(paso(true, { ...casi, plan: true, modo: 'propone' }), 'listo');
  assert.deepEqual(['cuenta', 'producto', 'inversion', 'modo'].map((p) => tramoDe(p as never)), [0, 1, 2, 3]);
});

test('la charla: cada pregunta con lo que respondió, y la de ahora con sus opciones', () => {
  const ms = mensajesDeArranque({ nombre: 'Martín', conectada: true, r: { producto: P[1], kpi: 'agenda' }, productos: P, ...sinMedir });
  assert.deepEqual(ms.map((m) => m.de), ['mako', 'mako', 'yo', 'mako', 'yo', 'mako']);
  assert.equal(ms[2].texto, 'Curso online');
  assert.equal(ms[4].texto, 'Agendas');
  assert.match(ms.at(-1)!.texto, /Cuánto te deja una venta/);
  assert.equal(ms.slice(0, -1).some((m) => m.opciones), false, 'sólo la pregunta de ahora trae opciones');
  const prod = mensajesDeArranque({ nombre: 'Martín', conectada: true, r: {}, productos: P, ...sinMedir });
  assert.deepEqual(prod.at(-1)!.opciones, ['Mentoría 1 a 1', 'Curso online', 'Varios a la vez']);
});

test('lo que escribe o toca se entiende: montos con puntos, «No sé» como SUPUESTO dicho, y «otro monto» vuelve a preguntar', () => {
  const x = { productos: P, r: { kpi: 'lead' as const }, costoMedido: null };
  assert.deepEqual(leerRespuesta('ticket', 'US$ 1.500', x), { ticket: 1500 });
  assert.deepEqual(leerRespuesta('costo', 'No sé, usa US$ 5 para empezar', x), { costo: { valor: COSTO_SUPUESTO.lead, supuesto: true } });
  assert.deepEqual(leerRespuesta('costo', '7,5', x), { costo: { valor: 7.5, supuesto: false } });
  assert.deepEqual(leerRespuesta('resultado', 'Ventas', x), { kpi: 'venta' });
  assert.equal(leerRespuesta('producto', 'Algo que no existe', x), null);
  const otro = leerRespuesta('plan', 'Probar con otro monto', x)!;
  assert.ok('inversionMes' in otro && otro.inversionMes === undefined && 'plan' in otro, 'borra la inversión y el plan para volver a preguntar');
});

test('la calculadora no arranca sin un costo: ni del cliente ni supuesto, no se inventa', () => {
  const r: RespuestasArranque = { kpi: 'lead', ticket: 600, inversionMes: 600 };
  assert.equal(entradaDelArranque(r, null, null, 3, 3), null);
  const medida = entradaDelArranque(r, 6.4, 8, 3, 3)!;
  assert.equal(medida.costoPorResultado, 6.4, 'lo medido de sus anuncios');
  assert.equal(medida.cierre, 8);
  assert.equal(entradaDelArranque({ ...r, costo: { valor: 5, supuesto: true } }, null, null, 0, 0)!.avatares, 1, 'al menos un avatar');
  assert.equal('cierre' in entradaDelArranque({ ...r, kpi: 'venta', costo: { valor: 60, supuesto: true } }, null, null, 3, 3)!, false, 'con ventas no hay cierre');
});

test('al terminar se guarda el resultado, el modo, el tope diario y las metas del mes del plan', () => {
  const c = configDelArranque({ kpi: 'lead', inversionMes: 600, modo: 'piloto' }, { facturacion: 7200 } as never);
  assert.deepEqual(c, { encendido: true, modo: 'piloto', kpi: 'lead', presupuestoMaxDia: 20, metaGastoMes: 600, metaVentasMes: 7200 });
  assert.equal(configDelArranque({}, null).modo, 'propone', 'sin elegir, propone (nunca piloto por defecto)');
});

test('lo que llega del navegador se sanea: lo desconocido se va y los números raros también', () => {
  const s = sanearRespuestas({ kpi: 'leads', ticket: -3, inversionMes: 600, costo: { valor: 5, supuesto: 'si' }, modo: 'piloto', hackeo: true, producto: { nombre: '  Mentoría ', id: 9 } });
  assert.deepEqual(s, { inversionMes: 600, costo: { valor: 5, supuesto: false }, modo: 'piloto', producto: { id: null, nombre: 'Mentoría', precio: null } });
  assert.deepEqual(sanearRespuestas('nada'), {});
});

const F = [{ id: 1, nombre: 'Funnel principal', producto: 'Mentoría 1 a 1', esDefault: true }, { id: 2, nombre: 'Funnel curso', producto: null, esDefault: false }];

test('la cuenta por producto: sin asignaciones no se inventa nada; un conjunto gana a su campaña; lo sin asignar no suma', () => {
  const s = [
    { campana: '030 · Mentoría', adset_name: 'Pymes', spend_usd: 60, leads_crm: 10, agendas: 3, cierres: 1 },
    { campana: '030 · Mentoría', adset_name: 'Retargeting', spend_usd: 40, leads_crm: 2, agendas: 1, cierres: 0 },
    { campana: 'Sin asignar', adset_name: null, spend_usd: 99, leads_crm: 9, agendas: 9, cierres: 9 },
  ];
  assert.deepEqual(porProducto(s, [], F, 'lead', 10), []);
  const asig = [
    { tipo: 'campana' as const, id: 'c1', nombre: '030 · Mentoría', funnelId: null },
    { tipo: 'conjunto' as const, id: 's2', nombre: 'Retargeting', funnelId: 2 },
  ];
  const r = porProducto(s, asig, F, 'lead', 10);
  assert.deepEqual(r.map((x) => [x.nombre, x.gasto, x.resultados, x.costo, x.tono]), [
    ['Mentoría 1 a 1', 60, 10, 6, 'bien'],
    ['Funnel curso', 40, 2, 20, 'mal'],
  ]);
  assert.equal(porProducto(s, asig, F, 'agenda', null)[0].resultados, 3, 'cuenta el resultado que se busca');
});

test('el lienzo: cada campaña en el producto de su asignación (o el de sus conjuntos), los productos sin campañas también, y lo sin asignar aparte', () => {
  const campanas = [
    { id: 'c1', nombre: '030 · Mentoría', prendida: true, presupuestoDia: 30, conjuntos: 2 },
    { id: 'c2', nombre: '028 · Curso', prendida: false, presupuestoDia: null, conjuntos: 1 },
    { id: 'c3', nombre: 'Prueba suelta', prendida: true, presupuestoDia: 10, conjuntos: 1 },
  ];
  const senales = [
    { campana: '030 · MENTORÍA', adset_name: 'Pymes', spend_usd: 60, leads_crm: 10, agendas: 2, cierres: 1 },
    { campana: '028 · Curso', adset_name: 'Todos', spend_usd: 40, leads_crm: 2, agendas: 0, cierres: 0 },
  ];
  const asig = [
    { tipo: 'campana' as const, id: 'c1', nombre: '030 · Mentoría', funnelId: null },
    { tipo: 'conjunto' as const, id: 's9', nombre: 'Todos', funnelId: 2, campanaId: 'c2' },
  ];
  const F3 = [...F, { id: 3, nombre: 'Funnel comunidad', producto: 'Comunidad', esDefault: false }];
  const { productos, sinProducto } = lienzo(campanas, senales, asig, F3, 'lead', 10);
  const de = (n: string) => productos.find((p) => p.nombre === n)!;
  assert.deepEqual(de('Mentoría 1 a 1').campanas.map((c) => [c.id, c.gasto, c.resultados, c.costo, c.tono]), [['c1', 60, 10, 6, 'bien']]);
  assert.deepEqual(de('Funnel curso').campanas.map((c) => c.id), ['c2'], 'sin asignación propia, va al producto de su conjunto');
  // El nombre es el de la casa (nombreVisible): un funnel con nombre propio se llama así, no por su producto.
  assert.deepEqual(de('Funnel comunidad').campanas, [], 'un producto sin campañas también aparece');
  assert.deepEqual(sinProducto.map((c) => c.id), ['c3']);
  assert.equal(de('Funnel curso').costo, 20);
});

test('el producto de cada acción: por id, o por el nombre de su campaña (sin importar mayúsculas)', () => {
  const mapa = mapaDeProductos([{ tipo: 'campana', id: 'c1', nombre: '030 · Mentoría', funnelId: null }, { tipo: 'conjunto', id: 's2', nombre: 'Retargeting', funnelId: 2 }], F);
  assert.equal(productoDeAccion(mapa, { nivel: 'adset', entidadId: 's2', entidadNombre: 'Retargeting', campanaNombre: '030 · Mentoría' }), 'Funnel curso');
  assert.equal(productoDeAccion(mapa, { nivel: 'ad', entidadId: 'a9', entidadNombre: 'Video', campanaNombre: '030 · MENTORÍA' }), 'Mentoría 1 a 1');
  assert.equal(productoDeAccion(mapa, { nivel: 'ad', entidadId: 'a9', entidadNombre: 'Video', campanaNombre: 'Otra' }), null);
});

test('la tarjeta: la pestaña de Autopilot, el antes → después con su %, y el artículo correcto', () => {
  const auto = (t: string) => t === 'stop_loss';
  assert.equal(pestanaAutopilot({ estado: 'abierta', tactica: 'surf' }, auto), 'hoy');
  assert.equal(pestanaAutopilot({ estado: 'abierta', tactica: 'stop_loss' }, auto), 'programadas', 'una táctica automática la lanza el piloto');
  assert.equal(pestanaAutopilot({ estado: 'aplicada', tactica: 'surf' }, auto), 'implementadas');
  assert.equal(pestanaAutopilot({ estado: 'bloqueada', tactica: 'surf' }, auto), 'bloqueadas');
  assert.deepEqual(cambioDe({ antes: { presupuesto: 50 }, despues: { presupuesto: 40 }, moneda: 'USD' }), { antes: '$50', despues: '$40/día', pct: '-20%' });
  assert.deepEqual(cambioDe({ antes: { estado: 'ACTIVE' }, despues: { estado: 'PAUSED' }, moneda: 'USD' })?.despues, 'Pausado');
  const base = { entidadNombre: 'X', campanaNombre: 'C', antes: {}, despues: {}, moneda: 'USD', variaciones: [] };
  assert.equal(queHace({ ...base, tipo: 'pausar', nivel: 'campaign', campanaNombre: null }), 'Pausar la campaña «X».');
  assert.equal(queHace({ ...base, tipo: 'activar', nivel: 'ad' }), 'Prender el anuncio «X» (campaña «C»).');
  assert.match(impactoEsperado({ tipo: 'pausar', tactica: 'calidad' }, 'lead')[0], /no agendan/);
});
