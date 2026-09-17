// =============================================================================
// api-mako/areas/instagram.run — los cuerpos del área `instagram`
// =============================================================================
// Un runner por id de instagram.def.ts. Lecturas: { leer }. Acciones: { preparar, ejecutar }.
// Todo corre adentro de runWithWorkspace(ctx.ws): getTenantDb, getSetting y
// crearBorradorPublicacion resuelven ese workspace. Nunca se escribe desde
// preparar().
//
// ⚠️ ZERNIO Y EL WORKSPACE. Con la key de la plataforma, la cuenta de Zernio de la
// agencia ve los profiles de TODOS los clientes. Por eso ningún id de Zernio sale
// del input: la cuenta se toma de estadoConexionIg (filtrada por el profile del
// ws) y los ids de conversación y de post se resuelven desde las tablas locales
// (getTenantDb) a partir del id LOCAL que manda el agente.
//
// ⚠️ listAccounts/listConversations sin accountId/getConnectUrl pasan por
// ensureProfile, que MATERIALIZA la decisión de cuenta de Zernio. Todo lo de aquí
// que toca Zernio pasa antes por estadoConexionIg, que no consulta la API si la
// decisión está sin resolver.
//
// ⚠️ Y CON LA DECISIÓN TOMADA, LEER ESCRIBE. estado_conexion_instagram y
// conversaciones_inbox_zernio pasan por estadoConexionIg → listAccounts →
// profileIdEfectivo → ensureProfile, que la PRIMERA vez hace upsert en
// zernio_workspace y, con key propia (BYOK), upsertRouting('zernio', …) en CADA
// llamada. Es idempotente y heredado de la page /instagram, pero no es una lectura
// pura. La variante de solo lectura necesita cfg/zFetch, privados de lib/zernio.ts.
//
// ⚠️ NINGÚN DM SALE CON UN TEXTO QUE NADIE VIO. enviar_borrador_dm_instagram tiene
// proponer() propio: fija el texto del borrador EN la propuesta, así el formulario lo
// muestra entero y editable, y al confirmar sale ese texto (no el que haya en la base,
// que el webhook reescribe con cada DM entrante). generar_borrador_dm_instagram se
// niega con la auto-respuesta prendida: ahí la lib envía sola.
// =============================================================================

import 'server-only';
import { esAccion, type Ctx, type Ejecutado, type Preparado, type Propuesto, type Runners } from '../tipos';
import { proponerPantallaGenerica } from '../acciones';
import { porId } from '../registro';
import { tzDeWorkspace } from '@/lib/timezone';
import { estadoConexionIg, estadoZernioIg, firmarPreview, listarConversaciones, listarPublicaciones } from '@/app/instagram/ig-datos';
import { KEY_IG_AUTO_RESPUESTA, enviarBorradorIg, generarBorradorIg, igAutoRespuestaHabilitada, ventanaVigente } from '@/lib/ig-chatbot';
import { crearBorradorPublicacion } from '@/lib/ig-contenido';
import { getConversation, getPost, listConversations } from '@/lib/zernio';
import { setSetting } from '@/lib/settings';
import { getEstadoTab, marcarPasoTab, pasoBloqueadoPor, tabOnboardingDef } from '@/lib/tab-onboarding-state';
import {
  borradoresPorConversacionIg, cancelarProgramacionIg, descartarBorradorIg, editarBorradorIg, leerBorradorIg, leerConversacionIg,
  leerPublicacionIg, localesPorZernioId, mensajesRecientesIg, sincronizarPublicacionIg, ultimoMensajeRealIg,
} from './instagram.helpers';

// ── utilidades ───────────────────────────────────────────────────────────────

const num = (input: Record<string, unknown>, k: string): number | null => {
  const v = input[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};
const str = (input: Record<string, unknown>, k: string): string | null => {
  const v = input[k];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};
const recorta = (s: string | null | undefined, n: number): string | null => {
  if (s == null) return null;
  return s.length > n ? `${s.slice(0, n)}… (recortado)` : s;
};
const fmtFecha = (iso: string, tz: string): string => {
  try { return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: tz }); } catch { return iso; }
};
const json = (o: unknown): string => JSON.stringify(o);
const error = (content: string) => ({ content, isError: true as const });
const TAB = 'instagram';

