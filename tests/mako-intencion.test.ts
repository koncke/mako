// =============================================================================
// La intención del turno: qué te están pidiendo, decidido por CÓDIGO
// =============================================================================
// El corpus de abajo NO es inventado: son los mensajes REALES que el dueño mandó
// al grupo de MaKo entre el 26/7 y el 12/8 (tabla mako_doer_conv). Se copian acá
// porque son la única prueba de que la clasificación sirve para cómo escribe él
// —infinitivos, encabezados en mayúscula, links pelados— y no para cómo
// imaginamos que escribiría.
//
// El caso que abre el archivo es el que rompió: mismo formato que los cinco
// anteriores, y el sexto devolvió un ensayo sobre material de 33 horas antes.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clasificarIntencion, CONTRATO, type Intencion } from '../lib/mako-intencion';

const intencionDe = (t: string, ctx?: { hayPendientes?: boolean; hayMedia?: boolean }) =>
  clasificarIntencion(t, ctx).intencion;

test('EL CASO: un volcado de ideas con links se CAPTURA, no se contesta', () => {
  const elQueRompio = 'Investigar competencia:\n\nhttps://www.instagram.com/sergiozaragozax\n\nhttps://www.viralclip.io/';
  const v = clasificarIntencion(elQueRompio);
  assert.equal(v.intencion, 'capturar', 'volvió a leerse como un pedido de análisis');
  assert.equal(v.dudosa, false, 'la señal es limpia: infinitivo de título, sin imperativo');
});

test('Los volcados reales del dueño se capturan (corpus de mako_doer_conv)', () => {
  // Textualmente como los mandó. Si alguno deja de capturar, ese mensaje se
  // habría perdido en una respuesta.
  const volcados = [
    'Tengo ideas:\n1. Que el board tenga filtros\n2. Que se pueda ordenar',
    'Idea:\n\nINVESTIGAR Y COPIAR EL BRANDING DEL DASHBOARD DE ESTA CHICA:\nhttps://www.instagram.com/reel/DbwfkLPp36B/',
    'INVESTIGAR:\nhttps://www.instagram.com/reel/DZss3EzErZQ/',
    'Idea para la Ads Content Machine:\nSacar los ángulos de los comentarios',
    'COMPETENCIA DE ALGUIEN QUE VENDE UN SOFTWARE:\nhttps://ejemplo.com',
    'FUNCIONALIDADES DESEADAS:\nQue se pueda exportar el board',
    'VSL:\nGrabar la versión corta',
    'SISTEMA DE PUNTAJE.\nQue cada tarea tenga un puntaje de impacto',
    'SI ALGUIEN ME PROPONE UNA FUNCIONALIDAD, PUEDO COBRARLE POR DESARROLLARLA',
    'Idea para la content machine:\n\nhttps://www.instagram.com/p/DauN83qggy9/\n\nAngulo disruptivo.',
  ];
  for (const v of volcados) {
    assert.equal(intencionDe(v), 'capturar', `dejó de capturarse: «${v.split('\n')[0]}»`);
  }
});

test('Un pedido de verdad a MaKo NO se captura', () => {
  // La diferencia con los de arriba es de una letra: infinitivo vs voseo.
  assert.equal(intencionDe('investigá la competencia de viralclip'), 'pensar');
  assert.equal(intencionDe('armame el copy del anuncio'), 'pensar');
  assert.equal(intencionDe('pausá la campaña 029'), 'actuar');
  assert.equal(intencionDe('¿cuántas reuniones tengo mañana?'), 'consultar');
  assert.equal(intencionDe('decime cuántos leads entraron hoy'), 'consultar',
    'un «decime <interrogativo>» es una consulta: mandarlo a pensar lo tarifa como análisis');
});

test('«Investigar» vs «investigá»: la tilde es la que decide', () => {
  assert.equal(intencionDe('Investigar la competencia'), 'capturar');
  assert.equal(intencionDe('investigá la competencia'), 'pensar');
  // Y el sesgo declarado: sin tilde NO es imperativo, así que se captura. Es el
  // error barato — queda anotado. El inverso pierde el material.
  assert.equal(intencionDe('investiga la competencia'), 'capturar');
});

