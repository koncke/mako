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

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { MakoStar } from './MakoBrand';

const MONO = "'Geist Mono', monospace";
const CONSOLA_URL = 'https://console.anthropic.com/settings/billing';

type Resumen = {
  saldo: { usd: number; setAt: string } | null;
  gastadoMesUsd: number;
  gastadoDesdeSaldoUsd: number;
  restanteUsd: number | null;
  ultimaOp: { tokens: number; costUsd: number; feature: string; at: string } | null;
  porFeature: Array<{ feature: string; costUsd: number; tokens: number }>;
};

const FEATURE_LABEL: Record<string, string> = {
  'ads-rename': 'Ordenar nombres',
  'script-analyst': 'Script Analyst',
  'script-valorador': 'Valorar guion',
  'mako-chat': 'MaKo (chat)',
  closing: 'Closing Analyst',
  validador: 'Validador',
  otros: 'Otros',
};

const usd = (n: number) => (n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(n >= 0.01 ? 3 : 4)}`);
const fmtTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export function SaldoMaKo() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Resumen | null>(null);
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

  const guardar = async () => {
    const v = Number(input);
    if (!Number.isFinite(v) || v < 0) return;
    setSaving(true);
    try {
      const j = await fetch('/api/anthropic-usage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ saldoUsd: v }) }).then((r) => r.json());
      if (j?.ok) { setData(j as Resumen); setInput(''); }
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

            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={row}>
                <span style={{ color: 'var(--dim)' }}>Saldo restante</span>
                <b style={{ fontFamily: MONO, color: restante === null ? 'var(--faint)' : low ? 'var(--bad)' : 'var(--ink)' }}>{restante !== null ? usd(restante) : '—'}</b>
              </div>
              <div style={row}>
                <span style={{ color: 'var(--dim)' }}>Gastado este mes</span>
                <b style={{ fontFamily: MONO, color: 'var(--ink)' }}>{usd(data?.gastadoMesUsd ?? 0)}</b>
              </div>
              {data?.ultimaOp && (
                <div style={{ ...row, fontSize: 12, color: 'var(--faint)' }}>
                  <span>Última op · {FEATURE_LABEL[data.ultimaOp.feature] ?? data.ultimaOp.feature}</span>
                  <span style={{ fontFamily: MONO }}>{fmtTokens(data.ultimaOp.tokens)} tok · {usd(data.ultimaOp.costUsd)}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={label}>Cargar / actualizar saldo (USD)</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={input} onChange={(e) => setInput(e.target.value)} inputMode="decimal" placeholder={data?.saldo ? String(data.saldo.usd) : 'Ej: 20'} style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: MONO, fontSize: 13, outline: 'none' }} />
                <button onClick={guardar} disabled={saving || !input.trim()} style={{ padding: '8px 12px', borderRadius: 9, border: 'none', background: saving || !input.trim() ? 'var(--border-strong)' : 'var(--ink)', color: 'var(--surface)', fontSize: 13, fontWeight: 600, cursor: saving || !input.trim() ? 'default' : 'pointer' }}>{saving ? '…' : 'Guardar'}</button>
              </div>
              <span style={{ fontSize: 11, color: 'var(--faint)', lineHeight: 1.45 }}>La API no expone el saldo real. Pegá el de la consola y MaKo le va restando el gasto de cada operación.</span>
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
