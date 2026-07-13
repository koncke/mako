'use client';

// =============================================================================
// EditarTextosModal — editar los TEXTOS de un anuncio ya publicado (y reparar
// rechazos por copy). Mismo espíritu simple que "Nueva campaña".
// =============================================================================
// Prellena con el copy actual (GET), deja editar texto/título/descr/CTA/URL y al
// guardar crea un creativo NUEVO con el MISMO video/imagen (POST) → Meta re-revisa.
// El media NO se cambia acá (solo textos). Si el anuncio reutiliza un post
// existente, avisa que no se puede editar desde acá.
// =============================================================================

import { useEffect, useState, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';
import { MakoStar, MakoWord } from '../_components/MakoBrand';
import { CTA_OPCIONES } from '@/lib/campaign-types';
import { explicarIssueEs } from '@/lib/meta-health-ui';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type AdEdit = {
  ad_id: string; name: string; status: string;
  issues: Array<{ resumen: string; mensaje: string }>;
  editable: boolean; reason?: string;
  creative: {
    media_type: 'image' | 'video' | null; image_hash: string | null; video_id: string | null; thumbnail_url: string | null;
    primary_text: string; headline: string; description: string; cta_type: string | null; destination_url: string; lead_form_id: string | null;
  } | null;
};

const field: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' };
const lbl: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 5, display: 'block' };
const btnDark: CSSProperties = { padding: '11px 20px', borderRadius: 12, border: 'none', background: 'var(--ink)', color: 'var(--surface)', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '11px 18px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 14, cursor: 'pointer' };

export function EditarTextosModal({ adId, adName, onClose, onSaved }: { adId: string; adName: string; onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState<AdEdit | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [primary, setPrimary] = useState(''); const [headline, setHeadline] = useState(''); const [description, setDescription] = useState('');
  const [cta, setCta] = useState(''); const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false); const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    fetch(`/api/ads-manager/ad-edit?ad_id=${encodeURIComponent(adId)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (cancel) return;
        if (!j.ok) { setLoadErr(j.error || 'No se pudo cargar el anuncio'); return; }
        const ad = j.ad as AdEdit; setData(ad);
        const c = ad.creative;
        if (c) { setPrimary(c.primary_text); setHeadline(c.headline); setDescription(c.description); setCta(c.cta_type ?? ''); setUrl(c.destination_url); }
      })
      .catch((e) => { if (!cancel) setLoadErr(String(e)); });
    return () => { cancel = true; };
  }, [adId]);

  const guardar = async () => {
    setSaving(true); setErr(null);
    try {
      const r = await fetch('/api/ads-manager/ad-edit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ad_id: adId, edited: { primary_text: primary, headline, description, cta_type: cta || undefined, destination_url: url } }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo guardar');
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  const esLeadForm = !!data?.creative?.lead_form_id;
  // Mostrar el botón actual aunque sea un CTA legacy que no esté en nuestra lista.
  const ctaOpts = CTA_OPCIONES.map((o) => ({ value: o.value as string, label: o.label }));
  if (cta && !ctaOpts.some((o) => o.value === cta)) ctaOpts.unshift({ value: cta, label: cta });

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 85, background: 'rgba(18,21,27,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 18px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 540, maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 80px rgba(18,21,27,.4)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)' }}>
            <MakoStar size={12} /> <MakoWord base="var(--accent)">MaKo</MakoWord>
          </div>
          <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: '0 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>Editar textos · {adName}</span>
          <button aria-label="Cerrar" onClick={onClose} style={{ width: 30, height: 30, flex: 'none', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {loadErr && <div style={{ fontSize: 13, color: 'var(--bad)', textAlign: 'center' }}>{loadErr}</div>}
          {!data && !loadErr && <div style={{ padding: '30px', textAlign: 'center', color: 'var(--dim)', fontSize: 14 }}>Cargando el anuncio…</div>}
          {data && !data.editable && (
            <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.5, textAlign: 'center', padding: '20px 10px' }}>{data.reason}</div>
          )}
          {data && data.editable && (
            <>
              {data.issues.length > 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--bad)', background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 10, padding: '10px 12px', lineHeight: 1.45 }}>
                  <b>{explicarIssueEs(data.issues[0]).titulo}.</b> {explicarIssueEs(data.issues[0]).detalle}
                </div>
              )}
              <label><span style={lbl}>Texto principal</span>
                <textarea value={primary} onChange={(e) => setPrimary(e.target.value)} rows={5} style={{ ...field, resize: 'vertical', lineHeight: 1.5 }} /></label>
              <label><span style={lbl}>Título</span>
                <input value={headline} onChange={(e) => setHeadline(e.target.value)} style={field} /></label>
              <label><span style={lbl}>Descripción (opcional)</span>
                <input value={description} onChange={(e) => setDescription(e.target.value)} style={field} /></label>
              <div><span style={lbl}>Botón (CTA)</span>
                <Dropdown value={cta} placeholder="Elegí un botón…" options={ctaOpts} onChange={setCta} width="100%" /></div>
              {!esLeadForm && (
                <label><span style={lbl}>Destino (URL)</span>
                  <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://tu-landing/vsl" style={field} /></label>
              )}
              <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: 0, lineHeight: 1.5 }}>Se crea un creativo nuevo con el mismo video/imagen y estos textos; Meta vuelve a revisarlo. El video/imagen no se cambia acá.</p>
            </>
          )}
        </div>

        {data && data.editable && (
          <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
            {err && <span style={{ fontSize: 12.5, color: 'var(--bad)', lineHeight: 1.4, marginRight: 'auto' }}>{err}</span>}
            <button aria-label="Cerrar" onClick={onClose} style={btnGhost}>Cancelar</button>
            <button onClick={guardar} disabled={saving} style={{ ...btnDark, opacity: saving ? 0.5 : 1, cursor: saving ? 'default' : 'pointer' }}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
          </div>
        )}
      </div>
    </div>
  );
}
