'use client';

// =============================================================================
// EditorMensajeWhatsApp — UN editor para todo lo que sale por WhatsApp
// =============================================================================
// Pedido de Martín (08/10/2026, punto 8): «El editable del audio también está horrible, todos
// los botones amontonados... Te pedí que todo lo que tenga que ver con WhatsApp tenga un mismo
// editable, ya sea audio, texto, archivos, lo que sea... con la interfaz tipo WhatsApp que ya
// creamos... Que se grabe audio desde el costado, que se pueda adjuntar archivos, emojis etc...»
//
// Tercera tanda (09/10/2026, decisiones 1 y 2): UNA columna siempre (la `fila` se leía rota: la prop
// `disposicion` queda en el tipo SIN EFECTO) y sin «Revisar antes de enviar» (el dato `revisar` lo
// sigue leyendo el motor; `mostrarRevisar` y `revisarHeredado` quedan en el tipo sin efecto).
//
// ── CUARTA TANDA, PUNTO 15: VARIOS MENSAJES POR TARJETA ─────────────────────────────────────────
// Pedido literal: «Debería funcionar el botón de "enviar", justamente es una buena manera de en una
// sola automatización enviar varios mensajes... Por ejemplo, un audio primero y luego un link. Pero en
// este caso, no se debe conservar esos mensajes ya enviados en la barra donde se escriben mensajes,
// porque sino, no puedo enviar otros. Se debería enviar y si lo quiero modificar, debería tener el
// icono del lapiz cada mensaje. También elimina la transcripción de los audios, es innecesario. Luego,
// el botón de basura para eliminar debería ser más notorio... y siempre debe aparecer los 5 segundos
// de deshacer. Y no quiero botones ni nada abajo de donde se escriben mensajes...».
//
//   · ES UN CHAT DE WHATSAPP DE VERDAD: la barra es un BORRADOR (modo `enviar` del composer: Enter y
//     la flecha mandan). «Enviar» suma la burbuja y vacía la barra. Lo que hay en el chat ES el
//     mensaje: la lista de partes (`partes`, lib/mensaje-partes.ts), que sale en orden.
//   · CADA BURBUJA TIENE SU ✏️ (la vuelve a la barra; «Enviar» la devuelve a SU lugar) y una papelera
//     VISIBLE, roja, con «Deshacer» 5 s (el toast de la casa, app/_ui/Toast).
//   · UN ADJUNTO VA COMO EN WHATSAPP: elegirlo lo deja arriba de la barra (el chip) y lo escrito es su
//     pie; «Enviar» lo suma. Una nota de voz grabada se manda con la flecha, como en WhatsApp.
//   · SIN LA TRANSCRIPCIÓN del audio (en la burbuja), y NADA DEBAJO DE LA BARRA: «✦ MaKo» y «{ }»
//     suben a la fila de arriba (al lado del número de salida). ⚠️ «{ }» va arriba hasta que el
//     composer tenga el lugar al lado del clip (ComposerWhatsApp no tiene esa ranura y es de otra
//     parte: está pedido como bloqueante en el reporte de esta parte).
//   · ARRIBA, EL NÚMERO DE SALIDA (`linea`, SalidaWhatsApp.tsx) con «Vincular nuevo». Es el de la
//     AUTOMATIZACIÓN: lo pasa quien monta, y sin la prop no se dibuja.
//
// ⚠️ VARIAS PARTES SÓLO DONDE EL MOTOR LAS MANDA: el WhatsApp NO oficial (es el que lleva audio y
//    archivos, y por eso la condición es `permiteAudio || permiteAdjuntos`). En el oficial sale UNA
//    plantilla y en el recordatorio de la reunión UN texto: ahí el editor es el de siempre (modo
//    `editar`: la barra ES el mensaje).
// ⚠️ LO ESCRITO SIN ENVIAR NO SE PIERDE AL TOCAR OTRA TARJETA: el borrador de la barra vive en un
//    mapa del módulo por tarjeta (como el borrador de un chat). No viaja a la secuencia: lo que se
//    publica es lo que está en el chat.
// ⚠️ NADA DE ACÁ PUBLICA. `onChange` es un cambio LOCAL (sólo «Publicar» publica). Lo único que este
//    editor escribe en el server es la BIBLIOTECA (un audio o un archivo nuevo), que no cambia ninguna
//    secuencia; el número de salida lo guarda quien monta (`linea.onElegir`). Lo fija
//    tests/editor-mensaje-whatsapp.test.ts.
// ⚠️ LO QUE TERMINA DESPUÉS DE UN `await` SE APLICA SÓLO AL MISMO PASO (`mismoPaso`): subir un video
//    tarda, y el lienzo puede reusar este editor para otro nodo.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { AudioSetting, PasoSecuenciaDto } from './ChatAgentApp';
import { BurbujaHilo } from '../whatsapp/_shared/BurbujaHilo';
import { ComposerWhatsApp, PopoverWA, MenuWA, IconVideo, type ComposerHandle, type OpcionMenuWA, type ChipComposer } from '../whatsapp/_shared/ComposerWhatsApp';
import { IconClip, IconDoc, IconMic, IconTrash } from '../whatsapp/_shared/composer-icons';
import { subirConProgreso } from '../customer-success/curso/subir-video';
import { SalidaWhatsApp } from './SalidaWhatsApp';
import { useWs } from '@/app/_ui/Link';
import { Spinner, Toast, useToast } from '@/app/_ui';
import { VARIABLES_LEAD, VARIABLES_NEGOCIO, aplicarVariables } from '@/lib/template-vars';
import { guionVigente, cambiosDePaso } from '@/lib/guion-audio';
import { partesDe, formaGuardada, esUnTexto, TOPE_PARTES, type ParteMensaje } from '@/lib/mensaje-partes';
import {
  ACEPTA_FOTO_VIDEO, ACEPTA_DOCUMENTO, validarArchivoWA, archivoConTipoWA, tituloDeArchivo, pesoLegible,
  tipoEnvioDeMime, type AdjuntoDto,
} from '@/lib/setting-adjuntos-reglas';

