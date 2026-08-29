// =============================================================================
// /admin/agente — en qué trabajan los clientes en SU Claude Code
// =============================================================================
// El objetivo declarado del dueño, textual: «saber en qué trabajan mis clientes y
// poder priorizar el desarrollo de funcionalidades que veo que son más demandadas, o
// incluso darles recomendaciones de prompting al ver que están usando mal Claude».
//
// ⚠️ ARRANCA SIN UNA SOLA LLAMADA DE IA, y es a propósito. La versión con
// clasificación automática por temas es cara, tarda, y hasta no tener sesiones reales
// no se sabe contra qué catálogo clasificar. Un feed ordenado por fecha con lo que
// escribió cada cliente ya contesta la primera pregunta el primer día — que es el
// mismo método con el que se armó docs/chats.md, y funcionó.
//
// ⚠️ CRUZA EL AISLAMIENTO POR WORKSPACE, Y ES EL ÚNICO LUGAR DEL SISTEMA DONDE ESO
// PASA. Lee con el cliente de SERVICIO, sin scope, porque el punto es ver a todos los
// clientes juntos. La misma tabla, leída por el CLIENTE en su propio panel, sí se
// scopea (está en TENANT_TABLES). Las dos lecturas existen y son distintas: gateado a
// super-admin con `getSesionAdmin`, igual que el resto de /admin.
// =============================================================================

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { getSupabaseServer } from '@/lib/supabase';
import { Pagina, PageHeader, EmptyState } from '@/app/_ui';
import { MONO } from '@/app/_ui/tokens';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Fila = {
  id: number;
  workspace_id: number;
  sesion_id: string;
  empezo_en: string | null;
  termino_en: string | null;
  acta: { titulo?: string; resumen?: string; turnos?: number; herramientas?: number } | null;
  turnos: Array<{ ts: string; texto: string }> | null;
  redacciones: number;
  created_at: string;
};

const cuando = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export default async function AgenteAdminPage() {
  if (!(await getSesionAdmin())) redirect('/');

  const svc = getSupabaseServer();
  // Sin scope de workspace, a propósito: ver el porqué en la cabecera.
  const [{ data: filas }, { data: wss }] = await Promise.all([
    svc.from('agente_sesiones').select('*').order('created_at', { ascending: false }).limit(200),
    svc.from('workspaces').select('id, nombre'),
  ]);

  const sesiones = (filas ?? []) as Fila[];
  const nombreWs = new Map(((wss ?? []) as Array<{ id: number; nombre: string }>).map((w) => [w.id, w.nombre]));

  // Cuántas sesiones por cliente: la respuesta más barata a «quién lo está usando».
  const porCliente = new Map<number, number>();
  for (const s of sesiones) porCliente.set(s.workspace_id, (porCliente.get(s.workspace_id) ?? 0) + 1);

  const totalTurnos = sesiones.reduce((a, s) => a + (s.turnos?.length ?? 0), 0);
  const totalRedacciones = sesiones.reduce((a, s) => a + (s.redacciones ?? 0), 0);

  return (
    <Pagina ancho="completo">
      <PageHeader titulo="Agente de los clientes" />

      {!sesiones.length ? (
        <EmptyState
          titulo="Todavía no reportó ningún agente"
          detalle="Cuando un cliente instale el plugin de MaKo en su Claude Code y acepte el reporte, cada sesión que cierre va a aparecer aquí."
        />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 26, marginBottom: 22, fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>
            <span><strong style={{ color: 'var(--ink)' }}>{sesiones.length}</strong> sesiones</span>
            <span><strong style={{ color: 'var(--ink)' }}>{porCliente.size}</strong> clientes</span>
            <span><strong style={{ color: 'var(--ink)' }}>{totalTurnos}</strong> mensajes</span>
            {/* Esta es la alarma, no una estadística: si sube, el filtro de «solo
                turnos humanos» está dejando pasar cosas y hay que mirar por qué. */}
            <span style={{ color: totalRedacciones > 0 ? 'var(--warn)' : 'var(--faint)' }}>
              {totalRedacciones} redacciones
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {sesiones.map((s) => (
              <article
                key={s.id}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}
              >
                <header style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                  <strong style={{ fontSize: 'var(--fs-card)', color: 'var(--ink)' }}>
                    {nombreWs.get(s.workspace_id) ?? `Workspace ${s.workspace_id}`}
                  </strong>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>
                    {cuando(s.empezo_en ?? s.created_at)}
                  </span>
                  {s.redacciones > 0 && (
                    <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--warn)' }}>
                      {s.redacciones} {s.redacciones === 1 ? 'redacción' : 'redacciones'}
                    </span>
                  )}
                </header>

                {s.acta?.titulo && (
                  <div style={{ fontSize: 'var(--fs-md)', color: 'var(--ink)', marginBottom: 6 }}>{s.acta.titulo}</div>
                )}
                {s.acta?.resumen && (
                  <p style={{ margin: '0 0 10px', fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55 }}>
                    {s.acta.resumen}
                  </p>
                )}

                {/* Los mensajes del cliente, que es donde se ve CÓMO prompea. Se
                    muestran los primeros: el que quiera el resto abre la sesión. */}
                {!!s.turnos?.length && (
                  <ol style={{ margin: 0, padding: '10px 0 0 18px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {s.turnos.slice(0, 6).map((t, i) => (
                      <li key={i} style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.5 }}>
                        {t.texto.length > 240 ? `${t.texto.slice(0, 240)}…` : t.texto}
                      </li>
                    ))}
                    {s.turnos.length > 6 && (
                      <li style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)' }}>
                        y {s.turnos.length - 6} mensajes más
                      </li>
                    )}
                  </ol>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </Pagina>
  );
}
