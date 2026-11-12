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
//
// ⚠️ MIENTRAS GRABA SE TIENE QUE VER, SIN DUDA (22/10/2026, la llamada con Mauricio, min 56: «¿está grabando? No», y
// borró y repitió dos veces). La barra decía lo mismo grabando que sin grabar: mientras el navegador abría el micrófono,
// un punto gris, 0:00 y la onda quieta; y ya grabando, una onda que se movía SOLA, hablara o no. Ahora: mientras abre, lo
// DICE («Abriendo el micrófono…» y, si tarda, que lo permita); grabando, el punto rojo late y la onda sigue la VOZ (el
// nivel del micrófono, `flujo` + `nivelDeMuestras`): si se habla y no se mueve, no está entrando. Es la barra de los
// tres lugares (WhatsApp, Automations y Offer: todos montan `BarraGrabacion`).

import { useEffect, useRef, useState, type CSSProperties } from 'react';
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

/**
 * Cada cuánto el grabador entrega lo que lleva grabado, cuando alguien lo pide (`onTrozo`). Décima tanda del
 * Chatbot, WhatsApp 3 («Alguien puede estar grabando un audio y sin querer refresca o se sale y perdió lo
 * grabado»): quien monta guarda una copia a cada trozo, y lo más que se pierde es este rato.
 */
export const TROZO_MS = 1000;

