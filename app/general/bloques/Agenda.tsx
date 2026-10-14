'use client';

// =============================================================================
// Agenda — Mi día, las próximas llamadas y las próximas publicaciones (del Calendario)
// =============================================================================
// Los tres leen lo MISMO (los próximos 14 días del Calendario, app/general/datos.ts) y lo dibujan distinto: «Mi día»
// como la agenda de Google (la hora, el carril de color y la raya de «Ahora»), las llamadas con su fecha en un
// cuadradito como un evento de calendario, y las publicaciones como tarjetas con su formato.
//
// ⚠️ LA AGENDA DE GOOGLE SE DIBUJA Y NADA MÁS: no viaja a ningún modelo (AGENTS.md, «La agenda no pasa por IA»).
// ⚠️ Los colores son los del Calendario (`colorDe`, app/calendario/comun.ts): un evento se reconoce igual en las dos tabs.
// =============================================================================

import type { CSSProperties } from 'react';
import Link from '@/app/_ui/Link';
import { colorDe } from '@/app/calendario/comun';
import { ROTULO_FORMATO, diaDe, horaDe, sumarDias, type ItemCalendario, type FormatoPublicacion } from '@/lib/calendario-modelo';
import { opcionDe, numeroDe, type OpcionesElegidas } from '@/lib/general-piezas';
import type { DatosGeneral } from '../datos-tipos';
import { Cabeza, Fallo, Placeholder, diaCorto, diaDeSemana, useAhora } from './comun';
import { calendarioMuestra, hoyMuestra } from './muestras';

type Cal = { items: ItemCalendario[]; tz: string; hoy: string; falla: boolean };

const tzLocal = (): string => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; } };
const calMuestra = (): Cal => ({ items: calendarioMuestra(), tz: tzLocal(), hoy: hoyMuestra(), falla: false });
const destino = (it: ItemCalendario) => (it.href && it.href.startsWith('/') ? it.href : '/calendario');

// ── Mi día ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const deHoy = (c: Cal) => c.items.filter((it) => diaDe(it.inicio, c.tz) === c.hoy && it.capa !== 'objetivos');

function LineaDeTiempo({ c, items }: { c: Cal; items: ItemCalendario[] }) {
  const todoElDia = items.filter((it) => it.diaCompleto);
  const conHora = items.filter((it) => !it.diaCompleto);
  const ahora = useAhora();
  const iAhora = ahora ? conHora.findIndex((it) => it.inicio > ahora) : -1;
  const marcaAhora = ahora && (
    <div key="ahora" aria-label="Ahora" style={{ display: 'grid', gridTemplateColumns: '54px 14px 1fr', alignItems: 'center', margin: '2px 0' }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--bad)', textAlign: 'right', paddingRight: 8 }} className="gb-num">{horaDe(ahora, c.tz)}</span>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--bad)', justifySelf: 'center' }} />
      <span style={{ height: 2, background: 'var(--bad)', borderRadius: 2 }} />
    </div>
  );
  const filas = conHora.map((it) => {
    const color = colorDe(it);
    const pasado = !!ahora && (it.fin ?? it.inicio) < ahora;
    return (
      <Link key={it.id} href={destino(it)} style={{ display: 'grid', gridTemplateColumns: '54px 14px 1fr', alignItems: 'stretch', textDecoration: 'none', opacity: pasado ? 0.55 : 1 }}>
        <span style={{ fontSize: 12.5, color: 'var(--dim)', textAlign: 'right', paddingRight: 8, paddingTop: 9 }} className="gb-num">{horaDe(it.inicio, c.tz)}</span>
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ width: 2, flex: 1, background: 'var(--border)' }} />
        </span>
        <span style={{ margin: '3px 0', padding: '7px 12px', borderRadius: 10, background: `color-mix(in srgb, ${color} 14%, transparent)`, borderLeft: `4px solid ${color}`, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.titulo}</span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--dim)' }} className="gb-num">
            {horaDe(it.inicio, c.tz)}{it.fin ? ` – ${horaDe(it.fin, c.tz)}` : ''}{it.detalle ? ` · ${it.detalle}` : ''}
          </span>
        </span>
      </Link>
    );
  });
  if (marcaAhora) { if (iAhora >= 0) filas.splice(iAhora, 0, marcaAhora); else if (conHora.length) filas.push(marcaAhora); }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {todoElDia.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, paddingLeft: 68, flex: 'none' }}>
          {todoElDia.map((it) => (
            <Link key={it.id} href={destino(it)} className="gb-chip" style={{ background: colorDe(it), color: '#fff', borderColor: 'transparent', textDecoration: 'none' }}>{it.titulo}</Link>
          ))}
        </div>
      )}
      {/* Sólo lo que entra entero (`gb-cabe`, ./comun.tsx). */}
      <div className="gb-cabe">{filas}</div>
    </div>
  );
}

