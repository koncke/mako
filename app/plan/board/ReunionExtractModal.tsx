'use client';

// ReunionExtractModal — G3: MaKo lee una reunión de Fathom y saca los action items
// del equipo como tarjetas del plan. Dos fases: elegir la reunión → revisar los
// candidatos (incluir/excluir + reasignar proyecto) → agregar al plan. El perro
// guardián los re-puntúa solo cuando entran (cambia la firma del plan).
//
// Lo que sale de acá al plan es SIEMPRE tuyo: las tareas de otras personas viven en
// su propia tab (ReunionTareas) y se les mandan a ellas — no se pueden tildar.

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { GuardianIcon } from './GuardianIcon';
import { SvcIcon } from '../../_components/ServicioVisual';
import { ReunionTareas, type CandidataTarea, type FilaTarea } from './ReunionTareas';
import { type Label, type Fuente } from './types';
import { TIPO_REUNION_UI, type TipoReunion } from '@/lib/reunion-clasificar';
import { frenoDeScope, type FrenoScope } from '@/lib/reunion-gate';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

type Participante = { nombre: string; email: string };
type ReunionMeta = { recordingId: number; titulo: string; fecha: string | null; durMin: number | null; url: string | null; involucrados: string[]; tipo: TipoReunion; participantes?: Participante[] };
type Candidata = CandidataTarea;
type Existente = { id: string; titulo: string; detalle: string };
type Duda = { termino: string; porque: string };
// enriquece = ya existe en el plan; el Perro sugiere sumarle a esa tarjeta en vez de duplicar.
type Fila = FilaTarea;

/** Lo que YA salió de una reunión (borrador pendiente o ya aplicado). */
export type ResumenBorrador = { id: string; estado: 'pendiente' | 'aplicada' | 'descartada'; creadas: number; pendientesMias: number; pendientesOtros: number };

async function apiFathom(body: Record<string, unknown>): Promise<{ ok: boolean; reuniones?: ReunionMeta[]; nextCursor?: string | null; borradores?: Record<string, ResumenBorrador>; tareas?: Candidata[]; dudas?: Duda[]; cruces?: Array<{ i: number; idExistente: string | null; razon: string }>; usage?: unknown; error?: string }> {
  return fetch('/api/plan-fathom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
}

function fmtFecha(iso: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return ''; }
}

