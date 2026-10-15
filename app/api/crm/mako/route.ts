// =============================================================================
// /api/crm/mako — el chat de MaKo al costado del CRM y sus sugerencias
// =============================================================================
// GET  ?funnel=N                → { ok, crm, sugerencias, calladas, callar }  (lo del botón plegado;
//                                  `calladas`: las de «Ahora no» de ESE CRM, null si no se pudo leer)
// GET  ?funnel=N&hilo=1         → { ok, crm, sesion, mensajes, propuestas }   (al ABRIR el panel)
// POST { action:'send', funnel, sessionId?, mensaje }                 → RespuestaTurno
// POST { action:'confirmar'|'cancelar', funnel, sessionId, pendienteId } → ResultadoTarjeta
// POST { action:'hacer', funnel, sugerencia }                          → { ok, secuenciaId, nombre, aviso, href }
// POST { action:'ahora_no', funnel, sugerencia }                       → { ok }
// POST { action:'volver_a_mostrar', funnel, sugerencia }               → { ok, cambio }
//
// Sin `funnel` (o con uno que no es del workspace), el CRM del negocio: lo que dibuja /crm sin `?funnel=`.
//
// Lo que decide vive en app/crm/mako-crm/chat-server.ts (quién, qué CRM, qué lee MaKo), en el turno de
// lib/mako-turno-app.ts y en lib/sugerencias-crm-server.ts (calcular una vez, crear, callar): esto sólo
// traduce HTTP. PRIVADA: no está en PUBLICOS (lib/rutas-publicas.ts) y además exige la sesión adentro,
// en cada pedido (`chatDelRequest`).
//
// ⚠️ EL GET SIN `hilo` NO ESCRIBE NADA: lo pide el botón plegado al montarse, en cada carga de /crm. El
// hilo (`abrirDelCrm`) sí escribe —`pendientesVigentes` vence lo vencido antes de leer— y por eso va
// aparte, recién cuando la persona abre el panel.
//
// ⚠️ «HACERLO», «AHORA NO» Y «VOLVER A MOSTRAR» SON DEL ADMIN, y se miran ACÁ (la pantalla sólo esconde
// el botón): crear automatizaciones es suyo (POST /api/chat-agent/secuencias es admin-only), y callar
// una sugerencia (o deshacerlo) es para todo el equipo. La pantalla manda el ID de la sugerencia, nunca
// la plantilla ni la etapa: qué se crea lo decide la cuenta fresca del server (lib/sugerencias-crm-server.ts).
//
// ⚠️ CONFIRMAR VA POR ACÁ Y NO POR UNA SERVER ACTION (como en /api/crm/analyst): el techo de una action
// lo pone la PÁGINA que la monta, y confirmar puede correr una acción lenta con la pendiente reclamada.
// maxDuration 420: el doer encadena hasta 8 pasos (y confirmar replicar_landing corre ~275 s); el `fetch` de la
// pantalla corta a los 425 s.
// =============================================================================

import type { NextRequest } from 'next/server';
import { chatDelRequest, abrirDelCrm, turnoDelCrm, tarjetaDelCrm, type ChatDelCrm } from '@/app/crm/mako-crm/chat-server';
import { sugerenciasDeUnCrm, hacerSugerencia, ahoraNo, volverAMostrar } from '@/lib/sugerencias-crm-server';
import { dePantalla } from '@/lib/sugerencias-crm';

export const dynamic = 'force-dynamic';
// 420 y no 300 (tanda 7 del Web Generator, 15/10/2026; Martín: «Todas las funciones a la API de MaKo»): confirmar
// replicar_landing por chat corre hasta ~275 s (lib/editor-landing/replicar.ts: imágenes hasta los 265 s, más
// guardar el tema y crear) y antes y después van los pasos del modelo y el envío: 300 lo cortaba. Plan Pro con
// fluid compute: tope 800. tests/mako-doer-plazo.test.ts.
export const maxDuration = 420;

