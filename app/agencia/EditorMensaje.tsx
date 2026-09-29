'use client';

// =============================================================================
// EditorMensaje — el texto de un mensaje, con los botones de formato del canal
// =============================================================================
// «El mensaje debe estar formateado, se debe poder editar, ponerle negrita, etc.»
//
// ── Por qué ASTERISCOS y no HTML ────────────────────────────────────────────
// El formato de este mensaje no lo elige la pantalla: lo eligen los canales por
// los que sale. WhatsApp entiende `*negrita*`, `_itálica_` y `~tachado~`, y el
// email los traduce solo (`marcasAHtml` en lib/email-html.ts los pasa a
// `<strong>`, `<em>` y tachado). O sea que una barra de formato que envuelve la
// selección con esas marcas se ve bien en LOS DOS canales hoy.
//
// Un editor que emitiera HTML se vería bien acá y llegaría a WhatsApp como
// `<b>texto</b>` literal, que es el canal principal. Por eso no hay
// contentEditable: el dialecto del canal es el formato, y el textarea lo muestra
// tal cual va a salir.
//
// ⚠️ LOS BOTONES ENVUELVEN, NO REEMPLAZAN. Los dos precedentes del repo que
// insertan en un campo (los slots de un prompt, los parámetros de una plantilla de
// Meta) SUSTITUYEN la selección por un token y dejan el caret detrás. Copiado tal
// cual, apretar «B» con texto seleccionado lo BORRA y deja dos asteriscos. Acá se
// envuelve y se vuelve a seleccionar lo de adentro, que es lo que hace que se
// pueda encadenar (negrita y después itálica sobre lo mismo).

import { useRef, type CSSProperties } from 'react';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

/** Las marcas que los dos canales entienden. Ver la cabecera. */
const MARCAS = [
  { marca: '*', label: 'B', titulo: 'Negrita', estilo: { fontWeight: 800 } as CSSProperties },
  { marca: '_', label: 'I', titulo: 'Itálica', estilo: { fontStyle: 'italic' } as CSSProperties },
  { marca: '~', label: 'S', titulo: 'Tachado', estilo: { textDecoration: 'line-through' } as CSSProperties },
] as const;

export function EditorMensaje({ valor, onChange, filas = 7, disabled }: {
  valor: string;
  onChange: (v: string) => void;
  filas?: number;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  /** Envuelve la selección con la marca, y la deja seleccionada adentro. */
  function envolver(marca: string) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const dentro = valor.slice(a, b);

    // Sin selección no se adivina qué envolver: se ponen las dos marcas y el caret
    // queda en el medio, listo para escribir. Es lo que hace cualquier editor.
    const nuevo = valor.slice(0, a) + marca + dentro + marca + valor.slice(b);
    onChange(nuevo);

    // El foco y la selección se restauran en el tick siguiente: React todavía no
    // pintó el valor nuevo, así que moverlos ahora los aplica sobre el viejo.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + marca.length, b + marca.length);
    });
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 7 }}>
        {MARCAS.map((m) => (
          <button
            key={m.marca} type="button" disabled={disabled}
            onClick={() => envolver(m.marca)}
            title={`${m.titulo} — se manda como ${m.marca}texto${m.marca}`}
            aria-label={m.titulo}
            style={{
              width: 30, height: 28, borderRadius: 7, cursor: disabled ? 'default' : 'pointer',
              border: '1px solid var(--border-strong)', background: 'var(--surface)',
              color: 'var(--dim)', fontFamily: SANS, fontSize: 13, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              ...m.estilo,
            }}
          >
            {m.label}
          </button>
        ))}
        {/* No es una glosa de más: el asterisco que aparece en el campo ES el
            formato, y sin esta línea se lee como un error de tipeo. */}
        <span style={{ alignSelf: 'center', marginLeft: 4, fontSize: 11, color: 'var(--faint)', fontFamily: MONO }}>
          *negrita* _itálica_ ~tachado~
        </span>
      </div>

      <textarea
        ref={ref} value={valor} rows={filas} disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
          border: '1px solid var(--border-strong)', background: 'var(--surface-2)',
          color: 'var(--ink)', fontSize: 13.5, fontFamily: SANS, lineHeight: 1.55,
          outline: 'none', resize: 'vertical',
        }}
      />
    </div>
  );
}
