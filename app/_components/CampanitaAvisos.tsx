'use client';

// =============================================================================
// CampanitaAvisos — el feed de avisos del negocio en ESCRITORIO (17/10/2026)
// =============================================================================
// Hasta este día el feed (`notificaciones`, mig 0250) sólo lo leía el «Avisos» de MaKo Mobile, y en escritorio no había
// dónde ver un aviso que no llegó al grupo. Desde que la tarjeta MaKo de un negocio sin grupo «queda en la app»
// (`SinGrupo`, lib/mako-tarjeta.ts), ESTA es esa app. El mapeo previo, con las trampas, en docs/hallazgos-comunicacion.md
// («La campanita de escritorio y el «sin grupo de MaKo»»).
//
// DÓNDE: en el pie del Sidebar, al lado de la identidad, y NO en una fila nueva: la columna de navegación ya scrollea en
// 1024×768, y AGENTS.md dice que no scrollea nunca. Plegada, sólo un punto sobre la foto si hay algo sin ver.
//
// LO QUE LEE: GET /api/notificaciones (sólo admin; un closer o setter recibe la lista vacía y no ve la campana). El número
// se pide con `?contar=1` en cada cambio de pantalla; la lista, recién al abrir, y ESTRICTA: «no pude leer» no se dibuja
// «Sin avisos todavía». Lo que se dibuja sale de lib/campanita.ts (agrupar, la salida, el link).
//
// LO QUE ESCRIBE: la marca de agua de ESTA persona (POST `visto`), y sólo si al abrir hay algo más nuevo que la marca
// (`marcaAlAbrir`): la marca reescribe el `perfil` entero.
//
// ⚠️ El panel va por PORTAL y en blanco, como el menú del perfil, con id `avisos-menu`: el Sidebar lo mira con `:hover`
// antes de plegarse (si no, la barra se cerraba debajo del panel abierto).
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from '@/app/_ui/Link';
import { Icon } from './icons';
import { agruparAvisos, haceCuanto, marcaAlAbrir, LINK_POR_DEFECTO, type AvisoCampanita, type FilaFeed } from '@/lib/campanita';

const MONO = "'Geist Mono', monospace";
export const ID_PANEL_AVISOS = 'avisos-menu';

type Lista = { estado: 'cargando' } | { estado: 'error' } | { estado: 'ok'; avisos: AvisoCampanita[] };

