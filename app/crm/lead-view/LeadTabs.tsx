'use client';

// =============================================================================
// LeadTabs — tabs del detalle del lead (texto con subrayado activo)
// =============================================================================
// Genérico: recibe la lista de tabs con su contenido (ReactNode, server
// components incluidos). Lo usan la ruta /crm/[id] y el modal de preview.

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

const SANS = "'Geist', sans-serif";

export type LeadTabDef = {
  key: string;
  label: string;
  content: ReactNode;
  badge?: number;
};

export function LeadTabs({ tabs, initial, onChange, actions, fija, irA }: {
  tabs: LeadTabDef[];
  initial?: string;
  onChange?: (key: string) => void;
  /** Contenido extra a la derecha de la fila de tabs (ej. botón Editar). */
  actions?: ReactNode;
  /**
   * LA FILA DE PESTAÑAS QUEDA PEGADA ARRIBA al scrollear, con el fondo de quien la contiene.
   *
   * Pedido de Martín (12/10/2026, punto 16): «Cuando hago scroll por el modal, las tabs de arriba
   * deben acompañar el scroll. Deben permanecer fijas, como todo lo que esta arriba».
   *
   * ⚠️ UN STICKY SE PEGA A SU ANCESTRO QUE SCROLLEA, y ese ancestro tiene que TENER ALTO (AGENTS.md:
   * un `overflow-y: auto` sin alto crece con su contenido y no scrollea nunca). En el pop-up es el
   * cuerpo de la ficha (`flex: 1; minHeight: 0; overflowY: auto` adentro de un panel con alto
   * topeado); en la ruta /crm/[id], el documento. Por eso esta fila no puede vivir adentro de nada
   * con `overflow`: la raíz de LeadTabs no lleva ninguno.
   */
  fija?: { fondo: string };
  /**
   * Cambiar de tab DESDE AFUERA: «solucionar» un dato sin marcar lleva a la tab donde vive su
   * campo (13/10/2026). `n` cambia en cada pedido, así pedir dos veces la misma tab vuelve a
   * correr el efecto aunque ya se esté ahí.
   */
  irA?: { key: string; n: number } | null;
}) {
  const initKey = initial && tabs.some((t) => t.key === initial) ? initial : tabs[0]?.key ?? '';
  const [tab, setTab] = useState<string>(initKey);
  // Las tabs ya visitadas quedan MONTADAS (ocultas con display:none): cambiar de
  // tab no descarta estado del cliente (insight recién generado, chat cargado).
  const [visitadas, setVisitadas] = useState<string[]>([initKey]);
  useEffect(() => {
    if (!irA || !tabs.some((t) => t.key === irA.key)) return;
    setTab(irA.key);
    setVisitadas((v) => (v.includes(irA.key) ? v : [...v, irA.key]));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sólo cuando llega un pedido nuevo
  }, [irA?.n]);

  // ⚠️ `minHeight: var(--touch)`: 40 px con mouse (lo que ya medía) y 44 en una pantalla táctil, un iPad con la
  // computadora adaptada (app/globals.css, `pointer: coarse`; Martín, 14/10/2026: «La app de MaKo se debe
  // adaptar al tamaño de la pantalla siempre»).
  const tabBtn = (active: boolean): CSSProperties => ({
    position: 'relative', padding: '11px 2px', marginRight: 22, border: 'none', background: 'transparent', minHeight: 'var(--touch)',
    fontFamily: SANS, fontSize: 15, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none',
    color: active ? 'var(--primary)' : 'var(--dim)',
    borderBottom: '2px solid ' + (active ? 'var(--primary)' : 'transparent'),
    display: 'inline-flex', alignItems: 'center', gap: 7,
  });

  const activeKey = tabs.some((t) => t.key === tab) ? tab : tabs[0]?.key ?? '';

  return (
    <div>
      {/* Las tabs BAJAN de renglón si no entran; no scrollean.
          Antes scrolleaban de costado y encima con la barra de scroll oculta por
          CSS (`.lead-tabs-scroll`), así que las últimas tabs del lead no tenían
          ni una pista de que existían. Una barra de navegación no esconde
          destinos detrás de un gesto: si no entran, se ven en dos renglones.
          Las acciones (el dropdown de etapa) siguen en la misma línea. */}
      <div style={{
        borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12,
        ...(fija ? { position: 'sticky' as const, top: 0, zIndex: 5, background: fija.fondo, paddingTop: 6 } : {}),
      }}>
        <div role="tablist" style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, flex: 1 }}>
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button key={t.key} role="tab" aria-selected={active} onClick={() => { setTab(t.key); setVisitadas((v) => (v.includes(t.key) ? v : [...v, t.key])); onChange?.(t.key); }} style={tabBtn(active)}>
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span style={{ fontSize: 11.5, fontWeight: 700, minWidth: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, padding: '0 6px', background: active ? 'rgba(47,111,237,.12)' : 'var(--surface-2)', color: active ? 'var(--primary)' : 'var(--dim)', border: '1px solid ' + (active ? 'var(--primary)' : 'var(--border)') }}>{t.badge}</span>
              )}
            </button>
          );
        })}
        </div>
        {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', flex: 'none' }}>{actions}</div>}
      </div>
      <div role="tabpanel" style={{ marginTop: 20 }}>
        {tabs
          .filter((t) => t.key === activeKey || visitadas.includes(t.key))
          .map((t) => (
            <div key={t.key} style={{ display: t.key === activeKey ? 'flex' : 'none', flexDirection: 'column', gap: 18 }}>
              {t.content}
            </div>
          ))}
      </div>
    </div>
  );
}
