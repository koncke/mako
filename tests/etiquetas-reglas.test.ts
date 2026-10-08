// =============================================================================
// Las reglas de las etiquetas del CRM que se deciden sin base (lib/etiquetas-reglas.ts)
// =============================================================================
// El nombre y su clave de unicidad (la misma que el índice de la mig 0224), el slug de Chatwoot,
// las listas del sistema de WhatsApp que NO son etiquetas, la sincronización del catálogo del
// celular que NO pisa nombres, quién apunta a una etiqueta dentro de una secuencia, y el
// segmento de email `etiqueta:<id>`.
//
// Correr: node --import tsx --test tests/etiquetas-reglas.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (08/10/2026), una rotura por vez sobre lib/etiquetas-reglas.ts, restaurando
// de memoria (E-romper.py). Con todo puesto: 7 pass / 0 fail. Seis roturas, las seis cazadas:
//   1. `sinMarcasInvisibles` sin el rango U+200B-U+200F → 2 fallos (el nombre limpio y las listas
//      del sistema).
//   2. `planSincronizarCatalogo` devolviendo también el nombre de findLabels para las que ya estaban
//      (el bug viejo: pisar) → 1 fallo.
//   3. podar con una lectura VACÍA → 1 fallo.
//   4. `claveNombre` sin el toLowerCase → 1 fallo.
//   5. `etiquetaDeSegmento` aceptando `etiqueta:0` / `etiqueta:abc` → 1 fallo.
//   6. `usoEnPasos` contando la fila aunque el valor sea OTRA etiqueta → 1 fallo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  limpiarNombreEtiqueta, claveNombre, colorValido, slugChatwoot, esListaDelSistema, catalogoCelular,
  planSincronizarCatalogo, usoEnPasos, etiquetaDeSegmento, TOPE_NOMBRE_ETIQUETA,
} from '../lib/etiquetas-reglas';

test('el nombre se limpia y su clave es la del índice único (mayúsculas y bordes no cuentan)', () => {
  assert.equal(limpiarNombreEtiqueta('  Cualificado  '), 'Cualificado');
  assert.equal(limpiarNombreEtiqueta('Seguimiento\n\tsemanal'), 'Seguimiento semanal');
  assert.equal(limpiarNombreEtiqueta('\u200EFavoritos'), 'Favoritos');
  assert.equal(limpiarNombreEtiqueta(42), '');
  assert.equal(limpiarNombreEtiqueta('x'.repeat(80)).length, TOPE_NOMBRE_ETIQUETA);
  assert.equal(claveNombre(' Cualificado '), claveNombre('cualificado'));
  assert.notEqual(claveNombre('Calificado'), claveNombre('Cualificado'));
  assert.equal(colorValido('#5e81ac'), '#5E81AC');
  assert.equal(colorValido('rojo'), null);
});

test('el slug de Chatwoot: minúsculas, sin acentos ni espacios, y nunca vacío', () => {
  assert.equal(slugChatwoot('Seguimiento semanal', 1), 'seguimiento_semanal');
  assert.equal(slugChatwoot('Hablar en cámara 📷', 2), 'hablar_en_camara');
  assert.equal(slugChatwoot('Lac interés', 3), 'lac_interes');
  assert.equal(slugChatwoot('📷📷', 7), 'etiqueta_7');
});

test('las listas del sistema (Favoritos, Grupos, No leídos) no son etiquetas, con o sin U+200E', () => {
  for (const n of ['Favoritos', '\u200EGrupos', '\u200ENo leídos', 'No leidos', 'Unread', 'favorites']) {
    assert.ok(esListaDelSistema(n), n);
  }
  for (const n of ['Seguimiento', 'Nuevo cliente', 'Grupo VIP', null]) assert.ok(!esListaDelSistema(n), String(n));
  const cat = catalogoCelular([
    { label_id: '1', name: '\u200EFavoritos', color: 0 },
    { label_id: '4', name: 'Importante', color: 6 },
    { label_id: '4', name: 'Importante (repetida)', color: 6 },
    { label_id: '72', name: null, color: 3 },
    { label_id: '2', name: 'Huayacán', color: 1 },
  ]);
  assert.deepEqual(cat.map((l) => [l.labelId, l.nombre]), [['72', 'Etiqueta 72'], ['2', 'Huayacán'], ['4', 'Importante']]);
});

test('sincronizar el catálogo NO pisa los nombres buenos con los de findLabels (sin acentos)', () => {
  const guardadas = [
    { label_id: '2', name: 'Huayacán', color: 1 },
    { label_id: '5', name: 'Hablar en cámara 📷', color: 4 },
    { label_id: '9', name: 'ALQUILER', color: 2 },        // ya no está en el celular
  ];
  const vivas = [
    { id: '2', name: 'Huayacn', color: 1 },
    { id: '5', name: 'Hablar en cmara ', color: 8 },        // cambió el color
    { id: '11', name: 'Aula/Espacio', color: 3 },           // nueva
  ];
  const plan = planSincronizarCatalogo(guardadas, vivas);
  assert.deepEqual(plan.nuevas, [{ label_id: '11', name: 'Aula/Espacio', color: 3 }]);
  assert.deepEqual(plan.colores, [{ label_id: '5', color: 8 }], 'de las que ya estaban se toma el color, nunca el nombre');
  assert.deepEqual(plan.podar, ['9']);
});

test('con una lectura VACÍA no se poda nada: «no me devolvió nada» no es «no tiene ninguna»', () => {
  const plan = planSincronizarCatalogo([{ label_id: '2', name: 'Huayacán', color: 1 }], []);
  assert.deepEqual(plan, { nuevas: [], colores: [], podar: [] });
});

test('quién apunta a una etiqueta dentro de los pasos: condiciones y pasos de acción, por id', () => {
  const pasos = [
    { id: 'a', nodo: 'condicion', ramas: [
      { id: 'r1', modo: 'todas', filas: [{ campo: 'etiqueta', valor: 7 }], siguiente: null },
      { id: 'r2', modo: 'todas', filas: [{ campo: 'etiqueta', valor: '8' }, { campo: 'agendo' }], siguiente: null },
      { id: 'r3', modo: 'cualquiera', filas: [{ campo: 'etiqueta', valor: '7', no: true }], siguiente: null },
    ] },
    { id: 'b', accion: { operacion: 'poner_etiqueta_lead', params: { etiquetaId: 7 } } },
    { id: 'c', accion: { operacion: 'sacar_etiqueta_lead', params: { etiquetaId: 8 } } },
    { id: 'd', accion: { operacion: 'agregar_nota_lead', params: { etiquetaId: 7 } } },
    { id: 'e', cuerpo: 'Hola' },
  ];
  assert.deepEqual(usoEnPasos(pasos, 7), { condiciones: 2, acciones: 1 });
  assert.deepEqual(usoEnPasos(pasos, 8), { condiciones: 1, acciones: 1 });
  assert.deepEqual(usoEnPasos(null, 7), { condiciones: 0, acciones: 0 });
});

test('el segmento de email por etiqueta: sólo `etiqueta:<entero positivo>`', () => {
  assert.equal(etiquetaDeSegmento('etiqueta:12'), 12);
  for (const s of ['etiqueta:0', 'etiqueta:abc', 'etiqueta:', 'etiqueta:1.5', 'activos', 'etiqueta:-3', 'Etiqueta:12']) {
    assert.equal(etiquetaDeSegmento(s), null, s);
  }
});