test('Un «sí» acentuado confirma (el bug del \\b con tildes)', () => {
  // `\b` en JS se calcula con `\w`, que no incluye «í»: con /(s[ií])\b/ la forma
  // MÁS común de decir que sí no matcheaba y caía al default.
  for (const s of ['sí', 'sí, dale', 'Sí dale cargalo']) {
    assert.equal(intencionDe(s, { hayPendientes: true }), 'confirmar', `no confirmó: «${s}»`);
  }
  // Sin nada esperando, un «sí» suelto no es material: no puede parir tareas.
  assert.equal(intencionDe('sí, dale', { hayPendientes: false }), 'charlar');
});

test('CONTRATO: capturar y confirmar OBLIGAN a llamar una tool', () => {
  // Es la diferencia entre «el prompt se lo pide» y «el código se lo exige».
  // Sin esto, capturar funcionaba el 80% de las veces — que es como se llegó acá.
  assert.equal(CONTRATO.capturar.forzarTool, true);
  assert.equal(CONTRATO.confirmar.forzarTool, true);
  assert.equal(CONTRATO.capturar.exigeBorrador, true,
    'sin validación de salida, un turno de captura puede terminar en texto y nadie se entera');

  // Y capturar NO puede ver las tools de escritura sobre la cuenta: anotar una
  // idea jamás debería poder mover un lead o tocar una campaña.
  const permitidas = CONTRATO.capturar.tools;
  assert.ok(Array.isArray(permitidas), 'capturar dejó de acotar las tools');
  for (const t of permitidas as string[]) {
    assert.ok(!/^proponer_(cambio_etapa|toggle|renombrar|presupuesto|estado|agendar)/.test(t),
      `capturar puede llamar «${t}», que escribe sobre la cuenta`);
  }
});

test('Toda intención tiene contrato: una capacidad nueva no puede entrar sin decidirlo', () => {
  const todas: Intencion[] = ['capturar', 'confirmar', 'consultar', 'actuar', 'pensar', 'charlar'];
  for (const i of todas) {
    assert.ok(CONTRATO[i], `la intención «${i}» no tiene contrato`);
    assert.ok(typeof CONTRATO[i].forzarTool === 'boolean');
  }
  assert.deepEqual(Object.keys(CONTRATO).sort(), [...todas].sort(),
    'el catálogo y el contrato se desincronizaron: una intención sin fila es una que hereda cualquier cosa');
});

test('CABLEADO: la INTENCIÓN manda sobre las tools, no el tier del router', () => {
  const src = readFileSync(new URL('../lib/mako-doer-in.ts', import.meta.url), 'utf8');
  assert.ok(src.includes('clasificarIntencion('), 'el doer dejó de clasificar la intención');
  assert.ok(src.includes('toolsParaIntencion(intencion.intencion'),
    'las tools volvieron a elegirse por el motivo del router, que contesta otra pregunta');
  assert.ok(src.includes('CONTRATO[intencion.intencion].forzarTool'),
    'la obligación de llamar la tool dejó de salir del contrato');
});

test('CABLEADO: el historial entra MARCADO como contexto, no como pedido', () => {
  const src = readFileSync(new URL('../lib/mako-doer-in.ts', import.meta.url), 'utf8');
  assert.ok(/\[CONTEXTO/.test(src),
    'el historial volvió a entrar como mensajes de usuario indistinguibles del pedido de ahora');
  const conv = readFileSync(new URL('../lib/mako-doer-conv.ts', import.meta.url), 'utf8');
  const horas = Number(/HORAS_CONTEXTO = (\d+)/.exec(conv)?.[1] ?? '0');
  assert.ok(horas > 0 && horas <= 24,
    `la ventana de contexto volvió a ${horas} h: con 48 h MaKo contestó un pedido con material de anteayer`);
});
