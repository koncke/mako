'use client';

// =============================================================================
// ReunionTareas — el reparto: MIS tareas en una tab, las de cada persona en la suya
// =============================================================================
// De una reunión salen compromisos de varios. Antes entraban todos a la misma lista
// (destildados, pero cargables) y las de otro terminaban en tu tablero. Ahora:
//
//   · Tab "Mías"  → lo único que se puede cargar a TU plan (las de otro ni aparecen).
//   · Tab por persona → sus tareas + qué hacer con ellas: bajarlas (.md), MANDÁRSELAS
//     por WhatsApp y mail, y —si tiene cuenta en la app— dejárselas en SU plan para
//     que las confirme ("Martín te envió estas tareas…").
//
// Lo comparten la extracción manual (ReunionExtractModal) y el modal de confirmación
// de un borrador pendiente (TareasRecibidasModal), así el reparto es el mismo venga
// de donde venga.

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { SvcIcon } from '../../_components/ServicioVisual';
import { type Label, type Prio } from './types';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

export type CandidataTarea = {
  titulo: string; detalle: string; prioridad: Prio; proyectoId: string | null;
  dueño?: string; dueñoEmail?: string; esDeOtro?: boolean;
  /** segundo de la grabación donde se dijo — para ir a escuchar ese momento. */
  minuto?: number;
};

