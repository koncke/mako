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
import { Dropdown } from '../../components/Dropdown';
import { ScoreIcon } from './guardian-form';
import { type Label, type Prio, PLABEL } from './types';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

export type CandidataTarea = {
  titulo: string; detalle: string; prioridad: Prio; proyectoId: string | null;
  dueño?: string; dueñoEmail?: string; esDeOtro?: boolean;
};
export type FilaTarea = CandidataTarea & { incluir: boolean; enriquece?: { id: string; razon: string } };
export type ReunionRefUI = { recordingId?: number; titulo: string; fecha?: string | null; url?: string | null };

type Destinatario = {
  email: string; nombre: string; registrado: boolean;
  workspaceId: number | null; telefono: string; puedeCargarPlan: boolean;
};

export const banda = (p: Prio): string => (p === 'alta' ? '#D0504A' : p === 'media' ? '#C8870C' : p === 'baja' ? '#1E9E57' : '#98A0AC');

const KEY_SIN_DUEÑO = '__otros__';
const claveDe = (f: FilaTarea): string => (f.dueñoEmail || '').trim().toLowerCase() || (f.dueño || '').trim().toLowerCase() || KEY_SIN_DUEÑO;

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
  reunion: ReunionRefUI;
  onFila: (i: number, patch: Partial<FilaTarea>) => void;
  /** texto que va arriba de la lista de MIS tareas. */
  cabecera?: string;
}) {
  // Índices originales, para que el patch vuelva a la fila correcta del padre.
  const conIdx = useMemo(() => filas.map((f, i) => ({ f, i })), [filas]);
  const mias = useMemo(() => conIdx.filter((x) => !x.f.esDeOtro), [conIdx]);
  const grupos = useMemo(() => {
    const m = new Map<string, { clave: string; nombre: string; email: string; items: Array<{ f: FilaTarea; i: number }> }>();
    for (const x of conIdx) {
      if (!x.f.esDeOtro) continue;
      const clave = claveDe(x.f);
      const prev = m.get(clave);
      if (prev) prev.items.push(x);
      else m.set(clave, { clave, nombre: (x.f.dueño || '').trim() || (x.f.dueñoEmail || '').trim() || 'Otra persona', email: (x.f.dueñoEmail || '').trim().toLowerCase(), items: [x] });
    }
    return [...m.values()];
  }, [conIdx]);

  const [tab, setTab] = useState<string>('mias');
  const activo = tab === 'mias' ? null : grupos.find((g) => g.clave === tab) ?? null;
  // Si desaparece el grupo activo (se re-extrajo), volvemos a "Mías".
  useEffect(() => { if (tab !== 'mias' && !grupos.some((g) => g.clave === tab)) setTab('mias'); }, [grupos, tab]);

  // Quién es cada uno en la app (para saber si podemos mandarle o cargarle el plan).
  const [dests, setDests] = useState<Record<string, Destinatario> | null>(null);
  useEffect(() => {
    if (!reunion.recordingId || grupos.length === 0 || dests) return;
    void apiReunion({ action: 'destinatarios', recordingId: reunion.recordingId }).then((j) => {
      const arr = (j.ok && Array.isArray(j.destinatarios) ? j.destinatarios : []) as Destinatario[];
      setDests(Object.fromEntries(arr.map((d) => [d.email, d])));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reunion.recordingId, grupos.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* tabs: Mías + una por persona con tareas */}
      {grupos.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
          <TabBtn activo={tab === 'mias'} onClick={() => setTab('mias')} label={`Mías`} n={mias.length} />
          {grupos.map((g) => (
            <TabBtn key={g.clave} activo={tab === g.clave} onClick={() => setTab(g.clave)} label={g.nombre.split(' ')[0] || 'Otros'} n={g.items.length} />
          ))}
        </div>
      )}

      {tab === 'mias' ? (
        <>
          {cabecera && <div style={{ fontSize: 13, color: 'var(--dim)' }}>{cabecera}</div>}
          {mias.length === 0
            ? <div style={{ padding: '26px 12px', textAlign: 'center', color: 'var(--faint)', fontSize: 13.5, lineHeight: 1.5 }}>
                De esta reunión no salió ninguna tarea tuya: todas quedaron del lado de las otras personas.
              </div>
            : mias.map(({ f, i }) => (
                <FilaCandidata key={i} f={f} labels={labels} onFila={(p) => onFila(i, p)} />
              ))}
        </>
      ) : activo ? (
        <PanelPersona
          key={activo.clave}
          nombre={activo.nombre}
          dest={activo.email ? dests?.[activo.email] : undefined}
          cargandoDest={!!activo.email && dests === null && !!reunion.recordingId}
          filas={activo.items.map((x) => x.f)}
          labels={labels}
          reunion={reunion}
        />
      ) : null}
    </div>
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

/** Una tarea MÍA: se tilda/destilda y se le elige proyecto. */
function FilaCandidata({ f, labels, onFila }: { f: FilaTarea; labels: Label[]; onFila: (p: Partial<FilaTarea>) => void }) {
  return (
    <div style={{ display: 'flex', gap: 11, padding: '12px 13px', borderRadius: 12, border: `1px solid ${f.incluir ? 'var(--primary)' : 'var(--border)'}`, background: f.incluir ? 'var(--primary-bg)' : 'var(--surface-2)', opacity: f.incluir ? 1 : 0.6 }}>
      <button type="button" onClick={() => onFila({ incluir: !f.incluir })} aria-label="Incluir"
        style={{ width: 20, height: 20, flex: 'none', marginTop: 1, borderRadius: 6, border: `1.5px solid ${f.incluir ? 'var(--primary)' : 'var(--border-strong)'}`, background: f.incluir ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{f.incluir ? '✓' : ''}</button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>{f.titulo}</div>
        {f.detalle && <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 3, lineHeight: 1.5 }}>{f.detalle}</div>}
        {f.enriquece && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            <span title={f.enriquece.razon} style={{ fontSize: 11, fontWeight: 700, color: 'var(--warn)', background: 'var(--warn-bg, var(--surface))', border: '1px solid var(--warn)', borderRadius: 6, padding: '2px 7px' }}>⚠ ya existe en el plan · {f.enriquece.razon.slice(0, 50)}</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: banda(f.prioridad), fontFamily: MONO }}><ScoreIcon size={11} color={banda(f.prioridad)} />{PLABEL[f.prioridad]}</span>
          <Dropdown
            value={f.proyectoId ?? ''}
            onChange={(v) => onFila({ proyectoId: v || null })}
            ariaLabel="Proyecto de la tarea"
            buttonStyle={{ padding: '4px 8px', borderRadius: 8, fontSize: 12, fontWeight: 600, maxWidth: 200 }}
            options={[{ value: '', label: 'Sin proyecto' }, ...labels.map((l) => ({ value: l.id, label: `${l.emoji} ${l.name}`, color: l.color }))]}
          />
        </div>
      </div>
    </div>
  );
}

/** Tab de una persona: sus tareas (solo lectura) + qué hacer con ellas. */
function PanelPersona({ nombre, dest, cargandoDest, filas, labels, reunion }: {
  nombre: string; dest?: Destinatario; cargandoDest: boolean;
  filas: FilaTarea[]; labels: Label[]; reunion: ReunionRefUI;
}) {
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
        Esto quedó del lado de <b style={{ color: 'var(--ink)' }}>{nombre}</b>{dest?.email ? ` (${dest.email})` : ''}. No entra a tu plan: mandáselo.
      </div>

      {filas.map((f, i) => (
        <div key={i} style={{ display: 'flex', gap: 11, padding: '12px 13px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <span style={{ flex: 'none', marginTop: 2, fontSize: 13, color: 'var(--faint)', fontFamily: MONO }}>{i + 1}.</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>{f.titulo}</div>
            {f.detalle && <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 3, lineHeight: 1.5 }}>{f.detalle}</div>}
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
