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
// ⚠️ Y DESDE EL 05/10/2026 ESTE TEST FIJA ADEMÁS QUE EL BOTÓN NO VUELVA. El catalogo
// paso de 8 a 13 campos: los cinco nuevos (fecha de agendamiento, motivo de salida, plazo
// de la nutricion manual y los dos slots de Fathom) eran EXACTAMENTE lo que mantenia vivo
// el formulario de «Editar lead →», que se borro entero.
//
// Probado rompiéndolo, uno por uno. Con el código como está: 19 pases, 0 fallos (y con los
// otros dos test de la familia, 35 / 0).
//   · `esCampoInline` devuelve true siempre                            → 11 / 1
//   · `calificado` pasa a escribirse por 'meta' (sin CAPI)             → 11 / 1
//   · el tri-estado acepta un texto truthy (`return !!v`)              → 11 / 1
//   · se saca la validación de formato de la fecha                     → 11 / 1
//   · `montoEnRiesgo` mira sólo el monto y no `cerro`                  → 11 / 1
//   · la action deja de validar `campo` contra el catálogo             → 11 / 1
//   · la action deja de rescatar el monto (`if (false)`)               → 11 / 1
//   · la asistencia de R1 se vuelve clickeable sin fecha               → 11 / 1
//   · los dos controles dejan de frenar el Escape                      → 11 / 1
//
// Y las SIETE del boton, medidas con el arnes sobre los tres test de la familia (35 / 0):
//   · el link de Fathom deja de validarse                              → 34 / 1
//   · `ponerLinkFathom` rearma el array como lo hacia el formulario     → 34 / 1
//   · la fecha limite de la nutricion manual se puede vaciar            → 34 / 1
//   · vuelve el boton «Editar lead →» al modal                           → 34 / 1
//   · la ruta /crm/[id] se queda sin «Borrar lead»                       → 34 / 1
//   · el plazo de nutricion se dibuja en cualquier etapa                → 34 / 1
//   · el motivo pasa a escribirse por el camino corto (sin invariante)  → 34 / 1
//   · vuelve a existir EditLeadForm.tsx                                 → 24 / 2
//
// ⚠️ Y UNA NO FALLO A LA PRIMERA, que es lo que la rotura enseñó: «la ruta se queda sin
// Borrar lead» daba 35 / 0 con el boton renombrado a «Quitar», porque el assert era
// `match(f, /Borrar lead/)` y esa cadena es TAMBIÉN el `title` del ConfirmDialog de dos
// lineas mas abajo — el guard encontrando lo que el archivo dice de si. Reanclado al texto
// del `<button>`: 34 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GESTO_INLINE, VIA_INLINE, esCampoInline, montoEnRiesgo, ponerLinkFathom, valorDeCampo } from '../app/crm/campo-inline';
import { REGLAS_RESUMEN } from '../app/crm/lead-view/ficha/reglas-resumen';

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
  // Las conversiones de Meta CAPI (SubmitApplication / QualifiedLead) se disparan DENTRO de
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

test('cada campo declara su gesto, y los cinco gestos están cubiertos', () => {
  assert.deepEqual(Object.keys(VIA_INLINE).sort(), Object.keys(GESTO_INLINE).sort());
  // Eran TRES hasta el 05/10/2026. Los dos nuevos son los que terminaron de vaciar el
  // botón «Editar lead →»: el motivo de salida (texto) y los links de Fathom (enlace).
  // Y los dos del 12/10/2026 (mig 0258): el ingreso estimado (monto) y el Instagram (usuario).
  assert.deepEqual(
    new Set(Object.values(GESTO_INLINE)),
    new Set(['fecha', 'tri', 'persona', 'texto', 'enlace', 'monto', 'instagram']),
  );
});

