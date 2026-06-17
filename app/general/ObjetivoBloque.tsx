'use client';

// =============================================================================
// ObjetivoBloque — objetivo HERO de Vista General (v3 Fase H, antes Fase 14)
// =============================================================================
// Lo primero y más destacado de Vista General: titular con la meta, avance
// grande, tres progresos (cierres · cash collected · sold/firmado), ritmo y
// edición inline. NO se ata al filtro de rango: acumulado desde objetivo_desde.
// Tono motivacional pero sobrio (panel de trabajo, sin confeti).
// =============================================================================

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setObjetivoAction } from './actions';
import type { ObjetivoProgreso } from '@/lib/queries';

function fmtUSD(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function fmtFecha(yyyy_mm_dd: string): string {
  const [y, m, d] = yyyy_mm_dd.split('-').map(Number);
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function ObjetivoBloque({ progreso }: { progreso: ObjetivoProgreso }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cierresMeta, setCierresMeta] = useState(progreso.cierres_meta?.toString() ?? '');
  const [cashMeta, setCashMeta] = useState(progreso.cash_meta?.toString() ?? '');
  const [desde, setDesde] = useState(progreso.desde);

  const guardar = () => {
    setError(null);
    startTransition(async () => {
      try {
        await setObjetivoAction('objetivo_cierres', cierresMeta);
        await setObjetivoAction('objetivo_cash_usd', cashMeta);
        await setObjetivoAction('objetivo_desde', desde);
        setEditando(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  };

  const cumplido = progreso.cumplido;
  const faltanCierres =
    progreso.cierres_meta !== null ? Math.max(progreso.cierres_meta - progreso.cierres_actual, 0) : null;

  const titular = cumplido
    ? 'Objetivo cumplido'
    : progreso.cierres_meta !== null
      ? `Camino a los ${progreso.cierres_meta} cierres`
      : 'Tu objetivo';

  return (
    <section
      className="rounded-2xl border p-7 md:p-10"
      style={{
        background: cumplido
          ? 'linear-gradient(180deg, rgba(62,207,142,0.08), var(--card-bg))'
          : 'linear-gradient(180deg, rgba(240,198,10,0.06), var(--card-bg))',
        borderColor: cumplido ? 'var(--accent-green)' : 'var(--card-border)',
        borderWidth: 2,
      }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm uppercase tracking-widest mb-1" style={{ color: 'var(--text-dim)' }}>
            Objetivo del negocio
          </div>
          <h2
            className="text-[40px] md:text-[56px] leading-none tracking-tight"
            style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, color: cumplido ? 'var(--accent-green)' : 'var(--text)' }}
          >
            {titular}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setEditando((v) => !v)}
          className="text-sm shrink-0"
          style={{ color: 'var(--text-dim)' }}
        >
          {editando ? 'cancelar' : '✎ editar'}
        </button>
      </div>

      <p className="text-base mt-2 mb-6" style={{ color: 'var(--text-dim)' }}>
        Acumulado desde {fmtFecha(progreso.desde)} · no depende del filtro de fechas.
      </p>

      {editando ? (
        <div className="space-y-4">
          <EditRow label="Meta de cierres">
            <input type="number" min="1" value={cierresMeta} onChange={(e) => setCierresMeta(e.target.value)} style={inputStyle} />
          </EditRow>
          <EditRow label="Meta de cash (USD)">
            <input type="number" min="0" value={cashMeta} onChange={(e) => setCashMeta(e.target.value)} style={inputStyle} />
          </EditRow>
          <EditRow label="Acumular desde">
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={inputStyle} />
          </EditRow>
          {error && <p className="text-sm" style={{ color: 'var(--accent-orange)' }}>{error}</p>}
          <button
            type="button"
            onClick={guardar}
            disabled={pending}
            className="px-5 py-2.5 rounded-lg font-medium text-base disabled:opacity-50"
            style={{ background: 'var(--accent-yellow)', color: '#000' }}
          >
            {pending ? 'Guardando…' : 'Guardar objetivo'}
          </button>
        </div>
      ) : (
        <div className="space-y-7">
          {/* CIERRES — avance grande + barra prominente */}
          <div>
            <div className="flex items-end justify-between gap-3 flex-wrap mb-2">
              <div className="flex items-baseline gap-3">
                <span
                  className="leading-none tabular-nums"
                  style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 600, fontSize: 'clamp(56px, 9vw, 88px)', color: cumplido ? 'var(--accent-green)' : 'var(--accent-yellow)' }}
                >
                  {progreso.cierres_actual}
                </span>
                {progreso.cierres_meta !== null && (
                  <span className="text-2xl md:text-3xl" style={{ color: 'var(--text-dim)' }}>
                    de {progreso.cierres_meta} cierres
                  </span>
                )}
              </div>
              {faltanCierres !== null && (
                <span className="text-lg" style={{ color: faltanCierres === 0 ? 'var(--accent-green)' : 'var(--text-dim)' }}>
                  {faltanCierres === 0 ? '¡Meta alcanzada!' : `faltan ${faltanCierres}`}
                </span>
              )}
            </div>
            <BarraGrande actual={progreso.cierres_actual} meta={progreso.cierres_meta} completo={cumplido} alto={16} />
          </div>

          {/* CASH COLLECTED — barra prominente */}
          <Progreso
            titulo="Cash collected"
            sub="lo cobrado (de los pagos)"
            actual={progreso.cash_actual}
            meta={progreso.cash_meta}
            texto={progreso.cash_meta !== null
              ? `${fmtUSD(progreso.cash_actual)} de ${fmtUSD(progreso.cash_meta)}${progreso.cash_actual >= progreso.cash_meta ? ' — ¡listo!' : ` · faltan ${fmtUSD(progreso.cash_meta - progreso.cash_actual)}`}`
              : `${fmtUSD(progreso.cash_actual)} (sin meta cargada)`}
          />

          {/* SOLD — referencia secundaria, claramente rotulada */}
          <div className="rounded-xl border px-5 py-4 flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: 'var(--card-border)', background: '#0f0f0f' }}>
            <div>
              <div className="text-sm uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Vendido (firmado)</div>
              <div className="text-sm" style={{ color: 'var(--text-pending)' }}>Lo comprometido en contratos — aún no cobrado, no confundir con el cash.</div>
            </div>
            <div className="text-[28px] tabular-nums" style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, color: 'var(--text)' }}>
              {fmtUSD(progreso.sold_actual)}
            </div>
          </div>

          {/* RITMO + cumplido */}
          {progreso.semanas_estimadas !== null && (
            <p className="text-base" style={{ color: 'var(--text-dim)' }}>
              A este ritmo ({progreso.cierres_30d} cierre{progreso.cierres_30d === 1 ? '' : 's'} en los últimos 30 días) llegás en{' '}
              <strong style={{ color: 'var(--text)' }}>~{progreso.semanas_estimadas} semana{progreso.semanas_estimadas === 1 ? '' : 's'}</strong>.
            </p>
          )}
          {cumplido && (
            <p className="text-base" style={{ color: 'var(--accent-green)' }}>
              ✓ Objetivo cumplido. Cargá el próximo con ✎ editar.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  background: '#0a0a0a',
  borderWidth: 1,
  borderColor: 'var(--card-border)',
  color: 'var(--text)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: '1.05rem',
  width: '100%',
  maxWidth: 240,
};

function EditRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm mb-1.5" style={{ color: 'var(--text-dim)' }}>{label}</span>
      {children}
    </label>
  );
}

function Progreso({
  titulo, sub, actual, meta, texto,
}: {
  titulo: string; sub: string; actual: number; meta: number | null; texto: string;
}) {
  const completo = meta !== null && actual >= meta;
  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-1.5 flex-wrap">
        <div>
          <span className="text-lg" style={{ fontWeight: 600 }}>{titulo}</span>
          <span className="text-sm ml-2" style={{ color: 'var(--text-pending)' }}>{sub}</span>
        </div>
        <span className="text-base tabular-nums" style={{ color: 'var(--text-dim)' }}>{texto}</span>
      </div>
      <BarraGrande actual={actual} meta={meta} completo={completo} alto={12} />
    </div>
  );
}

function BarraGrande({ actual, meta, completo, alto }: { actual: number; meta: number | null; completo: boolean; alto: number }) {
  const pct = meta && meta > 0 ? Math.min((actual / meta) * 100, 100) : 0;
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ background: '#1a1a1a', height: alto }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: completo ? 'var(--accent-green)' : 'var(--accent-yellow)' }}
      />
    </div>
  );
}