/** El número de avisos sin ver de esta persona (null = no se pudo contar: no se dibuja). */
function useNoVistas(pathname: string, activo: boolean): [number | null, (n: number | null) => void] {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    fetch('/api/notificaciones?contar=1', { cache: 'no-store', signal: AbortSignal.timeout(20_000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { ok?: boolean; noVistas?: unknown } | null) => { if (vivo) setN(j?.ok && typeof j.noVistas === 'number' ? j.noVistas : null); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [pathname, activo]);
  return [n, setN];
}

export function CampanitaAvisos({ open, pathname, onAbrir }: {
  /** El Sidebar está ensanchado: se dibuja la campana; plegado, sólo el punto. */
  open: boolean;
  pathname: string;
  /** Al abrir el panel: el Sidebar cierra sus otros desplegables. */
  onAbrir?: () => void;
}) {
  const [noVistas, setNoVistas] = useNoVistas(pathname, true);
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);
  const [lista, setLista] = useState<Lista>({ estado: 'cargando' });
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const cargar = () => {
    setLista({ estado: 'cargando' });
    fetch('/api/notificaciones?limit=40', { cache: 'no-store', signal: AbortSignal.timeout(20_000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { ok?: boolean; items?: FilaFeed[]; vistoHasta?: string | null } | null) => {
        if (!j?.ok || !Array.isArray(j.items)) { setLista({ estado: 'error' }); return; }
        const vistoHasta = j.vistoHasta ?? null;
        setLista({ estado: 'ok', avisos: agruparAvisos(j.items, vistoHasta) });
        const hasta = marcaAlAbrir(j.items, vistoHasta);
        if (hasta) {
          setNoVistas(0);
          fetch('/api/notificaciones', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'visto', hasta }),
          }).catch(() => { /* sin red: se marca la próxima vez que abra */ });
        }
      })
      .catch(() => setLista({ estado: 'error' }));
  };

  const abrir = () => {
    if (abierto) { setAbierto(false); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ left: r.right + 12, bottom: Math.max(12, window.innerHeight - r.bottom) });
    onAbrir?.();
    setAbierto(true);
    cargar();
  };

  // Plegada la barra, el panel no tiene de dónde colgar: se cierra.
  useEffect(() => { if (!open) setAbierto(false); }, [open]);

  useEffect(() => {
    if (!abierto) return;
    const onDown = (e: MouseEvent) => {
      if (document.getElementById(ID_PANEL_AVISOS)?.contains(e.target as Node)) return;
      if (btnRef.current?.contains(e.target as Node)) return;
      setAbierto(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [abierto]);

  const hay = (noVistas ?? 0) > 0;

  if (!open) {
    // Plegada: un punto sobre la foto, y nada que tocar (la barra se ensancha al pasar el cursor o tocarla).
    return hay ? (
      <span aria-hidden data-avisos-punto
        style={{ position: 'absolute', top: 8, left: 'calc(50% + 10px)', width: 9, height: 9, borderRadius: '50%', background: 'var(--bad)', border: '2px solid var(--sidebar)', pointerEvents: 'none' }} />
    ) : null;
  }

  return (
    <>
      <button ref={btnRef} type="button" onClick={abrir} data-avisos-campana
        aria-label={hay ? `Avisos: ${noVistas} sin ver` : 'Avisos'} aria-expanded={abierto} title="Avisos"
        className="mk-navrow"
        style={{ position: 'relative', flex: 'none', width: 38, height: 38, marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r-md)', border: 'none', background: abierto ? 'var(--sidebar-2)' : 'transparent', cursor: 'pointer', color: 'var(--sidebar-text)' }}>
        <Icon name="bell" size={19} />
        {hay && (
          <span style={{ position: 'absolute', top: 3, right: 2, minWidth: 16, height: 16, padding: '0 4px', boxSizing: 'border-box', borderRadius: 999, background: 'var(--bad)', color: '#fff', fontFamily: MONO, fontSize: 10, fontWeight: 700, lineHeight: '16px', textAlign: 'center' }}>
            {noVistas! > 99 ? '99+' : noVistas}
          </span>
        )}
      </button>

      {abierto && pos && createPortal(
        <div id={ID_PANEL_AVISOS} role="dialog" aria-label="Avisos"
          style={{ position: 'fixed', left: pos.left, bottom: pos.bottom, zIndex: 2000, width: 'min(360px, calc(100vw - 24px))', maxHeight: 'min(560px, calc(100vh - 24px))', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', boxShadow: '0 18px 44px rgba(23,21,17,.28)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, padding: '12px 15px 8px', flex: 'none' }}>
            <span style={{ fontWeight: 700, fontSize: 'var(--fs-md)', color: 'var(--ink)' }}>Avisos</span>
            <Link href={LINK_POR_DEFECTO} onClick={() => setAbierto(false)} style={{ fontSize: 12, color: 'var(--dim)', textDecoration: 'none' }}>Configurar</Link>
          </div>
          <div style={{ overflowY: 'auto', padding: '0 6px 8px' }}>
            {lista.estado === 'cargando' && <p style={{ margin: 0, padding: '14px 10px', fontSize: 13, color: 'var(--dim)' }}>Cargando…</p>}
            {lista.estado === 'error' && (
              <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--dim)', display: 'flex', gap: 10, alignItems: 'center' }}>
                <span>No pude leer los avisos.</span>
                <button type="button" onClick={cargar} style={{ border: 'none', background: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: 13 }}>Reintentar</button>
              </div>
            )}
            {lista.estado === 'ok' && !lista.avisos.length && <p style={{ margin: 0, padding: '14px 10px', fontSize: 13, color: 'var(--dim)' }}>Sin avisos todavía.</p>}
            {lista.estado === 'ok' && lista.avisos.map((a) => <RenglonAviso key={a.id} a={a} onIr={() => setAbierto(false)} />)}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function RenglonAviso({ a, onIr }: { a: AvisoCampanita; onIr: () => void }) {
  const cuerpo = (
    <>
      <span aria-hidden style={{ flex: 'none', width: 7, height: 7, marginTop: 6, borderRadius: '50%', background: a.nuevo ? (a.urgente ? 'var(--bad)' : 'var(--primary)') : 'transparent' }} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span style={{ flex: 1, minWidth: 0, fontWeight: a.nuevo ? 700 : 600, fontSize: 13.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titulo}</span>
          {a.veces > 1 && <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11, color: 'var(--dim)' }}>×{a.veces}</span>}
          <span style={{ flex: 'none', fontSize: 11.5, color: 'var(--faint)' }}>{haceCuanto(a.createdAt)}</span>
        </span>
        {a.frase && (
          <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 12.5, color: 'var(--dim)', marginTop: 2, lineHeight: 1.35 }}>{a.frase}</span>
        )}
        {a.salida && <span data-aviso-salida style={{ display: 'inline-block', marginTop: 4, fontSize: 11, fontWeight: 600, color: 'var(--warn)' }}>{a.salida}</span>}
      </span>
    </>
  );
  const estilo = { display: 'flex', gap: 9, alignItems: 'flex-start', padding: '9px 9px', borderRadius: 10, textDecoration: 'none' } as const;
  return a.link
    ? <Link href={a.link} onClick={onIr} className="mk-navrow mk-navrow--claro" style={estilo}>{cuerpo}</Link>
    : <div style={estilo}>{cuerpo}</div>;
}
