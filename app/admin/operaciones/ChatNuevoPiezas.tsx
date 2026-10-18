'use client';

// =============================================================================
// «Nuevo chat» sin modal: lo que se DIBUJA (17/10/2026; el motor está en ChatNuevo.tsx)
// =============================================================================
// Martín (22:50): «Nuevo chat jamás debe abrir un modal... Que simplemente abra el chat y que el usuario al comenzar a escribir la
// IA vaya entendiendo dónde lo debe colocar». Acá van las piezas de pantalla —la cabecera, el chat vacío o con lo que MaKo decidió,
// y la caja—, SIN el motor (`useChatNuevo`, que firma y habla con el servidor): así se dibujan en un test y las comparten la
// computadora (ChatNuevoCentro) y la hoja del teléfono (ChatsMovil.tsx → HojaChatNuevo).

import type { RefObject } from 'react';
import { Icon } from '@/app/_components/icons';
import { frasePorDonde, type DecisionChatNuevo } from '@/lib/centro-chat-nuevo';
import { CirculoNuevo } from './NuevoChat';
import { Muneco } from './Muneco';
import { BotonMandar } from './Microfono';
import { BotonEmojis } from './Emojis';

export type FaseChatNuevo = 'escribiendo' | 'decidiendo' | 'confirmando' | 'saliendo' | 'abriendo' | 'fallo' | 'sin_forma';

/** Lo que las piezas necesitan del motor (`useChatNuevo`). */
export type ChatNuevo = {
  texto: string;
  setTexto: (t: string) => void;
  /** El primer mensaje, ya mandado (null = todavía no se escribió). */
  enviado: string | null;
  fase: FaseChatNuevo;
  decision: DecisionChatNuevo | null;
  /** El nombre que Martín está cambiando, si lo está cambiando. */
  editando: { texto: string; error: string | null } | null;
  caja: RefObject<HTMLTextAreaElement | null>;
  /** ¿Se puede cambiar el nombre o el lugar? Mientras la decisión está a la vista y antes de que el trabajo salga. */
  puedeCambiar: boolean;
  /** Cómo va el último chat que se pidió abrir (useCentro.ts → apertura). */
  apertura: string | null;
  copiarConAviso: (texto: string, aviso: string) => void | Promise<void>;
  mandar: () => void | Promise<void>;
  reintentar: () => void;
  cambiar: () => void;
  escribirNombre: (t: string) => void;
  dejar: () => void;
  aceptarNombre: () => void;
  comandoParaCopiar: () => string;
};

/** El título de la cabecera: «Nuevo chat» hasta que MaKo decide, y después el nombre; se toca para cambiarlo. */
export function TituloChatNuevo({ n }: { n: ChatNuevo }) {
  const nombre = n.decision?.nombre ?? 'Nuevo chat';
  return n.puedeCambiar
    ? <button type="button" className="co-cab__nombre" title="Cambiar el nombre o el lugar" aria-label={`Cambiar ${nombre}`} onClick={n.cambiar}>{nombre}</button>
    : <>{nombre}</>;
}

/** La criatura de la cabecera: el círculo de «Nuevo chat», y con la decisión, la del chat que va a ser. */
export function CriaturaChatNuevo({ n, size = 34 }: { n: ChatNuevo; size?: number }) {
  return n.decision ? <Muneco titulo={n.decision.nombre} animo="despierto" size={size} /> : <CirculoNuevo size={size} />;
}

