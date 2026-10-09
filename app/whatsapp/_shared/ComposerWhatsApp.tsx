'use client';

// =============================================================================
// ComposerWhatsApp — la barra de escribir de WhatsApp, UNA para todo el producto
// =============================================================================
// Pedido de Martín (08/10/2026, punto 8): «todo lo que tenga que ver con WhatsApp tenga un mismo
// editable, ya sea audio, texto, archivos... con la interfaz tipo WhatsApp que ya creamos... Que
// se grabe audio desde el costado, que se pueda adjuntar archivos, emojis etc... Copialo tal
// cual». Lo que mostró es el composer de /whatsapp (EmpresaInbox), que era una COPIA A MANO del de
// ChatHilo. Había tres copias; ésta es la pieza, y la montan:
//   · ChatHilo (simulador, ensayo, plantillas, grupos de MaKo) y EmpresaInbox, en modo `enviar`;
//   · el editor de un mensaje del lienzo (app/chatbot/EditorMensajeWhatsApp.tsx), en modo `editar`.
// (El inbox OFICIAL, WhatsAppApp.tsx, todavía tiene la suya.)
//
// Es PRESENTACIONAL: el valor vive afuera (el borrador del chat, o el paso del lienzo), y lo único
// que guarda adentro es lo que es de la barra: si el selector de emojis está abierto y la
// grabación en curso.
//
// Lo que cambia entre los dos modos, y por qué:
//   · ENTER. En `enviar` manda (Shift+Enter, salto de línea). En `editar` es un salto de línea:
//     copiar el onKeyDown del chat a un editor hace que Enter guarde y los mensajes pierdan sus
//     renglones (BurbujaMaKo.tsx ya lo tenía escrito: «en un editor, Enter NO»). Lo decide
//     `accionDeTecla`, que un test ejecuta.
//   · LA FLECHA. En `enviar`, con texto o adjunto la flecha reemplaza al micrófono, como en
//     WhatsApp. En `editar` no hay nada que mandar: el texto ES el mensaje, y el micrófono queda
//     siempre al costado.
//   · EL AUDIO, IGUAL EN LOS DOS Y EN TODOS LADOS (sexta tanda, WhatsApp 7): ✓ TERMINA la grabación
//     (no manda), la barra pasa a escucharla (▶ donde estaba el punto rojo, 🎤 para seguir grabando) y
//     recién la ➤ verde la manda (`onAudio`). La sesión vive en `useGrabacionVoz` (VoiceRecorder.tsx).
//     `audioAlSoltar` ya no hace nada: «por motivos de seguridad que no se escape nunca un audio
//     indeseado» — EmpresaInbox lo sigue pasando y ahora también escucha antes de mandar.
//   · UN AUDIO QUE YA EXISTE (`audioPendiente`, WhatsApp 9): editar una nota de voz del lienzo la abre
//     en ESTA misma barra para escucharla, borrarla o grabarle algo más, no en un recuadro con una ✕.
//
// ⚠️ EL EMOJI Y EL MENÚ DEL CLIP VAN POR PORTAL (`PopoverWA`). El panel del nodo en el lienzo mide
//    328 px, scrollea y vive adentro de un contenedor con `overflow: hidden` (Lienzo.tsx): un
//    selector de 340×320 posicionado `absolute` arriba de la fila quedaba recortado por los dos
//    lados. En el body, ubicado con la caja del botón, entra siempre.
// ⚠️ EL EMOJI SE INSERTA EN EL CURSOR, no al final (`insertarEnCursor`). Al final, un emoji puesto
//    a mitad de una frase aparecía después del link del pie.

