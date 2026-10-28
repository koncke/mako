// =============================================================================
// Instagram: RESPONDER EN PÚBLICO el comentario que disparó el flujo (ticket #17 de Leandro, 28/10/2026; el #12 es el mismo)
// =============================================================================
// Leandro (Fiesta Music, ws10), con el disparador «El usuario comenta tu publicación o Reel»: no había forma de contestar EN
// PÚBLICO el comentario; el nodo de Instagram sólo mandaba un DM (la respuesta privada). Zernio lo tiene (OpenAPI v1.394.0:
// POST /v1/inbox/comments/{postId} con `accountId`, `message` y `commentId`). Diseño (AGENTS.md, «un CAMPO del nodo es UNA
// rama»): `en_comentario: true` DENTRO del paso de mensaje; ausente = un DM, lo de siempre.
// Fija:
//   · la decisión pura (lib/canal-social.ts): sale con un comentario guardado, SIN mirar la ventana de 24 h, los 7 días ni si
//     la respuesta privada ya se usó; sin comentario no sale y es terminal;
//   · el dato: sólo en un mensaje de Instagram o Messenger, sobrevive al guardado (`camposDelFlujo`, la quinta puerta) y
//     Publicar frena una respuesta pública con botones o sin texto;
//   · la pantalla: el interruptor se ofrece sólo con un CRON de comentario (`canalesConComentario`);
//   · la IA del lienzo (crear y editar) y la API (`cambiar_botones_mensaje`) lo prenden y lo apagan;
//   · el cableado (leyendo el fuente: son módulos `server-only`): el envío publica por Zernio ANTES de decidir el DM, no gasta
//     la respuesta privada, y el motor lo pasa en la salida y en «Si responde».
// Correr: node --import tsx --test tests/instagram-respuesta-publica.test.ts
// ROTURAS (28/10/2026, una por vez y restaurada; base 10 / 0): la decisión mirando si la privada se usó → 9 / 1; `normalizar`
// sin el campo → 9 / 1; `camposDelFlujo` sin el campo → 9 / 1; Publicar sin `problemasDeRespuestaPublica` → 8 / 2; el
// interruptor siempre a la vista → 9 / 1; el envío marcando la privada como usada → 9 / 1; «Si responde» sin pasarlo → 9 / 1;
// crear con IA ignorándolo → 9 / 1; la regla al modelo en todo pedido de Instagram → 9 / 1; editar sin tocarlo → 9 / 1; la API
// sin `conComentario` → 9 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decidirRespuestaPublica, decidirSalida, respondeEnComentario, problemasDeRespuestaPublica, type ConversacionSocial } from '../lib/canal-social';
import { normalizar, validarGrafo, type PasoGrafo } from '../lib/flujo-grafo';
import { camposDelFlujo } from '../lib/nutricion-grafo-motor';
import { canalesConComentario, opcionesCronIA } from '../lib/disparadores';
import {
  deIA, deIAEdicion, aIA, userDeCrear, userDeEditar, disparadoresParaIA, RESPUESTA_PUBLICA, CREAR_IA_SYSTEM_TEMPLATE, LISTA_BLANCA_IA,
  type CtxIA,
} from '../lib/flujo-ia';
import { catalogosDe, etapasDeCondicion } from '../lib/condiciones-catalogos';
import { botonesParaGuardar } from '../lib/botones-api';
import { porId } from '../lib/api-mako/registro';

const RAIZ = join(__dirname, '..');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n'));

const DIA = 24 * 3600_000;
const AHORA = Date.parse('2026-10-28T12:00:00Z');
/** Comentó hace 10 días, la ventana de 24 h cerrada y la respuesta privada ya usada: un DM no sale. */
const COMENTO: ConversacionSocial = {
  conversacionId: null, cuentaId: 'acc_fiesta', ventanaExpiraAt: null,
  comentarioId: 'c_17', comentarioPostId: 'p_reel', comentarioAt: new Date(AHORA - 10 * DIA).toISOString(),
  comentarioRespondidoAt: new Date(AHORA - 9 * DIA).toISOString(),
};