/** 4530 → "1:15:30" (o "12:34" si no llega a la hora). */
function relojDe(seg?: number): string {
  if (seg == null || !Number.isFinite(seg) || seg < 0) return '';
  const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = Math.floor(seg % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
/** El link a la grabación PARADO en ese segundo (Fathom acepta ?timestamp=). */
function urlEnMinuto(url?: string | null, seg?: number): string | null {
  if (!url) return null;
  if (seg == null) return url;
  return `${url}${url.includes('?') ? '&' : '?'}timestamp=${seg}`;
}
export type ReunionRefUI = { recordingId?: number; titulo: string; fecha?: string | null; url?: string | null };
// `reunion` viaja EN LA FILA: cuando MaKo dejó varias reuniones esperando, la misma
// pantalla mezcla tareas de todas y cada una tiene que saber de cuál salió (para
// agruparlas, fecharlas y, si son de otra persona, mandárselas con el candado de ESA
// grabación). Si falta, se usa la reunión única que pasa el modal de extracción.
export type FilaTarea = CandidataTarea & { incluir: boolean; enriquece?: { id: string; razon: string }; reunion?: ReunionRefUI };

type Destinatario = {
  email: string; nombre: string; registrado: boolean;
  workspaceId: number | null; telefono: string; puedeCargarPlan: boolean;
};

export const banda = (p: Prio): string => (p === 'alta' ? '#D0504A' : p === 'media' ? '#C8870C' : p === 'baja' ? '#1E9E57' : '#98A0AC');

const KEY_SIN_DUEÑO = '__otros__';
/**
 * Identidad de la persona para agrupar. Si hay email, ese manda. Si no, el PRIMER
 * NOMBRE normalizado: el modelo escribe a la misma persona de dos formas según el
 * tramo ("Francisco Di Giorno" y "Francisco Hugo Di Giorno") y con el nombre completo
 * salían dos tabs de una tarea cada una. Juntar de más a dos personas con el mismo
 * primer nombre en una misma reunión es raro; partir a una en dos, pasa siempre.
 */
const personaDe = (f: FilaTarea): string => {
  const email = (f.dueñoEmail || '').trim().toLowerCase();
  if (email) return email;
  const nombre = (f.dueño || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  return nombre ? nombre.split(/\s+/)[0] : KEY_SIN_DUEÑO;
};
// La tab es de PERSONA × REUNIÓN, no solo de persona: los botones "Enviar" y "Cargar
// en el plan de X" validan contra los participantes de UNA grabación, así que mezclar
// dos reuniones en la misma tab mandaría tareas bajo la reunión equivocada.
const claveDe = (f: FilaTarea, rid?: number): string => `${rid ?? f.reunion?.recordingId ?? 0}|${personaDe(f)}`;

/** Versión corta para la tab: "28 jul 22:58". Con dos reuniones el MISMO día, poner
 *  solo la fecha deja dos tabs con el mismo nombre — la hora es lo que las distingue. */
function cuandoCorto(iso?: string | null): string {
  const largo = cuandoFue(iso);
  return largo ? largo.replace(/^\S+\s/, '').replace(' · ', ' ') : '';
}

/** "mié 28 jul · 15:30" en la zona del que mira (su navegador, que es la correcta acá). */
function cuandoFue(iso?: string | null): string {
  if (!iso) return '';
  try {
    const p = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso));
    const g = (t: string) => p.find((x) => x.type === t)?.value ?? '';
    if (!g('day')) return '';
    return `${g('weekday').replace('.', '')} ${g('day')} ${g('month').replace('.', '')} · ${g('hour')}:${g('minute')}`;
  } catch { return ''; }
}

async function apiReunion(body: Record<string, unknown>): Promise<Record<string, unknown> & { ok: boolean; error?: string }> {
  return fetch('/api/plan-reunion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
}

function descargarMd(nombre: string, filas: FilaTarea[], reunion: ReunionRefUI) {
  const md = [
    `# Tareas de la reunión${reunion.titulo ? ` — ${reunion.titulo}` : ''}`,
    nombre ? `\nPara: **${nombre}**` : '',
    '',
    ...filas.map((f) => `- [ ] **${f.titulo}**${f.detalle ? `\n  ${f.detalle}` : ''}`),
  ].filter((l) => l !== '').join('\n');
  const blob = new Blob([md], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tareas-${(nombre || 'reunion').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function ReunionTareas({ filas, labels, reunion, onFila, cabecera }: {
  filas: FilaTarea[];
  labels: Label[];
  /** reunión por defecto, para cuando las filas no traen la suya (extracción manual). */
  reunion: ReunionRefUI;
  onFila: (i: number, patch: Partial<FilaTarea>) => void;
  /** texto que va arriba de la lista de MIS tareas. */
  cabecera?: string;
}) {
  // Índices originales, para que el patch vuelva a la fila correcta del padre.
  const conIdx = useMemo(() => filas.map((f, i) => ({ f, i, r: f.reunion ?? reunion })), [filas, reunion]);
  const mias = useMemo(() => conIdx.filter((x) => !x.f.esDeOtro), [conIdx]);
  // MIS tareas agrupadas por reunión (con varias esperando, saber de cuál salió cada
  // una es la mitad del sentido de la pantalla).
  const miasPorReunion = useMemo(() => {
    const m = new Map<string, { r: ReunionRefUI; items: typeof mias }>();
    for (const x of mias) {
      const k = String(x.r.recordingId ?? x.r.titulo ?? '');
      const prev = m.get(k);
      if (prev) prev.items.push(x); else m.set(k, { r: x.r, items: [x] });
    }
    return [...m.values()];
  }, [mias]);
  const grupos = useMemo(() => {
    const m = new Map<string, { clave: string; nombre: string; email: string; r: ReunionRefUI; items: Array<{ f: FilaTarea; i: number }> }>();
    for (const x of conIdx) {
      if (!x.f.esDeOtro) continue;
      const clave = claveDe(x.f, x.r.recordingId);
      const prev = m.get(clave);
      if (prev) prev.items.push(x);
      else m.set(clave, { clave, nombre: (x.f.dueño || '').trim() || (x.f.dueñoEmail || '').trim() || 'Otra persona', email: (x.f.dueñoEmail || '').trim().toLowerCase(), r: x.r, items: [x] });
    }
    return [...m.values()];
  }, [conIdx]);

  // La tab elegida se DERIVA, no se sincroniza por efecto: si el grupo activo
  // desaparece (se re-extrajo la reunión), cae sola a "Mías" sin un render de más.
  // ¿La pantalla mezcla más de una reunión? Define si hace falta fechar cada bloque.
  const variasReuniones = useMemo(
    () => new Set(conIdx.map((x) => String(x.r.recordingId ?? x.r.titulo ?? ''))).size > 1,
    [conIdx],
  );

  const [tabSel, setTab] = useState<string>('mias');
  const activo = tabSel === 'mias' ? null : grupos.find((g) => g.clave === tabSel) ?? null;
  const tab = tabSel === 'mias' || activo ? tabSel : 'mias';

  // Quién es cada uno en la app (para saber si podemos mandarle o cargarle el plan).
  // Indexado por REUNIÓN: los participantes se validan por grabación, así que cada una
  // trae su propio mapa. Se piden solo cuando hay tareas de otros.
  const ridsConOtros = useMemo(() => [...new Set(grupos.map((g) => g.r.recordingId).filter((x): x is number => !!x))].join(','), [grupos]);
  const [dests, setDests] = useState<Record<number, Record<string, Destinatario>>>({});
  const [destsListos, setDestsListos] = useState(false);
  useEffect(() => {
    if (!ridsConOtros) return;
    const rids = ridsConOtros.split(',').map(Number);
    let vivo = true;
    void Promise.all(rids.map(async (rid) => {
      const j = await apiReunion({ action: 'destinatarios', recordingId: rid });
      const arr = (j.ok && Array.isArray(j.destinatarios) ? j.destinatarios : []) as Destinatario[];
      return [rid, Object.fromEntries(arr.map((d) => [d.email, d]))] as const;
    })).then((pares) => { if (vivo) { setDests(Object.fromEntries(pares)); setDestsListos(true); } });
    return () => { vivo = false; };
  }, [ridsConOtros]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* tabs: Mías + una por persona con tareas */}
      {grupos.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
          <TabBtn activo={tab === 'mias'} onClick={() => setTab('mias')} label={`Mías`} n={mias.length} />
          {grupos.map((g) => (
            // Con varias reuniones la misma persona aparece una vez por reunión: se
            // aclara con la fecha para poder distinguirlas de un vistazo.
            <TabBtn key={g.clave} activo={tab === g.clave} onClick={() => setTab(g.clave)}
              label={(g.nombre.split(' ')[0] || 'Otros') + (variasReuniones && cuandoCorto(g.r.fecha) ? ` · ${cuandoCorto(g.r.fecha)}` : '')}
              n={g.items.length} />
          ))}
        </div>
      )}

      {tab === 'mias' ? (
        <>
          {cabecera && <div style={{ fontSize: 13, color: 'var(--dim)' }}>{cabecera}</div>}
          {mias.length === 0
            ? <div style={{ padding: '26px 12px', textAlign: 'center', color: 'var(--faint)', fontSize: 13.5, lineHeight: 1.5 }}>
                De {miasPorReunion.length > 1 ? 'estas reuniones' : 'esta reunión'} no salió ninguna tarea tuya: todas quedaron del lado de las otras personas.
              </div>
            : miasPorReunion.map((g, gi) => (
                <div key={gi} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Encabezado por reunión: solo si hay más de una en la pantalla. */}
                  {variasReuniones && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginTop: gi ? 6 : 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{g.r.titulo || 'Reunión'}</span>
                      {cuandoFue(g.r.fecha) && <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)' }}>{cuandoFue(g.r.fecha)}</span>}
                      <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)' }}>· {g.items.length}</span>
                      <LinkGrabacion url={g.r.url} />
                    </div>
                  )}
                  {g.items.map(({ f, i }) => (
                    <FilaCandidata key={i} f={f} onFila={(p) => onFila(i, p)} url={g.r.url} />
                  ))}
                </div>
              ))}
        </>
      ) : activo ? (
        <PanelPersona
          key={activo.clave}
          nombre={activo.nombre}
          dest={activo.email ? dests[activo.r.recordingId ?? 0]?.[activo.email] : undefined}
          cargandoDest={!!activo.email && !destsListos && !!activo.r.recordingId}
          items={activo.items}
          labels={labels}
          reunion={activo.r}
          onFila={onFila}
        />
      ) : null}
    </div>
  );
}

