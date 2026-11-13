// =============================================================================
// El grupo de la app: lo puro (3/11/2026)
// =============================================================================
// La condición que abre un grupo a alguien de otro negocio, la identidad en el mensaje, lo que se le saca a un invitado, los carteles, el push y los links. Sin base.
//
// PROBADO ROMPIÉNDOLO: al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { autorDePersona, juzgarAcceso, laVeUnInvitado, leerParticipanteDeApp, letraDeAcceso, msgDeFila, nombraAMaKoEnElTexto, participanteDeApp, sinLinksParaInvitado, textoParaComparar, tituloParaInvitado, type FilaGrupo } from '../lib/grupo-reglas';
import { cartelParaLaApp, claveDeLaApp, esClaveDeLaApp, esIdDeLaApp, filaDelId, vozDeLaApp, wsDeClaveDeLaApp } from '../lib/grupo-salida';
import { telefonoDelParticipante, actorDeWhatsApp } from '../lib/doer-ticket';
import { canalDeClave } from '../lib/api-mako/canal';
import { conQuienPidio, quienEnElGrupo, rechazoSiNoEsConfirmacionPura, sinQuienPidio } from '../lib/confirmacion-pura';
import { sinElLlamadoAMaKo } from '../lib/doer-para-quien';
import { quierePushDelGrupo, PUSH_SOLO_ADMINS, PUSH_TIPOS } from '../lib/notif-catalogo';
import { rutaMovilOHome } from '../lib/movil-rutas';
import { rutaDelSecondBrainEnOpsCenter } from '../lib/ops-center-ruta';
import { textoFalloIA } from '../lib/fallo-ia-texto';
import { avisoClaveTapadaEnElGrupo } from '../lib/doer-claves';
import { TABLAS_DE_INQUILINO } from '../lib/tablas-de-inquilino';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

const base = { ws: 7, esPlataforma: false, negocioPausado: false, invitacion: null, agenciasAprobadas: [] as number[] };
const p = (extra: Record<string, unknown>) => ({ id: 1, rol: 'usuario', rol_ws: 'admin', estado: 'activo', workspace_id: 7, ...extra });

test('la condición: en positivo; sin una razón, null', () => {
  assert.equal(juzgarAcceso({ ...base, persona: null }), null);
  assert.equal(juzgarAcceso({ ...base, persona: p({ id: 0 }) }), null, 'sin una persona de verdad');
  assert.equal(juzgarAcceso({ ...base, persona: p({ estado: 'suspendido' }) }), null);
  assert.deepEqual(juzgarAcceso({ ...base, persona: p({}) }), { tipo: 'admin', administra: true, desdeId: 0 });
  assert.deepEqual(juzgarAcceso({ ...base, persona: p({ rol_ws: null }) }), { tipo: 'admin', administra: true, desdeId: 0 }, 'rol_ws null es admin');
  // 13/11/2026, el Cerebro: con los grupos de WhatsApp dejados, el closer y el setter del negocio están en su grupo, con lo que su rol ve (`equipo`).
  assert.deepEqual(juzgarAcceso({ ...base, persona: p({ rol_ws: 'closer' }) }), { tipo: 'equipo', administra: false, desdeId: 0, rolWs: 'closer' }, 'closer y setter del negocio, del equipo');
  assert.deepEqual(juzgarAcceso({ ...base, persona: p({ rol_ws: 'setter' }) }), { tipo: 'equipo', administra: false, desdeId: 0, rolWs: 'setter' });
  assert.equal(juzgarAcceso({ ...base, persona: p({ rol_ws: 'closer', estado: 'invitado' }) }), null, 'un closer que nunca entró, no');
  assert.equal(juzgarAcceso({ ...base, persona: p({ rol_ws: 'closer', workspace_id: 8 }) }), null, 'el closer de OTRO negocio, no');
  assert.equal(juzgarAcceso({ ...base, persona: p({ estado: 'invitado' }) }), null, 'un invitado a MaKo que nunca entró no administra');
  assert.equal(juzgarAcceso({ ...base, persona: p({ workspace_id: 8 }) }), null);
});

test('la agencia: administra, activa y con la cartera aprobada; si no se pudo leer, ese camino dice que no', () => {
  const de = p({ workspace_id: 13 });
  assert.deepEqual(juzgarAcceso({ ...base, persona: de, agenciasAprobadas: [13] }), { tipo: 'agencia', administra: true, desdeId: 0 });
  assert.equal(juzgarAcceso({ ...base, persona: p({ workspace_id: 13, rol_ws: 'closer' }), agenciasAprobadas: [13] }), null);
  assert.equal(juzgarAcceso({ ...base, persona: de, agenciasAprobadas: [] }), null);
  assert.equal(juzgarAcceso({ ...base, persona: de, agenciasAprobadas: null }), null, 'no pude leer no es «sí»');
});

