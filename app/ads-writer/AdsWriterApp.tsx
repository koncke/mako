'use client';

// =============================================================================
// AdsWriterApp — MaKo escribe copy de anuncios de Meta (Ads Writer)
// =============================================================================
// Pedís un anuncio en lenguaje natural → MaKo devuelve 3-5 variantes de copy
// (cada una con un ángulo distinto), aterrizadas en el brief real del negocio.
// Podés pedirle un ajuste (regenera sobre lo que ya escribió) y copiar cada
// campo. No persiste nada (patrón "writer"): genera a pedido. POST /api/ads-writer.
// =============================================================================

import { useEffect, useState, type CSSProperties } from 'react';
import { MakoStar, MakoWord } from '../_components/MakoBrand';
import { Icon } from '../_components/icons';
import type { AdCopySet } from '@/lib/ad-copy';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

const EJEMPLOS = [
  'Un anuncio para dueños de negocio estancados que no logran despegar',
  'Copy con ángulo de dolor para llevar tráfico al VSL',
  'Anuncio con prueba social para agendar una llamada',
  'Reenganchar leads fríos que no respondieron',
];

const LOAD_STEPS = [
  'Leyendo tu oferta y tu avatar…',
  'Mirando tus anuncios ganadores…',
  'Buscando ángulos distintos…',
  'Escribiendo y puliendo el copy…',
];

const btnDark: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 22px', borderRadius: 12, border: 'none', background: 'var(--ink)', color: 'var(--surface)', fontFamily: SANS, fontSize: 15, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 14, cursor: 'pointer' };

