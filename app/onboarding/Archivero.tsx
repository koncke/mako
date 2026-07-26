'use client';

// =============================================================================
// El Archivero — el repositorio de documentos del negocio (v2)
// =============================================================================
// UN botón: soltás TODOS tus archivos y MaKo los procesa y rellena el brief por
// dentro (no un formulario de preguntas). Los archivos SE CONSERVAN: se listan, se
// descargan, se borran (y al borrar se va lo que ese archivo aportó) y se agregan
// más. Lo que ningún doc resolvió se pregunta de a 1, salteable. El resumen es
// read-only y referencia de qué archivo salió cada dato; editar = solo super-admin.
// Self-contained: se trae su estado del backend. Se usa en Configuraciones y en el
// wizard. onEstado avisa el brief efectivo (para el panel del wizard).
// =============================================================================

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const ACCEPT = '.txt,.md,.markdown,.docx,.pdf,image/*';

type Fuente = { tipo: 'archivo' | 'manual'; id?: string; nombre?: string };
type FileRow = { id: string; nombre: string; mime: string | null; tamano: number | null; razonamiento: string | null; aporto: number; created_at: string };
type Campo = { key: string; label: string; type: string; placeholder?: string; grupo: string };
type Estado = { files: FileRow[]; brief: Campo[]; answers: Record<string, string>; fuente: Record<string, Fuente>; gaps: string[]; esSuperAdmin: boolean };

