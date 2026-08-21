'use client';

// =============================================================================
// DependenciasBloque — «esto no puede empezar hasta que aquello termine»
// =============================================================================
// El bloque que va adentro del detalle de una tarea y del de un proyecto. Uno solo para
// los dos niveles: la anatomía es idéntica y mantener dos copias es garantizar que
// diverjan (es la regla de `.mk-fila` de AGENTS.md aplicada acá).
//
// Muestra las DOS direcciones, y no es simetría por prolijidad:
//   · «Espera a…»   → por qué esto no se puede empezar hoy.
//   · «Destraba a…» → por qué ESTO importa más de lo que su título sugiere. Es la mitad
//     que explica el ranking: una tarea chica que destraba tres cosas grandes sube, y sin
//     ver esta lista ese salto parece arbitrario.
//
// La lista inversa NO se guarda: se deriva recorriendo las aristas. Dos listas guardadas
// se desincronizan, que es el mismo motivo por el que el score de un proyecto se deriva de
// sus tareas en vez de escribirse aparte.
// =============================================================================

import { useMemo, useState } from 'react';
import { type Dep, type ClaseDep, type EntidadDep, puedeDepender } from './dependencias';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

export type Candidato = { id: string; titulo: string; sub?: string; terminado?: boolean };

export function DependenciasBloque({ entidad, id, deps, candidatos, impacto, onAdd, onDel }: {
  entidad: EntidadDep;
  id: string;
  deps: Dep[];
  /** todo lo que se puede elegir del MISMO nivel, sin incluirse a sí mismo */
  candidatos: Candidato[];
  /** una frase con el RADIO de la escritura, para decirlo ANTES del click. */
  impacto?: (aId: string) => string;
  onAdd: (d: { entidad: EntidadDep; deId: string; aId: string; clase: ClaseDep; razon: string }) => Promise<{ ok: boolean; error?: string; camino?: string[] }>;
  onDel: (entidad: EntidadDep, deId: string, aId: string) => Promise<void> | void;
}) {
  const [abriendo, setAbriendo] = useState(false);
  const [q, setQ] = useState('');
  const [clase, setClase] = useState<ClaseDep>('bloquea');
  const [razon, setRazon] = useState('');
  const [elegido, setElegido] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const mias = deps.filter((d) => d.entidad === entidad);
  const espera = mias.filter((d) => d.deId === id);
  const destraba = mias.filter((d) => d.aId === id);
  const nombre = (x: string) => candidatos.find((c) => c.id === x)?.titulo ?? x;
  const listo = (x: string) => candidatos.find((c) => c.id === x)?.terminado ?? false;

  // Los candidatos que cerrarían un círculo salen DESHABILITADOS con el motivo al lado, no
  // escondidos: esconderlos es no decir por qué, y el dueño se queda buscando una opción
  // que existe y no aparece.
  const opciones = useMemo(() => {
    const yaPuestos = new Set(espera.map((d) => d.aId));
    const t = q.trim().toLowerCase();
    return candidatos
      .filter((c) => c.id !== id && !yaPuestos.has(c.id))
      .filter((c) => !t || c.titulo.toLowerCase().includes(t) || (c.sub ?? '').toLowerCase().includes(t))
      .map((c) => ({ ...c, ciclo: !puedeDepender(deps, entidad, id, c.id).ok }))
      .slice(0, 40);
  }, [candidatos, deps, entidad, id, q, espera]);

  const guardar = async () => {
    if (!elegido) return;
    setGuardando(true); setError('');
    const r = await onAdd({ entidad, deId: id, aId: elegido, clase, razon: razon.trim() });
    setGuardando(false);
    if (!r.ok) { setError(r.error || 'No se pudo guardar.'); return; }
    setAbriendo(false); setElegido(null); setRazon(''); setQ(''); setClase('bloquea');
  };

  const Fila = ({ d, dir }: { d: Dep; dir: 'espera' | 'destraba' }) => {
    const otro = dir === 'espera' ? d.aId : d.deId;
    const hecho = listo(otro);
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 0', borderTop: '1px solid var(--border)' }}>
        <span style={{ flex: 'none', fontSize: 12, marginTop: 1 }}>{d.clase === 'ordena' ? '↔' : hecho ? '✓' : '🔒'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: hecho ? 'var(--dim)' : 'var(--ink)', textDecoration: hecho ? 'line-through' : 'none', wordBreak: 'break-word' }}>{nombre(otro)}</div>
          {/* La razón es lo único que hace auditable la arista a las seis semanas: sin
              ella, el candado solo puede decir «falta terminarla» y nadie sabe por qué
              existe el vínculo. */}
          {d.razon && <div style={{ fontSize: 11.5, color: 'var(--faint)', fontStyle: 'italic', marginTop: 2 }}>{d.razon}</div>}
          {d.clase === 'ordena' && <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>Van juntas — no frena el arranque.</div>}
        </div>
        <button onClick={() => void onDel(entidad, d.deId, d.aId)} title="Sacar esta dependencia"
          style={{ flex: 'none', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--faint)', fontSize: 15, lineHeight: 1, padding: '0 2px' }}>×</button>
      </div>
    );
  };

  return (
    <div style={{ fontFamily: SANS }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 700 }}>Depende de</div>
        <span style={{ flex: 1 }} />
        {!abriendo && (
          <button onClick={() => setAbriendo(true)}
            style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 8, padding: '4px 9px', cursor: 'pointer', fontFamily: MONO, fontSize: 11, fontWeight: 700, color: 'var(--dim)' }}>+ Agregar</button>
        )}
      </div>

      {espera.length === 0 && destraba.length === 0 && !abriendo && (
        <div style={{ fontSize: 12.5, color: 'var(--faint)', paddingBottom: 4 }}>
          Nada la frena y no frena nada. {entidad === 'proyecto' ? 'Se puede arrancar cuando quieras.' : 'Se puede empezar hoy.'}
        </div>
      )}

      {espera.length > 0 && (
        <div style={{ marginBottom: destraba.length ? 12 : 0 }}>
          {espera.map((d) => <Fila key={d.aId} d={d} dir="espera" />)}
        </div>
      )}

      {destraba.length > 0 && (
        <>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 700, marginTop: 4 }}>Destraba a</div>
          <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>
            Por esto sube de prioridad: vale al menos lo que vale lo mejor que destraba.
          </div>
          {destraba.map((d) => <Fila key={d.deId} d={d} dir="destraba" />)}
        </>
      )}

      {abriendo && (
        <div style={{ marginTop: 8, border: '1px solid var(--border-strong)', borderRadius: 10, padding: 12, background: 'var(--surface-2)' }}>
          {/* La pregunta que decide la clase, en la PANTALLA y no solo en la cabeza del que
              la carga. Es la mejor forma de operacionalizar la distinción del dueño:
              «correlacionado» vs «depende absolutamente de que el anterior termine». */}
          <div style={{ fontSize: 12.5, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.45 }}>
            Si alguien empieza <strong>esto</strong> hoy, sin que lo otro esté terminado, ¿el trabajo que haga se tira?
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {([['bloquea', 'Sí — no se puede empezar antes'], ['ordena', 'No, pero van juntas']] as Array<[ClaseDep, string]>).map(([c, txt]) => (
              <button key={c} onClick={() => setClase(c)}
                style={{ border: `1px solid ${clase === c ? 'var(--primary)' : 'var(--border-strong)'}`, background: clase === c ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'var(--surface)', color: clase === c ? 'var(--primary)' : 'var(--dim)', borderRadius: 9, padding: '6px 11px', cursor: 'pointer', fontFamily: SANS, fontSize: 12.5, fontWeight: 600 }}>{txt}</button>
            ))}
          </div>

          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={entidad === 'proyecto' ? 'Buscar un proyecto…' : 'Buscar una tarea…'}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, outline: 'none', fontFamily: SANS, marginBottom: 8 }} />

          {/* Con tope de alto y scroll VISIBLE: un menú con overflow:hidden clipea sus
              últimas filas en silencio, que es la regla 4 de layout de AGENTS.md. */}
          <div className="mk-scroll-x" style={{ maxHeight: 210, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            {opciones.length === 0 && <div style={{ padding: 10, fontSize: 12.5, color: 'var(--faint)' }}>No hay nada más para elegir.</div>}
            {opciones.map((c) => (
              <button key={c.id} disabled={c.ciclo} onClick={() => setElegido(c.id)} title={c.ciclo ? 'No se puede: eso ya espera a esto. Sería un círculo.' : ''}
                style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid var(--border)', background: elegido === c.id ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'transparent', padding: '8px 11px', cursor: c.ciclo ? 'not-allowed' : 'pointer', opacity: c.ciclo ? 0.45 : 1, fontFamily: SANS }}>
                <div style={{ fontSize: 13, color: 'var(--ink)', wordBreak: 'break-word' }}>{c.titulo}</div>
                <div style={{ fontSize: 11, color: 'var(--faint)' }}>{c.ciclo ? 'Ya espera a esto — sería un círculo' : (c.sub ?? '')}</div>
              </button>
            ))}
          </div>

          <input value={razon} onChange={(e) => setRazon(e.target.value)} placeholder="¿Qué produce lo otro que esto necesita?"
            style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, outline: 'none', fontFamily: SANS, margin: '8px 0' }} />

          {/* La consecuencia de lo irreversible va PEGADA al botón, en tinta normal y
              antes del click: una dependencia de proyecto frena decenas de tarjetas de un
              saque, y es la escritura de mayor palanca de todo el tablero. */}
          {elegido && impacto?.(elegido) && (
            <div style={{ fontSize: 12.5, color: 'var(--ink)', marginBottom: 8 }}>{impacto(elegido)}</div>
          )}
          {error && <div style={{ fontSize: 12.5, color: 'var(--bad, #C0392B)', marginBottom: 8 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            {/* Cada botón nombra su acción y su objeto — nada de «Aceptar» / «Cancelar». */}
            <button disabled={!elegido || guardando} onClick={() => void guardar()}
              style={{ border: 'none', background: elegido ? 'var(--primary)' : 'var(--border-strong)', color: '#fff', borderRadius: 9, padding: '8px 14px', cursor: elegido ? 'pointer' : 'not-allowed', fontFamily: SANS, fontSize: 13, fontWeight: 700 }}>
              {guardando ? 'Guardando…' : clase === 'bloquea' ? 'Marcar que espera a esto' : 'Marcar que van juntas'}
            </button>
            <button onClick={() => { setAbriendo(false); setElegido(null); setError(''); }}
              style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 9, padding: '8px 14px', cursor: 'pointer', fontFamily: SANS, fontSize: 13, fontWeight: 600 }}>No agregar nada</button>
          </div>
        </div>
      )}
    </div>
  );
}
