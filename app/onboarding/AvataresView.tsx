'use client';

// =============================================================================
// AvataresView — los 3 AVATARES SEGMENTABLES que MaKo propone (el "¿a quién?" de Jan)
// =============================================================================
// Self-contained: trae su estado de /api/onboarding/avatares. Cada avatar es un
// SEGMENTO de cliente targeteable en Meta (firmografía: industria, tamaño, rol,
// geografía), no un retrato emocional. Card con: segmento, situación, dolor y —lo
// accionable— cómo lo targeteás en Meta. Edición inline. Debajo, el "cliente ideal"
// base (campos avatar_*, editables) que es el contexto del que salen los segmentos
// (P4: "Avatar" se unifica con "Avatares"). Corre con la IA gratis del cliente.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { CamposNegocio } from './CamposNegocio';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Avatar = { id: string; nombre: string; segmento: string; senalesMeta: string; situacion: string; dolor: string };
type Estado = { avatares: Avatar[]; tieneBrief: boolean };

const btnPrimary: CSSProperties = { padding: '12px 22px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 500, cursor: 'pointer' };
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };

// Texto editable en el lugar.
function Edit({ valor, onSave, style }: { valor: string; onSave: (v: string) => void; style?: CSSProperties }) {
  return (
    <div className="ava-edit" contentEditable suppressContentEditableWarning spellCheck={false}
      onBlur={(e) => { const nv = (e.currentTarget.textContent || '').replace(/\s+/g, ' ').trim(); if (nv !== (valor ?? '').trim()) onSave(nv); }}
      style={{ outline: 'none', cursor: 'text', borderRadius: 6, padding: '2px 6px', margin: '0 -6px', ...style }}
    >{valor}</div>
  );
}

// Campo etiquetado (Segmento / Situación / Dolor) dentro de la card.
function Campo({ label, color, valor, onSave }: { label: string; color: string; valor: string; onSave: (v: string) => void }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color, marginBottom: 3 }}>{label}</div>
      <Edit valor={valor} onSave={onSave} style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }} />
    </div>
  );
}

function ContextoClienteIdeal({ onSaved }: { onSaved?: () => void }) {
  return <CamposNegocio titulo="Tu cliente ideal (contexto)" subtitulo="La base de la que MaKo saca los segmentos. Corrígela y vuelve a generar para afinarlos." prefijos={['avatar_']} onSaved={onSaved} />;
}

export function AvataresView() {
  const [est, setEst] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [gen, setGen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try { const j = await (await fetch('/api/onboarding/avatares')).json(); if (j.ok) setEst(j as Estado); else setErr(j.error); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const generar = async () => {
    setGen(true); setErr(null);
    try {
      const j = await (await fetch('/api/onboarding/avatares', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generar' }) })).json();
      if (j.ok) setEst(j as Estado); else setErr(j.error || 'No se pudieron generar los avatares.');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setGen(false); }
  };

  const guardar = async (avatares: Avatar[]) => {
    setEst((e) => (e ? { ...e, avatares } : e));
    const j = await (await fetch('/api/onboarding/avatares', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'guardar', avatares }) })).json();
    if (j.ok) setEst(j as Estado);
  };
  const editar = (id: string, campo: keyof Avatar, v: string) => {
    if (!est) return;
    guardar(est.avatares.map((a) => (a.id === id ? { ...a, [campo]: v } : a)));
  };

  const css = <style>{'@keyframes ava-spin{to{transform:rotate(360deg)}}.ava-edit:hover{background:var(--surface-2)}.ava-edit:focus{background:var(--surface-2);box-shadow:inset 0 0 0 1px var(--border-strong)}'}</style>;

  if (cargando) return <div style={{ ...eyebrow, padding: '18px 0', textAlign: 'center' }}>Cargando tus avatares…</div>;

  const avatares = est?.avatares ?? [];

  // ── Generando ────────────────────────────────────────────────────────────────
  if (gen) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: '80px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {css}
        <div style={{ width: 46, height: 46, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'ava-spin .8s linear infinite' }} />
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginTop: 22 }}>MaKo está definiendo tus segmentos</div>
        <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 8, lineHeight: 1.6 }}>Busca 3 tipos de cliente distintos que podrías targetear en Meta por separado.</div>
      </div>
    );
  }

  // ── Cabecera + acción ────────────────────────────────────────────────────────
  const header = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
      <div>
        <div style={{ ...eyebrow, marginBottom: 4 }}>Tus avatares · segmentos para Meta</div>
        <div style={{ fontSize: 13, color: 'var(--dim)', maxWidth: 520 }}>Tres tipos de cliente distintos (por industria, tamaño, rol o zona) que targetearías por separado. Toca cualquier texto para ajustarlo.</div>
      </div>
      {avatares.length > 0 && <button type="button" onClick={generar} style={btnGhost}>↺ Regenerar</button>}
    </div>
  );

  // ── Vacío: generar ─────────────────────────────────────────────────────────
  if (!avatares.length) {
    return (
      <div>
        {css}
        <div style={{ maxWidth: 520, margin: '0 auto 28px', textAlign: 'center', padding: '36px 0 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
          <h2 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 12px', lineHeight: 1.25 }}>Tus avatares</h2>
          <p style={{ fontSize: 14.5, color: 'var(--dim)', lineHeight: 1.6, margin: '0 auto 24px', maxWidth: 460 }}>
            Antes de los ángulos, defino a <b>quién</b> le hablas. Propongo <b>3 segmentos</b> de cliente distintos —por industria, tamaño, rol o zona— que podrías targetear en Meta por separado.
          </p>
          {est?.tieneBrief ? (
            <button type="button" onClick={generar} style={btnPrimary}>✦ Proponer mis 3 segmentos</button>
          ) : (
            <div style={{ fontSize: 13.5, color: 'var(--warn)', lineHeight: 1.6 }}>Primero carga tu negocio en <b>El Archivero</b>: de ahí salen los avatares.</div>
          )}
          {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 16 }}>{err}</div>}
        </div>
        <ContextoClienteIdeal onSaved={cargar} />
      </div>
    );
  }

  // ── Las 3 cards + contexto ──────────────────────────────────────────────────
  return (
    <div>
      {css}
      {header}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
        {avatares.map((a, i) => (
          <div key={a.id} style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
              <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: 'var(--faint)', flex: 'none' }}>0{i + 1}</span>
              <Edit valor={a.nombre} onSave={(v) => editar(a.id, 'nombre', v)} style={{ fontFamily: SANS, fontSize: 17.5, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1.2 }} />
            </div>
            <Campo label="Segmento" color="#2F6DDB" valor={a.segmento} onSave={(v) => editar(a.id, 'segmento', v)} />
            <Campo label="Situación" color="var(--faint)" valor={a.situacion} onSave={(v) => editar(a.id, 'situacion', v)} />
            <Campo label="Dolor" color="#CF4E29" valor={a.dolor} onSave={(v) => editar(a.id, 'dolor', v)} />
            {/* Lo accionable: cómo lo targeteás en Meta. Caja acentuada. */}
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 3 }}>Cómo lo targeteas en Meta</div>
              <Edit valor={a.senalesMeta} onSave={(v) => editar(a.id, 'senalesMeta', v)} style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }} />
            </div>
          </div>
        ))}
      </div>
      {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 14, textAlign: 'center' }}>{err}</div>}
      <div style={{ borderTop: '1px solid var(--border)', margin: '26px 0 20px' }} />
      <ContextoClienteIdeal />
    </div>
  );
}