export function AdsWriterApp() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState(0);
  const [set, setSet] = useState<AdCopySet | null>(null);
  const [uso, setUso] = useState<{ tokens: number; costUsd: number } | null>(null);
  const [ajuste, setAjuste] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) { setLoadStep(0); return; }
    const id = setInterval(() => setLoadStep((s) => (s + 1) % LOAD_STEPS.length), 1600);
    return () => clearInterval(id);
  }, [loading]);

  async function generar(mode: 'suggest' | 'adjust') {
    if (mode === 'suggest' && !prompt.trim()) return;
    if (mode === 'adjust' && (!ajuste.trim() || !set)) return;
    setErr(null);
    if (mode === 'adjust') setAdjusting(true); else setLoading(true);
    try {
      const payload = mode === 'adjust' ? { mode, setActual: set, instruccion: ajuste } : { mode: 'suggest', prompt };
      const r = await fetch('/api/ads-writer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo generar el copy.');
      setSet(j.set);
      setUso(j.uso ?? null);
      if (mode === 'adjust') setAjuste('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setAdjusting(false);
    }
  }

  async function copiar(key: string, text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied((c) => (c === key ? null : c)), 1200); } catch { /* sin permiso */ }
  }

  const fmtUso = uso ? `✦ ${uso.tokens >= 1000 ? `${(uso.tokens / 1000).toFixed(1)}k` : uso.tokens} tok · $${uso.costUsd >= 1 ? uso.costUsd.toFixed(2) : uso.costUsd.toFixed(3)}` : '';

  return (
    <main style={{ flex: 1, minWidth: 0, minHeight: '100vh', overflowY: 'auto' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 28px 80px' }}>
        {/* encabezado */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: MONO, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 12 }}>
          <MakoStar size={13} /> <MakoWord base="var(--accent)">MaKo</MakoWord>
          <span style={{ color: 'var(--faint)' }}>·</span>
          <Icon name="pen" size={14} /> <span>Ads Writer</span>
        </div>
        <h1 style={{ fontFamily: SANS, fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 8px' }}>Escribí un anuncio con MaKo</h1>
        <p style={{ fontSize: 15.5, color: 'var(--dim)', lineHeight: 1.6, margin: '0 0 24px', maxWidth: 620 }}>
          Contale qué querés promocionar. MaKo escribe varias variantes de copy —cada una con un ángulo distinto— usando tu oferta, tu avatar y tus anuncios ganadores reales.
        </p>

        {/* panel de pedido */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18 }}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') generar('suggest'); }}
            placeholder="Ej: un anuncio para dueños de negocio que trabajan 12 horas y no crecen, con ángulo de dolor, para llevarlos al VSL…"
            rows={3}
            style={{ width: '100%', resize: 'vertical', border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', fontFamily: SANS, fontSize: 16, lineHeight: 1.5 }}
          />
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', margin: '10px 0 4px' }}>
            {EJEMPLOS.map((ej) => (
              <button key={ej} type="button" onClick={() => setPrompt(ej)}
                style={{ fontFamily: SANS, fontSize: 12.5, color: 'var(--dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: '5px 11px', cursor: 'pointer' }}>
                {ej}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12 }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>⌘/Ctrl + Enter</span>
            <button onClick={() => generar('suggest')} disabled={loading || !prompt.trim()} style={{ ...btnDark, opacity: loading || !prompt.trim() ? 0.45 : 1, cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer' }}>
              {loading ? 'MaKo escribiendo…' : set ? 'Escribir de nuevo' : 'MaKo, escribí'}
            </button>
          </div>
        </div>

        {err && <div style={{ fontSize: 13.5, color: 'var(--bad)', background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '11px 14px', marginTop: 16, lineHeight: 1.5 }}>{err}</div>}

        {/* cargando */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 24, color: 'var(--dim)', fontFamily: SANS, fontSize: 15 }}>
            <span style={{ display: 'inline-block', width: 14, height: 14, animation: 'adw-spin 1s linear infinite' }}><MakoStar size={14} /></span>
            <span>{LOAD_STEPS[loadStep]}</span>
            <style>{'@keyframes adw-spin{to{transform:rotate(360deg)}}'}</style>
          </div>
        )}

        {/* resultados */}
        {set && !loading && (
          <div style={{ marginTop: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>
                <MakoStar size={12} /> {set.variants.length} variante{set.variants.length === 1 ? '' : 's'}
              </div>
              {fmtUso && <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{fmtUso}</span>}
            </div>

            {set.nota && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 15px', marginBottom: 16 }}>
                <span style={{ flex: 'none', marginTop: 1 }}><MakoStar size={15} /></span>
                <p style={{ margin: 0, fontFamily: SANS, fontSize: 14, color: 'var(--ink)', lineHeight: 1.55 }}>{set.nota}</p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
              {set.variants.map((vr, i) => (
                <article key={i} style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent)', background: 'var(--warn-bg)', borderRadius: 6, padding: '3px 8px' }}>{vr.angulo || `Variante ${i + 1}`}</span>
                    <button type="button" onClick={() => copiar(`all-${i}`, [vr.primary_text, vr.headline, vr.description].filter(Boolean).join('\n\n'))}
                      style={{ ...btnGhost, padding: '5px 10px', fontSize: 12 }}>
                      {copied === `all-${i}` ? 'Copiado ✓' : 'Copiar todo'}
                    </button>
                  </div>

                  <CopyField label="Texto principal" value={vr.primary_text} onCopy={() => copiar(`pt-${i}`, vr.primary_text)} copied={copied === `pt-${i}`} big />
                  {vr.headline && <CopyField label="Título" value={vr.headline} onCopy={() => copiar(`hl-${i}`, vr.headline)} copied={copied === `hl-${i}`} />}
                  {vr.description && <CopyField label="Descripción" value={vr.description} onCopy={() => copiar(`ds-${i}`, vr.description)} copied={copied === `ds-${i}`} />}

                  {vr.cta && (
                    <div style={{ marginTop: 2 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: SANS, fontSize: 13, fontWeight: 600, color: 'var(--primary-strong)', background: 'var(--primary-bg)', borderRadius: 8, padding: '6px 12px' }}>
                        {vr.cta}
                      </span>
                    </div>
                  )}
                </article>
              ))}
            </div>

            {/* barra de ajuste */}
            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <input
                value={ajuste}
                onChange={(e) => setAjuste(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') generar('adjust'); }}
                placeholder="Pedile un ajuste a MaKo… (ej: más corto, otro ángulo, tono más directo)"
                style={{ flex: 1, minWidth: 220, padding: '12px 15px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14.5, outline: 'none' }}
              />
              <button onClick={() => generar('adjust')} disabled={adjusting || !ajuste.trim()} style={{ ...btnDark, opacity: adjusting || !ajuste.trim() ? 0.45 : 1, cursor: adjusting || !ajuste.trim() ? 'not-allowed' : 'pointer' }}>
                {adjusting ? 'Ajustando…' : 'Ajustar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function CopyField({ label, value, onCopy, copied, big }: { label: string; value: string; onCopy: () => void; copied: boolean; big?: boolean }) {
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 11px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
        <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' }}>{label}</span>
        <button type="button" onClick={onCopy} title="Copiar" style={{ border: 'none', background: 'transparent', color: copied ? 'var(--good)' : 'var(--faint)', cursor: 'pointer', fontFamily: MONO, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {copied ? 'copiado ✓' : 'copiar'}
        </button>
      </div>
      <p style={{ margin: 0, fontFamily: SANS, fontSize: big ? 14.5 : 13.5, fontWeight: big ? 400 : 600, color: 'var(--ink)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{value}</p>
    </div>
  );
}
