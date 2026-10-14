// =============================================================================
// Bloques — los bloques nuevos de /general que se dibujan en el server: Prioridades del Plan y Tu funnel hoy
// =============================================================================
// Los dos son SECCIONES de la casa (la fórmula de /general, /comercial y /marketing): título de 25 px, adentro una
// lista con filete o barras. Ninguno inventa una forma nueva — personalizar /general es elegir bloques del diseño
// restaurado, no rediseñarlo (memoria general-diseno-restaurado).
//
//   · PRIORIDADES DEL PLAN — las de la vista Prioridades del tablero, calculadas por `prioridadesDelTablero`
//     (app/plan/board/prioridades.ts) a través de `leerPlanHoy` (lib/plan-hoy.ts), la MISMA lectura del Today del
//     teléfono. Una segunda cuenta de «qué va primero» contestaría distinto que el tablero.
//   · TU FUNNEL HOY — cuántos leads hay en cada etapa (`conteoDelFunnel`, lib/general-alcance.ts), con una barra por
//     etapa a la escala de la etapa más llena. El color de cada barra es el `dot` de la etapa en el CRM: el mismo
//     color que la columna del tablero.

import type { CSSProperties } from 'react';
import Link from '@/app/_ui/Link';
import { PLABEL, PCOLOR } from '@/app/plan/board/types';
import type { ItemPlan } from '@/app/plan/board/hoy';
import type { ConteoFunnel } from '@/lib/general-alcance';

const H2: CSSProperties = { fontWeight: 600, fontSize: 25, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' };
const LINK: CSSProperties = { fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--primary)', textDecoration: 'none', whiteSpace: 'nowrap' };

function fechaCorta(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/** El título de una sección con su link a la derecha. */
function Cabeza({ titulo, extra, href, label }: { titulo: string; extra?: string | null; href: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
        <h2 style={H2}>{titulo}</h2>
        {extra && <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--dim)' }}>{extra}</span>}
      </div>
      <Link href={href} style={LINK}>{label} →</Link>
    </div>
  );
}

export function PrioridadesGeneral({ items, objetivo, error }: {
  items: ItemPlan[];
  /** El proyecto que manda en el tablero (el Objetivo Principal del Plan). */
  objetivo: { nombre: string; emoji: string } | null;
  error?: boolean;
}) {
  return (
    <>
      <Cabeza titulo="Prioridades del Plan" extra={objetivo ? `${objetivo.emoji} ${objetivo.nombre}` : null} href="/plan" label="Abrir el Plan" />
      {error ? (
        <span style={{ fontSize: 'var(--fs-md)', color: 'var(--dim)' }}>No pude leer el Plan.</span>
      ) : !items.length ? (
        <span style={{ fontSize: 'var(--fs-card)', color: 'var(--dim)' }}>No hay tareas abiertas en prioridad.</span>
      ) : (
        <div>
          {items.map((t, i) => (
            <Link key={t.id} href={t.linkEscritorio} data-prioridad={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', textDecoration: 'none',
              borderTop: i === 0 ? 'none' : '1px solid var(--border)',
            }}>
              <span style={{ flex: 'none', width: 22, fontWeight: 700, fontSize: 'var(--fs-md)', color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 'var(--fs-card)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titulo}</span>
                {t.proyecto && (
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.proyecto.emoji} {t.proyecto.nombre}
                  </span>
                )}
              </span>
              {t.deadline && (
                <span style={{ flex: 'none', fontSize: 'var(--fs-sm)', color: t.vencida ? 'var(--bad)' : 'var(--dim)', fontWeight: t.vencida ? 600 : 400, fontVariantNumeric: 'tabular-nums' }}>
                  {t.vencida ? 'vencida · ' : ''}{fechaCorta(t.deadline)}
                </span>
              )}
              <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>
                <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: PCOLOR[t.banda] }} />
                {PLABEL[t.banda]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export function FunnelHoy({ conteos, error, alcance }: {
  conteos: ConteoFunnel[];
  error?: boolean;
  /** El alcance pedido no tiene ningún funnel (eligió ofertas que ningún funnel vende). */
  alcance: 'todo' | 'elegido' | 'vacio';
}) {
  return (
    <>
      <Cabeza titulo="Tu funnel hoy" href="/crm" label="Abrir el CRM" />
      {error ? (
        <span style={{ fontSize: 'var(--fs-md)', color: 'var(--dim)' }}>No pude leer el CRM.</span>
      ) : alcance === 'vacio' || !conteos.length ? (
        <span style={{ fontSize: 'var(--fs-card)', color: 'var(--dim)' }}>
          {alcance === 'vacio' ? 'Ningún funnel vende lo que elegiste.' : 'Todavía no hay un funnel.'}
        </span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          {conteos.map((c) => {
            const tope = Math.max(1, ...c.etapas.map((e) => e.n));
            return (
              <div key={c.funnelId} data-funnel={c.funnelId}>
                {conteos.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontWeight: 600, fontSize: 'var(--fs-card)', color: 'var(--ink)' }}>{c.nombre}</span>
                    <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{c.total} leads</span>
                  </div>
                )}
                {conteos.length === 1 && (
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginBottom: 10 }}>
                    {c.nombre} · <span style={{ fontVariantNumeric: 'tabular-nums' }}>{c.total} leads</span>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {c.etapas.map((e) => (
                    <div key={e.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 180px) 1fr 44px', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</span>
                      {/* La barra se recorta al 100% y su carril lleva overflow: hidden (AGENTS.md, «Una barra de
                          gráfico se recorta al 100%, siempre»). */}
                      <span style={{ display: 'block', height: 10, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                        <span style={{ display: 'block', height: '100%', borderRadius: 999, width: `${Math.min(100, (e.n / tope) * 100)}%`, background: e.dot || 'var(--primary)', opacity: e.n ? 1 : 0 }} />
                      </span>
                      <span style={{ textAlign: 'right', fontWeight: 600, fontSize: 'var(--fs-md)', color: e.n ? 'var(--ink)' : 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{e.n}</span>
                    </div>
                  ))}
                  {c.sinEtapa > 0 && (
                    <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)' }}>{c.sinEtapa} en una etapa que el funnel ya no tiene</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
