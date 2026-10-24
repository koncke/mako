'use client';

// =============================================================================
// dictado-vivo — el texto aparece MIENTRAS hablás, sin pasar por nuestro server
// =============================================================================
// El reporte, textual (23/09/2026): «se tarda mucho en procesar la transcripción de lo que
// digo, cuando en otras apps es casi que inmediato, le voy dictando y lo va escribiendo».
//
// Y no era lentitud de nuestra cascada: era el CAMINO. Dictar era grabar todo → parar →
// armar un `FormData` → subirlo → esperar a que un modelo lo transcriba → pegar el texto.
// O sea que nada aparece hasta que terminás de hablar, y después hay una espera de red más
// una de modelo. Las apps con las que lo compara no transcriben en un server: usan el
// reconocimiento de voz DEL NAVEGADOR, que corre local, escribe mientras hablás y no cuesta
// nada.
//
// ⚠️ ES UNA CAPACIDAD DEL NAVEGADOR, NO UN ESTÁNDAR PAREJO. `SpeechRecognition` existe en
// Chrome, Edge y Safari (con prefijo `webkit`) y NO en Firefox. Por eso esto no reemplaza
// al camino viejo: lo adelanta. Si el navegador no lo trae, `soportado` es false y el botón
// vuelve a grabar y subir — que es más lento pero funciona en todos lados.
//
// ⚠️ Y NO SE PUEDE SABER SI HAY PERMISO SIN PEDIRLO. `start()` tira `not-allowed` cuando el
// micrófono está bloqueado, así que el fallback también cubre ese caso: se degrada al
// camino de grabar, que pide el permiso por el otro lado y da un error claro.
//
// ⚠️ EN ANDROID CADA RESULTADO TRAE TODO LO DICHO HASTA AHÍ (24/10/2026). Martín lo reportó el 17/10 («cuando lo probé, se
// dicta y se duplica lo que dije») y le volvió a pasar el 24/10, con un dictado de UNA vez que salió «continúa continúa con
// continúa con todo continúa con todo porque…». No repite palabras sueltas: repite el PREFIJO creciendo. El Chrome de
// Android, con `continuous` e `interimResults`, entrega cada resultado final con la frase ACUMULADA («continúa», después
// «continúa con», después «continúa con todo»), y el código los pegaba uno atrás del otro, como hace bien Chrome de
// escritorio (que entrega pedazos sueltos). Ahora cada resultado se SUMA con `sumarDictado`: si el nuevo ya empieza con lo
// acumulado, lo reemplaza; si es lo mismo, no suma nada; si es otro pedazo, va atrás. Lo fija tests/dictado-vivo.test.ts
// con la frase textual del 24/10.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';

/** Lo mínimo de la API que usamos. No está en la lib de TS: es una capacidad del navegador. */
type ResultadoReconocimiento = {
  readonly isFinal: boolean;
  readonly length: number;
  item(i: number): { transcript: string };
  [i: number]: { transcript: string };
};
type EventoReconocimiento = {
  readonly resultIndex: number;
  readonly results: { readonly length: number; item(i: number): ResultadoReconocimiento; [i: number]: ResultadoReconocimiento };
};
type Reconocimiento = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: EventoReconocimiento) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type CtorReconocimiento = new () => Reconocimiento;

function ctor(): CtorReconocimiento | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: CtorReconocimiento; webkitSpeechRecognition?: CtorReconocimiento };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Los errores que le importan a quien está dictando, en su idioma. */
const MOTIVO: Record<string, string> = {
  'not-allowed': 'El navegador no me dejó usar el micrófono. Habilítalo en el candado de la barra de direcciones.',
  'service-not-allowed': 'El navegador no me dejó usar el micrófono. Habilítalo en el candado de la barra de direcciones.',
  'audio-capture': 'No encontré ningún micrófono conectado.',
  network: 'El reconocimiento de voz del navegador se quedó sin conexión.',
};

export type DictadoVivo = {
  /** ¿este navegador puede dictar en vivo? Si no, hay que usar el camino de grabar y subir. */
  soportado: boolean;
  escuchando: boolean;
  arrancar: () => void;
  parar: () => void;
};

/**
 * Dictado en vivo.
 *
 * @param onTexto  se llama en CADA palabra con el texto acumulado de ESTA sesión de dictado
 *                 (no con el del campo). Quien lo consume decide cómo pegarlo a lo que ya
 *                 había escrito — de otra forma, un dictado que corrige una palabra a mitad
 *                 de camino duplicaría el resto.
 */
