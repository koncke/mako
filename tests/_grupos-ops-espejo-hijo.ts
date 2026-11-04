// =============================================================================
// Hijo de tests/grupos-ops-espejo.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Requisito 5 de Martín: lo que entra por el grupo de WhatsApp se ve también en la app, sin duplicar y sin que MaKo conteste dos veces. El WEBHOOK REAL, con su firma.

process.env.MAKO_DOER_VENTANA_MS = '0';
import { db, correrDespues, decirResultado, escenaNueva, red, aEvolution, alModelo, pushes, usuario, CREDITO2, OPENAI_NEGOCIO, PLATAFORMA } from './_grupos-ops-arnes';
import { decirYSalir } from './_salir-cuando-salio';

const WS = 10;
const JID = '120363000000000010@g.us', JID_SUPER = '120363000000000009@g.us', JID_PERSONAL = '120363000000000777@g.us', JID_PRUEBAS = '120363000000000888@g.us';
// La voz en el número de Martín, como hoy: su línea trae todos sus grupos, y sólo el anillo dice qué es de MaKo.
const LINEA = 'mako_ws9';
const clase = (c: string) => JSON.stringify({ clase: c, resumen: 'lo que pide', reenviado: false });
const filas = (ws = WS) => db.grupo_mensajes.filter((f) => f.workspace_id === ws);
const ahora = () => Math.floor(Date.now() / 1000);
// Primero lo que quedó para después de responder en la escena anterior: si no, corre en la siguiente.
async function limpiar() {
  await correrDespues();
  for (const t of ['grupo_mensajes', 'mako_doer_conv', 'mako_doer_buffer', 'mako_doer_lock', 'insistencias', 'flujo_corridas']) db[t].splice(0);
  db.app_settings = db.app_settings.filter((f) => !String(f.key).startsWith('mako.doer.'));
  db.app_settings.push({ workspace_id: 1, key: 'mako.doer.grupos', value: JSON.stringify([JID_PRUEBAS]) });
}
const msg = (id: string, message: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  key: { id, fromMe: false, remoteJid: JID, participant: '70000000000099@lid', addressingMode: 'lid', participantAlt: '5491133334444@s.whatsapp.net' },
  message, pushName: 'Pedro', messageTimestamp: ahora(), ...extra,
});
const eco = (id: string, texto: string, jid = JID) => ({ key: { id, fromMe: true, remoteJid: jid }, message: { conversation: texto }, pushName: 'Martín', messageTimestamp: ahora() });

