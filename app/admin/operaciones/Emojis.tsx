'use client';

// =============================================================================
// Los emojis de la caja del Ops Center (17/10/2026)
// =============================================================================
// Martín: «Poner emojis, tal vez desde el "+"». Copiado de WhatsApp: el emoji NO va en el «+» (el de WhatsApp es sólo para
// adjuntar), va en su propio botón, la carita junto al campo; abre el panel con las pestañas de categorías abajo de la
// grilla (Recientes, Caras, Gestos, Corazones, Objetos, Símbolos) y tocar uno lo pone donde está el cursor, sin cerrar el
// panel (se pueden poner varios). Los recientes viven en este navegador.
// Un set corto a propósito (no las 3.600 del estándar): los que se usan en un chat de trabajo. En el teléfono el teclado
// trae todos.

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';

const CATEGORIAS: ReadonlyArray<{ id: string; nombre: string; icono: string; emojis: readonly string[] }> = [
  { id: 'caras', nombre: 'Caras', icono: '😀', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😜', '🤪', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😬', '😮‍💨', '😌', '😴', '😷', '🤯', '🥳', '😎', '🤓', '🧐', '😕', '😟', '😮', '😲', '😳', '🥺', '😢', '😭', '😤', '😡', '🤬', '😱', '😓', '🫠', '🫡', '🤗', '🤫', '🤐', '🙃', '💀'] },
  { id: 'gestos', nombre: 'Gestos', icono: '👍', emojis: ['👍', '👎', '👌', '🤌', '✌️', '🤞', '🤝', '🙏', '👏', '🙌', '👐', '💪', '👋', '🤙', '👉', '👈', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '✍️', '🫶', '👀', '🧠', '🫵', '🤷', '🤦', '🙋', '🙆', '🙅'] },
  { id: 'corazones', nombre: 'Corazones', icono: '❤️', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💯', '🔥', '✨', '⭐', '🌟', '💫', '🎉', '🎊'] },
  { id: 'objetos', nombre: 'Objetos', icono: '💡', emojis: ['💡', '📌', '📍', '📎', '📝', '📄', '📊', '📈', '📉', '🗂️', '📁', '📅', '⏰', '⏳', '💻', '📱', '🖥️', '⌨️', '🔒', '🔑', '🛠️', '🔧', '⚙️', '🧪', '🚀', '🎯', '🏆', '💰', '💸', '📣', '📢', '🔔', '📦', '🧩', '🎨', '🎬'] },
  { id: 'simbolos', nombre: 'Símbolos', icono: '✅', emojis: ['✅', '☑️', '✔️', '❌', '❎', '⚠️', '🚫', '⛔', '❓', '❗', '‼️', '⁉️', '➡️', '⬅️', '⬆️', '⬇️', '🔄', '🔁', '➕', '➖', '🆕', '🆗', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟥', '🟩'] },
];
const CLAVE_RECIENTES = 'ops-center:emojis';
const TOPE_RECIENTES = 24;

function leerRecientes(): string[] {
  try { const v = JSON.parse(window.localStorage.getItem(CLAVE_RECIENTES) ?? '[]'); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, TOPE_RECIENTES) : []; } catch { return []; }
}
function guardarReciente(e: string, antes: readonly string[]): string[] {
  const n = [e, ...antes.filter((x) => x !== e)].slice(0, TOPE_RECIENTES);
  try { window.localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(n)); } catch { /* es una comodidad */ }
  return n;
}

/** Pone `emoji` donde está el cursor (o reemplaza lo seleccionado) y devuelve el texto y dónde queda el cursor. */
export function conEmoji(texto: string, ini: number | null | undefined, fin: number | null | undefined, emoji: string): { texto: string; cursor: number } {
  const a = Math.max(0, Math.min(ini ?? texto.length, texto.length));
  const b = Math.max(a, Math.min(fin ?? a, texto.length));
  return { texto: texto.slice(0, a) + emoji + texto.slice(b), cursor: a + emoji.length };
}

// ─────────────────────────────────────────────────────────────────────
// EL PANEL, SIEMPRE ADENTRO DE LA PANTALLA Y DEL RECUADRO DEL CHAT (20/11/2026, Martín probando el onboarding en producción)
// ─────────────────────────────────────────────────────────────────────
// Era `position: absolute` con `left: -46px` fijo (centro.css): con la carita cerca del borde, el recuadro del chat (su `overflow`)
// lo cortaba —media columna de caritas y la grilla cortada—, y a 375 la pantalla. Al abrirse se mide el botón y lo que lo recorta, y
// el panel se acomoda adentro (tests/emojis-dentro-del-chat.test.ts).
export const ANCHO_PANEL = 340;
/** La grilla (232) y las pestañas. */
export const ALTO_PANEL = 290;
export const MARGEN_PANEL = 8;
/** Entre el botón y el panel, que abre hacia arriba. */
const SEPARACION = 8;
type Caja = { left: number; top: number; right: number; bottom: number };

/**
 * Dónde va el panel: `left` RELATIVO al botón (el panel es `absolute` dentro de `.co-emojis`, que empieza en el botón), su ancho y su
 * alto máximo, para que quede adentro de `limite` (lo que recorta al botón: el recuadro del chat y la pantalla) con su margen. Con
 * lugar, como siempre: 46 px antes del botón, 340 de ancho y su alto entero.
 */
