// =============================================================================
// Los CRON de una automatización (lib/disparadores.ts): la lista, cuándo dispara cada uno, a quién
// =============================================================================
// Sexta tanda del Chatbot (09/10/2026), CRON puntos 2, 3, 6, 7, 8, 9 y 10. Lo que se persigue acá
// decide qué automatización arranca con cada evento, o sea a quién le llega un WhatsApp real, y
// falla en silencio: un «Ignorar» que no ignora, un Recurrente que ADEMÁS dispara con el evento, un
// escritor viejo que cambia el CRON de siempre y se lleva puestos los demás, un segundo CRON que
// pisa el ámbito de embudo del primero.
//
// PROBADO ROMPIÉNDOLO (09/10/2026): ver la cabecera del final del archivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanearDisparador, sanearDisparadores, disparadoresDe, disparadorDeColumnas, columnasDeDisparador, firmaDisparador,
  claseDeDisparador, disparaPorEvento, problemaDeDisparadores, problemaDeDisparador, quienTrasTocar, valoresQuien,
  conValorEtiqueta, valorEtiqueta, alternarIgnorar, textoDeDisparador, textosParaElGrupo, barreElDisparador, nuevoIdDisparador,
  ZONAS_POR_PAIS, paisDeZona, EVENTOS_INSTAGRAM, EVENTOS_MESSENGER, CLASES_DISPARADOR, VALOR_GRUPO,
  TRIGGER_ETIQUETA_AGREGADA, TRIGGER_ETIQUETA_QUITADA, TRIGGER_INSTAGRAM, TRIGGER_MESSENGER, TRIGGER_EMAIL_RECIBIDO, TRIGGER_SOLO_GRUPO,
  VALOR_ETIQUETA_AGREGADA, VALOR_ETIQUETA_QUITADA, TOPE_DISPARADORES, vistasPorDisparador, unaPorSecuencia,
  conProximas, nuevosOCambiados,
  type Disparador,
} from '../lib/disparadores';
import { PAISES } from '../lib/paises';
import type { PasoGrafo } from '../lib/flujo-grafo';

const CRON = { unidad: 'dia' as const, cada: 1, hora: 9, minuto: 0 };

// ── 1. La lista y el primero en las columnas ────────────────────────────────────────────────────

test('sin la lista (la 0241 sin aplicar, o una automatización de antes): UN CRON, el de las columnas', () => {
  const l = disparadoresDe({ trigger_tipo: 'etapa_actual', etapa: 'agenda', funnel_id: 5, producto_id: 9, etiqueta_id: 3 });
  assert.equal(l.length, 1);
  // Las columnas guardan los tres ámbitos; el disparador lleva sólo el de su tipo.
  assert.deepEqual(l[0], { id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'agenda', etapas: null, funnel_id: 5 });
});

test('⚠️ el PRIMERO es siempre el de las columnas; de la lista toma sólo lo que las columnas no tienen', () => {
  const lista = [
    { id: 'd7', trigger_tipo: TRIGGER_ETIQUETA_AGREGADA, ignorar: [4] },
    { id: 'd2', trigger_tipo: 'etiqueta_puesta', etiqueta_id: 8 },
  ];
  const l = disparadoresDe({ trigger_tipo: TRIGGER_ETIQUETA_AGREGADA, etapa: 'x', disparadores: lista });
  assert.deepEqual(l.map((d) => d.id), ['d7', 'd2']);
  assert.deepEqual(l[0].ignorar, [4], 'el «Ignorar» del primero vive en la lista');
  // Un escritor VIEJO cambió el disparador (la API de email, /email): lo de la lista era de OTRO.
  const cambiado = disparadoresDe({ trigger_tipo: 'etapa_actual', etapa: 'agenda', disparadores: lista });
  assert.equal(cambiado[0].trigger_tipo, 'etapa_actual');
  assert.equal(cambiado[0].ignorar, undefined, 'el «Ignorar» de una etiqueta quedó pegado a un disparador de etapa');
  // ⚠️ Y los demás SIGUEN: cambiar el primero no se lleva puestos a los otros CRON.
  assert.deepEqual(cambiado.map((d) => d.trigger_tipo), ['etapa_actual', 'etiqueta_puesta']);
  assert.notEqual(cambiado[0].id, cambiado[1].id);
  // El caso que de verdad muerde: el evento de Instagram guardado, y las columnas pasadas a Messenger.
  // Heredado, el `subtipo` arma un «comenta tu publicación» de MESSENGER que nadie eligió.
  const canal = disparadoresDe({ trigger_tipo: TRIGGER_MESSENGER, etapa: 'x', disparadores: [{ id: 'd1', trigger_tipo: TRIGGER_INSTAGRAM, subtipo: 'comentario' }] });
  assert.equal(canal[0].subtipo, null, 'el evento de un canal quedó pegado al otro canal');
});

