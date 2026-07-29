'use client';

// =============================================================================
// TareasRecibidasModal — "confirmá estas tareas" al entrar al plan
// =============================================================================
// Dos cosas caen acá, y las dos SIN crear nada por atrás:
//
//   · MaKo detectó sola una reunión nueva del equipo en Fathom, sacó los compromisos
//     y los dejó esperando (cron fathom-plan). Entrás al plan y te los muestra.
//   · Otra persona te mandó las tareas que asumiste en la reunión que tuvieron
//     ("Martín te envió estas tareas…").
//
// Confirmás lo que va (y sacás lo que no) y recién ahí se crean, con el Perro
// puntuándolas server-side igual que cualquier otra tarea. Si no querés ninguna,
// "Ahora no" descarta el borrador.

import { useState } from 'react';
import { GuardianIcon } from './GuardianIcon';
import { SvcIcon } from '../../_components/ServicioVisual';
import { ReunionTareas, type FilaTarea } from './ReunionTareas';
import { type Label, type Prio } from './types';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

type PropTarea = { titulo: string; proyecto?: string; deadline?: string; detalle?: string; prioridad?: Prio; dueno?: string; duenoEmail?: string; esDeOtro?: boolean };
export type PropuestaPendiente = {
  id: string; resumen: string; origen?: string; tareas: PropTarea[]; createdAt: string;
  enviadoPor?: string; fuenteTitulo?: string; fuenteUrl?: string; ref?: string;
};

async function api(body: Record<string, unknown>): Promise<Record<string, unknown> & { ok: boolean; error?: string }> {
  return fetch('/api/plan-propuesta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
}

const fechaLinda = (iso?: string) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long' }); } catch { return ''; }
};
/** El recordingId que dejó el cron en `ref` (fathom:12345) — habilita mandarle a otros. */
const recordingDeRef = (ref?: string): number | undefined => {
  const n = Number((ref ?? '').startsWith('fathom:') ? ref!.slice(7) : NaN);
  return Number.isFinite(n) ? n : undefined;
};

export function TareasRecibidasModal({ prop, labels, onListo, onClose }: {
  prop: PropuestaPendiente;
  labels: Label[];
  /** se aplicó: el board recarga para mostrar las tareas nuevas ya puntuadas. */
  onListo: () => void;
  onClose: () => void;
}) {
  // El borrador guarda el proyecto por NOMBRE (viaja entre tableros distintos): acá lo
  // reenganchamos con el proyecto real de ESTE board para poder cambiarlo en el momento.
  // Init perezoso (el padre monta este modal con key={prop.id}: un borrador nuevo = un
  // componente nuevo, así que no hace falta re-sincronizar por efecto).
  const [filas, setFilas] = useState<FilaTarea[]>(() => {
    const idPorNombre = new Map(labels.map((l) => [l.name.trim().toLowerCase(), l.id]));
    return prop.tareas.map((t) => ({
      titulo: t.titulo, detalle: t.detalle ?? '', prioridad: (t.prioridad ?? 'media') as Prio,
      proyectoId: t.proyecto ? idPorNombre.get(t.proyecto.trim().toLowerCase()) ?? null : null,
      dueño: t.dueno, dueñoEmail: t.duenoEmail, esDeOtro: t.esDeOtro,
      incluir: !t.esDeOtro,
    }));
  });

  const [guardando, setGuardando] = useState<'' | 'aplicar' | 'descartar'>('');
  const [err, setErr] = useState('');
  const nombreProyecto = (id: string | null) => labels.find((l) => l.id === id)?.name;
  const nIncluidas = filas.filter((f) => f.incluir && !f.esDeOtro).length;
  const hayMias = filas.some((f) => !f.esDeOtro);

  const aplicar = async () => {
    setGuardando('aplicar'); setErr('');
    const tareas = filas.filter((f) => f.incluir && !f.esDeOtro).map((f) => ({
      titulo: f.titulo, detalle: f.detalle, prioridad: f.prioridad, proyecto: nombreProyecto(f.proyectoId),
    }));
    const j = await api({ action: 'aplicar', id: prop.id, tareas, contexto: contextoDe(prop) });
    setGuardando('');
    if (j.ok) onListo();
    else setErr(String(j.error ?? 'No pude cargarlas.'));
  };

  const descartar = async () => {
    setGuardando('descartar');
    await api({ action: 'descartar', id: prop.id });
    setGuardando('');
    onClose();
  };

  const de = prop.enviadoPor?.trim();
  const titulo = de ? `${de} te envió estas tareas` : 'MaKo leyó tu reunión';
  const sub = prop.resumen || `${prop.tareas.length} tareas de la reunión${prop.fuenteTitulo ? ` «${prop.fuenteTitulo}»` : ''}.`;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 132, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
      <div style={{ width: '100%', maxWidth: 620, maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
          <GuardianIcon size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '.14em', color: 'var(--accent)' }}>✦ MAKO · TAREAS PARA CONFIRMAR</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginTop: 2 }}>{titulo}</div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--primary-weak)', background: 'var(--primary-bg)' }}>
            {prop.origen === 'fathom' && <span style={{ flex: 'none' }}><SvcIcon k="fathom" size={17} box={28} radius={8} /></span>}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{sub}</div>
              <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 3 }}>
                {fechaLinda(prop.createdAt)}
                {prop.fuenteUrl && <> · <a href={prop.fuenteUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>ver la grabación</a></>}
              </div>
            </div>
          </div>

          {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600 }}>{err}</div>}

          <ReunionTareas
            filas={filas}
            labels={labels}
            onFila={(i, patch) => setFilas((fs) => fs.map((f, k) => (k === i ? { ...f, ...patch } : f)))}
            reunion={{ recordingId: recordingDeRef(prop.ref), titulo: prop.fuenteTitulo ?? '', fecha: prop.createdAt, url: prop.fuenteUrl ?? null }}
            cabecera="Destildá lo que no vaya. El perro les pone la prioridad final."
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => void descartar()} disabled={!!guardando}
            style={{ padding: '11px 18px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 600, fontSize: 13.5, cursor: guardando ? 'default' : 'pointer', fontFamily: SANS }}>
            {guardando === 'descartar' ? 'Descartando…' : 'Ahora no'}
          </button>
          {hayMias && (
            <button type="button" onClick={() => void aplicar()} disabled={nIncluidas === 0 || !!guardando}
              style={{ padding: '12px 24px', borderRadius: 11, border: 'none', background: nIncluidas ? 'var(--primary)' : 'var(--border)', color: nIncluidas ? '#fff' : 'var(--faint)', fontSize: 14, fontWeight: 700, cursor: nIncluidas && !guardando ? 'pointer' : 'default', fontFamily: SANS }}>
              {guardando === 'aplicar' ? 'Cargando…' : nIncluidas ? `Agregar ${nIncluidas} al plan →` : 'Elegí al menos una'}
            </button>
          )}
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
