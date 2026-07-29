// =============================================================================
// /api/plan-reunion — repartir a cada persona las tareas que asumió en la reunión
// =============================================================================
// POST { action:'destinatarios', recordingId }        → { ok, destinatarios:[…] }
// POST { action:'enviar', recordingId, email, tareas, reunion, canales, telefono? }
//                                                     → { ok, wa?, email? }
// POST { action:'cargar', recordingId, email, tareas, reunion }
//                                                     → { ok, link }  (borrador en SU plan)
//
// CANDADO ANTI-SPAM: solo se le puede mandar algo a alguien que ESTUVO en esa
// reunión. La lista blanca son los participantes que quedaron cacheados al extraer
// (lib/plan-fathom → cacheKeyReunion, por workspace). Sin esa extracción previa,
// esta ruta no manda nada: si no, sería un formulario para mandar mails y WhatsApps
// a cualquier dirección desde el dominio de la agencia.
//
// AISLAMIENTO: escribir el borrador en el workspace de otra persona lo autoriza
// resolverDestinatarios (mismo workspace, o admin de la plataforma).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getSetting } from '@/lib/settings';
import { cacheKeyReunion, type Participante } from '@/lib/plan-fathom';
import { resolverDestinatarios, enviarTareasAPersona, cargarTareasEnPlanDe, type TareaDeOtro, type ReunionRef } from '@/lib/reunion-destinatarios';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Participantes cacheados de esa grabación (lista blanca). Vacío = no se extrajo acá. */
async function participantesDe(recordingId: number): Promise<Participante[]> {
  const raw = await getSetting(cacheKeyReunion(recordingId)).catch(() => null);
  if (!raw) return [];
  try {
    const prev = JSON.parse(raw) as { participantes?: unknown };
    return Array.isArray(prev.participantes)
      ? (prev.participantes as Participante[]).filter((p) => p && typeof p.email === 'string')
      : [];
  } catch { return []; }
}

const tareasDe = (raw: unknown): TareaDeOtro[] =>
  (Array.isArray(raw) ? raw : [])
    .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
    .map((t) => ({
      titulo: String(t.titulo ?? '').trim().slice(0, 200),
      detalle: t.detalle ? String(t.detalle).slice(0, 600) : undefined,
      prioridad: t.prioridad ? String(t.prioridad) : undefined,
      proyecto: t.proyecto ? String(t.proyecto).slice(0, 120) : undefined,
    }))
    .filter((t) => t.titulo)
    .slice(0, 40);

const reunionDe = (raw: unknown): ReunionRef => {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    titulo: String(o.titulo ?? '').slice(0, 200),
    fecha: o.fecha ? String(o.fecha) : null,
    url: o.url ? String(o.url).slice(0, 500) : null,
  };
};

export async function POST(req: NextRequest) {
  const sesion = await getUsuarioActual();
  if (!sesion) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const action = String(body.action ?? '');
  const recordingId = Number(body.recordingId);
  if (!Number.isFinite(recordingId)) return Response.json({ ok: false, error: 'Falta la reunión.' }, { status: 400 });

  try {
    const participantes = await participantesDe(recordingId);
    if (!participantes.length) {
      return Response.json({ ok: false, error: 'No tengo los participantes de esta reunión. Volvé a analizarla y probá de nuevo.' }, { status: 409 });
    }

    if (action === 'destinatarios') {
      const destinatarios = await resolverDestinatarios(participantes);
      return Response.json({ ok: true, destinatarios });
    }

    // De acá para abajo se le manda algo a UNA persona: tiene que ser de la reunión.
    const email = String(body.email ?? '').trim().toLowerCase();
    const invitado = participantes.find((p) => p.email === email);
    if (!invitado) return Response.json({ ok: false, error: 'Esa persona no estuvo en la reunión.' }, { status: 403 });

    const destinatarios = await resolverDestinatarios([invitado]);
    const dest = destinatarios[0];
    if (!dest) return Response.json({ ok: false, error: 'No puedo mandarle nada a esa dirección.' }, { status: 400 });

    const tareas = tareasDe(body.tareas);
    if (!tareas.length) return Response.json({ ok: false, error: 'No hay tareas para mandar.' }, { status: 400 });
    const reunion = reunionDe(body.reunion);
    const de = sesion.nombre || sesion.email || '';
    const ref = `fathom:${recordingId}`;

    if (action === 'cargar') {
      const r = await cargarTareasEnPlanDe({ dest, de, tareas, reunion, ref });
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 403 });
      return Response.json({ ok: true, link: r.link, nombre: dest.nombre });
    }

    if (action === 'enviar') {
      const canales = (body.canales ?? {}) as { wa?: boolean; email?: boolean };
      if (!canales.wa && !canales.email) return Response.json({ ok: false, error: 'Elegí al menos un canal.' }, { status: 400 });
      const telefono = body.telefono ? String(body.telefono).slice(0, 30) : undefined;
      // Si además tiene plan en la app, el mensaje lleva el link a la confirmación.
      const link = body.link ? String(body.link).slice(0, 500) : undefined;
      const r = await enviarTareasAPersona({ de, dest, tareas, reunion, canales, telefono, link });
      const ok = (!canales.wa || r.wa?.ok) && (!canales.email || r.email?.ok);
      return Response.json({ ok: !!ok, ...r, nombre: dest.nombre });
    }

    return Response.json({ ok: false, error: 'acción desconocida' }, { status: 400 });
  } catch (e) {
    console.error(`[api:plan-reunion] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
