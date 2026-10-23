// =============================================================================
// /api/integraciones/cuentas — varias cuentas de Stripe o de Mercado Pago en un negocio (22/10/2026)
// =============================================================================
// Martín (feedback del CRM, punto 3): «que pueda tener varias cuentas de Stripe y MP conectadas». La principal se sigue
// conectando como siempre (/api/integraciones/credencial, `descubrir-pago`); esto es la lista de TODAS y las de más:
//   · GET  ?servicio=stripe                                     → las cuentas del negocio, con su nombre y si cobran;
//   · POST { action: 'conectar', servicio, clave, nombre }       → otra cuenta (`c2`, `c3`…), con la misma conexión que
//                                                                  la principal (lib/cobros-conexion.ts, `descubrirPasarela`);
//   · POST { action: 'reconectar', servicio, cuenta }            → vuelve a registrar el aviso con la clave guardada;
//   · POST { action: 'renombrar', servicio, cuenta, nombre }     → el nombre que ve la persona;
//   · POST { action: 'desconectar', servicio, cuenta }           → UNA cuenta: sus claves, su aviso y su ruteo;
//   · POST { action: 'aviso', servicio: 'mercadopago', cuenta, secreto } → la clave secreta del aviso de ESA cuenta.
// Sólo el admin del negocio (o el super admin en él), como /api/integraciones/credencial. Nunca devuelve una clave.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin, getUsuarioActual } from '@/lib/auth';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { auditarCredencial, credDelCliente, eliminarCredencial, guardarCredencial } from '@/lib/credenciales';
import { leerCuentaStripe } from '@/lib/stripe-api';
import { leerCuentaMp } from '@/lib/mercadopago-api';
import { desconectarPasarela, descubrirPasarela, CLAVE_PASARELA } from '@/lib/cobros-conexion';
import {
  CLAVES_AGENDA, CUENTA_PRINCIPAL, aliasLimpio, claveDeCuenta, cuentaValida, esProveedorAgendaConCuentas,
  type ProveedorAgendaConCuentas, type ProveedorConCuentas,
} from '@/lib/cuentas-integracion';
import { cuentaParaConectar, cuentasDePago, guardarAliasCuenta } from '@/lib/cuentas-pago-server';
import { cuentasDeAgenda, guardarAliasAgenda, proximaCuentaDeAgenda } from '@/lib/cuentas-agenda-server';
import { perfilDeCalcom } from '@/lib/calcom';

export const dynamic = 'force-dynamic';

const esProveedor = (v: unknown): v is ProveedorConCuentas => v === 'stripe' || v === 'mercadopago';

/** El negocio y quién: admin del negocio o super admin parado en él. Sin negocio resuelto, 403 (fail-closed). */
async function contexto(): Promise<{ ws: number; autor: string | null } | { error: string; status: number }> {
  const sesion = await getUsuarioActual();
  if (!sesion) return { error: 'solo admin', status: 403 };
  const esSuperAdmin = (await getSesionAdmin()) != null;
  const esAdminWs = (await getRolWsEfectivo()) === 'admin';
  if (!esSuperAdmin && !esAdminWs) return { error: 'solo admin', status: 403 };
  const ws = await getWorkspaceActual();
  if (ws == null) return { error: 'workspace no resuelto', status: 403 };
  return { ws, autor: sesion.legacy ? sesion.sub : (sesion.email || sesion.sub) };
}

