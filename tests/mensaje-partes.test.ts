// =============================================================================
// Un mensaje de WhatsApp con VARIAS partes (cuarta tanda, punto 15): el modelo
// =============================================================================
// lib/mensaje-partes.ts. Lo que fija este test:
//   · lo guardado ANTES se lee como sus partes sin migrar nada (un audio con pie son dos burbujas);
//   · una sola parte se guarda en los campos de siempre (`partes` ni aparece), y varias en `partes`
//     con la primera copiada en los campos de siempre;
//   · un escritor que no sabe de partes cambia la PRIMERA sin borrar las demás, y `partes: []` (el
//     editor) sí las borra: ausente no es vacío;
//   · lo imposible (una parte sin archivo, varias por el oficial o por email) se rechaza al guardar;
//   · la marca de cuántas salieron, que es lo que evita duplicar al reintentar;
//   · el borrador del setter: un archivo y los textos juntos, nunca dos archivos.
//
// Probado rompiéndolo (09/10/2026, arnés del scratchpad: una rotura por vez, restaurada de memoria;
// base 8 / 8): 7 roturas, 7 cazadas.
//   1. `partesDeLegado` sin el pie del audio (sólo el audio)                    → 2 rojos.
//   2. `partesAlGuardar` tratando `partes: []` como ausente (`p.partes?.length`) → 1.
//   3. `partesAlGuardar` sin la cabeza de los campos de siempre (sólo `crudas`) → 1.
//   4. `formaGuardada` sin el caso «audio + texto» (lo guardaba como varias)    → 1.
//   5. `problemaDePartes` sin mirar el proveedor                                → 1.
//   6. `partesYaSalidas` aceptando la marca en un envío 'enviado'               → 1.
//   7. `borradorDePartes` con dos archivos tomando el primero                   → 1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  partesDe, partesDeLegado, partesExplicitas, formaGuardada, partesAlGuardar, problemaDePartes,
  marcaPartes, partesYaSalidas, borradorDePartes, sanearPartes, esUnTexto, TOPE_PARTES, type ParteMensaje,
} from '../lib/mensaje-partes';

const texto = (cuerpo: string): ParteMensaje => ({ tipo: 'texto', cuerpo });
const audio = (id: number): ParteMensaje => ({ tipo: 'audio', audio_id: id });
const media = (id: number, cuerpo?: string): ParteMensaje => (cuerpo ? { tipo: 'media', media_id: id, cuerpo } : { tipo: 'media', media_id: id });
const wa = { canal: 'whatsapp', proveedor: 'no_oficial' as const };

test('lo guardado antes se lee como sus partes, sin migrar: un audio con pie son dos burbujas', () => {
  assert.deepEqual(partesDeLegado({ ...wa, tipo: 'audio', audio_id: 7, cuerpo: 'Link: https://x.y' }), [audio(7), texto('Link: https://x.y')]);
  assert.deepEqual(partesDeLegado({ ...wa, tipo: 'audio', audio_id: 7, cuerpo: '' }), [audio(7)]);
  assert.deepEqual(partesDeLegado({ ...wa, tipo: 'media', media_id: 3, cuerpo: 'Los precios' }), [media(3, 'Los precios')], 'el caption va adentro del archivo');
  assert.deepEqual(partesDeLegado({ ...wa, cuerpo: 'Hola' }), [texto('Hola')]);
  assert.deepEqual(partesDeLegado({ ...wa, tipo: 'ia', cuerpo: 'Saluda' }), [texto('Saluda')]);
  assert.deepEqual(partesDeLegado({ ...wa, cuerpo: '   ' }), [], 'un texto vacío no es una burbuja');
  // Un audio de antes con pie NO es «varias partes» para el motor: sigue por la rama de siempre.
  assert.equal(partesExplicitas({ ...wa, tipo: 'audio', audio_id: 7, cuerpo: 'pie' }), null);
});

test('una sola parte se guarda como siempre; varias, en `partes` con la primera de espejo', () => {
  assert.deepEqual(formaGuardada([texto('Hola')]), { tipo: 'texto', cuerpo: 'Hola', audio_id: null, media_id: null, partes: [] });
  assert.deepEqual(formaGuardada([texto('Hola')], true).tipo, 'ia', '«MaKo lo adapta» sobrevive con un solo texto');
  // El audio seguido de un texto ES el audio con pie de siempre: no hace falta `partes`.
  assert.deepEqual(formaGuardada([audio(7), texto('Link')]), { tipo: 'audio', cuerpo: 'Link', audio_id: 7, media_id: null, partes: [] });
  const tres = formaGuardada([audio(7), texto('Link'), media(3, 'PDF')], true);
  assert.deepEqual(tres, { tipo: 'audio', cuerpo: '', audio_id: 7, media_id: null, partes: [audio(7), texto('Link'), media(3, 'PDF')] });
  assert.equal(formaGuardada([texto('a'), texto('b')], true).tipo, 'texto', 'MaKo reescribe UN texto, no una lista');
  assert.deepEqual(formaGuardada([]), { tipo: 'texto', cuerpo: '', audio_id: null, media_id: null, partes: [] });
  // Y se lee de vuelta igual: la forma guardada es estable.
  assert.deepEqual(partesDe({ ...wa, ...tres }), [audio(7), texto('Link'), media(3, 'PDF')]);
  assert.deepEqual(partesDe({ ...wa, ...formaGuardada([audio(7), texto('Link')]) }), [audio(7), texto('Link')]);
});

