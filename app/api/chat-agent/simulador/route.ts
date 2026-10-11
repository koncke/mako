// =============================================================================
// API: el «Probar» de /automations — el panel que recorre el flujo que se está editando
// =============================================================================
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
// POST { action: 'enviar-real', secuenciaId, destino, mensaje, primero, emisor? } → { enviados }
//      Manda DE VERDAD un mensaje que apareció en el panel (lib/prueba-paso.ts). Sólo admin, con
//      tope por (workspace, destino): 10 mensajes cada 10 minutos. `emisor` (sexta tanda): `{ linea }`
//      (WhatsApp; '' = la de por default) o `{ remitente }` (email). Ausente = el de siempre.
// POST { secuenciaId, historial, audioBase64? } (sin action) → { respuesta, desenlace }
//      El setter libre de antes. Queda por compatibilidad; el panel nuevo no lo usa.
//
// Sandbox salvo 'enviar-real': no inscribe, no guarda, no toca métricas. Admin y setter (el
// setter entrena con el simulador; no puede editar ni mandar de verdad).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { responderSimulador, type TurnoSim } from '@/lib/setting-simulador';
import { transcribirAudio } from '@/lib/ai-cheap';
import { clasificarEscenario } from '@/lib/chat-agent-handoff';
import { getUsuarioActual } from '@/lib/auth';
import { buscarUsuarioPorEmail } from '@/lib/usuarios';
import { escenariosDeRespuesta, normalizar, TOPE_NODOS, TOPE_GUIA, type PasoGrafo } from '@/lib/flujo-grafo';
import { destinoDelQueMira, destinosGuardados, sanearDestinoPrueba, sanearMensajePrueba, sanearEmisorPrueba } from '@/lib/simulador-grafo';
import { enviarPasoDePrueba, guardarDestinoDeQuienPrueba } from '@/lib/prueba-paso';
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

export async function GET(req: NextRequest) {
  const a = await acceso();
  if (!a) return json(SIN_ACCESO, 403);
  if (req.nextUrl.searchParams.get('destino') !== '1') return json({ ok: false, error: 'pedido inválido' }, 400);
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
      // (`expandirPasoIA`, novena tanda), así la guía y «sale sola» de cada caso son las que lee el motor.
      const casos = escenariosDeRespuesta(pasos);
      // La forma del clasificador de siempre. Se busca el caso por REFERENCIA: el clasificador
      // devuelve el mismo objeto que se le pasó, así que no hace falta comparar títulos (dos casos
      // pueden llamarse igual).
      const escenarios: EscenarioSecuencia[] = casos.map((c) => ({
        titulo: c.titulo, cuando: c.cuando, comoResponder: c.comoResponder, ...(c.contestaSolo ? { contestaSolo: true } : {}),
      }));
      const r = await clasificarEscenario(mensaje, escenarios);
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
      };
      // ⚠️ `responderSimulador` lee de lo GUARDADO el nombre, el objetivo, el gancho y las
      // preguntas de la secuencia; lo que se edita en el lienzo (el caso y su guía) viaja acá.
      const r = await responderSimulador(id, historial, { escenario });
      if (!r.ok) return json({ ok: false, error: r.error }, 400);
      return json({ ok: true, respuesta: r.respuesta });
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
    const r = await responderSimulador(id, historial);
    if (!r.ok) return json({ ok: false, error: r.error }, 400);
    return json({ ok: true, respuesta: r.respuesta, desenlace: r.desenlace, ...(t.texto ? { transcript: t.texto } : {}) });
  } catch (e) {
    console.error(`[api:chat-agent/simulador POST] ${msg(e)}`);
    return json({ ok: false, error: msg(e) }, 500);
  }
}
