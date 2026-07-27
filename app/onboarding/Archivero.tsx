'use client';

// =============================================================================
// El Archivero — el repositorio de documentos del negocio (v3, docs-first)
// =============================================================================
// Flujo (pedido de Martín 2026-07-27): los DOCUMENTOS primero, la preview al final.
//   · inicio   → un dropzone: soltás TODOS tus documentos y le das Analizar.
//   · leyendo  → MaKo lee y arma tu perfil (+ un panorama libre de todo).
//   · masdocs  → "¿Seguro que no tenés más documentos?" antes de completar a mano.
//   · huecos   → lo que ningún doc resolvió, como preguntas CERRADAS 1x1 (estilo
//                Perro): personalizadas, con opciones + "lo escribo yo". NO abiertas.
//   · panorama → recién acá la preview: el PANORAMA de todo lo que MaKo entendió +
//                el perfil por campos (con procedencia) + tus archivos.
// Los docs SIEMPRE ganan sobre lo cargado a mano. Self-contained (trae su estado).
// =============================================================================

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const ACCEPT = '.txt,.md,.markdown,.docx,.pdf,image/*';

type Fuente = { tipo: 'archivo' | 'manual'; id?: string; nombre?: string };
type FileRow = { id: string; nombre: string; mime: string | null; tamano: number | null; razonamiento: string | null; aporto: number; created_at: string };
type Campo = { key: string; label: string; type: string; placeholder?: string; grupo: string };
type Estado = { files: FileRow[]; brief: Campo[]; answers: Record<string, string>; fuente: Record<string, Fuente>; gaps: string[]; panorama: string; esSuperAdmin: boolean };
type PregCerrada = { key: string; pregunta: string; opciones: string[] };
type Vista = 'inicio' | 'leyendo' | 'masdocs' | 'huecos' | 'panorama';

const fmtSize = (n?: number | null) => (!n ? '' : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 22 };
const input: CSSProperties = { width: '100%', padding: '12px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 15, outline: 'none' };
const btnPrimary: CSSProperties = { padding: '11px 22px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '11px 18px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 14, fontWeight: 500, cursor: 'pointer' };
const link: CSSProperties = { background: 'none', border: 'none', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, textDecoration: 'underline', cursor: 'pointer', padding: 0 };
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };

// El panorama viene con subtítulos EN MAYÚSCULA + párrafos. Lo formateamos nativo.
function PanoramaText({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: ReactNode[] = [];
  let k = 0;
  const esSub = (l: string) => l.length > 0 && l.length <= 48 && l === l.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(l) && !/[a-záéíóúñ]/.test(l);
  for (const raw of lines) {
    const l = raw.trim().replace(/\*\*/g, '').replace(/^#+\s*/, '').trim(); // limpiar markdown (**bold**, #)
    if (!l) continue;
    if (esSub(l)) out.push(<div key={k++} style={{ ...eyebrow, color: 'var(--accent)', marginTop: out.length ? 16 : 0, marginBottom: 6 }}>{l.replace(/[:：]$/, '')}</div>);
    else out.push(<p key={k++} style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, margin: '0 0 8px' }}>{l.replace(/^[-•·]\s*/, '')}</p>);
  }
  return <div>{out}</div>;
}

