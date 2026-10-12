// =============================================================================
// La tarjeta «MaKo en WhatsApp» POR PARTES (undécima tanda, decisión 2 de la décima): el modelo puro
// =============================================================================
// lib/mako-tarjeta.ts. Lo que fija este test:
//   · ida y vuelta editor ↔ tarjeta (`pasoDeMako` / `paramsDeMako`): texto solo, audio solo, texto + audio +
//     archivo con pausas; el `id` y el `orden` REALES; `partes` siempre explícita; `mensaje` como espejo;
//   · la guarda de borrado de la biblioteca (`pasoUsaAudio` / `pasoUsaArchivo`) mira la tarjeta MaKo;
//   · `armarAvisoDeTarjeta`: la tarjeta tal cual sale SIN envoltorio, sin rótulo, SIN dedup y con el estado
//     fijo; la de antes y la del «Otra cosa» (con `respuesta`) salen como siempre;
//   · `resultadoDelAviso`: un WhatsApp que no salió es un fallo (se acabó el «Le avisé» falso);
//   · `prepararPartes`: TODOS los binarios se bajan antes de resolver un texto, y si falta uno no sale nada;
//   · el rótulo sobre una lista (`partesConRotulo`).
// El envío al grupo y el registro de punta a punta (con Evolution y la base de mentira) están en
// tests/voz-mako.test.ts.
//
// Y desde la ola 2 (w2-mako-editor), la tarjeta en el LIENZO: «¿está escrita?» por sus partes, la tarjeta nueva TAL
// CUAL, «minutos entre dos mensajes» sobre una MAKO y la forma única de sus params (tests 12-15, roturas al lado).
//
// Probado rompiéndolo (11/10/2026, arnés del scratchpad `wf-undecima/w1-mako-envio/romper.mjs`: una rotura por
// vez, restaurada byte a byte y comprobada con md5; base 11 / 11):
//   1. dedup en la tarjeta tal cual (`dedupKey`/`dedupTtlMin` en la rama tal cual de `armarAvisoDeTarjeta`)
//                                                                     → 1 rojo (5); y 1 en tests/voz-mako (6).
//   2. `prepararPartes` resuelve los textos ANTES de bajar los binarios                → 1 rojo (8).
//   3. `resultadoDelAviso` sin mirar `waError` (el «Le avisé» falso de antes) → 1 rojo (7); y 1 en voz-mako (6).
//   4. `paramsDeMako` guardando `partes` sólo con dos o más (como un WhatsApp)  → 4 rojos (1, 2, 3 y 11).
//   5. `pasoUsaAudio` sin mirar la tarjeta MaKo                                         → 1 rojo (4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pasoDeMako, paramsDeMako, partesDeMako, esTarjetaTalCual, textoDePartes, armarAvisoDeTarjeta, resultadoDelAviso,
  prepararPartes, partesConRotulo, textoDePreparadas, paramsConPartes, resumenDeMako, ESTADO_TARJETA, OP_TARJETA_MAKO, TEXTO_SOLO_AUDIO,
  TOPE_MENSAJE_MAKO, type PartePreparada,
} from '../lib/mako-tarjeta';
import { faltaEscribir, tarjetasIncompletas, nodoNuevo, grafoDeSecuencia, esMako, type PasoParaGrafo } from '../lib/flujo-conversacion';
import { partirConEspera } from '../lib/flujo-edicion';
import { claseDe } from '../lib/flujo-grafo';
import { formaGuardada, pasoUsaAudio, pasoUsaArchivo, pasosUsanAudio, type ParteMensaje } from '../lib/mensaje-partes';
import { pasosUsanAdjunto } from '../lib/setting-adjuntos-reglas';
import { OP_AVISAR } from '../lib/flujo-legado';
import { AVISO_REPETIDO, avisoSalio } from '../lib/nutricion-grafo-motor';

const texto = (cuerpo: string, pausa_s?: number): ParteMensaje => (pausa_s ? { tipo: 'texto', cuerpo, pausa_s } : { tipo: 'texto', cuerpo });
const audio = (id: number, pausa_s?: number): ParteMensaje => (pausa_s ? { tipo: 'audio', audio_id: id, pausa_s } : { tipo: 'audio', audio_id: id });
const media = (id: number, cuerpo?: string, pausa_s?: number): ParteMensaje =>
  ({ tipo: 'media', media_id: id, ...(cuerpo ? { cuerpo } : {}), ...(pausa_s ? { pausa_s } : {}) }) as ParteMensaje;