test('las etapas del primero salen de `etapasDe`: una lista vieja que ya no empieza con `etapa` no cuenta', () => {
  const l = disparadoresDe({ trigger_tipo: 'entrega_actual', etapa: 'hito2', etapas: ['onb', 'hito1'], producto_id: 9 });
  assert.equal(l[0].etapa, 'hito2');
  assert.equal(l[0].etapas, null);
  const ok = disparadoresDe({ trigger_tipo: 'entrega_actual', etapa: 'onb', etapas: ['onb', 'hito1'], producto_id: 9 });
  assert.deepEqual(ok[0].etapas, ['onb', 'hito1']);
});

test('el saneo: cada uno con los campos de SU tipo, ids únicos, con tope', () => {
  const d = sanearDisparador({ id: 'd3', trigger_tipo: TRIGGER_INSTAGRAM, subtipo: 'dm', etapa: 'agenda', etiqueta_id: 4, ignorar: [1] })!;
  assert.deepEqual(d, { id: 'd3', trigger_tipo: TRIGGER_INSTAGRAM, subtipo: 'dm' });
  assert.equal(sanearDisparador({ trigger_tipo: 'DROP TABLE' }), null);
  const repetidos = sanearDisparadores([{ id: 'd1', trigger_tipo: 'manual' }, { id: 'd1', trigger_tipo: TRIGGER_EMAIL_RECIBIDO, subtipo: 'recibido' }]);
  assert.deepEqual(repetidos.map((x) => x.id), ['d1', 'd2']);
  assert.equal(sanearDisparadores(Array.from({ length: 30 }, () => ({ trigger_tipo: 'manual' }))).length, TOPE_DISPARADORES);
  // El horario se sanea con la regla de lib/cron-aviso.ts; uno que no se entiende no queda.
  assert.equal(sanearDisparador({ trigger_tipo: 'etiqueta_puesta', etiqueta_id: 2, cron: { unidad: 'quincena' } })!.cron, undefined);
  assert.equal(nuevoIdDisparador(['d1', 'd2', 'd4']), 'd3');
});

test('⚠️ lo que el primero escribe en las columnas: el embudo SÓLO con un disparador de adquisición', () => {
  // motor-11 (docs/hallazgos-chatbot.md): «ausente no es null». Un null en `funnel_id` es «todos los
  // embudos»: escribirlo al elegir una etiqueta pasaba la automatización a TODOS los productos.
  const et = columnasDeDisparador({ id: 'd1', trigger_tipo: 'etiqueta_puesta', etiqueta_id: 3 });
  assert.ok(!('funnel_id' in et), 'una etiqueta pisa el embudo de la automatización');
  assert.ok(!('etapa' in et), '`etapa` es NOT NULL: sin etapa no se toca');
  assert.deepEqual(et, { trigger_tipo: 'etiqueta_puesta', etapas: null, producto_id: null, etiqueta_id: 3, cron: null });
  const venta = columnasDeDisparador({ id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'a', etapas: ['a', 'b'], funnel_id: 5 });
  assert.deepEqual(venta, { trigger_tipo: 'etapa_actual', etapa: 'a', etapas: ['a', 'b'], funnel_id: 5, producto_id: null, etiqueta_id: null, cron: null });
  assert.equal(columnasDeDisparador({ id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'a' }).etapas, null, 'con una sola etapa, `etapas` null (como la 0230)');
});

