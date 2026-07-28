'use client';

// =============================================================================
// El Archivero — repositorio de documentos del negocio (v7: solo Archivos)
// =============================================================================
// Flujo: inicio (soltás docs, con preview) → leyendo → masdocs [slide 1: qué
// entendí, con desvanecido arriba→abajo (una vez) | slide 2: te pido el doc que
// FALTA] → huecos (cerradas 1x1) → archivos (la lista, con "subir más"). El Resumen,
// la Oferta y los Avatares ya NO viven acá: son tabs propias del hub (P4). Al entrar,
// si ya hay documentos abre DIRECTO en la lista, no en el dropzone (P1). Los docs son
// la base; una edición manual explícita gana. El insight va en la parte BLANCA.
// =============================================================================

import { useCallback, useEffect, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode } from 'react';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const ACCEPT = '.txt,.md,.markdown,.docx,.pdf,image/*';

type Fuente = { tipo: 'archivo' | 'manual'; id?: string; nombre?: string };
type FileRow = { id: string; nombre: string; mime: string | null; tamano: number | null; razonamiento: string | null; aporto: number; created_at: string };
type Campo = { key: string; label: string; type: string; placeholder?: string; grupo: string };
type Estado = { files: FileRow[]; brief: Campo[]; answers: Record<string, string>; fuente: Record<string, Fuente>; gaps: string[]; panorama: string; esSuperAdmin: boolean };
type PregCerrada = { key: string; pregunta: string; opciones: string[] };
type Vista = 'inicio' | 'leyendo' | 'masdocs' | 'huecos' | 'archivos';
type Grupo = { label: string; campos: Campo[] };

