// =============================================================================
// EL CHAT DE MaKo EN EL LIENZO: una PREGUNTA se contesta, no se edita (15/10/2026)
// =============================================================================
// Medido en producción, en «Un Lead Entró» (#198): «¿Qué hace esta automatización? No cambies nada, sólo explícamelo.»
// estuvo ~100 s en «Escribiendo el flujo» y terminó en «Cambié 1». El modelo de EDITAR reescribió el texto que acompaña
// al audio de bienvenida («Te dejo aquí el video: https://confirmar.lovable.app» → «Hola estimado {{nombre}}! espero que
// estés muy bien! …») y el link del video se fue del borrador. La ruta mandaba todo al prompt de editar.
//
// Lo que fija este archivo:
//   · `esConsulta` (lib/flujo-ia-consulta.ts): la frase de ese día es una consulta; un pedido de cambio, aunque venga con
//     signos o con una negación al lado («no cambies el audio, saca el email»), no;
//   · `deIAEdicion`: si el modelo trae "respuesta", no se aplica NADA de lo que traiga junto, ni el cambio de canal que se
//     lee del pedido;
//   · la ruta: la consulta va ANTES de editar y devuelve el borrador tal cual; y el prompt de contestar está registrado.
//
// ⚠️ PROBADO ROMPIENDO (15/10/2026, en el worktree, una rotura por vez y restaurada al terminar, sha1 igual: scratchpad
// romper-consulta.mjs; base 8 pass / 0 fail). El resultado MEDIDO de cada rotura, al lado de su test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { esConsulta, pideCambio, respuestaDelModelo, deIARespuesta, userDeExplicar, TOPE_RESPUESTA, EXPLICAR_IA_SYSTEM_TEMPLATE } from '../lib/flujo-ia-consulta';
import { deIAEdicion, erroresEdicion, cambioDeCanal, disparadoresParaIA, EDITAR_IA_SYSTEM_TEMPLATE, LISTA_BLANCA_IA, type CtxIA, type PasoIA } from '../lib/flujo-ia';
import { ID_INICIO, type PasoGrafo } from '../lib/flujo-grafo';
import { opcionesCronIA } from '../lib/disparadores';
import { catalogosDe, etapasDeCondicion } from '../lib/condiciones-catalogos';
import { porId } from '../lib/api-mako/registro';

const leer = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const LA_DEL_15 = '¿Qué hace esta automatización? No cambies nada, sólo explícamelo.';

// rotura 1 (`esConsulta` devuelve siempre false): 6 pass / 2 fail, caen éste y el de la negación.
test('esConsulta: las preguntas y los «explícame» son consultas', () => {
  for (const t of [
    LA_DEL_15,
    '¿Qué manda primero?',
    '¿Por qué no sale el audio?',
    '¿Cuándo pasa al AI Step?',
    'Explícame el flujo',
    'Dime qué mensajes manda',
    '¿Qué le cambiarías?',
    'No toques nada, sólo dime cuántos mensajes manda',
    '¿Me puedes explicar qué hace la condición?',
    '¿Manda el audio antes que el video?',
  ]) assert.equal(esConsulta(t), true, t);
});

// rotura 2 (`pideCambio` devuelve siempre false): 6 pass / 2 fail, caen éste y el de la negación.
test('esConsulta: un pedido de cambio no es consulta, aunque venga con signos', () => {
  for (const t of [
    'Cambia el audio por un texto',
    '¿Puedes agregar un email después del audio?',
    '¿Le agregas un email al final?',
    'Agrégale un recordatorio un día antes',
    'Haz que el audio salga primero, ¿se puede?',
    'Mejora los textos, no cambies nada más',
    '¿Qué hace? Saca el email del final',
    'hola',
    '',
  ]) assert.equal(esConsulta(t), false, t);
});

// rotura 3 (sin borrar las negaciones en `pideCambio`): 7 pass / 1 fail, cae éste (por «¿Puedes no cambiar nada…?»: la
// frase del 15/10 sigue siendo consulta igual, porque «No cambies» no es un imperativo de la lista).
test('una negación no es un pedido, pero lo que viene al lado sí', () => {
  assert.equal(pideCambio('No cambies el audio, pero saca el email'), true);
  assert.equal(pideCambio('no le cambies nada'), false);
  assert.equal(pideCambio('sin tocar nada'), false);
  assert.equal(esConsulta('No cambies el audio, ¿qué hace la condición?'), true);
  // Sin borrar la negación, «puedes no cambiar» se lee como «¿puedes cambiar…?».
  assert.equal(esConsulta('¿Puedes no cambiar nada y sólo explicarme qué hace?'), true);
});

const acciones = LISTA_BLANCA_IA.map((id) => {
  const d = porId(id);
  if (!d) throw new Error(`la lista blanca nombra «${id}», que no está en el registro`);
  return { id: d.id, titulo: d.titulo, parametros: d.parametros };
});
const PRODUCTOS = [{ funnelId: 3, productoId: 10, nombre: 'VSL Funnel', esDefault: true, etapas: [{ value: 'lead', label: 'Lead entrante' }], etapasEntrega: [] }];
const ctxDe = (pedido: string): CtxIA => ({
  etiquetas: [], productos: PRODUCTOS,
  disparadores: disparadoresParaIA(opcionesCronIA({ productos: PRODUCTOS, etiquetas: [], conectados: { instagram: true, messenger: false, email: false, pagos: false } })),
  audios: [], archivos: [], acciones, links: {},
  catalogoCondicion: catalogosDe({ etapas: etapasDeCondicion(PRODUCTOS), productos: PRODUCTOS, remotos: null }),
  pedido,
});
const VIDEO = 'Te dejo aquí el video: https://confirmar.lovable.app';
/** Como #198: entrada → el mensaje del video. */
const base198 = (): PasoGrafo[] => [
  { id: 'o0', canal: 'whatsapp', proveedor: 'no_oficial', delay_horas: 0, asunto: null, cuerpo: VIDEO, siguiente: null },
  { id: ID_INICIO, nodo: 'inicio', siguiente: 'o0' },
];