/** Link a la grabación de ESA reunión (el de cada bloque, no uno global). */
function LinkGrabacion({ url }: { url?: string | null }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: 'var(--primary)', textDecoration: 'none' }}>
      <SvcIcon k="fathom" size={11} box={16} radius={4} /> ver la grabación
    </a>
  );
}

function TabBtn({ activo, onClick, label, n }: { activo: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: SANS, fontSize: 13, fontWeight: activo ? 700 : 500, border: `1px solid ${activo ? 'var(--primary)' : 'var(--border-strong)'}`, background: activo ? 'var(--primary-bg)' : 'var(--surface)', color: activo ? 'var(--primary)' : 'var(--dim)' }}>
      {label}
      <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, opacity: 0.75 }}>{n}</span>
    </button>
  );
}

/**
 * Una tarea MÍA: se tilda/destilda y se le puede corregir el contexto.
 *
 * NO tiene prioridad ni selector de proyecto a propósito: las dos cosas las decide el
 * Perro cuando entran (mostrarlas acá era pedirle al usuario que adivine algo que la
 * app va a pisar dos segundos después). Lo que sí necesita mano humana es el DETALLE:
 * la IA escucha mal un número y queda escrito ("el grupal de $497" cuando son $1500).
 */
function FilaCandidata({ f, onFila, url }: { f: FilaTarea; onFila: (p: Partial<FilaTarea>) => void; url?: string | null }) {
  const [editando, setEditando] = useState(false);
  const link = urlEnMinuto(url, f.minuto);
  const reloj = relojDe(f.minuto);
  return (
    <div style={{ display: 'flex', gap: 11, padding: '12px 13px', borderRadius: 12, border: `1px solid ${f.incluir ? 'var(--primary)' : 'var(--border)'}`, background: f.incluir ? 'var(--primary-bg)' : 'var(--surface-2)', opacity: f.incluir ? 1 : 0.6 }}>
      <button type="button" onClick={() => onFila({ incluir: !f.incluir })} aria-label="Incluir"
        style={{ width: 20, height: 20, flex: 'none', marginTop: 1, borderRadius: 6, border: `1.5px solid ${f.incluir ? 'var(--primary)' : 'var(--border-strong)'}`, background: f.incluir ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{f.incluir ? '✓' : ''}</button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>{f.titulo}</div>
        {editando
          ? <textarea autoFocus value={f.detalle} onChange={(e) => onFila({ detalle: e.target.value })} onBlur={() => setEditando(false)} rows={4}
              style={{ width: '100%', marginTop: 5, padding: '8px 10px', borderRadius: 9, border: '1px solid var(--primary)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 12.5, lineHeight: 1.5, outline: 'none', fontFamily: SANS, resize: 'vertical' }} />
          : f.detalle && <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 3, lineHeight: 1.5 }}>{f.detalle}</div>}
        {f.enriquece && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            <span title={f.enriquece.razon} style={{ fontSize: 11, fontWeight: 700, color: 'var(--warn)', background: 'var(--warn-bg, var(--surface))', border: '1px solid var(--warn)', borderRadius: 6, padding: '2px 7px' }}>⚠ ya existe en el plan · {f.enriquece.razon.slice(0, 50)}</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 7, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setEditando((v) => !v)}
            style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: editando ? 'var(--primary)' : 'var(--faint)' }}>
            {editando ? '✓ listo' : '✎ corregir contexto'}
          </button>
          {/* La transcripción de Fathom etiqueta MAL a quien habla (mezcla dos voces en
              un bloque), así que la atribución falla y no hay prompt que lo arregle:
              MaKo le está siendo fiel a una fuente equivocada. Que se corrija en un click. */}
          <button type="button" onClick={() => onFila({ esDeOtro: true, incluir: false })}
            title="Sacarla de tu plan y mandarla a la tab de la otra persona"
            style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: 'var(--faint)' }}>
            ↪ no es mía
          </button>
          {/* El minuto exacto: se dijo acá, andá a escucharlo. */}
          {reloj && (link
            ? <a href={link} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: 'var(--primary)', textDecoration: 'none' }}>▶ {reloj}</a>
            : <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)' }}>▶ {reloj}</span>)}
        </div>
      </div>
    </div>
  );
}

