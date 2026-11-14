'use client';

// =============================================================================
// FuentesWebGenerator — los formularios y páginas de Web Generator que entran a ESTE funnel (14/11/2026)
// =============================================================================
// La llamada con Julio Mazariegos (docs/relevo/llamada-julio-13-11.md, punto 3): Martín le dijo que en «Asignar campañas»
// aparecían «tanto campañas de Meta como los formularios que tenés activos», y aparecían sólo las campañas. Martín, 14/11:
// «si se arma un formulario o piensa en otras cosas que se pueden armar en Web Generator, que se pueda asignar dentro del
// lead entrante. Eso es súper importante».
//
// Las landings PUBLICADAS del negocio (publicar ya las deja acá, sin cargar la URL en /integraciones) y, en cada una, lo que
// trae gente: formularios, encuestas, quizzes, agenda y pago, por su nombre (lib/editor-landing/piezas.ts). Cada fila tiene
// un INTERRUPTOR «entra a este funnel»: prendido, el lead que llena ese formulario cae en la etapa de entrada de este funnel.
//
// ⚠️ INTERRUPTOR Y NO CASILLA: en este modal la casilla SELECCIONA (Martín, 06/10/2026: «el checkbox no debería asignar,
// porque se entiende en todo MaKo que esa es la selección múltiple»). Un interruptor dice «prendido / apagado» y nada más.
// =============================================================================

import { useEffect, useState, type CSSProperties } from 'react';
import Link from '@/app/_ui/Link';
import { Spinner, SANS, MONO } from '@/app/_ui';
import { piezasWebAction, asignarPiezaAction } from './piezas-web-actions';
import type { AsignacionesPiezas, PiezaWeb, TipoPieza } from '@/lib/editor-landing/piezas';
import type { LandingConPiezas } from '@/lib/piezas-web';

type Datos = { landings: LandingConPiezas[]; asignadas: AsignacionesPiezas; crms: Array<{ id: number; nombre: string }>; principal: number | null };

const ICONO: Record<TipoPieza, string> = {
  formulario: 'M6 4h12a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 6 4Zm2.5 4.5h7M8.5 12h7M8.5 15.5h4',
  encuesta: 'M9 5H6.5A1.5 1.5 0 0 0 5 6.5v12A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-12A1.5 1.5 0 0 0 17.5 5H15M9 3.5h6V6H9ZM8.5 11l1.5 1.5 2.5-2.5M8.5 16h7',
  quiz: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-2.6-11.2a2.7 2.7 0 1 1 3.6 2.5c-.6.3-1 .8-1 1.5v.6M12 17.2h.01',
  agenda: 'M5 6.5h14V19H5ZM5 10h14M9 4v4M15 4v4M9.5 14.5l1.8 1.8 3.4-3.4',
  pago: 'M3.5 6.5h17v11h-17ZM3.5 10.5h17M7 14.5h4',
};

function Interruptor({ prendido, onCambiar, disabled, etiqueta }: { prendido: boolean; onCambiar: (v: boolean) => void; disabled?: boolean; etiqueta: string }) {
  return (
    <button type="button" role="switch" aria-checked={prendido} aria-label={etiqueta} disabled={disabled} onClick={() => onCambiar(!prendido)}
      style={{
        flex: 'none', width: 38, height: 22, borderRadius: 999, border: 'none', padding: 2, cursor: disabled ? 'default' : 'pointer',
        background: prendido ? 'var(--primary)' : 'var(--border-strong)', transition: 'background .15s', opacity: disabled ? 0.6 : 1,
        display: 'inline-flex', justifyContent: prendido ? 'flex-end' : 'flex-start',
      }}>
      <span style={{ width: 18, height: 18, borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
    </button>
  );
}

const FILA: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderTop: '1px solid var(--border)', minWidth: 0 };

/**
 * `funnelId` = el funnel que se está mirando (null = el del negocio, como en el resto del CRM). La sección se dibuja sola:
 * lee sus datos al montarse y guarda cada interruptor en el acto.
 */
export function FuentesWebGenerator({ funnelId, nombreProducto }: { funnelId: number | null; nombreProducto: string }) {
  const [datos, setDatos] = useState<Datos | null | undefined>(undefined);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    piezasWebAction().then((r) => { if (vivo) setDatos(r); }).catch(() => { if (vivo) setDatos(null); });
    return () => { vivo = false; };
  }, []);

  if (datos === undefined) return <div style={{ padding: '18px 0', display: 'flex', justifyContent: 'center' }}><Spinner size={16} /></div>;
  if (datos === null) return <p role="status" style={{ margin: 0, padding: '12px 0', fontFamily: SANS, fontSize: 13, color: 'var(--warn)' }}>No pude leer tus landings. Vuelve a abrir esta ventana.</p>;

  const real = funnelId ?? datos.principal;
  const nombreDe = (id: number) => datos.crms.find((c) => c.id === id)?.nombre ?? 'otro funnel';
  const conPiezas = datos.landings.filter((l) => l.piezas.length > 0);

  const cambiar = async (p: PiezaWeb, prendido: boolean) => {
    if (real == null) { setError('No pude saber cuál es este funnel. Recarga la página.'); return; }
    setGuardando(p.clave);
    setError(null);
    const r = await asignarPiezaAction(p.clave, real, prendido).catch(() => ({ ok: false as const, error: 'No se pudo guardar' }));
    setGuardando(null);
    if (r.ok) setDatos({ ...datos, asignadas: r.asignadas });
    else setError(r.error);
  };

  if (!conPiezas.length) {
    return (
      <p style={{ margin: 0, padding: '12px 0', fontFamily: SANS, fontSize: 13, color: 'var(--dim)' }}>
        {datos.landings.length ? 'Tus landings publicadas no tienen formularios, agenda ni pago.' : 'Todavía no publicaste una landing.'}{' '}
        <Link href="/web-generator" style={{ color: 'var(--primary)', fontWeight: 600 }}>Ir a Web Generator</Link>
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: SANS }}>
      {error && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: 'var(--bad)' }}>{error}</p>}
      {conPiezas.map((l) => (
        <div key={l.docId} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '10px 12px', minWidth: 0, flexWrap: 'wrap' }}>
            <b style={{ fontSize: 14, color: 'var(--ink)' }}>{l.titulo}</b>
            {l.url && <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{l.url.replace(/^https?:\/\//, '')}</a>}
          </div>
          {l.piezas.map((p) => {
            const asignados = datos.asignadas[p.clave] ?? [];
            const prendido = real != null && asignados.includes(real);
            const otros = asignados.filter((id) => id !== real).map(nombreDe);
            return (
              <div key={p.clave} style={FILA} data-pieza={p.clave}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--dim)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none' }}>
                  <path d={ICONO[p.tipo]} />
                </svg>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.rotulo} · {p.pagina}{otros.length ? ` · También entra a ${otros.join(', ')}` : ''}
                  </span>
                </span>
                {guardando === p.clave && <Spinner size={14} />}
                <Interruptor prendido={prendido} disabled={guardando != null} onCambiar={(v) => void cambiar(p, v)}
                  etiqueta={`${p.nombre}: ${prendido ? 'entra' : 'no entra'} a ${nombreProducto}`} />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
