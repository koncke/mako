'use client';

// =============================================================================
// CampoConDatos — los {{datos}} AZULES y CLICKEABLES mientras se escribe
// =============================================================================
// Pedido de Martín (11/10/2026, undécima tanda, punto 7), textual: «Y los datos, al momento de EDITAR, también se
// deben marcar en azul y ser clickeables, si los clickeo que salte el desplegable con el dato que elegí y que se
// pueda cambiar allí mismo por otro dato.» En la burbuja de lo enviado ya se pintaban (TextoMarcas.tsx); en el
// campo donde se escribe, el token se veía crudo.
//
// CÓMO: un ESPEJO detrás del campo. Envuelve el <textarea> o el <input> que el editor ya tenía (no lo reescribe:
// el editor y sus pruebas siguen viendo SU campo, con su ref, su onChange y su onKeyDown) y dibuja detrás el mismo
// texto partido con `tokensDe` (lib/variables-aviso.ts): el texto común en tinta, cada token en
// var(--primary-strong) y en var(--bad) el que ESTE mensaje no puede mandar (`fuera`: la pregunta de Publicar). El
// campo queda arriba, transparente, con su cursor. Lo guardado sigue siendo TEXTO PLANO: no hay serializador que
// pueda perder un token, y deshacer, el IME y el teclado del celular son los del navegador.
//
// ⚠️ EL TOKEN CON PESO NORMAL (diseño, decisión 31): con 600 el texto del espejo es más ancho que el del campo y el
//    cursor queda corrido. Por lo mismo, en el campo no se pintan negritas ni itálicas: sólo color.
// ⚠️ EL ESPEJO COPIA EL ESTILO CALCULADO del campo (fuente, padding, borde, interlineado, letter-spacing), no el que
//    se le pasa: hay campos estilados por clase (`.mk-gmail-fila input`, `.mk-gmail-html`).
// ⚠️ LA BARRA DE SCROLL NO SE ESCONDE (el composer pasa los 168 px y scrollea): los dos reservan el mismo canal
//    (`scrollbar-gutter: stable`) y el espejo sigue el scrollTop/scrollLeft del campo.
// ⚠️ EL CLIC SE RESUELVE CON EL PUNTO DEL PUNTERO sobre las cajas del token en el espejo (`getClientRects`), no con
//    el cursor que deja el navegador: un clic en la mitad derecha de «}}» deja el cursor DESPUÉS del token.
//
// Clic en un token (también uno rojo): se selecciona y se abre el «{ }» con ESE dato marcado (`ArbolDeDatos
// seleccionado`); elegir otro lo reemplaza ahí mismo. Con el cursor ADENTRO de un token, el «{ }» del editor lo
// abre igual (`abrirDatoEnCursor`, el camino del teclado).
//
// Sin `datos` (los chats de /whatsapp), devuelve el campo TAL CUAL: ni espejo ni clic.

import {
  cloneElement, isValidElement, useCallback, useImperativeHandle, useInsertionEffect, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type MouseEvent, type ReactElement, type Ref,
} from 'react';
import { PopoverWA } from '../whatsapp/_shared/ComposerWhatsApp';
import { ArbolDeDatos } from './SelectorDatos';
import {
  tokensDe, tokensFueraDe, reemplazarToken, datoDe, CLAVE_MENSAJE_MAKO,
  type ContextoDatos, type GrupoDatos, type TokenEnTexto,
} from '@/lib/variables-aviso';
import { esVariableConocida } from '@/lib/template-vars';

// ── Lo que se decide sin DOM (lo ejecuta tests/campo-con-datos.test.ts) ──────────────────────────────────────

/** ¿Este dato NO se puede mandar en ESTE mensaje? (el rojo). Recibe la clave en minúsculas, sin llaves. */
export type DatoFuera = (key: string) => boolean;

