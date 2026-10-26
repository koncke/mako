// =============================================================================
// Agents — en qué trabajan los clientes en SU Claude Code (la pestaña Agents de Customers, 25/10/2026)
// =============================================================================
// Era la página /admin/agente. El objetivo declarado del dueño, textual: «saber en qué trabajan mis clientes y poder
// priorizar el desarrollo de funcionalidades que veo que son más demandadas, o incluso darles recomendaciones de
// prompting al ver que están usando mal Claude». Desde el 25/10 vive adentro de Customers (docs/feedback-25-10-tarde.md
// punto 12); /admin/agente redirige acá.
//
// ⚠️ ARRANCA SIN UNA SOLA LLAMADA DE IA, y es a propósito: un feed ordenado por fecha con lo que escribió cada cliente
// ya contesta la primera pregunta el primer día.
// ⚠️ CRUZA EL AISLAMIENTO POR WORKSPACE (lee con el cliente de SERVICIO, sin scope: el punto es ver a todos los clientes
// juntos). El guard de super admin lo pone quien la monta (app/customers/page.tsx), como el resto de lo de la plataforma.

// La lectura vive en lib/agente-sesiones.ts desde el 17/10/2026: la comparte el teléfono (app/m/agente).
import { leerSesionesAgente } from '@/lib/agente-sesiones';
import { EmptyState } from '@/app/_ui';
import { MONO } from '@/app/_ui/tokens';

const cuando = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export async function ContenidoAgentes() {
  // Sin scope de workspace, a propósito: ver el porqué en la cabecera.
  const { sesiones, nombreWs } = await leerSesionesAgente();

  // Cuántas sesiones por cliente: la respuesta más barata a «quién lo está usando».
  const porCliente = new Map<number, number>();
  for (const s of sesiones) porCliente.set(s.workspace_id, (porCliente.get(s.workspace_id) ?? 0) + 1);

  const totalTurnos = sesiones.reduce((a, s) => a + (s.turnos?.length ?? 0), 0);
  const totalRedacciones = sesiones.reduce((a, s) => a + (s.redacciones ?? 0), 0);

  if (!sesiones.length) {
    return (
      <EmptyState
        titulo="Todavía no reportó ningún agente"
        detalle="Cuando un cliente instale el plugin de MaKo en su Claude Code y acepte el reporte, cada sesión que cierre va a aparecer aquí."
      />
    );
  }
  return (
    <>
      <div style={{ display: 'flex', gap: 26, marginBottom: 22, fontSize: 'var(--fs-sm)', color: 'var(--dim)', flexWrap: 'wrap' }}>
        <span><strong style={{ color: 'var(--ink)' }}>{sesiones.length}</strong> sesiones</span>
        <span><strong style={{ color: 'var(--ink)' }}>{porCliente.size}</strong> clientes</span>
        <span><strong style={{ color: 'var(--ink)' }}>{totalTurnos}</strong> mensajes</span>
        {/* Esta es la alarma, no una estadística: si sube, el filtro de «solo turnos humanos» está dejando pasar cosas. */}
        <span style={{ color: totalRedacciones > 0 ? 'var(--warn)' : 'var(--faint)' }}>
          {totalRedacciones} redacciones
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sesiones.map((s) => (
          <article key={s.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
            <header style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
              <strong style={{ fontSize: 'var(--fs-card)', color: 'var(--ink)' }}>
                {nombreWs.get(s.workspace_id) ?? `Workspace ${s.workspace_id}`}
              </strong>
              <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{cuando(s.empezo_en ?? s.created_at)}</span>
              {s.redacciones > 0 && (
                <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--warn)' }}>
                  {s.redacciones} {s.redacciones === 1 ? 'redacción' : 'redacciones'}
                </span>
              )}
            </header>
            {s.acta?.titulo && <div style={{ fontSize: 'var(--fs-md)', color: 'var(--ink)', marginBottom: 6 }}>{s.acta.titulo}</div>}
            {s.acta?.resumen && (
              <p style={{ margin: '0 0 10px', fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55 }}>{s.acta.resumen}</p>
            )}
            {/* Los mensajes del cliente, que es donde se ve CÓMO prompea. Se muestran los primeros. */}
            {!!s.turnos?.length && (
              <ol style={{ margin: 0, padding: '10px 0 0 18px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {s.turnos.slice(0, 6).map((t, i) => (
                  <li key={i} style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.5 }}>
                    {t.texto.length > 240 ? `${t.texto.slice(0, 240)}…` : t.texto}
                  </li>
                ))}
                {s.turnos.length > 6 && <li style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)' }}>y {s.turnos.length - 6} mensajes más</li>}
              </ol>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
