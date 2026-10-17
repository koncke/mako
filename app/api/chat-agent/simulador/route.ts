// =============================================================================
// API: el «Probar» de /automations — el panel que recorre el flujo que se está editando
// =============================================================================
// GET  ?grupo=1[&evento=1] → { hay, nombre, deCadaNegocio? }: el grupo de WhatsApp de MaKo de ESTE negocio, con su
//      nombre REAL (16/10/2026, lib/probar-grupo.ts: el primer contacto de «Probar»). Sólo se LEE: «Probar» nunca le
//      escribe. `evento=1` en SuperAdmin: la fila de un evento le escribe al grupo de CADA negocio, no hay un nombre.
//      Admin y setter. `nombre: null` = no se pudo leer (no es «no tiene»: eso es `hay: false`).
// GET  ?destino=1 → { telefono, email, telefonos, emails }: lo de la PERSONA que mira (su fila de
//      `usuarios`): su teléfono y su email, y los que guardó para probar (`destinosGuardados`). Sólo admin.
//      ⚠️ Antes era el contacto de reportes del WORKSPACE: con el super admin mirando a un cliente,
//      la prueba le llegaba al cliente (revisión adversarial del 08/10/2026, lienzo-3).
// POST { action: 'guardar-destino', destino: { telefono } | { email } } → { telefonos, emails }
//      Suma un «Nuevo número» / «Nuevo email» a los guardados de ESA persona (quinta tanda, punto 1),
//      en SU fila. Nunca en el workspace.
// POST { action: 'clasificar', pasos, mensaje? | audioBase64? } → { casoId, titulo, transcript? }
//      Clasifica la respuesta del lead contra los casos de «Si responde» LOCALES (los que se ven
//      en el lienzo, sin publicar), con el MISMO clasificador del motor (`clasificarEscenario`).
// POST { action: 'responder', secuenciaId, historial, escenario } → { respuesta }
//      Redacta un «MaKo contesta» con el redactor del motor (`responderSimulador`) y el caso
//      LOCAL como guía.
// POST { action: 'mensaje-lead', titulo, cuando, ultimo } → { mensaje }
//      Lo que ESCRIBE el lead de un escenario que contesta (15/10/2026, lib/probar-lead.ts): un mensaje que cae en ese
//      caso del AI Step. Siempre ok: sin IA, el «cuándo» del caso.
// POST { action: 'enviar-real', secuenciaId, destino, mensaje, primero, emisor? } → { enviados }
//      Manda DE VERDAD un mensaje que apareció en el panel (lib/prueba-paso.ts). Sólo admin, con
//      tope por (workspace, destino): 10 mensajes cada 10 minutos. `emisor` (sexta tanda): `{ linea }`
//      (WhatsApp; '' = la de por default) o `{ remitente }` (email). Ausente = el de siempre.
// POST { action: 'enviar-grupo', secuenciaId, partes, caso } → { salieron } (17/10/2026, #852)
//      «Probar en el grupo»: una automatización que SÓLO le habla al grupo de MaKo se prueba en el grupo de verdad, con
//      un encabezado de prueba (lib/probar-grupo-envio.ts). Sólo admin, con tope por negocio.
// POST { secuenciaId, historial, audioBase64? } (sin action) → { respuesta, desenlace }
//      El setter libre de antes. Queda por compatibilidad; el panel nuevo no lo usa.
//
// Sandbox salvo 'enviar-real': no inscribe, no guarda, no toca métricas. Admin y setter (el
// setter entrena con el simulador; no puede editar ni mandar de verdad).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual, wsSuperAdmin } from '@/lib/workspace';
import { getGrupoJidMaKo } from '@/lib/mako-grupo';
import { infoGrupoMaKo } from '@/lib/mako-chat';
import { responderSimulador, type TurnoSim } from '@/lib/setting-simulador';
import { transcribirAudio } from '@/lib/ai-cheap';
import { clasificarEscenario } from '@/lib/chat-agent-handoff';
import { getUsuarioActual } from '@/lib/auth';
import { buscarUsuarioPorEmail } from '@/lib/usuarios';
import { escenariosDeRespuesta, normalizar, TOPE_NODOS, TOPE_GUIA, TOPE_OBJETIVO, TOPE_EJEMPLO, TOPE_EJEMPLOS, type PasoGrafo } from '@/lib/flujo-grafo';
import { destinoDelQueMira, destinosGuardados, sanearDestinoPrueba, sanearMensajePrueba, sanearEmisorPrueba } from '@/lib/simulador-grafo';
import { enviarPasoDePrueba, guardarDestinoDeQuienPrueba } from '@/lib/prueba-paso';
import { enviarPruebaAlGrupo } from '@/lib/probar-grupo-envio';
import { rateLimit } from '@/lib/rate-limit';
import { chatCheapCascade } from '@/lib/ai-cheap';
import { getPromptText } from '@/lib/prompt-render';
import { MENSAJE_LEAD_SYSTEM_TEMPLATE, userMensajeLead, mensajeLeadDe } from '@/lib/probar-lead';
import type { EscenarioSecuencia } from '@/lib/setting-estrategia';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const json = (body: Record<string, unknown>, status = 200) => Response.json(body, { status });