test('la decisión: con el comentario guardado sale, sin ventana, sin los 7 días y sin gastar la privada', () => {
  assert.deepEqual(decidirRespuestaPublica(COMENTO, 'instagram'), { via: 'publica', comentarioId: 'c_17', postId: 'p_reel', cuentaId: 'acc_fiesta' });
  // El mismo lead, por DM: no sale (por eso la pública no puede pasar por `decidirSalida`).
  assert.equal(decidirSalida(COMENTO, AHORA, 'instagram').via, null);
  // Sin comentario (escribió por DM), sin cuenta o sin conversación: no sale y es terminal, con su porqué.
  const sinComentario = decidirRespuestaPublica({ ...COMENTO, comentarioId: null }, 'instagram');
  assert.equal(sinComentario.via, null);
  assert.match(sinComentario.via === null ? sinComentario.motivo : '', /no comentó una publicación/);
  assert.equal(decidirRespuestaPublica({ ...COMENTO, comentarioPostId: '  ' }).via, null);
  assert.equal(decidirRespuestaPublica({ ...COMENTO, cuentaId: null }).via, null);
  const nada = decidirRespuestaPublica(null, 'messenger');
  assert.ok(nada.via === null && nada.terminal && /Messenger/.test(nada.motivo));
});

const M = (extra: Partial<PasoGrafo> = {}): PasoGrafo => ({ id: 'm1', canal: 'instagram', cuerpo: '¡Te lo mandé por mensaje!', siguiente: 'm2', en_comentario: true, ...extra } as PasoGrafo);
const FLUJO = (m: PasoGrafo): PasoGrafo[] => [
  { id: 'entrada', nodo: 'inicio', canal: 'instagram', cuerpo: '', siguiente: 'm1' } as PasoGrafo,
  m,
  { id: 'm2', canal: 'instagram', cuerpo: 'Acá está el recurso: https://fiesta.example/recurso', siguiente: null } as PasoGrafo,
];

test('el dato: sólo en un mensaje de Instagram o Messenger, y sólo `true`', () => {
  assert.equal(respondeEnComentario(M()), true);
  assert.equal(respondeEnComentario(M({ canal: 'messenger' })), true);
  assert.equal(respondeEnComentario(M({ canal: 'whatsapp' })), false);
  assert.equal(respondeEnComentario({ ...M(), en_comentario: 'si' }), false);
  assert.equal(respondeEnComentario(M({ en_comentario: undefined })), false);
  // `normalizar` lo deja en el DM y lo saca de un WhatsApp (y de una tarjeta que no es un mensaje).
  const [, m] = normalizar(FLUJO(M()));
  assert.equal(m.en_comentario, true);
  const [, w] = normalizar(FLUJO(M({ canal: 'whatsapp' })));
  assert.ok(!('en_comentario' in w), 'un WhatsApp no responde comentarios');
});

test('la QUINTA PUERTA: el guardado lo conserva (sin esto, el interruptor se apagaba solo y salía por DM)', () => {
  assert.equal(camposDelFlujo(M()).en_comentario, true);
  assert.ok(!('en_comentario' in camposDelFlujo(M({ canal: 'whatsapp' }))));
  assert.ok(!('en_comentario' in camposDelFlujo({ ...M(), nodo: 'esperar', espera: { minutos: 5 } })));
});

