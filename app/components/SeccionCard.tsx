'use client';

// =============================================================================
// SeccionCard — tarjeta desplegable para texto seccionado por SUBTÍTULO
// =============================================================================
// Patrón repetido en el Resumen del Archivero, la descripción de Persona y (desde
// acá) el Guion de video de la Matriz: la IA devuelve texto con subtítulos en
// MAYÚSCULA, se parte por sección y cada una es una tarjeta que abre/cierra. Antes
// vivía duplicado en cada vista; un solo componente + un solo parser.

import { useState, type CSSProperties } from 'react';

const SANS = "'Geist', sans-serif";

export type Seccion = { titulo: string; texto: string };

/** true si la línea es un SUBTÍTULO (toda mayúscula, corta, con al menos una letra). */
export function esSubtitulo(l: string, maxLen = 48): boolean {
  return l.length > 0 && l.length <= maxLen && l === l.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(l) && !/[a-záéíóúñ]/.test(l);
}

/**
 * Parte un texto con subtítulos en MAYÚSCULA (cada uno en su propia línea) en
 * secciones {titulo, texto}. Lo que aparece ANTES del primer subtítulo (si hay)
 * cae en una sección con `tituloSinSub` (p.ej. "Panorama general") — o se
 * descarta si no se pasa (útil cuando el prompt garantiza que TODO viene con
 * subtítulo, como el guion GANCHO/HISTORIA/CTA).
 */
export function parsearSecciones(text: string, tituloSinSub?: string, maxLenSub = 48): Seccion[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: Seccion[] = [];
  let actual: Seccion | null = null;
  for (const raw of lines) {
    const l = raw.trim().replace(/\*\*/g, '').replace(/^#+\s*/, '').trim();
    if (!l || l === '---') continue;
    if (esSubtitulo(l, maxLenSub)) {
      actual = { titulo: l.replace(/[:：]$/, ''), texto: '' };
      out.push(actual);
    } else {
      const limpio = l.replace(/^[-•·]\s*/, '');
      if (!actual) {
        if (!tituloSinSub) continue;
        actual = { titulo: tituloSinSub, texto: '' };
        out.push(actual);
      }
      actual.texto = actual.texto ? `${actual.texto}\n${limpio}` : limpio;
    }
  }
  return out;
}

/**
 * El emoji de cada bloque de un guion.
 *
 * Vive junto al parser y no en cada pantalla porque el mapa YA estaba escrito
 * dos veces —el lector de /ads-writer y la matriz del onboarding— con las
 * mismas 17 entradas. Una tercera copia en el Video Generator garantizaba que
 * el dia que se agregue una estructura nueva, dos pantallas la muestren y una
 * la dibuje con el generico.
 *
 * Las claves son las `etiquetas` de lib/guion-estructuras.ts, que ya son
 * CONTRATO con este parser.
 */
export const ICONO_SECCION_GUION: Record<string, string> = {
  GANCHO: '\u{1F3A3}', HISTORIA: '\u{1F4D6}', VALOR: '\u{1F393}', PROPUESTA: '\u{1F4A5}', CTA: '\u{1F449}',
  PROBLEMA: '\u{1F616}', AGITACION: '\u{1F525}', SOLUCION: '\u{1F4A1}',
  ATENCION: '\u{1F9F2}', INTERES: '\u{1F440}', DESEO: '\u{2728}',
  ANTES: '\u{23EE}\u{FE0F}', DESPUES: '\u{23ED}\u{FE0F}', PUENTE: '\u{1F309}',
  PROMESA: '\u{1F91D}', PINTURA: '\u{1F5BC}\u{FE0F}', PRUEBA: '\u{2705}',
};

const TAMANOS = {
  sm: { pad: '13px 16px', icon: 30, iconFont: 14, tituloFont: 13.5, bodyPad: '0 16px 14px 58px', bodyFont: 13.5 },
  md: { pad: '15px 18px', icon: 32, iconFont: 15, tituloFont: 15, bodyPad: '2px 18px 18px 62px', bodyFont: 14.5 },
};

export function SeccionCard({
  s, abiertoDefault, icono = '📌', size = 'md', accion, children,
}: {
  s: Seccion;
  abiertoDefault: boolean;
  /** Emoji del chip — resuelto por quien llama (heurística por tema, mapa fijo, o por índice). */
  icono?: string;
  size?: 'sm' | 'md';
  /** Slot opcional a la derecha del título (ej. un botón "Regenerar" por sección). */
  accion?: React.ReactNode;
  /** Body custom (ej. editable) — si no se pasa, se muestra s.texto en solo lectura. */
  children?: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(abiertoDefault);
  const t = TAMANOS[size];
  const rowStyle: CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: t.pad, background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: SANS };
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button type="button" onClick={() => setAbierto((a) => !a)} style={{ ...rowStyle, flex: 1, minWidth: 0 }}>
          {/* --accent-soft es amarillo fuerte: se funde con los emojis (mismo tono). Fondo neutro. */}
          <span aria-hidden style={{ flex: 'none', width: t.icon, height: t.icon, borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: t.iconFont }}>{icono}</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: t.tituloFont, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{s.titulo}</span>
          <span aria-hidden style={{ flex: 'none', color: 'var(--faint)', fontSize: 12, transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
        </button>
        {accion && <div style={{ paddingRight: 14 }}>{accion}</div>}
      </div>
      {abierto && (
        <div style={{ padding: t.bodyPad, fontSize: t.bodyFont, color: 'var(--dim)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{children ?? s.texto}</div>
      )}
    </div>
  );
}