test('⚠️ las vistas del motor: un CRON extra que no es de adquisición usa el EMBUDO de la automatización', () => {
  const base = {
    id: 7, trigger_tipo: 'etapa_actual', etapa: 'agenda', etapas: [] as string[], funnel_id: 5, producto_id: null, etiqueta_id: null,
    cron: null, cron_proxima_at: null,
    disparadores: [
      { id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'agenda', funnel_id: 5 },
      { id: 'd2', trigger_tipo: 'etiqueta_puesta', etiqueta_id: 3, cron: CRON, cron_proxima_at: '2026-10-10T15:00:00Z' },
      { id: 'd3', trigger_tipo: 'etapa_actual', etapa: 'ganado', funnel_id: 8 },
    ] as Disparador[],
  };
  const v = vistasPorDisparador(base);
  assert.deepEqual(v.map((x) => [x.disparador.id, x.disparador.indice, x.trigger_tipo]), [['d1', 0, 'etapa_actual'], ['d2', 1, 'etiqueta_puesta'], ['d3', 2, 'etapa_actual']]);
  // Con el embudo del CRON (ausente → null = TODOS), el de etiqueta le escribía a leads de otros productos.
  assert.equal(v[1].funnel_id, 5);
  assert.equal(v[1].etiqueta_id, 3);
  assert.deepEqual(v[1].cron, CRON);
  assert.equal(v[1].cron_proxima_at, '2026-10-10T15:00:00Z');
  assert.equal(v[2].funnel_id, 8, 'el de adquisición lleva SU embudo');
  // Sin la lista, una sola vista: la automatización tal cual.
  assert.equal(vistasPorDisparador({ ...base, disparadores: undefined }).length, 1);
  // Y una automatización, UNA vez, aunque disparen dos de sus CRON.
  assert.deepEqual(unaPorSecuencia([{ id: 1, n: 'a' }, { id: 2, n: 'b' }, { id: 1, n: 'c' }]).map((x) => x.n), ['a', 'b']);
});

// ── 2. Cuándo dispara un evento ─────────────────────────────────────────────────────────────────

test('«Se le puso «X»»: sólo X; «Se agrega etiqueta a un lead»: cualquiera, salvo las de Ignorar', () => {
  const una: Disparador = { id: 'd1', trigger_tipo: 'etiqueta_puesta', etiqueta_id: 3 };
  assert.equal(disparaPorEvento(una, 'etiqueta', { etiquetaId: 3 }), true);
  assert.equal(disparaPorEvento(una, 'etiqueta', { etiquetaId: '3' }), true, 'un bigint llega como texto');
  assert.equal(disparaPorEvento(una, 'etiqueta', { etiquetaId: 4 }), false);
  const cualquiera: Disparador = { id: 'd2', trigger_tipo: TRIGGER_ETIQUETA_AGREGADA, ignorar: [9] };
  assert.equal(disparaPorEvento(cualquiera, 'etiqueta', { etiquetaId: 4 }), true);
  assert.equal(disparaPorEvento(cualquiera, 'etiqueta', { etiquetaId: 9 }), false, '«Ignorar» no ignora');
  assert.equal(disparaPorEvento(cualquiera, 'etiqueta_quitada', { etiquetaId: 4 }), false, 'poner y sacar son dos eventos');
  assert.equal(disparaPorEvento(cualquiera, 'etiqueta', {}), false, 'sin etiqueta en el evento no se cae en «entonces todas»');
  const sacar: Disparador = { id: 'd3', trigger_tipo: TRIGGER_ETIQUETA_QUITADA, ignorar: [] };
  assert.equal(disparaPorEvento(sacar, 'etiqueta_quitada', { etiquetaId: 4 }), true);
  assert.equal(disparaPorEvento(sacar, 'etiqueta', { etiquetaId: 4 }), false);
});

test('Instagram y Messenger: el MISMO evento; sin subtipo en el evento, ninguno', () => {
  const dm: Disparador = { id: 'd1', trigger_tipo: TRIGGER_INSTAGRAM, subtipo: 'dm' };
  assert.equal(disparaPorEvento(dm, 'instagram', { subtipo: 'dm' }), true);
  assert.equal(disparaPorEvento(dm, 'instagram', { subtipo: 'comentario' }), false);
  assert.equal(disparaPorEvento(dm, 'instagram', {}), false);
  assert.equal(disparaPorEvento(dm, 'messenger', { subtipo: 'dm' }), false, 'un DM de Messenger no es uno de Instagram');
  const qr: Disparador = { id: 'd2', trigger_tipo: TRIGGER_MESSENGER, subtipo: 'qr' };
  assert.equal(disparaPorEvento(qr, 'messenger', { subtipo: 'qr' }), true);
  assert.equal(disparaPorEvento({ id: 'd3', trigger_tipo: TRIGGER_EMAIL_RECIBIDO, subtipo: 'recibido' }, 'email_recibido', {}), true);
});

