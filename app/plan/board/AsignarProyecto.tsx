'use client';

// =============================================================================
// AsignarProyectoModal — elegís el proyecto y listo
// =============================================================================
// Era un wizard de TRES pasos: «Hola, soy el Perro Guardián MaKo» con su escudo y su
// párrafo, después la lista, y después una justificación OBLIGATORIA de por qué lo movías.
// El reporte, textual (23/09/2026): «al darle aún me sigue apareciendo la fricción de antes
// del perro guardián».
//
// Es la misma fricción que se sacó de la prioridad, del alta de tarea y del alta de
// proyecto, sobreviviendo en el último lugar donde quedaba. Quedó en UNA pantalla: buscás,
// elegís, guardás.
//
// Lo que NO se sacó, porque no es fricción sino utilidad: el buscador, los filtros por
// familia y el orden. Con 70 proyectos, una lista plana es un scroll donde encontrar
// «Feature: Landing Analyst» es leer de a uno.
//
// ⚠️ Y EL MOTIVO ERA OBLIGATORIO. Pedirle a alguien que escriba un párrafo para mover una
// tarjeta de proyecto es exactamente lo que el dueño viene rechazando desde el 22/09: el
// historial ya registra QUÉ se movió y QUIÉN lo hizo, que es lo que se necesita para
// auditarlo. El porqué, cuando importa, se escribe en las notas.

import { useMemo, useState } from 'react';
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
  const [sel, setSel] = useState<string[]>(task.labels.slice());
  const [busca, setBusca] = useState('');
  const [fam, setFam] = useState<Familia>('todos');
  const [orden, setOrden] = useState<'prioridad' | 'az'>('prioridad');
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  // El motivo viaja VACÍO: se pedía obligatorio y era la fricción. `onAsignar` lo sigue
  // aceptando porque el historial lo sabe escribir, y el día que vuelva a haber una fuente
  // para él —una reunión, un audio— entra por acá sin tocar nada más.
  const confirmar = () => { onAsignar(sel, ''); onClose(); };

  const actuales = task.labels;
  const mismos = sel.length === actuales.length && sel.every((id) => actuales.includes(id));
  const agregados = sel.filter((id) => !actuales.includes(id));
  const quitados = actuales.filter((id) => !sel.includes(id));

  // ⛔ ACÁ VIVÍAN `chip` y `cambioHeader`, que dibujaban el resumen «de X → a Y» del paso
  // de confirmación. Ese paso se fue con el wizard: lo que se elige se ve tildado en la
  // lista, y el pie dice a dónde va. Un resumen de lo que acabás de marcar, en la pantalla
  // siguiente, es releer lo que ya estás mirando.

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

  const puedeGuardar = !mismos;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 140, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '7vh 20px 20px', fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, maxHeight: '82vh', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px 0', flex: 'none' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{actuales.length ? 'Cambiar de proyecto' : 'Asignar un proyecto'}</span>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} aria-label="Cerrar" style={{ border: 'none', background: 'transparent', color: 'var(--faint)', fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: '2px 4px' }}>×</button>
        </div>

        <div style={{ padding: '14px 20px 0', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, flex: 1 }}>
          <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Busca el proyecto…"
            style={{ width: '100%', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 14, outline: 'none', fontFamily: SANS, flex: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 'none' }}>
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
          {visibles.length === 0 && (
            <div style={{ padding: '18px 4px', color: 'var(--faint)', fontSize: 13.5 }}>
              Ningún proyecto coincide con «{busca.trim()}».
            </div>
          )}
          {/* Los ELEGIDOS van siempre arriba y no los filtra nada: si un filtro te
              escondiera lo que ya marcaste, la pantalla estaría mintiendo sobre lo que
              vas a guardar. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', overscrollBehavior: 'contain', paddingBottom: 4, minHeight: 0 }}>
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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '14px 20px 18px', flex: 'none' }}>
          <span style={{ fontSize: 12, color: 'var(--faint)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sel.length === 0 ? 'La dejas sin proyecto.' : sel.length === 1 ? (labels.find((l) => l.id === sel[0])?.name ?? '') : `${sel.length} proyectos`}
          </span>
          <div style={{ display: 'flex', gap: 9, flex: 'none' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 16px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
            <button type="button" onClick={confirmar} disabled={!puedeGuardar}
              style={{ padding: '10px 20px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: puedeGuardar ? 'pointer' : 'default', opacity: puedeGuardar ? 1 : 0.5, fontFamily: SANS, whiteSpace: 'nowrap' }}>Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

