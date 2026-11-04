'use client';

// =============================================================================
// El panel de UN chat: la cabecera, la conversación y la caja abajo — una pieza para todos los Ops Center (21/10/2026)
// =============================================================================
// Martín, mirando el Ops Center de un cliente al lado del suyo: «el ops center de los clientes se ve muy mal comparado al de
// SuperAdmin... eso debe funcionar». Hasta ese día el del cliente (app/second-brain/ChatSecondBrain.tsx) armaba su propia
// cabecera, su propio hilo y su propia caja, copiados a mano de Conversacion.tsx, y se habían separado: el hilo iba suelto
// (sin `.co-hilo__col`, lo de la persona quedaba a la izquierda), sin la foto, sin arrastrar y soltar igual. Ahora es UNA
// pieza (la tanda 5 de docs/diseno-mako-ai-native.md, «el Centro como adaptador»): la monta la conversación de Claude Code
// (Conversacion.tsx) y la de MaKo de cada cliente, y cada una le pasa SU hilo y SU caja.
//
// LA CABECERA (17/10/2026, 19:31): la criatura AL LADO del título, a la izquierda, como la foto de WhatsApp. Tocar la criatura
// deja cambiarla; tocar el título deja renombrarlo EN EL LUGAR (Enter guarda, Escape lo deja como estaba). Sin chips de cuenta
// ni estado: «esos botones al lado de la criatura NO van, para eso está el "+"».
// ⚠️ ARRASTRAR Y SOLTAR es del panel: toda la conversación es la zona (18/10/2026; sin esto el navegador abría el archivo en la
//    pestaña). Lo soltado va a `adjuntos.onSumar`, lo mismo que el «+» de la caja.

import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Icon } from '@/app/_components/icons';
import { ContextoSoltar } from '@/app/_chat/soltar-en-la-caja';
import type { Aspecto } from '@/lib/centro-munecos';
import { alSoltar, traeArchivos, type AdjuntosDeCaja } from './AdjuntosCaja';
import { Muneco, type Animo } from './Muneco';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

export type CabeceraChat = {
  /** De qué chat es: cambiarlo suelta el renombre a medias (dos chats pueden llamarse igual). */
  clave: string;
  titulo: string;
  /** De qué nombre sale la criatura, si no es el título (una conversación de Offer lleva la de Offer). */
  criatura?: string;
  aspecto?: Aspecto | null;
  animo: Animo;
  /** Lo que espera de la persona (el globito de la criatura). */
  espera?: number;
  /** Tocar la criatura abre el selector. Sin esto (el Cerebro, que es siempre la estrella de MaKo) no se toca. */
  onMuneco?: () => void;
  /** Renombrar en el lugar: devuelve el error, o null si salió. Sin esto el título no se toca. */
  onRenombrar?: (nombre: string) => Promise<string | null>;
  /** Lo que va al lado del título, en la misma barra (la lista de tickets de Soporte, 23/10/2026). */
  acciones?: ReactNode;
  /** El renglón chico debajo del nombre: en un grupo, quiénes están (4/11/2026, como WhatsApp). */
  subtitulo?: ReactNode;
  /** Lo que va ANTES de la criatura, en cualquier ancho (la «←» a la lista de automatizaciones, 23/10/2026): el «volver» de
   *  la ventana angosta es otra cosa y sólo se ve ahí. */
  antes?: ReactNode;
  /** «Volver a los chats», en la ventana angosta. Sin esto (un chat embebido en una pantalla: la ficha de un lead), no hay botón. */
  onVolver?: () => void;
};

/** La cabecera: «volver» (en la ventana angosta), la criatura, el título que se renombra en el lugar. */
/**
 * «Plegar el chat» (29/10/2026, Martín: en los editores de Create «el chat a la izquierda le come lugar al editor»). Lo provee
 * la pantalla de Create (app/_crear/PantallaCrear.tsx) cuando la tarjeta se puede plegar a una barra fina; con él, la cabecera
 * de CUALQUIER chat que viva ahí (el Cerebro, el del Video Editor, el del Image Editor) dibuja el botón a la derecha. Fuera de
 * Create es `null` y la cabecera no cambia.
 */
export const PlegarChatCtx = createContext<(() => void) | null>(null);

