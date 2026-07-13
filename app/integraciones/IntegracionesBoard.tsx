'use client';

// =============================================================================
// IntegracionesBoard — grid de estado + Saldo de IA + detalle en vivo de Meta
// =============================================================================

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { MakoStar } from '../_components/MakoBrand';
import { Icon } from '../_components/icons';
import { SaludBoard } from '../marketing/salud/SaludBoard';
import type { MetaHealth } from '@/lib/meta-health-ui';

const MONO = "'Geist Mono', monospace";

type Integracion = { key: string; nombre: string; categoria: string; descripcion: string; estado: 'conectada' | 'falta'; detalle: string; tieneDetalle?: boolean };

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18 };

function dotColor(i: Integracion, metaSev: string | null): string {
  if (i.key === 'meta' && metaSev) return metaSev === 'verde' ? 'var(--good)' : metaSev === 'ambar' ? 'var(--warn)' : 'var(--bad)';
  return i.estado === 'conectada' ? 'var(--good)' : 'var(--bad)';
}
function estadoLabel(i: Integracion, metaSev: string | null): string {
  if (i.estado === 'falta') return 'Falta config';
  if (i.key === 'meta' && metaSev && metaSev !== 'verde') return 'Requiere atención';
  return 'Conectada';
}

function IntegracionCard({ i, metaSev }: { i: Integracion; metaSev: string | null }) {
  const color = dotColor(i, metaSev);
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none', background: color, boxShadow: color !== 'var(--good)' ? `0 0 10px ${color}` : 'none' }} />
        <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)', flex: 1, minWidth: 0 }}>{i.nombre}</span>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>{i.categoria}</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.45 }}>{i.descripcion}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 2 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color }}>{estadoLabel(i, metaSev)}</span>
        {i.estado === 'falta' && <span style={{ fontSize: 11.5, color: 'var(--faint)', fontFamily: MONO }}>· {i.detalle}</span>}
        {i.tieneDetalle && <span style={{ fontSize: 11.5, color: 'var(--dim)', marginLeft: 'auto' }}>detalle ↓</span>}
      </div>
    </div>
  );
}

