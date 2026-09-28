// =============================================================================
// API: "Completar con los datos de Mau" / "Eliminar los datos de Mau"
// =============================================================================
// El botón que aparece en cada lugar donde falta algo. Trae del workspace del
// dueño SOLO el ámbito del lugar donde está parado el usuario, y lo devuelve
// exacto (lib/datos-mau.ts guarda el recibo de lo que trajo).
//
// GET  → { ok, disponible, completados }   ¿corresponde mostrar los botones acá?
// POST { action: 'completar'|'eliminar', ambito }
//
// Guard, en este orden y sin excepciones:
//   · super-admin de la agencia (getSesionAdmin)
//   · el workspace efectivo tiene que ser EXACTAMENTE el de prueba (WS_PRUEBA)
//
// ⚠️ Antes la segunda condición era «que no sea el del dueño». Eso protegía a
// Mauricio y a nadie más: en el workspace de cualquier cliente REAL aparecía el
// botón de Reset, que vacía 50+ tablas y 4 buckets de storage. Un click de más
// en la cuenta equivocada y no hay vuelta atrás.

import { NextResponse } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { agenciasDeCliente } from '@/lib/agencia';
import { esClienteDePrueba } from '@/lib/auth-session';
import { getWorkspaceActual } from '@/lib/workspace';
import { AMBITOS, ambitosCompletados, completarConDatosDelDueno, eliminarDatosDelDueno, type AmbitoKey } from '@/lib/datos-mau';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** null si acá no corresponde tocar nada; el workspace de prueba si sí. */
async function wsDePrueba(): Promise<number | null> {
  if (!(await getSesionAdmin())) return null;
  const ws = await getWorkspaceActual();
  // Lista blanca explícita (hoy el cliente de prueba y el de diseño), NUNCA
  // «distinto del dueño». La versión negativa dejaba pasar a todos los clientes
  // reales, y sigue siendo la forma en que esto se rompe.
  if (ws == null || !esClienteDePrueba(ws)) return null;

  // ⚠️ Y NUNCA ADENTRO DEL CLIENTE DE UNA AGENCIA. «Que JAMÁS me deje completar
  // nada con Datos de Mauricio» inspeccionando un cliente de agencia
  // (27/09/2026). Hoy eso no pasaba, pero NO por una condición: pasaba porque
  // los clientes de agencia nacen como workspaces nuevos y nunca les toca el id
  // 3 ni el 4. Una propiedad accidental leída como una protección es la trampa
  // de siempre — una fila a mano en `agencia_clientes` alcanzaba para abrirlo.
  //
  // Se pregunta por CUALQUIER fila, no sólo las aprobadas: que una agencia haya
  // pedido ese cliente ya lo saca de «un workspace de la plataforma para
  // probar». El que decide si se puede ENTRAR es otro guard; éste decide si se
  // pueden volcar los datos de un cliente real adentro, que es más destructivo
  // y por lo tanto más restrictivo.
  if ((await agenciasDeCliente(ws)).length > 0) return null;

  return ws;
}

/** El catálogo, para que el panel global lo liste sin duplicar los nombres. */
const CATALOGO = (Object.keys(AMBITOS) as AmbitoKey[]).map((k) => ({
  key: k, titulo: AMBITOS[k].titulo, seccion: AMBITOS[k].seccion,
  label: AMBITOS[k].label, nota: AMBITOS[k].nota ?? null,
}));

export async function GET() {
  const ws = await wsDePrueba();
  if (ws == null) return NextResponse.json({ ok: true, disponible: false, completados: [], ambitos: [] });
  try {
    return NextResponse.json({ ok: true, disponible: true, ws, ambitos: CATALOGO, completados: await ambitosCompletados(ws) });
  } catch {
    return NextResponse.json({ ok: true, disponible: true, ws, ambitos: CATALOGO, completados: [] });
  }
}

export async function POST(req: Request) {
  const ws = await wsDePrueba();
  if (ws == null) {
    return NextResponse.json({ ok: false, error: 'Esto solo corre en un workspace de prueba de la agencia.' }, { status: 403 });
  }
  let body: { action?: string; ambito?: string };
  try { body = (await req.json()) as typeof body; } catch { body = {}; }

  // Traer TODO: cada ámbito, y además dar el onboarding por terminado. Es el
  // atajo de "dejame el cliente listo para mirar el dashboard": traer los datos
  // sin cerrar el alta dejaría al admin igual de trabado en el wizard.
  if (body.action === 'todo') {
    try {
      const detalle: Record<string, number> = {};
      const avisos: string[] = [];
      let copiado = 0;
      for (const k of Object.keys(AMBITOS) as AmbitoKey[]) {
        try {
          const r = await completarConDatosDelDueno(k, ws);
          copiado += r.copiado;
          if (r.copiado) detalle[k] = r.copiado;
          for (const a of r.avisos) if (!avisos.includes(a)) avisos.push(a);
        } catch (e) {
          avisos.push(`${k}: ${msg(e)}`);
        }
      }
      const { patchEstadoOnboarding } = await import('@/lib/onboarding-state');
      await patchEstadoOnboarding((s) => {
        s.status = 'done';
        for (const k of Object.keys(s.steps)) s.steps[k as keyof typeof s.steps] = { done: true };
      });
      return NextResponse.json({ ok: true, copiado, detalle, avisos });
    } catch (e) {
      console.error(`[api:datos-mau] todo ws=${ws}: ${msg(e)}`);
      return NextResponse.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  }

  // Reset: vaciar el workspace entero. No lleva ámbito — se lleva todo.
  if (body.action === 'reset') {
    try {
      const { resetearWorkspace } = await import('@/lib/reset-workspace');
      const r = await resetearWorkspace(ws);
      return NextResponse.json({ ok: true, ...r });
    } catch (e) {
      console.error(`[api:datos-mau] reset ws=${ws}: ${msg(e)}`);
      return NextResponse.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  }

  const ambito = body.ambito as AmbitoKey;
  if (!ambito || !(ambito in AMBITOS)) {
    return NextResponse.json({ ok: false, error: 'ámbito inválido' }, { status: 400 });
  }

  try {
    if (body.action === 'completar') {
      const r = await completarConDatosDelDueno(ambito, ws);
      return NextResponse.json({ ok: true, ...r });
    }
    if (body.action === 'eliminar') {
      const r = await eliminarDatosDelDueno(ambito, ws);
      return NextResponse.json({ ok: true, ...r });
    }
    return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (e) {
    console.error(`[api:datos-mau] ${body.action}/${ambito}: ${msg(e)}`);
    return NextResponse.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
