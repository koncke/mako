'use client';

// =============================================================================
// GrabarEnFrio — «Grabar llamada» de la hoja Cold Calling: elegir el lead y grabar con la MISMA grabadora de la ficha
// =============================================================================
// Martín, 04/11/2026: «un dashboard template que sea "Call Calling"», con el botón de grabar de la ficha del lead. En la hoja no hay
// un lead abierto, así que primero se busca (como el buscador del CRM del teléfono: GET /api/crm/llamadas-grabadas?buscar=, que llama
// a `buscarLeads`) y después va el panel de siempre (`PanelGrabar`, con origen «cold-calling»): el aviso de que se graba, lo que no se
// puede grabar en este aparato, cortar y «¿Cómo terminó?». Lo que graba es la grabadora del módulo: cerrar esto no corta la llamada.
//
// Lo que no se ve en la firma:
//   · Si ya se está grabando, abre en ESE lead: buscar otro mientras una llamada sigue no tiene salida (el panel dice «córtala»).
//   · «Otro lead» se ofrece sólo con la grabadora libre o cerrada, para la siguiente llamada de la tanda.
//   · Buscar menos de 2 letras no pide nada (MIN_BUSQUEDA de app/m/crm/reglas.ts): «a» trae media cartera.
// =============================================================================

import { useEffect, useState } from 'react';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { PanelGrabar } from './GrabarLlamada';
import { useGrabadora } from './grabadora';
import { boton } from './piezas';

const RUTA = '/api/crm/llamadas-grabadas';
/** Lo mismo que `MIN_BUSQUEDA` (app/m/crm/reglas.ts): el server tampoco busca con menos. */
const MIN = 2;

type Encontrado = { id: number; nombre: string; segunda: string | null };

/**
 * `inicial` (10/11/2026, «Velocidad de llamada»): el lead que ya se eligió en la hoja (el «Llamar» de una tarjeta). Si ya se está
 * grabando a otro, manda la llamada en curso, como siempre.
 */
export function GrabarEnFrio({ inicial = null }: { inicial?: { id: number; nombre: string } | null } = {}) {
  const g = useGrabadora();
  const enCurso = g.leadId != null && (g.fase === 'pidiendo' || g.fase === 'grabando' || g.fase === 'cerrando');
  const [lead, setLead] = useState<{ id: number; nombre: string } | null>(enCurso ? { id: g.leadId!, nombre: g.leadNombre ?? '' } : inicial);
  const [q, setQ] = useState('');
  const [filas, setFilas] = useState<Encontrado[] | null>(null);
  const [hayMas, setHayMas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const texto = q.trim();
    if (texto.length < MIN) { setFilas(null); setError(null); return; }
    let vivo = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${RUTA}?buscar=${encodeURIComponent(texto)}`, { signal: AbortSignal.timeout(20_000) });
        const j = (await r.json().catch(() => null)) as { ok?: boolean; filas?: Encontrado[]; hayMas?: boolean; error?: string } | null;
        if (!vivo) return;
        if (!r.ok || !j?.ok) { setError(j?.error ?? 'No pude buscar los leads.'); setFilas(null); return; }
        setError(null); setFilas(j.filas ?? []); setHayMas(!!j.hayMas);
      } catch {
        if (vivo) { setError('No pude buscar los leads. Revisa tu conexión.'); setFilas(null); }
      }
    }, 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [q]);

  if (lead) {
    const libre = g.fase === 'libre' || g.fase === 'cerrada' || g.leadId !== lead.id;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 650, color: 'var(--ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lead.nombre || `Lead #${lead.id}`}
          </span>
          {libre && <button type="button" style={boton('claro')} onClick={() => { setLead(null); setQ(''); setFilas(null); }}>Otro lead</button>}
        </div>
        <PanelGrabar leadId={lead.id} leadNombre={lead.nombre} origen="cold-calling" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input
        type="search" value={q} data-autofocus placeholder="Busca el lead por nombre, teléfono o email" aria-label="Buscar el lead"
        onChange={(e) => setQ(e.target.value)}
        style={{ height: 40, padding: '0 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', font: 'inherit', fontSize: 14 }}
      />
      {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--bad)' }}>{error}<ReportarASoporte /></p>}
      {filas && !filas.length && !error && <p style={{ margin: 0, fontSize: 13, color: 'var(--dim)' }}>Ningún lead se llama así.</p>}
      {filas && filas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 320, overflowY: 'auto' }}>
          {filas.map((f) => (
            <button
              key={f.id} type="button" onClick={() => setLead({ id: f.id, nombre: f.nombre })}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '9px 10px', border: 0, borderBottom: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', textAlign: 'left', font: 'inherit' }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{f.nombre}</span>
              {f.segunda && <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>{f.segunda}</span>}
            </button>
          ))}
          {hayMas && <span style={{ padding: '8px 10px', fontSize: 12.5, color: 'var(--faint)' }}>Hay más: escribe un poco más del nombre.</span>}
        </div>
      )}
    </div>
  );
}