export async function GET(req: NextRequest) {
  const ctx = await contexto();
  if ('error' in ctx) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });
  const servicio = req.nextUrl.searchParams.get('servicio');
  if (esProveedorAgendaConCuentas(servicio)) {
    try {
      return NextResponse.json({ ok: true, cuentas: await listaAgenda(ctx.ws, servicio) });
    } catch (e) {
      return NextResponse.json({ ok: false, error: `No pude leer las cuentas: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
    }
  }
  if (!esProveedor(servicio)) return NextResponse.json({ ok: false, error: 'servicio inválido' }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, cuentas: await cuentasDePago(ctx.ws, servicio) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `No pude leer las cuentas: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }
}

type Body = { action?: string; servicio?: string; cuenta?: string; clave?: string; nombre?: string; secreto?: string };

// ── LA AGENDA (fase B, 23/10/2026): Calendly y Cal.com con la misma lista ─────────────────────────────────────────
// La misma forma que las cuentas de pago, así la pantalla es una sola: `conectada` = lee su agenda (token / API key),
// `conAviso` = tiene el secreto de su aviso (sin él, sus reservas no se pueden verificar).

async function listaAgenda(ws: number, p: ProveedorAgendaConCuentas) {
  return (await cuentasDeAgenda(ws, p)).map((c) => ({
    id: `${p}:${c.cuenta}`, cuenta: c.cuenta, nombre: c.nombre, principal: c.principal, conectada: c.conToken, conAviso: c.conFirma,
  }));
}

/** ¿El proveedor acepta el token (Calendly) o la API key (Cal.com)? Lo pregunta, nunca lo supone. */
async function tokenDeAgendaValido(p: ProveedorAgendaConCuentas, token: string): Promise<boolean> {
  if (p === 'calcom') return (await perfilDeCalcom(token)) != null;
  try {
    const r = await fetch('https://api.calendly.com/users/me', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(8000) });
    return r.ok;
  } catch {
    return false;
  }
}

const NOMBRE_AGENDA: Record<ProveedorAgendaConCuentas, string> = { calendly: 'Calendly', calcom: 'Cal.com' };

async function postAgenda(ctx: { ws: number; autor: string | null }, p: ProveedorAgendaConCuentas, body: Body): Promise<NextResponse> {
  const b = CLAVES_AGENDA[p];
  const lista = () => listaAgenda(ctx.ws, p);
  const guardar = async (clave: string, valor: string) => {
    await guardarCredencial(ctx.ws, clave, valor, p, ctx.autor);
    await auditarCredencial(ctx.ws, clave, 'guardar', ctx.autor);
  };
  if (body.action === 'conectar') {
    const token = typeof body.clave === 'string' ? body.clave.trim() : '';
    if (!token) return NextResponse.json({ ok: false, error: p === 'calendly' ? 'Pega el token de esa cuenta.' : 'Pega la API key de esa cuenta.', nadaGuardado: true }, { status: 400 });
    if (!(await tokenDeAgendaValido(p, token))) {
      return NextResponse.json({ ok: false, error: `${NOMBRE_AGENDA[p]} no aceptó esa clave. No la guardé.`, nadaGuardado: true }, { status: 422 });
    }
    // Sin ninguna cuenta, la principal (como la tarjeta); con alguna, la que sigue: nunca pisa la de otra.
    const cuenta = (await lista()).length ? await proximaCuentaDeAgenda(ctx.ws, p) : CUENTA_PRINCIPAL;
    await guardar(claveDeCuenta(b.clave, cuenta), token);
    const secreto = typeof body.secreto === 'string' ? body.secreto.trim() : '';
    if (secreto) await guardar(claveDeCuenta(b.firmaAviso, cuenta), secreto.slice(0, 300));
    const nombre = aliasLimpio(body.nombre);
    if (nombre) await guardarAliasAgenda(ctx.ws, p, cuenta, nombre, ctx.autor);
    const mensaje = secreto ? 'Conectada.' : 'Conectada. Para que entren sus reservas, falta el secreto de su aviso.';
    return NextResponse.json({ ok: true, cuenta, completa: !!secreto, mensaje, cuentas: await lista() });
  }
  const cuenta = body.cuenta;
  if (!cuentaValida(cuenta)) return NextResponse.json({ ok: false, error: 'cuenta inválida' }, { status: 400 });
  if (!(await lista()).some((x) => x.cuenta === cuenta)) return NextResponse.json({ ok: false, error: 'Esa cuenta ya no está conectada. Recarga.' }, { status: 404 });
  if (body.action === 'renombrar') {
    await guardarAliasAgenda(ctx.ws, p, cuenta, typeof body.nombre === 'string' ? body.nombre : '', ctx.autor);
    return NextResponse.json({ ok: true, cuentas: await lista() });
  }
  if (body.action === 'aviso') {
    const secreto = typeof body.secreto === 'string' ? body.secreto.trim() : '';
    if (secreto.length > 300) return NextResponse.json({ ok: false, error: 'Esa clave es demasiado larga.' }, { status: 400 });
    const env = claveDeCuenta(b.firmaAviso, cuenta);
    if (secreto) await guardar(env, secreto);
    else { await eliminarCredencial(ctx.ws, env); await auditarCredencial(ctx.ws, env, 'borrar', ctx.autor); }
    return NextResponse.json({ ok: true, cuentas: await lista() });
  }
  if (body.action === 'desconectar') {
    // UNA cuenta: su token, su secreto y su nombre. La R1/R2 y los vínculos de «Asignar evento» no se tocan: son del
    // negocio, no de la cuenta (un tipo de evento de esa cuenta deja de listarse, y su vínculo queda para desvincular).
    for (const base of [b.clave, b.firmaAviso, b.alias]) {
      const env = claveDeCuenta(base, cuenta);
      await eliminarCredencial(ctx.ws, env);
      await auditarCredencial(ctx.ws, env, 'borrar', ctx.autor);
    }
    return NextResponse.json({ ok: true, aviso: null, cuentas: await lista() });
  }
  return NextResponse.json({ ok: false, error: 'acción inválida' }, { status: 400 });
}

/** El id de la cuenta EN EL PROVEEDOR de una clave; null si no la acepta (la conexión lo dice después). */
async function idEnElProveedor(p: ProveedorConCuentas, clave: string): Promise<string | null> {
  const c = p === 'stripe' ? await leerCuentaStripe(clave) : await leerCuentaMp(clave);
  return c.ok ? String(c.id) : null;
}

export async function POST(req: NextRequest) {
  const ctx = await contexto();
  if ('error' in ctx) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 });
  }
  const p = body.servicio;
  if (esProveedorAgendaConCuentas(p)) {
    try {
      return await postAgenda(ctx, p, body);
    } catch (e) {
      console.error(`[integraciones/cuentas] ws ${ctx.ws} ${p} ${body.action}:`, e instanceof Error ? e.message : String(e));
      return NextResponse.json({ ok: false, error: `No se pudo: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
    }
  }
  if (!esProveedor(p)) return NextResponse.json({ ok: false, error: 'servicio inválido' }, { status: 400 });
  const lista = async () => cuentasDePago(ctx.ws, p);

  try {
    if (body.action === 'conectar') {
      const clave = typeof body.clave === 'string' ? body.clave.trim() : '';
      if (!clave) return NextResponse.json({ ok: false, error: 'Pega la clave de esa cuenta.', nadaGuardado: true }, { status: 400 });
      // La misma cuenta ya conectada: le cambia la clave. Una que volvió: el sufijo de SUS cobros. Si no, la que sigue
      // (nunca hereda la principal de otra cuenta): lib/cuentas-pago-server.ts, `cuentaParaConectar`.
      const cuenta = await cuentaParaConectar(ctx.ws, p, await idEnElProveedor(p, clave).catch(() => null));
      const r = await descubrirPasarela(p, ctx.ws, clave, ctx.autor, { guardarClave: true, cuenta });
      if (!r.ok) return NextResponse.json({ ok: false, error: r.error, nadaGuardado: r.nadaGuardado }, { status: r.status });
      const nombre = aliasLimpio(body.nombre);
      if (nombre) await guardarAliasCuenta(ctx.ws, p, cuenta, nombre, ctx.autor);
      return NextResponse.json({ ok: true, cuenta, completa: r.completa, mensaje: r.mensaje, cuentas: await lista() });
    }

    const cuenta = body.cuenta;
    if (!cuentaValida(cuenta)) return NextResponse.json({ ok: false, error: 'cuenta inválida' }, { status: 400 });
    if (!(await lista()).some((x) => x.cuenta === cuenta)) return NextResponse.json({ ok: false, error: 'Esa cuenta ya no está conectada. Recarga.' }, { status: 404 });

    if (body.action === 'reconectar') {
      // Con la clave GUARDADA de esa cuenta (credDelCliente, nunca el entorno): vuelve a registrar el aviso de Stripe.
      const guardada = await credDelCliente(claveDeCuenta(CLAVE_PASARELA[p], cuenta), ctx.ws);
      if (!guardada) return NextResponse.json({ ok: false, error: 'Esa cuenta no tiene su clave guardada: desconéctala y vuelve a conectarla.' }, { status: 400 });
      const r = await descubrirPasarela(p, ctx.ws, guardada, ctx.autor, { guardarClave: false, cuenta });
      if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
      return NextResponse.json({ ok: true, completa: r.completa, mensaje: r.mensaje, cuentas: await lista() });
    }
    if (body.action === 'renombrar') {
      await guardarAliasCuenta(ctx.ws, p, cuenta, typeof body.nombre === 'string' ? body.nombre : '', ctx.autor);
      return NextResponse.json({ ok: true, cuentas: await lista() });
    }
    if (body.action === 'aviso') {
      // Mercado Pago: la clave secreta del aviso de ESA cuenta (la de la principal se pega en su tarjeta). Sin ella, sus
      // suscripciones no renuevan en el CRM. Vacía la borra.
      if (p !== 'mercadopago') return NextResponse.json({ ok: false, error: 'servicio inválido' }, { status: 400 });
      const secreto = typeof body.secreto === 'string' ? body.secreto.trim() : '';
      if (secreto.length > 300) return NextResponse.json({ ok: false, error: 'Esa clave es demasiado larga.' }, { status: 400 });
      const env = claveDeCuenta('MERCADOPAGO_WEBHOOK_SECRET', cuenta);
      if (secreto) await guardarCredencial(ctx.ws, env, secreto, 'mercadopago', ctx.autor);
      else await eliminarCredencial(ctx.ws, env);
      await auditarCredencial(ctx.ws, env, secreto ? 'guardar' : 'borrar', ctx.autor);
      return NextResponse.json({ ok: true, cuentas: await lista() });
    }
    if (body.action === 'desconectar') {
      const r = await desconectarPasarela(ctx.ws, p, ctx.autor, cuenta);
      return NextResponse.json({ ok: true, aviso: r.aviso, cuentas: await lista() });
    }
    return NextResponse.json({ ok: false, error: 'acción inválida' }, { status: 400 });
  } catch (e) {
    console.error(`[integraciones/cuentas] ws ${ctx.ws} ${body.action}:`, e instanceof Error ? e.message : String(e));
    return NextResponse.json({ ok: false, error: `No se pudo: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }
}
