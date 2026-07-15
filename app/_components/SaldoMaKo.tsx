'use client';

// =============================================================================
// SaldoMaKo — chip de uso de la API de Anthropic (sidebar)
// =============================================================================
// La API de Anthropic NO expone el saldo prepago real. Acá: el usuario carga su
// saldo a mano (lo lee de la consola) y la app le RESTA el gasto real de cada
// operación. Muestra restante, gasto del mes, última operación y desglose, +
// link a la consola para ver el saldo verdadero. Se refresca al abrir, al
// volver a la pestaña y cada 60s (los nuevos gastos aparecen al toque).
// =============================================================================

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { MakoStar } from './MakoBrand';

const MONO = "'Geist Mono', monospace";
const CONSOLA_URL = 'https://console.anthropic.com/settings/billing';

type Movimiento = { at: string; feature: string; motivo: string | null; model: string | null; provider: string; tokens: number; costUsd: number };
type ProvSaldo = { provider: string; costMesUsd: number; tokens: number; saldo: { usd: number; setAt: string } | null; restanteUsd: number | null; gratis: boolean };
type Resumen = {
  saldo: { usd: number; setAt: string } | null;
  gastadoMesUsd: number;
  gastadoDesdeSaldoUsd: number;
  restanteUsd: number | null;
  ultimaOp: { tokens: number; costUsd: number; feature: string; at: string } | null;
  porFeature: Array<{ feature: string; costUsd: number; tokens: number }>;
  porProveedor?: ProvSaldo[];
  historial?: Movimiento[];
};

const FEATURE_LABEL: Record<string, string> = {
  'ads-rename': 'Ordenar nombres',
  'script-analyst': 'Script Analyst',
  'script-valorador': 'Valorar guion',
  'mako-chat': 'MaKo (chat)',
  'mako-doer': 'MaKo Doer',
  'mako-doer-in': 'MaKo · WhatsApp',
  'ia-barata': 'IA barata',
  closing: 'Closing Analyst',
  validador: 'Validador',
  otros: 'Otros',
};

// Etiqueta corta del proveedor, para distinguir el gasto de Claude del barato.
const PROV_LABEL: Record<string, string> = { anthropic: 'Claude', groq: 'Groq', openai: 'OpenAI' };