async function acceso(): Promise<{ ws: number; rol: string } | null> {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || (rol !== 'admin' && rol !== 'setter')) return null;
  return { ws, rol: String(rol) };
}

const SIN_ACCESO = { ok: false, error: 'Sin acceso al simulador en este workspace.' };

function historialDe(raw: unknown): TurnoSim[] {
  return Array.isArray(raw)
    ? (raw as Array<Record<string, unknown>>)
        .filter((t) => (t?.de === 'lead' || t?.de === 'negocio') && typeof t?.texto === 'string' && (t.texto as string).trim())
        .map((t) => ({ de: t.de as 'lead' | 'negocio', texto: String(t.texto) }))
    : [];
}

/** Los pasos LOCALES que manda el panel. Un tope por las dudas: lo valida el flujo, no esto. */
function pasosDe(raw: unknown): PasoGrafo[] | null {
  if (!Array.isArray(raw) || raw.length > TOPE_NODOS * 2) return null;
  if (!raw.every((p) => p && typeof p === 'object' && !Array.isArray(p))) return null;
  return normalizar(raw as PasoGrafo[]);
}

async function transcribir(body: Record<string, unknown>): Promise<{ texto: string } | { error: string }> {
  if (typeof body.audioBase64 !== 'string' || !body.audioBase64) return { texto: '' };
  if (body.audioBase64.length > 8_000_000) return { error: 'El audio es muy largo para el simulador.' };
  const t = (await transcribirAudio(body.audioBase64, typeof body.audioMime === 'string' && body.audioMime ? body.audioMime : 'audio/mpeg')).trim();
  return t ? { texto: t } : { error: 'No entendí el audio — prueba de nuevo o escríbelo.' };
}

/** Cuánto se espera a WhatsApp por el nombre del grupo: sin él, el contacto dice «Grupo de MaKo» y la prueba sigue. */
const PLAZO_GRUPO_MS = 8000;

/** El grupo de MaKo del negocio, para el primer contacto de «Probar» (`nombreDelGrupo`, lib/probar-grupo.ts). */
async function grupoDelNegocio(ws: number, deUnEvento: boolean): Promise<Record<string, unknown>> {
  try {
    if (deUnEvento && ws === (await wsSuperAdmin().catch(() => -1))) return { ok: true, hay: true, nombre: null, deCadaNegocio: true };
    const jid = await getGrupoJidMaKo(ws);
    if (!jid) return { ok: true, hay: false, nombre: null };
    const info = await Promise.race([
      infoGrupoMaKo(jid).catch(() => null),
      new Promise<null>((r) => { setTimeout(() => r(null), PLAZO_GRUPO_MS); }),
    ]);
    return { ok: true, hay: true, nombre: info?.subject?.trim() || null };
  } catch (e) {
    console.error(`[api:chat-agent/simulador GET grupo] ${msg(e)}`);
    return { ok: false, error: 'No pude leer el grupo.' };
  }
}

export async function GET(req: NextRequest) {
  const a = await acceso();
  if (!a) return json(SIN_ACCESO, 403);
  const q = req.nextUrl.searchParams;
  if (q.get('grupo') === '1') return json(await grupoDelNegocio(a.ws, q.get('evento') === '1'));
  if (q.get('destino') !== '1') return json({ ok: false, error: 'pedido inválido' }, 400);
  // «Mandar a mi WhatsApp» le escribe a un número real: el destino sólo lo ve el admin.
  if (a.rol !== 'admin') return json({ ok: false, error: 'Solo el admin prueba de verdad.' }, 403);
  try {
    // La PERSONA, no el negocio: «A mi WhatsApp» tiene que ser de quien prueba. Ni siquiera el
    // perfil «viendo como cliente» de lib/perfil.ts (`getPerfil`): ése devuelve el del admin del
    // cliente, que es justo a quien no hay que escribirle. Sin fila propia, vacío.
    const sesion = await getUsuarioActual();
    const propia = sesion?.email ? await buscarUsuarioPorEmail(sesion.email) : null;
    const d = destinoDelQueMira(propia);
    // Los GUARDADOS de esa misma persona (quinta tanda, punto 1): el desplegable de «Probar en
    // WhatsApp / Email» los ofrece primero. Su teléfono y su email de siempre van adelante.
    const g = destinosGuardados(propia);
    return json({ ok: true, telefono: d.telefono, email: d.email, telefonos: g.telefonos, emails: g.emails });
  } catch (e) {
    console.error(`[api:chat-agent/simulador GET] ${msg(e)}`);
    return json({ ok: false, error: 'No pude leer tu contacto.' }, 500);
  }
}