export function Archivero({ onEstado, onFacts }: {
  onEstado?: (answers: Record<string, string>) => void;
  /** Los campos ya conocidos, para pintarlos en el panel negro (la "prueba"). */
  onFacts?: (facts: { k: string; v: string }[]) => void;
}) {
  const [est, setEst] = useState<Estado | null>(null);
  const [vista, setVista] = useState<Vista>('inicio');
  const [cargando, setCargando] = useState(true);
  const [drag, setDrag] = useState(false);
  const [cola, setCola] = useState<{ file: File; url: string | null }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [editVals, setEditVals] = useState<Record<string, string>>({});
  // Huecos como preguntas cerradas 1x1.
  const [preguntas, setPreguntas] = useState<PregCerrada[]>([]);
  const [gapIdx, setGapIdx] = useState(0);
  const [cargandoPreg, setCargandoPreg] = useState(false);
  const [otroKey, setOtroKey] = useState<string | null>(null); // qué pregunta está en modo "lo escribo yo"
  const [otroVal, setOtroVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const aplicar = useCallback((e: Estado) => {
    setEst(e);
    onEstado?.(e.answers);
    onFacts?.(e.brief.filter((c) => (e.answers[c.key] ?? '').trim()).map((c) => ({ k: c.label, v: e.answers[c.key] })));
  }, [onEstado, onFacts]);

  const cargar = useCallback(async () => {
    try { const j = await (await fetch('/api/onboarding/archivero')).json(); if (j.ok) aplicar(j as Estado); else setErr(j.error || 'No se pudo cargar.'); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setCargando(false); }
  }, [aplicar]);
  useEffect(() => { cargar(); }, [cargar]);

  // Sumar a la cola (acumulativo, con preview para imágenes). Todavía NO analiza.
  const addCola = (fl: FileList | null) => {
    const arr = fl ? Array.from(fl) : [];
    if (!arr.length) return;
    setCola((prev) => {
      const map = new Map(prev.map((c) => [c.file.name + c.file.size, c]));
      for (const f of arr) { const k = f.name + f.size; if (!map.has(k)) map.set(k, { file: f, url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null }); }
      return Array.from(map.values());
    });
  };
  const quitarCola = (k: string) => setCola((prev) => { const c = prev.find((x) => x.file.name + x.file.size === k); if (c?.url) URL.revokeObjectURL(c.url); return prev.filter((x) => x.file.name + x.file.size !== k); });

  const analizar = async () => {
    if (!cola.length) return;
    setVista('leyendo'); setErr(null); setWarnings([]);
    try {
      const fd = new FormData(); cola.forEach((c) => fd.append('file', c.file));
      const j = await (await fetch('/api/onboarding/archivero', { method: 'POST', body: fd })).json();
      setWarnings(Array.isArray(j.warnings) ? j.warnings : []);
      if (j.brief) { aplicar(j as Estado); cola.forEach((c) => c.url && URL.revokeObjectURL(c.url)); setCola([]); setVista('masdocs'); }
      else { setErr(j.error || 'No se pudo procesar.'); setVista('inicio'); }
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setVista('inicio'); }
  };

  // "No tengo más": si faltan datos, la IA arma las preguntas cerradas; si no, al panorama.
  const seguirDesdeMasDocs = async () => {
    if (!est || est.gaps.length === 0) { setVista('panorama'); return; }
    setCargandoPreg(true); setErr(null);
    try {
      const j = await (await fetch('/api/onboarding/archivero/preguntas', { method: 'POST' })).json();
      const pregs: PregCerrada[] = Array.isArray(j.preguntas) ? j.preguntas : [];
      setPreguntas(pregs); setGapIdx(0); setOtroKey(null); setOtroVal('');
      setVista(pregs.length ? 'huecos' : 'panorama'); // sin preguntas (o IA falló) → panorama
    } catch { setVista('panorama'); }
    finally { setCargandoPreg(false); }
  };

  const borrar = async (id: string) => {
    setConfirmDel(null); setErr(null);
    try { const j = await (await fetch(`/api/onboarding/archivero?id=${id}`, { method: 'DELETE' })).json(); if (j.ok) aplicar(j as Estado); else setErr(j.error); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };

  const guardarManual = async (campos: Record<string, string>) => {
    const j = await (await fetch('/api/onboarding/archivero/manual', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campos }) })).json();
    if (j.ok && j.brief) aplicar(j as Estado);
    return j;
  };

  // Responder / saltar una pregunta cerrada y avanzar. Al terminar → panorama.
  const responderGap = async (key: string, valor: string | null) => {
    if (valor && valor.trim()) await guardarManual({ [key]: valor.trim() });
    setOtroKey(null); setOtroVal('');
    if (gapIdx + 1 >= preguntas.length) setVista('panorama'); else setGapIdx((i) => i + 1);
  };

  if (cargando || !est) return <div style={{ ...eyebrow, padding: '18px 0', textAlign: 'center' }}>{err ? <span style={{ color: 'var(--bad)' }}>{err}</span> : 'Cargando el archivero…'}</div>;

  const hayArchivos = est.files.length > 0;
  const hayPerfil = Object.keys(est.answers).length > 0;
  const grupos: { label: string; campos: Campo[] }[] = [];
  for (const c of est.brief) { let g = grupos.find((x) => x.label === c.grupo); if (!g) { g = { label: c.grupo, campos: [] }; grupos.push(g); } g.campos.push(c); }
  const fuenteTxt = (k: string) => { const f = est.fuente[k]; return !f ? '' : f.tipo === 'manual' ? 'a mano' : (f.nombre || 'un archivo'); };

  const cajaWarn = warnings.length > 0 && (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '10px 13px' }}>
      {warnings.map((w, i) => <div key={i} style={{ fontSize: 12, color: 'var(--warn)', lineHeight: 1.5 }}>· {w}</div>)}
    </div>
  );

  // ── LEYENDO ────────────────────────────────────────────────────────────────
  if (vista === 'leyendo') {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: '96px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <style>{'@keyframes arch-spin{to{transform:rotate(360deg)}}'}</style>
        <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'arch-spin .8s linear infinite' }} />
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)', marginTop: 24 }}>MaKo está leyendo tus documentos</div>
        <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 8, lineHeight: 1.6 }}>Ordenando tu avatar, tu oferta y tu nicho,<br />y armando el panorama de tu negocio. Tarda unos segundos.</div>
      </div>
    );
  }

  // ── ¿MÁS DOCUMENTOS? (con insight de lo leído + qué doc falta, por nombre) ───
  if (vista === 'masdocs') {
    const insights = est.files.filter((f) => (f.razonamiento || '').trim());
    const faltan = grupos.filter((g) => g.campos.length > 0 && g.campos.every((c) => !(est.answers[c.key] ?? '').trim()));
    const nombreDoc = (label: string) => /oferta/i.test(label) ? 'tu OFERTA o tu PRODUCTO' : /avatar/i.test(label) ? 'tu AVATAR (quién es tu cliente y qué le duele)' : /negocio|nicho/i.test(label) ? 'a qué te dedicás' : label.toLowerCase();
    return (
      <div style={{ maxWidth: 580, margin: '0 auto', padding: '20px 0' }}>
        {/* PRIMERO: lo que MaKo entendió de cada documento (prueba de que lo leyó) */}
        {insights.length > 0 && (
          <div style={{ ...card, textAlign: 'left', padding: '18px 20px', borderColor: 'var(--accent)' }}>
            <div style={{ ...eyebrow, color: 'var(--accent)', marginBottom: 12 }}>✦ Esto entendí de lo que subiste</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {insights.map((f) => (
                <div key={f.id} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--good)', fontSize: 16, flex: 'none', marginTop: 1 }}>✓</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.55 }}>{f.razonamiento}</div>
                    <div style={{ ...eyebrow, fontSize: 10, marginTop: 4 }}>{f.nombre}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DESPUÉS: pedir más documentos (o el que falta, por nombre) */}
        <div style={{ textAlign: 'center', marginTop: insights.length ? 26 : 0 }}>
          <div style={{ fontSize: 38, marginBottom: 8 }}>📂</div>
          <h2 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 6px', lineHeight: 1.2 }}>¿Seguro que no tenés más documentos?</h2>
        </div>

        {faltan.length > 0 ? (
          <div style={{ ...card, marginTop: 12, textAlign: 'left', background: 'var(--primary-bg)', borderColor: 'var(--primary)', padding: '15px 18px' }}>
            <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.55 }}>
              Todavía no vi {faltan.map((g, i) => (
                <span key={g.label}>{i > 0 ? (i === faltan.length - 1 ? ' ni ' : ', ') : ''}<b>{nombreDoc(g.label)}</b></span>
              ))}. ¿Tenés un documento de {faltan.length === 1 ? 'eso' : 'esos'}? Subilo y no te lo tengo que preguntar a mano.
            </div>
          </div>
        ) : (
          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--dim)', lineHeight: 1.6, margin: '12px auto 0', maxWidth: 440 }}>
            Cuantos más documentos me des —avatar, oferta, nicho, guiones, tu web—, mejor te entiendo.
          </p>
        )}

        {cajaWarn && <div style={{ margin: '14px 0' }}>{cajaWarn}</div>}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => { setErr(null); setWarnings([]); setVista('inicio'); }} style={btnGhost}>Tengo más, subir</button>
          <button type="button" onClick={seguirDesdeMasDocs} disabled={cargandoPreg} style={{ ...btnPrimary, opacity: cargandoPreg ? 0.6 : 1 }}>
            {cargandoPreg ? 'Preparando…' : est.gaps.length ? 'No, completá lo que falte →' : 'No, ver mi perfil →'}
          </button>
        </div>
        {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 16, textAlign: 'center' }}>{err}</div>}
      </div>
    );
  }

  // ── HUECOS: preguntas CERRADAS 1x1 (estilo Perro) ───────────────────────────
  if (vista === 'huecos') {
    const p = preguntas[gapIdx];
    if (!p) { setVista('panorama'); return null; }
    const enOtro = otroKey === p.key;
    return (
      <div style={{ maxWidth: 540, margin: '0 auto', textAlign: 'center', padding: '18px 0' }}>
        <div style={{ ...eyebrow, marginBottom: 18 }}>Pregunta {gapIdx + 1} de {preguntas.length}</div>
        <h2 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 22px', lineHeight: 1.28 }}>{p.pregunta}</h2>
        {!enOtro ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxWidth: 460, margin: '0 auto', textAlign: 'left' }}>
            {p.opciones.map((o, i) => (
              <button key={i} type="button" onClick={() => responderGap(p.key, o)}
                style={{ textAlign: 'left', cursor: 'pointer', fontFamily: SANS, fontSize: 14.5, padding: '13px 16px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', lineHeight: 1.4 }}>
                {o}
              </button>
            ))}
            <button type="button" onClick={() => { setOtroKey(p.key); setOtroVal(''); }}
              style={{ textAlign: 'left', cursor: 'pointer', fontFamily: SANS, fontSize: 14, padding: '13px 16px', borderRadius: 12, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)' }}>
              ✎ Otra — lo escribo yo
            </button>
          </div>
        ) : (
          <div style={{ maxWidth: 460, margin: '0 auto', textAlign: 'left' }}>
            <textarea style={{ ...input, minHeight: 90, resize: 'vertical', lineHeight: 1.5 }} value={otroVal} autoFocus placeholder="Escribilo con tus palabras…" onChange={(e) => setOtroVal(e.target.value)} />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
              <button type="button" onClick={() => { setOtroKey(null); setOtroVal(''); }} style={btnGhost}>Volver a las opciones</button>
              <button type="button" onClick={() => responderGap(p.key, otroVal)} disabled={!otroVal.trim()} style={{ ...btnPrimary, opacity: otroVal.trim() ? 1 : 0.4 }}>Guardar y seguir</button>
            </div>
          </div>
        )}
        {!enOtro && (
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 22, alignItems: 'center' }}>
            <button type="button" onClick={() => responderGap(p.key, null)} style={link}>Saltar</button>
            <button type="button" onClick={() => setVista('panorama')} style={link}>Terminar — el resto después</button>
          </div>
        )}
      </div>
    );
  }

  // ── PANORAMA: la preview, recién al final ────────────────────────────────────
  if (vista === 'panorama') {
    const gapsRestantes = est.gaps.length;
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <button type="button" onClick={() => { setErr(null); setWarnings([]); setVista('inicio'); }} style={link}>← Subir más documentos</button>
          {est.esSuperAdmin && !editando && hayPerfil && <button type="button" onClick={() => { setEditVals({ ...est.answers }); setEditando(true); }} style={link}>Editar</button>}
        </div>

        {cajaWarn}

        {/* El PANORAMA libre: todo lo que MaKo entendió */}
        {est.panorama.trim() && !editando && (
          <div style={{ ...card, borderColor: 'var(--accent)' }}>
            <div style={{ ...eyebrow, marginBottom: 12 }}>✦ Esto entendí de tu negocio</div>
            <PanoramaText text={est.panorama} />
          </div>
        )}

        {/* Completar lo que falta (preguntas cerradas) */}
        {gapsRestantes > 0 && !editando && (
          <div style={{ ...card, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '16px 18px' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Faltan {gapsRestantes} dato{gapsRestantes === 1 ? '' : 's'}</div>
              <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2, lineHeight: 1.45 }}>Lo que ningún documento resolvió. Te lo pregunto de a uno.</div>
            </div>
            <button type="button" onClick={seguirDesdeMasDocs} disabled={cargandoPreg} style={{ ...btnPrimary, flex: 'none', opacity: cargandoPreg ? 0.6 : 1 }}>{cargandoPreg ? 'Preparando…' : 'Completar'}</button>
          </div>
        )}

        {/* El perfil por campos (con procedencia) */}
        {hayPerfil && !editando && (
          <div style={card}>
            <div style={{ ...eyebrow, marginBottom: 6 }}>Tu perfil, por campo</div>
            {grupos.filter((g) => g.campos.some((c) => (est.answers[c.key] ?? '').trim())).map((g) => (
              <div key={g.label} style={{ marginTop: 16 }}>
                <div style={{ ...eyebrow, color: 'var(--accent)', marginBottom: 4 }}>{g.label}</div>
                {g.campos.filter((c) => (est.answers[c.key] ?? '').trim()).map((c) => (
                  <div key={c.key} style={{ padding: '9px 0', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, color: 'var(--faint)' }}>{c.label}</div>
                    <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.5, marginTop: 2 }}>{est.answers[c.key]}</div>
                    <div style={{ fontSize: 10, color: 'var(--faint)', fontFamily: MONO, marginTop: 3 }}>· {fuenteTxt(c.key)}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Edición (solo super-admin) */}
        {editando && (
          <div style={card}>
            <div style={{ ...eyebrow, marginBottom: 6 }}>Editar el perfil</div>
            {grupos.map((g) => (
              <div key={g.label} style={{ marginTop: 16 }}>
                <div style={{ ...eyebrow, color: 'var(--accent)', marginBottom: 8 }}>{g.label}</div>
                {g.campos.map((c) => (
                  <div key={c.key} style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 12, color: 'var(--faint)', display: 'block', marginBottom: 4 }}>{c.label}</label>
                    {c.type === 'textarea'
                      ? <textarea style={{ ...input, minHeight: 56, resize: 'vertical', lineHeight: 1.5, fontSize: 14 }} value={editVals[c.key] ?? ''} placeholder={c.placeholder} onChange={(e) => setEditVals((a) => ({ ...a, [c.key]: e.target.value }))} />
                      : <input style={{ ...input, fontSize: 14 }} value={editVals[c.key] ?? ''} placeholder={c.placeholder} onChange={(e) => setEditVals((a) => ({ ...a, [c.key]: e.target.value }))} />}
                  </div>
                ))}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16 }}>
              <button type="button" onClick={async () => {
                const changed: Record<string, string> = {};
                for (const c of est.brief) { const nv = (editVals[c.key] ?? '').trim(); if (nv !== (est.answers[c.key] ?? '').trim()) changed[c.key] = nv; }
                if (Object.keys(changed).length) await guardarManual(changed);
                setEditando(false);
              }} style={btnPrimary}>Guardar cambios</button>
              <button type="button" onClick={() => setEditando(false)} style={link}>Cancelar</button>
            </div>
          </div>
        )}

        {/* Tus archivos */}
        {hayArchivos && (
          <div>
            <div style={{ ...eyebrow, marginBottom: 10 }}>Tus archivos · {est.files.length}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {est.files.map((f) => (
                <div key={f.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nombre}</div>
                      {f.razonamiento && <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2, lineHeight: 1.45 }}>{f.razonamiento}</div>}
                      <div style={{ ...eyebrow, marginTop: 5, fontSize: 10 }}>{fmtSize(f.tamano)}{f.aporto > 0 ? ` · ${f.aporto} dato${f.aporto === 1 ? '' : 's'}` : ' · sin datos útiles'}</div>
                    </div>
                    <a href={`/api/onboarding/archivero/download?id=${f.id}`} style={{ ...link, whiteSpace: 'nowrap' }}>Descargar</a>
                    {confirmDel === f.id
                      ? <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', whiteSpace: 'nowrap' }}><button type="button" onClick={() => borrar(f.id)} style={{ ...link, color: 'var(--bad)', fontWeight: 600 }}>Borrar</button><button type="button" onClick={() => setConfirmDel(null)} style={link}>No</button></span>
                      : <button type="button" onClick={() => setConfirmDel(f.id)} style={{ ...link, color: 'var(--faint)' }}>Borrar</button>}
                  </div>
                  {confirmDel === f.id && <div style={{ fontSize: 11.5, color: 'var(--warn)', marginTop: 8 }}>Se va lo que este archivo aportó al perfil.</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── INICIO (dropzone grande + cola con preview + Analizar) ──────────────────
  const ext = (n: string) => (n.split('.').pop() || 'DOC').toUpperCase().slice(0, 4);
  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addCola(e.dataTransfer.files); }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: 340, border: `1.5px dashed ${drag ? 'var(--primary)' : 'var(--border-strong)'}`, background: drag ? 'var(--primary-bg)' : 'var(--surface-2)', borderRadius: 20, padding: '48px 28px', textAlign: 'center', transition: 'all .15s' }}>
        <input ref={inputRef} type="file" multiple accept={ACCEPT} style={{ display: 'none' }} onChange={(e) => { addCola(e.target.files); e.target.value = ''; }} />
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5-5 5 5" /><path d="M12 5v12" /></svg>
        <div style={{ fontSize: 23, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', marginTop: 18 }}>Soltá acá todo lo de tu negocio</div>
        <div style={{ fontSize: 14, color: 'var(--dim)', marginTop: 10, lineHeight: 1.6, maxWidth: 420 }}>Avatar, oferta, nicho, producto, guiones de venta, tu web…<br />PDF, Word, texto o imágenes. Todos los que quieras — MaKo los ordena.</div>
        <div style={{ marginTop: 26 }}><span style={{ ...btnPrimary, display: 'inline-block', padding: '13px 26px', fontSize: 15.5 }}>Elegir archivos</span></div>
      </label>

      {cola.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {cola.map((c) => {
              const k = c.file.name + c.file.size;
              return (
                <div key={k} style={{ width: 96 }}>
                  <div style={{ position: 'relative', width: 96, height: 96, borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {c.url ? <img src={c.url} alt={c.file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: 'var(--dim)' }}>{ext(c.file.name)}</span>}
                    <button type="button" aria-label="Quitar" onClick={() => quitarCola(k)} style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 999, border: 'none', background: 'rgba(18,21,27,.7)', color: '#fff', fontSize: 11, lineHeight: '20px', cursor: 'pointer', padding: 0 }}>✕</button>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.file.name}</div>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={analizar} style={{ ...btnPrimary, width: '100%', marginTop: 18, padding: '14px', fontSize: 15.5 }}>✦ Analizar {cola.length} documento{cola.length === 1 ? '' : 's'}</button>
        </div>
      )}

      {(hayPerfil || hayArchivos) && cola.length === 0 && (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button type="button" onClick={() => setVista('panorama')} style={link}>Ver lo que MaKo ya sabe de tu negocio →</button>
        </div>
      )}
      {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 14, textAlign: 'center' }}>{err}</div>}
      {cajaWarn && <div style={{ marginTop: 12 }}>{cajaWarn}</div>}
    </div>
  );
}