test('los campos de siempre MANDAN sobre la primera parte guardada', () => {
  const guardado = { ...wa, ...formaGuardada([texto('Hola'), texto('Link')]) };
  // Un escritor que no sabe de partes cambió el texto del paso: cambia la primera, las demás siguen.
  assert.deepEqual(partesDe({ ...guardado, cuerpo: 'Buenas' }), [texto('Buenas'), texto('Link')]);
});

test('al guardar: sin `partes` se conservan las que había; con `partes: []` se borran (ausente ≠ vacío)', () => {
  const previas = [texto('Hola'), texto('Link'), audio(9)];
  // Un escritor viejo (el generador, una tool de la API) manda el paso sin la clave.
  const viejo = partesAlGuardar({ ...wa, cuerpo: 'Buenas' }, previas);
  assert.deepEqual(viejo.partes, [texto('Buenas'), texto('Link'), audio(9)], 'la primera es la de sus campos y las demás sobreviven');
  assert.equal(viejo.variantes, undefined, 'varias partes no sortean variantes');
  // El editor dice «una sola» con `[]`: lo que había se va.
  assert.deepEqual(partesAlGuardar({ ...wa, cuerpo: 'Buenas', partes: [] }, previas), { partes: undefined });
  // Un mensaje de los de siempre, sin partes guardadas: no se toca NADA.
  assert.deepEqual(partesAlGuardar({ ...wa, cuerpo: 'Hola' }, undefined), {});
  // «MaKo lo adapta» no vive en un paso de varias partes.
  assert.equal(partesAlGuardar({ ...wa, tipo: 'ia', cuerpo: 'Saluda', partes: [texto('Saluda'), texto('Link')] }).tipo, 'texto');
  // Un paso que pasó al oficial suelta las conservadas: el canal lo eligió quien guarda.
  assert.deepEqual(partesAlGuardar({ canal: 'whatsapp', proveedor: 'oficial', template_wa: 'x', cuerpo: 'Hola' }, previas), { partes: undefined });
});

test('lo imposible se rechaza al guardar, con el porqué', () => {
  assert.equal(problemaDePartes({ ...wa, partes: [texto('a'), texto('b')] }), null);
  assert.equal(problemaDePartes({ ...wa, partes: [] }), null, '`[]` es «una sola»');
  assert.match(problemaDePartes({ ...wa, partes: [texto('a'), { tipo: 'media' }] }) ?? '', /sin su texto o su archivo/);
  assert.match(problemaDePartes({ canal: 'email', partes: [texto('a'), texto('b')] }) ?? '', /email/);
  assert.match(problemaDePartes({ canal: 'whatsapp', proveedor: 'oficial', partes: [texto('a'), texto('b')] }) ?? '', /oficial/);
  const muchas = Array.from({ length: TOPE_PARTES + 1 }, (_, i) => texto(`m${i}`));
  assert.match(problemaDePartes({ ...wa, partes: muchas }) ?? '', /más de/);
});

test('el saneo tira lo que no se puede mandar y topea', () => {
  assert.deepEqual(sanearPartes([{ tipo: 'texto', cuerpo: '  ' }, { tipo: 'audio' }, { tipo: 'media', media_id: '4', cuerpo: '' }, 'x', null]), [media(4)]);
  assert.equal(sanearPartes(Array.from({ length: 10 }, () => texto('a'))).length, TOPE_PARTES);
  assert.equal(esUnTexto([texto('a')]), true);
  assert.equal(esUnTexto([audio(1)]), false);
  assert.equal(esUnTexto([texto('a'), texto('b')]), false);
});

test('la marca de cuántas salieron: sólo en un fallo, y con su formato exacto', () => {
  assert.equal(partesYaSalidas({ estado: 'fallo', asunto: marcaPartes(2) }), 2);
  assert.equal(partesYaSalidas({ estado: 'enviado', asunto: marcaPartes(2) }), 0, 'un envío completo vuelve a empezar (un «Ir a» que vuelve a esta tarjeta)');
  assert.equal(partesYaSalidas({ estado: 'fallo', asunto: null }), 0);
  assert.equal(partesYaSalidas({ estado: 'fallo', asunto: 'partes salidas: 2 de 3' }), 0, 'un formato distinto no es la marca');
  assert.equal(partesYaSalidas(null), 0);
});

test('el borrador del setter: el único archivo y los textos juntos; con dos archivos no se arma', () => {
  assert.deepEqual(borradorDePartes([audio(7), texto('Link')]), { ok: true, texto: 'Link', audioId: 7, adjuntoId: null });
  assert.deepEqual(borradorDePartes([texto('Hola'), media(3, 'PDF'), texto('Chau')]), { ok: true, texto: 'Hola\n\nPDF\n\nChau', audioId: null, adjuntoId: 3 });
  assert.deepEqual(borradorDePartes([texto('a'), texto('b')]), { ok: true, texto: 'a\n\nb', audioId: null, adjuntoId: null });
  const dos = borradorDePartes([audio(7), media(3)]);
  assert.equal(dos.ok, false, 'tomar el primero perdería el otro en silencio');
});
