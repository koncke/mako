'use client';

// =============================================================================
// MoverPartido — un control, dos mitades, cada una mueve para un lado
// =============================================================================
// Pedido de Martín (30/09/2026), textual: «pon un botón doble, que esté en la misma
// linea y se divida a la mitad. Que tenga los íconos de flechas al costado, y que
// cada uno sirva para mover la etapa de lugar. Obvio a los que no se puedan mover,
// que no tengan esto».
//
// ⚠️ VIVE ACÁ Y NO ADENTRO DE UNA PANTALLA porque lo dibujan DOS: la fila de una etapa
// en el pop-up del embudo (vertical: sube y baja) y la cabecera de una columna del
// tablero (horizontal: izquierda y derecha). Son la misma pieza con el eje cambiado, y
// dos copias de un control de dos botones divergen en el primer ajuste — que acá es
// visible, porque las dos se ven en la misma pantalla con un clic de distancia.
//
// ⚠️ Y SI NO SE PUEDE MOVER PARA NINGÚN LADO, NO SE DIBUJA. Es literal del pedido, y es
// la regla de la casa: un control entero en gris ocupa el lugar de los que sí se pueden
// usar y se lee como que la app está rota. Distinto es `trabajando`, que apaga las dos
// mitades SIN esconder la caja: si desapareciera mientras se guarda, la fila saltaría.

import type { CSSProperties } from 'react';
import { FlechaAbajoIcon, FlechaArribaIcon, FlechaDerechaIcon, FlechaIzquierdaIcon } from './iconos';

const SANS = "'Geist', sans-serif";

export function MoverPartido({ label, eje = 'vertical', puedeAntes, puedeDespues, trabajando, onAntes, onDespues }: {
  /** El nombre de lo que se mueve. Va en el `aria-label` y en el `title`. */
  label: string;
  /** `vertical` = sube y baja (una lista) · `horizontal` = izquierda y derecha (columnas). */
  eje?: 'vertical' | 'horizontal';
  puedeAntes: boolean;
  puedeDespues: boolean;
  trabajando?: boolean;
  onAntes: () => void;
  onDespues: () => void;
}) {
  if (!puedeAntes && !puedeDespues) return null;
  const horizontal = eje === 'horizontal';
  // `border-box`: el filete del medio vive DENTRO de la mitad de la izquierda, así las dos
  // miden exactamente 28 — «que se divida a la mitad», y una mitad de 29 se nota.
  const mitad = (apagado: boolean): CSSProperties => ({
    width: 28, height: 28, boxSizing: 'border-box', flex: 'none',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    border: 'none', background: 'transparent', padding: 0, fontFamily: SANS,
    color: apagado ? 'var(--faint)' : 'var(--dim)',
    cursor: apagado ? 'default' : 'pointer', opacity: apagado ? 0.45 : 1,
  });
  const antesOff = !!trabajando || !puedeAntes;
  const despuesOff = !!trabajando || !puedeDespues;
  const txtAntes = horizontal ? `Mover ${label} a la izquierda` : `Subir ${label}`;
  const txtDespues = horizontal ? `Mover ${label} a la derecha` : `Bajar ${label}`;
  return (
    // `data-nodrag` en el envoltorio: el arrastre de la fila o de la columna no arranca
    // desde sus botones — si no, agarrar la flecha se lleva la pieza entera.
    <span data-nodrag style={{
      flex: 'none', display: 'inline-flex', alignItems: 'center', borderRadius: 8,
      background: 'var(--surface)', boxShadow: '0 1px 2px rgba(18,21,27,.08)', overflow: 'hidden',
    }}>
      <button type="button" onClick={onAntes} disabled={antesOff}
        aria-label={txtAntes} title={txtAntes}
        style={{ ...mitad(antesOff), borderRight: '1px solid var(--border)' }}>
        {horizontal ? <FlechaIzquierdaIcon /> : <FlechaArribaIcon />}
      </button>
      <button type="button" onClick={onDespues} disabled={despuesOff}
        aria-label={txtDespues} title={txtDespues}
        style={mitad(despuesOff)}>
        {horizontal ? <FlechaDerechaIcon /> : <FlechaAbajoIcon />}
      </button>
    </span>
  );
}
