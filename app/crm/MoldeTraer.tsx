'use client';

// =============================================================================
// MoldeTraer — UNA estética para «Traer de otro funnel», el Scraper (un grupo de WhatsApp) e «Importar» (24/10/2026)
// =============================================================================
// Martín, textual (punto 20 del 24/10): «Rediseña los modales de "scraper" y "de otro funnel", se ven muy feos, mira la
// captura la cantidad de botones que tienen, no se entiende nada... Y también rediseña el de "importar", que tiene una
// estetica MUY diferente, todos tienen que compartir estetica...». La captura (el Scraper): PROSPECCIÓN / Círculo TIBIO /
// el nombre del grupo / ← Atrás / Completar desde mi WhatsApp / Datos de empresa / Traer 131, todo en el pie.
//
// COPIADO DE LA PANTALLA «Preview import» DEL IMPORTADOR DE ATTIO (su documentación oficial, mirada el 25/10/2026:
// attio.com/help → «Import data into Attio via CSV», la captura del paso 4). Lo que se tomó, la ESTRUCTURA:
//   · arriba, los PASOS numerados en una fila chica («1 Archivo · 2 Revisar»), sólo si hay pasos;
//   · DE DÓNDE en una fila (los selectores y el buscador), con un «⋯» a la derecha para lo que no es el camino principal
//     (en el Scraper: completar desde WhatsApp, datos de empresa). Attio pone ahí su «⋮»;
//   · A DÓNDE en la fila de abajo, cuando se elige («Entran a: etapa · etiqueta»);
//   · UNA línea de resumen: lo que se va a traer, en negrita, a la izquierda, y los números que lo explican en chips a la
//     derecha («495 Companies ready for import» · «0 will be created» · «495 will be updated»);
//   · la LISTA, lo único que scrollea (`VistaConPie`);
//   · el pie con DOS botones a la derecha, «Atrás» y la acción, y a la izquierda sólo lo que está pasando (el avance, un
//     error, lo que terminó). Nada más.
// Los colores, la letra y los íconos son los de la casa.
// =============================================================================

