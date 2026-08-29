'use client';

// AsignarProyectoModal — cambiar el/los proyecto(s) de una tarea (CHECKLIST, multi).
// Los proyectos ACTUALES vienen marcados con el chip "Actual"; no se puede avanzar si
// no cambiás nada. La pregunta final es PERSONALIZADA según el cambio (sin proyecto /
// cambiás de X a Y / agregás A, B, C). El motivo queda en el historial (feedback #19).

import { useMemo, useState, type CSSProperties } from 'react';
import { WizardShell } from '@/app/_components/WizardShell';
import { IntroBody, textareaStyle } from './guardian-form';
import { type BoardTask, type Label } from './types';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

// ── Elegir entre 68 proyectos ────────────────────────────────────────────────
// Esto era una lista plana. Con 30 entraba; con 68 el paso se volvió un scroll
// largo donde encontrar «Feature: Landing Analyst» es leer de a uno.
//
// La familia sale del PREFIJO del nombre, que ya es la convención del catálogo
// (lib/plan-proyectos-catalogo.ts). No se importa el catálogo a propósito: acá
// llegan los proyectos del TABLERO, que pueden incluir alguno que el catálogo
// todavía no tenga, y ésos tienen que poder elegirse igual.
type Familia = 'todos' | 'feature' | 'agente' | 'vender' | 'otros';
const FAMILIAS: Array<{ id: Familia; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'feature', label: 'Features' },
  { id: 'agente', label: 'Agentes' },
  { id: 'vender', label: 'Vender' },
  { id: 'otros', label: 'Otros' },
];
const familiaDe = (nombre: string): Exclude<Familia, 'todos'> => {
  const n = nombre.trim().toLowerCase();
  if (n.startsWith('feature:')) return 'feature';
  if (n.startsWith('agente:')) return 'agente';
  if (n.startsWith('vender mako:')) return 'vender';
  return 'otros';
};
/** Sin el prefijo y sin acentos: buscar «landing» tiene que encontrar «Feature: Landing
 *  Analyst», y escribir «feature» no puede devolver los 47. */
const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const sinPrefijo = (s: string): string => norm(s).replace(/^(feature|agente|vender mako)\s*:\s*/, '');