export type VariableEditor = { key: string; label: string; ejemplo?: string };

export type EditorMensajeWhatsAppProps = {
  /** El mensaje (un nodo `mensaje` del flujo). */
  paso: PasoSecuenciaDto;
  /** Cambio LOCAL: nunca publica. Publicar es del lienzo (sólo «Publicar» publica). */
  onChange: (patch: Partial<PasoSecuenciaDto>) => void;
  /** La biblioteca de audios del workspace («Audios guardados» del clip). */
  audios: AudioSetting[];
  /** Un audio grabado desde aquí se suma a la biblioteca del padre. */
  onAudioNuevo?: (a: AudioSetting) => void;
  /** Los datos que se pueden insertar como {{key}}. Default: los del motor (lib/template-vars.ts). */
  variables?: VariableEditor[];
  /** El botón ✦ (MaKo lo adapta para cada lead). Sólo texto por el no oficial. */
  permiteIA?: boolean;
  /** Abre la guía de voz la primera vez que se prende la IA. */
  onModoIA?: (on: boolean) => void;
  /** Mic y «Audios guardados». false en el recordatorio y en el oficial. */
  permiteAudio?: boolean;
  /** Clip: fotos, videos, documentos. */
  permiteAdjuntos?: boolean;
  /**
   * SIN EFECTO desde la tercera tanda (09/10/2026, decisión 2): «Revisar antes de enviar» salió de
   * la pantalla. Quedan en el tipo para que quien las pasa siga compilando; el dato `revisar` del
   * paso no se toca (este editor ya no lo escribe).
   */
  mostrarRevisar?: boolean;
  revisarHeredado?: boolean;
  /** Nombre del negocio, para la burbuja de vista previa. */
  negocio?: string;
  placeholder?: string;
  // ── Opcionales (08/10/2026) ──
  /** La biblioteca de ARCHIVOS, si el padre ya la tiene. Sin esto, el editor la pide solo. */
  adjuntos?: AdjuntoDto[];
  /** Un archivo subido desde aquí, para el padre que lleva la biblioteca. */
  onAdjuntoNuevo?: (a: AdjuntoDto) => void;
  /** Lo que MaKo necesita para escribir el guion de la nota de voz («✦ guion»). */
  paraGuion?: { objetivo?: string | null; gancho?: string | null; preguntas?: string[] };
  /** Mientras el lienzo guarda: apaga los botones. */
  deshabilitado?: boolean;
  /** Además de la línea de error del editor. */
  onError?: (m: string) => void;
  /**
   * SIN EFECTO desde la tercera tanda (09/10/2026, decisión 1): el editor es UNA columna siempre,
   * el chat arriba y el composer abajo. La `fila` (chat a un costado, composer al otro) se leía rota.
   */
  disposicion?: 'columna' | 'fila';
  /**
   * EL NÚMERO DE SALIDA (cuarta tanda, punto 15): la línea de la AUTOMATIZACIÓN y su guardado (el
   * mismo del selector del CRON). Sin esto, la fila del número no se dibuja.
   */
  linea?: { actual: string | null; onElegir: (linea: string | null) => void | Promise<void> };
};

/** La ruta del guion: la misma que usa PasoAudioControl (una cosa, un lugar). */
const RUTA_GUION = '/api/chat-agent/onboarding/guion-audio';
/** La ruta corta a los 60 s (`maxDuration`); el navegador espera un poco más y no para siempre. */
const ESPERA_GUION_MS = 65_000;
/** La de audios corta a los 120 s (transcribe al guardar). */
const ESPERA_AUDIO_MS = 125_000;

