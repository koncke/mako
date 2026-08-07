'use client';

// =============================================================================
// BarraPreview — la barra de navegación, mostrada dentro de otra pantalla
// =============================================================================
// NO ES UNA IMITACIÓN. Usa los mismos componentes que la barra de verdad
// (`Marca`, `Familia`, `NavLink`, `Identidad`, `panelStyle`), importados de
// Sidebar.tsx. Es la única forma de que la promesa se sostenga: si mañana
// alguien cambia el aire de una fila o el color de un rótulo, esto cambia solo.
//
// El intento anterior sí era una imitación —una lista dibujada a mano en la
// pantalla del sistema de diseño— y el resultado fue el previsible: no se
// parecía a la barra. Un catálogo que muestra un dibujo de la pieza en vez de
// la pieza no sirve para revisar nada.
//
// Lo único que cambia respecto de la barra real:
//   · la ruta se pasa por prop en vez de leerse de usePathname(), porque el
//     navegador está parado en /admin/ui y marcaría la fila equivocada;
//   · no hay fetch de perfil, contadores ni permisos: eso son datos de sesión,
//     no diseño;
//   · el desplegable de una colección se ancla al botón que lo abre, en vez de
//     al borde izquierdo de la ventana.

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { FAMILIAS, MAKO_NAV, type NavGrupo } from './nav';
import { Familia, Identidad, Marca, NavLink, panelStyle, identidadStyle, FULL, RAIL } from './Sidebar';
import { Icon } from './icons';

const MONO = "'Geist Mono', monospace";

export function BarraPreview({ ruta, expandida }: {
  /** La ruta que se quiere ver marcada como activa. */
  ruta: string;
  expandida: boolean;
}) {
  const familiaDeRuta = FAMILIAS.find((f) => [...f.bloques.flat(), ...(f.grupos ?? []).flatMap((g) => g.items)].some((i) => i.match(ruta)))?.key ?? 'operate';
  const [abierta, setAbierta] = useState<string | null>(familiaDeRuta);
  const [rutaVista, setRutaVista] = useState(ruta);
  if (ruta !== rutaVista) { setRutaVista(ruta); setAbierta(familiaDeRuta); }

  const [flyout, setFlyout] = useState<{ g: NavGrupo; top: number; left: number } | null>(null);
  const abrirFlyout = (key: string, el: HTMLElement) => {
    const g = FAMILIAS.flatMap((f) => f.grupos ?? []).find((x) => x.key === key);
    if (!g) return;
    const r = el.getBoundingClientRect();
    setFlyout({ g, top: r.top, left: r.right + 12 });
  };

  return (
    <div style={{ display: 'flex', flex: 'none' }}>
      <div style={{ ...panelStyle(expandida), borderRadius: 16, minHeight: 560 }}>
        <Marca open={expandida} />
        <nav style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {FAMILIAS.map((f, i) => (
            <Familia key={f.key} f={{ ...f, grupos: f.grupos ?? [] }} primera={i === 0}
              open={expandida} pathname={ruta} abiertaEsta={abierta === f.key}
              contadorFamilia={0} contadorItem={() => 0}
              onToggle={(k) => setAbierta((prev) => (prev === k ? null : k))}
              flyoutKey={flyout?.g.key ?? null}
              onAbrirFlyout={abrirFlyout} onCerrarFlyout={() => setFlyout(null)} />
          ))}
        </nav>
        <div style={{ marginTop: 'auto', paddingTop: 12, flex: 'none' }}>
          <div style={{ height: 1, background: 'var(--sidebar-2)', margin: expandida ? '0 6px 8px' : '0 4px 8px' }} />
          {MAKO_NAV.map((it) => (
            <NavLink key={it.key} item={it} active={it.match(ruta)} expanded={expandida} />
          ))}
          <div style={identidadStyle(expandida, false)}>
            <Identidad open={expandida} nombre="Mauricio Bustos" subrotulo="Cuenta" />
          </div>
        </div>
      </div>

      {flyout && createPortal(
        <div onMouseLeave={() => setFlyout(null)}
          style={{ position: 'fixed', top: flyout.top, left: flyout.left, zIndex: 2000, width: 226, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', boxShadow: '0 18px 44px rgba(23,21,17,.28)', overflow: 'hidden', padding: 6 }}>
          <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)', padding: '4px 10px 6px' }}>{flyout.g.label}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {flyout.g.items.map((it) => (
              <span key={it.key} className="mk-navrow mk-navrow--claro"
                style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', borderRadius: 'var(--r-sm)', fontSize: 'var(--fs-md)', fontWeight: 500 }}>
                <span style={{ display: 'flex', color: 'var(--faint)' }}><Icon name={it.icon} size={17} /></span>
                {it.label}
              </span>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
