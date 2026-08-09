// =============================================================================
// POST /api/agente/telemetria — lo que el plugin del cliente reporta de su sesión
// =============================================================================
// Auth: `Authorization: Bearer <token de /integraciones>`, igual que el resto de
// /api/agente. Lo llama un HOOK de Claude Code en la máquina del cliente al cerrar
// una sesión, no una persona.
//
// Recibe dos cosas con vidas distintas, y esa es la decisión de diseño:
//   · el ACTA (de qué se trató, cuántos turnos, qué señales) — se queda;
//   · los TURNOS QUE ESCRIBIÓ LA PERSONA — caducan.
// Nunca el transcript entero: las credenciales y los datos de terceros aparecen en
// las SALIDAS DE HERRAMIENTAS, no en lo que alguien tipea.
//
// La redacción corre DOS veces a propósito: en el plugin antes de que el texto salga
// por la red (que es el único momento en que sirve de verdad) y acá al recibir, por
// si el plugin es viejo o alguien postea a mano. Esta segunda pasada no es
// desconfianza: es que un cliente con una versión vieja no puede volverse un agujero.
//
// UPSERT por (workspace_id, sesion_id): si el hook reintenta porque no había internet,
// actualiza en vez de duplicar.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { bearerDe, wsPorAgenteToken } from '@/lib/agente-token';
import { getSupabaseServer } from '@/lib/supabase';
import { redactarTurnos } from '@/lib/agente-redaccion';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Cuánto viven los turnos. El acta no caduca; esto sí, porque es lo único que puede
 *  traer contenido del negocio del cliente y solo hace falta un tiempo para leer CÓMO
 *  prompea. Noventa días es un trimestre: alcanza para ver un patrón y no es un
 *  archivo permanente de lo que alguien escribió. */
const DIAS_TURNOS = 90;

/** Tope del cuerpo, ANTES de parsear. Sin esto, un transcript enorme se convierte en
 *  un JSON.parse de varios MB en una función serverless. */
const TOPE_BYTES = 512 * 1024;

export async function POST(req: NextRequest) {
  const ws = await wsPorAgenteToken(bearerDe(req));
  if (ws == null) return NextResponse.json({ ok: false, error: 'token inválido o revocado' }, { status: 401 });

  const largo = Number(req.headers.get('content-length') ?? 0);
  if (largo > TOPE_BYTES) {
    return NextResponse.json({ ok: false, error: `cuerpo demasiado grande (tope ${TOPE_BYTES} bytes)` }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }

  const sesionId = String(body.sesion_id ?? '').trim();
  if (!sesionId) return NextResponse.json({ ok: false, error: 'falta `sesion_id`' }, { status: 400 });

  const acta = body.acta && typeof body.acta === 'object' ? (body.acta as Record<string, unknown>) : {};
  const crudos = Array.isArray(body.turnos) ? (body.turnos as Array<{ ts?: unknown; texto?: unknown }>) : [];
  const { turnos, tapadas } = redactarTurnos(crudos);

  const purgar = new Date(Date.now() + DIAS_TURNOS * 24 * 60 * 60 * 1000).toISOString();

  try {
    // Se usa el cliente de SERVICIO y se escribe `workspace_id` a mano, en vez del
    // proxy tenant: acá no hay sesión de browser que resuelva el workspace — lo
    // resolvió el token, y ese es el único dato de identidad que hay.
    const { error } = await getSupabaseServer()
      .from('agente_sesiones')
      .upsert({
        workspace_id: ws,
        sesion_id: sesionId,
        empezo_en: typeof body.empezo_en === 'string' ? body.empezo_en : null,
        termino_en: typeof body.termino_en === 'string' ? body.termino_en : new Date().toISOString(),
        acta,
        turnos,
        redacciones: tapadas,
        purgar_despues: purgar,
      }, { onConflict: 'workspace_id,sesion_id' });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, turnos: turnos.length, redacciones: tapadas });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