// ── Saldo de IA (inline) ──────────────────────────────────────────────────────
type UsageItem = { at: string; feature: string; motivo: string | null; model: string | null; tokens: number; costUsd: number };
type Resumen = {
  saldo: { usd: number; setAt: string } | null;
  gastadoMesUsd: number;
  restanteUsd: number | null;
  ultimaOp: { tokens: number; costUsd: number; feature: string; at: string } | null;
  historial?: UsageItem[];
};
const usd = (n: number) => (n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(n >= 0.01 ? 3 : 4)}`);
const fmtTok = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const FEATURE_LABEL: Record<string, string> = {
  'mako-guardian': 'Perro Guardián', 'checklist-coach': 'MaKo (coach)', 'ads-rename': 'Ordenar nombres',
  'script-analyst': 'Script Analyst', 'mako-chat': 'MaKo (chat)', closing: 'Closing Analyst', otros: 'Otros', tools: 'MaKo (acciones)',
};
const fmtHora = (iso: string) => { try { return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

function SaldoIA() {
  const [data, setData] = useState<Resumen | null>(null);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    try { const j = await (await fetch('/api/anthropic-usage')).json(); if (j?.ok) setData(j as Resumen); } catch { /* offline */ }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    const v = Number(input);
    if (!Number.isFinite(v) || v < 0) return;
    setSaving(true);
    try { const j = await (await fetch('/api/anthropic-usage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ saldoUsd: v }) })).json(); if (j?.ok) { setData(j as Resumen); setInput(''); } }
    finally { setSaving(false); }
  };

  const restante = data?.restanteUsd ?? null;
  const low = restante !== null && restante <= 5;

  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <MakoStar size={15} color="var(--accent)" />
        <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>Saldo de IA</span>
      </div>
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' }}>Saldo restante</div>
          <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, color: restante === null ? 'var(--faint)' : low ? 'var(--bad)' : 'var(--ink)', marginTop: 4 }}>{restante !== null ? usd(restante) : '—'}</div>
        </div>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' }}>Gastado este mes</div>
          <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, color: 'var(--ink)', marginTop: 4 }}>{usd(data?.gastadoMesUsd ?? 0)}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} inputMode="decimal" placeholder={data?.saldo ? `Actual: ${data.saldo.usd}` : 'Cargar saldo (USD)'} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: MONO, fontSize: 14, outline: 'none', width: 180 }} />
        <button onClick={guardar} disabled={saving || !input.trim()} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: saving || !input.trim() ? 'var(--border-strong)' : 'var(--ink)', color: 'var(--surface)', fontSize: 13.5, fontWeight: 600, cursor: saving || !input.trim() ? 'default' : 'pointer' }}>{saving ? '…' : 'Guardar'}</button>
        <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Ver saldo real ↗</a>
      </div>
      <span style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.45 }}>La API de Anthropic no expone el saldo prepago. Pegá el de la consola y MaKo le resta el gasto de cada operación.</span>

      {/* Historial de gasto: cada operación con su MOTIVO, tokens y costo */}
      {data?.historial && data.historial.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 2 }}>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 10 }}>Historial de gasto · {data.historial.length} operaciones</div>
          <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 340, overflowY: 'auto' }}>
            {data.historial.map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 2px', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.motivo || FEATURE_LABEL[h.feature] || h.feature}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--faint)', fontFamily: MONO }}>{FEATURE_LABEL[h.feature] ?? h.feature} · {fmtHora(h.at)}</span>
                </span>
                <span style={{ flex: 'none', textAlign: 'right' }}>
                  <span style={{ display: 'block', fontFamily: MONO, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{usd(h.costUsd)}</span>
                  <span style={{ display: 'block', fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{fmtTok(h.tokens)} tok</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Board ─────────────────────────────────────────────────────────────────────
type MetaEstadoHist = { id: number; severidad: string; statusLabel: string; disableReason: string | null; entregaFrenada: boolean; balanceMxn: number; detalle: string | null; createdAt: string };

const fmtFecha = (iso: string) => {
  try { return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
};

export function IntegracionesBoard({ integraciones, health, metaError, historial }: { integraciones: Integracion[]; health: MetaHealth | null; metaError: string | null; historial: MetaEstadoHist[] }) {
  const metaSev = health?.account.severidad ?? null;
  const conectadas = integraciones.filter((i) => i.estado === 'conectada').length;

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="integraciones" size={34} /></span>
        <h1 style={{ fontWeight: 600, fontSize: 42, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Integraciones</h1>
      </header>
      <p style={{ fontSize: 14, color: 'var(--dim)', margin: '0 0 22px', maxWidth: 720 }}>
        {conectadas} de {integraciones.length} servicios conectados. El detalle en vivo de Meta y el saldo de IA están abajo.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14, marginBottom: 30 }}>
        {integraciones.map((i) => <IntegracionCard key={i.key} i={i} metaSev={metaSev} />)}
      </div>

      <div style={{ marginBottom: 30 }}>
        <SaldoIA />
      </div>

      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)', margin: '0 0 14px' }}>Meta — detalle en vivo</div>
      {metaError || !health ? (
        <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 16, padding: '20px 24px' }}>
          <p style={{ fontWeight: 600, fontSize: 17, margin: '0 0 4px', color: 'var(--bad)' }}>No se pudo leer el estado de Meta</p>
          <p style={{ fontFamily: MONO, fontSize: 13.5, margin: 0, color: 'var(--dim)' }}>{metaError ?? 'Sin datos'}</p>
        </div>
      ) : (
        <SaludBoard health={health} />
      )}

      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)', margin: '34px 0 14px' }}>Historial de estados de Meta</div>
      {historial.length === 0 ? (
        <div style={{ ...card, color: 'var(--dim)', fontSize: 13.5 }}>Sin incidentes registrados. Acá van a quedar los momentos en que la cuenta estuvo en ámbar/rojo o con la entrega frenada.</div>
      ) : (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          {historial.map((h, i) => {
            const color = h.severidad === 'rojo' ? 'var(--bad)' : 'var(--warn)';
            return (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none', background: color }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{h.entregaFrenada ? 'Entrega frenada' : h.statusLabel}{h.disableReason ? ` · ${h.disableReason}` : ''}</span>
                  {h.detalle && h.detalle !== h.statusLabel && <span style={{ display: 'block', fontSize: 12.5, color: 'var(--dim)', marginTop: 1 }}>{h.detalle}</span>}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)', flex: 'none' }}>{fmtFecha(h.createdAt)}</span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