export type GrabadorVoz = {
  /**
   * `onSend` y `onError` se pasan EN CADA `start`: los de ese momento (ver el hook). `onTrozo` (opcional):
   * lo grabado HASTA AHORA de este tramo, cada `TROZO_MS`, para guardar un borrador. No entrega nada: `onSend`
   * sigue siendo lo único que sale, y sólo cuando la persona lo pide.
   */
  start: (onSend: (blob: Blob, secs: number) => void | Promise<void>, onError?: (msg: string) => void, onTrozo?: (parcial: Blob) => void) => Promise<void>;
  stop: (cancel: boolean) => void;
  pause: () => void;
  resume: () => void;
  /** El componente se va: cancela lo que esté GRABANDO y suelta el micrófono. */
  soltar: () => void;
  /** El micrófono que se está grabando (para que la onda siga la voz); `null` si no está grabando. */
  flujo: () => MediaStream | null;
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
  // ⚠️ EL PEDIDO DEL MICRÓFONO SE PUEDE CANCELAR (revisión de la sexta tanda, 10/10/2026). La primera
  // vez el navegador muestra su cartel de permiso y `pedirMicrofono` queda pendiente; un `stop` o un
  // `soltar` en ese rato no encontraban grabador (`rec` null) y, al dar Permitir, el MediaRecorder
  // arrancaba igual: el micrófono grabando sin ninguna barra, o con la barra trabada. Cada pedido lleva
  // su número de intento; si al volver ya no es el vigente, se sueltan las pistas y NO se arranca.
  let intento = 0;
  let pidiendo = false;
  const cancelarPedido = () => { if (pidiendo) { intento++; pidiendo = false; } };

  const avisar = () => alEstado({ recording: activo, paused: pausado, secs });
  const pararTimer = () => { if (timer) { clearInterval(timer); timer = null; } };
  const arrancarTimer = () => {
    if (timer) return;
    timer = setInterval(() => { secs += 1; avisar(); }, 1000);
  };

  return {
    async start(onSend, onError, onTrozo) {
      if (activo) return;
      const mio = ++intento;
      pidiendo = true;
      let s: MediaStream;
      try { s = await entorno.pedirMicrofono(); }
      catch {
        // Cancelado mientras se pedía: la persona ya se fue, no es un error que mostrar.
        if (mio === intento) { pidiendo = false; onError?.('No se pudo acceder al micrófono. Revisa los permisos.'); }
        return;
      }
      // Se canceló mientras el navegador pedía el permiso: se suelta el micrófono y NO se arranca.
      if (mio !== intento) { s.getTracks().forEach((t) => t.stop()); return; }
      pidiendo = false;
      let r: MediaRecorder;
      try { r = entorno.crearRecorder(s); }
      catch { s.getTracks().forEach((t) => t.stop()); onError?.('Tu navegador no permite grabar audio.'); return; }
      const este = r;
      stream = s;
      chunks = [];
      cancelado = false;
      r.ondataavailable = (e) => {
        if (e.data && e.data.size) chunks.push(e.data);
        // El borrador (WhatsApp 3): lo de este tramo hasta ahora. Una cancelación no deja borrador.
        if (onTrozo && rec === este && !cancelado && chunks.length) onTrozo(new Blob(chunks, { type: este.mimeType || 'audio/webm' }));
      };
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
      // Con `onTrozo`, en trozos (el navegador entrega cada `TROZO_MS`); sin él, como siempre: todo al parar.
      if (onTrozo) r.start(TROZO_MS); else r.start();
      avisar();
      arrancarTimer();
    },
    stop(cancel) {
      cancelarPedido();
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
      cancelarPedido();
      pararTimer();
      // GRABANDO (o en pausa) = se cancela. Ya parado por la persona = se deja terminar: el
      // `onstop` todavía no corrió y lo que se entrega es lo que ella pidió mandar.
      if (rec && rec.state !== 'inactive') {
        cancelado = true;
        try { rec.stop(); } catch { /* noop */ }
      }
      stream?.getTracks().forEach((t) => t.stop());
    },
    flujo() { return activo && rec ? stream : null; },
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
  /**
   * El navegador todavía no entregó el micrófono (su cartel de permiso, o el dispositivo abriendo). La
   * barra ya dice «grabando», pero ⏸ y ✓ no hacen nada todavía; 🗑 cancela el pedido.
   */
  pidiendoMic: boolean;
};

/** Lo que la sesión necesita del navegador, además del grabador. */
export type EntornoVoz = EntornoGrabador & {
  /** Junta los tramos en UN audio (en el navegador: decodifica y arma un WAV). Uno solo vuelve tal cual. */
  unir: (tramos: Blob[]) => Promise<Blob>;
  crearUrl: (b: Blob) => string;
  soltarUrl: (u: string) => void;
};

/**
 * EL BORRADOR DE LA SESIÓN (décima tanda del Chatbot, WhatsApp 3): todo lo grabado y sin mandar —los tramos
 * de antes y lo que va del que se está grabando—, a cada trozo y al pasar a escucharlo. `null`: la persona lo
 * TIRÓ (🗑). Mandarlo (➤) no avisa nada: eso lo sabe quien recibe `onSend`. Lo usa el editor del lienzo para
 * que un audio no se pierda al cerrar el panel o recargar (app/automations/EditorMensajeWhatsApp.tsx).
 */
export type BorradorDeVoz = (b: { tramos: Blob[]; secs: number } | null) => void;

export type SesionVoz = {
  /** 🎤 desde cero: tira lo que hubiera y graba. `onBorrador` (opcional): ver `BorradorDeVoz`. */
  start: (onSend: (blob: Blob, secs: number) => void | Promise<void>, onError?: (msg: string) => void, onBorrador?: BorradorDeVoz) => Promise<void>;
  /** ✓: cierra el tramo y pasa a escuchar. */
  terminar: () => void;
  /** 🎤 en la revisión: otro tramo que se suma al final. */
  seguir: () => Promise<void>;
  /** WA9: arranca en la revisión con un audio que YA existe; 🎤 le suma, ➤ manda el nuevo. */
  revisarExistente: (base: { blob: Blob; secs: number }, onSend: (blob: Blob, secs: number) => void | Promise<void>, onError?: (msg: string) => void, onBorrador?: BorradorDeVoz) => Promise<void>;
  /** ➤: une todo y lo entrega. */
  enviar: () => Promise<void>;
  /** 🗑: tira todo (grabando o revisando). */
  descartar: () => void;
  pause: () => void;
  resume: () => void;
  /** El componente se va: cancela lo que esté grabando y suelta el micrófono y las URLs. */
  soltar: () => void;
  /** El micrófono del tramo que se está grabando (la onda lo escucha); `null` si no hay. */
  flujo: () => MediaStream | null;
};

export const ESTADO_VOZ_INICIAL: EstadoVoz = { fase: 'quieta', paused: false, secs: 0, revision: null, uniendo: false, pidiendoMic: false };

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
  /** El borrador (WhatsApp 3) y cuántos tramos se GRABARON en esta sesión: un audio que ya existía no es un borrador. */
  let alBorrador: BorradorDeVoz | undefined;
  let grabados = 0;
  // Cada `start` del grabador vale para UN tramo: si mientras tanto se descartó, lo que llega se tira.
  let vuelta = 0;
  // ⚠️ La fase pasa a «grabando» ANTES de que el navegador entregue el micrófono (la barra tiene que
  // aparecer al tocar el 🎤). Mientras tanto ✓ y ⏸ no hacen nada —no hay tramo que cerrar— y 🗑 cancela
  // el PEDIDO (el grabador suelta las pistas al volver). Antes, un ✓ en ese rato dejaba la barra con
  // `uniendo` puesto y todo apagado, con el micrófono abierto y sin salida (revisión, 10/10/2026).
  let pidiendoMic = false;

  const secsPrevios = () => tramos.reduce((s, t) => s + t.secs, 0);
  const avisar = () => alEstado({
    fase, paused, secs: fase === 'grabando' ? secsPrevios() + secsTramo : (revision?.secs ?? secsPrevios()),
    revision: revision ? { url: revision.url, secs: revision.secs } : null, uniendo, pidiendoMic,
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
      if (grabados > 0) alBorrador?.({ tramos: [blob], secs: revision.secs });
    } catch {
      avisarError?.('No se pudo juntar el audio. Vuelve a grabarlo.');
      tramos = []; fase = 'quieta';
    } finally { uniendo = false; avisar(); }
  }

  async function grabarTramo() {
    const mia = ++vuelta;
    pidiendoMic = true; avisar();
    try {
      // El trozo de lo que va grabado (WhatsApp 3), con los tramos de antes adelante: el borrador es TODO.
      const trozo = alBorrador ? (parcial: Blob) => {
        if (mia !== vuelta) return;
        alBorrador?.({ tramos: [...tramos.map((t) => t.blob), parcial], secs: secsPrevios() + secsTramo });
      } : undefined;
      await grabador.start((blob, secs) => {
        if (mia !== vuelta) return;   // se descartó mientras el navegador cerraba el tramo
        tramos.push({ blob, secs });
        grabados++;
        secsTramo = 0;
        void armarRevision();
      }, (m) => {
        // Sin micrófono o grabación vacía: si había algo grabado, se vuelve a escucharlo.
        avisarError?.(m);
        if (mia !== vuelta) return;
        uniendo = false; pidiendoMic = false;
        fase = tramos.length ? 'revisando' : 'quieta'; paused = false; secsTramo = 0;
        if (fase === 'revisando' && !revision) void armarRevision(); else avisar();
      }, trozo);
    } finally {
      // Con la vuelta ya descartada, quien la descartó apagó `pidiendoMic` (y puede haber otra pidiendo).
      if (mia === vuelta && pidiendoMic) { pidiendoMic = false; avisar(); }
    }
  }

  return {
    async start(onSend, onError, onBorrador) {
      if (fase === 'grabando') return;
      entregar = onSend; avisarError = onError; alBorrador = onBorrador; grabados = 0;
      soltarRevision(); tramos = []; secsTramo = 0; paused = false;
      fase = 'grabando'; avisar();
      await grabarTramo();
    },
    terminar() {
      // Con el micrófono pendiente no hay tramo que cerrar: un ✓ acá dejaba la barra trabada.
      if (fase !== 'grabando' || pidiendoMic) return;
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
    async revisarExistente(base, onSend, onError, onBorrador) {
      vuelta++;
      pidiendoMic = false;
      grabador.soltar();
      entregar = onSend; avisarError = onError; alBorrador = onBorrador; grabados = 0;
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
      // La persona lo TIRÓ: el borrador también se va (WhatsApp 3).
      alBorrador?.(null);
      // `stop(true)` también cancela un pedido de micrófono pendiente (el grabador suelta las pistas al volver).
      if (fase === 'grabando') grabador.stop(true);
      soltarRevision(); tramos = []; secsTramo = 0; paused = false; uniendo = false; pidiendoMic = false; fase = 'quieta'; avisar();
    },
    pause() { if (fase === 'grabando' && !pidiendoMic) grabador.pause(); },
    resume() { if (fase === 'grabando' && !pidiendoMic) grabador.resume(); },
    soltar() {
      vuelta++;
      pidiendoMic = false;
      grabador.soltar();
      soltarRevision();
      tramos = []; fase = 'quieta';
    },
    flujo: () => (fase === 'grabando' && !pidiendoMic ? grabador.flujo() : null),
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

export type GrabacionVoz = EstadoVoz & Omit<SesionVoz, 'start' | 'revisarExistente' | 'soltar' | 'flujo'> & {
  /** El micrófono que se graba: la onda sigue su nivel. Sin él, la onda queda quieta (24/10/2026: nunca se mueve sola). */
  flujo?: () => MediaStream | null;
  start: () => Promise<void>;
  revisarExistente: (base: { blob: Blob; secs: number }) => Promise<void>;
};

/**
 * El hook de la sesión. `onSend` recibe lo que se MANDA (con ➤, después de escucharlo): el blob de un
 * tramo tal cual o el WAV de los tramos unidos, y los segundos.
 */
export function useGrabacionVoz(onSend: (blob: Blob, secs: number) => void | Promise<void>, onError?: (msg: string) => void, onBorrador?: BorradorDeVoz): GrabacionVoz {
  const [estado, setEstado] = useState<EstadoVoz>(ESTADO_VOZ_INICIAL);
  const [sesion] = useState(() => crearSesionVoz(setEstado, entornoVozDelNavegador));
  useEffect(() => () => sesion.soltar(), [sesion]);
  return {
    ...estado,
    // `onSend` el de ESTE render, como el grabador. Lo que se grabó NO viaja a otro destino: quien
    // monta esto para mandar remonta al cambiar de chat (`key`), y el desmontaje lo descarta.
    start: () => sesion.start(onSend, onError, onBorrador),
    revisarExistente: (base) => sesion.revisarExistente(base, onSend, onError, onBorrador),
    terminar: sesion.terminar, seguir: sesion.seguir, enviar: sesion.enviar, descartar: sesion.descartar,
    pause: sesion.pause, resume: sesion.resume, flujo: sesion.flujo,
  };
}

/** Cuántas barras de la onda entran en un ancho (una cada 5 px). Pura (test). */
export const barrasDeOnda = (ancho: number): number => Math.max(12, Math.min(160, Math.floor(ancho / 5)));

/**
 * Cuánto suena un pedazo del micrófono, de 0 a 1 (las muestras de `getByteTimeDomainData`: 128 es silencio). La raíz del
 * RMS, para que una voz normal (RMS ~0,05) llene media barra y el ruido de fondo (~0,003) casi no la mueva. Pura (test).
 */
export function nivelDeMuestras(muestras: ArrayLike<number>): number {
  if (!muestras.length) return 0;
  let suma = 0;
  for (let i = 0; i < muestras.length; i++) { const v = (muestras[i] - 128) / 128; suma += v * v; }
  return Math.min(1, Math.sqrt(Math.sqrt(suma / muestras.length)) * 1.6);
}

/** Cada cuánto entra una barra nueva por la derecha (la onda corre como la de WhatsApp). */
const PASO_ONDA_MS = 70;
/** La barra más baja: en silencio la onda es una línea, no nada. */
const PISO_ONDA = 0.12;

/**
 * LA ONDA A TODO EL ANCHO (WhatsApp 7: «debería ocupar mucho más espacio, hasta el final del ancho, no
 * todo amontonado a la derecha, esto en todos lados»). Cuenta las barras con el ancho que le toca
 * (`ResizeObserver`); el ancho lo da el `flex: 1` de quien la pone.
 *
 * Y SIGUE LA VOZ (22/10/2026): con `flujo`, escucha el micrófono (un AnalyserNode, sin sonar por el parlante) y cada
 * `PASO_ONDA_MS` entra por la derecha una barra con lo que sonó. Las alturas se escriben en el DOM, sin pasar por React:
 * un estado por cuadro re-dibujaría la caja entera 60 veces por segundo.
 * SIN NADA QUE ESCUCHAR, QUIETA (24/10/2026, Martín: «la animación de ondas de grabando audios no sigue lo que está
 * escuchando, es decir, es sólo una animación predefinida»): sin `flujo`, sin Web Audio o con el navegador que no deja
 * escuchar el micrófono, la onda es una línea. Antes se movía sola, y una onda que se mueve sin sonido dice que entra voz
 * cuando no se sabe.
 */
function OndaGrabando({ paused, flujo }: { paused: boolean; flujo?: (() => MediaStream | null) | null }) {
  const [caja, setCaja] = useState<HTMLDivElement | null>(null);
  const [n, setN] = useState(48);
  /** null = todavía no se sabe; true = la onda sigue la voz; false = sin micrófono que escuchar (queda quieta). */
  const [sigueVoz, setSigueVoz] = useState<boolean | null>(flujo ? null : false);
  const pausada = useRef(paused);
  useEffect(() => { pausada.current = paused; }, [paused]);
  useEffect(() => {
    if (!caja) return;
    const medir = () => setN(barrasDeOnda(caja.getBoundingClientRect().width));
    medir();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    ro?.observe(caja);
    return () => ro?.disconnect();
  }, [caja]);
  useEffect(() => {
    if (!caja || !flujo) return;
    const s = flujo();
    const AC = typeof window !== 'undefined' ? (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
    if (!s || !AC) { setSigueVoz(false); return; }
    let ctx: AudioContext;
    let fuente: MediaStreamAudioSourceNode;
    let oido: AnalyserNode;
    try {
      ctx = new AC();
      fuente = ctx.createMediaStreamSource(s);
      oido = ctx.createAnalyser();
      oido.fftSize = 512;
      fuente.connect(oido);   // al analizador y nada más: no suena por el parlante
      void ctx.resume().catch(() => {});
    } catch { setSigueVoz(false); return; }
    setSigueVoz(true);
    const muestras = new Uint8Array(oido.fftSize);
    let historia: number[] = [];
    let pico = 0;
    let ultimo = 0;
    let cuadro = 0;
    const dibujar = (t: number) => {
      cuadro = requestAnimationFrame(dibujar);
      if (pausada.current) return;
      oido.getByteTimeDomainData(muestras);
      pico = Math.max(pico, nivelDeMuestras(muestras));
      if (t - ultimo < PASO_ONDA_MS) return;
      ultimo = t;
      const barras = caja.querySelectorAll<HTMLElement>('[data-barra]');
      historia = [...historia, pico].slice(-barras.length);
      pico = 0;
      // La más nueva a la derecha: las de la izquierda que todavía no sonaron quedan en el piso.
      const vacias = barras.length - historia.length;
      barras.forEach((b, i) => {
        const h = i < vacias ? 0 : historia[i - vacias];
        b.style.transform = `scaleY(${(PISO_ONDA + (1 - PISO_ONDA) * h).toFixed(3)})`;
      });
    };
    cuadro = requestAnimationFrame(dibujar);
    return () => {
      cancelAnimationFrame(cuadro);
      try { fuente.disconnect(); } catch { /* noop */ }
      void ctx.close().catch(() => {});
    };
  }, [caja, flujo]);
  return (
    <div ref={setCaja} data-onda data-sigue-voz={sigueVoz ? '' : undefined} data-sin-oido={sigueVoz === false ? '' : undefined} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, height: 26, overflow: 'hidden' }}>
      {Array.from({ length: n }).map((_, i) => (
        // Las alturas las escribe el micrófono (arriba, en el DOM); sin él, todas en el piso: una línea.
        <span key={i} data-barra style={{ flex: 'none', width: 3, height: 22, borderRadius: 2, background: 'var(--good)', transformOrigin: 'center', transform: `scaleY(${PISO_ONDA})`, transition: 'transform 60ms linear', opacity: paused ? 0.5 : 1 }}></span>
      ))}
    </div>
  );
}

/** Lo que tarda el navegador en abrir el micrófono antes de pedirle a la persona que lo permita (su cartel puede no verse). */
const TARDA_MIC_MS = 2_500;

/** Mientras el navegador abre el micrófono: dicho con palabras, no con un punto gris (que se leía «no está grabando»). */
function AbriendoMic() {
  const [tarda, setTarda] = useState(false);
  useEffect(() => { const t = setTimeout(() => setTarda(true), TARDA_MIC_MS); return () => clearTimeout(t); }, []);
  return (
    <span role="status" data-abriendo-mic style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {tarda ? 'Permite el micrófono' : 'Abriendo el micrófono…'}
    </span>
  );
}

const btnRedondo: CSSProperties = { flex: 'none', width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 };
// `--sobre-good`: el color del ícono. Quien pinta la barra con otro `--good` (el onboarding de Offer: la tinta, que en oscuro
// es casi blanca) dice también con qué se lee encima; si no, el ✓ blanco desaparecía sobre el botón claro.
const btnVerde = (apagado: boolean): CSSProperties => ({ ...btnRedondo, width: 44, height: 44, background: 'var(--good)', color: 'var(--sobre-good, #fff)', cursor: apagado ? 'default' : 'pointer', opacity: apagado ? 0.6 : 1 });

/**
 * La fila de la barra, grabando y escuchando. `contain: inline-size` (12/11/2026, Martín: «grabé un audio y se corta… no se ve el
 * botón para enviar»): la barra mide lo que le da su caja y NUNCA empuja su ancho hacia afuera. El pie de los chats de Create es una
 * GRILLA (Copywriting `.nt-mako-pie`, Image `.pie`, el `<footer>` del Video Editor), y un hijo de grilla no baja de lo que pide su
 * contenido: la onda pedía su ancho en barras (y las cuenta según su ancho: crecía sola, 451 px en una tarjeta de 340) y el `range`
 * de escuchar, 129 px. El ➤ y el ✓ quedaban afuera. docs/hallazgos-chat.md.
 */
const BARRA: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, width: '100%', minWidth: 0, contain: 'inline-size' };

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
export function BarraGrabacion({ voz, ocupado = false, rotuloEnviar = 'Enviar audio', existente, colorPlay }: {
  voz: GrabacionVoz;
  ocupado?: boolean;
  rotuloEnviar?: string;
  existente?: { url: string; secs?: number | null; onBorrar: () => void; onDejar: () => void; onSeguir?: () => void } | null;
  /** El ▶ de escuchar lo grabado. Sin esto, el verde de WhatsApp (el de `AudioPlay`); la caja de los chats con MaKo
   *  (app/_chat/CajaChat.tsx) pasa el suyo (22/10/2026: en Offer era el único verde de la barra). */
  colorPlay?: string;
}) {
  const grabando = voz.fase === 'grabando';
  if (grabando) {
    const cerrando = voz.uniendo;
    // Con el micrófono pendiente no hay nada que pausar ni que terminar todavía; el 🗑 sí: cancela el pedido.
    const sinMic = voz.pidiendoMic;
    return (
      <div data-barra-voz="grabando" aria-label={sinMic ? 'Abriendo el micrófono' : voz.paused ? 'Grabación en pausa' : 'Grabando'} style={BARRA}>
        <style>{WAVE_CSS}</style>
        <button type="button" onClick={voz.descartar} disabled={cerrando} title="Eliminar grabación" aria-label="Eliminar grabación" style={{ ...btnRedondo, color: 'var(--bad)' }}><IconoBorrar size={20} /></button>
        {sinMic ? <AbriendoMic /> : (
          <>
            {/* GRABANDO: el punto rojo LATE y la onda sigue la voz. En pausa, el punto quieto y la onda apagada. */}
            <span data-punto-rec style={{ flex: 'none', width: 10, height: 10, borderRadius: '50%', background: '#e53935', animation: voz.paused ? 'none' : 'mako-latido 1.2s ease-out infinite', opacity: voz.paused ? 0.4 : 1 }}></span>
            <span style={{ flex: 'none', fontVariantNumeric: 'tabular-nums', fontSize: 14, color: 'var(--ink)', minWidth: 38 }}>{fmtDur(voz.secs)}</span>
            <OndaGrabando paused={voz.paused || cerrando} flujo={voz.flujo} />
          </>
        )}
        {voz.paused ? (
          <button type="button" onClick={voz.resume} title="Seguir grabando" aria-label="Seguir grabando" style={{ ...btnRedondo, color: 'var(--ink)' }}><IconMic /></button>
        ) : (
          <button type="button" onClick={voz.pause} disabled={cerrando || sinMic} title="Pausar" aria-label="Pausar grabación" style={{ ...btnRedondo, color: 'var(--ink)' }}><IconPause /></button>
        )}
        <button type="button" onClick={voz.terminar} disabled={cerrando || sinMic} title="Terminar grabación" aria-label="Terminar grabación" style={btnVerde(cerrando || sinMic)}><IconListo /></button>
      </div>
    );
  }
  const r = voz.revision ?? (existente ? { url: existente.url, secs: existente.secs ?? 0 } : null);
  if (!r) return null;
  const propia = !!voz.revision;
  const apagado = ocupado || voz.uniendo;
  return (
    <div data-barra-voz="revisando" style={BARRA}>
      <button type="button" onClick={() => (propia ? voz.descartar() : existente?.onBorrar())} disabled={apagado} title="Borrar el audio" aria-label="Borrar el audio" style={{ ...btnRedondo, color: 'var(--bad)' }}><IconoBorrar size={20} /></button>
      {/* ▶ DONDE ESTABA EL PUNTO ROJO: el reproductor de la casa, a todo el ancho. */}
      <AudioPlay key={r.url} src={r.url} duracion={r.secs || null} velocidad={false} style={{ flex: 1, minWidth: 0, width: 'auto' }} {...(colorPlay ? { color: colorPlay } : {})} />
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
