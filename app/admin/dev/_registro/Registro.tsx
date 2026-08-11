'use client';

// =============================================================================
// El Roadmap y el Change History — la pantalla de todo registro de área
// =============================================================================
// Nació adentro de la sub-tab del rediseño y se mueve acá cuando dejó de haber
// una sola: Onboarding, General, Chatbot y Ads Generator tienen la misma
// pantalla con otros datos. Lo único que cambia por área es el CONTENIDO —que
// vive en el `bitacora.ts` de cada una— y eso es lo único que se escribe a
// mano, porque es lo único que ningún código puede deducir: el porqué.
//
// Las filas del historial arrancan PLEGADAS. Con más de treinta entradas y el
// pedido textual adentro, una lista abierta son ~9.000 px: para llegar a la de
// abajo hay que scrollear un rato y no se puede barrer la historia de un
// vistazo. Plegada, el índice entero entra en dos pantallas.

import { useEffect, useState } from 'react';
import { Section, Avatar, EmptyState, MONO } from '@/app/_ui';
// El mismo «ver más» del historial de Proyectos del plan. Vive ahí y no en
// app/_ui porque nació ahí; se importa en vez de escribir un segundo.
import { useVerMas } from '@/app/plan/board/VerMas';
import { ClaudeMark } from '@/app/_components/icons';
import { CUENTAS, TIPOS, type Hito, type Parte } from './tipos';

