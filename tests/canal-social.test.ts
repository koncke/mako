// =============================================================================
// Instagram y Messenger como canales de las automatizaciones (por Zernio)
// =============================================================================
// Sexta tanda (09/10/2026), CRON 4-7: Instagram vuelve —salió el 06/10 con su tab— como CANAL de
// /chatbot, con Messenger. Lo que este archivo fija, y por qué cada cosa:
//
//   · el canal de un paso SE CONSERVA al guardar: hasta hoy todo lo que no era email se guardaba
//     como WhatsApp, y un paso de Instagram le habría salido al lead POR WHATSAPP, sin un error;
//   · la ventana de Meta (`decidirSalida`): un DM dentro de las 24 h del último mensaje de la persona,
//     o la respuesta privada a un comentario dentro de los 7 días; si no, NO sale y es terminal;
//   · el webhook leído con las formas de la doc de Zernio (docs.zernio.com/webhooks/inbox, 09/10):
//     cada disparador que la tabla dice disponible lo produce `eventoSocialDe` con un cuerpo de verdad;
//   · la firma, ejecutada; y el orden del webhook y las guardas del motor, sobre el FUENTE (los dos
//     viven en módulos `server-only`, que un test no puede importar).
//
// PROBADO ROMPIÉNDOLO (09/10/2026), con un arnés que restaura DE MEMORIA, una rotura por vez. Base en
// verde: este archivo 15 pass / 0 fail (y con flujo-conversacion y webhooks-ruteo-estricto, 43 / 0).
// Cada rotura dio 14 / 1 y cayó EXACTAMENTE el test que la cuida:
//   · `canalAGuardar` devolviendo 'whatsapp' para Instagram           → «el canal se conserva».
//   · la rama del WhatsApp no oficial ANTES que la social             → «la rama social va primero».
//   · `decidirSalida` sin mirar `ventana > ahora`                     → «la ventana de 24 h».
//   · `decidirSalida` sin mirar `comentarioRespondidoAt`              → «una sola respuesta privada».
//   · `eventoSocialDe` sin `metadata.storyReply`                      → «cada disparador disponible…».
//   · el prefijo del QR cambiado a 'qr_'                              → «el QR es un ref con su prefijo».
//   · `verificarFirmaZernio` aceptando sin secreto                    → «la firma».
//   · sin el corte del dedup / sin soltar el reclamo                  → «el webhook, en orden» (las dos).
//   · el freno de 20 h sin excluir lo social                          → «sin el freno de 20 h».
//   · la guarda de «Si responde» sin `esCanalSocial`                  → ««Si responde» no manda lo social por WhatsApp».
//   · `canalesParaProbar` contando Instagram como WhatsApp            → «el ＋ crea la tarjeta…».
//   · Instagram adentro de «Si responde» en `opcionesDelMas`          → el test del menú de tests/flujo-conversacion.test.ts (14 / 1 en ese archivo).
//   · `wsPorIdentificador` (la tolerante) para la cuenta              → 25 / 3 con tests/webhooks-ruteo-estricto.test.ts: éste y los dos barridos de allá.
// Restaurado: 15 / 0.
//
// Correr: node --import tsx --test tests/canal-social.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  canalAGuardar, decidirSalida, eventoSocialDe, DISPARADORES_SOCIALES, PREFIJO_REF_QR, VENTANA_META_MS, VENTANA_COMENTARIO_MS,
  problemaDeAdjunto, nombreDeParticipante, linkDeReferencia, esCanalSocial, type ConversacionSocial, type EventoSocial,
} from '../lib/canal-social';
import { verificarFirmaZernio, firmarZernio } from '../lib/zernio-firma';
import { nodoNuevo, tituloDeTarjeta, canalesParaProbar, grafoDeSecuencia, type PasoParaGrafo } from '../lib/flujo-conversacion';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas ANTES que los bloques (AGENTS.md).
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── El canal al guardar ──────────────────────────────────────────────────────

