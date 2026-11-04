'use client';

// =============================================================================
// «Nuevo chat» sin modal: lo que se DIBUJA (17/10/2026; el motor está en ChatNuevo.tsx)
// =============================================================================
// Martín (22:50): «Nuevo chat jamás debe abrir un modal... Que simplemente abra el chat y que el usuario al comenzar a escribir la
// IA vaya entendiendo dónde lo debe colocar». Acá van las piezas de pantalla —la cabecera y el chat vacío o con lo que MaKo
// decidió—, SIN el motor (`useChatNuevo`, que firma y habla con el servidor): así se dibujan en un test y las comparten la
// computadora (ChatNuevoCentro) y la hoja del teléfono (ChatsMovil.tsx → HojaChatNuevo). La caja, la única de toda la app, está
// en CajaChatNuevo.tsx (28/10/2026: trae CSS).

import { useState, type ReactNode, type RefObject } from 'react';
import { Icon } from '@/app/_components/icons';
import { IconoChat } from '@/app/m/mako/iconos';
import { frasePorDonde, type DecisionChatNuevo } from '@/lib/centro-chat-nuevo';
import { CirculoNuevo } from './NuevoChat';
import { Muneco } from './Muneco';
import type { GrabacionLista } from '@/app/_chat/nota-que-se-manda';
import { AudioPlay } from '@/app/whatsapp/_shared/AudioPlay';
// Sólo el TIPO: AdjuntosCaja.tsx trae su CSS, y estas piezas se dibujan en un test (en node un `.css` no carga). La caja, que
// sí lo trae, está en CajaChatNuevo.tsx.
import type { AdjuntosDeCaja } from './AdjuntosCaja';
import { TEXTO_SOLO_ADJUNTOS, etiquetaDoc } from '@/lib/centro-caja';
import type { AdjuntoCaja } from './useCentro';
import { Visor } from './Visor';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

/** `pasando`: el primer mensaje es una nota de voz y se está pasando a texto (con el texto, MaKo decide). */
export type FaseChatNuevo = 'escribiendo' | 'pasando' | 'decidiendo' | 'confirmando' | 'saliendo' | 'abriendo' | 'fallo' | 'sin_forma';

/** Lo que las piezas necesitan del motor (`useChatNuevo`). */
export type ChatNuevo = {
  texto: string;
  setTexto: (t: string) => void;
  /** El primer mensaje, ya mandado (null = todavía no se escribió). */
  enviado: string | null;
  /** Si el primer mensaje es una nota de voz: se escucha arriba de su texto. */
  nota: { url: string; secs: number } | null;
  /** Por qué la nota no se entendió (se vuelve a la caja). */
  errorNota: string | null;
  /** Lo adjuntado en la caja (ChatNuevo.tsx: el estado es del motor del Centro, useCentro.ts). */
  adjuntos: AdjuntosDeCaja;
  /** Los archivos del primer mensaje, ya mandado: se ven en su burbuja. */
  archivos: readonly AdjuntoCaja[];
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
  /** La nota de voz grabada, en el acto (sin transcribir): ChatNuevo.tsx → mandarNota. */
  mandarNota: (g: GrabacionLista) => void;
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
export function CuerpoChatNuevo({ n, alPie }: {
  n: ChatNuevo;
  /** Lo que va debajo de la portada mientras el chat está vacío: los gurús (app/second-brain/GaleriaDeGurus.tsx). */
  alPie?: ReactNode;
}) {
  const { enviado, decision, fase, editando, nota, archivos } = n;
  if (!enviado && !nota) {
    return (
      <>
        <div className="co-portada">
          <CirculoNuevo size={76} />
          <p className="co-portada__nombre">Nuevo chat</p>
          <p className="co-portada__dato">Escribe lo que necesitas. Yo decido dónde va.</p>
        </div>
        {alPie}
      </>
    );
  }
  return (
    <>
      {/* La nota de voz se escucha ya, y debajo, cuando llega, lo que se entendió (el globo de voz del hilo, HiloMako). */}
      {/* Lo adjuntado va arriba, en miniaturas; sólo con archivos, sin epígrafe (como en el hilo: TEXTO_SOLO_ADJUNTOS no se dibuja). */}
      <div className="co-yo">
        <ArchivosDelMensaje archivos={archivos} />
        {nota ? (
          <div className="co-burbuja ch-voz">
            <AudioPlay src={nota.url} duracion={nota.secs} color="var(--primary)" style={{ width: 240 }} />
            {enviado && <span className="ch-voz__texto">{enviado}</span>}
          </div>
        ) : archivos.length && enviado === TEXTO_SOLO_ADJUNTOS ? null : <div className="co-burbuja">{enviado}</div>}
      </div>
      <div className="co-nuevo-nota" role="status" aria-live="polite">
        {fase === 'pasando' && <span>Pasando tu nota a texto…</span>}
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
        {editando?.error && <span className="co-nuevo-nota__error" role="alert">{editando.error}<ReportarASoporte /></span>}
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

/** Los archivos del primer mensaje, arriba de su burbuja: sólo la miniatura, como en la caja; tocarla la amplía. */
function ArchivosDelMensaje({ archivos }: { archivos: readonly AdjuntoCaja[] }) {
  const [viendo, setViendo] = useState<AdjuntoCaja | null>(null);
  if (!archivos.length) return null;
  return (
    <>
      <ul className="co-miniaturas" aria-label="Lo que mandaste">
        {archivos.map((x) => (
          <li key={x.id} className="co-miniatura">
            <button type="button" className="co-miniatura__ver" onClick={() => setViendo(x)} aria-label={`Ver ${x.file.name}`} title={x.file.name}>
              {/* eslint-disable-next-line @next/next/no-img-element -- la vista previa local (blob:) */}
              {x.tipo === 'image' ? <img src={x.url} alt="" /> : <span className="co-miniatura__doc"><IconoChat nombre="archivo" size={18} /><span>{etiquetaDoc(x.file.name)}</span></span>}
            </button>
          </li>
        ))}
      </ul>
      {viendo && <Visor url={viendo.url} nombre={viendo.file.name} tipo={viendo.tipo} onCerrar={() => setViendo(null)} />}
    </>
  );
}