/**
 * EL ROJO CON LA PREGUNTA DE PUBLICAR (`problemasDeTokens`, lib/tokens-del-flujo.ts), para quien sabe con qué se
 * resuelve su tarjeta (`contextoDeTarjeta`): una plantilla oficial lleva sólo los datos que el motor registra
 * (`esVariableConocida`); el resto, lo que el árbol de ese contexto resuelve (`tokensFueraDe`). Y `{{mensaje_mako}}`
 * siempre en rojo: Publicar ya no lo deja pasar (punto 4).
 */
export function fueraDelContexto(ctx: ContextoDatos | 'oficial'): DatoFuera {
  return (key) => {
    const k = key.toLowerCase();
    if (k === CLAVE_MENSAJE_MAKO) return true;
    if (ctx === 'oficial') return !esVariableConocida(k);
    return tokensFueraDe(`{{${k}}}`, ctx).length > 0;
  };
}

/**
 * EL ROJO DE QUIEN SÓLO TIENE EL ÁRBOL (sin contexto): fuera = lo que el árbol no ofrece, salvo un nombre viejo del
 * catálogo (`oculta`: se resuelve igual). Es el MISMO conjunto que `tokensFueraDe` con el contexto que armó ese
 * árbol (`datosOfrecidos` = los no ocultos que valen), con los ocultos dados por buenos.
 */
export function fueraDelArbol(grupos: readonly GrupoDatos[]): DatoFuera {
  const ofrecidas = new Set(grupos.flatMap((g) => g.items.map((d) => d.key)));
  return (key) => {
    const k = key.toLowerCase();
    if (k === CLAVE_MENSAJE_MAKO) return true;
    if (ofrecidas.has(k)) return false;
    return !datoDe(k)?.oculta;
  };
}

/** Un pedazo del espejo: texto común (`dato: null`) o un token con su clave y si queda fuera. */
export type TramoCampo = { txt: string; ini: number; fin: number; dato: string | null; fuera: boolean };

/** El texto partido para el espejo, con sus offsets en el texto tal cual. Juntos, los `txt` son el texto entero. */
export function tramosDelCampo(texto: string, fuera?: DatoFuera): TramoCampo[] {
  const t = typeof texto === 'string' ? texto : '';
  const out: TramoCampo[] = [];
  let i = 0;
  for (const tok of tokensDe(t)) {
    if (tok.ini > i) out.push({ txt: t.slice(i, tok.ini), ini: i, fin: tok.ini, dato: null, fuera: false });
    out.push({ txt: t.slice(tok.ini, tok.fin), ini: tok.ini, fin: tok.fin, dato: tok.key, fuera: !!fuera?.(tok.key) });
    i = tok.fin;
  }
  if (i < t.length) out.push({ txt: t.slice(i), ini: i, fin: t.length, dato: null, fuera: false });
  return out;
}

/**
 * El token donde está el cursor: ADENTRO (entre la primera y la última llave) o seleccionado ENTERO. Un cursor
 * pegado antes o después del token no está adentro: ahí el «{ }» inserta otro, como siempre.
 */
export function tokenEnCursor(texto: string, desde: number | null | undefined, hasta: number | null | undefined): TokenEnTexto | null {
  if (typeof desde !== 'number' || typeof hasta !== 'number') return null;
  for (const t of tokensDe(texto)) {
    if (desde === t.ini && hasta === t.fin) return t;
    if (t.ini < desde && hasta < t.fin) return t;
  }
  return null;
}

/**
 * Pone `{{nuevo}}` donde estaba ESE token, si sigue ahí (el texto pudo cambiar con el panel abierto), y dice dónde
 * queda el cursor. `null` = el token ya no está en su lugar: no se toca nada.
 */
export function cambiarDato(texto: string, tok: TokenEnTexto, nuevo: string): { valor: string; cursor: number } | null {
  const t = typeof texto === 'string' ? texto : '';
  if (t.slice(tok.ini, tok.fin).toLowerCase() !== `{{${tok.key}}}`) return null;
  return reemplazarToken(t, tok.ini, tok.fin, nuevo.toLowerCase());
}