export function useDictadoVivo(onTexto: (textoDeLaSesion: string, final: boolean) => void, onError: (m: string) => void): DictadoVivo {
  const [soportado, setSoportado] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const rec = useRef<Reconocimiento | null>(null);
  const finalRef = useRef('');
  // Los callbacks en un ref: el reconocimiento vive entre renders y capturar el primero
  // dejaría el texto pegándose en un `setState` viejo.
  const cbTexto = useRef(onTexto);
  const cbError = useRef(onError);
  useEffect(() => { cbTexto.current = onTexto; cbError.current = onError; });

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSoportado(ctor() != null); }, []);

  // Al desmontar se ABORTA, no se para: `stop()` procesa lo último y dispara `onresult`
  // sobre un componente que ya no existe.
  useEffect(() => () => { try { rec.current?.abort(); } catch { /* ya estaba muerto */ } }, []);

  const parar = useCallback(() => {
    setEscuchando(false);
    try { rec.current?.stop(); } catch { /* no estaba escuchando */ }
  }, []);

  const arrancar = useCallback(() => {
    const C = ctor();
    if (!C) return;
    try { rec.current?.abort(); } catch { /* no había */ }
    finalRef.current = '';
    const r = new C();
    // El español de México: es el de Mauricio y el de sus clientes. No se adivina del
    // navegador — `navigator.language` es el idioma de la INTERFAZ, no el que se habla.
    r.lang = 'es-MX';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const t = textoDelEvento(finalRef.current, e);
      finalRef.current = t.final;
      cbTexto.current(t.mostrar, false);
    };
    r.onerror = (e) => {
      // `no-speech` y `aborted` son parte del uso normal (te callaste, o cortaste vos): no
      // son un error que alguien tenga que leer.
      if (e.error !== 'no-speech' && e.error !== 'aborted') cbError.current(MOTIVO[e.error] ?? `El dictado se cortó (${e.error}).`);
      setEscuchando(false);
    };
    r.onend = () => {
      setEscuchando(false);
      cbTexto.current(finalRef.current.trim(), true);
    };
    rec.current = r;
    try { r.start(); setEscuchando(true); }
    catch (err) { cbError.current(err instanceof Error ? err.message : 'No pude arrancar el dictado.'); }
  }, []);

  return { soportado, escuchando, arrancar, parar };
}

/** Una palabra para comparar: sin mayúsculas, sin tildes y sin la puntuación que el reconocedor agrega o saca. */
const normal = (s: string): string[] => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);

/**
 * Suma un resultado del reconocedor a lo que ya se dictó en esta sesión.
 *   · Chrome de escritorio entrega PEDAZOS («hola» y después «cómo estás»): van uno atrás del otro.
 *   · Chrome de Android entrega la frase ACUMULADA («continúa», «continúa con», «continúa con todo»): el nuevo ya trae lo
 *     anterior, y gana el nuevo. Se compara por palabras normalizadas: entre un resultado y el siguiente cambian la
 *     mayúscula, una tilde o una coma.
 *   · El mismo resultado dos veces (un final que repite al interino, o un final viejo reenviado) no suma nada.
 * ⚠️ El costo, a sabiendas: quien dicte dos veces seguidas exactamente lo mismo («no» y «no») queda con una sola. Es raro, y el
 *    Android que duplicaba cada frase le pasa a cualquiera que dicte desde el teléfono.
 */
export function sumarDictado(acumulado: string, nuevo: string): string {
  const a = acumulado.trim();
  const n = nuevo.trim();
  if (!n) return a;
  if (!a) return n;
  const pa = normal(a);
  const pn = normal(n);
  if (!pn.length) return a;
  // El nuevo empieza con TODO lo acumulado (Android): es la frase entera, corregida y más larga.
  if (pn.length >= pa.length && pa.every((w, i) => pn[i] === w)) return n;
  // Lo acumulado ya termina con el nuevo (un final que repite lo último que se vio), o ya EMPIEZA con él (un Android que
  // reenvía en cada evento los finales viejos, desde el primero): nada que sumar.
  if (pn.length <= pa.length && pn.every((w, i) => pa[pa.length - pn.length + i] === w)) return a;
  if (pn.length <= pa.length && pn.every((w, i) => pa[i] === w)) return a;
  return `${a} ${n}`;
}

/** Lo mínimo de un evento del reconocedor que se lee (el `onresult`). */
type EventoDictado = Pick<EventoReconocimiento, 'resultIndex' | 'results'>;

/**
 * Lo que deja un evento del reconocedor: `final` es lo dictado y ya firme (para el próximo evento), `mostrar` es eso más lo
 * que todavía se está oyendo. Pura: la usan el hook y su test.
 */
export function textoDelEvento(final: string, e: EventoDictado): { final: string; mostrar: string } {
  let firme = final;
  let interino = '';
  for (let i = e.resultIndex; i < e.results.length; i++) {
    const res = e.results[i];
    const txt = res[0]?.transcript ?? '';
    if (res.isFinal) firme = sumarDictado(firme, txt);
    else interino = sumarDictado(interino, txt);
  }
  return { final: firme, mostrar: sumarDictado(firme, interino) };
}

/** Pega lo dictado a lo que ya estaba escrito, sin comerse el espacio ni duplicarlo. */
export function unirDictado(base: string, dictado: string): string {
  const b = base.trimEnd();
  const d = dictado.trim();
  if (!d) return base;
  if (!b) return d;
  return `${b} ${d}`;
}
