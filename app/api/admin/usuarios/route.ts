// =============================================================================
// /api/admin/usuarios — gestión de cuentas (solo admin)
// =============================================================================
// GET  → lista de usuarios + resumen del estado del workspace (integraciones
//        conectadas según /metodo y avance del perfil del negocio).
// POST → { action: 'crear' | 'nombre' | 'rol' | 'estado' | 'eliminar', ... }.
//        Guard duro: nunca dejar el workspace sin un admin activo.
// El proxy ya exige rol admin para llegar acá; igual re-verificamos contra la
// base (getSesionAdmin) por si el rol cambió después de firmada la cookie.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import {
  actualizarUsuario, contarAdminsActivos, contarAdminsClienteActivos, crearUsuario, eliminarUsuario,
  listarUsuarios, type EstadoUsuario, type Usuario,
} from '@/lib/usuarios';
import { integracionConectada } from '@/lib/credenciales';
import { SERVICIOS_METODO } from '@/lib/metodo-catalogo';
import { getAnswers, getSchema } from '@/lib/onboarding';
import { listarWorkspaces, OWNER_WS } from '@/lib/workspace';
import type { Rol, RolWorkspace } from '@/lib/auth-session';
import { invitarPorEmail } from '@/lib/invitaciones';
import { urlGravatar, caraDeUsuario } from '@/lib/gravatar';
// Suspender, eliminar, bajar de rol o mover a alguien APAGA los tokens clásicos de la API que
// esa persona acuñó (14/10/2026): sólo los que ya no administra, y sin tirar nunca (la decisión
// ya está escrita; si esto falla, el chequeo por pedido los corta igual en menos de un minuto).
import { revocarAgenteTokensDe } from '@/lib/agente-token';

const ROLES_WS: RolWorkspace[] = ['admin', 'closer', 'setter'];

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Estado de integraciones del workspace actual (sin impersonar = el dueño).

async function resumenIntegraciones() {
  const porServicio = await Promise.all(SERVICIOS_METODO.map(async (s) => ({
    key: s.key, nombre: s.nombre, core: s.core ?? false,
    conectada: await integracionConectada(s.key, OWNER_WS),
  })));
  return {
    conectadas: porServicio.filter((s) => s.conectada).length,
    total: porServicio.length,
    porServicio,
  };
}

async function resumenPerfilNegocio() {
  try {
    const [schema, answers] = await Promise.all([getSchema(), getAnswers()]);
    const campos = schema.flatMap((g) => g.fields);
    const completados = campos.filter((f) => (answers[f.key] ?? '').trim()).length;
    return { completados, total: campos.length };
  } catch {
    return { completados: 0, total: 0 };
  }
}

