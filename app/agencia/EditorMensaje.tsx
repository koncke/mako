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

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, useMemo } from 'react';
import { tramosConVariables } from '@/lib/variables-aviso';
import { Dropdown } from '../components/Dropdown';
import type { VariableAviso } from '@/lib/variables-aviso';

const SANS = "'Geist', sans-serif";

const MARCAS = [
  { comando: 'bold', label: 'B', titulo: 'Negrita', estilo: { fontWeight: 800 } as CSSProperties },
  { comando: 'italic', label: 'I', titulo: 'Itálica', estilo: { fontStyle: 'italic' } as CSSProperties },
  { comando: 'strikeThrough', label: 'S', titulo: 'Tachado', estilo: { textDecoration: 'line-through' } as CSSProperties },
] as const;

const escaparHtml = (s: string) => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Marcas → HTML, para pintar. Una marca abre y cierra en la MISMA línea.
 *
 * ⚠️ LOS TOKENS `{{…}}` QUEDAN AFUERA DE LAS MARCAS. La itálica es `_texto_` y un
 * token trae guiones bajos adentro: sin esto, `Hola {{lead_nombre}}, mirá
 * {{link_crm}}` se dibuja «Hola {{leadnombre}}, mirá {{linkcrm}}» en itálica, y con
 * una negrita en el medio salen etiquetas CRUZADAS que el navegador reparenta — y ahí
 * `domAMarcas` devuelve un texto distinto del que se escribió, sin que nada falle.
 */
