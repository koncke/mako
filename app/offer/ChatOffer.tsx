'use client';

// =============================================================================
// ChatOffer — la conversación con MaKo, con el chat de WhatsApp de la casa
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que el diseño del chat se vea exactamente igual a lo que
// ya creamos… Que tenga ese formato de grabar audio, la animación de grabando audio, adjuntar
// archivos, imagenes, emojis… Copialo tal cual.» (Mandó la captura del editor de mensajes de
// WhatsApp de /automations.) Por eso esto NO dibuja un chat propio: monta las piezas de
// app/whatsapp/_shared tal cual.
//
//   · el HILO es `ChatHilo` (scroll pegado abajo, entrada animada de lo nuevo, la franja de las
//     respuestas rápidas con `encimaDelComposer`); la burbuja de cada mensaje es `BurbujaHilo`
//     (el audio del dueño con `AudioPlay` y su transcripción, la hora y las palomitas `Ticks`);
//   · la BARRA es `ComposerWhatsApp` en modo `enviar`: emojis, el clip con su menú y el micrófono con
//     la grabación de `useGrabacionVoz` / `BarraGrabacion` (✓ termina, se escucha, ➤ verde manda).
//
// Lo que se ENVUELVE, y por qué (no se toca ningún archivo de _shared, que montan otras tabs):
//   ⚠️ MaKo escribe Markdown (negrita, listas) y la burbuja pinta marcas de WhatsApp (`*negrita*`):
//      sus mensajes van por `renderMensaje` de ChatHilo, con la MISMA burbuja (`BurbujaHilo`) y el
//      texto por <Markdown> en su ranura `vacio` (lo que dibuja cuando no hay texto propio). Al lado,
//      su foto de perfil (./AvatarMako.tsx).
//   ⚠️ LA BARRA DE ChatHilo NO SIRVE ACÁ: su selector corta en 4 MB y su `accept` no trae .txt/.md/.csv;
//      los archivos de Offer se suben y se leen por el camino de Offer (subir-url → PUT → leer,
//      lib/formatos-archivo.ts → ACCEPT_IMPORTAR, hasta 25 MB). Así que ChatHilo va SIN barra (sin
//      handlers de envío) y la barra se monta acá, con su menú del clip propio (`menuClip`: «Foto o
//      video» y «Documento», como el editor del lienzo).
//   ⚠️ LOS ARCHIVOS ELEGIDOS NO SE LEEN ACÁ (11/10/2026, «Solo cuando le doy a ENVIAR debería…»): el clip
//      y soltar llaman a `onArchivos`, que los junta en la vista previa de la casa (VistaAdjuntos, la
//      misma de ChatHilo). La vista llega armada por `vista` y se apoya ENCIMA del hilo y la barra, sin
//      desmontarlos (la barra guarda la sesión de voz; el hilo, su scroll).
//   ⚠️ LA CAJA: ChatHilo trae su propio borde y su radio. Para que la barra quede ADENTRO de la misma
//      tarjeta (como en ChatHilo con su barra), la tarjeta es ésta, con los mismos valores, y la de
//      ChatHilo se aplana con una regla de la hoja (estilos.ts → `.of-hilo-lista > div`): una regla con
//      `!important` le gana al estilo en línea sin tocar el componente compartido.
//   ⚠️ LOS COLORES: el default de ChatHilo es el índigo del WhatsApp no oficial, y su burbuja
//      (`--wa-noof-bubble`) no se redefine en oscuro: texto claro sobre burbuja clara. Acá van
//      `--primary` / `--primary-bg`, que existen en los dos temas (y el dueño en azul, como en la v1).
//
// ⚠️ LA HORA DE CADA BURBUJA SE PIDE DESPUÉS DE MONTAR (`montado`): sale de la zona horaria de quien
// la calcula, y el HTML del server la diría distinta del navegador (la hidratación falla).
// ⚠️ `data-esquina-ocupada` en la tarjeta: la ➤ y el micrófono viven en el rincón de abajo a la
// derecha, y sin la marca la esquina de los avisos los tapa (AGENTS.md).

import { useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent, type DragEvent, type ReactNode } from 'react';
import { Button, Spinner } from '@/app/_ui';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { useWs } from '@/app/_ui/Link';
import { Markdown } from '@/app/_components/Markdown';
import { MakoStar } from '@/app/_components/MakoBrand';
import { TextoMarcas } from '@/app/_components/TextoMarcas';
import { ChatHilo, type HiloMsg } from '@/app/whatsapp/_shared/ChatHilo';
import { BurbujaHilo } from '@/app/whatsapp/_shared/BurbujaHilo';
import { Ticks } from '@/app/whatsapp/_shared/Ticks';
import { ComposerWhatsApp, IconVideo, type OpcionMenuWA } from '@/app/whatsapp/_shared/ComposerWhatsApp';
import { IconDoc } from '@/app/whatsapp/_shared/composer-icons';
import { GRAMATICA } from '@/lib/mako-gramatica';
import { ACCEPT_IMPORTAR, EXT_POR_FAMILIA } from '@/lib/formatos-archivo';
import { conWs } from '@/lib/ws-tab';
import type { AdjuntoVista, OfferMensaje, OfferSesionVista } from '@/lib/offer-marco';
import { AvatarMako } from './AvatarMako';
import { ChipArchivo } from './ChipArchivo';
import { esOpcionArmar, esOpcionNinguna, horaDe, nombrePdfVersion, notaDelAdjunto, pdfDeMensaje, ticksDe } from './ayudas';
import { descargarPdf, mensajeDeError } from './offer-api';
import { GenerandoEnChat, type PasoGeneracion } from './Generando';

/** El acento de la tarjeta y la burbuja del dueño: tokens que existen en claro Y en oscuro. */
const ACENTO = 'var(--primary)';
const BURBUJA_YO = 'var(--primary-bg)';
/** El renglón de «MaKo está escribiendo» viaja como un mensaje más del hilo (con su foto al lado). */
const ID_ESCRIBIENDO = '__of-escribiendo';

const ACCEPT_FOTO = [...EXT_POR_FAMILIA.imagen, ...EXT_POR_FAMILIA.video].map((e) => `.${e}`).join(',');

const sinSuscripcion = () => () => {};

/** El texto de una burbuja, con el mismo tamaño y la misma tinta que el de BurbujaHilo. */
const TEXTO_BURBUJA = { fontSize: 14, lineHeight: 1.45, color: 'var(--ink)', overflowWrap: 'anywhere' as const };

/** Los archivos que viajaron con un mensaje, ADENTRO de su burbuja (como un adjunto de WhatsApp). */
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

/**
 * El PDF de una versión de la oferta, como un documento de WhatsApp adentro de la burbuja de MaKo: el
 * ícono, el nombre y, al tocarlo, baja ESA versión. Baja por `fetch` (offer-api → descargarPdf) para que
 * un error del servidor se diga en el chat y no se descargue un JSON con nombre de PDF.
 */
