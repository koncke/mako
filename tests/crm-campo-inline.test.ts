// =============================================================================
// Editar un campo del lead EN EL LUGAR — el catálogo y sus dos candados
// =============================================================================
// «Que ya no exista el botón de "editar" en la ruta de cada lead, sino que
// simplemente … le doy click arriba y ya puedo sobre escribir» (Martín,
// 05/10/2026). Sacar el modo de edición mueve la escritura de UN formulario
// validado a OCHO controles sueltos, y eso rompe dos cosas que el formulario
// tapaba sin que se vieran:
//
//   1. el campo llega por una SERVER ACTION, o sea por una URL: `campo` ya no es
//      un `<input name>` de un form nuestro, es un argumento que manda el
//      navegador. Sin catálogo, cualquier columna de `leads` sería escribible.
//   2. `calificado` es el dato que dispara el evento a Meta, y SOLO lo dispara
//      `updateLead`. Guardarlo por el camino corto (`saveLeadMeta`) escribiría la
//      columna y dejaría a Meta sin el evento — la pantalla diría que sí y Meta
//      no se enteraría. Es exactamente lo que Martín preguntó el mismo día («¿le
//      llega igual a Meta la info dependiendo el funnel?»).
//
// Y el tercero, el que la rotura enseñó: `updateLead` vacía el monto de cierre de
// cualquier lead con `cerro != true`, haya mandado el caller lo que haya mandado.
//
// Probado rompiéndolo, uno por uno. Con el código como está: 12 pases, 0 fallos.
//   · `esCampoInline` devuelve true siempre                            → 11 / 1
//   · `calificado` pasa a escribirse por 'meta' (sin CAPI)             → 11 / 1
//   · el tri-estado acepta un texto truthy (`return !!v`)              → 11 / 1
//   · se saca la validación de formato de la fecha                     → 11 / 1
//   · `montoEnRiesgo` mira sólo el monto y no `cerro`                  → 11 / 1
//   · la action deja de validar `campo` contra el catálogo             → 11 / 1
//   · la action deja de rescatar el monto (`if (false)`)               → 11 / 1
//   · la asistencia de R1 se vuelve clickeable sin fecha               → 11 / 1
//   · los dos controles dejan de frenar el Escape                      → 11 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GESTO_INLINE, VIA_INLINE, esCampoInline, montoEnRiesgo, valorDeCampo } from '../app/crm/campo-inline';

// El archivo SIN comentarios: todo test que persiga la PRESENCIA de una línea de
// código tiene que mirar el código, no la prosa que lo explica (si no, el propio
// comentario que documenta la regla hace pasar el test).
const sinComentarios = (t: string) => t.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (p: string) => sinComentarios(readFileSync(join(import.meta.dirname, p), 'utf8'));

// ── 1 · El catálogo es una lista blanca, no una sugerencia ───────────────────

test('sólo los campos del catálogo se pueden editar desde la ficha', () => {
  for (const ok of ['fecha_junta_1', 'asistio_j1', 'calificado', 'closer', 'setter']) {
    assert.equal(esCampoInline(ok), true, `${ok} debería estar en el catálogo`);
  }
  // Las tres que importan: la llave del inquilino, la plata y el desenlace. Ninguna
  // se edita con un click sobre un valor, y ninguna tiene por qué ser escribible
  // desde un argumento que manda el navegador.
  for (const no of ['workspace_id', 'monto_cierre_usd', 'estado_lead', 'id', '']) {
    assert.equal(esCampoInline(no), false, `${no} NO debería estar en el catálogo`);
  }
});

test('«calificado» y las asistencias se escriben por updateLead, que es el que avisa a Meta', () => {
  // El evento `Lead` / `QualifiedLead` de Meta CAPI se dispara DENTRO de
  // updateLead (lib/leads.ts). Un campo de estos ruteado a 'meta' guarda bien y
  // no avisa: la falla no se ve en la pantalla, se ve en el Ads Manager semanas
  // después, cuando Meta trae leads peores por falta de señal.
  assert.equal(VIA_INLINE.calificado, 'lead');
  assert.equal(VIA_INLINE.asistio_j1, 'lead');
  assert.equal(VIA_INLINE.asistio_j2, 'lead');
  // Y las invariantes también viven ahí: sin fecha de R1 no hay asistencia.
  assert.equal(VIA_INLINE.fecha_junta_1, 'lead');
  assert.equal(VIA_INLINE.fecha_junta_2, 'lead');
  assert.equal(VIA_INLINE.fecha_confirmacion, 'lead');
  // Closer y setter no tienen invariante ni evento: camino corto.
  assert.equal(VIA_INLINE.closer, 'meta');
  assert.equal(VIA_INLINE.setter, 'meta');
});