test('los QUINCE campos del formulario están en el catálogo (menos los que ya edita el contacto)', () => {
  // ⚠️ ESTA LISTA ES LA MEDICIÓN QUE ORDENÓ EL TRABAJO. El formulario editaba 15 campos y
  // el catálogo tenía 8: los cuatro de contacto ya se editaban con `EditableInline` en
  // `InfoPrincipalCard` (y por eso NO están acá), y faltaban estos cinco, que eran los
  // que mantenían vivo el botón. Si mañana alguien saca uno, el botón vuelve a hacer falta.
  for (const c of ['fecha_agenda', 'motivo_perdida', 'nutricion_manual_deadline', 'fathom_r1', 'fathom_r2']) {
    assert.equal(esCampoInline(c), true, `${c} tiene que editarse en la ficha`);
  }
  // 13 + los dos de la mig 0258 (ingreso estimado e Instagram, 12/10/2026).
  assert.equal(Object.keys(VIA_INLINE).length, 15);
});

// ── 2b · Los dos gestos nuevos ───────────────────────────────────────────────

test('la fecha límite de la nutrición manual NO se puede vaciar', () => {
  // Era la única validación de campo que el formulario tenía de verdad («Para
  // "Nutrición - Manual" tienes que poner una fecha límite»). De esa fecha cuelga el
  // aviso de nutrición vencida (lib/crm-auto-plan.ts): vaciarla saca al lead del radar.
  assert.equal(valorDeCampo('nutricion_manual_deadline', '2026-11-04'), '2026-11-04');
  assert.throws(() => valorDeCampo('nutricion_manual_deadline', ''), /fecha límite/);
  assert.throws(() => valorDeCampo('nutricion_manual_deadline', null), /fecha límite/);
  // Y las otras fechas SÍ se pueden vaciar: borrar la R2 es legítimo.
  assert.equal(valorDeCampo('fecha_junta_2', ''), null);
  assert.equal(valorDeCampo('fecha_agenda', ''), null);
});

test('un link de Fathom se valida, y el formulario NO lo validaba', () => {
  // El formulario sólo ponía un placeholder: guardaba cualquier cosa que se pegara, y
  // un texto que no es una URL de Fathom deja un «Abrir →» que no abre y un análisis de
  // la llamada sin con qué emparejarse. La regla vivía sólo en el canal de MaKo.
  assert.equal(valorDeCampo('fathom_r1', 'https://fathom.video/share/AbC'), 'https://fathom.video/share/AbC');
  assert.equal(valorDeCampo('fathom_r2', 'https://app.fathom.video/calls/99'), 'https://app.fathom.video/calls/99');
  // Vaciar es legítimo: saca el link de esa reunión.
  assert.equal(valorDeCampo('fathom_r1', ''), null);
  assert.throws(() => valorDeCampo('fathom_r1', 'la grabación de la primera'), /URL de Fathom/);
  assert.throws(() => valorDeCampo('fathom_r2', 'https://fathom.video.evil.tld/x'), /URL de Fathom/);
  assert.throws(() => valorDeCampo('fathom_r1', 'http://fathom.video/x'), /URL de Fathom/);
});