export function DocumentoPdf({ sesionId, version, onError, onVer }: { sesionId: number; version: number; onError: (m: string) => void; onVer?: (() => void) | null }) {
  const [bajando, setBajando] = useState(false);
  const bajar = async () => {
    if (bajando) return;
    setBajando(true);
    try { await descargarPdf(sesionId, version); } catch (e) { onError(mensajeDeError(e)); } finally { setBajando(false); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button type="button" className="of-doc" onClick={() => void bajar()} disabled={bajando} aria-busy={bajando || undefined}
        title="Descargar el PDF" aria-label={`Descargar el PDF de tu oferta, versión ${version}`}>
        <span className="of-doc__icono" aria-hidden>PDF</span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="of-doc__nombre">{nombrePdfVersion(version)}</span>
          <span className="of-doc__meta">PDF</span>
        </span>
        <span aria-hidden style={{ flex: 'none', display: 'inline-flex', color: 'var(--dim)' }}>
          {bajando ? <Spinner size={16} /> : <IconoMenu nombre="descargar" size={18} />}
        </span>
      </button>
      {/* «Ver» abre la oferta en una ventana ENCIMA del chat (16/10/2026, Martín en la llamada del 12/10:
          «que jamás se salga el recuadro del chat… de última que haya como una preview de un pop-up»). */}
      {onVer && (
        <button type="button" className="of-doc-ver" onClick={onVer}>
          <IconoMenu nombre="ver" size={15} /> Ver mi oferta
        </button>
      )}
    </div>
  );
}

/** La fila de un mensaje de MaKo: su foto y, al lado, la burbuja. */
function FilaMako({ animar = false, avatar, children }: { animar?: boolean; avatar?: (animar: boolean) => ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      {avatar ? avatar(animar) : <AvatarMako size={30} animar={animar} />}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>{children}</div>
    </div>
  );
}

/** MaKo armando la oferta, como un mensaje más del hilo (ya no reemplaza al chat). */
export type ArmandoEnChat = { paso: PasoGeneracion; corriendo: boolean; error: string | null; onReintentar: () => void };
/** El renglón de «MaKo está armando tu oferta» viaja como un mensaje más del hilo. */
const ID_ARMANDO = '__of-armando';

export type AudioEnEspera = { url: string; secs: number };

export function ChatOffer({
  sesion, pendiente, respondiendo, fuente, opcionArmar, opcionActualizar, opcionesHabilitadas, onOpcion, onVarias, onReintentar,
  texto, onTexto, onEnviar, ocupado, vista, onArchivos, onAudio, audioEnEspera, onReenviarAudio, onDescartarAudio,
  error, onError, armando = null, onVerOferta = null, avatar, extra, soloTexto = false, placeholder, errorExtra,
}: {
  sesion: OfferSesionVista;
  /** El mensaje del dueño ya dibujado mientras MaKo contesta (optimista). */
  pendiente: OfferMensaje | null;
  respondiendo: boolean;
  /** Qué está leyendo MaKo («tu respuesta», «tu audio», «tu link»): va al lado del rótulo de la gramática. */
  fuente: string;
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
  texto: string;
  onTexto: (v: string) => void;
  onEnviar: () => void;
  /** MaKo contesta, se lee un archivo o se arma la oferta: los botones de la barra se apagan (el campo no). */
  ocupado: boolean;
  /** La vista previa de los archivos juntados (VistaAdjuntos), encima del hilo y la barra; null = el chat. */
  vista: ReactNode | null;
  /** El clip y soltar: los JUNTA en la vista previa (no los sube ni los lee). */
  onArchivos: (archivos: File[]) => void;
  /** La nota de voz que se mandó con la ➤ (ya escuchada en la barra). */
  onAudio: (blob: Blob, secs: number) => void;
  /** Una nota de voz que NO salió (se cortó la subida): vuelve a la barra de escucharla para reintentar. */
  audioEnEspera: AudioEnEspera | null;
  onReenviarAudio: () => void;
  onDescartarAudio: () => void;
  error: string | null;
  onError: (m: string) => void;
  /** MaKo armando la oferta: va como un mensaje más al final del hilo (el chat no se va). */
  armando?: ArmandoEnChat | null;
  /** «Ver mi oferta» debajo de cada PDF: abre la oferta en una ventana encima del chat. */
  onVerOferta?: (() => void) | null;
  /** La foto de MaKo al lado de cada mensaje suyo (el chat de arranque usa su muñeco). Sin esto, la estrella. */
  avatar?: (animar: boolean) => ReactNode;
  /** Lo que va adentro de la burbuja de un mensaje de MaKo, debajo del texto (las tarjetas del arranque). */
  extra?: (m: OfferMensaje) => ReactNode | null;
  /** Sin clip ni micrófono: el arranque pregunta cosas cortas (el nombre, un código) fuera de la oferta. */
  soloTexto?: boolean;
  placeholder?: string;
  /** Lo que va debajo del error (en el arranque, conectar una IA propia si la de MaKo no contesta). */
  errorExtra?: ReactNode;
}) {
  const ws = useWs();
  const montado = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const inputDoc = useRef<HTMLInputElement>(null);
  const inputFoto = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);
  const [marcadas, setMarcadas] = useState<{ de: string; idxs: number[] }>({ de: '', idxs: [] });

  const mensajes = sesion.mensajes;
  const ultimo = mensajes[mensajes.length - 1];

  // Los mensajes por id: `renderMensaje` recibe el del hilo y necesita el de Offer (el Markdown, los adjuntos).
  const porId = useMemo(() => {
    const m = new Map<string, OfferMensaje>();
    for (const x of mensajes) m.set(x.id, x);
    if (pendiente) m.set(pendiente.id, pendiente);
    return m;
  }, [mensajes, pendiente]);

  // El hilo en la forma de ChatHilo. Memo: el autoscroll del hilo corre cuando cambia `mensajes`, y
  // un arreglo nuevo en cada tecla del composer lo dispararía sin que haya nada nuevo.
  const hilo = useMemo<HiloMsg[]>(() => {
    const aHilo = (m: OfferMensaje, status: string | null): HiloMsg => {
      const fecha = montado ? m.at : null;
      if (m.de === 'mako') return { id: m.id, fromMe: false, texto: m.texto, fecha };
      if (m.audio?.url) {
        return { id: m.id, fromMe: true, tipo: 'audio', mediaUrl: conWs(m.audio.url, ws), transcript: m.texto.trim() || null, fecha, status };
      }
      return { id: m.id, fromMe: true, texto: m.texto, fecha, status };
    };
    const out = mensajes.map((m, i) => aHilo(m, m.de === 'yo' ? ticksDe(mensajes, i) : null));
    if (pendiente) out.push(aHilo(pendiente, 'sent'));
    if (respondiendo) out.push({ id: ID_ESCRIBIENDO, fromMe: false });
    if (armando && (armando.corriendo || armando.error)) out.push({ id: ID_ARMANDO, fromMe: false });
    return out;
  }, [mensajes, pendiente, respondiendo, montado, ws, armando]);

  /** Los mensajes que la burbuja de ChatHilo no sabe dibujar; null = la de siempre. */
  const renderMensaje = (h: HiloMsg): ReactNode | null => {
    if (h.id === ID_ARMANDO && armando) {
      return (
        <FilaMako animar={armando.corriendo} avatar={avatar}>
          <BurbujaHilo contenido={{}} saliente={false} maxAncho="88%" vacio={(
            <GenerandoEnChat paso={armando.paso} corriendo={armando.corriendo} error={armando.error} onReintentar={armando.onReintentar} />
          )} />
        </FilaMako>
      );
    }
    if (h.id === ID_ESCRIBIENDO) {
      return (
        <FilaMako animar avatar={avatar}>
          <BurbujaHilo contenido={{}} saliente={false} vacio={(
            <span role="status" style={{ fontSize: 13, color: 'var(--dim)' }}>
              <span style={{ color: 'var(--mako-ink)', fontWeight: 600 }}>{GRAMATICA.analizando.rotulo}</span>
              {' · '}{fuente}
              <span className="of-puntos" aria-hidden><span>.</span><span>.</span><span>.</span></span>
            </span>
          )} />
        </FilaMako>
      );
    }
    const m = porId.get(String(h.id));
    if (!m) return null;
    const hora = horaDe(h.fecha);
    if (m.de === 'mako') {
      // Después de cada armado, MaKo manda el PDF de esa versión (`pdf`) con la propuesta de pulirla: el
      // documento arriba y el texto debajo, como un archivo de WhatsApp con su pie.
      const pdf = pdfDeMensaje(m);
      const tarjeta = extra?.(m) ?? null;
      return (
        <FilaMako avatar={avatar}>
          <BurbujaHilo saliente={false} hora={hora} maxAncho="88%"
            contenido={m.audio?.url ? { audio: { url: conWs(m.audio.url, ws), transcript: m.texto.trim() || null, duracion_s: m.audio.secs } } : {}}
            vacio={(
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pdf && <DocumentoPdf sesionId={sesion.id} version={pdf.version} onError={onError} onVer={onVerOferta} />}
                {m.texto.trim() && <div style={TEXTO_BURBUJA}><Markdown text={m.texto} /></div>}
                {!!m.adjuntos?.length && <Adjuntos lista={m.adjuntos} />}
                {tarjeta}
              </div>
            )} />
        </FilaMako>
      );
    }
    // Del dueño, con archivos: los archivos van ADENTRO de la burbuja y el texto debajo, como un
    // adjunto con su pie. Sin archivos, la burbuja de siempre de ChatHilo.
    if (!m.adjuntos?.length) return null;
    // ⚠️ Una nota de voz CON documentos: la «Transcripción del audio» (el servidor la arma cuando la nota
    // no entra en el mensaje) viaja como un adjunto más. La burbuja del audio no tiene dónde dibujar
    // otra cosa (su `vacio` sólo sale sin audio), así que los chips van debajo, alineados con ella; sin
    // esto la burbuja de siempre los tiraba y la transcripción entera quedaba invisible.
    if (m.audio?.url) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <BurbujaHilo saliente fondo={BURBUJA_YO} hora={hora} pie={<Ticks status={h.status ?? null} />}
            contenido={{ audio: { url: conWs(m.audio.url, ws), transcript: m.texto.trim() || null, duracion_s: m.audio.secs } }} />
          <div style={{ maxWidth: '78%', minWidth: 0 }}><Adjuntos lista={m.adjuntos} /></div>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <BurbujaHilo saliente fondo={BURBUJA_YO} hora={hora} pie={<Ticks status={h.status ?? null} />} contenido={{}}
          vacio={(
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Adjuntos lista={m.adjuntos} />
              {m.texto.trim() && <div style={{ ...TEXTO_BURBUJA, whiteSpace: 'pre-wrap' }}><TextoMarcas texto={m.texto} /></div>}
            </div>
          )} />
      </div>
    );
  };

  // Las respuestas rápidas cuelgan SÓLO del último mensaje, y sólo si es de MaKo: las de una pregunta
  // ya contestada no contestan nada. Se guarda el índice ORIGINAL: en una pregunta del diagnóstico la
  // opción N es la respuesta N, y filtrar las vacías no puede correrlas de lugar.
  const opciones = !pendiente && ultimo?.de === 'mako'
    ? (ultimo.opciones ?? []).map((t, idx) => ({ t: t.trim(), idx })).filter((o) => o.t)
    : [];
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
  const encimaDelComposer = opciones.length || onReintentar ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 10 }}>
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
  ) : undefined;

  const menuClip: OpcionMenuWA[] = [
    { key: 'foto', label: 'Foto o video', icono: <IconVideo size={18} />, onElegir: () => inputFoto.current?.click() },
    { key: 'doc', label: 'Documento', icono: <IconDoc size={18} />, onElegir: () => inputDoc.current?.click() },
  ];
  const elegidos = (e: ChangeEvent<HTMLInputElement>) => {
    const lista = Array.from(e.target.files ?? []);
    // Se vacía para que elegir el MISMO archivo otra vez vuelva a disparar el cambio.
    e.target.value = '';
    if (lista.length) onArchivos(lista);
  };

  // Soltar archivos sobre el chat hace lo mismo que el clip.
  const alArrastrar = (e: DragEvent<HTMLDivElement>) => {
    if (ocupado || !Array.from(e.dataTransfer?.types ?? []).includes('Files')) return;
    e.preventDefault();
    if (!encima) setEncima(true);
  };
  const alSoltar = (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    setEncima(false);
    if (!ocupado) onArchivos(Array.from(e.dataTransfer.files));
  };

  return (
    <div className="of-hilo" data-esquina-ocupada data-encima={encima || undefined}
      onDragOver={alArrastrar} onDragLeave={() => setEncima(false)} onDrop={alSoltar}
      style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative',
        background: 'var(--surface)', border: '1px solid var(--border)', borderTop: `3px solid ${ACENTO}`, borderRadius: 16, overflow: 'hidden',
      }}>
      {/* El alto del hilo sale de una caja ABSOLUTA: ChatHilo se mide con `height: 100%`, y un
          porcentaje contra un alto que sale de flex da CERO en Safari (AGENTS.md, «Dos reglas de
          layout»). Contra una caja con `inset: 0` el alto es definido en todos los motores. */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <div className="of-hilo-lista" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
          <ChatHilo
            key={sesion.id}
            mensajes={hilo}
            accent={ACENTO}
            accentBubble={BURBUJA_YO}
            animarNuevos
            renderMensaje={renderMensaje}
            encimaDelComposer={encimaDelComposer}
          />
        </div>
      </div>
      {error && <div role="alert" className="of-error">{error}{errorExtra ? <> {errorExtra}</> : null}</div>}
      {/* La barra va POR CONVERSACIÓN (`key`): una grabación a medias no viaja a otra (la sesión de voz
          guarda el `onAudio` del render en que se apretó el 🎤: ComposerWhatsApp, cabecera). */}
      <ComposerWhatsApp
        key={sesion.id}
        modo="enviar"
        valor={texto}
        onValor={onTexto}
        onEnviar={onEnviar}
        ocupado={ocupado}
        placeholder={placeholder}
        menuClip={soloTexto ? undefined : menuClip}
        onAudio={soloTexto ? undefined : onAudio}
        onErrorAudio={onError}
        audioPendiente={audioEnEspera
          ? { url: audioEnEspera.url, secs: audioEnEspera.secs, onDescartar: onDescartarAudio, onUsar: onReenviarAudio, rotuloUsar: 'Enviar audio' }
          : null}
      />
      <input ref={inputFoto} type="file" multiple accept={ACCEPT_FOTO} onChange={elegidos} hidden />
      <input ref={inputDoc} type="file" multiple accept={ACCEPT_IMPORTAR} onChange={elegidos} hidden />
      {/* La vista previa, como en WhatsApp Web: tapa el área del chat (hilo + barra) con `inset: 0`. */}
      {vista && <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', flexDirection: 'column' }}>{vista}</div>}
    </div>
  );
}