/** Una tarjeta MaKo como la guarda el lienzo (con su id y su orden reales, y un lugar en el grafo). */
const tarjeta = (params: Record<string, unknown>) => ({ id: 'ma_aviso', orden: 4, siguiente: 'b', canal: 'whatsapp', delay_horas: 0, cuerpo: '', accion: { operacion: 'avisar_al_equipo', params } });

test('1. ida y vuelta: un texto solo (y la tarjeta de antes se lee como su texto)', () => {
  assert.equal(OP_TARJETA_MAKO, OP_AVISAR, 'el literal de la tarjeta dejó de ser el de `OP_AVISAR`');
  // La de antes: sin `partes`, un texto en `mensaje`.
  const vieja = tarjeta({ leadId: 'evento', titulo: 'Ojo', mensaje: 'Agendó y no confirmó.' });
  assert.equal(esTarjetaTalCual(vieja.accion.params), false);
  const dto = pasoDeMako(vieja);
  assert.equal(dto.id, 'ma_aviso', 'el editor necesita el id REAL de la tarjeta');
  assert.equal(dto.orden, 4);
  assert.equal(dto.siguiente, 'b', 'el lugar en el grafo viaja intacto');
  assert.equal(dto.canal, 'whatsapp');
  assert.equal(dto.proveedor, 'no_oficial');
  assert.deepEqual({ tipo: dto.tipo, cuerpo: dto.cuerpo, audio_id: dto.audio_id, media_id: dto.media_id, partes: dto.partes },
    { tipo: 'texto', cuerpo: 'Agendó y no confirmó.', audio_id: null, media_id: null, partes: [] });
  // El editor cambia el texto: vuelve como lista EXPLÍCITA de una parte, con el espejo, y conserva lead y título.
  const p = paramsDeMako(vieja.accion.params, { cuerpo: 'Nuevo agendado: {{nombre_completo}}' });
  assert.deepEqual(p, { leadId: 'evento', titulo: 'Ojo', mensaje: 'Nuevo agendado: {{nombre_completo}}', partes: [texto('Nuevo agendado: {{nombre_completo}}')] });
  assert.equal(esTarjetaTalCual(p), true, 'una sola parte también sale tal cual');
  // Y se vuelve a leer igual.
  assert.equal(pasoDeMako(tarjeta(p)).cuerpo, 'Nuevo agendado: {{nombre_completo}}');
});

test('2. ida y vuelta: un audio solo (la Voz de MaKo), con el espejo que dice que es una nota de voz', () => {
  const p = paramsDeMako({ leadId: 'evento' }, { tipo: 'audio', audio_id: 31, cuerpo: '' });
  assert.deepEqual(p, { leadId: 'evento', mensaje: TEXTO_SOLO_AUDIO, partes: [audio(31)] });
  const dto = pasoDeMako(tarjeta(p));
  assert.deepEqual({ tipo: dto.tipo, audio_id: dto.audio_id, cuerpo: dto.cuerpo, partes: dto.partes }, { tipo: 'audio', audio_id: 31, cuerpo: '', partes: [] });
  // El espejo de una nota de voz no está vacío: el «Falta completar» del lienzo no la frena.
  assert.ok(String(p.mensaje).trim());
});

