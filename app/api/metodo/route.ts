// =============================================================================
// /api/metodo — estado y guardado de credenciales de integraciones
// =============================================================================
// GET  → por servicio del catálogo, el estado de cada campo: si está
//        configurado, de dónde sale (servidor = env de Vercel, panel = cargado
//        acá) y una máscara (últimos 4, solo para lo cargado desde el panel —
//        lo del servidor no se filtra ni parcialmente).
// POST → { action: 'guardar', servicio, valores: { ENV: valor } } o
//        { action: 'borrar', env }. Solo claves del catálogo (whitelist) y
//        nunca de servicios soloServidor. Guardado cifrado + aplicado a
//        process.env al instante (las demás instancias lo toman al arrancar).

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import {
  eliminarCredencial, guardarCredencial, listarCredenciales, origenCredencial,
} from '@/lib/credenciales';
import { ENVS_METODO, SERVICIOS_METODO, servicioMetodo } from '@/lib/metodo-catalogo';

export const dynamic = 'force-dynamic';

async function estadoServicios() {
  let metas: Awaited<ReturnType<typeof listarCredenciales>> = [];
  try {
    metas = await listarCredenciales();
  } catch {
    // sin Supabase (local) el estado sale solo de las envs
  }
  const porClave = new Map(metas.map((m) => [m.clave, m]));

  return SERVICIOS_METODO.map((s) => {
    const campos = s.campos.map((c) => {
      const origenVivo = origenCredencial(c.env); // según el process.env de ESTA instancia
      const meta = porClave.get(c.env);
      // Si esta instancia todavía no hidrató la credencial pero la base tiene una
      // fila legible, la damos por configurada (origen 'panel'): la hidratación
      // es por cold start, así que sin esto una instancia recién arrancada
      // reportaría "Falta conectar" algo ya guardado.
      const enDbLegible = Boolean(meta && meta.legible);
      const origen: 'servidor' | 'panel' | null = origenVivo ?? (enDbLegible ? 'panel' : null);
      return {
        env: c.env,
        configurado: origen !== null,
        origen,
        mask: origen === 'panel' && meta ? meta.mask : '',
        // guardada en la base pero ilegible (rotó el secret) → re-pegar
        ilegible: Boolean(meta && !meta.legible && origenVivo !== 'servidor'),
      };
    });
    const requeridos = s.campos.filter((c) => !c.opcional).map((c) => c.env);
    // Si TODOS los campos son opcionales, "conectada" exige al menos uno.
    const conectada = requeridos.length > 0
      ? campos.filter((c) => requeridos.includes(c.env)).every((c) => c.configurado)
      : campos.some((c) => c.configurado);
    return { key: s.key, conectada, campos };
  });
}

export async function GET() {
  const sesion = await getSesionAdmin();
  if (!sesion) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, servicios: await estadoServicios() });
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

  try {
    if (body.action === 'guardar') {
      const servicio = servicioMetodo(body.servicio ?? '');
      if (!servicio || servicio.soloServidor) {
        return NextResponse.json({ ok: false, error: 'servicio inválido' }, { status: 400 });
      }
      const valores = body.valores && typeof body.valores === 'object' ? body.valores : {};
      const envsDelServicio = new Set(servicio.campos.map((c) => c.env));
      let guardadas = 0;
      for (const [env, valor] of Object.entries(valores)) {
        if (!envsDelServicio.has(env)) continue; // whitelist estricta
        const v = typeof valor === 'string' ? valor.trim() : '';
        if (!v) continue;
        if (origenCredencial(env) === 'servidor') continue; // la env de Vercel manda
        // La sesión legacy trae el email de una cookie no firmada (editable) →
        // no lo usamos como atribución; guardamos el sub en su lugar.
        const autor = sesion.legacy ? sesion.sub : (sesion.email || sesion.sub);
        await guardarCredencial(env, v, servicio.key, autor);
        guardadas++;
      }
      return NextResponse.json({ ok: true, guardadas, servicios: await estadoServicios() });
    }

    if (body.action === 'borrar') {
      const env = body.env ?? '';
      if (!ENVS_METODO.has(env)) return NextResponse.json({ ok: false, error: 'clave inválida' }, { status: 400 });
      await eliminarCredencial(env);
      return NextResponse.json({ ok: true, servicios: await estadoServicios() });
    }

    return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
