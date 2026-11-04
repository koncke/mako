// =============================================================================
// Hijo de tests/grupos-ops-avisos.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Requisito 3 de Martín: TODOS los avisos caen en el grupo de la app, sin depender de que WhatsApp los entregue. `emitirAviso` y las puertas de lib/mako-grupo.ts, REALES. Evolution contesta lo que pida la escena.

import { db, correrDespues, decirResultado, escenaNueva, red, aEvolution, pushes, usuario } from './_grupos-ops-arnes';
import { decirYSalir } from './_salir-cuando-salio';

const WS = 10, SIN_GRUPO = 12, PLATAFORMA = 9, OTRO = 14;
const JID = '120363000000000010@g.us', JID_SUPER = '120363000000000009@g.us', JID_OTRO = '120363000000000014@g.us';
const LINEA = 'mako_superadmin_x';
const ESTADO = { activo: true, wa: true, email: false, frecuenciaMin: 0 };

const filas = (ws: number) => db.grupo_mensajes.filter((f) => f.workspace_id === ws);
const mails = () => red.filter((x) => x.host === 'api.resend.com').length;
function limpiar() {
  db.grupo_mensajes.splice(0); db.mako_doer_conv.splice(0); db.insistencias.splice(0); db.grupo_leidos.splice(0); db.notificaciones.splice(0);
  db.app_settings = db.app_settings.filter((f) => !String(f.key).startsWith('mako.aviso.last') && !String(f.key).startsWith('mako.equipo') && !String(f.key).startsWith('mako.espaciado') && !String(f.key).startsWith('aviso.arreglo'));
}

