'use client';

// RichText — descripción editable que "flota" (sin caja), como el título, pero con
// formato (negrita / subrayado / lista). Guarda HTML. contentEditable NO controlado:
// se setea el HTML inicial una vez y se commitea onBlur para no pelear con el cursor.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { sanearHtmlEmail } from '@/lib/email-html-seguro';

const SANS = "'Geist', sans-serif";

/**
 * UNA ETIQUETA CITADA ENTRE COMILLAS INVERTIDAS ES TEXTO, NO MARCADO: «1.158 `<button>` sueltos».
 *
 * Los detalles que escribe el Perro HABLAN de HTML (ver `ES_HTML`), y la lista blanca de abajo se
 * lleva un `<button>` o un `<textarea>` CON TODO LO QUE VIENE DESPUÉS si no encuentra su cierre:
 * medido (14/10/2026), `<div>1.158 `<button>` sueltos y el resto</div>` salía `<div>1.158 `</div>`.
 * Por eso lo citado se escapa ANTES de sanear y no cuenta para decidir si un texto es HTML.
 *
 * Sólo un código con UNA etiqueta adentro y sin `<`/`>` sueltos: así no puede cruzar de un renglón
 * del editor al otro (`it`s</div><div>use `x``) ni nacer adentro de un atributo.
 *
 * ⚠️ GEMELO de `CODIGO_CITADO` en lib/todo.ts (el saneo al GUARDAR). Un `'use client'` no se puede
 * importar desde el server ni al revés sin un módulo compartido, así que la regla está dos veces y
 * tests/seguridad-xss.test.ts compara las dos.
 */