test('cada campo declara su gesto, y los tres gestos están cubiertos', () => {
  assert.deepEqual(Object.keys(VIA_INLINE).sort(), Object.keys(GESTO_INLINE).sort());
  assert.deepEqual(
    new Set(Object.values(GESTO_INLINE)),
    new Set(['fecha', 'tri', 'persona']),
  );
});

// ── 2 · Lo que llega se valida de verdad ─────────────────────────────────────

test('un tri-estado acepta sí, no o nada — nunca un texto', () => {
  assert.equal(valorDeCampo('calificado', true), true);
  assert.equal(valorDeCampo('calificado', false), false);
  assert.equal(valorDeCampo('asistio_j2', null), null);
  // `'si'` es truthy en JavaScript: sin esto entraba como un sí que nadie marcó
  // y mandaba el evento a Meta.
  assert.throws(() => valorDeCampo('calificado', 'si'), /sí, no o sin marcar/);
  assert.throws(() => valorDeCampo('calificado', '1'), /sí, no o sin marcar/);
});

test('una fecha es una fecha o no entra', () => {
  assert.equal(valorDeCampo('fecha_junta_1', '2026-10-05'), '2026-10-05');
  // Vaciar el campo es legítimo: borra la fecha (y con ella la asistencia, que es
  // lo que hace updateLead).
  assert.equal(valorDeCampo('fecha_junta_1', ''), null);
  assert.equal(valorDeCampo('fecha_junta_2', null), null);
  assert.throws(() => valorDeCampo('fecha_junta_1', 'mañana'), /AAAA-MM-DD/);
  assert.throws(() => valorDeCampo('fecha_confirmacion', '05/10/2026'), /AAAA-MM-DD/);
  assert.throws(() => valorDeCampo('fecha_junta_1', true), /no es un sí\/no/);
});

test('una persona entra recortada, y vacía es «sin asignar»', () => {
  assert.equal(valorDeCampo('closer', '  Vendedora 2  '), 'Vendedora 2');
  assert.equal(valorDeCampo('setter', ''), null);
  assert.equal(valorDeCampo('setter', '   '), null);
  assert.equal((valorDeCampo('closer', 'x'.repeat(200)) as string).length, 80);
});

// ── 3 · El monto de cierre que updateLead se lleva puesto ────────────────────

test('un lead facturando tiene monto y NO tiene cerro: guardarle una asistencia se lo borraría', () => {
  // El caso real: `lib/pagos.ts` y el editor del deal escriben
  // `monto_cierre_usd` directo, sin pasar por updateLead. Así queda un lead con
  // monto y con `cerro` en null — y updateLead fuerza monto y fecha de cierre a
  // null cuando `cerro != true`, mire el caller lo que mire.
  assert.equal(montoEnRiesgo({ cerro: null, monto_cierre_usd: 4800, fecha_cierre: null }), true);
  assert.equal(montoEnRiesgo({ cerro: null, monto_cierre_usd: null, fecha_cierre: '2026-09-30' }), true);
  // Un lead ganado no corre riesgo: su `cerro` es true y la regla no aplica.
  assert.equal(montoEnRiesgo({ cerro: true, monto_cierre_usd: 4800, fecha_cierre: '2026-09-30' }), false);
  // Y sin nada que perder no hay nada que rescatar (no se gasta un UPDATE de más).
  assert.equal(montoEnRiesgo({ cerro: null, monto_cierre_usd: null, fecha_cierre: null }), false);
  assert.equal(montoEnRiesgo({}), false);
});

// ── 4 · Cableado: la action usa el catálogo y rescata el monto ───────────────