test('guardar el link de UNA reunión no toca los de las otras', () => {
  // ⚠️ ES LO QUE EL FORMULARIO NO HACÍA: su `buildFathom(u1, u2)` rearmaba el array
  // entero con dos slots, así que tocar la R1 borraba todo lo que no cayera ahí.
  const esR2 = (l: string | null | undefined) => /r2|reuni[oó]n 2|junta 2/i.test(l ?? '');
  const antes = [
    { label: 'Reunión 1', url: 'https://fathom.video/share/uno' },
    { label: 'Reunión 2', url: 'https://fathom.video/share/dos' },
  ];
  assert.deepEqual(ponerLinkFathom(antes, 'fathom_r1', 'https://fathom.video/share/nuevo', esR2), [
    { label: 'Reunión 1', url: 'https://fathom.video/share/nuevo' },
    { label: 'Reunión 2', url: 'https://fathom.video/share/dos' },
  ]);
  // Borrar la R1 deja la R2 en pie.
  assert.deepEqual(ponerLinkFathom(antes, 'fathom_r1', null, esR2), [antes[1]]);
  // Un link con OTRA etiqueta cae en el bucket de la R1 (lo no etiquetado es R1) y no
  // desaparece al corregir el slot: se conserva en su posición.
  const conTercero = [...antes, { label: 'Entrega', url: 'https://fathom.video/share/tres' }];
  assert.deepEqual(ponerLinkFathom(conTercero, 'fathom_r2', 'https://fathom.video/share/x', esR2), [
    antes[0],
    { label: 'Reunión 2', url: 'https://fathom.video/share/x' },
    conTercero[2],
  ]);
  // Y en un lead sin nada, el slot nace en su lugar.
  assert.deepEqual(ponerLinkFathom([], 'fathom_r2', 'https://fathom.video/share/z', esR2), [
    { label: 'Reunión 2', url: 'https://fathom.video/share/z' },
  ]);
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

// ── 6 · El botón «Editar lead →» ya no existe, y nada quedó huérfano ────────

test('⚠️ el botón de editar el LEAD no existe en ninguna de las dos fichas', () => {
  // Pedido DOS veces: «que ya no exista el botón de "editar" en la ruta de cada lead».
  // La primera vez se contestó que no se podía porque «de él cuelga el Deal Details
  // entero». Medido: el botón era un <Link href={/crm/{id}?edit=1}> y lo que abría era
  // EditLeadForm (430 líneas); el DealDetailsCard (799) se monta APARTE, en la tab Pagos.
  for (const ruta of ['../app/crm/LeadSheet.tsx', '../app/crm/[id]/LeadDetailBody.tsx']) {
    const f = leer(ruta);
    assert.ok(!/Editar lead/.test(f), `${ruta}: volvió el botón «Editar lead →»`);
    assert.ok(!/EditLeadForm/.test(f), `${ruta}: volvió el formulario de edición`);
  }
  // El lápiz del header de la ruta también se fue (era `<IconPencil /> Editar`).
  const body = leer('../app/crm/[id]/LeadDetailBody.tsx');
  assert.ok(!/IconPencil/.test(body), 'volvió el lápiz del header');
  // Y el formulario está BORRADO, no sólo desenlazado: una pantalla a la que no se
  // llega sigue siendo una pantalla que alguien va a volver a enlazar.
  assert.equal(existsSync(join(import.meta.dirname, '../app/crm/[id]/EditLeadForm.tsx')), false);
  // Lo mismo con su guardado en lote: una server action es una URL, y ésta escribía los
  // 15 campos Y la etapa.
  assert.ok(!/saveLeadEditorAction/.test(leer('../app/crm/actions.ts')), 'la action del formulario tiene que estar borrada');
});

test('BORRAR LEAD no se fue con el botón: está en las DOS fichas, con su confirmación', () => {
  // Es irreversible, y en la ruta /crm/[id] vivía SOLO al pie del formulario.
  for (const [ruta, accion] of [
    ['../app/crm/LeadSheet.tsx', 'deleteLeadInlineAction'],
    ['../app/crm/[id]/LeadDetailBody.tsx', 'deleteLeadAction'],
  ] as const) {
    const f = leer(ruta);
    // ⚠️ SE PERSIGUE EL BOTÓN, NO LA CADENA: «Borrar lead» es también el `title` del
    // ConfirmDialog, así que un `assert.match(f, /Borrar lead/)` pasa en verde con el
    // botón renombrado. Verificado rompiéndolo: con el rótulo cambiado a «Quitar», la
    // versión floja daba 35/0 y ésta da 34/1.
    // Desde el 12/10/2026 es el tacho rojo de la casa con su texto (punto 12: «Ahí debería estar el
    // botón de "Borrar lead" y en rojo»), así que el rótulo viaja en `texto=` y no entre etiquetas.
    // Verificado rompiéndolo (12/10/2026): con el texto cambiado a «Quitar» en el modal, 1 fallo.
    assert.match(f, /<BotonBorrar texto="Borrar lead"/, `${ruta}: el botón de borrar no dice qué hace (o dejó de ser el tacho rojo)`);
    assert.match(f, new RegExp(accion), `${ruta}: tiene que llamar a ${accion}`);
    // La confirmación NOMBRA la consecuencia, pegada al botón (regla de la casa).
    assert.match(f, /No se puede deshacer/, `${ruta}: la confirmación no nombra la consecuencia`);
    assert.match(f, /confirmLabel="Borrar definitivamente"/, `${ruta}: el botón no dice qué hace`);
  }
});

test('⚠️ el guardado campo por campo no puede dejar un estado que el formulario impedía', () => {
  // El formulario guardaba TODO junto; ahora cada campo se guarda solo, así que una
  // edición a medias queda guardada a medias. Los tres pares que DEPENDEN entre sí no
  // se ofrecen cuando el dependiente no se puede guardar — y el candado de verdad vive
  // en `updateLead`, que fuerza el valor a null. Acá se fija que la ficha tampoco lo
  // dibuje clickeable (un campo que invita a editar y rebota se lee como app rota).
  const card = leer('../app/crm/lead-view/ReunionesCard.tsx');
  assert.match(card, /campo="asistio_j1"[^>]*bloqueado=\{!lead\.fecha_junta_1\}/);
  assert.match(card, /campo="asistio_j2"[^>]*bloqueado=\{!lead\.fecha_junta_2\}/);
  assert.match(card, /campo="calificado"[^>]*bloqueado=\{calificadoSeDescarta\(lead\)\}/);
  // El cuarto par: el motivo de salida sólo existe en perdido/descalificado, y la
  // invariante es de `updateLead` — por eso el campo va por 'lead' y no por el atajo.
  assert.equal(VIA_INLINE.motivo_perdida, 'lead');
  // Y la fecha límite de la nutrición manual se dibuja SÓLO en esa etapa, en las dos
  // fichas: ofrecerla en otra etapa es ofrecer un dato que `setBoardStageOverride` nulea.
  // ⚠️ CAMBIADO A PROPÓSITO EL 14/10/2026 (la ficha por bloques): las dos puertas montan la MISMA
  // ficha y el plazo es el bloque `plazo-nutricion`, cuya regla pura dice cuándo se calla
  // (app/crm/lead-view/ficha/reglas-resumen.ts). Se EJECUTA. Re-verificado rompiéndolo: la regla
  // devolviendo siempre false → 1 fallo.
  const regla = REGLAS_RESUMEN['plazo-nutricion'].estaVacio;
  const conEtapa = (etapa: string) => ({ etapa, lead: {}, data: {} }) as unknown as Parameters<typeof regla>[0];
  assert.equal(regla(conEtapa('manual')), false, 'en la nutrición manual el plazo se dibuja');
  assert.equal(regla(conEtapa('agenda')), true, 'el plazo no está condicionado a la etapa');
  for (const ruta of ['../app/crm/LeadSheet.tsx', '../app/crm/[id]/LeadDetailBody.tsx']) {
    assert.match(leer(ruta), /<FichaPorBloques\b/, `${ruta}: no monta la ficha compartida`);
    assert.doesNotMatch(leer(ruta), /<PlazoNutricionCard/, `${ruta}: monta el plazo a mano, sin la regla de la etapa`);
  }
});

test('el campo editable se cierra con Escape sin cerrar la ficha entera', () => {
  // Los Escape de los modales viven en `document` y en captura: sin
  // `stopImmediatePropagation`, cancelar una fecha cerraba además la ficha. Es el
  // mismo bug que `EditableInline` ya tiene resuelto y documentado.
  const campo = leer('../app/crm/lead-view/CampoEditable.tsx');
  const veces = (campo.match(/stopImmediatePropagation\(\)/g) ?? []).length;
  assert.ok(veces >= 2, `los dos controles propios tienen que frenar el Escape (hay ${veces})`);
});
