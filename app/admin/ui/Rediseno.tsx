'use client';

// =============================================================================
// Las secciones del registro del rediseño, dentro de /admin/ui
// =============================================================================
// LA BARRA Y LOS ÍCONOS NO ESTÁN ESCRITOS ACÁ: se leen de app/_components/nav.ts
// y se pintan con el mismo <Icon> del Sidebar. Es la única forma de que esto no
// mienta — si mañana se renombra una tab y nadie toca este archivo, acá se ve el
// nombre nuevo.
//
// Lo único escrito a mano es la BITÁCORA (bitacora.ts), que es lo que ningún
// código puede deducir: el porqué de cada cambio.

import { FAMILIAS, MAKO_NAV, USER_NAV, type NavItem } from '@/app/_components/nav';
import { Icon } from '@/app/_components/icons';
import { Section, MONO } from '@/app/_ui';
import { BITACORA, PARTES } from './bitacora';

const NAV = '#14161B';
const NAV_TEXT = '#949CAA';
const ON_NAV = '#F3F5F8';

/** `**negrita**` y `` `código` `` — lo mínimo para que la bitácora se lea. */
function texto(s: string) {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((p, k) => {
    if (p.startsWith('**')) return <strong key={k} style={{ color: 'var(--ink)', fontWeight: 600 }}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('`')) return <code key={k} style={{ fontFamily: MONO, fontSize: '.9em', color: 'var(--ink)' }}>{p.slice(1, -1)}</code>;
    return <span key={k}>{p}</span>;
  });
}

const CHIP = {
  hecha: { t: 'Hecha', bg: 'var(--good-bg)', c: 'var(--good)' },
  sigue: { t: 'Sigue', bg: 'var(--primary-bg)', c: 'var(--primary)' },
  cola: { t: 'En cola', bg: 'var(--surface-2)', c: 'var(--faint)' },
} as const;

