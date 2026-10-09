'use client';

// =============================================================================
// EditorMensajeWhatsApp — UN editor para todo lo que sale por WhatsApp
// =============================================================================
// Pedido de Martín (08/10/2026, punto 8): «El editable del audio también está horrible, todos
// los botones amontonados... Te pedí que todo lo que tenga que ver con WhatsApp tenga un mismo
// editable, ya sea audio, texto, archivos, lo que sea... con la interfaz tipo WhatsApp que ya
// creamos... Que se grabe audio desde el costado, que se pueda adjuntar archivos, emojis etc...
// Copialo tal cual... Obvio que hay que agregarle tal vez otras funciones, pero haz bien el
// diseño.»
//
// Es un chat de WhatsApp de un solo mensaje, como un TELÉFONO: ARRIBA la burbuja como llega
// (`BurbujaHilo`: el texto; el audio y su pie como segunda burbuja; el archivo con su caption), en
// un chat que llena el alto que haya y scrollea, y ABAJO la barra de siempre (`ComposerWhatsApp` en
// modo `editar`). Debajo, una fila mínima: ✦ (MaKo lo adapta), { } (datos) y «↻ N» (otras formas
// de decirlo).
//
// Tercera tanda (09/10/2026, decisiones 1 y 2 de docs/chatbot-flujo-ramas-diseno.md):
//   · UNA columna, siempre. La segunda tanda había partido el editor en dos para el panel apaisado
//     (`disposicion="fila"`: el chat a un costado y el composer al otro) y Martín lo vio así en
//     producción: «está bugeado, la barra donde se escribe o se graba audio al costado y el chat al
//     otro costado». La fila se fue; la prop `disposicion` queda en el tipo SIN EFECTO para que el
//     lienzo que la pasa siga compilando.
//   · «Revisar antes de enviar» sale de la pantalla («¿Qué es "Revisar antes de enviar"?, eso no
//     tiene mucho sentido»). El dato `revisar` de cada paso queda tal cual (lo sigue leyendo el
//     motor); `mostrarRevisar` y `revisarHeredado` quedan en el tipo sin efecto, por lo mismo.
//
// Cómo mapea al paso, sin campos nuevos más que `media_id`:
//   · `cuerpo` es lo que se escribe en la barra: el texto, la base de MaKo, el PIE del audio o el
//     caption del archivo. Por eso no hay rótulos: el placeholder dice cuál de los cuatro es.
//   · el mic graba al costado; al soltar, el audio queda para escucharlo, con papelera y «Usar».
//     «Usar» lo sube a la biblioteca (/api/chat-agent/audios) y el paso pasa a voz con
//     `pasoAVoz` (el texto se vuelve el guion para leer, nada se pierde).
//   · el clip: «Foto o video», «Documento», «Audios guardados», «Archivos guardados». Un archivo
//     es `tipo: 'media'` + `media_id` (lib/setting-adjuntos.ts), subido directo al bucket con una
//     URL firmada.
//   · la ✕ del chip del audio o del archivo vuelve a texto sin perder lo escrito (`pasoSinAdjunto`).
//
// ⚠️ NADA DE ACÁ PUBLICA. `onChange` es un cambio LOCAL: lo guarda el lienzo con «Publicar»
//    (punto del contrato: sólo «Publicar» publica). Antes, elegir o grabar un audio llamaba a
//    `setAudioDePaso`, que hacía PATCH de TODOS los pasos locales en el acto — incluidos textos
//    editados y pasos borrados sin publicar — y no apilaba deshacer. Lo único que este editor
//    escribe en el server es la BIBLIOTECA (un audio o un archivo nuevo), que no cambia ninguna
//    secuencia. Lo fija tests/editor-mensaje-whatsapp.test.ts.
// ⚠️ LO QUE TERMINA DESPUÉS DE UN `await` SE APLICA SÓLO AL MISMO PASO. Subir un video tarda; si
//    en el medio se abre otro nodo y el lienzo reusa este editor, el archivo NO se le pone al otro
//    mensaje: queda en la biblioteca y nada más (`mismoPaso`).

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { AudioSetting, PasoSecuenciaDto } from './ChatAgentApp';
import { BurbujaHilo } from '../whatsapp/_shared/BurbujaHilo';
import { ComposerWhatsApp, PopoverWA, MenuWA, IconVideo, type ComposerHandle, type OpcionMenuWA, type ChipComposer } from '../whatsapp/_shared/ComposerWhatsApp';
import { IconClip, IconDoc, IconMic } from '../whatsapp/_shared/composer-icons';
import { subirConProgreso } from '../customer-success/curso/subir-video';
import { useWs } from '@/app/_ui/Link';
import { Spinner } from '@/app/_ui';
import { VARIABLES_LEAD, VARIABLES_NEGOCIO, aplicarVariables } from '@/lib/template-vars';
import { guionVigente, guionParaLeer, pasoAMedia, pasoSinAdjunto, pasoAVozDesde, cambiosDePaso } from '@/lib/guion-audio';
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