/** Lo que se ve en el chat: el vacío con su invitación, o el mensaje y lo que MaKo decidió con él. */
export function CuerpoChatNuevo({ n }: { n: ChatNuevo }) {
  const { enviado, decision, fase, editando } = n;
  if (!enviado) {
    return (
      <div className="co-portada">
        <CirculoNuevo size={76} />
        <p className="co-portada__nombre">Nuevo chat</p>
        <p className="co-portada__dato">Escribe lo que necesitas. Yo decido dónde va.</p>
      </div>
    );
  }
  return (
    <>
      <div className="co-yo"><div className="co-burbuja">{enviado}</div></div>
      <div className="co-nuevo-nota" role="status" aria-live="polite">
        {fase === 'decidiendo' && <span>Decidiendo dónde va…</span>}
        {decision && fase !== 'decidiendo' && !editando && (
          <span className="co-nuevo-nota__fila">
            <Icon name="check" size={14} />
            <span>{frasePorDonde(decision)}</span>
            {n.puedeCambiar && <button type="button" className="co-chip" onClick={n.cambiar}>Cambiar</button>}
          </span>
        )}
        {decision && editando && (
          <span className="co-nuevo-nota__fila">
            <input className="co-nuevo-nota__input" value={editando.texto} maxLength={80} autoFocus aria-label="Nombre del chat"
              onChange={(e) => n.escribirNombre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); n.aceptarNombre(); }
                if (e.key === 'Escape') { e.preventDefault(); n.dejar(); }
              }} />
            <button type="button" className="co-chip" onClick={n.aceptarNombre}>Mandar</button>
            <button type="button" className="co-chip" onClick={n.dejar}>Dejar como está</button>
          </span>
        )}
        {editando?.error && <span className="co-nuevo-nota__error" role="alert">{editando.error}</span>}
        {fase === 'saliendo' && <span className="co-nuevo-nota__estado">Mandándolo…</span>}
        {fase === 'abriendo' && <span className="co-nuevo-nota__estado">{n.apertura ?? 'Abriéndolo en la PC…'}</span>}
        {fase === 'fallo' && (
          <span className="co-nuevo-nota__fila">
            <span className="co-nuevo-nota__estado">No salió.</span>
            <button type="button" className="co-chip" onClick={n.reintentar}>Reintentar</button>
          </span>
        )}
        {fase === 'sin_forma' && (
          <span className="co-nuevo-nota__fila">
            <span className="co-nuevo-nota__estado">Ningún Runner abre chats todavía.</span>
            <button type="button" className="co-chip" onClick={() => void n.copiarConAviso(n.comandoParaCopiar(), 'Copiado: pégalo en PowerShell')}>Copiar comando</button>
          </span>
        )}
      </div>
    </>
  );
}

/**
 * La caja de escribir del chat nuevo: un campo y UN botón (WhatsApp), alineados como la del resto (`--caja-toque`). Sólo para el
 * primer mensaje: después de mandarlo, el chat de verdad toma su lugar. `movil` usa las clases de la hoja del teléfono.
 */
export function CajaChatNuevo({ n, movil = false }: { n: ChatNuevo; movil?: boolean }) {
  const ocupado = n.fase !== 'escribiendo';
  const fila = (
    <div className={movil ? 'm-operaciones-caja__fila' : 'co-caja__fila'}>
      <BotonEmojis campo={n.caja} valor={n.texto} onValor={n.setTexto} apagado={ocupado} />
      <div className="co-caja__campo">
        <textarea
          ref={n.caja} rows={1} value={n.texto} disabled={ocupado}
          onChange={(e) => n.setTexto(e.target.value)}
          onKeyDown={(e) => {
            // En el teléfono Enter baja de renglón; en la computadora Enter manda y Mayús+Enter baja.
            if (movil || e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
            e.preventDefault();
            void n.mandar();
          }}
          placeholder="Escribe lo que necesitas" aria-label="Escribe lo que necesitas"
        />
      </div>
      <BotonMandar valor={n.texto} onValor={n.setTexto} onError={() => {}} enviando={n.fase === 'decidiendo'} apagado={ocupado}
        hayQueMandar={!!n.texto.trim()} onMandar={() => void n.mandar()} titulo="Mandar (Enter)" />
    </div>
  );
  return movil ? <div className="m-operaciones-caja">{fila}</div> : <div className="co-caja-wrap"><div className="co-caja">{fila}</div></div>;
}