export function CabeceraDeChat({ clave, titulo, criatura: deCriatura = titulo, aspecto, animo, espera = 0, onMuneco, onRenombrar, acciones, subtitulo, antes, onVolver }: CabeceraChat) {
  // El título se renombra en el lugar: `editando` es lo que se está escribiendo.
  const [editando, setEditando] = useState<{ texto: string; error: string | null; mandando: boolean } | null>(null);
  useEffect(() => { setEditando(null); }, [clave]);
  const guardarNombre = async () => {
    if (!editando || !onRenombrar || editando.mandando) return;
    setEditando({ ...editando, mandando: true, error: null });
    const mal = await onRenombrar(editando.texto);
    if (mal) setEditando({ ...editando, mandando: false, error: mal }); else setEditando(null);
  };
  const criatura = <Muneco titulo={deCriatura} aspecto={aspecto} animo={animo} size={34} espera={espera} />;
  const plegar = useContext(PlegarChatCtx);
  return (
    <header className="co-cab">
      {onVolver && (
        <button type="button" className="co-acceso co-cab__volver" style={{ width: 'auto' }} onClick={onVolver} aria-label="Volver a los chats">
          <span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><Icon name="chevron" size={18} /></span>
        </button>
      )}
      {antes}
      {onMuneco ? (
        <button type="button" className="co-cab__muneco" onClick={onMuneco} title="Cambiar su criatura" aria-label={`Cambiar la criatura de ${titulo}`}>
          {criatura}
        </button>
      ) : <span className="co-cab__muneco" role="img" aria-label={deCriatura}>{criatura}</span>}
      <div className="co-cab__texto">
        <h1 className="co-cab__titulo" title={titulo}>
          {editando ? (
            <input className="co-cab__input" value={editando.texto} maxLength={120} autoFocus disabled={editando.mandando}
              aria-label={`Nombre de ${titulo}`} enterKeyHint="done"
              onChange={(e) => setEditando({ ...editando, texto: e.target.value, error: null })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void guardarNombre(); }
                if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setEditando(null); }
              }}
              onBlur={() => { if (!editando.mandando) setEditando(null); }} />
          ) : onRenombrar ? (
            <button type="button" className="co-cab__nombre" title="Renombrar" aria-label={`Renombrar ${titulo}`}
              onClick={() => setEditando({ texto: titulo, error: null, mandando: false })}>{titulo}</button>
          ) : titulo}
        </h1>
        {editando?.error && <span className="co-cab__error" role="alert">{editando.error}<ReportarASoporte /></span>}
        {subtitulo && !editando && <span className="co-cab__sub">{subtitulo}</span>}
      </div>
      {acciones}
      {plegar && (
        <button type="button" className="cr-plegar" onClick={plegar} title="Plegar el chat" aria-label="Plegar el chat de MaKo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3.5" y="4" width="17" height="16" rx="2.5" /><path d="M9 4v16M15.5 10l-2 2 2 2" />
          </svg>
        </button>
      )}
    </header>
  );
}

/**
 * El panel entero de un chat. `children` es lo que va adentro de la columna del hilo (`.co-hilo__col`: la columna flex que
 * pone lo de la persona a la derecha); `arriba`, lo que va arriba de la conversación (los fijados); `despues`, lo que flota
 * sobre ella (el menú de un mensaje, sus modales); `caja`, la caja de escribir (o la caja quieta que dice por qué no se
 * puede), y `estado`, la línea de abajo de la caja.
 */
export function PanelDeChat({ cabecera, adjuntos, hilo, arriba, despues, caja, estado, reemplazo, children }: {
  cabecera: CabeceraChat;
  /** Lo que se suelta sobre la conversación se adjunta (lo mismo que el «+»). Sin esto, no recibe archivos. */
  adjuntos?: AdjuntosDeCaja;
  /** La conversación, para que el padre la lleve abajo y la caja la acompañe al crecer. */
  hilo: RefObject<HTMLDivElement | null>;
  arriba?: ReactNode;
  despues?: ReactNode;
  caja: ReactNode;
  estado: string;
  /** Lo que ocupa el lugar de la conversación ENTERA, hilo y caja (4/11/2026: el Second Brain de un gurú, Martín: «no debe abrirse
   *  un modal, sino que debe reemplazar lo que está en el chat»). La conversación queda montada y escondida: al volver sigue donde
   *  estaba, con lo escrito en la caja. */
  reemplazo?: ReactNode;
  children: ReactNode;
}) {
  /** Se está arrastrando un archivo sobre la conversación: se dibuja dónde soltarlo (18/10/2026). */
  const [soltando, setSoltando] = useState(false);
  // Lo soltado va a los adjuntos de la CAJA de adentro (los de la pantalla y los que ella lee, app/_chat/soltar-en-la-caja.ts):
  // con los de la pantalla solos, un Word rebotaba en el Second Brain y donde no había ninguno no se podía soltar (ticket #16).
  const enLaCaja = useRef<AdjuntosDeCaja | undefined>(undefined);
  const destino = () => enLaCaja.current ?? adjuntos;
  return (
    <ContextoSoltar.Provider value={enLaCaja}>
    <section className="co-panel" aria-label={`Conversación con ${cabecera.titulo}`} data-soltando={soltando || undefined} data-mako-chat=""
      onDragOver={(e) => { if (!traeArchivos(e.dataTransfer)) return; e.preventDefault(); e.dataTransfer.dropEffect = destino()?.puede ? 'copy' : 'none'; if (!soltando) setSoltando(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSoltando(false); }}
      onDropCapture={() => setSoltando(false)} onDrop={(e) => { setSoltando(false); alSoltar(e, destino()); }}>
      {soltando && <div className="co-soltar" aria-hidden>{destino()?.puede ? 'Suelta para adjuntar' : destino()?.espera ?? 'Este chat no recibe archivos'}</div>}
      <CabeceraDeChat {...cabecera} />
      <div className="co-cuerpo">
        {reemplazo != null && <div className="co-reemplazo">{reemplazo}</div>}
        <div className="co-conv" style={reemplazo != null ? { display: 'none' } : undefined}>
          {arriba}
          <div className="co-hilo" ref={hilo} data-recorrido="sb-hilo">
            <div className="co-hilo__col">{children}</div>
          </div>
          {despues}
          <div className="co-caja-wrap" data-recorrido="sb-escribir">
            {caja}
            <p className="co-caja__estado" aria-live="polite">{estado}</p>
          </div>
        </div>
      </div>
    </section>
    </ContextoSoltar.Provider>
  );
}