test('invitado: de otro negocio, no administra y lee desde su `desde_id`', () => {
  assert.deepEqual(juzgarAcceso({ ...base, persona: p({ workspace_id: 8 }), invitacion: { desdeId: 42 } }), { tipo: 'invitado', administra: false, desdeId: 42 });
  assert.deepEqual(juzgarAcceso({ ...base, persona: p({ rol_ws: 'closer' }), invitacion: { desdeId: 3 } }), { tipo: 'equipo', administra: false, desdeId: 0, rolWs: 'closer' }, 'un closer del negocio invitado antes sigue siendo del equipo');
  assert.deepEqual(juzgarAcceso({ ...base, persona: p({}), invitacion: { desdeId: 3 } }), { tipo: 'admin', administra: true, desdeId: 0 }, 'quien administra no queda recortado por una invitación vieja');
});

test('negocio pausado: entra sólo el super admin', () => {
  assert.equal(juzgarAcceso({ ...base, negocioPausado: true, persona: p({}) }), null);
  assert.equal(juzgarAcceso({ ...base, negocioPausado: true, persona: p({ workspace_id: 8 }), invitacion: { desdeId: 0 } }), null);
  assert.equal(juzgarAcceso({ ...base, negocioPausado: true, persona: p({ rol: 'admin', workspace_id: null }) })?.tipo, 'soporte');
});

test('⛔ el grupo de la plataforma: sólo el rol global, y nadie lo administra', () => {
  const plat = { ...base, ws: 9, esPlataforma: true };
  assert.equal(juzgarAcceso({ ...plat, persona: p({ workspace_id: 9 }) }), null, 'admin de ese workspace, sin el rol global');
  assert.equal(juzgarAcceso({ ...plat, persona: p({ workspace_id: 8 }), invitacion: { desdeId: 0 } }), null, 'ni invitado');
  assert.deepEqual(juzgarAcceso({ ...plat, persona: p({ rol: 'admin', workspace_id: 9 }) }), { tipo: 'soporte', administra: false, desdeId: 0 });
});

test('la letra: `m` sólo con la prueba positiva', () => {
  assert.equal(letraDeAcceso(null), 'i');
  assert.equal(letraDeAcceso({ tipo: 'invitado', administra: false, desdeId: 0 }), 'i');
  for (const tipo of ['admin', 'agencia', 'soporte'] as const) assert.equal(letraDeAcceso({ tipo, administra: true, desdeId: 0 }), 'm');
});

test('⛔ la identidad en el mensaje: anclada al final, y nunca un teléfono', () => {
  assert.equal(participanteDeApp('Ana@X.com', 'm'), 'ana@x.com#m@app.mako');
  assert.deepEqual(leerParticipanteDeApp('ana@x.com#m@app.mako'), { email: 'ana@x.com', letra: 'm' });
  assert.deepEqual(leerParticipanteDeApp('x#m@y.com#i@app.mako'), { email: 'x#m@y.com', letra: 'i' }, 'leído por el primer `#`, correría con todas las herramientas');
  assert.equal(leerParticipanteDeApp('x#m@y.com'), null);
  assert.equal(leerParticipanteDeApp('5491100000010@s.whatsapp.net'), null);
  assert.equal(leerParticipanteDeApp(null), null);
  assert.equal(telefonoDelParticipante('12345678#m@app.mako'), null, 'sin DEBUG ni computadora del dueño por un email de dígitos');
  assert.equal(actorDeWhatsApp('ana@x.com#m@app.mako', 'Ana'), 'whatsapp:Ana');
  assert.equal(quienEnElGrupo('ana@x.com#m@app.mako'), 'ana@x.com#m@app.mako', 'una cadena estable: el «sí» de quien pidió anda');
});

test('la clave: termina en @g.us y las confirmaciones son las de WhatsApp', () => {
  assert.equal(claveDeLaApp(7), 'app7@g.us');
  assert.ok(esClaveDeLaApp('app7@g.us'));
  assert.ok(!esClaveDeLaApp('120363000000000010@g.us'));
  assert.equal(wsDeClaveDeLaApp('app7@g.us'), 7);
  assert.equal(canalDeClave('app7@g.us'), 'whatsapp', 'con `app:`, `rechazoSiNoEsConfirmacionPura` no correría: un «ok, esperá» ejecutaría plata');
  assert.ok(esIdDeLaApp('app:12') && !esIdDeLaApp('3EB0') && !esIdDeLaApp('app:x'));
  assert.equal(filaDelId('app:12'), 12);
});

