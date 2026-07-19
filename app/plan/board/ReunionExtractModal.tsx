'use client';

// ReunionExtractModal — G3: MaKo lee una reunión de Fathom y saca los action items
// del equipo como tarjetas del plan. Dos fases: elegir la reunión → revisar los
// candidatos (incluir/excluir + reasignar proyecto) → agregar al plan. El perro
// guardián los re-puntúa solo cuando entran (cambia la firma del plan).

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { GuardianIcon } from './GuardianIcon';
import { ScoreIcon } from './guardian-form';
import { Dropdown } from '../../components/Dropdown';
import { SvcIcon } from '../../_components/ServicioVisual';
import { type Label, type Prio, type Fuente, PLABEL } from './types';
import { TIPO_REUNION_UI, type TipoReunion } from '@/lib/reunion-clasificar';
import { frenoDeScope, type FrenoScope } from '@/lib/reunion-gate';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const AUTOLOAD_KEY = 'mako_reunion_autoload'; // opt-in recordado: cargar solo las de equipo (punto: auto-load)

type ReunionMeta = { recordingId: number; titulo: string; fecha: string | null; durMin: number | null; url: string | null; involucrados: string[]; tipo: TipoReunion };
type Candidata = { titulo: string; detalle: string; prioridad: Prio; proyectoId: string | null; dueño?: string; esDeOtro?: boolean };
type Existente = { id: string; titulo: string; detalle: string };
type Duda = { termino: string; porque: string };
// enriquece = ya existe en el plan; el Perro sugiere sumarle a esa tarjeta en vez de duplicar.
type Fila = Candidata & { incluir: boolean; enriquece?: { id: string; razon: string } };

const banda = (p: Prio): string => (p === 'alta' ? '#D0504A' : p === 'media' ? '#C8870C' : p === 'baja' ? '#1E9E57' : '#98A0AC');

async function apiFathom(body: Record<string, unknown>): Promise<{ ok: boolean; reuniones?: ReunionMeta[]; nextCursor?: string | null; tareas?: Candidata[]; dudas?: Duda[]; cruces?: Array<{ i: number; idExistente: string | null; razon: string }>; usage?: unknown; error?: string }> {
  return fetch('/api/plan-fathom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
}

function fmtFecha(iso: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return ''; }
}