// rotura 4 (sin la salida temprana de `deIAEdicion`): 6 pass / 2 fail, caen éste y el del cambio de canal.
test('deIAEdicion: con "respuesta" no se aplica nada de lo que vino junto (el bug de #198)', () => {
  const ctx = ctxDe(LA_DEL_15);
  const r = deIAEdicion({ respuesta: 'Le manda un audio de bienvenida y el link del video.', cambiar: [{ id: 'o0', texto: 'Hola estimado {{nombre}}! espero que estés muy bien!' }] }, base198(), ctx);
  assert.equal((r.pasos.find((p) => p.id === 'o0') as PasoIA).cuerpo, VIDEO, 'el texto del video sigue igual');
  assert.deepEqual([r.cambiadas, r.quitadas, r.agregadas], [[], [], []]);
  assert.equal(r.respuesta, 'Le manda un audio de bienvenida y el link del video.');
  assert.equal(r.resumen, r.respuesta, 'lo que dice MaKo es la respuesta, no «Cambié 1»');
  // Para editar, «no cambió nada» es un error que pide otro intento: por eso la ruta no revisa una respuesta.
  assert.deepEqual(erroresEdicion(base198(), r, ctx), ['no cambió nada']);
});

test('deIAEdicion: una respuesta tampoco hace el cambio de canal que se lee del pedido', () => {
  const pedido = '¿Por qué no cambias WhatsApp por Instagram?';
  assert.equal(cambioDeCanal(pedido), 'instagram', 'el pedido nombra el cambio');
  const r = deIAEdicion({ respuesta: 'Porque el CRON es de una etapa del CRM.' }, base198(), ctxDe(pedido));
  assert.equal((r.pasos.find((p) => p.id === 'o0') as PasoIA).canal, 'whatsapp');
  assert.deepEqual(r.cambiadas, []);
});

// rotura 5 (`respuestaDelModelo` sin tope): 7 pass / 1 fail, cae éste.
test('la respuesta: texto con tope, y sin ella la cascada prueba otro proveedor', () => {
  assert.equal(respuestaDelModelo({ respuesta: '  Le manda   un audio.  ' }), 'Le manda un audio.');
  assert.ok(respuestaDelModelo({ respuesta: 'Una frase larga. '.repeat(200) }).length <= TOPE_RESPUESTA);
  assert.equal(respuestaDelModelo({ cambiar: [] }), '');
  assert.deepEqual(deIARespuesta({}).errores.length, 1);
  assert.deepEqual(deIARespuesta({ respuesta: 'Sí.' }).errores, []);
  const u = userDeExplicar({ cron: 'Llega a «Lead entrante»', flujo: '{"tarjetas":[]}', pregunta: LA_DEL_15 });
  assert.match(u, /<material>\{"tarjetas":\[\]\}<\/material>/, 'el flujo va como material, no como instrucciones');
  assert.match(u, /Llega a «Lead entrante»/);
});

// rotura 6 (la ruta sin la rama de la consulta): 7 pass / 1 fail, cae éste.
test('la ruta: la consulta va ANTES de editar y devuelve el borrador tal cual', () => {
  const ruta = leer('app/api/chat-agent/secuencias/ia/route.ts');
  const consulta = ruta.indexOf('if (!respuestas.length && esConsulta(pedido))');
  const editar = ruta.indexOf("getPromptText('chatbot.editar-ia.system'");
  assert.ok(consulta > 0 && editar > consulta, 'la consulta se decide antes del prompt de editar');
  assert.match(ruta.slice(consulta, editar), /getPromptText\('chatbot\.explicar-ia\.system', EXPLICAR_IA_SYSTEM_TEMPLATE\)/);
  assert.match(ruta, /const contestar = async[\s\S]{0,400}pasos: base,[\s\S]{0,200}cambiadas: \[\], quitadas: \[\]/, 'contestar devuelve el borrador sin cambios');
  assert.match(ruta, /if \(r\.respuesta\) \{ await contestar\(r\.respuesta\); return; \}/, 'la capa 2: editar contestó');
  assert.match(ruta, /errores: r\.respuesta \? \[\] : erroresEdicion\(base, r, ctx\)/, 'una respuesta no se reintenta por «no cambió nada»');
});

test('los prompts: el de contestar está registrado y el de editar ofrece "respuesta"', () => {
  const reg = leer('lib/prompt-registry.ts');
  assert.match(reg, /key: 'chatbot\.explicar-ia\.system'[\s\S]{0,300}default: EXPLICAR_IA_SYSTEM_TEMPLATE/);
  assert.match(EXPLICAR_IA_SYSTEM_TEMPLATE, /\{"respuesta": "…"\}/);
  assert.match(EXPLICAR_IA_SYSTEM_TEMPLATE, /No cambias nada/);
  assert.match(EDITAR_IA_SYSTEM_TEMPLATE, /"respuesta": si el pedido es una PREGUNTA/);
});
