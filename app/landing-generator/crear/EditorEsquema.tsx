'use client';

// =============================================================================
// EditorEsquema — el «Esquema» de Gamma antes de generar
// =============================================================================
// Gamma (generador clásico, «Generar» → esquema): una tarjeta por sección, el número a
// la izquierda en una columna lila (#8a9cef sobre aurora-100), el título en negrita y
// las viñetas debajo, todo editable en el lugar; «+ Agregar sección» como fila punteada
// a lo ancho; y al pie «N secciones en total». En una página web Gamma dice «sección»
// donde en una presentación dice «diapositiva»/«módulo»: acá siempre «sección».
//
// Teclado como en Gamma: Enter en el título baja a la primera viñeta; Enter en una
// viñeta crea la siguiente; Retroceso en una viñeta vacía la borra y vuelve a la de
// arriba. Shift+Enter es un salto de línea adentro del punto (en «Conservar» un punto es
// un párrafo entero de la persona).
//
// Lo que NO se copia: Gamma reordena arrastrando. Acá se reordena con ↑/↓ y con
// Alt+↑/↓: un arrastre se verifica arrastrando en un navegador (AGENTS.md, «un GESTO no
// se verifica leyendo el handler») y en esta tanda no se levanta el dev server. Queda
// anotado como pendiente en el informe.
//
// Los topes son los de la ruta (ia-reglas.ts), importados y no copiados: si el server
// sube un tope, la pantalla lo sigue sola.
// =============================================================================

import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type TextareaHTMLAttributes } from 'react';
import type { Esquema, SeccionEsquema } from '@/lib/editor-landing/api-tipos';
import { MAX_PUNTOS, MAX_SECCIONES, MAX_TITULO_SECCION } from '@/lib/editor-landing/ia-reglas';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { Ico } from '../MiniaturaLanding';

// ─────────────────────────────────────────────────────────────────────────────
// Lo puro (con test)
// ─────────────────────────────────────────────────────────────────────────────

export function textoSecciones(n: number): string {
  return n === 1 ? '1 sección en total' : `${n} secciones en total`;
}

/** Mueve la sección `i` un lugar arriba (-1) o abajo (+1). Fuera de rango, igual. */
export function moverSeccion(e: Esquema, i: number, delta: -1 | 1): Esquema {
  const j = i + delta;
  if (i < 0 || j < 0 || i >= e.secciones.length || j >= e.secciones.length) return e;
  const s = [...e.secciones];
  [s[i], s[j]] = [s[j], s[i]];
  return { ...e, secciones: s };
}

/** Saca la sección `i`. La última no se saca: un esquema sin secciones no genera nada. */
export function quitarSeccion(e: Esquema, i: number): Esquema {
  if (e.secciones.length <= 1 || i < 0 || i >= e.secciones.length) return e;
  return { ...e, secciones: e.secciones.filter((_, k) => k !== i) };
}

/** Agrega una sección vacía al final, hasta el tope de la ruta. */
export function agregarSeccion(e: Esquema): Esquema {
  if (e.secciones.length >= MAX_SECCIONES) return e;
  return { ...e, secciones: [...e.secciones, { titulo: '', puntos: [''] }] };
}

/**
 * Lo que viaja a la ruta: títulos y puntos sin espacios de borde, sin viñetas vacías y sin
 * secciones que quedaron en blanco (ni título ni puntos). Una sección con puntos y sin
 * título se manda con el primer punto como título: la persona escribió algo y se respeta.
 */
export function esquemaParaEnviar(e: Esquema): Esquema {
  const secciones: SeccionEsquema[] = [];
  for (const s of e.secciones) {
    const puntos = s.puntos.map((p) => p.trim()).filter(Boolean).slice(0, MAX_PUNTOS);
    let titulo = s.titulo.replace(/\s+/g, ' ').trim().slice(0, MAX_TITULO_SECCION);
    if (!titulo && !puntos.length) continue;
    if (!titulo) titulo = puntos.shift()!.replace(/\s+/g, ' ').slice(0, MAX_TITULO_SECCION);
    secciones.push({ titulo, puntos });
  }
  return { titulo: e.titulo.replace(/\s+/g, ' ').trim() || secciones[0]?.titulo || 'Landing', secciones: secciones.slice(0, MAX_SECCIONES) };
}

// ─────────────────────────────────────────────────────────────────────────────
// La pantalla
// ─────────────────────────────────────────────────────────────────────────────

/** Un textarea de un renglón que crece con su texto (las viñetas de Gamma envuelven). */
function AutoTexto({ value, ...resto }: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return <textarea ref={ref} rows={1} value={value} {...resto} />;
}