const fmtSize = (n?: number | null) => (!n ? '' : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const esImg = (m?: string | null) => !!m && m.startsWith('image/');
const esPdf = (m?: string | null, n?: string) => (!!m && m === 'application/pdf') || (!!n && n.toLowerCase().endsWith('.pdf'));
const conDato = (g: Grupo, ans: Record<string, string>) => g.campos.some((c) => (ans[c.key] ?? '').trim());
const grupoWord = (label: string) => /oferta/i.test(label) ? 'tu oferta' : /avatar/i.test(label) ? 'tu avatar' : /negocio|nicho/i.test(label) ? 'tu negocio' : label.toLowerCase();
// De un campo faltante a un "tema de documento" que se lee natural.
const TERMINO_CAMPO: Record<string, string> = {
  negocio_que_hace: 'a qué te dedicas',
  oferta_nombre: 'tu oferta',
  oferta_ticket: 'tus precios',
  oferta_promesa: 'tu promesa',
  oferta_incluye: 'qué incluye tu oferta',
  oferta_garantia: 'tu garantía',
  avatar_quien: 'quién es tu cliente',
  avatar_dolor: 'el dolor de tu cliente',
  avatar_deseo: 'qué quiere lograr tu cliente',
  avatar_objecion: 'sus objeciones',
  avatar_nicho: 'tu nicho',
};
const listar = (arr: string[]) => arr.length <= 1 ? (arr[0] ?? '') : `${arr.slice(0, -1).join(', ')} o ${arr[arr.length - 1]}`;
const listarY = (arr: string[]) => arr.length <= 1 ? (arr[0] ?? '') : `${arr.slice(0, -1).join(', ')} y ${arr[arr.length - 1]}`;

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 22 };
const input: CSSProperties = { width: '100%', padding: '12px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 15, outline: 'none' };
const btnPrimary: CSSProperties = { padding: '12px 22px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 };
const btnGhost: CSSProperties = { padding: '12px 18px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 14, fontWeight: 500, cursor: 'pointer' };
const link: CSSProperties = { background: 'none', border: 'none', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, textDecoration: 'underline', cursor: 'pointer', padding: 0 };
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };
const iconBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', padding: 0 };

// Íconos.
const Ico = ({ d, size = 15 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{d.split('|').map((p, i) => <path key={i} d={p} />)}</svg>
);
const I_OJO = 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z|M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z';
const I_BAJAR = 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|M7 10l5 5 5-5|M12 15V3';
const I_BORRAR = 'M3 6h18|M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6';
const I_SUBIR = 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|M7 9l5-5 5 5|M12 4v12';

// Desvanecido de arriba hacia abajo, UNA sola vez por `id` (no se repite al volver).
// `index` ESCALONA: cada bloque espera a que termine el de arriba (delay = index·dur).
function Fade({ id, seen, index = 0, children }: { id: string; seen: MutableRefObject<Set<string>>; index?: number; children: ReactNode }) {
  const animar = !seen.current.has(id);
  useEffect(() => { seen.current.add(id); }, [id, seen]);
  const dur = 1.3; // más lento (pedido de Martín)
  return <div style={animar ? { animation: `arch-reveal ${dur}s ease-out both`, animationDelay: `${(index * (dur - 0.25)).toFixed(2)}s` } : undefined}>{children}</div>;
}

// Miniatura del documento (PDF → visor inline; imagen → la imagen; otro → ícono).
function DocThumb({ mime, nombre, src, w = 78, h = 100 }: { mime?: string | null; nombre?: string; src: string; w?: number; h?: number }) {
  const box: CSSProperties = { width: w, height: h, borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--surface-2)', flex: 'none', position: 'relative' };
  if (esImg(mime)) return <div style={box}><img src={src} alt={nombre || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>;
  if (esPdf(mime, nombre)) return <div style={box}><iframe src={src} title={nombre || 'pdf'} style={{ width: '135%', height: '135%', border: 'none', transform: 'scale(.74)', transformOrigin: 'top left', pointerEvents: 'none' }} scrolling="no" /></div>;
  return <div style={{ ...box, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: 'var(--dim)' }}>{(nombre?.split('.').pop() || 'DOC').toUpperCase().slice(0, 4)}</span></div>;
}

// 3 acciones (abrir · descargar · borrar) — se usan bajo la miniatura.
function DocAcciones({ id, confirm, onConfirm, onBorrar }: { id: string; confirm: boolean; onConfirm: () => void; onBorrar: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
      <a href={`/api/onboarding/archivero/download?id=${id}&preview=1`} target="_blank" rel="noopener noreferrer" title="Abrir" style={{ ...iconBtn, textDecoration: 'none' }}><Ico d={I_OJO} /></a>
      <a href={`/api/onboarding/archivero/download?id=${id}`} title="Descargar" style={{ ...iconBtn, textDecoration: 'none' }}><Ico d={I_BAJAR} /></a>
      <button type="button" title="Borrar" onClick={() => (confirm ? onBorrar() : onConfirm())} style={{ ...iconBtn, color: confirm ? 'var(--bad)' : 'var(--dim)', borderColor: confirm ? 'var(--bad)' : 'var(--border-strong)' }}><Ico d={I_BORRAR} /></button>
      {confirm && <span style={{ fontSize: 11, color: 'var(--bad)', fontWeight: 600 }}>¿Seguro?</span>}
    </div>
  );
}

export function Archivero({ onEstado }: {
  onEstado?: (answers: Record<string, string>) => void;
  onFacts?: (facts: { k: string; v: string }[]) => void; // ya NO se usa (el insight va en blanco)
}) {
  const [est, setEst] = useState<Estado | null>(null);
  const [vista, setVista] = useState<Vista>('inicio');
  const [masSlide, setMasSlide] = useState<'insight' | 'pedir'>('insight');
  const [cargando, setCargando] = useState(true);
  const [drag, setDrag] = useState(false);
  const [cola, setCola] = useState<{ file: File; url: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [preguntas, setPreguntas] = useState<PregCerrada[]>([]);
  const [gapIdx, setGapIdx] = useState(0);
  const [cargandoPreg, setCargandoPreg] = useState(false);
  const [otroKey, setOtroKey] = useState<string | null>(null);
  const [otroVal, setOtroVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const vistos = useRef<Set<string>>(new Set()); // qué animaciones de fade ya corrieron
  const primera = useRef(true); // primera carga: si ya hay docs, abrimos en la lista (P1)

  const aplicar = useCallback((e: Estado) => { setEst(e); onEstado?.(e.answers); }, [onEstado]);

  const cargar = useCallback(async () => {
    try {
      const j = await (await fetch('/api/onboarding/archivero')).json();
      if (j.ok || j.brief) {
        aplicar(j as Estado);
        // Al entrar, si ya hay documentos, abrimos DIRECTO en la lista (no en el dropzone).
        if (primera.current && Array.isArray(j.files) && j.files.length > 0) setVista('archivos');
      } else setErr(j.error || 'No se pudo cargar.');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { primera.current = false; setCargando(false); }
  }, [aplicar]);
  useEffect(() => { cargar(); }, [cargar]);

  const addCola = (fl: FileList | null) => {
    const arr = fl ? Array.from(fl) : [];
    if (!arr.length) return;
    setCola((prev) => {
      const map = new Map(prev.map((c) => [c.file.name + c.file.size, c]));
      for (const f of arr) { const k = f.name + f.size; if (!map.has(k)) map.set(k, { file: f, url: URL.createObjectURL(f) }); }
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
      if (j.brief) { aplicar(j as Estado); cola.forEach((c) => URL.revokeObjectURL(c.url)); setCola([]); setMasSlide('insight'); setVista('masdocs'); }
      else { setErr(j.error || 'No se pudo procesar.'); setVista('inicio'); }
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setVista('inicio'); }
  };

  const seguirDesdeMasDocs = async () => {
    if (!est || est.gaps.length === 0) { setVista('archivos'); return; }
    setCargandoPreg(true); setErr(null);
    try {
      const j = await (await fetch('/api/onboarding/archivero/preguntas', { method: 'POST' })).json();
      const pregs: PregCerrada[] = Array.isArray(j.preguntas) ? j.preguntas : [];
      setPreguntas(pregs); setGapIdx(0); setOtroKey(null); setOtroVal('');
      setVista(pregs.length ? 'huecos' : 'archivos');
    } catch { setVista('archivos'); }
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

  const responderGap = async (key: string, valor: string | null) => {
    if (valor && valor.trim()) await guardarManual({ [key]: valor.trim() });
    setOtroKey(null); setOtroVal('');
    if (gapIdx + 1 >= preguntas.length) setVista('archivos'); else setGapIdx((i) => i + 1);
  };

  if (cargando || !est) return <div style={{ ...eyebrow, padding: '18px 0', textAlign: 'center' }}>{err ? <span style={{ color: 'var(--bad)' }}>{err}</span> : 'Cargando el archivero…'}</div>;

  const hayArchivos = est.files.length > 0;
  const hayPerfil = Object.keys(est.answers).length > 0;
  const grupos: Grupo[] = [];
  for (const c of est.brief) { let g = grupos.find((x) => x.label === c.grupo); if (!g) { g = { label: c.grupo, campos: [] }; grupos.push(g); } g.campos.push(c); }
  const previewUrl = (id: string) => `/api/onboarding/archivero/download?id=${id}&preview=1`;

  const keyframes = <style>{'@keyframes arch-spin{to{transform:rotate(360deg)}}@keyframes arch-reveal{from{clip-path:inset(0 0 100% 0);opacity:.35}to{clip-path:inset(0 0 0 0);opacity:1}}.arch-edit:hover{background:var(--surface-2)}.arch-edit:focus{background:var(--surface-2);box-shadow:inset 0 0 0 1px var(--border-strong)}'}</style>;
  const cajaWarn = warnings.length > 0 && (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '10px 13px' }}>
      {warnings.map((w, i) => <div key={i} style={{ fontSize: 12, color: 'var(--warn)', lineHeight: 1.5 }}>· {w}</div>)}
    </div>
  );

  // Lista de archivos reutilizable (miniatura + acciones + razonamiento).
  const listaArchivos = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {est.files.map((f) => (
        <div key={f.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, background: 'var(--surface)', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 9, alignItems: 'center' }}>
            <DocThumb mime={f.mime} nombre={f.nombre} src={previewUrl(f.id)} />
            <DocAcciones id={f.id} confirm={confirmDel === f.id} onConfirm={() => setConfirmDel(f.id)} onBorrar={() => borrar(f.id)} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nombre}</div>
            {f.razonamiento && <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 5, lineHeight: 1.55 }}>{f.razonamiento}</div>}
            <div style={{ ...eyebrow, marginTop: 8, fontSize: 10 }}>{fmtSize(f.tamano)}{f.aporto > 0 ? ` · ${f.aporto} dato${f.aporto === 1 ? '' : 's'}` : ' · sin datos'}</div>
          </div>
        </div>
      ))}
    </div>
  );

  // ── LEYENDO ────────────────────────────────────────────────────────────────
  if (vista === 'leyendo') {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: '96px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {keyframes}
        <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'arch-spin .8s linear infinite' }} />
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)', marginTop: 24 }}>MaKo está leyendo tus documentos</div>
        <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 8, lineHeight: 1.6 }}>Ordenando tu avatar, tu oferta y tu nicho,<br />y armando el panorama de tu negocio.</div>
      </div>
    );
  }

  // ── MASDOCS ─────────────────────────────────────────────────────────────────
  if (vista === 'masdocs') {
    const insights = est.files.filter((f) => (f.razonamiento || '').trim());
    const recibidos = grupos.filter((g) => g.campos.length > 0 && conDato(g, est.answers));

    // Slide 1: qué entendí — una CAJA por documento + una caja con los datos.
    if (masSlide === 'insight') {
      return (
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 0' }}>
          {keyframes}
          <div style={{ ...eyebrow, color: 'var(--accent)', marginBottom: 14, fontSize: 11 }}>✦ Esto entendí de tus documentos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {insights.map((f, i) => {
              const partes = (f.razonamiento || '').split(/\.\s+/);
              const titulo = partes[0]?.replace(/\.$/, '') || 'Documento';
              const cuerpo = partes.length > 1 ? partes.slice(1).join('. ') : '';
              return (
                <Fade key={f.id} id={`ins:${f.id}`} index={i} seen={vistos}>
                  <div style={{ ...card, padding: 16, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{titulo}</div>
                      {cuerpo && <div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.6, marginTop: 6 }}>{cuerpo}</div>}
                      <div style={{ ...eyebrow, fontSize: 10, marginTop: 10 }}>{f.nombre}{f.aporto > 0 ? ` · ${f.aporto} dato${f.aporto === 1 ? '' : 's'}` : ''}</div>
                    </div>
                    <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                      <DocThumb mime={f.mime} nombre={f.nombre} src={previewUrl(f.id)} w={78} h={100} />
                      <DocAcciones id={f.id} confirm={confirmDel === f.id} onConfirm={() => setConfirmDel(f.id)} onBorrar={() => borrar(f.id)} />
                    </div>
                  </div>
                </Fade>
              );
            })}
            {insights.length === 0 && <div style={{ ...card, fontSize: 14, color: 'var(--dim)' }}>Leí tus documentos.</div>}

            {hayPerfil && (
              <Fade id="campos-insight" index={insights.length} seen={vistos}>
                <div style={{ ...card, padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 999, background: 'var(--good-bg)', color: 'var(--good)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flex: 'none' }}>✓</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>Listo, ya conozco tu negocio</div>
                    <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 3, lineHeight: 1.5 }}>Extraje {Object.keys(est.answers).length} datos clave{recibidos.length ? <> de {listarY(recibidos.map((g) => grupoWord(g.label)))}</> : ''}. Los revisas en las tabs de tu perfil.</div>
                  </div>
                </div>
              </Fade>
            )}
          </div>
          {cajaWarn && <div style={{ marginTop: 14 }}>{cajaWarn}</div>}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}>
            <button type="button" onClick={() => setMasSlide('pedir')} style={btnPrimary}>Siguiente →</button>
          </div>
        </div>
      );
    }

    // Slide 2: pedir otro documento — título fijo + nombres de docs + qué falta.
    const gapTerms = [...new Set(est.gaps.map((k) => TERMINO_CAMPO[k]).filter(Boolean))];
    const secundario = est.gaps.length > 0 ? 'Completar a mano →' : 'Ver mis documentos →';
    const nombresDocs = est.files.map((f) => f.nombre);
    const cubren = recibidos.map((g) => grupoWord(g.label));
    return (
      <div style={{ minHeight: '100%', maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', padding: '34px 0 10px' }}>
        {keyframes}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>📂</div>
          <h2 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 14px', lineHeight: 1.3 }}>¿Tienes algún otro documento?</h2>

          {nombresDocs.length > 0 && (
            <div style={{ fontSize: 15, color: 'var(--dim)', lineHeight: 1.6, margin: '0 auto 4px', maxWidth: 460 }}>
              {nombresDocs.length === 1
                ? <>Ya recibí tu documento <b style={{ color: 'var(--ink)' }}>{nombresDocs[0]}</b>{cubren.length ? <>, que corresponde a {listarY(cubren)}</> : ''}.</>
                : <>Ya recibí estos documentos{cubren.length ? <>, que corresponden a {listarY(cubren)}</> : ''}:
                    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, marginTop: 8, textAlign: 'left' }}>
                      {nombresDocs.map((n, i) => <span key={i} style={{ color: 'var(--ink)', fontWeight: 500 }}>· {n}</span>)}
                    </span>
                  </>}
            </div>
          )}

          <p style={{ fontSize: 15, color: 'var(--dim)', lineHeight: 1.6, margin: '10px auto 0', maxWidth: 460 }}>
            {gapTerms.length > 0
              ? <>Me falta un documento que hable de <b style={{ color: 'var(--ink)' }}>{listar(gapTerms.slice(0, 3))}</b> — o cualquier documento de tu negocio.</>
              : <>Mientras más documentos me des, mejor te entiendo.</>}
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 30, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => { setErr(null); setWarnings([]); setVista('inicio'); }} style={{ ...btnPrimary, padding: '13px 24px', fontSize: 15 }}><Ico d={I_SUBIR} size={16} /> Sí, subir más</button>
            <button type="button" onClick={seguirDesdeMasDocs} disabled={cargandoPreg} style={{ ...btnGhost, opacity: cargandoPreg ? 0.6 : 1 }}>{cargandoPreg ? 'Preparando…' : secundario}</button>
          </div>
          {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 16 }}>{err}</div>}
        </div>
        <div style={{ textAlign: 'center', paddingTop: 16, marginTop: 20, borderTop: '1px solid var(--border)' }}>
          <button type="button" onClick={() => setMasSlide('insight')} style={link}>← Volver a lo que entendí</button>
        </div>
      </div>
    );
  }

  // ── HUECOS: preguntas CERRADAS 1x1 (con Atrás) ──────────────────────────────
  if (vista === 'huecos') {
    const p = preguntas[gapIdx];
    if (!p) { setVista('archivos'); return null; }
    const enOtro = otroKey === p.key;
    return (
      <div style={{ maxWidth: 540, margin: '0 auto', textAlign: 'center', padding: '18px 0' }}>
        <div style={{ ...eyebrow, marginBottom: 18 }}>Pregunta {gapIdx + 1} de {preguntas.length}</div>
        <h2 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 22px', lineHeight: 1.28 }}>{p.pregunta}</h2>
        {!enOtro ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxWidth: 460, margin: '0 auto', textAlign: 'left' }}>
            {p.opciones.map((o, i) => (
              <button key={i} type="button" onClick={() => responderGap(p.key, o)}
                style={{ textAlign: 'left', cursor: 'pointer', fontFamily: SANS, fontSize: 14.5, padding: '13px 16px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', lineHeight: 1.4 }}>{o}</button>
            ))}
            <button type="button" onClick={() => { setOtroKey(p.key); setOtroVal(''); }}
              style={{ textAlign: 'left', cursor: 'pointer', fontFamily: SANS, fontSize: 14, padding: '13px 16px', borderRadius: 12, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)' }}>✎ Otra — lo escribo yo</button>
          </div>
        ) : (
          <div style={{ maxWidth: 460, margin: '0 auto', textAlign: 'left' }}>
            <textarea style={{ ...input, minHeight: 90, resize: 'vertical', lineHeight: 1.5 }} value={otroVal} autoFocus placeholder="Escríbelo con tus palabras…" onChange={(e) => setOtroVal(e.target.value)} />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
              <button type="button" onClick={() => { setOtroKey(null); setOtroVal(''); }} style={btnGhost}>Volver a las opciones</button>
              <button type="button" onClick={() => responderGap(p.key, otroVal)} disabled={!otroVal.trim()} style={{ ...btnPrimary, opacity: otroVal.trim() ? 1 : 0.4 }}>Guardar y seguir</button>
            </div>
          </div>
        )}
        {!enOtro && (
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 22, alignItems: 'center' }}>
            {gapIdx > 0 && <button type="button" onClick={() => { setOtroKey(null); setGapIdx((i) => Math.max(0, i - 1)); }} style={link}>← Atrás</button>}
            <button type="button" onClick={() => responderGap(p.key, null)} style={link}>Saltar</button>
            <button type="button" onClick={() => setVista('archivos')} style={link}>Terminar</button>
          </div>
        )}
      </div>
    );
  }

  // ── ARCHIVOS: la lista, con "subir más" ─────────────────────────────────────
  if (vista === 'archivos') {
    const gaps = est.gaps.length;
    return (
      <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {keyframes}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ ...eyebrow, marginBottom: 3 }}>Tus documentos{hayArchivos ? ` · ${est.files.length}` : ''}</div>
            <div style={{ fontSize: 13, color: 'var(--dim)' }}>Todo lo que subiste. MaKo lo lee y arma tu perfil.</div>
          </div>
          <button type="button" onClick={() => { setErr(null); setWarnings([]); setVista('inicio'); }} style={btnPrimary}><Ico d={I_SUBIR} size={16} /> Subir más</button>
        </div>
        {gaps > 0 && (
          <button type="button" onClick={seguirDesdeMasDocs} disabled={cargandoPreg} style={{ ...btnGhost, alignSelf: 'flex-start', color: 'var(--primary)', fontWeight: 600, borderColor: 'var(--primary)' }}>
            {cargandoPreg ? 'Preparando…' : `Completar ${gaps} dato${gaps === 1 ? '' : 's'} que faltan →`}
          </button>
        )}
        {hayArchivos ? listaArchivos : <div style={{ ...card, fontSize: 14, color: 'var(--dim)', textAlign: 'center' }}>Todavía no subiste documentos.</div>}
        {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, textAlign: 'center' }}>{err}</div>}
      </div>
    );
  }

  // ── INICIO (dropzone + cola con PREVIEW + Analizar) ─────────────────────────
  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {keyframes}
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addCola(e.dataTransfer.files); }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: 300, border: `1.5px dashed ${drag ? 'var(--primary)' : 'var(--border-strong)'}`, background: drag ? 'var(--primary-bg)' : 'var(--surface-2)', borderRadius: 20, padding: '44px 28px', textAlign: 'center', transition: 'all .15s' }}>
        <input ref={inputRef} type="file" multiple accept={ACCEPT} style={{ display: 'none' }} onChange={(e) => { addCola(e.target.files); e.target.value = ''; }} />
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5-5 5 5" /><path d="M12 5v12" /></svg>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', marginTop: 16 }}>Suelta aquí todo lo de tu negocio</div>
        <div style={{ fontSize: 14, color: 'var(--dim)', marginTop: 9, lineHeight: 1.6, maxWidth: 420 }}>Avatar, oferta, nicho, producto, guiones, tu web…<br />PDF, Word, texto o imágenes. Todos los que quieras.</div>
        <div style={{ marginTop: 22 }}><span style={{ ...btnPrimary, display: 'inline-block', padding: '12px 24px', fontSize: 15 }}>Elegir archivos</span></div>
      </label>

      {cola.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ ...eyebrow, marginBottom: 10 }}>Vas a subir · {cola.length}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {cola.map((c) => {
              const k = c.file.name + c.file.size;
              return (
                <div key={k} style={{ width: 88 }}>
                  <div style={{ position: 'relative' }}>
                    <DocThumb mime={c.file.type} nombre={c.file.name} src={c.url} w={88} h={110} />
                    <button type="button" aria-label="Quitar" onClick={() => quitarCola(k)} style={{ position: 'absolute', top: 5, right: 5, width: 20, height: 20, borderRadius: 999, border: 'none', background: 'rgba(18,21,27,.72)', color: '#fff', fontSize: 11, lineHeight: '20px', cursor: 'pointer', padding: 0, zIndex: 2 }}>✕</button>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.file.name}</div>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={analizar} style={{ ...btnPrimary, width: '100%', marginTop: 18, padding: '14px', fontSize: 15.5, justifyContent: 'center' }}>✦ Analizar {cola.length} documento{cola.length === 1 ? '' : 's'}</button>
        </div>
      )}

      {(hayPerfil || hayArchivos) && cola.length === 0 && (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button type="button" onClick={() => setVista('archivos')} style={link}>Ver mis documentos →</button>
        </div>
      )}
      {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 14, textAlign: 'center' }}>{err}</div>}
      {cajaWarn && <div style={{ marginTop: 12 }}>{cajaWarn}</div>}
    </div>
  );
}