test('⚠️ con HORARIO no responde a ningún evento: un Recurrente sale por su agenda', () => {
  const rec: Disparador = { id: 'd1', trigger_tipo: 'etiqueta_puesta', etiqueta_id: 3, cron: CRON };
  assert.equal(disparaPorEvento(rec, 'etiqueta', { etiquetaId: 3 }), false);
  assert.equal(claseDeDisparador(rec), 'recurrente');
});

test('el barrido no mira lo que dispara sólo por su evento, ni el grupo solo', () => {
  for (const t of [TRIGGER_ETIQUETA_AGREGADA, TRIGGER_ETIQUETA_QUITADA, TRIGGER_INSTAGRAM, TRIGGER_MESSENGER, TRIGGER_EMAIL_RECIBIDO, TRIGGER_SOLO_GRUPO, 'manual']) {
    assert.equal(barreElDisparador({ trigger_tipo: t }), false, t);
  }
  for (const t of ['etapa_actual', 'entrega_actual', 'etiqueta_puesta', 'instant_form_sin_agenda']) assert.equal(barreElDisparador({ trigger_tipo: t }), true, t);
});

// ── 3. Qué le falta ─────────────────────────────────────────────────────────────────────────────

test('lo que le falta: dos iguales, un segundo sin elegir, el grupo sin horario, un evento apagado', () => {
  const a: Disparador = { id: 'd1', trigger_tipo: 'etiqueta_puesta', etiqueta_id: 3 };
  assert.equal(problemaDeDisparadores([a]), null);
  assert.equal(problemaDeDisparadores([a, { ...a, id: 'd2' }]), 'Ese CRON ya está');
  assert.equal(problemaDeDisparadores([{ id: 'd1', trigger_tipo: 'manual' }]), null, 'una automatización recién creada no es un error');
  assert.equal(problemaDeDisparadores([a, { id: 'd2', trigger_tipo: 'manual' }]), 'Elige qué lo dispara');
  assert.equal(problemaDeDisparador({ id: 'd1', trigger_tipo: TRIGGER_SOLO_GRUPO, grupo: true }, { unico: true }), 'El grupo de MaKo es para un Recurrente');
  assert.equal(problemaDeDisparador({ id: 'd1', trigger_tipo: 'manual', cron: CRON }, { unico: true }), 'Elige a quién le llega');
  assert.equal(problemaDeDisparador({ id: 'd1', trigger_tipo: TRIGGER_SOLO_GRUPO, cron: CRON, grupo: true }, { unico: true }), null);
  assert.equal(problemaDeDisparador({ id: 'd1', trigger_tipo: TRIGGER_INSTAGRAM, subtipo: 'anuncio' }, { unico: true }), 'Ese evento todavía no se puede usar');
  assert.equal(problemaDeDisparador({ id: 'd1', trigger_tipo: TRIGGER_MESSENGER, subtipo: null }, { unico: true }), 'Elige el evento');
  assert.equal(problemaDeDisparador({ id: 'd1', trigger_tipo: TRIGGER_INSTAGRAM, subtipo: 'dm', cron: CRON }, { unico: true }), 'Un evento no se repite por horario');
  assert.equal(problemaDeDisparador({ id: 'd1', trigger_tipo: 'entrega_actual', etapa: 'onb' }, { unico: true }), 'Elige el producto');
});

test('los eventos de ManyChat: seis de Instagram y seis de Messenger, con el del anuncio APAGADO (y la tienda, que Zernio no avisa)', () => {
  assert.equal(EVENTOS_INSTAGRAM.length, 6);
  assert.equal(EVENTOS_MESSENGER.length, 6);
  assert.deepEqual(EVENTOS_INSTAGRAM.filter((e) => e.apagado).map((e) => e.subtipo), ['anuncio']);
  // La tienda de Facebook, apagada desde la segunda pasada (09/10/2026): Zernio no la avisa
  // (`DISPARADORES_SOCIALES` la marca `disponible: false`, tests/disparadores-canal-social.test.ts).
  assert.deepEqual(EVENTOS_MESSENGER.filter((e) => e.apagado).map((e) => e.subtipo), ['anuncio', 'tienda']);
  assert.deepEqual(CLASES_DISPARADOR.map((c) => c.label), ['Producto', 'Recurrente', 'Etiqueta', 'Instagram', 'Messenger', 'Email']);
});

