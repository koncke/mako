'use client';

// =============================================================================
// ChatOffer — la conversación con MaKo, con el hilo y la caja del Ops Center (22/10/2026, OF4)
// =============================================================================
// Martín, 18/10: «un solo chat en toda la app»; y el 20/10: «Te pedí que unificaras el chat del Ops Center en todos lados,
// su diseño y funcionalidades... Y en el onboarding y en otros lugares el chat sigue siendo diferente». Hasta el 22/10 esto
// montaba las piezas del chat de WhatsApp de la casa (pedido del 11/10); ahora monta las del Ops Center, las MISMAS con las
// que el Ops Center ya lee y sigue una conversación de Offer (app/second-brain/PiezasCliente.tsx):
//   · el HILO es `HiloMako` (app/_chat/HiloMako.tsx) con los mensajes pasados por `itemsDeOffer` (app/m/mako/chat-ui.ts),
//     la proyección que usa el Ops Center: lo del dueño a la derecha con su foto (su nota de voz se escucha, con lo que se
//     entendió debajo), lo de MaKo a la izquierda con su criatura, la que tiene esta conversación en la lista del Ops Center
//     (`criaturaDeOffer`). Lo de Offer que el hilo no sabe dibujar va en su hueco `enMensaje`: el PDF de una versión con
//     «Ver mi oferta» y la nota de voz de MaKo, arriba del texto; los documentos que leyó y las tarjetas del onboarding, debajo;
//   · la CAJA es la única (app/_chat/CajaChat.tsx) con la nota de voz (`voz`: el micrófono GRABA, se escucha y recién ahí se
//     manda, con O10: «Abriendo el micrófono…» y el rojo que late). La arma OfferApp, para la tab y para el onboarding, y
//     llega por `caja`. Lo adjuntado (el «+», pegar, soltar) va en sus miniaturas, arriba del texto, y se lee recién al mandar
//     (11/10/2026, «Solo cuando le doy a ENVIAR debería…»), por el camino de Offer (subir-url → PUT → leer, hasta 25 MB, y
//     el .zip de una carpeta).
// Las respuestas rápidas siguen siendo las de Offer, al final del hilo: «Armar mi oferta» en dorado y, con `varias`, marcar
// y «Enviar (N)». El Ops Center las dibuja como una pregunta del hilo; acá no (se filtra el bloque de `itemsDeOffer`).
//
// ⚠️ LA HORA SE PIDE DESPUÉS DE MONTAR (`montado`): sale de la zona horaria de quien la calcula, y el HTML del server la
// diría distinta del navegador (la hidratación falla). Antes, los mensajes van sin hora.
// ⚠️ `data-esquina-ocupada` en la tarjeta: la ➤ y el micrófono viven en el rincón de abajo a la derecha, y sin la marca la
// esquina de los avisos los tapa (AGENTS.md).
// ⚠️ SOLTAR UN ARCHIVO SE FRENA SIEMPRE (revisión del Cerebro, 20/10): sin preventDefault Chrome lo abre en la pestaña y el
// dueño pierde la conversación. Arrastrar y soltar es de la PANTALLA (la caja no lo hace).

import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type DragEvent, type ReactNode } from 'react';
import { Button } from '@/app/_ui';
import { useWs } from '@/app/_ui/Link';
import { MakoStar } from '@/app/_components/MakoBrand';
import { CajaChat } from '@/app/_chat/CajaChat';
import type { PropsCajaChat } from '@/app/_chat/CajaChat';
import { RecomendacionesDeMako } from '@/app/_chat/RecomendacionesDeMako';
import { HiloMako, type EnMensaje } from '@/app/_chat/HiloMako';
import { FilaDelChat } from '@/app/admin/operaciones/Hilo';
import { AudioPlay } from '@/app/whatsapp/_shared/AudioPlay';
import { itemsDeOffer, type ItemHilo } from '@/app/m/mako/chat-ui';
import { estaAbajo } from '@/lib/centro-caja';
import { SECCION_OFFER, criaturaDeOffer } from '@/lib/chat-mako-reglas';
import { conWs } from '@/lib/ws-tab';
import type { AdjuntoVista, OfferMensaje, OfferSesionVista } from '@/lib/offer-marco';
import { ChipArchivo } from './ChipArchivo';
import { DocumentoPdf } from './DocumentoPdf';
import { esOpcionArmar, esOpcionNinguna, notaDelAdjunto, pdfDeMensaje } from './ayudas';
import { GenerandoEnChat, type PasoGeneracion } from './Generando';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import type { MensajeWA } from '@/lib/centro-mensajes';