test('CABLEADO: la action valida contra el catálogo antes de escribir', () => {
  const src = leer('../app/crm/actions.ts');
  const i = src.indexOf('export async function guardarCampoLeadAction');
  assert.ok(i > 0, 'la action tiene que existir');
  const cuerpo = src.slice(i, i + 2200);
  assert.match(cuerpo, /esCampoInline\(campo\)/, 'el campo tiene que validarse contra el catálogo');
  assert.match(cuerpo, /valorDeCampo\(campo, valor\)/, 'el valor tiene que normalizarse');
  // El orden importa: validar DESPUÉS de escribir no valida nada.
  assert.ok(cuerpo.indexOf('esCampoInline') < cuerpo.indexOf('saveLeadMeta'), 'se valida antes de escribir');
});

test('CABLEADO: la action pasa por updateLead y deja el cambio en el historial', () => {
  const src = leer('../app/crm/actions.ts');
  const i = src.indexOf('export async function guardarCampoLeadAction');
  const cuerpo = src.slice(i, i + 2200);
  assert.match(cuerpo, /await updateLead\(id,/, 'los campos con invariante van por updateLead');
  assert.match(cuerpo, /logLeadChanges\(id, before, after/, 'el cambio queda en el historial del lead');
});

test('CABLEADO: la action rescata el monto de cierre que updateLead se lleva', () => {
  const src = leer('../app/crm/actions.ts');
  const i = src.indexOf('export async function guardarCampoLeadAction');
  const cuerpo = src.slice(i, i + 2200);
  assert.match(cuerpo, /montoEnRiesgo\(before\)/, 'tiene que mirar si el lead tiene monto que perder');
  assert.match(cuerpo, /monto_cierre_usd: before\.monto_cierre_usd/, 'y volver a escribirlo');
  // Y el rescate va ANTES de leer el `after`: si no, el historial escribiría una
  // línea «Monto de cierre → —» que nunca pasó.
  assert.ok(cuerpo.indexOf('montoEnRiesgo') < cuerpo.indexOf('const after'), 'el rescate va antes del after');
});

// ── 5 · Lo que no se puede editar no se dibuja clickeable ────────────────────

test('la asistencia a R1 no se ofrece sin fecha de R1', () => {
  // `updateLead` fuerza `asistio_j1` a null cuando no hay `fecha_junta_1`: un chip
  // clickeable ahí guardaría y volvería solo al valor anterior. Un campo que
  // invita a editar y rebota se lee como que la app está rota.
  const card = leer('../app/crm/lead-view/ReunionesCard.tsx');
  assert.match(card, /campo="asistio_j1"[^>]*bloqueado=\{!lead\.fecha_junta_1\}/);
  assert.match(card, /campo="asistio_j2"[^>]*bloqueado=\{!lead\.fecha_junta_2\}/);
  // ⚠️ «Calificado» YA NO SE ESCONDE DETRÁS DE LA ASISTENCIA (05/10/2026): el mismo
  // dato se marca ahora en la pestaña Tracking, porque hay funnels sin reuniones y
  // es la señal que viaja a Meta. Si acá apareciera y desapareciera con otra
  // condición, la misma pregunta tendría dos respuestas según la pestaña. Las dos
  // tarjetas bloquean por el MISMO candado, y sólo en el caso que `updateLead`
  // descarta: consta que no vino. Lo fija tests/crm-calificado-sin-reunion.test.ts.
  assert.match(card, /campo="calificado"[^>]*bloqueado=\{calificadoSeDescarta\(lead\)\}/);
  // El modo edición ya no es el único camino: la tarjeta monta los campos editables.
  assert.match(card, /FechaEditable, TriEditable, PersonaEditable/);
});

test('el campo editable se cierra con Escape sin cerrar la ficha entera', () => {
  // Los Escape de los modales viven en `document` y en captura: sin
  // `stopImmediatePropagation`, cancelar una fecha cerraba además la ficha. Es el
  // mismo bug que `EditableInline` ya tiene resuelto y documentado.
  const campo = leer('../app/crm/lead-view/CampoEditable.tsx');
  const veces = (campo.match(/stopImmediatePropagation\(\)/g) ?? []).length;
  assert.ok(veces >= 2, `los dos controles propios tienen que frenar el Escape (hay ${veces})`);
});