test('3. ida y vuelta: texto + audio + archivo con pausas, y el espejo recortado', () => {
  const lista = [texto('Hola equipo, {{nombre_completo}} agendó'), audio(31, 3), media(9, 'La agenda de hoy', 2)];
  // El editor manda la forma guardada (un diff de ella): la primera en los campos de siempre, todas en `partes`.
  const p = paramsDeMako({ leadId: 'evento' }, formaGuardada(lista));
  assert.deepEqual(p.partes, lista);
  assert.equal(p.mensaje, 'Hola equipo, {{nombre_completo}} agendó\n\nLa agenda de hoy', 'el espejo son los textos y los pies, unidos');
  const dto = pasoDeMako(tarjeta(p));
  assert.deepEqual(dto.partes, lista);
  assert.equal(dto.tipo, 'texto');
  assert.equal(dto.cuerpo, 'Hola equipo, {{nombre_completo}} agendó');
  // Cambiar SÓLO la primera (los campos de siempre mandan sobre ella) no borra las demás.
  const p2 = paramsDeMako(p, { cuerpo: 'Nuevo: {{nombre_completo}}' });
  assert.deepEqual(p2.partes, [texto('Nuevo: {{nombre_completo}}'), audio(31, 3), media(9, 'La agenda de hoy', 2)]);
  // `partes: []` es «una sola parte, lo sé»: se queda la primera.
  assert.deepEqual(paramsDeMako(p, { partes: [] }).partes, [texto('Hola equipo, {{nombre_completo}} agendó')]);
  // El espejo tiene el tope del registro.
  const largo = paramsDeMako({}, formaGuardada([texto('a'.repeat(900)), texto('b'.repeat(900))]));
  assert.equal(String(largo.mensaje).length, TOPE_MENSAJE_MAKO);
  // Lo que el registro no declara no se guarda (la `respuesta` la pone el motor en cada corrida).
  assert.deepEqual(Object.keys(paramsDeMako({ leadId: 'evento', respuesta: 'x', otro: 1 }, { cuerpo: 'y' })).sort(), ['leadId', 'mensaje', 'partes']);
  // Sin `partes` y sin mensaje, no hay nada.
  assert.deepEqual(partesDeMako({ leadId: 'evento' }), []);
  assert.equal(textoDePartes([]), '');
});

test('4. la Voz de MaKo y el archivo de una tarjeta MaKo no se pueden borrar de la biblioteca', () => {
  const p = tarjeta({ leadId: 'evento', mensaje: 'x', partes: [texto('x'), audio(31), media(9)] });
  assert.ok(pasoUsaAudio(p, 31), 'el audio de la tarjeta MaKo se podía borrar: el aviso fallaría en cada lead');
  assert.ok(pasoUsaArchivo(p, 9));
  assert.ok(!pasoUsaAudio(p, 32) && !pasoUsaArchivo(p, 10));
  assert.ok(pasosUsanAudio([{ canal: 'whatsapp', cuerpo: 'hola' }, p], 31));
  assert.ok(pasosUsanAdjunto([p], 9), 'la guarda de la biblioteca de archivos (lib/setting-adjuntos-reglas.ts)');
  // Otra acción con una lista que se llama igual no es la tarjeta MaKo.
  assert.ok(!pasoUsaAudio({ accion: { operacion: 'crear_tarea', params: { partes: [audio(31)] } } }, 31));
});

const preparadas: PartePreparada[] = [
  { tipo: 'texto', texto: 'Nuevo agendado: Ana López' },
  { tipo: 'audio', base64: 'QUJD', mime: 'audio/mpeg', pausaMs: 3000 },
];
const lead = { id: 5, nombre: 'Ana López', telefono: '+52 664 000 0000' };
const LINK = 'https://hola-mako.com/crm/5?ws=1';

test('5. la tarjeta TAL CUAL: sin envoltorio, sin rótulo, SIN dedup, con el estado fijo', () => {
  const a = armarAvisoDeTarjeta({ leadId: 5, mensaje: 'Nuevo agendado: {{nombre_completo}}', partes: [texto('x'), audio(3)] }, {
    desdeUnFlujo: true, respuesta: '', lead, linkLead: LINK, textos: { titulo: 'Ana López: hay que verlo', mensaje: 'Nuevo agendado: Ana López' }, partes: preparadas,
  });
  assert.equal(a.rotulo, false, 'sin el rótulo de barras');
  assert.deepEqual(a.estado, ESTADO_TARJETA, 'el interruptor es la automatización');
  assert.deepEqual(ESTADO_TARJETA, { activo: true, wa: true, email: false, frecuenciaMin: 0 });
  assert.ok(!('dedupKey' in a) && !('dedupTtlMin' in a), 'la tarjeta tal cual NO se deduplica: el reclamo del motor ya impide el doble envío');
  assert.deepEqual(a.partes, preparadas, 'salen las partes como están');
  assert.equal(a.texto, 'Nuevo agendado: Ana López', 'el feed lleva los textos');
  assert.ok(!a.texto.includes('🟡') && !a.texto.includes('— MaKo'));
  assert.equal(a.link, '/crm/5');
  assert.equal(textoDePreparadas([{ tipo: 'audio', base64: 'x', mime: 'audio/mpeg' }]), TEXTO_SOLO_AUDIO, 'un aviso que es sólo la nota de voz dice eso en el feed');
});

