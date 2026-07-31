'use client';

// =============================================================================
// Pill "CRM automático: ON/OFF" del header del CRM (tarea #5)
// =============================================================================
// Muestra y togglea el interruptor POR WORKSPACE del CRM automático (MaKo mueve
// leads solo). Solo lo ve el admin del workspace: /api/crm-auto responde 403 al
// resto y el componente no renderiza nada.
// =============================================================================

import { useEffect, useState } from 'react';

export function CrmAutoToggle() {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('/api/crm-auto');
        const j = await r.json();
        if (j.ok) setOn(Boolean(j.habilitado));
        // 403 = setter/closer: el toggle es config admin-only, sin ruido.
      } catch { /* sin toggle */ }
    })();
  }, []);

  if (on == null) return null;

  const toggle = async () => {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/crm-auto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on: !on }) });
      const j = await r.json();
      if (j.ok) setOn(Boolean(j.habilitado));
      else setErr(j.error || 'No se pudo cambiar');
    } catch {
      setErr('Sin conexión — probá de nuevo');
    } finally {
      setBusy(false);
    }
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button onClick={() => void toggle()} disabled={busy} aria-pressed={on}
        title={on ? 'MaKo mueve leads y deja confirmaciones — clic para pausar' : 'MaKo solo mira (dry-run): no mueve ningún lead — clic para activar'}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: 12.5, fontWeight: 600, border: '1px solid ' + (on ? 'var(--good)' : 'var(--border-strong)'), background: on ? 'var(--good-bg)' : 'var(--surface)', color: on ? 'var(--good)' : 'var(--dim)' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: on ? 'var(--good)' : 'var(--faint)' }} />
        CRM automático: {on ? 'ON' : 'OFF'}
      </button>
      {err && <span style={{ fontSize: 12, color: 'var(--bad)' }}>{err}</span>}
    </span>
  );
}
