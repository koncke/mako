'use client';

// =============================================================================
// La caja del Ops Center, en el chat del onboarding (20/10/2026)
// =============================================================================
// Martín (pedido del 18/10, punto 3): «el composer del chat del onboarding es el del Ops Center TAL CUAL: + para adjuntar,
// el micrófono para grabar audio, los adjuntos arriba, arrastrar y soltar, sin el enviar verde. Copiá el componente del Ops
// Center; no hagas uno nuevo». La caja del Ops Center no es un componente suelto: vive adentro de
// app/admin/operaciones/Conversacion.tsx (`co-caja-wrap`). Esto es ESA fila, con SUS piezas (ListaAdjuntos, MasCaja,
// BotonEmojis, BotonMandar, alPegar, la capa de los links, las viñetas) y SUS clases de centro.css: ninguna pieza propia.
// tests/onboarding-caja-centro.test.ts compara las dos: si allá se suma una pieza, el test lo dice.
//
// Lo que NO viene, y por qué:
//   · el «Con qué corre» del «+» (la cuenta, el modelo, el esfuerzo) y las tareas vinculadas: son del Runner, no de MaKo;
//   · la cita (responder a un mensaje) y las preguntas del empleado: el onboarding no las tiene.
// El micrófono DICTA (BotonMandar → useDictar): lo dicho entra en la caja y se lee antes de mandar. El onboarding ya no
// manda notas de voz; la tab Offer sigue con la barra de WhatsApp y las suyas.
// Los archivos se juntan arriba del texto y se leen recién al MANDAR (OfferApp → enviarVista), como antes.
//
// ⚠️ LA ARMA OfferApp Y ChatOffer LA RECIBE HECHA (`caja`): ChatOffer lo importa un test en node
// (tests/offer-pulir-pdf.test.ts → DocumentoPdf) y estas piezas traen .css, que node no lee.

import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { conVinetas, enterEnLista } from '@/lib/centro-caja';
import { BotonMandar } from '@/app/admin/operaciones/Microfono';
import { BotonEmojis } from '@/app/admin/operaciones/Emojis';
import { ListaAdjuntos, MasCaja, alPegar, type AdjuntosDeCaja } from '@/app/admin/operaciones/AdjuntosCaja';
import { LinksDeLaCaja, ResalteDeLinks, hayLinks } from '@/app/admin/operaciones/ConLinks';
import '@/app/admin/operaciones/centro.css';

export function CajaDelCentro({ texto, onTexto, onMandar, ocupado, placeholder = 'Escríbele a MaKo', adjuntos, estado }: {
  texto: string;
  onTexto: (v: string) => void;
  onMandar: () => void;
  /** MaKo contesta o se leen los archivos: los botones se apagan; el campo no (se puede seguir escribiendo). */
  ocupado: boolean;
  placeholder?: string;
  /** Lo juntado y cómo se suma o se quita; undefined = sólo texto (el arranque pregunta el nombre o un código). */
  adjuntos: AdjuntosDeCaja | undefined;
  /** La línea de abajo de la caja: «Leyendo «X»…». Lo que dice el micrófono si no pudo va primero. */
  estado: string | null;
}) {
  const caja = useRef<HTMLTextAreaElement>(null);
  /** Dónde va el cursor después de que una lista cambió el texto (la viñeta, el ítem siguiente). */
  const cursor = useRef<number | null>(null);
  /** La capa que pinta los links: se corre con el scroll del <textarea>. */
  const resalte = useRef<HTMLDivElement | null>(null);
  const [faltaMic, setFaltaMic] = useState<string | null>(null);
  const conLinks = hayLinks(texto);

  // El renglón crece con lo que se escribe, hasta 220 px, y pasado el tope sigue al cursor (Conversacion.tsx).
  useLayoutEffect(() => {
    const el = caja.current;
    if (!el) return;
    const antes = el.scrollTop;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
    el.scrollTop = el.selectionEnd >= el.value.length ? el.scrollHeight : antes;
    if (cursor.current != null) { el.setSelectionRange(cursor.current, cursor.current); cursor.current = null; }
  }, [texto]);

  const tecla = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter manda; Shift+Enter baja de renglón. Mientras se compone un acento (IME), Enter es del teclado. Adentro de una
    // lista, Enter arma el ítem siguiente y en uno vacío la corta (lib/centro-caja.ts → enterEnLista).
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      const l = enterEnLista(texto, e.currentTarget.selectionStart, e.currentTarget.selectionEnd);
      if (l) { cursor.current = l.cursor; onTexto(l.texto); return; }
      if (!ocupado) onMandar();
    }
  };

  return (
    <div className="co-caja-wrap">
      <div className="co-caja">
        <ListaAdjuntos a={adjuntos} />
        <div className="co-caja__fila">
          {adjuntos && <MasCaja a={adjuntos} apagado={ocupado} resumen={null} />}
          <BotonEmojis campo={caja} valor={texto} onValor={onTexto} apagado={ocupado} />
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
            onPaste={(e) => alPegar(e, adjuntos)}
            placeholder={placeholder}
            aria-label={placeholder}
          />
          </div>
          <BotonMandar valor={texto} onValor={(v) => { setFaltaMic(null); onTexto(v); }} onError={setFaltaMic} enviando={false} apagado={ocupado}
            hayQueMandar={!!texto.trim() || !!adjuntos?.items.length} onMandar={onMandar} titulo="Mandar (Enter)" />
        </div>
        <LinksDeLaCaja texto={texto} />
      </div>
      <p className="co-caja__estado" aria-live="polite">{faltaMic ?? estado ?? ''}</p>
    </div>
  );
}