test('6. la tarjeta de ANTES, la de la API y la del «Otra cosa» salen como siempre', () => {
  // La de antes (sin `partes`), desde un flujo: EXACTAMENTE el texto de la décima.
  const vieja = armarAvisoDeTarjeta({ leadId: 5, mensaje: 'Agendó y no confirmó.' }, {
    desdeUnFlujo: true, respuesta: '', lead, linkLead: LINK, textos: { titulo: 'no confirmó la reunión', mensaje: 'Agendó y no confirmó.' }, partes: null,
  });
  assert.equal(vieja.texto, ['🟡 *no confirmó la reunión*', '', 'Agendó y no confirmó.', '', 'Ana López · +52 664 000 0000', `👉 ${LINK}`, '', '— MaKo'].join('\n'));
  assert.equal(vieja.dedupKey, 'lead:5');
  assert.equal(vieja.dedupTtlMin, 720);
  assert.ok(!('rotulo' in vieja) && !('estado' in vieja) && !('partes' in vieja), 'la de antes no cambia nada del aviso');
  // Con `respuesta` (el «Otra cosa» del AI Step), por respuesta, y con lo que escribió el lead.
  const otra = armarAvisoDeTarjeta({ leadId: 5, mensaje: 'x', partes: [texto('x')] }, {
    desdeUnFlujo: true, respuesta: '¿Cuánto cuesta?', lead, linkLead: LINK, textos: { titulo: 'T', mensaje: 'Te escribió algo' }, partes: [{ tipo: 'texto', texto: 'Te escribió algo' }],
  });
  assert.equal(otra.dedupKey, 'lead:5:resp:¿Cuánto cuesta?');
  assert.ok(otra.texto.includes('_"¿Cuánto cuesta?"_'));
  assert.ok(!('partes' in otra), 'con sólo textos, el aviso es un texto como siempre');
  // Desde la API (no un flujo), con una nota de voz: el texto envuelto PRIMERO y después la nota de voz.
  const api = armarAvisoDeTarjeta({ mensaje: 'x', partes: [texto('x'), audio(3)] }, {
    desdeUnFlujo: false, respuesta: '', lead: null, linkLead: null, textos: { titulo: 'Una automatización te avisa', mensaje: 'Nuevo agendado: Ana López' }, partes: preparadas,
  });
  assert.ok(!('dedupKey' in api), 'sin lead no hay entidad de qué deduplicar');
  assert.deepEqual(api.partes?.map((p) => p.tipo), ['texto', 'audio'], 'el audio no se pierde');
  assert.equal((api.partes?.[0] as { texto: string }).texto, api.texto);
  assert.ok(api.texto.startsWith('🟡 *Una automatización te avisa*') && api.texto.endsWith('— MaKo'));
});

test('7. «Le avisé» sólo si llegó: un WhatsApp que no salió es un fallo con su causa', () => {
  const base = { ok: true, wa: false, deduped: false };
  const r = resultadoDelAviso({ ...base, waError: 'el workspace no tiene grupo de MaKo todavía' }, lead);
  assert.equal(r.ok, false, 'el éxito falso de la décima: «Le avisé» con el grupo inexistente');
  assert.match(r.resumen, /no tiene grupo de MaKo/);
  assert.deepEqual(resultadoDelAviso({ ...base, wa: true }, lead), { ok: true, resumen: 'Le avisé al equipo.' });
  const rep = resultadoDelAviso({ ...base, deduped: true }, lead);
  assert.ok(rep.ok && rep.resumen.startsWith(AVISO_REPETIDO) && !avisoSalio(rep), 'el deduplicado sigue diciéndoselo al motor');
  assert.equal(resultadoDelAviso({ ...base, apagado: true }, lead).ok, true, 'apagado en Configuraciones no es un fallo');
  assert.equal(resultadoDelAviso({ ...base, agrupado: true }, null).ok, true);
  assert.equal(resultadoDelAviso({ ok: false, wa: false, deduped: false }, null).ok, false);
  assert.equal(resultadoDelAviso({ ...base }, null).ok, true, 'sólo por email (sin WhatsApp elegido) no es un fallo');
});