export function EditorEsquema({ esquema, onCambio, deshabilitado = false }: {
  esquema: Esquema;
  onCambio: (e: Esquema) => void;
  deshabilitado?: boolean;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  // El campo que tiene que tomar el foco DESPUÉS del render que lo crea (una viñeta
  // nueva no existe todavía cuando se aprieta Enter).
  const foco = useRef<{ campo: string; alFinal: boolean } | null>(null);
  useEffect(() => {
    const f = foco.current;
    if (!f) return;
    foco.current = null;
    const el = raiz.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-campo="${f.campo}"]`);
    if (!el) return;
    el.focus();
    if (f.alFinal) el.setSelectionRange(el.value.length, el.value.length);
  });

  const secciones = esquema.secciones;
  const setSeccion = (i: number, s: SeccionEsquema) => onCambio({ ...esquema, secciones: secciones.map((x, k) => (k === i ? s : x)) });
  const enfocar = (campo: string, alFinal = false) => { foco.current = { campo, alFinal }; };

  const teclaTitulo = (i: number) => (ev: KeyboardEvent<HTMLInputElement>) => {
    // `enfocar` sólo cuando el gesto CAMBIA algo: sin render nuevo, el pedido de foco
    // quedaría colgado y se cumpliría en el próximo render, sobre otra tecla.
    if (ev.key === 'Enter') {
      ev.preventDefault();
      const s = secciones[i];
      if (s.puntos.length) {
        raiz.current?.querySelector<HTMLTextAreaElement>(`[data-campo="p${i}-0"]`)?.focus();
      } else {
        setSeccion(i, { ...s, puntos: [''] });
        enfocar(`p${i}-0`);
      }
    } else if (ev.altKey && (ev.key === 'ArrowUp' || ev.key === 'ArrowDown')) {
      ev.preventDefault();
      const delta = ev.key === 'ArrowUp' ? -1 : 1;
      const movido = moverSeccion(esquema, i, delta);
      if (movido === esquema) return;
      onCambio(movido);
      enfocar(`t${i + delta}`);
    }
  };

  const teclaPunto = (i: number, j: number) => (ev: KeyboardEvent<HTMLTextAreaElement>) => {
    const s = secciones[i];
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      if (s.puntos.length >= MAX_PUNTOS) return;
      const puntos = [...s.puntos];
      puntos.splice(j + 1, 0, '');
      setSeccion(i, { ...s, puntos });
      enfocar(`p${i}-${j + 1}`);
    } else if (ev.key === 'Backspace' && !s.puntos[j]) {
      ev.preventDefault();
      setSeccion(i, { ...s, puntos: s.puntos.filter((_, k) => k !== j) });
      enfocar(j > 0 ? `p${i}-${j - 1}` : `t${i}`, true);
    }
  };

  return (
    <div className="gp-esquema" ref={raiz}>
      <label className="gp-esq-titulo-landing">
        <span className="gp-etiqueta">Título</span>
        <input
          className="gp-campo"
          value={esquema.titulo}
          maxLength={200}
          disabled={deshabilitado}
          onChange={(ev) => onCambio({ ...esquema, titulo: ev.target.value })}
        />
      </label>

      <ol className="gp-esq-lista">
        {secciones.map((s, i) => (
          <li key={i} className="gp-esq-sec">
            <div className="gp-esq-num" aria-hidden="true">{i + 1}</div>
            <div className="gp-esq-cuerpo">
              <input
                data-campo={`t${i}`}
                className="gp-esq-titulo"
                value={s.titulo}
                placeholder="Título de la sección"
                aria-label={`Título de la sección ${i + 1}`}
                maxLength={MAX_TITULO_SECCION}
                disabled={deshabilitado}
                onChange={(ev) => setSeccion(i, { ...s, titulo: ev.target.value })}
                onKeyDown={teclaTitulo(i)}
              />
              {s.puntos.length > 0 && (
                <ul className="gp-esq-puntos">
                  {s.puntos.map((p, j) => (
                    <li key={j}>
                      <AutoTexto
                        data-campo={`p${i}-${j}`}
                        className="gp-esq-punto"
                        value={p}
                        placeholder="Escribe un punto"
                        aria-label={`Punto ${j + 1} de la sección ${i + 1}`}
                        disabled={deshabilitado}
                        onChange={(ev) => setSeccion(i, { ...s, puntos: s.puntos.map((x, k) => (k === j ? ev.target.value : x)) })}
                        onKeyDown={teclaPunto(i, j)}
                      />
                    </li>
                  ))}
                </ul>
              )}
              {!s.puntos.length && !deshabilitado && (
                <button type="button" className="gp-esq-punto-mas" onClick={() => { setSeccion(i, { ...s, puntos: [''] }); enfocar(`p${i}-0`); }}>
                  <Ico n="mas" t={12} /> Agregar punto
                </button>
              )}
            </div>
            <div className="gp-esq-acciones">
              <button type="button" className="gp-icono-btn" aria-label="Subir sección" disabled={deshabilitado || i === 0} onClick={() => onCambio(moverSeccion(esquema, i, -1))}>
                <Ico n="flecha-arriba" t={14} />
              </button>
              <button type="button" className="gp-icono-btn" aria-label="Bajar sección" disabled={deshabilitado || i === secciones.length - 1} onClick={() => onCambio(moverSeccion(esquema, i, 1))}>
                <Ico n="flecha-abajo" t={14} />
              </button>
              <button type="button" className="gp-icono-btn gp-icono-btn-peligro" aria-label="Eliminar sección" disabled={deshabilitado || secciones.length <= 1} onClick={() => onCambio(quitarSeccion(esquema, i))}>
                <IconoBorrar size={15} />
              </button>
            </div>
          </li>
        ))}
      </ol>

      <button
        type="button"
        className="gp-esq-agregar"
        disabled={deshabilitado || secciones.length >= MAX_SECCIONES}
        onClick={() => { onCambio(agregarSeccion(esquema)); enfocar(`t${secciones.length}`); }}
      >
        <Ico n="mas" t={14} /> Agregar sección
      </button>

      <div className="gp-esq-pie">{textoSecciones(secciones.length)}</div>
    </div>
  );
}

/** La hoja del esquema (la importa la pantalla de Crear junto con la suya). */
export const CSS_ESQUEMA = `
.gp .gp-esquema { display: flex; flex-direction: column; gap: 12px; }
.gp .gp-esq-titulo-landing { display: flex; flex-direction: column; gap: 6px; }
.gp .gp-esq-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.gp .gp-esq-sec { position: relative; display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; border-radius: 12px; background: var(--gp-superficie); box-shadow: var(--gp-sombra-tarjeta); overflow: hidden; }
.gp .gp-esq-num { display: flex; justify-content: center; padding-top: 14px; background: var(--gp-lila-fondo); color: var(--gp-lila-num); font-size: 14px; font-weight: 700; }
.gp .gp-esq-cuerpo { min-width: 0; padding: 10px 6px 12px 14px; }
.gp .gp-esq-titulo { width: 100%; padding: 4px 0; border: 0; background: transparent; color: var(--gp-titulo); font: inherit; font-size: 16px; font-weight: 600; outline: none; }
.gp .gp-esq-titulo::placeholder, .gp .gp-esq-punto::placeholder { color: var(--gp-debil); font-weight: 400; }
.gp .gp-esq-puntos { margin: 2px 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 2px; color: var(--gp-tenue); }
.gp .gp-esq-puntos li::marker { color: var(--gp-debil); }
.gp .gp-esq-punto { display: block; width: 100%; padding: 2px 0; border: 0; background: transparent; color: var(--gp-texto); font: inherit; font-size: 14px; line-height: 1.5; resize: none; overflow: hidden; outline: none; field-sizing: content; }
.gp .gp-esq-titulo:focus-visible, .gp .gp-esq-punto:focus-visible { outline: none; box-shadow: inset 0 -2px 0 var(--gp-azul-300); }
.gp .gp-esq-punto-mas { display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; padding: 2px 0; border: 0; background: transparent; color: var(--gp-tenue); font-size: 13px; cursor: pointer; }
.gp .gp-esq-acciones { display: flex; flex-direction: column; gap: 2px; padding: 6px 6px; opacity: 0; transition: opacity .15s; }
.gp .gp-esq-sec:hover .gp-esq-acciones, .gp .gp-esq-sec:focus-within .gp-esq-acciones { opacity: 1; }
@media (hover: none) { .gp .gp-esq-acciones { opacity: 1; } }
.gp .gp-esq-acciones .gp-icono-btn { width: 28px; height: 28px; }
.gp .gp-esq-acciones .gp-icono-btn:disabled { opacity: .35; cursor: default; }
.gp .gp-icono-btn-peligro { color: var(--gp-peligro); }
.gp .gp-esq-agregar { display: flex; align-items: center; justify-content: center; gap: 6px; height: 44px; border: 1.5px dashed var(--gp-borde); border-radius: 12px; background: transparent; color: var(--gp-tenue); font-size: 14px; font-weight: 600; cursor: pointer; }
.gp .gp-esq-agregar:hover:not(:disabled) { border-color: var(--gp-azul-300); color: var(--gp-activo-texto); background: var(--gp-activo-fondo); }
.gp .gp-esq-agregar:disabled { opacity: .5; cursor: not-allowed; }
.gp .gp-esq-pie { color: var(--gp-tenue); font-size: 13px; }
`;
