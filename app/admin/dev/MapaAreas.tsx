'use client';

// =============================================================================
// El mapa de las áreas, con el lenguaje de la BARRA
// =============================================================================
// Pedido del dueño, textual: «utiliza el mismo diseño que vamos a utilizar en la
// sidebar». Y tiene razón por una razón que no es estética: esta pantalla existe
// para decidir cómo se va a ver Dev en la barra. Si se dibuja de otra forma, lo
// que se aprueba acá no es lo que después aparece allá.
//
// Así que cada familia se pinta igual que en `Sidebar.tsx`: el rótulo AFUERA (mono,
// .17em, mayúsculas) y la caja de ítems ADENTRO, con su fondo al 6% de blanco. La
// geometría de la fila sale de `filaStyle`, la misma función que usa la barra —
// por eso está exportada. Si el aire de la barra cambia, cambia acá también.
//
// La diferencia con la barra: allá es UNA columna de 244px y acá son varias. 122
// áreas en una sola columna son 5.500px de scroll; en grilla se escanean.

import { useMemo, useState } from 'react';
import Link from '@/app/_ui/Link';
import { filaStyle } from '@/app/_components/Sidebar';
import { Icon } from '@/app/_components/icons';

export type AreaVista = {
  slug: string;
  titulo: string;
  alcance: string;
  agente: boolean;
  abiertas: number;
  estado: 'listo' | 'parcial' | 'por-construir';
  nota: string;
};

type Grupo = { grupo: string; areas: AreaVista[] };
type Familia = { familia: string; proposito: string; icono: string; grupos: Grupo[] };

const MONO = "'Geist Mono', monospace";
const PUNTO = { listo: 'var(--good)', parcial: 'var(--warn-fill)', 'por-construir': 'var(--faint)' } as const;

type Filtro = 'todo' | 'listo' | 'parcial' | 'por-construir' | 'agentes' | 'trampas';

export function MapaAreas({ familias, total, abiertas }: { familias: Familia[]; total: number; abiertas: number }) {
  const [filtro, setFiltro] = useState<Filtro>('todo');
  const [q, setQ] = useState('');
  const [plegadas, setPlegadas] = useState<Set<string>>(new Set());

  const cuenta = useMemo(() => {
    const c = { listo: 0, parcial: 0, 'por-construir': 0, agentes: 0, trampas: 0 };
    for (const f of familias) for (const g of f.grupos) for (const a of g.areas) {
      c[a.estado]++;
      if (a.agente) c.agentes++;
      if (a.nota) c.trampas++;
    }
    return c;
  }, [familias]);

  const pasa = (a: AreaVista) => {
    if (filtro === 'agentes' && !a.agente) return false;
    if (filtro === 'trampas' && !a.nota) return false;
    if ((filtro === 'listo' || filtro === 'parcial' || filtro === 'por-construir') && a.estado !== filtro) return false;
    if (!q.trim()) return true;
    const n = q.trim().toLowerCase();
    return a.titulo.toLowerCase().includes(n) || a.alcance.toLowerCase().includes(n);
  };

  const plegar = (k: string) =>
    setPlegadas((p) => { const s = new Set(p); if (s.has(k)) s.delete(k); else s.add(k); return s; });

  return (
    <>
      <Filtros
        filtro={filtro} setFiltro={setFiltro} q={q} setQ={setQ}
        cuenta={cuenta} total={total} abiertas={abiertas}
      />

      {/* La grilla acomoda las familias por alto, no por orden: si van en columnas
          fijas, Operate (31 áreas) deja las otras dos columnas vacías abajo. */}
      <div style={{ columns: '300px auto', columnGap: 18, marginTop: 4 }}>
        {familias.map((f) => {
          const visibles = f.grupos.map((g) => ({ ...g, areas: g.areas.filter(pasa) })).filter((g) => g.areas.length);
          if (!visibles.length) return null;
          const nAreas = visibles.reduce((s, g) => s + g.areas.length, 0);
          const nT = visibles.reduce((s, g) => s + g.areas.reduce((x, a) => x + a.abiertas, 0), 0);
          const cerrada = plegadas.has(f.familia);
          return (
            <section
              key={f.familia}
              style={{
                breakInside: 'avoid', marginBottom: 18, background: 'var(--sidebar)',
                borderRadius: 'var(--r-lg)', padding: '16px 14px 14px',
              }}
            >
              <button
                type="button"
                onClick={() => plegar(f.familia)}
                aria-expanded={!cerrada}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                  padding: '0 2px 3px', border: 'none', background: 'transparent', cursor: 'pointer',
                  fontFamily: MONO, fontSize: 12, letterSpacing: '.17em', textTransform: 'uppercase',
                  fontWeight: 700, color: 'var(--on-sidebar)',
                }}
              >
                <Icon name={f.icono} size={15} />
                <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.familia}</span>
                {nT > 0 && <Contador n={nT} />}
                <span style={{ flex: 'none', fontSize: 10, opacity: 0.75, transform: cerrada ? 'none' : 'rotate(90deg)', transition: 'transform .15s' }}>›</span>
              </button>

              {!cerrada && (
                <>
                  <p style={{ margin: '0 0 7px', padding: '0 2px', fontSize: 10.5, color: 'var(--sidebar-text)', opacity: 0.62 }}>
                    {f.proposito} · {nAreas} {nAreas === 1 ? 'área' : 'áreas'}
                  </p>
                  <div style={{
                    display: 'flex', flexDirection: 'column',
                    background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)',
                    borderRadius: 'var(--r-lg)', padding: 5,
                  }}>
                    {visibles.map((g, i) => (
                      <Bloque
                        key={g.grupo || '_'}
                        grupo={g}
                        primero={i === 0}
                        cerrado={plegadas.has(`${f.familia}/${g.grupo}`)}
                        onPlegar={() => plegar(`${f.familia}/${g.grupo}`)}
                      />
                    ))}
                  </div>
                </>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

function Bloque({ grupo, primero, cerrado, onPlegar }: { grupo: Grupo; primero: boolean; cerrado: boolean; onPlegar: () => void }) {
  const sep = primero ? {} : { marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,.06)' };
  if (!grupo.grupo) {
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 1, ...sep }}>{grupo.areas.map((a) => <Fila key={a.slug} a={a} />)}</div>;
  }
  return (
    <div style={sep}>
      <button
        type="button"
        onClick={onPlegar}
        aria-expanded={!cerrado}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '5px 10px 5px 8px',
          border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: MONO,
          fontSize: 9.5, letterSpacing: '.13em', textTransform: 'uppercase',
          color: 'var(--sidebar-text)',
        }}
      >
        <span style={{ fontSize: 9, transform: cerrado ? 'none' : 'rotate(90deg)', transition: 'transform .15s' }}>›</span>
        <span style={{ flex: 1, textAlign: 'left' }}>{grupo.grupo}</span>
        <span style={{ fontFamily: MONO, fontSize: 10, opacity: 0.7 }}>{grupo.areas.length}</span>
      </button>
      {!cerrado && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingLeft: 9, marginLeft: 9, borderLeft: '1px solid rgba(255,255,255,.09)' }}>
          {grupo.areas.map((a) => <Fila key={a.slug} a={a} />)}
        </div>
      )}
    </div>
  );
}

