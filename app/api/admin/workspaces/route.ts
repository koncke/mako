// =============================================================================
// /api/admin/workspaces — clientes/workspaces (solo admin)
// =============================================================================
// GET  → lista de workspaces + cuántos usuarios tiene cada uno.
// POST → { action: 'crear', nombre } | { action: 'nombre'|'estado'|'capa'|'cara', id, ... }.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { actualizarWorkspace, listarWorkspaces, runWithWorkspace, getWorkspace, wsSuperAdmin, getWorkspaceActual } from '@/lib/workspace';
import { listarUsuarios } from '@/lib/usuarios';
import { getSupabaseServer } from '@/lib/supabase';
import { leerTodo } from '@/lib/supabase-paginado';
            // Un cliente nuevo ya NO arranca con secuencias sembradas.
import { CAPA_DEFAULT, esCapaValida, CAPAS_VENDIBLES, type CapaId } from '@/lib/capas';
import { avisarCambioDePlan } from '@/lib/aviso-plan';
import { darDeAltaCliente } from '@/lib/alta-cliente';
import { saneaPortada, saneaIcono, yPortada } from '@/lib/portadas';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  try {
    /**
     * ⚠️ LOS CLIENTES SE LEEN CON EL CLIENTE CRUDO Y NO CON `getTenantDb()`. `leads` está
     * en TENANT_TABLES, así que el tenant client filtraría por el workspace del REQUEST y
     * devolvería sólo los 3 del super admin — en silencio, con el resto en cero. Acá el
     * panel es de la plataforma y la pregunta es «cuántos tiene CADA UNO».
     *
     * ⚠️ Y PAGINADO. PostgREST corta en 1000 filas sin decir nada, y hay 1.524 leads:
     * con un `select` pelado, los workspaces cuyos leads caen después del corte
     * aparecerían con menos clientes de los que tienen y nadie lo notaría.
     */
    const [workspaces, usuarios, ganados] = await Promise.all([
      listarWorkspaces(),
      listarUsuarios(),
      leerTodo<{ workspace_id: number | null }>(
        getSupabaseServer(), 'leads', 'workspace_id',
        { orden: 'id', eq: { estado_lead: 'ganado' } },
      ),
    ]);
    const conteo = new Map<number, number>();
    for (const u of usuarios) if (u.workspace_id != null) conteo.set(u.workspace_id, (conteo.get(u.workspace_id) ?? 0) + 1);
    const conClientes = new Map<number, number>();
    for (const l of ganados) if (l.workspace_id != null) conClientes.set(l.workspace_id, (conClientes.get(l.workspace_id) ?? 0) + 1);
    return NextResponse.json({
      ok: true,
      workspaces: workspaces.map((w) => ({
        ...w,
        usuarios: conteo.get(w.id) ?? 0,
        clientes: conClientes.get(w.id) ?? 0,
      })),
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
        // El alta vive en lib/alta-cliente.ts desde el 11/10/2026: la llaman este panel y el pago de
        // un plan de MaKo (lib/cobros.ts). El orden ya pagado (email único antes de escribir, seed en
        // runWithWorkspace, rollback del usuario, mail no fatal) está escrito allá, con su porqué.
        const r = await darDeAltaCliente({
          nombre: body.nombre ?? '',
          capa: (body.capa ?? CAPA_DEFAULT).trim(),
          adminEmail: body.adminEmail ?? '',
          adminNombre: body.adminNombre,
          invitadoPor: admin.legacy ? 'admin' : (admin.email || 'admin'),
        });
        if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
        return NextResponse.json({ ok: true, workspace: r.workspace, invitacion: r.invitacion });
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
        /**
         * ⚠️ `CAPAS_VENDIBLES` Y NO `esCapaValida`, que dejaba pasar `superadmin`. Esa capa
         * no es un plan: es CÓMO SE IDENTIFICA LA PLATAFORMA (`wsSuperAdmin()` toma el
         * menor id con esa capa), así que ponérsela a un cliente le muda a su workspace
         * las credenciales y el remitente de MaKo. El menú ya no la ofrece desde el 28/09
         * — pero el menú no es el guard, y esta ruta la aceptaba igual.
         */
        if (!esCapaValida(capa) || !CAPAS_VENDIBLES.some((c) => c.id === capa)) {
          return NextResponse.json({ ok: false, error: 'Ese no es un plan que se pueda asignar.' }, { status: 400 });
        }
        // Y al revés: tampoco se le cambia el plan A la plataforma.
        if (body.id === (await wsSuperAdmin())) {
          return NextResponse.json({ ok: false, error: 'Ese es el espacio de la plataforma: no tiene plan.' }, { status: 400 });
        }

        const antes = await getWorkspace(body.id);
        if (!antes) return NextResponse.json({ ok: false, error: 'ese cliente ya no está' }, { status: 404 });
        // Un mail que dice «tu plan cambió» sobre algo que no cambió es ruido, y el ruido
        // enseña a ignorar los mails que sí importan.
        if (antes.capa === capa) return NextResponse.json({ ok: true, workspace: antes, aviso: null });

        const workspace = await actualizarWorkspace(body.id, { capa });

        /**
         * ⚠️ EL MAIL VA DESPUÉS Y NO PUEDE TUMBAR EL CAMBIO. Ya está escrito en la base:
         * devolver un 500 porque se cayó Resend haría que la pantalla muestre un error
         * sobre algo que SÍ pasó, y el próximo click lo intentaría de nuevo. El resultado
         * del envío viaja en `aviso` y lo pinta quien llamó.
         */
        let aviso = null;
        try {
          aviso = await avisarCambioDePlan({
            ws: body.id, nombreWs: antes.nombre,
            capaAntes: antes.capa as CapaId, capaAhora: capa,
          });
        } catch (e) {
          aviso = { enviado: false, error: e instanceof Error ? e.message : String(e) };
        }
        return NextResponse.json({ ok: true, workspace, aviso });
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
      /**
       * BORRAR UN CLIENTE. Es lo más destructivo de la app y no tiene vuelta atrás.
       *
       * ⚠️ EL `import()` ES DINÁMICO a propósito, como en datos-mau: el módulo arrastra
       * el vaciador y la cartera, y no hay razón para que eso entre al bundle de una
       * ruta que casi siempre hace otra cosa.
       *
       * ⚠️ Y EL 400 LLEVA EL MOTIVO TAL CUAL. `motivoNoEliminable` ya devuelve una frase
       * escrita para leerse; traducirla a «no se pudo» tira justo lo que la persona
       * necesita para decidir qué hacer.
       */
      case 'eliminar': {
        if (typeof body.id !== 'number') return NextResponse.json({ ok: false, error: 'id inválido' }, { status: 400 });
        const { eliminarWorkspace } = await import('@/lib/eliminar-workspace');
        const r = await eliminarWorkspace(body.id, String(body.nombre ?? ''), await getWorkspaceActual());
        if (!r.ok) return NextResponse.json(r, { status: 400 });
        return NextResponse.json(r);
      }

      default:
        return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
