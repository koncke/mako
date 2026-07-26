'use client';

// =============================================================================
// El Archivero — el repositorio de documentos del negocio (v2, por fases)
// =============================================================================
// Como los forms de MaKo: UNA cosa por pantalla.
//   · inicio  → un solo dropzone/botón: soltás TODO y se procesa (nada más).
//   · leyendo → MaKo lee.
//   · resumen → "Esto entendí" en tarjeta limpia (con procedencia) + tus archivos
//               (descargar/borrar cascada/agregar). Read-only salvo super-admin.
//   · huecos  → lo que ningún doc resolvió, DE A 1 por pantalla, salteable.
// Self-contained (se trae su estado). onEstado avisa el brief efectivo (wizard).
// =============================================================================

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const ACCEPT = '.txt,.md,.markdown,.docx,.pdf,image/*';

type Fuente = { tipo: 'archivo' | 'manual'; id?: string; nombre?: string };
type FileRow = { id: string; nombre: string; mime: string | null; tamano: number | null; razonamiento: string | null; aporto: number; created_at: string };
type Campo = { key: string; label: string; type: string; placeholder?: string; grupo: string };
type Estado = { files: FileRow[]; brief: Campo[]; answers: Record<string, string>; fuente: Record<string, Fuente>; gaps: string[]; esSuperAdmin: boolean };
type Vista = 'inicio' | 'leyendo' | 'resumen' | 'huecos';

const fmtSize = (n?: number | null) => (!n ? '' : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 22 };
const input: CSSProperties = { width: '100%', padding: '12px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 15, outline: 'none' };
const btnPrimary: CSSProperties = { padding: '11px 22px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '11px 18px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 14, fontWeight: 500, cursor: 'pointer' };
const link: CSSProperties = { background: 'none', border: 'none', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, textDecoration: 'underline', cursor: 'pointer', padding: 0 };
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };

export function Archivero({ onEstado }: { onEstado?: (answers: Record<string, string>) => void }) {
  const [est, setEst] = useState<Estado | null>(null);
  const [vista, setVista] = useState<Vista>('inicio');
  const [cargando, setCargando] = useState(true);
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
    try { const j = await (await fetch('/api/onboarding/archivero')).json(); if (j.ok) aplicar(j as Estado); else setErr(j.error || 'No se pudo cargar.'); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setCargando(false); }
  }, [aplicar]);
  useEffect(() => { cargar(); }, [cargar]);

  // Un solo gesto: elegir/soltar archivos LOS SUBE (sin botón aparte, sin cola).
  const subir = async (archivos: File[]) => {
    if (!archivos.length) return;
    setVista('leyendo'); setErr(null); setWarnings([]);
    try {
      const fd = new FormData(); archivos.forEach((f) => fd.append('file', f));
      const j = await (await fetch('/api/onboarding/archivero', { method: 'POST', body: fd })).json();
      setWarnings(Array.isArray(j.warnings) ? j.warnings : []);
      if (j.brief) { aplicar(j as Estado); setVista('resumen'); }
      else { setErr(j.error || 'No se pudo procesar.'); setVista('inicio'); }
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setVista('inicio'); }
  };
  const onFiles = (fl: FileList | null) => { const a = fl ? Array.from(fl) : []; if (a.length) subir(a); };

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

  if (cargando || !est) return <div style={{ ...eyebrow, padding: '18px 0', textAlign: 'center' }}>{err ? <span style={{ color: 'var(--bad)' }}>{err}</span> : 'Cargando el archivero…'}</div>;

  const hayArchivos = est.files.length > 0;
  const hayPerfil = Object.keys(est.answers).length > 0;
  const gapKeys = est.gaps.filter((k) => !gapSkip.has(k));
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
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: '52px 0' }}>
        <div style={{ ...eyebrow, color: 'var(--dim)' }}>MaKo está leyendo tus documentos</div>
        <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 10, lineHeight: 1.6 }}>Ordenando tu avatar, tu oferta y tu nicho.<br />Tarda unos segundos.</div>
      </div>
    );
  }

  // ── HUECOS (de a 1 por pantalla) ────────────────────────────────────────────
  if (vista === 'huecos') {
    const gapActual = est.brief.find((c) => c.key === gapKeys[0]);
    if (!gapActual) { setVista('resumen'); return null; }
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '18px 0' }}>
        <div style={{ ...eyebrow, marginBottom: 18 }}>Faltan {gapKeys.length} · {gapActual.grupo}</div>
        <h2 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 22px', lineHeight: 1.2 }}>{gapActual.label}</h2>
        <div style={{ maxWidth: 460, margin: '0 auto', textAlign: 'left' }}>
          {gapActual.type === 'textarea'
            ? <textarea style={{ ...input, minHeight: 96, resize: 'vertical', lineHeight: 1.5 }} value={gapVal} placeholder={gapActual.placeholder} autoFocus onChange={(e) => setGapVal(e.target.value)} />
            : <input style={input} value={gapVal} placeholder={gapActual.placeholder} autoFocus onChange={(e) => setGapVal(e.target.value)} />}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 22 }}>
          <button type="button" onClick={() => { setGapVal(''); setGapSkip((s) => new Set(s).add(gapActual.key)); }} style={btnGhost}>Saltar</button>
          <button type="button" onClick={async () => { const v = gapVal.trim(); if (!v) return; await guardarManual({ [gapActual.key]: v }); setGapVal(''); }} disabled={!gapVal.trim()} style={{ ...btnPrimary, opacity: gapVal.trim() ? 1 : 0.4 }}>Guardar y seguir</button>
        </div>
        <div style={{ marginTop: 20 }}><button type="button" onClick={() => { setGapVal(''); setVista('resumen'); }} style={link}>Terminar — completo el resto después</button></div>
      </div>
    );
  }

  // ── RESUMEN (esto entendí + archivos) ───────────────────────────────────────
  if (vista === 'resumen') {
    return (
      <div style={{ maxWidth: 620, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <button type="button" onClick={() => { setErr(null); setWarnings([]); setVista('inicio'); }} style={link}>← Subir más documentos</button>
          {est.esSuperAdmin && !editando && hayPerfil && <button type="button" onClick={() => { setEditVals({ ...est.answers }); setEditando(true); }} style={link}>Editar</button>}
        </div>

        {cajaWarn}

        {gapKeys.length > 0 && !editando && (
          <div style={{ ...card, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '16px 18px' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Faltan {gapKeys.length} datos</div>
              <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2, lineHeight: 1.45 }}>Lo que ningún documento resolvió. Te los pregunto de a uno.</div>
            </div>
            <button type="button" onClick={() => setVista('huecos')} style={{ ...btnPrimary, flex: 'none' }}>Completar</button>
          </div>
        )}

        {/* Esto entendí — tarjeta limpia, agrupada, con procedencia */}
        {hayPerfil && !editando && (
          <div style={card}>
            <div style={{ ...eyebrow, marginBottom: 6 }}>Esto entendí de tu negocio</div>
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

  // ── INICIO (un solo botón) ──────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files); }}
        style={{ display: 'block', cursor: 'pointer', border: `1.5px dashed ${drag ? 'var(--primary)' : 'var(--border-strong)'}`, background: drag ? 'var(--primary-bg)' : 'var(--surface-2)', borderRadius: 16, padding: '40px 24px', textAlign: 'center', transition: 'all .15s' }}>
        <input ref={inputRef} type="file" multiple accept={ACCEPT} style={{ display: 'none' }} onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)' }}>Soltá acá todo lo de tu negocio</div>
        <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 8, lineHeight: 1.6 }}>Avatar, oferta, nicho, producto, guiones de venta, tu web…<br />PDF, Word, texto o imágenes. Todos juntos — MaKo los ordena.</div>
        <div style={{ marginTop: 20 }}><span style={{ ...btnPrimary, display: 'inline-block' }}>Elegir archivos</span></div>
      </label>

      {(hayPerfil || hayArchivos) && (
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <button type="button" onClick={() => setVista('resumen')} style={link}>Ver lo que MaKo ya sabe de tu negocio →</button>
        </div>
      )}
      {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 14, textAlign: 'center' }}>{err}</div>}
      {cajaWarn && <div style={{ marginTop: 12 }}>{cajaWarn}</div>}
    </div>
  );
}