/** El ➤ y el ✓ de la barra de grabar van en el negro del Ops Center: la barra los pinta con `--good` (el verde), y el ícono,
 *  con `--sobre-good` (sin él, el ✓ blanco no se veía sobre la tinta clara del modo oscuro). */
const SIN_VERDE = { '--good': 'var(--ink)', '--sobre-good': 'var(--surface)' } as CSSProperties;
/** Lo que Offer suma adentro de un mensaje de MaKo, separado de su texto. */
const EN_MENSAJE: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8, margin: '2px 0' };
const nada = () => {};

/** ¿MaKo está LEYENDO algo (un link o archivos) y no sólo contestando? Entonces la espera dice «Analizando…» (18/10/2026). */
export function leeAlgo(fuente: string | undefined): boolean {
  return fuente === 'tu link' || /archivos?$/.test(fuente ?? '');
}

const sinSuscripcion = () => () => {};

/** Los archivos que viajaron con un mensaje de MaKo, debajo de su texto (como un adjunto de WhatsApp). */
function Adjuntos({ lista }: { lista: AdjuntoVista[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
      {lista.map((a) => {
        const nota = notaDelAdjunto(a);
        return <ChipArchivo key={a.id} nombre={a.nombre} via={a.via} estado={nota ? 'aviso' : 'listo'} nota={nota || undefined} />;
      })}
    </div>
  );
}

/** MaKo armando la oferta, como un mensaje más del hilo (ya no reemplaza al chat). */
export type ArmandoEnChat = { paso: PasoGeneracion; corriendo: boolean; error: string | null; onReintentar: () => void };

type ItemMsg = Extract<ItemHilo, { k: 'msg' }>;

export function ChatOffer({
  sesion, pendiente, respondiendo, fuente, opcionArmar, opcionActualizar, opcionesHabilitadas, onOpcion, onVarias, onReintentar,
  caja, onCitar, onArchivos, ocupado, error, onError, armando = null, onVerOferta = null, extra, soloTexto = false, errorExtra, enTarjeta = false,
}: {
  sesion: OfferSesionVista;
  /** «Responder» del clic derecho de un mensaje. Sin él, el menú sólo trae Copiar. */
  onCitar?: (m: MensajeWA) => void;
  /** El mensaje del dueño ya dibujado mientras MaKo contesta (optimista): sale con «Enviando…». */
  pendiente: OfferMensaje | null;
  respondiendo: boolean;
  /** Qué está leyendo MaKo («tu respuesta», «tu audio», «tu link»): con un link o archivos, «Analizando …» (`leeAlgo`); si
   *  no, los tres puntitos. */
  fuente?: string;
  /** El texto de la opción que arma la oferta (lib/offer-reglas.ts → OPCION_ARMAR). */
  opcionArmar: string;
  /** El de actualizar el PDF (ayudas.ts → ACTUALIZAR_PDF): si MaKo lo ofrece, también arma y va en dorado. */
  opcionActualizar: string;
  /** Falso mientras se lee un archivo o MaKo contesta: un toque ahí mandaría a medias. */
  opcionesHabilitadas: boolean;
  /** El índice de la opción en `opciones` del último mensaje (el ORIGINAL: el de una pregunta del diagnóstico). */
  onOpcion: (idx: number) => void;
  /**
   * Las opciones marcadas de un mensaje con `varias` (16/10/2026), en el orden en que están. Sin esto, cada opción
   * se manda sola con un toque, como siempre (el chat de arranque no lo pasa).
   */
  onVarias?: (idxs: number[]) => void;
  /** «Reintentar» la respuesta de MaKo al último mensaje; null = no hay nada sin contestar. */
  onReintentar: (() => void) | null;
  /** La caja única, armada por OfferApp (la tab y el onboarding): lo escrito, lo adjuntado y la nota de voz. */
  caja: PropsCajaChat;
  /** Soltar archivos sobre la conversación: los JUNTA en la caja, como el «+» (no los sube ni los lee). */
  onArchivos: (archivos: File[]) => void;
  /** MaKo contesta, se lee un archivo o se arma la oferta: soltar no junta nada. */
  ocupado: boolean;
  error: string | null;
  onError: (m: string) => void;
  /** MaKo armando la oferta: va como un mensaje más al final del hilo (el chat no se va). */
  armando?: ArmandoEnChat | null;
  /** «Ver mi oferta» debajo de cada PDF: abre la oferta en una ventana encima del chat. */
  onVerOferta?: (() => void) | null;
  /** Lo que va adentro de un mensaje de MaKo, debajo del texto (las tarjetas del arranque). */
  extra?: (m: OfferMensaje) => ReactNode | null;
  /** Sin adjuntar: el arranque pregunta cosas cortas (el nombre, un código) fuera de la oferta. */
  soloTexto?: boolean;
  /** Lo que va debajo del error (en el arranque, conectar una IA propia si la de MaKo no contesta). */
  errorExtra?: ReactNode;
  /** Adentro de la tarjeta del chat de Create (app/_crear/PantallaCrear.tsx, 29/10/2026): el borde y el redondeado son de la
   *  tarjeta, no del hilo (si no, quedan dos marcos). */
  enTarjeta?: boolean;
}) {
  const ws = useWs();
  const montado = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const [encima, setEncima] = useState(false);
  const [marcadas, setMarcadas] = useState<{ de: string; idxs: number[] }>({ de: '', idxs: [] });
  /** Para la píldora del día («Hoy», «Ayer») del hilo. */
  const [ahora] = useState(() => Date.now());
  const hilo = useRef<HTMLDivElement>(null);
  /** ¿Se estaba mirando lo último? Entonces lo nuevo lo sigue (si se subió a leer algo de antes, no se lo mueve). */
  const abajo = useRef(true);
  const deSesion = useRef(sesion.id);

  const mensajes = sesion.mensajes;
  const ultimo = mensajes[mensajes.length - 1];
  // Su criatura, la de la fila de esta conversación en el Ops Center (lib/chat-mako-reglas.ts → listaDelCliente).
  const quien = { nombre: criaturaDeOffer(sesion.titulo?.trim() || SECCION_OFFER) };

  // Los mensajes por id: el hueco del hilo (`enMensaje`) recibe el del hilo y necesita el de Offer (el PDF, los adjuntos).
  const porId = useMemo(() => {
    const m = new Map<string, OfferMensaje>();
    for (const x of mensajes) m.set(x.id, x);
    if (pendiente) m.set(pendiente.id, pendiente);
    return m;
  }, [mensajes, pendiente]);

  // El hilo, con la proyección del Ops Center. Memo: el scroll sigue a `items`, y un arreglo nuevo en cada tecla de la caja lo
  // movería sin que haya nada nuevo.
  const items = useMemo<ItemHilo[]>(() => {
    const todos = pendiente ? [...mensajes, pendiente] : mensajes;
    const conHora = montado ? todos : todos.map((m) => ({ ...m, at: '' }));
    return itemsDeOffer(conHora, (u) => conWs(u, ws), notaDelAdjunto)
      .filter((x) => x.k !== 'bloque')
      .map((x) => (pendiente && x.k === 'msg' && x.id === `of-${pendiente.id}` ? { ...x, estado: 'enviando' as const } : x));
  }, [mensajes, pendiente, montado, ws]);

  // Las respuestas rápidas cuelgan SÓLO del último mensaje, y sólo si es de MaKo: las de una pregunta
  // ya contestada no contestan nada. Se guarda el índice ORIGINAL: en una pregunta del diagnóstico la
  // opción N es la respuesta N, y filtrar las vacías no puede correrlas de lugar.
  const opciones = !pendiente && ultimo?.de === 'mako'
    ? (ultimo.opciones ?? []).map((t, idx) => ({ t: t.trim(), idx })).filter((o) => o.t)
    : [];

  // Lo nuevo se ve sin buscarlo: la conversación sigue abajo si se estaba mirando lo último, al abrir otra y cuando escribe
  // el dueño.
  useLayoutEffect(() => {
    const h = hilo.current;
    if (!h) return;
    if (deSesion.current !== sesion.id) { deSesion.current = sesion.id; abajo.current = true; }
    if (abajo.current || pendiente) h.scrollTop = h.scrollHeight;
  }, [items, respondiendo, armando?.corriendo, armando?.error, opciones.length, error, sesion.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Lo de Offer adentro de un mensaje de MaKo: el PDF y su nota de voz arriba; lo que leyó y las tarjetas, debajo. */
  const enMensaje = (x: ItemMsg): EnMensaje | null => {
    const m = x.role === 'assistant' ? porId.get(x.id.replace(/^of-/, '')) : undefined;
    if (!m) return null;
    // Después de cada armado, MaKo manda el PDF de esa versión (`pdf`) con la propuesta de pulirla: el documento arriba y
    // el texto debajo, como un archivo de WhatsApp con su pie.
    const pdf = pdfDeMensaje(m);
    const tarjeta = extra?.(m) ?? null;
    const audio = m.audio?.url ? <AudioPlay src={conWs(m.audio.url, ws)} duracion={m.audio.secs} color="var(--primary)" style={{ width: 240 }} /> : null;
    const lista = m.adjuntos?.length ? m.adjuntos : null;
    if (!pdf && !audio && !lista && !tarjeta) return null;
    return {
      arriba: pdf || audio ? (
        <div style={EN_MENSAJE}>
          {pdf && <DocumentoPdf sesionId={sesion.id} version={pdf.version} onError={onError} onVer={onVerOferta} />}
          {audio}
        </div>
      ) : null,
      abajo: lista || tarjeta ? <div style={EN_MENSAJE}>{lista && <Adjuntos lista={lista} />}{tarjeta}</div> : null,
    };
  };

  // Con `varias`, cada opción se marca y se desmarca, y «Enviar» las manda juntas. «Armar mi oferta» y la que dice
  // que no hay ninguna («No, sólo ésta») siguen saliendo con un toque. Lo marcado cuelga del id del mensaje: con el
  // mensaje siguiente arranca vacío solo, sin un efecto que lo limpie.
  const varias = !!onVarias && ultimo?.de === 'mako' && ultimo.varias === true && !ultimo.pregunta;
  const marcadasAhora = varias && marcadas.de === ultimo?.id ? marcadas.idxs : [];
  const tocar = (idx: number, t: string, armar: boolean) => {
    if (!varias || armar || esOpcionNinguna(t)) { onOpcion(idx); return; }
    const idxs = marcadasAhora.includes(idx) ? marcadasAhora.filter((i) => i !== idx) : [...marcadasAhora, idx].sort((a, b) => a - b);
    setMarcadas({ de: ultimo!.id, idxs });
  };
  // Van AL FINAL DEL HILO, y se desplazan con él (22/10/2026, el caso de uso de OF4 a 390 px): fijas arriba de la caja, cuatro
  // opciones largas ocupaban 250 px y la conversación quedaba en 240. Así las dibuja también el Ops Center (una pregunta del hilo).
  const rapidas = opciones.length || onReintentar ? (
    <div className="of-rapidas" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {onReintentar && (
        <div className="of-reintento" role="status">
          <span>MaKo no contestó tu último mensaje.</span>
          <Button variant="secondary" size="sm" onClick={onReintentar}>Reintentar</Button>
        </div>
      )}
      {opciones.length > 0 && (
        <div role="group" aria-label={varias ? 'Respuestas rápidas: puedes marcar varias' : 'Respuestas rápidas'} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {varias && <span className="of-pill-ayuda">Puedes marcar varias</span>}
          {opciones.map(({ t, idx }) => {
            const armar = !ultimo?.pregunta && (esOpcionArmar(t, opcionArmar) || esOpcionArmar(t, opcionActualizar)) && sesion.puedeConcluir;
            const marcable = varias && !armar && !esOpcionNinguna(t);
            const marcada = marcable && marcadasAhora.includes(idx);
            return (
              <button key={`${idx}-${t}`} type="button" className={`of-pill${armar ? ' of-pill--mako' : ''}${marcada ? ' of-pill--marcada' : ''}`}
                disabled={!opcionesHabilitadas} onClick={() => tocar(idx, t, armar)} {...(marcable ? { 'aria-pressed': marcada } : {})}>
                {armar && <MakoStar size={14} animate={false} />}
                {marcada && <span aria-hidden>✓</span>}
                {t}
              </button>
            );
          })}
          {marcadasAhora.length > 0 && (
            <Button size="sm" disabled={!opcionesHabilitadas} onClick={() => { onVarias?.(marcadasAhora); setMarcadas({ de: '', idxs: [] }); }}>
              Enviar ({marcadasAhora.length})
            </Button>
          )}
        </div>
      )}
    </div>
  ) : null;

  // Soltar archivos sobre el chat hace lo mismo que el «+». Con sólo texto (el arranque pregunta el nombre o un código) no se
  // adjunta: soltar no hace nada, pero el archivo se frena igual.
  const alArrastrar = (e: DragEvent<HTMLDivElement>) => {
    if (!Array.from(e.dataTransfer?.types ?? []).includes('Files')) return;
    e.preventDefault();
    if (soloTexto || ocupado) return;
    if (!encima) setEncima(true);
  };
  const alSoltar = (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    setEncima(false);
    if (!soloTexto && !ocupado) onArchivos(Array.from(e.dataTransfer.files));
  };

  return (
    <div className="of-hilo" data-esquina-ocupada
      onDragOver={alArrastrar} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setEncima(false); }} onDropCapture={() => setEncima(false)} onDrop={alSoltar}
      style={enTarjeta
        ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative', background: 'var(--surface)', overflow: 'hidden' }
        : {
          flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative',
          background: 'var(--surface)', border: '1px solid var(--border)', borderTop: '3px solid var(--primary)', borderRadius: 16, overflow: 'hidden',
        }}>
      <div className="co-hilo" ref={hilo} onScroll={(e) => { abajo.current = estaAbajo(e.currentTarget); }}>
        <div className="co-hilo__col">
          <HiloMako items={items} quien={quien} ahora={ahora} escribiendo={null}
            tarjeta={null} onTarjeta={nada} onReintentar={nada} onRecargar={nada} enMensaje={enMensaje} onCitar={onCitar} />
          {/* La espera, en la fila de MaKo del Ops Center: SÓLO LOS TRES PUNTITOS de «está escribiendo», sin texto (18/10/2026,
              Martín: «En lugar de "Revisando tu respuesta", sólo debería aparecer la animación de los ... como que está
              escribiendo»; por eso no el «Trabajando…» del hilo). Y «Analizando…» mientras LEE un link o un documento (18/10,
              14:00, Martín): ahí tarda y conviene decir qué hace. */}
          {respondiendo && (
            <FilaDelChat m={null} quien={{ titulo: quien.nombre }} marcas={null} hora={null}>
              {leeAlgo(fuente) ? (
                <span role="status" className="of-analizando">Analizando {fuente}<span className="of-puntos" aria-hidden><span>.</span><span>.</span><span>.</span></span></span>
              ) : (
                <span role="status" aria-label="MaKo está escribiendo" className="of-escribiendo"><i /><i /><i /></span>
              )}
            </FilaDelChat>
          )}
          {armando && (armando.corriendo || armando.error) && (
            <FilaDelChat m={null} quien={{ titulo: quien.nombre }} marcas={null} hora={null} ancho>
              <GenerandoEnChat paso={armando.paso} corriendo={armando.corriendo} error={armando.error} onReintentar={armando.onReintentar} />
            </FilaDelChat>
          )}
          {rapidas}
        </div>
      </div>
      {/* El cartel de soltar del Ops Center (centro.css → .co-soltar). */}
      {encima && <div className="co-soltar" aria-hidden>Suelta para adjuntar</div>}
      {error && <div role="alert" className="of-error">{error}{errorExtra ? <> {errorExtra}</> : null}<ReportarASoporte /></div>}
      {/* La caja va POR CONVERSACIÓN (`key`): una grabación a medias no viaja a otra (la grabación guarda el `onAudio` del
          render en que se apretó el micrófono). */}
      {/* Lo que MaKo recomienda sobre la oferta con lo que dice la gente (26/10/2026): el bloque de preguntas, plegado, justo
          arriba de la caja (afuera de su envoltorio: la caja es la única, tests/onboarding-caja-centro.test.ts). */}
      <RecomendacionesDeMako superficie="offer" alPedir={caja.onTexto} />
      <div key={sesion.id} className="co-caja-wrap" style={SIN_VERDE}>
        <div className="co-caja"><CajaChat {...caja} /></div>
      </div>
    </div>
  );
}
