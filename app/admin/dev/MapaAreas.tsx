'use client';

// =============================================================================
// El mapa de las áreas: familias plegables, con filtro por estado
// =============================================================================
// Es una pantalla para ESCANEAR, no para leer: lo que se busca es «qué está
// abierto» o «qué falta construir», no recorrer 121 renglones. Por eso el estado
// va como franja de color además de rótulo, y los filtros son lo primero.
//
// El alcance de cada área se muestra al pasar el mouse, no debajo del nombre: con
// 121 áreas, una línea de prosa por renglón convierte el mapa en un muro. Regla de
// la casa: nada de texto innecesario.

import { useMemo, useState } from 'react';
import Link from '@/app/_ui/Link';
import { Tooltip } from '@/app/_ui';

export type AreaVista = {
  slug: string;
  titulo: string;
  alcance: string;
  agente: boolean;
  abiertas: number;
  estado: 'listo' | 'parcial' | 'por-construir';
  nota: string;
};

type Familia = { familia: string; proposito: string; grupos: Array<{ grupo: string; areas: AreaVista[] }> };

const ROTULO = { listo: 'Cerrado', parcial: 'Abierto', 'por-construir': 'Por construir' } as const;
const COLOR = { listo: 'var(--good)', parcial: 'var(--warn-fill)', 'por-construir': 'var(--faint)' } as const;

type Filtro = 'todo' | 'listo' | 'parcial' | 'por-construir' | 'agentes';

export function MapaAreas({ familias, total, abiertas }: { familias: Familia[]; total: number; abiertas: number }) {
  const [filtro, setFiltro] = useState<Filtro>('todo');
  const [q, setQ] = useState('');

  const cuenta = useMemo(() => {
    const c = { listo: 0, parcial: 0, 'por-construir': 0, agentes: 0 };
    for (const f of familias) for (const g of f.grupos) for (const a of g.areas) {
      c[a.estado]++;
      if (a.agente) c.agentes++;
    }
    return c;
  }, [familias]);

  const pasa = (a: AreaVista) => {
    if (filtro === 'agentes' ? !a.agente : filtro !== 'todo' && a.estado !== filtro) return false;
    if (!q.trim()) return true;
    const n = q.trim().toLowerCase();
    return a.titulo.toLowerCase().includes(n) || a.alcance.toLowerCase().includes(n);
  };

  const chip = (id: Filtro, label: string, n?: number, color?: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setFiltro(filtro === id ? 'todo' : id)}
      aria-pressed={filtro === id}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer',
        font: 'inherit', fontSize: 13, padding: '6px 13px', borderRadius: 999,
        border: `1px solid ${filtro === id ? 'var(--ink)' : 'var(--border-strong)'}`,
        background: filtro === id ? 'var(--ink)' : 'var(--surface)',
        color: filtro === id ? 'var(--surface)' : 'var(--dim)',
      }}
    >
      {color && <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flex: 'none' }} />}
      {label}
      {n !== undefined && <b style={{ fontVariantNumeric: 'tabular-nums' }}>{n}</b>}
    </button>
  );

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', margin: '0 0 22px' }}>
        {chip('listo', 'Cerrado', cuenta.listo, COLOR.listo)}
        {chip('parcial', 'Abierto', cuenta.parcial, COLOR.parcial)}
        {chip('por-construir', 'Por construir', cuenta['por-construir'], COLOR['por-construir'])}
        {chip('agentes', 'Agentes', cuenta.agentes, 'var(--mako)')}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar un área…"
          style={{
            font: 'inherit', fontSize: 13, padding: '6px 12px', borderRadius: 999,
            border: '1px solid var(--border-strong)', background: 'var(--surface)',
            color: 'var(--ink)', minWidth: 190, marginLeft: 'auto',
          }}
        />
        <span style={{ fontSize: 12.5, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>
          {total} áreas · {abiertas} tareas abiertas
        </span>
      </div>

      <div style={{ display: 'grid', gap: 18 }}>
        {familias.map((f) => {
          const visibles = f.grupos.map((g) => ({ ...g, areas: g.areas.filter(pasa) })).filter((g) => g.areas.length);
          if (!visibles.length) return null;
          const n = visibles.reduce((s, g) => s + g.areas.length, 0);
          return (
            <section key={f.familia} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <header style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '16px 20px 13px', borderBottom: '1px solid var(--border)' }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 660, letterSpacing: '-0.015em' }}>{f.familia}</h2>
                <span style={{ fontSize: 13, color: 'var(--dim)' }}>{f.proposito}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
              </header>
              {visibles.map((g) => (
                <div key={g.grupo || '_'}>
                  {g.grupo && (
                    <h3 style={{ margin: 0, padding: '12px 20px 4px', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--faint)' }}>
                      {g.grupo}
                    </h3>
                  )}
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {g.areas.map((a) => (
                      <li key={a.slug} style={{ borderTop: '1px solid var(--border)' }}>
                        <Link
                          href={`/admin/dev/${a.slug}`}
                          style={{
                            display: 'grid', gridTemplateColumns: '3px 1fr auto 44px 96px', alignItems: 'center',
                            gap: 14, padding: '9px 20px 9px 0', textDecoration: 'none', color: 'inherit',
                          }}
                        >
                          <span style={{ alignSelf: 'stretch', background: COLOR[a.estado], borderRadius: '0 2px 2px 0' }} aria-hidden />
                          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                            {a.agente && <span title="Agente: corre solo" style={{ color: 'var(--mako-ink)', fontSize: 11 }}>◆</span>}
                            <Tooltip text={a.alcance}>
                              <span style={{ fontWeight: 530, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titulo}</span>
                            </Tooltip>
                          </span>
                          <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>{a.nota ? '⚑' : ''}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--warn)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {a.abiertas ? `${a.abiertas}t` : ''}
                          </span>
                          <span style={{ fontSize: 11.5, textAlign: 'right', color: a.estado === 'listo' ? 'var(--good)' : a.estado === 'parcial' ? 'var(--warn)' : 'var(--faint)' }}>
                            {ROTULO[a.estado]}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}