export function lugarDelPanel(o: { boton: Caja; limite: Caja }): { left: number; ancho: number; altoMax: number } {
  const { boton, limite } = o;
  const ancho = Math.max(0, Math.min(ANCHO_PANEL, limite.right - limite.left - 2 * MARGEN_PANEL));
  const desde = limite.left + MARGEN_PANEL;
  const hasta = limite.right - MARGEN_PANEL - ancho;
  const izq = Math.min(Math.max(boton.left - 46, desde), Math.max(desde, hasta));
  const altoMax = Math.max(0, Math.min(ALTO_PANEL, boton.top - SEPARACION - (limite.top + MARGEN_PANEL)));
  return { left: izq - boton.left, ancho, altoMax };
}

/** Lo que recorta a `el`: la pantalla y cada antepasado con `overflow` que no es `visible` (el recuadro del chat, el panel lateral…). */
function limiteDe(el: HTMLElement): Caja {
  let left = 0, top = 0, right = window.innerWidth, bottom = window.innerHeight;
  for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
    const s = getComputedStyle(a);
    if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
    const k = a.getBoundingClientRect();
    left = Math.max(left, k.left); top = Math.max(top, k.top); right = Math.min(right, k.right); bottom = Math.min(bottom, k.bottom);
  }
  return { left, top, right, bottom };
}

export function BotonEmojis({ campo, valor, onValor, apagado }: {
  /** El <textarea> de la caja: el emoji va donde está su cursor. */
  campo: RefObject<HTMLTextAreaElement | null>;
  valor: string;
  onValor: (v: string) => void;
  apagado?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [cat, setCat] = useState('caras');
  const [recientes, setRecientes] = useState<string[]>([]);
  const caja = useRef<HTMLDivElement>(null);
  // Su lugar, medido antes de pintarse (useLayoutEffect): nunca se ve un cuadro recortado.
  const [lugar, setLugar] = useState<CSSProperties | undefined>(undefined);
  useLayoutEffect(() => {
    if (!abierto) return;
    const medir = () => {
      const w = caja.current;
      if (!w) return;
      const l = lugarDelPanel({ boton: w.getBoundingClientRect(), limite: limiteDe(w) });
      setLugar({ left: l.left, width: l.ancho, maxHeight: l.altoMax });
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [abierto]);
  // Dónde estaba el cursor al abrir: tocar el panel le saca el foco al campo.
  const sel = useRef<{ ini: number; fin: number } | null>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => { if (!caja.current?.contains(e.target as Node)) setAbierto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', tecla); };
  }, [abierto]);
  const abrir = () => {
    const el = campo.current;
    sel.current = el ? { ini: el.selectionStart, fin: el.selectionEnd } : null;
    const r = leerRecientes();
    setRecientes(r);
    if (!abierto) setCat(r.length ? 'recientes' : 'caras');
    setAbierto((v) => !v);
  };
  const poner = (e: string) => {
    const r = conEmoji(valor, sel.current?.ini, sel.current?.fin, e);
    sel.current = { ini: r.cursor, fin: r.cursor };
    onValor(r.texto);
    setRecientes((antes) => guardarReciente(e, antes));
    // El cursor, después del emoji (en el cuadro siguiente: el valor nuevo todavía no llegó al campo).
    window.setTimeout(() => { const el = campo.current; if (el) el.setSelectionRange(r.cursor, r.cursor); }, 0);
  };
  const lista = cat === 'recientes' ? recientes : CATEGORIAS.find((c) => c.id === cat)?.emojis ?? [];
  return (
    <div className="co-emojis" ref={caja}>
      <button type="button" className="co-emojis__boton" aria-haspopup="dialog" aria-expanded={abierto} disabled={apagado}
        onPointerDown={(e) => e.preventDefault()} onClick={abrir} aria-label="Emojis" title="Emojis">
        <Carita />
      </button>
      {abierto && (
        <div className="co-emojis__panel" role="dialog" aria-label="Emojis" style={lugar}>
          <div className="co-emojis__grilla" role="listbox" aria-label={cat === 'recientes' ? 'Recientes' : CATEGORIAS.find((c) => c.id === cat)?.nombre}>
            {lista.map((e) => (
              <button key={e} type="button" role="option" aria-selected={false} className="co-emojis__emoji" onPointerDown={(ev) => ev.preventDefault()} onClick={() => poner(e)}>{e}</button>
            ))}
            {!lista.length && <p className="co-emojis__vacio">Los que uses aparecerán aquí.</p>}
          </div>
          <div className="co-emojis__pestanas" role="tablist">
            <button type="button" role="tab" aria-selected={cat === 'recientes'} className="co-emojis__pestana" onClick={() => setCat('recientes')} aria-label="Recientes" title="Recientes">🕘</button>
            {CATEGORIAS.map((c) => (
              <button key={c.id} type="button" role="tab" aria-selected={cat === c.id} className="co-emojis__pestana" onClick={() => setCat(c.id)} aria-label={c.nombre} title={c.nombre}>{c.icono}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** La carita de WhatsApp, en trazo. */
function Carita() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="9" /><path d="M8.2 14.2c.9 1.3 2.2 2 3.8 2s2.9-.7 3.8-2" /><circle cx="9" cy="10" r=".6" fill="currentColor" /><circle cx="15" cy="10" r=".6" fill="currentColor" />
    </svg>
  );
}