/** `**negrita**` y `` `código` `` — lo mínimo para que el historial se lea. */
export function texto(s: string) {
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

// ── Roadmap ──────────────────────────────────────────────────────────────────
export function Roadmap({ partes }: { partes: Parte[] }) {
  return (
    <Section titulo="Roadmap">
      {partes.length === 0 ? (
        <EmptyState titulo="Sin fases todavía" detalle="Se escriben en el bitacora.ts de esta área." />
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
          {partes.map((p, i) => {
            const c = CHIP[p.estado];
            return (
              <li key={p.titulo} style={{ display: 'grid', gridTemplateColumns: '34px minmax(0,1fr) auto', gap: 14, alignItems: 'center', padding: '13px 16px', background: p.estado === 'hecha' ? 'var(--good-bg)' : 'var(--surface)' }}>
                <span style={{ fontFamily: MONO, fontSize: 13, color: p.estado === 'hecha' ? 'var(--good)' : 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--ink)' }}>
                  {p.titulo}
                  {/* Pasa por `texto()` igual que los puntos de la bitácora: el detalle
                      de una fase nombra funciones y archivos, y sin esto los backticks
                      y los ** se leían literales en pantalla. Estaba así en las siete
                      áreas — el helper existía y el Roadmap era el único que no lo usaba. */}
                  <span style={{ display: 'block', fontWeight: 400, fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginTop: 2 }}>{texto(p.detalle)}</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', background: c.bg, color: c.c, border: `1px solid ${p.estado === 'cola' ? 'var(--border-strong)' : `color-mix(in srgb, ${c.c} 35%, transparent)`}` }}>
                  {p.estado !== 'cola' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />}
                  {c.t}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}

// ── Change History ───────────────────────────────────────────────────────────
/**
 * Un color por actor. Es CATEGORÍA, no estado: dice QUIÉN, no si algo salió
 * bien. Por eso no usa los semánticos de la casa.
 *   · naranja `#D97757` — el de Claude
 *   · azul    `#2F6FED` — los pedidos del dueño
 */
const COLOR = { claude: '#D97757', martin: '#2F6FED' } as const;

function Meta({ h }: { h: Hito }) {
  const c = CUENTAS[h.cuenta];
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginTop: 3, fontSize: 'var(--fs-meta)', color: 'var(--faint)', lineHeight: 1.5 }}>
      <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{h.fecha} · {h.hora}</span>
      <span aria-hidden>·</span>
      {/* El rótulo va tenue y el valor firme: así el ojo salta de un nombre de
          chat al siguiente sin releer «Nombre del chat» treinta veces. */}
      <span style={{ minWidth: 0 }}>
        Nombre del chat: <span style={{ color: 'var(--dim)' }}>{h.chat}</span>
      </span>
      <span aria-hidden>·</span>
      <span style={{ whiteSpace: 'nowrap' }}>Cuenta {c.n}: <span style={{ color: 'var(--dim)' }}>{c.nombre}</span></span>
    </div>
  );
}

function Bloque({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 600, marginBottom: 7 }}>{rotulo}</div>
      {children}
    </div>
  );
}

function Detalle({ h }: { h: Hito }) {
  return (
    <div style={{ paddingBottom: 6 }}>
      {h.pedido && (
        // El pedido va TEXTUAL. Resumido perdería lo que más sirve: cómo lo
        // dijo. La mitad de las reglas de la casa salieron de una frase suya.
        <blockquote style={{ margin: '12px 0 0', padding: '11px 15px', background: 'var(--surface-2)', borderLeft: `2px solid ${COLOR.martin}`, borderRadius: '0 var(--r-sm) var(--r-sm) 0', fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {h.pedido}
        </blockquote>
      )}

      {h.puntos.length > 0 && (
        <ul style={{ margin: '14px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {h.puntos.map((p, k) => (
            <li key={k} style={{ position: 'relative', paddingLeft: 16, fontSize: 'var(--fs-sm)', lineHeight: 1.6, color: 'var(--dim)' }}>
              <span style={{ position: 'absolute', left: 1, top: '.66em', width: 5, height: 5, borderRadius: '50%', background: 'var(--faint)' }} />
              {texto(p)}
            </li>
          ))}
        </ul>
      )}

      {h.archivos && (
        <Bloque rotulo="Dónde vive">
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {h.archivos.map((a, k) => {
              const corte = a.indexOf(' — ');
              const ruta = corte > 0 ? a.slice(0, corte) : a;
              const que = corte > 0 ? a.slice(corte + 3) : '';
              return (
                <li key={k} style={{ fontSize: 'var(--fs-meta)', lineHeight: 1.55, color: 'var(--dim)' }}>
                  <code style={{ fontFamily: MONO, color: 'var(--ink)' }}>{ruta}</code>
                  {que && <span> — {que}</span>}
                </li>
              );
            })}
          </ul>
        </Bloque>
      )}

      {h.commits && (
        <Bloque rotulo={h.commits.length > 1 ? 'Commits' : 'Commit'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
            {h.commits.map((c) => (
              <div key={c.sha} style={{ display: 'grid', gridTemplateColumns: '68px minmax(0,1fr) auto', gap: 12, alignItems: 'baseline', padding: '8px 11px', background: 'var(--surface)' }}>
                <code style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--ink)', fontWeight: 600 }}>{c.sha}</code>
                <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--dim)', lineHeight: 1.45 }}>{c.msg}</span>
                <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  +{c.lineas} · {c.archivos} arch.
                </span>
              </div>
            ))}
          </div>
        </Bloque>
      )}
    </div>
  );
}

export function ChangeHistory({ hitos }: { hitos: Hito[] }) {
  // El array se mantiene en orden cronológico —se agrega al final, que es lo
  // natural al escribirlo— pero se LEE al revés: lo último que pasó va arriba.
  const recientes = [...hitos].reverse();
  const { visibles, boton } = useVerMas(recientes, { inicial: 14, tanda: 14, estilo: 'texto' });
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());

  // La foto de perfil del dueño, de `/api/perfil` (`usuarios.foto_url`). El
  // NOMBRE en cambio va fijo: el autor de estos pedidos es Martín, no «quien
  // esté logueado» — en local con dev-login el perfil es «Dev (local)» y las
  // iniciales saldrían «D(». Sin foto, `Avatar` cae a iniciales.
  const [foto, setFoto] = useState('');
  useEffect(() => {
    let vivo = true;
    fetch('/api/perfil').then((r) => r.json()).then((j) => {
      if (vivo && j?.ok && j.perfil) setFoto((j.perfil.avatarUrl as string) || '');
    }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const alternar = (k: string) => setAbiertas((prev) => {
    const s = new Set(prev);
    if (s.has(k)) s.delete(k); else s.add(k);
    return s;
  });

  if (hitos.length === 0) {
    return (
      <Section titulo="Change History">
        <EmptyState
          titulo="Todavía no hay historia"
          detalle="Se llena trabajando: cada tanda deja una entrada en el bitacora.ts de esta área."
        />
      </Section>
    );
  }

  const todasAbiertas = visibles.every((h, i) => abiertas.has(h.titulo + i));

  return (
    <Section
      titulo="Change History"
      accion={
        <button type="button" className="mk-vermas"
          onClick={() => setAbiertas(todasAbiertas ? new Set() : new Set(visibles.map((h, i) => h.titulo + i)))}>
          {todasAbiertas ? 'Plegar todo' : 'Desplegar todo'}
        </button>
      }
    >
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {visibles.map((h, i) => {
          const clave = h.titulo + i;
          const abierta = abiertas.has(clave);
          const color = COLOR[h.actor];
          // La línea se corta en el último VISIBLE, no en el último del array:
          // si no, cuelga en el aire cuando hay entradas todavía plegadas.
          const ultimo = i === visibles.length - 1;
          return (
            <li key={clave} style={{ position: 'relative', paddingLeft: 32 }}>
              {/* El riel: la línea entre puntos y el punto de esta entrada. */}
              <span aria-hidden style={{ position: 'absolute', left: 10, top: 24, bottom: 0, width: 1, background: ultimo ? 'transparent' : 'var(--border)' }} />
              <span aria-hidden style={{ position: 'absolute', left: 6.5, top: 20, width: 9, height: 9, borderRadius: '50%', background: color, boxShadow: '0 0 0 3px var(--surface)' }} />

              <button type="button" className="mk-hist__cab" onClick={() => alternar(clave)} aria-expanded={abierta}>
                <span style={{ display: 'flex', flex: 'none', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: h.actor === 'claude' ? 'color-mix(in srgb, #D97757 14%, transparent)' : 'transparent' }}>
                  {h.actor === 'claude' ? <ClaudeMark size={17} /> : <Avatar name="Martín" url={foto} size={28} />}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 'var(--fs-card)', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>
                    <span style={{ color }}>{TIPOS[h.tipo]}:</span> {h.titulo}
                  </span>
                  <Meta h={h} />
                </span>
                <span aria-hidden style={{ flex: 'none', color: 'var(--faint)', fontSize: 11, alignSelf: 'center', transform: abierta ? 'rotate(90deg)' : 'none', transition: 'transform .15s ease' }}>›</span>
              </button>

              {abierta && <div style={{ paddingBottom: 8 }}><Detalle h={h} /></div>}
              {!abierta && <div style={{ height: 6 }} />}
            </li>
          );
        })}
      </ol>
      {boton}
    </Section>
  );
}