const FILA: CSSProperties = { gap: 12 };
const NOMBRE: CSSProperties = { fontSize: 14, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 };
const META: CSSProperties = { fontSize: 12.5, color: 'var(--dim)', flex: 'none' };

function ListaSimple({ c, items, conDia = false }: { c: Cal; items: ItemCalendario[]; conDia?: boolean }) {
  const manana = sumarDias(c.hoy, 1);
  return (
    <div className="gb-cabe">
      {items.map((it) => (
        <Link key={it.id} href={destino(it)} className="gb-fila" style={FILA}>
          <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: colorDe(it), flex: 'none' }} />
          <span style={{ ...META, minWidth: conDia ? 96 : 50 }} className="gb-num">
            {conDia ? `${diaCorto(diaDe(it.inicio, c.tz), c.hoy, manana)} · ` : ''}{it.diaCompleto ? 'Todo el día' : horaDe(it.inicio, c.tz)}
          </span>
          <span style={NOMBRE}>{it.titulo}</span>
          {it.detalle && <span style={META}>{it.detalle}</span>}
        </Link>
      ))}
    </div>
  );
}

function CuerpoMiDia({ c, vista }: { c: Cal; vista: string }) {
  const items = deHoy(c);
  return vista === 'lista' ? <ListaSimple c={c} items={items} /> : <LineaDeTiempo c={c} items={items} />;
}

export function BloqueMiDia({ d, op }: { d: DatosGeneral['calendario']; op?: OpcionesElegidas }) {
  if (!d.ok) return <Fallo titulo="Mi día" error={d.error} />;
  const vista = opcionDe('agenda', op, 'vista');
  const hay = deHoy(d.d).length > 0;
  return (
    <div className="gb">
      <Cabeza titulo="Mi día" href="/calendario?vista=dia" link="Abrir el Calendario" />
      {d.d.falla && <span className="gb-fallo" style={{ marginBottom: 8 }}>No pude leer todo el Calendario.</span>}
      {hay ? <CuerpoMiDia c={d.d} vista={vista} /> : (
        <Placeholder muestra={<CuerpoMiDia c={calMuestra()} vista={vista} />} texto="Nada agendado para hoy." accion={{ href: '/calendario?vista=dia', rotulo: 'Agendar algo' }} />
      )}
    </div>
  );
}

export function MuestraMiDia({ op }: { op?: OpcionesElegidas }) {
  return (
    <div className="gb">
      <Cabeza titulo="Mi día" />
      <CuerpoMiDia c={calMuestra()} vista={opcionDe('agenda', op, 'vista')} />
    </div>
  );
}

// ── Las próximas llamadas ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * Las llamadas del CRM (no las de Google) que no empezaron hace más de una hora, dentro de los días elegidos. Antes de
 * montar (`ahora` null) cuenta desde el principio de hoy: el server y el primer dibujo tienen que dar lo mismo.
 */
