'use client';

// =============================================================================
// Una tarjeta de tamaño: la hoja en blanco con su proporción, el nombre y las medidas
// =============================================================================
// La usan la fila que abre un círculo del Inicio, los resultados del buscador y el
// diálogo «Crear un diseño». Un clic crea el diseño (no hay paso intermedio, como en
// Canva). Los nombres van a la IZQUIERDA: un <button> centra su texto por defecto.

import styles from './tarjeta-tamano.module.css';

/** El lado mayor de la hoja dibujada, en px. */
const LADO = 84;

export function TarjetaTamano({ nombre, medidas, ancho, alto, disabled, onClick }: {
  nombre: string;
  medidas: string;
  ancho: number;
  alto: number;
  disabled?: boolean;
  onClick: () => void;
}) {
  const escala = LADO / Math.max(ancho, alto);
  return (
    <button type="button" className={styles.tarjeta} disabled={disabled} onClick={onClick} title={`${nombre} · ${medidas}`}>
      <span className={styles.fondo}>
        <span
          className={styles.hoja}
          style={{ width: Math.max(6, Math.round(ancho * escala)), height: Math.max(6, Math.round(alto * escala)) }}
        />
      </span>
      <span className={styles.nombre}>{nombre}</span>
      <span className={styles.medidas}>{medidas}</span>
    </button>
  );
}
