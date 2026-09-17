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
import { clasificarIntencion, CONTRATO, areasDelMensaje, AREA_KEYWORDS, type Intencion } from '../lib/mako-intencion';

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

// =============================================================================
// El cliente que escribió «OPA» y recibió «No pude armar el borrador con eso»
// =============================================================================
// 2026-08-24. Un cliente estrenó su grupo de MaKo con un saludo de tres letras y
// después preguntó cuál era su oferta. Las dos veces le llegó un mensaje sobre
// borradores del plan. El dueño lo leyó como que MaKo creía que todo era una
// tarea — y tenía razón a medias: eso hacía el clasificador, y encima el texto
// del error lo confirmaba.

test('Un saludo o una prueba del canal NO es material para el plan', () => {
  // «OPA» caía al default (`capturar`, con la tool OBLIGATORIA): se le pedía al
  // modelo parir una tarea de un saludo. La regla de saludo YA existía —solo le
  // faltaban las aperturas rioplatenses y las palabras con las que alguien
  // prueba un canal nuevo—, así que se amplió esa en vez de escribir otra.
  for (const s of ['OPA', 'opa!', 'Ola', 'che', 'holis', 'test', 'prueba', 'probando', 'ping', 'Hola']) {
    const i = clasificarIntencion(s, { hayMedia: false, hayPendientes: false, hayContacto: false });
    assert.equal(i.intencion, 'charlar', `«${s}» volvió a clasificarse como ${i.intencion}`);
  }
});

test('Un saludo que ADEMÁS trae material sigue siendo material', () => {
  // El tope de largo existe justamente por esto: «hola, anotá esto» empieza
  // igual que «hola». Si el saludo se comiera al pedido, el arreglo de arriba
  // habría cambiado un bug por otro peor — perder trabajo en vez de sobrar una
  // tarea.
  const i = clasificarIntencion(
    'Hola MaKo, anotá esto para el plan: rehacer los creativos de la campaña de captación y medir el CPL',
    { hayMedia: false, hayPendientes: false, hayContacto: false },
  );
  assert.equal(i.intencion, 'capturar', 'un pedido explícito con saludo adelante dejó de capturarse');
});

test('Una clasificación DUDOSA no puede obligar a llamar la herramienta', () => {
  // `dudosa: true` significa, textual, «sin señal clara». El default de ese caso
  // es `capturar`, que tiene forzarTool: true — o sea que una ADIVINANZA era más
  // fuerte que una clasificación segura. Es «el fallback es más débil que el
  // camino feliz, nunca más fuerte» (AGENTS.md) dado vuelta.
  const src = readFileSync(new URL('../lib/mako-doer-in.ts', import.meta.url), 'utf8');
  assert.match(
    src,
    /CONTRATO\[intencion\.intencion\]\.forzarTool && !intencion\.dudosa/,
    'una intención dudosa volvió a forzar la tool: se le pide al modelo inventar una tarea de cualquier cosa',
  );
});

test('areasDelMensaje: nombra las áreas del pedido, y un mensaje sin área no suma nada', () => {
  // Es lo que decide qué herramientas del registro (lib/api-mako) se suman a un turno
  // del doer. Sin área nombrada, el turno lleva las de siempre y nada más: una
  // adivinanza no puede sumar capacidades de escritura.
  assert.deepEqual(areasDelMensaje('hola MaKo, ¿todo bien?'), []);
  assert.ok(areasDelMensaje('pausá la secuencia de nutrición de los no-show').includes('chatbot'));
  assert.ok(areasDelMensaje('¿cuánto invertí en Meta este mes?').includes('metricas'));
  assert.ok(areasDelMensaje('mandá el broadcast del lunes por email').includes('email'));
  assert.ok(areasDelMensaje('mové a Ana a la etapa de agendados').includes('crm'));
  assert.ok(areasDelMensaje('¿cómo va el objetivo del trimestre?').includes('general'));
  // Cada área tiene su patrón: la tabla es exhaustiva (el tipo lo exige) y ninguno
  // matchea el texto vacío.
  for (const [area, re] of Object.entries(AREA_KEYWORDS)) assert.ok(!re.test(''), `el patrón de ${area} matchea vacío`);
});