const fmtSize = (n?: number | null) => (!n ? '' : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

const btn: CSSProperties = { padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { background: 'none', border: 'none', color: 'var(--dim)', fontFamily: SANS, fontSize: 12.5, textDecoration: 'underline', cursor: 'pointer', padding: 0 };
const input: CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' };
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };

export function Archivero({ onEstado }: { onEstado?: (answers: Record<string, string>) => void }) {
  const [est, setEst] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [cola, setCola] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [editVals, setEditVals] = useState<Record<string, string>>({});
  const [gapSkip, setGapSkip] = useState<Set<string>>(new Set());
  const [gapVal, setGapVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const aplicar = useCallback((e: Estado) => { setEst(e); onEstado?.(e.answers); }, [onEstado]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try { const j = await (await fetch('/api/onboarding/archivero')).json(); if (j.ok) aplicar(j as Estado); else setErr(j.error || 'No se pudo cargar.'); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setCargando(false); }
  }, [aplicar]);
  useEffect(() => { cargar(); }, [cargar]);

  const addFiles = (fl: FileList | null) => {
    if (!fl || !fl.length) return;
    setCola((prev) => { const m = new Map(prev.map((f) => [f.name + f.size, f])); for (const f of Array.from(fl)) m.set(f.name + f.size, f); return Array.from(m.values()); });
  };

  const subir = async () => {
    if (!cola.length) return;
    setSubiendo(true); setErr(null); setWarnings([]);
    try {
      const fd = new FormData(); cola.forEach((f) => fd.append('file', f));
      const j = await (await fetch('/api/onboarding/archivero', { method: 'POST', body: fd })).json();
      setWarnings(Array.isArray(j.warnings) ? j.warnings : []);
      if (j.brief) aplicar(j as Estado);
      if (!j.ok && !j.brief) { setErr(j.error || 'No se pudo procesar.'); return; }
      setCola([]);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setSubiendo(false); }
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

  if (cargando) return <div style={{ ...eyebrow, padding: '18px 0' }}>Cargando el archivero…</div>;
  if (!est) return <div style={{ color: 'var(--bad)', fontSize: 13, fontWeight: 600 }}>{err}</div>;

  const hayArchivos = est.files.length > 0;
  const hayPerfil = Object.keys(est.answers).length > 0;
  const gapKeys = est.gaps.filter((k) => !gapSkip.has(k));
  const gapActual = !editando ? est.brief.find((c) => c.key === gapKeys[0]) : undefined;

  // Resumen agrupado (solo lo que se sabe).
  const grupos: { label: string; campos: Campo[] }[] = [];
  for (const c of est.brief) { let g = grupos.find((x) => x.label === c.grupo); if (!g) { g = { label: c.grupo, campos: [] }; grupos.push(g); } g.campos.push(c); }

  const fuenteTxt = (k: string) => { const f = est.fuente[k]; if (!f) return ''; return f.tipo === 'manual' ? 'a mano' : (f.nombre || 'un archivo'); };

  // ── Uploader (hero si está vacío, compacto si ya hay archivos) ──────────────
  const uploader = (
    <div>
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        style={{ display: 'block', cursor: 'pointer', border: `1.5px dashed ${drag ? 'var(--primary)' : 'var(--border-strong)'}`, background: drag ? 'var(--primary-bg)' : 'var(--surface-2)', borderRadius: 14, padding: hayArchivos ? '16px' : '30px 20px', textAlign: 'center', transition: 'all .15s' }}>
        <input ref={inputRef} type="file" multiple accept={ACCEPT} style={{ display: 'none' }} onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        <div style={{ fontSize: hayArchivos ? 14 : 16, fontWeight: 600, color: 'var(--ink)' }}>{hayArchivos ? 'Agregar más archivos' : 'Soltá acá todo lo de tu negocio'}</div>
        {!hayArchivos && <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 6, lineHeight: 1.55 }}>Avatar, oferta, nicho, producto, guiones de venta, tu web…<br />PDF, Word, texto o imágenes. Todos juntos — MaKo los ordena.</div>}
      </label>

      {cola.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {cola.map((f) => (
            <span key={f.name + f.size} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: '4px 6px 4px 11px', fontSize: 12, color: 'var(--ink)' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{f.name}</span>
              <button type="button" aria-label="Quitar" onClick={() => setCola((p) => p.filter((x) => x.name + x.size !== f.name + f.size))} style={{ border: 'none', background: 'var(--border)', color: 'var(--dim)', borderRadius: 999, width: 16, height: 16, lineHeight: '15px', fontSize: 10, cursor: 'pointer', padding: 0 }}>✕</button>
            </span>
          ))}
        </div>
      )}
      {cola.length > 0 && (
        <button type="button" onClick={subir} disabled={subiendo} style={{ ...btn, width: '100%', marginTop: 12, opacity: subiendo ? 0.6 : 1 }}>
          {subiendo ? 'MaKo está leyendo…' : `✦ Ordenar ${cola.length} archivo${cola.length === 1 ? '' : 's'}`}
        </button>
      )}
      {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 10 }}>{err}</div>}
      {warnings.length > 0 && (
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', marginTop: 10 }}>
          {warnings.map((w, i) => <div key={i} style={{ fontSize: 12, color: 'var(--warn)', lineHeight: 1.5 }}>· {w}</div>)}
        </div>
      )}
    </div>
  );

  // Estado vacío total: solo el hero.
  if (!hayArchivos && !hayPerfil && cola.length === 0) return <div style={{ textAlign: 'left' }}>{uploader}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, textAlign: 'left' }}>
      {uploader}

      {/* ── Archivos guardados ── */}
      {hayArchivos && (
        <div>
          <div style={{ ...eyebrow, marginBottom: 10 }}>Tus archivos · {est.files.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {est.files.map((f) => (
              <div key={f.id} style={{ border: '1px solid var(--border)', borderRadius: 11, padding: '11px 13px', background: 'var(--surface)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nombre}</div>
                    {f.razonamiento && <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2, lineHeight: 1.45 }}>{f.razonamiento}</div>}
                    <div style={{ ...eyebrow, marginTop: 4, fontSize: 10 }}>{fmtSize(f.tamano)}{f.aporto > 0 ? ` · aportó ${f.aporto} dato${f.aporto === 1 ? '' : 's'}` : ' · sin datos útiles'}</div>
                  </div>
                  <a href={`/api/onboarding/archivero/download?id=${f.id}`} style={{ ...btnGhost, whiteSpace: 'nowrap' }}>Descargar</a>
                  {confirmDel === f.id ? (
                    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', whiteSpace: 'nowrap' }}>
                      <button type="button" onClick={() => borrar(f.id)} style={{ ...btnGhost, color: 'var(--bad)', fontWeight: 600 }}>Borrar</button>
                      <button type="button" onClick={() => setConfirmDel(null)} style={btnGhost}>No</button>
                    </span>
                  ) : (
                    <button type="button" aria-label="Borrar archivo" onClick={() => setConfirmDel(f.id)} style={{ ...btnGhost, color: 'var(--faint)' }}>Borrar</button>
                  )}
                </div>
                {confirmDel === f.id && <div style={{ fontSize: 11.5, color: 'var(--warn)', marginTop: 8 }}>Al borrarlo se va lo que este archivo aportó al perfil.</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Hueco: de a 1 pregunta, salteable ── */}
      {gapActual && (
        <div style={{ border: '1px solid var(--border-strong)', borderRadius: 12, padding: 16, background: 'var(--surface-2)' }}>
          <div style={{ ...eyebrow, marginBottom: 8 }}>MaKo todavía no sabe · faltan {gapKeys.length}</div>
          <label style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>{gapActual.label}</label>
          {gapActual.type === 'textarea'
            ? <textarea style={{ ...input, minHeight: 64, resize: 'vertical', lineHeight: 1.5 }} value={gapVal} placeholder={gapActual.placeholder} autoFocus onChange={(e) => setGapVal(e.target.value)} />
            : <input style={input} value={gapVal} placeholder={gapActual.placeholder} autoFocus onChange={(e) => setGapVal(e.target.value)} />}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
            <button type="button" onClick={async () => { const v = gapVal.trim(); if (!v) return; await guardarManual({ [gapActual.key]: v }); setGapVal(''); }} disabled={!gapVal.trim()} style={{ ...btn, opacity: gapVal.trim() ? 1 : 0.4 }}>Guardar y seguir</button>
            <button type="button" onClick={() => { setGapVal(''); setGapSkip((s) => new Set(s).add(gapActual.key)); }} style={btnGhost}>Saltar</button>
          </div>
        </div>
      )}

      {/* ── Esto entendí (read-only; editar = super-admin) ── */}
      {hayPerfil && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10 }}>
            <div style={eyebrow}>Esto entendí de tu negocio</div>
            {est.esSuperAdmin && !editando && <button type="button" onClick={() => { setEditVals({ ...est.answers }); setEditando(true); }} style={btnGhost}>Editar</button>}
          </div>

          {!editando ? (
            grupos.filter((g) => g.campos.some((c) => (est.answers[c.key] ?? '').trim())).map((g) => (
              <div key={g.label} style={{ marginBottom: 16 }}>
                <div style={{ ...eyebrow, color: 'var(--accent)', marginBottom: 7 }}>{g.label}</div>
                {g.campos.filter((c) => (est.answers[c.key] ?? '').trim()).map((c) => (
                  <div key={c.key} style={{ marginBottom: 9 }}>
                    <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{c.label}</div>
                    <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }}>{est.answers[c.key]}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--faint)', fontFamily: MONO, marginTop: 1 }}>· {fuenteTxt(c.key)}</div>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <div>
              {grupos.map((g) => (
                <div key={g.label} style={{ marginBottom: 14 }}>
                  <div style={{ ...eyebrow, color: 'var(--accent)', marginBottom: 7 }}>{g.label}</div>
                  {g.campos.map((c) => (
                    <div key={c.key} style={{ marginBottom: 9 }}>
                      <label style={{ fontSize: 11.5, color: 'var(--faint)', display: 'block', marginBottom: 3 }}>{c.label}</label>
                      {c.type === 'textarea'
                        ? <textarea style={{ ...input, minHeight: 52, resize: 'vertical', lineHeight: 1.5 }} value={editVals[c.key] ?? ''} placeholder={c.placeholder} onChange={(e) => setEditVals((a) => ({ ...a, [c.key]: e.target.value }))} />
                        : <input style={input} value={editVals[c.key] ?? ''} placeholder={c.placeholder} onChange={(e) => setEditVals((a) => ({ ...a, [c.key]: e.target.value }))} />}
                    </div>
                  ))}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 4 }}>
                <button type="button" onClick={async () => {
                  const changed: Record<string, string> = {};
                  for (const c of est.brief) { const nv = (editVals[c.key] ?? '').trim(); if (nv !== (est.answers[c.key] ?? '').trim()) changed[c.key] = nv; }
                  if (Object.keys(changed).length) await guardarManual(changed);
                  setEditando(false);
                }} style={btn}>Guardar cambios</button>
                <button type="button" onClick={() => setEditando(false)} style={btnGhost}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