test('el canal se conserva al guardar: Instagram y Messenger no se vuelven WhatsApp', () => {
  assert.equal(canalAGuardar('instagram', 'texto'), 'instagram');
  assert.equal(canalAGuardar('messenger', 'media'), 'messenger');
  // Lo de antes, igual: un email que no es audio es email; todo lo demás, WhatsApp.
  assert.equal(canalAGuardar('email', 'texto'), 'email');
  assert.equal(canalAGuardar('email', 'audio'), 'whatsapp');
  assert.equal(canalAGuardar('telegram', 'texto'), 'whatsapp');
  assert.equal(canalAGuardar(undefined, undefined), 'whatsapp');
  // Y el motor lo usa: sin esto `setSecuenciaPasos` lo reconstruía como WhatsApp.
  const nut = sinComentarios(leer('../lib/nutricion.ts'));
  assert.match(nut, /canal: canalAGuardar\(p\.canal, p\.tipo\),/);
  assert.doesNotMatch(nut, /canal: \(p\.canal === 'email' && p\.tipo !== 'audio' \? 'email' : 'whatsapp'\)/);
});

// ── La ventana de Meta ───────────────────────────────────────────────────────

const AHORA = Date.parse('2026-10-09T18:00:00Z');
const conv = (extra: Partial<ConversacionSocial> = {}): ConversacionSocial => ({
  conversacionId: 'c1', cuentaId: 'acc1', ventanaExpiraAt: null,
  comentarioId: null, comentarioPostId: null, comentarioAt: null, comentarioRespondidoAt: null, ...extra,
});
const enHoras = (h: number) => new Date(AHORA + h * 3600_000).toISOString();

test('la ventana de 24 h: dentro sale un DM, fuera no sale y es terminal', () => {
  assert.deepEqual(decidirSalida(conv({ ventanaExpiraAt: enHoras(3) }), AHORA), { via: 'dm', conversacionId: 'c1', cuentaId: 'acc1' });
  const fuera = decidirSalida(conv({ ventanaExpiraAt: enHoras(-1) }), AHORA);
  assert.equal(fuera.via, null);
  assert.ok(fuera.via === null && fuera.terminal, 'reintentar no abre la ventana: sólo la abre la persona, escribiendo');
  assert.equal(VENTANA_META_MS, 24 * 3600_000);
});

test('una sola respuesta privada, dentro de los 7 días del comentario', () => {
  const comentario = { comentarioId: 'k1', comentarioPostId: 'p1', comentarioAt: enHoras(-30), conversacionId: null };
  assert.deepEqual(decidirSalida(conv(comentario), AHORA), { via: 'respuesta_privada', comentarioId: 'k1', postId: 'p1', cuentaId: 'acc1' });
  // Ya se usó: no hay otra.
  assert.equal(decidirSalida(conv({ ...comentario, comentarioRespondidoAt: enHoras(-29) }), AHORA).via, null);
  // Pasaron los 7 días.
  assert.equal(decidirSalida(conv({ ...comentario, comentarioAt: new Date(AHORA - VENTANA_COMENTARIO_MS - 1).toISOString() }), AHORA).via, null);
  // Con la ventana abierta gana el DM (la conversación ya existe).
  assert.equal(decidirSalida(conv({ ...comentario, conversacionId: 'c1', ventanaExpiraAt: enHoras(2) }), AHORA).via, 'dm');
});

test('sin conversación o sin cuenta no sale, y lo dice', () => {
  const sin = decidirSalida(null, AHORA, 'messenger');
  assert.ok(sin.via === null && sin.terminal && /Messenger/.test(sin.motivo));
  const sinCuenta = decidirSalida(conv({ cuentaId: null, ventanaExpiraAt: enHoras(2) }), AHORA);
  assert.ok(sinCuenta.via === null && sinCuenta.terminal);
});

// ── Lo que se puede mandar ───────────────────────────────────────────────────

test('Instagram acepta foto, video o PDF; las notas de voz de la biblioteca no', () => {
  assert.equal(problemaDeAdjunto('instagram', 'image/jpeg'), null);
  assert.equal(problemaDeAdjunto('instagram', 'video/mp4'), null);
  assert.equal(problemaDeAdjunto('instagram', 'application/pdf'), null);
  assert.ok(problemaDeAdjunto('instagram', 'audio/ogg; codecs=opus'));
  assert.ok(problemaDeAdjunto('instagram', 'audio/mpeg'));
  assert.equal(problemaDeAdjunto('messenger', 'audio/mpeg'), null);
});

// ── El webhook, con las formas de la doc de Zernio ───────────────────────────