import {
  useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, useSyncExternalStore,
  type ChangeEvent, type CSSProperties, type ReactNode, type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import { EmojiPicker } from '../EmojiPicker';
import { SendArrow, IconSmiley, IconClip, IconMic, IconDoc } from './composer-icons';
import { useGrabacionVoz, BarraGrabacion } from './VoiceRecorder';
import { useCapaModal } from '@/app/_components/pila-modales';

// ── Lo que se decide sin DOM (lo ejecuta tests/composer-whatsapp.test.ts) ────────────────────

export type ModoComposer = 'enviar' | 'editar';

/** Qué hace una tecla en el campo. `null` = lo de siempre del navegador (en `editar`, Enter es un renglón). */
export function accionDeTecla(modo: ModoComposer, e: { key: string; shiftKey?: boolean; isComposing?: boolean }): 'enviar' | null {
  if (modo !== 'enviar') return null;
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return null;
  return 'enviar';
}

/**
 * Pone `texto` donde está el cursor (o reemplaza lo seleccionado) y dice dónde queda el cursor.
 * Sin selección conocida, al final: es lo que hace el navegador con un valor puesto por código.
 */
export function insertarEnCursor(valor: string, desde: number | null | undefined, hasta: number | null | undefined, texto: string): { valor: string; cursor: number } {
  const n = valor.length;
  const a = typeof desde === 'number' && Number.isFinite(desde) ? Math.max(0, Math.min(n, desde)) : n;
  const b = typeof hasta === 'number' && Number.isFinite(hasta) ? Math.max(a, Math.min(n, hasta)) : a;
  return { valor: valor.slice(0, a) + texto + valor.slice(b), cursor: a + texto.length };
}

export type Caja = { left: number; top: number; right: number; bottom: number };

/**
 * Dónde cae un popover del composer: ARRIBA del botón (la barra vive abajo de todo, como en
 * WhatsApp), alineado a su borde izquierdo. Si arriba no entra y abajo hay más lugar, abajo. Y
 * siempre adentro de la ventana. Pura y afuera del componente para que un test la ejecute.
 */
export function ubicarPopover(ancla: Caja, panel: { ancho: number; alto: number }, ventana: { ancho: number; alto: number }, margen = 8): { left: number; top: number } {
  const left = Math.max(margen, Math.min(ancla.left, ventana.ancho - panel.ancho - margen));
  const cabeArriba = ancla.top - margen;
  const cabeAbajo = ventana.alto - ancla.bottom - margen;
  const abajo = panel.alto > cabeArriba && cabeAbajo > cabeArriba;
  const crudo = abajo ? ancla.bottom + 6 : ancla.top - 6 - panel.alto;
  const top = Math.max(margen, Math.min(crudo, ventana.alto - panel.alto - margen));
  return { left, top };
}

// ── El popover (emoji, clip, datos, biblioteca) ──────────────────────────────────────────────

const sinSuscripcion = () => () => {};

/**
 * Un panel anclado a un botón, en el body. Se registra en la pila de capas (`anidada`: no tapa a
 * lo de abajo) y cierra con Escape y con un clic afuera.
 *
 * ⚠️ ESCAPE CON `stopImmediatePropagation`. Todos los Escape de la casa viven en `document`, y
 *    `stopPropagation` no frena a los listeners hermanos del mismo nodo: sin esto, Escape cerraba
 *    el emoji Y el panel del nodo (AGENTS.md, «un popover anclado también es una capa»).
 * ⚠️ LA POSICIÓN SE ESCRIBE EN EL NODO, no en un estado: nace invisible en (0,0) y un layout
 *    effect lo mueve antes del primer pintado. `montado` va en las dependencias — sin él, la
 *    primera corrida no encuentra el nodo que monta el portal y no vuelve a correr nunca.
 */
export function PopoverWA({ ancla, onCerrar, etiqueta, children }: {
  ancla: HTMLElement | null;
  onCerrar: () => void;
  /** El nombre del panel para el lector de pantalla. */
  etiqueta: string;
  children: ReactNode;
}) {
  const montado = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const panel = useRef<HTMLDivElement>(null);
  const capa = useCapaModal(true, { anidada: true });
  const arriba = capa.esElDeArriba;
  const cerrar = useRef(onCerrar);
  useEffect(() => { cerrar.current = onCerrar; }, [onCerrar]);

  useLayoutEffect(() => {
    const p = panel.current;
    if (!p) return;
    const ubicar = () => {
      const caja = p.getBoundingClientRect();
      const ventana = { ancho: window.innerWidth, alto: window.innerHeight };
      const a = ancla?.isConnected ? ancla.getBoundingClientRect() : null;
      // Campo por campo: `top`/`left` de un DOMRect son getters del prototipo y un spread no los copia.
      const pos = a
        ? ubicarPopover({ left: a.left, top: a.top, right: a.right, bottom: a.bottom }, { ancho: caja.width, alto: caja.height }, ventana)
        : { left: Math.max(8, (ventana.ancho - caja.width) / 2), top: Math.max(8, (ventana.alto - caja.height) / 2) };
      p.style.left = `${Math.round(pos.left)}px`;
      p.style.top = `${Math.round(pos.top)}px`;
      p.style.visibility = 'visible';
    };
    ubicar();
    window.addEventListener('resize', ubicar);
    window.addEventListener('scroll', ubicar, true);
    // El contenido cambia de alto (una búsqueda de emojis sin resultados, una lista que llega).
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(ubicar) : null;
    ro?.observe(p);
    return () => { window.removeEventListener('resize', ubicar); window.removeEventListener('scroll', ubicar, true); ro?.disconnect(); };
  }, [ancla, montado]);

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t || panel.current?.contains(t) || ancla?.contains(t)) return;
      cerrar.current();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !arriba()) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      cerrar.current();
    };
    document.addEventListener('mousedown', fuera, true);
    document.addEventListener('keydown', tecla, true);
    return () => { document.removeEventListener('mousedown', fuera, true); document.removeEventListener('keydown', tecla, true); };
  }, [ancla, arriba]);

  if (!montado) return null;
  return createPortal(
    <div ref={panel} role="dialog" aria-label={etiqueta}
      style={{ position: 'fixed', left: 0, top: 0, visibility: 'hidden', zIndex: capa.z, display: capa.visible ? undefined : 'none' }}>
      {children}
    </div>,
    document.body,
  );
}