/** Tab de una persona: sus tareas (solo lectura) + qué hacer con ellas. */
function PanelPersona({ nombre, dest, cargandoDest, items, labels, reunion, onFila }: {
  nombre: string; dest?: Destinatario; cargandoDest: boolean;
  items: Array<{ f: FilaTarea; i: number }>; labels: Label[]; reunion: ReunionRefUI;
  onFila: (i: number, patch: Partial<FilaTarea>) => void;
}) {
  const filas = items.map((x) => x.f);
  const [abrirEnvio, setAbrirEnvio] = useState(false);
  const [wa, setWa] = useState(true);
  const [mail, setMail] = useState(true);
  // El número que tenemos guardado se puede pisar a mano (null = todavía no lo tocó).
  const [telManual, setTelManual] = useState<string | null>(null);
  const telefono = telManual ?? dest?.telefono ?? '';
  const [enviando, setEnviando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [nota, setNota] = useState('');
  const [err, setErr] = useState('');
  const [linkPlan, setLinkPlan] = useState('');

  const proyectoNombre = (id: string | null) => labels.find((l) => l.id === id)?.name;
  const payload = filas.map((f) => ({ titulo: f.titulo, detalle: f.detalle, prioridad: f.prioridad, proyecto: proyectoNombre(f.proyectoId) }));
  const puedeMandar = !!dest && !!reunion.recordingId;

  const enviar = async () => {
    setEnviando(true); setErr(''); setNota('');
    const j = await apiReunion({
      action: 'enviar', recordingId: reunion.recordingId, email: dest!.email, tareas: payload,
      reunion: { titulo: reunion.titulo, fecha: reunion.fecha, url: reunion.url },
      canales: { wa, email: mail }, telefono: telefono || undefined, link: linkPlan || undefined,
    });
    setEnviando(false);
    const detalleWa = (j.wa as { ok: boolean; error?: string } | undefined);
    const detalleMail = (j.email as { ok: boolean; error?: string } | undefined);
    if (j.ok) {
      setAbrirEnvio(false);
      setNota(`Le mandé sus tareas a ${nombre}${wa && mail ? ' por WhatsApp y mail' : wa ? ' por WhatsApp' : ' por mail'}.`);
    } else {
      setErr(j.error || [detalleWa?.ok === false ? `WhatsApp: ${detalleWa.error}` : '', detalleMail?.ok === false ? `Mail: ${detalleMail.error}` : ''].filter(Boolean).join(' · ') || 'No pude mandárselas.');
    }
  };

  const cargarEnSuPlan = async () => {
    setCargando(true); setErr(''); setNota('');
    const j = await apiReunion({
      action: 'cargar', recordingId: reunion.recordingId, email: dest!.email, tareas: payload,
      reunion: { titulo: reunion.titulo, fecha: reunion.fecha, url: reunion.url },
    });
    setCargando(false);
    if (j.ok) {
      setLinkPlan(String(j.link ?? ''));
      setNota(`Listo: ${nombre} va a ver estas tareas la próxima vez que entre a su plan.`);
    } else setErr(String(j.error ?? 'No pude cargárselas.'));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>
        Esto quedó del lado de <b style={{ color: 'var(--ink)' }}>{nombre}</b>{dest?.email ? ` (${dest.email})` : ''}
        {reunion.titulo ? <> en <b style={{ color: 'var(--ink)' }}>{reunion.titulo}</b></> : null}
        {cuandoFue(reunion.fecha) ? <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)' }}> ({cuandoFue(reunion.fecha)})</span> : null}
        . No entra a tu plan: mandáselo. <LinkGrabacion url={reunion.url} />
      </div>

      {items.map(({ f, i: idx }, i) => (
        <div key={i} style={{ display: 'flex', gap: 11, padding: '12px 13px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <span style={{ flex: 'none', marginTop: 2, fontSize: 13, color: 'var(--faint)', fontFamily: MONO }}>{i + 1}.</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>{f.titulo}</div>
            {f.detalle && <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 3, lineHeight: 1.5 }}>{f.detalle}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 5, flexWrap: 'wrap' }}>
              {relojDe(f.minuto) && (
                <a href={urlEnMinuto(reunion.url, f.minuto) ?? '#'} target="_blank" rel="noreferrer"
                  style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: 'var(--primary)', textDecoration: 'none' }}>▶ {relojDe(f.minuto)}</a>
              )}
              {/* Si la transcripción se equivocó de hablante, devolvela a tu plan. */}
              <button type="button" onClick={() => onFila(idx, { esDeOtro: false, incluir: true })}
                title="Es tuya: pasala a la tab Mías"
                style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: 'var(--faint)' }}>
                ↩ en realidad es mía
              </button>
            </div>
          </div>
        </div>
      ))}

      {nota && <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--good)', background: 'var(--surface-2)', border: '1px solid var(--good)', borderRadius: 9, padding: '9px 12px' }}>✓ {nota}</div>}
      {err && <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--bad)' }}>{err}</div>}

      {/* confirmación de envío: se ve EXACTAMENTE a dónde va antes de mandar */}
      {abrirEnvio && dest && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '12px 13px', borderRadius: 12, border: '1px solid var(--primary-weak)', background: 'var(--primary-bg)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>¿Se las mando a {nombre}?</div>
          <Check on={mail} set={setMail} label={`Mail a ${dest.email}`} />
          <Check on={wa} set={setWa} label="WhatsApp" />
          {wa && (
            <input value={telefono} onChange={(e) => setTelManual(e.target.value)} placeholder="Número con código de país (ej. 5215512345678)"
              style={{ padding: '8px 11px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, outline: 'none', fontFamily: SANS }} />
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setAbrirEnvio(false)} style={ghost}>Cancelar</button>
            <button type="button" onClick={() => void enviar()} disabled={enviando || (!wa && !mail) || (wa && !telefono.trim())}
              style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: enviando ? 'default' : 'pointer', opacity: enviando || (!wa && !mail) || (wa && !telefono.trim()) ? 0.55 : 1, fontFamily: SANS }}>
              {enviando ? 'Mandando…' : 'Mandar'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 2 }}>
        <button type="button" onClick={() => descargarMd(nombre, filas, reunion)} style={ghost}>⬇ Descargar (.md)</button>
        <button type="button" onClick={() => { setAbrirEnvio(true); setErr(''); setNota(''); }} disabled={!puedeMandar || abrirEnvio}
          title={puedeMandar ? 'Mandarle sus tareas por WhatsApp y mail' : 'No tengo el mail de esta persona en la reunión'}
          style={{ ...ghost, opacity: puedeMandar && !abrirEnvio ? 1 : 0.5, cursor: puedeMandar && !abrirEnvio ? 'pointer' : 'default' }}>
          ✉ Enviar
        </button>
        {cargandoDest && <span style={{ fontSize: 12, color: 'var(--faint)', alignSelf: 'center' }}>Buscando su cuenta…</span>}
        {dest?.puedeCargarPlan && (
          <button type="button" onClick={() => void cargarEnSuPlan()} disabled={cargando || !!linkPlan}
            title={`Le dejo estas tareas en su plan para que las confirme`}
            style={{ padding: '11px 18px', borderRadius: 11, border: 'none', background: linkPlan ? 'var(--border)' : 'var(--ink)', color: linkPlan ? 'var(--faint)' : 'var(--surface)', fontSize: 13.5, fontWeight: 700, cursor: cargando || linkPlan ? 'default' : 'pointer', fontFamily: SANS }}>
            {cargando ? 'Cargando…' : linkPlan ? '✓ En su plan' : `Cargar en el plan de ${nombre.split(' ')[0]}`}
          </button>
        )}
      </div>
    </div>
  );
}

function Check({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink)', cursor: 'pointer' }}>
      <button type="button" role="checkbox" aria-checked={on} onClick={() => set(!on)}
        style={{ width: 18, height: 18, flex: 'none', borderRadius: 5, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on ? '✓' : ''}</button>
      {label}
    </label>
  );
}

const ghost: CSSProperties = { padding: '11px 18px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: SANS };
