'use client';

// =============================================================================
// Grabador de nota de voz — hook + barra visual, COMPARTIDO entre inboxes.
// Extraído 1:1 del inbox oficial (WhatsAppApp.tsx: startRec/stopRec/pauseRec/
// resumeRec + la barra con waveform) para que el no oficial lo use IDÉNTICO.
// El hook entrega el Blob grabado; el que llama decide el formato/envío (webm/opus para
// Evolution; el MP3 era para el oficial, Chatwoot, que se borró el 09/10/2026).
// =============================================================================
//
// ⚠️ DESMONTAR A MITAD DE UNA GRABACIÓN NO ENTREGA EL AUDIO (08/10/2026). El cleanup llamaba
// a `stop()` sin marcar la grabación como cancelada, y el `onstop` del MediaRecorder disparaba
// `onSend` igual: cerrar el panel de un mensaje del lienzo o cambiar de nodo a mitad de una
// grabación subía el audio, se lo asignaba al paso y publicaba la secuencia con un `pasos` de un
// render viejo. Ahora el desmontaje CANCELA lo que está grabando; lo que la persona ya terminó
// (apretó la flecha) se entrega aunque el componente se vaya antes de que el navegador lo cierre.
//
// La lógica vive en `crearGrabadorVoz`, sin React, para que un test la pueda EJECUTAR con un
// MediaRecorder falso (tests/composer-whatsapp.test.ts). El hook sólo la envuelve.

import { useEffect, useState, type CSSProperties } from 'react';
import { WAVE_CSS, IconPause, IconMic, SendArrow } from './composer-icons';
// El tacho de la casa (app/_ui/BotonBorrar.tsx, sexta tanda, general 9): rojo siempre.
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { AudioPlay } from './AudioPlay';

function fmtDur(s: number) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

export type VoiceRecorder = {
  recording: boolean; paused: boolean; secs: number;
  start: () => Promise<void>; stop: (cancel: boolean) => void; pause: () => void; resume: () => void;
};

export type EstadoGrabacion = { recording: boolean; paused: boolean; secs: number };

/** Lo que el grabador necesita del navegador: se inyecta para poder probarlo sin uno. */
export type EntornoGrabador = {
  pedirMicrofono: () => Promise<MediaStream>;
  crearRecorder: (s: MediaStream) => MediaRecorder;
};

const entornoDelNavegador: EntornoGrabador = {
  pedirMicrofono: () => navigator.mediaDevices.getUserMedia({ audio: true }),
  crearRecorder: (s) => new MediaRecorder(s),
};

export type GrabadorVoz = {
  /** `onSend` y `onError` se pasan EN CADA `start`: los de ese momento (ver el hook). */
  start: (onSend: (blob: Blob, secs: number) => void | Promise<void>, onError?: (msg: string) => void) => Promise<void>;
  stop: (cancel: boolean) => void;
  pause: () => void;
  resume: () => void;
  /** El componente se va: cancela lo que esté GRABANDO y suelta el micrófono. */
  soltar: () => void;
};

/**
 * El grabador, sin React. `alEstado` recibe cada cambio (grabando, pausado, segundos).
 *
 * ⚠️ `soltar` NO es un «muerto para siempre»: en desarrollo, StrictMode monta, desmonta y vuelve
 *    a montar, y un grabador que quedara inservible tras el primer desmontaje no grabaría nunca.
 *    Sólo cancela lo que está en curso.
 */