test('Publicar: una respuesta pública no lleva botones y tiene texto; el flujo de Leandro se publica', () => {
  assert.deepEqual(validarGrafo(FLUJO(M())), []);
  assert.deepEqual(problemasDeRespuestaPublica(M(), 'la tarjeta m1'), []);
  assert.deepEqual(problemasDeRespuestaPublica(M({ botones: [{ id: 'b1', titulo: 'Ver', url: 'https://x.com' }] }), 'la tarjeta m1'),
    ['la tarjeta m1: una respuesta en el comentario no lleva botones']);
  assert.deepEqual(problemasDeRespuestaPublica(M({ cuerpo: '  ' }), 'la tarjeta m1'), ['la tarjeta m1: una respuesta en el comentario es de texto, y no tiene']);
  // Un archivo con su pie de texto sí (sale el texto); una sola parte de archivo sin texto, no.
  assert.deepEqual(problemasDeRespuestaPublica(M({ partes: [{ tipo: 'media', media_id: 3, cuerpo: 'Mirá' }] } as Partial<PasoGrafo>), 'x'), []);
  assert.equal(problemasDeRespuestaPublica(M({ partes: [{ tipo: 'media', media_id: 3 }] } as Partial<PasoGrafo>), 'x').length, 1);
  assert.ok(validarGrafo(FLUJO(M({ botones: [{ id: 'b1', titulo: 'Ver', url: 'https://x.com' }] }))).some((e) => /no lleva botones/.test(e)));
});