/** ¿El punto cae en alguna de estas cajas? (las de un token que se parte en dos renglones son dos). */
export function puntoEnCajas(cajas: ArrayLike<{ left: number; top: number; right: number; bottom: number }>, x: number, y: number, holgura = 1): boolean {
  for (let i = 0; i < cajas.length; i++) {
    const c = cajas[i]!;
    if (x >= c.left - holgura && x <= c.right + holgura && y >= c.top - holgura && y <= c.bottom + holgura) return true;
  }
  return false;
}

/** El color de un token en el espejo. Sin `fontWeight`: ver la cabecera. */
export const colorDelDato = (fuera: boolean): string => (fuera ? 'var(--bad)' : 'var(--primary-strong)');

// ── El campo ─────────────────────────────────────────────────────────────────────────────────────────────────

export type CampoConDatosHandle = {
  /** Con el cursor ADENTRO de un dato: lo selecciona y abre el «{ }» con él elegido. `false` = no había uno. */
  abrirDatoEnCursor: () => boolean;
};

type Campo = HTMLTextAreaElement | HTMLInputElement;
/** Un manejador del campo tal como lo trae (el de un `<textarea>` o el de un `<input>`): se llama con su evento. */
type Manejador = ((e: never) => void) | undefined;
type PropsDelCampo = {
  value?: unknown;
  style?: CSSProperties;
  className?: string;
  ref?: Ref<Campo>;
  onScroll?: Manejador;
  onClick?: Manejador;
  onMouseMove?: Manejador;
  onMouseLeave?: Manejador;
  onKeyUp?: Manejador;
  onSelect?: Manejador;
};

/** Lo que el espejo copia del estilo CALCULADO del campo: todo lo que mueve una letra de lugar. */
const COPIADAS = [
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'fontStretch', 'fontFeatureSettings', 'fontKerning',
  'letterSpacing', 'wordSpacing', 'lineHeight', 'textIndent', 'textTransform', 'textAlign', 'tabSize', 'direction', 'boxSizing',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius',
] as const;

function copiarEstilo(campo: Campo, espejo: HTMLElement, esInput: boolean) {
  const cs = getComputedStyle(campo);
  const destino = espejo.style as unknown as Record<string, string>;
  const origen = cs as unknown as Record<string, string>;
  for (const p of COPIADAS) if (destino[p] !== origen[p]) destino[p] = origen[p] ?? '';
  if (!esInput) {
    destino.whiteSpace = cs.whiteSpace === 'pre' ? 'pre' : 'pre-wrap';
    destino.overflowWrap = cs.overflowWrap || 'break-word';
    destino.wordBreak = cs.wordBreak || 'normal';
  }
  espejo.scrollTop = campo.scrollTop;
  espejo.scrollLeft = campo.scrollLeft;
}

function asignarRef<T>(r: Ref<T> | undefined, n: T | null) {
  if (typeof r === 'function') r(n);
  else if (r && typeof r === 'object') (r as { current: T | null }).current = n;
}

/**
 * La selección se ve a través del campo transparente, y el placeholder no hereda el `-webkit-text-fill-color`
 * transparente. Va al `<head>` una vez (no como un `<style>` en el árbol: el campo se dibuja en muchos editores).
 */
const CSS_CAMPO = '.mk-campo-datos::selection{background:rgba(36,95,214,.26)}'
  + '.mk-campo-datos::placeholder{color:var(--faint);-webkit-text-fill-color:var(--faint);opacity:1}';