// ── 4. El Recurrente: «A quién» ─────────────────────────────────────────────────────────────────

test('«A quién»: el grupo y los clientes a la vez; con el grupo, la última etapa se puede sacar', () => {
  const r0: Disparador = { id: 'd1', trigger_tipo: 'manual', cron: CRON };
  const conGrupo = quienTrasTocar(r0, VALOR_GRUPO);
  assert.equal(conGrupo.trigger_tipo, TRIGGER_SOLO_GRUPO);
  assert.deepEqual(valoresQuien(conGrupo), [VALOR_GRUPO]);
  // El grupo es lo único marcado: no se apaga (un Recurrente sin nadie a quién mandarle no hace nada).
  assert.deepEqual(valoresQuien(quienTrasTocar(conGrupo, VALOR_GRUPO)), [VALOR_GRUPO]);
  // Clientes de una etapa de la entrega, ADEMÁS del grupo.
  const ambos = quienTrasTocar(conGrupo, 'entrega:9:onb');
  assert.equal(ambos.trigger_tipo, 'entrega_actual');
  assert.equal(ambos.grupo, true);
  assert.deepEqual(valoresQuien(ambos), [VALOR_GRUPO, 'entrega:9:onb']);
  assert.deepEqual(ambos.cron, CRON, 'cambiar a quién le sacó el horario');
  // Otra etapa del mismo kanban se suma.
  assert.deepEqual(valoresQuien(quienTrasTocar(ambos, 'entrega:9:hito1')), [VALOR_GRUPO, 'entrega:9:onb', 'entrega:9:hito1']);
  // Con el grupo, sacar la ÚLTIMA etapa deja sólo el grupo.
  const soloGrupo = quienTrasTocar(ambos, 'entrega:9:onb');
  assert.equal(soloGrupo.trigger_tipo, TRIGGER_SOLO_GRUPO);
  assert.deepEqual(valoresQuien(soloGrupo), [VALOR_GRUPO]);
  // Sin el grupo, la última etapa no se saca.
  const sinGrupo = quienTrasTocar(ambos, VALOR_GRUPO);
  assert.equal(sinGrupo.grupo, undefined);
  assert.deepEqual(valoresQuien(quienTrasTocar(sinGrupo, 'entrega:9:onb')), ['entrega:9:onb']);
});

// ── 5. La Etiqueta: el desplegable y «Ignorar» ──────────────────────────────────────────────────

test('la Etiqueta: una puntual, «Se agrega…», «Se elimina…», y el Ignorar sobrevive entre las dos', () => {
  let d: Disparador = { id: 'd1', trigger_tipo: 'manual' };
  d = conValorEtiqueta(d, VALOR_ETIQUETA_AGREGADA);
  assert.equal(d.trigger_tipo, TRIGGER_ETIQUETA_AGREGADA);
  d = alternarIgnorar(alternarIgnorar(d, 4), 7);
  assert.deepEqual(d.ignorar, [4, 7]);
  d = alternarIgnorar(d, 4);
  assert.deepEqual(d.ignorar, [7]);
  d = conValorEtiqueta(d, VALOR_ETIQUETA_QUITADA);
  assert.equal(d.trigger_tipo, TRIGGER_ETIQUETA_QUITADA);
  assert.deepEqual(d.ignorar, [7], 'pasar de «se agrega» a «se elimina» borró lo que ignoraba');
  d = conValorEtiqueta(d, 'etiqueta:5');
  assert.deepEqual(d, { id: 'd1', trigger_tipo: 'etiqueta_puesta', etiqueta_id: 5 });
  assert.equal(valorEtiqueta(d), 'etiqueta:5');
});

// ── 6. Cómo se dice ─────────────────────────────────────────────────────────────────────────────

