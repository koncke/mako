'use client';

// =============================================================================
// ConocimientoView — Conocimiento de MaKo por CURSOS (bajar a tierra metodología)
// =============================================================================
// Cada curso agrupa entradas (lecciones) de una metodología/autor, con un área de
// aplicación (mensajes / ads / general). Se puede:
//   - Importar un curso curado con un click (ej. "Levanta Muertos").
//   - Agregar conocimiento a mano (texto) o subiendo un video/audio de una clase,
//     que OpenAI transcribe y vos revisás antes de guardarlo.
// Escribe sobre la misma tabla mako_knowledge que usa el RAG de MaKo.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { MakoLogo } from '../_components/MakoBrand';
import { ConfirmDialog } from '../_components/ChatItemMenu';
import { Dropdown } from '../components/Dropdown';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Estado = 'indexado' | 'pendiente' | 'error';
type Entry = {
  id: number; titulo: string; categoria: string | null; cuerpo: string;
  curso: string | null; autor: string | null; area: string; fuente: string;
  activo: boolean; estado: Estado; error: string | null; updated_at: string;
};
type Curado = { clave: string; curso: string; autor: string; area: string; descripcion: string; cantidad: number; importado: boolean };

const AREAS = [
  { value: 'mensajes', label: 'Mensajes (WhatsApp / DM)' },
  { value: 'ads', label: 'Anuncios / creativos' },
  { value: 'general', label: 'General (todo el dashboard)' },
];
const areaLabel = (a: string) => AREAS.find((x) => x.value === a)?.label ?? a;
const AREA_COLOR: Record<string, { bg: string; fg: string }> = {
  mensajes: { bg: 'var(--good-bg)', fg: 'var(--good)' },
  ads: { bg: 'var(--accent-soft)', fg: '#14161B' },
  general: { bg: 'var(--surface-2)', fg: 'var(--dim)' },
};

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 };
const input: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' };
const area: CSSProperties = { ...input, minHeight: 120, resize: 'vertical', lineHeight: 1.5 };
const labelStyle: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6, display: 'block' };
const btnDark: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: 'none', background: '#14161B', color: '#F3F5F8', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '8px 13px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, cursor: 'pointer' };

function EstadoBadge({ estado, error }: { estado: Estado; error: string | null }) {
  const map: Record<Estado, { t: string; bg: string; fg: string }> = {
    indexado: { t: 'Indexado', bg: 'var(--good-bg)', fg: 'var(--good)' },
    pendiente: { t: 'Pendiente', bg: 'var(--warn-bg)', fg: 'var(--warn)' },
    error: { t: 'Error', bg: 'var(--bad-bg)', fg: 'var(--bad)' },
  };
  const m = map[estado] ?? map.pendiente;
  return <span title={error ?? undefined} style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: m.bg, color: m.fg }}>{m.t}</span>;
}

function AreaBadge({ area: a }: { area: string }) {
  const c = AREA_COLOR[a] ?? AREA_COLOR.general;
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: c.bg, color: c.fg }}>{areaLabel(a)}</span>;
}

type Grupo = { curso: string | null; nombre: string; autor: string | null; area: string; entries: Entry[]; activas: number };