function llamadasDe(c: Cal, dias: number, ahora: string | null): ItemCalendario[] {
  const haceUnaHora = ahora ? new Date(Date.parse(ahora) - 60 * 60_000).toISOString() : '';
  const hasta = sumarDias(c.hoy, Math.max(1, dias) - 1);
  return c.items.filter((it) => it.capa === 'llamadas' && it.fuente !== 'google' && (!haceUnaHora || it.inicio >= haceUnaHora) && diaDe(it.inicio, c.tz) <= hasta);
}

function TarjetasLlamadas({ c, items }: { c: Cal; items: ItemCalendario[] }) {
  const manana = sumarDias(c.hoy, 1);
  return (
    <div className="gb-cabe">
      {items.map((it, i) => {
        const dia = diaDe(it.inicio, c.tz);
        const color = colorDe(it);
        const cuando = diaCorto(dia, c.hoy, manana);
        // La PRÓXIMA va en grande (la quinta vuelta, 14/10/2026: «textos enormes, cosas grandes»): es la que se mira.
        const grande = i === 0;
        return (
          // Filas con su línea, no una tarjeta por llamada: la fecha en su cuadradito, como un evento de calendario.
          <Link key={it.id} href={destino(it)} className="gb-fila" style={grande ? { paddingBottom: 14 } : undefined}>
            <span aria-hidden style={{ flex: 'none', width: grande ? 58 : 42, height: grande ? 62 : 44, borderRadius: grande ? 14 : 10, background: `color-mix(in srgb, ${color} 14%, transparent)`, color, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
              <span style={{ fontSize: grande ? 12 : 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{diaDeSemana(dia)}</span>
              <span style={{ fontSize: grande ? 26 : 18, fontWeight: 700 }} className="gb-num">{Number(dia.slice(8, 10))}</span>
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: grande ? 5 : 3, minWidth: 0, flex: 1 }}>
              <span style={grande ? { ...NOMBRE, fontSize: 'clamp(17px, 4.2cqi, 24px)', fontWeight: 700, letterSpacing: '-0.015em' } : NOMBRE}>{it.titulo}</span>
              <span style={{ fontSize: grande ? 'clamp(13.5px, 2.8cqi, 16px)' : 12.5, color: 'var(--dim)' }} className="gb-num">{horaDe(it.inicio, c.tz)}{it.detalle ? ` · ${it.detalle}` : ''}</span>
            </span>
            {(cuando === 'Hoy' || cuando === 'Mañana') && (
              <span className="gb-chip" style={cuando === 'Hoy' ? { background: color, color: '#fff', borderColor: 'transparent' } : undefined}>{cuando}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export function BloqueLlamadas({ d, op }: { d: DatosGeneral['calendario']; op?: OpcionesElegidas }) {
  const ahora = useAhora();
  if (!d.ok) return <Fallo titulo="Próximas llamadas" error={d.error} />;
  const dias = numeroDe(opcionDe('llamadas', op, 'dias'));
  const limite = numeroDe(opcionDe('llamadas', op, 'limite'));
  const items = llamadasDe(d.d, dias, ahora);
  return (
    <div className="gb">
      <Cabeza titulo="Próximas llamadas" extra={items.length ? `${items.length}` : null} href="/calendario?vista=agenda" link="Ver la agenda" />
      {items.length ? <TarjetasLlamadas c={d.d} items={items.slice(0, limite)} /> : (
        <Placeholder
          muestra={<TarjetasLlamadas c={calMuestra()} items={llamadasDe(calMuestra(), 14, null).slice(0, limite)} />}
          texto={dias === 1 ? 'Ninguna llamada hoy.' : `Ninguna llamada en los próximos ${dias} días.`}
          accion={{ href: '/crm', rotulo: 'Abrir el CRM' }}
        />
      )}
    </div>
  );
}

export function MuestraLlamadas({ op }: { op?: OpcionesElegidas }) {
  const c = calMuestra();
  return (
    <div className="gb">
      <Cabeza titulo="Próximas llamadas" />
      <TarjetasLlamadas c={c} items={llamadasDe(c, 14, null).slice(0, numeroDe(opcionDe('llamadas', op, 'limite')))} />
    </div>
  );
}

// ── Las próximas publicaciones ──────────────────────────────────────────────────────────────────────────────────────

/** Un color por formato (los de la paleta de Google, como el Calendario). */
const COLOR_FORMATO: Record<FormatoPublicacion, string> = { reel: '#8e24aa', story: '#f4511e', post: '#039be5', ad: '#e3a008', email: '#33b679', video: '#d50000', otro: '#616161' };

const publicacionesDe = (c: Cal, dias: number) => {
  const hasta = sumarDias(c.hoy, dias - 1);
  return c.items.filter((it) => it.capa === 'publicaciones' && diaDe(it.inicio, c.tz) <= hasta);
};

function TarjetasPublicaciones({ c, items }: { c: Cal; items: ItemCalendario[] }) {
  const manana = sumarDias(c.hoy, 1);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
      {items.map((it) => {
        const color = it.formato ? COLOR_FORMATO[it.formato] : colorDe(it);
        return (
          <Link key={it.id} href={destino(it)} className="gb-losa" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', textDecoration: 'none', minWidth: 0 }}>
            <span aria-hidden style={{ height: 6, background: color }} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '10px 12px 12px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                <span className="gb-chip" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>{it.formato ? ROTULO_FORMATO[it.formato] : 'Publicación'}</span>
                <span style={{ fontSize: 12, color: 'var(--dim)' }} className="gb-num">{diaCorto(diaDe(it.inicio, c.tz), c.hoy, manana)}</span>
              </span>
              <span style={{ fontSize: 15.5, fontWeight: 650, color: 'var(--ink)', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3 }}>{it.titulo}</span>
              {!it.diaCompleto && <span style={{ fontSize: 12, color: 'var(--faint)' }} className="gb-num">{horaDe(it.inicio, c.tz)}</span>}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function CuerpoPublicaciones({ c, items, vista }: { c: Cal; items: ItemCalendario[]; vista: string }) {
  return vista === 'lista'
    ? <ListaSimple c={c} items={items.map((p) => ({ ...p, detalle: p.formato ? ROTULO_FORMATO[p.formato] : p.detalle }))} conDia />
    : <TarjetasPublicaciones c={c} items={items} />;
}

export function BloquePublicaciones({ d, op }: { d: DatosGeneral['calendario']; op?: OpcionesElegidas }) {
  if (!d.ok) return <Fallo titulo="Próximas publicaciones" error={d.error} />;
  const dias = numeroDe(opcionDe('publicaciones', op, 'dias'));
  const vista = opcionDe('publicaciones', op, 'vista');
  const items = publicacionesDe(d.d, dias);
  return (
    <div className="gb">
      <Cabeza titulo="Próximas publicaciones" href="/calendario" link="Planear" />
      {items.length ? <CuerpoPublicaciones c={d.d} items={items} vista={vista} /> : (
        <Placeholder
          muestra={<CuerpoPublicaciones c={calMuestra()} items={publicacionesDe(calMuestra(), 14)} vista={vista} />}
          texto={`Nada planeado para los próximos ${dias} días.`}
          accion={{ href: '/calendario', rotulo: 'Planear una publicación' }}
        />
      )}
    </div>
  );
}

export function MuestraPublicaciones({ op }: { op?: OpcionesElegidas }) {
  const c = calMuestra();
  return (
    <div className="gb">
      <Cabeza titulo="Próximas publicaciones" />
      <CuerpoPublicaciones c={c} items={publicacionesDe(c, 14)} vista={opcionDe('publicaciones', op, 'vista')} />
    </div>
  );
}