export function ReunionExtractModal({ labels, existentes, archivoInicial, autoloadScope, onCrear, onUsage, onClose }: {
  labels: Label[];
  existentes: Existente[];               // tareas abiertas del plan, para el dedup del Perro (punto 8)
  archivoInicial?: File | null;          // si entró por el botón "subir archivo" del toolbar (punto 7)
  autoloadScope?: string;                // scope del opt-in de auto-load (por workspace): NO se comparte entre inquilinos/impersonaciones
  onCrear: (cands: Candidata[], fuente?: Fuente) => void;
  onUsage?: (u: unknown) => void;
  onClose: () => void;
}) {
  // La preferencia de auto-load se guarda POR workspace: si un super-admin la prende
  // en su agencia y después "entra como" un cliente (mismo origin → mismo localStorage),
  // NO debe auto-cargar en el tablero del cliente sin haber optado ahí.
  const autoKey = AUTOLOAD_KEY + ':' + (autoloadScope ?? 'default');
  const [fase, setFase] = useState<'lista' | 'extrayendo' | 'validar' | 'revisar'>('lista');
  const [reuniones, setReuniones] = useState<ReunionMeta[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);   // nextCursor de Fathom
  const [cargandoMas, setCargandoMas] = useState(false);
  const [q, setQ] = useState('');                              // búsqueda por título/email
  const [desde, setDesde] = useState('');                      // filtro por fecha (YYYY-MM-DD)
  const [elegida, setElegida] = useState<ReunionMeta | null>(null);
  const [archivoNombre, setArchivoNombre] = useState(''); // nombre del archivo subido (para la fuente)
  const [filas, setFilas] = useState<Fila[]>([]);
  const [dudas, setDudas] = useState<Duda[]>([]);              // términos a aclarar (paso previo, punto 7)
  const [defs, setDefs] = useState<Record<number, string>>({}); // definiciones que va escribiendo el usuario
  const [autoload, setAutoload] = useState(false);            // opt-in recordado (auto-cargar reuniones de equipo)
  const [err, setErr] = useState('');

  // Trae una página. `reset` = arranca de cero (cambió el filtro de fecha); si no,
  // agrega a lo que ya hay (botón "cargar más"). El cursor lo da Fathom.
  const cargar = async (reset: boolean) => {
    if (reset) { setReuniones(null); setCursor(null); }
    setCargandoMas(!reset); // no limpiamos err acá: volverALista() puede querer conservar el error de un archivo que falló
    const j = await apiFathom({ action: 'reuniones', cursor: reset ? undefined : cursor ?? undefined, recordedAfter: desde || undefined });
    setCargandoMas(false);
    if (j.ok && j.reuniones) {
      setReuniones((prev) => (reset || !prev ? j.reuniones! : [...prev, ...j.reuniones!]));
      setCursor(j.nextCursor ?? null);
    } else { setErr(j.error || 'No pude traer las reuniones.'); if (reset) setReuniones([]); }
  };

  // Lista de Fathom: solo si NO entró por "subir archivo" del toolbar. Recarga al
  // cambiar el filtro de fecha.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (archivoInicial) return; setErr(''); void cargar(true); }, [desde]);

  // Búsqueda client-side sobre título + emails de los involucrados.
  const visibles = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n || !reuniones) return reuniones ?? [];
    return reuniones.filter((r) => (r.titulo + ' ' + r.involucrados.join(' ')).toLowerCase().includes(n));
  }, [q, reuniones]);

  const [freno, setFreno] = useState<FrenoScope>(null);   // aviso del Perro por tipo (punto 8)

  // Decide qué hacer con las candidatas ya cruzadas: auto-cargar (solo reuniones de
  // equipo, sin conflictos, con el opt-in prendido) o abrir la revisión manual.
  // `fuente` = la reunión de la que salieron (null si vino de un archivo).
  const finalizar = (filasNuevas: Fila[], fuente: ReunionMeta | null) => {
    // Limpio = reunión de equipo (sus tareas SÍ son del plan), sin freno, y donde TODAS
    // las candidatas quedaron tildadas: ni tareas de otros (esDeOtro→destildada) ni
    // choques con el plan (enriquece→destildada). Así el auto-load nunca deja afuera
    // algo que el usuario querría ver (p.ej. bajar las de otros como .md).
    const limpio = !!fuente && fuente.tipo === 'equipo' && !frenoDeScope(fuente.tipo) && filasNuevas.length > 0 && filasNuevas.every((f) => f.incluir);
    if (autoload && limpio) {
      // Auto-load (punto: sin apretar el botón): carga y cierra. El board deja un undo,
      // así que es reversible. Solo pasa por acá el caso 100% limpio (siempre Fathom).
      onCrear(filasNuevas.map(({ incluir: _i, enriquece: _e, ...c }) => c), fuente ? { tipo: 'fathom', etiqueta: fuente.titulo, url: fuente.url ?? undefined } : undefined);
      onClose();
      return;
    }
    setFilas(filasNuevas); setFase('revisar');
  };

  // Anota las candidatas: reparto mío/de-otro (viene del backend), y el cruce del
  // Perro contra el plan (dedup, punto 8). Al de-otro lo destildo por default: tu
  // tablero es tuyo, las de otros se bajan como md.
  const procesar = async (tareas: Candidata[], dudasIn: Duda[], fuente: ReunionMeta | null) => {
    const filasNuevas: Fila[] = tareas.map((t) => ({ ...t, incluir: !t.esDeOtro }));
    // Dedup contra el plan (best-effort: apiFathom nunca lanza; si el server falla, ok:false).
    const jc = await apiFathom({ action: 'cruzar', candidatas: tareas.map((t) => ({ titulo: t.titulo, detalle: t.detalle })), existentes, uso: 'Cruzar con el plan' });
    if (jc.ok && Array.isArray(jc.cruces)) {
      for (const c of jc.cruces) if (filasNuevas[c.i]) filasNuevas[c.i] = { ...filasNuevas[c.i], enriquece: { id: c.idExistente!, razon: c.razon }, incluir: false };
    }
    // Paso previo (punto 7): si MaKo no entendió algún término, que el usuario lo aclare
    // ANTES de revisar (y antes de cualquier auto-load).
    if (dudasIn.length > 0) { setFilas(filasNuevas); setDudas(dudasIn); setDefs({}); setFase('validar'); return; }
    finalizar(filasNuevas, fuente);
  };

  const extraer = async (r: ReunionMeta) => {
    setElegida(r); setFase('extrayendo'); setErr(''); setFreno(frenoDeScope(r.tipo));
    const proyectos = labels.map((l) => ({ id: l.id, emoji: l.emoji, nombre: l.name }));
    const j = await apiFathom({ action: 'extraer', recordingId: r.recordingId, proyectos, uso: 'Extraer tareas de reunión' });
    if (j.usage) onUsage?.(j.usage);
    if (j.ok && j.tareas) await procesar(j.tareas, j.dudas ?? [], r);
    else { setErr(j.error || 'MaKo no pudo leer la reunión.'); setFase('lista'); setElegida(null); }
  };

  // Subir un archivo (md/txt/transcript) → mismo pipeline (punto 5). Los archivos NUNCA
  // auto-cargan (fuente=null): no hay clasificación, así que siempre pasan por revisión.
  const subirArchivo = async (file: File) => {
    setElegida(null); setArchivoNombre(file.name); setFase('extrayendo'); setErr(''); setFreno(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('proyectos', JSON.stringify(labels.map((l) => ({ id: l.id, emoji: l.emoji, nombre: l.name }))));
    const j = await fetch('/api/plan-fathom', { method: 'POST', body: fd }).then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
    if (j.usage) onUsage?.(j.usage);
    if (j.ok && j.tareas) await procesar(j.tareas, j.dudas ?? [], null);
    // Falló el archivo: mostramos el error y volvemos a la lista (que se carga sola,
    // porque el modo-archivo la había salteado) para que el usuario no quede colgado.
    else { setErr(j.error || 'No pude leer el archivo.'); volverALista(); }
  };

  // Mount: leer el opt-in de auto-load, y si entró por "subir archivo", procesarlo directo.
  useEffect(() => {
    try { setAutoload(localStorage.getItem(autoKey) === '1'); } catch { /* no-op */ }
    if (archivoInicial) void subirArchivo(archivoInicial);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  // Guarda las definiciones que el usuario escribió (glosario) y pasa a la revisión.
  // Cuando hubo dudas NO auto-cargamos: había ambigüedad, mejor que las mire.
  const [guardandoDudas, setGuardandoDudas] = useState(false);
  const guardarDudasYSeguir = async () => {
    setGuardandoDudas(true);
    await Promise.all(dudas.map((d, i) => {
      const def = (defs[i] ?? '').trim();
      return def ? apiFathom({ action: 'glosario-guardar', termino: d.termino, definicion: def }) : Promise.resolve();
    }));
    setGuardandoDudas(false); setDudas([]); setFase('revisar');
  };

  const nIncluidas = useMemo(() => filas.filter((f) => f.incluir).length, [filas]);
  const deOtros = useMemo(() => filas.filter((f) => f.esDeOtro), [filas]);

  // Baja las tareas de otros como .md, para pasárselas a esa persona (punto 5).
  const descargarDeOtros = () => {
    const md = ['# Tareas de la reunión' + (elegida ? ` — ${elegida.titulo}` : ''), '', ...deOtros.map((f) => `- [ ] **${f.dueño || 'Alguien'}:** ${f.titulo}${f.detalle ? `\n  ${f.detalle}` : ''}`)].join('\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'tareas-de-otros.md'; a.click();
    URL.revokeObjectURL(a.href);
  };

  const confirmar = () => {
    // fuente: la reunión de Fathom (con link) o el archivo subido (feedback jul-19).
    const fuente: Fuente | undefined = elegida ? { tipo: 'fathom', etiqueta: elegida.titulo, url: elegida.url ?? undefined }
      : archivoNombre ? { tipo: 'archivo', etiqueta: archivoNombre }
        : undefined;
    onCrear(filas.filter((f) => f.incluir).map(({ incluir: _i, enriquece: _e, ...c }) => c), fuente);
    onClose();
  };
  const setFila = (i: number, patch: Partial<Fila>) => setFilas((fs) => fs.map((f, k) => (k === i ? { ...f, ...patch } : f)));

  // Volver a la lista de reuniones de Fathom. Si nunca se cargó (entramos por "subir
  // archivo", que la saltea), la trae ahora: si no, quedaría un spinner falso eterno.
  const volverALista = () => {
    setFase('lista'); setElegida(null); setFilas([]); setFreno(null); setDudas([]);
    if (reuniones == null && !cargandoMas) void cargar(true);
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 620, maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
          <GuardianIcon size={34} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '.14em', color: 'var(--accent)' }}>✦ MAKO · REUNIÓN → PLAN</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginTop: 2 }}>
              {fase === 'lista' ? 'Elegí una reunión' : fase === 'extrayendo' ? 'Leyendo la reunión…' : fase === 'validar' ? 'Antes de seguir, aclarame esto' : `Action items · ${elegida?.titulo.slice(0, 40) ?? ''}`}
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>

        {/* cuerpo */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 22px' }}>
          {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginBottom: 12 }}>{err}</div>}

          {/* lista de reuniones */}
          {fase === 'lista' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Subir archivo YA NO vive acá: es un botón aparte del toolbar (punto 7). */}
              {/* búsqueda + filtro por fecha (punto 9) */}
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título o email…"
                  style={{ flex: 1, minWidth: 0, padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, outline: 'none', fontFamily: SANS }} />
                <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} title="Desde esta fecha"
                  style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: desde ? 'var(--ink)' : 'var(--faint)', fontSize: 13, outline: 'none', fontFamily: SANS }} />
                {desde && <button type="button" onClick={() => setDesde('')} title="Quitar el filtro de fecha" style={{ padding: '0 10px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', fontSize: 14 }}>✕</button>}
              </div>

              {reuniones == null
                ? <Cargando texto="Buscando tus reuniones en Fathom…" />
                : visibles.length === 0
                  ? <Vacio texto={q || desde ? 'Ninguna reunión coincide con el filtro.' : 'No encontré reuniones recientes en Fathom.'} />
                  : <>
                      {visibles.map((r) => {
                        const t = TIPO_REUNION_UI[r.tipo];
                        return (
                          <button key={r.recordingId} type="button" onClick={() => extraer(r)}
                            style={{ display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left', width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer', fontFamily: SANS }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}>
                            {/* logo de Fathom (punto 6): son grabaciones de Fathom, no un micrófono genérico */}
                            <span style={{ flex: 'none', marginTop: 1 }}><SvcIcon k="fathom" size={17} box={28} radius={8} /></span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.titulo}</span>
                                <span title={`Clasificada como ${t.label} por los emails de los invitados`} style={{ flex: 'none', fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: `var(--${t.tono})`, background: `var(--${t.tono}-bg, var(--surface-2))`, border: `1px solid var(--${t.tono})` }}>{t.label}</span>
                              </span>
                              <span style={{ display: 'block', fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>{fmtFecha(r.fecha)}{r.durMin ? ` · ${r.durMin} min` : ''}</span>
                              {r.involucrados.length > 0 && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--dim)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>👤 {r.involucrados.join(', ')}</span>}
                            </span>
                            <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600, whiteSpace: 'nowrap', marginTop: 2 }}>Extraer →</span>
                          </button>
                        );
                      })}
                      {/* cargar más (punto 9): solo si Fathom devolvió cursor y no estás filtrando en local */}
                      {cursor && !q && (
                        <button type="button" onClick={() => void cargar(false)} disabled={cargandoMas}
                          style={{ alignSelf: 'center', marginTop: 4, padding: '8px 18px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13, fontWeight: 600, cursor: cargandoMas ? 'default' : 'pointer', fontFamily: SANS }}>
                          {cargandoMas ? 'Cargando…' : 'Cargar más reuniones'}
                        </button>
                      )}
                    </>}
            </div>
          )}

          {/* extrayendo */}
          {fase === 'extrayendo' && <Cargando texto="MaKo está sacando los action items del equipo…" grande />}

          {/* paso previo (punto 7): MaKo pregunta por lo que no entendió → glosario */}
          {fase === 'validar' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--primary-weak)', background: 'var(--primary-bg)' }}>
                <GuardianIcon size={26} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>MaKo ya sacó las tareas, pero hay términos que no tiene claros.</div>
                  <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2, lineHeight: 1.5 }}>Aclaralos y quedan guardados en el glosario del negocio: la próxima reunión ya los entiende sin preguntar.</div>
                </div>
              </div>
              {dudas.map((d, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 13px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>¿Qué es <span style={{ color: 'var(--accent)' }}>{d.termino}</span>?</div>
                  {d.porque && <div style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.45, fontStyle: 'italic' }}>{d.porque}</div>}
                  <input value={defs[i] ?? ''} onChange={(e) => setDefs((s) => ({ ...s, [i]: e.target.value }))} placeholder={`Definí "${d.termino}" en una frase…`}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, outline: 'none', fontFamily: SANS }} />
                </div>
              ))}
            </div>
          )}

          {/* revisar candidatos */}
          {fase === 'revisar' && (
            filas.length === 0
              ? <Vacio texto="MaKo no encontró action items concretos en esta reunión." />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Freno del Perro por tipo de reunión (punto 8): ventas/entrega no son del plan */}
                  {freno && (
                    <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--warn)', background: 'var(--warn-bg, var(--surface-2))' }}>
                      <GuardianIcon size={26} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warn)' }}>🐕 {freno.titulo}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2, lineHeight: 1.5 }}>{freno.detalle}</div>
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 2 }}>Elegí cuáles agregar a TU plan. Las de otras personas van destildadas — bajalas como .md desde abajo. El perro les pone la prioridad final.</div>
                  {filas.map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: 11, padding: '12px 13px', borderRadius: 12, border: `1px solid ${f.incluir ? 'var(--primary)' : 'var(--border)'}`, background: f.incluir ? 'var(--primary-bg)' : 'var(--surface-2)', opacity: f.incluir ? 1 : 0.6 }}>
                      <button type="button" onClick={() => setFila(i, { incluir: !f.incluir })} aria-label="Incluir"
                        style={{ width: 20, height: 20, flex: 'none', marginTop: 1, borderRadius: 6, border: `1.5px solid ${f.incluir ? 'var(--primary)' : 'var(--border-strong)'}`, background: f.incluir ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{f.incluir ? '✓' : ''}</button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>{f.titulo}</div>
                        {f.detalle && <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 3, lineHeight: 1.5 }}>{f.detalle}</div>}
                        {/* dueño (punto 5) + "ya existe" del Perro (punto 8) */}
                        {(f.esDeOtro || f.enriquece) && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                            {f.esDeOtro && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--dim)', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '2px 7px' }}>👤 de {f.dueño || 'otra persona'} — no es tuya</span>}
                            {f.enriquece && <span title={f.enriquece.razon} style={{ fontSize: 11, fontWeight: 700, color: 'var(--warn)', background: 'var(--warn-bg, var(--surface))', border: '1px solid var(--warn)', borderRadius: 6, padding: '2px 7px' }}>⚠ ya existe en el plan · {f.enriquece.razon.slice(0, 50)}</span>}
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: banda(f.prioridad), fontFamily: MONO }}><ScoreIcon size={11} color={banda(f.prioridad)} />{PLABEL[f.prioridad]}</span>
                          <Dropdown
                            value={f.proyectoId ?? ''}
                            onChange={(v) => setFila(i, { proyectoId: v || null })}
                            ariaLabel="Proyecto de la tarea"
                            buttonStyle={{ padding: '4px 8px', borderRadius: 8, fontSize: 12, fontWeight: 600, maxWidth: 200 }}
                            options={[
                              { value: '', label: 'Sin proyecto' },
                              ...labels.map((l) => ({ value: l.id, label: `${l.emoji} ${l.name}`, color: l.color })),
                            ]}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
          )}
        </div>

        {/* footer — paso previo (glosario): guardar y seguir / saltear */}
        {fase === 'validar' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => { setDudas([]); setFase('revisar'); }} style={ghostBtn} disabled={guardandoDudas}>Saltear</button>
            <button type="button" onClick={() => void guardarDudasYSeguir()} disabled={guardandoDudas}
              style={{ padding: '12px 24px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: guardandoDudas ? 'default' : 'pointer', fontFamily: SANS, opacity: guardandoDudas ? 0.7 : 1 }}>
              {guardandoDudas ? 'Guardando…' : 'Guardar y seguir →'}
            </button>
          </div>
        )}

        {/* footer */}
        {fase === 'revisar' && filas.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            {/* opt-in de auto-load (solo reuniones de equipo, que son las que SÍ van al plan) */}
            {elegida?.tipo === 'equipo' && !freno && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--dim)', cursor: 'pointer' }}>
                <button type="button" role="checkbox" aria-checked={autoload} onClick={() => { const v = !autoload; setAutoload(v); try { localStorage.setItem(autoKey, v ? '1' : '0'); } catch { /* no-op */ } }}
                  style={{ width: 18, height: 18, flex: 'none', borderRadius: 5, border: `1.5px solid ${autoload ? 'var(--primary)' : 'var(--border-strong)'}`, background: autoload ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{autoload ? '✓' : ''}</button>
                Las próximas reuniones de equipo, cargalas solas al plan (siempre con deshacer).
              </label>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <button type="button" onClick={volverALista} style={ghostBtn}>← Otra reunión</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* las de otros se bajan como .md para pasárselas (punto 5) */}
                {deOtros.length > 0 && (
                  <button type="button" onClick={descargarDeOtros} style={{ ...ghostBtn, fontSize: 13 }}>
                    ⬇ {deOtros.length} de otros (.md)
                  </button>
                )}
                <button type="button" onClick={confirmar} disabled={nIncluidas === 0}
                  style={{ padding: '12px 24px', borderRadius: 11, border: 'none', background: nIncluidas ? 'var(--primary)' : 'var(--border)', color: nIncluidas ? '#fff' : 'var(--faint)', fontSize: 14, fontWeight: 700, cursor: nIncluidas ? 'pointer' : 'default', fontFamily: SANS }}>
                  {nIncluidas ? `Agregar ${nIncluidas} al plan →` : 'Elegí al menos una'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Cargando({ texto, grande }: { texto: string; grande?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: grande ? '46px 0' : '30px 0', color: 'var(--dim)', textAlign: 'center' }}>
      {grande && <GuardianIcon size={48} />}
      <Spinner />
      <div style={{ fontSize: 13.5 }}>{texto}</div>
    </div>
  );
}
function Vacio({ texto }: { texto: string }) {
  return <div style={{ padding: '40px 12px', textAlign: 'center', color: 'var(--faint)', fontSize: 14, lineHeight: 1.5 }}>{texto}</div>;
}
function Spinner() {
  return (
    <>
      <span style={{ width: 26, height: 26, borderRadius: '50%', border: '2.5px solid var(--border-strong)', borderTopColor: 'var(--primary)', display: 'inline-block', animation: 'makoSpin 0.7s linear infinite' }} />
      <style>{'@keyframes makoSpin{to{transform:rotate(360deg)}}'}</style>
    </>
  );
}

const ghostBtn: CSSProperties = { padding: '11px 18px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: SANS };