test('8. prepararPartes: TODOS los binarios se bajan antes de resolver un texto; si falta uno, no sale nada', async () => {
  const orden: string[] = [];
  const d = {
    audio: async (id: number) => { orden.push(`audio ${id}`); return id === 404 ? ('no-existe' as const) : { base64: 'QQ==', mime: 'audio/mpeg' }; },
    archivo: async (id: number) => { orden.push(`archivo ${id}`); return id === 500 ? null : { base64: 'Qg==', media: { tipo: 'document' as const, mimetype: 'application/pdf', fileName: 'a.pdf' } }; },
    texto: async (t: string) => { orden.push(`texto ${t}`); return t.replace('{{x}}', 'Ana'); },
  };
  const ok = await prepararPartes([texto('Hola {{x}}'), audio(1, 3), media(2, 'pie {{x}}'), texto('{{vacio}}'.replace('{{vacio}}', ' '))], d);
  assert.ok(ok.ok);
  assert.deepEqual(orden.slice(0, 2), ['audio 1', 'archivo 2'], 'un texto se resolvió antes de bajar los binarios');
  if (ok.ok) {
    assert.deepEqual(ok.partes.map((p) => p.tipo), ['texto', 'audio', 'media'], 'un texto vacío no sale');
    assert.equal((ok.partes[0] as { texto: string }).texto, 'Hola Ana');
    assert.equal(ok.partes[0].pausaMs, undefined, 'la primera no espera');
    assert.equal(ok.partes[1].pausaMs, 3000);
    assert.equal(ok.partes[2].pausaMs, 1000, 'sin elegir, la pausa de siempre');
    assert.equal((ok.partes[2] as { caption?: string }).caption, 'pie Ana');
  }
  orden.length = 0;
  const falta = await prepararPartes([texto('Hola'), audio(1), audio(404)], d);
  assert.deepEqual(falta, { ok: false, error: 'parte 3: el audio ya no existe' });
  assert.ok(!orden.some((x) => x.startsWith('texto')), 'con un binario que falta no se resuelve nada');
  assert.deepEqual(await prepararPartes([media(500)], d), { ok: false, error: 'parte 1: no pude bajar el archivo' });
  assert.deepEqual(await prepararPartes([texto('  ')], { ...d, texto: async () => '' }), { ok: false, error: 'El aviso quedó vacío.' });
});

test('9. el rótulo sobre una lista: pegado a la primera si es texto, idempotente; sin él, intacta', () => {
  const lista: PartePreparada[] = [{ tipo: 'texto', texto: 'hola' }, { tipo: 'audio', base64: 'x', mime: 'audio/mpeg' }];
  assert.equal((partesConRotulo(lista, '━━ 👤 LEAD ━━')[0] as { texto: string }).texto, '━━ 👤 LEAD ━━\nhola');
  assert.deepEqual(partesConRotulo(lista, null), lista, 'la tarjeta tal cual no lleva rótulo');
  const ya: PartePreparada[] = [{ tipo: 'texto', texto: '━━ 👤 LEAD ━━\nhola' }];
  assert.deepEqual(partesConRotulo(ya, '━━ 👤 LEAD ━━'), ya);
  const audioPrimero: PartePreparada[] = [{ tipo: 'audio', base64: 'x', mime: 'audio/mpeg' }];
  assert.deepEqual(partesConRotulo(audioPrimero, '━━ 👤 LEAD ━━'), audioPrimero);
});

