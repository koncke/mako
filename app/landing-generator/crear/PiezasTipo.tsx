'use client';

// =============================================================================
// crear/PiezasTipo — las pastillas «Landing | Presentación» (y el micrófono redondo)
// =============================================================================
// Pedido de Martín (11/10/2026, tanda 2, punto 6): «Al momento de crear nuevo tengo que elegir
// si crear landing, presentación...». Decisión T4 de docs/diseno-editor-landing.md. Lo puro
// (qué cambia con el tipo) vive en ./tipo.ts.
//
// Las usan la caja del Panel (../CajaCrear.tsx) y el generador (./CrearConIA.tsx):
//   · `SelectorTipo`: los «chips de formato» de la caja de Gamma 5 (relevo gamma-ui §3: la
//     activa blanca con el texto azul). Es un radiogroup: flechas para cambiar, un solo tab.
//   · `.gp-mic` (en CSS_TIPO): el `BotonDictar` de la casa como un círculo de 34.
// La miniatura de una plantilla o de una diapositiva que se está generando NO vive acá: es
// `MiniaturaLanding` con su `formato` y su `proporcion` (el padre directo del `.gm-doc` declara
// la forma de la diapositiva: css.ts, «15b. Presentaciones»).
// Van adentro de `.gma.gp` con CSS_GP (los tokens `--gp-*`).
// =============================================================================

import { useRef, type KeyboardEvent } from 'react';
import { Ico } from '../MiniaturaLanding';
import { ICONO_TIPO, NOMBRE_TIPO, TIPOS_CREAR, type TipoCrear } from './tipo';

/** Las pastillas «Landing | Presentación». */
export function SelectorTipo({ valor, onCambio, deshabilitado }: {
  valor: TipoCrear;
  onCambio: (t: TipoCrear) => void;
  deshabilitado?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const mover = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const j = (i + d + TIPOS_CREAR.length) % TIPOS_CREAR.length;
    onCambio(TIPOS_CREAR[j]);
    refs.current[j]?.focus();
  };
  return (
    <div className="gp-tipos" role="radiogroup" aria-label="Qué vas a crear">
      {TIPOS_CREAR.map((t, i) => (
        <button
          key={t}
          ref={(el) => { refs.current[i] = el; }}
          type="button"
          role="radio"
          className="gp-tipo"
          aria-checked={valor === t}
          tabIndex={valor === t ? 0 : -1}
          disabled={deshabilitado}
          onClick={() => onCambio(t)}
          onKeyDown={(e) => mover(e, i)}
        >
          <Ico n={ICONO_TIPO[t]} t={15} />
          {NOMBRE_TIPO[t]}
        </button>
      ))}
    </div>
  );
}

/**
 * La hoja de las pastillas (tokens de CSS_GP) y del micrófono redondo (`.gp-mic`).
 * ⚠️ El micrófono es `BotonDictar` (app/plan/board/CrearTareaModal.tsx) con sus estilos EN LÍNEA
 * (42px, radio 11): para que sea un círculo de 34 como el «+» y el ↑ de la caja, la hoja le pisa
 * SÓLO el tamaño y el radio con `!important` (un `!important` de hoja le gana a un estilo en
 * línea sin él). Los colores de «escuchando» siguen siendo los suyos: son la única señal de que
 * el micrófono está abierto.
 */
export const CSS_TIPO = `
.gp .gp-tipos { display: inline-flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.gp .gp-tipo { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 16px; border: 1px solid var(--gp-borde); border-radius: 9999px; background: transparent; color: var(--gp-texto); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; transition: background-color .15s, border-color .15s, box-shadow .15s; }
.gp .gp-tipo:hover:not(:disabled) { background: var(--gp-hover); }
.gp .gp-tipo[aria-checked="true"] { background: var(--gp-superficie); border-color: var(--gp-azul-300); color: var(--gp-activo-texto); box-shadow: var(--gp-sombra-tarjeta); }
.gp .gp-tipo:disabled { opacity: .55; cursor: default; }
.gp .gp-tipo .gp-ico { display: inline-flex; }
.gp .gp-mic > button { width: 34px !important; height: 34px !important; border-radius: 9999px !important; }
`;
