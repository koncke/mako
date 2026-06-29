'use client';

// =============================================================================
// PendientesLists — listas interactivas del tab Pendientes (v3 Fase G)
// =============================================================================
// Tres listas con "Cargar más" (paginan de a 20, sin scroll infinito):
//   1) SinMarcarList — datos sin marcar (asistencias/resoluciones), oldest-first.
//   2) ColaList      — cobros, J2 sin match, no-shows a recontactar.
//   3) FormulariosList — instant forms sin agenda, con flujo de nutrición.
// =============================================================================

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { updateLeadAction } from '../leads/actions';
import { PendienteActions } from '../leads/PendienteActions';
import type { PendienteItem, ColaItem, FormSinAgenda } from '@/lib/queries';

const PAGINA = 20;

function useCargarMas<T>(items: T[]) {
  const [visibles, setVisibles] = useState(PAGINA);
  const mostrados = items.slice(0, visibles);
  const restantes = items.length - mostrados.length;
  const cargarMas = () => setVisibles((v) => v + PAGINA);
  return { mostrados, restantes, cargarMas };
}

function CargarMas({ restantes, onClick }: { restantes: number; onClick: () => void }) {
  if (restantes <= 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 px-4 py-2 rounded-lg border text-base"
      style={{ borderColor: 'var(--card-border)', color: 'var(--accent-yellow)' }}
    >
      Cargar más ({restantes} más)
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) Datos sin marcar — asistencias y resoluciones, los más viejos primero
// ─────────────────────────────────────────────────────────────────────────────
export function SinMarcarList({ items }: { items: PendienteItem[] }) {
  const { mostrados, restantes, cargarMas } = useCargarMas(items);
  if (items.length === 0) {
    return <p className="text-base" style={{ color: 'var(--accent-green)' }}>🟢 Todo marcado — el tablero lee datos frescos.</p>;
  }
  return (
    <div>
      <div className="space-y-2">
        {mostrados.map((p) => (
          <div
            key={`${p.lead_id}-${p.tipo}`}
            className="rounded-lg border p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
          >
            <div className="min-w-0">
              <Link href={`/leads/${p.lead_id}`} className="text-base font-medium" style={{ color: 'var(--accent-yellow)' }}>
                {p.lead_nombre}
              </Link>
              <div className="text-sm" style={{ color: 'var(--text-dim)' }}>{p.mensaje}</div>
            </div>
            <PendienteActions leadId={p.lead_id} tipo={p.tipo} motivoActual={null} />
          </div>
        ))}
      </div>
      <CargarMas restantes={restantes} onClick={cargarMas} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) Cola de acción — cobros, J2 sin match, no-shows
// ─────────────────────────────────────────────────────────────────────────────
const COLA_LABEL: Partial<Record<ColaItem['tipo'], string>> = {
  cobro_vencido: 'Cobranza',
  j2_sin_match: 'R2 sin match',
  noshow_recontactar: 'Recontactar no-shows',
};
const COLA_ORDEN: Array<ColaItem['tipo']> = ['cobro_vencido', 'j2_sin_match', 'noshow_recontactar'];

export function ColaList({ items }: { items: ColaItem[] }) {
  const { mostrados, restantes, cargarMas } = useCargarMas(items);
  if (items.length === 0) {
    return <p className="text-base" style={{ color: 'var(--accent-green)' }}>Nada urgente — todo al día.</p>;
  }
  return (
    <div>
      <div className="space-y-5">
        {COLA_ORDEN.map((tipo) => {
          const grupo = mostrados.filter((i) => i.tipo === tipo);
          if (grupo.length === 0) return null;
          return (
            <div key={tipo}>
              <div className="text-sm uppercase tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>
                {COLA_LABEL[tipo] ?? tipo} · {grupo.length}
              </div>
              <div className="space-y-2">
                {grupo.map((item, i) => (
                  <div
                    key={`${tipo}-${item.lead_id ?? 'x'}-${i}`}
                    className="rounded-lg border p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                    style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                  >
                    <div className="min-w-0">
                      <div className="text-base" style={{ fontWeight: 600 }}>{item.titulo}</div>
                      <div className="text-sm" style={{ color: 'var(--text-dim)' }}>{item.detalle}</div>
                    </div>
                    <Link
                      href={item.link}
                      className="shrink-0 px-4 py-2 rounded-lg border text-base text-center"
                      style={{ borderColor: 'var(--accent-yellow)', color: 'var(--accent-yellow)' }}
                    >
                      {item.accion} →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <CargarMas restantes={restantes} onClick={cargarMas} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) Formularios sin agenda — con flujo de nutrición + resolución
// ─────────────────────────────────────────────────────────────────────────────
export function FormulariosList({ items }: { items: FormSinAgenda[] }) {
  const { mostrados, restantes, cargarMas } = useCargarMas(items);
  if (items.length === 0) {
    return <p className="text-base" style={{ color: 'var(--accent-green)' }}>Sin formularios pendientes de agendar.</p>;
  }
  return (
    <div>
      <div className="space-y-2">
        {mostrados.map((f) => <FormularioCard key={f.lead_id} f={f} />)}
      </div>
      <CargarMas restantes={restantes} onClick={cargarMas} />
    </div>
  );
}

function FormularioCard({ f }: { f: FormSinAgenda }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nutri, setNutri] = useState(f.nutricion_realizada);
  const [resol, setResol] = useState<'perdido' | 'descalificado' | null>(null);
  const [motivo, setMotivo] = useState('');

  const guardar = (input: Parameters<typeof updateLeadAction>[1], optimisticNutri?: boolean) => {
    setError(null);
    if (optimisticNutri !== undefined) setNutri(optimisticNutri);
    startTransition(async () => {
      try {
        await updateLeadAction(f.lead_id, input);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        if (optimisticNutri !== undefined) setNutri(!optimisticNutri); // revertir
      }
    });
  };

  return (
    <div className="rounded-lg border p-4" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/leads/${f.lead_id}`} className="text-base font-medium" style={{ color: 'var(--accent-yellow)' }}>
            {f.nombre}
          </Link>
          <div className="text-sm" style={{ color: 'var(--text-dim)' }}>
            {f.empresa ? `${f.empresa} · ` : ''}dejó el form hace {f.dias} día{f.dias === 1 ? '' : 's'} y no agendó
            {f.origen ? ` · ${f.origen}` : ''}
          </div>
        </div>
        <Link
          href={`/leads/${f.lead_id}`}
          className="shrink-0 px-4 py-2 rounded-lg text-base text-center font-medium"
          style={{ background: 'var(--accent-yellow)', color: '#000' }}
        >
          Agendar / abrir ficha →
        </Link>
      </div>

      {/* Nutrición + resolución */}
      <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-x-4 gap-y-2" style={{ borderColor: 'var(--card-border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: 'var(--text-dim)' }}>¿Nutrición hecha?</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => guardar({ nutricion_realizada: !nutri }, !nutri)}
            className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50"
            style={{
              borderColor: nutri ? 'var(--accent-green)' : 'var(--card-border)',
              color: nutri ? 'var(--accent-green)' : 'var(--text-dim)',
              background: nutri ? '#0f1f17' : 'transparent',
            }}
          >
            {nutri ? '✓ Sí' : 'No'}
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm" style={{ color: 'var(--text-dim)' }}>Resolver:</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => guardar({ estado_lead: 'no_responde' })}
            className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50"
            style={{ borderColor: 'var(--text-pending)', color: 'var(--text-pending)' }}
          >
            No responde
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setResol(resol === 'perdido' ? null : 'perdido')}
            className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50"
            style={{ borderColor: resol === 'perdido' ? 'var(--accent-orange)' : 'var(--card-border)', color: resol === 'perdido' ? 'var(--accent-orange)' : 'var(--text-dim)' }}
          >
            Perdido
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setResol(resol === 'descalificado' ? null : 'descalificado')}
            className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50"
            style={{ borderColor: resol === 'descalificado' ? 'var(--text-dim)' : 'var(--card-border)', color: 'var(--text-dim)' }}
          >
            Descalificado
          </button>
        </div>

        {resol && (
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo (opcional)"
              className="px-3 py-1.5 rounded border text-sm flex-1 min-w-0"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--card-border)', color: 'var(--text)' }}
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => guardar({ estado_lead: resol, motivo_perdida: motivo.trim() || null })}
              className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ background: 'var(--accent-yellow)', color: '#000' }}
            >
              {pending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-sm mt-2" style={{ color: 'var(--accent-orange)' }}>{error}</p>}
    </div>
  );
}