const json = (cuerpo: Record<string, unknown>, status = 200) => Response.json(cuerpo, { status });

const idDe = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim());
  return Number.isInteger(n) && n > 0 ? n : null;
};
const idSugerencia = (v: unknown): string | null => (typeof v === 'string' && /^[a-z0-9:_-]{1,120}$/i.test(v) ? v : null);

export async function GET(req: NextRequest) {
  try {
    const c = await chatDelRequest(req.nextUrl.searchParams.get('funnel'));
    if ('error' in c) return json({ ok: false, error: c.error }, c.status);
    const crm = { id: c.crm.id, nombre: c.crm.nombre };
    if (req.nextUrl.searchParams.get('hilo') === '1') return json({ ok: true, crm, ...(await abrirDelCrm(c)) });
    const r = await sugerenciasDeUnCrm(c.persona.ws, c.crm.id);
    const admin = c.persona.rol === 'admin';
    return json({
      ok: true, crm,
      sugerencias: (r?.sugerencias ?? []).map((s) => dePantalla(s, admin)),
      calladas: r ? r.calladas?.map((x) => dePantalla(x.sugerencia, admin)) ?? null : [],
      callar: admin,
    });
  } catch (e) {
    console.error('[api/crm/mako] GET', e instanceof Error ? e.message : String(e));
    return json({ ok: false, error: 'No pude cargar lo de MaKo.' }, 500);
  }
}

async function mandar(c: ChatDelCrm, sessionId: number | null, mensaje: string) {
  if (!mensaje.trim()) return json({ ok: false, error: 'Escribe algo.' }, 400);
  const r = await turnoDelCrm(c, sessionId, { mensaje });
  if (!r) return json({ ok: false, error: 'No encuentro ese chat.' }, 404);
  // Un fallo del modelo NO es un error HTTP: el mensaje quedó guardado y el aviso viaja adentro.
  return json({ ...r });
}

export async function POST(req: NextRequest) {
  try {
    let body: { action?: unknown; funnel?: unknown; sessionId?: unknown; mensaje?: unknown; pendienteId?: unknown; sugerencia?: unknown };
    try { body = await req.json(); } catch { return json({ ok: false, error: 'Pedido inválido.' }, 400); }
    const c = await chatDelRequest(body.funnel);
    if ('error' in c) return json({ ok: false, error: c.error }, c.status);

    if (body.action === 'send') {
      return await mandar(c, idDe(body.sessionId), typeof body.mensaje === 'string' ? body.mensaje : '');
    }
    if (body.action === 'confirmar' || body.action === 'cancelar') {
      const sessionId = idDe(body.sessionId);
      const pendienteId = idDe(body.pendienteId);
      if (sessionId == null || pendienteId == null) return json({ ok: false, error: 'Acción inválida' }, 400);
      return json({ ...(await tarjetaDelCrm(c, body.action, sessionId, pendienteId)) });
    }
    if (body.action === 'hacer' || body.action === 'ahora_no' || body.action === 'volver_a_mostrar') {
      if (c.persona.rol !== 'admin') return json({ ok: false, error: 'Esto lo decide el admin de la cuenta.' }, 403);
      const id = idSugerencia(body.sugerencia);
      if (!id) return json({ ok: false, error: 'Falta la sugerencia.' }, 400);
      const r = body.action === 'hacer'
        ? await hacerSugerencia(c.persona.ws, c.crm.id, id)
        : body.action === 'ahora_no'
          ? await ahoraNo(c.persona.ws, c.crm.id, id)
          : await volverAMostrar(c.persona.ws, c.crm.id, id);
      if (!r.ok) return json({ ok: false, error: r.error }, r.status);
      return json({ ...r });
    }
    return json({ ok: false, error: 'Pedido inválido.' }, 400);
  } catch (e) {
    console.error('[api/crm/mako] POST', e instanceof Error ? e.message : String(e));
    return json({ ok: false, error: 'Algo falló de nuestro lado. Intenta de nuevo.' }, 500);
  }
}