test('la pantalla: el interruptor se ofrece sólo con un CRON de comentario, en su canal', () => {
  assert.deepEqual(canalesConComentario([{ trigger_tipo: 'instagram', subtipo: 'comentario' }]), ['instagram']);
  assert.deepEqual(canalesConComentario([{ trigger_tipo: 'instagram', subtipo: 'dm' }, { trigger_tipo: 'instagram', subtipo: 'en_vivo' }]), []);
  assert.deepEqual(canalesConComentario([{ trigger_tipo: 'messenger', subtipo: 'comentario' }, { trigger_tipo: 'etapa', subtipo: 'comentario' }]), ['messenger']);
  const editor = leer('app/automations/EditorMensajeSocial.tsx');
  assert.match(editor, /\(comentario \|\| enComentario\) && \(/, 'el interruptor se ve sólo con un CRON de comentario (o si ya está prendido)');
  assert.match(editor, /onChange\(v \? \{ en_comentario: true, botones: undefined \} : \{ en_comentario: undefined \}\)/);
  assert.match(editor, /partes\.length > 0 && !enComentario && \(/, 'prendido, los botones no se ofrecen');
  assert.match(leer('app/automations/FlujoLienzo.tsx'), /comentario=\{pr\.comentarioEn\?\.includes\(paso\.canal\) \?\? false\}/);
  assert.match(leer('app/automations/SecuenciaPerfil.tsx'), /comentarioEn=\{comentarioEn\}/);
  assert.match(leer('app/automations/SecuenciaPerfil.tsx'), /canalesConComentario\(crons\.lista\)/);
});

test('el envío: publica por Zernio ANTES de decidir el DM, y no gasta la respuesta privada', () => {
  const z = leer('lib/zernio.ts');
  assert.match(z, /export async function responderComentarioEnPublico[\s\S]{0,300}`\/inbox\/comments\/\$\{encodeURIComponent\(input\.postId\)\}`/);
  assert.match(z, /JSON\.stringify\(\{ accountId: input\.accountId, message: input\.texto, commentId: input\.commentId \}\)/);
  const c = leer('lib/canal-zernio.ts');
  const rama = c.indexOf('if (input.enComentario) {');
  assert.ok(rama > 0 && rama < c.indexOf('const salida = decidirSalida('), 'la pública se decide antes que el DM');
  const cuerpo = c.slice(rama, c.indexOf('const salida = decidirSalida('));
  assert.match(cuerpo, /decidirRespuestaPublica\(/);
  assert.match(cuerpo, /responderComentarioEnPublico\(ws, \{ accountId: pub\.cuentaId, postId: pub\.postId, commentId: pub\.comentarioId, texto, idempotencyKey: `\$\{idempotencia\}#publica` \}\)/);
  assert.doesNotMatch(cuerpo, /marcarComentarioRespondido/, 'la pública no gasta la privada');
  assert.match(cuerpo, /esRechazoDelComentario\(e\)[\s\S]{0,120}terminal: true/, '403 y 422 no se reintentan');
  const n = leer('lib/nutricion.ts');
  assert.equal((n.match(/\.\.\.\(respondeEnComentario\((paso|p)\) \? \{ enComentario: true \} : \{\}\)/g) ?? []).length, 2, 'la salida y «Si responde» lo pasan');
});

// ── La IA del lienzo y la API ──
const acciones = LISTA_BLANCA_IA.map((id) => { const d = porId(id)!; return { id: d.id, titulo: d.titulo, parametros: d.parametros }; });
const PRODUCTOS = [{ funnelId: 2, productoId: 10, nombre: 'Fiesta Music', esDefault: true, etapas: [{ value: 'nuevo', label: 'Lead entrante' }], etapasEntrega: [{ value: 'onboarding', label: 'Onboarding' }] }];
const ctx = (pedido: string, disparadorActual?: string): CtxIA => ({
  etiquetas: [], productos: PRODUCTOS,
  disparadores: disparadoresParaIA(opcionesCronIA({ productos: PRODUCTOS, etiquetas: [], conectados: { instagram: true, messenger: true, email: false, pagos: false } })),
  audios: [], archivos: [], acciones,
  links: { recurso: { url: 'https://fiesta.example/recurso', para: 'El recurso gratis' } },
  catalogoCondicion: catalogosDe({ etapas: etapasDeCondicion(PRODUCTOS), productos: PRODUCTOS, remotos: null }),
  pedido, perfil: 'Fiesta Music: clases de DJ.',
  ...(disparadorActual ? { disparadorActual } : {}),
} as CtxIA);
const clave = (c: CtxIA, valor: string) => `d${c.disparadores.findIndex((d) => d.value === valor) + 1}`;
const rnd = () => { let k = 0; return () => ((k++ * 0.137) % 1); };
const PEDIDO = 'Por Instagram: a quien comenta pruebafm respondele en público el comentario y mandale el recurso por privado';
const tarjetas = (extra: Record<string, unknown> = {}) => [
  { id: 't1', tipo: 'mensaje', canal: 'instagram', texto: '¡Te lo mandé por mensaje!', en_comentario: true, sigue: 't2', ...extra },
  { id: 't2', tipo: 'mensaje', canal: 'instagram', texto: '¡Acá está!', link: 'recurso' },
];

test('crear con IA: con un CRON de comentario arma la respuesta pública antes del DM, y se publica', () => {
  const c = ctx(PEDIDO);
  const r = deIA({ disparador: clave(c, 'instagram:comentario'), inicio: 't1', tarjetas: tarjetas() }, c, rnd());
  const msjs = r.pasos.filter((p) => p.canal === 'instagram' && !p.nodo);
  assert.equal(msjs[0].en_comentario, true);
  assert.ok(!('en_comentario' in msjs[1]), 'el DM del recurso sigue siendo un DM');
  assert.deepEqual(validarGrafo(r.pasos), []);
  // Con otro CRON de Instagram (un DM), no hay comentario que responder: va por privado y se dice.
  const dm = deIA({ disparador: clave(c, 'instagram:dm'), inicio: 't1', tarjetas: tarjetas() }, c, rnd());
  assert.ok(dm.pasos.every((p) => !p.en_comentario));
  assert.ok(dm.avisos.some((a) => /CRON de comentario/.test(a)), dm.avisos.join(' | '));
  // Con botones: se sacan, con su porqué (un comentario no los lleva).
  const bs = deIA({ disparador: clave(c, 'instagram:comentario'), inicio: 't1', tarjetas: tarjetas({ botones: [{ titulo: 'Ver', link: 'recurso' }] }) }, c, rnd());
  assert.ok(bs.pasos.every((p) => !p.botones?.length));
  assert.ok(bs.avisos.some((a) => /no lleva botones/.test(a)), bs.avisos.join(' | '));
});

test('lo que se le dice al modelo va SÓLO si el pedido habla de responder en público (el techo de Groq)', () => {
  assert.ok(!CREAR_IA_SYSTEM_TEMPLATE.includes('RESPUESTA PÚBLICA'));
  assert.ok(userDeCrear(ctx(PEDIDO), { perfil: 'Fiesta Music', voz: null, pedido: PEDIDO }).includes(RESPUESTA_PUBLICA));
  const otro = 'Por Instagram: a quien comenta pruebafm mandale el recurso';
  assert.ok(!userDeCrear(ctx(otro), { perfil: 'Fiesta Music', voz: null, pedido: otro }).includes(RESPUESTA_PUBLICA));
});

test('editar con IA: el modelo la ve, la prende y la apaga', () => {
  const c = ctx(PEDIDO);
  const base = deIA({ disparador: clave(c, 'instagram:comentario'), inicio: 't1', tarjetas: tarjetas({ en_comentario: false }) }, c, rnd()).pasos;
  const m1 = base.find((p) => p.canal === 'instagram' && !p.nodo)!;
  assert.ok(!m1.en_comentario);
  const pedido = 'respondé en público el comentario con el primer mensaje';
  const on = deIAEdicion({ cambiar: [{ id: m1.id, en_comentario: true }] }, base, ctx(pedido, 'instagram:comentario'), rnd());
  const m1on = on.pasos.find((p) => p.id === m1.id)!;
  assert.equal(m1on.en_comentario, true, on.avisos.join(' | '));
  assert.equal((aIA(on.pasos).tarjetas.find((t) => t.id === m1.id) as { en_comentario?: boolean }).en_comentario, true);
  assert.ok(userDeEditar(ctx('cambiá el texto', 'instagram:comentario'), { perfil: 'Fiesta Music', voz: null, pedido: 'cambiá el texto' }, on.pasos).includes(RESPUESTA_PUBLICA),
    'un flujo que ya la tiene se la dice al modelo');
  const off = deIAEdicion({ cambiar: [{ id: m1.id, en_comentario: false }] }, on.pasos, ctx('mandalo por privado', 'instagram:comentario'), rnd());
  assert.ok(!off.pasos.find((p) => p.id === m1.id)!.en_comentario);
  // Un cambio que no la nombra la deja como estaba.
  const texto = deIAEdicion({ cambiar: [{ id: m1.id, texto: '¡Revisá tus mensajes!' }] }, on.pasos, ctx('cambiá el texto', 'instagram:comentario'), rnd());
  assert.equal(texto.pasos.find((p) => p.id === m1.id)!.en_comentario, true);
});

test('la API: cambiar_botones_mensaje la prende y la apaga, y frena botones con ella', () => {
  const def = porId('cambiar_botones_mensaje')!;
  assert.ok(def.parametros.some((p) => p.nombre === 'en_comentario' && p.tipo === 'boolean'));
  const pasos = FLUJO(M({ en_comentario: undefined }));
  const on = botonesParaGuardar(pasos, 'm1', null, 'Pruebafm', undefined, true);
  assert.ok(on.ok, on.ok ? '' : on.error);
  assert.equal(on.ok && on.pasos[1].en_comentario, true);
  assert.match(on.ok ? on.resumen : '', /responde en público, debajo del comentario/);
  const off = botonesParaGuardar(on.ok ? on.pasos : [], 'm1', null, 'Pruebafm', undefined, false);
  assert.ok(off.ok && !('en_comentario' in off.pasos[1]));
  const conBotones = botonesParaGuardar(pasos, 'm1', [{ titulo: 'Ver', link: 'https://x.com' }], 'Pruebafm', undefined, true);
  assert.ok(!conBotones.ok && /no lleva botones/.test(conBotones.error));
  // La ficha de la API la dice.
  assert.match(leer('lib/api-mako/areas/chatbot.run.ts'), /\.\.\.\(respondeEnComentario\(p\) \? \{ en_comentario: true \} : \{\}\)/);
});