function marcasAHtmlEditor(texto: string): string {
  const conMarcas = (l: string) => l
    .replace(/\*([^*\n]+?)\*/g, '<b>$1</b>')
    .replace(/_([^_\n]+?)_/g, '<i>$1</i>')
    .replace(/~([^~\n]+?)~/g, '<s>$1</s>');
  /**
   * ⚠️ EL TOKEN VA AZUL Y CON `color` A SECAS — NINGUN OTRO ESTILO.
   *
   * Pedido: «los datos deberían salir como {NOMBRE DEL DATO} y en el texto, pintado
   * de azul para que se diferencie». La burbuja (`TextoMarcas`) ya lo pintaba; el
   * editor no, y era el unico lugar donde el token se escribe.
   *
   * ⚠️ Y NO SE PUEDE COPIAR EL ESTILO DE LA BURBUJA. Alla el token va con
   * `fontWeight: 600`, y `domAMarcas` (abajo) trata `Number(est.fontWeight) >= 600`
   * como NEGRITA: copiarlo guarda `*{{lead_nombre}}*` en el texto, o sea le mete
   * asteriscos al mensaje sin que nada falle. Un span con SOLO color se aplana
   * limpio y el token vuelve entero — medido.
   */
  const porLinea = escaparHtml(texto ?? '').split('\n').map((l) =>
    tramosConVariables(l).map((t) => (t.esVar ? `<span style="color:var(--primary-strong)">${t.txt}</span>` : conMarcas(t.txt))).join(''));
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

export function EditorMensaje({ valor, onChange, filas = 10, disabled, variables, accion }: {
  valor: string;
  onChange: (v: string) => void;
  filas?: number;
  /** Lo que va al final de la barra de adentro: hoy el boton de IA. */
  accion?: ReactNode;
  disabled?: boolean;
  /**
   * Los datos de MaKo que ESTE mensaje puede resolver, ya agrupados. Sin lista, no hay
   * botón.
   *
   * Llegan AGRUPADOS y no planos a propósito: qué se ofrece y cómo se agrupa lo decide el
   * catálogo (`variablesOfrecidas`), así que un grupo nuevo o una regla de alcance nueva
   * las hereda esta barra sin tocarla.
   */
  variables?: Array<{ titulo: string; items: VariableAviso[] }>;
}) {
  // Los grupos salen del catálogo, no de esta pantalla. Ver el comentario del selector.
  const grupos = useMemo(() => variables ?? [], [variables]);
  const ref = useRef<HTMLDivElement>(null);
  const cajaRef = useRef<HTMLDivElement | null>(null);
  const [enfocado, setEnfocado] = useState(false);

  /**
   * Cerrar la barra con un `pointerdown` del documento y NO con el `onBlur` de la
   * caja: el menú del desplegable se monta por portal FUERA de la caja, así que
   * elegir un dato disparaba el blur y la barra desaparecía a mitad del gesto. Acá
   * se pregunta dónde cayó el click, que es el dato que de verdad decide.
   */
  useEffect(() => {
    if (!enfocado) return;
    const alTocar = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (cajaRef.current?.contains(t)) return;
      if (t.closest('[role="listbox"]')) return;
      setEnfocado(false);
    };
    document.addEventListener('pointerdown', alTocar, true);
    return () => document.removeEventListener('pointerdown', alTocar, true);
  }, [enfocado]);
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

  /**
   * METE UN DATO DE MAKO EN EL CURSOR.
   *
   * ⚠️ ES TEXTO PLANO, NO UN CHIP. `domAMarcas` —la mitad que decide qué se GUARDA—
   * aplana todo lo que no sea b/i/s y no avisa: un `<span>` que dijera «Nombre del
   * lead» se serializaría como ese texto y la variable desaparecería entera, sin un
   * error. Lo que se escribe es `{{lead_nombre}}`; el color se lo pone el pintado.
   *
   * `insertText` es el mismo camino que ya usa el pegado, y es lo único que respeta
   * el deshacer del navegador y la posición del cursor.
   */
  function insertarVariable(key: string) {
    const el = ref.current;
    if (!el || disabled) return;
    el.focus();
    document.execCommand('insertText', false, `{{${key}}}`);
    emitir();
    // Se pinta en el acto: el dato recién insertado es justo el que tiene que
    // verse distinto, y acá el caret puede ir al final sin molestar a nadie.
    repintar();
    const sel = window.getSelection();
    if (sel && el.lastChild) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); }
  }

  /**
   * Vuelve a pintar el HTML desde el texto. Es lo que hace que un token tipeado a
   * mano se ponga azul.
   *
   * ⚠️ CORRE AL SALIR DE LA CAJA, NO EN CADA TECLA. Reescribir el innerHTML mientras
   * se escribe manda el caret al principio en cada letra — es la trampa nº1 que la
   * cabecera de este archivo documenta, y por eso el efecto de abajo sólo repinta
   * cuando el valor viene de AFUERA. Al salir no hay caret que cuidar, así que el
   * token se ve azul en cuanto dejás de escribirlo. (Tampoco las negritas tipeadas a
   * mano se pintan antes de eso: es el mismo contrato, no una excepción del token.)
   */
  function repintar() {
    const el = ref.current;
    if (!el) return;
    const html = marcasAHtmlEditor(propio.current ?? valor ?? "");
    if (el.innerHTML !== html) el.innerHTML = html;
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
    /**
     * ⚠️ LA BARRA VA ADENTRO DE LA CAJA, PERO NO ADENTRO DEL `contentEditable`.
     *
     * Pedido: «las opciones de formateo de texto, como también el llamado a cosas
     * dentro de MaKo, deberían salir dentro de la caja de texto, y aparecer solo si
     * apreto para escribir». Lo primero es visual y lo segundo es un estado.
     *
     * Y la distincion no es un detalle de maqueta: `domAMarcas` camina TODOS los
     * `childNodes` de la caja y aplana a texto lo que no sea b/i/s/br/div/p. Un boton
     * que fuera HIJO del contentEditable se guardaria en el mensaje como la letra
     * «B», sin error y sin que nada quede rojo — es el mismo mecanismo que ya se
     * llevo puesto un chip de variables. Asi que el borde pasa al ENVOLTORIO, el
     * contentEditable se queda sin borde adentro, y la barra es su HERMANA flotando
     * encima.
     *
     * El foco no es el problema: cada boton ya lleva `onMouseDown preventDefault`, asi
     * que la seleccion viva sobrevive. Lo que faltaba era saber si la caja esta
     * enfocada, y eso no se puede colgar del `onBlur` del contentEditable: el menu del
     * desplegable se monta por PORTAL fuera de la caja, asi que elegir un dato
     * disparaba el blur y la barra se iba en el medio del gesto. Se cierra con un
     * `pointerdown` del documento que mira si el click cayo afuera de la caja Y afuera
     * de cualquier menu abierto.
     */
    <div ref={cajaRef} style={{ opacity: disabled ? 0.6 : 1 }}>
      {/*
        ⚠️ EL ALTO SE RESERVA AUNQUE LA BARRA NO ESTÉ. Con la barra adentro de la caja, su
        `paddingTop` le hacía lugar; afuera, mostrarla y esconderla movería la caja 34 px
        cada vez que alguien clickea para escribir — el texto se va de abajo del cursor
        justo al empezar a tipear. El envoltorio mide siempre lo mismo y lo que cambia es
        su contenido.
      */}
      <div style={{ minHeight: 34, marginBottom: 6 }}>
      {enfocado && !disabled && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          style={{
            // Un bloque propio, arriba de la caja y FUERA de su borde. Ya no flota:
            // flotar era lo que obligaba a reservarle un hueco adentro del texto.
            display: 'flex', alignItems: 'center', gap: 6,
            padding: 4, borderRadius: 9, background: 'var(--surface)',
            border: '1px solid var(--border)',
          }}
        >
          {MARCAS.map((m) => (
            <button
              key={m.comando} type="button"
              onClick={() => formato(m.comando)}
              title={m.titulo} aria-label={m.titulo}
              style={{
                width: 28, height: 26, borderRadius: 6, cursor: 'pointer',
                border: 'none', background: 'transparent',
                color: 'var(--dim)', fontFamily: SANS, fontSize: 13, lineHeight: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                ...m.estilo,
              }}
            >
              {m.label}
            </button>
          ))}
          {variables && variables.length > 0 && (
            <div style={{ marginLeft: 'auto' }}>
              {/*
                ⚠️ POR SECCIONES Y CON BUSCADOR, y las dos cosas las da el `Dropdown` solo.
                Pedido el 04/10/2026: «Hay muy pocas acciones o datos que extraer dentro
                de MaKo… te invito a que hagas un listado extenso, y que sea fácil de
                llegar a eso, que esté categorizado, y que tenga una barra de busqueda el
                desplegable para acceder facil». Con 42 filas, una lista plana es un
                scroll de dos pantallas: `columns` dibuja los grupos y la búsqueda
                aparece sola pasadas las 8 opciones (filtra por título Y por ejemplo, que
                es por donde uno busca «1.500» para encontrar el monto del cierre).

                La agrupación la decide el CATÁLOGO (`variablesPorGrupo`), no esta
                pantalla: el día que entre un grupo nuevo, el selector lo hereda.
              */}
              <Dropdown
                value="" width={170} ariaLabel="Meter un dato de MaKo"
                buttonStyle={{ padding: '5px 9px', fontSize: 12 }}
                secciones={grupos.map((g) => ({
                  title: g.titulo,
                  options: g.items.map((v) => ({
                    value: v.key, label: v.label,
                    // Sólo llegan acá los que este mensaje PUEDE resolver, así que el
                    // `sub` es siempre el valor de ejemplo. Lo que no se puede poner no
                    // se dibuja en gris: no se dibuja. Ver `variablesOfrecidas`.
                    sub: v.ejemplo,
                    // El token, para que buscar «saldo» encuentre «Cuánto falta
                    // cobrarle»: la palabra que uno tiene en la cabeza es la de la
                    // variable, y no está escrita en ningún renglón.
                    buscar: `{{${v.key}}}`,
                  })),
                }))}
                onChange={(k) => k && insertarVariable(k)}
                placeholder="＋ Dato de MaKo"
              />
            </div>
          )}
          {accion}
        </div>
      )}
      </div>

      <div style={{
        borderRadius: 10, background: 'var(--surface-2)',
        border: '1px solid ' + (enfocado ? 'var(--primary)' : 'var(--border-strong)'),
        boxShadow: enfocado ? '0 0 0 3px var(--primary-bg)' : undefined,
        transition: 'border-color .12s',
      }}>
      <div
        ref={ref}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox" aria-multiline="true" aria-label="El mensaje"
        onInput={emitir}
        onFocus={() => setEnfocado(true)}
        onBlur={() => { emitir(); repintar(); }}
        onPaste={(e) => {
          e.preventDefault();
          const txt = e.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, txt);
        }}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10,
          border: 'none', background: 'transparent',
          color: 'var(--ink)', fontSize: 13.5, fontFamily: SANS, lineHeight: 1.55,
          outline: 'none',
          // ⚠️ EL ALTO SALE DE ACA Y DE NINGUNA CONSTANTE COMPARTIDA. «La opcion de
          // editar el texto debería ser bastante más grande, para que entre todo
          // bien»: lo paga haber sacado RECORDATORIOS, que liberó el espacio. Subir
          // `PANEL_ANCHO` o `maxHeight` del panel habría movido TODOS los lienzos.
          minHeight: filas * 22, maxHeight: 430, overflowY: 'auto',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}
      />
      </div>
    </div>
  );
}