export function crearGrabadorVoz(alEstado: (e: EstadoGrabacion) => void, entorno: EntornoGrabador = entornoDelNavegador): GrabadorVoz {
  let rec: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let chunks: Blob[] = [];
  let cancelado = false;
  let activo = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  // Los segundos en una variable y no sólo en el estado: el `onstop` resetea el estado a 0 ANTES
  // de entregar el blob, y quien leía `secs` desde onSend recibía siempre 0 (por eso `duracion_s`
  // quedaba nulo en toda la biblioteca de audios).
  let secs = 0;
  let pausado = false;

  const avisar = () => alEstado({ recording: activo, paused: pausado, secs });
  const pararTimer = () => { if (timer) { clearInterval(timer); timer = null; } };
  const arrancarTimer = () => {
    if (timer) return;
    timer = setInterval(() => { secs += 1; avisar(); }, 1000);
  };

  return {
    async start(onSend, onError) {
      if (activo) return;
      let s: MediaStream;
      try { s = await entorno.pedirMicrofono(); }
      catch { onError?.('No se pudo acceder al micrófono. Revisa los permisos.'); return; }
      let r: MediaRecorder;
      try { r = entorno.crearRecorder(s); }
      catch { s.getTracks().forEach((t) => t.stop()); onError?.('Tu navegador no permite grabar audio.'); return; }
      const este = r;
      stream = s;
      chunks = [];
      cancelado = false;
      r.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      r.onstop = () => {
        s.getTracks().forEach((t) => t.stop()); // libera el micrófono
        pararTimer();
        const anulada = cancelado || rec !== este;
        const blob = new Blob(chunks, { type: este.mimeType || 'audio/webm' });
        if (rec === este) rec = null;
        // La duración se lee ANTES de resetear el contador.
        const dur = secs;
        activo = false; pausado = false; secs = 0;
        avisar();
        if (anulada || !blob.size) { if (!anulada) onError?.('La grabación quedó vacía, vuelve a intentarlo.'); return; }
        void onSend(blob, dur);
      };
      rec = r;
      activo = true; pausado = false; secs = 0;
      r.start();
      avisar();
      arrancarTimer();
    },
    stop(cancel) {
      cancelado = cancel;
      pararTimer();
      try { rec?.stop(); } catch { /* ya estaba parado */ }
    },
    pause() {
      try { rec?.pause(); } catch { /* noop */ }
      pararTimer();
      pausado = true;
      avisar();
    },
    resume() {
      try { rec?.resume(); } catch { /* noop */ }
      arrancarTimer();
      pausado = false;
      avisar();
    },
    soltar() {
      pararTimer();
      // GRABANDO (o en pausa) = se cancela. Ya parado por la persona = se deja terminar: el
      // `onstop` todavía no corrió y lo que se entrega es lo que ella pidió mandar.
      if (rec && rec.state !== 'inactive') {
        cancelado = true;
        try { rec.stop(); } catch { /* noop */ }
      }
      stream?.getTracks().forEach((t) => t.stop());
    },
  };
}

// onSend recibe el Blob grabado (mimeType nativo del navegador) y los SEGUNDOS
// que duró. onError superficia los mensajes (sin micrófono / grabación vacía).
// Libera el micro al desmontar, y lo que se estaba grabando se descarta.
export function useVoiceRecorder(onSend: (blob: Blob, secs: number) => void | Promise<void>, onError?: (msg: string) => void): VoiceRecorder {
  const [estado, setEstado] = useState<EstadoGrabacion>({ recording: false, paused: false, secs: 0 });
  // Un grabador por componente, creado UNA vez (estado perezoso, no un ref leído en el render).
  const [grabador] = useState(() => crearGrabadorVoz(setEstado));
  useEffect(() => () => grabador.soltar(), [grabador]);
  return {
    ...estado,
    // `onSend` el de ESTE render, como antes: si la persona cambia de chat a mitad de una
    // grabación, el audio va al chat donde empezó a grabar.
    start: () => grabador.start(onSend, onError),
    stop: grabador.stop,
    pause: grabador.pause,
    resume: grabador.resume,
  };
}