export function ReunionExtractModal({ labels, existentes, archivoInicial, onCrear, onUsage, onClose, onAbrirBorrador, recibidos, onAbrirRecibido }: {
  labels: Label[];
  existentes: Existente[];               // tareas abiertas del plan, para el dedup del Perro (punto 8)
  archivoInicial?: File | null;          // si entró por el botón "subir archivo" del toolbar (punto 7)
  onCrear: (cands: Candidata[], fuente?: Fuente) => void;
  onUsage?: (u: unknown) => void;
  onClose: () => void;
  /** entrar a una reunión que YA fue leída: se muestra lo que salió, no se re-analiza. */
  onAbrirBorrador?: (recordingId: number) => void;
  /**
   * Borradores que NO salieron de una reunión tuya: te los mandó otra persona desde la
   * suya. No aparecen en la lista de Fathom (esa grabación no es de tu cuenta), así que
   * sin esta sección quedarían sin ninguna puerta desde que el modal dejó de abrirse
   * solo. Van arriba de todo, que es donde se buscan.
   */
  recibidos?: Array<{ id: string; de: string; titulo: string; n: number }>;
  onAbrirRecibido?: (id: string) => void;
}) {
  const [fase, setFase] = useState<'lista' | 'extrayendo' | 'validar' | 'revisar'>('lista');
  const [reuniones, setReuniones] = useState<ReunionMeta[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);   // nextCursor de Fathom
  const [cargandoMas, setCargandoMas] = useState(false);
  // Qué salió ya de cada reunión, por recordingId. Lo manda el server con la lista, así
  // que no cuesta un round-trip: es lo que convierte "Extraer →" en "Ver lo que sacó →".
  const [borradores, setBorradores] = useState<Record<number, ResumenBorrador>>({});
  const [q, setQ] = useState('');                              // búsqueda por título/email
  const [desde, setDesde] = useState('');                      // filtro por fecha (YYYY-MM-DD)
  const [elegida, setElegida] = useState<ReunionMeta | null>(null);
  const [archivoNombre, setArchivoNombre] = useState(''); // nombre del archivo subido (para la fuente)
  const [filas, setFilas] = useState<Fila[]>([]);
  const [dudas, setDudas] = useState<Duda[]>([]);              // términos a aclarar (paso previo, punto 7)
  const [defs, setDefs] = useState<Record<number, string>>({}); // definiciones que va escribiendo el usuario
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
      const porId: Record<number, ResumenBorrador> = {};
      for (const [ref, v] of Object.entries(j.borradores ?? {})) {
        const n = Number(ref.replace('fathom:', ''));
        if (Number.isFinite(n)) porId[n] = v;
      }
      setBorradores((prev) => (reset ? porId : { ...prev, ...porId }));
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

  // Anota las candidatas: reparto mío/de-otro (viene del backend), y el cruce del
  // Perro contra el plan (dedup, punto 8). Las de otro NO se tildan nunca: van a la
  // tab de esa persona y se le mandan a ella.
  const procesar = async (tareas: Candidata[], dudasIn: Duda[]) => {
    const filasNuevas: Fila[] = tareas.map((t) => ({ ...t, incluir: !t.esDeOtro }));
    // Dedup contra el plan (best-effort: apiFathom nunca lanza; si el server falla, ok:false).
    const jc = await apiFathom({ action: 'cruzar', candidatas: tareas.map((t) => ({ titulo: t.titulo, detalle: t.detalle })), existentes, uso: 'Cruzar con el plan' });
    if (jc.ok && Array.isArray(jc.cruces)) {
      for (const c of jc.cruces) if (filasNuevas[c.i]) filasNuevas[c.i] = { ...filasNuevas[c.i], enriquece: { id: c.idExistente!, razon: c.razon }, incluir: false };
    }
    // Paso previo (punto 7): si MaKo no entendió algún término, que el usuario lo aclare
    // ANTES de revisar.
    if (dudasIn.length > 0) { setFilas(filasNuevas); setDudas(dudasIn); setDefs({}); setFase('validar'); return; }
    setFilas(filasNuevas); setFase('revisar');
  };

  const extraer = async (r: ReunionMeta, reanalizar = false) => {
    setElegida(r); setFase('extrayendo'); setErr(''); setFreno(frenoDeScope(r.tipo));
    const proyectos = labels.map((l) => ({ id: l.id, emoji: l.emoji, nombre: l.name }));
    // reanalizar: fuerza correr la IA de nuevo (ignora el cache). Sin esto, re-abrir la
    // misma reunión devuelve lo cacheado — NO cobra tokens (feedback jul-19).
    const j = await apiFathom({ action: 'extraer', recordingId: r.recordingId, proyectos, uso: 'Extraer tareas de reunión', reanalizar });
    if (j.usage) onUsage?.(j.usage);
    if (j.ok && j.tareas) await procesar(j.tareas, j.dudas ?? []);
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
    if (j.ok && j.tareas) await procesar(j.tareas, j.dudas ?? []);
    // Falló el archivo: mostramos el error y volvemos a la lista (que se carga sola,
    // porque el modo-archivo la había salteado) para que el usuario no quede colgado.
    else { setErr(j.error || 'No pude leer el archivo.'); volverALista(); }
  };

  // Mount: si entró por "subir archivo", procesarlo directo.
  useEffect(() => {
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

  // Solo MIS tareas tildadas: una tarea de otra persona jamás entra a mi plan.
  const nIncluidas = useMemo(() => filas.filter((f) => f.incluir && !f.esDeOtro).length, [filas]);
  const hayMias = useMemo(() => filas.some((f) => !f.esDeOtro), [filas]);

  const confirmar = () => {
    // fuente: la reunión de Fathom (con link) o el archivo subido (feedback jul-19).
    const fuente: Fuente | undefined = elegida ? { tipo: 'fathom', etiqueta: elegida.titulo, url: elegida.url ?? undefined }
      : archivoNombre ? { tipo: 'archivo', etiqueta: archivoNombre }
        : undefined;
    onCrear(filas.filter((f) => f.incluir && !f.esDeOtro).map(({ incluir: _i, enriquece: _e, ...c }) => c), fuente);
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

              {!!recibidos?.length && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 700 }}>Te mandaron tareas</div>
                  {recibidos.map((r) => (
                    <button key={r.id} type="button" onClick={() => onAbrirRecibido?.(r.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--primary)', background: 'var(--primary-bg)', color: 'var(--ink)', cursor: 'pointer', fontFamily: SANS }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.titulo}</span>
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>{r.de ? `Te las mandó ${r.de}` : 'Para confirmar'}</span>
                      </span>
                      <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, color: '#fff', background: 'var(--primary)', fontFamily: MONO }}>{r.n} esperando</span>
                      <span style={{ flex: 'none', fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>Confirmar →</span>
                    </button>
                  ))}
                </div>
              )}

              {reuniones == null
                ? <Cargando texto="Buscando tus reuniones en Fathom…" />
                : visibles.length === 0
                  ? <Vacio texto={q || desde ? 'Ninguna reunión coincide con el filtro.' : 'No encontré reuniones recientes en Fathom.'} />
                  : <>
                      {visibles.map((r) => {
                        const t = TIPO_REUNION_UI[r.tipo];
                        // Reunión ya leída: NO se vuelve a extraer (sería pagar de nuevo por
                        // lo mismo). Se entra a ver lo que salió: las tarjetas que ya están
                        // en el plan y lo que quedó del lado de otras personas.
                        const b = borradores[r.recordingId];
                        const yaLeida = !!b && !!onAbrirBorrador;
                        const quedan = b ? b.pendientesMias + b.pendientesOtros : 0;
                        return (
                          <button key={r.recordingId} type="button" onClick={() => (yaLeida ? onAbrirBorrador!(r.recordingId) : extraer(r))}
                            style={{ display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left', width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer', fontFamily: SANS }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}>
                            {/* logo de Fathom (punto 6): son grabaciones de Fathom, no un micrófono genérico */}
                            <span style={{ flex: 'none', marginTop: 1 }}><SvcIcon k="fathom" size={17} box={28} radius={8} /></span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.titulo}</span>
                                {/* CUÁNTAS esperan, en número y a la vista. El botón de
                                    Fathom ya no te encierra en el borrador pendiente, así
                                    que la lista tiene que decir de un vistazo cuál es la
                                    reunión que te está esperando y con cuántas. */}
                                {quedan > 0 && (
                                  <span title={`${b!.pendientesMias} tuya${b!.pendientesMias === 1 ? '' : 's'} sin confirmar${b!.pendientesOtros ? ` · ${b!.pendientesOtros} de otras personas para repartir` : ''}`}
                                    style={{ flex: 'none', fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, color: '#fff', background: b!.pendientesMias > 0 ? 'var(--primary)' : 'var(--dim)', fontFamily: MONO }}>
                                    {quedan} esperando
                                  </span>
                                )}
                                <span title={`Clasificada como ${t.label} por los emails de los invitados`} style={{ flex: 'none', fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: `var(--${t.tono})`, background: `var(--${t.tono}-bg, var(--surface-2))`, border: `1px solid var(--${t.tono})` }}>{t.label}</span>
                              </span>
                              <span style={{ display: 'block', fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>{fmtFecha(r.fecha)}{r.durMin ? ` · ${r.durMin} min` : ''}</span>
                              {r.involucrados.length > 0 && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--dim)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>👤 {r.involucrados.join(', ')}</span>}
                              {yaLeida && (
                                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--good)', fontWeight: 600, marginTop: 3 }}>
                                  ✓ {b.creadas > 0 ? `${b.creadas} ${b.creadas === 1 ? 'tarea' : 'tareas'} ya en tu plan` : 'MaKo ya la leyó'}
                                  {b.pendientesMias > 0 && <span style={{ color: 'var(--primary)', fontWeight: 600 }}> · {b.pendientesMias} sin confirmar</span>}
                                  {b.pendientesOtros > 0 && <span style={{ color: 'var(--dim)', fontWeight: 500 }}> · {b.pendientesOtros} para repartir</span>}
                                </span>
                              )}
                            </span>
                            <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600, whiteSpace: 'nowrap', marginTop: 2 }}>{quedan > 0 ? 'Confirmar →' : yaLeida ? 'Ver lo que sacó →' : 'Extraer →'}</span>
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
              ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                  <Vacio texto="MaKo no encontró action items concretos en esta reunión." />
                  {elegida && <button type="button" onClick={() => extraer(elegida, true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--primary-weak)', background: 'var(--primary-bg)', color: 'var(--primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>
                    ↻ Volver a analizar (gasta tokens)</button>}
                </div>
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
                  <ReunionTareas
                    filas={filas}
                    labels={labels}
                    onFila={setFila}
                    reunion={{ recordingId: elegida?.recordingId, titulo: elegida?.titulo ?? archivoNombre, fecha: elegida?.fecha ?? null, url: elegida?.url ?? null }}
                    cabecera="Elegí cuáles agregar a TU plan. El perro les pone la prioridad final."
                  />
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
            {/* Las reuniones nuevas del equipo ya se leen SOLAS (cron): esto es para las
                viejas o para re-analizar. Por eso acá no hay ningún opt-in que activar. */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <button type="button" onClick={volverALista} style={ghostBtn}>← Otra reunión</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Si NADA de la reunión es tuyo, el botón de cargar no tiene sentido:
                    lo único que queda es mandarle a cada uno lo suyo desde su tab. */}
                {hayMias
                  ? <button type="button" onClick={confirmar} disabled={nIncluidas === 0}
                      style={{ padding: '12px 24px', borderRadius: 11, border: 'none', background: nIncluidas ? 'var(--primary)' : 'var(--border)', color: nIncluidas ? '#fff' : 'var(--faint)', fontSize: 14, fontWeight: 700, cursor: nIncluidas ? 'pointer' : 'default', fontFamily: SANS }}>
                      {nIncluidas ? `Agregar ${nIncluidas} al plan →` : 'Elegí al menos una'}
                    </button>
                  : <button type="button" onClick={onClose}
                      style={{ padding: '12px 24px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>
                      Listo
                    </button>}
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