test('lo que dice cada fila de la tarjeta CRON', () => {
  const n = { deSiempre: (d: Disparador) => `de siempre: ${d.trigger_tipo}`, tz: 'America/Mexico_City' };
  assert.equal(textoDeDisparador({ id: 'd1', trigger_tipo: TRIGGER_ETIQUETA_AGREGADA }, n), 'Se agrega etiqueta a un lead');
  assert.equal(textoDeDisparador({ id: 'd1', trigger_tipo: TRIGGER_ETIQUETA_QUITADA }, n), 'Se elimina etiqueta a un lead');
  assert.equal(textoDeDisparador({ id: 'd1', trigger_tipo: TRIGGER_INSTAGRAM, subtipo: 'historia' }, n), 'El usuario responde a tu historia');
  assert.equal(textoDeDisparador({ id: 'd1', trigger_tipo: TRIGGER_EMAIL_RECIBIDO, subtipo: 'recibido' }, n), 'Recibes un email');
  assert.equal(textoDeDisparador({ id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'a' }, n), 'de siempre: etapa_actual');
  assert.equal(textoDeDisparador({ id: 'd1', trigger_tipo: TRIGGER_SOLO_GRUPO, cron: CRON, grupo: true }, n),
    'Todos los días a las 09:00 de America/Mexico_City · El grupo de MaKo');
  assert.equal(textoDeDisparador({ id: 'd1', trigger_tipo: 'etiqueta_puesta', etiqueta_id: 3, cron: CRON, grupo: true }, n),
    'Todos los días a las 09:00 de America/Mexico_City · El grupo de MaKo y de siempre: etiqueta_puesta');
});

// ── 7. El Recurrente al grupo: qué sale ─────────────────────────────────────────────────────────

test('⚠️ al grupo le llegan los TEXTOS de la salida; una condición corta, una espera no se espera', () => {
  const pasos: PasoGrafo[] = [
    { id: 'a', canal: 'whatsapp', cuerpo: 'Buen lunes equipo', siguiente: 'b', paralelos: ['m'] },
    { id: 'b', nodo: 'esperar', espera: { tipo: 'duracion', minutos: 60 } as never, siguiente: 'c' },
    { id: 'c', canal: 'email', asunto: 'x', cuerpo: 'un mail', siguiente: 'd' },
    { id: 'd', canal: 'whatsapp', tipo: 'audio', audio_id: 3, cuerpo: '', siguiente: 'e' },
    { id: 'e', nodo: 'condicion', ramas: [{ id: 'r', modo: 'todas', filas: [], siguiente: 'f' }], si_no: null },
    { id: 'f', canal: 'whatsapp', cuerpo: 'NO TIENE QUE SALIR', siguiente: null },
    { id: 'm', accion: { operacion: 'avisar_al_equipo', params: { mensaje: 'Revisen la agenda' } }, siguiente: 'n' },
    { id: 'n', accion: { operacion: 'poner_etiqueta_lead', params: { etiquetaId: 3 } }, siguiente: null },
  ];
  assert.deepEqual(textosParaElGrupo(pasos), ['Buen lunes equipo', 'Revisen la agenda']);
  // Varias partes: las de texto y el pie de un archivo, en orden.
  const partes: PasoGrafo[] = [{ id: 'a', canal: 'whatsapp', cuerpo: 'Hola', partes: [{ tipo: 'texto', cuerpo: 'Hola' }, { tipo: 'audio', audio_id: 2 }, { tipo: 'media', media_id: 4, cuerpo: 'El PDF' }], siguiente: null }];
  assert.deepEqual(textosParaElGrupo(partes), ['Hola', 'El PDF']);
});

// ── 8. El huso: los países del teléfono, con sus zonas ──────────────────────────────────────────

test('cada país de la lista del teléfono tiene sus zonas, y todas las conoce `Intl`', () => {
  for (const p of PAISES) {
    const zonas = ZONAS_POR_PAIS[p.iso2];
    assert.ok(zonas && zonas.length, `falta ${p.nombre}`);
    for (const z of zonas) {
      assert.doesNotThrow(() => new Intl.DateTimeFormat('en-US', { timeZone: z.tz }), `${p.iso2}: ${z.tz}`);
      assert.equal(paisDeZona(z.tz), p.iso2);
    }
  }
  assert.ok(ZONAS_POR_PAIS.MX.length >= 4, 'México tiene varias zonas: Tijuana y Cancún tienen el mismo +52');
  assert.equal(paisDeZona('Marte/Olympus'), null);
});

