'use client';

// =============================================================================
// TareasRecibidasModal — "confirmá estas tareas" al entrar al plan
// =============================================================================
// Dos cosas caen acá, y las dos SIN crear nada por atrás:
//
//   · MaKo detectó sola reuniones nuevas del equipo en Fathom, sacó los compromisos
//     y los dejó esperando (cron fathom-plan). Entrás al plan y te los muestra.
//   · Otra persona te mandó las tareas que asumiste en la reunión que tuvieron
//     ("Martín te envió estas tareas…").
//
// TODAS JUNTAS, no de a una: si MaKo leyó tres reuniones, el WhatsApp avisa una vez
// y acá se ven las tres en la misma pantalla (agrupadas por reunión, con su fecha).
// Antes se mostraba solo la primera y los números no cerraban con el mensaje.
//
// Confirmás lo que va (y sacás lo que no) y recién ahí se crean, con el Perro
// puntuándolas server-side —una sola pasada sobre todo el lote— igual que cualquier
// otra tarea. "Ahora no" cierra sin descartar: siguen esperándote.

import { useEffect, useState } from 'react';
import { GuardianIcon } from './GuardianIcon';
import { SvcIcon } from '../../_components/ServicioVisual';
import { ReunionTareas, type FilaTarea } from './ReunionTareas';
import { type Label, type Prio } from './types';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

type PropTarea = { titulo: string; proyecto?: string; deadline?: string; detalle?: string; prioridad?: Prio; dueno?: string; duenoEmail?: string; esDeOtro?: boolean; minuto?: number; minutos?: number[] };
type PropPregunta = { pregunta: string; tipo?: string; opciones?: string[] };
export type PropuestaPendiente = {
  id: string; resumen: string; origen?: string; tareas: PropTarea[]; createdAt: string;
  enviadoPor?: string; fuenteTitulo?: string; fuenteUrl?: string; fuenteFecha?: string; ref?: string;
  /** si trae preguntas, se confirma en el wizard /plan/revisar, no acá. */
  preguntas?: PropPregunta[];
};

