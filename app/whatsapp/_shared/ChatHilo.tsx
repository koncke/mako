'use client';

// =============================================================================
// ChatHilo — la columna del HILO (burbujas con media + composer) COMPARTIDA
// =============================================================================
// Extraída del inbox del cliente (EmpresaInbox) para reusar el MISMO chat en el
// WhatsApp de MaKo (grupos) y en las plantillas: mismas burbujas, misma media
// (imagen/audio/video/documento + lightbox) y el MISMO composer (emoji + adjuntar
// + nota de voz). Es agnóstico de la fuente de datos: recibe `mensajes` y los
// handlers de envío. readOnly (plantillas) esconde el composer.
//
// Desde el 08/10/2026 las dos mitades son piezas propias: la burbuja es `BurbujaHilo` (la misma
// de la tarjeta del lienzo y de la vista previa del editor) y la barra es `ComposerWhatsApp` en
// modo `enviar` (la misma del inbox y del editor). Lo que queda aquí es lo del HILO: el scroll,
// los borradores por conversación, el lightbox y la entrada animada de lo nuevo.
//
// LOS ARCHIVOS (11/10/2026, pedido de Martín con la captura de WhatsApp Web: «debería salir la vista
// previa del documento que acabo de subir, como lo tiene whatsapp… y puedo agregar más documentos... Y
// aún escribir un mensaje abajo… no solo a offer, sino a todos los chats»): elegir archivo(s) con el clip
// abre la VISTA PREVIA (./VistaAdjuntos.tsx) en el lugar del hilo, y se pueden juntar varios. Enviar los
// manda EN ORDEN con `onEnviarArchivo`, el texto como pie del primero (`enviarEnOrden`), y vuelve al
// hilo; si uno falla, los que faltan vuelven a la vista con el error. Antes era UN archivo en un chip.
//   ⚠️ El tope de 4 MB por archivo sigue: es del envío de quien monta el hilo (multipart).
//   ⚠️ Los archivos también son borrador POR CONVERSACIÓN (`adjuntoStore`), como el texto.

import { useEffect, useRef, useState, Fragment, type ReactNode } from 'react';
import { Ticks } from './Ticks';
import { BurbujaHilo, type ContenidoBurbuja } from './BurbujaHilo';
import { ComposerWhatsApp } from './ComposerWhatsApp';
import { VistaAdjuntos, useListaAdjuntos } from './VistaAdjuntos';
import { enviarEnOrden, MAX_ADJUNTOS, type ItemAdjunto } from './adjuntos-vista';

/** El `accept` del clip del hilo (y del «+» de la vista previa). */
const ACCEPT_HILO = 'image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx';
/** El tope de CADA archivo: el envío de quien monta el hilo es multipart y corta ahí. */
const TOPE_ARCHIVO_HILO = 4 * 1024 * 1024;

export type HiloMsg = {
  id: string | number;
  fromMe: boolean;
  tipo?: string | null;
  /** Solo para `tipo: 'sistema'`: pinta la línea en verde o en rojo. */
  tono?: 'ok' | 'bad' | null;
  texto?: string | null;
  mediaUrl?: string | null;
  mediaMime?: string | null;
  fecha?: string | null;
  status?: string | null;
  autor?: string | null; // nombre del remitente (para grupos, en burbujas ajenas)
  /** Lo que dice un audio (la transcripción): sale como «Dice: …» debajo del reproductor. */
  transcript?: string | null;
  /**
   * El nombre de un documento cuando `texto` es su caption. Sin esto, el `texto` de un documento
   * ES su nombre (así lo guarda el espejo de WhatsApp).
   */
  nombreArchivo?: string | null;
  /** Lo escribió MaKo para esta persona: la burbuja lleva la marca ✦. */
  ia?: boolean;
};

