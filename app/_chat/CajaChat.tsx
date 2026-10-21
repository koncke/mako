'use client';

// =============================================================================
// La caja de los chats con MaKo — UNA pieza en toda la app (20/10/2026)
// =============================================================================
// Martín, 18/10: «un solo chat en toda la app» (docs/feedback-18-10.md). Y el 20/10: «Te pedí que unificaras el chat del
// Ops Center en todos lados, su diseño y funcionalidades... Y en el onboarding y en otros lugares el chat sigue siendo
// diferente» (docs/feedback-20-10.md, punto 8). Es la caja del Ops Center sacada de Conversacion.tsx y ChatsMovil.tsx, con
// todo lo que ya hacía:
//   · UNA fila, como WhatsApp: el «+» (Documento, Fotos, Cámara y Pegar, y abajo lo de cada pantalla), los emojis, el
//     campo y UN botón, que es el micrófono sin nada escrito y la flecha con algo (Microfono.tsx → BotonMandar);
//   · las miniaturas de lo adjuntado arriba, pegar una imagen (Ctrl+V), viñetas y listas mientras se escribe, los links
//     azules con su chip, y sin tope de largo;
//   · el campo crece y el scroll lo acompaña: la conversación sigue abajo si estaba abajo, y el campo sigue al cursor.
// Lo que cambia de una pantalla a otra va por props: a quién se le escribe, qué se manda, qué va arriba (la cita, un
// texto largo pegado) y qué va en el «+». El motor (a qué endpoint manda y qué devuelve) es de cada pantalla.
// ⚠️ ARRASTRAR Y SOLTAR es de la PANTALLA: toda la conversación es la zona (`alSoltar` y `traeArchivos`, pegar.ts).
// La NOTA DE VOZ (20/10/2026, para el onboarding): con `voz`, sin nada escrito el botón GRABA en vez de dictar (el dictado
// no aguanta un monólogo, y su respaldo usa las keys del negocio, que un cliente nuevo no tiene). Mientras graba, o con lo
// grabado para escuchar, la fila es la barra de la grabación (`BarraGrabacion`): se termina, se escucha y recién ahí se
// manda (la regla de Martín del 09/10). Sin `voz`, el micrófono dicta, como siempre.
// ⚠️ tests/chat-unico.test.ts hace cumplir la regla: una pantalla de MaKo que arma su propia caja falla.