async function api(body: Record<string, unknown>): Promise<Record<string, unknown> & { ok: boolean; error?: string }> {
  return fetch('/api/plan-propuesta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
}

/** El recordingId que dejó el cron en `ref` (fathom:12345) — habilita mandarle a otros. */
const recordingDeRef = (ref?: string): number | undefined => {
  const n = Number((ref ?? '').startsWith('fathom:') ? ref!.slice(7) : NaN);
  return Number.isFinite(n) ? n : undefined;
};

/** Fila con la marca de a qué borrador pertenece, para aplicar cada uno por separado. */
type FilaConProp = FilaTarea & { propId: string };

export function TareasRecibidasModal({ props: todos, labels, onListo, onClose, onDescartadas }: {
  props: PropuestaPendiente[];
  labels: Label[];
  /** se aplicó: el board recarga para mostrar las tareas nuevas ya puntuadas. */
  onListo: () => void;
  /** cerrar SIN decidir: los borradores siguen esperando (se reabren desde Fathom). */
  onClose: () => void;
  /** se descartaron de verdad: ya no hay nada pendiente. */
  onDescartadas: () => void;
}) {
  // Los borradores de REUNIÓN traen sus preguntas cerradas y se responden acá, en el
  // paso previo a cargar. Los de WhatsApp (que además proponen bajas) siguen yendo al
  // wizard de /plan/revisar, que es donde se resuelven de a una.
  const props = todos.filter((p) => p.origen === 'fathom' || !p.preguntas?.length);
  const conPreguntas = todos.filter((p) => p.origen !== 'fathom' && !!p.preguntas?.length);
  // Las preguntas de los borradores que SÍ se confirman acá.
  const preguntas = props.flatMap((p) => (p.preguntas ?? []).map((q) => ({ ...q, propId: p.id })));
  const [paso, setPaso] = useState<'tareas' | 'preguntas'>('tareas');
  const [respuestas, setRespuestas] = useState<Record<number, string>>({});
  // Init perezoso (el padre monta con una key que depende de los ids: si cambian, es
  // un componente nuevo y no hace falta re-sincronizar por efecto).
  const [filas, setFilas] = useState<FilaConProp[]>(() => {
    const idPorNombre = new Map(labels.map((l) => [l.name.trim().toLowerCase(), l.id]));
    return props.flatMap((p) => p.tareas.map((t) => ({
      propId: p.id,
      titulo: t.titulo, detalle: t.detalle ?? '', prioridad: (t.prioridad ?? 'media') as Prio,
      proyectoId: t.proyecto ? idPorNombre.get(t.proyecto.trim().toLowerCase()) ?? null : null,
      dueño: t.dueno, dueñoEmail: t.duenoEmail, esDeOtro: t.esDeOtro, minuto: t.minuto, minutos: t.minutos,
      incluir: !t.esDeOtro,
      // La fecha de la REUNIÓN. Si el borrador no la trae (lo dejó una versión vieja
      // del cron), va SIN fecha: caer a createdAt mostraba la hora a la que corrió el
      // cron como si fuera la hora de la reunión — "tuviste una reunión hoy" cuando la
      // reunión había sido tres semanas antes.
      reunion: { recordingId: recordingDeRef(p.ref), titulo: p.fuenteTitulo ?? '', fecha: p.fuenteFecha ?? null, url: p.fuenteUrl ?? null },
    })));
  });

  const [guardando, setGuardando] = useState<'' | 'aplicar' | 'descartar'>('');
  const [err, setErr] = useState('');
  const nombreProyecto = (id: string | null) => labels.find((l) => l.id === id)?.name;
  const nIncluidas = filas.filter((f) => f.incluir && !f.esDeOtro).length;
  const hayMias = filas.some((f) => !f.esDeOtro);
  const nOtras = filas.filter((f) => f.esDeOtro).length;

  // Mientras se aplica NO se puede cerrar ni salir: son N tareas creadas + el Perro
  // puntuándolas por tandas, y cortarlo a la mitad deja el board a medio armar. El
  // navegador avisa si intentás refrescar o cerrar la pestaña.
  useEffect(() => {
    if (guardando !== 'aplicar') return;
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [guardando]);

  const aplicar = async () => {
    setGuardando('aplicar'); setErr('');
    // Un lote por borrador: cada reunión conserva su contexto para el Perro, pero el
    // Perro corre UNA sola vez sobre todo (lo arma el server).
    // Lo que respondió en el paso de preguntas viaja como CONTEXTO del Perro: es
    // justamente lo que la reunión no dejó claro.
    const dichas = preguntas.map((q, i) => (respuestas[i] ? `${q.pregunta} → ${respuestas[i]}` : '')).filter(Boolean).join(' · ');
    const lotes = props.map((p) => ({
      id: p.id,
      contexto: [contextoDe(p), dichas].filter(Boolean).join(' '),
      tareas: filas.filter((f) => f.propId === p.id && f.incluir && !f.esDeOtro)
        .map((f) => ({ titulo: f.titulo, detalle: f.detalle, prioridad: f.prioridad, proyecto: nombreProyecto(f.proyectoId), minuto: f.minuto, minutos: f.minutos })),
    })).filter((l) => l.tareas.length > 0);
    const j = await api({ action: 'aplicar-lote', lotes });
    setGuardando('');
    if (j.ok) onListo();
    // El error crudo puede ser una página de error del server (no JSON). Traducirlo:
    // "SyntaxError: Unexpected token 'A'" no le dice nada a nadie.
    else setErr(/JSON|Unexpected token/i.test(String(j.error ?? ''))
      ? 'Se cortó la conexión con el server antes de terminar. Revisá el plan: puede que algunas ya hayan entrado.'
      : String(j.error ?? 'No pude cargarlas.'));
  };

  const descartar = async () => {
    setGuardando('descartar');
    for (const p of todos) await api({ action: 'descartar', id: p.id });
    setGuardando('');
    onDescartadas();
  };

  const de = props.find((p) => p.enviadoPor?.trim())?.enviadoPor?.trim();
  const varias = props.length > 1;
  const soloPreguntas = props.length === 0 && conPreguntas.length > 0;
  const titulo = soloPreguntas ? 'MaKo te dejó un borrador para revisar'
    : de ? `${de} te envió estas tareas`
      : varias ? `MaKo leyó tus ${props.length} reuniones` : 'MaKo leyó tu reunión';
  const sub = soloPreguntas ? 'Necesita que le aclares un par de cosas antes de cargarlas.'
    : varias
      ? `${filas.length} compromisos en total: ${filas.length - nOtras} tuyos${nOtras ? ` y ${nOtras} de los demás` : ''}.`
      : (props[0]?.resumen || `${filas.length} compromisos de la reunión.`);

  const aplicando = guardando === 'aplicar';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 132, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 620, maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>

        {/* Cargando: tapa TODO el modal. Crear N tareas + puntuarlas por tandas puede
            tardar más de un minuto, y hasta ahora no se veía nada pasar. */}
        {aplicando && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 5, background: 'rgba(255,255,255,.86)', backdropFilter: 'blur(3px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
            <span style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid var(--border-strong)', borderTopColor: 'var(--primary)', display: 'inline-block', animation: 'makoSpinTR .7s linear infinite' }} />
            <style>{'@keyframes makoSpinTR{to{transform:rotate(360deg)}}'}</style>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Cargando {nIncluidas} {nIncluidas === 1 ? 'tarea' : 'tareas'} al plan…</div>
            <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.5, maxWidth: 380 }}>
              El perro las está puntuando contra tu plan y armando las checklists. Con muchas tareas puede tardar un par de minutos.
              <br /><b>No cierres ni refresques</b> hasta que termine.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
          <GuardianIcon size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '.14em', color: 'var(--accent)' }}>✦ MAKO · TAREAS PARA CONFIRMAR</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginTop: 2 }}>{titulo}</div>
          </div>
          {/* Mientras carga no hay salida: cerrar a mitad deja tareas creadas y el
              Perro sin correr. */}
          <button onClick={onClose} aria-label="Cerrar" disabled={!!guardando}
            style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: guardando ? 'not-allowed' : 'pointer', fontSize: 14, opacity: guardando ? 0.4 : 1 }}>✕</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--primary-weak)', background: 'var(--primary-bg)' }}>
            {props.some((p) => p.origen === 'fathom') && <span style={{ flex: 'none' }}><SvcIcon k="fathom" size={17} box={28} radius={8} /></span>}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{sub}</div>
              {/* Con varias, el link a cada grabación va en el encabezado de SU bloque
                  (acá arriba sería el de una sola, elegida al azar). */}
              {!varias && props[0]?.fuenteUrl && (
                <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 3 }}>
                  <a href={props[0].fuenteUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>ver la grabación</a>
                </div>
              )}
            </div>
          </div>

          {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600 }}>{err}</div>}

          {/* Borradores que MaKo dejó con preguntas: no se confirman acá, pero TIENEN
              que verse — si no, MaKo dice "entrá al plan" y no hay nada. */}
          {conPreguntas.map((p) => (
            <a key={p.id} href={`/plan/revisar/${p.id}`}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--warn)', background: 'var(--warn-bg, var(--surface-2))', textDecoration: 'none' }}>
              <span style={{ fontSize: 18 }}>💬</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                  MaKo dejó {p.tareas.length} {p.tareas.length === 1 ? 'tarea' : 'tareas'} con {p.preguntas!.length} {p.preguntas!.length === 1 ? 'pregunta' : 'preguntas'}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>{p.resumen || 'Necesita contexto tuyo antes de cargarlas.'}</span>
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>Responder →</span>
            </a>
          ))}

          {paso === 'preguntas' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>
                Antes de cargarlas, MaKo necesita un par de datos que la reunión no dejó claros. Son para que el perro priorice bien — <b>no</b> te va a preguntar qué es más urgente, eso lo decide él.
              </div>
              {preguntas.map((q, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '13px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.35 }}>{q.pregunta}</div>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    {(q.tipo === 'escala' ? ['1', '2', '3', '4', '5'] : (q.opciones ?? [])).map((op) => {
                      const on = respuestas[i] === op;
                      return (
                        <button key={op} type="button" onClick={() => setRespuestas((r) => ({ ...r, [i]: on ? '' : op }))}
                          style={{ padding: '7px 13px', borderRadius: 999, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', color: on ? 'var(--primary)' : 'var(--dim)', fontSize: 13, fontWeight: on ? 700 : 500, cursor: 'pointer', fontFamily: SANS }}>
                          {op}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : filas.length > 0 && <ReunionTareas
            filas={filas}
            labels={labels}
            onFila={(i, patch) => setFilas((fs) => fs.map((f, k) => (k === i ? { ...f, ...patch } : f)))}
            reunion={{ titulo: props[0]?.fuenteTitulo ?? '', fecha: props[0]?.fuenteFecha ?? props[0]?.createdAt, url: props[0]?.fuenteUrl ?? null, recordingId: recordingDeRef(props[0]?.ref) }}
            cabecera="Destildá lo que no vaya. El perro les pone la prioridad final."
          />}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', flexWrap: 'wrap' }}>
          {/* Descartar es explícito y borra TODO lo que está en pantalla; cerrar con la
              ✕ las deja esperando para la próxima. */}
          <button type="button" onClick={() => (paso === 'preguntas' ? setPaso('tareas') : void descartar())} disabled={!!guardando}
            style={{ padding: '11px 18px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 600, fontSize: 13.5, cursor: guardando ? 'default' : 'pointer', fontFamily: SANS }}>
            {paso === 'preguntas' ? '← Volver' : guardando === 'descartar' ? 'Descartando…' : varias ? 'Descartar todo' : 'Descartar'}
          </button>
          {hayMias && (paso === 'tareas'
            ? <button type="button" onClick={() => (preguntas.length ? setPaso('preguntas') : void aplicar())} disabled={nIncluidas === 0 || !!guardando}
                style={{ padding: '12px 24px', borderRadius: 11, border: 'none', background: nIncluidas ? 'var(--primary)' : 'var(--border)', color: nIncluidas ? '#fff' : 'var(--faint)', fontSize: 14, fontWeight: 700, cursor: nIncluidas && !guardando ? 'pointer' : 'default', fontFamily: SANS }}>
                {guardando === 'aplicar' ? 'Cargando…' : nIncluidas ? `Agregar ${nIncluidas} al plan →` : 'Elegí al menos una'}
              </button>
            : <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Contestar es opcional: si no sabés, cargá igual. */}
                <button type="button" onClick={() => void aplicar()} disabled={!!guardando}
                  style={{ padding: '11px 16px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: SANS }}>
                  Saltear
                </button>
                <button type="button" onClick={() => void aplicar()} disabled={!!guardando}
                  style={{ padding: '12px 24px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: guardando ? 'default' : 'pointer', fontFamily: SANS }}>
                  {guardando === 'aplicar' ? 'Cargando…' : `Cargar ${nIncluidas} al plan →`}
                </button>
              </div>)}
        </div>
      </div>
    </div>
  );
}

/** Contexto para el Perro: de dónde salieron estas tareas (mejora su puntuación). */
function contextoDe(prop: PropuestaPendiente): string {
  const de = prop.enviadoPor?.trim();
  return de
    ? `Se las mandó ${de} desde la reunión${prop.fuenteTitulo ? ` «${prop.fuenteTitulo}»` : ''}: son compromisos que asumió esta persona ahí.`
    : `Salieron de la reunión${prop.fuenteTitulo ? ` «${prop.fuenteTitulo}»` : ''} (Fathom): son compromisos que se asumieron ahí.`;
}