/** La cuenta de Instagram del ws, o el motivo legible de por qué no hay. */
async function cuentaDelWs(ws: number): Promise<{ id: string; username: string } | { error: string }> {
  const e = await estadoConexionIg(ws);
  if (e.cuenta) return { id: e.cuenta.id, username: e.cuenta.username };
  if (!e.zernio?.resuelto) return { error: 'Instagram no está configurado: falta el paso «Conexión con Zernio» en /instagram.' };
  if (!e.configurado) return { error: 'No hay una API key de Zernio utilizable (ni propia ni de la plataforma): sin ella no se puede leer la cuenta de Instagram.' };
  if (e.error) return { error: `Zernio no respondió: ${e.error}` };
  return { error: 'No hay una cuenta de Instagram conectada. Se conecta desde /instagram.' };
}

const quien = (u: string | null | undefined): string => (u ? `@${u}` : 'el lead');

const SALE_SOLA = 'Con la respuesta automática prendida y la ventana de 24 h abierta, la respuesta sale sola al llegar el DM, y rehacerla desde aquí la ENVIARÍA sin que nadie la lea. Para rehacerla desde aquí, apaga primero la respuesta automática.';

/** Lo que tiene que valer para enviar un borrador, al proponer y al confirmar. */
async function validarEnvio(id: number): Promise<{ username: string | null; textoBorrador: string | null } | { error: string }> {
  const b = await leerBorradorIg(id);
  if (!b) return { error: `No existe el mensaje #${id} en este workspace.` };
  if (b.estado !== 'borrador') return { error: `El mensaje #${id} ya no es un borrador pendiente (está «${b.estado}»).` };
  const conv = await leerConversacionIg(b.conversacion_id);
  if (!conv?.zernio_conversation_id || !conv.zernio_account_id) return { error: 'La conversación de ese borrador no tiene los datos de Zernio para enviar.' };
  if (!ventanaVigente(conv.ventana_expira_at)) {
    return { error: 'La ventana de 24 h de Meta de esa conversación está cerrada. Fuera de la ventana el DM sale con el tag HUMAN_AGENT y lo tiene que mandar una persona desde la bandeja de /instagram.' };
  }
  return { username: conv.username, textoBorrador: b.texto?.trim() || null };
}

const resumenEnvio = (username: string | null, texto: string): string => `Enviar a ${quien(username)} por Instagram: «${texto}»`;

// ── lecturas ─────────────────────────────────────────────────────────────────

