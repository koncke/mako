// =============================================================================
// Rediseño en curso — el registro vivo de la Fase 1
// =============================================================================
// LA BARRA Y LOS ÍCONOS DE ESTA PÁGINA NO ESTÁN ESCRITOS ACÁ: se leen de
// app/_components/nav.ts y se pintan con el mismo <Icon> del Sidebar. Es la
// única forma de que la página no mienta — si mañana se renombra una tab y nadie
// toca este archivo, acá se ve el nombre nuevo.
//
// Lo único escrito a mano es la BITÁCORA (bitacora.ts), que es lo que ningún
// código puede deducir: el porqué de cada cambio.
//
// Server component a propósito: no tiene nada interactivo, así que no hace falta
// mandarle nada al navegador.

import { FAMILIAS, MAKO_NAV, USER_NAV, type NavItem } from '@/app/_components/nav';
import { Icon } from '@/app/_components/icons';
import { Section } from '@/app/_ui/PageHeader';
import { MONO } from '@/app/_ui/tokens';
import { BITACORA, PARTES } from './bitacora';

const NAV = '#14161B';
const NAV_TEXT = '#949CAA';
const ON_NAV = '#F3F5F8';

/** `**negrita**` y `` `código` `` — lo mínimo para que la bitácora se lea. */
function texto(s: string) {
  const partes = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return partes.map((p, k) => {
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

export function Rediseno() {
  const destinos = FAMILIAS.reduce(
    (n, f) => n + f.bloques.flat().length + (f.grupos ?? []).reduce((m, g) => m + g.items.length, 0), 0,
  );
  const hechas = PARTES.filter((p) => p.estado === 'hecha').length;

  return (
    <main style={{ flex: 1, minWidth: 0, padding: 'var(--card-pad)', maxWidth: 1000 }}>
      <header style={{ paddingBottom: 24, borderBottom: '1px solid var(--border)', marginBottom: 'var(--sect-gap)' }}>
        <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)' }}>
          MaKo · Rediseño global · Fase 1
        </span>
        <h1 style={{ margin: '10px 0 0', fontSize: 'var(--fs-page)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15, color: 'var(--ink)' }}>
          Rediseño en curso
        </h1>
        <p style={{ margin: '10px 0 0', fontSize: 'var(--fs-md)', color: 'var(--dim)', lineHeight: 1.6, maxWidth: '64ch' }}>
          El registro de lo que se fue cambiando y cómo quedó la aplicación. La barra y los íconos de
          esta página salen del código real: lo que ves acá es lo que hay.
        </p>
        <p style={{ margin: '16px 0 0', borderLeft: '2px solid var(--mako)', padding: '2px 0 2px 14px', fontSize: 'var(--fs-md)', color: 'var(--dim)', lineHeight: 1.6, maxWidth: '62ch' }}>
          «El rediseño no debe comenzar corrigiendo pantallas aisladas. Sin un sistema global, cada
          tab volverá a resolver localmente los mismos problemas.»
        </p>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginTop: 20 }}>
          {[[`${hechas} / ${PARTES.length}`, 'partes terminadas'], [FAMILIAS.length, 'secciones en la barra'], [destinos, 'destinos'], [BITACORA.length, 'entradas de bitácora']].map(([n, l]) => (
            <span key={String(l)}>
              <b style={{ display: 'block', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{n}</b>
              <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)' }}>{l}</span>
            </span>
          ))}
        </div>
      </header>

      {/* ── Las nueve partes ─────────────────────────────────────────────── */}
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
      </Section>

      {/* ── La barra ─────────────────────────────────────────────────────── */}
      <Section titulo="La barra, tal como quedó" nota="sale de nav.ts: si cambia la navegación, cambia esto">
        <div style={{ background: NAV, borderRadius: 18, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {FAMILIAS.map((f) => (
            <section key={f.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 2px 8px', color: ON_NAV, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', flex: 'none' }}><Icon name={f.icon} size={17} /></span>
                <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '.17em', textTransform: 'uppercase', fontWeight: 700 }}>{f.label}</span>
                <span style={{ fontSize: 12, color: NAV_TEXT }}>{f.pregunta}</span>
              </div>
              <div style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 'var(--r-lg)', padding: 5 }}>
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
              <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '.17em', textTransform: 'uppercase', fontWeight: 700 }}>Fuera de las familias</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 'var(--r-lg)', padding: 5 }}>
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

      {/* ── Color ────────────────────────────────────────────────────────── */}
      <Section titulo="Un significado por color" nota="si el mismo color dice cinco cosas, no dice ninguna">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
          {[
            ['MaKo', '#F2B01E', 'Marca, y «acá intervino la inteligencia»'],
            ['Acción', '#2F6FED', 'Vos actuás: botones, links, foco'],
            ['Resultado', '#1E9E57', 'Favorable o completado'],
            ['Cuidado', '#EE7B1C', 'Anaranjado a propósito, para no ser dorado'],
            ['Riesgo', '#D0504A', 'Error o destrucción'],
            ['Neutro', '#98A0AC', 'Sin carga semántica'],
          ].map(([n, hex, q]) => (
            <div key={hex} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden', background: 'var(--surface)' }}>
              <div style={{ height: 52, background: hex }} />
              <div style={{ padding: '9px 11px' }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--ink)' }}>{n}</div>
                <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--dim)', marginTop: 2, lineHeight: 1.35 }}>{q}</div>
                <div style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', marginTop: 5 }}>{hex}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Bitácora ─────────────────────────────────────────────────────── */}
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
      </Section>

      <footer style={{ marginTop: 40, paddingTop: 22, borderTop: '1px solid var(--border)' }}>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--ink)' }}>Dónde mirar lo demás.</strong> El catálogo vivo de
          la biblioteca está en <code style={{ fontFamily: MONO }}>/admin/ui</code>, con los estados
          que en la app son difíciles de provocar. Las reglas escritas viven en{' '}
          <code style={{ fontFamily: MONO }}>app/_ui/LEEME.md</code>.
        </p>
        <p style={{ margin: '12px 0 0', fontSize: 'var(--fs-meta)', color: 'var(--faint)', lineHeight: 1.55 }}>
          La bitácora se escribe en <code style={{ fontFamily: MONO }}>app/admin/rediseno/bitacora.ts</code>.
          Todo lo demás de esta página se lee del código.
        </p>
      </footer>
    </main>
  );
}