const usd = (n: number) => (n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(n >= 0.01 ? 3 : 4)}`);
const fmtTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const fmtHora = (iso: string) => { try { return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

export function SaldoMaKo() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Resumen | null>(null);
  const [editProv, setEditProv] = useState<string | null>(null); // qué proveedor edito
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const j = await fetch('/api/anthropic-usage').then((r) => r.json());
      if (j?.ok) setData(j as Resumen);
    } catch { /* sin Supabase / offline → no rompe */ }
  }, []);

  useEffect(() => {
    cargar();
    const onFocus = () => cargar();
    window.addEventListener('focus', onFocus);
    const t = setInterval(cargar, 60000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(t); };
  }, [cargar]);

  const guardar = async (provider: string) => {
    const v = Number(input);
    if (!Number.isFinite(v) || v < 0) return;
    setSaving(true);
    try {
      const j = await fetch('/api/anthropic-usage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ saldoUsd: v, provider }) }).then((r) => r.json());
      if (j?.ok) { setData(j as Resumen); setInput(''); setEditProv(null); }
    } finally { setSaving(false); }
  };

  const restante = data?.restanteUsd ?? null;
  const low = restante !== null && restante <= 5;
  const chipLabel = restante !== null ? usd(restante) : 'Cargá tu saldo';
  const chipColor = restante === null ? 'var(--sidebar-text)' : low ? 'var(--bad)' : 'var(--on-sidebar)';

  const label: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--dim)' };
  const row: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, fontSize: 13 };

  return (
    <div style={{ position: 'relative', marginBottom: 8 }}>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} aria-hidden />
          <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 41, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 18px 44px rgba(23,21,17,.32)', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <MakoStar size={13} color="var(--accent)" />
              <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>Uso de la IA</span>
            </div>

            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ ...row, fontSize: 11 }}>
                <span style={label}>Gasto del mes por IA</span>
                <span style={{ fontFamily: MONO, color: 'var(--dim)' }}>total {usd(data?.gastadoMesUsd ?? 0)}</span>
              </div>
              {(data?.porProveedor ?? []).map((p) => (
                <div key={p.provider} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ ...row, fontSize: 12.5 }}>
                    <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{PROV_LABEL[p.provider] ?? p.provider}</span>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                      <span style={{ fontFamily: MONO, color: 'var(--dim)' }}>{usd(p.costMesUsd)}</span>
                      {p.gratis
                        ? <span style={{ fontSize: 10.5, color: 'var(--good)', fontWeight: 700 }}>GRATIS</span>
                        : p.restanteUsd !== null
                          ? <><span style={{ fontFamily: MONO, fontSize: 11.5, color: p.restanteUsd <= 5 ? 'var(--bad)' : 'var(--ink)' }}>quedan {usd(p.restanteUsd)}</span><button onClick={() => { setEditProv(editProv === p.provider ? null : p.provider); setInput(''); }} style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, color: 'var(--faint)', cursor: 'pointer' }}>editar</button></>
                          : <button onClick={() => { setEditProv(p.provider); setInput(''); }} style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}>cargar saldo</button>}
                    </span>
                  </div>
                  {editProv === p.provider && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input value={input} onChange={(e) => setInput(e.target.value)} inputMode="decimal" autoFocus placeholder={p.saldo ? String(p.saldo.usd) : 'Saldo actual USD'} style={{ flex: 1, minWidth: 0, padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: MONO, fontSize: 12.5, outline: 'none' }} />
                      <button onClick={() => guardar(p.provider)} disabled={saving || !input.trim()} style={{ padding: '7px 11px', borderRadius: 8, border: 'none', background: saving || !input.trim() ? 'var(--border-strong)' : 'var(--ink)', color: 'var(--surface)', fontSize: 12.5, fontWeight: 600, cursor: saving || !input.trim() ? 'default' : 'pointer' }}>{saving ? '…' : 'OK'}</button>
                    </div>
                  )}
                </div>
              ))}
              <span style={{ fontSize: 10.5, color: 'var(--faint)', lineHeight: 1.45 }}>Las APIs no exponen el saldo real: pegá el de cada consola y MaKo le resta el gasto. Groq es gratis (limitado por rate). Claude descuenta del saldo prepago; OpenAI cargalo a mano.</span>
            </div>

            {data?.porFeature && data.porFeature.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={label}>Gasto del mes por herramienta</span>
                {data.porFeature.slice(0, 5).map((f) => (
                  <div key={f.feature} style={{ ...row, fontSize: 12 }}>
                    <span style={{ color: 'var(--dim)' }}>{FEATURE_LABEL[f.feature] ?? f.feature}</span>
                    <span style={{ fontFamily: MONO, color: 'var(--ink)' }}>{usd(f.costUsd)}</span>
                  </div>
                ))}
              </div>
            )}

            {data?.historial && data.historial.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={label}>Últimos movimientos</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 190, overflowY: 'auto' }}>
                  {data.historial.slice(0, 20).map((m, i) => (
                    <div key={`${m.at}-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <div style={{ ...row, fontSize: 12 }}>
                        <span style={{ color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.motivo || FEATURE_LABEL[m.feature] || m.feature}</span>
                        <span style={{ fontFamily: MONO, color: m.provider === 'anthropic' ? 'var(--ink)' : 'var(--good)', flex: 'none' }}>{usd(m.costUsd)}</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--faint)', display: 'flex', gap: 6 }}>
                        <span>{fmtHora(m.at)}</span>
                        <span>· {PROV_LABEL[m.provider] ?? m.provider}</span>
                        {m.tokens > 0 && <span>· {fmtTokens(m.tokens)} tok</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <a href={CONSOLA_URL} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Ver saldo real en Anthropic ↗</a>
          </div>
        </>
      )}

      <button type="button" onClick={() => { setOpen((v) => !v); if (!open) cargar(); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', borderRadius: 11, border: '1px solid var(--sidebar-2)', background: open ? 'var(--sidebar-2)' : 'transparent', cursor: 'pointer' }}>
        <MakoStar size={13} color="var(--accent-soft)" />
        <span style={{ flex: 1, textAlign: 'left', fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--sidebar-text)' }}>Saldo IA</span>
        <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: chipColor }}>{chipLabel}</span>
      </button>
    </div>
  );
}
