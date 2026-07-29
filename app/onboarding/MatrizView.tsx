'use client';

// =============================================================================
// MatrizView — la MATRIZ 3×3 (avatar × razón), con pop-up rico por celda
// =============================================================================
// La tabla: filas = avatares, columnas = las razones de ESE avatar. Cada celda es un
// anuncio en potencia; al hacer clic se abre un modal con TABS internas: Contexto
// (avatar + razón + entregable), Copy (el hook, editable), Guion (video, se genera a
// pedido), Imagen (placeholder hasta que generemos imágenes) y Video (futuro). Es el
// primer tab del hub: la salida de la fábrica de creativos. Lee /api/onboarding/razones.

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { formatoPorId, type Medio } from '@/lib/angulos-data';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Avatar = { id: string; nombre: string; segmento: string; senalesMeta: string; situacion: string; dolor: string };
type Celda = { id: string; avatarId: string; nombre: string; descripcion: string; copy: string; guion: string; imagenUrl: string; anguloImagen: string; anguloVideo: string };
type Estado = { razones: Celda[]; avatares: Avatar[]; tieneAvatares: boolean; tieneBrief: boolean };
type Entregable = { id: string; nombre: string; tipo: string; queEs: string; fomo: string };
type TabModal = 'contexto' | 'avatar' | 'razon' | 'guion' | 'imagen' | 'video';

const btnPrimary: CSSProperties = { padding: '12px 22px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 500, cursor: 'pointer' };
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };

function Edit({ valor, onSave, multiline, style }: { valor: string; onSave: (v: string) => void; multiline?: boolean; style?: CSSProperties }) {
  return (
    <div className="mtz-edit" contentEditable suppressContentEditableWarning spellCheck={false}
      onBlur={(e) => { const raw = e.currentTarget.innerText || ''; const nv = multiline ? raw.replace(/\n{3,}/g, '\n\n').trim() : raw.replace(/\s+/g, ' ').trim(); if (nv !== (valor ?? '').trim()) onSave(nv); }}
      style={{ outline: 'none', cursor: 'text', borderRadius: 6, padding: '4px 8px', margin: '0 -8px', whiteSpace: multiline ? 'pre-wrap' : 'normal', ...style }}
    >{valor}</div>
  );
}