/**
 * Una fila de un menú. Con `submenu`, elegirla abre la lista adentro del MISMO panel («Audios
 * guardados», «Archivos guardados»): un segundo popover colgado de otro lado se despega del clip.
 */
export type OpcionMenuWA = {
  key: string; label: string; icono?: ReactNode; detalle?: string; deshabilitado?: boolean;
  onElegir?: () => void;
  submenu?: OpcionMenuWA[];
  /** Lo que dice el submenú vacío. */
  vacio?: string;
};

const cajaMenu: CSSProperties = { minWidth: 210, maxWidth: 300, maxHeight: 320, overflowY: 'auto', padding: 6, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12, boxShadow: '0 12px 34px rgba(18,21,27,.18)', fontFamily: "'Geist', sans-serif" };
const filaMenu: CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: 'none', borderRadius: 8, background: 'transparent', color: 'var(--ink)', fontSize: 13.5, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' };

/** La lista de un popover: el menú del clip, los datos, la biblioteca. `alElegir`: después de una hoja (para cerrar). */
export function MenuWA({ opciones, vacio, alElegir }: { opciones: OpcionMenuWA[]; vacio?: string; alElegir?: () => void }) {
  const [abierta, setAbierta] = useState<OpcionMenuWA | null>(null);
  const lista = abierta?.submenu ?? opciones;
  return (
    <div role="menu" style={cajaMenu}>
      <style>{'.mk-menu-wa:hover:not(:disabled){background:var(--surface-2)}'}</style>
      {abierta && (
        <button type="button" className="mk-menu-wa" onClick={() => setAbierta(null)}
          style={{ ...filaMenu, color: 'var(--dim)', fontSize: 12.5, fontWeight: 600 }}>‹ {abierta.label}</button>
      )}
      {lista.length === 0 && <div style={{ padding: '10px 12px', color: 'var(--faint)', fontSize: 13 }}>{(abierta ? abierta.vacio : vacio) ?? 'Nada todavía.'}</div>}
      {lista.map((o) => (
        <button key={o.key} type="button" role="menuitem" className="mk-menu-wa" disabled={o.deshabilitado}
          onClick={() => { if (o.submenu) { setAbierta(o); return; } o.onElegir?.(); alElegir?.(); }}
          style={{ ...filaMenu, opacity: o.deshabilitado ? 0.5 : 1, cursor: o.deshabilitado ? 'default' : 'pointer' }}>
          {o.icono && <span aria-hidden style={{ flex: 'none', display: 'inline-flex', color: 'var(--dim)' }}>{o.icono}</span>}
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
          {o.detalle && <span style={{ flex: 'none', fontSize: 11.5, color: 'var(--faint)' }}>{o.detalle}</span>}
          {o.submenu && <span aria-hidden style={{ flex: 'none', color: 'var(--faint)' }}>›</span>}
        </button>
      ))}
    </div>
  );
}

// ── La barra ─────────────────────────────────────────────────────────────────────────────────

/** El ícono redondo del composer (emoji / clip / mic). El mismo de ChatHilo y EmpresaInbox. */
export const iconComposer: CSSProperties = { flex: 'none', width: 42, height: 42, borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, lineHeight: 1, cursor: 'pointer' };
const iconBtn: CSSProperties = { width: 28, height: 28, flex: 'none', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--dim)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 };