async function main() {
  db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo', estado: 'activo' }, { id: 1, capa: 'cliente', nombre: 'Dueño', estado: 'activo' }, { id: WS, capa: 'cliente', nombre: 'Fiesta', estado: 'activo' },
    { id: SIN_GRUPO, capa: 'cliente', nombre: 'Sin Grupo', estado: 'activo' }, { id: OTRO, capa: 'cliente', nombre: 'Otro', estado: 'activo' });
  db.app_settings.push(
    { workspace_id: WS, key: 'mako.grupo_jid', value: JID }, { workspace_id: OTRO, key: 'mako.grupo_jid', value: JID_OTRO }, { workspace_id: 1, key: 'mako.superadmin.grupo_jid', value: JID_SUPER },
    { workspace_id: 1, key: 'mako.voz.instancia', value: LINEA }, { workspace_id: WS, key: 'notif_emails', value: JSON.stringify(['equipo@fiesta.test']) },
    // Un aviso que insiste.
    { workspace_id: WS, key: 'mako.plantillas.store', value: JSON.stringify({ 'aviso-que-insiste': { flujo: { version: 1, activo: true, disparador: { tipo: 'evento' }, pasos: [{ tipo: 'insistir', cadaMin: 30, veces: 3 }] } } }) },
  );
  db.usuarios.push(usuario(101, 'dueno@fiesta.test', 'Ana', WS, 'admin'), usuario(102, 'closer@fiesta.test', 'Cris', WS, 'closer'), usuario(103, 'agencia@x.test', 'Agencia', OTRO, 'admin'), usuario(901, 'martin@mako.test', 'Martín', PLATAFORMA, null, { rol: 'admin' }));
  db.push_suscripciones.push(
    { id: 1, usuario_id: 101, endpoint: 'https://fcm.googleapis.com/fcm/send/ana', p256dh: 'p', auth: 'a', fallos: 0 },
    { id: 2, usuario_id: 102, endpoint: 'https://fcm.googleapis.com/fcm/send/cris', p256dh: 'p', auth: 'a', fallos: 0 },
    { id: 3, usuario_id: 901, endpoint: 'https://fcm.googleapis.com/fcm/send/martin', p256dh: 'p', auth: 'a', fallos: 0 },
    { id: 4, usuario_id: 103, endpoint: 'https://fcm.googleapis.com/fcm/send/agencia', p256dh: 'p', auth: 'a', fallos: 0 },
  );
  const { emitirAviso } = await import('../lib/avisos');
  const { enviarAlGrupoMaKo, enviarAlGrupoSuperAdmin, enviarAGrupoJid } = await import('../lib/mako-grupo');
  const { avisarArregloAlGrupo } = await import('../lib/aviso-arreglo');
  const { avisarTicket } = await import('../lib/tickets-cierre');
  const { llegoLaTarjeta, resultadoDelAviso } = await import('../lib/mako-tarjeta');
  const { conSalidaDelGrupo } = await import('../lib/grupo-salida');
  const { copiarAlGrupo } = await import('../lib/grupo-app');

  const out: Record<string, unknown> = {};
  const aviso = (extra: Record<string, unknown> = {}) => emitirAviso({ tipo: 'prueba-aviso', titulo: 'Título', texto: '¿Lo cargo al plan?', ws: WS, estado: ESTADO, ...extra } as never);
  const foto = (ws = WS) => ({
    filas: filas(ws).map((f) => ({ autor: f.autor_tipo, texto: f.texto, tipo: f.aviso_tipo, wa: f.wa_message_id, adjunto: f.adjunto })),
    conv: db.mako_doer_conv.map((f) => ({ jid: f.grupo_jid, ws: f.workspace_id, role: f.role, id: f.wa_message_id, content: f.content })),
  });

  // ── Con WhatsApp caído ──
  limpiar(); escenaNueva({ evolution: 'cae' });
  const cae = await aviso();
  await correrDespues();
  out.cae = { r: cae, ...foto(), mails: mails(), notif: db.notificaciones.map((n) => (n.payload as { salida?: string })?.salida ?? null) };

  // ── Sin grupo de WhatsApp ──
  limpiar(); escenaNueva();
  const sinGrupo = await aviso({ ws: SIN_GRUPO });
  await correrDespues();
  out.sinGrupo = { r: sinGrupo, ...foto(SIN_GRUPO), evolution: aEvolution() };

  // ── `canal.wa` falso ──
  limpiar(); escenaNueva();
  const sinWa = await aviso({ estado: { ...ESTADO, wa: false, email: true } });
  await correrDespues();
  out.sinWa = { r: sinWa, ...foto(), evolution: aEvolution() };

  // ── Lo que el negocio eligió que no salga, o que ya salió ──
  limpiar(); escenaNueva();
  const porEmail = await aviso({ estado: { ...ESTADO, wa: false, email: true }, push: false });
  const apagado = await aviso({ estado: { ...ESTADO, activo: false } });
  await correrDespues();
  out.noSeCopia = { porEmail: filas(WS).length, apagado: apagado.apagado ?? false, r: porEmail };
  limpiar(); escenaNueva();
  await aviso({ dedupTtlMin: 60, dedupKey: 'x' });
  const deduped = await aviso({ dedupTtlMin: 60, dedupKey: 'x' });
  await correrDespues();
  out.deduped = { filas: filas(WS).length, deduped: deduped.deduped };
  // En la cola del resumen: sale a la mañana. Un aviso agrupable con el resumen prendido.
  limpiar(); escenaNueva();
  db.app_settings.push({ workspace_id: WS, key: 'notification_prefs', value: JSON.stringify({ resumenDiario: true }) });
  const enCola = await aviso({ tipo: 'tareas-autocompletadas', categoria: 'aviso' });
  await correrDespues();
  out.enCola = { filas: filas(WS).length, agrupado: enCola.agrupado ?? false };
  db.app_settings = db.app_settings.filter((f) => f.key !== 'notification_prefs');

  // ── Con WhatsApp bien: la fila queda con su id, y el eco la encuentra ──
  limpiar(); escenaNueva();
  const bien = await aviso();
  await correrDespues();
  out.bien = { r: bien, ...foto() };

  // ── Por partes: una fila por parte; el binario se sube después ──
  limpiar(); escenaNueva();
  const partes = await aviso({ partes: [{ tipo: 'texto', texto: 'Mira este video' }, { tipo: 'audio', base64: Buffer.from('OggS audio').toString('base64'), mime: 'audio/ogg' }], rotulo: false });
  const antesDeSubir = filas(WS).map((f) => (f.adjunto ? (f.adjunto as { path?: string | null }).path ?? null : 'sin'));
  await correrDespues();
  out.partes = { r: partes, ...foto(), antesDeSubir };

  // Una tarjeta con un video: el hilo no lo guarda, queda su texto.
  limpiar(); escenaNueva();
  await aviso({ partes: [{ tipo: 'media', base64: 'AAAA', media: { tipo: 'video', mimetype: 'video/mp4' }, caption: 'Mira el video' }, { tipo: 'media', base64: Buffer.from('%PDF-1.7').toString('base64'), media: { tipo: 'document', mimetype: 'application/pdf', fileName: 'precio.pdf' }, caption: 'El precio' }], rotulo: false });
  await correrDespues();
  out.partesConVideo = foto().filas.map((f) => ({ texto: f.texto, adjunto: (f.adjunto as { tipo?: string } | null)?.tipo ?? null }));

  // ── `alDueno`: al grupo de la plataforma, y NUNCA a la memoria del cliente ──
  limpiar(); escenaNueva();
  await aviso({ alDueno: true });
  await correrDespues();
  out.alDueno = { deCliente: filas(WS).length, dePlataforma: filas(PLATAFORMA).length, conv: foto().conv };
  limpiar(); escenaNueva({ evolution: 'cae' });
  await aviso({ alDueno: true });
  await correrDespues();
  out.alDuenoCaido = { deCliente: filas(WS).length, dePlataforma: filas(PLATAFORMA).length, conv: foto().conv };

  // ── La insistencia: con la copia, sólo si alguien usa el grupo ──
  limpiar(); escenaNueva({ evolution: 'cae' });
  await emitirAviso({ tipo: 'aviso-que-insiste', titulo: 'T', texto: 'Insiste', ws: WS });
  await correrDespues();
  const sinNadie = db.insistencias.length;
  limpiar(); escenaNueva({ evolution: 'cae' });
  db.grupo_leidos.push({ workspace_id: WS, usuario_id: 101, hasta_id: 1, updated_at: new Date().toISOString() });
  await emitirAviso({ tipo: 'aviso-que-insiste', titulo: 'T', texto: 'Insiste', ws: WS });
  await correrDespues();
  const conAlguien = db.insistencias.length;
  limpiar(); escenaNueva();
  await emitirAviso({ tipo: 'aviso-que-insiste', titulo: 'T', texto: 'Insiste', ws: WS });
  await correrDespues();
  out.insistencia = { sinNadie, conAlguien, conWhatsApp: db.insistencias.length };

  // ── Las puertas directas ──
  limpiar(); escenaNueva({ evolution: 'cae' });
  const mako = await enviarAlGrupoMaKo(WS, 'Lo dice MaKo', 'mako');
  await correrDespues();
  out.puertaMako = { r: mako, ...foto() };
  limpiar(); escenaNueva({ evolution: 'cae' });
  const equipo = await enviarAlGrupoMaKo(WS, '👨‍💻 Desarrollador de MaKo: ya está', { de: 'equipo', ticket: 5 });
  await correrDespues();
  out.puertaEquipo = { r: equipo, ...foto(), anillo: db.app_settings.filter((f) => String(f.value).includes('ya está') && f.workspace_id === WS).map((f) => f.value) };
  limpiar(); escenaNueva({ evolution: 'cae' });
  const nula = await enviarAlGrupoMaKo(WS, 'Ya copió emitirAviso', null);
  await correrDespues();
  out.puertaNula = { r: nula, filas: filas(WS).length, conv: foto().conv.length };
  limpiar(); escenaNueva({ evolution: 'cae' });
  const superCon = await enviarAlGrupoSuperAdmin('Respuesta al equipo — negocio');
  await correrDespues();
  const conCopia = filas(PLATAFORMA).length;
  limpiar(); escenaNueva({ evolution: 'cae' });
  const superSin = await enviarAlGrupoSuperAdmin('Sin copia', { sinCopia: true });
  await correrDespues();
  out.superAdmin = { superCon, conCopia, superSin, sinCopia: filas(PLATAFORMA).length };
  limpiar(); escenaNueva({ evolution: 'cae' });
  const viejo = await enviarAGrupoJid(JID, 'Sin contexto: el panel de /agencia');
  out.sinContexto = { r: viejo, filas: filas(WS).length };

  // ── El contexto del turno: lo que dice MaKo va al hilo ──
  limpiar(); escenaNueva();
  const soloApp = await conSalidaDelGrupo({ ws: WS, clave: JID, soloApp: true, hayInvitado: false }, () => enviarAGrupoJid(JID, 'Sólo en la app'));
  await correrDespues();
  out.contextoSoloApp = { r: soloApp, ...foto(), evolution: aEvolution() };
  limpiar(); escenaNueva();
  const mixto = await conSalidaDelGrupo({ ws: WS, clave: JID, soloApp: false, hayInvitado: false }, () => enviarAGrupoJid(JID, 'En los dos'));
  await correrDespues();
  out.contextoMixto = { r: mixto, ...foto(), evolution: aEvolution() };
  limpiar(); escenaNueva();
  const claveDeLaApp = await enviarAGrupoJid(`app${SIN_GRUPO}@g.us`, 'Una clave de la app, sin contexto');
  await correrDespues();
  out.claveDeLaApp = { r: claveDeLaApp, ...foto(SIN_GRUPO), evolution: aEvolution() };

  // ── Reintentos sin burbujas de más, con WhatsApp caído y corriendo dos veces ──
  limpiar(); escenaNueva({ evolution: 'cae' });
  db.tickets.push({ id: 700, titulo: 'Se traba', estado: 'resuelto', respuesta: 'Listo', duplicado_de: null, workspace_id: WS, usuario_id: null, canal: 'whatsapp', contexto: {}, avisado_at: null, updated_at: new Date().toISOString() });
  const t1 = await avisarTicket(700);
  await correrDespues();
  const t2 = await avisarTicket(700);
  await correrDespues();
  out.ticket = { t1, t2, filas: filas(WS).length, avisado: !!db.tickets.find((t) => t.id === 700)?.avisado_at };
  limpiar(); escenaNueva({ evolution: 'cae' });
  const pedido = { ws: WS, clave: 'ticket:701', texto: 'Ya quedó arreglado lo del botón', prueba: 'deploy de prueba', origen: 'ticketera' };
  const a1 = await avisarArregloAlGrupo(pedido);
  const a2 = await avisarArregloAlGrupo(pedido);
  await correrDespues();
  out.arreglo = { a1, a2, filas: filas(WS).length, reservas: db.app_settings.filter((f) => String(f.key).includes('ticket:701')).length };
  out.consumidores = {
    llego: llegoLaTarjeta({ ok: true, wa: false, enApp: true }), noLlego: llegoLaTarjeta({ ok: true, wa: false }),
    resultado: resultadoDelAviso({ ok: true, wa: false, deduped: false, enApp: true, waError: 'Evolution 400 en mako_ws9: se cayó' } as never, null),
    sinCopia: resultadoDelAviso({ ok: true, wa: false, deduped: false, waError: 'Evolution 400 en mako_ws9: se cayó' } as never, null),
  };

  // ── La copia no frena ni tira el envío ──
  limpiar(); escenaNueva({ colgar: new Set(['grupo_mensajes:POST']) });
  const arranque = Date.now();
  const colgada = await enviarAlGrupoMaKo(WS, 'La base está colgada', 'mako');
  out.colgada = { r: colgada, ms: Date.now() - arranque, evolution: aEvolution() };
  limpiar(); escenaNueva({ fallar: new Set(['grupo_mensajes:POST']) });
  const rota = await aviso();
  await correrDespues();
  out.rota = { ok: rota.ok, wa: rota.wa, enApp: rota.enApp ?? false, evolution: aEvolution(), filas: filas(WS).length };

  // ── La copia tapa lo que un invitado no tiene que leer ──
  limpiar(); escenaNueva();
  const CLAVE = `sk-proj-${'A1b2C3d4'.repeat(6)}`;
  await copiarAlGrupo(WS, { texto: `Falló con la clave ${CLAVE}`, de: 'mako' });
  await correrDespues();
  out.copiaTapa = { enLaBase: JSON.stringify(db.grupo_mensajes).includes(CLAVE), texto: filas(WS)[0].texto };

  // ── El push: los miembros de verdad, menos el autor; un aviso, sin los admin del negocio que ya lo recibieron ──
  limpiar(); escenaNueva();
  db.agencia_clientes.push({ agencia_ws: OTRO, cliente_ws: WS, estado: 'aprobado' });
  db.grupo_invitados.push({ workspace_id: WS, email: 'closer@fiesta.test', usuario_id: 102, invito_usuario_id: 101, desde_id: 0, invitado_at: '2026-01-01T00:00:00.000Z', abrio_at: '2026-01-01T00:00:00.000Z', avisado_at: null, salio_at: null });
  await copiarAlGrupo(WS, { texto: 'Mira https://hola-mako.com/crm/5', de: 'mako' });
  await correrDespues();
  const aTodos = pushes.map((p) => ({ a: p.endpoint.split('/').pop(), cuerpo: p.cuerpo }));
  escenaNueva();
  await copiarAlGrupo(WS, { texto: 'Otro aviso', de: 'mako', pushYaSalio: true });
  await correrDespues();
  const sinAdmins = pushes.map((p) => p.endpoint.split('/').pop());
  // Las preferencias de cada uno.
  const conPerfil = (id: number, perfil: Record<string, unknown>) => { const u = db.usuarios.find((f) => f.id === id)!; u.perfil = perfil; };
  escenaNueva();
  conPerfil(101, { notifPush: { activo: false } }); conPerfil(103, { notifPush: { activo: true, items: { 'mako-grupo': false } } });
  conPerfil(102, { timezone: 'America/Argentina/Buenos_Aires', notifPush: { silencio: { desde: 0, hasta: 23.5 } } });
  await copiarAlGrupo(WS, { texto: 'Con preferencias', de: 'mako' });
  await correrDespues();
  const conPreferencias = pushes.map((p) => p.endpoint.split('/').pop());
  out.push = { aTodos, sinAdmins, conPreferencias };

  await decirYSalir(decirResultado(out));
}

main().catch((e) => { console.error(e); process.exit(1); });
