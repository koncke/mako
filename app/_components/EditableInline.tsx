'use client';

// =============================================================================
// EditableInline — un campo que no parece un campo
// =============================================================================
// «Solo clickeando y escribiendo, como los títulos o las descripciones de la
// tarea, que no parezca que haya un recuadro de texto» (27/09/2026).
//
// Es la misma regla que el título de una tarjeta del tablero ya cumple y que
// AGENTS.md tiene escrita: lo que se saca es LA CAJA, no la señal. Sin borde, sin
// fondo, sin radio y sin padding propio; lo que dice que se edita es el
// `cursor: text`, el `title` y el placeholder — y el foco se sigue viendo, porque
// un control sin ninguna señal de foco es inaccesible por teclado.
//
// ⚠️ ES UN `contentEditable` Y NO UN `<input>`, a propósito. Un input siempre trae
// su caja de layout: hay que darle un `width` o se queda con el tamaño del
// navegador, y en una línea que tiene además un link al lado («CRM →») eso obliga
// a medir el texto para que el link no quede flotando lejos. Un span editable
// ocupa exactamente lo que dice y hereda la tipografía de su renglón.
//
// ⚠️ GUARDA AL SALIR, NO EN CADA TECLA. Un guardado por pulsación son 20 requests
// por nombre, y acá cada una escribe en `leads` — que es el CRM. Enter guarda y
// sale; Escape descarta y restaura lo que había.

import { useCallback, useEffect, useRef } from 'react';

export function EditableInline({ valor, onGuardar, placeholder = '', titulo, className = '', maxLargo = 120 }: {
  valor: string;
  /** Se llama sólo si el texto CAMBIÓ de verdad, ya recortado. */
  onGuardar: (v: string) => void;
  placeholder?: string;
  titulo?: string;
  className?: string;
  maxLargo?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  /** Lo último que confirmamos, para saber si al salir hubo cambio. */
  const ultimo = useRef(valor);

  // ⚠️ EL TEXTO SE ESCRIBE POR REF Y NO COMO HIJO DE JSX. Un `contentEditable` con
  // children controlados por React pelea con el navegador en cada tecla: React
  // reescribe el nodo, el cursor salta al principio y escribir se vuelve imposible.
  // Se sincroniza sólo cuando el valor cambia DESDE AFUERA y el campo no tiene foco.
  useEffect(() => {
    ultimo.current = valor;
    const el = ref.current;
    if (el && document.activeElement !== el && el.textContent !== valor) el.textContent = valor;
  }, [valor]);

  const salir = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const v = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLargo);
    if (v === ultimo.current) { el.textContent = ultimo.current; return; }
    ultimo.current = v;
    el.textContent = v;
    onGuardar(v);
  }, [onGuardar, maxLargo]);

  return (
    <>
    {/* ⚠️ LA HOJA VA AFUERA DEL NODO EDITABLE. Adentro, el `<style>` ES CONTENIDO:
        `el.textContent` devolvería el CSS entero pegado al nombre del cliente, y eso
        es lo que se guardaría en `leads`. No da error y no se ve — hasta que alguien
        mira la fila. */}
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      tabIndex={0}
      aria-label={titulo}
      title={titulo}
      data-vacio={valor ? undefined : ''}
      data-placeholder={placeholder}
      className={`edin ${className}`}
      onBlur={salir}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); return; }
        if (e.key === 'Escape') {
          // ⚠️ `stopPropagation` NO ALCANZA acá y por eso va el `stopImmediate`: los
          // Escape de los modales viven en `document` y en captura, así que sin esto
          // descartar una edición cerraría además la ficha entera. Es el mismo bug que
          // ya se pagó dos veces hoy, en el popover de portada y en el de identidad.
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
          e.preventDefault();
          const el = e.currentTarget as HTMLElement;
          el.textContent = ultimo.current;
          el.blur();
        }
      }}
      // Pegar entra como TEXTO PLANO. Sin esto, copiar de un doc mete `<b>`, `<span
      // style>` y hasta una tabla adentro del nombre de un cliente.
      onPaste={(e) => {
        e.preventDefault();
        const t = e.clipboardData.getData('text/plain').replace(/\s+/g, ' ');
        document.execCommand('insertText', false, t);
      }}
    />
    </>
  );
}

const CSS = `
.edin{ cursor:text; outline:none; border:0; background:none; padding:0; border-radius:3px;
  min-width:1ch; display:inline-block; }
/* La única señal: la misma barra de foco que usa el doc de una tarea. No una caja. */
.edin:focus-visible, .edin:focus{ box-shadow:0 1px 0 0 var(--primary); }
/* El placeholder se dibuja con ::before porque un contentEditable vacio no tiene
   atributo placeholder. El data-vacio lo pone React desde el valor REAL y no desde
   el DOM: mirar :empty fallaria mientras se escribe y se borra.
   (Sin comillas invertidas aca adentro: esto vive en un template literal y una sola
   cierra la hoja a la mitad. Ya paso dos veces hoy.) */
.edin[data-vacio]::before{ content:attr(data-placeholder); color:var(--faint); font-weight:400; }
.edin[data-vacio]:focus::before{ content:''; }
`;