export function MatrizView() {
  const [est, setEst] = useState<Estado | null>(null);
  const [entregables, setEntregables] = useState<Entregable[]>([]);
  const [cargando, setCargando] = useState(true);
  const [gen, setGen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [tabModal, setTabModal] = useState<TabModal>('contexto');
  const [genGuion, setGenGuion] = useState(false);
  const [genAngulo, setGenAngulo] = useState<Medio | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [jr, je] = await Promise.all([
        (await fetch('/api/onboarding/razones')).json(),
        (await fetch('/api/onboarding/entregable')).json().catch(() => ({})),
      ]);
      if (jr.ok) setEst(jr as Estado); else setErr(jr.error);
      if (je && Array.isArray(je.entregables)) setEntregables(je.entregables as Entregable[]);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const generar = async () => {
    setGen(true); setErr(null);
    try {
      const j = await (await fetch('/api/onboarding/razones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generar' }) })).json();
      if (j.ok) setEst(j as Estado); else setErr(j.error || 'No se pudo generar la matriz.');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setGen(false); }
  };

  const guardar = async (razones: Celda[]) => {
    setEst((e) => (e ? { ...e, razones } : e));
    const j = await (await fetch('/api/onboarding/razones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'guardar', razones }) })).json();
    if (j.ok) setEst(j as Estado);
  };
  const editar = (id: string, campo: keyof Celda, v: string) => {
    if (!est) return;
    guardar(est.razones.map((r) => (r.id === id ? { ...r, [campo]: v } : r)));
  };
  const generarGuion = async (id: string) => {
    setGenGuion(true); setErr(null);
    try {
      const j = await (await fetch('/api/onboarding/razones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'guion', id }) })).json();
      if (j.ok) setEst(j as Estado); else setErr(j.error || 'No se pudo generar el guion.');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setGenGuion(false); }
  };
  const elegirAngulo = async (id: string, medio: Medio) => {
    setGenAngulo(medio); setErr(null);
    try {
      const j = await (await fetch('/api/onboarding/razones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'angulo', id, medio }) })).json();
      if (j.ok) setEst(j as Estado); else setErr(j.error || 'No se pudo elegir el ángulo.');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setGenAngulo(null); }
  };

  const css = <style>{'@keyframes mtz-spin{to{transform:rotate(360deg)}}@keyframes mtz-in{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}.mtz-edit:hover{background:var(--surface-2)}.mtz-edit:focus{background:var(--surface-2);box-shadow:inset 0 0 0 1px var(--border-strong)}.mtz-cell:hover{background:var(--surface-2)!important;border-color:var(--primary)!important}.mtz-cell:hover .mtz-arrow{color:var(--primary)!important}'}</style>;

  if (cargando) return <div style={{ ...eyebrow, padding: '18px 0', textAlign: 'center' }}>Cargando tu matriz…</div>;

  const razones = est?.razones ?? [];
  const avatares = est?.avatares ?? [];
  const razonesDe = (avId: string) => razones.filter((r) => r.avatarId === avId);
  const maxCols = Math.max(1, ...avatares.map((a) => razonesDe(a.id).length));

  if (gen) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: '80px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {css}
        <div style={{ width: 46, height: 46, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'mtz-spin .8s linear infinite' }} />
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginTop: 22 }}>MaKo está armando tu matriz</div>
      </div>
    );
  }

  if (!est?.tieneAvatares) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '48px 0' }}>
        {css}
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
        <h2 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 12px', lineHeight: 1.25 }}>Tu matriz de anuncios</h2>
        <div style={{ fontSize: 13.5, color: 'var(--warn)', lineHeight: 1.6 }}>Primero define tus avatares (y sube tu negocio en El Archivero).</div>
        {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 16 }}>{err}</div>}
      </div>
    );
  }

  if (!razones.length) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '48px 0' }}>
        {css}
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
        <h2 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 24px', lineHeight: 1.25 }}>Tu matriz de anuncios</h2>
        <button type="button" onClick={generar} style={btnPrimary}>✦ Armar mi matriz</button>
        {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 16 }}>{err}</div>}
      </div>
    );
  }

  const celda = abierta ? razones.find((r) => r.id === abierta) : null;
  const avatarDe = (id: string) => avatares.find((a) => a.id === id);
  const abrir = (id: string) => { setAbierta(id); setTabModal('contexto'); };

  return (
    <div>
      {css}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ ...eyebrow }}>Tu matriz de anuncios</div>
        <button type="button" onClick={generar} style={btnGhost}>↺ Regenerar</button>
      </div>

      {/* La grilla entra sin scroll horizontal: columnas flexibles (minmax 0,1fr) y la
          columna Avatar angosta. El detalle de cada anuncio vive en el pop-up. */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `minmax(88px, 124px) repeat(${maxCols}, minmax(0, 1fr))` }}>
          {/* Cabecera */}
          <div style={{ ...eyebrow, padding: '11px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>Avatar</div>
          {Array.from({ length: maxCols }, (_, i) => (
            <div key={i} style={{ ...eyebrow, padding: '11px 12px', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', background: 'var(--surface-2)' }}>Razón {i + 1}</div>
          ))}

          {avatares.map((av) => {
            const rs = razonesDe(av.id);
            return (
              <div key={av.id} style={{ display: 'contents' }}>
                <div style={{ padding: '11px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 2, justifyContent: 'center', minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{av.nombre}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{av.segmento}</div>
                </div>
                {Array.from({ length: maxCols }, (_, i) => {
                  const r = rs[i];
                  return (
                    <button key={i} type="button" className={r ? 'mtz-cell' : undefined} onClick={() => r && abrir(r.id)}
                      style={{ position: 'relative', textAlign: 'left', font: 'inherit', cursor: r ? 'pointer' : 'default', padding: '11px 26px 11px 12px', borderTop: '1px solid var(--border)', borderLeft: '1px solid var(--border)', background: 'var(--surface)', transition: 'all .12s', minHeight: 52, minWidth: 0, display: 'flex', alignItems: 'center' }}>
                      {r ? (
                        <>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>{r.nombre}</span>
                          {/* Flechita: señal de que la celda se abre. */}
                          <svg className="mtz-arrow" aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', top: 9, right: 9, color: 'var(--faint)', transition: 'color .12s' }}><path d="M7 17L17 7" /><path d="M7 7h10v10" /></svg>
                        </>
                      ) : <span style={{ fontSize: 12, color: 'var(--faint)' }}>—</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 14, textAlign: 'center' }}>{err}</div>}

      {/* ── MODAL con tabs internas ── */}
      {celda && (() => {
        const av = avatarDe(celda.avatarId);
        const tabs: Array<{ k: TabModal; label: string }> = [
          { k: 'contexto', label: 'Contexto' }, { k: 'avatar', label: 'Avatar' }, { k: 'razon', label: 'Razón de compra' }, { k: 'guion', label: 'Guion' }, { k: 'imagen', label: 'Imagen' }, { k: 'video', label: 'Video' },
        ];
        return (
          <div onClick={() => setAbierta(null)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ animation: 'mtz-in .18s ease-out', width: 'min(640px, 100%)', maxHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderTop: '3px solid var(--primary)', borderRadius: 16, boxShadow: '0 20px 60px rgba(18,21,27,.25)', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '18px 22px 12px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ ...eyebrow, color: 'var(--accent)' }}>Anuncio · {av?.nombre || 'Avatar'}</div>
                  <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1.2, marginTop: 3 }}>{celda.nombre}</div>
                </div>
                <button type="button" onClick={() => setAbierta(null)} aria-label="Cerrar" style={{ flex: 'none', width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', fontSize: 15 }}>✕</button>
              </div>
              {/* Tabs internas */}
              <div style={{ display: 'flex', gap: 4, padding: '0 22px', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
                {tabs.map((t) => {
                  const on = tabModal === t.k;
                  return <button key={t.k} type="button" onClick={() => setTabModal(t.k)} style={{ border: 'none', borderBottom: `2px solid ${on ? 'var(--primary)' : 'transparent'}`, background: 'none', color: on ? 'var(--ink)' : 'var(--dim)', fontFamily: SANS, fontWeight: on ? 600 : 500, fontSize: 13, padding: '9px 10px', cursor: 'pointer', flex: 'none' }}>{t.label}</button>;
                })}
              </div>
              {/* Cuerpo */}
              <div style={{ overflowY: 'auto', padding: '18px 22px 22px' }}>
                {tabModal === 'contexto' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <Bloque label="Copy / hook del anuncio">
                      <Edit valor={celda.copy} multiline onSave={(v) => editar(celda.id, 'copy', v)} style={{ fontFamily: SANS, fontSize: 15.5, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.5, minHeight: 40 }} />
                    </Bloque>
                    {/* Un poco más de contexto, no solo el hook: a quién le habla y por qué. */}
                    <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                      Anuncio para <b style={{ color: 'var(--ink)' }}>{av?.nombre || 'este avatar'}</b>, motivado por <b style={{ color: 'var(--ink)' }}>{celda.nombre}</b>.
                      {entregables.length > 0 && <> Apóyate en el entregable tangible: <b style={{ color: 'var(--ink)' }}>{entregables.map((e) => e.nombre).join(', ')}</b>.</>}
                      {' '}Mirá las tabs <b>Avatar</b> y <b>Razón de compra</b> para el detalle.
                    </div>
                  </div>
                )}
                {tabModal === 'avatar' && (
                  <Bloque label="Avatar · a quién le hablas">
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{av?.nombre || '—'}</div>
                    {av && <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6, marginTop: 6 }}><b>Segmento:</b> {av.segmento}<br /><b>Situación:</b> {av.situacion}<br /><b>Dolor:</b> {av.dolor}{av.senalesMeta && <><br /><b>Señales en Meta:</b> {av.senalesMeta}</>}</div>}
                  </Bloque>
                )}
                {tabModal === 'razon' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <Bloque label="Razón de compra · la motivación">
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{celda.nombre}</div>
                      <Edit valor={celda.descripcion} onSave={(v) => editar(celda.id, 'descripcion', v)} style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6, marginTop: 6 }} />
                    </Bloque>
                    {entregables.length > 0 && (
                      <Bloque label="Entregable tangible">
                        {entregables.map((e) => <div key={e.id} style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>· <b>{e.nombre}</b> — {e.queEs}</div>)}
                      </Bloque>
                    )}
                  </div>
                )}
                {tabModal === 'guion' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                      <div style={eyebrow}>Guion de video</div>
                      <button type="button" onClick={() => generarGuion(celda.id)} disabled={genGuion} style={{ ...btnGhost, opacity: genGuion ? 0.6 : 1 }}>{genGuion ? 'Escribiendo…' : celda.guion ? '↺ Regenerar' : '✦ Generar guion'}</button>
                    </div>
                    {celda.guion
                      ? <Edit valor={celda.guion} multiline onSave={(v) => editar(celda.id, 'guion', v)} style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.6, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', margin: 0 }} />
                      : <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6, textAlign: 'center', padding: '28px 0' }}>Todavía no hay guion. Genera uno a partir de esta razón y el entregable.</div>}
                  </div>
                )}
                {tabModal === 'imagen' && (
                  <AnguloTab medio="imagen" formatoId={celda.anguloImagen} cargando={genAngulo === 'imagen'}
                    onElegir={() => elegirAngulo(celda.id, 'imagen')}
                    nota="Con este formato y la persona de marca, acá vas a generar la imagen del anuncio (próximamente)." />
                )}
                {tabModal === 'video' && (
                  <AnguloTab medio="video" formatoId={celda.anguloVideo} cargando={genAngulo === 'video'}
                    onElegir={() => elegirAngulo(celda.id, 'video')}
                    nota="El guion de la tab anterior sigue este formato. Con eso, acá vas a generar el video (próximamente)." />
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function Bloque({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
// Tab Imagen/Video: el ÁNGULO (formato) elegido por la IA para ese medio, o el botón
// para que MaKo lo elija de la biblioteca. La generación real de imagen/video llega después.
function AnguloTab({ medio, formatoId, cargando, onElegir, nota }: { medio: Medio; formatoId: string; cargando: boolean; onElegir: () => void; nota: string }) {
  const fmt = formatoId ? formatoPorId(formatoId) : undefined;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={eyebrow}>Ángulo de {medio === 'imagen' ? 'imagen' : 'video'}</div>
        {fmt && <button type="button" onClick={onElegir} disabled={cargando} style={{ ...btnGhost, opacity: cargando ? 0.6 : 1 }}>{cargando ? 'Eligiendo…' : '↺ Que la IA cambie el ángulo'}</button>}
      </div>
      {fmt ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-2)', padding: '14px 16px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{fmt.nombre}</div>
          <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.55, marginTop: 5 }}>{fmt.descripcion}</div>
          <div style={{ fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.5, marginTop: 8, fontStyle: 'italic' }}>Ej: {fmt.ejemplo}</div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '26px 14px', border: '1px dashed var(--border-strong)', borderRadius: 12, background: 'var(--surface-2)' }}>
          <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.55, marginBottom: 14, maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>MaKo elige el mejor formato de {medio} de su biblioteca para este anuncio.</div>
          <button type="button" onClick={onElegir} disabled={cargando} style={{ ...btnPrimary, opacity: cargando ? 0.6 : 1 }}>{cargando ? 'Eligiendo…' : '✦ Que la IA elija el ángulo'}</button>
        </div>
      )}
      <div style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.5 }}>{nota}</div>
    </div>
  );
}
