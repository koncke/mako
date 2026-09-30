'use client';

// =============================================================================
// EditorMensaje — el texto de un mensaje, escrito COMO SE VE
// =============================================================================
// «El mensaje también se tiene que formatear en el editor» y «en el editor dice
// "negrita, itálica…", eso quítalo, basta con los botones».
//
// ── EL MODELO SIGUEN SIENDO LAS MARCAS DEL CANAL ───────────────────────────
// Lo que se guarda es `*negrita*`, `_itálica_` y `~tachado~`, porque eso es lo
// que WhatsApp entiende y lo que el email traduce solo (`marcasAHtml`). Un editor
// que emitiera HTML se vería bien acá y le llegaría al cliente como `<b>` literal
// — al canal principal.
//
// Lo que cambió es CÓMO SE ESCRIBE, no qué se guarda: antes era un textarea que
// mostraba los asteriscos («lo que se ve es lo que sale») y el dueño lo reportó
// como un error del producto. Ahora es un `contenteditable` que pinta el formato
// y SERIALIZA de vuelta a marcas en cada tecla. El string que sale por WhatsApp
// es exactamente el mismo.
//
// ── LAS TRES TRAMPAS DE UN contenteditable, Y CÓMO SE ESQUIVAN ─────────────
// 1. EL CARET SALTA SI SE REESCRIBE EL HTML EN CADA TECLA. React no controla este
//    nodo: el HTML se escribe UNA vez y sólo se vuelve a escribir cuando el valor
//    cambia desde AFUERA (lo compara contra lo último que este editor emitió). Sin
//    eso, escribir manda el cursor al principio en cada letra.
// 2. `execCommand` ESTÁ DEPRECADO Y ES LO CORRECTO ACÁ. Es lo único que sabe
//    envolver una selección respetando los límites de los nodos y dejando el caret
//    donde va; reimplementarlo con Range es el bug de «apretar B con texto
//    seleccionado lo borra», que este repo ya pagó una vez. Se le pide
//    `styleWithCSS = false` para que emita `<b>` y no un `<span style>`.
// 3. LO QUE PEGA EL PORTAPAPELES ENTRA CON SU HTML. Se intercepta `paste` y se
//    inserta TEXTO PLANO: un copiar-pegar de un doc trae tablas, colores y fuentes
//    que el serializador tira igual, pero mientras tanto rompen el renglón.

import { useEffect, useRef, type CSSProperties } from 'react';

const SANS = "'Geist', sans-serif";

const MARCAS = [
  { comando: 'bold', label: 'B', titulo: 'Negrita', estilo: { fontWeight: 800 } as CSSProperties },
  { comando: 'italic', label: 'I', titulo: 'Itálica', estilo: { fontStyle: 'italic' } as CSSProperties },
  { comando: 'strikeThrough', label: 'S', titulo: 'Tachado', estilo: { textDecoration: 'line-through' } as CSSProperties },
] as const;

const escaparHtml = (s: string) => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Marcas → HTML, para pintar. Una marca abre y cierra en la MISMA línea. */
function marcasAHtmlEditor(texto: string): string {
  const porLinea = escaparHtml(texto ?? '').split('\n').map((l) => l
    .replace(/\*([^*\n]+?)\*/g, '<b>$1</b>')
    .replace(/_([^_\n]+?)_/g, '<i>$1</i>')
    .replace(/~([^~\n]+?)~/g, '<s>$1</s>'));
  return porLinea.join('<br>') || '';
}

/**
 * El DOM → marcas. Es la mitad que decide qué se guarda, así que no adivina:
 * sólo reconoce las tres etiquetas y el `span` con estilo que algunos navegadores
 * emiten igual. Todo lo demás se aplana a texto — pegar un documento entero deja
 * su texto y tira su formato, que es lo correcto para un canal que sólo tiene tres.
 */
function domAMarcas(nodo: Node): string {
  let out = '';
  for (const hijo of Array.from(nodo.childNodes)) {
    if (hijo.nodeType === Node.TEXT_NODE) { out += hijo.textContent ?? ''; continue; }
    if (!(hijo instanceof HTMLElement)) continue;
    const tag = hijo.tagName.toLowerCase();
    if (tag === 'br') { out += '\n'; continue; }
    const dentro = domAMarcas(hijo);
    const est = hijo.style;
    const negrita = tag === 'b' || tag === 'strong' || est.fontWeight === 'bold' || Number(est.fontWeight) >= 600;
    const italica = tag === 'i' || tag === 'em' || est.fontStyle === 'italic';
    const tachado = tag === 's' || tag === 'strike' || tag === 'del' || est.textDecoration.includes('line-through');
    // Una marca vacía no se escribe: `**` suelto le llegaría al lead tal cual.
    const envuelto = dentro.trim()
      ? `${tachado ? '~' : ''}${italica ? '_' : ''}${negrita ? '*' : ''}${dentro}${negrita ? '*' : ''}${italica ? '_' : ''}${tachado ? '~' : ''}`
      : dentro;
    // `div` y `p` son renglones: el navegador los mete solo al apretar Enter.
    out += (tag === 'div' || tag === 'p') && out && !out.endsWith('\n') ? `\n${envuelto}` : envuelto;
  }
  return out;
}

export function EditorMensaje({ valor, onChange, filas = 7, disabled }: {
  valor: string;
  onChange: (v: string) => void;
  filas?: number;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  /** Lo último que ESTE editor emitió. Ver la trampa 1. */
  const propio = useRef<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (valor === propio.current) return;   // vino de nuestra propia tecla: el DOM ya está bien
    el.innerHTML = marcasAHtmlEditor(valor);
    propio.current = valor;
  }, [valor]);

  function emitir() {
    const el = ref.current;
    if (!el) return;
    const txt = domAMarcas(el);
    propio.current = txt;
    onChange(txt);
  }

  function formato(comando: string) {
    const el = ref.current;
    if (!el || disabled) return;
    el.focus();
    // Sin esto, Chrome emite `<span style="font-weight: bold">` y el serializador
    // tiene que adivinar; con tags, lo que se lee es lo que se escribió.
    try { document.execCommand('styleWithCSS', false, 'false'); } catch { /* no todos lo soportan */ }
    document.execCommand(comando);
    emitir();
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 7 }}>
        {MARCAS.map((m) => (
          <button
            key={m.comando} type="button" disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}   // no perder la selección al apretar
            onClick={() => formato(m.comando)}
            title={m.titulo} aria-label={m.titulo}
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
      </div>

      <div
        ref={ref}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox" aria-multiline="true" aria-label="El mensaje"
        onInput={emitir}
        onBlur={emitir}
        onPaste={(e) => {
          e.preventDefault();
          const txt = e.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, txt);
        }}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
          border: '1px solid var(--border-strong)', background: 'var(--surface-2)',
          color: 'var(--ink)', fontSize: 13.5, fontFamily: SANS, lineHeight: 1.55,
          outline: 'none', minHeight: filas * 22, maxHeight: 320, overflowY: 'auto',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          opacity: disabled ? 0.6 : 1,
        }}
      />
    </div>
  );
}