const cuenta = (platform: string) => ({ id: 'acc1', accountId: 'acc1', profileId: 'prof1', platform, username: 'negocio' });
const mensaje = (platform: string, extra: Record<string, unknown> = {}, metadata: Record<string, unknown> | null = null) => ({
  id: 'ev-1', event: 'message.received', timestamp: '2026-10-09T17:00:00Z',
  message: {
    id: 'm1', conversationId: 'c1', platform, platformMessageId: 'mid.1', direction: 'incoming', text: 'hola',
    attachments: [], sender: { id: 'igsid-1', name: 'Luis Pérez', username: 'luisp' }, sentAt: '2026-10-09T16:59:58.123Z', isRead: false, ...extra,
  },
  conversation: { id: 'c1', platformConversationId: 'igsid-1', participantId: 'igsid-1', participantName: 'Luis Pérez', status: 'active' },
  account: cuenta(platform),
  metadata,
});
const comentario = (platform: string, extra: Record<string, unknown> = {}) => ({
  id: 'ev-2', event: 'comment.received', timestamp: '2026-10-09T17:00:00Z',
  comment: {
    id: 'k1', postId: null, platformPostId: 'p1', platform, text: 'precio', createdAt: '2026-10-09T16:58:00Z',
    author: { id: 'au-1', username: 'ana', name: 'Ana' }, isReply: false, parentCommentId: null, ...extra,
  },
  post: { id: null, platformPostId: 'p1', content: null, imageUrl: null, permalink: null },
  account: { id: 'acc1', accountId: 'acc1', platform, username: 'negocio' },
});
const referral = (platform: string, ref: Record<string, unknown>) => ({
  id: 'ev-3', event: 'referral.received', timestamp: '2026-10-09T17:00:00Z', referral: ref,
  sender: { id: 'psid-1' }, conversation: { id: 'c2', platformConversationId: 'psid-1', participantId: 'psid-1', status: 'active' },
  account: cuenta(platform),
});
const evento = (body: unknown): EventoSocial => {
  const r = eventoSocialDe(body);
  assert.ok('evento' in r, `se ignoró: ${'ignorar' in r ? r.ignorar : ''}`);
  return r.evento;
};

test('cada disparador disponible lo produce un cuerpo de verdad del webhook', () => {
  const casos: Array<[string, string, unknown]> = [
    ['instagram', 'mensaje', mensaje('instagram')],
    ['instagram', 'historia', mensaje('instagram', {}, { storyReply: { storyId: 's1', storyUrl: 'https://cdn/x' } })],
    ['instagram', 'anuncio', mensaje('instagram', {}, { referral: { ad_id: '123', ads_context_data: { ad_title: 'x' } } })],
    ['instagram', 'referencia', mensaje('instagram', {}, { referral: { ref: 'promo-octubre', source: 'IGME-SOURCE-LINK', type: 'OPEN_THREAD' } })],
    ['instagram', 'comentario', comentario('instagram')],
    ['instagram', 'comentario_vivo', comentario('instagram', { isLive: true })],
    ['messenger', 'mensaje', mensaje('facebook')],
    ['messenger', 'anuncio', referral('facebook', { ad_id: '555', source: 'ADS' })],
    ['messenger', 'referencia', referral('facebook', { ref: 'feria', source: 'SHORTLINK' })],
    ['messenger', 'qr', referral('facebook', { ref: `${PREFIJO_REF_QR}stand-7`, source: 'SHORTLINK' })],
    ['messenger', 'comentario', comentario('facebook')],
  ];
  const vistos = new Set<string>();
  for (const [canal, subtipo, body] of casos) {
    const e = evento(body);
    assert.equal(e.canal, canal, `${canal}/${subtipo}: canal`);
    assert.equal(e.subtipo, subtipo, `${canal}/${subtipo}: subtipo`);
    vistos.add(`${canal}/${subtipo}`);
  }
  // La tabla de los disparadores y el lector dicen lo mismo: todo lo disponible se produce.
  const disponibles = DISPARADORES_SOCIALES.filter((d) => d.disponible).map((d) => `${d.canal}/${d.subtipo}`);
  assert.deepEqual(disponibles.filter((d) => !vistos.has(d)), [], 'un disparador «disponible» que ningún evento produce');
});

test('la tabla de ManyChat: seis por canal, y sólo la tienda de Facebook va apagada, con su motivo', () => {
  assert.equal(DISPARADORES_SOCIALES.filter((d) => d.canal === 'instagram').length, 6);
  assert.equal(DISPARADORES_SOCIALES.filter((d) => d.canal === 'messenger').length, 6);
  const apagados = DISPARADORES_SOCIALES.filter((d) => !d.disponible);
  assert.deepEqual(apagados.map((d) => `${d.canal}/${d.subtipo}`), ['messenger/tienda']);
  assert.ok(apagados.every((d) => (d.motivo ?? '').trim().length > 0), 'un disparador apagado sin motivo');
});