const fmtDur = (s: number | null | undefined) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}` : '');

/** ¿Es el mismo mensaje? Lo que termina después de un `await` sólo se aplica si sigue siéndolo. */
export const mismoPaso = (a: Pick<PasoSecuenciaDto, 'id' | 'orden'>, b: Pick<PasoSecuenciaDto, 'id' | 'orden'>): boolean =>
  (a.id ?? null) === (b.id ?? null) && a.orden === b.orden;

/**
 * El placeholder dice qué se está escribiendo: no hay rótulos (pedido de Martín, punto 5). `adjunto`
 * es lo que espera arriba de la barra: con un archivo, lo escrito es su pie; con un audio, otro
 * mensaje que sale después (un audio no lleva pie en WhatsApp).
 */
export function placeholderDe(tipo: PasoSecuenciaDto['tipo'], propio?: string, adjunto?: 'audio' | 'media' | null): string {
  if (adjunto === 'media') return 'Agrega un texto (opcional)';
  if (adjunto === 'audio') return 'Texto después del audio';
  if (tipo === 'ia') return 'Qué tiene que lograr';
  return propio ?? 'Escribe un mensaje';
}

/** Un adjunto elegido que todavía no se envió (el chip arriba de la barra). */
type Pendiente = { tipo: 'audio'; audio_id: number } | { tipo: 'media'; media_id: number };

/**
 * Lo que la barra MANDA: el adjunto (con lo escrito como su pie) o el texto. Un audio con texto son
 * DOS partes: WhatsApp no tiene pie de audio, y así le llegan al lead. Pura y exportada para el test.
 */
export function partesDeLaBarra(texto: string, adjunto: Pendiente | null): ParteMensaje[] {
  const t = texto.trim() ? texto : '';
  if (adjunto?.tipo === 'media') return [t ? { tipo: 'media', media_id: adjunto.media_id, cuerpo: t } : { tipo: 'media', media_id: adjunto.media_id }];
  if (adjunto?.tipo === 'audio') return [{ tipo: 'audio', audio_id: adjunto.audio_id }, ...(t ? [{ tipo: 'texto' as const, cuerpo: t }] : [])];
  return t ? [{ tipo: 'texto', cuerpo: t }] : [];
}

/**
 * La lista después de «Enviar»: lo de la barra se suma al final o, si se estaba editando una burbuja,
 * va a SU lugar. Pura y exportada para el test.
 */
export function enviarALista(lista: readonly ParteMensaje[], nuevas: readonly ParteMensaje[], editando: number | null): ParteMensaje[] {
  if (editando != null && editando >= 0 && editando < lista.length) return [...lista.slice(0, editando), ...nuevas, ...lista.slice(editando + 1)];
  return [...lista, ...nuevas];
}

/** El borrador de la barra por tarjeta: tocar otra no lo tira (no viaja a la secuencia). */
const borradores = new Map<string, string>();

// La biblioteca de archivos se pide UNA vez por pestaña y cliente (10 min): el editor se monta
// cada vez que se toca un nodo, y diez nodos no son diez pedidos.
const CACHE_MS = 10 * 60_000;
const cacheBiblioteca = new Map<string, { t: number; lista: AdjuntoDto[] }>();

const chip: CSSProperties = { height: 28, padding: '0 10px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: "'Geist', sans-serif", fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 };
const cajaPopover: CSSProperties = { width: 280, maxHeight: 340, overflowY: 'auto', padding: 10, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12, boxShadow: '0 12px 34px rgba(18,21,27,.18)', fontFamily: "'Geist', sans-serif", display: 'flex', flexDirection: 'column', gap: 8 };
const accionBurbuja: CSSProperties = { width: 28, height: 28, flex: 'none', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 };

function IconLapiz() {
  return <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" /><path d="M13.5 6.5l4 4" stroke="currentColor" strokeWidth={1.8} /></svg>;
}

/**
 * El alto mínimo del chat: una burbuja de dos renglones y su aire. En un panel de alto fijo el chat
 * se queda con TODO lo que sobra (flex), y por debajo de esto el panel scrollea antes de aplastarlo.
 */
export const ALTO_MIN_CHAT = 110;

export function EditorMensajeWhatsApp({
  paso, onChange, audios, onAudioNuevo, variables, permiteIA, onModoIA, permiteAudio = true, permiteAdjuntos = true,
  negocio, placeholder, adjuntos, onAdjuntoNuevo, paraGuion, deshabilitado, onError, linea,
}: EditorMensajeWhatsAppProps) {
  const ws = useWs();
  // ¿Varias partes? Sólo por el no oficial (ver la cabecera): el oficial y el recordatorio mandan uno.
  const varias = permiteAudio || permiteAdjuntos;
  const clavePaso = `${paso.id ?? ''}|${paso.orden}`;
  const claveBorrador = `${ws ?? ''}|${clavePaso}`;
  const [barra, setBarra] = useState(() => borradores.get(claveBorrador) ?? '');
  const [adjunto, setAdjunto] = useState<Pendiente | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const [grabado, setGrabado] = useState<{ blob: Blob; secs: number } | null>(null);
  const [fase, setFase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guionIA, setGuionIA] = useState<{ texto: string; de: string } | null>(null);
  const [pidiendo, setPidiendo] = useState(false);
  const [subida, setSubida] = useState<{ nombre: string; pct: number; cancelar: () => void } | null>(null);
  const [bibLocal, setBibLocal] = useState<AdjuntoDto[] | null>(() => cacheBiblioteca.get(String(ws ?? ''))?.lista ?? null);
  const [audiosAca, setAudiosAca] = useState<AudioSetting[]>([]);
  const [abierto, setAbierto] = useState<'datos' | 'variantes' | null>(null);
  const [btnDatos, setBtnDatos] = useState<HTMLButtonElement | null>(null);
  const [btnVariantes, setBtnVariantes] = useState<HTMLButtonElement | null>(null);
  const { toast, show, clear } = useToast();
  const composer = useRef<ComposerHandle>(null);
  const inputFoto = useRef<HTMLInputElement>(null);
  const inputDoc = useRef<HTMLInputElement>(null);
  const pasoVivo = useRef(paso);
  useEffect(() => { pasoVivo.current = paso; }, [paso]);
  const cancelarSubida = useRef<(() => void) | null>(null);
  useEffect(() => () => { cancelarSubida.current?.(); }, []);

  // El lienzo puede reusar este editor para otro nodo: lo que era del anterior (el audio sin usar,
  // el guion de MaKo, el error, la barra) no se queda dibujado en éste.
  const [claveVista, setClaveVista] = useState(clavePaso);
  if (claveVista !== clavePaso) {
    setClaveVista(clavePaso);
    setGrabado(null); setGuionIA(null); setError(null); setAbierto(null); setAdjunto(null); setEditando(null);
    setBarra(borradores.get(claveBorrador) ?? '');
  }

  const urlGrabado = useMemo(() => (grabado ? URL.createObjectURL(grabado.blob) : null), [grabado]);
  useEffect(() => () => { if (urlGrabado) URL.revokeObjectURL(urlGrabado); }, [urlGrabado]);

  const biblioteca = adjuntos ?? bibLocal;
  useEffect(() => {
    if (adjuntos || !permiteAdjuntos) return;
    const clave = String(ws ?? '');
    const c = cacheBiblioteca.get(clave);
    if (c && Date.now() - c.t < CACHE_MS) return;
    let vivo = true;
    fetch('/api/chat-agent/adjuntos', { cache: 'no-store', signal: AbortSignal.timeout(30_000) })
      .then((r) => r.json())
      .then((j: { ok?: boolean; adjuntos?: AdjuntoDto[] }) => {
        const lista = j?.ok && Array.isArray(j.adjuntos) ? j.adjuntos : [];
        if (j?.ok) cacheBiblioteca.set(clave, { t: Date.now(), lista });
        if (vivo) setBibLocal(lista);
      })
      .catch(() => { if (vivo) setBibLocal((b) => b ?? []); });
    return () => { vivo = false; };
  }, [adjuntos, permiteAdjuntos, ws]);

  const avisar = (m: string) => { setError(m); onError?.(m); };
  const escribir = (v: string) => {
    setBarra(v);
    if (v) borradores.set(claveBorrador, v); else borradores.delete(claveBorrador);
  };
  const limpiarBarra = () => { escribir(''); setAdjunto(null); setEditando(null); };

  const todosLosAudios = useMemo(() => {
    const vistos = new Set(audios.map((a) => a.id));
    return [...audiosAca.filter((a) => !vistos.has(a.id)), ...audios];
  }, [audios, audiosAca]);
  const audioDe = (id: number) => todosLosAudios.find((a) => a.id === id) ?? null;
  const archivoDe = (id: number) => (biblioteca ?? []).find((a) => a.id === id) ?? null;

  // ── EL MENSAJE ES LA LISTA DE PARTES ──────────────────────────────────────────────────────────
  // Varias: `partesDe` (lo de antes se lee como sus partes, sin migrar). Una (oficial, recordatorio):
  // el texto, que se edita en la barra misma.
  const partes = varias ? partesDe(paso) : [];
  const esIA = paso.tipo === 'ia';

  /**
   * Le pasa al lienzo la lista nueva en su forma GUARDADA (`formaGuardada`): una parte en los campos
   * de siempre y `partes: []` (que dice «una sola, lo sé»), varias en `partes`. Las variantes («↻ N»)
   * son de UN texto: con cualquier otra cosa se sueltan EXPLÍCITAS (`[]`), que es lo que le dice al
   * server «ya no tiene» (hallazgos-chatbot.md, «Un mensaje que pasa a archivo o a voz suelta sus
   * variantes»).
   */
  const aplicarPartes = (lista: readonly ParteMensaje[]) => {
    const antes = pasoVivo.current;
    const f = formaGuardada(lista, antes.tipo === 'ia');
    const despues: PasoSecuenciaDto = {
      ...antes, tipo: f.tipo, cuerpo: f.cuerpo, audio_id: f.audio_id, media_id: f.media_id, partes: f.partes,
      ...(esUnTexto(lista) ? {} : { variantes: [] }),
    };
    onChange(cambiosDePaso(antes, despues));
  };

  /** «Enviar»: lo de la barra se suma (o vuelve a su lugar, si se editaba) y la barra se vacía. */
  const enviar = () => {
    const nuevas = partesDeLaBarra(barra, adjunto);
    if (!nuevas.length) return;
    const lista = partesDe(pasoVivo.current);
    // «MaKo lo adapta» reescribe UN texto: una segunda parte lo apagaría sin decirlo.
    if (pasoVivo.current.tipo === 'ia' && editando == null && lista.length >= 1) { avisar('Con ✦ MaKo va un solo mensaje'); return; }
    const sig = enviarALista(lista, nuevas, editando);
    if (sig.length > TOPE_PARTES) { avisar(`Hasta ${TOPE_PARTES} mensajes`); return; }
    setError(null);
    aplicarPartes(sig);
    limpiarBarra();
  };

  /** ✏️: la burbuja vuelve a la barra. Lo escrito sin enviar no se pisa. */
  const editar = (i: number) => {
    const p = partes[i];
    if (!p) return;
    if ((barra.trim() || adjunto) && editando !== i) { avisar('Primero envía lo escrito'); return; }
    setError(null);
    setEditando(i);
    if (p.tipo === 'texto') { setAdjunto(null); escribir(p.cuerpo); }
    else if (p.tipo === 'media') { setAdjunto({ tipo: 'media', media_id: p.media_id }); escribir(p.cuerpo ?? ''); }
    else { setAdjunto({ tipo: 'audio', audio_id: p.audio_id }); escribir(''); }
    composer.current?.enfocar();
  };

  /** 🗑: se va en el acto, con «Deshacer» 5 s. */
  const borrar = (i: number) => {
    const antes = partesDe(pasoVivo.current);
    if (!antes[i]) return;
    const deQuien = pasoVivo.current;
    aplicarPartes(antes.filter((_, j) => j !== i));
    if (editando === i) limpiarBarra();
    else if (editando != null && editando > i) setEditando(editando - 1);
    show('Mensaje borrado', () => { if (mismoPaso(pasoVivo.current, deQuien)) aplicarPartes(antes); });
  };

  // ── El audio: grabar al costado, escuchar, mandarlo con la flecha ─────────────────────────────
  async function usarAudio() {
    const g = grabado;
    if (!g || fase) return;
    const deQuien = pasoVivo.current;
    setError(null);
    try {
      setFase('Convirtiendo…');
      const { blobToMp3 } = await import('../whatsapp/audio');
      const mp3 = await blobToMp3(g.blob);
      const buf = new Uint8Array(await mp3.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192));
      setFase('Guardando…');
      const r = await fetch('/api/chat-agent/audios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: `Mensaje ${deQuien.orden}`, base64: btoa(bin), mime: 'audio/mpeg', duracionS: g.secs }),
        signal: AbortSignal.timeout(ESPERA_AUDIO_MS),
      });
      const j = await r.json().catch(() => null) as { ok?: boolean; audio?: AudioSetting; error?: string } | null;
      if (!j?.ok || !j.audio) { avisar(j?.error || 'No se pudo guardar el audio.'); return; }
      const audio = j.audio;
      setAudiosAca((xs) => [audio, ...xs]);
      onAudioNuevo?.(audio);
      setGrabado(null);
      if (!mismoPaso(pasoVivo.current, deQuien)) return;
      // Como en WhatsApp: la nota de voz grabada SALE con la flecha (se suma al chat). Si se estaba
      // editando una burbuja, la reemplaza; lo escrito en la barra se queda para lo que siga.
      const nueva: ParteMensaje = { tipo: 'audio', audio_id: audio.id };
      const sig = enviarALista(partesDe(pasoVivo.current), [nueva], editando);
      if (sig.length > TOPE_PARTES) { avisar(`Hasta ${TOPE_PARTES} mensajes`); return; }
      aplicarPartes(sig);
      if (editando != null) limpiarBarra();
    } catch (e) {
      avisar(e instanceof Error && e.name === 'TimeoutError' ? 'Tardó demasiado. Prueba de nuevo.' : 'No se pudo procesar el audio.');
    } finally { setFase(null); }
  }

  // Lo que se lee mientras se graba: lo escrito en la barra (o el texto del mensaje), o el guion de
  // MaKo si salió de ESE texto (`guionVigente`: si el texto cambió, el de MaKo ya no es de éste).
  const textosDelChat = partes.flatMap((p) => (p.tipo === 'texto' ? [p.cuerpo] : [])).join('\n\n');
  const base = (barra.trim() || textosDelChat || (!varias ? paso.cuerpo ?? '' : '')).trim();
  const deMaKo = guionVigente(guionIA, base);
  const paraLeer = deMaKo ?? base;
  const puedeGuion = !!(base || paraGuion?.objetivo || paraGuion?.gancho);

  async function pedirGuion() {
    if (pidiendo) return;
    setPidiendo(true);
    const de = base;
    try {
      const r = await fetch(RUTA_GUION, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paso: {
          texto: base, pie: '',
          objetivo: paraGuion?.objetivo ?? '',
          gancho: paraGuion?.gancho ?? '',
          preguntas: paraGuion?.preguntas ?? [],
        } }),
        signal: AbortSignal.timeout(ESPERA_GUION_MS),
      });
      const j = await r.json().catch(() => null) as { ok?: boolean; guion?: string; error?: string } | null;
      if (!j?.ok || !j.guion) { avisar(j?.error || 'MaKo no pudo escribir el guion.'); return; }
      setGuionIA({ texto: j.guion, de });
    } catch (e) {
      avisar(e instanceof Error && e.name === 'TimeoutError' ? 'MaKo tardó demasiado. Prueba de nuevo.' : 'Sin conexión. Prueba de nuevo.');
    } finally { setPidiendo(false); }
  }

  const mientrasGraba: ReactNode = (paraLeer || puedeGuion) ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '9px 11px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      {paraLeer && <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.55, whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto' }}>{paraLeer}</div>}
      {puedeGuion && (
        <button type="button" onClick={() => void pedirGuion()} disabled={pidiendo} title="MaKo escribe qué decir"
          style={{ ...chip, alignSelf: 'flex-start', color: 'var(--mako-ink)' }}>
          {pidiendo ? <><Spinner size={12} /> Escribiendo…</> : '✦ guion'}
        </button>
      )}
    </div>
  ) : null;

  // ── El archivo: subir directo al bucket y registrarlo; queda arriba de la barra ──────────────
  async function subirArchivo(f: File) {
    setError(null);
    const v = validarArchivoWA({ nombre: f.name, tipo: f.type, tamano: f.size });
    if (!v.ok) { avisar(v.error); return; }
    const deQuien = pasoVivo.current;
    const post = async (body: object) => {
      const r = await fetch('/api/chat-agent/adjuntos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(65_000) });
      return r.json().catch(() => null) as Promise<{ ok?: boolean; error?: string; path?: string; signedUrl?: string; apikey?: string | null; adjunto?: AdjuntoDto } | null>;
    };
    try {
      const firma = await post({ action: 'subir', nombre: f.name, mime: v.mime, tamano: f.size });
      if (!firma?.ok || !firma.signedUrl || !firma.path) { avisar(firma?.error || 'No se pudo preparar la subida.'); return; }
      const s = subirConProgreso(firma.signedUrl, archivoConTipoWA(f, v.mime), firma.apikey ?? null,
        (pct) => setSubida((x) => (x ? { ...x, pct } : x)), 'JPG, PNG, MP4, PDF u Office');
      cancelarSubida.current = s.cancelar;
      setSubida({ nombre: f.name, pct: 0, cancelar: s.cancelar });
      await s.promesa;
      const reg = await post({ action: 'registrar', path: firma.path, nombre: f.name, titulo: tituloDeArchivo(f.name) });
      if (!reg?.ok || !reg.adjunto) { avisar(reg?.error || 'No se pudo guardar el archivo.'); return; }
      const adj = reg.adjunto;
      const clave = String(ws ?? '');
      const lista = [adj, ...(biblioteca ?? []).filter((a) => a.id !== adj.id)];
      cacheBiblioteca.set(clave, { t: Date.now(), lista });
      setBibLocal(lista);
      onAdjuntoNuevo?.(adj);
      // Queda ARRIBA de la barra, como en WhatsApp: lo escrito es su pie y «Enviar» lo suma.
      if (mismoPaso(pasoVivo.current, deQuien)) setAdjunto({ tipo: 'media', media_id: adj.id });
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo subir el archivo.');
    } finally {
      cancelarSubida.current = null;
      setSubida(null);
    }
  }

  // ── El chip arriba del campo: lo que se sube, o el adjunto que espera «Enviar» ────────────────
  let chipActual: ChipComposer | null = null;
  if (subida) {
    chipActual = { icono: 'doc', titulo: subida.nombre, detalle: `Subiendo ${subida.pct}%`, onQuitar: subida.cancelar, tituloQuitar: 'Cancelar subida' };
  } else if (adjunto?.tipo === 'audio') {
    const a = audioDe(adjunto.audio_id);
    chipActual = { icono: 'audio', titulo: a?.titulo ?? 'Nota de voz', detalle: fmtDur(a?.duracion_s), onQuitar: () => setAdjunto(null), tituloQuitar: 'Quitar audio' };
  } else if (adjunto?.tipo === 'media') {
    const adj = archivoDe(adjunto.media_id);
    const t = tipoEnvioDeMime(adj?.media_mime);
    chipActual = {
      imagen: t === 'image' ? adj?.url ?? null : null,
      icono: t === 'video' ? 'video' : 'doc',
      titulo: adj?.titulo ?? (biblioteca === null ? 'Cargando…' : 'Archivo'),
      detalle: pesoLegible(adj?.tamano),
      onQuitar: () => setAdjunto(null), tituloQuitar: 'Quitar archivo',
    };
  }

  // ── El clip ──────────────────────────────────────────────────────────────────────────────
  const menuClip: OpcionMenuWA[] = [];
  if (permiteAdjuntos) {
    menuClip.push({ key: 'foto', label: 'Foto o video', icono: <IconVideo size={18} />, onElegir: () => inputFoto.current?.click() });
    menuClip.push({ key: 'doc', label: 'Documento', icono: <IconDoc size={18} />, onElegir: () => inputDoc.current?.click() });
  }
  if (permiteAudio) {
    menuClip.push({
      key: 'audios', label: 'Audios guardados', icono: <IconMic />, vacio: 'Sin audios todavía.',
      submenu: todosLosAudios.map((a) => ({ key: `a${a.id}`, label: a.titulo, detalle: fmtDur(a.duracion_s), onElegir: () => setAdjunto({ tipo: 'audio', audio_id: a.id }) })),
    });
  }
  if (permiteAdjuntos) {
    menuClip.push({
      key: 'archivos', label: 'Archivos guardados', icono: <IconClip />, vacio: biblioteca === null ? 'Cargando…' : 'Sin archivos todavía.',
      submenu: (biblioteca ?? []).map((a) => ({ key: `f${a.id}`, label: a.titulo, detalle: pesoLegible(a.tamano), onElegir: () => setAdjunto({ tipo: 'media', media_id: a.id }) })),
    });
  }

  // ── Las burbujas como llegan ─────────────────────────────────────────────────────────────
  // `{{negocio}}` se resuelve con la MISMA función que el motor (`aplicarVariables`): si la pantalla
  // resolviera un token que el envío no conoce, al lead le llegaría con las llaves puestas y el
  // editor mostrándolo perfecto (tests/paso-variables-editor.test.ts).
  const conNegocio = (t: string) => aplicarVariables(t, negocio?.trim() ? { negocio: negocio.trim() } : {});
  const sinEscribir = <span style={{ color: 'var(--faint)', fontSize: 13 }}>Sin escribir</span>;
  const burbujaDe = (p: ParteMensaje): ReactNode => {
    if (p.tipo === 'audio') {
      const a = audioDe(p.audio_id);
      // Sin la transcripción (punto 15: «elimina la transcripción de los audios, es innecesario»).
      return <BurbujaHilo contenido={{ audio: a ? { url: a.url, titulo: a.titulo, transcript: null, duracion_s: a.duracion_s } : { url: null, titulo: 'audio' } }} />;
    }
    if (p.tipo === 'media') {
      const adj = archivoDe(p.media_id);
      const t = tipoEnvioDeMime(adj?.media_mime);
      return (
        <BurbujaHilo contenido={{
          media: adj
            ? { url: adj.url, mime: adj.media_mime, nombre: t === 'document' ? (adj.nombre_archivo ?? adj.titulo) : null }
            : { url: null, mime: '', nombre: biblioteca === null ? 'Cargando' : 'archivo' },
          texto: conNegocio(p.cuerpo ?? ''),
        }} />
      );
    }
    return <BurbujaHilo contenido={{ texto: conNegocio(p.cuerpo), ia: esIA }} />;
  };

  const vars = variables ?? [...VARIABLES_LEAD, ...VARIABLES_NEGOCIO].map((v) => ({ key: v.key, label: v.label, ejemplo: v.ejemplo }));
  // «↻ N» sólo en UN mensaje de texto: las variantes son otras formas de decir ESE texto (costuras-1).
  const unTexto = varias ? esUnTexto(partes) : (!paso.tipo || paso.tipo === 'texto' || paso.tipo === 'ia');
  const variantes = unTexto ? (paso.variantes ?? []) : [];
  const ocupado = !!deshabilitado || !!fase || !!subida;
  // ✦ MaKo: con UN texto (o nada todavía). Con varias partes no hay un texto que reescribir.
  const iaPosible = !!permiteIA && (!varias || partes.length === 0 || unTexto);

  const vista: ReactNode = varias ? (
    partes.length ? partes.map((p, i) => (
      <div key={i} data-parte={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, alignSelf: 'stretch', minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 4, flex: 'none' }}>
          {unTexto && variantes.length > 0 && (
            <button type="button" ref={setBtnVariantes} disabled={ocupado} title="Otras formas de decirlo" aria-expanded={abierto === 'variantes'}
              onClick={() => setAbierto((a) => (a === 'variantes' ? null : 'variantes'))} style={{ ...chip, height: 28 }}>↻ {variantes.length}</button>
          )}
          <button type="button" disabled={ocupado} onClick={() => editar(i)} title="Editar" aria-label={`Editar el mensaje ${i + 1}`}
            style={{ ...accionBurbuja, ...(editando === i ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : {}) }}><IconLapiz /></button>
          <button type="button" disabled={ocupado} onClick={() => borrar(i)} title="Borrar" aria-label={`Borrar el mensaje ${i + 1}`}
            style={{ ...accionBurbuja, color: 'var(--bad)', borderColor: 'var(--bad)' }}><IconTrash /></button>
        </div>
        <div style={{ minWidth: 0, display: 'flex', justifyContent: 'flex-end', borderRadius: 16, outline: editando === i ? '2px solid var(--primary)' : 'none', outlineOffset: 2 }}>
          {burbujaDe(p)}
        </div>
      </div>
    )) : sinEscribir
  ) : (
    <BurbujaHilo contenido={{ texto: conNegocio(paso.cuerpo ?? ''), ia: esIA }} vacio={sinEscribir} />
  );

  const faseNodo = fase ? (
    <div style={{ flex: 'none', padding: '7px 12px', borderTop: '1px solid var(--border)', fontSize: 12.5, color: 'var(--dim)', display: 'flex', alignItems: 'center', gap: 7 }}>
      <Spinner size={12} /> {fase}
    </div>
  ) : null;
  const editandoNodo = varias && editando != null ? (
    <div style={{ flex: 'none', padding: '6px 12px', borderTop: '1px solid var(--border)', fontSize: 12.5, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 7 }}>
      <IconLapiz /> <span style={{ flex: 1 }}>Editando</span>
      <button type="button" onClick={limpiarBarra} aria-label="Cancelar edición" title="Cancelar"
        style={{ background: 'none', border: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>
    </div>
  ) : null;
  const errorNodo = error ? <div role="alert" style={{ flex: 'none', padding: '6px 12px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--bad)' }}>{error}</div> : null;
  const composerNodo = varias ? (
    <ComposerWhatsApp
      ref={composer}
      modo="enviar"
      valor={barra}
      onValor={escribir}
      onEnviar={enviar}
      placeholder={placeholderDe(paso.tipo, placeholder, adjunto?.tipo ?? null)}
      ocupado={ocupado}
      menuClip={menuClip.length ? menuClip : undefined}
      onAudio={permiteAudio ? (blob, secs) => { setError(null); setGrabado({ blob, secs }); } : undefined}
      onErrorAudio={avisar}
      mientrasGraba={mientrasGraba}
      audioPendiente={grabado ? { url: urlGrabado, onDescartar: () => setGrabado(null), onUsar: () => void usarAudio() } : null}
      chip={chipActual}
      maxAlto={168}
    />
  ) : (
    <ComposerWhatsApp
      ref={composer}
      modo="editar"
      valor={paso.cuerpo ?? ''}
      onValor={(v) => onChange({ cuerpo: v })}
      placeholder={placeholderDe(paso.tipo, placeholder)}
      ocupado={ocupado}
    />
  );

  // LA FILA DE ARRIBA: el número de salida, y a la derecha «{ }» y «✦ MaKo». Arriba y no abajo:
  // «no quiero botones ni nada abajo de donde se escriben mensajes».
  const arriba = (
    <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, minWidth: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {linea && varias && <SalidaWhatsApp actual={linea.actual} onElegir={linea.onElegir} deshabilitado={ocupado} />}
      </div>
      <button type="button" ref={setBtnDatos} disabled={ocupado} title="Insertar un dato" aria-label="Insertar un dato" aria-expanded={abierto === 'datos'}
        onClick={() => setAbierto((a) => (a === 'datos' ? null : 'datos'))} style={{ ...chip, fontFamily: "'Geist Mono', monospace" }}>{'{ }'}</button>
      {iaPosible && (
        <button type="button" disabled={ocupado} aria-pressed={esIA} title="MaKo lo adapta para cada persona"
          onClick={() => { const on = !esIA; onChange({ tipo: on ? 'ia' : 'texto' }); onModoIA?.(on); }}
          style={{ ...chip, ...(esIA ? { background: 'var(--mako-bg)', borderColor: 'var(--mako-border)', color: 'var(--mako-ink)' } : {}) }}>
          ✦ MaKo
        </button>
      )}
      {!varias && variantes.length > 0 && (
        <button type="button" ref={setBtnVariantes} disabled={ocupado} title="Otras formas de decirlo" aria-expanded={abierto === 'variantes'}
          onClick={() => setAbierto((a) => (a === 'variantes' ? null : 'variantes'))} style={chip}>↻ {variantes.length}</button>
      )}
    </div>
  );

  // ── UNA columna, como un teléfono: arriba la fila, el chat (llena y scrollea), la barra abajo ──
  // El alto lo pone quien monta (el panel de /chatbot): el CHAT se queda con lo que sobra y es lo
  // único que se achica (hasta `ALTO_MIN_CHAT`); la barra no se achica nunca. Todo estira con flex y
  // `minHeight: 0`, nunca con `height: 100%` (AGENTS.md: contra un alto indefinido, Safari da cero).
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, minWidth: 0 }}>
      {arriba}
      <div data-chat style={{ flex: '1 1 auto', minHeight: ALTO_MIN_CHAT, padding: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderBottom: 'none', borderRadius: '14px 14px 0 0', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* `marginTop: auto` y no `justify-content: flex-end`: con flex-end y scroll, lo que desborda
            por ARRIBA no se puede alcanzar. Así las burbujas quedan abajo, como en un chat. */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {vista}
        </div>
      </div>
      <div data-barra style={{ flex: 'none', border: '1px solid var(--border)', borderRadius: '0 0 14px 14px', overflow: 'hidden', background: 'var(--surface)' }}>
        {faseNodo}
        {editandoNodo}
        {errorNodo}
        {composerNodo}
      </div>

      <input ref={inputFoto} type="file" accept={ACEPTA_FOTO_VIDEO} style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ''; if (f) void subirArchivo(f); }} />
      <input ref={inputDoc} type="file" accept={ACEPTA_DOCUMENTO} style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ''; if (f) void subirArchivo(f); }} />

      {abierto === 'datos' && (
        <PopoverWA ancla={btnDatos} etiqueta="Datos" onCerrar={() => setAbierto(null)}>
          <MenuWA alElegir={() => setAbierto(null)}
            opciones={vars.map((v) => ({ key: v.key, label: v.label, detalle: `{{${v.key}}}`, onElegir: () => composer.current?.insertar(`{{${v.key}}}`, { enfocar: true }) }))} />
        </PopoverWA>
      )}
      {abierto === 'variantes' && (
        <PopoverWA ancla={btnVariantes} etiqueta="Otras formas de decirlo" onCerrar={() => setAbierto(null)}>
          <div style={cajaPopover}>
            {variantes.map((v, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <textarea value={v} rows={3} aria-label={`Versión ${i + 2}`}
                  onChange={(e) => onChange({ variantes: variantes.map((x, j) => (j === i ? e.target.value : x)) })}
                  style={{ flex: 1, minWidth: 0, padding: '7px 9px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: 13, lineHeight: 1.45, resize: 'vertical', outline: 'none' }} />
                <button type="button" title="Quitar esta versión" aria-label="Quitar esta versión"
                  onClick={() => { const resto = variantes.filter((_, j) => j !== i); onChange({ variantes: resto }); if (!resto.length) setAbierto(null); }}
                  style={{ background: 'none', border: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 13, padding: '5px 2px' }}>✕</button>
              </div>
            ))}
          </div>
        </PopoverWA>
      )}
      <Toast state={toast} onClose={clear} />
    </div>
  );
}