export async function GET() {
  const admin = await getSesionAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  try {
    const [usuarios, workspaces, perfilNegocio, integraciones] = await Promise.all([
      listarUsuarios(), listarWorkspaces(), resumenPerfilNegocio(), resumenIntegraciones(),
    ]);
    return NextResponse.json({
      ok: true,
      // ⚠️ EL HASH DE GRAVATAR SE CALCULA ACA Y NO EN EL NAVEGADOR, por lo mismo que
      // en /api/compartir: en el browser `crypto.subtle` es async y no vale la pena,
      // y sobre todo asi el email crudo NUNCA viaja en una URL a un tercero.
      //
      // Es lo unico que hay para tener la cara de alguien ANTES de su primer login:
      // `foto_url` la llena Google al entrar, asi que hasta entonces es NULL. Se pide
      // con `d=404` y la mayoria de la gente no tiene uno — por eso `Marca` cae a las
      // iniciales cuando la imagen no carga, en vez de dejar un <img> roto.
      // `cara` es la que se DIBUJA (foto elegida > Gravatar > nada) y `gravatar` la
      // que hay detrás. Viajan las dos: la primera es la respuesta y la segunda es lo
      // que deja saber si esa cara es suya o sólo la de su email.
      usuarios: usuarios.map((u) => ({ ...u, gravatar: urlGravatar(u.email), cara: caraDeUsuario(u) })),
      workspaces,
      resumen: { integraciones, perfilNegocio },
      // Solo la cookie compartida real dispara el aviso "sesión vieja" — no la
      // sesión dev-admin de local (sub 'dev'), que también lleva legacy:true.
      sesion: { email: admin.email, legacy: admin.sub === 'legacy' },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}

type Body = {
  action?: string;
  id?: number;
  email?: string;
  nombre?: string;
  rol?: Rol;
  rol_ws?: RolWorkspace | null;
  estado?: EstadoUsuario;
  workspace_id?: number | null;
  /** La URL que devolvió /api/portadas. Vacía o ausente = quitarle la foto elegida. */
  foto_url?: string;
};

// true si tocar (bajar de rol / suspender / borrar) a este usuario dejaría a la
// AGENCIA sin ningún admin activo.
async function dejariaSinAdmins(u: Usuario): Promise<boolean> {
  if (u.rol !== 'admin' || u.estado === 'suspendido') return false;
  return (await contarAdminsActivos()) <= 1;
}

// true si tocar a este usuario dejaría a su CLIENTE sin ningún admin-cliente
// activo. `nuevoRolWs` = rol que quedaría tras el cambio (undefined = suspender/borrar).
async function dejariaClienteSinAdmin(u: Usuario, nuevoRolWs?: RolWorkspace | null): Promise<boolean> {
  if (u.rol !== 'usuario' || u.rol_ws !== 'admin' || u.estado === 'suspendido' || u.workspace_id == null) return false;
  if (nuevoRolWs === 'admin') return false; // sigue siendo admin del cliente
  return (await contarAdminsClienteActivos(u.workspace_id)) <= 1;
}

export async function POST(req: NextRequest) {
  const admin = await getSesionAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 });
  }

  try {
    const usuarios = await listarUsuarios();
    const objetivo = typeof body.id === 'number' ? usuarios.find((u) => u.id === body.id) : undefined;

    switch (body.action) {
      case 'crear': {
        const email = (body.email ?? '').trim().toLowerCase();
        if (!EMAIL_RE.test(email)) return NextResponse.json({ ok: false, error: 'Email inválido.' }, { status: 400 });
        if (usuarios.some((u) => u.email === email)) {
          return NextResponse.json({ ok: false, error: 'Ya existe un usuario con ese email.' }, { status: 400 });
        }
        const rol: Rol = body.rol === 'admin' ? 'admin' : 'usuario';
        const invitadoPor = admin.legacy ? 'admin' : (admin.email || 'admin');
        // Un usuario (no admin) tiene que pertenecer a un workspace.
        const wsId = typeof body.workspace_id === 'number' ? body.workspace_id : null;
        // rol dentro del negocio: admin de agencia → null; usuario-cliente → el
        // rol pedido (default 'admin', el dueño del negocio).
        const rolWs: RolWorkspace | null = rol === 'admin'
          ? null
          : (body.rol_ws && ROLES_WS.includes(body.rol_ws) ? body.rol_ws : 'admin');
        const nuevo = await crearUsuario({ email, nombre: body.nombre, rol, invitado_por: invitadoPor, workspace_id: rol === 'admin' ? null : wsId, rol_ws: rolWs });
        // Mismo criterio que el alta de un cliente: crear la fila sin avisarle a nadie
        // deja a una persona con cuenta y sin forma de enterarse de que la tiene.
        const invitacion = await invitarPorEmail({
          email, nombre: body.nombre, rolWs,
          workspace: wsId != null ? (await listarWorkspaces()).find((w) => w.id === wsId)?.nombre : undefined,
        });
        return NextResponse.json({ ok: true, usuario: nuevo, invitacion });
      }

      case 'workspace': {
        if (!objetivo) return NextResponse.json({ ok: false, error: 'usuario no encontrado' }, { status: 404 });
        const wsId = typeof body.workspace_id === 'number' ? body.workspace_id : null;
        // Mover/desasignar al único admin-cliente lo sacaría de su workspace y lo
        // dejaría sin ningún admin de cliente.
        if (wsId !== objetivo.workspace_id && (await dejariaClienteSinAdmin(objetivo))) {
          return NextResponse.json({ ok: false, error: 'Es el único admin de ese cliente — asigna otro admin antes.' }, { status: 400 });
        }
        // Al asignar a un cliente, un usuario sin rol de negocio queda como admin
        // de ese cliente (el rol se puede bajar después desde el equipo).
        const patch: { workspace_id: number | null; rol_ws?: RolWorkspace } = { workspace_id: wsId };
        if (wsId != null && objetivo.rol_ws == null) patch.rol_ws = 'admin';
        const movido = await actualizarUsuario(objetivo.id, patch);
        await revocarAgenteTokensDe(objetivo.email);
        return NextResponse.json({ ok: true, usuario: movido });
      }

      case 'rolws': {
        if (!objetivo) return NextResponse.json({ ok: false, error: 'usuario no encontrado' }, { status: 404 });
        const rolWs = body.rol_ws;
        if (!rolWs || !ROLES_WS.includes(rolWs)) return NextResponse.json({ ok: false, error: 'rol_ws inválido' }, { status: 400 });
        if (objetivo.rol !== 'usuario' || objetivo.workspace_id == null) {
          return NextResponse.json({ ok: false, error: 'El rol de equipo solo aplica a usuarios de un cliente.' }, { status: 400 });
        }
        if (await dejariaClienteSinAdmin(objetivo, rolWs)) {
          return NextResponse.json({ ok: false, error: 'Es el único admin de ese cliente — asigna otro admin antes.' }, { status: 400 });
        }
        const conRol = await actualizarUsuario(objetivo.id, { rol_ws: rolWs });
        if (rolWs !== 'admin') await revocarAgenteTokensDe(objetivo.email);
        return NextResponse.json({ ok: true, usuario: conRol });
      }

      case 'nombre': {
        if (!objetivo) return NextResponse.json({ ok: false, error: 'usuario no encontrado' }, { status: 404 });
        return NextResponse.json({ ok: true, usuario: await actualizarUsuario(objetivo.id, { nombre: (body.nombre ?? '').trim() }) });
      }

      /**
       * Su foto. `null` la quita — y quitarla NO deja a la persona sin cara: vuelve la
       * de su Gravatar, que es la que estaba antes de que alguien eligiera otra. Por eso
       * el respaldo se calcula al leer (`caraDeUsuario`) y no se copia a la columna: si
       * se copiara, «quitar» no tendría a dónde volver.
       */
      case 'foto': {
        if (!objetivo) return NextResponse.json({ ok: false, error: 'usuario no encontrado' }, { status: 404 });
        const url = typeof body.foto_url === 'string' ? body.foto_url.trim() : '';
        return NextResponse.json({ ok: true, usuario: await actualizarUsuario(objetivo.id, { foto_url: url || null }) });
      }

      // Volver a mandarle el acceso. Hace falta aunque el envío sea automático: el mail
      // se pierde, cae en spam, o el alta se hizo el día que el remitente no estaba
      // configurado. Sin este botón la única salida es borrar la cuenta y recrearla.
      case 'reinvitar': {
        if (!objetivo) return NextResponse.json({ ok: false, error: 'usuario no encontrado' }, { status: 404 });
        const ws = objetivo.workspace_id != null
          ? (await listarWorkspaces()).find((w) => w.id === objetivo.workspace_id)?.nombre
          : undefined;
        const invitacion = await invitarPorEmail({
          email: objetivo.email, nombre: objetivo.nombre, workspace: ws,
          rolWs: objetivo.rol_ws,
        });
        return NextResponse.json({ ok: true, invitacion });
      }

      case 'rol': {
        if (!objetivo) return NextResponse.json({ ok: false, error: 'usuario no encontrado' }, { status: 404 });
        const rol: Rol = body.rol === 'admin' ? 'admin' : 'usuario';
        if (rol !== 'admin' && (await dejariaSinAdmins(objetivo))) {
          return NextResponse.json({ ok: false, error: 'Es el único admin activo — asigna otro admin antes.' }, { status: 400 });
        }
        const conRolGlobal = await actualizarUsuario(objetivo.id, { rol });
        if (rol !== 'admin') await revocarAgenteTokensDe(objetivo.email);
        return NextResponse.json({ ok: true, usuario: conRolGlobal });
      }

      case 'estado': {
        if (!objetivo) return NextResponse.json({ ok: false, error: 'usuario no encontrado' }, { status: 404 });
        const estado = body.estado;
        if (estado !== 'activo' && estado !== 'suspendido' && estado !== 'invitado') {
          return NextResponse.json({ ok: false, error: 'estado inválido' }, { status: 400 });
        }
        if (estado === 'suspendido') {
          if (await dejariaSinAdmins(objetivo)) return NextResponse.json({ ok: false, error: 'Es el único admin activo — asigna otro admin antes.' }, { status: 400 });
          if (await dejariaClienteSinAdmin(objetivo)) return NextResponse.json({ ok: false, error: 'Es el único admin de ese cliente — asigna otro admin antes.' }, { status: 400 });
        }
        const conEstado = await actualizarUsuario(objetivo.id, { estado });
        if (estado === 'suspendido') await revocarAgenteTokensDe(objetivo.email);
        return NextResponse.json({ ok: true, usuario: conEstado });
      }

      case 'eliminar': {
        if (!objetivo) return NextResponse.json({ ok: false, error: 'usuario no encontrado' }, { status: 404 });
        if (await dejariaSinAdmins(objetivo)) {
          return NextResponse.json({ ok: false, error: 'Es el único admin activo — asigna otro admin antes.' }, { status: 400 });
        }
        if (await dejariaClienteSinAdmin(objetivo)) {
          return NextResponse.json({ ok: false, error: 'Es el único admin de ese cliente — asigna otro admin antes.' }, { status: 400 });
        }
        await eliminarUsuario(objetivo.id);
        await revocarAgenteTokensDe(objetivo.email);
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
