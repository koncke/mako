// =============================================================================
// /api/admin/workspaces — clientes/workspaces (solo admin)
// =============================================================================
// GET  → lista de workspaces + cuántos usuarios tiene cada uno.
// POST → { action: 'crear', nombre } | { action: 'nombre'|'estado'|'capa'|'cara', id, ... }.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { actualizarWorkspace, crearWorkspace, listarWorkspaces, runWithWorkspace } from '@/lib/workspace';
import { crearUsuario, listarUsuarios } from '@/lib/usuarios';
import { getSupabaseServer } from '@/lib/supabase';
import { setSetting } from '@/lib/settings';
import { estadoInicial, setEstadoOnboarding } from '@/lib/onboarding-state';
import { hoyEnTijuana } from '@/lib/date-utils';
            // Un cliente nuevo ya NO arranca con secuencias sembradas.
import { CAPA_DEFAULT, capaDef, esCapaValida } from '@/lib/capas';
import { invitarPorEmail, type ResultadoInvitacion } from '@/lib/invitaciones';
import { saneaPortada, saneaIcono, yPortada } from '@/lib/portadas';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  try {
    const [workspaces, usuarios] = await Promise.all([listarWorkspaces(), listarUsuarios()]);
    const conteo = new Map<number, number>();
    for (const u of usuarios) if (u.workspace_id != null) conteo.set(u.workspace_id, (conteo.get(u.workspace_id) ?? 0) + 1);
    return NextResponse.json({
      ok: true,
      workspaces: workspaces.map((w) => ({ ...w, usuarios: conteo.get(w.id) ?? 0 })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}

type Body = {
  action?: string; id?: number; nombre?: string; estado?: 'activo' | 'pausado'; capa?: string;
  adminEmail?: string; adminNombre?: string;
  /** La cara del cliente (mig 0179). `null` en cualquiera = volver al default. */
  portada?: string | null; portadaY?: number | null; icono?: string | null; avatarY?: number | null;
};

export async function POST(req: NextRequest) {
  const admin = await getSesionAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });

  let body: Body;
  try { body = (await req.json()) as Body; } catch { return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    switch (body.action) {
      case 'crear': {
        const nombre = (body.nombre ?? '').trim();
        if (nombre.length < 2) return NextResponse.json({ ok: false, error: 'Pon un nombre de cliente.' }, { status: 400 });
        const adminEmail = (body.adminEmail ?? '').trim().toLowerCase();
        // ⚠️ EL EMAIL ES OBLIGATORIO DESDE EL 27/09/2026: «el email NO puede ser
        // opcional… si justamente le llega la invitación por ahí». Sin él, esto
        // creaba un workspace SIN UNA SOLA FILA en `usuarios`: un cliente al que
        // nadie podía entrar, que no recibía nada, y que sólo se podía usar
        // entrando como él desde acá. Un alta que no da acceso no es un alta.
        //
        // Y borra una asimetría: las otras dos puertas —/api/admin/usuarios y
        // /api/equipo— ya lo exigían. Era ésta la rara.
        if (!adminEmail) return NextResponse.json({ ok: false, error: 'Pon el email de su admin: por ahí le llega el acceso.' }, { status: 400 });
        if (!EMAIL_RE.test(adminEmail)) return NextResponse.json({ ok: false, error: 'Email del admin inválido.' }, { status: 400 });
        // Se chequea ANTES de crear el workspace: evita dejar uno huérfano por un
        // email duplicado, que es un alta a medias que nadie limpia.
        {
          const existe = (await listarUsuarios()).some((u) => u.email === adminEmail);
          if (existe) return NextResponse.json({ ok: false, error: 'Ya existe un usuario con ese email.' }, { status: 400 });
        }
        const capa = (body.capa ?? CAPA_DEFAULT).trim();
        if (!esCapaValida(capa)) return NextResponse.json({ ok: false, error: 'Elige un tipo de cliente válido.' }, { status: 400 });
        const def = capaDef(capa);
        const ws = await crearWorkspace(nombre, capa);
        // Seed inicial del workspace, SEGÚN LA CAPA: solo se siembra lo que el
        // cliente compró. A uno de Project Manager no le sirve una secuencia de
        // nutrición ni un objetivo de cierres — no tiene ni ads ni CRM.
        try {
          await runWithWorkspace(ws.id, async () => {
            await setEstadoOnboarding(estadoInicial('pending'));
            if (def.integracionesRequeridas.includes('meta')) {
              // objetivo_desde ancla el progreso del objetivo en /general; sin
              // esto usaría la fecha de arranque del dueño.
              await setSetting('objetivo_desde', hoyEnTijuana());
            }
          });
        } catch (e) {
          console.error('[admin/workspaces] seed onboarding falló (no fatal):', e);
        }
        // Crear el usuario admin-del-cliente en el mismo paso. Si falla, revertir
        // el workspace para no dejar basura.
        let invitacion: ResultadoInvitacion | null = null;
        if (adminEmail) {
          const invitadoPor = admin.legacy ? 'admin' : (admin.email || 'admin');
          try {
            await crearUsuario({ email: adminEmail, nombre: body.adminNombre, rol: 'usuario', rol_ws: 'admin', workspace_id: ws.id, invitado_por: invitadoPor });
          } catch (e) {
            await getSupabaseServer().from('workspaces').delete().eq('id', ws.id);
            return NextResponse.json({ ok: false, error: `No se pudo crear el admin del cliente: ${e instanceof Error ? e.message : e}` }, { status: 500 });
          }
          // ⚠️ EL MAIL VA DESPUÉS DEL ALTA Y NO LA PUEDE DESHACER. Si Resend falla, el
          // cliente YA existe y su fila YA lo autoriza a entrar: revertir un alta buena
          // por un mail que no salió es peor que el mail que no salió. Lo que sí tiene
          // que pasar es que quien lo dio de alta se entere EN LA PANTALLA y pueda pasar
          // el link a mano — un aviso que solo va a los logs no frena nada.
          invitacion = await invitarPorEmail({
            email: adminEmail,
            nombre: body.adminNombre,
            workspace: ws.nombre,
            rolWs: 'admin',
          });
        }
        return NextResponse.json({ ok: true, workspace: ws, invitacion });
      }
      case 'nombre': {
        if (typeof body.id !== 'number') return NextResponse.json({ ok: false, error: 'id inválido' }, { status: 400 });
        return NextResponse.json({ ok: true, workspace: await actualizarWorkspace(body.id, { nombre: (body.nombre ?? '').trim() }) });
      }
      case 'estado': {
        if (typeof body.id !== 'number') return NextResponse.json({ ok: false, error: 'id inválido' }, { status: 400 });
        if (body.estado !== 'activo' && body.estado !== 'pausado') return NextResponse.json({ ok: false, error: 'estado inválido' }, { status: 400 });
        return NextResponse.json({ ok: true, workspace: await actualizarWorkspace(body.id, { estado: body.estado }) });
      }
      // Cambiar de capa = el cliente pasa a otra oferta (subir o bajar de nivel).
      // Solo mueve la columna: las tabs, el onboarding y los seeds se derivan de
      // ella en cada request, así que el cambio se ve en el próximo load.
      case 'capa': {
        if (typeof body.id !== 'number') return NextResponse.json({ ok: false, error: 'id inválido' }, { status: 400 });
        const capa = (body.capa ?? '').trim();
        if (!esCapaValida(capa)) return NextResponse.json({ ok: false, error: 'Tipo de cliente inválido.' }, { status: 400 });
        return NextResponse.json({ ok: true, workspace: await actualizarWorkspace(body.id, { capa }) });
      }
      /**
       * LA CARA del cliente: su portada, su marca y los dos encuadres (mig 0179).
       *
       * ⚠️ EL SANEO ES EL MISMO QUE EL DE UN LEAD Y EL DE UN PROYECTO, importado y no
       * reescrito (`lib/portadas.ts`): `saneaPortada` y `urlDeImagenOk` comparan
       * `new URL(v).origin` contra una lista blanca —nunca un prefijo, que es el bug
       * que AGENTS.md tiene medido con los cuatro parecidos de `flow.google.com`— y
       * `yPortada` topea el encuadre en 0-100. Tres saneos para el mismo formato serían
       * tres listas blancas, y la que se queda vieja es por donde entra una imagen de
       * un tercero cargándose con el referer del cliente.
       *
       * ⚠️ Y EL ENCUADRE SE BORRA CUANDO CAMBIA LA IMAGEN, igual que en la ficha de un
       * cliente: un `y` de la foto anterior aplicado a una foto nueva la deja encuadrada
       * en cualquier lado y quien la eligió no tiene forma de saber por qué. Si el que
       * llama manda las dos cosas juntas, gana lo que mandó.
       */
      case 'cara': {
        if (typeof body.id !== 'number') return NextResponse.json({ ok: false, error: 'id inválido' }, { status: 400 });
        const patch: Record<string, unknown> = {};
        if (body.portada !== undefined) patch.portada = saneaPortada(body.portada);
        if (body.portada !== undefined && body.portadaY === undefined) patch.portada_y = null;
        if (body.icono !== undefined) patch.icono = saneaIcono(body.icono);
        if (body.icono !== undefined && body.avatarY === undefined) patch.avatar_y = null;
        if (body.portadaY !== undefined) patch.portada_y = yPortada(body.portadaY);
        if (body.avatarY !== undefined) patch.avatar_y = yPortada(body.avatarY);
        if (!Object.keys(patch).length) return NextResponse.json({ ok: false, error: 'no había nada que cambiar' }, { status: 400 });
        // Se devuelve LO QUE QUEDÓ GUARDADO y no lo que se pidió: si el saneo descartó
        // la URL, la pantalla tiene que enterarse en vez de pintar algo que no está.
        return NextResponse.json({ ok: true, workspace: await actualizarWorkspace(body.id, patch) });
      }
      default:
        return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