/** La fila usa `filaStyle` y `.mk-navrow`: la misma geometría y el mismo hover
 *  que la barra de verdad. Lo único propio es qué se pinta adentro. */
function Fila({ a }: { a: AreaVista }) {
  return (
    <Link
      href={`/admin/dev/${a.slug}`}
      className="mk-navrow"
      title={a.nota ? `${a.alcance}\n\n⚑ ${a.nota}` : a.alcance}
      // El `gap` NO se pisa: sale de `filaStyle` y es el mismo que la barra. El
      // punto de estado ocupa la ranura del ícono (15px, centrado) para que los
      // rótulos arranquen exactamente donde arrancan allá.
      style={{ ...filaStyle(true), opacity: a.estado === 'por-construir' ? 0.62 : 1 }}
    >
      <span style={{ width: 15, flex: 'none', display: 'flex', justifyContent: 'center' }} aria-hidden>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: PUNTO[a.estado] }} />
      </span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* El dorado es el de MaKo: en esta app significa «lo hace la IA». */}
        {a.agente && <span title="Agente: corre solo" style={{ color: 'var(--mako)', fontSize: 9, flex: 'none' }}>◆</span>}
        {a.titulo}
      </span>
      {a.nota && <span title={a.nota} style={{ color: 'var(--mako)', fontSize: 10, flex: 'none', opacity: 0.85 }}>⚑</span>}
      {a.abiertas > 0 && <Contador n={a.abiertas} tono="rojo" />}
      {a.estado === 'por-construir' && (
        <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'currentColor', border: '1px solid currentColor', borderRadius: 5, padding: '1px 5px', opacity: 0.5, flex: 'none' }}>
          pronto
        </span>
      )}
    </Link>
  );
}

function Contador({ n, tono = 'tenue' }: { n: number; tono?: 'rojo' | 'tenue' }) {
  return (
    <span style={{
      fontFamily: MONO, fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 999, flex: 'none',
      background: tono === 'rojo' ? 'var(--bad)' : 'rgba(255,255,255,.12)',
      color: tono === 'rojo' ? '#fff' : 'var(--on-sidebar)',
    }}>{n}</span>
  );
}

function Filtros({ filtro, setFiltro, q, setQ, cuenta, total, abiertas }: {
  filtro: Filtro; setFiltro: (f: Filtro) => void; q: string; setQ: (s: string) => void;
  cuenta: Record<string, number>; total: number; abiertas: number;
}) {
  const chip = (id: Filtro, label: string, n: number, color?: string) => (
    <button
      key={id} type="button"
      onClick={() => setFiltro(filtro === id ? 'todo' : id)}
      aria-pressed={filtro === id}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', font: 'inherit',
        fontSize: 13, padding: '6px 13px', borderRadius: 999,
        border: `1px solid ${filtro === id ? 'var(--ink)' : 'var(--border-strong)'}`,
        background: filtro === id ? 'var(--ink)' : 'var(--surface)',
        color: filtro === id ? 'var(--surface)' : 'var(--dim)',
      }}
    >
      {color && <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flex: 'none' }} />}
      {label}<b style={{ fontVariantNumeric: 'tabular-nums' }}>{n}</b>
    </button>
  );
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', margin: '0 0 20px' }}>
      {chip('listo', 'Cerrado', cuenta.listo, 'var(--good)')}
      {chip('parcial', 'Abierto', cuenta.parcial, 'var(--warn-fill)')}
      {chip('por-construir', 'Por construir', cuenta['por-construir'], 'var(--faint)')}
      {chip('agentes', 'Agentes', cuenta.agentes, 'var(--mako)')}
      {chip('trampas', 'Con trampa', cuenta.trampas, 'var(--mako)')}
      <input
        value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar un área…"
        style={{
          font: 'inherit', fontSize: 13, padding: '6px 12px', borderRadius: 999,
          border: '1px solid var(--border-strong)', background: 'var(--surface)',
          color: 'var(--ink)', minWidth: 180, marginLeft: 'auto',
        }}
      />
      <span style={{ fontSize: 12.5, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>
        {total} áreas · {abiertas} tareas abiertas
      </span>
    </div>
  );
}
