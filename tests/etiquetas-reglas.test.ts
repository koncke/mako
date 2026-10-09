// =============================================================================
// Las reglas de las etiquetas del CRM que se deciden sin base (lib/etiquetas-reglas.ts)
// =============================================================================
// El nombre y su clave de unicidad (la misma que el índice de la mig 0224),
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
//
// ⚠️ Y LA REVISIÓN ADVERSARIAL DEL 08/10/2026 (parte E: datos-7, datos-6, etiquetas-6, etiquetas-3).
// Con todo puesto: 14 pass / 0 fail. Nueve roturas más (arnés romper-E.mjs, restaura de memoria),
// las nueve cazadas:
//   7. `autorPublico` aceptando cualquier cosa que empiece con «MaKo» → 1 fallo;
//   8. `traducirEtiquetasEnSecuencia` dejando el id del dueño en un paso ⚡ → 1 fallo;
//   9. … sin mirar las condiciones (`ramas[].filas[]`) → 1 fallo;
//  10. `planEspejo` tomando como ENTRADA una clave de un producto recién mirado → 1 fallo;
//  11. … actuando en la primera corrida (estado en vez de foto) → 1 fallo;
//  12. … avanzando en la foto lo que el tope dejó para la próxima → 1 fallo;
//  13. … sin ver las salidas (un lead que dejó el producto) → 2 fallos;
//  14. `leerFotoEspejo` aceptando una foto de otra versión → 1 fallo;
//  15. `consecuenciaDeArchivar` con la frase vieja («la usan…») → 1 fallo.
//
// (Desde el 09/10/2026 son 13 tests: el del slug de Chatwoot se fue con la integración.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  limpiarNombreEtiqueta, claveNombre, colorValido, esListaDelSistema, catalogoCelular,
  planSincronizarCatalogo, usoEnPasos, etiquetaDeSegmento, TOPE_NOMBRE_ETIQUETA,
  autorPublico, traducirEtiquetasEnSecuencia, consecuenciaDeArchivar, planEspejo, leerFotoEspejo,
  type FotoEspejo,
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

// (El test del slug de Chatwoot se fue el 09/10/2026 con la integración: `slugChatwoot` ya no existe.)

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

// ── Revisión adversarial del 08/10/2026 (parte E) ────────────────────────────

test('datos-7: por HTTP no sale el email de quien la puso — MaKo y la automatización, sí', () => {
  assert.equal(autorPublico('closer@agencia.com'), 'una persona');
  assert.equal(autorPublico('Leila Paz'), 'una persona');
  assert.equal(autorPublico('CRM'), 'una persona');
  assert.equal(autorPublico(null), 'una persona');
  assert.equal(autorPublico('MaKo'), 'MaKo');
  assert.equal(autorPublico('MaKo · automatización «Post agenda»'), 'MaKo · automatización «Post agenda»');
  assert.equal(autorPublico('MaKomaria@x.com'), 'una persona', 'un email que EMPIEZA con «MaKo» no es MaKo');
});

test('datos-6: las etiquetas de una secuencia se traducen al copiarla (condiciones, ⚡ Acción y disparador)', () => {
  const pasos = [
    { id: 'a', nodo: 'condicion', ramas: [
      { id: 'r1', modo: 'todas', filas: [{ campo: 'etiqueta', valor: 7 }, { campo: 'agendo' }], siguiente: 'b' },
      { id: 'r2', modo: 'todas', filas: [{ campo: 'etiqueta', valor: '8', no: true }], siguiente: null },
      { id: 'r3', modo: 'todas', filas: [{ campo: 'etiqueta', valor: 99 }], siguiente: null },
    ] },
    { id: 'b', accion: { operacion: 'poner_etiqueta_lead', params: { leadId: '$evento', etiquetaId: 8 } } },
    { id: 'c', accion: { operacion: 'sacar_etiqueta_lead', params: { etiquetaId: 99 } } },
    { id: 'd', cuerpo: 'Hola', audio_id: 3 },
  ];
  const original = JSON.stringify(pasos);
  const mapa = new Map([[7, 70], [8, 80]]);
  const t = traducirEtiquetasEnSecuencia(pasos, 7, (id) => mapa.get(id) ?? null);
  type P = { ramas?: Array<{ filas: Array<{ valor?: unknown; no?: boolean }> }>; accion?: { params?: Record<string, unknown> }; audio_id?: number };
  const p = t.pasos as P[];
  assert.equal(t.etiquetaId, 70, 'la columna del disparador');
  assert.deepEqual(p[0].ramas!.map((r) => r.filas.map((f) => f.valor ?? null)), [[70, null], [80], [null]]);
  assert.equal(p[0].ramas![1].filas[0].no, true, 'la negación viaja');
  assert.deepEqual(p[1].accion!.params, { leadId: '$evento', etiquetaId: 80 });
  assert.deepEqual(p[2].accion!.params, {}, 'lo que no está en el mapa queda VACÍO, nunca con el id del dueño');
  assert.equal(p[3].audio_id, 3, 'lo que no es una etiqueta no se toca');
  assert.equal(t.sinTraducir, 2);
  assert.equal(JSON.stringify(pasos), original, 'no muta lo que recibe');
  assert.deepEqual(traducirEtiquetasEnSecuencia(null, null, () => 1), { pasos: null, etiquetaId: null, sinTraducir: 0 });
});

