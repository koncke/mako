// =============================================================================
// /api/integraciones/credencial — BYOK desde los modales de /integraciones
// =============================================================================
// Trae el "pegar + guardar + probar conexión" de /metodo a los modales del board
// de integraciones, para que el admin de un workspace configure SUS credenciales
// sin salir de la app. Opera SIEMPRE sobre el workspace del request
// (getWorkspaceActual) — nunca sobre un ws provisto por el cliente.
//
// GUARD (seguridad multi-tenant): permitido solo para el super-admin de agencia
// (getSesionAdmin) o el admin del propio workspace (getRolWsEfectivo === 'admin').
// closer/setter/sin sesión → 403. El ws objetivo es el actual; si es null solo el
// super-admin cae al dueño (OWNER_WS), el resto es 403 (fail-closed).
//
// GET  ?servicio=<key> → catálogo + estado por campo (configurado/origen/máscara).
// POST { action:'guardar', servicio, valores } → whitelist estricta por campos.
// POST { action:'borrar', env }                → elimina la fila cifrada.
// POST { action:'verificar', servicio, valores } → "Probar conexión".
// POST { action:'revelar', env }               → texto plano de UNA credencial.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin, getUsuarioActual } from '@/lib/auth';
import { auditarCredencial, credWs, eliminarCredencial, estadoCampo, guardarCredencial } from '@/lib/credenciales';
import { getRolWsEfectivo, getWorkspaceActual, OWNER_WS } from '@/lib/workspace';
import { verificarServicio } from '@/lib/metodo-verificar';
import { ayudaDeCampo, ENVS_METODO, servicioMetodo } from '@/lib/metodo-catalogo';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => String(e instanceof Error ? e.message : e);

type Contexto = { ws: number; autor: string | null };

/**
 * Resuelve el workspace objetivo y valida el permiso. El ws SIEMPRE sale del
 * request (getWorkspaceActual): jamás se acepta un ws del body/query. Devuelve
 * un error tipado en vez de lanzar, para que cada handler responda con status.
 */
async function resolverContexto(): Promise<Contexto | { error: string; status: number }> {
  const sesion = await getUsuarioActual();
  if (!sesion) return { error: 'solo admin', status: 403 };

  // super-admin de agencia (o legacy/dev/dueño) O admin del propio workspace.
  const esSuperAdmin = (await getSesionAdmin()) != null;
  const esAdminWs = (await getRolWsEfectivo()) === 'admin';
  if (!esSuperAdmin && !esAdminWs) return { error: 'solo admin', status: 403 };

  const wsActual = await getWorkspaceActual();
  // ws null = admin sin impersonar: solo el super-admin cae al dueño; el resto
  // (p.ej. un admin-cliente sin workspace resuelto) → 403 fail-closed.
  if (wsActual == null) {
    if (!esSuperAdmin) return { error: 'workspace no resuelto', status: 403 };
    return { ws: OWNER_WS, autor: autorDe(sesion) };
  }
  return { ws: wsActual, autor: autorDe(sesion) };
}

// La sesión legacy trae el email de una cookie no firmada (editable) → no lo
// usamos como atribución; guardamos el sub en su lugar.
function autorDe(sesion: Awaited<ReturnType<typeof getUsuarioActual>>): string | null {
  if (!sesion) return null;
  return sesion.legacy ? sesion.sub : (sesion.email || sesion.sub);
}

/**
 * Guard EXTRA solo para 'revelar' (BYOK): ver una credencial en claro queda
 * reservado al admin del PROPIO workspace. La agencia no, ni impersonando.
 *
 * Por qué no alcanza el guard general: getRolWsEfectivo() devuelve 'admin' para
 * cualquiera con rol global 'admin' ANTES de mirar su rol_ws real
 * (lib/workspace.ts), y getWorkspaceActual() devuelve el ws impersonado. O sea
 * que "es admin de este workspace" da true para la agencia y no filtra nada.
 * El discriminante duro es `sesion.rol`: 'admin' = agencia; el cliente es
 * 'usuario' con su ws propio en `sesion.ws`. Las sesiones legacy/break-glass
 * (contraseña maestra, dev-login) tampoco pasan: no son de nadie en particular.
 *
 * Escribir SÍ sigue permitido a la agencia (configurar integraciones en el
 * onboarding es parte del laburo). Lo que se cierra es la LECTURA.
 */
function puedeRevelar(sesion: NonNullable<Awaited<ReturnType<typeof getUsuarioActual>>>, ws: number): boolean {
  if (sesion.legacy || sesion.rol === 'admin') return false;
  if (sesion.ws == null || sesion.ws !== ws) return false;
  return (sesion.rolWs ?? 'admin') === 'admin';
}