import { useState, type CSSProperties, type ReactNode } from 'react';
import { VistaConPie } from '@/app/_ui/VistaConPie';
import { MenuContextual } from '@/app/_ui/MenuContextual';
import { IconoMenu, type NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

/** Un chip de la línea de resumen. `nuevo` = lo que entra (azul); `gris` = lo que no (ya está, sin número). */
export type ChipResumen = { texto: string; tono?: 'nuevo' | 'gris' };
/** Una opción del «⋯». Lo que corre se PARA desde el pie (`estado.accion`), no desde acá. */
export type OpcionMas = { id: string; texto: string; icono: NombreIconoMenu; onElegir: () => void };
/** Lo que está pasando, a la izquierda del pie. `accion` = un botón chico al lado («Parar»). */
export type EstadoPie = { texto: string; tono?: 'ok' | 'mal' | 'neutro'; accion?: { texto: string; onClick: () => void } };

export function MoldeTraer({ arriba, pasos, fuente, destino, resumen, mas = [], estado, atras, accion, lista, children }: {
  /** Lo que va antes de todo (el importador: «Desde un archivo · De otro funnel»). */
  arriba?: ReactNode;
  /** Los pasos numerados (el importador). `actual` desde 0. */
  pasos?: { nombres: readonly string[]; actual: number };
  /** De dónde: los selectores y el buscador. */
  fuente?: ReactNode;
  /** A dónde: la fila «Entran a». */
  destino?: ReactNode;
  /** La línea de resumen. `extra`: un control chico a la derecha («Ignorar admins», 26/10/2026). */
  resumen?: { texto: string; chips?: readonly ChipResumen[]; extra?: ReactNode };
  /** El «⋯» de la fila de arriba: lo que no es el camino principal. Vacío = no se dibuja. */
  mas?: readonly OpcionMas[];
  estado?: EstadoPie | null;
  /** «Atrás»: vuelve a lo anterior (al alta, o al paso de antes). */
  atras?: { texto?: string; onClick: () => void; deshabilitado?: boolean };
  /** LA acción, el botón azul. */
  accion?: { texto: string; onClick: () => void; deshabilitado?: boolean };
  /** El estilo de la caja de la lista (sin borde para lo que no es una tabla, como la caja de soltar un archivo). */
  lista?: CSSProperties;
  children: ReactNode;
}) {
  const [menu, setMenu] = useState<{ x: number; y: number; n: number } | null>(null);
  const cabecera = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {arriba}
      {pasos && (
        <ol aria-label="Pasos" style={{ display: 'flex', alignItems: 'center', gap: 18, margin: 0, padding: 0, listStyle: 'none', fontFamily: SANS, fontSize: 13 }}>
          {pasos.nombres.map((n, i) => {
            const hoy = i === pasos.actual;
            return (
              <li key={n} aria-current={hoy ? 'step' : undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: hoy ? 'var(--ink)' : 'var(--dim)', fontWeight: hoy ? 600 : 500 }}>
                <span aria-hidden style={{ width: 20, height: 20, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 11, fontWeight: 700, background: hoy ? 'var(--primary)' : i < pasos.actual ? 'var(--primary-bg)' : 'var(--surface-2)', color: hoy ? '#fff' : i < pasos.actual ? 'var(--primary)' : 'var(--dim)' }}>{i + 1}</span>
                {n}
              </li>
            );
          })}
        </ol>
      )}
      {(fuente || mas.length > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {fuente}
          <span style={{ flex: 1 }} />
          {mas.length > 0 && (
            <button type="button" aria-label="Más acciones" aria-haspopup="menu" aria-expanded={!!menu} title="Más acciones"
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenu((m) => (m ? null : { x: r.right, y: r.bottom + 6, n: Date.now() })); }}
              style={{ flex: 'none', width: 38, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, border: '1px solid var(--border-strong)', background: menu ? 'var(--surface-2)' : 'var(--surface)', color: 'var(--dim)', fontSize: 16, cursor: 'pointer', padding: 0 }}>
              ⋯
            </button>
          )}
        </div>
      )}
      {destino && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: SANS, fontSize: 12.5, color: 'var(--faint)', flex: 'none' }}>Entran a</span>
          {destino}
        </div>
      )}
      {resumen && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontFamily: SANS }}>
          <strong style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{resumen.texto}</strong>
          <span style={{ flex: 1 }} />
          {(resumen.chips ?? []).map((c) => (
            <span key={c.texto} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: c.tono === 'nuevo' ? 'var(--primary)' : 'var(--dim)' }}>
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: c.tono === 'nuevo' ? 'var(--primary)' : 'var(--border-strong)' }} />
              {c.texto}
            </span>
          ))}
          {resumen.extra}
        </div>
      )}
      {menu && (
        <MenuContextual key={menu.n} punto={{ x: menu.x, y: menu.y }} etiqueta="Más acciones"
          items={mas.map((o) => ({ id: o.id, label: o.texto, icono: o.icono }))}
          onElegir={(id) => mas.find((o) => o.id === id)?.onElegir()} onCerrar={() => setMenu(null)} />
      )}
    </div>
  );
  const colorEstado = estado?.tono === 'mal' ? 'var(--bad)' : estado?.tono === 'ok' ? 'var(--good)' : 'var(--dim)';
  const pie = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontFamily: SANS }}>
      {estado && (
        <span role={estado.tono === 'mal' ? 'alert' : 'status'} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0, fontSize: 13, color: colorEstado }}>
          {estado.texto}
          {estado.accion && (
            <button type="button" onClick={estado.accion.onClick}
              style={{ appearance: 'none', border: 0, background: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}>
              {estado.accion.texto}
            </button>
          )}
          {/* Sólo se dibuja si es un error (lee el `role` de este span): todo aviso de error lo lleva (tests/reportar-a-soporte). */}
          <ReportarASoporte />
        </span>
      )}
      <span style={{ flex: 1 }} />
      {atras && (
        <button type="button" onClick={atras.onClick} disabled={atras.deshabilitado} style={{ ...BOTON, opacity: atras.deshabilitado ? 0.55 : 1, cursor: atras.deshabilitado ? 'default' : 'pointer' }}>
          {atras.texto ?? 'Atrás'}
        </button>
      )}
      {accion && (
        <button type="button" onClick={accion.onClick} disabled={accion.deshabilitado}
          style={{ ...BOTON, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, opacity: accion.deshabilitado ? 0.45 : 1, cursor: accion.deshabilitado ? 'default' : 'pointer' }}>
          {accion.texto}
        </button>
      )}
    </div>
  );
  return (
    <VistaConPie cabecera={cabecera} pie={pie} lista={{ border: '1px solid var(--border)', borderRadius: 12, ...lista }}>
      {children}
    </VistaConPie>
  );
}

/** Los dos botones del pie miden lo mismo: «Atrás» con borde, la acción en azul. */
const BOTON: CSSProperties = {
  flex: 'none', height: 40, padding: '0 18px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)',
  color: 'var(--ink)', fontFamily: SANS, fontSize: 14, fontWeight: 600,
};

/** Las fichas de la fila de arriba: un buscador o un campo, con la misma caja (los `Dropdown` de la casa ya miden 38). */
export const CAMPO_TRAER: CSSProperties = {
  height: 38, boxSizing: 'border-box', padding: '0 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)',
  color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none',
};