test('10. el editor de la ola 2 lee y escribe por estas dos funciones, nunca a mano', () => {
  // `pasoDeMako` devuelve un paso nuevo: no muta la tarjeta guardada.
  const t = tarjeta({ leadId: 'evento', mensaje: 'x' });
  const antes = JSON.stringify(t);
  pasoDeMako(t);
  paramsDeMako(t.accion.params, { cuerpo: 'y' });
  assert.equal(JSON.stringify(t), antes);
});

test('11. una tarjeta con «MaKo lo adapta» no existe: el tipo ia se lee como texto', () => {
  const p = paramsDeMako({}, { tipo: 'ia', cuerpo: 'Hola' });
  assert.deepEqual(p.partes, [texto('Hola')]);
  assert.equal(pasoDeMako(tarjeta(p)).tipo, 'texto');
});

// ── Ola 2 (w2-mako-editor): la tarjeta en el LIENZO ─────────────────────────────────────────────────────────
// El lienzo (lib/flujo-conversacion.ts, lib/flujo-edicion.ts) lee y escribe la tarjeta por estas funciones: lo que
// cuenta para «¿está escrita?» son sus PARTES, una tarjeta nueva nace TAL CUAL, y «minutos entre dos mensajes» la
// parte en dos tarjetas MAKO, como a un WhatsApp.
// Probado rompiéndolo (11/10/2026, arnés scratchpad/wf-undecima/w2-mako-editor/romper.mjs: una rotura por vez,
// restaurada byte a byte y comprobada con md5; base 15 / 0 en este archivo):
//   R1. `faltaEscribir` vuelve a mirar el espejo `mensaje` (y no las partes)                → 1 rojo (12).
//   R2. `nodoNuevo('mako')` nace como antes (`mensaje: ''`, sin `partes`)                   → 1 rojo (14).
//   R3. `partirConEspera` no acepta una tarjeta MAKO (sólo `claseDe === 'mensaje'`)         → 1 rojo (13).
//   R4. `paramsConPartes` sin sanear (una parte de texto vacía se guarda)                    → 1 rojo (15).
const enLienzo = (id: string, params: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  ({ id, canal: 'whatsapp', delay_horas: 0, cuerpo: '', siguiente: null, accion: { operacion: 'avisar_al_equipo', params }, ...extra }) as unknown as PasoParaGrafo;

test('12. «¿está escrita?» mira las PARTES: una tarjeta que es sólo la Voz de MaKo o un archivo sale; una sin partes, no', () => {
  // Sólo la Voz de MaKo (sin texto ni espejo): está escrita, y la tarjeta lo dice.
  const soloVoz = enLienzo('v', { leadId: 'evento', partes: [audio(31)] });
  assert.equal(faltaEscribir([soloVoz]), null, 'una tarjeta que es sólo la Voz de MaKo no se puede publicar');
  assert.ok(!tarjetasIncompletas([soloVoz]).has('v'));
  const n = grafoDeSecuencia([soloVoz], { disparador: 'X' }).nodos.find((x) => x.id === 'v')!;
  assert.equal(n.detalle, TEXTO_SOLO_AUDIO);
  assert.equal(n.advertencia, undefined, 'la tarjeta dice «Sin escribir» con la Voz de MaKo adentro');
  assert.equal(faltaEscribir([enLienzo('f', { partes: [media(9)] })]), null, 'sólo un archivo también sale');
  // Sin partes (la lista explícita y vacía), falta, aunque el espejo diga algo: la lista manda.
  const vacia = enLienzo('x', { leadId: 'evento', mensaje: 'viejo', partes: [] });
  assert.equal(faltaEscribir([vacia])?.id, 'x');
  assert.ok(tarjetasIncompletas([vacia]).has('x'));
  // La de antes (sin lista) se lee por su texto, como siempre.
  assert.equal(faltaEscribir([enLienzo('a', { mensaje: 'Agendó y no confirmó.' })]), null);
  assert.equal(faltaEscribir([enLienzo('a', { mensaje: '   ' })])?.id, 'a');
  // Varias partes: el renglón de un WhatsApp (`resumenDePartes`).
  assert.equal(resumenDeMako({ partes: [texto('Hola equipo'), audio(31), media(9, 'La agenda')] }), 'Hola equipo · [audio] · [archivo] La agenda');
});

test('13. «minutos entre dos mensajes» parte una tarjeta MAKO en dos tarjetas MAKO con el DELAY en el medio', () => {
  const lista = [texto('Nuevo agendado: {{nombre_completo}}'), audio(31, 3), media(9, 'Su ficha')];
  const pasos = [
    { id: 'entrada', nodo: 'inicio', siguiente: 'a', canal: 'whatsapp', delay_horas: 0, cuerpo: '' },
    enLienzo('a', { leadId: 'evento', titulo: 'Ojo', mensaje: 'x', partes: lista }, { siguiente: 'z', paralelos: ['p'] }),
    { id: 'z', canal: 'whatsapp', delay_horas: 0, cuerpo: 'después', siguiente: null },
    { id: 'p', canal: 'whatsapp', delay_horas: 0, cuerpo: 'en paralelo', siguiente: null },
  ] as unknown as PasoParaGrafo[];
  const r = partirConEspera(pasos, 'a', 1, 15, () => 0.42);
  assert.ok(r.ok && r.id, 'una tarjeta MAKO no se parte');
  const a = r.pasos.find((p) => p.id === 'a')!;
  const esp = r.pasos.find((p) => p.id === r.id)!;
  const resto = r.pasos.find((p) => p.id === esp.siguiente)!;
  assert.equal(a.siguiente, r.id);
  assert.equal((a as { paralelos?: unknown }).paralelos, undefined, 'los paralelos arrancaban al terminar TODA la tarjeta');
  assert.deepEqual([claseDe(esp), esp.espera?.minutos], ['esperar', 15]);
  // Las dos mitades son tarjetas MAKO, cada una con SU lista explícita, el espejo, el lead y el título.
  assert.deepEqual(a.accion, { operacion: 'avisar_al_equipo', params: { leadId: 'evento', titulo: 'Ojo', mensaje: 'Nuevo agendado: {{nombre_completo}}', partes: [lista[0]] } });
  assert.equal(esMako(resto), true, 'la segunda mitad dejó de ser una tarjeta MAKO');
  assert.deepEqual(resto.accion?.params, { leadId: 'evento', titulo: 'Ojo', mensaje: 'Su ficha', partes: [audio(31), media(9, 'Su ficha')] },
    'la pausa de segundos de la primera del resto quedó sumada a la espera de minutos');
  assert.equal(resto.siguiente, 'z');
  assert.deepEqual((resto as { paralelos?: string[] }).paralelos, ['p']);
  assert.equal(faltaEscribir(r.pasos), null);
  assert.equal(partirConEspera(pasos, 'a', 0, 15).ok, false, 'antes del primero no hay nada que partir');
  assert.equal(partirConEspera(pasos, 'a', 3, 15).ok, false, 'después del último tampoco');
});

test('14. una tarjeta MAKO nueva nace TAL CUAL: la lista explícita y vacía, sobre el lead del evento', () => {
  const n = nodoNuevo('mako', [], () => 0.5);
  assert.deepEqual(n.accion, { operacion: 'avisar_al_equipo', params: { leadId: 'evento', partes: [] } });
  assert.equal(esTarjetaTalCual(n.accion?.params), true, 'una tarjeta nueva saldría envuelta («🟡 título», «— MaKo»)');
  assert.equal(faltaEscribir([n])?.id, n.id, 'nace sin escribir y Publicar la frena');
  // Lo primero que escribe el editor la deja con su texto, todavía tal cual.
  assert.deepEqual(paramsDeMako(n.accion?.params, { cuerpo: '🎯 {{nombre_completo}} agendó' }), { leadId: 'evento', mensaje: '🎯 {{nombre_completo}} agendó', partes: [texto('🎯 {{nombre_completo}} agendó')] });
});

test('15. paramsConPartes: la forma ÚNICA de los params (lista saneada, espejo, lead y título)', () => {
  assert.deepEqual(paramsConPartes({ leadId: 5, titulo: '  ', respuesta: 'x' }, [texto('  '), audio(31)]), { leadId: 5, mensaje: TEXTO_SOLO_AUDIO, partes: [audio(31)] },
    'una parte vacía se guardó, o se coló lo que el registro no declara');
  assert.deepEqual(paramsConPartes(null, []), { mensaje: '', partes: [] });
});