export async function POST(req: NextRequest) {
  const a = await acceso();
  if (!a) return json(SIN_ACCESO, 403);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ ok: false, error: 'body inválido' }, 400); }

  try {
    // ── Clasificar la respuesta contra los casos LOCALES ──────────────────────
    if (body.action === 'clasificar') {
      const pasos = pasosDe(body.pasos);
      if (!pasos) return json({ ok: false, error: 'flujo inválido' }, 400);
      const t = await transcribir(body);
      if ('error' in t) return json({ ok: false, error: t.error }, 400);
      const mensaje = t.texto || (typeof body.mensaje === 'string' ? body.mensaje : '');
      // Llegan como se ven en el lienzo (un AI Step, compacto): `escenariosDeRespuesta` lo expande adentro
      // (`expandirPasoIA`, novena tanda), así la guía y «sale sola» de cada caso son las que lee el motor. Con el
      // MEDIO de la prueba (TikTok fase 0, 14/10/2026): por Instagram, los casos del AI Step de Instagram.
      const medio = body.medio === 'instagram' || body.medio === 'messenger' ? body.medio : undefined;
      const casos = escenariosDeRespuesta(pasos, { medio });
      // La forma del clasificador de siempre. Se busca el caso por REFERENCIA: el clasificador
      // devuelve el mismo objeto que se le pasó, así que no hace falta comparar títulos (dos casos
      // pueden llamarse igual).
      const escenarios: EscenarioSecuencia[] = casos.map((c) => ({
        titulo: c.titulo, cuando: c.cuando, comoResponder: c.comoResponder, ...(c.contestaSolo ? { contestaSolo: true } : {}),
      }));
      // Con la red de plataforma, como en vivo (AGENTS.md: todo camino de IA que use un cliente necesita su red).
      const r = await clasificarEscenario(mensaje, escenarios, { redDePlataforma: true });
      const i = r.encaja ? escenarios.indexOf(r.escenario) : -1;
      return json({
        ok: true,
        casoId: i >= 0 ? casos[i].casoId : null,
        titulo: i >= 0 ? casos[i].titulo : null,
        ...(t.texto ? { transcript: t.texto } : {}),
      });
    }

    // ── Redactar un «MaKo contesta» con el caso LOCAL ────────────────────────
    if (body.action === 'responder') {
      const id = Number(body.secuenciaId);
      if (!Number.isFinite(id)) return json({ ok: false, error: 'secuenciaId inválido' }, 400);
      const historial = historialDe(body.historial);
      if (!historial.length) return json({ ok: false, error: 'Escribe un mensaje como el lead primero.' }, 400);
      const e = (body.escenario && typeof body.escenario === 'object' ? body.escenario : {}) as Record<string, unknown>;
      const escenario: EscenarioSecuencia = {
        titulo: String(e.titulo ?? '').slice(0, 200) || 'Otra cosa',
        cuando: String(e.cuando ?? '').slice(0, 1000),
        // El tope es el de la guía de un AI Step (`TOPE_GUIA`): con 2000 «Probar» le cortaba la respuesta
        // del caso a un tono largo y contestaba distinto que el motor (revisión de la novena tanda).
        comoResponder: String(e.comoResponder ?? '').slice(0, TOPE_GUIA),
        // AI Step v2 (décima tanda): lo del caso que el redactor del motor también recibe (`escenarioParaRedactar`).
        ...(typeof e.objetivo === 'string' && e.objetivo.trim() ? { objetivo: e.objetivo.trim().slice(0, TOPE_OBJETIVO) } : {}),
        ...(Array.isArray(e.ejemplos) ? { ejemplos: (e.ejemplos as Array<Record<string, unknown>>).flatMap((x) => (typeof x?.lead === 'string' && typeof x?.tu === 'string' ? [{ lead: x.lead.slice(0, TOPE_EJEMPLO), tu: x.tu.slice(0, TOPE_EJEMPLO) }] : [])).slice(0, TOPE_EJEMPLOS) } : {}),
        ...(e.audio && typeof e.audio === 'object' ? { audio: { voz: 'propia' } } : {}),
      };
      // ⚠️ `responderSimulador` lee de lo GUARDADO el nombre, el objetivo, el gancho y las
      // preguntas de la secuencia; lo que se edita en el lienzo (el caso y su guía) viaja acá.
      const r = await responderSimulador(id, historial, { escenario, redDePlataforma: true });
      if (!r.ok) return json({ ok: false, error: r.error }, 400);
      return json({ ok: true, respuesta: r.respuesta });
    }

    // ── Lo que escribe el lead de un escenario que contesta (15/10/2026) ──────
    if (body.action === 'mensaje-lead') {
      const caso = { titulo: String(body.titulo ?? '').slice(0, 200), cuando: String(body.cuando ?? '').slice(0, 1000) };
      const system = await getPromptText('automations.probar.lead', MENSAJE_LEAD_SYSTEM_TEMPLATE);
      // La cascada gratis con la red de plataforma (AGENTS.md: todo camino de IA que use un cliente necesita su red). Si
      // no contesta, el «cuándo» del caso: la prueba sigue igual.
      const raw = await chatCheapCascade({
        system, user: userMensajeLead({ ...caso, ultimo: String(body.ultimo ?? '') }), json: true, maxTokens: 150, temperature: 0.8,
        feature: 'setting-simulador', motivo: 'Probar: lo que escribe el lead', redDePlataforma: true,
      }).catch((e) => { console.error(`[api:chat-agent/simulador mensaje-lead] ${msg(e)}`); return ''; });
      return json({ ok: true, mensaje: mensajeLeadDe(raw, caso) });
    }

    // ── Mandar DE VERDAD un mensaje que apareció en el panel ──────────────────
    if (body.action === 'enviar-real') {
      if (a.rol !== 'admin') return json({ ok: false, error: 'Solo el admin prueba de verdad.' }, 403);
      const id = Number(body.secuenciaId);
      if (!Number.isFinite(id)) return json({ ok: false, error: 'secuenciaId inválido' }, 400);
      const mensaje = sanearMensajePrueba(body.mensaje);
      if (!mensaje) return json({ ok: false, error: 'mensaje inválido' }, 400);
      // El destino es de ESTA prueba: se usa y se olvida (ver lib/prueba-paso.ts).
      const destino = sanearDestinoPrueba(body.destino);
      // El EMISOR (sexta tanda): un pedido; la línea y el remitente los vuelve a validar el envío.
      const emisor = sanearEmisorPrueba(body.emisor);
      const r = await enviarPasoDePrueba({ ws: a.ws, secuenciaId: id, destino, mensaje, primero: body.primero === true, emisor });
      return r.ok ? json({ ok: true, enviados: r.enviados }) : json({ ok: false, error: r.error }, 400);
    }

    // ── «Probar en el grupo» (17/10/2026, #852): la tarjeta MaKo de una automatización que sólo le habla al grupo ──
    if (body.action === 'enviar-grupo') {
      if (a.rol !== 'admin') return json({ ok: false, error: 'Solo el admin prueba de verdad.' }, 403);
      // Es el grupo del equipo: un tope por negocio, como el de «Probar en WhatsApp» por destino.
      if (!rateLimit(`probar-grupo:${a.ws}`, 12, 10 * 60_000)) return json({ ok: false, error: 'Muchas pruebas seguidas al grupo: espera unos minutos.' }, 429);
      const r = await enviarPruebaAlGrupo({ ws: a.ws, secuenciaId: Number(body.secuenciaId), partes: body.partes, caso: body.caso });
      return r.ok ? json({ ok: true, salieron: r.salieron }) : json({ ok: false, error: r.error }, 400);
    }

    // ── Guardar un «Nuevo número» / «Nuevo email» en los de QUIEN PRUEBA ───────
    if (body.action === 'guardar-destino') {
      if (a.rol !== 'admin') return json({ ok: false, error: 'Solo el admin prueba de verdad.' }, 403);
      const sesion = await getUsuarioActual();
      const r = sesion?.email ? await guardarDestinoDeQuienPrueba(sesion.email, body.destino) : { ok: false as const, error: 'Sin usuario propio' };
      return r.ok ? json({ ok: true, telefonos: r.guardados.telefonos, emails: r.guardados.emails }) : json({ ok: false, error: r.error }, 400);
    }

    // ── El setter libre de antes (sin action) ───────────────────────────────
    const id = Number(body.secuenciaId);
    if (!Number.isFinite(id)) return json({ ok: false, error: 'secuenciaId inválido' }, 400);
    const historial = historialDe(body.historial);
    const t = await transcribir(body);
    if ('error' in t) return json({ ok: false, error: t.error }, 400);
    if (t.texto) historial.push({ de: 'lead', texto: t.texto });
    if (!historial.length) return json({ ok: false, error: 'Escribe un mensaje como el lead primero.' }, 400);
    const r = await responderSimulador(id, historial, { redDePlataforma: true });
    if (!r.ok) return json({ ok: false, error: r.error }, 400);
    return json({ ok: true, respuesta: r.respuesta, desenlace: r.desenlace, ...(t.texto ? { transcript: t.texto } : {}) });
  } catch (e) {
    console.error(`[api:chat-agent/simulador POST] ${msg(e)}`);
    return json({ ok: false, error: msg(e) }, 500);
  }
}
