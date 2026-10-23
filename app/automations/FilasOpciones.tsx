'use client';

// =============================================================================
// FilasOpciones — las filas de Configuraciones › Anti-ban y Horario: nombre, número, unidad e interruptor
// =============================================================================
// Martín, 22/10/2026 (por el Cerebro, con captura del modal de #289): «en las opciones hay una cantidad aberrante de texto
// innecesario. Jamás jamás pongas todo eso... Elimina todo el texto innecesario y diseñalo mejor». Y: «Cada opción se
// prende y se apaga con un interruptor on/off, igual que «Horario de oficina»».
//   · CADA FILA: el nombre corto, el número con su unidad y el interruptor. Nada más.
//   · LO QUE NECESITA EXPLICACIÓN VA EN UN ⓘ (`Info`), nunca como párrafo. ⚠️ Es la excepción pedida a la regla del Tooltip
//     («nunca lleva información que no esté en otro lado», app/_ui/Tooltip.tsx): en el teléfono el ⓘ es un botón, y
//     tocarlo le da el foco, que es lo que abre el Tooltip.
//   · El molde es el de «Horario de oficina» (app/configuraciones/HorarioEnvioPanel.tsx): la tarjeta de la casa, el
//     título a la izquierda y el interruptor de la casa (`Interruptor`) a la derecha.
//
// Puro (sin acciones): lo dibujan los tests bajo tsx.

import type { CSSProperties, ReactNode } from 'react';
import { Tooltip } from '@/app/_ui/Tooltip';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

const SANS = "'Geist', sans-serif";

/** La tarjeta de la casa (la de «Horario de oficina»), con las filas adentro separadas por una raya. */
export const TARJETA_OPCIONES: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '4px 18px', fontFamily: SANS,
};
/** El ancho de la unidad («min», «mensajes», «h»): los números de una tarjeta quedan en columna. */
export const ANCHO_UNIDAD = 64;
/**
 * ⚠️ EN EL TELÉFONO LA UNIDAD VA A SU ANCHO (medido a 375 px el 22/10/2026): con los 64 px fijos, «Por día» y «Misma
 * persona» se partían en dos renglones con espacio de sobra. Abajo de 600 px (donde el Modal ya es la hoja de abajo) la
 * columna de números se pierde y cada fila respira; arriba, en columna. Un `@media` no entra en un `style` en línea.
 */
const CSS_OPCIONES = `.op-unidad{flex:none;width:${ANCHO_UNIDAD}px}@media (max-width:600px){.op-unidad{width:auto}}`;

/** La tarjeta, con el estilo de sus filas adentro. */
export function TarjetaOpciones({ children, etiqueta, datos }: { children: ReactNode; etiqueta?: string; datos?: Record<string, string | number> }) {
  return (
    <section {...datos} aria-label={etiqueta} style={TARJETA_OPCIONES}>
      <style>{CSS_OPCIONES}</style>
      {children}
    </section>
  );
}
/** El ancho del interruptor de la casa: una fila sin interruptor deja el hueco y su número queda en la misma columna. */
export const ANCHO_INTERRUPTOR = 46;

/** El ⓘ: la explicación de una fila, en un Tooltip. Su texto es también su nombre para el lector de pantalla. */
export function Info({ texto }: { texto: string }) {
  return (
    <Tooltip text={texto}>
      <button type="button" data-info="" aria-label={texto}
        style={{ width: 22, height: 22, padding: 0, margin: '-2px 0 -2px 2px', border: 'none', background: 'transparent', color: 'var(--faint)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle', cursor: 'help', flex: 'none' }}>
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden focusable="false">
          <circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 7.3v3.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="4.9" r="0.95" fill="currentColor" />
        </svg>
      </button>
    </Tooltip>
  );
}