import { useLayoutEffect, useRef, type ClipboardEvent, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { Icon } from '@/app/_components/icons';
import { BarraGrabacion, useGrabacionVoz, type GrabacionVoz } from '@/app/whatsapp/_shared/VoiceRecorder';
import { conVinetas, enterEnLista, estaAbajo } from '@/lib/centro-caja';
import { ListaAdjuntos, MasCaja, alPegar, type AdjuntosDeCaja } from '@/app/admin/operaciones/AdjuntosCaja';
import { BotonMandar } from '@/app/admin/operaciones/Microfono';
import { BotonEmojis } from '@/app/admin/operaciones/Emojis';
import { LinksDeLaCaja, ResalteDeLinks, hayLinks } from '@/app/admin/operaciones/ConLinks';

export type PropsCajaChat = {
  texto: string;
  onTexto: (t: string) => void;
  onMandar: () => void;
  /** Saliendo: el campo y el botón se apagan, y el botón gira. */
  enviando?: boolean;
  /** Sin poder escribir todavía (el chat no cargó): como `enviando`, sin el giro. */
  apagado?: boolean;
  /** «Escribe a CRM», «Escríbele a MaKo»: también es su nombre accesible. */
  placeholder: string;
  tituloMandar?: string;
  /** Las fotos y los PDF de la caja. Sin esto, el «+» sólo trae lo de `mas`. */
  adjuntos?: AdjuntosDeCaja;
  /** Lo de abajo del «+» (la cuenta, el modelo, las tareas): como función recibe `cerrar`. */
  mas?: ReactNode | ((cerrar: () => void) => ReactNode);
  /** Lo que va arriba de las miniaturas: la cita de un mensaje, un texto largo pegado. */
  arriba?: ReactNode;
  /** Además de lo escrito y lo adjuntado, ¿hay algo para mandar? (un texto largo pegado como documento). */
  hayAlgoMas?: boolean;
  /** Enter manda (la computadora). En el teléfono Enter baja de renglón: se manda con el botón. */
  enterManda?: boolean;
  /** Un pegado que la pantalla resuelve antes (un texto largo que va como documento): si llama a `preventDefault`, listo. */
  onPegar?: (e: ClipboardEvent<HTMLTextAreaElement>) => void;
  /** El campo, para enfocarlo desde afuera (responder un mensaje, «Responder sobre esto»). */
  campo?: RefObject<HTMLTextAreaElement | null>;
  /** La conversación que sigue abajo mientras se escribe (la del hilo, o el cuerpo de la hoja en el teléfono). */
  seguir?: () => HTMLElement | null;
  /** Hasta cuánto crece el campo a mano (la computadora, 220). null = lo hace crecer el CSS (`field-sizing`, el teléfono). */
  altoMax?: number | null;
  /** El micrófono no pudo (permiso, transcripción): lo dice la pantalla, en su línea de estado o en un aviso. */
  onErrorMic?: (m: string) => void;
  /** La clase de la fila: la de la computadora (`co-caja__fila`) o la del teléfono (`m-operaciones-caja__fila`). */
  fila?: string;
  /** La nota de voz: `onAudio` recibe lo que se MANDA (después de escucharlo); `pendiente`, una grabación de antes que la
   *  pantalla todavía tiene (con borrar, dejar y seguir); `rotuloEnviar`, el nombre del botón que la manda. */
  voz?: {
    onAudio: (blob: Blob, secs: number) => void | Promise<void>;
    onError?: (m: string) => void;
    pendiente?: { url: string; secs?: number | null; onBorrar: () => void; onDejar: () => void; onSeguir?: () => void } | null;
    rotuloEnviar?: string;
  };
  /** La línea de estado debajo de la caja, con lo que dice la pantalla («Leyendo «X»…»). Sin esto, no se dibuja (la pantalla
   *  puede tener la suya afuera, como el Ops Center). */
  estado?: string | null;
};

export function CajaChat(p: PropsCajaChat) {
  // La grabación es un hook: va en su propio componente, así una pantalla sin nota de voz no la monta.
  return p.voz ? <CajaConVoz {...p} voz={p.voz} /> : <Caja p={p} grabacion={null} />;
}

function CajaConVoz(p: PropsCajaChat & { voz: NonNullable<PropsCajaChat['voz']> }) {
  const grabacion = useGrabacionVoz(p.voz.onAudio, p.voz.onError);
  return <Caja p={p} grabacion={grabacion} />;
}

function Caja({ p, grabacion }: { p: PropsCajaChat; grabacion: GrabacionVoz | null }) {
  const { texto, onTexto, enviando = false, apagado = false, altoMax = 220 } = p;
  const propio = useRef<HTMLTextAreaElement | null>(null);
  const caja = p.campo ?? propio;
  /** Dónde va el cursor después de que una lista cambió el texto (la viñeta, el ítem siguiente). */
  const cursor = useRef<number | null>(null);
  /** La capa que pinta los links (17/10/2026): se corre con el scroll del <textarea>. */
  const resalte = useRef<HTMLDivElement | null>(null);
  const conLinks = hayLinks(texto);
  const quieto = enviando || apagado;

  // El campo crece con lo que se escribe, y el scroll lo acompaña (18/10/2026, Martín: «la caja crece y el chat no lo
  // acompaña»): la conversación, que se achica cuando la caja crece, sigue abajo si estaba abajo (se mide ANTES de crecer);
  // y el campo, pasado su tope, sigue al cursor (el `height = 'auto'` le reseteaba el scroll). En el teléfono crece el CSS:
  // la hoja sigue abajo si se está escribiendo y se miraba lo último (con el margen de lo que creció).
  useLayoutEffect(() => {
    const el = caja.current;
    if (!el) return;
    const h = p.seguir?.() ?? null;
    if (altoMax != null) {
      const abajo = h ? estaAbajo(h) : false;
      const antes = el.scrollTop;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, altoMax)}px`;
      el.scrollTop = el.selectionEnd >= el.value.length ? el.scrollHeight : antes;
      if (h && abajo) h.scrollTop = h.scrollHeight;
    } else if (h && document.activeElement === el && estaAbajo(h, 160)) h.scrollTop = h.scrollHeight;
    if (cursor.current != null) { el.setSelectionRange(cursor.current, cursor.current); cursor.current = null; }
  }, [texto]); // eslint-disable-line react-hooks/exhaustive-deps

  const tecla = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Mientras se compone un acento (IME), Enter es del teclado. Adentro de una lista, Enter arma el ítem siguiente y en
    // uno vacío la corta (lib/centro-caja.ts → enterEnLista). Fuera de una lista: en la computadora manda (Shift+Enter
    // baja de renglón); en el teléfono baja de renglón.
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    const l = enterEnLista(texto, e.currentTarget.selectionStart, e.currentTarget.selectionEnd);
    if (l) { e.preventDefault(); cursor.current = l.cursor; onTexto(l.texto); return; }
    if (p.enterManda) { e.preventDefault(); p.onMandar(); }
  };

  const hayQueMandar = !apagado && (!!texto.trim() || !!p.adjuntos?.items.length || !!p.hayAlgoMas);
  /** Grabando, o con lo grabado para escuchar: la fila es la barra de la grabación. */
  const conBarra = !!grabacion && (grabacion.fase === 'grabando' || !!grabacion.revision || !!p.voz?.pendiente);

  return (
    <>
      {p.arriba}
      <ListaAdjuntos a={p.adjuntos} />
      <div className={p.fila ?? 'co-caja__fila'}>
        {conBarra && grabacion ? (
          <BarraGrabacion voz={grabacion} ocupado={enviando} existente={p.voz?.pendiente ?? null} rotuloEnviar={p.voz?.rotuloEnviar} />
        ) : (<>
        {(p.adjuntos || p.mas) && <MasCaja a={p.adjuntos} apagado={quieto} resumen={null}>{p.mas}</MasCaja>}
        {/* Los emojis, en su botón junto al campo (WhatsApp; Emojis.tsx). */}
        <BotonEmojis campo={caja} valor={texto} onValor={onTexto} apagado={quieto} />
        {/* Un link se ve azul mientras se escribe (la capa de abajo) y se abre desde su chip (17/10/2026). */}
        <div className="co-caja__campo">
          {conLinks && <ResalteDeLinks texto={texto} capa={(el) => { resalte.current = el; }} />}
          <textarea
            ref={caja}
            className={conLinks ? 'co-caja__texto--resalte' : undefined}
            onScroll={(e) => { if (resalte.current) resalte.current.scrollTop = e.currentTarget.scrollTop; }}
            rows={1}
            value={texto}
            onChange={(e) => {
              // «- » y «* » al principio de un renglón se vuelven viñeta mientras se escribe (lib/centro-caja.ts).
              const v = conVinetas(e.target.value, e.target.selectionStart);
              if (v.texto !== e.target.value) cursor.current = v.cursor;
              onTexto(v.texto);
            }}
            onKeyDown={tecla}
            onPaste={(e) => { p.onPegar?.(e); if (!e.defaultPrevented) alPegar(e, p.adjuntos); }}
            placeholder={p.placeholder}
            aria-label={p.placeholder}
            disabled={quieto}
          />
        </div>
        {/* Con nota de voz y nada que mandar, el botón GRABA; si no, el de siempre (dicta, o la flecha con algo escrito). */}
        {grabacion && !hayQueMandar && !enviando ? (
          <button type="button" className="co-enviar co-enviar--mic" onClick={() => void grabacion.start()} disabled={quieto}
            aria-label="Grabar una nota de voz" title="Grabar una nota de voz">
            <Icon name="mic" size={18} />
          </button>
        ) : (
          <BotonMandar valor={texto} onValor={onTexto} onError={(m) => p.onErrorMic?.(m)} enviando={enviando} apagado={apagado}
            hayQueMandar={hayQueMandar} onMandar={p.onMandar} titulo={p.tituloMandar} />
        )}
        </>)}
      </div>
      <LinksDeLaCaja texto={texto} />
      {p.estado !== undefined && <p className="co-caja__estado" aria-live="polite">{p.estado ?? ''}</p>}
    </>
  );
}
