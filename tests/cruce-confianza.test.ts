// =============================================================================
// «Agregar 3 al plan» sobre una reunión de la que salían once cosas suyas
// =============================================================================
// 12/8/2026. De las 11 tareas propias de «Mau <> Martin: CUSTOMER SUCCESS», 8 llegaron
// DESTILDADAS porque el cruce anti-duplicados dijo «ya está en tu plan» con confianza
// «alta». Las OCHO eran falsas. El Jaccard de palabras clave contra la tarjeta con la que
// las cruzó, medido:
//
//     Conectar el Second Brain con el Cloud Code   → «Tab SuperAdmin: modelo de IA…»  0.00
//     Agregar infinitos guiones en el Ads Writer   → «Escritor de VSL + DMs…»         0.00
//     Desactivar el bot de ManyChat de Instagram   → «Cerrar el canal no oficial…»    0.00
//     Editar/crear avatares en Ads Writer          → «Escritor de VSL + DMs…»         0.00
//     Actualizar el plan del curso de CS           → «Configurar Fathom e IA…»        0.09
//
// Y en la reunión anterior, «GUIONES + VSL + LANDING», fueron 16 de 16 — con UNA tarjeta
// llevándose CUATRO candidatas distintas.
//
// Un falso «alta» no molesta: esconde un pedido real de una reunión, en silencio. Por eso
// la confianza del modelo dejó de ser la confianza.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { degradarConfianza, compartenAlgo } from '../lib/cruce-confianza';

const alta = (i: number, id: string) => ({ i, idExistente: id, confianza: 'alta' as const });

test('EL CASO REAL: cero palabras en común no es «la misma dicha de otro modo»', () => {
  const { cruces, degradados } = degradarConfianza(
    [alta(0, 't130')],
    [{ titulo: 'Conectar el Second Brain de MaKo con el Cloud Code para generar guiones' }],
    [{ id: 't130', titulo: 'Tab SuperAdmin: modelo de IA por tarea (editable)' }],
  );
  assert.equal(cruces[0].confianza, 'media');
  assert.match(degradados[0].porQue, /NINGUNA palabra/);
});

test('EL CASO REAL: una tarjeta no puede llevarse dos candidatas distintas', () => {
  // t51 se llevó «infinitos guiones en el Ads Writer» Y «editar/crear avatares en Ads
  // Writer». A lo sumo una es la misma, y no sabemos cuál: bajan las dos.
  const { cruces, degradados } = degradarConfianza(
    [alta(0, 't51'), alta(1, 't51')],
    [{ titulo: 'Agregar opción para generar infinitos guiones en el Ads Writer' },
     { titulo: 'Agregar función para editar/crear avatares en Ads Writer' }],
    [{ id: 't51', titulo: 'Escritor de VSL + escritor de DMs + loop analizar escribir producir' }],
  );
  assert.equal(cruces[0].confianza, 'media');
  assert.equal(cruces[1].confianza, 'media');
  assert.equal(degradados.length, 2);
  assert.match(degradados[0].porQue, /2 candidatas/);
});

test('NUNCA se descarta un cruce: la marca y su razón se conservan enteras', () => {
  // Bajar a «media» no apaga el aviso — la tarea sigue con el cartel verde diciendo de
  // qué la marcó. Lo único que pierde es el poder de destildarse sola.
  const entrada = [{ i: 0, idExistente: 't1', razon: 'ya está en tu plan como «X»', accion: 'enriquece' as const, confianza: 'alta' as const }];
  const { cruces } = degradarConfianza(entrada, [{ titulo: 'nada que ver' }], [{ id: 't1', titulo: 'otra cosa' }]);
  assert.equal(cruces.length, 1);
  assert.equal(cruces[0].razon, 'ya está en tu plan como «X»');
  assert.equal(cruces[0].accion, 'enriquece', 'el tipo del caller viaja entero');
  assert.equal(cruces[0].idExistente, 't1');
});