/** El nombre de un grupo de filas adentro de la tarjeta («WhatsApp», «Email»), con su ⓘ si lo necesita. */
export function GrupoOpciones({ titulo, info, primero = false }: { titulo: string; info?: string; primero?: boolean }) {
  return (
    <div data-grupo-opciones={titulo} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: primero ? '12px 0 2px' : '16px 0 2px', fontSize: 12.5, fontWeight: 600, color: 'var(--dim)', letterSpacing: '.01em' }}>
      {titulo}
      {info && <Info texto={info} />}
    </div>
  );
}

/**
 * Una fila: el nombre (y su ⓘ), lo que se elige (el número y su unidad) y el interruptor, en UNA línea también en el
 * teléfono: el nombre arranca en 0 y crece (`flex: 1 1 0`), así que en una caja angosta se parte en dos renglones antes
 * de mandar los controles abajo (medido a 375 px: con 150 px de base, hasta «Goteo» bajaba sus controles a otra línea).
 * El ⓘ va EN el renglón del nombre (inline) y PEGADO a la última palabra (`nowrap`): como ítem flex quedaba en la otra
 * punta, y suelto bajaba solo al renglón de abajo («Misma persona» / «ⓘ»).
 * Sólo si ni así entra, lo de la derecha baja entero, pegado a la derecha.
 */
export function FilaOpcion({ nombre, info, children, interruptor, sinInterruptor = false, error, datos, primera = false, debajo }: {
  nombre: string;
  info?: string;
  /** El número y su unidad (`Unidad`). */
  children?: ReactNode;
  interruptor?: ReactNode;
  /** Una fila que no se apaga (los topes de la línea): deja el hueco del interruptor para que el número quede en columna. */
  sinInterruptor?: boolean;
  /** Lo escrito que no vale, dicho abajo de la fila (no se guarda). */
  error?: string;
  /** Los `data-*` de la fila (los leen los tests y la captura). */
  datos?: Record<string, string>;
  /** La primera de la tarjeta, sin un grupo arriba: sin la raya de arriba. */
  primera?: boolean;
  /**
   * LO QUE SE ELIGE, EN EL RENGLÓN DE ABAJO (23/10/2026, el patrón de Ajustes de iOS: el nombre con su interruptor arriba y
   * el valor debajo, sólo con la opción prendida). Quien lo pasa decide cuándo: ausente, la fila es sólo nombre e interruptor.
   */
  debajo?: ReactNode;
}) {
  return (
    <div {...datos} data-fila-opcion="" style={{ display: 'flex', alignItems: 'center', gap: '6px 10px', flexWrap: 'wrap', minHeight: 50, padding: '7px 0', borderTop: primera ? 'none' : '1px solid var(--border)' }}>
      <span style={{ flex: '1 1 0', fontSize: 14.5, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.35 }}>
        {info ? <ConInfo texto={nombre} info={info} /> : nombre}
      </span>
      <span style={{ marginLeft: 'auto', flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        {children}
        {(interruptor || sinInterruptor) && <span style={{ width: ANCHO_INTERRUPTOR, display: 'inline-flex', justifyContent: 'flex-end', flex: 'none' }}>{interruptor}</span>}
      </span>
      {debajo && <span data-fila-debajo="" style={{ flexBasis: '100%', display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>{debajo}</span>}
      {error && <span role="alert" style={{ flexBasis: '100%', fontSize: 12.5, color: 'var(--bad)' }}>{error}<ReportarASoporte /></span>}
    </div>
  );
}

/** Un texto con su ⓘ pegado a la última palabra: si el renglón no alcanza, bajan juntos. */
function ConInfo({ texto, info }: { texto: string; info: string }) {
  const i = texto.lastIndexOf(' ');
  return <>{texto.slice(0, i + 1)}<span style={{ whiteSpace: 'nowrap' }}>{texto.slice(i + 1)}<Info texto={info} /></span></>;
}

/** La unidad al lado del número, en gris (más claro con la opción apagada). */
export function Unidad({ children, apagada = false }: { children: ReactNode; apagada?: boolean }) {
  return <span className="op-unidad" style={{ fontSize: 13, color: apagada ? 'var(--faint)' : 'var(--dim)' }}>{children}</span>;
}