test('etiquetas-6 / datos-5: la consecuencia de archivar dice que la APAGA y que los leads la conservan', () => {
  assert.equal(consecuenciaDeArchivar({ disparadores: 1, condiciones: 2, acciones: 0, leads: 12 }),
    'Deja de contar en 3 pasos o disparadores de automatizaciones y los 12 leads que la tienen la conservan como historia.');
  assert.equal(consecuenciaDeArchivar({ disparadores: 0, condiciones: 1, acciones: 0, leads: 1 }),
    'Deja de contar en 1 paso de automatizaciones y el lead que la tiene la conserva como historia.');
  assert.equal(consecuenciaDeArchivar({ disparadores: 0, condiciones: 0, acciones: 0, leads: 0 }), null, 'nada la usa: no hace falta preguntar');
  assert.equal(consecuenciaDeArchivar({ disparadores: null, condiciones: null, acciones: null, leads: 3 }),
    'Los 3 leads que la tienen la conservan como historia y no pude contar las automatizaciones.');
});

// El espejo etapa → etiqueta del barrido horario: una FOTO, no una reconciliación de estado.
const FOTO: FotoEspejo = { v: 1, at: '2026-10-08T15:00:00Z', productos: [1], etapas: { '10:1': 'lead', '11:1': 'agenda', '12:1': 'agenda', '13:1': 'lead' } };
const VIVOS = new Set([10, 11, 12, 14]);

test('etiquetas-3: la primera corrida es la LÍNEA DE BASE — no toca a nadie', () => {
  const r = planEspejo(null, [{ leadId: 10, productoId: 1, etapa: 'agenda' }], VIVOS, [1], { ahora: 'T', tope: 10 });
  assert.deepEqual(r.transiciones, []);
  assert.deepEqual(r.foto, { v: 1, at: 'T', productos: [1], etapas: { '10:1': 'agenda' } });
});

test('etiquetas-3: sólo lo que SE MOVIÓ desde la foto (no el estado), entradas a un producto mirado y salidas', () => {
  const actuales = [
    { leadId: 10, productoId: 1, etapa: 'agenda' },   // derivó a «Agenda» (Calendly): transición
    { leadId: 11, productoId: 1, etapa: 'agenda' },   // sigue igual: nada
    { leadId: 14, productoId: 1, etapa: 'lead' },     // nuevo en un producto que ya se miraba: entró
    { leadId: 10, productoId: 2, etapa: 'x' },        // producto que recién se empieza a mirar: base
  ];
  // El 12 dejó el producto 1 (vive, sin clave): salió. El 13 ya no existe: se suelta sin transición.
  const r = planEspejo(FOTO, actuales, VIVOS, [1, 2], { ahora: 'T', tope: 10 });
  assert.deepEqual(r.transiciones, [
    { leadId: 10, productoId: 1, desde: 'lead', hacia: 'agenda' },
    { leadId: 12, productoId: 1, desde: 'agenda', hacia: null },
    { leadId: 14, productoId: 1, desde: null, hacia: 'lead' },
  ]);
  assert.deepEqual(r.foto.etapas, { '10:1': 'agenda', '11:1': 'agenda', '14:1': 'lead', '10:2': 'x' });
  assert.deepEqual(r.foto.productos, [1, 2]);
});

test('etiquetas-3: el tope deja lo que no entró para la próxima, con su etapa VIEJA en la foto', () => {
  const actuales = [
    { leadId: 10, productoId: 1, etapa: 'agenda' },
    { leadId: 11, productoId: 1, etapa: 'ganado' },
    { leadId: 14, productoId: 1, etapa: 'lead' },
  ];
  const r = planEspejo(FOTO, actuales, VIVOS, [1], { ahora: 'T', tope: 1 });
  assert.equal(r.transiciones.length, 1);
  assert.equal(r.diferidas, 3);
  assert.equal(r.foto.etapas['10:1'], 'agenda', 'la aplicada avanza');
  assert.equal(r.foto.etapas['11:1'], 'agenda', 'la diferida queda donde estaba: la próxima corrida la vuelve a ver');
  assert.ok(!('14:1' in r.foto.etapas), 'una entrada diferida queda sin clave: la próxima vuelve a ser una entrada');
  assert.equal(r.foto.etapas['12:1'], 'agenda', 'una salida diferida conserva su clave');
});

test('etiquetas-3: una foto ilegible es «no hay foto» (línea de base), nunca una foto vacía', () => {
  assert.equal(leerFotoEspejo(null), null);
  assert.equal(leerFotoEspejo('{roto'), null);
  assert.equal(leerFotoEspejo(JSON.stringify({ v: 2, at: 'x', productos: [], etapas: {} })), null);
  const f = leerFotoEspejo(JSON.stringify({ v: 1, at: 'x', productos: [1, '2', 0], etapas: { '10:1': 'lead', basura: 'x', '11:1': 3 } }));
  assert.deepEqual(f, { v: 1, at: 'x', productos: [1, 2], etapas: { '10:1': 'lead' } });
});