test('el QR es un ref con su prefijo, y el link de referencia lo arma el código', () => {
  assert.equal(PREFIJO_REF_QR, 'qr-');
  assert.equal(linkDeReferencia('messenger', 'MiPagina', 'qr-stand 7'), 'https://m.me/MiPagina?ref=qr-stand%207');
  assert.equal(linkDeReferencia('instagram', '@negocio', 'promo'), 'https://ig.me/m/negocio?ref=promo');
});

test('lo que NO dispara: lo nuestro, la cuenta comentando, un evento ajeno; y lo que se guarda sin disparar', () => {
  assert.ok('ignorar' in eventoSocialDe(mensaje('instagram', { direction: 'outgoing' })));
  assert.ok('ignorar' in eventoSocialDe(mensaje('whatsapp')), 'WhatsApp no es de este canal: va por Evolution');
  assert.ok('ignorar' in eventoSocialDe(comentario('instagram', { author: { id: 'yo', isOwnAccount: true } })));
  assert.ok('ignorar' in eventoSocialDe({ id: 'x', event: 'post.published' }));
  assert.ok('ignorar' in eventoSocialDe('basura'));
  // Una mención en una historia llega, y no la escucha ningún disparador (no es «te envía un mensaje»).
  const mencion = evento(mensaje('instagram', { attachments: [{ type: 'share', originalType: 'story_mention', url: 'https://cdn/y' }] }));
  assert.equal(mencion.subtipo, 'mencion_historia');
  // Otra app de la página atiende la charla: se marca y el webhook no dispara.
  assert.equal(evento(mensaje('instagram', {}, { standby: true })).standby, true);
  // El lead nace con el nombre de la persona, o su usuario.
  assert.equal(nombreDeParticipante({ nombre: null, usuario: 'ana', canal: 'instagram' }), '@ana');
});

// ── La firma ─────────────────────────────────────────────────────────────────

test('la firma: HMAC-SHA256 del cuerpo crudo con el secreto, y sin secreto no pasa nada', () => {
  const raw = JSON.stringify(mensaje('instagram'));
  const firma = firmarZernio(raw, 'secreto');
  assert.equal(verificarFirmaZernio(raw, firma, 'secreto'), true);
  assert.equal(verificarFirmaZernio(raw, firma.toUpperCase(), 'secreto'), true, 'el hex en mayúsculas es la misma firma');
  assert.equal(verificarFirmaZernio(`${raw} `, firma, 'secreto'), false, 'un byte de más en el cuerpo');
  assert.equal(verificarFirmaZernio(raw, firma, 'otro'), false);
  assert.equal(verificarFirmaZernio(raw, firma, null), false, 'fail-closed: sin secreto, nada pasa');
  assert.equal(verificarFirmaZernio(raw, null, 'secreto'), false);
});

// ── El webhook, en orden (sobre el fuente: importa módulos `server-only`) ───

