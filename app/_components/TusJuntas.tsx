// =============================================================================
// TusJuntas — J1/J2 de hoy y mañana con contexto (Fase 11 → movido en v3 Fase G)
// =============================================================================
// Componente de presentación (server). Vivía en Vista General; en v3 pasó al
// tab Pendientes junto con el resto de lo operativo.

import Link from 'next/link';
import type { JuntaProxima } from '@/lib/queries';

export function TusJuntas({ juntas }: { juntas: JuntaProxima[] }) {
  return (
    <section>
      <h2 className="text-[28px] mb-3" style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500 }}>
        Tus reuniones
      </h2>
      {juntas.length === 0 ? (
        <p className="text-base" style={{ color: 'var(--text-dim)' }}>Sin reuniones hoy ni mañana.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {juntas.map((j) => (
            <JuntaCard key={`${j.lead_id}-${j.tipo}-${j.fecha}`} junta={j} />
          ))}
        </div>
      )}
    </section>
  );
}

function JuntaCard({ junta }: { junta: JuntaProxima }) {
  const respuestas = [
    { label: 'Facturación', value: junta.respuestas.facturacion },
    { label: 'Equipo', value: junta.respuestas.colaboradores },
    { label: 'Objetivo', value: junta.respuestas.objetivo },
    { label: 'Cuándo', value: junta.respuestas.cuando_empezar },
  ].filter((r) => r.value && r.value.trim());

  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <div className="flex items-center gap-2">
          <span
            className="px-2.5 py-1 rounded-full text-sm font-semibold"
            style={{
              background: junta.tipo === 'J1' ? 'rgba(240,198,10,0.15)' : 'rgba(62,207,142,0.15)',
              color: junta.tipo === 'J1' ? 'var(--accent-yellow)' : 'var(--accent-green)',
            }}
          >
            {junta.tipo === 'J1' ? 'R1' : 'R2'} · {junta.dia}
          </span>
          {junta.vsl_estado === 'sin_ver' ? (
            <span
              className="px-2.5 py-1 rounded-full text-sm font-semibold"
              style={{ background: 'rgba(255,107,53,0.15)', color: 'var(--accent-orange)' }}
            >
              ⚠ agendó sin ver el VSL
            </span>
          ) : junta.vsl_estado === 'vio' ? (
            <span className="text-sm" style={{ color: 'var(--text-dim)' }}>
              vio el VSL{junta.vsl_max_pct !== null ? ` hasta ${junta.vsl_max_pct}%` : ` ${junta.vsl_plays}×`}
            </span>
          ) : (
            <span className="text-sm" style={{ color: 'var(--text-pending)' }}>
              sin datos de VSL
            </span>
          )}
        </div>
        <Link href={`/leads/${junta.lead_id}`} className="text-sm" style={{ color: 'var(--primary)' }}>
          Abrir ficha →
        </Link>
      </div>

      <div className="text-xl" style={{ fontWeight: 600 }}>{junta.nombre}</div>
      <div className="text-base mb-3" style={{ color: 'var(--text-dim)' }}>
        {junta.empresa ?? 'Sin empresa'} · de {junta.origen}
      </div>

      {respuestas.length > 0 ? (
        <div className="space-y-1.5">
          {respuestas.map((r) => (
            <div key={r.label} className="text-base">
              <span className="text-sm uppercase tracking-wider mr-2" style={{ color: 'var(--text-dim)' }}>
                {r.label}
              </span>
              <span>{r.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-pending)' }}>
          Sin respuestas del formulario (lead manual u orgánico).
        </p>
      )}
    </div>
  );
}
