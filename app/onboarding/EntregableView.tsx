'use client';

// =============================================================================
// EntregableView — el elemento TANGIBLE de la oferta (el que genera FOMO)
// =============================================================================
// Self-contained: /api/onboarding/entregable. MaKo propone 1-3 entregables tangibles
// (dashboard/excel/metodología…) desde el brief; cada uno con qué ES y una línea de
// FOMO. Además el cliente puede CARGAR EL SUYO directo ("+ Agregar el mío") — muchas
// veces ya lo tiene claro. Edición inline. Corre con la IA gratis del cliente.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Entregable = { id: string; nombre: string; tipo: string; queEs: string; fomo: string };
type Estado = { entregables: Entregable[]; tieneBrief: boolean };

const btnPrimary: CSSProperties = { padding: '12px 22px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 500, cursor: 'pointer' };
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };

function Edit({ valor, ph, onSave, style }: { valor: string; ph?: string; onSave: (v: string) => void; style?: CSSProperties }) {
  return (
    <div className="ent-edit" contentEditable suppressContentEditableWarning spellCheck={false} data-ph={ph || 'Escribe…'}
      onBlur={(e) => { const nv = (e.currentTarget.textContent || '').replace(/\s+/g, ' ').trim(); if (nv !== (valor ?? '').trim()) onSave(nv); }}
      style={{ outline: 'none', cursor: 'text', borderRadius: 6, padding: '2px 6px', margin: '0 -6px', ...style }}
    >{valor}</div>
  );
}

const nuevoId = () => `ent_${Math.abs(Date.now() ^ Math.floor(performance.now() * 1000))}`;

export function EntregableView() {
  const [est, setEst] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [gen, setGen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try { const j = await (await fetch('/api/onboarding/entregable')).json(); if (j.ok) setEst(j as Estado); else setErr(j.error); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const generar = async () => {
    setGen(true); setErr(null);
    try {
      const j = await (await fetch('/api/onboarding/entregable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generar' }) })).json();
      if (j.ok) setEst(j as Estado); else setErr(j.error || 'No se pudo detectar el entregable.');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setGen(false); }
  };

  const guardar = async (entregables: Entregable[]) => {
    setEst((e) => (e ? { ...e, entregables } : e));
    const j = await (await fetch('/api/onboarding/entregable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'guardar', entregables }) })).json();
    if (j.ok) setEst(j as Estado);
  };
  const editar = (id: string, campo: keyof Entregable, v: string) => {
    if (!est) return;
    guardar(est.entregables.map((g) => (g.id === id ? { ...g, [campo]: v } : g)));
  };
  const agregarMio = () => {
    if (!est) return;
    guardar([...est.entregables, { id: nuevoId(), nombre: 'Mi entregable', tipo: 'Otro', queEs: '', fomo: '' }]);
  };
  const borrar = (id: string) => { if (est) guardar(est.entregables.filter((g) => g.id !== id)); };

  const css = <style>{'@keyframes ent-spin{to{transform:rotate(360deg)}}.ent-edit:hover{background:var(--surface-2)}.ent-edit:focus{background:var(--surface-2);box-shadow:inset 0 0 0 1px var(--border-strong)}.ent-edit:empty:before{content:attr(data-ph);color:var(--faint)}'}</style>;

  if (cargando) return <div style={{ ...eyebrow, padding: '18px 0', textAlign: 'center' }}>Cargando tu entregable…</div>;

  const entregables = est?.entregables ?? [];

  if (gen) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: '80px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {css}
        <div style={{ width: 46, height: 46, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'ent-spin .8s linear infinite' }} />
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginTop: 22 }}>MaKo está buscando tu entregable</div>
        <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 8, lineHeight: 1.6 }}>El elemento tangible que hace tu oferta imposible de ignorar.</div>
      </div>
    );
  }

  if (!entregables.length) {
    return (
      <div style={{ maxWidth: 540, margin: '0 auto', textAlign: 'center', padding: '48px 0' }}>
        {css}
        <div style={{ fontSize: 40, marginBottom: 12 }}>🧲</div>
        <h2 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 12px', lineHeight: 1.25 }}>Tu entregable</h2>
        <p style={{ fontSize: 14.5, color: 'var(--dim)', lineHeight: 1.6, margin: '0 auto 24px', maxWidth: 470 }}>
          El elemento <b>tangible</b> de tu oferta —un dashboard, una planilla, una metodología con nombre— que se entiende al instante y genera <b>FOMO</b> en tus anuncios.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {est?.tieneBrief && <button type="button" onClick={generar} style={btnPrimary}>✦ Que MaKo lo detecte</button>}
          <button type="button" onClick={agregarMio} style={btnGhost}>+ Cargar el mío</button>
        </div>
        {!est?.tieneBrief && <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.6, marginTop: 14 }}>Para que MaKo lo detecte, carga tu negocio en El Archivero. O cárgalo tú directo arriba.</div>}
        {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 16 }}>{err}</div>}
      </div>
    );
  }

  return (
    <div>
      {css}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...eyebrow, marginBottom: 4 }}>Tu entregable · el elemento tangible</div>
          <div style={{ fontSize: 13, color: 'var(--dim)', maxWidth: 520 }}>Lo concreto que hace tu oferta imposible de ignorar y dispara FOMO en los ads. Toca cualquier texto para ajustarlo.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={agregarMio} style={btnGhost}>+ Agregar el mío</button>
          {est?.tieneBrief && <button type="button" onClick={generar} style={btnGhost}>↺ Regenerar</button>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {entregables.map((g) => (
          <div key={g.id} style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: 18, display: 'flex', flexDirection: 'column', gap: 11, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Edit valor={g.tipo} ph="Tipo" onSave={(v) => editar(g.id, 'tipo', v)} style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent)', background: 'var(--accent-soft)', border: '1px solid var(--border)', borderRadius: 999, padding: '4px 10px' }} />
              <button type="button" onClick={() => borrar(g.id)} aria-label="Quitar" style={{ border: 'none', background: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 15, padding: 2 }}>✕</button>
            </div>
            <Edit valor={g.nombre} ph="Nombre del entregable" onSave={(v) => editar(g.id, 'nombre', v)} style={{ fontFamily: SANS, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1.2 }} />
            <Edit valor={g.queEs} ph="¿Qué es y qué resuelve?" onSave={(v) => editar(g.id, 'queEs', v)} style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.55 }} />
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#C8870C', marginBottom: 4 }}>Gancho para el anuncio (FOMO)</div>
              <Edit valor={g.fomo} ph="La línea de FOMO para el ad" onSave={(v) => editar(g.id, 'fomo', v)} style={{ fontSize: 13.5, fontStyle: 'italic', fontWeight: 500, color: 'var(--ink)', lineHeight: 1.45 }} />
            </div>
          </div>
        ))}
      </div>
      {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 14, textAlign: 'center' }}>{err}</div>}
    </div>
  );
}