// ── Las nueve partes ─────────────────────────────────────────────────────────
export function Partes() {
  return (
    <Section titulo="Las nueve partes" nota="las 21 tareas del board (#516–#535 y #538), agrupadas por lo que entregan">
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        {PARTES.map((p, i) => {
          const c = CHIP[p.estado];
          return (
            <li key={p.titulo} style={{ display: 'grid', gridTemplateColumns: '34px minmax(0,1fr) auto', gap: 14, alignItems: 'center', padding: '13px 16px', background: p.estado === 'hecha' ? 'var(--good-bg)' : 'var(--surface)' }}>
              <span style={{ fontFamily: MONO, fontSize: 13, color: p.estado === 'hecha' ? 'var(--good)' : 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--ink)' }}>
                {p.titulo}
                <span style={{ display: 'block', fontWeight: 400, fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginTop: 2 }}>{p.detalle}</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', background: c.bg, color: c.c, border: `1px solid ${p.estado === 'cola' ? 'var(--border-strong)' : `color-mix(in srgb, ${c.c} 35%, transparent)`}` }}>
                {p.estado !== 'cola' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />}
                {c.t}
              </span>
            </li>
          );
        })}
      </ol>
      <p style={{ margin: '14px 0 0', fontSize: 'var(--fs-meta)', color: 'var(--dim)', lineHeight: 1.55 }}>
        El orden lo fija el documento: «el rediseño no debe comenzar corrigiendo pantallas aisladas».
        Sin la biblioteca, cada tab vuelve a resolver localmente los mismos problemas.
      </p>
    </Section>
  );
}

// ── La bitácora ──────────────────────────────────────────────────────────────
export function Bitacora() {
  return (
    <Section titulo="Qué se fue cambiando" nota="en orden, con el porqué — los errores también">
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {BITACORA.map((h, i) => (
          <li key={h.titulo + i} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: 16 }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', paddingTop: 20, fontVariantNumeric: 'tabular-nums' }}>{String(i + 1).padStart(2, '0')}</span>
            <div style={{ borderLeft: `1px solid ${i === BITACORA.length - 1 ? 'transparent' : 'var(--border)'}`, padding: '16px 0 16px 18px', position: 'relative' }}>
              <span style={{ position: 'absolute', left: -4.5, top: 22, width: 8, height: 8, borderRadius: '50%', background: 'var(--mako)' }} />
              <div style={{ fontSize: 'var(--fs-card)', fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                {h.titulo}
                <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', fontWeight: 400 }}>{h.fecha}</span>
              </div>
              <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {h.puntos.map((p, k) => (
                  <li key={k} style={{ position: 'relative', paddingLeft: 16, fontSize: 'var(--fs-sm)', lineHeight: 1.55, color: 'var(--dim)' }}>
                    <span style={{ position: 'absolute', left: 1, top: '.62em', width: 5, height: 5, borderRadius: '50%', background: 'var(--faint)' }} />
                    {texto(p)}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
      <p style={{ margin: '16px 0 0', fontSize: 'var(--fs-meta)', color: 'var(--faint)', lineHeight: 1.55 }}>
        Se escribe en <code style={{ fontFamily: MONO }}>app/admin/ui/bitacora.ts</code>. Todo lo demás
        de esta pantalla se lee del código.
      </p>
    </Section>
  );
}

// ── La barra ─────────────────────────────────────────────────────────────────
/** Una fila de la barra, igual que se ve, con su ruta al lado. */
function Fila({ item }: { item: NavItem }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '7px 10px', borderRadius: 'var(--r-sm)', fontSize: 13, color: NAV_TEXT }}>
      <span style={{ display: 'flex', flex: 'none', color: NAV_TEXT }}><Icon name={item.icon} size={19} /></span>
      <span style={{ color: ON_NAV, fontWeight: 500, flex: 'none' }}>{item.label}</span>
      <code style={{ fontFamily: MONO, fontSize: 11, opacity: 0.7 }}>{item.href}</code>
      {item.comingSoon && (
        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 8.5, letterSpacing: '.06em', textTransform: 'uppercase', border: '1px solid currentColor', borderRadius: 5, padding: '1px 5px', opacity: 0.5 }}>pronto</span>
      )}
    </div>
  );
}

const caja = { background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 'var(--r-lg)', padding: 5 } as const;
const rotulo = { fontFamily: MONO, fontSize: 12, letterSpacing: '.17em', textTransform: 'uppercase', fontWeight: 700 } as const;

export function LaBarra() {
  const destinos = FAMILIAS.reduce(
    (n, f) => n + f.bloques.flat().length + (f.grupos ?? []).reduce((m, g) => m + g.items.length, 0), 0,
  );
  return (
    <Section titulo="La barra, tal como quedó" nota={`${FAMILIAS.length} secciones · ${destinos} destinos · sale de nav.ts`}>
      <div style={{ background: NAV, borderRadius: 18, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {FAMILIAS.map((f) => (
          <section key={f.key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 2px 8px', color: ON_NAV, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', flex: 'none' }}><Icon name={f.icon} size={17} /></span>
              <span style={rotulo}>{f.label}</span>
              <span style={{ fontSize: 12, color: NAV_TEXT }}>{f.pregunta}</span>
            </div>
            <div style={caja}>
              {f.bloques.map((b, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 1, ...(i ? { marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,.06)' } : {}) }}>
                  {b.map((it) => <Fila key={it.key} item={it} />)}
                </div>
              ))}
              {(f.grupos ?? []).map((g) => (
                <div key={g.key} style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '7px 10px', fontSize: 13, color: NAV_TEXT }}>
                    <span style={{ display: 'flex', flex: 'none' }}><Icon name={g.icon} size={19} /></span>
                    <span style={{ color: ON_NAV, fontWeight: 500 }}>{g.label}</span>
                    <span style={{ marginLeft: 'auto', opacity: 0.6 }}>›</span>
                  </div>
                  <div style={{ margin: '2px 0 0 22px', paddingLeft: 12, borderLeft: '1px solid rgba(255,255,255,.09)', display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {g.items.map((it) => <Fila key={it.key} item={it} />)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 2px 8px', color: ON_NAV }}>
            <span style={rotulo}>Fuera de las familias</span>
          </div>
          <div style={caja}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {MAKO_NAV.map((it) => <Fila key={it.key} item={it} />)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,.06)' }}>
              {USER_NAV.map((it) => <Fila key={it.key} item={it} />)}
            </div>
          </div>
        </section>
      </div>
      <p style={{ margin: '12px 0 0', fontSize: 'var(--fs-meta)', color: 'var(--dim)', lineHeight: 1.5 }}>
        Arriba de todo, la capacidad global de MaKo. Abajo, lo que vive detrás del avatar — más el
        saldo de IA. Los grupos con <span style={{ opacity: 0.7 }}>›</span> abren un desplegable al costado.
      </p>
    </Section>
  );
}