export function CampoConDatos({ children, datos, fuera, onValor, estiloCaja, ref }: {
  /** El `<textarea>` o el `<input>` del editor, con su `value`, su `ref` y sus eventos. */
  children: ReactElement<PropsDelCampo>;
  /** El árbol del «{ }» de ESTE mensaje (`datosOfrecidos`). Sin él (o vacío), el campo queda como estaba. */
  datos?: GrupoDatos[] | null;
  /** Lo que va en rojo. Sin esto, lo que el árbol no ofrece (`fueraDelArbol`). */
  fuera?: DatoFuera;
  /** El texto nuevo cuando se cambia un dato desde el «{ }» (tipear sigue yendo por el `onChange` del campo). */
  onValor: (v: string) => void;
  /** El lugar que el campo ocupaba en su fila (`flex`, `minWidth`): lo toma la caja que envuelve al campo y al espejo. */
  estiloCaja?: CSSProperties;
  ref?: Ref<CampoConDatosHandle>;
}) {
  const activo = !!datos?.length && isValidElement(children);
  const props: PropsDelCampo = isValidElement(children) ? children.props : {};
  const esInput = isValidElement(children) && children.type === 'input';
  const valor = typeof props.value === 'string' ? props.value : '';
  const refOriginal = props.ref;
  const campo = useRef<Campo | null>(null);
  const espejo = useRef<HTMLDivElement | null>(null);
  const [tocado, setTocado] = useState<(TokenEnTexto & { ancla: HTMLElement }) | null>(null);
  /** El cambio que se acaba de pedir: el cursor va después del dato nuevo cuando el valor llega. */
  const pendiente = useRef<{ valor: string; cursor: number } | null>(null);
  const vivo = useRef({ valor, onValor });
  const fueraDe = useMemo(() => fuera ?? fueraDelArbol(datos ?? []), [fuera, datos]);

  useInsertionEffect(() => {
    if (!activo || typeof document === 'undefined' || document.getElementById('mk-campo-datos')) return;
    const s = document.createElement('style');
    s.id = 'mk-campo-datos';
    s.textContent = CSS_CAMPO;
    document.head.appendChild(s);
  }, [activo]);

  // Cada render: lo vivo, el estilo del espejo (el del campo pudo cambiar: el composer le pone el alto) y el cursor
  // de un dato recién cambiado.
  useLayoutEffect(() => {
    vivo.current = { valor, onValor };
    const el = campo.current;
    const es = espejo.current;
    if (!activo || !el || !es) return;
    copiarEstilo(el, es, esInput);
    const p = pendiente.current;
    if (p && p.valor === valor) {
      pendiente.current = null;
      try { el.focus(); el.setSelectionRange(p.cursor, p.cursor); } catch { /* el campo ya no está */ }
    }
  });

  // El alto del campo cambia sin que este componente se dibuje (el composer crece con el texto): se vuelve a copiar.
  useLayoutEffect(() => {
    const el = campo.current;
    if (!activo || !el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => { const es = espejo.current; if (es && campo.current) copiarEstilo(campo.current, es, esInput); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [activo, esInput]);

  const refCampo = useCallback((n: Campo | null) => { campo.current = n; asignarRef(refOriginal, n); }, [refOriginal]);

  /** El token del espejo bajo el punto del puntero, con su caja (para anclar el «{ }»). */
  const tokenBajo = (x: number, y: number): (TokenEnTexto & { ancla: HTMLElement }) | null => {
    const es = espejo.current;
    if (!es) return null;
    for (const s of Array.from(es.querySelectorAll<HTMLElement>('[data-dato]'))) {
      if (puntoEnCajas(s.getClientRects(), x, y)) return { ini: Number(s.dataset.ini), fin: Number(s.dataset.fin), key: s.dataset.dato ?? '', ancla: s };
    }
    return null;
  };
  const abrir = (t: TokenEnTexto & { ancla: HTMLElement }) => {
    try { campo.current?.setSelectionRange(t.ini, t.fin); } catch { /* el campo ya no está */ }
    setTocado(t);
  };
  const elegir = (k: string) => {
    const t = tocado;
    setTocado(null);
    if (!t) return;
    const el = campo.current;
    const r = cambiarDato(vivo.current.valor, t, k);
    if (!r) { el?.focus(); return; }
    if (r.valor === vivo.current.valor) {
      try { el?.focus(); el?.setSelectionRange(r.cursor, r.cursor); } catch { /* el campo ya no está */ }
      return;
    }
    pendiente.current = r;
    vivo.current.onValor(r.valor);
  };

  useImperativeHandle(ref, () => ({
    abrirDatoEnCursor: () => {
      const el = campo.current;
      const es = espejo.current;
      if (!activo || !el || !es) return false;
      const t = tokenEnCursor(vivo.current.valor, el.selectionStart, el.selectionEnd);
      if (!t) return false;
      abrir({ ...t, ancla: es.querySelector<HTMLElement>(`[data-ini="${t.ini}"]`) ?? el });
      return true;
    },
  }), [activo]);

  if (!activo || !isValidElement(children)) return children;

  const alClic = (e: MouseEvent<Campo>) => {
    const el = campo.current;
    if (!el || el.disabled || el.readOnly) return;
    // Arrastró para seleccionar: es suyo, no un clic en un dato.
    if (el.selectionStart !== el.selectionEnd) return;
    const t = tokenBajo(e.clientX, e.clientY);
    if (t) abrir(t);
  };
  const alMover = (e: MouseEvent<Campo>) => {
    const el = campo.current;
    if (!el) return;
    const c = !el.disabled && !el.readOnly && tokenBajo(e.clientX, e.clientY) ? 'pointer' : '';
    if (el.style.cursor !== c) el.style.cursor = c;
  };
  const alSalir = () => { if (campo.current) campo.current.style.cursor = ''; };
  const seguirScroll = () => {
    const el = campo.current;
    const es = espejo.current;
    if (el && es) { es.scrollTop = el.scrollTop; es.scrollLeft = el.scrollLeft; }
  };
  const juntar = <E,>(a: Manejador, b: (e: E) => void) => (e: E) => { (a as ((x: E) => void) | undefined)?.(e); b(e); };

  const { background, backgroundColor, color, ...resto } = props.style ?? {};
  const tinta = typeof color === 'string' && color !== 'transparent' ? color : 'var(--ink)';
  const fondo = background ?? backgroundColor ?? 'transparent';
  const estiloEspejo: CSSProperties = {
    position: 'absolute', inset: 0, margin: 0, overflow: 'hidden', pointerEvents: 'none', userSelect: 'none',
    background: fondo, color: tinta, borderStyle: 'solid', borderColor: 'transparent',
    ...(esInput
      ? { display: 'flex', alignItems: 'center', whiteSpace: 'pre' }
      : { whiteSpace: 'pre-wrap', overflowWrap: 'break-word', scrollbarGutter: 'stable' }),
  };
  const estiloCampo: CSSProperties = {
    ...resto, position: 'relative', display: 'block', width: '100%',
    background: 'transparent', color: 'transparent', WebkitTextFillColor: 'transparent', caretColor: tinta,
    ...(esInput ? {} : { scrollbarGutter: 'stable' }),
  };
  const tramos = tramosDelCampo(valor, fueraDe).map((t, i) => (t.dato
    ? <span key={i} data-dato={t.dato} data-ini={t.ini} data-fin={t.fin} style={{ color: colorDelDato(t.fuera) }}>{t.txt}</span>
    : <span key={i}>{t.txt}</span>));

  return (
    <div data-campo-datos="" style={{ position: 'relative', display: 'block', minWidth: 0, ...estiloCaja }}>
      <div ref={espejo} aria-hidden="true" style={estiloEspejo}>
        {esInput ? <span style={{ flex: 'none', whiteSpace: 'pre' }}>{tramos}</span> : tramos}
        {/* Un renglón vacío al final ocupa su alto en el campo; en el espejo, sólo con algo adentro. */}
        {!esInput && valor.endsWith('\n') ? '​' : null}
      </div>
      {cloneElement(children, {
        ref: refCampo,
        className: [props.className, 'mk-campo-datos'].filter(Boolean).join(' '),
        style: estiloCampo,
        onScroll: juntar(props.onScroll, seguirScroll),
        onKeyUp: juntar(props.onKeyUp, seguirScroll),
        onSelect: juntar(props.onSelect, seguirScroll),
        onClick: juntar(props.onClick, alClic),
        onMouseMove: juntar(props.onMouseMove, alMover),
        onMouseLeave: juntar(props.onMouseLeave, alSalir),
      })}
      {tocado && (
        <PopoverWA ancla={tocado.ancla} etiqueta="Datos" onCerrar={() => setTocado(null)}>
          <ArbolDeDatos grupos={datos ?? []} seleccionado={tocado.key} onElegir={elegir} />
        </PopoverWA>
      )}
    </div>
  );
}
