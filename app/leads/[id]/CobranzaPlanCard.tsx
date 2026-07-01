'use client';

// =============================================================================
// CobranzaPlanCard — plan de pagos + lista de cuotas (rediseño claro)
// =============================================================================

import { useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { savePlanPagosAction, marcarPagoAction } from '../actions';
import { Dropdown } from '@/app/components/Dropdown';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import type { Lead } from '@/lib/leads';
import type { Pago } from '@/lib/pagos';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

function hoyISO(): string { return new Date().toISOString().slice(0, 10); }
function fmtFecha(s: string | null): string { return fmtDDMMYYYY(s); }
function fmtUSD(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function CobranzaPlanCard({ lead, pagos }: { lead: Lead; pagos: Pago[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const [cobroInicial, setCobroInicial] = useState(lead.cobro_inicial_usd?.toString() ?? '');
  const [montoCuota, setMontoCuota] = useState(lead.monto_cuota_usd?.toString() ?? '');
  const [totalCuotas, setTotalCuotas] = useState<string>(lead.total_cuotas?.toString() ?? '0');
  const [diaPago, setDiaPago] = useState<string>(lead.dia_de_pago?.toString() ?? '1');

  const nCuotas = parseInt(totalCuotas, 10) || 0;
  const inicialNum = parseFloat(cobroInicial) || 0;
  const cuotaNum = parseFloat(montoCuota) || 0;
  const totalPlan = inicialNum + cuotaNum * nCuotas;

  const cobrado = pagos.filter((p) => p.pagado).reduce((s, p) => s + Number(p.monto_usd), 0);
  const pendiente = pagos.filter((p) => !p.pagado).reduce((s, p) => s + Number(p.monto_usd), 0);

  const guardarPlan = () => {
    setFeedback(null);
    startTransition(async () => {
      try {
        await savePlanPagosAction(lead.id, {
          cobro_inicial_usd: cobroInicial.trim() ? parseFloat(cobroInicial) : null,
          monto_cuota_usd: montoCuota.trim() ? parseFloat(montoCuota) : null,
          total_cuotas: nCuotas > 0 ? nCuotas : null,
          dia_de_pago: parseInt(diaPago, 10) || null,
        });
        setFeedback({ kind: 'ok', msg: 'Plan guardado' });
        router.refresh();
      } catch (err) {
        setFeedback({ kind: 'err', msg: err instanceof Error ? err.message : String(err) });
      }
    });
  };

  return (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 6 }}>Plan de pagos</div>
      <p style={{ fontSize: 13.5, color: 'var(--dim)', marginBottom: 16, lineHeight: 1.5 }}>
        Cobro inicial + cuotas mensuales. Al guardar se generan las cuotas; cada una se marca cobrada con su fecha real. El cash del dashboard lee de acá.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        <Field label="Monto del cobro inicial (USD)"><input className="lead-field" type="number" step="0.01" min="0" value={cobroInicial} onChange={(e) => setCobroInicial(e.target.value)} /></Field>
        <Field label="Monto de cada cuota (USD)"><input className="lead-field" type="number" step="0.01" min="0" value={montoCuota} onChange={(e) => setMontoCuota(e.target.value)} /></Field>
        <Field label="Total de cuotas">
          <Dropdown
            value={totalCuotas}
            onChange={setTotalCuotas}
            width="100%"
            ariaLabel="Total de cuotas"
            options={[{ value: '0', label: 'Sin cuotas (solo inicial)' }, ...[1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `${n} cuota${n === 1 ? '' : 's'}` }))]}
          />
        </Field>
        <Field label="Día de pago (1–28)" hint="Tope 28 para que exista en todos los meses.">
          <Dropdown
            value={diaPago}
            onChange={setDiaPago}
            width="100%"
            ariaLabel="Día de pago"
            options={Array.from({ length: 28 }, (_, i) => i + 1).map((d) => ({ value: String(d), label: String(d) }))}
          />
        </Field>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 14, color: 'var(--dim)' }}>
          Total del plan: <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{fmtUSD(totalPlan)}</span>
          {nCuotas > 0 && <span style={{ fontSize: 13, marginLeft: 8 }}>({fmtUSD(inicialNum)} inicial + {nCuotas} × {fmtUSD(cuotaNum)})</span>}
        </div>
        <button type="button" onClick={guardarPlan} disabled={pending} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, opacity: pending ? 0.6 : 1 }}>{pending ? 'Guardando…' : 'Guardar plan'}</button>
      </div>

      {feedback && (
        <div style={{ borderRadius: 11, padding: '11px 16px', fontSize: 14, fontWeight: 600, marginTop: 14, background: feedback.kind === 'ok' ? 'var(--good-bg)' : 'var(--bad-bg)', color: feedback.kind === 'ok' ? 'var(--good)' : 'var(--bad)' }}>{feedback.msg}</div>
      )}

      {pagos.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={sectLabel}>Cuotas</div>
            <div style={{ fontSize: 13, color: 'var(--dim)' }}>Cobrado {fmtUSD(cobrado)} · Pendiente {fmtUSD(pendiente)}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pagos.map((p) => (
              <CuotaRow key={p.id} pago={p} leadId={lead.id} pending={pending} startTransition={startTransition} router={router} setFeedback={setFeedback} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function CuotaRow({ pago, leadId, pending, startTransition, router, setFeedback }: {
  pago: Pago; leadId: number; pending: boolean; startTransition: React.TransitionStartFunction;
  router: ReturnType<typeof useRouter>; setFeedback: (f: { kind: 'ok' | 'err'; msg: string } | null) => void;
}) {
  const [fechaPago, setFechaPago] = useState(pago.fecha_pago ?? hoyISO());
  const vencida = !pago.pagado && pago.fecha_esperada !== null && pago.fecha_esperada < hoyISO();
  const etiqueta = pago.numero === 0 ? 'Cobro inicial' : `Cuota ${pago.numero}`;

  const marcar = (pagado: boolean) => {
    setFeedback(null);
    startTransition(async () => {
      try { await marcarPagoAction(pago.id, leadId, pagado, pagado ? fechaPago : null); router.refresh(); }
      catch (err) { setFeedback({ kind: 'err', msg: err instanceof Error ? err.message : String(err) }); }
    });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 11, border: '1px solid ' + (vencida ? 'var(--bad)' : 'var(--border-strong)'), padding: '11px 14px', flexWrap: 'wrap', background: pago.pagado ? 'var(--good-bg)' : 'var(--surface-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--ink)', fontWeight: 600, fontSize: 14 }}>{etiqueta}</span>
        <span style={{ color: 'var(--dim)', fontSize: 14 }}>{fmtUSD(Number(pago.monto_usd))}</span>
        <span style={{ fontSize: 13, color: vencida ? 'var(--bad)' : 'var(--dim)' }}>
          {pago.pagado ? `cobrada el ${fmtFecha(pago.fecha_pago)}` : `vence ${fmtFecha(pago.fecha_esperada)}${vencida ? ' · vencida' : ''}`}
        </span>
      </div>
      {pago.pagado ? (
        <button type="button" onClick={() => marcar(false)} disabled={pending} style={{ fontSize: 13, color: 'var(--dim)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: SANS, opacity: pending ? 0.5 : 1 }}>deshacer</button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input className="lead-field" type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} style={{ width: 'auto' }} />
          <button type="button" onClick={() => marcar(true)} disabled={pending} style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: 'var(--good)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: SANS, opacity: pending ? 0.6 : 1 }}>Marcar pagada</button>
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12.5, marginBottom: 6, color: 'var(--dim)' }}>{label}</span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: 12, marginTop: 5, color: 'var(--faint)' }}>{hint}</span>}
    </label>
  );
}