export function IconVideo({ size = 22 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth={1.8} /><path d="M16 10.5l5-3v9l-5-3z" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" /></svg>;
}

/** Lo que va arriba del campo: un adjunto en espera, o el audio / archivo de un mensaje. */
export type ChipComposer = {
  /** Miniatura (una imagen local o la URL del archivo). */
  imagen?: string | null;
  icono?: 'doc' | 'audio' | 'video';
  titulo: string;
  detalle?: string;
  onQuitar?: () => void;
  tituloQuitar?: string;
};

export type ComposerHandle = {
  /** Escribe `texto` en el cursor. `enfocar`: devuelve el foco al campo (un dato sí, un emoji no). */
  insertar: (texto: string, opciones?: { enfocar?: boolean }) => void;
  enfocar: () => void;
  /** Arranca a grabar (el ✦ de MaKo: «Grabar con este guion»). Sin micrófono (`onAudio`), nada. */
  grabar: () => void;
};

export type ComposerWhatsAppProps = {
  modo: ModoComposer;
  valor: string;
  onValor: (v: string) => void;
  placeholder?: string;
  /** Mientras se manda o se sube algo: apaga los botones (no el campo). */
  ocupado?: boolean;
  /** Plantillas: la barra se ve, apagada, y no hace nada. */
  soloLectura?: boolean;
  /** `enviar`: Enter y la flecha. */
  onEnviar?: () => void;
  /** Clip simple: abre el selector de archivos con `acceptArchivo` y entrega el archivo. */
  onArchivo?: (f: File) => void;
  acceptArchivo?: string;
  /** Clip con menú (el editor): «Foto o video», «Documento», «Audios guardados»… */
  menuClip?: OpcionMenuWA[];
  /** Mic: lo que se MANDA (con la ➤ verde, después de escucharlo). Sin esto, no hay micrófono. */
  onAudio?: (blob: Blob, secs: number) => void | Promise<void>;
  onErrorAudio?: (m: string) => void;
  /**
   * SIN EFECTO desde la sexta tanda (WhatsApp 7): mandaba la nota de voz al soltar la grabación. Ahora
   * en todos lados se termina, se escucha y se manda con la ➤. Queda en el tipo para que quien la pasa
   * (EmpresaInbox) siga compilando.
   */
  audioAlSoltar?: boolean;
  /** Arriba de la barra de grabación, MIENTRAS se graba (el guion que sugirió MaKo, si sugirió uno). */
  mientrasGraba?: ReactNode;
  /**
   * Un audio que YA existe y se está editando (WhatsApp 9): la barra de escuchar, con 🗑 (`onDescartar`),
   * ➤ (`onUsar`: dejarlo como está) y, con `seguir`, 🎤 para grabarle algo más al final (lo baja, lo
   * une y lo que sale por `onAudio` es el audio nuevo).
   */
  audioPendiente?: { url: string | null; secs?: number | null; onDescartar: () => void; onUsar: () => void; rotuloUsar?: string; seguir?: boolean } | null;
  chip?: ChipComposer | null;
  ref?: Ref<ComposerHandle>;
  /** El alto máximo del campo antes de scrollear. */
  maxAlto?: number;
  /**
   * Un botón más EN la barra, al lado del clip (cuarta tanda del chatbot, punto 15: «la opción de "{}"
   * para insertar dato, debería estar al lado del botón de adjuntar archivo»). Lo dibuja quien monta;
   * la barra sólo le da el lugar. Sin esto, la barra es la de siempre.
   */
  trasClip?: ReactNode;
};

export function ComposerWhatsApp({
  modo, valor, onValor, placeholder, ocupado, soloLectura, onEnviar, onArchivo, acceptArchivo, menuClip,
  onAudio, onErrorAudio, mientrasGraba, audioPendiente, chip, ref, maxAlto, trasClip,
}: ComposerWhatsAppProps) {
  const editar = modo === 'editar';
  const campo = useRef<HTMLTextAreaElement | null>(null);
  const archivo = useRef<HTMLInputElement | null>(null);
  const [btnEmoji, setBtnEmoji] = useState<HTMLButtonElement | null>(null);
  const [btnClip, setBtnClip] = useState<HTMLButtonElement | null>(null);
  const [abierto, setAbierto] = useState<'emoji' | 'clip' | null>(null);
  const valorVivo = useRef(valor);
  const cursorPendiente = useRef<number | null>(null);

  const voz = useGrabacionVoz(async (blob, secs) => { await onAudio?.(blob, secs); }, onErrorAudio);
  const [bajando, setBajando] = useState(false);
  /** 🎤 sobre un audio que ya existe: se baja, se entra a la sesión con él y se graba lo que sigue. */
  const seguirExistente = async () => {
    const u = audioPendiente?.url;
    if (!u || bajando) return;
    setBajando(true);
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(30_000) });
      if (!r.ok) throw new Error(String(r.status));
      const blob = await r.blob();
      await voz.revisarExistente({ blob, secs: audioPendiente?.secs ?? 0 });
      await voz.seguir();
    } catch {
      onErrorAudio?.('No pude abrir ese audio para seguir grabando. Grábalo de nuevo.');
    } finally { setBajando(false); }
  };

  // El valor de AHORA para insertar: un emoji elegido entre dos renders no puede pisar lo último
  // que se escribió. Y el cursor se repone después de que React escribió el valor nuevo.
  useLayoutEffect(() => {
    valorVivo.current = valor;
    const el = campo.current;
    if (!el) return;
    if (cursorPendiente.current != null) {
      const c = cursorPendiente.current;
      cursorPendiente.current = null;
      try { el.setSelectionRange(c, c); } catch { /* el campo ya no está */ }
    }
    // Crece con el texto, como el de WhatsApp, hasta su tope; después scrollea.
    const tope = maxAlto ?? (editar ? 168 : 120);
    el.style.height = 'auto';
    const borde = el.offsetHeight - el.clientHeight;
    const alto = el.scrollHeight + borde;
    el.style.height = `${Math.min(alto, tope)}px`;
    el.style.overflowY = alto > tope ? 'auto' : 'hidden';
  }, [valor, editar, maxAlto]);

  const insertar = (texto: string, opciones?: { enfocar?: boolean }) => {
    const el = campo.current;
    const r = insertarEnCursor(valorVivo.current, el?.selectionStart, el?.selectionEnd, texto);
    cursorPendiente.current = r.cursor;
    valorVivo.current = r.valor;
    onValor(r.valor);
    if (opciones?.enfocar) el?.focus();
  };
  useImperativeHandle(ref, () => ({
    insertar, enfocar: () => campo.current?.focus(),
    grabar: () => { if (onAudio && voz.fase === 'quieta') void voz.start(); },
  }));

  if (soloLectura) {
    return (
      <div style={{ borderTop: '1px solid var(--border)', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 4, opacity: 0.55, pointerEvents: 'none', userSelect: 'none' }}>
        <span style={iconComposer}><IconSmiley /></span>
        <span style={iconComposer}><IconClip /></span>
        <div style={{ flex: 1, minHeight: 40, padding: '9px 16px', borderRadius: 21, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--faint)', fontSize: 14, display: 'flex', alignItems: 'center' }}>{placeholder ?? 'Escribe un mensaje…'}</div>
        <span style={iconComposer}><IconMic /></span>
      </div>
    );
  }

  // GRABANDO o ESCUCHANDO lo grabado (la sesión), o revisando un audio que YA existe (`audioPendiente`).
  // La barra ocupa TODO el ancho de la fila (WhatsApp 7: «no todo amontonado a la derecha»).
  if (voz.fase !== 'quieta' || !!audioPendiente?.url || bajando) {
    const existente = voz.fase === 'quieta' && audioPendiente?.url
      ? {
        url: audioPendiente.url, secs: audioPendiente.secs ?? null,
        onBorrar: audioPendiente.onDescartar, onDejar: audioPendiente.onUsar,
        onSeguir: audioPendiente.seguir ? () => void seguirExistente() : undefined,
      }
      : null;
    return (
      <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px' }}>
        {voz.fase === 'grabando' && mientrasGraba && <div style={{ marginBottom: 10 }}>{mientrasGraba}</div>}
        <BarraGrabacion voz={voz} ocupado={!!ocupado || bajando} existente={existente}
          rotuloEnviar={existente ? (audioPendiente?.rotuloUsar ?? 'Dejar este audio') : 'Enviar audio'} />
      </div>
    );
  }

  const conClip = !!onArchivo || !!menuClip?.length;
  const hayParaEnviar = !!valor.trim() || !!chip;
  // En el editor la fila es más angosta (el panel del nodo mide 328 px): botones de 38.
  const icono: CSSProperties = editar ? { ...iconComposer, width: 38, height: 38 } : iconComposer;

  return (
    <div style={{ borderTop: '1px solid var(--border)', position: 'relative' }}>
      {chip && (
        <div style={{ padding: '10px 16px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
          {chip.imagen ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={chip.imagen} alt={chip.titulo} style={{ width: 48, height: 48, flex: 'none', objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
          ) : (
            <div style={{ width: 48, height: 48, flex: 'none', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dim)' }}>
              {chip.icono === 'audio' ? <IconMic /> : chip.icono === 'video' ? <IconVideo /> : <IconDoc size={22} />}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chip.titulo}</div>
            {chip.detalle && <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{chip.detalle}</div>}
          </div>
          {chip.onQuitar && (
            <button type="button" onClick={chip.onQuitar} title={chip.tituloQuitar ?? 'Quitar adjunto'} aria-label={chip.tituloQuitar ?? 'Quitar adjunto'} style={iconBtn}>✕</button>
          )}
        </div>
      )}
      <div style={{ padding: editar ? '8px 8px' : '8px 12px', display: 'flex', alignItems: 'flex-end', gap: editar ? 2 : 4 }}>
        {onArchivo && !menuClip?.length && (
          <input ref={archivo} type="file" accept={acceptArchivo} style={{ display: 'none' }}
            onChange={(e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0] ?? null; e.target.value = ''; if (f) onArchivo(f); }} />
        )}
        <button type="button" ref={setBtnEmoji} onClick={() => setAbierto((a) => (a === 'emoji' ? null : 'emoji'))} title="Emojis" aria-label="Emojis" aria-expanded={abierto === 'emoji'}
          style={{ ...icono, color: abierto === 'emoji' ? 'var(--primary)' : 'var(--dim)' }}><IconSmiley /></button>
        {conClip && (
          <button type="button" ref={setBtnClip} disabled={ocupado} title="Adjuntar archivo" aria-label="Adjuntar archivo" aria-expanded={menuClip?.length ? abierto === 'clip' : undefined}
            onClick={() => { if (menuClip?.length) setAbierto((a) => (a === 'clip' ? null : 'clip')); else archivo.current?.click(); }}
            style={{ ...icono, color: abierto === 'clip' ? 'var(--primary)' : 'var(--dim)', opacity: ocupado ? 0.5 : 1 }}><IconClip /></button>
        )}
        {trasClip}
        <textarea ref={campo} value={valor} rows={1}
          onChange={(e) => { valorVivo.current = e.target.value; onValor(e.target.value); }}
          onKeyDown={(e) => {
            if (accionDeTecla(modo, { key: e.key, shiftKey: e.shiftKey, isComposing: e.nativeEvent.isComposing }) !== 'enviar') return;
            e.preventDefault();
            onEnviar?.();
          }}
          placeholder={placeholder ?? 'Escribe un mensaje…'}
          aria-label={placeholder ?? 'Mensaje'}
          style={{ flex: 1, minWidth: 0, minHeight: 40, resize: 'none', padding: '9px 16px', borderRadius: 21, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: 14, lineHeight: 1.35, outline: 'none' }} />
        {!editar && hayParaEnviar && onEnviar ? (
          <button type="button" onClick={onEnviar} disabled={ocupado} title="Enviar" aria-label="Enviar" style={{ flex: 'none', width: 42, height: 42, borderRadius: '50%', border: 'none', background: 'var(--wa)', color: '#fff', cursor: ocupado ? 'default' : 'pointer', opacity: ocupado ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SendArrow /></button>
        ) : onAudio ? (
          <button type="button" onClick={() => void voz.start()} disabled={ocupado} title="Grabar nota de voz" aria-label="Grabar nota de voz" style={{ ...icono, color: 'var(--dim)', opacity: ocupado ? 0.5 : 1 }}><IconMic /></button>
        ) : null}
      </div>

      {abierto === 'emoji' && (
        <PopoverWA ancla={btnEmoji} etiqueta="Emojis" onCerrar={() => setAbierto(null)}>
          <EmojiPicker onPick={(em) => insertar(em)} onClose={() => setAbierto(null)} />
        </PopoverWA>
      )}
      {abierto === 'clip' && menuClip?.length ? (
        <PopoverWA ancla={btnClip} etiqueta="Adjuntar" onCerrar={() => setAbierto(null)}>
          <MenuWA opciones={menuClip} alElegir={() => setAbierto(null)} />
        </PopoverWA>
      ) : null}
    </div>
  );
}