test('a un invitado se le sacan los links de MaKo y los avisos a la agencia', () => {
  const hosts = ['https://hola-mako.com', 'hola-mako.com', 'makodigital.app'];
  assert.equal(sinLinksParaInvitado('mira https://hola-mako.com/crm/5?ws=7 y www.hola-mako.com/plan', hosts), 'mira (en MaKo) y (en MaKo)');
  assert.equal(sinLinksParaInvitado('la landing es https://mi-negocio.com/oferta', hosts), 'la landing es https://mi-negocio.com/oferta', 'el resto lo ve igual');
  assert.equal(sinLinksParaInvitado('https://makodigital.app/x', hosts), '(en MaKo)');
  assert.equal(laVeUnInvitado({ id: 5, aviso_tipo: null }, 5), false, 'desde que entró: estrictamente después');
  assert.equal(laVeUnInvitado({ id: 6, aviso_tipo: null }, 5), true);
  assert.equal(laVeUnInvitado({ id: 6, aviso_tipo: 'meta-cuenta-frenada-agencia' }, 5), false);
  assert.equal(laVeUnInvitado({ id: 6, aviso_tipo: 'meta-cuenta-frenada' }, 5), true);
});

test('el nombre: nadie se hace pasar por MaKo, y un teléfono no se muestra', () => {
  assert.equal(autorDePersona('Ana'), 'Ana');
  assert.notEqual(autorDePersona('MaKo'), 'MaKo');
  assert.notEqual(autorDePersona('máko soporte'), 'máko soporte');
  assert.equal(autorDePersona('+54 9 223 355 0684', 'Alguien en WhatsApp'), 'Alguien en WhatsApp');
  assert.equal(autorDePersona('', 'Alguien'), 'Alguien');
  assert.equal(tituloParaInvitado('Soporte de MaKo', false), 'Invitación de Soporte de MaKo', 'sin el prefijo `MaKo <>`');
  assert.equal(tituloParaInvitado('Fiesta', true), 'Grupo de Fiesta');
});

const fila = (extra: Partial<FilaGrupo>): FilaGrupo => ({
  id: 12, workspace_id: 7, autor_tipo: 'persona', usuario_id: 1, autor_nombre: 'Ana', canal: 'app', texto: 'hola', adjunto: null, responde_a: null, reaccion: null, aviso_tipo: null, wa_message_id: null, created_at: '2026-11-03T00:00:00.000Z', ...extra,
});

test('el mensaje del doer: la forma de WhatsApp, sin base64, y la cita con el id de WhatsApp si lo tiene', () => {
  const o = { clave: 'app7@g.us', email: 'ana@x.com', letra: 'm' as const, nombre: 'Ana' };
  assert.deepEqual(msgDeFila(fila({}), o), { key: { remoteJid: 'app7@g.us', id: 'app:12', fromMe: false, participant: 'ana@x.com#m@app.mako' }, pushName: 'Ana', message: { conversation: 'hola' } });
  const conCita = msgDeFila(fila({}), { ...o, citada: fila({ id: 3, autor_tipo: 'mako', texto: 'lo que dije', wa_message_id: 'WA9' }) });
  assert.equal((conCita.message.extendedTextMessage as { text: string }).text, 'hola');
  assert.equal((conCita.message.contextInfo as { stanzaId: string }).stanzaId, 'WA9');
  const sinWa = msgDeFila(fila({}), { ...o, citada: fila({ id: 3, autor_tipo: 'mako' }) });
  assert.equal((sinWa.message.contextInfo as { stanzaId: string }).stanzaId, 'app:3');
  const audio = msgDeFila(fila({ texto: '', adjunto: { tipo: 'audio', path: 'x', mime: 'audio/mpeg', secs: 4 } }), o);
  assert.deepEqual(audio.message.audioMessage, { mimetype: 'audio/mpeg', seconds: 4 });
  const foto = msgDeFila(fila({ texto: 'mira', adjunto: { tipo: 'imagen', path: 'x', mime: 'image/png' } }), o);
  assert.deepEqual(foto.message.imageMessage, { mimetype: 'image/png', caption: 'mira' });
  const citaAudio = msgDeFila(fila({}), { ...o, citada: fila({ id: 3, canal: 'whatsapp', wa_message_id: 'WA8', texto: '', adjunto: { tipo: 'audio', path: 'x', mime: 'audio/ogg' } }) });
  assert.deepEqual((citaAudio.message.contextInfo as { quotedMessage: unknown }).quotedMessage, { audioMessage: { mimetype: 'audio/ogg' } });
  assert.equal(textoParaComparar('  a\n\n b '), 'a b');
  assert.equal(nombraAMaKoEnElTexto('Hola MÁKO, ¿qué tal?'), true);
  assert.equal(nombraAMaKoEnElTexto('che Bob'), false);
});