const CODIGO = /`[^`\n<>]*<\/?[a-zA-Z][^`\n<>]*>[^`\n<>]*`/g;
const citadoComoTexto = (s: string): string => s.replace(CODIGO, (c) => c.replace(/</g, '&lt;').replace(/>/g, '&gt;'));

/**
 * EL SANEO DEL TABLERO ES UNA LISTA BLANCA (auditoría de seguridad, 14/10/2026).
 *
 * Esto era una LISTA NEGRA por regex —sacaba script, `on…="…"` y `javascript:`— y corría SÓLO al
 * guardar desde esta pantalla. Lo que entraba por /api/todo (cualquier miembro del workspace, un
 * closer o un setter) se dibujaba con innerHTML tal cual: un `<b>` para que cuente como HTML más un
 * `<img src=x onerror=…>` corría en la sesión del admin que abría la tarjeta, o del super admin
 * entrando con ?ws=N. Y la regex se salteaba sola con un `href="java&#09;script:"` o un
 * `<svg><animate onbegin=…>`.
 *
 * Ahora es `sanearHtmlEmail` (lib/email-html-seguro.ts): lista blanca, la salida se arma de cero y
 * es puro, así que corre en el navegador. ⚠️ NO es `sanearHtml` de lib/html-seguro.ts, aunque sea
 * la otra lista blanca de la casa, por dos razones medidas: es `server-only` (este archivo es
 * `'use client'`), y su lista no tiene `div`, que es el RENGLÓN de este editor (lo emiten `mdAHtml`
 * y Chrome al apretar Enter): `<div>Primera línea</div><div>Segunda línea</div>` salía
 * «Primera líneaSegunda línea», y sin bloques no hay encabezados que plegar.
 *
 * Corre al DIBUJAR (`paraDibujar`), al guardar desde la pantalla (`contenidoDe`) y en el server al
 * guardar (`sanearDetalle`, lib/todo.ts). Lo usan también las notas (NotasLista).
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return sanearHtmlEmail(citadoComoTexto(html));
}

/**
 * El texto plano de un detalle, para las cards y para el pedido a MaKo.
 *
 * ⚠️ UN DOCUMENTO INERTE (DOMParser), NUNCA UN `div` DEL DOCUMENTO. Un elemento creado en la
 * página carga sus recursos y corre sus manejadores AUNQUE no esté montado: el
 * `document.createElement('div').innerHTML = detalle` de antes disparaba el `onerror` de un
 * `<img src=x>` con sólo dibujar la card del proyecto. En un documento de DOMParser no corre nada.
 * No se sanea antes: lo que sale es TEXTO (React lo escapa), y la lista blanca se llevaría el texto
 * que viene después de un `<button>` mencionado sin comillas invertidas.
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  if (typeof DOMParser === 'undefined') return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
}

/**
 * Markdown → HTML, solo para el texto que MaKo escribe.
 *
 * El campo guarda HTML (viene de contentEditable), pero la extracción de reuniones y el
 * Perro escriben MARKDOWN: `**Qué pidió**`, bullets con `- `. Sin esto se veían los
 * asteriscos crudos en la tarjeta. Se aplica SOLO si el texto no tiene ni una etiqueta:
 * lo que ya es HTML —todo lo que escribió el dueño a mano— no se toca.
 */
/** Las etiquetas que de verdad emite `contentEditable`. La detección vieja era
 *  `/<[a-z][\s\S]*>/i` — CUALQUIER cosa entre `<` y `>` — y eso rompía feo con los
 *  detalles que HABLAN de HTML: uno del rediseño dice «1.158 `<button>` sueltos», y con
 *  eso el texto se daba por HTML, así que (a) el markdown no se convertía y se veían los
 *  `**` crudos, y (b) ese `<button>` se renderizaba como un botón de verdad adentro de la
 *  descripción. Ahora solo cuentan las etiquetas de formato; `<button>`, `<select>` o
 *  `<input>` mencionados en un texto se escapan y se leen como lo que son: texto. */
const ES_HTML = /<(div|p|br|ul|ol|li|strong|b|u|em|i|span|h[1-6]|a)[\s>/]/i;

/** ¿Es HTML (lo escribió el editor) o markdown/texto (lo escribió MaKo)? Lo citado entre comillas
 *  invertidas no cuenta (`CODIGO`): «usar `<div>` en vez de `<button>`» es markdown que HABLA de
 *  HTML. ⚠️ Gemelo de `esHtmlDetalle` en lib/todo.ts: los dos lados tienen que decir lo mismo, o el
 *  server guardaría saneado como HTML lo que acá se dibuja escapado como markdown. */
export const esHtml = (texto: string): boolean => ES_HTML.test(texto.replace(CODIGO, ''));

export function mdAHtml(texto: string): string {
  if (!texto || esHtml(texto)) return texto;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // `codigo` → <code>. Los detalles técnicos están llenos de `archivo:linea` y de
  // `style={{`, y sin esto se leían las comillas invertidas crudas. Va DESPUÉS del
  // escapado, así que lo que quedó adentro ya es texto seguro.
  const inline = (s: string) => esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  const out: string[] = [];
  let lista: string[] = [];
  const cerrar = () => { if (lista.length) { out.push(`<ul>${lista.map((li) => `<li>${li}</li>`).join('')}</ul>`); lista = []; } };
  for (const raw of texto.split('\n')) {
    const t = raw.trim();
    if (/^[-*•]\s+/.test(t)) { lista.push(inline(t.replace(/^[-*•]\s+/, ''))); continue; }
    cerrar();
    if (!t) continue;
    out.push(`<div>${inline(t)}</div>`);
  }
  cerrar();
  return out.join('');
}

/**
 * LO QUE EL EDITOR DIBUJA de un valor guardado: el markdown pasado a HTML, y TODO por la lista
 * blanca. Se sanea al dibujar y no sólo al guardar porque lo guardado no pasó siempre por un saneo:
 * filas viejas, y todo lo que entró por /api/todo antes del 14/10/2026.
 */
export const paraDibujar = (valor: string): string => sanitizeHtml(mdAHtml(valor || ''));

/**
 * El CONTENIDO del editor, como se guarda: leído en un documento INERTE, sin lo que no es texto
 * de nadie y por la lista blanca.
 *
 * «Lo que no es texto de nadie» es lo `contenteditable="false"` que le monta encima quien lo
 * decora: los chevrones y el «Resumen» del plegado de `DetalleDoc` (BoardShell). Hay que sacarlo
 * ACÁ, antes del saneo: la lista blanca le borra el `class="mk-intro"` al «Resumen» y `sinMarcas`
 * (que lo reconoce por esa clase) ya no lo encontraría, así que cada blur escribiría «Resumen» en
 * el detalle. Un `<div><br></div>` es un editor vacío.
 */
function contenidoDe(ed: HTMLElement): string {
  const doc = new DOMParser().parseFromString(ed.innerHTML, 'text/html');
  doc.body.querySelectorAll('[contenteditable="false"]').forEach((n) => n.remove());
  const html = sanitizeHtml(doc.body.innerHTML);
  return html === '<br>' || html === '<div><br></div>' ? '' : html;
}

/**
 * LA SEÑAL DE FOCO DE UN CAMPO DE TEXTO DEL DETALLE, Y ES UNA SOLA.
 *
 * «No tiene que aparecer ningún recuadro de texto, tal cual como la descripción, que no
 * parezca un input que esté flotando el título» (25/09/2026). Lo que había en el título
 * —borde gris al pasar el mouse, fondo `--surface-2` al enfocar, todo con `borderRadius`—
 * es literalmente un recuadro, y el doc de al lado no tenía ninguno: las dos cosas se
 * editan igual y se veían distinto.
 *
 * ⚠️ PERO UN CONTROL SIN NINGUNA SEÑAL DE FOCO ES INACCESIBLE POR TECLADO. Así que no se
 * saca la señal: se saca la CAJA. Queda una barra de 2px en el borde izquierdo, que es la
 * misma pieza que ya marca el margen del doc, no un rectángulo alrededor del texto.
 *
 * Y vive ACÁ, exportada, para que el título y el doc usen el MISMO valor: dos campos que
 * se editan igual no pueden señalar el foco de dos maneras. El `:focus` de abajo la aplica
 * al editor; el título la escribe con este mismo string.
 */
export const FOCO_BARRA = 'inset 2px 0 0 var(--primary)';

export function RichText({ value, onChange, placeholder, style, encabezados = false, onFormato }: {
  value: string; onChange: (html: string) => void; placeholder?: string; style?: CSSProperties;
  /** dibuja el botón que convierte el renglón del cursor en ENCABEZADO (y al revés). Sólo
   *  lo pide el doc del detalle: en una nota no hay nada que plegar. */
  encabezados?: boolean;
  /** avisa que el botón de arriba tocó la estructura, para que quien decora el plegado
   *  vuelva a pasar. Trae el texto del encabezado RECIÉN CREADO (o `null` al quitarlo):
   *  sin eso, el encabezado nuevo nace plegado y esconde lo que se está escribiendo. */
  onFormato?: (encabezadoNuevo: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  /** El contenido tal como quedó DIBUJADO (`contenidoDe` recién pintado): la vara de «¿cambió?». */
  const dibujado = useRef('');

  // set inicial (una vez) + cuando cambia value DESDE afuera y no está enfocado.
  // ⚠️ Por `paraDibujar`, nunca el valor crudo: ver `sanitizeHtml`.
  useEffect(() => {
    const ed = ref.current;
    if (!ed || focused) return;
    const html = paraDibujar(value);
    if (ed.innerHTML !== html) ed.innerHTML = html;
    dibujado.current = contenidoDe(ed);
  }, [value, focused]);

  const commit = () => {
    setFocused(false);
    const ed = ref.current;
    if (!ed) return;
    const html = contenidoDe(ed);
    // ⚠️ NADA CAMBIÓ DESDE QUE SE DIBUJÓ → no se guarda. Desde que se dibuja SANEADO, lo que hay en
    // pantalla de un valor viejo ya no es el valor (un `<b>` de Chrome se dibuja `<strong>`), y sin
    // esta vara abrir y cerrar la tarjeta guardaba la versión saneada como una edición más. Se
    // compara contenido contra contenido, los dos leídos igual (`contenidoDe`).
    if (html === dibujado.current) return;
    // Ojo con el markdown: al mostrarlo se convierte a HTML, así que si el dueño abre y
    // cierra la tarjeta SIN tocar nada, `html` ya no es igual a `value` y se guardaría
    // solo. Se compara contra la versión convertida para no ensuciar el historial con
    // ediciones fantasma.
    if (html !== value && html !== mdAHtml(value || '')) onChange(html);
  };
  const cmd = (c: string) => { document.execCommand(c, false); ref.current?.focus(); };

  /**
   * EL BOTÓN QUE CREA UN DESPLEGABLE. «Si es formato, debo poder poner otros desplegables,
   * de alguna manera» (25/09/2026): hasta hoy los chevrones salían de los encabezados que
   * YA venían en el texto (los que escribe la extracción) y no había forma de crear uno.
   *
   * ⚠️ USA LA MISMA REGLA CON LA QUE `DetalleDoc` RECONOCE UN ENCABEZADO, y por eso emite
   * un `<h3>` y no una negrita: el reconocedor acepta cualquier `h1-h6` SIN pasar por la
   * heurística del texto (≤60 caracteres, sin punto ni dos puntos al final). Con una
   * negrita, un renglón largo o terminado en punto se vería en negrita y no se plegaría
   * —el creador y el reconocedor diciendo cosas distintas, que es cómo se escribe algo que
   * no anda y no da ningún error—. Un `<h3>` puesto a mano es una DECLARACIÓN, no una
   * adivinanza, así que siempre pliega.
   */
  const bloqueDelCursor = (): HTMLElement | null => {
    const ed = ref.current;
    const sel = window.getSelection();
    if (!ed || !sel || !sel.anchorNode || !ed.contains(sel.anchorNode)) return null;
    let n: Node | null = sel.anchorNode;
    while (n && n.parentNode && n.parentNode !== ed) n = n.parentNode;
    return n && n.nodeType === 1 && n.parentNode === ed ? (n as HTMLElement) : null;
  };
  const alternarEncabezado = () => {
    const antes = bloqueDelCursor();
    const eraH = !!antes && /^H[1-6]$/.test(antes.tagName);
    document.execCommand('formatBlock', false, eraH ? '<div>' : '<h3>');
    const ahora = bloqueDelCursor();
    // Al QUITARLO hay que sacarle también la negrita: casi todos los encabezados del
    // detalle nacen de un `**…**` del markdown, así que un bloque desformateado que sigue
    // entero en negrita lo vuelve a reconocer la otra mitad de la regla y el botón no
    // haría nada visible.
    // Probado ROMPIÉNDOLO en Chrome (25/09/2026) sobre `<div><strong>Por qué</strong></div>`:
    // con sólo `formatBlock('<div>')` queda `<div><strong>Por qué</strong></div>` y el
    // reconocedor sigue diciendo que SÍ (el chevrón no se va); con este bloque puesto queda
    // `<div>Por qué</div>` y dice que NO. Uno y uno.
    if (eraH && ahora && ahora.querySelector('strong,b') && (ahora.textContent || '').trim() === (ahora.querySelector('strong,b')?.textContent || '').trim()) {
      const r = document.createRange(); r.selectNodeContents(ahora);
      const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(r);
      document.execCommand('bold');
      sel?.collapseToEnd();
    }
    ref.current?.focus();
    onFormato?.(!eraH && ahora ? (ahora.textContent || '').trim() : null);
  };

  const btn: CSSProperties = { width: 26, height: 24, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', fontSize: 12.5, fontFamily: SANS, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };

  return (
    <div>
      <style>{`.mako-rt[contenteditable]:empty:before{content:attr(data-ph);color:var(--faint);pointer-events:none}.mako-rt b,.mako-rt strong{font-weight:700}.mako-rt u{text-decoration:underline}.mako-rt code{font-family:'Geist Mono',monospace;font-size:.9em;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;padding:1px 5px}.mako-rt ul{margin:4px 0;padding-left:20px}.mako-rt li{margin:2px 0}.mako-rt h1,.mako-rt h2,.mako-rt h3,.mako-rt h4,.mako-rt h5,.mako-rt h6{font-size:1em;font-weight:700;margin:11px 0 2px;color:var(--ink)}.mako-rt:focus{box-shadow:${FOCO_BARRA}}`}</style>
      {/* mini toolbar: aparece al enfocar */}
      <div style={{ display: 'flex', gap: 5, height: focused ? 30 : 0, opacity: focused ? 1 : 0, overflow: 'hidden', transition: 'height .12s, opacity .12s', marginBottom: focused ? 6 : 0 }}>
        <button type="button" title="Negrita" onMouseDown={(e) => { e.preventDefault(); cmd('bold'); }} style={{ ...btn, fontWeight: 800 }}>B</button>
        <button type="button" title="Subrayado" onMouseDown={(e) => { e.preventDefault(); cmd('underline'); }} style={{ ...btn, textDecoration: 'underline' }}>U</button>
        <button type="button" title="Lista" onMouseDown={(e) => { e.preventDefault(); cmd('insertUnorderedList'); }} style={btn}>•</button>
        {encabezados && <button type="button" title="Convertir este renglón en desplegable (y al revés)" aria-label="Convertir este renglón en desplegable"
          onMouseDown={(e) => { e.preventDefault(); alternarEncabezado(); }} style={{ ...btn, width: 'auto', padding: '0 8px', gap: 4, fontWeight: 800 }}>
          <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M3.4 1.4 L7 5 L3.4 8.6" /></svg>H
        </button>}
      </div>
      <div ref={ref} className="mako-rt" contentEditable suppressContentEditableWarning role="textbox" aria-multiline
        data-ph={placeholder || 'Escribe aquí…'}
        onFocus={() => setFocused(true)} onBlur={commit}
        style={{ outline: 'none', border: 'none', background: 'transparent', color: 'var(--dim)', fontSize: 14, lineHeight: 1.65, fontFamily: SANS, minHeight: 24, whiteSpace: 'pre-wrap', paddingLeft: 10, ...style }} />
    </div>
  );
}