export function ConocimientoView() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [curados, setCurados] = useState<Curado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busy, setBusy] = useState(false);
  const [seeding, setSeeding] = useState<string | null>(null);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<Entry | null>(null);
  const [del, setDel] = useState<Entry | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cargar = () => {
    fetch('/api/mako/knowledge')
      .then((r) => r.json())
      .then((j) => { setEntries(j.entries ?? []); setCurados(j.curados ?? []); })
      .finally(() => setCargando(false));
  };
  useEffect(() => { cargar(); }, []);

  // Devuelve true si la mutación salió bien; en error, lo muestra y NO recarga.
  const post = async (payload: Record<string, unknown>): Promise<boolean> => {
    setBusy(true); setErrorMsg(null);
    try {
      const r = await fetch('/api/mako/knowledge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErrorMsg(j.error || 'No se pudo completar la acción.'); return false; }
      cargar(); return true;
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : String(e)); return false; }
    finally { setBusy(false); }
  };

  const importar = async (clave: string) => {
    setSeeding(clave); setErrorMsg(null);
    try {
      const r = await fetch('/api/mako/knowledge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'seed_curso', clave }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErrorMsg(j.error || 'No se pudo importar el curso.'); return; }
      cargar();
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : String(e)); }
    finally { setSeeding(null); }
  };

  const grupos: Grupo[] = useMemo(() => {
    const map = new Map<string, Grupo>();
    for (const e of entries) {
      const key = e.curso ?? '__suelto__';
      let g = map.get(key);
      if (!g) { g = { curso: e.curso, nombre: e.curso ?? 'Conocimiento suelto', autor: e.autor, area: e.area, entries: [], activas: 0 }; map.set(key, g); }
      g.entries.push(e);
      if (e.activo) g.activas++;
      if (!g.autor && e.autor) g.autor = e.autor;
    }
    return [...map.values()].sort((a, b) => (a.curso === null ? 1 : b.curso === null ? -1 : a.nombre.localeCompare(b.nombre)));
  }, [entries]);

  const cursosExistentes = useMemo(() => [...new Set(entries.map((e) => e.curso).filter((c): c is string => !!c))], [entries]);
  const noImportados = curados.filter((c) => !c.importado);
  const toggleAbierto = (k: string) => setAbiertos((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <MakoLogo size={36} />
        <h1 style={{ fontWeight: 600, fontSize: 42, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Conocimiento</h1>
      </header>
      <p style={{ fontSize: 14, color: 'var(--dim)', margin: '0 0 26px', maxWidth: 760 }}>
        Los cursos y metodologías que MaKo tiene bajados a tierra. Cada curso se enchufa donde corresponde según su <strong>área</strong>: los de <em>Mensajes</em> alimentan las recomendaciones de WhatsApp, los de <em>Anuncios</em> los creativos, y los <em>Generales</em> todo el dashboard.
      </p>

      {errorMsg && (
        <div style={{ maxWidth: 880, marginBottom: 18, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '11px 14px', borderRadius: 12, border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)', fontSize: 13.5 }}>
          <span>{errorMsg}</span>
          <button aria-label="Descartar aviso" onClick={() => setErrorMsg(null)} style={{ flex: 'none', background: 'none', border: 'none', color: 'var(--bad)', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}

      <div style={{ maxWidth: 880, display: 'flex', flexDirection: 'column', gap: 28 }}>
        {/* ── Cursos curados por importar ── */}
        {noImportados.length > 0 && (
          <section>
            <SectionTitle>Bajar a tierra un curso</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {noImportados.map((c) => (
                <div key={c.clave} style={{ ...card, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, borderStyle: 'dashed' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>{c.curso}</span>
                      <AreaBadge area={c.area} />
                      <span style={{ fontSize: 11.5, color: 'var(--faint)', fontFamily: MONO }}>{c.cantidad} lecciones</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 4, fontFamily: MONO }}>{c.autor}</div>
                    <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 8, lineHeight: 1.5 }}>{c.descripcion}</div>
                  </div>
                  <button style={{ ...btnDark, flex: 'none', opacity: seeding ? 0.6 : 1 }} disabled={!!seeding} onClick={() => importar(c.clave)}>
                    {seeding === c.clave ? 'Importando…' : 'Bajar a tierra ↓'}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Cursos ya importados / conocimiento suelto ── */}
        <section>
          <SectionTitle>Tus cursos</SectionTitle>
          {cargando ? (
            <div style={{ ...card, color: 'var(--faint)', fontFamily: MONO, fontSize: 13 }}>Cargando…</div>
          ) : grupos.length === 0 ? (
            <div style={{ ...card, color: 'var(--faint)', fontSize: 14 }}>Todavía no hay conocimiento cargado. Importá un curso arriba o agregá uno abajo.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {grupos.map((g) => {
                const key = g.curso ?? '__suelto__';
                const open = abiertos.has(key);
                const todasActivas = g.activas === g.entries.length;
                return (
                  <div key={key} style={card}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <button onClick={() => toggleAbierto(key)} style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, color: 'var(--faint)' }}>{open ? '▾' : '▸'}</span>
                          <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>{g.nombre}</span>
                          <AreaBadge area={g.area} />
                          <span style={{ fontSize: 11.5, color: 'var(--faint)', fontFamily: MONO }}>{g.entries.length} {g.entries.length === 1 ? 'lección' : 'lecciones'} · {g.activas} activas</span>
                        </div>
                        {g.autor && <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 4, fontFamily: MONO, paddingLeft: 20 }}>{g.autor}</div>}
                      </button>
                      {g.curso && (
                        <button style={{ ...btnGhost, flex: 'none' }} disabled={busy} onClick={() => post({ action: 'set_curso_activo', curso: g.curso, activo: !todasActivas })}>
                          {todasActivas ? 'Desactivar curso' : 'Activar curso'}
                        </button>
                      )}
                    </div>

                    {open && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                        {g.entries.map((e) => (
                          <div key={e.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, background: 'var(--surface-2)' }}>
                            {edit?.id === e.id ? (
                              <EditEntry entry={e} onCancel={() => setEdit(null)} onSave={async (f) => { setEdit(null); await post({ action: 'update', id: e.id, ...f }); }} />
                            ) : (
                              <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>{e.titulo}</span>
                                  <EstadoBadge estado={e.estado} error={e.error} />
                                  {e.area !== g.area && <AreaBadge area={e.area} />}
                                  {e.fuente === 'transcripcion' && <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'var(--surface)', color: 'var(--faint)' }}>🎙️ transcripción</span>}
                                  {!e.activo && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: 'var(--surface)', color: 'var(--faint)' }}>Inactiva</span>}
                                </div>
                                {e.categoria && <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>{e.categoria}</div>}
                                <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 8, lineHeight: 1.55, whiteSpace: 'pre-wrap', maxHeight: 150, overflow: 'auto' }}>{e.cuerpo}</div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                                  <button style={btnGhost} disabled={busy} onClick={() => post({ action: 'update', id: e.id, activo: !e.activo })}>{e.activo ? 'Desactivar' : 'Activar'}</button>
                                  <button style={btnGhost} onClick={() => setEdit(e)}>Editar</button>
                                  <button style={btnGhost} disabled={busy} onClick={() => post({ action: 'reindex', id: e.id })}>Reindexar</button>
                                  <button style={{ ...btnGhost, color: 'var(--bad)' }} onClick={() => setDel(e)}>Eliminar</button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Agregar conocimiento (texto o transcripción) ── */}
        <section>
          <SectionTitle>Agregar conocimiento</SectionTitle>
          <AgregarPanel cursos={cursosExistentes} busy={busy} onCreate={(payload) => post({ action: 'create', ...payload })} />
        </section>
      </div>

      {del && (
        <ConfirmDialog
          titulo="¿Eliminar esta lección?"
          detalle={`"${del.titulo}" se borra del conocimiento de MaKo.`}
          confirmLabel="Eliminar"
          danger
          onCancel={() => setDel(null)}
          onConfirm={() => { const id = del.id; setDel(null); post({ action: 'delete', id }); }}
        />
      )}
    </main>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)', marginBottom: 12 }}>{children}</div>;
}

// ── Panel de alta: metadatos + (pegar texto | subir clase para transcribir) ────
function AgregarPanel({ cursos, busy, onCreate }: { cursos: string[]; busy: boolean; onCreate: (p: Record<string, unknown>) => Promise<boolean> }) {
  const [curso, setCurso] = useState('');
  const [autor, setAutor] = useState('');
  const [areaVal, setAreaVal] = useState('mensajes');
  const [categoria, setCategoria] = useState('');
  const [titulo, setTitulo] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [transcribiendo, setTranscribiendo] = useState(false);
  const [transcribeInfo, setTranscribeInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const transcribir = async (file: File) => {
    setError(null); setTranscribeInfo(null); setTranscribiendo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const j = await fetch('/api/mako/knowledge/transcribe', { method: 'POST', body: fd }).then((r) => r.json());
      if (!j.ok) { setError(j.error || 'No se pudo transcribir.'); return; }
      setCuerpo((prev) => (prev.trim() ? prev + '\n\n' : '') + j.transcript);
      if (!titulo.trim()) setTitulo(file.name.replace(/\.[^.]+$/, ''));
      const mins = j.duracion_s ? ` · ${Math.round(j.duracion_s / 60)} min` : '';
      setTranscribeInfo(`✓ Transcripción lista${mins}. Revisala y guardala.`);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setTranscribiendo(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const guardar = async () => {
    if (!titulo.trim() || !cuerpo.trim()) return;
    setError(null);
    const ok = await onCreate({ titulo, categoria: categoria || null, cuerpo, curso: curso.trim() || null, autor: autor.trim() || null, area: areaVal, fuente: transcribeInfo ? 'transcripcion' : 'manual' });
    // Solo limpiamos el formulario si de verdad se guardó (no perdemos el texto/transcripción en un error).
    if (!ok) { setError('No se pudo guardar (mirá el aviso de arriba). Tu texto sigue acá.'); return; }
    setTitulo(''); setCuerpo(''); setCategoria(''); setTranscribeInfo(null);
  };

  const puedeGuardar = !!titulo.trim() && !!cuerpo.trim() && !busy && !transcribiendo;

  return (
    <div style={card}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Curso</label>
          <input style={input} value={curso} onChange={(e) => setCurso(e.target.value)} placeholder="Levanta Muertos" list="cursos-existentes" />
          <datalist id="cursos-existentes">{cursos.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <div>
          <label style={labelStyle}>Autor / fuente</label>
          <input style={input} value={autor} onChange={(e) => setAutor(e.target.value)} placeholder="Nombre del autor o método" />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Área de aplicación</label>
          <Dropdown value={areaVal} onChange={setAreaVal} width="100%" ariaLabel="Área" options={AREAS} />
        </div>
        <div>
          <label style={labelStyle}>Categoría (opcional)</label>
          <input style={input} value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Objeciones · Estructura · Ejemplos…" />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Título de la lección</label>
        <input style={input} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Cómo manejar la objeción de precio" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
        <label style={{ ...labelStyle, margin: 0 }}>Contenido</label>
        <label style={{ ...btnGhost, cursor: transcribiendo ? 'default' : 'pointer', opacity: transcribiendo ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          {transcribiendo ? 'Transcribiendo…' : '🎙️ Subir clase (video/audio) y transcribir'}
          <input ref={fileRef} type="file" hidden accept="audio/*,video/*" disabled={transcribiendo} onChange={(e) => { const f = e.target.files?.[0]; if (f) void transcribir(f); }} />
        </label>
      </div>
      <textarea style={area} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} placeholder="Pegá la metodología / transcripción acá. MaKo la usa para responder y recomendar. También podés subir un video o audio de la clase y OpenAI lo transcribe." />
      {transcribeInfo && <div style={{ fontSize: 12.5, color: 'var(--good)', fontWeight: 600, marginTop: 6 }}>{transcribeInfo}</div>}
      {error && <div style={{ fontSize: 12.5, color: 'var(--bad)', marginTop: 6 }}>{error}</div>}
      <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 8 }}>El video/audio se transcribe con OpenAI (máx 25 MB). Al guardar, MaKo lo indexa (embedding) para recuperarlo cuando sea relevante.</div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
        <button style={{ ...btnDark, opacity: puedeGuardar ? 1 : 0.55 }} disabled={!puedeGuardar} onClick={guardar}>Guardar en conocimiento</button>
      </div>
    </div>
  );
}

function EditEntry({ entry, onCancel, onSave }: { entry: Entry; onCancel: () => void; onSave: (f: { titulo: string; categoria: string | null; cuerpo: string; area: string }) => void }) {
  const [titulo, setTitulo] = useState(entry.titulo);
  const [categoria, setCategoria] = useState(entry.categoria ?? '');
  const [cuerpo, setCuerpo] = useState(entry.cuerpo);
  const [areaVal, setAreaVal] = useState(entry.area);
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 200px', gap: 12, marginBottom: 12 }}>
        <div><label style={labelStyle}>Título</label><input style={input} value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
        <div><label style={labelStyle}>Categoría</label><input style={input} value={categoria} onChange={(e) => setCategoria(e.target.value)} /></div>
        <div><label style={labelStyle}>Área</label><Dropdown value={areaVal} onChange={setAreaVal} width="100%" ariaLabel="Área" options={AREAS} /></div>
      </div>
      <label style={labelStyle}>Contenido</label>
      <textarea style={area} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} />
      <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 6 }}>Solo se re-indexa si cambia el contenido. Editar título, categoría o área no re-embebe.</div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button style={btnGhost} onClick={onCancel}>Cancelar</button>
        <button style={btnDark} onClick={() => onSave({ titulo, categoria: categoria || null, cuerpo, area: areaVal })}>Guardar</button>
      </div>
    </div>
  );
}
