// =============================================================================
// /api/crm/horarios — los horarios de un día con su disponibilidad real
// =============================================================================
// GET ?fecha=YYYY-MM-DD[&duracion=45][&desde=7][&hasta=22][&paso=15][&margen=30]
//   → 200 { ok:true, codigo, motivo, tz, slots:[{hora, inicioIso, libre}], rango }
//
// Lo consume el paso "¿A qué hora?" del wizard de reagendado del CRM: la grilla
// de horas se pintaba a ciegas y el usuario elegía encima de reuniones que ya
// tenía en la agenda.
//
// Los cinco parámetros de grilla son OPCIONALES y tienen default en el contrato
// (app/crm/horarios-respuesta.ts). Existen para que un caller pueda pedir algo
// distinto —una jornada más corta, media hora de paso— sin tocar código, pero el
// cliente hoy no manda ninguno salvo `duracion`: el default es el rango bueno.
// `desde`/`hasta` admiten fracciones (8.5 = 8:30).
//
// Dos decisiones que no son obvias:
//
// · UN FALLO DE GOOGLE NO ES UN 500. Si no hay agenda conectada o la API falla,
//   la respuesta sigue siendo 200 con `ok:true`, la grilla completa y un `codigo`
//   distinto de 'ok' explicando qué pasó. La UI muestra el aviso y deja elegir la
//   hora igual: reagendar tiene que funcionar con Google caído. El 500 queda para
//   lo que de verdad se rompió acá adentro.
//
// · SIN CHEQUEO DE ROL. El worklist "Datos sin marcar" lo usan closers y setters,
//   no solo el admin del workspace. Alcanza con tener sesión y workspace.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { horariosLibresDeGoogle } from '@/lib/google-calendar';
import { tzDeWorkspace, TZ_DEFAULT } from '@/lib/timezone';
import { getWorkspaceActual } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Número de query string, o undefined si no vino / no es número. */
function num(v: string | null): number | undefined {
  if (v == null || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(req: NextRequest) {
  // La sesión se chequea acá y no solo en el gate de proxy.ts: sin AUTH_SECRET el
  // gate queda inactivo (local/dev), y getWorkspaceActual() sin cookie de sesión
  // cae al workspace DUEÑO — o sea que un request anónimo leería su agenda.
  const sesion = await getUsuarioActual();
  const ws = sesion ? await getWorkspaceActual() : null;
  if (!sesion || ws == null) {
    return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  }

  const fecha = (req.nextUrl.searchParams.get('fecha') ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return Response.json({ ok: false, error: 'Falta la fecha (YYYY-MM-DD).' }, { status: 400 });
  }

  try {
    const p = req.nextUrl.searchParams;
    // La zona es la del WORKSPACE, no la del navegador: es la agenda del negocio.
    // Viaja en la respuesta para que la pantalla pueda decir en qué zona está
    // leyendo los horarios.
    const tz = await tzDeWorkspace(ws).catch(() => TZ_DEFAULT);
    const r = await horariosLibresDeGoogle(fecha, {
      tz,
      duracionMin: num(p.get('duracion')),
      desdeHora: num(p.get('desde')),
      hastaHora: num(p.get('hasta')),
      pasoMin: num(p.get('paso')),
      margenMin: num(p.get('margen')),
    });
    // `rango` viaja siempre: es con lo que el cliente arma la grilla por su cuenta
    // cuando la agenda no se pudo verificar. Sin esto, un fallo de Google le hacía
    // pintar un rango distinto del que ofrece el server cuando anda.
    return Response.json({ ok: true, codigo: r.codigo, motivo: r.motivo, tz: r.tz, slots: r.slots, rango: r.rango });
  } catch (e) {
    // horariosLibresDeGoogle no lanza; si llegamos acá se rompió otra cosa.
    console.error(`[api:crm/horarios GET] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