function fmtHora(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

/** Un mensaje del hilo, en la forma de la burbuja. */
export function contenidoDeMensaje(m: HiloMsg): ContenidoBurbuja {
  const t = m.tipo;
  const texto = m.texto ?? undefined;
  if (t === 'audio') return { audio: { url: m.mediaUrl ?? null, transcript: m.transcript ?? null }, texto, ia: m.ia };
  if (t === 'document') {
    return m.nombreArchivo
      ? { media: { url: m.mediaUrl ?? null, mime: m.mediaMime ?? '', nombre: m.nombreArchivo, tipo: 'document' }, texto, ia: m.ia }
      : { media: { url: m.mediaUrl ?? null, mime: m.mediaMime ?? '', nombre: m.texto ?? null, tipo: 'document' }, ia: m.ia };
  }
  if (t === 'image' || t === 'video' || t === 'sticker') return { media: { url: m.mediaUrl ?? null, mime: m.mediaMime ?? '', tipo: t }, texto, ia: m.ia };
  return { texto, ia: m.ia };
}

// ── La entrada de lo NUEVO (opt-in) ─────────────────────────────────────────────────────────
// Punto 10 del pedido: el «Probar» «no tiene la animación de entrada de los mensajes». Se anima
// SÓLO la burbuja cuyo id no estaba en el render anterior, y la marca se queda puesta mientras el
// mensaje siga en el hilo: sacarla a mitad de camino reiniciaría la animación en el próximo render.
// Lo que ya estaba al montar no se anima (es historial). Puro, para que un test lo ejecute.

export type VistosHilo = { firma: string; ids: ReadonlySet<string>; entrando: ReadonlySet<string> };

const SEP = '\u0001';
export const vistosIniciales = (ids: readonly string[]): VistosHilo => ({ firma: ids.join(SEP), ids: new Set(ids), entrando: new Set() });

/** Los ids que entran en este render: los que estaban entrando y siguen, más los que no estaban. */
export function seguirEntradas(prev: VistosHilo, ids: readonly string[]): VistosHilo {
  const firma = ids.join(SEP);
  if (firma === prev.firma) return prev;
  const entrando = new Set<string>();
  for (const id of ids) if (prev.entrando.has(id) || !prev.ids.has(id)) entrando.add(id);
  return { firma, ids: new Set(ids), entrando };
}

// Corto y sólo transform + opacity (no mueve el layout). Con «reducir movimiento», sólo el fundido.
const CSS_ENTRADA = '@keyframes mk-hilo-entra{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes mk-hilo-funde{from{opacity:0}to{opacity:1}}.mk-hilo-entra{animation:mk-hilo-entra .24s cubic-bezier(.2,.8,.2,1) both}@media (prefers-reduced-motion:reduce){.mk-hilo-entra{animation:mk-hilo-funde .18s ease-out both}}';

export type ChatHiloProps = {
  mensajes: HiloMsg[];
  header?: ReactNode;
  /** acento del canal (cinta superior + burbuja saliente). Default índigo no-oficial. */
  accent?: string;
  accentBubble?: string;
  /** envía texto; devuelve true si ok. Ausente + readOnly → sin composer. */
  onEnviarTexto?: (texto: string) => Promise<boolean>;
  /** envía media/voz por multipart; tipo 'audio' para nota de voz. */
  onEnviarArchivo?: (blob: Blob, tipo: '' | 'audio', fileName: string, caption?: string) => Promise<boolean>;
  readOnly?: boolean;
  cargando?: boolean;
  vacio?: ReactNode;
  placeholder?: string;
  /** burbuja "escribiendo…" (para previews animadas). lado: quién escribe. */
  typing?: { lado: 'left' | 'right'; autor?: string } | null;
  /** clave de la conversación → borrador POR conversación (no se filtra al saltar). */
  draftKey?: string;
  /** avisa si esta conversación tiene borrador (texto/adjunto/audio) para ordenarla. */
  onDraftChange?: (key: string, hayBorrador: boolean) => void;
  /**
   * Anima la ENTRADA de las burbujas que no estaban en el render anterior (punto 10: el
   * «Probar» no tenía animación). Opt-in: ChatHilo también pinta los grupos REALES de MaKo y
   * el inbox, y ahí animar el historial en cada carga sería ruido.
   */
  animarNuevos?: boolean;
  /**
   * Lo que va pegado ARRIBA de la barra para escribir, adentro del chat: las respuestas
   * rápidas. «Probar» pone ahí las ramas de una condición para que quien prueba elija. Afuera
   * del chat, debajo de la barra, quedaban fuera de la vista en una ventana baja.
   */
  encimaDelComposer?: ReactNode;
  /**
   * Dibuja un mensaje a mano en vez de la burbuja; null = la burbuja de siempre. «Probar» dibuja
   * así un email del flujo como un MAIL (asunto, vista previa, cuerpo), no como un WhatsApp.
   * Opcional: los otros usos del hilo no lo pasan y no cambian.
   */
  renderMensaje?: (m: HiloMsg) => ReactNode | null;
};

// Borradores por conversación (sobreviven el salto entre chats, como el inbox real):
// texto y adjunto quedan atados a SU chat.
// ⚠️ EL AUDIO GRABADO SIN MANDAR YA NO (sexta tanda, WhatsApp 7): se escucha en la barra del composer
//    (la sesión de voz) y el composer se monta POR CONVERSACIÓN (`key`), así que cambiar de chat a mitad
//    de una grabación o de una escucha la descarta. Lo contrario —que viaje y salga en el otro chat, o
//    en el de antes con la pantalla mostrando otro— es justo «el audio que se escapa».
const draftStore = new Map<string, string>();
const adjuntoStore = new Map<string, ItemAdjunto[]>();

export function ChatHilo({
  mensajes, header, accent = 'var(--wa-noof)', accentBubble = 'var(--wa-noof-bubble)',
  onEnviarTexto, onEnviarArchivo, readOnly, cargando, vacio, placeholder, typing, draftKey, onDraftChange, animarNuevos, encimaDelComposer, renderMensaje,
}: ChatHiloProps) {
  const [draft, setDraftState] = useState<string>(() => (draftKey ? draftStore.get(draftKey) ?? '' : ''));
  const lista = useListaAdjuntos(
    { maxBytes: TOPE_ARCHIVO_HILO, maxArchivos: MAX_ADJUNTOS, accept: ACCEPT_HILO },
    () => (draftKey ? adjuntoStore.get(draftKey) ?? [] : []),
  );
  const prevKey = useRef(draftKey);
  // Reporta si el chat tiene ALGO en borrador (texto/adjuntos) → orden en la lista.
  const reportar = (key: string | undefined) => { if (key) onDraftChange?.(key, !!(draftStore.get(key) || adjuntoStore.get(key)?.length)); };
  // El borrador se lleva TAMBIÉN en un ref, y el store se escribe FUERA del
  // updater de estado. React puede invocar un updater dos veces (StrictMode) y
  // `reportar` avisa al PADRE: hacerlo adentro dispara un efecto ajeno durante
  // el render, y encima duplicado.
  const draftRef = useRef(draft);
  const setDraft = (v: string | ((p: string) => string)) => {
    const next = typeof v === 'function' ? (v as (p: string) => string)(draftRef.current) : v;
    draftRef.current = next;
    setDraftState(next);
    if (draftKey) { if (next) draftStore.set(draftKey, next); else draftStore.delete(draftKey); reportar(draftKey); }
  };
  /** Los adjuntos de una conversación al store (fuera de un updater, por lo mismo que el texto). */
  const guardarAdjuntos = (key: string | undefined, l: ItemAdjunto[]) => {
    if (!key) return;
    if (l.length) adjuntoStore.set(key, l); else adjuntoStore.delete(key);
    reportar(key);
  };
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [audioFase, setAudioFase] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ tipo: 'image'; url: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);

  // La entrada animada: se calcula en el render con lo que había en el anterior (el patrón de
  // «ajustar el estado cuando cambia una prop»). Sin `animarNuevos` no se toca nada.
  const idsHilo = mensajes.map((m) => String(m.id));
  const [vistos, setVistos] = useState(() => vistosIniciales(idsHilo));
  const siguientes = animarNuevos ? seguirEntradas(vistos, idsHilo) : vistos;
  if (siguientes !== vistos) setVistos(siguientes);
  const entrando = animarNuevos ? siguientes.entrando : null;

  // Cambió la conversación → cargar SU borrador/adjuntos (no se pierden).
  useEffect(() => {
    if (prevKey.current === draftKey) return;
    prevKey.current = draftKey;
    const suyo = draftKey ? draftStore.get(draftKey) ?? '' : '';
    draftRef.current = suyo; // el ref tiene que seguir al estado o el próximo envío usa el borrador viejo
    setDraftState(suyo);
    lista.poner(draftKey ? adjuntoStore.get(draftKey) ?? [] : []);
    setSendErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sólo al cambiar de conversación
  }, [draftKey]);
  useEffect(() => { const el = scrollRef.current; if (el && stickRef.current) el.scrollTop = el.scrollHeight; }, [mensajes, typing]);
  const onScroll = () => { const el = scrollRef.current; if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150; };

  /** El clip (o el «+» de la vista): suma a la vista previa; lo que no entra dice por qué. */
  function agregarArchivos(fs: File[]) {
    if (!fs.length) return;
    const errores = lista.agregar(fs);
    guardarAdjuntos(draftKey, lista.ref.current);
    setSendErr(errores.length ? errores.join(' ') : null);
  }
  function quitarArchivo(id: string) {
    lista.quitar(id);
    guardarAdjuntos(draftKey, lista.ref.current);
    if (!lista.ref.current.length) setSendErr(null);
  }
  /** La ✕ de la vista (o Escape): descarta los archivos. El texto queda: es el borrador del chat. */
  function cerrarVista() {
    lista.vaciar();
    guardarAdjuntos(draftKey, []);
    setSendErr(null);
  }
  async function enviarTexto() {
    const texto = draftRef.current.trim();
    // `sending` también corta acá: con Enter repetido se disparaban dos envíos
    // y, donde el handler es un turno de IA, las dos respuestas se pisaban.
    if (!onEnviarTexto || !texto || sending) return;
    setSending(true); setSendErr(null); stickRef.current = true;
    // La barra se vacía ANTES de esperar. En el inbox real el handler es un POST
    // de 300 ms y no se nota, pero en el simulador y en el ensayo espera un
    // TURNO ENTERO de IA: el mensaje quedaba duplicado, la burbuja arriba y el
    // mismo texto escrito abajo durante segundos. Si falla se devuelve, salvo
    // que el usuario ya haya escrito otra cosa mientras tanto.
    setDraft('');
    try {
      if (!(await onEnviarTexto(texto))) { setDraft((d) => d || texto); setSendErr('No se pudo enviar el mensaje.'); }
    } catch (e) {
      setDraft((d) => d || texto);
      setSendErr('No se pudo enviar (' + (e instanceof Error ? e.message : 'error de red') + ').');
    } finally { setSending(false); }
  }
  /**
   * Enviar de la vista previa: vuelve al hilo YA (como WhatsApp: lo que sale se ve salir en el hilo, no
   * detrás de la vista) y manda los archivos en orden, el texto como pie del primero. Si uno falla, los
   * que faltan vuelven a la vista con el error; el texto vuelve sólo si no salió con el primero.
   * ⚠️ Si la persona cambió de conversación mientras salían, lo que faltó vuelve al borrador de LA SUYA
   * (el store de esa clave), nunca a la vista de la que está mirando ahora.
   */
  async function enviarAdjuntos() {
    const items = lista.ref.current;
    if (sending || !onEnviarArchivo || !items.length) return;
    const key = draftKey;
    const cap = draftRef.current.trim();
    setSending(true); setSendErr(null); stickRef.current = true;
    lista.vaciar(); guardarAdjuntos(key, []); setDraft('');
    try {
      const r = await enviarEnOrden(items, cap, (it, caption) => onEnviarArchivo(it.file, '', it.file.name, caption));
      if (!r.faltan.length) return;
      if (prevKey.current === key) {
        lista.poner(r.faltan);
        guardarAdjuntos(key, r.faltan);
        if (!r.textoSalio) setDraft((d) => d || cap);
        setSendErr(r.error);
      } else if (key) {
        if (!r.textoSalio && cap && !draftStore.get(key)) draftStore.set(key, cap);
        guardarAdjuntos(key, r.faltan);
      }
    } finally { setSending(false); }
  }
  // El audio ya se ESCUCHÓ en la barra del composer (✓ termina, ➤ manda): lo que llega acá es lo que
  // se pidió mandar. Si el envío falla, se dice: la barra ya se vació, y volver a grabar es lo que hay.
  const enviarAudio = async (grabado: Blob) => {
    if (!onEnviarArchivo || sending) return;
    setSending(true); setSendErr(null); setAudioFase('Procesando audio…'); stickRef.current = true;
    let mp3: Blob;
    try { const { blobToMp3 } = await import('../audio'); mp3 = await blobToMp3(grabado); }
    catch (e) { setSendErr('No se pudo procesar el audio (' + (e instanceof Error ? e.message : 'error') + ').'); setSending(false); setAudioFase(null); return; }
    setAudioFase('Enviando audio…');
    if (!(await onEnviarArchivo(mp3, 'audio', 'nota-de-voz.mp3'))) setSendErr('No se pudo enviar el audio.');
    setSending(false); setAudioFase(null);
  };
  const puedeComponer = !readOnly && (!!onEnviarTexto || !!onEnviarArchivo);
  /** La vista previa tapa el hilo y la barra mientras haya archivos juntados (sin desmontarlos: la barra
   *  guarda la sesión de voz y el hilo su scroll). */
  const hayVista = puedeComponer && !!onEnviarArchivo && lista.items.length > 0;

  return (
    // `data-esquina-ocupada` cuando hay composer: su «Enviar» vive en el rincón de abajo a la
    // derecha, y la esquina de los avisos (EsquinaAvisos) sube para no taparlo.
    <div data-esquina-ocupada={puedeComponer ? '' : undefined} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, borderTop: `3px solid ${accent}`, overflow: 'hidden' }}>
      {header && <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>{header}</div>}
      {entrando && <style>{CSS_ENTRADA}</style>}

      {/* El cuerpo (hilo + barra) en una caja propia: la vista previa se apoya ENCIMA con `inset: 0`, un
          alto definido en todos los motores (un `height: 100%` contra un alto de flex da cero en Safari). */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--surface-2)' }}>
        {cargando && mensajes.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <style>{'@keyframes mako-spin{to{transform:rotate(360deg)}}'}</style>
            <span style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: accent, borderRadius: '50%', display: 'inline-block', animation: 'mako-spin .8s linear infinite' }} />
          </div>
        )}
        {!cargando && mensajes.length === 0 && (vacio ?? <div style={{ margin: 'auto', color: 'var(--faint)', fontSize: 13.5 }}>Sin mensajes.</div>)}
        {mensajes.map((m) => {
          const entra = entrando?.has(String(m.id)) ? 'mk-hilo-entra' : undefined;
          // Una línea de sistema NO es un mensaje de nadie: es lo que pasó en la
          // conversación ("pasaron 3 días", "la secuencia se pausó porque
          // respondió"). Va centrada y sin burbuja a propósito — si se pintara
          // como burbuja, quien mira creería que el negocio le mandó ESO al lead.
          // El TONO se agrega por campo y no por un `tipo` nuevo: cualquier tipo
          // desconocido cae al render de burbuja de acá abajo, y como estas
          // líneas se crean con fromMe:false se pintarían del lado del lead —
          // justo el malentendido que el párrafo de arriba evita.
          if (m.tipo === 'sistema') {
            const t = m.tono === 'ok'
              ? { background: 'var(--good-bg)', border: '1px solid var(--good)', color: 'var(--good)' }
              : m.tono === 'bad'
                ? { background: 'var(--bad-bg)', border: '1px solid var(--bad)', color: 'var(--bad)' }
                : { background: 'var(--surface)', border: '1px dashed var(--border-strong)', color: 'var(--faint)' };
            return (
              <div key={m.id} className={entra} style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ maxWidth: '86%', padding: '6px 13px', borderRadius: 999, ...t, fontSize: 11.5, lineHeight: 1.45, textAlign: 'center', fontWeight: m.tono ? 600 : 400 }}>{m.texto}</div>
              </div>
            );
          }
          const aMano = renderMensaje?.(m);
          if (aMano != null) return <div key={m.id} className={entra}>{aMano}</div>;
          const mine = m.fromMe;
          return (
            <Fragment key={m.id}>
              <div className={entra} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                {/* ⚠️ EL TEXTO SE PINTA CON SUS MARCAS (BurbujaHilo → TextoMarcas): esto dibuja
                    un hilo de WhatsApp, y los `*` crudos se leen como un error de tipeo. Vale
                    para los cuatro usos de este hilo, no sólo para la vista previa de un aviso. */}
                <BurbujaHilo contenido={contenidoDeMensaje(m)} saliente={mine} autor={m.autor ?? undefined}
                  fondo={accentBubble} hora={fmtHora(m.fecha)} pie={mine ? <Ticks status={m.status ?? null} /> : undefined}
                  onVerImagen={(url) => setLightbox({ tipo: 'image', url })} />
              </div>
            </Fragment>
          );
        })}
        {typing && (
          <div className={entrando ? 'mk-hilo-entra' : undefined} style={{ display: 'flex', justifyContent: typing.lado === 'right' ? 'flex-end' : 'flex-start' }}>
            <div style={{ padding: '11px 14px', borderRadius: typing.lado === 'right' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: typing.lado === 'right' ? accentBubble : 'var(--surface)', border: '1px solid ' + (typing.lado === 'right' ? 'rgba(91,107,214,.30)' : 'var(--border)') }}>
              {typing.lado === 'left' && typing.autor && <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--primary-strong)', marginBottom: 3 }}>{typing.autor}</div>}
              <style>{'@keyframes mako-dot{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}'}</style>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 8 }}>
                {[0, 1, 2].map((i) => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--dim)', display: 'inline-block', animation: `mako-dot 1.2s ${i * 0.2}s infinite` }} />)}
              </div>
            </div>
          </div>
        )}
      </div>

      {audioFase && (
        <div style={{ padding: '8px 16px', background: 'var(--surface-2)', color: accent, fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--border)' }}>
          <style>{'@keyframes mako-spin{to{transform:rotate(360deg)}}'}</style>
          <span style={{ width: 13, height: 13, border: `2px solid ${accent}`, borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'mako-spin .8s linear infinite' }} />
          {audioFase} (puede tardar unos segundos)
        </div>
      )}
      {sendErr && <div style={{ padding: '8px 16px', background: 'var(--warn-fill)', color: 'var(--warn)', fontSize: 12.5, borderTop: '1px solid var(--border)' }}>{sendErr}</div>}

      {encimaDelComposer && <div style={{ flex: 'none', padding: '8px 12px 0', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>{encimaDelComposer}</div>}
      {readOnly && <ComposerWhatsApp modo="enviar" soloLectura valor="" onValor={() => {}} placeholder={placeholder} />}
      {/* El composer va POR CONVERSACIÓN (`key`): una grabación o una escucha a medias no viaja al
          chat de al lado (ver la cabecera de los borradores). */}
      {puedeComponer && (
        <ComposerWhatsApp
          key={draftKey ?? 'hilo'}
          modo="enviar"
          valor={draft}
          onValor={setDraft}
          onEnviar={() => void enviarTexto()}
          ocupado={sending}
          placeholder={placeholder}
          onArchivos={onEnviarArchivo ? agregarArchivos : undefined}
          acceptArchivo={ACCEPT_HILO}
          onAudio={onEnviarArchivo ? enviarAudio : undefined}
          onErrorAudio={setSendErr}
        />
      )}

      {hayVista && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', flexDirection: 'column' }}>
          <VistaAdjuntos
            items={lista.items}
            onAgregar={agregarArchivos}
            onQuitar={quitarArchivo}
            onCerrar={cerrarVista}
            texto={draft}
            onTexto={setDraft}
            onEnviar={() => void enviarAdjuntos()}
            accept={ACCEPT_HILO}
            maxArchivos={MAX_ADJUNTOS}
            enviando={sending}
            error={sendErr}
          />
        </div>
      )}
      </div>

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500, padding: 28 }}>
          <button onClick={() => setLightbox(null)} title="Cerrar" aria-label="Cerrar" style={{ position: 'absolute', top: 18, right: 18, width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.14)', color: '#fff', fontSize: 20, cursor: 'pointer' }}>✕</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox.url} alt="adjunto" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '92vw', maxHeight: '88vh', borderRadius: 8, objectFit: 'contain' }} />
        </div>
      )}
    </div>
  );
}
