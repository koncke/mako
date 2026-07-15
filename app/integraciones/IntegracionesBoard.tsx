'use client';

// =============================================================================
// IntegracionesBoard — grid de estado + Saldo de IA + detalle en vivo de Meta
// =============================================================================

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { MakoStar } from '../_components/MakoBrand';
import { Icon } from '../_components/icons';
import { SaludBoard } from '../marketing/salud/SaludBoard';
import type { MetaHealth } from '@/lib/meta-health-ui';
import { procesoLegible, proveedorLegible, modeloLegible, motivoLegible } from '@/lib/ia-labels';

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

// ── Saldo de IA — vista completa (la fuente única; el chip de la sidebar linkea acá) ──
type Movimiento = { at: string; feature: string; motivo: string | null; model: string | null; provider: string; tokens: number; costUsd: number };
type ProvSaldo = { provider: string; costMesUsd: number; tokens: number; saldo: { usd: number; setAt: string } | null; restanteUsd: number | null; gratis: boolean };
type Resumen = {
  saldo: { usd: number; setAt: string } | null;
  gastadoMesUsd: number;
  restanteUsd: number | null;
  porFeature?: Array<{ feature: string; costUsd: number; tokens: number }>;
  porProveedor?: ProvSaldo[];
  historial?: Movimiento[];
};
const usd = (n: number) => (n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(n >= 0.01 ? 3 : 4)}`);
const fmtTok = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const fmtHora = (iso: string) => { try { return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
const chipMini: CSSProperties = { fontSize: 10.5, fontFamily: MONO, padding: '1px 7px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--dim)', flex: 'none' };

function SaldoIA() {
  const [data, setData] = useState<Resumen | null>(null);
  const [editProv, setEditProv] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    try { const j = await (await fetch('/api/anthropic-usage')).json(); if (j?.ok) setData(j as Resumen); } catch { /* offline */ }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (provider: string) => {
    const v = Number(input);
    if (!Number.isFinite(v) || v < 0) return;
    setSaving(true);
    try { const j = await (await fetch('/api/anthropic-usage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ saldoUsd: v, provider }) })).json(); if (j?.ok) { setData(j as Resumen); setInput(''); setEditProv(null); } }
    finally { setSaving(false); }
  };

  const cap: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' };
  const row: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 };

  return (
    <div id="saldo-ia" style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16, scrollMarginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <MakoStar size={15} color="var(--accent)" />
        <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>Saldo de IA</span>
        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 12, color: 'var(--dim)' }}>gasto del mes · {usd(data?.gastadoMesUsd ?? 0)}</span>
      </div>
      <span style={{ fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.45 }}>
        Las APIs no exponen el saldo prepago: pegá el de cada consola y MaKo le resta el gasto real de cada operación. Groq es gratis (limitado por rate); Claude descuenta del saldo prepago; OpenAI cargalo a mano.
      </span>

      {/* Por proveedor: Claude / Groq / OpenAI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
        {(data?.porProveedor ?? []).map((p) => (
          <div key={p.provider} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={row}>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{proveedorLegible(p.provider)}</span>
              {p.gratis
                ? <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--good)' }}>GRATIS</span>
                : p.restanteUsd !== null
                  ? <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: p.restanteUsd <= 5 ? 'var(--bad)' : 'var(--ink)' }}>{usd(p.restanteUsd)}</span>
                  : <span style={{ fontSize: 11, color: 'var(--faint)' }}>sin saldo</span>}
            </div>
            <div style={{ ...cap, fontSize: 10 }}>{p.gratis ? 'Gasto del mes' : 'Restante · gastó ' + usd(p.costMesUsd)}</div>
            {p.gratis
              ? <span style={{ fontFamily: MONO, fontSize: 13, color: 'var(--dim)' }}>{usd(p.costMesUsd)}</span>
              : editProv === p.provider ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={input} onChange={(e) => setInput(e.target.value)} inputMode="decimal" autoFocus placeholder={p.saldo ? String(p.saldo.usd) : 'Saldo USD'} style={{ flex: 1, minWidth: 0, padding: '6px 9px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: MONO, fontSize: 12.5, outline: 'none' }} />
                  <button onClick={() => guardar(p.provider)} disabled={saving || !input.trim()} style={{ padding: '6px 11px', borderRadius: 8, border: 'none', background: saving || !input.trim() ? 'var(--border-strong)' : 'var(--ink)', color: 'var(--surface)', fontSize: 12.5, fontWeight: 600, cursor: saving || !input.trim() ? 'default' : 'pointer' }}>{saving ? '…' : 'OK'}</button>
                </div>
              ) : (
                <button onClick={() => { setEditProv(p.provider); setInput(''); }} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}>{p.saldo ? 'editar saldo' : 'cargar saldo'}</button>
              )}
          </div>
        ))}
      </div>
      <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Ver saldo real en la consola de Anthropic ↗</a>

      {/* Gasto del mes por herramienta */}
      {data?.porFeature && data.porFeature.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ ...cap, marginBottom: 2 }}>Gasto del mes por proceso</div>
          {data.porFeature.slice(0, 8).map((f) => (
            <div key={f.feature} style={{ ...row, fontSize: 13 }}>
              <span style={{ color: 'var(--dim)' }}>{procesoLegible(f.feature)}</span>
              <span style={{ fontFamily: MONO, color: 'var(--ink)' }}>{usd(f.costUsd)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Historial: cada operación con proceso + IA + MODELO + tokens + costo */}
      {data?.historial && data.historial.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ ...cap, marginBottom: 10 }}>Historial · {data.historial.length} operaciones</div>
          <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 380, overflowY: 'auto' }}>
            {data.historial.map((h, i) => {
              const motivo = motivoLegible(h.motivo);
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 2px', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{procesoLegible(h.feature)}</span>
                      <span style={{ ...chipMini, color: h.provider === 'anthropic' ? 'var(--dim)' : 'var(--good)' }}>{proveedorLegible(h.provider)} · {modeloLegible(h.model)}</span>
                    </span>
                    {motivo && <span style={{ display: 'block', fontSize: 12, color: 'var(--dim)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{motivo}</span>}
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--faint)', fontFamily: MONO, marginTop: 2 }}>{fmtHora(h.at)}{h.tokens > 0 ? ` · ${fmtTok(h.tokens)} tok` : ''}</span>
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: h.provider === 'anthropic' ? 'var(--ink)' : 'var(--good)', flex: 'none' }}>{usd(h.costUsd)}</span>
                </div>
              );
            })}
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