/** El placeholder dice qué se está escribiendo: no hay rótulos (pedido de Martín, punto 5). */
export function placeholderDe(tipo: PasoSecuenciaDto['tipo'], propio?: string): string {
  if (tipo === 'audio') return 'Texto junto al audio';
  if (tipo === 'media') return 'Agrega un texto (opcional)';
  if (tipo === 'ia') return 'Qué tiene que lograr';
  return propio ?? 'Escribe el mensaje';
}

// La biblioteca de archivos se pide UNA vez por pestaña y cliente (10 min): el editor se monta
// cada vez que se toca un nodo, y diez nodos no son diez pedidos.
const CACHE_MS = 10 * 60_000;
const cacheBiblioteca = new Map<string, { t: number; lista: AdjuntoDto[] }>();

const chip: CSSProperties = { height: 28, padding: '0 10px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: "'Geist', sans-serif", fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 };
const cajaPopover: CSSProperties = { width: 280, maxHeight: 340, overflowY: 'auto', padding: 10, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12, boxShadow: '0 12px 34px rgba(18,21,27,.18)', fontFamily: "'Geist', sans-serif", display: 'flex', flexDirection: 'column', gap: 8 };

/**
 * El alto mínimo del chat: una burbuja de dos renglones y su aire. En un panel de alto fijo el chat
 * se queda con TODO lo que sobra (flex), y por debajo de esto el panel scrollea antes de aplastarlo.
 */
export const ALTO_MIN_CHAT = 110;

export function EditorMensajeWhatsApp({
  paso, onChange, audios, onAudioNuevo, variables, permiteIA, onModoIA, permiteAudio = true, permiteAdjuntos = true,
  negocio, placeholder, adjuntos, onAdjuntoNuevo, paraGuion, deshabilitado, onError,
}: EditorMensajeWhatsAppProps) {
  const ws = useWs();
  const [pendiente, setPendiente] = useState<{ blob: Blob; secs: number } | null>(null);
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
  const composer = useRef<ComposerHandle>(null);
  const inputFoto = useRef<HTMLInputElement>(null);
  const inputDoc = useRef<HTMLInputElement>(null);
  const pasoVivo = useRef(paso);
  useEffect(() => { pasoVivo.current = paso; }, [paso]);
  const cancelarSubida = useRef<(() => void) | null>(null);
  useEffect(() => () => { cancelarSubida.current?.(); }, []);

  // El lienzo puede reusar este editor para otro nodo: lo que era del anterior (el audio sin
  // usar, el guion de MaKo, el error) no se queda dibujado en éste.
  const clavePaso = `${paso.id ?? ''}|${paso.orden}`;
  const [claveVista, setClaveVista] = useState(clavePaso);
  if (claveVista !== clavePaso) {
    setClaveVista(clavePaso);
    setPendiente(null); setGuionIA(null); setError(null); setAbierto(null);
  }

  const urlPendiente = useMemo(() => (pendiente ? URL.createObjectURL(pendiente.blob) : null), [pendiente]);
  useEffect(() => () => { if (urlPendiente) URL.revokeObjectURL(urlPendiente); }, [urlPendiente]);

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
  const aplicar = (despues: PasoSecuenciaDto) => onChange(cambiosDePaso(pasoVivo.current, despues));

  const todosLosAudios = useMemo(() => {
    const vistos = new Set(audios.map((a) => a.id));
    return [...audiosAca.filter((a) => !vistos.has(a.id)), ...audios];
  }, [audios, audiosAca]);
  const audioActual = paso.tipo === 'audio' && paso.audio_id ? todosLosAudios.find((a) => a.id === paso.audio_id) ?? null : null;
  const adjActual = paso.tipo === 'media' && paso.media_id ? (biblioteca ?? []).find((a) => a.id === paso.media_id) ?? null : null;

  // ── El audio: grabar al costado, escuchar, «Usar» ─────────────────────────────────────────
  async function usarAudio() {
    const p = pendiente;
    if (!p || fase) return;
    const deQuien = pasoVivo.current;
    setError(null);
    try {
      setFase('Convirtiendo…');
      const { blobToMp3 } = await import('../whatsapp/audio');
      const mp3 = await blobToMp3(p.blob);
      const buf = new Uint8Array(await mp3.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192));
      setFase('Guardando…');
      const r = await fetch('/api/chat-agent/audios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: `Mensaje ${deQuien.orden}`, base64: btoa(bin), mime: 'audio/mpeg', duracionS: p.secs }),
        signal: AbortSignal.timeout(ESPERA_AUDIO_MS),
      });
      const j = await r.json().catch(() => null) as { ok?: boolean; audio?: AudioSetting; error?: string } | null;
      if (!j?.ok || !j.audio) { avisar(j?.error || 'No se pudo guardar el audio.'); return; }
      const audio = j.audio;
      setAudiosAca((xs) => [audio, ...xs]);
      onAudioNuevo?.(audio);
      setPendiente(null);
      if (mismoPaso(pasoVivo.current, deQuien)) aplicar(pasoAVozDesde(pasoVivo.current, audio.id));
    } catch (e) {
      avisar(e instanceof Error && e.name === 'TimeoutError' ? 'Tardó demasiado. Prueba de nuevo.' : 'No se pudo procesar el audio.');
    } finally { setFase(null); }
  }

  // Lo que se lee mientras se graba: el texto del mensaje (o el guion que ya se movió), o el de
  // MaKo si salió de ESE texto (`guionVigente`: si el texto cambió, el de MaKo ya no es de éste).
  const base = guionParaLeer(paso).trim();
  const deMaKo = guionVigente(guionIA, base);
  const paraLeer = (deMaKo ?? base) || audioActual?.transcript?.trim() || '';
  const puedeGuion = !!(base || audioActual?.transcript || paraGuion?.objetivo || paraGuion?.gancho);

  async function pedirGuion() {
    if (pidiendo) return;
    setPidiendo(true);
    const de = base;
    try {
      const r = await fetch(RUTA_GUION, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paso: {
          texto: base || audioActual?.transcript?.trim() || '',
          pie: paso.tipo === 'audio' ? paso.cuerpo : '',
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
      {/* 120 de alto: el panel mide ~420 y mientras se graba el chat se achica a su mínimo; con más,
          la barra de grabar quedaría debajo del borde. Lo que no entra scrollea. */}
      {paraLeer && <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.55, whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto' }}>{paraLeer}</div>}
      {puedeGuion && (
        <button type="button" onClick={() => void pedirGuion()} disabled={pidiendo} title="MaKo escribe qué decir"
          style={{ ...chip, alignSelf: 'flex-start', color: 'var(--mako-ink)' }}>
          {pidiendo ? <><Spinner size={12} /> Escribiendo…</> : '✦ guion'}
        </button>
      )}
    </div>
  ) : null;

  // ── El archivo: subir directo al bucket y registrarlo ─────────────────────────────────────
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
      if (mismoPaso(pasoVivo.current, deQuien)) aplicar(pasoAMedia(pasoVivo.current, adj.id));
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo subir el archivo.');
    } finally {
      cancelarSubida.current = null;
      setSubida(null);
    }
  }

  const quitarAdjunto = () => aplicar(pasoSinAdjunto(pasoVivo.current));

  // ── El chip arriba del campo ──────────────────────────────────────────────────────────────
  let chipActual: ChipComposer | null = null;
  if (subida) {
    chipActual = { icono: 'doc', titulo: subida.nombre, detalle: `Subiendo ${subida.pct}%`, onQuitar: subida.cancelar, tituloQuitar: 'Cancelar subida' };
  } else if (paso.tipo === 'audio') {
    chipActual = { icono: 'audio', titulo: audioActual?.titulo ?? 'Nota de voz', detalle: fmtDur(audioActual?.duracion_s), onQuitar: quitarAdjunto, tituloQuitar: 'Quitar audio' };
  } else if (paso.tipo === 'media') {
    const t = tipoEnvioDeMime(adjActual?.media_mime);
    chipActual = {
      imagen: t === 'image' ? adjActual?.url ?? null : null,
      icono: t === 'video' ? 'video' : 'doc',
      titulo: adjActual?.titulo ?? (biblioteca === null ? 'Cargando…' : 'Archivo'),
      detalle: pesoLegible(adjActual?.tamano),
      onQuitar: quitarAdjunto, tituloQuitar: 'Quitar archivo',
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
      submenu: todosLosAudios.map((a) => ({ key: `a${a.id}`, label: a.titulo, detalle: fmtDur(a.duracion_s), onElegir: () => aplicar(pasoAVozDesde(pasoVivo.current, a.id)) })),
    });
  }
  if (permiteAdjuntos) {
    menuClip.push({
      key: 'archivos', label: 'Archivos guardados', icono: <IconClip />, vacio: biblioteca === null ? 'Cargando…' : 'Sin archivos todavía.',
      submenu: (biblioteca ?? []).map((a) => ({ key: `f${a.id}`, label: a.titulo, detalle: pesoLegible(a.tamano), onElegir: () => aplicar(pasoAMedia(pasoVivo.current, a.id)) })),
    });
  }

  // ── La burbuja como llega ────────────────────────────────────────────────────────────────
  // `{{negocio}}` se resuelve con la MISMA función que el motor (`aplicarVariables`): si la
  // pantalla resolviera un token que el envío no conoce, al lead le llegaría con las llaves
  // puestas y el editor mostrándolo perfecto (tests/paso-variables-editor.test.ts).
  const texto = aplicarVariables(paso.cuerpo ?? '', negocio?.trim() ? { negocio: negocio.trim() } : {});
  const sinEscribir = <span style={{ color: 'var(--faint)', fontSize: 13 }}>Sin escribir</span>;
  let vista: ReactNode;
  if (paso.tipo === 'audio') {
    vista = (
      <>
        <BurbujaHilo contenido={{ audio: audioActual ? { url: audioActual.url, titulo: audioActual.titulo, transcript: audioActual.transcript, duracion_s: audioActual.duracion_s } : { url: null, titulo: 'audio' } }} />
        {texto.trim() && <BurbujaHilo contenido={{ texto }} />}
      </>
    );
  } else if (paso.tipo === 'media') {
    const t = tipoEnvioDeMime(adjActual?.media_mime);
    vista = (
      <BurbujaHilo contenido={{
        media: adjActual
          ? { url: adjActual.url, mime: adjActual.media_mime, nombre: t === 'document' ? (adjActual.nombre_archivo ?? adjActual.titulo) : null }
          : { url: null, mime: '', nombre: biblioteca === null ? 'Cargando' : 'archivo' },
        texto,
      }} />
    );
  } else {
    vista = <BurbujaHilo contenido={{ texto, ia: paso.tipo === 'ia' }} vacio={sinEscribir} />;
  }

  const vars = variables ?? [...VARIABLES_LEAD, ...VARIABLES_NEGOCIO].map((v) => ({ key: v.key, label: v.label, ejemplo: v.ejemplo }));
  const esTexto = !paso.tipo || paso.tipo === 'texto' || paso.tipo === 'ia';
  // «↻ N» sólo en un mensaje de TEXTO. Las variantes son otras formas de decir el texto; en un
  // audio o un archivo no hay texto que variar (el campo es el pie o el caption), y mostrarlas
  // invitaba a editar algo que el motor sorteaba como caption del archivo (costuras-1). Al pasar
  // a voz o a archivo, `pasoAVoz`/`pasoAMedia` las sueltan. Esconderlas no deja nada colgado sin
  // salida: medido en prod el 08/10/2026, de 142 pasos, ningún audio tiene variantes y no hay
  // ningún paso de archivo (el tipo nace con este rediseño).
  const variantes = esTexto ? (paso.variantes ?? []) : [];
  const ocupado = !!deshabilitado || !!fase || !!subida;

  const faseNodo = fase ? (
    <div style={{ flex: 'none', padding: '7px 12px', borderTop: '1px solid var(--border)', fontSize: 12.5, color: 'var(--dim)', display: 'flex', alignItems: 'center', gap: 7 }}>
      <Spinner size={12} /> {fase}
    </div>
  ) : null;
  const composerNodo = (
    <ComposerWhatsApp
      ref={composer}
      modo="editar"
      valor={paso.cuerpo ?? ''}
      onValor={(v) => onChange({ cuerpo: v })}
      placeholder={placeholderDe(paso.tipo, placeholder)}
      ocupado={ocupado}
      menuClip={menuClip.length ? menuClip : undefined}
      onAudio={permiteAudio ? (blob, secs) => { setError(null); setPendiente({ blob, secs }); } : undefined}
      onErrorAudio={avisar}
      mientrasGraba={mientrasGraba}
      audioPendiente={pendiente ? { url: urlPendiente, onDescartar: () => setPendiente(null), onUsar: () => void usarAudio(), rotuloUsar: 'Usar' } : null}
      chip={chipActual}
    />
  );
  const errorNodo = error ? <div role="alert" style={{ flex: 'none', padding: '6px 12px 8px', fontSize: 12, color: 'var(--bad)' }}>{error}</div> : null;
  const herramientas = (
    <div style={{ flex: 'none', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        {permiteIA && esTexto && (
          <button type="button" disabled={ocupado} aria-pressed={paso.tipo === 'ia'} title="MaKo lo adapta para cada persona"
            onClick={() => { const on = paso.tipo !== 'ia'; onChange({ tipo: on ? 'ia' : 'texto' }); onModoIA?.(on); }}
            style={{ ...chip, ...(paso.tipo === 'ia' ? { background: 'var(--mako-bg)', borderColor: 'var(--mako-border)', color: 'var(--mako-ink)' } : {}) }}>
            ✦ MaKo
          </button>
        )}
        <button type="button" ref={setBtnDatos} disabled={ocupado} title="Insertar un dato" aria-label="Insertar un dato" aria-expanded={abierto === 'datos'}
          onClick={() => setAbierto((a) => (a === 'datos' ? null : 'datos'))} style={{ ...chip, fontFamily: "'Geist Mono', monospace" }}>{'{ }'}</button>
        {variantes.length > 0 && (
          <button type="button" ref={setBtnVariantes} disabled={ocupado} title="Otras formas de decirlo" aria-expanded={abierto === 'variantes'}
            onClick={() => setAbierto((a) => (a === 'variantes' ? null : 'variantes'))} style={chip}>↻ {variantes.length}</button>
        )}
      </div>
  );

  // ── UNA columna, como un teléfono: el chat arriba (llena y scrollea), la barra abajo ────────
  // El alto lo pone quien monta (el panel de /chatbot, de alto FIJO): el CHAT se queda con lo que
  // sobra y es lo único que se achica (hasta `ALTO_MIN_CHAT`); la barra y las herramientas no se
  // achican nunca. Por eso el chat y la barra son dos cajas pegadas y no una con `overflow: hidden`:
  // en un panel bajo, esa caja recortaba la barra de grabar por abajo. Todo estira con flex y
  // `minHeight: 0`, nunca con `height: 100%` (AGENTS.md: contra un alto indefinido, Safari da cero).
  // Montado en un contenedor sin alto (el recordatorio), el chat mide lo que su burbuja.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, minWidth: 0 }}>
      <div data-chat style={{ flex: '1 1 auto', minHeight: ALTO_MIN_CHAT, padding: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderBottom: 'none', borderRadius: '14px 14px 0 0', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* `marginTop: auto` y no `justify-content: flex-end`: con flex-end y scroll, lo que desborda
            por ARRIBA no se puede alcanzar. Así la burbuja queda abajo, como en un chat, y scrollea. */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {vista}
        </div>
      </div>
      <div data-barra style={{ flex: 'none', border: '1px solid var(--border)', borderRadius: '0 0 14px 14px', overflow: 'hidden', background: 'var(--surface)', marginBottom: 8 }}>
        {faseNodo}
        {composerNodo}
        {errorNodo}
      </div>
      {herramientas}

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
    </div>
  );
}