/** El ✓ de «terminar de grabar» cuando el audio no sale todavía (se escucha antes de usarlo). */
export function IconListo() {
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

// =============================================================================
// LA SESIÓN DE VOZ: grabar → TERMINAR → escuchar → mandar (sexta tanda del Chatbot, WhatsApp 7)
// =============================================================================
// Pedido de Martín (09/10/2026), textual: «al darle enviar, en cualquier lado, no se debe enviar, se
// debe "terminar" de grabar y donde aparece el punto rojo de recording, ahora debe aparecer el botón de
// reproducir, para escuchar el audio que acabo de grabar. Esto en todos lados, por motivos de seguridad
// que no se escape nunca un audio indeseado. Y si apreto el botón de enviar otra vez, el verde, ahí si
// se envia. Y que al grabar un audio, el botón de envio cambie el ícono de la flecha a un check, y luego
// si pone la flecha de envio. También revisa que tendremos 3 flechas alineadas... Tal vez reemplazar la
// de seguir grabando por un microfono».
//
//   · GRABANDO: 🗑 · ● y el tiempo · la onda A TODO EL ANCHO · ⏸ (en pausa, 🎤 para seguir) · ✓.
//   · ✓ TERMINA (no manda): el tramo se cierra y la barra pasa a REVISAR: 🗑 · ▶ donde estaba el punto
//     rojo, el avance y el tiempo · 🎤 seguir grabando · ➤ (el verde) MANDA.
//   · 🎤 en la revisión graba OTRO TRAMO que se suma al final (los tramos se unen al escucharlos y al
//     mandar: `unirAudios`). Un solo ícono para «grabar más», en pausa o revisando: así no hay tres
//     flechas iguales una al lado de la otra (el ▶ de reproducir, el ▶ de reanudar y la ➤ de mandar).
//
// ⚠️ NADA SALE AL SOLTAR, EN NINGÚN LADO. `audioAlSoltar` (EmpresaInbox) mandaba la nota de voz al
//    apretar la flecha de la grabación; la prop se borró (ComposerWhatsApp). La única forma de que un
//    audio salga es apretar ➤ después de haberlo podido escuchar.
// ⚠️ Y LA ESCUCHA ES DEL DESTINO DONDE SE GRABÓ, Y NO VIAJA. La sesión guarda el `onSend` del 🎤 (el
//    de ESE render), así que quien la monta para mandarle a alguien la remonta al cambiar de destino
//    (`key` con el chat, en ChatHilo y EmpresaInbox): cambiar de chat descarta lo grabado. Sin la key,
//    la nota escuchada en el chat B salía al lead A.
// ⚠️ LA LÓGICA VIVE SIN REACT (`crearSesionVoz`) y con el navegador inyectado, como el grabador: un
//    test la ejecuta con un MediaRecorder falso y una unión falsa (tests/composer-whatsapp.test.ts).
// ⚠️ EL GRABADOR DE ABAJO NO CAMBIA DE CONTRATO: `useVoiceRecorder` sigue entregando al soltar (lo usa
//    el dictado del Plan, que no manda un audio a nadie). Lo nuevo es `useGrabacionVoz` + `BarraGrabacion`.

export type FaseVoz = 'quieta' | 'grabando' | 'revisando';

export type EstadoVoz = {
  fase: FaseVoz;
  /** Grabando y en pausa. */
  paused: boolean;
  /** Los segundos de TODO lo grabado (los tramos de antes y el que se está grabando). */
  secs: number;
  /** Lo que se escucha antes de mandar: los tramos unidos. */
  revision: { url: string; secs: number } | null;
  /** Uniendo los tramos (al terminar uno o al mandar). */
  uniendo: boolean;
};

/** Lo que la sesión necesita del navegador, además del grabador. */
export type EntornoVoz = EntornoGrabador & {
  /** Junta los tramos en UN audio (en el navegador: decodifica y arma un WAV). Uno solo vuelve tal cual. */
  unir: (tramos: Blob[]) => Promise<Blob>;
  crearUrl: (b: Blob) => string;
  soltarUrl: (u: string) => void;
};

export type SesionVoz = {
  /** 🎤 desde cero: tira lo que hubiera y graba. */
  start: (onSend: (blob: Blob, secs: number) => void | Promise<void>, onError?: (msg: string) => void) => Promise<void>;
  /** ✓: cierra el tramo y pasa a escuchar. */
  terminar: () => void;
  /** 🎤 en la revisión: otro tramo que se suma al final. */
  seguir: () => Promise<void>;
  /** WA9: arranca en la revisión con un audio que YA existe; 🎤 le suma, ➤ manda el nuevo. */
  revisarExistente: (base: { blob: Blob; secs: number }, onSend: (blob: Blob, secs: number) => void | Promise<void>, onError?: (msg: string) => void) => Promise<void>;
  /** ➤: une todo y lo entrega. */
  enviar: () => Promise<void>;
  /** 🗑: tira todo (grabando o revisando). */
  descartar: () => void;
  pause: () => void;
  resume: () => void;
  /** El componente se va: cancela lo que esté grabando y suelta el micrófono y las URLs. */
  soltar: () => void;
};

export const ESTADO_VOZ_INICIAL: EstadoVoz = { fase: 'quieta', paused: false, secs: 0, revision: null, uniendo: false };

/**
 * La sesión, sin React. Encima de `crearGrabadorVoz`: cada «terminar» es un `stop(false)` del grabador
 * cuyo blob NO se entrega, se guarda como un TRAMO. «Enviar» une los tramos y recién ahí entrega.
 */
export function crearSesionVoz(alEstado: (e: EstadoVoz) => void, entorno: EntornoVoz): SesionVoz {
  let tramos: Array<{ blob: Blob; secs: number }> = [];
  let fase: FaseVoz = 'quieta';
  let paused = false;
  let secsTramo = 0;
  let revision: { url: string; secs: number; blob: Blob } | null = null;
  let uniendo = false;
  let entregar: ((blob: Blob, secs: number) => void | Promise<void>) | null = null;
  let avisarError: ((m: string) => void) | undefined;
  // Cada `start` del grabador vale para UN tramo: si mientras tanto se descartó, lo que llega se tira.
  let vuelta = 0;

  const secsPrevios = () => tramos.reduce((s, t) => s + t.secs, 0);
  const avisar = () => alEstado({
    fase, paused, secs: fase === 'grabando' ? secsPrevios() + secsTramo : (revision?.secs ?? secsPrevios()),
    revision: revision ? { url: revision.url, secs: revision.secs } : null, uniendo,
  });
  const soltarRevision = () => { if (revision) { entorno.soltarUrl(revision.url); revision = null; } };

  const grabador = crearGrabadorVoz((e) => {
    // El grabador avisa al terminar con recording:false: la fase la maneja la sesión, no él.
    if (e.recording) { secsTramo = e.secs; paused = e.paused; avisar(); }
  }, entorno);

  async function armarRevision() {
    uniendo = true; avisar();
    try {
      const blob = tramos.length === 1 ? tramos[0].blob : await entorno.unir(tramos.map((t) => t.blob));
      soltarRevision();
      revision = { url: entorno.crearUrl(blob), secs: secsPrevios(), blob };
      fase = 'revisando';
    } catch {
      avisarError?.('No se pudo juntar el audio. Vuelve a grabarlo.');
      tramos = []; fase = 'quieta';
    } finally { uniendo = false; avisar(); }
  }

  async function grabarTramo() {
    const mia = ++vuelta;
    await grabador.start((blob, secs) => {
      if (mia !== vuelta) return;   // se descartó mientras el navegador cerraba el tramo
      tramos.push({ blob, secs });
      secsTramo = 0;
      void armarRevision();
    }, (m) => {
      // Sin micrófono o grabación vacía: si había algo grabado, se vuelve a escucharlo.
      avisarError?.(m);
      if (mia !== vuelta) return;
      uniendo = false;
      fase = tramos.length ? 'revisando' : 'quieta'; paused = false; secsTramo = 0;
      if (fase === 'revisando' && !revision) void armarRevision(); else avisar();
    });
  }

  return {
    async start(onSend, onError) {
      if (fase === 'grabando') return;
      entregar = onSend; avisarError = onError;
      soltarRevision(); tramos = []; secsTramo = 0; paused = false;
      fase = 'grabando'; avisar();
      await grabarTramo();
    },
    terminar() {
      if (fase !== 'grabando') return;
      // La fase queda «grabando» hasta que llega el blob (el `onstop` del navegador viene después):
      // `uniendo` dice que se está cerrando.
      uniendo = true; avisar();
      grabador.stop(false);
    },
    async seguir() {
      if (fase !== 'revisando' || uniendo) return;
      fase = 'grabando'; paused = false; secsTramo = 0; avisar();
      await grabarTramo();
    },
    async revisarExistente(base, onSend, onError) {
      vuelta++;
      grabador.soltar();
      entregar = onSend; avisarError = onError;
      soltarRevision();
      tramos = [{ blob: base.blob, secs: Math.max(0, Math.round(base.secs)) }];
      secsTramo = 0; paused = false;
      await armarRevision();
    },
    async enviar() {
      if (fase !== 'revisando' || uniendo || !revision) return;
      const r = revision;
      const destino = entregar;
      // Se vacía ANTES de entregar: un segundo clic no lo manda dos veces.
      revision = null; tramos = []; fase = 'quieta'; avisar();
      try { await destino?.(r.blob, r.secs); } finally { entorno.soltarUrl(r.url); }
    },
    descartar() {
      vuelta++;
      if (fase === 'grabando') grabador.stop(true);
      soltarRevision(); tramos = []; secsTramo = 0; paused = false; uniendo = false; fase = 'quieta'; avisar();
    },
    pause() { if (fase === 'grabando') grabador.pause(); },
    resume() { if (fase === 'grabando') grabador.resume(); },
    soltar() {
      vuelta++;
      grabador.soltar();
      soltarRevision();
      tramos = []; fase = 'quieta';
    },
  };
}

/**
 * JUNTA LOS TRAMOS EN UN AUDIO: los decodifica con Web Audio (los de MediaRecorder y los MP3 de la
 * biblioteca), pega las muestras en orden y arma un WAV mono de 16 bits. Quien lo manda lo pasa a MP3
 * igual que a una grabación de un tramo (`blobToMp3`, que decodifica cualquier cosa que el navegador
 * entienda): la unión no cambia el camino de envío.
 */
export async function unirAudios(tramos: Blob[]): Promise<Blob> {
  if (tramos.length === 1) return tramos[0];
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  try {
    const bufs: AudioBuffer[] = [];
    for (const t of tramos) bufs.push(await ctx.decodeAudioData(await t.arrayBuffer()));
    const canales = bufs.map((b) => {
      const c0 = b.getChannelData(0);
      if (b.numberOfChannels < 2) return c0;
      const c1 = b.getChannelData(1);
      const m = new Float32Array(c0.length);
      for (let i = 0; i < c0.length; i++) m[i] = (c0[i] + c1[i]) / 2;
      return m;
    });
    return wavDe(canales, ctx.sampleRate);
  } finally { await ctx.close().catch(() => {}); }
}

/** PCM mono (pedazos en orden) → un WAV de 16 bits. Pura: la ejecuta el test. */
export function wavDe(pedazos: Float32Array[], tasa: number): Blob {
  const n = pedazos.reduce((s, p) => s + p.length, 0);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const txt = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  txt(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); txt(8, 'WAVE'); txt(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, tasa, true); v.setUint32(28, tasa * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  txt(36, 'data'); v.setUint32(40, n * 2, true);
  let o = 44;
  for (const p of pedazos) {
    for (let i = 0; i < p.length; i++) {
      const s = Math.max(-1, Math.min(1, p[i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([buf], { type: 'audio/wav' });
}

const entornoVozDelNavegador: EntornoVoz = {
  ...entornoDelNavegador,
  unir: unirAudios,
  crearUrl: (b) => URL.createObjectURL(b),
  soltarUrl: (u) => { try { URL.revokeObjectURL(u); } catch { /* noop */ } },
};

export type GrabacionVoz = EstadoVoz & Omit<SesionVoz, 'start' | 'revisarExistente' | 'soltar'> & {
  start: () => Promise<void>;
  revisarExistente: (base: { blob: Blob; secs: number }) => Promise<void>;
};

/**
 * El hook de la sesión. `onSend` recibe lo que se MANDA (con ➤, después de escucharlo): el blob de un
 * tramo tal cual o el WAV de los tramos unidos, y los segundos.
 */
export function useGrabacionVoz(onSend: (blob: Blob, secs: number) => void | Promise<void>, onError?: (msg: string) => void): GrabacionVoz {
  const [estado, setEstado] = useState<EstadoVoz>(ESTADO_VOZ_INICIAL);
  const [sesion] = useState(() => crearSesionVoz(setEstado, entornoVozDelNavegador));
  useEffect(() => () => sesion.soltar(), [sesion]);
  return {
    ...estado,
    // `onSend` el de ESTE render, como el grabador. Lo que se grabó NO viaja a otro destino: quien
    // monta esto para mandar remonta al cambiar de chat (`key`), y el desmontaje lo descarta.
    start: () => sesion.start(onSend, onError),
    revisarExistente: (base) => sesion.revisarExistente(base, onSend, onError),
    terminar: sesion.terminar, seguir: sesion.seguir, enviar: sesion.enviar, descartar: sesion.descartar,
    pause: sesion.pause, resume: sesion.resume,
  };
}

/** Cuántas barras de la onda entran en un ancho (una cada 5 px). Pura (test). */
export const barrasDeOnda = (ancho: number): number => Math.max(12, Math.min(160, Math.floor(ancho / 5)));

/**
 * LA ONDA A TODO EL ANCHO (WhatsApp 7: «debería ocupar mucho más espacio, hasta el final del ancho, no
 * todo amontonado a la derecha, esto en todos lados»). Cuenta las barras con el ancho que le toca
 * (`ResizeObserver`); el ancho lo da el `flex: 1` de quien la pone.
 */
function OndaGrabando({ paused }: { paused: boolean }) {
  const [caja, setCaja] = useState<HTMLDivElement | null>(null);
  const [n, setN] = useState(48);
  useEffect(() => {
    if (!caja) return;
    const medir = () => setN(barrasDeOnda(caja.getBoundingClientRect().width));
    medir();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    ro?.observe(caja);
    return () => ro?.disconnect();
  }, [caja]);
  return (
    <div ref={setCaja} data-onda style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, height: 26, overflow: 'hidden' }}>
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} style={{ flex: 'none', width: 3, height: 22, borderRadius: 2, background: 'var(--good)', transformOrigin: 'center', animation: 'mako-wave .7s ease-in-out infinite alternate', animationDelay: `${(i % 11) * 0.06}s`, animationPlayState: paused ? 'paused' : 'running', opacity: paused ? 0.5 : 1 }}></span>
      ))}
    </div>
  );
}

const btnRedondo: CSSProperties = { flex: 'none', width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 };
const btnVerde = (apagado: boolean): CSSProperties => ({ ...btnRedondo, width: 44, height: 44, background: 'var(--good)', color: '#fff', cursor: apagado ? 'default' : 'pointer', opacity: apagado ? 0.6 : 1 });

/**
 * LA BARRA DE LA SESIÓN: la de grabar y la de escuchar antes de mandar. La usan el composer de WhatsApp
 * (el editor del lienzo, /whatsapp y el hilo), los grabadores de los onboardings (el del Chatbot y el del
 * Video Generator) y la tarea de AUDIO del alumno (app/compartido/curso/[token]/TareaAlumno.tsx).
 *
 * `existente`: WA9 («Si le doy editar a un audio... debería salir la misma barra de sonido, con los
 * botones de reanudar grabación, enviar, borrar, escuchar»): un audio que YA está (su URL) se revisa con
 * esta misma barra sin haberlo grabado acá. 🗑 lo borra (`onBorrar`), ➤ lo deja como está
 * (`onDejar`), 🎤 le graba algo más al final (`onSeguir`, que baja el audio y entra a la sesión).
 */
export function BarraGrabacion({ voz, ocupado = false, rotuloEnviar = 'Enviar audio', existente }: {
  voz: GrabacionVoz;
  ocupado?: boolean;
  rotuloEnviar?: string;
  existente?: { url: string; secs?: number | null; onBorrar: () => void; onDejar: () => void; onSeguir?: () => void } | null;
}) {
  const grabando = voz.fase === 'grabando';
  if (grabando) {
    const cerrando = voz.uniendo;
    return (
      <div data-barra-voz="grabando" style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minWidth: 0 }}>
        <style>{WAVE_CSS}</style>
        <button type="button" onClick={voz.descartar} disabled={cerrando} title="Eliminar grabación" aria-label="Eliminar grabación" style={{ ...btnRedondo, color: 'var(--bad)' }}><IconoBorrar size={20} /></button>
        <span style={{ flex: 'none', width: 9, height: 9, borderRadius: '50%', background: '#e53935', animation: voz.paused ? 'none' : 'mako-blink 1s steps(1) infinite', opacity: voz.paused ? 0.4 : 1 }}></span>
        <span style={{ flex: 'none', fontVariantNumeric: 'tabular-nums', fontSize: 14, color: 'var(--ink)', minWidth: 38 }}>{fmtDur(voz.secs)}</span>
        <OndaGrabando paused={voz.paused || cerrando} />
        {voz.paused ? (
          <button type="button" onClick={voz.resume} title="Seguir grabando" aria-label="Seguir grabando" style={{ ...btnRedondo, color: 'var(--ink)' }}><IconMic /></button>
        ) : (
          <button type="button" onClick={voz.pause} disabled={cerrando} title="Pausar" aria-label="Pausar grabación" style={{ ...btnRedondo, color: 'var(--ink)' }}><IconPause /></button>
        )}
        <button type="button" onClick={voz.terminar} disabled={cerrando} title="Terminar grabación" aria-label="Terminar grabación" style={btnVerde(cerrando)}><IconListo /></button>
      </div>
    );
  }
  const r = voz.revision ?? (existente ? { url: existente.url, secs: existente.secs ?? 0 } : null);
  if (!r) return null;
  const propia = !!voz.revision;
  const apagado = ocupado || voz.uniendo;
  return (
    <div data-barra-voz="revisando" style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minWidth: 0 }}>
      <button type="button" onClick={() => (propia ? voz.descartar() : existente?.onBorrar())} disabled={apagado} title="Borrar el audio" aria-label="Borrar el audio" style={{ ...btnRedondo, color: 'var(--bad)' }}><IconoBorrar size={20} /></button>
      {/* ▶ DONDE ESTABA EL PUNTO ROJO: el reproductor de la casa, a todo el ancho. */}
      <AudioPlay key={r.url} src={r.url} duracion={r.secs || null} style={{ flex: 1, minWidth: 0, width: 'auto' }} />
      {(propia || existente?.onSeguir) && (
        <button type="button" onClick={() => { if (propia) void voz.seguir(); else existente?.onSeguir?.(); }} disabled={apagado}
          title="Seguir grabando" aria-label="Seguir grabando" style={{ ...btnRedondo, color: 'var(--ink)' }}><IconMic /></button>
      )}
      <button type="button" onClick={() => { if (propia) void voz.enviar(); else existente?.onDejar(); }} disabled={apagado}
        title={rotuloEnviar} aria-label={rotuloEnviar} style={btnVerde(apagado)}><SendArrow /></button>
    </div>
  );
}

// ⛔ Acá vivía `VoiceRecorderBar`, la barra del grabador de SIEMPRE (`useVoiceRecorder`, que entrega al
// soltar). La montaba sólo el onboarding del Video Generator, y en la segunda pasada de la sexta tanda
// pasó a la sesión de la casa (`useGrabacionVoz` + `BarraGrabacion`, WhatsApp 7: «Esto en todos
// lados»): quedó con cero llamadores y se fue. `useVoiceRecorder` sigue (el dictado del Plan, que no
// manda un audio a nadie).