test('⛔ un «dale» en WhatsApp no confirma lo que nació sólo en la app; desde la app, sí', () => {
  const r = (confirma: string | null, nacioEnLaApp: boolean, mensaje = 'dale') => rechazoSiNoEsConfirmacionPura({ canal: 'whatsapp', aTerceros: undefined, mensaje, titulo: 'Mandar el mail', resumen: 'r', enElGrupo: { pidio: 'ana#m@app.mako', confirma, aMaKo: false }, nacioEnLaApp });
  assert.match(r('5491100000099@s.whatsapp.net', true) ?? '', /se pidió en el grupo de la app/);
  assert.match(r(null, true) ?? '', /se pidió en el grupo de la app/, 'un lote de varios tampoco');
  assert.equal(r('bob@x.com#m@app.mako', true), null);
  assert.equal(rechazoSiNoEsConfirmacionPura({ canal: 'whatsapp', mensaje: 'dale', titulo: 'T', resumen: 'r', aTerceros: undefined, enElGrupo: { pidio: null, confirma: null, aMaKo: false }, nacioEnLaApp: true, turnoDeLaApp: true }), null, 'un lote de varias personas, todo de la app');
  assert.ok(!leer('lib/confirmacion-pura.ts').includes('grupo-salida'), 'la importan los `.def` sin server-only: `node:async_hooks` rompería cualquier bundle del navegador que llegue a ellos');
  assert.equal(r('5491100000099@s.whatsapp.net', false), null, 'lo que nació en WhatsApp sigue como hoy');
  assert.equal(rechazoSiNoEsConfirmacionPura({ canal: 'app', aTerceros: true, mensaje: 'x', titulo: 't', resumen: 'r', nacioEnLaApp: true }), null, 'la bandeja de la app confirma');
  assert.deepEqual(sinQuienPidio(conQuienPidio({ a: 1 }, 'ana', true)), { payload: { a: 1 }, pidio: 'ana', soloApp: true });
  assert.deepEqual(sinQuienPidio(conQuienPidio({ a: 1 }, null, true)), { payload: { a: 1 }, pidio: null, soloApp: true }, 'no es un parámetro de la acción');
  assert.deepEqual(sinQuienPidio({ a: 1 }), { payload: { a: 1 }, pidio: null });
});

test('«@MaKo sí» escrito en la app es un «sí»', () => {
  assert.equal(sinElLlamadoAMaKo('@MaKo sí', null), 'sí');
  assert.equal(sinElLlamadoAMaKo('sí @mako', null), 'sí');
  assert.equal(sinElLlamadoAMaKo('@MaKo, ¿cuántos leads hay?', null), '@MaKo, ¿cuántos leads hay?', 'un pedido queda como está');
});