test('EL CASO QUE JUSTIFICA EL CRUCE CON IA SOBREVIVE: 15% de palabras alcanza', () => {
  // «Mensaje de WhatsApp después de agendar» y «follow-up post-agendamiento» son el mismo
  // trabajo y comparten poco léxico: eso lo ve el Perro y no un Jaccard. Si el piso fuera
  // un umbral en vez de «al menos una palabra», este caso moriría y con él la feature.
  const { cruces, degradados } = degradarConfianza(
    [alta(0, 't1')],
    [{ titulo: 'Armar el mensaje de WhatsApp después de agendar la reunión' }],
    [{ id: 't1', titulo: 'Follow-ups y el mensaje post-llamada que redacta MaKo' }],
  );
  assert.equal(cruces[0].confianza, 'alta', 'comparten «mensaje»: el modelo puede decidir');
  assert.equal(degradados.length, 0);
});

test('un lote donde CASI TODO es «alta» es un lote donde no se comparó nada', () => {
  // Medido: 16 de 16. Aunque cada par comparta una palabra, que el 100% del lote sea
  // duplicado no describe ninguna reunión real.
  const n = 6;
  const cruces = Array.from({ length: n }, (_, i) => alta(i, `t${i}`));
  const cands = Array.from({ length: n }, (_, i) => ({ titulo: `hacer la cosa numero ${i}` }));
  const exs = Array.from({ length: n }, (_, i) => ({ id: `t${i}`, titulo: `hacer la cosa numero ${i}` }));
  const r = degradarConfianza(cruces, cands, exs);
  assert.equal(r.degradados.length, n);
  assert.match(r.degradados[0].porQue, /no discriminó/);
});

test('…pero con pocos cruces no se aplica: dos de dos es normal', () => {
  // El corte de lote pide 4 o más. Una reunión corta que trae dos cosas ya pedidas es
  // perfectamente creíble, y castigarla sería el falso negativo de este chequeo.
  const r = degradarConfianza(
    [alta(0, 't1'), alta(1, 't2')],
    [{ titulo: 'revisar el reporte mensual' }, { titulo: 'mandar la factura de agosto' }],
    [{ id: 't1', titulo: 'revisar el reporte mensual' }, { id: 't2', titulo: 'mandar la factura de agosto' }],
  );
  assert.equal(r.degradados.length, 0);
});

test('la SEGUNDA grabación de la misma llamada puede matchear entero sin sospecha', () => {
  // Un notetaker por participante deja dos borradores del mismo contenido: ahí que TODO
  // cruce contra el borrador hermano es lo correcto. Por eso el chequeo del lote mira
  // solo los cruces contra el TABLERO.
  const n = 5;
  const cruces = Array.from({ length: n }, (_, i) => alta(i, `borrador:${i}`));
  const cands = Array.from({ length: n }, (_, i) => ({ titulo: `compromiso ${i} de la junta` }));
  const exs = Array.from({ length: n }, (_, i) => ({ id: `borrador:${i}`, titulo: `compromiso ${i} de la junta` }));
  assert.equal(degradarConfianza(cruces, cands, exs).degradados.length, 0);
});

test('«media» no se toca: la regla solo le quita poder a «alta»', () => {
  const medios = [{ i: 0, idExistente: 't1', confianza: 'media' as const }];
  const r = degradarConfianza(medios, [{ titulo: 'nada que ver' }], [{ id: 't1', titulo: 'otra cosa' }]);
  assert.equal(r.cruces[0].confianza, 'media');
  assert.equal(r.degradados.length, 0);
});

test('no se cuelga sin datos: una tarjeta que ya no existe no rompe el lote', () => {
  const r = degradarConfianza([alta(0, 'fantasma')], [{ titulo: 'algo' }], []);
  assert.equal(r.cruces[0].confianza, 'media', 'sin tarjeta con qué comparar, no hay «alta» que sostener');
  assert.equal(degradarConfianza([], [], []).cruces.length, 0);
});

test('compartenAlgo mira palabras con CONTENIDO, no «de» ni «la»', () => {
  assert.equal(compartenAlgo('cerrar el canal de whatsapp', 'abrir la cuenta de instagram'), false);
  assert.equal(compartenAlgo('cerrar el canal de whatsapp', 'revisar el canal nuevo'), true);
  assert.equal(compartenAlgo('', 'algo'), false);
});