test('el webhook, en orden: firma, ruteo ESTRICTO, reclamo del evento, y suelta el reclamo si falla', () => {
  const src = sinComentarios(leer('../app/api/webhooks/zernio/route.ts'));
  const i = (s: string) => { const k = src.indexOf(s); assert.ok(k >= 0, `no está «${s}»`); return k; };
  assert.ok(i('verificarFirmaZernio(raw') < i('JSON.parse(raw)'), 'la firma va sobre el cuerpo crudo, antes de parsear');
  assert.match(src, /wsPorIdentificadorEstricto\(RUTEO_PERFIL, perfil\)/);
  assert.match(src, /wsPorIdentificadorEstricto\(RUTEO_CUENTA, cuenta\)/, 'un comentario trae sólo la cuenta');
  assert.doesNotMatch(src, /\bwsPorIdentificador\(/, 'con la lectura tolerante, la base caída se contesta como «no es de nadie»');
  assert.match(src, /return responderFalloDeRuteo\('zernio', err,/);
  assert.ok(i(".upsert({ evento_id: eventoId, evento }, { onConflict: 'evento_id', ignoreDuplicates: true })") < i('procesarEventoSocial('),
    'el reclamo va ANTES de procesar: si no, una reentrega dispara dos veces');
  assert.ok(i('if (!(reclamo ?? []).length) return Response.json({ ok: true, event: evento, dedup: true });') < i('procesarEventoSocial('),
    'un evento ya reclamado no se vuelve a procesar');
  const atrapa = src.slice(src.lastIndexOf('} catch (e) {'));
  assert.ok(atrapa.indexOf('await soltar();') >= 0 && atrapa.indexOf('await soltar();') < atrapa.indexOf('status: 500'), 'sin soltar el reclamo, el reintento muere en el dedup');
  // Lo lento (el primer mensaje de la automatización) va después de contestar: Zernio corta a los 5 s.
  assert.match(src, /after\(async \(\) => \{[\s\S]*?dispararEventoSocial\(/);
});

// ── El motor ─────────────────────────────────────────────────────────────────

test('la rama social del motor va primero, y sale por Zernio', () => {
  const nut = sinComentarios(leer('../lib/nutricion.ts'));
  const iSocial = nut.indexOf('} else if (esCanalSocial(paso.canal)) {');
  const iWa = nut.indexOf("} else if (waOn && paso.canal === 'whatsapp' && paso.proveedor === 'no_oficial') {");
  assert.ok(iSocial > 0 && iWa > iSocial, 'la rama social tiene que decidir antes que la del WhatsApp');
  const rama = nut.slice(iSocial, iWa);
  assert.ok(rama.length < 3000, `el recorte de la rama social mide ${rama.length}`);
  assert.match(rama, /await enviarPasoSocial\(\{/);
  assert.match(rama, /terminal = r\.terminal === true;/, 'lo que Meta no deja tiene que cerrar el hilo, no reintentar para siempre');
  // El destino de la fila es la persona en esa app, no el email del lead.
  assert.match(nut, /destino: esCanalSocial\(paso\.canal\) \? destinoSocial : paso\.canal === 'whatsapp'/);
});

test('sin el freno de 20 h para lo social: la ventana de Meta es de 24 h', () => {
  const nut = sinComentarios(leer('../lib/nutricion.ts'));
  assert.match(nut, /if \(!canalApagado && !esCanalSocial\(paso\.canal\) && frenadoPorAntiBan\(/);
  // Y un paso social no cuenta como un email apagado.
  assert.match(nut, /p\.canal === 'whatsapp' \? waOn : esCanalSocial\(p\.canal\) \? true : emailOn/);
});

test('«Si responde» no manda lo social por WhatsApp', () => {
  // Un paso de Instagram «es» no oficial (no tiene plantilla): sin esta guarda salía por la línea.
  const nut = sinComentarios(leer('../lib/nutricion.ts'));
  assert.match(nut, /if \(p\.canal === 'email' \|\| esCanalSocial\(p\.canal\) \|\| proveedorDelPaso\(p\) !== 'no_oficial'\) return no\(/);
});

// ── El lienzo ────────────────────────────────────────────────────────────────

test('el ＋ crea la tarjeta con su canal, su título y su logo, y «Probar» la ofrece', () => {
  for (const canal of ['instagram', 'messenger'] as const) {
    const p = nodoNuevo(canal, [], () => 0.42);
    assert.equal(p.canal, canal);
    assert.ok(esCanalSocial(p.canal));
    assert.equal(tituloDeTarjeta(p), canal.toUpperCase());
    const g = grafoDeSecuencia([{ ...p, cuerpo: 'hola', siguiente: null } as PasoParaGrafo], { disparador: 'x' });
    const t = g.nodos.find((n) => n.id === p.id)!;
    assert.equal(t.icono, canal, 'el logo de la app (la clave del catálogo de marcas)');
    assert.equal(t.canal, undefined, 'sin el tinte de WhatsApp: CanalTarjeta todavía no conoce lo social');
  }
  const ig: PasoParaGrafo = { id: 'a', canal: 'instagram', delay_horas: 0, cuerpo: 'hola', siguiente: 'b' };
  const wa: PasoParaGrafo = { id: 'b', canal: 'whatsapp', delay_horas: 0, cuerpo: 'hola', siguiente: null };
  assert.deepEqual(canalesParaProbar([ig, wa]), ['whatsapp', 'instagram']);
  assert.deepEqual(canalesParaProbar([ig]), ['instagram'], 'un flujo sólo de Instagram no abre el teléfono de WhatsApp');
});