test('⚠️ al guardar, un horario que NO cambió conserva su ocurrencia; uno nuevo siembra la suya, en el futuro', () => {
  const ahora = new Date('2026-10-12T16:00:00Z');                       // lunes 10:00 de México
  const previo: Disparador = { id: 'd2', trigger_tipo: TRIGGER_SOLO_GRUPO, grupo: true, cron: { unidad: 'semana', cada: 1, hora: 9, minuto: 0, diaSemana: 1 }, cron_proxima_at: '2026-10-12T15:00:00.000Z' };
  // Tocar «A quién» (sumarle una etiqueta) guarda la lista entera: el horario es el mismo.
  const tocado: Disparador = { ...previo, trigger_tipo: 'etiqueta_puesta', etiqueta_id: 4 };
  const [a] = conProximas([tocado], [previo], ahora, 'America/Mexico_City');
  assert.equal(a.cron_proxima_at, '2026-10-12T15:00:00.000Z', 'se corrió el ancla a «ahora» y se perdió la ocurrencia de hoy');
  // Cambiar la hora es otro horario: siembra la próxima, estrictamente después de ahora.
  const [b] = conProximas([{ ...tocado, cron: { ...previo.cron!, hora: 11 } }], [previo], ahora, 'America/Mexico_City');
  assert.equal(b.cron_proxima_at, '2026-10-12T17:00:00.000Z');
  // Sin horario, ninguna.
  assert.equal(conProximas([{ id: 'd1', trigger_tipo: 'etiqueta_puesta', etiqueta_id: 4, cron_proxima_at: 'x' }], [], ahora, 'UTC')[0].cron_proxima_at, null);
  // Lo que se valida contra el negocio: sólo lo nuevo o distinto.
  const viejo: Disparador = { id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'borrada', funnel_id: 5 };
  assert.deepEqual(nuevosOCambiados([viejo, tocado], [viejo, previo]).map((d) => d.id), ['d2']);
});

test('la firma no mira el id ni la próxima ocurrencia, y sí el Ignorar y el horario', () => {
  const a: Disparador = { id: 'd1', trigger_tipo: TRIGGER_ETIQUETA_AGREGADA, ignorar: [2, 1] };
  assert.equal(firmaDisparador(a), firmaDisparador({ ...a, id: 'd9', ignorar: [1, 2] }));
  assert.notEqual(firmaDisparador(a), firmaDisparador({ ...a, ignorar: [1] }));
  const r: Disparador = { id: 'd1', trigger_tipo: TRIGGER_SOLO_GRUPO, cron: CRON, grupo: true, cron_proxima_at: '2026-10-10T15:00:00Z' };
  assert.equal(firmaDisparador(r), firmaDisparador({ ...r, cron_proxima_at: null }));
  assert.notEqual(firmaDisparador(r), firmaDisparador({ ...r, cron: { ...CRON, hora: 10 } }));
  assert.equal(disparadorDeColumnas({ trigger_tipo: 'manual' }).trigger_tipo, 'manual');
});

// PROBADO ROMPIÉNDOLO (09/10/2026), contra una base de 17 pass / 0 fail, una rotura por vez y
// restaurando de memoria:
//   · `disparadoresDe` heredando lo de la lista aunque cambió el trigger              → 16 / 1
//     (⚠️ la primera versión del test lo miraba con `ignorar` y daba VERDE: la higiene ya le saca
//     el `ignorar` a un disparador de etapa. Lo que de verdad muerde es el `subtipo` entre canales.)
//   · `disparadoresDe` devolviendo SÓLO el primero cuando el trigger cambió           → 16 / 1
//   · `columnasDeDisparador` con `funnel_id` siempre                                  → 16 / 1
//   · `disparaPorEvento` sin mirar `ignorar`                                          → 16 / 1
//   · `disparaPorEvento` sin el corte del horario                                     → 16 / 1
//   · `quienTrasTocar` sin la regla «con el grupo, la última etapa se puede sacar»    → 16 / 1
//   · `textosParaElGrupo` siguiendo las ramas de una condición                        → 16 / 1
//   · `problemaDeDisparadores` sin el chequeo de dos iguales                          → 16 / 1
// Restaurado: 17 / 0. Y con las vistas del motor y el guardado (19 en total):
//   · `vistasPorDisparador` con el `funnel_id` del CRON también fuera de adquisición  → 18 / 1
//   · `conProximas` recalculando siempre (sin conservar la de un horario igual)       → 18 / 1
// Restaurado: 19 / 0.