export const RUNNERS: Runners = {
  estado_conexion_instagram: {
    leer: async (_input, ctx) => {
      const e = await estadoConexionIg(ctx.ws);
      return json({
        listo: !!e.cuenta,
        key_zernio_utilizable: e.configurado,
        decision_zernio: e.zernio?.resuelto ?? null,
        plataforma_disponible: e.zernio?.plataformaDisponible ?? null,
        cuenta: e.cuenta ? { id: e.cuenta.id, usuario: `@${e.cuenta.username}`, nombre: e.cuenta.displayName ?? null } : null,
        error_zernio: e.error,
        nota: !e.zernio?.resuelto
          ? 'decision_zernio null = el paso «Conexión con Zernio» está sin resolver; no se consultó Zernio y cuenta es null por eso, no porque falte la cuenta.'
          : !e.configurado
            ? 'Decisión de Zernio tomada pero no hay una API key de Zernio utilizable (ni propia ni de la plataforma): no se consultó Zernio y cuenta es null por eso, no porque falte la cuenta de Instagram.'
            : e.cuenta ? 'Canal conectado.'
              : e.error ? 'Zernio no respondió: cuenta null no significa que no haya cuenta conectada.'
                : 'Decisión de Zernio tomada y key utilizable, pero sin cuenta de Instagram conectada: se conecta desde /instagram.',
      });
    },
  },

  estado_zernio_instagram: {
    leer: async (_input, ctx) => {
      const z = await estadoZernioIg(ctx.ws);
      return json({
        decision_zernio: z.resuelto,
        plataforma_disponible: z.plataformaDisponible,
        significado: z.resuelto === 'propia' ? 'usa la API key de Zernio del propio negocio'
          : z.resuelto === 'plataforma' ? 'usa la cuenta de Zernio de MaKo'
            : 'sin resolver: el paso «Conexión con Zernio» de /instagram está pendiente',
      });
    },
  },

  config_instagram: {
    leer: async () => {
      const [auto, tab] = await Promise.all([igAutoRespuestaHabilitada(), getEstadoTab(TAB)]);
      return json({
        auto_respuesta: auto,
        ensayo_hecho: !!tab.steps.ig_ensayo?.done,
        significado: auto
          ? 'PRENDIDA: el borrador de cada DM entrante se envía solo mientras la ventana de 24 h esté abierta.'
          : 'APAGADA: cada borrador espera que una persona lo envíe desde la bandeja.',
        nota: 'Aunque esté prendida, sin una secuencia activa en modo asistido MaKo no redacta nada. Para la conexión usa estado_conexion_instagram.',
      });
    },
  },

  estado_onboarding_instagram: {
    leer: async () => {
      const [estado, def] = [await getEstadoTab(TAB), tabOnboardingDef(TAB)];
      const pasos = (def?.pasos ?? []).map((p) => ({
        paso: p.key, nombre: p.label, hecho: !!estado.steps[p.key]?.done, hecho_at: estado.steps[p.key]?.at ?? null,
      }));
      return json({
        estado: estado.status === 'done' ? 'completo' : 'pendiente',
        pasos,
        faltan: pasos.filter((p) => !p.hecho).map((p) => p.nombre),
        nota: 'Los pasos «zernio» y «conectar» se recalculan al abrir /instagram; pueden estar atrasados si nadie la abrió desde que cambió la conexión.',
      });
    },
  },

  // ── DMs ──

  listar_conversaciones_instagram: {
    leer: async (input) => {
      const base = await listarConversaciones();
      // borradores_pendientes se recuenta sin la ventana de 600 mensajes de la lib.
      const b = await borradoresPorConversacionIg(base.map((c) => c.id));
      const todas = base.map((c) => ({ ...c, borradoresPendientes: b.porConv.get(c.id) ?? 0 }));
      const limite = num(input, 'limite') ?? 30;
      let lista = todas;
      if (input.soloConBorrador === true) lista = lista.filter((c) => c.borradoresPendientes > 0);
      if (input.soloVentanaVigente === true) lista = lista.filter((c) => ventanaVigente(c.ventanaExpiraAt));
      const devueltas = lista.slice(0, limite);
      if (!devueltas.length) {
        return todas.length ? 'Ninguna conversación cumple el filtro (entre las 100 más recientes).' : 'No hay conversaciones de Instagram todavía.';
      }
      return json({
        leidas: todas.length,
        tope_leidas: 100,
        coinciden: lista.length,
        devueltas: devueltas.length,
        conversaciones: devueltas.map((c) => ({
          conversacionId: c.id,
          usuario: c.username ? `@${c.username}` : null,
          ultimo_mensaje_at: c.ultimoMensajeAt,
          ultimo_texto: recorta(c.ultimoTexto, 200),
          borradores_pendientes: c.borradoresPendientes,
          ventana_abierta: ventanaVigente(c.ventanaExpiraAt),
          ventana_expira_at: c.ventanaExpiraAt,
          leadId: c.leadId,
        })),
        notas: [
          todas.length >= 100 ? 'Se leyeron solo las 100 conversaciones más recientes: puede haber más.' : null,
          b.leidas >= b.tope ? `borradores_pendientes es un mínimo: se leyeron ${b.tope} borradores y puede haber más.` : null,
          'ultimo_texto null puede ser un adjunto sin texto o un hilo viejo que quedó fuera de los 600 mensajes recientes que se leen para la vista previa.',
          'leadId casi siempre es null: hoy no existe el vínculo entre una conversación de Instagram y un lead del CRM.',
        ].filter(Boolean),
      });
    },
  },

  mensajes_conversacion_instagram: {
    leer: async (input) => {
      const id = num(input, 'conversacionId')!;
      const conv = await leerConversacionIg(id);
      if (!conv) return error(`No existe la conversación #${id} en este workspace (usa listar_conversaciones_instagram).`);
      const limite = num(input, 'limite') ?? 60;
      const { filas, total } = await mensajesRecientesIg(id, limite);
      return json({
        conversacionId: id,
        usuario: conv.username ? `@${conv.username}` : null,
        ventana_abierta: ventanaVigente(conv.ventana_expira_at),
        ventana_expira_at: conv.ventana_expira_at,
        total_mensajes: total,
        devueltos: filas.length,
        ...(total != null && total > filas.length ? { recorte: `Se muestran los ${filas.length} más recientes; ${total - filas.length} más viejos quedaron afuera.` } : {}),
        mensajes: filas.map((m) => ({
          id: m.id,
          de: m.direccion === 'entrante' ? 'lead' : 'negocio',
          estado: m.estado,
          texto: m.texto,
          adjuntos: Array.isArray(m.adjuntos) ? (m.adjuntos as Array<{ type?: string }>).map((a) => a?.type ?? 'archivo') : [],
          nota_o_error: m.error,
          at: m.created_at,
        })),
      });
    },
  },

  conversaciones_inbox_zernio: {
    leer: async (input, ctx) => {
      const cuenta = await cuentaDelWs(ctx.ws);
      if ('error' in cuenta) return error(cuenta.error);
      const status = str(input, 'status') as 'active' | 'archived' | null;
      const r = await listConversations(ctx.ws, {
        accountId: cuenta.id, platform: 'instagram',
        ...(status ? { status } : {}),
        limit: num(input, 'limite') ?? 30,
        ...(str(input, 'cursor') ? { cursor: str(input, 'cursor')! } : {}),
      });
      const locales = await localesPorZernioId(r.data.map((c) => c.id));
      return json({
        cuenta: `@${cuenta.username}`,
        devueltas: r.data.length,
        hay_mas: r.pagination?.hasMore ?? false,
        siguiente_cursor: r.pagination?.nextCursor ?? null,
        conversaciones: r.data.map((c) => ({
          conversacionId: locales.get(c.id) ?? null,
          participante: c.participantName ?? null,
          ultimo_mensaje: recorta(c.lastMessage ?? null, 200),
          actualizada_at: c.updatedTime ?? null,
          no_leidos: c.unreadCount ?? null,
          sigue_a_la_cuenta: c.instagramProfile?.isFollower ?? null,
          estado: c.status ?? null,
        })),
        nota: 'conversacionId null = la conversación no está en el espejo local (suele ser historia anterior a conectar la cuenta); sus mensajes no se pueden leer por mensajes_conversacion_zernio. no_leidos null = Zernio no lo informó, no es 0.',
      });
    },
  },

  mensajes_conversacion_zernio: {
    leer: async (input, ctx) => {
      const id = num(input, 'conversacionId')!;
      const conv = await leerConversacionIg(id);
      if (!conv) return error(`No existe la conversación #${id} en este workspace (usa listar_conversaciones_instagram).`);
      if (!conv.zernio_conversation_id || !conv.zernio_account_id) return error('Esa conversación no tiene los ids de Zernio para leerla en vivo.');
      // La decisión de Zernio ya está tomada si hay conversaciones espejadas; igual
      // se exige, para no llamar a la API por un workspace sin resolver.
      if (!(await estadoZernioIg(ctx.ws)).resuelto) return error('Instagram no está configurado: falta el paso «Conexión con Zernio» en /instagram.');
      const r = await getConversation(ctx.ws, conv.zernio_conversation_id, conv.zernio_account_id, {
        limit: num(input, 'limite') ?? 30,
        ...(str(input, 'cursor') ? { cursor: str(input, 'cursor')! } : {}),
      });
      return json({
        conversacionId: id,
        usuario: conv.username ? `@${conv.username}` : null,
        devueltos: r.messages.length,
        orden: r.sortOrderApplied ?? null,
        hay_mas: r.pagination?.hasMore ?? false,
        siguiente_cursor: r.pagination?.nextCursor ?? null,
        mensajes: r.messages.map((m) => ({
          de: m.direction === 'incoming' ? 'lead' : 'negocio',
          texto: m.message ?? null,
          at: m.createdAt ?? null,
          entrega: m.deliveryStatus ?? null,
          error_entrega: m.deliveryError?.message ?? null,
          adjuntos: (m.attachments ?? []).map((a) => ({ tipo: a.type ?? null, nombre: a.filename ?? null, enlace_renovable: a.refreshUrl ?? null })),
          reacciones: (m.reactions ?? []).map((x) => x.emoji).filter(Boolean),
          respuesta_a_story: m.storyReply ?? null,
        })),
        nota: 'enlace_renovable es lo único estable de un adjunto: la URL directa de Meta vence. Leer esto no marca nada como leído.',
      });
    },
  },

  // ── publicaciones ──

  listar_publicaciones_instagram: {
    leer: async (input) => {
      const todas = await listarPublicaciones();
      const estado = str(input, 'estado');
      const tipo = str(input, 'tipo');
      const limite = num(input, 'limite') ?? 30;
      const lista = todas.filter((p) => (!estado || p.estado === estado) && (!tipo || p.tipo === tipo));
      const devueltas = lista.slice(0, limite);
      if (!devueltas.length) {
        return todas.length ? 'Ninguna publicación cumple el filtro (entre las 100 más recientes).' : 'No hay publicaciones de Instagram todavía.';
      }
      return json({
        leidas: todas.length,
        tope_leidas: 100,
        coinciden: lista.length,
        devueltas: devueltas.length,
        publicaciones: devueltas.map((p) => ({
          publicacionId: p.id,
          tipo: p.tipo,
          estado: p.estado,
          caption: recorta(p.caption, 300),
          caption_caracteres: p.caption?.length ?? 0,
          media_archivos: p.media.length,
          media: p.media.slice(0, 10).map((m) => ({ path: m.path, tipo: m.mime })),
          programado_at: p.programadoAt,
          publicado_at: p.publicadoAt,
          en_zernio: !!p.zernioPostId,
          error: p.error,
          creada_at: p.createdAt,
        })),
        notas: [
          todas.length >= 100 ? 'El filtro corre sobre las 100 publicaciones más recientes por fecha de creación: puede haber más viejas.' : null,
          'Las fechas son UTC (ISO). Un borrador que vino de Reels, Carousels o Stories puede traer anexadas las notas de producción en la caption.',
        ].filter(Boolean),
      });
    },
  },

  estado_publicacion_zernio: {
    leer: async (input, ctx) => {
      const id = num(input, 'publicacionId')!;
      const fila = await leerPublicacionIg(id);
      if (!fila) return error(`No existe la publicación #${id} en este workspace (usa listar_publicaciones_instagram).`);
      if (!fila.zernio_post_id) return error(`La publicación #${id} está en estado «${fila.estado}» y nunca se mandó a Zernio: no tiene estado vivo.`);
      const post = await getPost(ctx.ws, fila.zernio_post_id);
      return json({
        publicacionId: id,
        estado_local: fila.estado,
        estado_zernio: post.status,
        programado_para: post.scheduledFor ?? null,
        plataformas: (post.platforms ?? []).map((p) => ({
          plataforma: p.platform, estado: p.status ?? null, publicado_at: p.publishedAt ?? null, enlace: p.platformPostUrl ?? null,
        })),
        nota: 'Si estado_local está en publicando o programado y no coincide con estado_zernio, refrescar_publicacion_instagram deja la fila al día. Zernio no trae el motivo de un fallo en esta lectura.',
      });
    },
  },

  preview_media_instagram: {
    leer: async (input, ctx) => {
      const path = str(input, 'path')!;
      const url = await firmarPreview(ctx.ws, path);
      if (!url) return error('No se pudo generar el enlace: el path no es de este workspace o el archivo no existe.');
      return json({ path, url, vence_en_seg: 300, nota: 'El enlace vence en 5 minutos: no lo guardes, pide uno nuevo cuando haga falta.' });
    },
  },

  // ── acciones: DMs ──

  generar_borrador_dm_instagram: {
    preparar: async (input): Promise<Preparado> => {
      const id = num(input, 'conversacionId')!;
      const conv = await leerConversacionIg(id);
      if (!conv) return { error: `No existe la conversación #${id} en este workspace (usa listar_conversaciones_instagram).` };
      const ultimo = await ultimoMensajeRealIg(id);
      if (!ultimo || ultimo.direccion !== 'entrante') {
        return { error: 'El último mensaje de esa conversación no es del lead: no hay nada que responder.' };
      }
      if ((await igAutoRespuestaHabilitada()) && ventanaVigente(conv.ventana_expira_at)) {
        return { error: SALE_SOLA };
      }
      return {
        payload: { conversacionId: id },
        resumen: `Redactar un borrador de respuesta a ${quien(conv.username)} por Instagram (reemplaza el borrador pendiente si había uno); queda en la bandeja sin enviarse.`,
      };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const id = Number(payload.conversacionId);
      // Se vuelve a mirar al confirmar: entre la propuesta y el «sí» (hasta 2 h) alguien
      // pudo prender la auto-respuesta o un DM nuevo pudo abrir la ventana, y entonces
      // generarBorradorIg ENVIARÍA un texto que nadie leyó. Queda una carrera de
      // segundos (la lib relee el flag después de redactar) porque generarBorradorIg
      // no tiene una opción de «no enviar».
      const conv = await leerConversacionIg(id);
      if (!conv) return { ok: false, resumen: `La conversación #${id} ya no existe en este workspace.` };
      if ((await igAutoRespuestaHabilitada()) && ventanaVigente(conv.ventana_expira_at)) {
        return { ok: false, resumen: SALE_SOLA };
      }
      const r = await generarBorradorIg(ctx.ws, id);
      if (!r.ok) return { ok: false, resumen: `MaKo no redactó la respuesta: ${r.motivo}.` };
      return {
        ok: true,
        resumen: r.enviado
          ? 'Listo: redacté la respuesta y se envió sola (auto-respuesta prendida).'
          : 'Listo: el borrador quedó en la bandeja de /instagram para que alguien lo revise y lo envíe.',
        datos: { borradorId: r.borradorId, enviado: r.enviado },
      };
    },
  },

  editar_borrador_dm_instagram: {
    preparar: async (input): Promise<Preparado> => {
      const id = num(input, 'borradorId')!;
      const texto = str(input, 'texto');
      if (!texto) return { error: 'El texto nuevo no puede estar vacío.', faltan: ['texto'] };
      const b = await leerBorradorIg(id);
      if (!b) return { error: `No existe el mensaje #${id} en este workspace.` };
      if (b.estado !== 'borrador') return { error: `El mensaje #${id} ya no es un borrador (está «${b.estado}»).` };
      const conv = await leerConversacionIg(b.conversacion_id);
      return {
        payload: { borradorId: id, texto },
        resumen: `Cambiar el borrador para ${quien(conv?.username)} por: «${texto}»`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const ok = await editarBorradorIg(Number(payload.borradorId), String(payload.texto));
      return ok
        ? { ok: true, resumen: 'Borrador corregido; sigue esperando que alguien lo envíe.' }
        : { ok: false, resumen: 'Ese borrador ya no está pendiente (se envió o se descartó).' };
    },
  },

  descartar_borrador_dm_instagram: {
    preparar: async (input): Promise<Preparado> => {
      const id = num(input, 'borradorId')!;
      const b = await leerBorradorIg(id);
      if (!b) return { error: `No existe el mensaje #${id} en este workspace.` };
      if (b.estado !== 'borrador') return { error: `El mensaje #${id} no es un borrador (está «${b.estado}») y no se descarta.` };
      const conv = await leerConversacionIg(b.conversacion_id);
      return { payload: { borradorId: id }, resumen: `Descartar el borrador para ${quien(conv?.username)}: «${recorta(b.texto, 200) ?? ''}»` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const ok = await descartarBorradorIg(Number(payload.borradorId));
      return ok
        ? { ok: true, resumen: 'Borrador descartado.' }
        : { ok: false, resumen: 'Ese borrador ya no existe (se envió o se descartó antes).' };
    },
  },

  enviar_borrador_dm_instagram: {
    // proponer() propio: el TEXTO lo fija el código en la propuesta, no el modelo.
    // La pantalla genérica guarda el input y al confirmar vuelve a correr preparar();
    // si el input no traía `texto`, preparar leería el texto ACTUAL de la base, que
    // generarBorradorIg reescribe con cada DM que entra: saldría un texto que nadie vio.
    proponer: async (input, ctx): Promise<Propuesto> => {
      const def = porId('enviar_borrador_dm_instagram');
      if (!def || !esAccion(def)) return { error: 'La operación enviar_borrador_dm_instagram no está registrada.' };
      const id = num(input, 'borradorId')!;
      const v = await validarEnvio(id);
      if ('error' in v) return { error: v.error };
      const texto = str(input, 'texto') ?? v.textoBorrador;
      if (!texto) return { error: 'El borrador no tiene texto: pasa el mensaje en «texto».' };
      const p = await proponerPantallaGenerica(def, { borradorId: id, texto }, resumenEnvio(v.username, texto), ctx, null);
      return p.propuesta;
    },
    // Corre al CONFIRMAR, con el input guardado (y quizá editado en la pantalla).
    preparar: async (input): Promise<Preparado> => {
      const id = num(input, 'borradorId')!;
      const v = await validarEnvio(id);
      if ('error' in v) return { error: v.error };
      const texto = str(input, 'texto');
      if (!texto) return { error: 'El texto del DM no puede estar vacío: escribe el mensaje.', faltan: ['texto'] };
      return { payload: { borradorId: id, texto }, resumen: resumenEnvio(v.username, texto) };
    },
    ejecutar: async (payload, ctx: Ctx): Promise<Ejecutado> => {
      const id = Number(payload.borradorId);
      const texto = typeof payload.texto === 'string' ? payload.texto.trim() : '';
      if (!texto) return { ok: false, resumen: 'No se envió: falta el texto confirmado.' };
      // Se escribe el texto que la persona confirmó y recién después se envía.
      const ok = await editarBorradorIg(id, texto);
      if (!ok) return { ok: false, resumen: 'Ese borrador ya no está pendiente (otro envío o un descarte llegó primero).' };
      // Sin permitirFueraDeVentana: si la ventana se cerró entre la propuesta y el
      // clic, la lib se niega y el envío pasa a la bandeja de /instagram.
      const r = await enviarBorradorIg(id, ctx.actor ?? `api-mako:${ctx.canal}`);
      if (!r.ok) return { ok: false, resumen: `No se envió: ${r.error}` };
      return { ok: true, resumen: 'DM enviado por Instagram.', datos: { borradorId: id, messageId: r.messageId } };
    },
  },

  // ── acciones: publicaciones ──

  crear_borrador_publicacion_instagram: {
    preparar: async (input): Promise<Preparado> => {
      const tipo = str(input, 'tipo') as 'reel' | 'carrusel' | 'story' | null;
      const caption = str(input, 'caption');
      if (!tipo) return { error: 'Falta el formato (reel, carrusel o story).', faltan: ['tipo'] };
      if (!caption) return { error: 'Falta la caption.', faltan: ['caption'] };
      const notas = str(input, 'notas');
      return {
        payload: { tipo, caption, ...(notas ? { notas } : {}) },
        resumen: `Guardar un ${tipo} como borrador en /instagram: «${recorta(caption, 200)}»${notas ? ' (con notas de producción)' : ''}`,
      };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const r = await crearBorradorPublicacion(ctx.ws, {
        tipo: payload.tipo as 'reel' | 'carrusel' | 'story',
        caption: String(payload.caption ?? ''),
        ...(typeof payload.notas === 'string' ? { notas: payload.notas } : {}),
      });
      if (!r.ok) return { ok: false, resumen: r.error };
      return { ok: true, resumen: `Borrador guardado en /instagram (#${r.id}). La media y la fecha se completan ahí.`, datos: { publicacionId: r.id, href: r.href } };
    },
  },

  cancelar_programacion_instagram: {
    preparar: async (input, ctx): Promise<Preparado> => {
      const id = num(input, 'publicacionId')!;
      const p = await leerPublicacionIg(id);
      if (!p) return { error: `No existe la publicación #${id} en este workspace.` };
      if (p.estado !== 'programado' || !p.zernio_post_id) return { error: `La publicación #${id} no está programada (está «${p.estado}»): no hay nada que cancelar.` };
      const cuando = p.programado_at ? fmtFecha(p.programado_at, await tzDeWorkspace(ctx.ws)) : '(sin fecha)';
      return {
        payload: { publicacionId: id },
        resumen: `Cancelar el ${p.tipo} programado para el ${cuando}: «${recorta(p.caption, 120) ?? 'sin caption'}». Queda como borrador, y para volver a programarlo hay que armar el post de nuevo en /instagram.`,
      };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const r = await cancelarProgramacionIg(ctx.ws, Number(payload.publicacionId));
      return r.ok ? { ok: true, resumen: 'Publicación cancelada: ya no sale y quedó como borrador.' } : { ok: false, resumen: r.error ?? 'No se pudo cancelar.' };
    },
  },

  refrescar_publicacion_instagram: {
    preparar: async (input): Promise<Preparado> => {
      const id = num(input, 'publicacionId')!;
      const p = await leerPublicacionIg(id);
      if (!p) return { error: `No existe la publicación #${id} en este workspace.` };
      if (!p.zernio_post_id) return { error: `La publicación #${id} nunca se mandó a Zernio (está «${p.estado}»): no hay estado que sincronizar.` };
      if (p.estado !== 'publicando' && p.estado !== 'programado') {
        return { error: `La publicación #${id} está «${p.estado}»: solo se sincronizan las que siguen en publicando o programado. Para mirar su estado vivo usa estado_publicacion_zernio.` };
      }
      return { payload: { publicacionId: id }, resumen: `Sincronizar con Zernio el estado del ${p.tipo} #${id} (hoy figura «${p.estado}»).` };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const r = await sincronizarPublicacionIg(ctx.ws, Number(payload.publicacionId));
      return r.ok ? { ok: true, resumen: `Estado actualizado: ${r.estado}.`, datos: { estado: r.estado } } : { ok: false, resumen: r.error };
    },
  },

  // ── acciones: configuración ──

  // Dos operaciones y no un booleano: en /mako/revisar el título es el resumen que se
  // guardó al proponer, y una casilla editable dejaba ejecutar PRENDER bajo un título
  // que decía APAGAR, sin el aviso del ensayo.
  prender_auto_respuesta_instagram: {
    preparar: async (): Promise<Preparado> => {
      const [actual, tab] = await Promise.all([igAutoRespuestaHabilitada(), getEstadoTab(TAB)]);
      if (actual) return { error: 'La respuesta automática ya está prendida.' };
      const aviso = !tab.steps.ig_ensayo?.done ? ' Ojo: el ensayo de respuesta del onboarding no está hecho; nadie vio todavía una respuesta de MaKo.' : '';
      return {
        payload: { on: true },
        resumen: `PRENDER la respuesta automática de Instagram: MaKo enviará sola la respuesta a cada DM mientras la ventana de 24 h esté abierta.${aviso}`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      if (payload.on !== true) return { ok: false, resumen: 'La propuesta no es de prender: no se tocó nada.' };
      await setSetting(KEY_IG_AUTO_RESPUESTA, 'true');
      return { ok: true, resumen: 'Respuesta automática de Instagram prendida.' };
    },
  },

  apagar_auto_respuesta_instagram: {
    preparar: async (): Promise<Preparado> => {
      if (!(await igAutoRespuestaHabilitada())) return { error: 'La respuesta automática ya está apagada.' };
      return { payload: { on: false }, resumen: 'APAGAR la respuesta automática de Instagram: cada borrador esperará que una persona lo envíe.' };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      if (payload.on !== false) return { ok: false, resumen: 'La propuesta no es de apagar: no se tocó nada.' };
      await setSetting(KEY_IG_AUTO_RESPUESTA, 'false');
      return { ok: true, resumen: 'Respuesta automática de Instagram apagada.' };
    },
  },

  marcar_paso_onboarding_instagram: {
    preparar: async (input): Promise<Preparado> => {
      const paso = str(input, 'paso');
      if (paso !== 'ig_contexto') return { error: 'Desde aquí solo se marca el paso ig_contexto.' };
      const def = tabOnboardingDef(TAB);
      const estado = await getEstadoTab(TAB);
      if (estado.steps[paso]?.done) return { error: 'El paso «Contexto del negocio» ya está hecho.' };
      const falta = def ? pasoBloqueadoPor(def.pasos, estado.steps, paso) : null;
      if (falta) {
        const label = def?.pasos.find((p) => p.key === falta)?.label ?? falta;
        return { error: `Antes de este paso falta completar «${label}» en /instagram.` };
      }
      return { payload: { paso }, resumen: 'Dar por hecho el paso «Contexto del negocio» del onboarding de Instagram.' };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      await marcarPasoTab(TAB, String(payload.paso));
      return { ok: true, resumen: 'Paso «Contexto del negocio» marcado como hecho.' };
    },
  },
};
