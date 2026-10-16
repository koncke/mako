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

// El parser se mudó a lib/guion-secciones.ts (16/10/2026): el teléfono (app/m/copywriting) lo usa
// sin llevarse este componente de cliente. Se RE-EXPORTA desde acá para los importadores de siempre;
// no hay una segunda copia (tests/m-copywriting.test.ts lo fija).
import type { Seccion } from '@/lib/guion-secciones';
export type { Seccion };
export { esSubtitulo, parsearSecciones } from '@/lib/guion-secciones';

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

/**
 * Convierte el `**enfasis**` en nodos, para que el campo editable lo MUESTRE en
 * negrita en vez de escupir los asteriscos.
 */
function conEnfasis(texto: string) {
  return texto.split(/\*\*/).map((t, i) => (
    i % 2 === 1 ? <strong key={i}>{t}</strong> : <span key={i}>{t}</span>
  ));
}

/**
 * Vuelve del DOM al texto con `**`.
 *
 * Hay que recorrer los nodos y no leer `innerText`: innerText devuelve la negrita
 * como texto plano, así que guardar con él BORRARÍA el énfasis en silencio cada
 * vez que alguien pasa el foco por una línea. Es el modo de falla más caro de un
 * campo editable — no falla, adelgaza el contenido de a poco.
 */
function desdeDom(nodo: Node): string {
  if (nodo.nodeType === 3) return nodo.textContent ?? '';
  const el = nodo as HTMLElement;
  const dentro = Array.from(el.childNodes).map(desdeDom).join('');
  const tag = el.tagName;
  if (tag === 'STRONG' || tag === 'B') return dentro ? `**${dentro}**` : '';
  if (tag === 'BR') return '\n';
  if (tag === 'DIV' || tag === 'P') return `\n${dentro}`;
  return dentro;
}

/**
 * Texto que se edita donde se lee. Sin botón de lápiz y sin «modo edición»: se
 * hace clic encima, se escribe, y al salir se guarda.
 *
 * `onSave` solo se llama si el texto CAMBIÓ. Sin esa comparación, cada clic que
 * pase por el campo dispararía un guardado — y con el guardado en el server, un
 * viaje de red por cada vez que alguien pasa el foco de largo.
 */
export function EditarTexto({ valor, onSave, multiline, style, disabled, enfasis, className }: {
  valor: string;
  onSave: (v: string) => void;
  multiline?: boolean;
  style?: CSSProperties;
  disabled?: boolean;
  /** Pinta `**así**` en negrita y lo conserva al guardar. */
  enfasis?: boolean;
  /**
   * Una clase extra. Hoy la única es `mk-edit--visible`, que muestra la caja EN
   * REPOSO en vez de sólo al pasar por encima: donde el texto ES la pantalla,
   * que se pueda tocar tiene que verse sin buscarlo, y la alternativa era una
   * leyenda que lo explicara.
   */
  className?: string;
}) {
  return (
    <div
      className={className ? `mk-edit ${className}` : 'mk-edit'}
      contentEditable={!disabled}
      suppressContentEditableWarning
      spellCheck={false}
      onBlur={(e) => {
        const crudo = enfasis
          ? Array.from(e.currentTarget.childNodes).map(desdeDom).join('')
          : (e.currentTarget.innerText || '');
        const nuevo = multiline
          ? crudo.replace(/\n{3,}/g, '\n\n').trim()
          : crudo.replace(/\s+/g, ' ').trim();
        if (nuevo !== (valor ?? '').trim()) onSave(nuevo);
      }}
      style={{ whiteSpace: multiline ? 'pre-wrap' : 'normal', opacity: disabled ? 0.6 : 1, ...style }}
    >
      {enfasis ? conEnfasis(valor) : valor}
    </div>
  );
}

/**
 * Rearma el guion completo después de editar UNA sección.
 *
 * Las tarjetas son independientes pero el guion guardado sigue siendo un solo
 * string con sus rótulos: es el contrato con el parser, con `soloHablado` y con
 * el planificador de tomas.
 */
export function reconstruirSecciones(secciones: Seccion[]): string {
  return secciones.map((s) => `${s.titulo}\n${s.texto}`).join('\n\n');
}

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