// Estado de un servicio (catálogo + estado por campo) para el ws objetivo.
async function estadoServicio(servicioKey: string, ws: number) {
  const s = servicioMetodo(servicioKey);
  if (!s) return null;
  const campos = await Promise.all(s.campos.map(async (c) => {
    let est: Awaited<ReturnType<typeof estadoCampo>>;
    try { est = await estadoCampo(c.env, ws); }
    catch { est = { configurado: false, origen: null, mask: '', ilegible: false }; }
    return {
      env: c.env,
      label: c.label,
      placeholder: c.placeholder ?? null,
      secreto: !!c.secreto,
      opcional: !!c.opcional,
      nota: c.nota ?? null,
      host: !!c.host,
      // Cómo se consigue ESTE campo. El modal ya no muestra un tutorial por
      // servicio: cada credencial se saca de un lado distinto.
      ayuda: ayudaDeCampo(c.env),
      ...est,
    };
  }));
  return {
    key: s.key,
    nombre: s.nombre,
    categoria: s.categoria,
    paraQue: s.paraQue,
    soloServidor: !!s.soloServidor,
    tutorial: s.tutorial,
    campos,
  };
}

export async function GET(req: NextRequest) {
  const ctx = await resolverContexto();
  if ('error' in ctx) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });

  const servicioKey = req.nextUrl.searchParams.get('servicio') ?? '';
  try {
    const servicio = await estadoServicio(servicioKey, ctx.ws);
    if (!servicio) return NextResponse.json({ ok: false, error: 'servicio inválido' }, { status: 400 });
    return NextResponse.json({ ok: true, servicio });
  } catch (e) {
    return NextResponse.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

type Body = { action?: string; servicio?: string; valores?: Record<string, unknown>; env?: string };

export async function POST(req: NextRequest) {
  const ctx = await resolverContexto();
  if ('error' in ctx) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });

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
        if (!envsDelServicio.has(env)) continue; // whitelist estricta: ignora envs ajenas
        const v = typeof valor === 'string' ? valor.trim() : '';
        if (!v) continue; // input vacío nunca pisa una guardada
        // Sin excepciones para el dueño: guardar SIEMPRE escribe en la base, y la
        // base manda (lib/credenciales.ts). Todo se configura desde la app.
        await guardarCredencial(ctx.ws, env, v, servicio.key, ctx.autor);
        await auditarCredencial(ctx.ws, env, 'guardar', ctx.autor);
        guardadas++;
      }
      const estado = await estadoServicio(servicio.key, ctx.ws);
      return NextResponse.json({ ok: true, guardadas, servicio: estado });
    }

    if (body.action === 'borrar') {
      const env = body.env ?? '';
      if (!ENVS_METODO.has(env)) return NextResponse.json({ ok: false, error: 'clave inválida' }, { status: 400 });
      await eliminarCredencial(ctx.ws, env);
      await auditarCredencial(ctx.ws, env, 'borrar', ctx.autor);
      return NextResponse.json({ ok: true });
    }

    // Revelar UNA credencial (el "ojito"). Va en su propia action a propósito:
    // el GET del estado manda solo la máscara, así el texto plano nunca viaja
    // por el solo hecho de abrir el modal — hay que pedirlo, y queda registrado.
    // credWs scopea al ws del contexto: nunca se lee la credencial de otro.
    if (body.action === 'revelar') {
      const env = body.env ?? '';
      if (!ENVS_METODO.has(env)) return NextResponse.json({ ok: false, error: 'clave inválida' }, { status: 400 });
      // getUsuarioActual está cacheada por request: volver a pedirla no cuesta.
      const sesion = await getUsuarioActual();
      if (!sesion || !puedeRevelar(sesion, ctx.ws)) {
        // El intento RECHAZADO también se audita: es la señal más interesante.
        await auditarCredencial(ctx.ws, env, 'revelar', ctx.autor, { permitido: false, motivo: 'no es admin de este workspace' });
        return NextResponse.json({ ok: false, error: 'Solo el admin de este espacio puede ver una credencial.' }, { status: 403 });
      }
      const valor = await credWs(env, ctx.ws);
      if (!valor) return NextResponse.json({ ok: false, error: 'sin credencial guardada' }, { status: 404 });
      await auditarCredencial(ctx.ws, env, 'revelar', ctx.autor);
      return NextResponse.json({ ok: true, valor }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (body.action === 'verificar') {
      const servicio = servicioMetodo(body.servicio ?? '');
      if (!servicio) return NextResponse.json({ ok: false, error: 'servicio inválido' }, { status: 400 });
      const valores = body.valores && typeof body.valores === 'object' ? body.valores : {};
      const resultado = await verificarServicio(servicio.key, valores);
      return NextResponse.json(resultado);
    }

    return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