test('⚠️ los carteles no le hablan de WhatsApp a quien escribe en la app', () => {
  const doer = leer('lib/mako-doer-in.ts');
  const literales = [...doer.matchAll(/enviarAGrupoJid\(jid, '([^']*WhatsApp[^']*)'/g)].map((m) => m[1]);
  const conCita = [...doer.matchAll(/(?:\? |: )'((?:La nota de voz que citaste|Me llegó tu audio)[^']*WhatsApp[^']*)'/g)].map((m) => m[1]);
  assert.ok(literales.length >= 2, `la guarda dejó de ver los carteles: ${literales}`);
  assert.ok(conCita.length >= 2, `la guarda dejó de ver los carteles: ${conCita}`);
  for (const t of [...literales, ...conCita]) assert.ok(!/WhatsApp/.test(cartelParaLaApp(t)), `«${cartelParaLaApp(t)}»`);
  const clave = cartelParaLaApp(avisoClaveTapadaEnElGrupo('https://hola-mako.com/integraciones'));
  assert.ok(!/Bórrala/.test(clave) && /nadie la vio/.test(clave), 'en la app ya quedó tapada: no hay nada que borrar');
  const conPc = cartelParaLaApp(textoFalloIA('sin_keys', 'https://hola-mako.com/x', 'contestar', 0, [], { conPc: true }));
  assert.ok(!/WhatsApp/.test(conPc), conPc);
  assert.equal(cartelParaLaApp('Le mandé un WhatsApp a Pérez.'), 'Le mandé un WhatsApp a Pérez.', 'lo que dice el modelo no se toca');
  assert.equal(vozDeLaApp('Estás en un grupo de WhatsApp con el dueño.'), 'Estás en un grupo de MaKo con el dueño.');
});

test('el push del grupo: sin nada guardado, sí; lo apagado, apagado; «No molestar» manda', () => {
  assert.equal(quierePushDelGrupo(undefined, ''), true, '`normalizarPush` lo daría apagado a un closer: un invitado nunca oiría nada');
  assert.equal(quierePushDelGrupo({}, ''), true);
  assert.equal(quierePushDelGrupo({ activo: false }, ''), false);
  assert.equal(quierePushDelGrupo({ activo: true, items: { 'mako-grupo': false } }, ''), false);
  assert.equal(quierePushDelGrupo({ silencio: { desde: 0, hasta: 23.5 } }, 'UTC', new Date('2026-11-03T12:00:00Z')), false);
  assert.equal(quierePushDelGrupo({ silencio: { desde: 22, hasta: 8 } }, 'UTC', new Date('2026-11-03T12:00:00Z')), true);
  assert.ok(PUSH_TIPOS.some((t) => t.id === 'mako-grupo'), 'se apaga en «Qué te avisa»');
  assert.ok(!PUSH_SOLO_ADMINS.has('mako-grupo'));
});

test('el link del push no pierde el grupo', () => {
  assert.equal(rutaMovilOHome('/second-brain?grupo=7'), '/m/second-brain?grupo=7');
  assert.equal(rutaMovilOHome('/admin/operaciones?grupo=7'), '/m/operaciones?grupo=7');
  assert.equal(rutaDelSecondBrainEnOpsCenter({ grupo: '7' }), '/admin/operaciones?grupo=7', 'al super admin le abría el grafo');
});

test('la migración: sólo agrega, sin `desde_id` por default, y la cita no sale del negocio', () => {
  const sql = leer('supabase/migrations/0372_grupos_de_la_app.sql').replace(/^--.*$/gm, '');
  assert.match(sql, /desde_id\s+bigint not null,/, 'con `default 0`, una lectura que falla abriría el historial entero');
  assert.match(sql, /foreign key \(workspace_id, responde_a\) references grupo_mensajes \(workspace_id, id\)/);
  assert.match(sql, /unique \(workspace_id, id\)/);
  assert.match(sql, /create unique index if not exists ux_grupo_mensajes_wa on grupo_mensajes \(workspace_id, wa_message_id\) where wa_message_id is not null/);
  assert.match(sql, /create unique index if not exists ux_grupo_mensajes_cliente on grupo_mensajes \(workspace_id, usuario_id, cliente_id\) where cliente_id is not null/);
  assert.ok(!/\bdrop\s|\bdelete\s+from\b|\btruncate\b|\bupdate\s+\w+\s+set\b|alter table (?!grupo_)/i.test(sql), 'sólo agrega');
  assert.ok(!/workspace_id\s+bigint[^,\n]*default/.test(sql), 'sin default: el 1 es un cliente');
  for (const t of ['grupo_mensajes', 'grupo_invitados', 'grupo_leidos']) {
    assert.match(sql, new RegExp(`alter table ${t} enable row level security`));
    assert.match(sql, new RegExp(`revoke all on ${t} from anon, authenticated`));
    assert.ok((TABLAS_DE_INQUILINO as readonly string[]).includes(t), t);
    assert.ok(!new RegExp(`'${t}'`).test(leer('lib/workspace.ts')), `${t} en TENANT_TABLES: getTenantDb le daría a un invitado SU negocio`);
  }
});

// PROBADO ROMPIÉNDOLO (3/11/2026): una rotura por vez sobre el código real, corriendo este archivo, y restaurada. Las 3 dieron rojo:
//   · el nombre MaKo pasa → 1 en rojo: «el nombre: nadie se hace pasar por MaKo, y un teléfono no se»
//   · la letra por el primer # → 1 en rojo: «⛔ la identidad en el mensaje: anclada al final, y nunca un t»
//   · @mako no se saca → 1 en rojo: ««@MaKo sí» escrito en la app es un «sí»»
