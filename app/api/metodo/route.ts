// =============================================================================
// /api/metodo — estado y guardado de credenciales de integraciones (por workspace)
// =============================================================================
// Opera sobre el workspace ACTUAL (getWorkspaceActual): un admin que "entra
// como" un cliente gestiona las credenciales de ESE cliente; sin impersonar,
// las del dueño. Solo admin. El dueño se trata como cualquier otro cliente: lo
// que guarda acá va a la base cifrada y la base manda (lib/credenciales.ts).
// GET  → por servicio, el estado de cada campo (configurado, origen, máscara).
// POST → { action: 'guardar', servicio, valores } | { action: 'borrar', env }.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { eliminarCredencial, estadoCampo, guardarCredencial, RemitenteNoPropioError } from '@/lib/credenciales';
import { getWorkspaceActual, OWNER_WS } from '@/lib/workspace';
import { ENVS_METODO, SERVICIOS_METODO, servicioMetodo } from '@/lib/metodo-catalogo';

export const dynamic = 'force-dynamic';

async function estadoServicios(ws: number) {
  const servicios = [];
  for (const s of SERVICIOS_METODO) {
    const campos = await Promise.all(s.campos.map(async (c) => {
      let est: Awaited<ReturnType<typeof estadoCampo>>;
      try { est = await estadoCampo(c.env, ws); }
      catch { est = { configurado: false, origen: null, mask: '', ilegible: false }; }
      return { env: c.env, ...est };
    }));
    const requeridos = s.campos.filter((c) => !c.opcional).map((c) => c.env);
    const conectada = requeridos.length > 0
      ? campos.filter((c) => requeridos.includes(c.env)).every((c) => c.configurado)
      : campos.some((c) => c.configurado);
    servicios.push({ key: s.key, conectada, campos });
  }
  return servicios;
}

export async function GET() {
  const sesion = await getSesionAdmin();
  if (!sesion) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  try {
    const ws = (await getWorkspaceActual()) ?? OWNER_WS;
    return NextResponse.json({ ok: true, servicios: await estadoServicios(ws) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}

type Body = { action?: string; servicio?: string; valores?: Record<string, unknown>; env?: string };

export async function POST(req: NextRequest) {
  const sesion = await getSesionAdmin();
  if (!sesion) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 });
  }

  const ws = (await getWorkspaceActual()) ?? OWNER_WS;

  try {
    if (body.action === 'guardar') {
      const servicio = servicioMetodo(body.servicio ?? '');
      if (!servicio || servicio.soloServidor) {
        return NextResponse.json({ ok: false, error: 'servicio inválido' }, { status: 400 });
      }
      const valores = body.valores && typeof body.valores === 'object' ? body.valores : {};
      // Sin los DERIVADOS (lib/metodo-catalogo.ts → `derivado`): el id de la cuenta de Stripe o de
      // Mercado Pago lo escribe sólo el descubrimiento (lib/cobros-conexion.ts). Tipeado aquí,
      // reclamaba el de otro negocio — es la misma whitelist que la de /api/integraciones/credencial,
      // y cerrar una deja la otra abierta.
      const envsDelServicio = new Set(servicio.campos.filter((c) => !c.derivado).map((c) => c.env));
      let guardadas = 0;
      for (const [env, valor] of Object.entries(valores)) {
        if (!envsDelServicio.has(env)) continue; // whitelist estricta (y sin derivados)
        const v = typeof valor === 'string' ? valor.trim() : '';
        if (!v) continue;
        // Sin excepciones para el dueño: guardar SIEMPRE escribe en la base, y la
        // base manda (lib/credenciales.ts). Todo se configura desde la app.
        // La sesión legacy trae el email de una cookie no firmada (editable) →
        // no lo usamos como atribución; guardamos el sub en su lugar.
        const autor = sesion.legacy ? sesion.sub : (sesion.email || sesion.sub);
        try {
          await guardarCredencial(ws, env, v, servicio.key, autor);
        } catch (e) {
          // El remitente de MaKo como `RESEND_FROM` (undécima tanda): es un dato del usuario, no un 500.
          if (e instanceof RemitenteNoPropioError) return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
          throw e;
        }
        guardadas++;
      }
      // Guardar una integración con histórico (Meta, Fathom, YouTube, Panda) arranca SU parte, una vez y en
      // segundo plano (lib/onboarding-extract.ts).
      if (guardadas > 0) {
        const { arrancarHistoricoEnSegundoPlano } = await import('@/lib/onboarding-extract');
        await arrancarHistoricoEnSegundoPlano(ws, servicio.key);
      }
      return NextResponse.json({ ok: true, guardadas, servicios: await estadoServicios(ws) });
    }

    if (body.action === 'borrar') {
      const env = body.env ?? '';
      if (!ENVS_METODO.has(env)) return NextResponse.json({ ok: false, error: 'clave inválida' }, { status: 400 });
      await eliminarCredencial(ws, env);
      return NextResponse.json({ ok: true, servicios: await estadoServicios(ws) });
    }

    return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