async function main() {
  db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo', estado: 'activo' }, { id: 1, capa: 'cliente', nombre: 'Dueño', estado: 'activo' }, { id: WS, capa: 'cliente', nombre: 'Fiesta', estado: 'activo' });
  db.app_settings.push({ workspace_id: WS, key: 'mako.grupo_jid', value: JID }, { workspace_id: 1, key: 'mako.superadmin.grupo_jid', value: JID_SUPER }, { workspace_id: 1, key: 'mako.voz.instancia', value: LINEA });
  db.evolution_instancias.push({ instance_name: LINEA, workspace_id: PLATAFORMA }, { instance_name: 'mako_ws9b', workspace_id: PLATAFORMA });
  db.usuarios.push(usuario(101, 'ana@fiesta.test', 'Ana', WS, 'admin'), usuario(901, 'martin@mako.test', 'Martín', PLATAFORMA, null, { rol: 'admin' }));
  db.push_suscripciones.push({ id: 1, usuario_id: 101, endpoint: 'https://fcm.googleapis.com/fcm/send/ana', p256dh: 'p', auth: 'a', fallos: 0 });
  const { cifrarSecreto } = await import('../lib/credenciales');
  db.credenciales.push(
    { workspace_id: WS, clave: 'OPENAI_API_KEY', valor_enc: cifrarSecreto(OPENAI_NEGOCIO, WS, 'OPENAI_API_KEY'), servicio: 'openai' },
    { workspace_id: PLATAFORMA, clave: 'ANTHROPIC_CREDITO_CUENTA2', valor_enc: cifrarSecreto(CREDITO2, PLATAFORMA, 'ANTHROPIC_CREDITO_CUENTA2'), servicio: 'anthropic' },
  );
  const { NextRequest } = await import('next/server');
  const { POST } = await import('../app/api/webhooks/evolution/route');
  const { firmaDeInstancia } = await import('../lib/evolution-firma');
  const { copiarAlGrupo } = await import('../lib/grupo-app');
  const { enviarAGrupoJid, anotarEnviadosAlGrupo } = await import('../lib/mako-grupo');
  const { conSalidaDelGrupo } = await import('../lib/grupo-salida');
  const { leerMensajeDeWhatsApp } = await import('../lib/grupo-espejo');

  const webhook = async (m: unknown, instance = LINEA) => {
    const firma = firmaDeInstancia(process.env.EVOLUTION_WEBHOOK_SECRET!, instance);
    const r = await POST(new NextRequest(`https://hola-mako.com/api/webhooks/evolution?firma=${firma}&i=${instance}`, { method: 'POST', body: JSON.stringify({ event: 'messages.upsert', instance, data: m }) }));
    return r.status;
  };
  const foto = (ws = WS) => filas(ws).map((f) => ({ id: f.id, autor: f.autor_tipo, canal: f.canal, nombre: f.autor_nombre, texto: f.texto, wa: f.wa_message_id, adjunto: f.adjunto, responde: f.responde_a, waAt: f.wa_at }));
  const out: Record<string, unknown> = {};
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]).toString('base64');
  const HTML = Buffer.from('<html><script>alert(1)</script></html>').toString('base64');
  const OGG = Buffer.from('OggS audio de whatsapp').toString('base64');
  const PDF = Buffer.from('%PDF-1.7 un documento').toString('base64');

  // ── Una persona en WhatsApp: una fila, con su nombre y sin su teléfono, y UN turno ──
  await limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Te contesto por los dos.' });
  const status = await webhook(msg('WA1', { conversation: 'mako, ¿cuántos leads hay?' }));
  const antesDelTurno = foto();
  await correrDespues();
  out.persona = { status, antesDelTurno, despues: foto(), llamadas: alModelo().length, envios: aEvolution().filter((c) => c.includes('/message/sendText/')).length, conv: db.mako_doer_conv.length };
  const enElHilo = JSON.stringify(foto());
  out.sinTelefono = !enElHilo.includes('5491133334444');

  // ── Re-entrega y dos líneas: una fila y un turno ──
  await limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Una vez.' });
  await webhook(msg('WA2', { conversation: 'mako, una vez' }));
  await webhook(msg('WA2', { conversation: 'mako, una vez' }));
  await webhook(msg('WA2', { conversation: 'mako, una vez' }), 'mako_ws9b');
  await correrDespues();
  out.reentrega = { filas: foto().filter((f) => f.autor === 'persona').length, llamadas: alModelo().length };

  // ── Los grupos que no son de ningún negocio: la voz es el número de Martín ──
  await limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Soy de prueba.' });
  await webhook({ ...msg('WA3', { conversation: 'la charla de su familia' }), key: { ...msg('WA3', {}).key, remoteJid: JID_PERSONAL } });
  await correrDespues();
  const personal = { filas: db.grupo_mensajes.length, llamadas: alModelo().length };
  await limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Soy de prueba.' });
  await webhook({ ...msg('WA4', { conversation: 'mako, probando' }), key: { ...msg('WA4', {}).key, remoteJid: JID_PRUEBAS } });
  await correrDespues();
  out.ajenos = { personal, pruebas: { filas: db.grupo_mensajes.length, llamadas: alModelo().length, envios: aEvolution().filter((c) => c.includes('/message/sendText/')).length } };

  // ── Una clave pegada en WhatsApp, tapada antes de guardar ──
  await limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Ok.' });
  const CLAVE = `sk-proj-${'A1b2C3d4'.repeat(6)}`;
  await webhook(msg('WA5', { conversation: `mako, esta es: ${CLAVE}` }));
  out.clave = { texto: foto()[0].texto, enLaBase: JSON.stringify(db.grupo_mensajes).includes(CLAVE) };

  // ── Lo que no es un mensaje ──
  await limpiar(); escenaNueva();
  await webhook(msg('WA6', { reactionMessage: { text: '👍', key: { id: 'WA5' } } }));
  out.reaccion = db.grupo_mensajes.length;

  // ── Los archivos: validados, y la fila primero ──
  await limpiar(); escenaNueva({ clase: clase('NO_REPLY') });
  await webhook(msg('WA7', { imageMessage: { caption: 'mirá', mimetype: 'image/png' } }, { base64: PNG }));
  await webhook(msg('WA8', { audioMessage: { mimetype: 'audio/ogg', seconds: 3, ptt: true } }, { base64: OGG }));
  await webhook(msg('WA9', { documentMessage: { fileName: 'precio.pdf', mimetype: 'application/pdf' } }, { base64: PDF }));
  await webhook(msg('WA10', { documentMessage: { fileName: 'virus.pdf', mimetype: 'application/pdf' } }, { base64: HTML }));
  await webhook(msg('WA11', { imageMessage: { mimetype: 'image/svg+xml' } }, { base64: HTML }));
  await webhook(msg('WA12', { documentMessage: { fileName: 'plan.docx', mimetype: 'application/msword' } }));
  await webhook(msg('WA13', { videoMessage: { caption: 'el video' } }));
  await webhook(msg('WA14', { stickerMessage: {} }));
  // Una foto que no se puede bajar: la fila queda, con su texto.
  await webhook(msg('WA15', { imageMessage: { caption: 'sin bajar', mimetype: 'image/jpeg' } }));
  out.archivos = foto().map((f) => ({ wa: f.wa, texto: f.texto, tipo: (f.adjunto as { tipo?: string } | null)?.tipo ?? null, conPath: !!(f.adjunto as { path?: string } | null)?.path }));

  // ── La cita y la hora ──
  await limpiar(); escenaNueva({ clase: clase('NO_REPLY') });
  await webhook(msg('WA20', { conversation: 'lo primero' }));
  await webhook(msg('WA21', { extendedTextMessage: { text: 'te contesto', contextInfo: { stanzaId: 'WA20', participant: 'x@lid' } } }));
  const f20 = foto();
  out.cita = { responde: f20[1].responde === f20[0].id, waAt: !!f20[0].waAt };

  // ── EL ECO, sin duplicar ──
  // La copia y el eco ANTES de que vuelva el `key.id`.
  await limpiar(); escenaNueva();
  await copiarAlGrupo(WS, { texto: 'Un aviso de MaKo', de: 'mako' });
  await webhook(eco('ECO1', 'Un aviso de MaKo'));
  out.ecoAntesDelId = foto().map((f) => ({ autor: f.autor, wa: f.wa }));
  // Lo que se copia como texto porque el hilo no lo dibuja (un video, un Word): su eco dice otra cosa, y con el eco ganándole al id salía una burbuja doble.
  await limpiar(); escenaNueva();
  await copiarAlGrupo(WS, { texto: '', de: 'mako', partes: [{ tipo: 'media', media: { tipo: 'video', mimetype: 'video/mp4' }, base64: 'AAAA', caption: 'Mira el resumen' }, { tipo: 'media', media: { tipo: 'document', mimetype: 'application/msword', fileName: 'plan.doc' }, base64: 'AAAA', caption: '' }] as never });
  await webhook({ key: { id: 'ECOV', fromMe: true, remoteJid: JID }, message: { videoMessage: { caption: 'Mira el resumen', mimetype: 'video/mp4' } }, pushName: 'Martín', messageTimestamp: ahora() });
  await webhook({ key: { id: 'ECOD', fromMe: true, remoteJid: JID }, message: { documentMessage: { mimetype: 'application/msword', fileName: 'plan.doc' } }, pushName: 'Martín', messageTimestamp: ahora() });
  out.ecoDeVideo = foto().map((f) => ({ autor: f.autor, wa: f.wa }));
  // ⚠️ Con un link: la copia lo guarda con `?ws=`, y lo que manda el doer va crudo.
  await limpiar(); escenaNueva();
  const dicho = 'Abrí el ticket. Mira el progreso aquí: https://hola-mako.com/tickets?t=5';
  await conSalidaDelGrupo({ ws: WS, clave: JID, soloApp: false, hayInvitado: false }, () => enviarAGrupoJid(JID, dicho));
  const enviado = red.filter((x) => x.camino.includes('/message/sendText/')).map((x) => String((JSON.parse(x.cuerpo) as { text: string }).text))[0];
  // El id quedó atado: el eco de ese id no suma nada.
  const idAtado = String(foto()[0].wa);
  await webhook(eco(idAtado, enviado));
  out.ecoConLink = { filas: foto().length, guardado: foto()[0].texto, enviado };
  // Lo mismo si el eco le gana al id (la fila todavía no lo tiene).
  await limpiar(); escenaNueva();
  await copiarAlGrupo(WS, { texto: dicho, de: 'mako' });
  await webhook(eco('ECO2', dicho));
  out.ecoConLinkSinId = foto().map((f) => ({ autor: f.autor, wa: f.wa }));
  // Sin copia, con el id en el anillo: de MaKo, o del equipo si va firmado (el panel de /agencia).
  await limpiar(); escenaNueva();
  await anotarEnviadosAlGrupo(1, JID, ['ECO3', 'ECO4']);
  await webhook(eco('ECO3', 'Lo mandó el panel'));
  await webhook(eco('ECO4', '👨‍💻 Desarrollador de MaKo: ya quedó'));
  out.ecoDelAnillo = foto().map((f) => ({ autor: f.autor, nombre: f.nombre }));
  // Fuera del anillo: es la persona dueña de la línea escribiendo.
  await limpiar(); escenaNueva({ clase: clase('NO_REPLY') });
  await webhook(eco('ECO5', 'Lo escribo yo, desde mi teléfono'));
  out.ecoDeLaPersona = foto().map((f) => ({ autor: f.autor, nombre: f.nombre }));
  // Dos avisos iguales: se atan en orden.
  await limpiar(); escenaNueva();
  await copiarAlGrupo(WS, { texto: 'Igual', de: 'mako' });
  await copiarAlGrupo(WS, { texto: 'Igual', de: 'mako' });
  await webhook(eco('ECO6', 'Igual'));
  await webhook(eco('ECO7', 'Igual'));
  out.dosIguales = foto().map((f) => f.wa);

  // ── El turno de un mensaje de WhatsApp: lo que dice MaKo se ve en la app, una vez, también con su eco ──
  await limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Te contesto.' });
  await webhook(msg('WA30', { conversation: 'mako, ¿cuántos leads?' }));
  await correrDespues();
  const respuesta = foto().find((f) => f.autor === 'mako');
  await webhook(eco(String(respuesta?.wa), 'Te contesto.'));
  out.turnoConEco = { filas: foto().map((f) => f.autor), reaccionEnLaFila: db.grupo_mensajes.find((f) => f.wa_message_id === 'WA30')?.reaccion, envios: aEvolution().filter((c) => c.includes('/message/sendText/')).length };

  // ── El push: lo de ahora suena; lo viejo que reentrega Evolution al reconectar, no ──
  await limpiar(); escenaNueva({ clase: clase('NO_REPLY') });
  await webhook(msg('WA40', { conversation: 'recién' }));
  await correrDespues();
  const reciente = pushes.length;
  escenaNueva({ clase: clase('NO_REPLY') });
  await webhook(msg('WA41', { conversation: 'de hace una hora' }, { messageTimestamp: ahora() - 3600 }));
  await correrDespues();
  out.push = { reciente, viejo: pushes.length, filaVieja: foto().some((f) => f.wa === 'WA41') };

  // ── El acuse del webhook sigue cerrando, con la función extraída ──
  await limpiar(); escenaNueva({ clase: clase('CHARLA') });
  db.insistencias.push({ id: 900, workspace_id: WS, flujo_id: 'x', lead_id: null, texto: 'y', cada_min: 30, veces: 3, enviadas: 0, proxima_at: new Date().toISOString(), cerrada_at: null });
  await webhook(msg('WA50', { conversation: 'ok' }));
  await correrDespues();
  out.acuse = db.insistencias[0].cerrada_at != null;

  out.leer = { reaccion: leerMensajeDeWhatsApp({ reactionMessage: {} }), protocolo: leerMensajeDeWhatsApp({ protocolMessage: {} }), vacio: leerMensajeDeWhatsApp({}) };
  await decirYSalir(decirResultado(out));
}

main().catch((e) => { console.error(e); process.exit(1); });