export function AsignarProyectoModal({ task, labels, onAsignar, onClose }: {
  task: BoardTask; labels: Label[];
  onAsignar: (labelIds: string[], motivo: string) => void; onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState<string[]>(task.labels.slice());
  const [motivo, setMotivo] = useState('');
  const [busca, setBusca] = useState('');
  const [fam, setFam] = useState<Familia>('todos');
  const [orden, setOrden] = useState<'prioridad' | 'az'>('prioridad');
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const confirmar = () => { onAsignar(sel, motivo.trim()); onClose(); };

  const actuales = task.labels;
  const mismos = sel.length === actuales.length && sel.every((id) => actuales.includes(id));
  const agregados = sel.filter((id) => !actuales.includes(id));
  const quitados = actuales.filter((id) => !sel.includes(id));

  const chip = (id: string) => { const l = labels.find((x) => x.id === id); return l ? <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 700, padding: '3px 10px', borderRadius: 999, border: `1px solid ${l.color}59`, background: `${l.color}1f`, color: l.color }}>{l.emoji} {l.name}</span> : null; };
  // encabezado del cambio, con emojis + chips (se lee más fácil que un texto plano)
  const cambioHeader = () => {
    const flecha = <span style={{ color: 'var(--faint)', fontSize: 18, margin: '0 2px' }}>→</span>;
    if (sel.length === 0) return <div style={cambioBox}><span style={{ color: 'var(--dim)', fontSize: 14 }}>La dejas <b style={{ color: 'var(--ink)' }}>sin proyecto</b>.</span></div>;
    if (quitados.length === actuales.length && actuales.length > 0 && agregados.length) {
      if (actuales.length === 1 && sel.length === 1) return <div style={cambioBox}>{chip(actuales[0])}{flecha}{chip(sel[0])}</div>;
      return <div style={cambioBox}>{sel.map(chip)}</div>;
    }
    if (agregados.length && !quitados.length) return <div style={cambioBox}><span style={{ color: 'var(--dim)', fontSize: 13.5 }}>Agregas</span>{agregados.map(chip)}</div>;
    if (quitados.length && !agregados.length) return <div style={cambioBox}><span style={{ color: 'var(--dim)', fontSize: 13.5 }}>Sacas</span>{quitados.map(chip)}</div>;
    return <div style={cambioBox}>{sel.map(chip)}</div>;
  };

  // Lo que se ve en la lista: filtrado y ordenado, pero con lo YA ELEGIDO siempre
  // arriba y a salvo de los filtros.
  const visibles = useMemo(() => {
    const q = sinPrefijo(busca.trim());
    const pasa = (l: Label) => {
      if (sel.includes(l.id)) return true;                       // lo elegido no se esconde
      if (fam !== 'todos' && familiaDe(l.name) !== fam) return false;
      if (!q) return true;
      return sinPrefijo(l.name).includes(q) || norm(l.name).includes(q) || norm(l.detalle ?? '').includes(q);
    };
    const elegido = (l: Label) => (sel.includes(l.id) ? 0 : 1);
    return labels.filter(pasa).sort((a, b) => elegido(a) - elegido(b)
      || (orden === 'prioridad' ? (b.score || 0) - (a.score || 0) : 0)
      || sinPrefijo(a.name).localeCompare(sinPrefijo(b.name)));
  }, [labels, busca, fam, orden, sel]);

  const preguntas = ['Hola, soy el Perro Guardián MaKo', '¿En qué proyecto(s) va esta tarea?', sel.length === 0 ? '¿Por qué la dejas sin proyecto?' : '¿Por qué el cambio?'];
  const subs: (string | undefined)[] = [undefined, 'Puedes elegir más de uno. Tienes que cambiar algo para seguir.', 'Cuéntame tu criterio: así entiendo dónde encaja de verdad.'];
  const puedeAvanzar = idx === 0 ? true : idx === 1 ? !mismos : motivo.trim() !== '';

  return (
    <WizardShell
      titulo="Cambiar proyecto"
      total={3} idx={idx}
      pregunta={preguntas[idx]} sub={subs[idx]}
      puedeAvanzar={puedeAvanzar}
      enUltimo={idx === 2} confirmLabel="Guardar →"
      atrasLabel={idx === 0 ? 'Cancelar' : 'Atrás'}
      onClose={onClose}
      onAtras={() => (idx === 0 ? onClose() : setIdx(idx - 1))}
      onSiguiente={() => setIdx(idx + 1)}
      onConfirmar={confirmar}
    >
      {idx === 0 && <IntroBody que={`mover "${task.title.slice(0, 44)}" de proyecto`} mi="que cada tarea viva donde de verdad corresponde" />}
      {idx === 1 && (
        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Busca el proyecto…"
            style={{ width: '100%', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 14, outline: 'none', fontFamily: SANS }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {FAMILIAS.map((f) => {
              const on = fam === f.id;
              const n = f.id === 'todos' ? labels.length : labels.filter((l) => familiaDe(l.name) === f.id).length;
              if (!n) return null;
              return (
                <button key={f.id} type="button" onClick={() => setFam(f.id)}
                  style={{ padding: '5px 11px', borderRadius: 999, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', color: on ? 'var(--primary)' : 'var(--dim)', fontSize: 12.5, fontWeight: on ? 700 : 500, cursor: 'pointer', fontFamily: SANS }}>
                  {f.label} <span style={{ fontFamily: MONO, fontSize: 11, opacity: .7 }}>{n}</span>
                </button>
              );
            })}
            <span style={{ flex: 1 }} />
            <button type="button" onClick={() => setOrden((o) => (o === 'prioridad' ? 'az' : 'prioridad'))}
              title="Cambiar el orden de la lista"
              style={{ padding: '5px 11px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 12.5, cursor: 'pointer', fontFamily: SANS, whiteSpace: 'nowrap' }}>
              {orden === 'prioridad' ? '↓ Prioridad' : '↓ A-Z'}
            </button>
          </div>
          {/* Los ELEGIDOS van siempre arriba y no los filtra nada: si un filtro te
              escondiera lo que ya marcaste, la pantalla estaría mintiendo sobre lo que
              vas a guardar. */}
          {visibles.length === 0 && (
            <div style={{ padding: '18px 4px', color: 'var(--faint)', fontSize: 13.5 }}>
              Ningún proyecto coincide con «{busca.trim()}».
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto', overscrollBehavior: 'contain' }}>
            {visibles.map((l) => {
              const on = sel.includes(l.id);
              const esActual = actuales.includes(l.id);
              return (
                <button key={l.id} type="button" onClick={() => toggle(l.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '11px 14px', borderRadius: 11, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', color: 'var(--ink)', fontSize: 14, cursor: 'pointer', fontFamily: SANS, flex: 'none' }}>
                  <span style={{ width: 17, height: 17, borderRadius: 5, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{on ? '✓' : ''}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>{l.emoji} {l.name}</span>
                  {!!l.score && <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', flex: 'none' }}>{l.score}</span>}
                  {esActual && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--dim)', background: 'var(--surface-2)', border: '1px solid var(--border-strong)', borderRadius: 5, padding: '1px 7px', textTransform: 'uppercase', letterSpacing: '.04em', flex: 'none' }}>Actual</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {idx === 2 && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{cambioHeader()}<textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus placeholder="Ej: es parte del núcleo, no de growth…" style={{ ...textareaStyle }} /></div>}
    </WizardShell>
  );
}

const cambioBox: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' };
