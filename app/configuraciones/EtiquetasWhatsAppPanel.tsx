'use client';

// =============================================================================
// EtiquetasWhatsAppPanel — mapea cada ETAPA del funnel a una etiqueta de WhatsApp
// del número no oficial. Al cambiar de etapa un lead, el sistema le pone/saca la
// etiqueta sola. Las etiquetas NO se crean acá (se crean en WhatsApp Business del
// celular y llegan solas); acá solo se sincronizan y se mapean.
// =============================================================================

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';

type Label = { labelId: string; name: string | null; color: number | null };
type Etapa = { key: string; label: string };

export function EtiquetasWhatsAppPanel() {
  const [labels, setLabels] = useState<Label[]>([]);
  const [mapeo, setMapeo] = useState<Record<string, string>>({});
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sync, setSync] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/whatsapp/evolution/labels', { cache: 'no-store' });
      const j = await r.json();
      if (r.status === 403) { setErr('Solo el admin del workspace puede configurar etiquetas.'); return; }
      if (!j.ok) throw new Error(j.error || 'No se pudo cargar');
      setLabels(j.labels ?? []); setMapeo(j.mapeo ?? {}); setEtapas(j.etapas ?? []); setErr(null);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setCargando(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function sincronizar() {
    setSync(true); setErr(null); setOkMsg(null);
    try {
      const r = await fetch('/api/whatsapp/evolution/labels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync' }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo sincronizar');
      setLabels(j.labels ?? []);
      setOkMsg((j.labels?.length ?? 0) > 0 ? `Sincronizadas ${j.labels.length} etiquetas.` : 'Este número no tiene etiquetas (¿es WhatsApp Business?).');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSync(false); }
  }

  async function setEtapaLabel(etapa: string, labelId: string) {
    const val = labelId || null;
    setMapeo((m) => { const n = { ...m }; if (val) n[etapa] = val; else delete n[etapa]; return n; });
    setOkMsg(null);
    try {
      const r = await fetch('/api/whatsapp/evolution/labels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ etapa, labelId: val }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo guardar');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); void load(); }
  }

  const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px', maxWidth: '640px' };
  const opciones = [{ value: '', label: 'Sin etiqueta' }, ...labels.map((l) => ({ value: l.labelId, label: l.name || `(sin nombre) ${l.labelId}` }))];

  return (
    <div style={card}>
      <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)' }}>Etiquetas de WhatsApp por etapa</div>
      <div style={{ fontSize: '13px', color: 'var(--dim)', lineHeight: 1.55, marginTop: '4px', marginBottom: '16px' }}>
        Cuando un lead cambia de etapa en el CRM, se le pone/saca sola la etiqueta correspondiente en tu WhatsApp no oficial. Las etiquetas se crean una vez en <strong style={{ color: 'var(--ink)' }}>WhatsApp Business</strong> del celular; aquí solo se mapean. (Solo funciona en cuentas WhatsApp Business.)
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <button onClick={() => void sincronizar()} disabled={sync} style={{ padding: '8px 14px', borderRadius: '9px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: sync ? 0.6 : 1 }}>{sync ? 'Sincronizando…' : 'Sincronizar etiquetas'}</button>
        {okMsg && <span style={{ fontSize: '12.5px', color: 'var(--good)', fontWeight: 600 }}>{okMsg}</span>}
      </div>

      {err && <div style={{ marginBottom: '12px', padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)', fontSize: '12.5px' }}>{err}</div>}
      {cargando ? (
        <div style={{ color: 'var(--dim)', fontSize: '13px' }}>Cargando…</div>
      ) : labels.length === 0 ? (
        <div style={{ padding: '12px', borderRadius: '9px', border: '1px solid var(--warn-fill)', background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: '12.5px', lineHeight: 1.5 }}>No hay etiquetas todavía. Crea las etiquetas del funnel en la app de WhatsApp Business del celular conectado y toca «Sincronizar etiquetas».</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {etapas.map((e) => (
            <div key={e.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <span style={{ fontSize: '13.5px', color: 'var(--ink)', fontWeight: 500 }}>{e.label}</span>
              <Dropdown value={mapeo[e.key] ?? ''} onChange={(v) => void setEtapaLabel(e.key, v)} width={240} ariaLabel={`Etiqueta para ${e.label}`} options={opciones} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
